// === benchResolvers.js (June 2026 — Phase A of Tier C IA cleanup) ===
//
// Pure functions for the Bench surface — owned products NOT currently in
// the built routine (Unused) + products that share an active family with
// something already active (Overlap). Used by:
//
//   1. The Bench sub-tab in Regimen (regimenView === 'bench') — the new
//      canonical home for "what's on my shelf I'm not using" after the
//      Tier C IA migration (see project_regimen_canonical memory).
//   2. The legacy Pearls/Picks/bench view inside Insights (kept during
//      Phase A for safety; Phase C deletes it).
//
// Both surfaces call computeBench with the same inputs and render from
// the same shape, so behavior stays in lockstep until Phase C cleans up.
//
// Module-scope dependencies (resolved at call time via global lookup —
// the build_current.js sidecar runs FIRST, so these symbols exist by
// the time anything calls in here):
//   - detectActiveFamily(text) — string → family slug
//   - productIsInBuiltRoutine(product) — bool predicate
//
// Names are `bench*` prefixed so they don't collide with the Pearls
// IIFE-local helpers (productBudgetFamily, overlapFamilyLabel,
// overlapFamilyForProduct) that still exist there until Phase C.

const benchProductFamily = (p) => {
  const cat = String(p?.category || '').toLowerCase();
  const text = `${p?.name || ''} ${p?.brand || ''} ${p?.actives || ''} ${p?.main || ''} ${(p?.tags || []).join(' ')}`.toLowerCase();
  if (cat.includes('sunscreen') || /\bspf\b|sunscreen|uv clear|mineral/.test(text)) return 'spf';
  if (cat.includes('cleanser') || /cleanser|cleansing|wash|balm|oil cleanser/.test(text)) return 'cleanser';
  if (cat.includes('moisturizer') || /moisturizer|cream|lotion|barrier|ceramide|atobarrier|cicaplast/.test(text)) return 'moisturizer';
  if (/retinoid|retinol|retinal|adapalene|tretinoin|tazarotene|bha|aha|salicylic|glycolic|lactic|vitamin c|ascorbic|azelaic|benzoyl/.test(text)) return 'active';
  return 'other';
};

const benchOverlapLabel = (family) => ({
  spf: 'SPF',
  cleanser: 'Cleansers',
  moisturizer: 'Moisturizers',
  retinoid: 'Retinoids',
  bha: 'BHA',
  aha: 'AHA',
  pha: 'PHA',
  bpo: 'Benzoyl peroxide',
  azelaic: 'Azelaic acid',
  vitc: 'Vitamin C',
  niacinamide: 'Niacinamide',
  peptide: 'Peptides',
  ceramide: 'Ceramides',
  humectant: 'Hydrators',
  centella: 'Centella',
  tranexamic: 'Tranexamic acid',
  arbutin: 'Arbutin',
  bakuchiol: 'Bakuchiol',
})[family] || String(family || 'Other').replace(/-/g, ' ');

const benchOverlapFamilyForProduct = (p) => {
  const text = [p.activeIngredients, p.actives, p.main, p.name, p.category, ...(p.tags || [])]
    .filter(Boolean)
    .join(' ');
  const activeFamily = (typeof detectActiveFamily === 'function')
    ? detectActiveFamily(text)
    : null;
  return activeFamily || benchProductFamily(p);
};

// === computeBench — single entry point used by both Regimen/bench and
// the legacy Pearls/Picks/bench view ===
//
// Inputs:
//   products: full product array (will filter to active inside)
//
// Output:
//   unusedProducts: Product[] — active products NOT in built routine
//   overlapGroups: { family, label, items }[] — active products grouped
//                  by overlapping active family (≥ 2 per group)
//   benchCount: number — sum used as the badge count
//
// The Pearls version computed unused = activeProductsForBudget.filter(
// p => !builtBudgetIds.has(p.id)) where activeProductsForBudget came from
// budgetScope routing. Here we always use the full active set —
// behaviorally identical when budgetScope is 'all' (the default).

const computeBench = ({ products }) => {
  if (!Array.isArray(products) || products.length === 0) {
    return { unusedProducts: [], overlapGroups: [], benchCount: 0 };
  }
  const active = products.filter(p => !p.endDate);
  const built = (typeof productIsInBuiltRoutine === 'function')
    ? active.filter(productIsInBuiltRoutine)
    : active;
  const builtIds = new Set(built.map(p => p.id));

  // === Unused — owned but not in built routine ===
  const unusedProducts = active.filter(p => !builtIds.has(p.id));

  // === Overlap — products that share an active family ===
  // Use built routine when populated; otherwise fall back to all-active
  // (matches Pearls behavior for users who haven't built a routine yet).
  const overlapBase = built.length ? built : active;
  const overlapMap = overlapBase.reduce((acc, p) => {
    const family = benchOverlapFamilyForProduct(p);
    if (!family || family === 'other') return acc;
    if (!acc[family]) acc[family] = [];
    acc[family].push(p);
    return acc;
  }, {});
  const overlapGroups = Object.entries(overlapMap)
    .map(([family, items]) => ({ family, label: benchOverlapLabel(family), items }))
    .filter(g => g.items.length > 1)
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));

  return {
    unusedProducts,
    overlapGroups,
    benchCount: unusedProducts.length + overlapGroups.length,
  };
};
