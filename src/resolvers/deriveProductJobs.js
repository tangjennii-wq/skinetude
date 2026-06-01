// === DERIVE PRODUCT JOBS — May 2026 ===
// Pure derivation from existing product fields (category, actives, main,
// tags) → the spec taxonomy (jobs + mechanism tags). See RECOMMENDATIONS.md
// §2 for the canonical taxonomy.
//
// This is a HEURISTIC, not hand-tagging. Right answer for the common case.
// Per-product overrides (RECOMMENDATIONS.md §2 hybrid approach) can be
// added later. v1 derives.
//
// INPUT
//   product: { category, actives, main, tags }
//
// OUTPUT
//   { jobs: string[], mechanismTags: string[] }
//
// jobs:           cleanse, hydrate, moisturize-seal, sun-protect,
//                 barrier-repair, soothe, exfoliate-chem, exfoliate-phys,
//                 treat-retinoid, treat-vitC, treat-niacinamide, treat-peptide,
//                 eye, lip, tone-evening, makeup-replacement, barrier-cream,
//                 overnight-mask
// mechanismTags:  humectant, occlusive, emollient, ceramide-restorative,
//                 anti-inflammatory, antioxidant, exfoliant-AHA,
//                 exfoliant-BHA, exfoliant-PHA, retinoid, peptide,
//                 vitamin-C, niacinamide
const deriveProductJobs = (product) => {
  if (!product || typeof product !== 'object') return { jobs: [], mechanismTags: [] };

  const jobs = new Set();
  const mechs = new Set();

  const category = String(product.category || '').toLowerCase();
  const actives  = String(product.actives  || '').toLowerCase();
  const main     = String(product.main     || '').toLowerCase();
  const tags     = (product.tags || []).map(t => String(t || '').toLowerCase());
  const tagSet   = new Set(tags);
  const ingredientText = `${actives} ${main}`;
  const allText        = `${ingredientText} ${tags.join(' ')}`;

  // === MECHANISM TAGS — pattern-match ingredient text ===

  // Humectants — water-binders
  if (/\b(hyaluronic|sodium\s+hyaluronate|glycerin|sodium\s+pca|panthenol|propanediol|betaine|trehalose|polyglutamic|honey|aloe|allantoin|urea)\b/.test(ingredientText)) {
    mechs.add('humectant');
  }

  // Occlusives — seal water in
  if (/\b(petrolatum|petroleum|beeswax|shea|cocoa\s+butter|mango\s+butter|lanolin|dimethicone|cyclopentasiloxane|squalane)\b/.test(ingredientText)) {
    mechs.add('occlusive');
  }

  // Emollients — soften
  if (/\b(jojoba|argan|squalane|caprylic|isopropyl\s+palmitate|coconut|sweet\s+almond|marula|rosehip|camellia|tsubaki|olive\s+oil)\b/.test(ingredientText)) {
    mechs.add('emollient');
  }

  // Ceramide-restorative — barrier rebuild
  if (/\b(ceramide|cholesterol|fatty\s+acids?|phytosphingosine)\b/.test(ingredientText)) {
    mechs.add('ceramide-restorative');
    jobs.add('barrier-repair');
  }

  // Anti-inflammatory — soothe mechanism
  if (/\b(centella|cica|madecassoside|allantoin|panthenol|colloidal\s+oat|oat\s+extract|bisabolol|azelaic|niacinamide|green\s+tea|tiger\s+grass|heartleaf|houttuynia|calendula)\b/.test(ingredientText)) {
    mechs.add('anti-inflammatory');
    jobs.add('soothe');
  }

  // Antioxidants
  if (/\b(vitamin\s*e|tocopherol|ferulic|resveratrol|astaxanthin|green\s+tea|polyphenol|coenzyme\s*q10|coq10|ubiquinone)\b/.test(ingredientText)) {
    mechs.add('antioxidant');
  }

  // Vitamin C family
  if (/\b(ascorbic|ascorbate|ascorbyl|thd|tetrahexyldecyl|vitamin\s*c|sap|magnesium\s+ascorbyl)\b/.test(ingredientText)) {
    mechs.add('vitamin-C');
    mechs.add('antioxidant');
    jobs.add('treat-vitC');
  }

  // Niacinamide
  if (/\bniacinamide\b/.test(ingredientText)) {
    mechs.add('niacinamide');
    jobs.add('treat-niacinamide');
  }

  // Peptides
  if (/\b(peptide|matrixyl|argireline|copper\s+peptide)\b/.test(ingredientText)) {
    mechs.add('peptide');
    jobs.add('treat-peptide');
  }

  // Retinoids
  if (/\b(retinol|retinal|retinaldehyde|tretinoin|retinyl|granactive\s+retinoid)\b/.test(ingredientText)
      || tagSet.has('retinol') || tagSet.has('retinaldehyde') || tagSet.has('daily-retinol')) {
    mechs.add('retinoid');
    jobs.add('treat-retinoid');
  }
  // Bakuchiol as retinoid-alternative
  if (/\bbakuchiol\b/.test(ingredientText) || tagSet.has('bakuchiol') || tagSet.has('retinol-alternative')) {
    jobs.add('treat-retinoid');
  }

  // Exfoliants — BHA / AHA / PHA / physical
  if (/\b(salicylic|bha|betaine\s+salicylate)\b/.test(ingredientText) || tagSet.has('bha')) {
    mechs.add('exfoliant-BHA');
    jobs.add('exfoliate-chem');
  }
  if (/\b(glycolic|lactic|mandelic|tartaric|aha)\b/.test(ingredientText)
      || tagSet.has('aha') || tagSet.has('aha-bha') || tagSet.has('aha-bha-pha')) {
    mechs.add('exfoliant-AHA');
    jobs.add('exfoliate-chem');
  }
  if (/\b(gluconolactone|lactobionic|pha)\b/.test(ingredientText) || tagSet.has('pha')) {
    mechs.add('exfoliant-PHA');
    jobs.add('exfoliate-chem');
  }
  if (tagSet.has('physical-exfoliant') || /\b(scrub|micro\s*polish|jojoba\s+beads|rice\s+powder)\b/.test(allText)) {
    jobs.add('exfoliate-phys');
  }

  // === SUN PROTECTION ===
  // SPF by category, tags, or actives
  if (category === 'sunscreen'
      || tags.some(t => /spf/.test(t))
      || /\b(zinc\s+oxide|titanium\s+dioxide|avobenzone|octinoxate|octisalate|homosalate|tinosorb|uvinul)\b/.test(ingredientText)
      || /\bspf\s*\d/.test(ingredientText)) {
    jobs.add('sun-protect');
  }
  // Moisturizer-SPF dual function
  if (tagSet.has('moisturizer-spf')) {
    jobs.add('moisturize-seal');
  }
  // Tinted SPF — complement job
  if (tagSet.has('tinted-spf')) {
    jobs.add('tone-evening');
  }

  // === CATEGORY → PRIMARY JOB ===
  if (category === 'cleanser') jobs.add('cleanse');
  if (category === 'moisturizer') jobs.add('moisturize-seal');
  if (category === 'oil') jobs.add('moisturize-seal'); // oils mostly seal

  // Eye products live in category 'eye-cream' AND in category 'treatment' with 'eye-cream' tag.
  if (category === 'eye-cream'
      || tagSet.has('eye-cream') || tagSet.has('eye-gel')
      || tagSet.has('eye-patches') || tagSet.has('eye-tint')) {
    jobs.add('eye');
  }

  // Lip products
  if (tagSet.has('lip-mask') || tagSet.has('lip-balm') || tagSet.has('lip-treatment')) {
    jobs.add('lip');
  }

  // Toner — hydrating vs. exfoliating
  if (category === 'toner') {
    if (!jobs.has('exfoliate-chem')) {
      jobs.add('hydrate');
    }
  }

  // Essence — hydration
  if (category === 'essence') jobs.add('hydrate');

  // Mask — only sleeping/overnight masks count as moisturize-seal
  if (category === 'mask') {
    if (tagSet.has('sleeping-mask') || tagSet.has('overnight')) {
      jobs.add('moisturize-seal');
      jobs.add('overnight-mask'); // complement candidate
    }
  }

  // Hydrate via humectant heuristic — anything that delivers moisturize-seal
  // AND has humectants also delivers hydrate. Covers moisturizers, oils,
  // moisturizer-spf tagged sunscreens, and overnight masks alike.
  if (jobs.has('moisturize-seal') && mechs.has('humectant')) {
    jobs.add('hydrate');
  }
  // Hydrating serum/treatment — pure humectant serums (no other treat-job) → hydrate
  if ((category === 'serum' || category === 'treatment') && jobs.size === 0 && mechs.has('humectant')) {
    jobs.add('hydrate');
  }

  // Makeup-replacement complement
  if (tagSet.has('primer') || tagSet.has('tinted-moisturizer')
      || tagSet.has('cushion') || tagSet.has('foundation-alternative')) {
    jobs.add('makeup-replacement');
  }

  // Barrier-cream complement — rich occlusive moisturizers explicitly tagged for barrier
  if (category === 'moisturizer'
      && (tagSet.has('barrier') || tagSet.has('rich-cream'))
      && mechs.has('ceramide-restorative')) {
    jobs.add('barrier-cream');
  }

  return {
    jobs: [...jobs].sort(),
    mechanismTags: [...mechs].sort(),
  };
};

// Node-only export — sidecar concat ignores this branch.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { deriveProductJobs };
}
