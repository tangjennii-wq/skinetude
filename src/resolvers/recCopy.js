// === REC COPY — May 2026 ===
// Translates coverageEngine output into card-ready props with voice
// guardrails (RECOMMENDATIONS.md §1) baked in. Single source of truth
// for recommendation copy across Home / Regimen / Journal / Insights —
// keeps the "obsessed friends, not dermatologist" voice consistent.
//
// INPUT
//   coverage:    output of resolveCoverageStates
//   options: {
//     surface?:  'home' | 'regimen' | 'journal' | 'insights'
//     maxCards?: number   // surface caps per RECOMMENDATIONS.md §5
//   }
//
// OUTPUT: array of card prop objects, ordered highest priority first.
//   {
//     state:  'SWAP_SUGGESTED' | 'MISSING' | 'CONCERN_GAP' | 'COMPLEMENT'
//     eyebrow: string           // small all-caps label
//     title:   string           // headline copy (voice-checked)
//     body:    string           // 1–2 line rationale
//     picks:   CatalogPick[]    // 1–3 recommended products
//     meta:    { ... }          // surface routing hints, slot, etc.
//   }
//
// Priority order matches RECOMMENDATIONS.md §4: SWAP > MISSING > CONCERN_GAP > COMPLEMENT.

// Voice constants — quick-reference for prose. The forbidden list keeps
// reviewers honest if they hand-write copy beyond what's generated here.
// (Asserted by a CI lint later, ideally.)
const VOICE_AVOID = [
  'treatment', 'treat (verb)', 'clinically', 'dermatologist', 'prescribe',
  'diagnosis', 'symptom', 'condition', 'mechanism of action',
  'ritual', 'rhythm',
];

const SURFACE_CAPS = {
  home:     1,
  regimen:  6,  // up to one card per slot — RegimenView caps from outside
  journal:  3,
  insights: 5,
};

// Title generators per state. All inputs assumed already job/mechanism
// labels from JOB_LABELS / MECHANISM_LABELS, not raw enum values.
const titleForMissing = (jobLabel) =>
  `We'd add a ${jobLabel}.`;

const concernLabelForCard = (concern) => {
  const raw = String(concern || '').toLowerCase();
  if (/^(pores?|enlarged[_\s-]?pores?|congestion)$/.test(raw)) return 'Pores';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const titleForConcernGap = (concern, mechLabel) => {
  const concernCap = concernLabelForCard(concern);
  return `${concernCap}? Try layering ${mechLabel}.`;
};

const titleForComplement = (jobLabel) =>
  `Worth a look: ${jobLabel}.`;

const titleForSwap = (productName) =>
  `Worth rethinking — ${productName}.`;

// Build a single card per state instance.
const buildMissingCard = (entry, JOB_LABELS, catalog, pickFn) => {
  const jobLabel = JOB_LABELS[entry.job] || entry.job;
  return {
    state:   'MISSING',
    eyebrow: `Missing · ${entry.slot.toUpperCase()}`,
    title:   titleForMissing(jobLabel),
    body:    `Your ${entry.slot.toUpperCase()} slot doesn't have anything in the ${jobLabel} job. Here's what we'd reach for.`,
    picks:   pickFn(entry.job, { count: 3 }),
    meta:    { slot: entry.slot, job: entry.job, priority: 100 },
  };
};

const buildConcernGapCard = (entry, MECH_LABELS, JOB_LABELS, pickFn, jobForMech) => {
  const mechLabel = MECH_LABELS[entry.mechanism] || entry.mechanism;
  const job       = jobForMech(entry.mechanism);
  const picks     = job ? pickFn(job, { count: 3 }) : [];
  // Eyebrow promoted to "{Concern} · this week" (May 2026 audit pass)
  // so the mechanism categorization (Calm/Hydrate/Repair) is baked
  // into the actionable card. Replaces the standalone "What your
  // skin needs" trio that used to sit above this section.
  const concernCap = concernLabelForCard(entry.concern);
  return {
    state:   'CONCERN_GAP',
    eyebrow: `${concernCap} · this week`,
    title:   titleForConcernGap(entry.concern, mechLabel),
    body:    `Nothing in your routine right now carries ${mechLabel}. These would close the gap.`,
    picks,
    meta:    { concern: entry.concern, mechanism: entry.mechanism, priority: 70 },
  };
};

const buildComplementCard = (entry, JOB_LABELS, pickFn) => {
  const jobLabel = JOB_LABELS[entry.job] || entry.job;
  return {
    state:   'COMPLEMENT',
    eyebrow: 'Worth a look',
    title:   titleForComplement(jobLabel),
    body:    'You\'re covered — this just extends the routine without replacing anything you own.',
    picks:   pickFn(entry.job, { count: 2 }),
    meta:    { job: entry.job, reason: entry.reason, priority: 40 },
  };
};

const buildSwapCard = (entry) => {
  const productName = entry.product?.brand
    ? `${entry.product.brand} ${entry.product.name}`
    : entry.product?.name || 'this product';
  return {
    state:   'SWAP_SUGGESTED',
    eyebrow: 'Worth rethinking',
    title:   titleForSwap(productName),
    body:    `${entry.suggestion}\n${entry.because}`,
    picks:   [],  // SWAP shows the WHY, not picks. Action lives in a tap.
    meta:    { ruleId: entry.ruleId, priority: 200 },
  };
};

// Inverse of CONCERN_TO_MECHANISM — given a mechanism, what job in
// the catalog should we pick from? Keeps recCopy decoupled from the
// engine's concern table.
const MECHANISM_TO_PICK_JOB = {
  'ceramide-restorative': 'barrier-repair',
  'anti-inflammatory':    'soothe',
  humectant:              'hydrate',
  'vitamin-C':            'treat-vitC',
  'exfoliant-BHA':        'exfoliate-chem',
  'exfoliant-AHA':        'exfoliate-chem',
  'exfoliant-PHA':        'exfoliate-chem',
  niacinamide:            'treat-niacinamide',
  retinoid:               'treat-retinoid',
  peptide:                'treat-peptide',
};
const jobForMechanism = (mech) => MECHANISM_TO_PICK_JOB[mech] || null;

const buildRecCards = (coverage, options = {}) => {
  const {
    surface  = 'journal',
    maxCards = SURFACE_CAPS[surface] || 3,
  } = options;

  // Catalog + label lookups. Use globals (sidecar concat) if present,
  // else fall back to require in Node.
  const labels = (typeof JOB_LABELS !== 'undefined')
    ? { jobs: JOB_LABELS, mechs: MECHANISM_LABELS }
    : (() => {
        try {
          const m = require('../../data/recommendationCatalog.js');
          return { jobs: m.JOB_LABELS, mechs: m.MECHANISM_LABELS };
        } catch (e) { return { jobs: {}, mechs: {} }; }
      })();

  const pickFn = (typeof pickFromCatalog !== 'undefined')
    ? pickFromCatalog
    : (() => {
        try {
          const m = require('../../data/recommendationCatalog.js');
          return m.pickFromCatalog;
        } catch (e) { return () => []; }
      })();

  const cards = [];

  // SWAP — highest priority
  (coverage.swap || []).forEach(s => cards.push(buildSwapCard(s)));

  // MISSING — required jobs
  (coverage.missing || []).forEach(m => cards.push(buildMissingCard(m, labels.jobs, null, pickFn)));

  // CONCERN_GAP
  (coverage.concernGap || []).forEach(c => cards.push(buildConcernGapCard(c, labels.mechs, labels.jobs, pickFn, jobForMechanism)));

  // COMPLEMENT — lowest priority, only surfaces in Insights/Regimen
  (coverage.complement || []).forEach(c => cards.push(buildComplementCard(c, labels.jobs, pickFn)));

  // Sort by priority descending and cap.
  cards.sort((a, b) => (b.meta.priority || 0) - (a.meta.priority || 0));

  // Surface-specific filters per RECOMMENDATIONS.md §5
  let filtered = cards;
  if (surface === 'home') {
    // Home shows MISSING only — and ONLY for truly glaring gaps.
    // Per spec: "Only if glaring gap (no SPF, no cleanser). Stay quiet."
    // Hydrate / moisturize-seal missing is granular; belongs to Regimen + Insights,
    // not the front door.
    const HOME_GLARING_JOBS = new Set(['sun-protect', 'cleanse']);
    filtered = cards.filter(c => c.state === 'MISSING' && HOME_GLARING_JOBS.has(c.meta?.job));
  } else if (surface === 'regimen') {
    // Regimen shows MISSING (per empty slot — caller handles slot routing)
    filtered = cards.filter(c => c.state === 'MISSING' || c.state === 'COMPLEMENT');
  } else if (surface === 'journal') {
    // Journal shows SWAP + CONCERN_GAP
    filtered = cards.filter(c => c.state === 'SWAP_SUGGESTED' || c.state === 'CONCERN_GAP');
  } else if (surface === 'insights') {
    // Insights shows CONCERN_GAP + COMPLEMENT
    filtered = cards.filter(c => c.state === 'CONCERN_GAP' || c.state === 'COMPLEMENT');
  }

  return filtered.slice(0, maxCards);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildRecCards,
    VOICE_AVOID,
    SURFACE_CAPS,
    MECHANISM_TO_PICK_JOB,
  };
}
