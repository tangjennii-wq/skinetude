# Supabase Gemini Proxy — Setup

This wires the Étude / Skinetude app to a Supabase Edge Function so the
Gemini API key lives server-side instead of being shipped in the client bundle.

**What you get**

- Gemini key hidden behind Supabase, not visible in the deployed JS.
- Per-device daily caps: **40 image generations + 200 text/vision calls**
  (~$2/user/day worst-case ceiling). Capped per-`localStorage`-UUID, resets
  at midnight UTC.
- CORS locked to `https://tangjennii-wq.github.io`.
- BYO-key escape hatch: if a user pastes their own Gemini key in Settings,
  the app talks to Google directly and bypasses the proxy + caps.

Project ref: **`vdtmflgetzilcgtcsogt`**
GitHub origin: **`https://tangjennii-wq.github.io`**

---

## Files added

- `supabase/functions/gemini-proxy/index.ts` — the Edge Function
- `supabase/migrations/20260503000000_gemini_usage.sql` — the rate-limit table + RPC

## Files changed

- `index.jsx.source` — Gemini calls now go through `callGeminiProxied()`.
  Hardcoded `DEFAULT_GEMINI_KEY` has been removed; the old value is in a
  retirement list so any user with it cached in localStorage gets cleared.
- `index.html` — rebuilt from the patched sidecar.

---

## One-time setup

### 1. Install the Supabase CLI

```bash
brew install supabase/tap/supabase
# or: npm i -g supabase
supabase --version   # should print 1.x or higher
```

### 2. Log in and link the project

```bash
cd /Users/jennitang/Developer/TangSkin
supabase login                                  # opens a browser
supabase link --project-ref vdtmflgetzilcgtcsogt
```

The link command will ask for the database password. Find it in
**Supabase dashboard → Project Settings → Database → Connection string**
(or reset it from there if you don't remember).

### 3. Apply the SQL migration

```bash
supabase db push
```

This creates `gemini_usage` and the `check_and_bump_gemini` function with
RLS locked down so only the service role can read/write.

If you'd rather not use the CLI for this, paste the contents of
`supabase/migrations/20260503000000_gemini_usage.sql` into the Supabase
dashboard's SQL editor and click **Run**.

### 4. Set the Gemini API key as a secret

Get a key at https://aistudio.google.com/apikey if you don't have one.
**Important**: rotate the old `AIzaSyACBlFyOukgnhCf8...` key — it was previously
hardcoded in the public bundle, so treat it as compromised.

```bash
supabase secrets set GEMINI_API_KEY=YOUR_FRESH_KEY_HERE
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-populated by
Supabase for Edge Functions — you don't need to set them.

### 5. Deploy the Edge Function

```bash
supabase functions deploy gemini-proxy --no-verify-jwt
```

`--no-verify-jwt` is important: it lets the browser call the function
without sending a Supabase auth token. The function does its own
identity check via the `x-device-id` header.

### 6. Smoke test

```bash
curl -i -X POST \
  -H 'Content-Type: application/json' \
  -H 'x-device-id: 11111111-2222-3333-4444-555555555555' \
  -H 'Origin: https://tangjennii-wq.github.io' \
  -d '{"mode":"text","model":"gemini-2.5-flash","payload":{"contents":[{"parts":[{"text":"say hi in 5 words"}]}]}}' \
  https://vdtmflgetzilcgtcsogt.supabase.co/functions/v1/gemini-proxy
```

Expected: `HTTP/2 200` plus a Gemini response JSON. If you see `403
origin_not_allowed`, the Origin header isn't on the allowlist. If you see
`429 rate_limit_exceeded`, you've already burned that test device's daily quota.

---

## How it fits together

```
Browser (https://tangjennii-wq.github.io/skinetude/)
   │
   │  fetch POST  https://vdtmflgetzilcgtcsogt.supabase.co/functions/v1/gemini-proxy
   │  headers: x-device-id: <uuid from localStorage>
   │  body:    { mode: "image" | "text", model, payload }
   ▼
Edge Function (gemini-proxy)
   │  1. CORS allowlist check  (Origin must be tangjennii-wq.github.io)
   │  2. Validate device-id    (UUID-ish)
   │  3. RPC check_and_bump_gemini(device, mode, cap)   ← atomic in Postgres
   │  4. Proxy to Gemini with GEMINI_API_KEY secret
   ▼
Google Gemini API
```

## Operations cheatsheet

**See current usage**

```sql
select device_id, day, mode, count
from public.gemini_usage
where day >= current_date - 7
order by day desc, count desc
limit 50;
```

**Reset one device's quota**

```sql
delete from public.gemini_usage
where device_id = '<uuid>'
  and day = current_date;
```

**Tighten or loosen the caps** — edit `DAILY_CAPS` at the top of
`supabase/functions/gemini-proxy/index.ts` and redeploy:

```bash
supabase functions deploy gemini-proxy --no-verify-jwt
```

**Add a new allowed origin** (e.g. a custom domain) — edit
`ALLOWED_ORIGINS` in the same file and redeploy.

**Rotate the Gemini key**

```bash
supabase secrets set GEMINI_API_KEY=NEW_KEY
# Edge Functions pick up new secrets within seconds — no redeploy needed.
```

## Troubleshooting

- **`origin_not_allowed`**: the browser sent an Origin not in `ALLOWED_ORIGINS`.
  Check the deployed app URL exactly (no trailing slash).
- **`missing_or_invalid_device_id`**: `x-device-id` header missing or
  not UUID-shaped. The client sets this automatically; clearing
  localStorage and reloading will regenerate it.
- **`rate_limit_exceeded`**: that device hit 30 images or 100 text calls
  for today. Either wait until midnight UTC, paste a personal Gemini key
  in Settings to bypass, or query the table to bump it manually.
- **Function logs**: `supabase functions logs gemini-proxy` (or the
  Logs tab in the dashboard) — every call writes its outcome.
- **CORS errors in the browser console**: usually means the origin
  isn't allowlisted. The function returns a `Vary: Origin` header so
  caches don't poison across origins.
