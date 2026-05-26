// === parseSkinMetrics — DO NOT TIGHTLY COUPLE TO UI / DESIGN ================
// This is the AUTHORITATIVE parser for the structured "METRICS: ..." line +
// "REGION: ..." line that every analysis prompt appends after its prose
// bullets. Consumed by every cover, drawer, journal, compare, and trend
// surface that reads metricSnapshot or region on a log.
//
// If you're moving / renaming / refactoring — leave these in place and keep
// callers wired. Removing them WILL break the cover quartet.
//
// Reduced from 6 → 4 metrics in May 2026 (Jenni: "what's reasonable?").
// Dropped barrier + sensitivity — they overlapped heavily with redness
// in practice (a stripped barrier or reactive skin almost always co-read
// as high redness). Four sharp signals is more honest than six fuzzy ones.
// Old logs with 6-metric snapshots still parse; barrier/sensitivity keys
// just aren't picked up anymore — old data isn't migrated, it's
// silently de-emphasized.
const SKIN_METRIC_KEYS = ['redness', 'hydration', 'texture', 'breakouts'];

// === parseSkinRegion (May 2026) ===
// Pulls "REGION: <value>" from analysis output. Used to label each log
// with the body region the photo actually shows — Full Face / R Cheek /
// L Cheek / Forehead / T-zone / Chin / Nose / Jaw / Hairline / Neck /
// Back / Body / Other. Surfaces in Journal/Compare for context.
const SKIN_REGION_VALUES = [
  'Full Face', 'R Cheek', 'L Cheek', 'Forehead', 'T-zone', 'Chin',
  'Nose', 'Jaw', 'Hairline', 'Neck', 'Back', 'Body', 'Other',
];

const parseSkinRegion = (text) => {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(/REGION:\s*([A-Za-z\- ]+)/i);
  if (!m) return null;
  const raw = m[1].trim();
  // Match case-insensitive against the canonical list so casing drift in
  // the model output doesn't lose data.
  const found = SKIN_REGION_VALUES.find(v => v.toLowerCase() === raw.toLowerCase());
  return found || raw.slice(0, 32);
};

// === Strip both METRICS and REGION lines from displayed prose ===
const stripAnalysisStructuredLines = (text) => {
  if (!text) return text;
  return text
    .replace(/\n?\s*METRICS:\s*.+$/im, '')
    .replace(/\n?\s*REGION:\s*.+$/im, '')
    .trim();
};

const parseSkinMetrics = (text) => {
  if (!text || typeof text !== 'string') return null;
  // Path 1 — explicit METRICS: line.
  const lineMatch = text.match(/METRICS:\s*(.+)/i);
  if (lineMatch) {
    const out = {};
    lineMatch[1].split(',').forEach(pair => {
      const [k, v] = pair.split('=').map(s => s && s.trim());
      if (k && v) out[k.toLowerCase()] = v.replace(/[^A-Za-z]/g, '');
    });
    if (Object.keys(out).length) return out;
  }
  // Path 2 — scan-the-whole-text fallback. Picks up metrics that Claude
  // inlined into a bullet ("...redness=Low, hydration=Balanced...").
  const pattern = new RegExp(`\\b(${SKIN_METRIC_KEYS.join('|')})\\s*=\\s*([A-Za-z]+)`, 'gi');
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return null;
  const out = {};
  matches.forEach(m => {
    const key = m[1].toLowerCase();
    const val = m[2];
    if (!out[key]) out[key] = val; // first occurrence per key wins
  });
  return Object.keys(out).length ? out : null;
};
