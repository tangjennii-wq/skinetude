// === budgetResolvers.js (June 2026 — Phase A.2 of Tier C IA cleanup) ===
//
// Pure functions for the Budget Picks surface — drugstore-tier ($) catalog
// items scored against a user's action goal + observed concerns. Used by:
//
//   1. The Bench sub-tab in Regimen (new canonical home after Phase A.2).
//   2. The legacy Pearls/Picks/budget view inside Insights (kept until
//      Phase C deletes the Picks sub-tab entirely).
//
// Both surfaces compute through computeBudgetPicks with the same inputs,
// so the migration is behavior-identical while we deprecate Picks.
//
// Module-scope dependencies (resolved at call time — sidecar runs first):
//   - POPULAR_PRODUCTS — the catalog
//   - getBrandPriority(brand) — brand-priority score (optional, fallback 3)
//
// Names are `budget*` prefixed to avoid colliding with the Pearls IIFE
// helpers (suggestedTagsForProduct, suggestedScoreFor, etc.) that still
// live there until Phase C.

const budgetHaystack = (p) => [
  p.name, p.brand, p.category, p.actives, p.activeIngredients,
  p.main, p.mainIngredients,
  ...(p.tags || []), ...(p.concerns || []),
].filter(Boolean).join(' ').toLowerCase();

// === Action-goal tagging ===
// Maps a product to which goals it serves. Mirrors the Pearls/Picks
// suggestedTagsForProduct exactly so scoring stays consistent.
const budgetTagsForProduct = (p) => {
  const text = budgetHaystack(p);
  const tags = [];
  if (/ceramide|barrier|cicaplast|atobarrier|lipid|panthenol|madecassoside|balm|cream|recovery/.test(text)) tags.push('repair');
  if (/centella|cica|calm|soothing|sensitive|madecassoside|azelaic|mugwort|heartleaf/.test(text)) tags.push('calm');
  if (/hyaluronic|hydrate|hydrating|glycerin|snail|essence|lotion|humectant|toner/.test(text)) tags.push('hydrate');
  if (/vitamin c|ascorbic|niacinamide|bright|pigment|arbutin|tranexamic|kojic|tone|discoloration/.test(text)) tags.push('brighten');
  if (/salicylic|bha|glycolic|lactic|aha|retinol|retinal|adapalene|texture|exfoliat|pore/.test(text)) tags.push('exfoliate');
  return [...new Set(tags)];
};

// === Concern hits ===
// Returns the subset of activeConcerns that this product seems to address
// based on haystack-text matching + the same synonym table the Pearls
// version uses.
const budgetConcernHits = (p, activeConcerns) => {
  if (!activeConcerns || activeConcerns.length === 0) return [];
  const hay = budgetHaystack(p);
  return activeConcerns.filter(c => {
    if (!c) return false;
    if (hay.includes(c)) return true;
    if (/redness|flush|sensitive|irritation/.test(c) && /redness|sensitive|calm|soothing|centella|azelaic|cica|madecassoside/.test(hay)) return true;
    if (/dry|dryness|dehydration/.test(c) && /hyaluronic|hydrate|hydrating|glycerin|snail|ceramide|barrier|cream|lotion/.test(hay)) return true;
    if (/acne|breakout|blemish|congestion/.test(c) && /salicylic|bha|adapalene|benzoyl|azelaic|retinol|pore|blemish/.test(hay)) return true;
    if (/pore|enlarged pores/.test(c) && /pore|salicylic|bha|niacinamide|retinol|retinal|texture/.test(hay)) return true;
    if (/texture|rough|bump/.test(c) && /texture|exfoliat|lactic|glycolic|retinol|retinal|aha|bha/.test(hay)) return true;
    if (/pigment|dark spot|melasma|tone/.test(c) && /pigment|bright|vitamin c|ascorbic|niacinamide|tranexamic|arbutin|kojic|tone/.test(hay)) return true;
    return false;
  });
};

// === Scoring ===
// Combines brand priority (24% weight), hero flag, action-goal match
// (heaviest single signal), and concern-hit count.
const budgetScoreFor = (p, { actionFilter = 'all', activeConcerns = [] } = {}) => {
  const tags = budgetTagsForProduct(p);
  const concernHits = budgetConcernHits(p, activeConcerns);
  let score = 0;
  const priority = typeof getBrandPriority === 'function' ? getBrandPriority(p.brand) : 3;
  if (priority === 1) score += 28;
  else if (priority === 2) score += 16;
  if (p.hero === true) score += 10;
  if (actionFilter !== 'all' && tags.includes(actionFilter)) score += 30;
  score += concernHits.length * 18;
  return score + tags.length;
};

// === Tie-breaker hash ===
// Stable, seed-aware hash so the "second-place" rotation feels intentional
// across refreshes. Matches the Pearls picksSeedHash byte-for-byte.
const budgetSeedHash = (p, seed = 0) => {
  const text = `${seed}|${p.brand || ''}|${p.name || ''}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 0xffffffff;
};

// === computeBudgetPicks — top N drugstore-tier matches ===
//
// Inputs:
//   userConcerns: string[] — user's persistent concerns (e.g. ['redness'])
//   actionFilter: 'all' | 'repair' | 'calm' | 'hydrate' | 'brighten' | 'exfoliate'
//     defaults to 'all'. In Regimen/Bench we pass userProfile.actionGoal.
//   activeConcerns: Set<string>|null — concern filter; null = use all
//     userConcerns. (Pearls supports a per-pill toggle UI; Regimen/Bench
//     just uses the persistent set.)
//   seed: number — rotation seed (0 disables rotation; Pearls bumps on
//     refresh).
//   limit: number — top N to return (default 8).
//
// Output:
//   Product[] sorted by score band then seed-hash. Each product has
//   _tags, _concernHits, _score, _tie fields appended for the renderer.

const computeBudgetPicks = ({
  userConcerns = [],
  actionFilter = 'all',
  activeConcerns = null,
  seed = 0,
  limit = 8,
} = {}) => {
  if (typeof POPULAR_PRODUCTS === 'undefined' || !Array.isArray(POPULAR_PRODUCTS)) return [];
  const concernSet = Array.isArray(activeConcerns)
    ? activeConcerns
    : activeConcerns instanceof Set
      ? [...activeConcerns]
      : (userConcerns || []).map(c => String(c || '').toLowerCase()).filter(Boolean);
  const ctx = { actionFilter, activeConcerns: concernSet };
  const decorated = POPULAR_PRODUCTS
    .filter(p => String(p.priceTier || '').trim() === '$')
    .map(p => {
      const tags = budgetTagsForProduct(p);
      const concernHits = budgetConcernHits(p, concernSet);
      return {
        ...p,
        _source: 'budget',
        _tags: tags,
        _concernHits: concernHits,
        _score: budgetScoreFor(p, ctx),
        _tie: budgetSeedHash(p, seed),
      };
    })
    .filter(p => p._tags.length > 0
      && (actionFilter === 'all' || p._tags.includes(actionFilter))
      && (concernSet.length === 0 || p._concernHits.length > 0));
  decorated.sort((a, b) => {
    const scoreBand = Math.round((b._score || 0) / 5) - Math.round((a._score || 0) / 5);
    if (scoreBand !== 0) return scoreBand;
    return (a._tie || 0) - (b._tie || 0);
  });
  return decorated.slice(0, limit);
};

// === Derm endorsement label compactor ===
// Picks the shortest legible label from a long derm citation. Used by
// the Budget render card. Pulled out of Pearls so the Regimen render
// can reuse it without duplicating the regex.
const compactDermLabel = (raw) => {
  if (!raw) return '';
  const s = String(raw);
  const handle = (s.match(/\(([^)]+)\)/) || [])[1];
  const platform = /IG\b|Instagram/i.test(s) ? 'IG'
    : /YT\b|YouTube/i.test(s) ? 'YT'
    : /TikTok/i.test(s) ? 'TikTok'
    : '';
  if (handle) return platform ? `${handle} • ${platform}` : handle;
  const dr = (s.match(/(Dr\.?\s+\w+|\w+\s+MD)/) || [])[1];
  if (dr) return platform ? `${dr} • ${platform}` : dr;
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
};
