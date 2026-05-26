// === resolveContextSummary (Phase 2 helper) ===
// Returns a human-readable one-line summary of a check-in log's
// context factors + note. Used by Journal, Insights, Compare to
// surface "what shifted today" without re-reading raw data.
// Returns: "Poor sleep · Stress · note" | "" if nothing.
const resolveContextSummary = (log) => {
  if (!log) return '';
  const factors = Array.isArray(log.contextFactors) ? log.contextFactors : [];
  // Map keys back to labels via CONTEXT_FACTORS (defined in
  // src/constants/observationChips.js; defensive against undefined
  // at load time during file-concat startup).
  const labels = (typeof CONTEXT_FACTORS !== 'undefined' ? CONTEXT_FACTORS : [])
    .filter(c => factors.includes(c.key))
    .map(c => c.label);
  const hasNote = !!(log.notes && String(log.notes).trim());
  const parts = [...labels];
  if (hasNote) parts.push('note');
  return parts.join(' · ');
};
