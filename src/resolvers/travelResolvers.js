// === travelResolvers.js (June 2026 — Travel mode Phase 2.5) ===
//
// Heuristic auto-build for the user's travel routine. Pares any shelf
// (even 15+ products) down to ~5–7 essentials biased by:
//   - locationKind: beach / cold / humid / dry / normal
//   - durationDays: weekend / week / 2-weeks+
//   - actionGoal: barrier_repair / acne / brightening / etc.
//   - jetlag flag: |TZ delta| >= 3h adds a hydration layer
//
// No AI call — pure scoring + slot filling. Re-runnable so the user can
// edit destination/duration/goal in TravelSetupModal and rerun the
// suggestion. Output is a product-ID array sized for the trip.
//
// Module-scope dependencies (resolved at call time — sidecar runs first):
//   - benchProductFamily(p) — categorization helper from benchResolvers.js
//   - detectActiveFamily(text) — active-class detector
//
// Note: kept independent from the Picks scoring engine on purpose. This
// is a *packing* problem, not a *shopping* problem. We're not adding
// stuff to the shelf, we're choosing what fits in the bag.

// === Slot map for what a travel routine needs ===
//
// Numbers are TARGET counts; the resolver picks the highest-scoring
// product per slot from what's on the shelf. Adjusted by locationKind
// and durationDays below.

const TRAVEL_SLOT_TARGETS = {
  cleanser: 1,
  moisturizer: 1,
  spf: 1,
  // Actives: 0–2. Heuristic below picks based on action goal.
  active: 1,
  // Hydration layer (essence / serum). Added when jetlag or dry climate.
  hydration: 0,
  // Optional barrier-recovery balm (cicaplast, balm types) for harsh climates.
  recovery: 0,
};

// === Score a single product for travel-readiness ===
//
// Higher score = more useful for the trip. Travel-friendly = simple,
// stable, multi-purpose. We DOWNRANK:
//   - Glass droppers (fragile)
//   - Very high concentrations of new actives (risk of irritation away from home)
//   - Single-purpose mask treatments (cadence doesn't fit short trips)
// And UPRANK:
//   - Hero products (you'd notice their absence)
//   - Products in built routine (you already trust them)
//   - Products tagged for the destination's climate

const travelScore = (p, { locationKind, actionGoal, jetlag, isInBuiltRoutine }) => {
  let score = 0;
  const text = `${p?.name || ''} ${p?.brand || ''} ${p?.actives || ''} ${p?.main || ''} ${p?.category || ''} ${(p?.tags || []).join(' ')}`.toLowerCase();

  // Built routine = baseline trust
  if (isInBuiltRoutine) score += 14;
  if (p.hero === true) score += 8;

  // Climate match
  if (locationKind === 'beach') {
    if (/spf|sunscreen|mineral|tinted/.test(text)) score += 24;
    if (/ceramide|barrier|cicaplast/.test(text)) score += 10;
    if (/oil|balm/.test(text)) score -= 5; // greasy + sweat = no
  }
  if (locationKind === 'cold' || locationKind === 'dry') {
    if (/ceramide|barrier|cicaplast|squalane|panthenol|peptide/.test(text)) score += 18;
    if (/oil|balm|recovery/.test(text)) score += 10;
    if (/light|gel|aqua/.test(text)) score -= 4;
  }
  if (locationKind === 'humid') {
    if (/gel|light|lotion|essence|aqua/.test(text)) score += 12;
    if (/oil|balm|heavy|rich/.test(text)) score -= 6;
    if (/spf|sunscreen/.test(text)) score += 14;
  }

  // Action goal match
  if (actionGoal === 'BARRIER_REPAIR' && /ceramide|barrier|cicaplast|centella|panthenol|madecassoside/.test(text)) score += 12;
  if (actionGoal === 'ACNE_REDUCTION' && /salicylic|bha|adapalene|benzoyl|azelaic|niacinamide/.test(text)) score += 12;
  if (actionGoal === 'ANTI_AGING' && /retinol|retinal|retinoid|peptide|tretinoin|tazarotene/.test(text)) score += 12;
  if (actionGoal === 'BRIGHTENING' && /vitamin c|ascorbic|niacinamide|tranexamic|kojic|arbutin/.test(text)) score += 12;

  // Jetlag → favor hydration + skip new actives
  if (jetlag) {
    if (/hyaluronic|hydrat|essence|sheet|aqua/.test(text)) score += 8;
    if (/retinol|retinoid|acid|bha|aha/.test(text)) score -= 6; // skip first few days
  }

  // Penalties for travel friction
  if (/glass|droppers/.test(text)) score -= 3;
  if (/mask/.test(text) && !/sleeping/.test(text)) score -= 6;

  return score;
};

// === Suggest packing list ===
//
// Inputs:
//   products: full product array (will filter to active inside)
//   locationKind: 'beach' | 'cold' | 'humid' | 'dry' | 'normal' | ''
//   durationDays: 0..N (used to scale active count)
//   actionGoal: userProfile.actionGoal (e.g. 'BARRIER_REPAIR')
//   jetlag: boolean (passed from TZ delta check)
//
// Output:
//   productIds: string[] — ordered by importance, sized for the trip
//
// Sizing rules:
//   weekend (≤3d):   4–5 products (cleanser, moisturizer, SPF, 1 active)
//   week (≤9d):      5–6 products (+ hydration if jetlag/dry)
//   2-weeks+:        6–7 products (full essentials kit)
//   Always at least: cleanser, moisturizer, SPF.

const suggestTravelRegimen = ({
  products,
  locationKind = 'normal',
  durationDays = 7,
  actionGoal = '',
  jetlag = false,
} = {}) => {
  if (!Array.isArray(products) || products.length === 0) return [];

  const active = products.filter(p => !p.endDate);
  if (active.length === 0) return [];

  // Tune slot targets by trip context
  const targets = { ...TRAVEL_SLOT_TARGETS };
  if (jetlag || locationKind === 'cold' || locationKind === 'dry') {
    targets.hydration = 1;
  }
  if (locationKind === 'cold' || locationKind === 'dry') {
    targets.recovery = 1;
  }
  // Long trip → allow 2 actives (still bounded). Short trip → 0–1.
  if (durationDays <= 3) targets.active = Math.min(targets.active, 1);
  if (durationDays >= 10) targets.active = 2;

  // Score everything once
  const isInBuiltRoutine = (p) => (typeof productIsInBuiltRoutine === 'function')
    ? productIsInBuiltRoutine(p)
    : false;
  const scored = active.map(p => ({
    product: p,
    score: travelScore(p, { locationKind, actionGoal, jetlag, isInBuiltRoutine: isInBuiltRoutine(p) }),
    family: (typeof benchProductFamily === 'function') ? benchProductFamily(p) : 'other',
  }));

  // Classify by slot. The benchProductFamily gives spf/cleanser/moisturizer/active/other.
  // We split "other" into hydration/recovery based on text patterns.
  const classify = (p) => {
    const text = `${p?.name || ''} ${p?.actives || ''} ${p?.main || ''} ${(p?.tags || []).join(' ')}`.toLowerCase();
    const fam = (typeof benchProductFamily === 'function') ? benchProductFamily(p) : 'other';
    if (fam === 'spf' || fam === 'cleanser' || fam === 'moisturizer') return fam;
    if (fam === 'active') return 'active';
    // Fall-through bucketing
    if (/cicaplast|recovery|balm|repair/.test(text)) return 'recovery';
    if (/essence|hyaluronic|hydrat|toner|ampoule|serum/.test(text)) return 'hydration';
    return null; // unknown — skip
  };

  // Group scored items by slot
  const bySlot = {};
  scored.forEach(s => {
    const slot = classify(s.product);
    if (!slot) return;
    if (!bySlot[slot]) bySlot[slot] = [];
    bySlot[slot].push(s);
  });
  Object.keys(bySlot).forEach(k => bySlot[k].sort((a, b) => b.score - a.score));

  // Fill slots in priority order
  const order = ['cleanser', 'moisturizer', 'spf', 'active', 'hydration', 'recovery'];
  const picked = [];
  const pickedIds = new Set();
  order.forEach(slot => {
    const need = targets[slot] || 0;
    const pool = bySlot[slot] || [];
    let taken = 0;
    for (const s of pool) {
      if (taken >= need) break;
      if (pickedIds.has(s.product.id)) continue;
      pickedIds.add(s.product.id);
      picked.push(s.product.id);
      taken++;
    }
  });

  return picked;
};
