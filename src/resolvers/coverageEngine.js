// === COVERAGE ENGINE — May 2026 ===
// Pure functions that compute recommendation states from a resolved
// routine + this week's flagged concerns + user preferences. See
// RECOMMENDATIONS.md §3–5 for the rules.
//
// INPUT
//   routine:     { am: Product[], pm: Product[] }
//                Already resolved (use resolveTodayRitual or similar).
//                Products must have category/actives/main/tags fields.
//   concerns:    string[]   e.g. ['repair', 'calm', 'hydrate']
//                Same vocabulary as NEEDS_CATALOG in JournalTodayPanel:
//                'repair' | 'calm' | 'hydrate' | 'brighten' | 'clarify'.
//   preferences: { routineSize?: 'minimal' | 'standard' | 'maximal' }
//   deriveJobs:  override for the derivation fn (testing). Defaults to
//                deriveProductJobs from the sibling module.
//
// OUTPUT
//   {
//     missing:    Array<{ slot: 'am'|'pm', job: string }>,
//     concernGap: Array<{ concern: string, mechanism: string }>,
//     complement: Array<{ job: string, reason: string }>,
//     swap:       Array<...>,   // empty in v1; AI worker populates later
//     allCovered: boolean,      // true when missing + concernGap + swap empty
//     coverage:   {             // for debugging + downstream UI
//       am: { jobs: string[], mechanismTags: string[] },
//       pm: { jobs: string[], mechanismTags: string[] },
//     },
//   }
//
// State priority (highest first): SWAP > MISSING > CONCERN_GAP > COMPLEMENT.
// COMPLEMENT is suppressed entirely for minimalist users
// (RECOMMENDATIONS.md §6 — minimalist suppression).

// Required jobs per slot — Layer 1 structural check.
const REQUIRED_JOBS_AM = ['cleanse', 'hydrate', 'moisturize-seal', 'sun-protect'];
const REQUIRED_JOBS_PM = ['cleanse', 'hydrate', 'moisturize-seal'];

// Concern → mechanism family — Layer 2 fit check.
// Vocab matches NEEDS_CATALOG in JournalTodayPanel so the engine plugs
// into the existing concern flagging without translation.
const CONCERN_TO_MECHANISM = {
  repair:   'ceramide-restorative',
  calm:     'anti-inflammatory',
  hydrate:  'humectant',
  brighten: 'vitamin-C',
  clarify:  'exfoliant-BHA',
};

// === SWAP_SUGGESTED RULES (v1, deterministic) ===
// Per RECOMMENDATIONS.md §4, SWAP is the only state that says something
// negative about an owned product. Bar is high. v1 rules are deterministic
// and explanation-first (always include a `because` line).
//
// Each rule:
//   {
//     id:       string                          // stable, for UI dedupe
//     test:     (ctx) => Product | null         // returns offending product or null
//     suggestion: string                        // 1-line action, voice-checked
//     because:    string                        // 1-line mechanism rationale
//   }
//
// ctx: { am: Product[], pm: Product[], concerns: string[], derive: fn }
//
// SWAP fires ONLY when the relevant concern is flagged. No concern, no swap.
const SWAP_RULES = [
  {
    id: 'am-cleansing-oil-calm',
    test: ({ am, concerns, derive }) => {
      if (!concerns.includes('calm')) return null;
      return (am || []).find(p => {
        if (!p) return false;
        const tags = (p.tags || []).map(t => String(t).toLowerCase());
        const name = String(p.name || '').toLowerCase();
        const cat  = String(p.category || '').toLowerCase();
        // Cleansing oils, balms, double-cleanse formats in the AM slot
        if (cat !== 'cleanser') return false;
        return tags.includes('cleansing-oil') || tags.includes('cleansing-balm')
            || tags.includes('double-cleanse') || tags.includes('first-cleanse')
            || /oil|balm/.test(name);
      }) || null;
    },
    suggestion: 'Cut AM cleansing oil — switch to a gentle gel or just water for now.',
    because:    'Oil + emulsifier residue is a likely overstripping source when redness is persisting.',
  },
  {
    id: 'pm-retinoid-repair',
    test: ({ pm, concerns, derive }) => {
      if (!concerns.includes('repair')) return null;
      return (pm || []).find(p => {
        if (!p) return false;
        const d = derive(p);
        return d.jobs.includes('treat-retinoid');
      }) || null;
    },
    suggestion: 'Buffer the retinoid — alternate nights, or skip until the barrier reads steady.',
    because:    'Retinoid turnover is hard to layer on a compromised barrier.',
  },
  {
    id: 'physical-exfoliant-calm',
    test: ({ am, pm, concerns, derive }) => {
      if (!concerns.includes('calm')) return null;
      return [...(am || []), ...(pm || [])].find(p => {
        if (!p) return false;
        const d = derive(p);
        return d.jobs.includes('exfoliate-phys');
      }) || null;
    },
    suggestion: 'Drop physical exfoliation this week — PHA when you\'re ready to add turnover back.',
    because:    'Mechanical abrasion compounds reactive skin.',
  },
  {
    id: 'too-many-actives-calm',
    test: ({ pm, concerns, derive }) => {
      if (!concerns.includes('calm')) return null;
      const treatJobs = ['treat-retinoid', 'treat-vitC', 'exfoliate-chem'];
      const offenders = (pm || []).filter(p => {
        if (!p) return false;
        const d = derive(p);
        return d.jobs.some(j => treatJobs.includes(j));
      });
      return offenders.length >= 3 ? offenders[0] : null;
    },
    suggestion: 'Simplify PM — drop down to one active until reactivity settles.',
    because:    'Three or more turnover-class actives in one slot is hard for a calm phase.',
  },
];

const evaluateSwapRules = ({ am, pm, concerns, derive }) => {
  const hits = [];
  const seenIds = new Set();
  SWAP_RULES.forEach(rule => {
    const offender = rule.test({ am, pm, concerns, derive });
    if (offender && !seenIds.has(rule.id)) {
      seenIds.add(rule.id);
      hits.push({
        ruleId:     rule.id,
        product:    { name: offender.name, brand: offender.brand, id: offender.id || null },
        suggestion: rule.suggestion,
        because:    rule.because,
      });
    }
  });
  return hits;
};

// Roll up a slot's products into the union of jobs and mechanism tags.
const summarizeSlot = (products, deriveJobs) => {
  const jobs = new Set();
  const mechs = new Set();
  (products || []).forEach(p => {
    const d = deriveJobs(p);
    (d.jobs || []).forEach(j => jobs.add(j));
    (d.mechanismTags || []).forEach(m => mechs.add(m));
  });
  return {
    jobs: [...jobs].sort(),
    mechanismTags: [...mechs].sort(),
  };
};

const resolveCoverageStates = (
  { routine, concerns = [], preferences = {} } = {},
  deriveJobs = (typeof deriveProductJobs !== 'undefined' ? deriveProductJobs : null)
) => {
  // Defensive: if no derivation fn passed AND none in scope, fall back to empty.
  if (typeof deriveJobs !== 'function') {
    return {
      missing: [], concernGap: [], complement: [], swap: [],
      allCovered: true,
      coverage: { am: { jobs: [], mechanismTags: [] }, pm: { jobs: [], mechanismTags: [] } },
    };
  }

  const am = (routine && routine.am) || [];
  const pm = (routine && routine.pm) || [];

  const amSummary = summarizeSlot(am, deriveJobs);
  const pmSummary = summarizeSlot(pm, deriveJobs);

  const amJobSet = new Set(amSummary.jobs);
  const pmJobSet = new Set(pmSummary.jobs);
  // Mechanisms unify across AM/PM — concern fit only needs the mechanism
  // to be present somewhere in the active routine, not in both slots.
  const allMechs = new Set([...amSummary.mechanismTags, ...pmSummary.mechanismTags]);

  const missing    = [];
  const concernGap = [];
  const complement = [];
  // SWAP from deterministic rules. AI worker can append later.
  const swap       = evaluateSwapRules({ am, pm, concerns: concerns || [], derive: deriveJobs });

  // === Layer 1 — required jobs per slot ===
  REQUIRED_JOBS_AM.forEach(job => {
    if (!amJobSet.has(job)) missing.push({ slot: 'am', job });
  });
  REQUIRED_JOBS_PM.forEach(job => {
    if (!pmJobSet.has(job)) missing.push({ slot: 'pm', job });
  });

  // === Layer 2 — concern fit ===
  (concerns || []).forEach(concern => {
    const mech = CONCERN_TO_MECHANISM[concern];
    if (!mech) return; // unknown concern — skip silently
    if (!allMechs.has(mech)) {
      concernGap.push({ concern, mechanism: mech });
    }
  });

  // === COMPLEMENT — different-job extensions ===
  // Suppressed entirely for minimalists per RECOMMENDATIONS.md §6.
  if (preferences.routineSize !== 'minimal') {
    // Has SPF but no tinted SPF → tinted-SPF complement
    if (amJobSet.has('sun-protect') && !amJobSet.has('tone-evening')) {
      complement.push({ job: 'tone-evening', reason: 'has-sun-protect-no-tint' });
    }
    // Has moisturize but no ceramide AND repair is a concern → barrier-cream complement
    if ((concerns || []).includes('repair')
        && pmJobSet.has('moisturize-seal')
        && !allMechs.has('ceramide-restorative')) {
      complement.push({ job: 'barrier-cream', reason: 'repair-flagged-no-ceramide' });
    }
  }

  return {
    missing,
    concernGap,
    complement,
    swap,
    allCovered: missing.length === 0 && concernGap.length === 0 && swap.length === 0,
    coverage: { am: amSummary, pm: pmSummary },
  };
};

// Node-only export — sidecar concat ignores this branch.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveCoverageStates,
    summarizeSlot,
    evaluateSwapRules,
    SWAP_RULES,
    REQUIRED_JOBS_AM,
    REQUIRED_JOBS_PM,
    CONCERN_TO_MECHANISM,
  };
}
