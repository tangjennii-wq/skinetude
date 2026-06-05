// === TodayRitualModal (Wave 5.3 extract — May 2026) ===
// Pulled out of App so the 720-line modal can be reasoned about
// independently and so App's render method is shorter. Behavior preserved
// exactly. All App-scope state + setters passed as props.
//
// This modal is the daily command center: edits any day's AM/PM ritual,
// supports repeat-yesterday, add-from-shelf bottom sheet (embedded),
// reorder mode, clear-slot, and the "used something else" / "procedure
// today" quick actions. Title shifts between "Today's check-in" /
// "Yesterday's check-in" / "[date]'s check-in" based on targetDate.
//
// Module-scope (no prop bridge needed): Modal, Photo, DashedBottleOutline,
// Icon, resolveTodayRitual, localDateISO, generateProductArtForAll.

const TodayRitualModal = ({
  // === DATA ===
  regimenLogs, setRegimenLogs,
  products,
  ritualViewDate,
  generatedProductArt,
  // === FORM STATE (kept at App scope so the form survives App re-renders) ===
  ritualForm, setRitualForm,
  ritualFormRef,
  ritualSlot, setRitualSlot,
  // === EMBEDDED SHELF-SHEET STATE ===
  editRegimenShelfOpen, setEditRegimenShelfOpen,
  editRegimenShelfSelected, setEditRegimenShelfSelected,
  editRegimenShelfSearch, setEditRegimenShelfSearch,
  editRegimenShelfFilter, setEditRegimenShelfFilter,
  // === "Used something else" inline form state ===
  somethingElseInput, setSomethingElseInput,
  somethingElsePromptOpen, setSomethingElsePromptOpen,
  // === MODAL TRIGGERS ===
  setShowCheckInModal,
  setShowProductModal,
  setShowProcedureModal,
  // === PRODUCT MODAL CONTEXT BRIDGES ===
  setProductModalRegimenContext,
  setProductForm,
  // === COVER REBUILD TRIGGER ===
  setCoverRoutineRebuildToken,
  // === GEMINI ART RESYNC ===
  lastArtSyncRef,
  // === App-scope helpers ===
  toast,
  saveData,
  // Wave 8 audit (May 2026) — App-scope, not module-scope.
  generateProductArtForAll,
  // June 2026 Phase 2: needed for travel.active log tagging.
  userProfile}) => {
  // === DATE-AWARE ===
  // Edits whichever day's regimen the user is viewing (via cover or
  // regimen scrubber). Defaults to today. When opened on a prior day,
  // the modal title + save target both follow the viewed date.
  const today = localDateISO();
  const targetDate = ritualViewDate || today;
  const isEditingToday = targetDate === today;
  const existing = (regimenLogs || []).find(r => r.date === targetDate);
  const yKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDateISO(d); })();
  const yesterdayCheckIn = (regimenLogs || []).find(r => r.date === yKey && r.submitted);
  const activeProductsList = (products || []).filter(p => !p.endDate);
  // === FORM SEED ===
  // Seed AM/PM from built routine when no existing log; otherwise use the
  // existing log's contents. See sidecar comments for the long history of
  // why this seeding logic is the way it is (useTimes-as-roster bug, etc.)
  const seedFromPlanned = (() => {
    if (!isEditingToday) return { am: [], pm: [] };
    try {
      const resolved = resolveTodayRitual({
        products: products || [],
        regimenLogs: [],
        date: targetDate});
      return {
        am: (resolved.am || []).map(p => p.id),
        pm: (resolved.pm || []).map(p => p.id)};
    } catch (_) {
      return { am: [], pm: [] };
    }
  })();
  const formSeed = existing ? {
    date: targetDate,
    amProducts: [...(existing.amProducts || [])],
    pmProducts: [...(existing.pmProducts || [])],
    amDone: [...(existing.amDone || existing.amProducts || [])],
    pmDone: [...(existing.pmDone || existing.pmProducts || [])],
    notes: existing.notes || ''} : {
    date: targetDate,
    amProducts: seedFromPlanned.am,
    pmProducts: seedFromPlanned.pm,
    amDone: [],
    pmDone: [],
    notes: ''};
  const form = ritualFormRef.current || ritualForm || formSeed;
  const setForm = (updater) => {
    const base = ritualFormRef.current || ritualForm || formSeed;
    const next = typeof updater === 'function' ? updater(base) : updater;
    ritualFormRef.current = next;
    setRitualForm(next);
  };

  const slot = ritualSlot;
  const slotKey = slot === 'am' ? 'amProducts' : 'pmProducts';
  const doneKey = slot === 'am' ? 'amDone' : 'pmDone';
  const slotIds = form[slotKey] || [];
  const slotProducts = slotIds.map(id => activeProductsList.find(p => p.id === id)).filter(Boolean);

  const toggleDone = (productId) => {
    setForm(f => {
      const arr = f[doneKey] || [];
      const next = arr.includes(productId) ? arr.filter(x => x !== productId) : [...arr, productId];
      return { ...f, [doneKey]: next };
    });
  };
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const addProductToSlot = (productId) => {
    setForm(f => {
      if ((f[slotKey] || []).includes(productId)) return f;
      return { ...f, [slotKey]: [...(f[slotKey] || []), productId] };
    });
    setAddPickerOpen(false);
  };
  const removeProductFromSlot = (productId) => {
    setForm(f => ({
      ...f,
      [slotKey]: (f[slotKey] || []).filter(x => x !== productId),
      [doneKey]: (f[doneKey] || []).filter(x => x !== productId)}));
  };
  const moveStep = (productId, dir) => {
    setForm(f => {
      const arr = [...(f[slotKey] || [])];
      const idx = arr.indexOf(productId);
      if (idx === -1) return f;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return f;
      const tmp = arr[idx]; arr[idx] = arr[newIdx]; arr[newIdx] = tmp;
      return { ...f, [slotKey]: arr };
    });
  };
  const [reorderMode, setReorderMode] = useState(false);

  const repeatYesterday = () => {
    if (!yesterdayCheckIn) { toast('Nothing logged yesterday — nothing to copy', 'error'); return; }
    setForm(f => ({
      ...f,
      amProducts: [...(yesterdayCheckIn.amProducts || [])],
      pmProducts: [...(yesterdayCheckIn.pmProducts || [])],
      amDone: [...(yesterdayCheckIn.amProducts || [])],
      pmDone: [...(yesterdayCheckIn.pmProducts || [])]}));
    toast('Pulled in yesterday\'s routine', 'info');
  };
  const clearSlot = () => {
    setForm(f => ({ ...f, [slotKey]: [], [doneKey]: [] }));
  };

  // === Save handler — writes regimenLogs with submitted: true ===
  const handleSubmit = async () => {
    const safeForm = ritualFormRef.current || form;
    const id = existing?.id || Date.now();
    // June 2026 Phase 2: tag new submitted logs with travel:true when the
    // user is in active travel mode. Preserves existing travel tag on
    // edit so re-saving a travel log doesn't accidentally drop the flag.
    const isTraveling = !!(userProfile?.travel?.active);
    const submitted = {
      ...safeForm,
      id,
      date: targetDate,
      submitted: true,
      submittedAt: Date.now(),
      ...(safeForm?.travel || existing?.travel
        ? { travel: safeForm?.travel || existing.travel }
        : (isTraveling ? { travel: true } : {})),
    };
    const next = existing
      ? regimenLogs.map(r => r.date === targetDate ? { ...r, ...submitted } : r)
      : [submitted, ...regimenLogs];
    setRegimenLogs(next);
    setCoverRoutineRebuildToken(t => t + 1);
    setShowCheckInModal(false);
    setRitualForm(null);
    ritualFormRef.current = null;
    setReorderMode(false);
    setAddPickerOpen(false);
    toast(existing ? 'Regimen updated ✨' : 'Regimen saved ✨');
    saveData('regimenLogs', next).catch(e => {
      console.error('[ritual] saveData failed:', e);
      toast(`Save error: ${e?.message || 'unknown'}`, 'error');
    });
    // Product imagery is text/icon-only now; do not trigger background
    // AI bottle generation after ritual saves.
  };

  const openShelfSheet = () => {
    setEditRegimenShelfSelected([]);
    setEditRegimenShelfSearch('');
    setEditRegimenShelfFilter('all');
    setEditRegimenShelfOpen(true);
  };
  const closeShelfSheet = () => {
    setEditRegimenShelfOpen(false);
    setEditRegimenShelfSelected([]);
    setEditRegimenShelfSearch('');
    setEditRegimenShelfFilter('all');
  };
  const commitShelfSelection = () => {
    if (editRegimenShelfSelected.length === 0) return;
    const slotKeyNow = ritualSlot === 'am' ? 'amProducts' : 'pmProducts';
    setForm(f => {
      const current = f[slotKeyNow] || [];
      const additions = editRegimenShelfSelected.filter(id => !current.includes(id));
      if (additions.length === 0) return f;
      return { ...f, [slotKeyNow]: [...current, ...additions] };
    });
    closeShelfSheet();
    toast(`Added ${editRegimenShelfSelected.length} to ${ritualSlot.toUpperCase()} routine`, 'success');
  };
  const shelfFilterToCategory = {
    all: null,
    toner: ['toner'],
    serum: ['serum'],
    moisturizer: ['moisturizer', 'cream'],
    essence: ['essence'],
    cleanser: ['cleanser', 'wash'],
    'eye-care': ['eye'],
    spf: ['spf', 'sunscreen']};
  const shelfSheetProducts = (() => {
    const q = editRegimenShelfSearch.trim().toLowerCase();
    const matchKeys = shelfFilterToCategory[editRegimenShelfFilter];
    return activeProductsList
      .filter(p => !slotIds.includes(p.id))
      .filter(p => {
        if (!matchKeys) return true;
        const cat = (p.category || '').toLowerCase();
        return matchKeys.some(k => cat.includes(k));
      })
      .filter(p => {
        if (!q) return true;
        return (p.brand || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (a.brand || a.name || '').localeCompare(b.brand || b.name || ''));
  })();

  return (
    <>
    <Modal compact onClose={() => {
      setShowCheckInModal(false);
      setRitualForm(null);
      ritualFormRef.current = null;
      setReorderMode(false);
      setAddPickerOpen(false);
      closeShelfSheet();
    }} title={(() => {
      if (isEditingToday) return "Today's check-in";
      if (targetDate === yKey) return "Yesterday's check-in";
      return new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + " check-in";
    })()} actionLabel={ritualSlot === 'pm' ? 'Save PM check-in' : 'Save AM check-in'} action={handleSubmit}>
      <div className="space-y-4">
        <p className="text-[11.5px] -mt-1" style={{color:'var(--ink-soft)'}}>
          {ritualSlot === 'pm' ? 'Close the loop on tonight\'s routine.' : 'Confirm what you used this morning.'}
        </p>
        <div className="rounded-full flex p-1 gap-1" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          {[
            { id: 'am', label: 'AM products', icon: 'Sun' },
            { id: 'pm', label: 'PM products', icon: 'Moon' },
          ].map(t => {
            const active = ritualSlot === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setRitualSlot(t.id)}
                className="flex-1 rounded-full py-2 px-3 flex items-center justify-center gap-1.5 transition"
                style={{
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--ink-soft)',
                  boxShadow: 'none',
                  whiteSpace: 'nowrap'}}
              >
                <Icon name={t.icon} size={12} style={{color: active ? 'var(--accent)' : 'var(--ink-soft)'}} />
                <span className="text-[11px] tracking-[0.16em] uppercase" style={{whiteSpace:'nowrap'}}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {slotProducts.length === 0 ? (
          <div className="rounded-[14px] p-6 text-center" style={{background:'var(--cream-deep)', border:'1px dashed var(--line)'}}>
            <div className="font-sans text-[15px] mb-1" style={{color:'var(--ink)'}}>
              {slot === 'am' ? 'Stepping out bare? Brave.' : 'Going to bed bare? Bolder.'}
            </div>
            <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>
              {slot === 'am' ? 'Even SPF beats nothing.' : 'At least wash the day off.'} Pull from your shelf or add something new.
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {slotProducts.map((p, i) => {
              const art = generatedProductArt && generatedProductArt[`prod-${p.id}`];
              const hasRealPhoto = p.photo || p.photoPath;
              return (
                <div key={p.id} className="regimen-row">
                  <div className="font-sans text-[14px] text-center" style={{color:'var(--ink-soft)'}}>{i + 1}</div>
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
                  {reorderMode ? (
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveStep(p.id, -1)} disabled={i === 0} className="px-1 py-0.5 disabled:opacity-30" style={{color:'var(--ink-soft)'}}>
                        <Icon name="ChevronUp" size={13} />
                      </button>
                      <button onClick={() => moveStep(p.id, 1)} disabled={i === slotProducts.length - 1} className="px-1 py-0.5 disabled:opacity-30" style={{color:'var(--ink-soft)'}}>
                        <Icon name="ChevronDown" size={13} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => removeProductFromSlot(p.id)} className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)]" style={{color:'var(--ink-soft)'}} title="Remove from routine">
                      <Icon name="X" size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={repeatYesterday}
            disabled={!yesterdayCheckIn}
            className="pill-secondary pill-compact"
            title={!yesterdayCheckIn ? "No check-in yesterday" : 'Pull in yesterday’s routine'}
            type="button"
          >
            <Icon name="RotateCcw" size={12} />
            <span>Repeat</span>
          </button>
          <button
            onClick={openShelfSheet}
            className="pill-primary pill-compact"
            type="button"
          >
            <Icon name="Plus" size={12} />
            <span>From Shelf</span>
          </button>
          <button
            onClick={() => {
              setProductModalRegimenContext({ slot: ritualSlot, date: targetDate });
              setShowProductModal(true);
            }}
            className="pill-secondary pill-compact"
            type="button"
          >
            <Icon name="Plus" size={12} />
            <span>New</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setReorderMode(v => !v)}
            disabled={slotProducts.length < 2}
            className="shortcut-card"
            style={reorderMode ? {borderColor: 'var(--line)', background:'var(--accent-soft)'} : null}
            type="button"
          >
            <Icon name="Menu" size={13} style={{color:'var(--accent)'}} />
            <span>{reorderMode ? 'Done reordering' : 'Reorder steps'}</span>
          </button>
          <button
            onClick={clearSlot}
            disabled={slotProducts.length === 0}
            className="shortcut-card"
            type="button"
          >
            <Icon name="Trash2" size={13} style={{color:'var(--accent)'}} />
            <span style={{whiteSpace:'nowrap'}}>Clear {slot.toUpperCase()}</span>
          </button>
        </div>

        {(() => {
          const extrasKey = slot === 'am' ? 'amExtras' : 'pmExtras';
          const slotExtras = form[extrasKey] || [];
          const inputVal = somethingElseInput || '';
          const promptOpen = somethingElsePromptOpen;
          const addExtrasToday = () => {
            const v = inputVal.trim();
            if (!v) return;
            setForm(f => ({ ...f, [extrasKey]: [...(f[extrasKey] || []), v] }));
            setSomethingElseInput('');
            setSomethingElsePromptOpen(false);
            toast(`Added "${v}" to today's ${slot.toUpperCase()}`, 'success');
          };
          const addExtrasToShelf = () => {
            const v = inputVal.trim();
            if (!v) return;
            setProductModalRegimenContext({ slot, date: form.date || localDateISO() });
            setProductForm({
              name: v,
              brand: '',
              category: 'serum',
              startDate: '',
              endDate: '',
              activeIngredients: '',
              mainIngredients: '',
              tags: [],
              concerns: [],
              photo: null,
              photoB64: null,
              useDays: [0,1,2,3,4,5,6],
              useTimes: [slot],
              frequency: 'daily',
              notes: ''});
            setShowProductModal(true);
            setSomethingElseInput('');
            setSomethingElsePromptOpen(false);
          };
          return (
            <div className="mt-4 pt-3 border-t" style={{borderColor: 'var(--line)'}}>
              <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Also today?</div>
              {slotExtras.length > 0 && (
                <div className="space-y-1 mb-2">
                  {slotExtras.map((name, i) => (
                    <div key={`${name}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px]" style={{background:'var(--accent-soft)'}}>
                      <Icon name="Check" size={11} style={{color:'var(--accent)'}} />
                      <span className="text-[11.5px] flex-1 truncate" style={{color:'var(--ink)'}}>{name}</span>
                      <button
                        onClick={() => setForm(f => ({ ...f, [extrasKey]: (f[extrasKey] || []).filter(x => x !== name) }))}
                        className="text-[10px] tracking-[0.18em] uppercase"
                        style={{color:'var(--ink-soft)', cursor:'pointer'}}
                        type="button"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              {!promptOpen ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSomethingElsePromptOpen(true)}
                    className="rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                    style={{background:'var(--cream-deep)', border: '1px solid var(--line)', cursor:'pointer'}}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon name="Plus" size={11} style={{color:'var(--accent)'}} />
                      <span className="text-[11.5px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.005em'}}>Used something else?</span>
                    </div>
                    <div className="text-[10px] mt-0.5 leading-tight" style={{color:'var(--ink-soft)'}}>
                      One-off product not on your shelf.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCheckInModal(false);
                      setTimeout(() => setShowProcedureModal(true), 60);
                    }}
                    className="rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                    style={{background:'var(--cream-deep)', border: '1px solid var(--line)', cursor:'pointer'}}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon name="Plus" size={11} style={{color:'var(--accent)'}} />
                      <span className="text-[11.5px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.005em'}}>Procedure today?</span>
                    </div>
                    <div className="text-[10px] mt-0.5 leading-tight" style={{color:'var(--ink-soft)'}}>
                      Facial, microneedling, lasers.
                    </div>
                  </button>
                </div>
              ) : (
                <div className="rounded-[12px] p-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                  <input
                    autoFocus
                    type="text"
                    value={inputVal}
                    onChange={(e) => setSomethingElseInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtrasToday(); } }}
                    placeholder="e.g., Sample Vitamin C from event"
                    className="w-full px-3 py-2 text-[12.5px] rounded-[10px]"
                    style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink)'}}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={addExtrasToday}
                      disabled={!inputVal.trim()}
                      className="flex-1 rounded-full py-2 px-3 text-[10.5px] tracking-[0.16em] uppercase transition hover:opacity-90 disabled:opacity-40"
                      style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, cursor:'pointer'}}
                    >Today only</button>
                    <button
                      type="button"
                      onClick={addExtrasToShelf}
                      disabled={!inputVal.trim()}
                      className="flex-1 rounded-full py-2 px-3 text-[10.5px] tracking-[0.16em] uppercase transition hover:bg-[var(--cream)] disabled:opacity-40"
                      style={{background:'transparent', color:'var(--ink)', border: '1px solid var(--line)', fontWeight:600, cursor:'pointer'}}
                    >Add to shelf</button>
                    <button
                      type="button"
                      onClick={() => { setSomethingElseInput(''); setSomethingElsePromptOpen(false); }}
                      className="text-[10px] tracking-[0.18em] uppercase"
                      style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </Modal>

    {editRegimenShelfOpen && (
      <div
        className="shelf-bottom-sheet-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) closeShelfSheet(); }}
      >
        <div className="shelf-bottom-sheet" role="dialog" aria-label="Add from shelf">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div>
              <div className="font-sans text-[16px]" style={{color:'var(--ink)'}}>Add from shelf</div>
              <div className="text-[10.5px] tracking-[0.18em] uppercase mt-0.5" style={{color:'var(--ink-soft)'}}>
                to {ritualSlot.toUpperCase()} routine
              </div>
            </div>
            <button
              onClick={closeShelfSheet}
              className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)]"
              style={{color:'var(--ink-soft)'}}
              aria-label="Close"
              type="button"
            >
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-full px-3 py-2" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <Icon name="Search" size={12} style={{color:'var(--ink-soft)'}} />
              <input
                type="text"
                value={editRegimenShelfSearch}
                onChange={(e) => setEditRegimenShelfSearch(e.target.value)}
                placeholder="Search your shelf"
                className="flex-1 bg-transparent outline-none text-[13px]"
                style={{color:'var(--ink)'}}
              />
              {editRegimenShelfSearch && (
                <button onClick={() => setEditRegimenShelfSearch('')} style={{color:'var(--ink-soft)'}} type="button">
                  <Icon name="X" size={11} />
                </button>
              )}
            </div>
          </div>

          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'toner', label: 'Toner' },
              { id: 'serum', label: 'Serum' },
              { id: 'moisturizer', label: 'Moisturizer' },
              { id: 'essence', label: 'Essence' },
              { id: 'cleanser', label: 'Cleanser' },
              { id: 'eye-care', label: 'Eye Care' },
              { id: 'spf', label: 'SPF' },
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setEditRegimenShelfFilter(chip.id)}
                className={'filter-chip' + (editRegimenShelfFilter === chip.id ? ' active' : '')}
                type="button"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="shelf-scroll-area">
            {shelfSheetProducts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="font-sans text-[14px] mb-1" style={{color:'var(--ink)'}}>
                  {activeProductsList.filter(p => !slotIds.includes(p.id)).length === 0
                    ? 'Whole shelf is already in. Greedy.'
                    : 'Nothing here. Try less.'}
                </div>
                <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>
                  {activeProductsList.filter(p => !slotIds.includes(p.id)).length === 0
                    ? 'Hit + New Product if you’ve got more.'
                    : 'Loosen the filter or search shorter.'}
                </div>
              </div>
            ) : (
              shelfSheetProducts.map(p => {
                const selected = editRegimenShelfSelected.includes(p.id);
                const art = generatedProductArt && generatedProductArt[`prod-${p.id}`];
                const hasRealPhoto = p.photo || p.photoPath;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setEditRegimenShelfSelected(prev =>
                        prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                      );
                    }}
                    className="shelf-row"
                    type="button"
                  >
                    <div className="h-11 flex items-end justify-center overflow-hidden">
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
                    <div className="min-w-0 text-left">
                      <div className="font-medium text-[13px] truncate" style={{color:'var(--ink)'}}>{p.brand || p.name}</div>
                      {p.brand && p.name && p.brand !== p.name && (
                        <div className="text-[10.5px] truncate" style={{color:'var(--ink-soft)'}}>{p.name}</div>
                      )}
                      <div className="text-[9.5px] mt-0.5 tracking-[0.12em] uppercase" style={{color:'var(--ink-soft)'}}>
                        {(p.category || 'product').replace(/-/g, ' ')}{p.size ? ' · ' + p.size : ''}
                      </div>
                    </div>
                    <div className={'shelf-plus' + (selected ? ' selected' : '')}>
                      <Icon name={selected ? 'Check' : 'Plus'} size={13} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="shelf-footer">
            <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>
              {editRegimenShelfSelected.length === 0
                ? 'Select products to add'
                : `${editRegimenShelfSelected.length} selected`}
            </div>
            <button
              onClick={commitShelfSelection}
              disabled={editRegimenShelfSelected.length === 0}
              className="pill-primary"
              style={editRegimenShelfSelected.length === 0 ? {opacity:0.5, pointerEvents:'none', whiteSpace:'nowrap'} : {whiteSpace:'nowrap'}}
              type="button"
            >
              Add to {ritualSlot.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
