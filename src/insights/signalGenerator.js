// === signalGenerator — deep Insights "Signals" generator (May 2026) ===
// Expands the Journal "Frida observed" treatment into 3-5 weekly Signal
// cards on the Insights page. Each Signal has up to four parts:
//
//   observation     — what happened (descriptive, no causal claim)
//   connection      — what else co-moved (co-occurrence, NOT causation)
//   possibleFactor  — what was different in that window ("on those days",
//                     "during this stretch") — context, never "because"
//   suggestedAction — a concrete try, framed as a probe not a prescription
//
// HARD RULES (memory: feedback_no_causal_claims):
//   - Never write "because", "thanks to", "X caused Y", "X lifted Y".
//   - Connections are ONLY co-occurrence. Use "on the same days",
//     "together with", "alongside", "in the same window".
//   - Suggestions use "try", "consider", "watch for", never "you should".
//
// Score scale (mirrors computeInsights):
//   100 / 80 / 55 (neutral mid) / 30 / 10 — deficit is < 50.
//
// Inputs:
//   logs        — journal entries with metricSnapshot + concerns + date
//   products    — shelf products (cadence.days drives "in rotation")
//   regimenLogs — daily AM/PM done lists
//
// Output:
//   Array of Signal objects:
//   {
//     id, category, signal, strength,
//     observation, connection?, possibleFactor?, suggestedAction
//   }
// Empty array when there isn't enough data — the panel handles that.

const SIGNAL_SCORE_MAP = {
  redness:    { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
  hydration:  { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
  texture:    { Smooth: 100, Even: 80, Uneven: 55, Rough: 30, Bumpy: 10 },
  breakouts:  { Clear: 100, Few: 75, Some: 50, Many: 25, Severe: 10 },
  barrier:    { Strong: 100, Steady: 80, Holding: 55, Compromised: 30, Stripped: 10 },
  sensitivity:{ Calm: 100, Settled: 80, Tender: 55, Reactive: 30, Inflamed: 10 },
};

const SIGNAL_METRIC_LABELS = {
  redness: 'Redness',
  hydration: 'Hydration',
  texture: 'Texture',
  breakouts: 'Breakouts',
  barrier: 'Barrier',
  sensitivity: 'Sensitivity',
};

// Verb pairs — positive direction / negative direction. Borrowed from
// JournalTodayPanel's verbForMetric so Signals copy reads like the
// "Frida observed" line on Today, not a corporate dashboard.
const SIGNAL_MOVE_VERBS = {
  redness:    { up: 'softened', down: 'lifted' },
  hydration:  { up: 'improved', down: 'slipped' },
  texture:    { up: 'smoothed', down: 'roughened' },
  breakouts:  { up: 'cleared', down: 'picked up' },
  barrier:    { up: 'steadied', down: 'looked more compromised' },
  sensitivity:{ up: 'calmed', down: 'read more reactive' },
};

const signalTitleCase = (w) => w ? String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase() : null;

const signalScoreFor = (key, raw) => {
  const tc = signalTitleCase(raw);
  if (!tc) return null;
  const v = SIGNAL_SCORE_MAP[key]?.[tc];
  return typeof v === 'number' ? v : null;
};

const signalLocalISO = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// =====================================================================
// Helpers — shared selectors over logs / shelf / regimenLogs.
// =====================================================================

// Sorted journal entries with metric snapshots, newest first, last 60.
const getRecentSnapLogs = (logs) => {
  const withSnap = (logs || []).filter(l => l && l.metricSnapshot && l.date);
  return [...withSnap]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 60);
};

// Per-metric averages for last 7 days vs prior 7 days.
const weekOverWeekDelta = (recent, metric) => {
  const now = Date.now();
  const days = (l) => (now - new Date(l.date).getTime()) / 86400000;
  const recVals = [], prevVals = [];
  recent.forEach(l => {
    const s = signalScoreFor(metric, l.metricSnapshot[metric]);
    if (s == null) return;
    const d = days(l);
    if (d < 7) recVals.push(s);
    else if (d < 14) prevVals.push(s);
  });
  if (recVals.length < 3 || prevVals.length < 3) return null;
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return {
    metric,
    recentAvg: avg(recVals),
    priorAvg: avg(prevVals),
    delta: avg(recVals) - avg(prevVals),
    recentN: recVals.length,
    priorN: prevVals.length,
  };
};

// Products currently "in rotation" — has cadence.days and no endDate.
// Used as the candidate set for "possible factor" framing.
const getInRotationProducts = (products) => {
  return (products || []).filter(p => {
    if (!p) return false;
    const days = p.cadence && Array.isArray(p.cadence.days) ? p.cadence.days : [];
    return days.length > 0 && !p.endDate;
  });
};

// Group rotation products by mechanism family — used for the
// "overlap" signal (e.g. you have 2 niacinamides). Reads from
// product.mechanismTags if available, else from a quick keyword scan
// on actives/main/category. Kept lightweight so this file stays
// independent of deriveProductJobs ordering in the build.
const groupByMechanism = (products) => {
  const groups = {};
  const inrot = getInRotationProducts(products);
  inrot.forEach(p => {
    const tags = Array.isArray(p.mechanismTags) ? p.mechanismTags : null;
    let mechs = [];
    if (tags && tags.length) {
      mechs = tags.slice();
    } else {
      // Cheap fallback — match a small list of common ingredient families.
      const text = `${String(p.actives || '').toLowerCase()} ${String(p.main || '').toLowerCase()}`;
      if (/\bniacinamide\b/.test(text)) mechs.push('niacinamide');
      if (/\b(retinol|retinal|retinaldehyde|tretinoin|retinyl)\b/.test(text)) mechs.push('retinoid');
      if (/\b(ascorbic|ascorbyl|vitamin\s*c)\b/.test(text)) mechs.push('vitamin-C');
      if (/\b(salicylic|bha)\b/.test(text)) mechs.push('exfoliant-BHA');
      if (/\b(glycolic|lactic|mandelic|aha)\b/.test(text)) mechs.push('exfoliant-AHA');
      if (/\b(ceramide|phytosphingosine|cholesterol)\b/.test(text)) mechs.push('ceramide-restorative');
      if (/\b(centella|cica|madecassoside|colloidal\s+oat)\b/.test(text)) mechs.push('anti-inflammatory');
    }
    mechs.forEach(m => {
      if (!groups[m]) groups[m] = [];
      groups[m].push(p);
    });
  });
  return groups;
};

const MECH_FRIENDLY = {
  'niacinamide': 'niacinamide',
  'retinoid': 'retinoid',
  'vitamin-C': 'vitamin C',
  'exfoliant-BHA': 'BHA exfoliant',
  'exfoliant-AHA': 'AHA exfoliant',
  'ceramide-restorative': 'ceramide cream',
  'anti-inflammatory': 'soothing active',
};

// Adherence: counts AM vs PM check-ins over last 30 days.
const computeAmPmCadence = (regimenLogs, windowDays = 30) => {
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (windowDays - 1));
  const startISO = signalLocalISO(windowStart);
  let amDays = 0, pmDays = 0, totalDays = 0;
  // Track which weekday is most missed.
  const missedByDow = [0, 0, 0, 0, 0, 0, 0];
  const plannedByDow = [0, 0, 0, 0, 0, 0, 0];
  const byDate = new Map();
  (regimenLogs || []).forEach(r => { if (r && r.date) byDate.set(r.date, r); });
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = signalLocalISO(d);
    if (iso < startISO) break;
    const dow = d.getDay();
    plannedByDow[dow]++;
    const log = byDate.get(iso);
    const hadAm = log && Array.isArray(log.amDone) && log.amDone.length > 0;
    const hadPm = log && Array.isArray(log.pmDone) && log.pmDone.length > 0;
    if (hadAm) amDays++;
    if (hadPm) pmDays++;
    if (hadAm || hadPm) totalDays++;
    else missedByDow[dow]++;
  }
  // Find the weekday with highest miss rate (need >= 3 missed to surface).
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let worstDow = -1, worstRate = 0;
  for (let i = 0; i < 7; i++) {
    if (plannedByDow[i] < 2) continue;
    const rate = missedByDow[i] / plannedByDow[i];
    if (rate > worstRate && missedByDow[i] >= 3) {
      worstRate = rate;
      worstDow = i;
    }
  }
  return {
    amDays,
    pmDays,
    totalDays,
    windowDays,
    worstDow,
    worstDowName: worstDow >= 0 ? DAY_NAMES[worstDow] : null,
    worstDowMissed: worstDow >= 0 ? missedByDow[worstDow] : 0,
  };
};

// =====================================================================
// Signal generators — each returns 0..n signals. computeSignals
// concatenates and trims to top 5.
// =====================================================================

// 1. METRIC TREND — biggest mover week-over-week (positive or negative).
//    Pairs with a co-movement connection if any other metric moved in the
//    same direction in the same window. Suggests a watch-and-log probe.
const trendSignals = (recent) => {
  const out = [];
  const metrics = ['redness', 'hydration', 'texture', 'breakouts', 'barrier', 'sensitivity'];
  const moves = metrics.map(m => weekOverWeekDelta(recent, m)).filter(Boolean);
  if (moves.length === 0) return out;
  // Best (most positive) and worst (most negative) movers.
  const sorted = [...moves].sort((a, b) => b.delta - a.delta);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const tryFor = (m, dir) => {
    if (dir === 'up') return `Keep an eye on ${SIGNAL_METRIC_LABELS[m].toLowerCase()} for another week. If it holds, you have a baseline worth protecting.`;
    return `Try a one-week barrier reset — pause anything new, lean on a ceramide cream nightly, and watch whether ${SIGNAL_METRIC_LABELS[m].toLowerCase()} settles back.`;
  };
  if (best && best.delta >= 8) {
    const verb = SIGNAL_MOVE_VERBS[best.metric].up;
    // Co-movers in same direction.
    const coMovers = moves.filter(m => m.metric !== best.metric && m.delta >= 5);
    coMovers.sort((a, b) => b.delta - a.delta);
    const co = coMovers[0];
    out.push({
      id: `trend-up-${best.metric}`,
      category: 'trend',
      signal: best.metric,
      strength: best.delta >= 16 ? 'high' : 'mid',
      observation: `${SIGNAL_METRIC_LABELS[best.metric]} ${verb} this week vs last — about ${Math.round(best.delta)} points on the same scale.`,
      connection: co
        ? `${SIGNAL_METRIC_LABELS[co.metric]} ${SIGNAL_MOVE_VERBS[co.metric].up} alongside it, on the same days.`
        : null,
      possibleFactor: null,
      suggestedAction: tryFor(best.metric, 'up'),
    });
  }
  if (worst && worst.delta <= -8 && (!best || worst.metric !== best.metric)) {
    const verb = SIGNAL_MOVE_VERBS[worst.metric].down;
    const coMovers = moves.filter(m => m.metric !== worst.metric && m.delta <= -5);
    coMovers.sort((a, b) => a.delta - b.delta);
    const co = coMovers[0];
    out.push({
      id: `trend-down-${worst.metric}`,
      category: 'trend',
      signal: worst.metric,
      strength: worst.delta <= -16 ? 'high' : 'mid',
      observation: `${SIGNAL_METRIC_LABELS[worst.metric]} ${verb} this week vs last — down about ${Math.round(Math.abs(worst.delta))} points.`,
      connection: co
        ? `${SIGNAL_METRIC_LABELS[co.metric]} ${SIGNAL_MOVE_VERBS[co.metric].down} in the same window.`
        : null,
      possibleFactor: null,
      suggestedAction: tryFor(worst.metric, 'down'),
    });
  }
  return out;
};

// 1b. TREND COMPARISON — pair the biggest positive + biggest negative
//     mover in one card so the user sees "what's working vs what's
//     drifting" together at the top of Signals. Only fires when BOTH
//     directions are meaningfully moving (≥5 pts each way).
const trendComparisonSignals = (recent) => {
  const out = [];
  const metrics = ['redness', 'hydration', 'texture', 'breakouts', 'barrier', 'sensitivity'];
  const moves = metrics.map(m => weekOverWeekDelta(recent, m)).filter(Boolean);
  if (moves.length < 2) return out;
  const sorted = [...moves].sort((a, b) => b.delta - a.delta);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  // Only pair when one is clearly up AND another clearly down.
  if (!best || !worst || best.metric === worst.metric) return out;
  if (best.delta < 5 || worst.delta > -5) return out;
  const upVerb = SIGNAL_MOVE_VERBS[best.metric].up;
  const downVerb = SIGNAL_MOVE_VERBS[worst.metric].down;
  out.push({
    id: 'trend-pair',
    category: 'trends-paired',
    signal: 'all',
    strength: 'high',
    observation: `Working: ${SIGNAL_METRIC_LABELS[best.metric]} ${upVerb} (+${Math.round(best.delta)}). Drifting: ${SIGNAL_METRIC_LABELS[worst.metric]} ${downVerb} (${Math.round(worst.delta)}).`,
    connection: `Two metrics moving opposite ways in the same week — useful contrast for figuring out what's pulling weight vs what's slipping.`,
    possibleFactor: `The lift on ${SIGNAL_METRIC_LABELS[best.metric].toLowerCase()} is worth protecting. The dip on ${SIGNAL_METRIC_LABELS[worst.metric].toLowerCase()} needs a closer look — could be a new product, a missed step, or context (sleep, weather, hormones).`,
    suggestedAction: `Keep whatever's been steady for ${SIGNAL_METRIC_LABELS[best.metric].toLowerCase()}. For ${SIGNAL_METRIC_LABELS[worst.metric].toLowerCase()}: pause anything new for a week and watch if it settles back on its own.`,
  });
  return out;
};

// 2. PRODUCT-IN-ROTATION CORRELATION — for a metric on an UP trend,
//    name a product that's been in rotation across that window. Strictly
//    framed as "during this stretch" — never "because of."
//
// Data gap: we don't have per-day product-usage timestamps for most users,
// so this degrades to "products on the shelf with cadence covering this
// week" — i.e. SHELF MEMBERSHIP, not usage logs. The copy reflects that.
const productCorrelationSignals = (recent, products) => {
  const out = [];
  if (!products || products.length === 0) return out;
  const metrics = ['redness', 'hydration', 'texture', 'breakouts', 'barrier'];
  const moves = metrics.map(m => weekOverWeekDelta(recent, m)).filter(Boolean);
  const winners = moves.filter(m => m.delta >= 10).sort((a, b) => b.delta - a.delta);
  if (winners.length === 0) return out;
  const top = winners[0];
  // Pick a product whose mechanism plausibly maps to this metric's lift.
  const inRotation = getInRotationProducts(products);
  const mechMatch = {
    redness:    ['anti-inflammatory', 'niacinamide', 'ceramide-restorative'],
    sensitivity:['anti-inflammatory', 'ceramide-restorative'],
    hydration:  ['humectant'],
    barrier:    ['ceramide-restorative', 'occlusive'],
    breakouts:  ['exfoliant-BHA', 'niacinamide'],
    texture:    ['exfoliant-AHA', 'retinoid'],
  };
  const wanted = mechMatch[top.metric] || [];
  const candidate = inRotation.find(p => {
    const tags = Array.isArray(p.mechanismTags) ? p.mechanismTags : [];
    if (tags.some(t => wanted.includes(t))) return true;
    const text = `${String(p.actives || '').toLowerCase()} ${String(p.main || '').toLowerCase()}`;
    if (wanted.includes('ceramide-restorative') && /\bceramide\b/.test(text)) return true;
    if (wanted.includes('anti-inflammatory') && /\b(centella|cica|madecassoside|colloidal\s+oat)\b/.test(text)) return true;
    if (wanted.includes('niacinamide') && /\bniacinamide\b/.test(text)) return true;
    if (wanted.includes('exfoliant-BHA') && /\b(salicylic|bha)\b/.test(text)) return true;
    if (wanted.includes('exfoliant-AHA') && /\b(glycolic|lactic|mandelic|aha)\b/.test(text)) return true;
    if (wanted.includes('retinoid') && /\b(retinol|retinal|tretinoin)\b/.test(text)) return true;
    if (wanted.includes('humectant') && /\b(hyaluronic|glycerin|panthenol|polyglutamic)\b/.test(text)) return true;
    return false;
  });
  if (!candidate) return out;
  const productName = candidate.name || candidate.brand || 'that product';
  // Count rotation nights in the past week to give the "X nights" framing.
  const days = candidate.cadence && Array.isArray(candidate.cadence.days) ? candidate.cadence.days : [];
  const nightsThisWeek = days.length;
  const verb = SIGNAL_MOVE_VERBS[top.metric].up;
  out.push({
    id: `product-${top.metric}-${(candidate.id || productName).toString().slice(0, 12)}`,
    category: 'product',
    signal: top.metric,
    strength: top.delta >= 18 ? 'high' : 'mid',
    observation: `${SIGNAL_METRIC_LABELS[top.metric]} ${verb} about ${Math.round(top.delta)} points this week.`,
    connection: null,
    possibleFactor: `${productName} has been in your rotation across this stretch${nightsThisWeek ? ` — scheduled ${nightsThisWeek} ${nightsThisWeek === 1 ? 'day' : 'days'} a week` : ''}. We can't match it to the improvement day-by-day yet, but it's the most likely candidate on your shelf.`,
    suggestedAction: `Try running ${productName} two more nights this week and see if the pattern holds. If yes, it's earning its place.`,
  });
  return out;
};

// 3. CO-MOVEMENT — two metrics that move together on the same days.
//    Different from the trend/connection above: this is about
//    correlation across the wider window, not a single week's delta.
const coMovementSignals = (recent) => {
  const out = [];
  const metrics = ['redness', 'hydration', 'texture', 'breakouts', 'barrier', 'sensitivity'];
  let bestPair = null;
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const a = metrics[i], b = metrics[j];
      let both = 0, aGood = 0, bGood = 0, sample = 0;
      recent.forEach(l => {
        const sa = signalScoreFor(a, l.metricSnapshot[a]);
        const sb = signalScoreFor(b, l.metricSnapshot[b]);
        if (sa == null || sb == null) return;
        sample++;
        const aG = sa >= 70, bG = sb >= 70;
        if (aG) aGood++;
        if (bG) bGood++;
        if (aG && bG) both++;
      });
      if (sample < 10 || aGood < 3 || bGood < 3) continue;
      const conditional = both / aGood;
      const baseline = bGood / sample;
      const lift = conditional - baseline;
      if (lift < 0.25) continue;
      if (!bestPair || lift > bestPair.lift) {
        bestPair = { a, b, conditional, baseline, lift, both, aGood };
      }
    }
  }
  if (bestPair) {
    const aLabel = SIGNAL_METRIC_LABELS[bestPair.a];
    const bLabel = SIGNAL_METRIC_LABELS[bestPair.b];
    out.push({
      id: `comove-${bestPair.a}-${bestPair.b}`,
      category: 'co-movement',
      signal: bestPair.a,
      strength: bestPair.lift >= 0.45 ? 'high' : 'mid',
      observation: `${aLabel} and ${bLabel} keep showing up well on the same days.`,
      connection: `On the ${bestPair.aGood} days ${aLabel.toLowerCase()} read strong, ${bLabel.toLowerCase()} was also strong ${Math.round(bestPair.conditional * 100)}% of the time — about ${Math.round(bestPair.lift * 100)} points above the baseline.`,
      possibleFactor: `Could be one underlying system (barrier + hydration travel together a lot), could be coincidence — too few days to say.`,
      suggestedAction: `Next time ${aLabel.toLowerCase()} dips, note ${bLabel.toLowerCase()} in the same check-in. Two or three matched dips and the pattern becomes real.`,
    });
  }
  return out;
};

// 4. SHELF OVERLAP — two+ products with the same mechanism in rotation.
//    Surface the biggest overlap; suggest sampling one for two weeks.
const shelfOverlapSignals = (products) => {
  const out = [];
  if (!products || products.length === 0) return out;
  const groups = groupByMechanism(products);
  const overlaps = Object.entries(groups)
    .filter(([, arr]) => arr.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  if (overlaps.length === 0) return out;
  const [mech, arr] = overlaps[0];
  const friendly = MECH_FRIENDLY[mech] || mech.replace(/-/g, ' ');
  const names = arr.slice(0, 3).map(p => p.name || p.brand || 'unnamed').join(' and ');
  out.push({
    id: `overlap-${mech}`,
    category: 'overlap',
    signal: 'texture', // neutral tone for shelf-meta signal
    strength: arr.length >= 3 ? 'high' : 'mid',
    observation: `You have ${arr.length} ${friendly} products in rotation right now — ${names}.`,
    connection: null,
    possibleFactor: `Two products doing the same job is fine, but it muddies the read on which one is actually pulling its weight.`,
    suggestedAction: `Try sampling one for two weeks alone, then the other for two weeks. Whichever your skin holds steadier under is the one to keep.`,
  });
  return out;
};

// 5. ADHERENCE PATTERN — AM vs PM lopsided, or a most-missed weekday.
const adherenceSignals = (regimenLogs) => {
  const out = [];
  const cad = computeAmPmCadence(regimenLogs, 30);
  if (cad.totalDays >= 7) {
    const diff = cad.amDays - cad.pmDays;
    if (Math.abs(diff) >= 5) {
      const heavy = diff > 0 ? 'AM' : 'PM';
      const light = diff > 0 ? 'PM' : 'AM';
      const heavyN = diff > 0 ? cad.amDays : cad.pmDays;
      const lightN = diff > 0 ? cad.pmDays : cad.amDays;
      out.push({
        id: `adh-ampm`,
        category: 'adherence',
        signal: 'hydration',
        strength: Math.abs(diff) >= 10 ? 'high' : 'mid',
        observation: `You check in more on ${heavy} than ${light} — ${heavyN} vs ${lightN} days in the last month.`,
        connection: null,
        possibleFactor: `The ${light} routine is where a lot of the work lands (barrier, repair, retinoids if you use them). A thin ${light} log makes it hard for Frida to see if those steps are doing anything.`,
        suggestedAction: `Try a 1-minute ${light} check-in tomorrow — just the two or three steps you actually did. Two weeks of ${light} data and we can run a real read on that half of the day.`,
      });
    }
  }
  if (cad.worstDow && cad.worstDowMissed >= 3) {
    out.push({
      id: `adh-dow`,
      category: 'adherence',
      signal: 'breakouts',
      strength: cad.worstDowMissed >= 5 ? 'high' : 'mid',
      observation: `${cad.worstDowName}s are your most-missed day — ${cad.worstDowMissed} skipped in the last month.`,
      connection: null,
      possibleFactor: `Could be a weekend cadence shift, could be travel, could be the day just runs longer.`,
      suggestedAction: `Try a ${cad.worstDowName} morning reminder — even a 30-second check-in keeps the streak alive and the data clean.`,
    });
  }
  return out;
};

// =====================================================================
// 6. AI vs FEEL — convergence/divergence between AI photo read and user rating.
// =====================================================================
// AI score = what the camera sees (objective surface).
// User rating (1-10 slider) = what the skin feels like (subjective sensation).
// Convergence builds confidence; divergence is its own signal — "looks
// fine but feels tight" can flag a barrier issue before it shows up.
const feelVsAiSignals = (logs) => {
  const out = [];
  const recent = (logs || []).filter(l => l && l.metricSnapshot && typeof l.rating === 'number');
  if (recent.length < 5) return out;
  // Last 14 days
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const window = recent.filter(l => l.date && new Date(l.date).getTime() >= cutoff);
  if (window.length < 4) return out;
  // AI score per log: average of metricSnapshot scores → 0-100.
  const aiPerLog = window.map(l => {
    const snap = l.metricSnapshot || {};
    const vals = [];
    for (const k of Object.keys(SIGNAL_SCORE_MAP)) {
      const word = snap[k];
      const score = word && SIGNAL_SCORE_MAP[k] && SIGNAL_SCORE_MAP[k][word];
      if (typeof score === 'number') vals.push(score);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }).filter(v => v != null);
  if (aiPerLog.length < 4) return out;
  const aiAvg = aiPerLog.reduce((a, b) => a + b, 0) / aiPerLog.length;
  // User rating 1-10 → scale to 0-100 to compare.
  const feelAvg = (window.reduce((a, b) => a + b.rating, 0) / window.length) * 10;
  const gap = aiAvg - feelAvg; // positive = AI higher than feel; negative = feel higher than AI
  const absGap = Math.abs(gap);

  // CONVERGENCE — both saying the same thing.
  if (absGap < 12 && aiAvg >= 70 && feelAvg >= 70) {
    out.push({
      id: 'feel-converge-good',
      category: 'feel-vs-ai',
      signal: 'all',
      strength: 'high',
      observation: `Camera and feel agree this week — both reading strong (AI ${aiAvg.toFixed(0)}, your rating ${(feelAvg/10).toFixed(1)}/10).`,
      connection: null,
      possibleFactor: `When the objective read and the subjective feel land in the same place, that's high-confidence "this is working."`,
      suggestedAction: `Don't change anything yet. Note what's in rotation this week — this is the baseline worth protecting.`,
    });
  } else if (absGap < 12 && aiAvg < 50 && feelAvg < 50) {
    out.push({
      id: 'feel-converge-bad',
      category: 'feel-vs-ai',
      signal: 'all',
      strength: 'high',
      observation: `Camera and feel agree something's off — both reading low (AI ${aiAvg.toFixed(0)}, your rating ${(feelAvg/10).toFixed(1)}/10).`,
      connection: null,
      possibleFactor: `Both signals pointing the same way means it's not just perception — there's something real to look at.`,
      suggestedAction: `Strip back to essentials for 3-5 days: cleanser, ceramide moisturizer, SPF. Pause actives. See if it lifts on its own before adding anything new.`,
    });
  }
  // DIVERGENCE — AI vs feel disagree by >20 points.
  else if (gap >= 20) {
    // AI says fine, you feel worse.
    out.push({
      id: 'feel-diverge-tight',
      category: 'feel-vs-ai',
      signal: 'sensitivity',
      strength: gap >= 30 ? 'high' : 'mid',
      observation: `You're feeling tighter than the camera shows — AI reads ${aiAvg.toFixed(0)}, your rating averages ${(feelAvg/10).toFixed(1)}/10.`,
      connection: null,
      possibleFactor: `Skin can feel reactive or tight before it visually shows. This gap often precedes a barrier dip by a few days.`,
      suggestedAction: `Skip the actives tonight. One layer of ceramide moisturizer over a humectant. Watch the gap for another 3 days — if it closes, false alarm; if it stays, your barrier is asking for help.`,
    });
  } else if (gap <= -20) {
    // AI sees something, you feel fine.
    out.push({
      id: 'feel-diverge-look',
      category: 'feel-vs-ai',
      signal: 'redness',
      strength: gap <= -30 ? 'high' : 'mid',
      observation: `Camera read is lower than your felt rating — AI ${aiAvg.toFixed(0)}, you're rating ${(feelAvg/10).toFixed(1)}/10.`,
      connection: null,
      possibleFactor: `Visual signal (redness, congestion) can show up before you feel it. Lighting and angle matter — could be camera, could be early.`,
      suggestedAction: `Take a check-in at the same time tomorrow in the same light. If the gap holds, treat what the camera sees — gentle and slow.`,
    });
  }
  return out;
};

// =====================================================================
// computeSignals — concat, dedupe by signal-metric, cap at 5.
// =====================================================================
const computeSignals = ({ logs, products, regimenLogs }) => {
  const recent = getRecentSnapLogs(logs);
  // Need a baseline of at least 6 entries before we surface anything
  // (matches PatternsPanel threshold). Below that, return [].
  if (recent.length < 6) return [];
  const all = [
    ...trendComparisonSignals(recent),
    ...trendSignals(recent),
    ...feelVsAiSignals(logs),
    ...productCorrelationSignals(recent, products),
    ...coMovementSignals(recent),
    ...shelfOverlapSignals(products),
    ...adherenceSignals(regimenLogs),
  ];
  // Dedupe — if two signals share the same metric AND category, keep the
  // stronger one. Category-trend redness and category-product redness
  // are allowed to coexist (different framings).
  const seen = new Map();
  all.forEach(s => {
    const key = `${s.category}-${s.signal}`;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, s); return; }
    const rank = (x) => x === 'high' ? 3 : x === 'mid' ? 2 : 1;
    if (rank(s.strength) > rank(prev.strength)) seen.set(key, s);
  });
  // Order: trends-paired → trend → feel-vs-ai → product → co-movement → overlap → adherence.
  const order = { 'trends-paired': 0, trend: 1, 'feel-vs-ai': 2, product: 3, 'co-movement': 4, overlap: 5, adherence: 6 };
  const ranked = [...seen.values()].sort((a, b) => {
    const oa = order[a.category] ?? 9;
    const ob = order[b.category] ?? 9;
    if (oa !== ob) return oa - ob;
    const rank = (x) => x === 'high' ? 3 : x === 'mid' ? 2 : 1;
    return rank(b.strength) - rank(a.strength);
  });
  return ranked.slice(0, 5);
};

// Node-only export — sidecar concat ignores this branch.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeSignals };
}
