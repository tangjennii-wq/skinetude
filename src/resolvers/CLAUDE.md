# CLAUDE.md — Resolver rules

Rules for any agent editing `src/resolvers/*`. These files are the math + parsing layer that the rest of the app depends on. They must stay deterministic, pure, and back-compat. Bugs here ripple everywhere.

Repo-level rules in `/CLAUDE.md` still apply. These are additional.

---

## Composite math is sacred

`compositeIndex.js` is the canonical score implementation. If you change any of:

- The 5 domains (`COMPOSITE_DOMAINS`)
- The input-blend weights (`WEIGHT_AI`, `WEIGHT_CHIP`, `WEIGHT_OVERALL`)
- The chip-to-domain map (`CHIP_TO_DOMAIN`)
- The goal-weight multipliers (`GOAL_WEIGHTS`)
- The baseline policy (`BASELINE_TARGET_N`, `BASELINE_PATTERN_THRESHOLD`, `BASELINE_REFRESH_DAYS`)

…you must also update `src/components/ScoreExplainerModal.jsx` so the explainer drawer doesn't lie to the user. The two files are a single contract surfaced in two places.

**Do not** silently change the chip-deficit (`CHIP_DEFICIT_SCORE` = 35) or chip-neutral (`CHIP_NEUTRAL_SCORE` = 70) anchors. They're calibrated against the 100/80/55/30/10 scale used everywhere else. Drifting them rebalances every domain score across every user's history.

---

## Sensitivity stays dropped

Sensitivity was removed as an AI outcome domain in June 2026 — a photo can't see felt-sense reactivity. **Do not** re-add it to:

- `COMPOSITE_DOMAINS`
- `COMPOSITE_SCORE_MAP`
- The AI extraction prompt in `index.jsx.source` (`GEMINI_METRIC_PROMPT`, Haiku fallback)
- The chip rail tile sets in `HomeDashboard.jsx` / `JournalTodayPanel.jsx`

Sensitivity remains as a user-self-report chip (`OBSERVATION_CHIPS_BASE`) and as **context**, never as an outcome.

---

## Parser back-compat

`parseSkinMetrics.js` and `parseSkinRegion.js` handle multiple legacy log shapes (METRICS: line, inlined bullets, missing fields). Any change must:

- Still parse legacy logs from before each shape was canonical
- Pass `null` (not `undefined`, not `{}`) when nothing was recoverable — downstream consumers check `!== null`
- Never throw on malformed input — wrap with try/catch and return null

Run `grep -n "parseSkinMetrics\|parseSkinRegion" index.jsx.source` and check every call site if you change the return shape.

---

## Pure functions only

Resolvers must be **pure**:
- No React imports
- No `useState`/`useEffect`
- No `localStorage` / `sessionStorage` / `document` / `window` access
- No side effects — they take inputs, return outputs
- No `Date.now()` inside the math (pass dates as args so tests are deterministic)

If you need state, lift it to the App-scope caller. The resolver layer is unit-testable; once it stops being pure, it isn't.

---

## Build-step coupling

These files are concatenated into the bundle by `build_current.js`. The concatenation order in `SRC_FILES` matters:

- `parseSkinMetrics.js` ships before `normalizeRatingTo5.js` ships before `compositeIndex.js` (composite depends on the others indirectly — keep it after them).
- New resolver files must be added to `SRC_FILES` in `build_current.js`. Otherwise they exist in the repo but don't make it into `index.html`.
- After editing any resolver, run `node build_current.js` and grep `index.html` for a unique symbol from your change to confirm it landed.

---

## Naming

Module-scope `const` declarations (no `export`) — the bundle is a single concatenated file, so `const name = ...` at module scope is automatically global to the rest of the bundle. Don't introduce `export`/`import` syntax here without also updating `build_current.js` to handle it.

---

## Where the math is consumed

If you change a resolver, check what depends on it before declaring done:

- `aiScoreFromLog`, `displayScore` (in `index.jsx.source`) wrap `computeCompositeScore`
- `HomeDashboard.jsx` reads composite + baseline + delta + most-benign pattern
- `JournalTodayPanel.jsx` reads `metricsRaw` derived from the snapshot
- `ScoreExplainerModal.jsx` describes the math in plain English
- `MetricTrendsGrid.jsx` reads per-domain history
- Compare view reads per-domain deltas

Grep for the function name before refactoring its signature.
