// === EmptyRoutineState (May 2026 — bare-slot redesign) ===
// Minimal "No AM/PM products planned" state shown when the active slot
// is empty. Per Jenni (May 2026): an empty slot can be intentional, so
// this surface shouldn't push product-building. It just acknowledges
// the state and offers two paths via the parent's action area below:
//   - Log ritual (treat as bare today)
//   - Edit routine (change the future plan)
// No dashed box. No build prompt. No "Same as yesterday" pill (parent's
// "Used something else?" sheet handles add paths).
//
// Props
//   slot       — 'am' | 'pm'. Drives copy.
//   canRepeat  — boolean. Currently unused; kept on the prop signature so
//                callers stay compatible without churn.
//   onRepeat   — () => void. Same — unused, kept for compatibility.
const EmptyRoutineState = ({ slot /*, canRepeat, onRepeat*/ }) => (
  <div className="py-2">
    <div style={{color:'var(--ink)', fontSize:15, lineHeight:1.25, fontWeight:600, letterSpacing:'-0.012em'}}>
      {slot === 'am' ? 'No AM products planned.' : 'No PM products planned.'}
    </div>
    <div className="mt-1" style={{color:'var(--ink-soft)', fontSize:11.5, lineHeight:1.45}}>
      {slot === 'am'
        ? 'Log this morning as bare, or edit your routine.'
        : 'Log tonight as bare, or edit your routine.'}
    </div>
  </div>
);
