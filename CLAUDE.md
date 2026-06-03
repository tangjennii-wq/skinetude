# CLAUDE.md — Frida agent rules

Project-level rules for Claude (and any future agent) working in this repo.
Brand depth lives in `BRAND.md`. This file is the operating contract.

---

## Voice

**Tang & Gainey are doctors, but NOT dermatologists.**
Tang = nephrologist. Gainey = gastroenterologist. Position them as obsessed enthusiasts who've spent twenty years reading skincare papers for fun, never as clinical dermatology authority. They have opinions because they're smart and read the literature, not because they're board-certified to treat your skin.

**Tone**: direct, warm, dry, brief, a little dark. Two best friends texting, not a wellness brand. Calibrated against actual founder texting cadence.

**Three AI personas** (used in prompts via `ETUDE_VOICE_PREFIX`):
- **Jenni** — the more grounded one (relative to Gainey, not to a normal person)
- **Gainey** — sharper, more chaotic, more brilliant, lovably unhinged
- **Blend** — both voices fused (default for most copy)

Every user-facing prompt that calls `callClaude` should prepend the voice prefix unless explicitly opting out. Search for `ETUDE_VOICE_PREFIX` for the canonical text.

---

## Retired words — do not use

These are banned from all UI copy, prompts, and analysis text:

- **rhythm** — retired 2026-05-14. Use *routine, cadence, regimen, week, system*.
- **ritual** — retired 2026-05-18. Use *regimen, routine, check-in*.

If you find these in existing code while editing nearby, fix them.

---

## No causal claims

We have snapshot data, not attribution. Don't write copy like:

- "What lifted Friday's score" → instead: "Friday's read"
- "Thanks to your niacinamide" → instead: "Your niacinamide is in the mix"
- "Your barrier improved because…" → instead: "Your barrier reads steady"

Stay descriptive. Never imply a product *caused* a measured outcome. The composite is a snapshot; the trend is what matters; correlation is not causation; we report what we see.

---

## Composite Index v1 (June 2026)

The score is computed in `src/resolvers/compositeIndex.js`. Rules:

- **5 outcome domains**: redness, hydration, texture, breakouts, barrier.
- **Sensitivity is NOT a domain.** A photo can't see felt-sense reactivity. It remains only as a user-self-report chip. Do not re-add it to AI extraction prompts.
- **Per-domain blend**: 50% AI photo + 30% noticed chip + 20% overall 1-10 rating. Renormalizes when an input is missing.
- **Baseline**: median of first 10 strong logs. Modes: `establishing` (n<7), `forming` (7–9), `anchored` (10+), `refreshing` (90+ days old).
- **Delta over absolute**: surface change-from-baseline more prominently than the absolute number. Skin scores are noisy day-to-day — the trend is the honest signal.
- **Goal weighting**: domain weights modulate by `userProfile.actionGoal` (BARRIER_REPAIR, ACNE_REDUCTION, ANTI_AGING, etc.).

If you change any of these defaults, update `ScoreExplainerModal.jsx` so the explainer matches the math.

---

## Design direction

- **Mobile-first, 380px width.** Frida is mobile-primary; desktop is enhancement. Design at 380px first.
- **Editorial apartment, not luxury SaaS.** Brooklyn loft / curated. Museum-shelf composition. **When in doubt, REMOVE rather than add.** One focal point per section.
- **Typography**: Figtree as hero font. Hierarchy: 600 eyebrows / 700 headlines / 400 body. **No italics globally** — they got killed for being twee.
- **Color palette**: white page bg, red `#E53C2D` hero, AWW accents (dusty pink, powder blue, mustard, sage). Gold accent locked at `#E8B335` for AM / sun states.
- **No bottle imagery.** Product art is text/icon-only.

---

## Code structure

- `index.jsx.source` — the sidecar source of truth. Edit this, not `index.html` directly.
- `src/components/*.jsx`, `src/resolvers/*.js` — component + resolver files concatenated into the bundle.
- `build_current.js` — the build script. **Always run `node build_current.js` after editing src/ files**, otherwise the browser keeps serving stale `index.html`.
- `data/` — product catalog, brands, ingredient mappings.
- `supabase/functions/` — edge functions (Gemini proxy, etc.).

The bundle is generated, single-file, and deployed to `tangjennii-wq.github.io/skinetude/`.

---

## Agent-facing workflow rules

1. **Prompt before non-trivial changes.** For UX/structural decisions or anything that touches >1 component, present a plan and wait for approval before editing.
2. **Run the build after src/ edits.** `node build_current.js` from the repo root. Verify with grep against `index.html` that your changes landed.
3. **Verification before "done".** Don't declare work complete based on intent — re-grep the bundle for the new strings/symbols you added.
4. **Don't reintroduce retired words.** Search for `rhythm` and `ritual` before any large copy pass.
5. **Don't reintroduce sensitivity as an AI metric domain.** It was dropped deliberately; the model rejection is intentional.
6. **Run `regression-guardrail` before structural commits.** After any non-trivial change to `index.jsx.source`, `src/components/*.jsx`, or `src/resolvers/*`, invoke the `regression-guardrail` subagent (`.claude/agents/regression-guardrail.md`) to verify the seven fundamental flows still work. Catalog: photo upload → analysis fires, product save → today's log updated, done-state inheritance on slot-add, cover token bumps after writes, composite math integrity, no banned words, sensitivity stays dropped. Add new flows to the catalog when new incident-driven invariants emerge.
7. **Use the centralized helpers in `src/resolvers/logHelpers.js`.** When creating photo logs, use `createPhotoLogs({ shots, apiKeyOn, ... })` — it returns `{ newLogs, fireAnalysis }`. When promoting products to the weekly routine, use `addProductToRoutine(product, slot)` (single) or `addManyToRoutine(list, ids, slot)` (batch). These wrap the load-bearing patterns (analyzing flag, retryLogAnalysis worker pool, suggestedCadence safety check). Don't hand-roll the log shape or hardcode `cadence: { days: [0,1,2,3,4,5,6] }` ever — every parallel call site that did so caused a regression. If the helpers don't cover your case, EXTEND them; don't fork.

## Other subagents available

In addition to `regression-guardrail`, the repo has six other reviewers in `.claude/agents/`:

- **brand-voice-auditor** — scans copy for retired words, italics, off-brand phrasing, causal claims
- **brand-voice-rewriter** — rewrites flagged copy into Tang & Gainey voice
- **design-direction-critic** — flags layout / visual choices that drift from the editorial-apartment direction
- **interaction-loading-detective** — catches onboarding-shows-at-wrong-time, stuck spinners, first-time cards with no permanent re-entry, modal stack escape hatches, state transition flashes
- **mobile-first-qa** — checks 380px-first layout, touch targets, scroll behavior
- **stratechery-critic** — strategic / surface-area critique through a Ben Thompson lens

Use them deliberately. Brand voice + design before any copy or layout ships; regression-guardrail + interaction-loading-detective before any structural or modal/onboarding commit; stratechery + mobile-first for periodic audits.

---

## Where to look first

- `BRAND.md` — long-form brand exposition, voice examples, founders.
- `RECOMMENDATIONS.md` — how the rec engine is supposed to behave.
- `SUPABASE_SETUP.md` — Supabase project + edge function config.
- `src/resolvers/compositeIndex.js` — the composite score math.
- `src/components/HomeDashboard.jsx` — the cover, where the score + chip rail render.
- `index.jsx.source` around the `// === FRIDA VOICE: TWO DOCTOR FRIENDS ===` marker — `ETUDE_VOICE_PREFIX` lives there.
