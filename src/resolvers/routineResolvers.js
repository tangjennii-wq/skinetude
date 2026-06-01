// === FACE-ONLY ROUTINE FILTER (May 2026 — bug fix) ===
// User reported PM slot showing 11+ products including "The Body Exfoliator."
// Root cause: each component independently decided what belonged in
// AM/PM, so display fixes on the cover broke modal/Regimen Today and
// vice versa. The architectural answer is ONE resolver function
// (resolveTodayRitual below) used by every Home / Regimen Today /
// Check-in Modal surface.
const MAX_FACE_ROUTINE_SLOT_PRODUCTS = 6;
const isBodyProduct = (p) => {
  if (!p) return false;
  // Direct catalog signal — preferred path. Once products.js catalog
  // entries gain a body:true flag, this short-circuits cleanly.
  if (p.body === true) return true;
  if (p.face === false) return true;
  const text = `${p.name || ''} ${p.brand || ''}`.toLowerCase();
  // Word-boundary checks so "everybody serum" doesn't trip the filter.
  if (/\bbody\b/.test(text)) return true;
  if (/\bhand cream\b|\bfoot cream\b|\bhair\b|\bscalp\b/.test(text)) return true;
  const tags = (p.tags || []).map(t => String(t).toLowerCase());
  if (tags.includes('body') || tags.includes('hand') || tags.includes('foot') || tags.includes('hair') || tags.includes('scalp')) return true;
  return false;
};

// === resolveTodayRitual — SINGLE SOURCE OF TRUTH (May 2026) ===
// Every Home / Regimen Today / Check-in Modal view MUST use this
// resolver to decide which products are in today's AM and PM. Each
// component making its own decision is what caused the body-exfoliator-
// in-PM regression: the cover used buildSlot, Regimen used a different
// reader, the modal seeded from yet another path, and a fix on one
// surface broke the others.
//
// Rules enforced here:
//   1. If a regimenLog exists for date → use its amProducts/pmProducts
//      (PLUS amExtras/pmExtras) as the canonical list. Log wins
//      whether submitted or in-progress — the log IS today's truth.
//   2. If no log → if user has a built routine, derive from pattern
//      (getProductsForTodayFromPattern with cadence + useTimes).
//   3. If no log AND no pattern → empty.
//   4. Body / hand / scalp / hair products are filtered out at every
//      path. Face routines are face only.
//   5. Hard cap of MAX_FACE_ROUTINE_SLOT_PRODUCTS per slot. Overflow
//      surfaces as `amOverflow` / `pmOverflow` so the UI can render
//      "+N more" instead of an unbounded list; callers can reveal hidden items inline.
//   6. Dedupe by product id — defensive against logs that accidentally
//      pushed the same id twice.
//
// AI suggestions never enter today's ritual via this resolver — they
// must go through an explicit "apply" mutation that writes to the
// regimenLog first.
//
// Returns:
//   {
//     source: 'submitted-log' | 'in-progress-log' | 'pattern' | 'empty',
//     am: Product[],         // capped, body-filtered, deduped
//     pm: Product[],         // capped, body-filtered, deduped
//     amExtras: string[],    // free-text "used something else" entries
//     pmExtras: string[],
//     amOverflow: number,    // count truncated from am
//     pmOverflow: number,
//     amHidden: Product[],    // products hidden behind "+N more"
//     pmHidden: Product[],
//   }
//
// NOTE: resolveTodayRitual references userHasBuiltPattern and
// getProductsForTodayFromPattern. userHasBuiltPattern stays in
// index.jsx.source for now (it's tightly coupled to productCadenceDays
// helpers that haven't been extracted). JS reference resolution is
// at call time, not parse time, so this works as long as those
// symbols exist at module scope by the time resolveTodayRitual is
// invoked — which they do (sidecar runs entirely before any
// component calls resolveTodayRitual).
const resolveTodayRitual = ({ products, regimenLogs, date, acceptedPlan = null }) => {
  const empty = {
    source: 'empty', am: [], pm: [],
    amExtras: [], pmExtras: [],
    amOverflow: 0, pmOverflow: 0,
    amHidden: [], pmHidden: [],
  };
  if (!date) return empty;
  const active = Array.isArray(products) ? products.filter(p => !p.endDate) : [];
  const log = Array.isArray(regimenLogs) ? regimenLogs.find(r => r.date === date) : null;
  const resolvePlanForDate = (plan) => {
    if (!plan || !date) return null;
    let dow;
    try { dow = new Date(date + 'T00:00:00').getDay(); }
    catch { dow = new Date().getDay(); }
    const resolveByIds = (ids = []) => ids
      .map(id => active.find(p => p.id === id))
      .filter(Boolean);
    const amCap = capWithOverflow(resolveByIds((plan.am || {})[dow] || []));
    const pmCap = capWithOverflow(resolveByIds((plan.pm || {})[dow] || []));
    if (amCap.list.length === 0 && pmCap.list.length === 0) return null;
    return {
      source: 'accepted-plan',
      am: amCap.list,
      pm: pmCap.list,
      amExtras: [], pmExtras: [],
      amOverflow: amCap.overflow,
      pmOverflow: pmCap.overflow,
      amHidden: amCap.hidden,
      pmHidden: pmCap.hidden,
    };
  };
  const capWithOverflow = (arr) => {
    const filtered = (arr || []).filter(p => p && !isBodyProduct(p));
    // Dedupe by id.
    const seen = new Set();
    const deduped = [];
    for (const p of filtered) {
      if (!p || !p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      deduped.push(p);
    }
    if (deduped.length <= MAX_FACE_ROUTINE_SLOT_PRODUCTS) {
      return { list: deduped, overflow: 0, hidden: [] };
    }
    return {
      list: deduped.slice(0, MAX_FACE_ROUTINE_SLOT_PRODUCTS),
      overflow: deduped.length - MAX_FACE_ROUTINE_SLOT_PRODUCTS,
      hidden: deduped.slice(MAX_FACE_ROUTINE_SLOT_PRODUCTS),
    };
  };
  if (log) {
    const resolveByIds = (ids = []) => ids
      .map(id => active.find(p => p.id === id))
      .filter(Boolean);
    const amRaw = resolveByIds(log.amProducts || []);
    const pmRaw = resolveByIds(log.pmProducts || []);
    // Log means log. A same-day one-off product may intentionally sit
    // outside the built weekly pattern, especially from "Used something
    // else? → From shelf." Do not narrow oversized logs back to managed
    // routine products or fall back to the plan; cap with overflow so the
    // add remains visible and inspectable.
    const amCap = capWithOverflow(amRaw);
    const pmCap = capWithOverflow(pmRaw);
    return {
      source: log.submitted ? 'submitted-log' : 'in-progress-log',
      am: amCap.list,
      pm: pmCap.list,
      amExtras: Array.isArray(log.amExtras) ? log.amExtras : [],
      pmExtras: Array.isArray(log.pmExtras) ? log.pmExtras : [],
      amOverflow: amCap.overflow,
      pmOverflow: pmCap.overflow,
      amHidden: amCap.hidden,
      pmHidden: pmCap.hidden,
    };
  }
  const planResolved = resolvePlanForDate(acceptedPlan);
  if (planResolved) return planResolved;
  // === PAST-DAY EMPTY GUARD (May 2026 per Jenni) ===
  // For dates before today, refuse to fall back to the shelf pattern. The
  // pattern represents what's PLANNED, not what HAPPENED — surfacing it on
  // past days created the illusion that yesterday's blank log contained
  // every shelf product, which it didn't. Past + no log = blank, with a
  // 'past-empty' source so the cover can offer a 'Log retroactively' CTA.
  // Today + future keep the pattern fallback because those views are
  // legitimately about the planned routine.
  try {
    const todayKey = (() => {
      const d = new Date();
      const tz = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tz).toISOString().slice(0, 10);
    })();
    if (date < todayKey) {
      return { ...empty, source: 'past-empty' };
    }
  } catch (_) { /* fall through */ }
  if (userHasBuiltPattern(products)) {
    let dow;
    try { dow = new Date(date + 'T00:00:00').getDay(); }
    catch { dow = new Date().getDay(); }
    const { am, pm } = getProductsForTodayFromPattern(active, dow);
    const amCap = capWithOverflow(am);
    const pmCap = capWithOverflow(pm);
    return {
      source: 'pattern',
      am: amCap.list,
      pm: pmCap.list,
      amExtras: [], pmExtras: [],
      amOverflow: amCap.overflow,
      pmOverflow: pmCap.overflow,
      amHidden: amCap.hidden,
      pmHidden: pmCap.hidden,
    };
  }
  return empty;
};

// Return today's AM and PM products derived from each product's cadence.
// Used as the display fallback when no regimenLog exists for today.
//
// STRICT FILTER (May 2026):
//  - Only includes products passing productIsInBuiltRoutine.
//  - Only includes products whose cadence.days contains dayOfWeek.
//  - Only adds to AM if useTimes contains 'am'; only to PM if 'pm'.
//  - NEVER fans a product into both slots from empty useTimes.
const getProductsForTodayFromPattern = (products, dayOfWeek) => {
  const am = [];
  const pm = [];
  if (!Array.isArray(products)) return { am, pm };
  for (const p of products) {
    if (!productIsInBuiltRoutine(p)) continue;
    if (!p.cadence.days.includes(dayOfWeek)) continue;
    const ut = (p.useTimes || []).map(t => String(t || '').toLowerCase());
    if (ut.includes('am')) am.push(p);
    if (ut.includes('pm')) pm.push(p);
  }
  return { am, pm };
};
