// === WeeklyPlanEditor (July 2026 — Phase 2 of the regimen restructure) ===
// Edit-in-place weekly plan grid. The answer to "moving retinol from daily
// to MWF should not cost a 7-step wizard."
//
// One row per active shelf product: AM/PM slot chips + seven day chips,
// every tap writes immediately through sanitizeProductForSave (schema
// stays normalized — cadence.days guaranteed, useTimes lowercase).
// Scheduling a product that was never in the plan routes through
// addProductToRoutine so cadence comes from suggestedCadence (retinoids
// land MWF PM, masks Sunday, vitamin C daily AM) — never hardcoded —
// and sets routineManaged:true so the resolver actually honors it.
//
// Two sections: "In your plan" (scheduled) and "On the shelf, not
// scheduled" (one tap on AM or PM promotes them). The full builder
// (proposals, refine, start-over) stays reachable behind a link the
// caller renders below this component — this grid handles the small
// changes, the builder handles strategy.
//
// Props
//   products      — full shelf array.
//   setProducts   — App-scope setter.
//   saveData      — persistence funnel.
//   setCoverRoutineRebuildToken — bump after every write.
//   toast         — feedback funnel.

const WEEKLY_DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const WeeklyPlanEditor = ({ products, setProducts, saveData, setCoverRoutineRebuildToken, toast }) => {
  // July 2026 v2 (per Jenni): off-plan products moved out of the inline
  // list into a CONTEXTUAL floating Bench pill — visible only while this
  // editor is mounted (Refine view), opening a bottom sheet to schedule
  // anything benched. Keeps the grid tight and honors the "shelf access
  // is contextual, never a global floating drawer" ruling.
  const [benchOpen, setBenchOpen] = useState(false);
  const active = (Array.isArray(products) ? products : []).filter(p => p && !p.endDate);
  const inPlan = active.filter(p => productIsInBuiltRoutine(p));
  const offPlan = active.filter(p => !productIsInBuiltRoutine(p));

  const persist = (next, label) => {
    setProducts(next);
    saveData('products', next).catch(e => {
      console.error(`[weekly-plan ${label}] save failed:`, e);
      toast(`Save error: ${e?.message || 'unknown'}`, 'error');
    });
    setCoverRoutineRebuildToken(t => t + 1);
  };

  const toggleSlot = (product, slot) => {
    const ut = (Array.isArray(product.useTimes) ? product.useTimes : []).map(t => String(t).toLowerCase());
    const has = ut.includes(slot);
    let updated;
    if (has) {
      // Removing a slot. If it was the last one, the product simply drops
      // out of the plan (resolver requires a non-empty useTimes).
      updated = sanitizeProductForSave({ ...product, useTimes: ut.filter(t => t !== slot) });
    } else {
      // Adding a slot — helper defers to suggestedCadence when the product
      // has no explicit cadence yet; routineManaged makes the resolver
      // honor it.
      updated = sanitizeProductForSave({ ...addProductToRoutine(product, slot), routineManaged: true });
    }
    const next = products.map(p => p.id === product.id ? updated : p);
    persist(next, 'toggle-slot');
    const stillIn = (updated.useTimes || []).length > 0;
    toast(
      has
        ? (stillIn ? `${product.name}: ${slot.toUpperCase()} off.` : `${product.name} is off the weekly plan.`)
        : `${product.name}: ${slot.toUpperCase()} on.`,
      'info'
    );
  };

  const toggleDay = (product, dayIdx) => {
    const days = (product.cadence && Array.isArray(product.cadence.days)) ? [...product.cadence.days] : [0,1,2,3,4,5,6];
    const has = days.includes(dayIdx);
    const nextDays = has ? days.filter(d => d !== dayIdx) : [...days, dayIdx].sort((a, b) => a - b);
    const updated = sanitizeProductForSave({
      ...product,
      routineManaged: true,
      cadence: { ...(product.cadence || {}), days: nextDays, frequency: nextDays.length },
    });
    const next = products.map(p => p.id === product.id ? updated : p);
    persist(next, 'toggle-day');
    if (nextDays.length === 0) toast(`${product.name}: no days selected — it won’t appear this week.`, 'info');
  };

  // Remove from the plan entirely — product lands on the bench, cadence
  // preserved so re-scheduling restores it.
  const removeFromPlan = (product) => {
    const updated = sanitizeProductForSave({ ...product, useTimes: [] });
    persist(products.map(p => p.id === product.id ? updated : p), 'remove-from-plan');
    toast(`${product.name} moved to the bench.`, 'info');
  };

  const renderRow = (p, scheduled) => {
    const ut = (Array.isArray(p.useTimes) ? p.useTimes : []).map(t => String(t).toLowerCase());
    const days = (p.cadence && Array.isArray(p.cadence.days)) ? p.cadence.days : [];
    return (
      <div key={p.id} className="py-2.5" style={{borderTop: '1px solid var(--line)'}}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            {(p.brand || p.category) && (
              <div className="text-[8.5px] tracking-[0.18em] uppercase truncate" style={{color:'var(--ink-soft)', fontWeight:600}}>
                {p.brand}{p.brand && p.category ? ' · ' : ''}{(p.category || '').replace(/-/g, ' ')}
              </div>
            )}
            <div className="text-[12.5px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500}}>{p.name || p.brand || 'Product'}</div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {['am', 'pm'].map(slot => {
              const on = ut.includes(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => toggleSlot(p, slot)}
                  className="h-7 min-w-9 px-2 rounded-full text-[8.5px] tracking-[0.1em] uppercase transition cursor-pointer"
                  style={{
                    background: on ? (slot === 'pm' ? 'var(--accent-blue, #86CAE7)' : 'var(--gold)') : 'transparent',
                    color: on ? 'var(--ink)' : 'var(--ink-soft)',
                    border: '1px solid ' + (on ? 'transparent' : 'var(--line)'),
                    fontWeight: on ? 700 : 600,
                  }}
                  aria-pressed={on}
                  aria-label={`${p.name}: ${on ? 'remove from' : 'add to'} ${slot.toUpperCase()}`}
                >{slot}</button>
              );
            })}
            {scheduled && (
              <button
                type="button"
                onClick={() => removeFromPlan(p)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[rgba(201,138,138,0.10)] hover:text-[var(--rose)] cursor-pointer"
                style={{color:'var(--ink-soft)', opacity:0.65, border:'none', background:'transparent', cursor:'pointer'}}
                title={`Remove ${p.name} from the weekly plan (moves to the bench)`}
                aria-label={`Remove ${p.name} from the weekly plan`}
              >
                <Icon name="X" size={12} />
              </button>
            )}
          </div>
        </div>
        {scheduled && (
          <div className="flex items-center gap-1">
            {WEEKLY_DAY_LABELS.map((label, di) => {
              const on = days.includes(di);
              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => toggleDay(p, di)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] transition cursor-pointer"
                  style={{
                    background: on ? 'var(--accent)' : 'transparent',
                    color: on ? 'var(--cream)' : 'var(--ink-soft)',
                    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                    fontWeight: on ? 700 : 500,
                  }}
                  aria-pressed={on}
                  aria-label={`${p.name}: toggle ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][di]}`}
                >{label}</button>
              );
            })}
            <span className="ml-1 text-[9px]" style={{color:'var(--ink-soft)'}}>
              {days.length === 7 ? 'daily' : days.length === 0 ? 'no days' : `${days.length}×/wk`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <EditorialCard pad="tight" style={{background:'var(--cream-deep)'}}>
      <div className="mb-2">
        <h2 className="font-sans text-[22px] leading-[1.05] mb-0.5" style={{color:'var(--ink)'}}>Weekly plan</h2>
        <p className="text-[11px] leading-snug" style={{color:'var(--ink-soft)'}}>
          Tap a slot or day to change it. Applies going forward — today’s log stays as logged.
        </p>
      </div>
      {inPlan.length > 0 ? (
        <div className="mb-1">
          <div className="text-[9px] tracking-[0.25em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:600}}>In your plan</div>
          {inPlan.map(p => renderRow(p, true))}
        </div>
      ) : (
        <p className="text-[11.5px] leading-snug mb-1" style={{color:'var(--ink-soft)'}}>
          Nothing scheduled yet. Open the bench below and tap AM or PM on anything you own.
        </p>
      )}

      {/* === CONTEXTUAL BENCH PILL (July 2026 v2 per Jenni) ===
          Floating, but scoped: exists only while this editor is on screen.
          Opens the bench sheet to schedule anything unplanned. */}
      {offPlan.length > 0 && (
        <button
          type="button"
          onClick={() => setBenchOpen(true)}
          className="fixed bottom-24 md:bottom-8 right-4 z-[900] rounded-full px-4 py-3 flex items-center gap-2 shadow-lg transition hover:opacity-90"
          style={{background:'var(--ink)', color:'var(--cream)', border:'1px solid var(--ink)', fontWeight:700, fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer'}}
          aria-label={`Open the bench — ${offPlan.length} unscheduled product${offPlan.length === 1 ? '' : 's'}`}
        >
          <Icon name="Layers" size={13} />
          <span>Bench · {offPlan.length}</span>
        </button>
      )}
      {benchOpen && (
        <>
          <div className="shelf-bottom-sheet-overlay" onClick={() => setBenchOpen(false)} />
          <div className="shelf-bottom-sheet" role="dialog" aria-label="Add from the bench">
            <div className="px-4 pt-4 pb-2 flex items-start justify-between flex-shrink-0">
              <div className="min-w-0">
                <div className="font-sans text-[18px]" style={{color:'var(--ink)'}}>The bench</div>
                <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                  Owned but not in the weekly plan. Tap AM or PM to schedule.
                </div>
              </div>
              <button
                onClick={() => setBenchOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)] flex-shrink-0"
                style={{color:'var(--ink-soft)', border:'none', background:'transparent', cursor:'pointer'}}
                aria-label="Close"
                type="button"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
            <div className="shelf-scroll-area px-4 pb-4">
              {offPlan.length === 0 ? (
                <p className="text-[12px] pt-4" style={{color:'var(--ink-soft)'}}>
                  Bench is empty — everything you own is scheduled.
                </p>
              ) : (
                offPlan.map(p => renderRow(p, false))
              )}
            </div>
          </div>
        </>
      )}
    </EditorialCard>
  );
};
