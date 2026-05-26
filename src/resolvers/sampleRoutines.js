// === SAMPLE ROUTINES (May 2026 — for exploring users) ===
// Three curated starter routines. Tap "View sample" → opens preview
// modal. "Add to my routine" pre-fills the build wizard. No AI, no
// product matching — these are illustrative templates with category
// names + short blurbs. Replace later with real product picks if/when
// the brand-tier matcher is ready.
const SAMPLE_ROUTINES = [
  {
    id: 'minimal',
    label: 'Minimal Routine',
    icon: 'Sun',
    blurb: '3 essential steps. Barrier-first approach.',
    am: [
      { name: 'Cleanser', sub: 'Gentle cleanse' },
      { name: 'Moisturizer', sub: 'Hydrate & support' },
      { name: 'Sunscreen', sub: 'Daily protection' },
    ],
    pm: [
      { name: 'Cleanser', sub: 'Gentle cleanse' },
      { name: 'Moisturizer', sub: 'Recover & nourish' },
    ],
  },
  {
    id: 'brightening',
    label: 'Brightening Routine',
    icon: 'Sparkles',
    blurb: 'Glow support with smart active spacing.',
    am: [
      { name: 'Cleanser', sub: 'Gentle cleanse' },
      { name: 'Vitamin C', sub: 'Brighten & protect' },
      { name: 'Moisturizer', sub: 'Hydrate & support' },
      { name: 'Sunscreen', sub: 'Daily protection' },
    ],
    pm: [
      { name: 'Cleanser', sub: 'Gentle cleanse' },
      { name: 'Niacinamide serum', sub: 'Tone support — every night' },
      { name: 'Retinol', sub: '2–3 nights weekly. Buffer with moisturizer if new.' },
      { name: 'Moisturizer', sub: 'Recover & nourish' },
    ],
  },
  {
    id: 'sensitive',
    label: 'Sensitive Skin Routine',
    icon: 'Leaf',
    blurb: 'Calm, gentle, and reduces reactivity.',
    am: [
      { name: 'Cream cleanser', sub: 'Non-foaming' },
      { name: 'Barrier serum', sub: 'Centella + panthenol' },
      { name: 'Moisturizer', sub: 'Ceramide-rich' },
      { name: 'Mineral sunscreen', sub: 'Daily protection' },
    ],
    pm: [
      { name: 'Cream cleanser', sub: 'Non-foaming' },
      { name: 'Barrier serum', sub: 'Centella + panthenol' },
      { name: 'Moisturizer', sub: 'Ceramide-rich, occlusive' },
    ],
  },
];

const FOUNDATIONAL_SAMPLE_ROUTINE = SAMPLE_ROUTINES[0]; // Minimal — used as the default "Sample Routine" card preview.
