// === RECOMMENDATION CATALOG — May 2026 ===
// Curated "what we'd try" picks per job. SEPARATE from POPULAR_PRODUCTS
// (data/products.js) — that catalog is everything the shelf parser
// knows about. THIS catalog is the hand-picked subset Frida surfaces
// as recommendations: 3–5 picks per job, mixed price tiers, each with
// a tasting-notes blurb in brand voice.
//
// Per RECOMMENDATIONS.md §7: lean curated. Keeps voice + safety
// controllable. Replaces "generative per user" until AI worker exists.
//
// Voice rules (RECOMMENDATIONS.md §1):
//   - No clinical / dermatologist coding
//   - Tasting-notes language ("slick", "tacky", "doesn't pill")
//   - Ingredient + function in one breath
//   - Persona tag: 'jenni' (warmer), 'gainey' (drier), 'blend' (consensus)
//
// Schema per entry:
//   {
//     id:       string                  // stable id for picks
//     brand:    string
//     name:     string
//     blurb:    string                  // 1–2 lines, voice-checked
//     persona:  'jenni' | 'gainey' | 'blend'
//     priceTier:'$' | '$$' | '$$$' | '$$$$'
//     why:      string                  // 1-line mechanism crumb (Layer 2 fit)
//   }

const RECOMMENDATION_CATALOG = {
  // === CORE REQUIRED JOBS ===

  cleanse: [
    { id: 'cl-cerave-hydra',     brand: 'CeraVe',         name: 'Hydrating Cleanser',                blurb: 'Lotion-y, non-stripping. The one you reach for when nothing else cooperates.',     persona: 'blend',  priceTier: '$',    why: 'ceramides + glycerin, no surfactant tightness' },
    { id: 'cl-biossance-aloe',   brand: 'Biossance',      name: 'Squalane + Amino Aloe Cleanser',     blurb: 'Gel, but not squeaky. Lathers just enough.',                                       persona: 'gainey', priceTier: '$$',   why: 'amino acid surfactants, gentle' },
    { id: 'cl-tatcha-rice',      brand: 'Tatcha',         name: 'The Rice Wash',                      blurb: 'Cream texture, almost rinses like water. Worth it if your skin reads tight.',      persona: 'jenni',  priceTier: '$$',   why: 'rice extract, low-foam' },
    { id: 'cl-vanicream',        brand: 'Vanicream',      name: 'Gentle Facial Cleanser',             blurb: 'No-frills workhorse. Foams a little, doesn\'t squeak.',                            persona: 'gainey', priceTier: '$',    why: 'minimalist, fragrance-free' },
  ],

  hydrate: [
    { id: 'hy-laroche-b5',       brand: 'La Roche-Posay', name: 'Hyalu B5 Serum',                     blurb: 'The hyaluronic that doesn\'t pill under SPF. Quiet, reliable.',                    persona: 'blend',  priceTier: '$$',   why: 'two-weight HA + panthenol' },
    { id: 'hy-good-molec',       brand: 'The Inkey List', name: 'Hyaluronic Acid Serum',              blurb: 'Cheapest of the good ones. Plain HA + glycerin.',                                  persona: 'gainey', priceTier: '$',    why: 'humectant base layer' },
    { id: 'hy-haruharu-toner',   brand: 'Haruharu Wonder',name: 'Black Rice Hyaluronic Toner',        blurb: 'Watery, not tacky. Layer it under everything.',                                    persona: 'jenni',  priceTier: '$',    why: 'fermented rice, HA' },
  ],

  'moisturize-seal': [
    { id: 'ms-cerave-pm',        brand: 'CeraVe',         name: 'PM Facial Moisturizing Lotion',      blurb: 'Lotion-light. Stacks under retinoid without smothering it.',                       persona: 'blend',  priceTier: '$',    why: 'ceramides, niacinamide, no SPF' },
    { id: 'ms-kiehls-ufc',       brand: 'Kiehl\'s',       name: 'Ultra Facial Cream',                 blurb: 'The reliable one. Mid-weight, no fragrance theater.',                              persona: 'jenni',  priceTier: '$$',   why: 'squalane + glycerin, predictable' },
    { id: 'ms-fab-ultra',        brand: 'First Aid Beauty',name:'Ultra Repair Cream',                  blurb: 'Heavier. For when skin reads cooked.',                                             persona: 'gainey', priceTier: '$$',   why: 'colloidal oat + occlusives' },
    { id: 'ms-biossance-omega',  brand: 'Biossance',      name: 'Squalane + Omega Repair Cream',      blurb: 'Squalane base, sits well under makeup or SPF.',                                    persona: 'blend',  priceTier: '$$',   why: 'squalane + ceramides + omegas' },
  ],

  'sun-protect': [
    { id: 'sp-supergoop-glow',   brand: 'Supergoop!',     name: 'Glowscreen SPF 40',                  blurb: 'Pearlescent finish, no cast. Pricey for what it is, but it wears well.',          persona: 'jenni',  priceTier: '$$',   why: 'chemical, hydrating base' },
    { id: 'sp-eltamd-uv',        brand: 'EltaMD',         name: 'UV Clear Broad-Spectrum SPF 46',     blurb: 'The dermatologist Reddit pick that actually earned it. Niacinamide-forward.',     persona: 'gainey', priceTier: '$$',   why: 'zinc + chemical hybrid, niacinamide' },
    { id: 'sp-beautyofjoseon',   brand: 'Beauty of Joseon',name:'Relief Sun SPF 50',                   blurb: 'Best $20 sunscreen in the category. Light, no white cast.',                       persona: 'blend',  priceTier: '$',    why: 'chemical filters, rice extract' },
    { id: 'sp-isntree-mineral',  brand: 'Isntree',        name: 'Hyaluronic Acid Watery Sun Gel',     blurb: 'Watery, fast-disappearing. Mineral.',                                              persona: 'jenni',  priceTier: '$',    why: 'mineral, hyaluronic-base' },
  ],

  // === CONDITIONAL / CONCERN-DRIVEN ===

  soothe: [
    { id: 'so-laroche-b5',       brand: 'La Roche-Posay', name: 'Cicaplast Baume B5',                 blurb: 'For when the skin reads angry. Sticky, sits well overnight.',                      persona: 'blend',  priceTier: '$',    why: 'panthenol + madecassoside, anti-inflammatory' },
    { id: 'so-purito-centella',  brand: 'Purito',         name: 'Centella Green Level Calming Toner', blurb: 'Watery, almost neutral. Layer it before serums to take the edge off.',             persona: 'jenni',  priceTier: '$',    why: 'centella + aloe, calming base' },
    { id: 'so-skin1004-ampoule', brand: 'SKIN1004',       name: 'Madagascar Centella Ampoule',        blurb: 'Pure centella, almost no other ingredients. Boring, in a good way.',               persona: 'gainey', priceTier: '$',    why: 'centella asiatica monosource' },
  ],

  'barrier-repair': [
    { id: 'br-skinfix-triple',   brand: 'Skinfix',        name: 'Barrier+ Triple Lipid Peptide Cream',blurb: 'Reads expensive. Cushiony, ceramide-heavy.',                                       persona: 'jenni',  priceTier: '$$',   why: 'ceramide + cholesterol + fatty acid trio' },
    { id: 'br-dr-jart-cica',     brand: 'Dr. Jart+',      name: 'Cicapair Tiger Grass Cream',         blurb: 'Green-tinted on application, dries down neutral. Heavy enough to feel like progress.',persona:'blend',priceTier: '$$',   why: 'centella + ceramides' },
    { id: 'br-illiyoon-ceramide',brand: 'Illiyoon',       name: 'Ceramide Ato Concentrate Cream',     blurb: 'Korean drugstore. Quietly does the work.',                                         persona: 'gainey', priceTier: '$',    why: 'ceramide + cholesterol, fragrance-free' },
  ],

  'treat-vitC': [
    { id: 'vc-maelove-glow',     brand: 'Maelove',        name: 'The Glow Maker',                     blurb: 'L-ascorbic at the strength you want, fraction of the SkinCeuticals price.',         persona: 'gainey', priceTier: '$$',   why: 'L-ascorbic 15% + ferulic + vit E' },
    { id: 'vc-tatcha-violet',    brand: 'Tatcha',         name: 'Violet-C',                           blurb: 'Vit C with an AHA finish. Skip it if your barrier is shaky.',                      persona: 'jenni',  priceTier: '$$',   why: 'L-ascorbic 20% + AHA' },
    { id: 'vc-ole-truth',        brand: 'Ole Henriksen',  name: 'Truth Serum',                        blurb: 'More gentle, more daily-friendly. Less "do I feel it working" sting.',             persona: 'blend',  priceTier: '$$',   why: 'ascorbic + collagen blend' },
  ],

  'treat-retinoid': [
    { id: 'rt-maelove-moonlight',brand: 'Maelove',        name: 'Moonlight Retinal',                  blurb: 'Retinaldehyde — stronger than retinol, gentler than tretinoin. Sweet spot.',         persona: 'gainey', priceTier: '$$',   why: 'retinaldehyde 0.1% + niacinamide' },
    { id: 'rt-avene-retrinal',   brand: 'Avène',          name: 'RetrinAL 0.1',                       blurb: 'European pharmacy retinaldehyde. Reliable, low-drama.',                             persona: 'blend',  priceTier: '$$',   why: 'retinaldehyde 0.1%' },
    { id: 'rt-cerave-resurface', brand: 'CeraVe',         name: 'Resurfacing Retinol Serum',          blurb: 'Encapsulated retinol with ceramides built in. Beginner-tier.',                      persona: 'jenni',  priceTier: '$',    why: 'encapsulated retinol + ceramides' },
  ],

  'treat-niacinamide': [
    { id: 'ni-good-molec-niac',  brand: 'The Inkey List', name: 'Niacinamide Serum',                  blurb: 'Plain 10% niacinamide. Use it under SPF, every day.',                              persona: 'gainey', priceTier: '$',    why: 'niacinamide 10%' },
    { id: 'ni-glow-recipe',      brand: 'Glow Recipe',    name: 'Watermelon Glow Niacinamide Drops',  blurb: 'Niacinamide that doesn\'t feel like a chore. Pinky tinted.',                        persona: 'jenni',  priceTier: '$$',   why: 'niacinamide + hyaluronic' },
  ],

  'treat-peptide': [
    { id: 'pe-medik8-liquid',    brand: 'Medik8',         name: 'Liquid Peptides',                    blurb: 'Stack-friendly. Layer under moisturizer without pilling.',                          persona: 'gainey', priceTier: '$$$',  why: 'multi-peptide blend' },
    { id: 'pe-biossance-copper', brand: 'Biossance',      name: 'Squalane + Copper Peptide',          blurb: 'Squalane base makes it usable solo or under cream.',                                persona: 'blend',  priceTier: '$$',   why: 'copper peptides + squalane' },
  ],

  'exfoliate-chem': [
    { id: 'ex-paulas-bha',       brand: 'Paula\'s Choice',name: '2% BHA Liquid Exfoliant',            blurb: 'The defining BHA. Quiet, not abrasive.',                                            persona: 'blend',  priceTier: '$$',   why: 'salicylic 2%' },
    { id: 'ex-cosrx-aha',        brand: 'COSRX',          name: 'AHA 7 Whitehead Power Liquid',       blurb: 'Glycolic 7%. Use 2x/week, not nightly.',                                            persona: 'gainey', priceTier: '$',    why: 'glycolic 7%' },
    { id: 'ex-good-molec-pha',   brand: 'The Inkey List', name: 'PHA Toner',                          blurb: 'PHA — gentler exfoliant for skin that doesn\'t tolerate AHA/BHA.',                  persona: 'jenni',  priceTier: '$',    why: 'gluconolactone (PHA)' },
  ],

  eye: [
    { id: 'ey-cerave-eye',       brand: 'CeraVe',         name: 'Eye Repair Cream',                   blurb: 'The cheap workhorse. Ceramides, niacinamide, decent.',                              persona: 'gainey', priceTier: '$',    why: 'ceramides + niacinamide' },
    { id: 'ey-laroche-pigment',  brand: 'La Roche-Posay', name: 'Pigmentclar Eyes',                   blurb: 'For dark circles that read pigmented, not just shadowed.',                          persona: 'blend',  priceTier: '$$',   why: 'niacinamide + caffeine' },
  ],

  // === COMPLEMENT JOBS (RECOMMENDATIONS.md §2) ===

  'tone-evening': [
    // Tinted SPF — same job as sun-protect plus tone evening
    { id: 'te-iliam-tinted',     brand: 'ILIA',           name: 'Super Serum Skin Tint SPF 40',       blurb: 'The tinted SPF that earned all the hype. Sheer, doesn\'t cake.',                   persona: 'jenni',  priceTier: '$$',   why: 'mineral SPF + tint, hyaluronic' },
    { id: 'te-saie-glowy',       brand: 'Saie',           name: 'Glowy Super Skin SPF 35',            blurb: 'Lighter coverage, dewy finish. Closer to skincare than makeup.',                    persona: 'blend',  priceTier: '$$',   why: 'mineral SPF + sheer tint' },
    { id: 'te-tower28-sunny',    brand: 'Tower 28',       name: 'SunnyDays SPF 30 Tinted',            blurb: 'Daily-driver tint, not for going out. Light, runs cool-toned.',                    persona: 'jenni',  priceTier: '$$',   why: 'mineral SPF + tint' },
  ],

  'barrier-cream': [
    // Rich barrier creams — complement when ceramide-restorative is missing during a repair phase
    { id: 'bc-laroche-cicaplast',brand: 'La Roche-Posay', name: 'Cicaplast Baume B5+',                blurb: 'The European pharmacy panic-button. Slugs nicely.',                                 persona: 'blend',  priceTier: '$',    why: 'panthenol + madecassoside, occlusive' },
    { id: 'bc-aquaphor',         brand: 'Aquaphor',       name: 'Healing Ointment',                   blurb: 'Petrolatum, when nothing else is holding. For slugging nights only.',               persona: 'gainey', priceTier: '$',    why: 'petrolatum occlusion' },
  ],

  'overnight-mask': [
    { id: 'om-laneige-water',    brand: 'Laneige',        name: 'Water Sleeping Mask',                blurb: 'Sleeping mask everyone\'s used at least once. Gel-light, hydrating.',              persona: 'blend',  priceTier: '$$',   why: 'humectant + sleeping mask format' },
    { id: 'om-summer-friday',    brand: 'Summer Fridays', name: 'Jet Lag Mask',                       blurb: 'Wear-it-as-cream variety. Cushiony, doesn\'t pill.',                                persona: 'jenni',  priceTier: '$$',   why: 'niacinamide + glycerin' },
  ],
};

// Get N picks for a job, optionally filtered by persona or priceTier.
const pickFromCatalog = (job, { count = 3, persona = null, priceTier = null } = {}) => {
  const list = RECOMMENDATION_CATALOG[job] || [];
  let filtered = list;
  if (persona)   filtered = filtered.filter(p => p.persona === persona);
  if (priceTier) filtered = filtered.filter(p => p.priceTier === priceTier);
  return filtered.slice(0, count);
};

// Friendly labels per job — used in UI cards. Short, brand-voice.
const JOB_LABELS = {
  cleanse:             'cleanser',
  hydrate:             'hydrator',
  'moisturize-seal':   'moisturizer',
  'sun-protect':       'SPF',
  'barrier-repair':    'barrier support',
  soothe:              'soother',
  'exfoliate-chem':    'exfoliant',
  'exfoliate-phys':    'physical exfoliant',
  'treat-retinoid':    'retinoid',
  'treat-vitC':        'vitamin C',
  'treat-niacinamide': 'niacinamide',
  'treat-peptide':     'peptide serum',
  eye:                 'eye treatment',
  lip:                 'lip treatment',
  'tone-evening':      'tinted SPF',
  'makeup-replacement':'tinted base',
  'barrier-cream':     'rich barrier cream',
  'overnight-mask':    'sleeping mask',
};

// Mechanism → friendly label (for CONCERN_GAP cards).
const MECHANISM_LABELS = {
  humectant:              'humectants',
  occlusive:              'occlusives',
  emollient:              'emollients',
  'ceramide-restorative': 'ceramides',
  'anti-inflammatory':    'soothers',
  antioxidant:            'antioxidants',
  'exfoliant-AHA':        'AHA',
  'exfoliant-BHA':        'BHA',
  'exfoliant-PHA':        'PHA',
  retinoid:               'retinoid',
  peptide:                'peptides',
  'vitamin-C':            'vitamin C',
  niacinamide:            'niacinamide',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RECOMMENDATION_CATALOG,
    pickFromCatalog,
    JOB_LABELS,
    MECHANISM_LABELS,
  };
}
