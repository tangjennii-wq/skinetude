# Étude — Technical Baseline v2

**Snapshotted:** May 6, 2026
**State:** Functional, polished editorial baseline. Stable foundation before the personality/voice imbuing phase.

## What this is

A frozen copy of `index.html` + `index.jsx.source` representing the app at the moment the major UI / interaction polish was complete, persistence and analysis pipelines were hardened, and the editorial design language was established. This is the "good-enough" technical floor before we layer in personality, vibes, and Tang & Gainey voice work on top.

Use as the rollback point if anything in the personality/voice phase breaks the app.

## How to revert

```bash
cp _baseline_v2/index.html index.html
cp _baseline_v2/index.jsx.source index.jsx.source
```

Then re-deploy.

## What you keep by reverting to v2 (delta vs v1)

### Persistence + reliability
- `saveData` guest-namespace fallback (no more silent drops when not signed in)
- `saveToSupabase` UPSERT with `onConflict: 'user_id'`
- `loadFromSupabase` localStorage fallback path
- Null-guarded `user.cloud` access (no crashes for guest users)
- 60-second `AbortController` timeout on every Claude API call
- Recurring 30s watchdog that auto-clears any `analyzing: true` flag older than 120s
- `analyzingStartedAt` timestamps on every analysis trigger so the watchdog can identify stale flags
- One-shot boot scrub for analyzing flags loaded from storage

### Cover (Atelier) page
- "Good afternoon, [name]" greeting with sage botanical sprig
- Skin Snapshot card with rounded photo + bottom-right camera affordance
- "Today" headline (italic terracotta when photo logged)
- 2-line AI-derived description: primary read + supporting observation
- Score block: `9.0 /10` + `SKIN READ` micro-label + muted `you read: X.X`
- 4-column horizontal metric strip (Redness · Hydration · Texture · Breakouts)
- Half-pill CTA row: filled `Read analysis →` + ghost `Compare`
- "Check in again" italic link beneath
- Ritual card with 3 uniform pill buttons in even grid:
  - `Repeat` / `Repeated` (toggle pill, white ↔ terracotta with undo)
  - `+ Add new` (opens Find a Product hub)
  - `Eye + Shelf (N)` (count derived from active products)
- Today actives chip rail (Niacinamide · Vitamin C · Hyaluronic Acid · etc.)
- AM / PM routine bottle silhouettes
- Étude Insight card (BETA)
- This Week strip with photo previews

### Add Product flow (global)
- Single canonical `<ProductModal />` reachable from every entry point
- Find a Product hub: 3 stacked option cards
  - Scan product (label OCR via Gemini Vision)
  - Search product (typeahead + URL paste)
  - Search by brand (brand list → brand SKUs with category chips)
- `BrandPicker` module-scope component with smooth local-state typing
- Defensive useEffect that resets `productEntryMode → 'choose'` whenever the modal closes — re-opening always lands on the hub

### Skin Read drawer
- Full-bleed `mobile-full-sheet` on phones (no top gap)
- Sticky 36px close chip in upper-right
- Photo + 7-day trend chart side-by-side
- Real rating chart: SMTWTFS x-axis, 0/5/10 y-ticks, hairline gridlines, today's filled dot
- 5-metric tile strip
- ÉTUDE Analysis bullets with context-aware icons
- Same-day siblings nav (◀ N of M today ▶)

### Modals (universal)
- `Modal` wrapper: floating card on every viewport, `.modal-card` CSS class with progressive enhancement (`max-height: 92vh; max-height: 92dvh;`)
- Bigger 36px cream close chip with hairline border
- Date / Area row in SkinLogModal: strict 2-col grid (`minmax(0, 1fr)`), identical 44px height + 10px radius + 12px padding on both inputs
- Tighter mobile padding (px-3 / py-2 in compact mode)

### Typing-jerk fixes
- `StableInput` (module scope) — uncontrolled with defaultValue + ref
- `LocalSearchInput` (module scope) — owns local state, optional debounce
- `BrandPicker` — module-scope component with local search state
- `ChatInputBox` — module-scope component for Counsel chat
- Applied across ProductModal, ProcedureModal, EventModal, ColorModal, RegimenCheckIn, SkinLogModal text inputs

### Editorial palette
- Full semantic token set: `--bg-main`, `--bg-card`, `--text-primary/secondary/tertiary`, `--border-soft/mid`, `--accent-primary` + hover + soft, `--accent-sage` + dark + soft, `--accent-ink`
- Legacy aliases (`--cream`, `--ink`, `--accent`, etc.) mapped onto the new tokens for backwards compatibility — no breaking refactor needed
- Card-lifts-off-page contrast: `--bg-card` is BRIGHTER than `--bg-main`

### Other notable polish
- "+ Product" pill in `EditorialPageHeader` (terracotta-outlined, leading Plus icon)
- "Yesterday's regimen" → `Repeat` toggle with undo
- Cover Analysis button → "Reading…" loader during in-flight analysis
- Regimen tab compact card pair (Your routine vs Recommended)
- Brand search smooth typing (no more one-letter-at-a-time)

## What's NOT yet in v2 (the next phase)

Personality and vibes — the Tang & Gainey voice imbuing pass:

- Two-voice toggle (Jenni / Gainey / Blend) for the daily Read
- Voice-tagged microcopy throughout
- Disagreement-as-a-feature (occasional dual reads on ambiguous calls)
- Editorial copy polish across empty states, toasts, error messages
- More subtle copy elsewhere (button labels, modal titles, pearls)

## File sizes

- `index.html`: 1,968,023 bytes (compiled bundle)
- `index.jsx.source`: ~1,914,000 bytes (editable React source)
