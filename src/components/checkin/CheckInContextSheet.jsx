// === CheckInContextSheet (Phase 3A — extracted from CheckInDetailsModal) ===
// Bottom-sheet overlay (z-[66], one above the modal) that lets the user
// pick context factors (sleep, stress, travel, hormonal, weather, etc.)
// and add an optional quick note. The sheet keeps its own DRAFT state on
// the parent (sheetContext / sheetNote) so Cancel doesn't apply mid-edit
// — that draft is committed to the modal's `contextFactors` + `note` on
// "Add to check-in".
//
// Behavior preserved exactly: same overlay backdrop, same dismiss-on-
// overlay-click, same ModalHeader copy, same StickyModalFooter primary
// + cancel pattern, same Chip selection semantics, same textarea
// fallback-italic placeholder treatment.
//
// Props
//   open                — boolean. Returns null when false so the parent
//                         can render unconditionally.
//   sheetContext        — Set<string>. Draft selected keys (CONTEXT_FACTORS).
//   toggleSheetContext  — (key) => void. Toggles a draft key.
//   sheetNote           — string. Draft note text.
//   setSheetNote        — (string) => void. Updates draft note.
//   onApply             — () => void. Commits draft to the modal and closes.
//   onCancel            — () => void. Discards draft and closes.
const CheckInContextSheet = ({ open, sheetContext, toggleSheetContext, sheetNote, setSheetNote, onApply, onCancel }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[66] flex items-end md:items-center justify-center px-3 py-6"
      style={{background:'rgba(0,0,0,0.55)'}}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[20px] overflow-hidden flex flex-col"
        style={{background:'var(--cream)', border:'1px solid var(--line)', maxHeight:'85vh'}}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          eyebrow="Context"
          title="Anything different today?"
          subtitle="Add context that may have affected your skin."
        />
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_FACTORS.map(c => (
                <Chip key={c.key} active={sheetContext.has(c.key)} onClick={() => toggleSheetContext(c.key)} size="md">
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[9.5px] tracking-[0.28em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:600}}>Quick Note</div>
            <textarea
              value={sheetNote}
              onChange={(e) => setSheetNote(e.target.value)}
              placeholder="Anything else you noticed?"
              rows={2}
              className="w-full px-1 py-1 text-[13px] resize-none focus:outline-none"
              style={{
                background:'transparent',
                border:'none',
                borderBottom:'1px solid var(--line)',
                color:'var(--ink)',
                fontFamily:'inherit',
                fontStyle: sheetNote ? 'normal' : 'italic',
              }}
            />
          </div>
        </div>
        <StickyModalFooter
          cancel={{ label: 'Cancel', onClick: onCancel }}
          primary={{ label: 'Add to check-in', onClick: onApply, maxWidth: 9999 }}
        />
      </div>
    </div>
  );
};
