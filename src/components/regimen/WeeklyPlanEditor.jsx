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
const WEEKLY_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// === WeeklyDayEditor (July 2026 per Jenni) ===
// The transposed edit lens: pick a DAY, then toggle which in-plan
// products run that day, per slot. Same cadence.days data the product
// grid edits — just day-major instead of product-major. The read-only
// rotation calendar lives on the Regimen tab; this one is for changing
// things.
const WeeklyDayEditor = ({ products, setProducts, saveData, setCoverRoutineRebuildToken, toast }) => {
  const [dayIdx, setDayIdx] = useState(new Date().getDay());
  const active = (Array.isArray(products) ? products : []).filter(p => p && !p.endDate);
  const inPlan = active.filter(p => productIsInBuiltRoutine(p));
  const persist = (next, label) => {
    setProducts(next);
    saveData('products', next).catch(e => {
      console.error(`[weekly-day ${label}] save failed:`, e);
      toast(`Save error: ${e?.message || 'unknown'}`, 'error');
    });
    setCoverRoutineRebuildToken(t => t + 1);
  };
  const toggleProductOnDay = (product) => {
    const days = (product.cadence && Array.isArray(product.cadence.days)) ? [...product.cadence.days] : [0,1,2,3,4,5,6];
    const has = days.includes(dayIdx);
    const nextDays = has ? days.filter(d => d !== dayIdx) : [...days, dayIdx].sort((a, b) => a - b);
    const updated = sanitizeProductForSave({
      ...product,
      routineManaged: true,
      cadence: { ...(product.cadence || {}), days: nextDays, frequency: nextDays.length },
    });
    persist(products.map(p => p.id === product.id ? updated : p), 'toggle-product-day');
  };
  const slotProducts = (slot) => inPlan.filter(p => (Array.isArray(p.useTimes) ? p.useTimes : []).map(t => String(t).toLowerCase()).includes(slot));
  const renderDayRow = (p) => {
    const days = (p.cadence && Array.isArray(p.cadence.days)) ? p.cadence.days : [];
    const on = days.includes(dayIdx);
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => toggleProductOnDay(p)}
        className="w-full py-2 flex items-center gap-2.5 text-left transition hover:opacity-90"
        style={{borderTop: '1px solid var(--line)', background:'transparent', border:'none', borderTopStyle:'solid', borderTopWidth:1, borderTopColor:'var(--line)', cursor:'pointer'}}
        aria-pressed={on}
        aria-label={`${p.name}: ${on ? 'skip' : 'include'} on ${WEEKLY_DAY_NAMES[dayIdx]}`}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 20, height: 20, borderRadius: '50%',
            background: on ? 'var(--accent)' : 'transparent',
            border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
            color: on ? 'var(--cream)' : 'transparent',
          }}
        >
          {on && <Icon name="Check" size={11} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          {(p.brand || p.category) && (
            <span className="block text-[8.5px] tracking-[0.18em] uppercase truncate" style={{color:'var(--ink-soft)', fontWeight:600, opacity: on ? 1 : 0.6}}>
              {p.brand}{p.brand && p.category ? ' · ' : ''}{(p.category || '').replace(/-/g, ' ')}
            </span>
          )}
          <span className="block text-[12.5px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500, opacity: on ? 1 : 0.55}}>{p.name || p.brand || 'Product'}</span>
        </span>
        <span className="text-[9px] flex-shrink-0" style={{color:'var(--ink-soft)'}}>
          {(p.cadence && Array.isArray(p.cadence.days)) ? (p.cadence.days.length === 7 ? 'daily' : `${p.cadence.days.length}×/wk`) : ''}
        </span>
      </button>
    );
  };
  return (
    <EditorialCard pad="tight" style={{background:'var(--cream-deep)'}}>
      <div className="mb-2">
        <h2 className="font-sans text-[22px] leading-[1.05] mb-0.5" style={{color:'var(--ink)'}}>Weekly plan · by day</h2>
        <p className="text-[11px] leading-snug" style={{color:'var(--ink-soft)'}}>
          Pick a day, tap a product to include or skip it that day. Applies going forward.
        </p>
      </div>
      <div className="flex items-center gap-1 mb-3">
        {WEEKLY_DAY_LABELS.map((label, di) => {
          const selected = di === dayIdx;
          const isToday = di === new Date().getDay();
          return (
            <button
              key={di}
              type="button"
              onClick={() => setDayIdx(di)}
              className="flex-1 h-9 rounded-full flex items-center justify-center text-[10px] transition cursor-pointer"
              style={{
                background: selected ? 'var(--accent)' : 'transparent',
                color: selected ? 'var(--cream)' : (isToday ? 'var(--accent)' : 'var(--ink-soft)'),
                border: '1px solid ' + (selected ? 'var(--accent)' : (isToday ? 'var(--accent)' : 'var(--line)')),
                fontWeight: selected || isToday ? 700 : 500,
              }}
              aria-pressed={selected}
              aria-label={`Edit ${WEEKLY_DAY_NAMES[di]}`}
            >{label}</button>
          );
        })}
      </div>
      <div className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{color:'var(--ink)', fontWeight:700}}>
        {WEEKLY_DAY_NAMES[dayIdx]}{dayIdx === new Date().getDay() ? ' · today' : ''}
      </div>
      {['am', 'pm'].map(slot => {
        const list = slotProducts(slot);
        const onCount = list.filter(p => (p.cadence && Array.isArray(p.cadence.days)) && p.cadence.days.includes(dayIdx)).length;
        return (
          <div key={slot} className="mb-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon name={slot === 'pm' ? 'Moon' : 'Sun'} size={11} style={{color: slot === 'pm' ? 'var(--accent-blue, #86CAE7)' : 'var(--gold)'}} />
              <span className="text-[9px] tracking-[0.25em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{slot.toUpperCase()} · {onCount} of {list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className="text-[11px] py-1.5" style={{color:'var(--ink-soft)'}}>Nothing scheduled for {slot.toUpperCase()} yet — add via Products.</p>
            ) : list.map(renderDayRow)}
          </div>
        );
      })}
      <p className="text-[10px] text-center" style={{color:'var(--ink-soft)'}}>
        New to the plan? Add it from Products or the bench.
      </p>
    </EditorialCard>
  );
};

const WeeklyPlanEditor = ({ products, setProducts, saveData, setCoverRoutineRebuildToken, toast }) => {
  // July 2026 v2 (per Jenni): off-plan products moved out of the inline
  // list into a CONTEXTUAL floating Bench pill — visible only while this
  // editor is mounted (Refine view), opening a bottom sheet to schedule
  // anything benched. Keeps the grid tight and honors the "shelf access
  // is contextual, never a global floating drawer" ruling.
  const [benchOpen, setBenchOpen] = useState(false);
  // Products scheduled DURING this bench session stay visible in the sheet
  // (now with their day chips) so the user can adjust the suggested cadence
  // immediately — one tap schedules, the days appear in place. Cleared on
  // sheet close.
  const [recentlyScheduled, setRecentlyScheduled] = useState([]);
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
    if (!has) setRecentlyScheduled(prev => prev.includes(product.id) ? prev : [...prev, product.id]);
    const dayCount = (updated.cadence && Array.isArray(updated.cadence.days)) ? updated.cadence.days.length : 7;
    const cadenceWord = dayCount === 7 ? 'daily' : `${dayCount}×/wk`;
    toast(
      has
        ? (stillIn ? `${product.name}: ${slot.toUpperCase()} off.` : `${product.name} is off the weekly plan.`)
        : `${product.name}: ${slot.toUpperCase()} on · ${cadenceWord}. Adjust the days if that's wrong.`,
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
                  Tap AM or PM to schedule — the days appear right here to adjust.
                </div>
              </div>
              <button
                onClick={() => { setBenchOpen(false); setRecentlyScheduled([]); }}
                className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)] flex-shrink-0"
                style={{color:'var(--ink-soft)', border:'none', background:'transparent', cursor:'pointer'}}
                aria-label="Close"
                type="button"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
            <div className="shelf-scroll-area px-4 pb-4">
              {(() => {
                // Bench list keeps just-scheduled items visible (with day
                // chips) so cadence is adjustable in place. Original shelf
                // order preserved — rows don't jump when tapped.
                const benchList = active.filter(p => !productIsInBuiltRoutine(p) || recentlyScheduled.includes(p.id));
                if (benchList.length === 0) {
                  return (
                    <p className="text-[12px] pt-4" style={{color:'var(--ink-soft)'}}>
                      Bench is empty — everything you own is scheduled.
                    </p>
                  );
                }
                return benchList.map(p => renderRow(p, productIsInBuiltRoutine(p)));
              })()}
            </div>
          </div>
        </>
      )}
    </EditorialCard>
  );
};
