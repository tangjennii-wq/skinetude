// === Sunday Digest builder (May 2026) ============================
// Pure data layer for the weekly digest. Given the raw app state
// (logs, regimenLogs, products, optional weeklyInsights), returns a
// structured digest object PLUS a plaintext rendering suitable for
// embedding in an .ics event description.
//
// Voice rules applied here (see project_brand_voice.md):
//   - Direct, brief, dry. Two sentences beats five.
//   - No causal claims ("thanks to X"). Snapshot data only.
//   - No "rhythm" or "ritual" — use routine, regimen, week.
//   - No emojis, no exclamation points.
//   - No "consult a dermatologist" — we ARE the doctors (but never
//     diagnose; this is data, not advice).
//
// Consumers:
//   - SundayDigestModal.jsx — renders the structured object on screen
//   - buildDigestIcs.js — wraps plaintext into an .ics description
//
// Depends only on module-scope helpers `aiScoreOut10` and
// `localDateISO`, both already defined in index.jsx.source and thus
// in scope at runtime after build_current.js concatenation.
// ===================================================================

const DIGEST_WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Pull the most-recent completed Sunday→Saturday window (or the
// in-progress one if today is mid-week). We always render from
// Sunday so the digest matches the .ics anchor.
const resolveDigestWindow = (today = new Date()) => {
  const anchor = new Date(today);
  anchor.setHours(0, 0, 0, 0);
  // Day-of-week 0=Sun. Walk back to the nearest Sunday.
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

const dayList = (start) => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(start);
  d.setDate(start.getDate() + i);
  return d;
});

const isoFor = (d) => (typeof localDateISO === 'function'
  ? localDateISO(d)
  : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);

const hasPhoto = (l) => l && (l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:')));

const scoreFor = (log) => {
  if (!log) return null;
  if (typeof aiScoreOut10 === 'function') {
    const s = aiScoreOut10(log);
    return s != null ? Number(s) : null;
  }
  return null;
};

// Roll up regimen adherence over the window. A day "counts" toward
// adherence if the user logged AT LEAST one AM or PM completion that
// day (we don't penalize partial — the goal is showing up, not
// perfection). Returns { days: 0-7, total: 7, ratio }.
const computeWeeklyAdherence = (regimenLogs, weekDates) => {
  const isoSet = new Set(weekDates.map(isoFor));
  let days = 0;
  (regimenLogs || []).forEach(r => {
    if (!r || !isoSet.has(r.date)) return;
    const amDone = Array.isArray(r.amDone) && r.amDone.length > 0;
    const pmDone = Array.isArray(r.pmDone) && r.pmDone.length > 0;
    const amExtras = Array.isArray(r.amExtras) && r.amExtras.length > 0;
    const pmExtras = Array.isArray(r.pmExtras) && r.pmExtras.length > 0;
    if (amDone || pmDone || amExtras || pmExtras || r.submitted) days += 1;
  });
  return { days, total: 7, ratio: days / 7 };
};

// Surface 2-3 most-used products this week. Counts a product as used
// any day it appeared in amDone/pmDone.
const computeTopProducts = (regimenLogs, products, weekDates, n = 3) => {
  const isoSet = new Set(weekDates.map(isoFor));
  const tally = new Map();
  (regimenLogs || []).forEach(r => {
    if (!r || !isoSet.has(r.date)) return;
    const ids = [...(r.amDone || []), ...(r.pmDone || [])];
    ids.forEach(id => tally.set(id, (tally.get(id) || 0) + 1));
  });
  const lookup = new Map((products || []).map(p => [p.id, p]));
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, count]) => {
      const p = lookup.get(id);
      return p ? { name: p.name || 'Unnamed product', brand: p.brand || '', count } : null;
    })
    .filter(Boolean);
};

// Compute metric drift across the window — start vs end average of
// the four canonical metrics. Returns the keys whose direction
// changed by ≥10 pts (0-100 scale), most-moved first.
const METRIC_SCORE = {
  redness:    { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
  hydration:  { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
  texture:    { Smooth: 100, Even: 80, Uneven: 55, Rough: 30, Bumpy: 10 },
  breakouts:  { Clear: 100, Few: 75, Some: 50, Many: 25, Severe: 10 },
};
// Direction: 'pos' means up = better, 'neg' means up = worse.
const METRIC_DIR = { redness: 'neg', hydration: 'pos', texture: 'pos', breakouts: 'neg' };
const tc = (w) => (w ? String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase() : null);

const computeMetricDrift = (weekLogs) => {
  const withSnap = weekLogs.filter(l => l && l.metricSnapshot);
  if (withSnap.length < 2) return [];
  const half = Math.floor(withSnap.length / 2) || 1;
  const first = withSnap.slice(0, half);
  const last = withSnap.slice(-half);
  const avg = (subset, key) => {
    const vals = subset
      .map(l => METRIC_SCORE[key]?.[tc(l.metricSnapshot[key])])
      .filter(v => typeof v === 'number');
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const drifts = Object.keys(METRIC_SCORE).map(key => {
    const a = avg(first, key);
    const b = avg(last, key);
    if (a == null || b == null) return null;
    const delta = b - a;
    // For 'neg' metrics (redness, breakouts), positive raw delta
    // already means "less of the bad thing" because the score map
    // maps Clear=100. So delta direction is consistent across all
    // four keys: positive delta = better.
    return { key, delta: Math.round(delta), dir: METRIC_DIR[key] };
  }).filter(Boolean);
  return drifts
    .filter(d => Math.abs(d.delta) >= 10)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
};

// === The Read — Tang & Gainey voice copy. Generated locally
// from the structured data; no API call required so the digest
// works offline and ships even when the API key is missing.
// Future PR can swap in a Claude-generated version that pulls
// from the same structured object.
const buildRead = ({ checkIns, avgScore, adherence, drifts, topProducts }) => {
  const lines = [];

  if (checkIns === 0) {
    return [
      'No photos this week. Skin\'s still happening — we just can\'t see it.',
      'Pin a Sunday and try again.',
    ].join(' ');
  }

  // Opening — what we have.
  if (checkIns >= 5) {
    lines.push(`${checkIns} check-ins this week.`);
  } else if (checkIns >= 2) {
    lines.push(`${checkIns} check-ins — enough to read a shape, not a story.`);
  } else {
    lines.push(`One check-in this week. Snapshot, not a pattern.`);
  }

  // Score line.
  if (avgScore != null) {
    if (avgScore >= 7.5) lines.push(`Average sat at ${avgScore.toFixed(1)} — skin held steady or better.`);
    else if (avgScore >= 6) lines.push(`Average ${avgScore.toFixed(1)}. Middle of the road.`);
    else lines.push(`Average ${avgScore.toFixed(1)}. Below your usual; worth a closer look this week.`);
  }

  // Adherence — descriptive, never moralizing.
  if (adherence.days >= 6) {
    lines.push(`Regimen logged ${adherence.days}/7 days — you showed up.`);
  } else if (adherence.days >= 3) {
    lines.push(`Regimen logged ${adherence.days}/7 days.`);
  } else if (adherence.days >= 1) {
    lines.push(`Regimen logged ${adherence.days}/7 days — the rest is blank.`);
  }

  // Metric drift — only if a clear mover. Descriptive only.
  if (drifts.length > 0) {
    const top = drifts[0];
    const word = top.delta > 0 ? 'eased' : 'climbed';
    if (top.key === 'redness') lines.push(`Redness ${word} across the week.`);
    else if (top.key === 'hydration') lines.push(`Hydration ${top.delta > 0 ? 'lifted' : 'dipped'}.`);
    else if (top.key === 'texture') lines.push(`Texture ${top.delta > 0 ? 'smoothed' : 'roughened'}.`);
    else if (top.key === 'breakouts') lines.push(`Breakouts ${top.delta > 0 ? 'cleared' : 'picked up'}.`);
  }

  // Top product mention — neutral, no causal claim.
  if (topProducts.length > 0) {
    const top = topProducts[0];
    const label = top.brand ? `${top.brand} ${top.name}` : top.name;
    lines.push(`${label} carried the routine (${top.count}× this week).`);
  }

  // Cap to 4 sentences for Blend voice. Trim from middle if needed.
  return lines.slice(0, 4).join(' ');
};

// === Public: buildDigest ===
// Input: { logs, regimenLogs, products, today? }
// Output: { window, checkIns, avgScore, biggestMover, adherence,
//           topProducts, drifts, read, plaintext }
const buildDigest = ({ logs, regimenLogs, products, today } = {}) => {
  const window = resolveDigestWindow(today || new Date());
  const days = dayList(window.start);
  const isoSet = new Set(days.map(isoFor));

  const weekLogs = (logs || [])
    .filter(l => l && isoSet.has(l.date) && hasPhoto(l))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const scored = weekLogs.map(l => ({ log: l, score: scoreFor(l) }));
  const scoresOnly = scored.map(s => s.score).filter(v => typeof v === 'number');
  const avgScore = scoresOnly.length
    ? Number((scoresOnly.reduce((s, v) => s + v, 0) / scoresOnly.length).toFixed(1))
    : null;

  let biggestMover = null;
  if (scored.length >= 2 && avgScore != null) {
    scored.forEach(({ log, score }) => {
      if (score == null) return;
      const delta = score - avgScore;
      if (!biggestMover || Math.abs(delta) > Math.abs(biggestMover.delta)) {
        biggestMover = { date: log.date, delta: Number(delta.toFixed(1)) };
      }
    });
  }

  const adherence = computeWeeklyAdherence(regimenLogs, days);
  const topProducts = computeTopProducts(regimenLogs, products, days, 3);
  const drifts = computeMetricDrift(weekLogs);

  const read = buildRead({
    checkIns: scoresOnly.length,
    avgScore,
    adherence,
    drifts,
    topProducts,
  });

  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const headline = `Frida · week of ${fmtDate(window.start)}`;

  // Plaintext for .ics description. RFC 5545 needs \n escaped to
  // literal \n inside the DESCRIPTION line — handled by the .ics
  // builder, not here. Here we just keep real newlines.
  const plaintext = [
    headline,
    '',
    read,
    '',
    `Check-ins: ${scoresOnly.length}/7`,
    avgScore != null ? `Avg score: ${avgScore.toFixed(1)}/10` : null,
    `Regimen logged: ${adherence.days}/7 days`,
    topProducts.length
      ? `Most-used: ${topProducts.map(p => p.brand ? `${p.brand} ${p.name}` : p.name).join(', ')}`
      : null,
    drifts.length
      ? `Metric movement: ${drifts.map(d => `${d.key} ${d.delta > 0 ? '+' : ''}${d.delta}`).join(', ')}`
      : null,
    '',
    'Open Frida → Journal for the full read.',
  ].filter(l => l !== null).join('\n');

  return {
    window: {
      start: isoFor(window.start),
      end: isoFor(window.end),
      label: `${fmtDate(window.start)} – ${fmtDate(window.end)}`,
    },
    checkIns: scoresOnly.length,
    photoDays: weekLogs.length,
    avgScore,
    biggestMover,
    adherence,
    topProducts,
    drifts,
    read,
    plaintext,
    headline,
    days: days.map(d => {
      const iso = isoFor(d);
      const entry = scored.find(s => s.log.date === iso);
      return {
        iso,
        weekday: DIGEST_WEEKDAYS[d.getDay()],
        hasLog: !!entry,
        score: entry ? entry.score : null,
      };
    }),
  };
};
