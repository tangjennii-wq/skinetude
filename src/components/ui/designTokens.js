// === Design tokens (Fix 2 — May 2026) ===
// Hoisted out of BrandPicker.jsx where the T object was wedged from an
// earlier extraction pass. Single source of truth for spacing, sizing,
// type, and shape tokens. Used by every UI primitive + reusable card.
// Token names + values unchanged from prior inline definition.

// === DESIGN TOKENS (May 2026 — Phase 1 stabilization) ===
// Single source of truth for spacing, sizing, and color tokens used by
// reusable UI primitives below. When the modal or a card looks wrong,
// the fix lives HERE — not duplicated across 20 inline style blocks.
//
// Naming convention:
//   T.space.*       — gap/padding/margin in px
//   T.radius.*      — border-radius in px (pill = 999)
//   T.fontSize.*    — font-size in px
//   T.weight.*      — font-weight numeric
//   T.tracking.*    — letter-spacing (em values for editorial uppercase)
const T = {
  space: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, xxxl: 24 },
  radius: { sm: 8, md: 10, lg: 12, xl: 14, xxl: 18, hero: 22, pill: 999 },
  fontSize: {
    eyebrow: 11,         // section labels (e.g. "SKIN CHECK-IN")
    micro: 10,           // tiniest UPPERCASE labels
    bodyTight: 12,       // dense body inside cards
    body: 13,            // standard body
    bodyRoomy: 14,       // hero body / spec body
    cardTitle: 20,       // "Three moves to make today."
    heroTitleSmall: 24,  // hero in narrow column
    heroTitle: 28,       // hero at desktop
  },
  weight: { regular: 400, medium: 500, mediumPlus: 550, semibold: 600, semiboldPlus: 650, bold: 700 },
  tracking: {
    eyebrow: '0.18em',     // editorial section labels
    eyebrowLoose: '0.22em',// alternative wider eyebrow
    cta: '0.08em',         // uppercase button labels
    body: '0',             // body text default
  },
  buttonHeight: { primary: 42, secondary: 40, compact: 38 },
};
