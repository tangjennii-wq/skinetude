// === CheckInObservationChips (Phase 3A — extracted from CheckInDetailsModal) ===
// "Notice" — neutral noun chips (redness, dryness, etc.).
//
// Behavior preserved exactly: same chips, same toggle semantics, same
// preview rendering, same copy. References OBSERVATION_CHIPS_BASE and
// CONTEXT_FACTORS from src/constants/observationChips.js (concatenated
// earlier in the build).
//
// Props
//   noticed         — Set<string> of selected chip keys.
//   toggleNoticed   — (key) => void. Toggles a key in the noticed set.
const CheckInObservationChips = ({ noticed, toggleNoticed }) => (
  <div>
    <CardHeader eyebrow="Notice" marginBottom={T.space.md} />
    <div className="flex flex-wrap gap-1">
      {OBSERVATION_CHIPS_BASE.map(c => (
        <Chip key={c.key} active={noticed.has(c.key)} onClick={() => toggleNoticed(c.key)} size="sm">
          {c.label}
        </Chip>
      ))}
    </div>
  </div>
);
