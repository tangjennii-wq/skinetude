// === EmptyRoutineState (May 2026 — bare-slot redesign) ===
// Minimal "No AM/PM products planned" state shown when the active slot
// is empty. Per Jenni (May 2026): an empty slot can be intentional, so
// this surface shouldn't push product-building. It just acknowledges
// the state and offers two paths via the parent's action area below:
//   - Log ritual (treat as bare today)
//   - Edit routine (change the future plan)
//
// Aug 2026 update: If the OTHER slot has products and this one is empty,
// the engine can suggest "what we'd add" to fill the gap. Rec card
// surfaces under the bare-slot copy — not as a push to build, but as a
// quiet "if you wanted to extend, here's where we'd go." Stays silent if
// the user truly has no routine built (engine has no signal).
//
// Props
//   slot       — 'am' | 'pm'. Drives copy.
//   canRepeat  — boolean. Currently unused; kept on the prop signature so
//                callers stay compatible without churn.
//   onRepeat   — () => void. Same — unused, kept for compatibility.
//   products       — Aug 2026. Optional. Active shelf — engine reads it.
//   regimenLogs    — Aug 2026. Optional. For resolving today's slot products.
const EmptyRoutineState = ({ slot, products, regimenLogs /*, canRepeat, onRepeat*/ }) => {
  // Engine-driven empty-slot rec — silent unless there's a meaningful gap
  // and the OTHER slot has something to compare against.
  let recSection = null;
  if (Array.isArray(products) && products.length > 0
      && typeof resolveTodayRitual === 'function'
      && typeof resolveCoverageStates === 'function'
      && typeof deriveProductJobs === 'function') {
    try {
      const todayStr = (typeof localDateISO === 'function') ? localDateISO() : new Date().toISOString().slice(0, 10);
      const ritual = resolveTodayRitual({ products, regimenLogs: regimenLogs || [], date: todayStr });
      const otherSlot = slot === 'am' ? ritual.pm : ritual.am;
      // Only surface recs when the other slot has products — otherwise
      // the user truly has no routine and we'd be pushing build.
      if (Array.isArray(otherSlot) && otherSlot.length > 0) {
        const coverage = resolveCoverageStates({
          routine: { am: ritual.am, pm: ritual.pm },
          concerns: [],
          preferences: {},
        }, deriveProductJobs);
        if ((coverage.missing || []).some(m => m.slot === slot)) {
          recSection = (
            <div className="mt-3">
              <RecCardSection coverage={coverage} surface="regimen" slot={slot} compact />
            </div>
          );
        }
      }
    } catch (e) { /* silent fail — bare state still renders */ }
  }

  return (
    <div className="py-2">
      <div style={{color:'var(--ink)', fontSize:15, lineHeight:1.25, fontWeight:600, letterSpacing:'-0.012em'}}>
        {slot === 'am' ? 'No AM products planned.' : 'No PM products planned.'}
      </div>
      <div className="mt-1" style={{color:'var(--ink-soft)', fontSize:11.5, lineHeight:1.45}}>
        {slot === 'am'
          ? 'Log this morning as bare, or edit your routine.'
          : 'Log tonight as bare, or edit your routine.'}
      </div>
      {recSection}
    </div>
  );
};
