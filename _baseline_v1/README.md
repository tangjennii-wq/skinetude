# Étude — Technical Baseline v1

**Snapshotted:** May 4, 2026
**State:** End of the technical-build phase, just before the Tang & Gainey brand voice was fully imbued.

## What this is

A frozen copy of `index.html` + `index.jsx.source` representing the app at the moment we finished building the structural / functional features (Today tab, Skin Read drawer, Compact Timeline, Suggested Matches drawer, Counsel merge, About tab, evidence dots, context-aware bullet icons, score consistency fixes, etc.) but BEFORE we started layering in the founders' voice (two-voice toggle, voice-tagged microcopy, Disagreement-as-a-Feature).

## What's in here

- `index.html` — the deployed bundle as it stood after the last technical fix
- `index.jsx.source` — the editable sidecar source

## How to revert

If anything in the brand-voice phase breaks the app or you want to roll back to "everything works, just no signature voice yet":

```bash
cp _baseline_v1/index.html index.html
cp _baseline_v1/index.jsx.source index.jsx.source
```

Then re-deploy as usual.

## What you keep by reverting

- Today tab consolidation (analysis + trend chart + needs cards inline, no popup)
- Compact / Extended Timeline toggle with spine + dots
- Suggested Matches drawer with heart-favorite mechanic
- Counsel merge (Pearls + Counsel folded into one tab with Color sub-tab)
- About Us slim placeholder
- Evidence dots (●●● tappable for source attribution)
- Context-aware bullet icons (Droplet for cleanse, Sun for SPF, etc.)
- Score consistency (cover/drawer/trend chart all use the same 6 metrics)
- Mobile fixes (analysis/compare buttons, metric strip, environment input)
- Profile wizard remount fix (state lifted to App)
- Silent Gemini (no notifications about background AI)

## What you LOSE by reverting

Anything we ship in the "brand voice" phase:
- Two-voice toggle (Jenni / Gainey / Blend)
- Voice-tagged microcopy
- Disagreement-as-a-Feature
- Any further refinements built on top of this baseline
