// === normalizeRatingTo5 ===
// Read-side helper for the 1-5 ←→ 1-10 rating migration. New logs save
// ratingScale:'5'; legacy logs lack the field and stored 1-10. Display
// surfaces (Compare, Journal, Insights) should call this to render a
// consistent 1-5 scale regardless of when the log was created.
const normalizeRatingTo5 = (raw, ratingScale) => {
  if (raw == null) return null;
  if (ratingScale === '5') return Math.max(1, Math.min(5, Math.round(raw)));
  // Legacy or unspecified — heuristic: if value > 5 assume 1-10.
  if (raw > 5) return Math.max(1, Math.min(5, Math.round(raw / 2)));
  return Math.max(1, Math.min(5, Math.round(raw)));
};
