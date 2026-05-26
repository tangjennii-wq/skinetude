// === BRAND + PRODUCT RANKING (Phase 1 — May 2026) ============================
// Shared sort layer for every "Add a product" surface. Until this existed,
// each picker (brand browse, product search, scan-result list, shelf
// suggestions) invented its own ordering rules — drift was inevitable and
// bugs like "CeraVe never shows on the first page when a user searches
// 'cerave'" kept re-appearing.
//
// This module is pure: no React, no app state, no side effects. Same input
// → same output. Callers pass everything they need (query string, brand
// counts, user's shelf products). Resolvers/sorters live here so the
// "what's a popular brand" / "what's a hero product" definitions stay in
// one place.
//
// Phase 1 scope: helpers only. Existing pickers continue to use whatever
// they have today. Migration to these helpers happens in later phases —
// touching ProductModal UI is explicitly out of scope.
//
// Reads (at runtime — concatenated earlier in the build):
//   - BRAND_RECOMMENDATION_INFO  (data/brands.js)  — { popular, tier } per brand
//   - POPULAR_PRODUCTS           (data/products.js) — catalog
// Neither is required for the helpers to work — they degrade to reasonable
// defaults when the data lookups miss, so unit testing in isolation is OK.

// === BRAND_PRIORITY_OVERRIDES ===
// Explicit per-brand priority bands. Lower number = higher surfacing.
//   1 — highest taste-fit / obvious default brands
//   2 — strong popular brands
//   3 — normal searchable brands (default when not listed)
//   4 — searchable-only / do NOT surface in browse-first views
// Names match the canonical brand strings the rest of the app uses
// (case-sensitive at storage time; we normalize at lookup time).
const BRAND_PRIORITY_OVERRIDES = {
  priority1: [
    // Tang & Gainey faves + accessible derm-tier defaults
    'Rhode', 'Summer Fridays', 'Glow Recipe', 'Tower 28',
    'CeraVe', 'La Roche-Posay', 'Vanicream', 'EltaMD',
    'SkinCeuticals', 'SkinMedica', 'Skinbetter Science',
    // K-beauty go-tos
    'COSRX', 'Beauty of Joseon', 'Anua', 'Round Lab',
    'SKIN1004', 'Skin1004', 'Dr. Jart+', 'Laneige',
    'AESTURA', 'Hada Labo', 'Torriden', 'TIRTIR', 'Innisfree',
  ],
  priority2: [
    // Strong popular brands — surface after priority 1
    "Paula's Choice", 'Drunk Elephant', 'Sunday Riley', 'Tatcha',
    'Caudalie', 'First Aid Beauty', 'Biossance', 'Youth To The People',
    'Topicals', 'Kiehl\'s', 'Dermalogica', 'Dr. Dennis Gross',
    'Farmacy', 'Dieux', 'Medik8',
    // K-beauty + Asian prestige
    'Medicube', 'Purito', 'Peach & Lily', 'Dr.G', 'Illiyoon',
    'Anessa', 'Shiseido', 'Sulwhasoo', 'SK-II',
    // Prestige + medical-grade
    'La Mer', 'Augustinus Bader', 'Obagi Medical',
    'ZO Skin Health', 'Zo Skin Health',
    'iS Clinical', 'Alastin', 'Revision Skincare', 'PCA Skin',
    'Amorepacific', 'Biologique Recherche', 'Dr. Barbara Sturm',
  ],
  priority4: [
    // Searchable-only — don't take browse-first slots. Users who know
    // these brands will type the name; everyone else doesn't need them
    // up top.
    'Hero Cosmetics', 'Tom Ford', 'U Beauty',
    'Gucci Beauty', 'Prada Beauty', 'YSL Beauty',
  ],
};

// === normalizeSearchText ===
// Lowercase, strip diacritics, replace non-word chars with single spaces,
// collapse repeats, trim. Used everywhere a string needs to be compared
// loosely — "L'Oréal" / "loreal" / "L Oreal" all normalize to the same
// "loreal" token. Pure function; safe to call repeatedly.
const normalizeSearchText = (value) => {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Pre-built lookup map so getBrandPriority is O(1). Built ONCE at module
// load; the BRAND_PRIORITY_OVERRIDES object isn't mutated at runtime, so
// the map stays correct without invalidation logic.
const _BRAND_PRIORITY_MAP = (() => {
  const map = new Map();
  for (const b of BRAND_PRIORITY_OVERRIDES.priority1) map.set(normalizeSearchText(b), 1);
  for (const b of BRAND_PRIORITY_OVERRIDES.priority2) map.set(normalizeSearchText(b), 2);
  for (const b of BRAND_PRIORITY_OVERRIDES.priority4) map.set(normalizeSearchText(b), 4);
  return map;
})();

// === getBrandPriority(brand) ===
// Returns 1 / 2 / 3 / 4. Order of lookup:
//   1. Explicit override in BRAND_PRIORITY_OVERRIDES (most specific)
//   2. BRAND_RECOMMENDATION_INFO.popular === true → priority 2
//   3. Default → priority 3
// Empty / unknown brand strings return 3 (the neutral default). Never
// returns null — callers can rely on a number coming back.
const getBrandPriority = (brand) => {
  if (!brand) return 3;
  const key = normalizeSearchText(brand);
  if (_BRAND_PRIORITY_MAP.has(key)) return _BRAND_PRIORITY_MAP.get(key);
  // Fall back to the brand info dictionary if present at runtime.
  if (typeof BRAND_RECOMMENDATION_INFO !== 'undefined' && BRAND_RECOMMENDATION_INFO) {
    const info = BRAND_RECOMMENDATION_INFO[brand];
    if (info && info.popular) return 2;
  }
  return 3;
};

// === tierRank(tier) ===
// Maps brand price tier strings to a small numeric rank. Used only as a
// tie-breaker — a more accessible tier wins a tie when two brands are
// otherwise equal in priority + popularity. Returns:
//   1 = drugstore (most accessible)
//   2 = midrange (default when tier is empty/unknown)
//   3 = prestige
//   4 = luxury
// Note: this is INTENTIONALLY not the same axis as priority. A drugstore
// brand can be priority 1 (CeraVe) and a luxury brand can be priority 4
// (Tom Ford). Tier is a separate signal about price band.
const tierRank = (tier) => {
  const t = String(tier || '').toLowerCase().trim();
  if (t === 'drugstore') return 1;
  if (t === 'midrange' || t === 'mid-range' || t === 'mid range' || t === '') return 2;
  if (t === 'prestige') return 3;
  if (t === 'luxury') return 4;
  return 2;
};

// Query-relevance scoring. Same scale used by both brand and product sorters
// so callers can reason about magnitudes consistently. Tuning here changes
// behavior everywhere — desirable.
//   exact match (after normalization)     → +800
//   prefix match                          → +400
//   word-start match (\b)                 → +200
//   substring match                       → +100
//   no match                              → −1000 (push to bottom)
// Returns 0 if no query — callers can short-circuit when query is empty.
const _queryRelevance = (haystackNorm, queryNorm) => {
  if (!queryNorm) return 0;
  if (haystackNorm === queryNorm) return 800;
  if (haystackNorm.startsWith(queryNorm + ' ') || haystackNorm.startsWith(queryNorm)) return 400;
  // \b word-boundary in normalized text — non-word chars already stripped,
  // so word starts are at positions 0 and after a single space.
  const wordStart = new RegExp('(^|\\s)' + queryNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (wordStart.test(haystackNorm)) return 200;
  if (haystackNorm.includes(queryNorm)) return 100;
  return -1000;
};

// === scoreBrandForPicker(brand, query, counts, userShelfBrands) ===
// Composite score for a single brand at a given query. Higher = surface
// higher. Components (all additive):
//   - Inverse priority      → (5 - priority) × 100      [priority 1 = 400]
//   - Query relevance       → see _queryRelevance        [up to +800]
//   - Popular boost         → +30 if BRAND_RECOMMENDATION_INFO.popular
//   - Tier accessibility    → small inverse tier bonus   [drugstore = +10]
//   - User shelf bonus      → +60 if brand is on the user's active shelf
//   - Brand count bonus     → +10/+20 if catalog has 2+/5+ products
// The big query-match number (+800) intentionally beats any priority,
// so an exact query match on a prestige brand still wins over a non-
// matching priority-1 brand — addresses the "drugstore should not
// always beat prestige if a prestige brand is an exact query match"
// requirement.
//
// Args:
//   brand            — string (canonical brand name)
//   query            — search string (may be empty)
//   counts           — { [brand]: number } map of product counts (optional)
//   userShelfBrands  — Set<string> of brand names the user already has
const scoreBrandForPicker = (brand, query, counts, userShelfBrands) => {
  if (!brand) return -Infinity;
  const priority = getBrandPriority(brand);
  const queryNorm = normalizeSearchText(query);
  const brandNorm = normalizeSearchText(brand);
  let score = (5 - priority) * 100;
  score += _queryRelevance(brandNorm, queryNorm);
  if (typeof BRAND_RECOMMENDATION_INFO !== 'undefined' && BRAND_RECOMMENDATION_INFO) {
    const info = BRAND_RECOMMENDATION_INFO[brand];
    if (info && info.popular) score += 30;
    if (info && info.tier) score += (5 - tierRank(info.tier)) * 2; // small inverse tier tiebreak
  }
  if (userShelfBrands && typeof userShelfBrands.has === 'function' && userShelfBrands.has(brand)) {
    score += 60;
  }
  if (counts && counts[brand]) {
    if (counts[brand] >= 5) score += 20;
    else if (counts[brand] >= 2) score += 10;
  }
  return score;
};

// === sortBrandsForPicker(brands, query, counts, products) ===
// Convenience wrapper around scoreBrandForPicker that returns a NEW sorted
// array (input not mutated). Derives `userShelfBrands` from the user's
// `products` array so callers don't have to pre-compute the Set.
//
// Args:
//   brands   — string[] of canonical brand names
//   query    — search string (may be empty)
//   counts   — { [brand]: number } map of product counts (optional)
//   products — user's products array (optional; used to derive shelf brands)
const sortBrandsForPicker = (brands, query, counts, products) => {
  const shelfBrands = new Set();
  if (Array.isArray(products)) {
    for (const p of products) {
      if (p && p.brand && !p.endDate) shelfBrands.add(p.brand);
    }
  }
  return [...(brands || [])].sort((a, b) =>
    scoreBrandForPicker(b, query, counts, shelfBrands) - scoreBrandForPicker(a, query, counts, shelfBrands)
  );
};

// === scoreProductForSearch(product, query, userShelfBrands) ===
// Composite score for a single product result. Higher = surface higher.
// Components:
//   - Brand priority      → (5 - priority) × 50          [priority 1 = +200]
//   - Hero flag           → +100 if product.hero === true
//   - Popular flag        → +30 if product.popular === true
//   - Query relevance     → name first; brand fallback   [up to +800]
//   - Shelf brand bonus   → +60 if user already has this brand on shelf
// The hero boost (+100) is intentional — when a brand has a hero serum,
// it should beat the same brand's lesser-known supporting products on
// browse views. With a query, the +800 exact-match still dominates.
//
// Args:
//   product           — product object ({ name, brand, hero, popular, ... })
//   query             — search string (may be empty)
//   userShelfBrands   — Set<string> of brand names the user already has
const scoreProductForSearch = (product, query, userShelfBrands) => {
  if (!product) return -Infinity;
  const queryNorm = normalizeSearchText(query);
  const nameNorm = normalizeSearchText(product.name || '');
  const brandNorm = normalizeSearchText(product.brand || '');
  let score = (5 - getBrandPriority(product.brand)) * 50;
  if (product.hero === true) score += 100;
  if (product.popular === true) score += 30;
  if (queryNorm) {
    // Score against name first; if that has no match, fall back to brand.
    // Don't add both — a brand match shouldn't compound a name match for
    // the same query token (otherwise "cerave moisturizer" double-counts
    // every CeraVe product).
    const nameScore = _queryRelevance(nameNorm, queryNorm);
    if (nameScore > 0) {
      score += nameScore;
    } else {
      const brandScore = _queryRelevance(brandNorm, queryNorm);
      score += brandScore; // could be 0 or -1000
    }
  }
  if (userShelfBrands && typeof userShelfBrands.has === 'function' && product.brand && userShelfBrands.has(product.brand)) {
    score += 60;
  }
  return score;
};

// === sortProductsForSearch(products, query, userProducts) ===
// Convenience wrapper around scoreProductForSearch. Derives user shelf
// brands from `userProducts` so callers don't pre-build the Set.
//
// Args:
//   products      — Product[] (catalog candidates)
//   query         — search string (may be empty)
//   userProducts  — Product[] of the user's own shelf (optional)
const sortProductsForSearch = (products, query, userProducts) => {
  const shelfBrands = new Set();
  if (Array.isArray(userProducts)) {
    for (const p of userProducts) {
      if (p && p.brand && !p.endDate) shelfBrands.add(p.brand);
    }
  }
  return [...(products || [])].sort((a, b) =>
    scoreProductForSearch(b, query, shelfBrands) - scoreProductForSearch(a, query, shelfBrands)
  );
};

// === DUAL-MODE EXPORT (May 2026 — Phase 5 guards) =============================
// The bundle expects these as plain module-scope consts (concatenation
// model). check_build.js needs to require() the helpers for functional
// asserts (Rhode > Rare Beauty for "rh", etc.). The CommonJS hook below
// runs ONLY in Node — when this file is concatenated into the browser
// bundle, `module` is undefined and the hook silently does nothing.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BRAND_PRIORITY_OVERRIDES,
    normalizeSearchText,
    getBrandPriority,
    tierRank,
    scoreBrandForPicker,
    sortBrandsForPicker,
    scoreProductForSearch,
    sortProductsForSearch,
  };
}
