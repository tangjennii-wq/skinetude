// === RegimenTodayView (Wave 8.1 sub-extract — May 2026) ===
// The `today` sub-view of RegimenView. Mounted when
// `regimenView === 'today'`. ~880 lines lifted.

const RegimenTodayView = ({
  generatedProductArt,
  products,
  regimenLogs,
  ritualViewDate,
  saveData,
  setCoverRoutineRebuildToken,
  setEditingProductId,
  setRegimenLogs,
  setRegimenView,
  setRitualSlot,
  setRitualViewDate,
  setShowProductModal,
  toast,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  persistRitualProgress,
  regimenWeekOffset,
  ritualProgress,
  ritualSlot,
  setAddRitualSheet,
  setRitualSuggestError,
  setRitualSuggestSelected,
  setRitualSuggestSheet,
  setRitualSuggestToken,
  setRitualSuggestion,
  setShelfQuickAddOpen,
}) => {
  return (() => {
  const todayKey = localDateISO();
  // ritualViewDate drives which day's regimen we show + edit.
  // Defaults to today; user scrubs to prior days via ◀▶.
  const viewDate = ritualViewDate || todayKey;
  const isViewingToday = viewDate === todayKey;
  // === CRITICAL: todayLog must read ANY log for the day, not only
  // submitted ones. Auto-save paths (From Shelf, cover X, quick-add
  // sheet) write logs with submitted:false so the user can edit
  // mid-routine. If we only matched submitted:true here, the
  // Regimen page silently fell through to the products+useTimes
  // shelf-default path and showed an empty AM/PM even though the
  // user just added items. submittedToday remains a separate flag
  // for the "officially checked in for today" indicator.
  // BUG FIX (May 2026): the previous filter `&& r.submitted` was
  // why From Shelf adds appeared on the cover but not the Regimen
  // page. KEEP THESE TWO READS SEPARATE.
  const todayLog = (regimenLogs || []).find(r => r.date === viewDate);
  const submittedToday = !!(todayLog && todayLog.submitted);

  // Yesterday's submitted check-in — used by "Same as yesterday" pill.
  const yKey = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return localDateISO(d);
  })();
  const yesterdayCheckIn = (regimenLogs || []).find(r => r.date === yKey && r.submitted);
  const canRepeatYesterday = !!yesterdayCheckIn && !submittedToday && isViewingToday;
  // Day label + scrub helper.
  // Day label carries the date for any non-today view so the
  // user always knows which day they're looking at.
  const dateShort = new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const viewDayLabel = isViewingToday ? 'Today'
    : viewDate === yKey ? `Yesterday · ${dateShort}`
    : new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const shiftDay = (deltaDays) => {
    const d = new Date(viewDate + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    const next = localDateISO(d);
    if (next > todayKey) return;
    setRitualViewDate(next);
  };

  // Resolve AM/PM product lists. SOURCE PRIORITY:
  //   1. Today's submitted check-in (what the user explicitly logged)
  //   2. Active shelf products with useTimes including AM/PM (the
  //      user's default schedule — not AI; user-set on each product)
  // No AI here. Suggestions are opt-in via the "Suggest with AI" sheet.
  const productById = Object.fromEntries((products || []).map(p => [p.id, p]));
  // resolveSlot returns BOTH:
  //   - shelf products in slot (resolved by id)
  //   - text-only "extras" (AI-suggested products not yet on the shelf)
  // Extras are tagged { isExtra:true, name } so the renderer can show
  // them as plain rows. Without this, AI-generated routine suggestions
  // for products the user doesn't yet own were silently dropped from
  // the Today's Regimen view.
  // AI-suggested gap products (amExtras / pmExtras) are intentionally
  // EXCLUDED from the Regimen home view — Jenni's call. They still
  // live on the log (so Suggests can show them in its own sheet) but
  // shouldn't muddy the routine you tap into daily. To surface them
  // again, open Étude Suggests.
  // Same bug fix as cover buildSlot: today's regimen page starts
  // EMPTY when no log exists. The useTimes shelf-default fallback
  // was misleading — useTimes is the generic "typically AM/PM"
  // tag, not an implicit daily roster.
  // === Pattern fallback (May 2026) ===
  // When no regimenLog exists for today AND the user has built a
  // real weekly pattern (≥1 active product has non-default
  // cadence), DISPLAY today's pattern as the fallback. NOT
  // written to disk — pure view. User's first edit or submit
  // commits a real regimenLog, which then takes priority over
  // the pattern on subsequent reads.
  // === SINGLE RESOLVER (May 2026 bug fix) ===
  // Replaces the inline resolveSlot. Same body filter,
  // dedupe, and cap as the cover so the two surfaces stay
  // in lockstep. The viewDate gate (only resolve when
  // viewing today) lives below — for non-today views the
  // user is editing a historical log and we surface its
  // products as-is via the same resolver.
  const patternBuilt = userHasBuiltPattern(products);
  const regimenTodayResolved = resolveTodayRitual({
    products,
    regimenLogs,
    date: viewDate,
  });
  const amProducts = regimenTodayResolved.am;
  const pmProducts = regimenTodayResolved.pm;
  const totalSteps = amProducts.length + pmProducts.length;
  // Truthy when the routine card is showing the pattern fallback
  // (no log yet, pattern exists). Drives the "Built from your
  // weekly rotation" eyebrow line above the routine.
  const isShowingPatternFallback = regimenTodayResolved.source === 'pattern' && totalSteps > 0;
  const amOverflowRegimen = regimenTodayResolved.amOverflow;
  const pmOverflowRegimen = regimenTodayResolved.pmOverflow;

  // Mirror cover's repeatYesterday — copies yesterday's picks into today
  // and marks today as submitted in regimenLogs.
  const repeatYesterday = () => {
    if (!yesterdayCheckIn) return;
    const next = {
      id: Date.now(),
      date: todayKey,
      amProducts: [...(yesterdayCheckIn.amProducts || [])],
      pmProducts: [...(yesterdayCheckIn.pmProducts || [])],
      amExtras: [...(yesterdayCheckIn.amExtras || [])],
      pmExtras: [...(yesterdayCheckIn.pmExtras || [])],
      devices: [...(yesterdayCheckIn.devices || [])],
      sleep: yesterdayCheckIn.sleep || '',
      supplements: [...(yesterdayCheckIn.supplements || [])],
      hydration: yesterdayCheckIn.hydration || false,
      sunscreenReapply: yesterdayCheckIn.sunscreenReapply || false,
      notes: '',
      submitted: true,
    };
    const newList = [next, ...(regimenLogs || [])];
    setRegimenLogs(newList);
    saveData('regimenLogs', newList);
    setCoverRoutineRebuildToken(t => t + 1);
    toast('Logged — same as yesterday ✨', 'info');
  };
  // Undo — drop today's auto-log so the user can re-decide.
  // Same code path is used when the user taps the filled "Repeated"
  // pill to clear what was applied. Toast spells out the outcome
  // so it's not a mystery destructive action.
  const undoRepeatYesterday = () => {
    const newList = (regimenLogs || []).filter(r => r.date !== todayKey);
    setRegimenLogs(newList);
    saveData('regimenLogs', newList);
    setCoverRoutineRebuildToken(t => t + 1);
    toast('Cleared today’s routine ✨', 'info');
  };

  // === Clear today's routine — SLOT-AWARE ===
  // Clears products from a SPECIFIC slot (AM or PM) on today's
  // regimenLog. Surfaces in the header as "Clear AM" / "Clear PM"
  // matching whichever slot the user has selected via the toggle.
  // If today has no log yet, no-op with a toast. Same auto-save +
  // cover-rebuild path as the bottle X handler.
  const clearTodayRoutine = (slot) => {
    const slotKey = slot === 'am' ? 'amProducts' : 'pmProducts';
    const exists = (regimenLogs || []).some(r => r.date === todayKey);
    // No log yet → create an empty log for this slot so the
    // pattern fallback STOPS auto-filling today's slot. Without
    // this, clearing a pattern-filled slot would do nothing
    // (no log to mutate) and the products would reappear on
    // next render. This is the "no, not today" gesture.
    if (!exists) {
      const emptyLog = {
        id: Date.now(),
        date: todayKey,
        amProducts: [], pmProducts: [],
        amExtras: [], pmExtras: [],
        devices: [], sleep: '', supplements: [],
        submitted: false,
      };
      const newList = [...(regimenLogs || []), emptyLog];
      setRegimenLogs(newList);
      saveData('regimenLogs', newList);
      setCoverRoutineRebuildToken(t => t + 1);
      toast(`Cleared ${slot.toUpperCase()} for today`, 'info');
      return;
    }
    const newList = (regimenLogs || []).map(r => {
      if (r.date !== todayKey) return r;
      return { ...r, [slotKey]: [] };
    });
    setRegimenLogs(newList);
    saveData('regimenLogs', newList);
    setCoverRoutineRebuildToken(t => t + 1);
    toast(`Cleared ${slot.toUpperCase()} routine`, 'info');
  };

  // === REGENERATE — restore today's slot from the built pattern ===
  // Symmetric to clearTodayRoutine. When the user has built a
  // weekly rotation but cleared today's slot (or wants to undo
  // a manual edit), tapping the same header button — now
  // labelled "Restore AM/PM" — writes the pattern's products
  // for today's day-of-week into today's log. No-op + toast if
  // no pattern exists.
  const regenerateSlotForToday = (slot) => {
    if (!userHasBuiltPattern(products)) {
      toast('No weekly rotation built yet', 'info');
      return;
    }
    const dow = new Date().getDay();
    const pat = getProductsForTodayFromPattern((products || []).filter(p => !p.endDate), dow);
    const slotKey = slot === 'am' ? 'amProducts' : 'pmProducts';
    const patSlotIds = (slot === 'am' ? pat.am : pat.pm).map(p => p.id);
    const exists = (regimenLogs || []).some(r => r.date === todayKey);
    if (!exists) {
      // No log yet means the pattern was already showing — but
      // user may have hit Regenerate as a deliberate gesture.
      // Materialize the log so the regenerate state is sticky
      // for today even if the pattern is edited later.
      const newLog = {
        id: Date.now(),
        date: todayKey,
        amProducts: slot === 'am' ? patSlotIds : [],
        pmProducts: slot === 'pm' ? patSlotIds : [],
        amExtras: [], pmExtras: [],
        devices: [], sleep: '', supplements: [],
        submitted: false,
      };
      const newList = [...(regimenLogs || []), newLog];
      setRegimenLogs(newList);
      saveData('regimenLogs', newList);
      setCoverRoutineRebuildToken(t => t + 1);
      toast(`Restored ${slot.toUpperCase()} from your weekly plan`, 'info');
      return;
    }
    const newList = (regimenLogs || []).map(r => {
      if (r.date !== todayKey) return r;
      return { ...r, [slotKey]: patSlotIds };
    });
    setRegimenLogs(newList);
    saveData('regimenLogs', newList);
    setCoverRoutineRebuildToken(t => t + 1);
    toast(`Restored ${slot.toUpperCase()} from your weekly plan`, 'info');
  };

  // AI Suggest entry point — opens the bottom sheet for today.
  // Bumps ritualSuggestToken to GUARANTEE a fresh fetch fires (the
  // sheet's auto-fetch effect dedupes by `${dateISO}#${token}`, so
  // re-opening for the same date without a token bump silently
  // skipped the call and left the user staring at an empty sheet).
  const openSuggestForToday = () => {
    setRitualSuggestion(null);
    setRitualSuggestSelected(new Set());
    setRitualSuggestError('');
    setRitualSuggestToken(t => t + 1);
    setRitualSuggestSheet({ dateISO: todayKey, source: 'today' });
  };

  // Progress: keys live in ritualProgress[todayKey] as ['am-id', 'pm-id', ...].
  const doneKeys = ritualProgress[todayKey] || [];
  const stepKey = (slot, p) => `${slot}-${p.id}`;
  const isDone = (slot, p) => doneKeys.includes(stepKey(slot, p));
  const doneCount = doneKeys.length;
  const allSteps = [
    ...amProducts.map(p => ({ slot: 'am', product: p })),
    ...pmProducts.map(p => ({ slot: 'pm', product: p })),
  ];
  const nextStep = allSteps.find(s => !isDone(s.slot, s.product));
  const nextLabel = nextStep ? (nextStep.product.name || 'Next step') : 'All done';

  // Continue ritual = mark next step complete.
  const continueRitual = () => {
    if (!nextStep) return;
    const k = stepKey(nextStep.slot, nextStep.product);
    const next = { ...ritualProgress, [todayKey]: [...doneKeys, k] };
    persistRitualProgress(next);
  };
  const resetToday = () => {
    const next = { ...ritualProgress };
    delete next[todayKey];
    persistRitualProgress(next);
  };

  // Remove a product from the regimen page's AM/PM tile —
  // ALWAYS writes to today's regimenLog (auto-save). If no log
  // exists yet, synthesize one from current visible AM/PM lists
  // so removing one bottle doesn't wipe the rest. Mirrors the
  // cover's removeFromSlot pattern — regimenLogs is the single
  // source of truth.
  const removeFromRegimenSlot = (p, slot) => {
    if (!p) return;
    const today = localDateISO();
    const targetLog = todayLog || (regimenLogs || []).find(r => r.date === today);
    const slotKey = slot === 'am' ? 'amProducts' : 'pmProducts';
    const otherKey = slot === 'am' ? 'pmProducts' : 'amProducts';
    const baseLog = targetLog || {
      id: Date.now(),
      date: today,
      amProducts: amProducts.map(x => x.id).filter(Boolean),
      pmProducts: pmProducts.map(x => x.id).filter(Boolean),
      amDone: [],
      pmDone: [],
      notes: '',
      submitted: false,
    };
    const updated = {
      ...baseLog,
      [slotKey]: (baseLog[slotKey] || []).filter(id => id !== p.id),
      [otherKey]: baseLog[otherKey] || [],
    };
    const exists = (regimenLogs || []).some(r => r.date === today);
    const newLogs = exists
      ? regimenLogs.map(r => r.date === today ? updated : r)
      : [updated, ...(regimenLogs || [])];
    setRegimenLogs(newLogs);
    saveData('regimenLogs', newLogs).catch(e => {
      console.error('[regimen-page X] saveData failed:', e);
      toast(`Save error: ${e?.message || 'unknown'}`, 'error');
    });
    setCoverRoutineRebuildToken(t => t + 1);
    toast(`Removed from ${slot.toUpperCase()}`, 'info');
  };

  // Bottle thumbnail — real photo > Gemini art > dashed outline.
  const renderBottleThumb = (p, key, slot) => {
    const slotKey = `prod-${p.id}`;
    const aiArt = generatedProductArt && generatedProductArt[slotKey];
    const caption = (p && (p.brand || p.name)) || '';
    return (
      <div key={key} className="flex-shrink-0 w-14 flex flex-col items-center relative">
        {/* X-remove chip in upper-right of each bottle tile */}
        {p && slot && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeFromRegimenSlot(p, slot); }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center transition hover:opacity-90 cursor-pointer z-10"
            style={{background:'var(--cream)', border:'1px solid var(--line)', color:'var(--ink-soft)', boxShadow:'0 1px 2px rgba(28,25,23,0.05)', cursor:'pointer'}}
            title={`Remove from ${slot.toUpperCase()}`}
            aria-label={`Remove ${p.name} from ${slot.toUpperCase()}`}
          >
            <Icon name="X" size={7} />
          </button>
        )}
        <div className="h-16 flex items-end justify-center overflow-hidden">
          {p.photo || p.photoPath ? (
            <Photo item={p} alt={p.name} className="h-full w-auto max-w-full object-contain"
              renderFallback={() => aiArt
                ? <img src={aiArt} alt={p.name} className="h-full w-auto max-w-full object-contain" />
                : <DashedBottleOutline />}
            />
          ) : aiArt ? (
            <img src={aiArt} alt={p.name} className="h-full w-auto max-w-full object-contain" />
          ) : (
            <DashedBottleOutline />
          )}
        </div>
        {caption ? (
          <div
            className="text-[8px] tracking-[0.08em] uppercase mt-0.5 truncate w-full text-center"
            style={{color:'var(--ink-soft)'}}
            title={caption}
          >
            {caption}
          </div>
        ) : null}
      </div>
    );
  };

  // Build the 7-day weekly rotation strip — anchored to current
  // Monday with a `regimenWeekOffset` shift in weeks (0 = current
  // week, negative = past). Capped at 0 so we never show future weeks.
  // Each day: { date, label, isToday, theme, hasAm, hasPm, amProducts, pmProducts, dayLog }
  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
  const baseWeekStart = new Date(todayDate);
  const dow = baseWeekStart.getDay(); // 0=Sun, 1=Mon
  baseWeekStart.setDate(baseWeekStart.getDate() - ((dow + 6) % 7)); // back to Monday
  const weekStart = new Date(baseWeekStart);
  weekStart.setDate(baseWeekStart.getDate() + regimenWeekOffset * 7);
  const weekEndForRange = new Date(weekStart);
  weekEndForRange.setDate(weekStart.getDate() + 6);
  const isCurrentRegimenWeek = regimenWeekOffset === 0;
  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayShort = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const dayLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // Theme inference per day — anchor on hero ingredient if a log exists,
  // else cycle through a curated rotation of common AI themes.
  const themeRotation = ['Vitamin C AM', 'Retinol PM', 'Recovery Day', 'Acid Night', 'Hydration', 'Barrier Repair', 'Reset Sunday'];
  const inferTheme = (dayProducts) => {
    const all = [...(dayProducts.am || []), ...(dayProducts.pm || [])];
    const txt = all.map(p => `${p.name || ''} ${p.activeIngredients || ''}`).join(' ').toLowerCase();
    if (/retinol|tretinoin|retinaldehyde|adapalene/.test(txt)) return 'Retinol PM';
    if (/ascorbic|vitamin c|c.?ferulic/.test(txt)) return 'Vitamin C AM';
    if (/glycolic|salicylic|lactic|mandelic|aha|bha/.test(txt)) return 'Acid Night';
    if (/niacinamide|panthenol|ceramide|centella/.test(txt)) return 'Barrier Repair';
    if (/hyaluronic|squalane|glycerin|essence/.test(txt)) return 'Hydration';
    return null;
  };
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    const iso = localDateISO(d);
    const log = (regimenLogs || []).find(r => r.date === iso && r.submitted);
    const dayAmProducts = log ? (log.amProducts || []).map(id => productById[id]).filter(Boolean) : [];
    const dayPmProducts = log ? (log.pmProducts || []).map(id => productById[id]).filter(Boolean) : [];
    const inferred = inferTheme({ am: dayAmProducts, pm: dayPmProducts });
    const theme = inferred || themeRotation[i];
    return {
      iso, date: d, letter: dayLetters[i], short: dayShort[i], long: dayLong[i],
      isToday: iso === todayKey,
      theme,
      hasAm: dayAmProducts.length > 0 || (!log && (i % 2 === 0)), // heuristic for fallback
      hasPm: dayPmProducts.length > 0 || (!log && (i % 2 === 1)),
      amProducts: dayAmProducts, pmProducts: dayPmProducts, log,
    };
  });

  // Progress ring SVG — circumference based.
  const ringR = 22; const ringC = 2 * Math.PI * ringR;
  const ringPct = totalSteps > 0 ? doneCount / totalSteps : 0;
  const ringDash = ringC * ringPct;

  // === Square product tile ===
  // Real photo > AI art > dashed bottle outline. Brand on top
  // (small caps), product name underneath. Used by both Morning
  // and Evening rows in the new mockup-aligned layout.
  const renderProductTile = (p, key, slot) => {
    const slotKey = `prod-${p.id}`;
    const aiArt = generatedProductArt && generatedProductArt[slotKey];
    const hasPhoto = p.photo || p.photoPath;
    return (
      <div key={key} className="flex-shrink-0 w-[78px] md:w-[72px] relative">
        {/* Quick-remove X in upper-right of the tile */}
        {slot && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeFromRegimenSlot(p, slot); }}
            className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center transition hover:opacity-90 cursor-pointer z-10"
            style={{background:'var(--cream)', border:'1px solid var(--line)', color:'var(--ink-soft)', boxShadow:'0 1px 2px rgba(28,25,23,0.05)', cursor:'pointer'}}
            title={`Remove from ${slot.toUpperCase()}`}
            aria-label={`Remove ${p.name} from ${slot.toUpperCase()}`}
          >
            <Icon name="X" size={7} />
          </button>
        )}
        <div className="w-[78px] h-[78px] md:w-[72px] md:h-[72px] rounded-[14px] overflow-hidden flex items-center justify-center" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
          {hasPhoto ? (
            <Photo item={p} alt={p.name} className="w-full h-full object-cover"
              renderFallback={() => aiArt
                ? <img src={aiArt} alt={p.name} className="w-full h-full object-contain p-2" />
                : <div className="w-full h-full flex items-center justify-center" style={{color:'var(--ink-soft)'}}><DashedBottleOutline /></div>}
            />
          ) : aiArt ? (
            <img src={aiArt} alt={p.name} className="w-full h-full object-contain p-2" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{color:'var(--ink-soft)'}}>
              <DashedBottleOutline />
            </div>
          )}
        </div>
        {p.brand && (
          <div className="text-[10px] font-medium text-center mt-1.5 truncate" style={{color:'var(--ink)'}} title={p.brand}>{p.brand}</div>
        )}
        {p.name && (
          <div className="text-[9.5px] text-center leading-tight mt-0.5 line-clamp-2" style={{color:'var(--ink-soft)'}} title={p.name}>{p.name}</div>
        )}
      </div>
    );
  };
  const renderAddTile = (slot, key) => (
    <button
      key={key}
      type="button"
      onClick={() => setAddRitualSheet({ slot })}
      className="flex-shrink-0 w-[78px] h-[78px] md:w-[72px] md:h-[72px] rounded-[14px] flex flex-col items-center justify-center gap-0.5 transition hover:opacity-80 cursor-pointer"
      style={{border:'1px dashed var(--line)', background:'transparent', color:'var(--ink-soft)', cursor:'pointer'}}
    >
      <Icon name="Plus" size={16} />
      <span className="text-[8px] tracking-[0.18em] uppercase mt-0.5">Add step</span>
    </button>
  );

  return (
    <div className="space-y-4 md:space-y-4">
      {/* === TODAY'S RITUAL HERO CARD (mockup-aligned) ===
          Header: TODAY'S RITUAL eyebrow + ⓘ info icon top-right,
          Regimen serif title, "Your selected ritual for today."
          subtitle. Below: 3-equal-segment action bar (Repeat
          Yesterday / Edit Today / Étude Suggests). Then Morning
          and Evening sections each as a horizontal scroll row of
          square product tiles + dashed Add Step tiles. Bottom:
          single subtle Étude AI note card.
          AI is opt-in via the "Suggest with AI" italic link in
          the action row below; it proposes a routine the user
          can accept item-by-item. The eyebrow reflects state,
          not source: LOGGED (submitted), PLANNED (default), or
          empty. */}
      <EditorialCard pad="tight" className="export-target" style={{background:'var(--cream-deep)'}}>
        {/* Header strip — eyebrow + title + subtitle (left).
            Right side: quick-action icons (Repeat ↻ + Clear AM/PM
            ✕) on top, with the Info ⓘ icon below them. The icons
            are slot-aware — Clear's label flips to match whichever
            AM/PM tab is active. Hidden on past-day views (read-
            only context). */}
        <div className="flex items-start justify-between gap-3 mb-2 md:mb-2">
          <div className="min-w-0 flex-1">
            <Eyebrow className="mb-1 md:mb-0.5">{isViewingToday ? "Today's Regimen" : `${viewDayLabel}'s Regimen`}</Eyebrow>
            <h2 className="font-serif italic text-[22px] md:text-[22px] leading-[1.05] mb-0.5" style={{color:'var(--ink)'}}>
              Regimen
            </h2>
            <p className="text-[11.5px] md:text-[11px] leading-snug" style={{color:'var(--ink-soft)'}}>
              {isShowingPatternFallback
                ? 'From your current routine.'
                : isViewingToday ? 'Your regimen for today.' : 'Edit a prior day\'s log if something was off.'}
            </p>
            {/* === GENERATED-FROM-WEEK INDICATOR (May 2026, slice 5) ===
                Surfaces the connection between Today and Rotation
                so users understand this isn't a static product
                list — it's auto-derived from the weekly plan.
                Tappable link routes to Rotation for the full view.
                Shows only when the user has a built pattern AND
                we're viewing today (not a past day log). */}
            {isShowingPatternFallback && isViewingToday && userHasBuiltPattern(products) && (
              <button
                onClick={() => setRegimenView('occasions')}
                className="mt-1.5 inline-flex items-center gap-1.5 text-[9.5px] tracking-[0.18em] uppercase transition hover:opacity-70"
                style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                type="button"
              >
                <Icon name="Calendar" size={10} />
                View weekly rotation
                <Icon name="ArrowRight" size={10} />
              </button>
            )}
          </div>
          {/* Quick-action stack — Repeat + Clear/Restore.
              May 2026: export (JPG) and info (full plan sheet)
              icons retired per Jenni — the surface had too
              many controls. Repeat and Clear stack vertically
              on the right rail, mirroring how the buttons read
              most naturally as a small editorial action list. */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {isViewingToday && (
              <>
                <button
                  type="button"
                  onClick={() => { if (submittedToday) undoRepeatYesterday(); else repeatYesterday(); }}
                  disabled={!yesterdayCheckIn}
                  className="flex items-center gap-1 transition hover:opacity-70 disabled:opacity-30"
                  style={{color: submittedToday ? 'var(--accent)' : 'var(--ink-soft)', cursor: yesterdayCheckIn ? 'pointer' : 'default'}}
                  title={submittedToday ? 'Repeated — tap to clear' : (yesterdayCheckIn ? 'Repeat yesterday\'s picks' : 'No yesterday log to repeat')}
                  aria-label="Repeat last regimen"
                >
                  <Icon name={submittedToday ? 'Check' : 'RotateCcw'} size={11} />
                  <span className="text-[9px] tracking-[0.18em] uppercase">{submittedToday ? 'Repeated' : 'Repeat'}</span>
                </button>
                {/* === CLEAR ↔ RESTORE TOGGLE (May 2026) ===
                    Same button position, swaps role based on
                    whether the active slot currently has any
                    products. If empty AND a built pattern
                    exists for today → "RESTORE" with the undo
                    icon. If empty AND no pattern → hide
                    entirely (nothing to act on). If has
                    products → "CLEAR" with trash icon. */}
                {(() => {
                  const activeSlotList = ritualSlot === 'pm' ? pmProducts : amProducts;
                  const activeSlotEmpty = activeSlotList.length === 0;
                  const patternBuiltForUser = userHasBuiltPattern(products);
                  // Hide if empty AND no pattern (nothing to clear, nothing to restore)
                  if (activeSlotEmpty && !patternBuiltForUser) return null;
                  if (activeSlotEmpty) {
                    // Empty but pattern exists → Restore
                    return (
                      <button
                        type="button"
                        onClick={() => regenerateSlotForToday(ritualSlot)}
                        className="flex items-center gap-1 transition hover:opacity-70"
                        style={{color:'var(--accent)', cursor:'pointer'}}
                        title={`Restore ${ritualSlot.toUpperCase()} from your weekly plan`}
                        aria-label={`Restore ${ritualSlot.toUpperCase()} from your weekly plan`}
                      >
                        <Icon name="RotateCcw" size={11} />
                        <span className="text-[9px] tracking-[0.18em] uppercase">Restore {ritualSlot.toUpperCase()}</span>
                      </button>
                    );
                  }
                  // Default state: slot has products → Clear
                  return (
                    <button
                      type="button"
                      onClick={() => clearTodayRoutine(ritualSlot)}
                      className="flex items-center gap-1 transition hover:opacity-70"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                      title={`Clear ${ritualSlot.toUpperCase()} routine for today`}
                      aria-label={`Clear ${ritualSlot.toUpperCase()} routine`}
                    >
                      <Icon name="Trash2" size={11} />
                      <span className="text-[9px] tracking-[0.18em] uppercase">Clear {ritualSlot.toUpperCase()}</span>
                    </button>
                  );
                })()}
              </>
            )}
          </div>
        </div>
        {/* Day scrubber — ◀ DAY ▶ navigation. Forward arrow
            disabled on today (no future). When on a prior day,
            a quick "jump to today" link sits next to the date. */}
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[var(--cream)] cursor-pointer"
            style={{color:'var(--ink-soft)', cursor:'pointer'}}
            aria-label="Previous day"
          >
            <Icon name="ChevronLeft" size={14} />
          </button>
          <div className="flex items-baseline gap-2">
            <span className="font-serif italic text-[13px]" style={{color: isViewingToday ? 'var(--accent)' : 'var(--ink)'}}>{viewDayLabel}</span>
            {/* Logged-today cue (restored May 2026). */}
            {isViewingToday && submittedToday && (
              <span
                className="inline-flex items-center gap-1 text-[8.5px] tracking-[0.18em] uppercase"
                style={{color:'var(--sage, #8a9b7e)', fontWeight:600}}
                title={`Logged${todayLog?.submittedAt ? ' · ' + new Date(todayLog.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}`}
              >
                <Icon name="Check" size={9} /> Logged
              </span>
            )}
            {!isViewingToday && (
              <button
                type="button"
                onClick={() => setRitualViewDate(todayKey)}
                className="text-[9px] tracking-[0.2em] uppercase italic transition hover:opacity-70"
                style={{color:'var(--accent)'}}
              >
                jump to today
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            disabled={isViewingToday}
            className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[var(--cream)] cursor-pointer disabled:opacity-30"
            style={{color:'var(--ink-soft)', cursor: isViewingToday ? 'default' : 'pointer'}}
            aria-label="Next day"
          >
            <Icon name="ChevronRight" size={14} />
          </button>
        </div>

        {/* === INLINE EDIT-IN-PLACE LAYOUT (May 2026 redesign) ===
             Replaces the prior 3-tab control (Repeat/Edit/Suggests)
             + Morning/Evening tile rows with the same compact format
             the Edit Today modal uses — but rendered ON the page so
             the user can edit without a popup. AM/PM toggle, numbered
             rows with auto-save X, then three action pills (Repeat /
             From Shelf / New Product), utility row (Reorder / Clear),
             and Étude Suggests as a tappable inline card that opens
             the existing AI suggestion sheet. */}

        {/* AM / PM segmented toggle */}
        <div className="rounded-full flex p-1 gap-1 mb-4" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
          {[
            { id: 'am', label: 'AM routine', icon: 'Sun' },
            { id: 'pm', label: 'PM routine', icon: 'Moon' },
          ].map(t => {
            const active = ritualSlot === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setRitualSlot(t.id)}
                className="flex-1 rounded-full py-2 px-3 flex items-center justify-center gap-1.5 transition"
                style={{
                  background: active ? 'var(--cream)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-soft)',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  cursor:'pointer',
                }}
              >
                <Icon name={t.icon} size={12} style={{color: active ? 'var(--accent)' : 'var(--ink-soft)'}} />
                <span className="text-[11px] tracking-[0.18em] uppercase">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Numbered rows for the active slot — auto-save on X */}
        {(() => {
          const slotList = ritualSlot === 'pm' ? pmProducts : amProducts;
          const slotKey = ritualSlot;
          if (slotList.length === 0) {
            // === EMPTY STATE COPY (May 2026) ===
            // Two flavors depending on whether the user has
            // built any weekly rotation:
            //  1) No build yet at all → motivate building.
            //     This is the "you haven't told us your week"
            //     state, not a same-day blank state.
            //  2) Build exists but today's slot is empty
            //     (user cleared, or pattern legitimately has
            //     nothing here) → existing T&G snark + a hint
            //     that they can Restore from the corner.
            const patternBuiltForUser = userHasBuiltPattern(products);
            if (!patternBuiltForUser) {
              return (
                <button
                  type="button"
                  onClick={() => { setRegimenView('build'); }}
                  className="w-full rounded-[14px] p-6 text-center mb-4 transition hover:bg-[var(--cream)]"
                  style={{background:'var(--cream-deep)', border:'1px dashed var(--accent)', cursor:'pointer'}}
                  aria-label="Go to Build to design your weekly rotation"
                >
                  <Icon name="Sparkles" size={14} style={{color:'var(--accent)', marginBottom:6, opacity:0.85}} />
                  <div className="text-[14px]" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.01em'}}>
                    No regimen yet. Build one.
                  </div>
                  <div className="text-[11px] mt-1" style={{color:'var(--ink-soft)'}}>
                    Tell Étude your concerns and active cadence — we'll lay out the week.
                  </div>
                  <div className="mt-2.5 text-[10px] tracking-[0.22em] uppercase inline-flex items-center gap-1.5" style={{color:'var(--accent)', fontWeight:600}}>
                    Build your week
                    <Icon name="ArrowRight" size={10} />
                  </div>
                </button>
              );
            }
            return (
              <div className="rounded-[14px] p-6 text-center mb-4" style={{background:'var(--cream-deep)', border:'1px dashed var(--line)'}}>
                <div className="font-serif italic text-[15px] mb-1" style={{color:'var(--ink)'}}>
                  {slotKey === 'am' ? 'Stepping out bare? Brave.' : 'Going to bed bare? Bolder.'}
                </div>
                <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>
                  {slotKey === 'am' ? 'Even SPF beats nothing.' : 'At least wash the day off.'} Pull from your shelf, or restore your weekly plan above.
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-1 mb-4">
              {slotList.map((p, i) => {
                if (p.isExtra) {
                  // AI-suggested product not yet on shelf — non-removable text row.
                  return (
                    <div key={`extra-${i}`} className="regimen-row">
                      <div className="font-serif italic text-[14px] text-center" style={{color:'var(--ink-soft)'}}>{i + 1}</div>
                      <div className="h-12 flex items-end justify-center overflow-hidden">
                        <DashedBottleOutline />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[13px] truncate" style={{color:'var(--ink)'}}>{p.name}</div>
                        <div className="text-[9.5px] mt-0.5 tracking-[0.12em] uppercase italic" style={{color:'var(--ink-soft)'}}>AI suggestion · not on shelf</div>
                      </div>
                      <span style={{width:28}} />
                    </div>
                  );
                }
                const art = generatedProductArt && generatedProductArt[`prod-${p.id}`];
                const hasRealPhoto = p.photo || p.photoPath;
                return (
                  <div key={p.id} className="regimen-row">
                    <div className="font-serif italic text-[14px] text-center" style={{color:'var(--ink-soft)'}}>{i + 1}</div>
                    <div className="h-12 flex items-end justify-center overflow-hidden">
                      {hasRealPhoto ? (
                        <Photo item={p} alt={p.name} className="h-full w-auto max-w-full object-contain"
                          renderFallback={() => art ? <img src={art} alt={p.name} className="h-full w-auto max-w-full object-contain" /> : <DashedBottleOutline />}
                        />
                      ) : art ? (
                        <img src={art} alt={p.name} className="h-full w-auto max-w-full object-contain" />
                      ) : (
                        <DashedBottleOutline />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[13px] truncate" style={{color:'var(--ink)'}}>{p.brand || p.name}</div>
                      {p.brand && p.name && p.brand !== p.name && (
                        <div className="text-[10.5px] truncate" style={{color:'var(--ink-soft)'}}>{p.name}</div>
                      )}
                      {p.category && (
                        <div className="text-[9.5px] mt-0.5 tracking-[0.12em] uppercase" style={{color:'var(--ink-soft)'}}>{p.category.replace(/-/g, ' ')}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromRegimenSlot(p, slotKey)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)]"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                      title="Remove from routine"
                      type="button"
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Two primary action pills — From Shelf + New Product.
            Repeat moved to upper-right header icons (with Clear). */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setShelfQuickAddOpen(true)}
            className="pill-primary pill-compact"
            title="Pick from your shelf — taps add directly to AM or PM"
            type="button"
          >
            <Icon name="Plus" size={12} />
            <span>From Shelf</span>
          </button>
          <button
            onClick={() => { setEditingProductId(null); setShowProductModal(true); }}
            className="pill-secondary pill-compact"
            title="Add a new product to your shelf"
            type="button"
          >
            <Icon name="Plus" size={12} />
            <span>New Product</span>
          </button>
        </div>

        {/* === Étude Suggests — full-width pill ===
             Promoted from a quiet editorial card to an actual pill
             button so the affordance reads as "tap to do something
             AI-y" instead of an info card. Filled with sparkle icon
             for brand emphasis. */}
        <button
          onClick={openSuggestForToday}
          className="w-full pill-secondary pill-compact mb-2"
          style={{borderColor:'var(--accent)', color:'var(--accent)'}}
          title="Tang & Gainey pick from products already on your shelf"
          type="button"
        >
          <Icon name="Sparkles" size={12} />
          <span>Suggest picks from your shelf</span>
        </button>

        {/* Clear utility moved to upper-right header icons (slot-aware). */}
        {/* Note card removed (May 2026 per Jenni): "Étude AI learns
            from your log to personalize recommendations" was static
            clutter. The same line now surfaces inside the Suggest
            sheet's loading state, where it has meaning (the
            personalization is actually happening at that moment). */}

        {/* === SECONDARY: progress tracker UI HIDDEN ===
            The Continue Ritual / Reset card was removed per Jenni's
            spec to declutter. Underlying state (ritualProgress,
            nextStep, doneCount) is preserved so the kebab menu in
            Edit Today can still expose "Mark done today" later.
            Set to false to keep the JSX block intact for easy
            un-hide if we want it back. */}
        {false && submittedToday && totalSteps > 0 && (
          <div className="mt-4 pt-3 border-t" style={{borderColor:'var(--line)'}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-shrink-0" style={{width:'56px', height:'56px'}}>
                <svg viewBox="0 0 56 56" width="56" height="56">
                  <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--line)" strokeWidth="3" />
                  <circle
                    cx="28" cy="28" r={ringR} fill="none"
                    stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${ringDash} ${ringC}`}
                    transform="rotate(-90 28 28)"
                    style={{transition:'stroke-dasharray 350ms ease-out'}}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-serif italic text-[14px]" style={{color:'var(--ink)'}}>{doneCount}/{totalSteps}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <Eyebrow className="mb-0.5">{nextStep ? 'Next' : 'Complete'}</Eyebrow>
                <div className="font-serif italic text-[16px] leading-tight truncate" style={{color:'var(--ink)'}}>{nextLabel}</div>
              </div>
              {doneCount > 0 && (
                <button
                  onClick={resetToday}
                  className="text-[10px] tracking-[0.18em] uppercase italic transition hover:opacity-70 flex-shrink-0"
                  style={{color:'var(--ink-soft)'}}
                  title="Reset today's progress"
                >
                  Reset
                </button>
              )}
            </div>
            <button
              onClick={continueRitual}
              disabled={!nextStep}
              className="w-full rounded-full py-2.5 px-4 text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
              style={{background:'var(--ink)', color:'var(--cream)'}}
            >
              {nextStep
                ? <><Icon name="Check" size={12} /> Continue regimen <Icon name="ArrowRight" size={12} /></>
                : <><Icon name="Sparkles" size={12} /> Regimen complete</>}
            </button>
          </div>
        )}
      </EditorialCard>

      {/* "What we'd try" tiles relocated (May 2026) — see end of
          Shelf sub-tab. Removed from cover entrance to give the
          daily-read surface more breathing room. */}

    </div>
  );
  })();
};
