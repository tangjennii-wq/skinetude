// === CheckInObservationChips (Phase 3A — extracted from CheckInDetailsModal) ===
// "What did you notice?" — neutral noun chips (redness, dryness, etc.) plus
// the inline "+ Add context" affordance and the selected-context preview
// row that appears below once the user has chosen any context factors or
// added a note via the bottom sheet.
//
// Why include the preview row here and not in the modal body?
//   - It's visually attached to the chip grid (right below the "+ Add
//     context" link). Putting them together is the design-intent unit.
//   - The Edit affordance in that row also reopens the context sheet —
//     same handler as the "+ Add context" link — so the two pieces share
//     props (`onAddContext`).
//
// Behavior preserved exactly: same chips, same toggle semantics, same
// preview rendering, same copy. References OBSERVATION_CHIPS_BASE and
// CONTEXT_FACTORS from src/constants/observationChips.js (concatenated
// earlier in the build).
//
// Props
//   noticed         — Set<string> of selected chip keys.
//   toggleNoticed   — (key) => void. Toggles a key in the noticed set.
//   contextFactors  — Set<string> of selected context-factor keys.
//   note            — string. The quick note from the context sheet.
//                     Drives the "Quick note added" preview pip.
//   onAddContext    — () => void. Opens the context bottom sheet.
const CheckInObservationChips = ({ noticed, toggleNoticed, contextFactors, note, onAddContext }) => (
  <div>
    <CardHeader eyebrow="What did you notice?" marginBottom={T.space.md} />
    <div className="flex flex-wrap gap-1">
      {OBSERVATION_CHIPS_BASE.map(c => (
        <Chip key={c.key} active={noticed.has(c.key)} onClick={() => toggleNoticed(c.key)} size="sm">
          {c.label}
        </Chip>
      ))}
    </div>
    <button
      type="button"
      onClick={onAddContext}
      className="mt-2 inline-flex items-center gap-1 transition hover:opacity-80"
      style={{color:'var(--ink-soft)', fontWeight:500, fontSize:10.5, cursor:'pointer'}}
    >
      <Icon name="Plus" size={10} />
      <span>Add context</span>
    </button>
    {(contextFactors.size > 0 || note) && (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px]" style={{color:'var(--ink-soft)'}}>
        {Array.from(contextFactors).map((k, i) => {
          const c = CONTEXT_FACTORS.find(x => x.key === k);
          if (!c) return null;
          return (
            <span key={k} className="inline-flex items-center">
              {i > 0 && <span style={{margin:'0 4px', color:'var(--line)'}}>·</span>}
              {c.label}
            </span>
          );
        })}
        {note && (
          <span className="inline-flex items-center">
            {contextFactors.size > 0 && <span style={{margin:'0 4px', color:'var(--line)'}}>·</span>}
            <em>Quick note added</em>
          </span>
        )}
        <button
          type="button"
          onClick={onAddContext}
          className="ml-1 text-[10px] tracking-[0.12em] uppercase transition hover:opacity-70"
          style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
        >Edit</button>
      </div>
    )}
  </div>
);
