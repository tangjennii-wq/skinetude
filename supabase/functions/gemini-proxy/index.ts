// supabase/functions/gemini-proxy/index.ts
//
// Proxies Google Gemini API calls so the API key lives in Supabase secrets
// instead of being shipped in the client bundle. Enforces:
//   - CORS allowlist (only the deployed app origin)
//   - Per-device daily caps (see DAILY_CAPS — free-tier sizing)
//
// Identity = client-generated UUID sent in `x-device-id`. No Supabase auth.
// Deploy with --no-verify-jwt so the browser doesn't need an anon key.
//
// Required secrets (set via `supabase secrets set`):
//   GEMINI_API_KEY        — your Google AI Studio key
//   SUPABASE_URL          — auto-populated by Supabase, but readable here
//   SUPABASE_SERVICE_ROLE_KEY — auto-populated, used for the rate-limit RPC

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  "https://tangjennii-wq.github.io",
  // local dev — comment out before going prod-only if you want
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "null", // file:// origins (when opening index.html directly) report as "null"
]);

// Per-device daily caps.
//
// === FREE-TIER SIZING (July 2026) ===
// The proxy now runs on a FREE-TIER Google AI Studio key ($0). Free-tier
// quota is per-PROJECT, not per-device — every user draws from one shared
// daily pool (roughly a few hundred Flash requests/day; Google no longer
// publishes exact numbers — check aistudio.google.com/rate-limit). These
// per-device caps exist so one heavy user can't drain the whole pool:
//   - text 50/day/device ≈ a full day of check-ins + chat for one person
//   - image 5/day/device ≈ product-art gen trickles in over a few days
// Image gen (Nano Banana) has little/no free-tier quota on many projects —
// the client already degrades to text/icon product art when it fails.
//
// To flip back to a paid key later: `supabase secrets set GEMINI_API_KEY=…`
// with a billing-enabled key, and consider restoring the old paid-tier caps
// (image: 40, text: 200 — ~$2/device/day worst case at 2026 Flash pricing).
const DAILY_CAPS = {
  image: 5,
  text: 50,
} as const;

type Mode = keyof typeof DAILY_CAPS;

// UUID v4 (or any reasonably unique 32+ hex/uuid-ish token)
const DEVICE_ID_RE = /^[a-f0-9-]{16,64}$/i;

// ─── HELPERS ───────────────────────────────────────────────────────────────
function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-device-id, authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: unknown, init: ResponseInit & { origin?: string | null } = {}) {
  const { origin = null, ...rest } = init;
  return new Response(JSON.stringify(body), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...(rest.headers || {}),
    },
  });
}

// ─── ENV ───────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!GEMINI_API_KEY) console.error("[gemini-proxy] GEMINI_API_KEY not set");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[gemini-proxy] Supabase env vars missing");
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── HANDLER ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get("origin");

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Origin gate (defense in depth — CORS already blocks the browser)
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "origin_not_allowed", origin }, { status: 403, origin });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405, origin });
  }

  // Device identity
  const deviceId = (req.headers.get("x-device-id") || "").trim();
  if (!DEVICE_ID_RE.test(deviceId)) {
    return json({ error: "missing_or_invalid_device_id" }, { status: 400, origin });
  }

  // Body
  let body: { mode?: Mode; model?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400, origin });
  }

  const mode = body.mode;
  const model = body.model;
  const payload = body.payload;

  if (!mode || !(mode in DAILY_CAPS)) {
    return json({ error: "invalid_mode", expected: Object.keys(DAILY_CAPS) }, { status: 400, origin });
  }
  if (typeof model !== "string" || !/^[a-zA-Z0-9._-]{3,80}$/.test(model)) {
    return json({ error: "invalid_model" }, { status: 400, origin });
  }
  if (!model.startsWith("gemini-")) {
    return json({ error: "model_not_allowed", model }, { status: 400, origin });
  }
  if (!payload || typeof payload !== "object") {
    return json({ error: "missing_payload" }, { status: 400, origin });
  }

  // Rate-limit check + bump (atomic in Postgres)
  const cap = DAILY_CAPS[mode];
  const { data: rl, error: rlErr } = await sb.rpc("check_and_bump_gemini", {
    p_device: deviceId,
    p_mode: mode,
    p_limit: cap,
  });

  if (rlErr) {
    console.error("[gemini-proxy] rate-limit RPC failed:", rlErr);
    return json({ error: "rate_limit_check_failed", detail: rlErr.message }, { status: 500, origin });
  }

  // RPC returns a single-row table → array of one row
  const row = Array.isArray(rl) ? rl[0] : rl;
  if (!row?.allowed) {
    return json(
      {
        error: "rate_limit_exceeded",
        mode,
        used: row?.current_count ?? cap,
        limit: cap,
        resets_at: "midnight UTC",
      },
      { status: 429, origin },
    );
  }

  // Proxy to Gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const aborted = (e as Error)?.name === "AbortError";
    return json(
      { error: aborted ? "upstream_timeout" : "upstream_network_error", detail: String(e) },
      { status: 502, origin },
    );
  }
  clearTimeout(timeout);

  const text = await upstream.text();
  // Pass through status + body so the client's existing error parsing keeps working
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "X-RateLimit-Limit": String(cap),
      "X-RateLimit-Remaining": String(Math.max(0, cap - (row.current_count ?? 0))),
      "X-RateLimit-Mode": mode,
      ...corsHeaders(origin),
    },
  });
});
