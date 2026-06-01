// === Skin Check-In constants ===
// Chip vocab for the daily check-in modal:
//   OBSERVATION_CHIPS_BASE — "What did you notice?" tags (redness, dryness, etc.)
//   CONTEXT_FACTORS        — lifestyle/context factors shown in the Add Context bottom sheet
//   RATING_10_WORDS        — word labels under the 1-10 rating pill rail
// All declared at module scope so the bundled output (after build_current.js
// concatenation) keeps them globally available, identical to before extraction.
const OBSERVATION_CHIPS_BASE = [
  { key: 'redness',        label: 'redness' },
  { key: 'dryness',        label: 'dryness' },
  { key: 'breakouts',      label: 'breakouts' },
  { key: 'sensitivity',    label: 'sensitivity' },
  { key: 'dullness',       label: 'dullness' },
  { key: 'texture',        label: 'texture' },
  { key: 'enlarged_pores', label: 'enlarged pores' },
  { key: 'other',          label: 'other' },
];

const CONTEXT_FACTORS = [
  { key: 'poor_sleep',     label: 'Poor sleep' },
  { key: 'stress',         label: 'Stress' },
  { key: 'travel',         label: 'Travel' },
  { key: 'cycle_change',   label: 'Cycle change' },
  { key: 'sun_exposure',   label: 'Sun exposure' },
  { key: 'sunburn',        label: 'Sunburn' },
  { key: 'weather_change', label: 'Weather change' },
  { key: 'makeup',         label: 'Makeup' },
  { key: 'sweaty_workout', label: 'Sweaty workout' },
  { key: 'alcohol',        label: 'Alcohol' },
  { key: 'diet_change',    label: 'Diet change' },
  { key: 'picked_skin',    label: 'Picked skin' },
  { key: 'feeling_sick',   label: 'Feeling ill' },
];

// Anchor labels for the 1-10 rating rail. Three labels (low / mid / high)
// keep the visual sparse — the other pill numbers don't need words to
// be legible. Mirrors Frida's 0-10 AI score scale so users aren't
// translating between two ranges. (May 28 2026 per Jenni — was 1-5;
// confusing alongside the "6.0 /10" cover score.)
const RATING_10_WORDS = { 1: 'Struggling', 5: 'Okay', 10: 'Glowing' };
// Back-compat alias — anything still importing the old name keeps working.
const RATING_5_WORDS = RATING_10_WORDS;
