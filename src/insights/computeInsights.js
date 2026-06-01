// === computeInsights — pure helpers for the Insights surface ===
// All exports are pure functions over logs + regimenLogs. They are
// designed so the InsightsView never has to do statistics inline.
//
// IMPORTANT — no causal claims. We have snapshot data, not attribution.
// `computePatternObservations` returns CO-OCCURRENCE / TIMING observations
// only ("redness reads higher on Sundays the last 3 weeks") — never
// "your weekend routine caused this." Memory rule: feedback_no_causal_claims.

// Score table mirrors the rest of the app (HomeDashboard, JournalTodayPanel,
// CompareMetricInfographic). Kept inline rather than reaching for the
// module-scope COMPARE_SCORE_MAP so this file can be tested independently.
const INSIGHTS_SCORE_MAP = {
  redness:    { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
  hydration:  { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
  texture:    { Smooth: 100, Even: 80, Uneven: 55, Rough: 30, Bumpy: 10 },
  breakouts:  { Clear: 100, Few: 75, Some: 50, Many: 25, Severe: 10 },
  barrier:    { Strong: 100, Steady: 80, Holding: 55, Compromised: 30, Stripped: 10 },
  sensitivity:{ Calm: 100, Settled: 80, Tender: 55, Reactive: 30, Inflamed: 10 },
};

// Higher score = better for ALL metrics (redness/breakouts inverted in the
// scale itself — Clear=100). So a rising line is always "improving."
const INSIGHTS_METRIC_LABELS = {
  redness:   'Redness',
  hydration: 'Hydration',
  texture:   'Texture',
  breakouts: 'Breakouts',
  barrier:   'Barrier',
  sensitivity: 'Sensitivity',
};

const insightsTitleCase = (w) => w ? String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase() : null;

const insightsScoreFor = (key, raw) => {
  const tc = insightsTitleCase(raw);
  if (!tc) return null;
  const v = INSIGHTS_SCORE_MAP[key]?.[tc];
  return typeof v === 'number' ? v : null;
};

// Local YYYY-MM-DD; identical shape to the app-wide localDateISO.
const insightsLocalISO = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// =====================================================================
// computeMetricTrends — last N weeks of per-metric averages.
// Returns:
//   {
//     metrics: ['redness', 'hydration', 'texture', 'breakouts'],
//     weeks: [{ label: 'W-3', startISO, points: { redness: 62, hydration: 78, ... } }, ...],
//     series: { redness: [62, 64, null, 70], hydration: [...], ... },
//     totals: { entryCount: 14, weeksWithData: 3 },
//   }
// `series` values are null when a week has no snapshots for that metric.
// =====================================================================
const computeMetricTrends = (logs, weeks = 4) => {
  const metrics = ['redness', 'hydration', 'texture', 'breakouts'];
  const today = new Date();
  // Build week buckets — index 0 = oldest, index weeks-1 = current week.
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(start.getDate() - (i + 1) * 7 + 1);
    const end = new Date(today);
    end.setDate(end.getDate() - i * 7);
    buckets.push({
      label: i === 0 ? 'This week' : `${i}w ago`,
      startISO: insightsLocalISO(start),
      endISO: insightsLocalISO(end),
      tallies: metrics.reduce((acc, m) => { acc[m] = []; return acc; }, {}),
    });
  }
  let entryCount = 0;
  (logs || []).forEach(log => {
    if (!log || !log.metricSnapshot || !log.date) return;
    const d = new Date(log.date);
    if (isNaN(d.getTime())) return;
    const iso = insightsLocalISO(d);
    const bucket = buckets.find(b => iso >= b.startISO && iso <= b.endISO);
    if (!bucket) return;
    entryCount++;
    metrics.forEach(m => {
      const score = insightsScoreFor(m, log.metricSnapshot[m]);
      if (score != null) bucket.tallies[m].push(score);
    });
  });
  const series = metrics.reduce((acc, m) => {
    acc[m] = buckets.map(b => {
      const vals = b.tallies[m];
      if (!vals.length) return null;
      return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    });
    return acc;
  }, {});
  const weeksOut = buckets.map((b, i) => ({
    label: b.label,
    startISO: b.startISO,
    endISO: b.endISO,
    points: metrics.reduce((acc, m) => {
      acc[m] = series[m][i];
      return acc;
    }, {}),
  }));
  const weeksWithData = weeksOut.filter(w => metrics.some(m => w.points[m] != null)).length;
  return { metrics, labels: INSIGHTS_METRIC_LABELS, weeks: weeksOut, series, totals: { entryCount, weeksWithData } };
};

// =====================================================================
// computeAdherence — streak + AM/PM adherence over the last `windowDays`.
// regimenLog shape: { date, amProducts[], pmProducts[], amDone[], pmDone[],
//                     amSkipped[], pmSkipped[], submitted }
//
// Returns:
//   {
//     currentStreak,           // consecutive days ending today with any check-in
//     longestStreak,           // longest run of consecutive days in window
//     checkInDays,             // days in window that have a regimenLog entry
//     amRate, pmRate,          // 0-100 % (done / (done + skipped + missed))
//     amCount, pmCount,        // logged days that had AM/PM products planned
//     windowDays,
//   }
// =====================================================================
const computeAdherence = (regimenLogs, windowDays = 30) => {
  const today = new Date();
  const todayISO = insightsLocalISO(today);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (windowDays - 1));
  const windowStartISO = insightsLocalISO(windowStart);
  const byDate = new Map();
  (regimenLogs || []).forEach(r => {
    if (r && r.date) byDate.set(r.date, r);
  });
  // Streak — walk backwards from today.
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = insightsLocalISO(d);
    const log = byDate.get(iso);
    const had = log && (
      (Array.isArray(log.amDone) && log.amDone.length > 0) ||
      (Array.isArray(log.pmDone) && log.pmDone.length > 0) ||
      log.submitted
    );
    if (had) currentStreak++;
    else break;
  }
  // Longest streak in window.
  let longestStreak = 0, runningStreak = 0, checkInDays = 0;
  let amDone = 0, amExpected = 0, pmDone = 0, pmExpected = 0;
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = insightsLocalISO(d);
    const log = byDate.get(iso);
    const had = log && (
      (Array.isArray(log.amDone) && log.amDone.length > 0) ||
      (Array.isArray(log.pmDone) && log.pmDone.length > 0) ||
      log.submitted
    );
    if (had) {
      checkInDays++;
      runningStreak++;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
    if (log) {
      const amPlanned = (log.amProducts || []).length;
      const pmPlanned = (log.pmProducts || []).length;
      if (amPlanned > 0) {
        amExpected += amPlanned;
        amDone += (log.amDone || []).length;
      }
      if (pmPlanned > 0) {
        pmExpected += pmPlanned;
        pmDone += (log.pmDone || []).length;
      }
    }
  }
  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : null;
  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    checkInDays,
    windowDays,
    amRate: pct(amDone, amExpected),
    pmRate: pct(pmDone, pmExpected),
    amCount: amExpected,
    pmCount: pmExpected,
  };
};

// =====================================================================
// computePatternObservations — co-occurrence / timing observations only.
// NEVER causal. Surfaces patterns the user can investigate, never
// attributes them to a product / behavior.
//
// Returns an array of observations:
//   [{ id, title, body, signal: 'redness'|'hydration'|..., strength: 'low'|'mid'|'high' }]
// Empty when the signal isn't strong enough to mention.
// =====================================================================
const computePatternObservations = (logs) => {
  const out = [];
  const withSnap = (logs || []).filter(l => l && l.metricSnapshot && l.date);
  if (withSnap.length < 6) return out;
  const recent = [...withSnap]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 60);
  const metrics = ['redness', 'hydration', 'texture', 'breakouts'];
  // === DAY-OF-WEEK PATTERN ===
  // For each metric, compute per-weekday average. Surface ONLY when the
  // weakest weekday is meaningfully worse than the rest of the week
  // (>= 12 points lower than the week-without-that-day average) and there
  // are at least 3 readings on that weekday.
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  metrics.forEach(metric => {
    const byDay = Array.from({ length: 7 }, () => []);
    recent.forEach(l => {
      const s = insightsScoreFor(metric, l.metricSnapshot[metric]);
      if (s == null) return;
      const dow = new Date(l.date).getDay();
      byDay[dow].push(s);
    });
    const counts = byDay.map(arr => arr.length);
    if (counts.some(c => c === 0)) return; // need every weekday represented
    const means = byDay.map(arr => arr.reduce((s, v) => s + v, 0) / arr.length);
    let worstDay = 0;
    for (let i = 1; i < 7; i++) if (means[i] < means[worstDay]) worstDay = i;
    if (counts[worstDay] < 3) return;
    const otherMean = means.filter((_, i) => i !== worstDay).reduce((s, v) => s + v, 0) / 6;
    const gap = otherMean - means[worstDay];
    if (gap < 12) return;
    const label = INSIGHTS_METRIC_LABELS[metric];
    // Descriptive, NOT causal — "reads lower" not "caused by."
    out.push({
      id: `dow-${metric}`,
      title: `${label} reads lower on ${DAY_NAMES[worstDay]}s`,
      body: `${counts[worstDay]} ${DAY_NAMES[worstDay]} readings average ${Math.round(means[worstDay])} vs ${Math.round(otherMean)} the rest of the week. Worth a look — what tends to be different that day?`,
      signal: metric,
      // === COMPACT-ROW FIELDS (May 30 v3 per Jenni) ===
      metric: label,
      readingCount: counts[worstDay],
      actionHint: `check what's different on ${DAY_NAMES[worstDay]}s`,
      strength: gap >= 22 ? 'high' : gap >= 16 ? 'mid' : 'low',
    });
  });
  // === CO-OCCURRENCE PATTERN ===
  // Look at the strongest metric pairing — on entries where metric A
  // dipped (< 50), does metric B also tend to be in deficit? Surfaces
  // the pair that moves together most often.
  const dipPairs = [];
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const a = metrics[i], b = metrics[j];
      let both = 0, aDip = 0, bDip = 0, sample = 0;
      recent.forEach(l => {
        const sa = insightsScoreFor(a, l.metricSnapshot[a]);
        const sb = insightsScoreFor(b, l.metricSnapshot[b]);
        if (sa == null || sb == null) return;
        sample++;
        const aD = sa < 50, bD = sb < 50;
        if (aD) aDip++;
        if (bD) bDip++;
        if (aD && bD) both++;
      });
      if (sample < 10 || aDip < 3 || bDip < 3) continue;
      // Conditional rate: of the days A dipped, how often did B also dip?
      const conditional = both / aDip;
      const baseline = bDip / sample;
      const lift = conditional - baseline;
      if (lift < 0.25) continue;
      dipPairs.push({ a, b, conditional, baseline, lift, both, aDip });
    }
  }
  dipPairs.sort((a, b) => b.lift - a.lift);
  const top = dipPairs[0];
  if (top) {
    const aLabel = INSIGHTS_METRIC_LABELS[top.a];
    const bLabel = INSIGHTS_METRIC_LABELS[top.b];
    out.push({
      id: `pair-${top.a}-${top.b}`,
      title: `${aLabel} and ${bLabel} tend to move together`,
      body: `On the ${top.aDip} days ${aLabel.toLowerCase()} read low, ${bLabel.toLowerCase()} was also low ${Math.round(top.conditional * 100)}% of the time. Could be one system, could be coincidence — watch the next dip and see.`,
      signal: top.a,
      metric: `${aLabel} + ${bLabel}`,
      readingCount: top.aDip,
      actionHint: `watch the next dip — they may share a cause`,
      strength: top.lift >= 0.45 ? 'high' : top.lift >= 0.35 ? 'mid' : 'low',
    });
  }
  // === TRAJECTORY OBSERVATION ===
  // Most-improved metric and most-slipped metric across last 14 days vs
  // prior 14. Descriptive only.
  const now = Date.now();
  const inWindow = (l, startDays, endDays) => {
    const t = new Date(l.date).getTime();
    const days = (now - t) / 86400000;
    return days >= startDays && days < endDays;
  };
  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const deltas = metrics.map(m => {
    const recentVals = recent.filter(l => inWindow(l, 0, 14))
      .map(l => insightsScoreFor(m, l.metricSnapshot[m]))
      .filter(v => v != null);
    const priorVals = recent.filter(l => inWindow(l, 14, 28))
      .map(l => insightsScoreFor(m, l.metricSnapshot[m]))
      .filter(v => v != null);
    if (recentVals.length < 3 || priorVals.length < 3) return null;
    return { metric: m, delta: avg(recentVals) - avg(priorVals), recentN: recentVals.length };
  }).filter(Boolean);
  if (deltas.length) {
    deltas.sort((a, b) => b.delta - a.delta);
    const best = deltas[0];
    const worst = deltas[deltas.length - 1];
    if (best && best.delta >= 8) {
      out.push({
        id: `gain-${best.metric}`,
        title: `${INSIGHTS_METRIC_LABELS[best.metric]} is the biggest mover, up`,
        body: `Last 14 days average ${Math.round(best.delta)} points higher than the 14 before. Worth noting what's been consistent in that window.`,
        signal: best.metric,
        metric: INSIGHTS_METRIC_LABELS[best.metric],
        readingCount: best.recentN,
        actionHint: `note what's been consistent`,
        strength: best.delta >= 16 ? 'high' : 'mid',
      });
    }
    if (worst && worst.delta <= -8 && worst.metric !== best.metric) {
      out.push({
        id: `loss-${worst.metric}`,
        title: `${INSIGHTS_METRIC_LABELS[worst.metric]} is slipping`,
        body: `Last 14 days average ${Math.round(Math.abs(worst.delta))} points lower than the 14 before. Look for changes — products, weather, sleep.`,
        signal: worst.metric,
        metric: INSIGHTS_METRIC_LABELS[worst.metric],
        readingCount: worst.recentN,
        actionHint: `look for what changed`,
        strength: worst.delta <= -16 ? 'high' : 'mid',
      });
    }
  }
  return out;
};
