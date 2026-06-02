// === Frida Composite Index v1 — June 2026 ===
// Replaces the simple unweighted mean of 6 metricSnapshot domains with a
// scientifically-grounded blend of three inputs per domain, then a goal-
// weighted composite. Sensitivity is dropped as an outcome domain (it's
// antecedent — see `feedback`/`project` memos for the call). The 1-10
// user rating slider folds in as the felt-sense input.
//
// Design choices (locked by Jenni):
//   - 5 outcome domains: redness, hydration, texture, breakouts, barrier
//   - Per-domain blend: 50% AI photo + 30% noticed-chip + 20% overall rating
//   - Fall back to renormalized 2-input or AI-only modes when inputs missing
//   - Baseline = median of first 10 logs (mode-gated for confidence)
//   - At day 7: surface ONE most-benign pattern
//   - At day 10+: full pattern observations OK
//   - Goal weighting per userProfile.actionGoal
//
// Pure module-scope functions. No React, no App-state coupling. Concatenated
// into the bundle by build_current.js between the existing resolvers.

// =========================================================================
// 1. CONSTANTS
// =========================================================================

const COMPOSITE_DOMAINS = ['redness', 'hydration', 'texture', 'breakouts', 'barrier'];

// Higher = better skin for that domain. Same scale family as COMPARE_SCORE_MAP
// but redefined here so this resolver has zero dependencies on the sidecar.
const COMPOSITE_SCORE_MAP = {
  redness:   { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
  hydration: { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
  texture:   { Smooth: 100, Even: 80, Uneven: 55, Rough: 30, Bumpy: 10 },
  breakouts: { Clear: 100, Few: 75, Some: 50, Many: 25, Severe: 10 },
  barrier:   { Strong: 100, Steady: 80, Holding: 55, Compromised: 30, Stripped: 10 },
};

// Maps a noticed-chip key → the domain it signals a deficit on. Chips not
// here (sensitivity, other) don't bias any composite domain — they remain
// in the log as context.
const CHIP_TO_DOMAIN = {
  redness:        'redness',
  dryness:        'hydration',
  breakouts:      'breakouts',
  texture:        'texture',
  enlarged_pores: 'texture',
  dullness:       'texture',  // until tone is added as a domain in v2
};

// Felt-sense values for the chip signal per domain:
//   chip flagged for D    → user reports a deficit there → 35 (Moderate)
//   chip NOT flagged for D → no specific complaint → 70 (between Low and Good)
const CHIP_DEFICIT_SCORE = 35;
const CHIP_NEUTRAL_SCORE = 70;

// Default domain weights. Sensitivity isn't here; if it's still on a legacy
// log's metricSnapshot it gets ignored. Goal modulation multiplies these.
const DOMAIN_WEIGHT_DEFAULT = {
  redness:   1.0,
  hydration: 1.0,
  texture:   1.0,
  breakouts: 1.0,
  barrier:   1.0,
};

// Per-goal multipliers. Values multiply the default weight before averaging.
// Matches userProfile.actionGoal vocab — keep in sync.
const GOAL_WEIGHTS = {
  MAINTENANCE: { ...DOMAIN_WEIGHT_DEFAULT },
  BARRIER_REPAIR: { redness: 1.2, hydration: 1.5, texture: 1.0, breakouts: 1.0, barrier: 1.8 },
  ACNE_REDUCTION: { redness: 1.0, hydration: 1.0, texture: 1.3, breakouts: 2.0, barrier: 1.0 },
  ANTI_AGING:     { redness: 1.3, hydration: 1.2, texture: 1.8, breakouts: 1.0, barrier: 1.0 },
  BRIGHTENING:    { redness: 1.1, hydration: 1.0, texture: 1.3, breakouts: 1.0, barrier: 1.0 },
  HYDRATION:      { redness: 1.0, hydration: 1.8, texture: 1.0, breakouts: 1.0, barrier: 1.5 },
  PIH:            { redness: 1.2, hydration: 1.0, texture: 1.3, breakouts: 1.2, barrier: 1.0 },
};

// Input-blend weights. Sum to 1.0 in the all-present case; otherwise the
// resolver renormalizes against the available inputs.
const WEIGHT_AI = 0.50;
const WEIGHT_CHIP = 0.30;
const WEIGHT_OVERALL = 0.20;

// Baseline policy
const BASELINE_TARGET_N = 10;       // hit this many logs → fully anchored
const BASELINE_PATTERN_THRESHOLD = 7; // at day 7 surface ONE benign pattern
const BASELINE_REFRESH_DAYS = 90;   // prompt user to re-anchor after this

// =========================================================================
// 2. UTILITIES
// =========================================================================

const compositeTitleCase = (w) => w ? String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase() : null;

// Convert a 1-10 (or legacy 1-5) user rating to a 10-100 felt-sense score.
// Mirrors normalizeRatingTo10 semantics but local-only so this file has no
// cross-resolver dependency.
const compositeRatingTo100 = (rating, ratingScale) => {
  if (rating == null || Number.isNaN(Number(rating))) return null;
  const n = Number(rating);
  // Legacy 1-5 scale: expand to 1-10 first.
  const ten = (ratingScale === '5' || (n >= 1 && n <= 5 && ratingScale !== '10')) ? (n * 2) : n;
  return Math.max(10, Math.min(100, ten * 10));
};

const median = (arr) => {
  const xs = arr.filter(x => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
};

// =========================================================================
// 3. PER-DOMAIN BLENDED SCORE
// =========================================================================

// Returns { score, inputs } for ONE domain on ONE log.
//   score: 0-100 or null if nothing usable
//   inputs: which signals contributed — used by composite to pick its mode
const computeDomainScore = (log, domain) => {
  if (!log || !COMPOSITE_SCORE_MAP[domain]) return { score: null, inputs: [] };

  // === Input 1: AI photo read ===
  const snap = log.metricSnapshot || null;
  const aiWord = snap && snap[domain] ? compositeTitleCase(snap[domain]) : null;
  const S_AI = aiWord && COMPOSITE_SCORE_MAP[domain][aiWord] != null
    ? COMPOSITE_SCORE_MAP[domain][aiWord]
    : null;

  // === Input 2: User's noticed chips ===
  // If the chip mapped to this domain is flagged → deficit signal.
  // If user logged chips at all and didn't flag this domain → neutral signal.
  // If user logged NO chips at all → no signal (null).
  const noticedArr = Array.isArray(log.noticed) ? log.noticed : null;
  let S_chip = null;
  if (noticedArr) {
    const flaggedDomains = new Set(noticedArr.map(k => CHIP_TO_DOMAIN[k]).filter(Boolean));
    S_chip = flaggedDomains.has(domain) ? CHIP_DEFICIT_SCORE : CHIP_NEUTRAL_SCORE;
  }

  // === Input 3: Overall felt-sense 1-10 rating ===
  const S_overall = compositeRatingTo100(log.rating, log.ratingScale);

  // === BLEND ===
  // Honor Jenni's call: if user gave no rating, fall back to AI-only with a
  // warning surfaced upstream (mode === 'ai-only'). The 2-input renormalize
  // is reserved for the AI-missing path (legacy logs or photo-failure).
  const has = { ai: S_AI != null, chip: S_chip != null, overall: S_overall != null };

  if (has.ai && has.chip && has.overall) {
    return {
      score: WEIGHT_AI * S_AI + WEIGHT_CHIP * S_chip + WEIGHT_OVERALL * S_overall,
      inputs: ['ai', 'chip', 'overall'],
    };
  }
  if (has.ai && has.chip && !has.overall) {
    // Renormalize across the two present inputs (AI + chip)
    const wA = WEIGHT_AI / (WEIGHT_AI + WEIGHT_CHIP);
    const wC = WEIGHT_CHIP / (WEIGHT_AI + WEIGHT_CHIP);
    return { score: wA * S_AI + wC * S_chip, inputs: ['ai', 'chip'] };
  }
  if (has.ai && !has.chip && has.overall) {
    const wA = WEIGHT_AI / (WEIGHT_AI + WEIGHT_OVERALL);
    const wO = WEIGHT_OVERALL / (WEIGHT_AI + WEIGHT_OVERALL);
    return { score: wA * S_AI + wO * S_overall, inputs: ['ai', 'overall'] };
  }
  if (has.ai) {
    // AI-only fallback per Jenni's spec when rating + chips both missing.
    return { score: S_AI, inputs: ['ai'] };
  }
  if (has.chip && has.overall) {
    const wC = WEIGHT_CHIP / (WEIGHT_CHIP + WEIGHT_OVERALL);
    const wO = WEIGHT_OVERALL / (WEIGHT_CHIP + WEIGHT_OVERALL);
    return { score: wC * S_chip + wO * S_overall, inputs: ['chip', 'overall'] };
  }
  if (has.chip) return { score: S_chip, inputs: ['chip'] };
  if (has.overall) return { score: S_overall, inputs: ['overall'] };
  return { score: null, inputs: [] };
};

// =========================================================================
// 4. COMPOSITE SCORE (goal-weighted, 0-100)
// =========================================================================

// Returns:
//   composite: 0-100 number or null
//   perDomain: { redness: 0-100, hydration: ..., ... }
//   inputsUnion: array of input types that contributed to ANY domain
//   mode: 'full' | 'ai-only' | 'self-only' | 'partial' | 'empty'
//     full       = at least one domain has all 3 inputs
//     ai-only    = no chip + no rating; only AI photo
//     self-only  = no AI photo; chip + rating only
//     partial    = a mix of 1-2 input modes across domains
//     empty      = no usable inputs
//   warning: human-readable string when mode != 'full', else null
const computeCompositeScore = (log, goal) => {
  if (!log) return { composite: null, perDomain: {}, inputsUnion: [], mode: 'empty', warning: 'No log data.' };

  const goalKey = goal && GOAL_WEIGHTS[goal] ? goal : 'MAINTENANCE';
  const weights = GOAL_WEIGHTS[goalKey];

  const perDomain = {};
  const inputModes = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const D of COMPOSITE_DOMAINS) {
    const { score, inputs } = computeDomainScore(log, D);
    if (score == null) continue;
    perDomain[D] = Math.round(score);
    inputModes.push(inputs);
    const w = weights[D] ?? 1.0;
    weightedSum += score * w;
    weightTotal += w;
  }

  if (weightTotal === 0) {
    return { composite: null, perDomain: {}, inputsUnion: [], mode: 'empty', warning: 'Nothing to score yet.' };
  }

  // Classify the overall mode by inspecting which inputs contributed.
  const flat = inputModes.flat();
  const hasAI = flat.includes('ai');
  const hasChip = flat.includes('chip');
  const hasOverall = flat.includes('overall');
  const allDomainsFull = inputModes.length === COMPOSITE_DOMAINS.length
    && inputModes.every(arr => arr.includes('ai') && arr.includes('chip') && arr.includes('overall'));

  let mode = 'partial';
  let warning = null;
  if (allDomainsFull) {
    mode = 'full';
  } else if (hasAI && !hasChip && !hasOverall) {
    mode = 'ai-only';
    warning = 'AI photo only — add a rating + chips for a fuller read.';
  } else if (!hasAI && (hasChip || hasOverall)) {
    mode = 'self-only';
    warning = 'No photo read yet — add one for a more complete score.';
  } else if (hasAI && !hasOverall) {
    mode = 'partial';
    warning = 'Add your 1-10 rating to fold in how you feel.';
  } else if (!hasAI) {
    mode = 'self-only';
    warning = 'No photo read yet.';
  }

  return {
    composite: Math.round(weightedSum / weightTotal),
    perDomain,
    inputsUnion: Array.from(new Set(flat)),
    mode,
    warning,
    goalKey,
  };
};

// Convenience: "8.4" string for display, or null.
const compositeOut10 = (log, goal) => {
  const { composite } = computeCompositeScore(log, goal);
  return composite != null ? (composite / 10).toFixed(1) : null;
};

// =========================================================================
// 5. BASELINE
// =========================================================================

// Returns:
//   composite: median composite over first BASELINE_TARGET_N qualifying logs
//   perDomain: median per-domain scores over same set
//   n: count of qualifying logs used
//   setAt: ISO date of the earliest qualifying log (when baseline anchor began)
//   mode: 'establishing' (n < 7) | 'forming' (7-9) | 'anchored' (10+) | 'refreshing' (90+ days old)
//   ready: true once we've passed the 7-day note threshold
const computeBaseline = (logs, goal) => {
  const sorted = (Array.isArray(logs) ? logs : [])
    .filter(l => l && l.date)
    // === TRAVEL EXCLUSION (June 2026 per Jenni) ===
    // Travel-tagged logs still get individual composite scores (you can
    // see how the trip went), but they don't anchor the baseline. Skin
    // behaves differently on the road — lighting, water, climate, sleep
    // all shift. Baseline stays calibrated to "your normal skin." When
    // travel mode flips off and the user returns home, baseline keeps
    // its pre-travel anchor; new home-day logs continue to fill it.
    .filter(l => !(l.travel === true))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Qualifying logs: have BOTH AI snapshot and a rating, so the per-domain
  // blend has the strongest possible signal at anchor time.
  const qualifying = sorted.filter(l => l.metricSnapshot && l.rating != null);

  // If we don't have enough strong logs yet, fall back to any log with a
  // composite > null so the early-days experience still shows movement.
  const pool = qualifying.length >= 3 ? qualifying : sorted.filter(l => {
    return computeCompositeScore(l, goal).composite != null;
  });

  const sample = pool.slice(0, BASELINE_TARGET_N);
  if (sample.length === 0) {
    return { composite: null, perDomain: {}, n: 0, setAt: null, mode: 'establishing', ready: false };
  }

  const compositeVals = [];
  const perDomainVals = {};
  for (const D of COMPOSITE_DOMAINS) perDomainVals[D] = [];

  for (const l of sample) {
    const { composite, perDomain } = computeCompositeScore(l, goal);
    if (composite != null) compositeVals.push(composite);
    for (const D of COMPOSITE_DOMAINS) {
      if (perDomain[D] != null) perDomainVals[D].push(perDomain[D]);
    }
  }

  const baselineComposite = median(compositeVals);
  const baselinePerDomain = {};
  for (const D of COMPOSITE_DOMAINS) baselinePerDomain[D] = median(perDomainVals[D]);

  const n = sample.length;
  const setAt = sample[0].date;
  const ageDays = (Date.now() - new Date(setAt).getTime()) / (1000 * 60 * 60 * 24);

  let mode = 'establishing';
  if (n >= BASELINE_TARGET_N) mode = 'anchored';
  else if (n >= BASELINE_PATTERN_THRESHOLD) mode = 'forming';
  if (mode === 'anchored' && ageDays > BASELINE_REFRESH_DAYS) mode = 'refreshing';

  return {
    composite: baselineComposite != null ? Math.round(baselineComposite) : null,
    perDomain: baselinePerDomain,
    n,
    setAt,
    mode,
    ready: n >= BASELINE_PATTERN_THRESHOLD,
    ageDays: Math.round(ageDays),
  };
};

// =========================================================================
// 6. DELTA vs BASELINE
// =========================================================================

const computeBaselineDelta = (todayScore, baseline) => {
  if (!todayScore || !baseline || todayScore.composite == null || baseline.composite == null) {
    return { composite_delta: null, perDomain_delta: {}, vsBaseline: null };
  }
  const composite_delta = todayScore.composite - baseline.composite;
  const perDomain_delta = {};
  for (const D of COMPOSITE_DOMAINS) {
    if (todayScore.perDomain[D] != null && baseline.perDomain[D] != null) {
      perDomain_delta[D] = todayScore.perDomain[D] - baseline.perDomain[D];
    }
  }
  // Human-readable vsBaseline phrasing
  const sign = composite_delta > 0 ? '+' : '';
  const vsBaseline = `${sign}${composite_delta} vs your baseline`;
  return { composite_delta, perDomain_delta, vsBaseline };
};

// =========================================================================
// 7. MOST-BENIGN PATTERN AT DAY 7 (forming-mode messaging)
// =========================================================================

// Per Jenni: at the day-7 threshold, name ONE pattern — the most BENIGN
// one — to give the user a tiny early-read win without overclaiming.
// "Most benign" = the domain with (a) the highest mean score across logs,
// AND (b) the lowest variance. Lowest-risk thing to point at.
//
// Returns:
//   { domain, copy, n, mean, stdev } or null when nothing qualifies
const pickMostBenignPattern = (logs, goal) => {
  // Same travel exclusion as baseline — patterns derived for the
  // anchored state shouldn't be drawn from a week at the beach.
  const pool = (Array.isArray(logs) ? logs : []).filter(l => l && l.metricSnapshot && !(l.travel === true));
  if (pool.length < BASELINE_PATTERN_THRESHOLD) return null;

  const perDomainSeries = {};
  for (const D of COMPOSITE_DOMAINS) perDomainSeries[D] = [];

  for (const l of pool) {
    const { perDomain } = computeCompositeScore(l, goal);
    for (const D of COMPOSITE_DOMAINS) {
      if (perDomain[D] != null) perDomainSeries[D].push(perDomain[D]);
    }
  }

  const stats = COMPOSITE_DOMAINS.map(D => {
    const series = perDomainSeries[D];
    if (series.length < 3) return null;
    const mean = series.reduce((s, x) => s + x, 0) / series.length;
    const variance = series.reduce((s, x) => s + (x - mean) ** 2, 0) / series.length;
    const stdev = Math.sqrt(variance);
    // Benignness score = mean - stdev (high & stable wins). Threshold: mean ≥ 65.
    return { domain: D, mean, stdev, score: mean - stdev };
  }).filter(s => s && s.mean >= 65);

  if (stats.length === 0) return null;
  stats.sort((a, b) => b.score - a.score);
  const winner = stats[0];

  // Copy follows brand voice: terse, descriptive, no causal claims.
  const DOMAIN_COPY = {
    redness:   'Your redness reads steady — a quiet baseline to build from.',
    hydration: 'Your hydration has been holding — that\'s your stable ground.',
    texture:   'Texture\'s been even, log to log.',
    breakouts: 'Breakouts are quiet — nothing flaring.',
    barrier:   'Barrier reads steady — the rest of the routine can flex.',
  };

  return {
    domain: winner.domain,
    copy: DOMAIN_COPY[winner.domain],
    n: perDomainSeries[winner.domain].length,
    mean: Math.round(winner.mean),
    stdev: Math.round(winner.stdev),
  };
};

// =========================================================================
// 8. PUBLIC EXPORTS (module-scope — bundled into the App globals)
// =========================================================================

// Everything declared at module-scope above is already available to the
// sidecar after build_current.js concatenation. The explicit list below
// is purely for documentation / check_build.js manifest purposes:
//
//   COMPOSITE_DOMAINS, COMPOSITE_SCORE_MAP, CHIP_TO_DOMAIN, GOAL_WEIGHTS,
//   computeDomainScore, computeCompositeScore, compositeOut10,
//   computeBaseline, computeBaselineDelta, pickMostBenignPattern
