// === normalizeRatingTo10 (May 28 2026 per Jenni) ===
// Read-side helper for the user-rating scale. Frida's AI cover score
// is 0-10, so the user's self-rating now also lives on a 1-10 scale —
// matching ranges avoids the "is that out of 5 or 10?" confusion.
//
// History of scales on a log:
//   - ratingScale === '10' → new logs, value already 1-10
//   - ratingScale === '5'  → mid-era logs, value 1-5; double on read
//   - no ratingScale       → very old logs, value was 1-10; use as-is
const normalizeRatingTo10 = (raw, ratingScale) => {
  if (raw == null) return null;
  if (ratingScale === '10') return Math.max(1, Math.min(10, Math.round(raw)));
  if (ratingScale === '5')  return Math.max(1, Math.min(10, Math.round(raw * 2)));
  // Legacy / unspecified — assume the older 1-10 storage.
  return Math.max(1, Math.min(10, Math.round(raw)));
};

// Back-compat alias so older imports keep working until callers update.
// New code should reach for normalizeRatingTo10 directly.
const normalizeRatingTo5 = (raw, ratingScale) => {
  const ten = normalizeRatingTo10(raw, ratingScale);
  return ten == null ? null : Math.max(1, Math.min(5, Math.round(ten / 2)));
};
