// === RegimenView (Wave 7.1 extract — May 2026) ===
// The Regimen tab body — extracted from App's inline JSX
// `{activeTab === 'regimen' && (<div>...</div>)}`. ~4720 lines: build plan,
// today's ritual, shelf, refine flows, Q&A, weekly editor.
//
// All App-scope state + setters are passed as explicit props.

const RegimenView = ({
  activeTab,
  logs,
  products, setProducts,
  setRemoveScopePrompt, // July 2026 Phase 1: Today view routes X to the App-level skip/remove prompt
  procedures,
  regimenLogs, setRegimenLogs,
  buildAnswers, setBuildAnswers,
  buildPlan, setBuildPlan,
  regimenView, setRegimenView,
  postAcceptDay, setPostAcceptDay,
  generatedProductArt,
  homeDevices, setHomeDevices,
  sensitivities, setSensitivities,
  userProfile,
  cycleData,
  hormonalContext,
  userConcerns, setUserConcerns,
  ritualViewDate, setRitualViewDate,
  setRitualSlot,
  setEditingProductId,
  setProductForm,
  setShowProductModal,
  setShowProcedureModal,
  setEditingProcedureId,
  setShowProfileModal,
  setCoverRoutineRebuildToken,
  setOpenLesson,
  setProductCompareId,
  saveData,
  toast,
  openChat,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  // Forwarded to RegimenBuildView.
  buildAddProposal, setBuildAddProposal,
  buildAddQueue, setBuildAddQueue,
  buildAddSheet, setBuildAddSheet,
  buildAddStage, setBuildAddStage,
  buildBudget, setBuildBudget,
  buildConcernInputOpen, setBuildConcernInputOpen,
  buildConcernInputValue, setBuildConcernInputValue,
  buildExperience, setBuildExperience,
  buildMode, setBuildMode,
  buildPlanAccepted, setBuildPlanAccepted,
  buildRebuildSheetOpen, setBuildRebuildSheetOpen,
  buildRefreshNudgeDismissed, setBuildRefreshNudgeDismissed,
  buildSelectedActives, setBuildSelectedActives,
  buildStep, setBuildStep,
  buildTolerance, setBuildTolerance,
  cancelProposal,
  closeProposal,
  flipProposalSlot,
  isBuildCardExpanded,
  persistentSummaryDay, setPersistentSummaryDay,
  refineMoreOptions, setRefineMoreOptions,
  runAcceptProposal,
  setAddDeviceSheet,
  setAddRxSheet,
  setBuildAddPriorIds,
  setBuildPendingAdd,
  setProfileWizardStep,
  setRefineHowItWorks,
  setRefineIntent,
  setRefineSheetOpen,
  setStartOverConfirmOpen,
  toggleBuildEditExpand,
  toggleProposalDay,
  // Forwarded to RegimenTodayView.
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
  setUsedSomethingElseSheet,
  // Forwarded to RegimenShelfView.
  assessProduct,
  assessingProduct,
  deleteProduct,
  expandedShelfProductId, setExpandedShelfProductId,
  productAssessment,
  regenerateProductAlternatives,
  setMatchesDrawerFilter,
  setMatchesDrawerOpen,
  setShelfTagFilter,
  setShowInactiveProducts, showInactiveProducts,
  // Forwarded to RegimenOccasionsView.
  rotationViewMode, setRotationViewMode,
  rotationTargetSlot, setRotationTargetSlot,
  setWeeklyExpandedDay, weeklyExpandedDay}) => {
  // July 2026 Phase 2: the Build view leads with the edit-in-place
  // WeeklyPlanEditor grid once a plan exists; the full builder
  // (proposals / refine / start over) sits behind this toggle.
  // July 2026 per Jenni (IA consolidation): sub-nav is Refine · Today ·
  // Shelf · Build. Rotation folded into Refine as the week lens; Bench
  // folded into Shelf as a filter. Legacy deep links redirect below.
  const [planLens, setPlanLens] = useState('week'); // July 2026 per Jenni: by-day editor is the Refine default — it opens on today
  const [shelfBenchOnly, setShelfBenchOnly] = useState(false);
  // Regimen tab lens: today's execution card vs the weekly calendar.
  const [regimenLens, setRegimenLens] = useState('today');
  useEffect(() => {
    if (regimenView === 'occasions') {
      // Legacy rotation links = "show me the week" → Regimen tab, week lens.
      setRegimenLens('week');
      setRegimenView('today');
    } else if (regimenView === 'bench') {
      setShelfBenchOnly(true);
      setRegimenView('shelf');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regimenView]);
  return (
<div className="md:max-w-md md:mx-auto pb-6">
  {/* === EDITORIAL HEADER ===
      Eyebrow + serif display. The Shelf "Add Product" CTA moves
      inline to the Shelf view itself instead of living in the global
      page header — keeps the title clean and matches the cover language. */}
  <EditorialPageHeader
    eyebrow="Frida"
    title="Regimen"
    body="What to do today, and how it changes across the week."
    action={() => { setEditingProductId(null); setShowProductModal(true); }}
    actionLabel="Product"
    actionIcon="Plus"
  />

  {/* === Sub-tab toggle (May 2026 — IA pivot) ===
      Order: Today · Rotation · Shelf · Build/Rebuild.
      Build sits LAST as a quiet exit ramp — daily use is on the
      left (Today/Rotation/Shelf), the "I want to change my
      rhythm" surface is on the right. The label is dynamic:
      "Build" for new users (no rhythm yet), "Rebuild" once a
      rhythm exists. The id stays 'build' for both states so all
      existing deep-links/handlers keep working. The legacy
      'occasions' id is preserved → renders Rotation body. */}
  <div className="mb-2.5 md:mb-3">
    {/* === TAB ORDER — June 2026 per Jenni ===
        Moved Refine/Build to position 2 (was last). The "make my
        routine evolve" intent is the second-most-frequent thing
        users come to Regimen for, after checking Today. Putting it
        third or fourth made it feel like an admin / edge surface
        rather than a primary daily-use tool. */}
    {/* === Bench sub-tab added June 2026 (Phase A of Tier C IA cleanup) ===
        Sits between Refine and Rotation — fits the "look at what's not
        actively serving the routine" narrative right after Refine's
        "make the routine better" lens. Replaces what used to live in
        Insights → Picks → Bench. Budget Picks migrates to Bench in
        Phase A.2 (deferred — full Picks scoring engine extraction). */}
    <EditorialSubTabs
      tabs={[
        { id: 'build', label: 'Refine' },
        { id: 'today', label: 'Regimen' },
        { id: 'shelf', label: 'Shelf' },
        { id: 'buildweek', label: 'Build' },
      ]}
      value={regimenView}
      onChange={setRegimenView}
    />
  </div>

  {/* === RITUAL TODAY VIEW (Page 1) ===
      The hero of Ritual. Composed of:
        1. Today's Ritual editorial card — AM + PM thumbnail rows,
           progress ring, Continue CTA, Why-this-today link.
        2. Weekly Rotation card — horizontal day strip Mon→Sun, each
           tile shows hero theme + AM/PM micro icons. TAP A TILE to
           open the magical day-detail bottom sheet (signature UX).
      Data sources are derived from existing state — today's regimenLog
      for what was actually used, active products as fallback, and a
      themed 7-day strip computed from logs + product cadence. No new
      AI calls required for first paint; tap-to-detail can call AI for
      the per-day reasoning if a key is set. */}
  {/* Today branch folded into the Plan surface lenses (July 2026 per Jenni). */}

  {/* === BUILD VIEW ===
      Frida Formulary panel at the top (inline version of the same
      drawer on the Journal page) + the existing RoutineBuilder
      wizard below. Both surfaces share matchesDrawerFilter state so
      pill selection persists across the two views. */}
  {regimenView === 'build' && userHasBuiltPattern(products) && (
    <>
      {/* === LENS TOGGLE (July 2026 per Jenni) === one plan, two views:
          edit-in-place by product, or the calendar week lens (the old
          Rotation surface, folded in — its tab is gone). */}
      <div className="rounded-full flex p-1 gap-1 mb-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {[
          { id: 'week', label: 'Week', icon: 'Calendar' },
          { id: 'product', label: 'Products', icon: 'ListChecks' },
        ].map(t => {
          const active = planLens === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPlanLens(t.id)}
              className="flex-1 rounded-full py-2 px-3 flex items-center justify-center gap-1.5 transition"
              style={{background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--ink-soft)', cursor:'pointer'}}
            >
              <Icon name={t.icon} size={12} style={{color: active ? 'var(--accent)' : 'var(--ink-soft)'}} />
              <span className="text-[10.5px] tracking-[0.22em] uppercase">{t.label}</span>
            </button>
          );
        })}
      </div>
      {planLens === 'week' ? (
        <WeeklyDayEditor
          products={products}
          setProducts={setProducts}
          saveData={saveData}
          setCoverRoutineRebuildToken={setCoverRoutineRebuildToken}
          toast={toast}
        />
      ) : (
      <WeeklyPlanEditor
        products={products}
        setProducts={setProducts}
        saveData={saveData}
        setCoverRoutineRebuildToken={setCoverRoutineRebuildToken}
        toast={toast}
      />
      )}
      <div className="flex justify-center mt-3">
        <button
          type="button"
          onClick={() => setRegimenView('buildweek')}
          className="inline-flex items-center gap-1 transition hover:opacity-70"
          style={{background:'transparent', border:'none', color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', cursor:'pointer', padding:'6px 0'}}
        >
          <span>Rebuild routine</span>
          <Icon name="ArrowRight" size={10} />
        </button>
      </div>
    </>
  )}
  {((regimenView === 'build' && !userHasBuiltPattern(products)) || regimenView === 'buildweek') && (
    <>
      {/* Build is its own tab now (July 2026 per Jenni) — the deep
          assessment lives here; quick edits live on Refine. */}
    <RegimenBuildView
      products={products}
      setProducts={setProducts}
      regimenLogs={regimenLogs}
      setRegimenLogs={setRegimenLogs}
      buildAnswers={buildAnswers}
      setBuildAnswers={setBuildAnswers}
      buildPlan={buildPlan}
      setBuildPlan={setBuildPlan}
      regimenView={regimenView}
      setRegimenView={setRegimenView}
      postAcceptDay={postAcceptDay}
      setPostAcceptDay={setPostAcceptDay}
      homeDevices={homeDevices}
      setHomeDevices={setHomeDevices}
      sensitivities={sensitivities}
      userProfile={userProfile}
      cycleData={cycleData}
      hormonalContext={hormonalContext}
      userConcerns={userConcerns}
      setUserConcerns={setUserConcerns}
      setEditingProductId={setEditingProductId}
      setProductForm={setProductForm}
      setShowProductModal={setShowProductModal}
      setShowProcedureModal={setShowProcedureModal}
      setEditingProcedureId={setEditingProcedureId}
      setShowProfileModal={setShowProfileModal}
      setCoverRoutineRebuildToken={setCoverRoutineRebuildToken}
      saveData={saveData}
      toast={toast}
      buildAddProposal={buildAddProposal}
      setBuildAddProposal={setBuildAddProposal}
      buildAddQueue={buildAddQueue}
      setBuildAddQueue={setBuildAddQueue}
      buildAddSheet={buildAddSheet}
      setBuildAddSheet={setBuildAddSheet}
      buildAddStage={buildAddStage}
      setBuildAddStage={setBuildAddStage}
      buildBudget={buildBudget}
      setBuildBudget={setBuildBudget}
      buildConcernInputOpen={buildConcernInputOpen}
      setBuildConcernInputOpen={setBuildConcernInputOpen}
      buildConcernInputValue={buildConcernInputValue}
      setBuildConcernInputValue={setBuildConcernInputValue}
      buildExperience={buildExperience}
      setBuildExperience={setBuildExperience}
      buildMode={buildMode}
      setBuildMode={setBuildMode}
      buildPlanAccepted={buildPlanAccepted}
      setBuildPlanAccepted={setBuildPlanAccepted}
      buildRebuildSheetOpen={buildRebuildSheetOpen}
      setBuildRebuildSheetOpen={setBuildRebuildSheetOpen}
      buildRefreshNudgeDismissed={buildRefreshNudgeDismissed}
      setBuildRefreshNudgeDismissed={setBuildRefreshNudgeDismissed}
      buildSelectedActives={buildSelectedActives}
      setBuildSelectedActives={setBuildSelectedActives}
      buildStep={buildStep}
      setBuildStep={setBuildStep}
      buildTolerance={buildTolerance}
      setBuildTolerance={setBuildTolerance}
      cancelProposal={cancelProposal}
      closeProposal={closeProposal}
      flipProposalSlot={flipProposalSlot}
      isBuildCardExpanded={isBuildCardExpanded}
      persistentSummaryDay={persistentSummaryDay}
      setPersistentSummaryDay={setPersistentSummaryDay}
      refineMoreOptions={refineMoreOptions}
      setRefineMoreOptions={setRefineMoreOptions}
      runAcceptProposal={runAcceptProposal}
      setAddDeviceSheet={setAddDeviceSheet}
      setAddRxSheet={setAddRxSheet}
      setBuildAddPriorIds={setBuildAddPriorIds}
      setBuildPendingAdd={setBuildPendingAdd}
      setProfileWizardStep={setProfileWizardStep}
      setRefineHowItWorks={setRefineHowItWorks}
      setRefineIntent={setRefineIntent}
      setRefineSheetOpen={setRefineSheetOpen}
      setStartOverConfirmOpen={setStartOverConfirmOpen}
      toggleBuildEditExpand={toggleBuildEditExpand}
      toggleProposalDay={toggleProposalDay}
    />
    </>
  )}

  {/* === REGIMEN TAB (July 2026 per Jenni) === Today's regimen + the
      weekly calendar, as views. Editing lives on Refine. */}
  {regimenView === 'today' && (
    <>
      <div className="rounded-full flex p-1 gap-1 mb-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {[
          { id: 'today', label: 'Today', icon: 'Sun' },
          { id: 'week', label: 'Week', icon: 'Calendar' },
        ].map(t => {
          const active = regimenLens === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setRegimenLens(t.id)}
              className="flex-1 rounded-full py-2 px-3 flex items-center justify-center gap-1.5 transition"
              style={{background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent)' : 'var(--ink-soft)', cursor:'pointer'}}
            >
              <Icon name={t.icon} size={12} style={{color: active ? 'var(--accent)' : 'var(--ink-soft)'}} />
              <span className="text-[10.5px] tracking-[0.22em] uppercase">{t.label}</span>
            </button>
          );
        })}
      </div>
      {regimenLens === 'today' ? (
    <RegimenTodayView
      onEditWeeklyPlan={() => { setPlanLens('week'); setRegimenView('build'); }}
      generatedProductArt={{}}
      buildPlan={buildPlan}
      buildPlanAccepted={buildPlanAccepted}
      products={products}
      regimenLogs={regimenLogs}
      ritualViewDate={ritualViewDate}
      saveData={saveData}
      setCoverRoutineRebuildToken={setCoverRoutineRebuildToken}
      setEditingProductId={setEditingProductId}
      setRegimenLogs={setRegimenLogs}
      setRegimenView={setRegimenView}
      setRitualSlot={setRitualSlot}
      setRitualViewDate={setRitualViewDate}
      setShowProductModal={setShowProductModal}
      toast={toast}
      persistRitualProgress={persistRitualProgress}
      regimenWeekOffset={regimenWeekOffset}
      ritualProgress={ritualProgress}
      ritualSlot={ritualSlot}
      setAddRitualSheet={setAddRitualSheet}
      setRitualSuggestError={setRitualSuggestError}
      setRitualSuggestSelected={setRitualSuggestSelected}
      setRitualSuggestSheet={setRitualSuggestSheet}
      setRitualSuggestToken={setRitualSuggestToken}
      setRitualSuggestion={setRitualSuggestion}
      setShelfQuickAddOpen={setShelfQuickAddOpen}
      setUsedSomethingElseSheet={setUsedSomethingElseSheet}
      setProducts={setProducts}
      setRemoveScopePrompt={setRemoveScopePrompt}
      setExpandedShelfProductId={setExpandedShelfProductId}
      userProfile={userProfile}
    />
      ) : (
        <RegimenOccasionsView
          logs={logs}
          products={products}
          setBuildPlan={setBuildPlan}
          setRegimenView={setRegimenView}
          setShowProductModal={setShowProductModal}
          rotationViewMode={rotationViewMode}
          setRotationViewMode={setRotationViewMode}
          rotationTargetSlot={rotationTargetSlot}
          setRotationTargetSlot={setRotationTargetSlot}
          setBuildPlanAccepted={setBuildPlanAccepted}
          setBuildStep={setBuildStep}
          setWeeklyExpandedDay={setWeeklyExpandedDay}
          weeklyExpandedDay={weeklyExpandedDay}
          setRefineIntent={setRefineIntent}
          setRefineSheetOpen={setRefineSheetOpen}
        />
      )}
    </>
  )}

  {regimenView === 'shelf' && (
    <RegimenShelfView
      benchOnly={shelfBenchOnly}
      setBenchOnly={setShelfBenchOnly}
      generatedProductArt={{}}
      logs={logs}
      openChat={openChat}
      products={products}
      regimenLogs={regimenLogs}
      saveData={saveData}
      setCoverRoutineRebuildToken={setCoverRoutineRebuildToken}
      setEditingProductId={setEditingProductId}
      setProducts={setProducts}
      setShowProductModal={setShowProductModal}
      toast={toast}
      assessProduct={assessProduct}
      assessingProduct={assessingProduct}
      deleteProduct={deleteProduct}
      expandedShelfProductId={expandedShelfProductId}
      setExpandedShelfProductId={setExpandedShelfProductId}
      productAssessment={productAssessment}
      regenerateProductAlternatives={regenerateProductAlternatives}
      setMatchesDrawerFilter={setMatchesDrawerFilter}
      setMatchesDrawerOpen={setMatchesDrawerOpen}
      setOpenLesson={setOpenLesson}
      setProductCompareId={setProductCompareId}
      setShelfTagFilter={setShelfTagFilter}
      setShowInactiveProducts={setShowInactiveProducts}
      showInactiveProducts={showInactiveProducts}
    />
  )}

  {/* Legacy 'ritual' sub-view replaced by 'today' (above) and 'build'.
      Concerns/Sensitivities/Technique blocks below are kept for code-
      preservation but no longer reachable from the 4-tab nav — they
      fold into the Build wizard in Page 3. */}

  {regimenView === 'concerns' && (
    <ConcernGuide onOpenLesson={setOpenLesson} framing="regimen" />
  )}

  {/* Rotation branch removed July 2026 — folded into the plan grid's
      week lens above; 'occasions' deep links redirect via the effect. */}

  {regimenView === 'sensitivities' && (() => {
    const COMMON_TRIGGERS = ['fragrance', 'essential oils', 'denatured alcohol', 'sulfates', 'lanolin', 'formaldehyde releasers', 'AHAs', 'BHAs', 'physical exfoliants', 'retinol', 'high-strength acids', 'methyl/propyl parabens'];
    const addSensitivity = (text) => {
      const v = text.trim().toLowerCase();
      if (!v) return;
      if (sensitivities.includes(v)) return;
      const next = [...sensitivities, v];
      setSensitivities(next);
      saveData('sensitivities', next);
      // Sensitivities are an AI input — regenerate cover Recommended.
      setCoverRoutineRebuildToken(t => t + 1);
    };
    const removeSensitivity = (s) => {
      const next = sensitivities.filter(x => x !== s);
      setSensitivities(next);
      saveData('sensitivities', next);
      setCoverRoutineRebuildToken(t => t + 1);
    };
    return (
      <div className="space-y-6">
        <div className="border p-5 md:p-6" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
          <div className="text-[9px] tracking-[0.3em] uppercase mb-2 flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
            Why this matters
          </div>
          <p className="text-sm font-light leading-relaxed" style={{color:'var(--ink)'}}>
            Anything you list here is fed into AI photo and product analysis. If a product contains a trigger, you'll get flagged. If your skin reacts on a logged day, the AI will look here first.
          </p>
        </div>

        {/* Add new */}
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Add a sensitivity</div>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.target); addSensitivity(fd.get('s') || ''); e.target.reset(); }} className="flex gap-2">
            <input autoCapitalize="off" autoCorrect="off" spellCheck={false} name="s" placeholder="e.g. fragrance, AHA, lanolin, salicylic acid" className={inputCls + ' flex-1'} />
            <button type="submit" className="px-4 tracking-[0.18em] text-[10px] uppercase border whitespace-nowrap transition flex items-center gap-1.5" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
              <Icon name="Plus" size={12} /> Add
            </button>
          </form>
        </div>

        {/* Common quick-pick chips */}
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Common triggers — tap to add</div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_TRIGGERS.map(t => {
              const already = sensitivities.includes(t);
              return (
                <button key={t} disabled={already} onClick={() => addSensitivity(t)} className="text-[10px] tracking-[0.1em] px-2.5 py-1 border rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed" style={{borderColor: 'var(--line)', color: already ? 'var(--ink-soft)' : 'var(--ink)', background:'var(--cream)'}}>
                  {already ? '✓ ' : '+ '}{t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current list */}
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase mb-2 border-b pb-2" style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}>Your list ({sensitivities.length})</div>
          {sensitivities.length === 0 ? (
            <p className="text-sm font-light" style={{color:'var(--ink-soft)'}}>Nothing flagged yet. Add anything that's burned, stung, or broken you out.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sensitivities.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 border rounded-full" style={{borderColor: 'var(--line)', color:'var(--accent)', background:'var(--cream)'}}>
                  {s}
                  <button onClick={() => removeSensitivity(s)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${s}`}>
                    <Icon name="X" size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Conflict report — products on shelf that contain known triggers */}
        {sensitivities.length > 0 && products.length > 0 && (() => {
          const flagged = products.filter(p => {
            const haystack = `${p.name || ''} ${p.activeIngredients || ''} ${p.mainIngredients || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
            return sensitivities.some(s => haystack.includes(s));
          });
          return flagged.length > 0 ? (
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase mb-2 border-b pb-2 flex items-center gap-2" style={{color:'var(--accent)', borderColor: 'var(--line)'}}>
                <Icon name="AlertTriangle" size={11} /> Products on your shelf that touch these triggers
              </div>
              <div className="space-y-2">
                {flagged.map(p => {
                  const haystack = `${p.name || ''} ${p.activeIngredients || ''} ${p.mainIngredients || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
                  const matches = sensitivities.filter(s => haystack.includes(s));
                  return (
                    <div key={p.id} className="border p-3" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                      <div className="flex justify-between items-baseline gap-2 flex-wrap">
                        <div>
                          <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{p.brand}</div>
                          <div className="font-sans text-sm" style={{color:'var(--ink)'}}>{p.name}</div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {matches.map(m => (
                            <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background:'var(--accent)', color:'var(--cream)'}}>{m}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}
      </div>
    );
  })()}

  {regimenView === 'technique' && (
    <RegimenTechnique onOpenLesson={setOpenLesson} />
  )}

  {/* === BENCH — June 2026 Phase A of Tier C IA cleanup ===
      The new canonical home for "what's on my shelf I'm not using":
      Unused (owned products not in built routine) + Overlap (products
      sharing an active family with something already active). Pulls from
      computeBench (src/resolvers/benchResolvers.js) which both this view
      and the legacy Pearls/Picks/bench render call — so behavior stays
      in lockstep during the migration.

      Budget Picks (drugstore-tier matches) is NOT here yet — it depends
      on the full Picks scoring engine which is a bigger extraction.
      Phase A.2 will lift Budget once that lift happens. Until then a
      footer note points to the Insights/Picks/Budget location. */}
  {regimenView === 'bench' && (() => {
    const { unusedProducts, overlapGroups, benchCount } = (typeof computeBench === 'function')
      ? computeBench({ products })
      : { unusedProducts: [], overlapGroups: [], benchCount: 0 };
    // June 2026 Phase A.2 — budget picks for the Bench surface. Uses
    // userProfile.actionGoal as the action filter (so picks line up with
    // the user's stated goal) and userConcerns as the concern set.
    const budgetPicks = (typeof computeBudgetPicks === 'function')
      ? computeBudgetPicks({
          userConcerns: userConcerns || [],
          actionFilter: (userProfile?.actionGoal || 'all'),
          limit: 6,
        })
      : [];
    return (
      <div className="md:max-w-md md:mx-auto pb-6">
        <div className="rounded-[14px] border p-3" style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] tracking-[0.25em] uppercase" style={{color:'var(--accent)', fontWeight:650}}>Bench</div>
              <div className="text-[12px] mt-1 leading-snug" style={{color:'var(--ink-soft)'}}>Products on the bench — not currently in your routine, or overlapping something active.</div>
            </div>
            <span className="rounded-full border px-3 py-1.5 text-[9px] tracking-[0.14em] uppercase flex-shrink-0" style={{borderColor: 'var(--line)', color:'var(--ink-soft)', background:'var(--cream-deep)', fontWeight:700}}>
              {benchCount || 'Clear'}
            </span>
          </div>

          {/* === Unused — owned but not in built routine === */}
          <div className="text-[9px] tracking-[0.22em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:700}}>Unused — owned but not in routine</div>
          <div className="space-y-2 mb-4">
            {unusedProducts.length === 0 ? (
              <div className="rounded-[12px] border p-3 text-[12px] leading-snug" style={{borderColor: 'var(--line)', background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                Every owned product is already scheduled in your routine.
              </div>
            ) : (
              unusedProducts.slice(0, 8).map(p => {
                const fam = (typeof benchProductFamily === 'function') ? benchProductFamily(p) : 'product';
                const tier = p.priceTier || (typeof productTier === 'function' ? productTier(p) : '') || '$$';
                return (
                  <div key={p.id || `${p.brand}-${p.name}`} className="rounded-[14px] border p-3 flex items-start justify-between gap-3" style={{borderColor: 'var(--line)', background:'var(--cream-deep)'}}>
                    <div className="min-w-0">
                      <div className="text-[9px] tracking-[0.22em] uppercase mb-0.5" style={{color:'var(--ink-soft)'}}>{p.brand || fam}</div>
                      <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:650}}>{p.name || p.displayName}</div>
                      <span className="inline-flex mt-2 text-[8.5px] tracking-[0.13em] uppercase rounded-full border px-2 py-0.5" style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}>{fam}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="text-[11px] tracking-[0.18em] uppercase" style={{color:'var(--accent)', fontWeight:700}}>{tier}</div>
                      <button
                        type="button"
                        onClick={() => setRegimenView('build')}
                        className="text-[9px] tracking-[0.16em] uppercase rounded-full border px-2.5 py-1"
                        style={{borderColor: 'var(--accent)', color:'var(--accent)', background:'var(--cream)', fontWeight:700}}
                      >
                        Add to routine
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* === Overlap — products that share an active family === */}
          <div className="text-[9px] tracking-[0.22em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:700}}>Overlapping with active products</div>
          {overlapGroups.length === 0 ? (
            <div className="rounded-[12px] border p-3 text-[12px] leading-snug" style={{borderColor: 'var(--line)', background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
              No obvious duplicate lanes. Your current routine is not repeating the same job heavily.
            </div>
          ) : (
            <div className="space-y-2">
              {overlapGroups.slice(0, 8).map(group => (
                <div key={group.family} className="rounded-[14px] border p-3" style={{borderColor: 'var(--line)', background:'var(--cream-deep)'}}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="text-[8.5px] tracking-[0.2em] uppercase" style={{color:'var(--accent)', fontWeight:700}}>Repeated lane</div>
                      <div className="text-[13px] leading-tight mt-0.5" style={{color:'var(--ink)', fontWeight:700}}>{group.label}</div>
                    </div>
                    <span className="text-[8.5px] tracking-[0.14em] uppercase rounded-full border px-2 py-1 flex-shrink-0" style={{borderColor: 'var(--line)', color:'var(--ink-soft)', background:'var(--cream)'}}>{group.items.length} products</span>
                  </div>
                  <div className="space-y-1.5">
                    {group.items.slice(0, 4).map(p => (
                      <div key={p.id || `${p.brand}-${p.name}`} className="rounded-[10px] border px-2.5 py-2" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                        <div className="text-[8px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>{p.brand || group.label}</div>
                        <div className="text-[11.5px] leading-tight mt-0.5" style={{color:'var(--ink)', fontWeight:650}}>{p.name || p.displayName}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10.5px] leading-snug mt-2" style={{color:'var(--ink-soft)'}}>
                    Decide whether each product has a different timing, texture, or purpose. If not, one can probably rotate out.
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === Budget Picks (Phase A.2 — June 2026) ===
              Drugstore-tier ($) catalog matches scored against the user's
              actionGoal + observed concerns. Pulled from computeBudgetPicks
              (src/resolvers/budgetResolvers.js). Same engine the legacy
              Pearls/Picks/Budget view uses, behavior-identical so the
              Phase C deletion is safe. Derm endorsements (when present)
              render as a compact eyebrow chip above brand. */}
          <div className="text-[9px] tracking-[0.22em] uppercase mt-4 mb-2" style={{color:'var(--ink-soft)', fontWeight:700}}>Budget picks — drugstore-tier matches</div>
          {budgetPicks.length === 0 ? (
            <div className="rounded-[12px] border p-3 text-[12px] leading-snug" style={{borderColor: 'var(--line)', background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
              No drugstore-tier matches for your current goal + concerns yet.
            </div>
          ) : (
            <div className="space-y-2">
              {budgetPicks.map((p, i) => {
                const dermChip = p.derm_endorsement && (typeof compactDermLabel === 'function')
                  ? compactDermLabel(p.derm_endorsement)
                  : null;
                const concernLabel = (p._concernHits || [])[0];
                const actionLabel = (p._tags && p._tags[0])
                  ? ({ repair:'Barrier', calm:'Calm', hydrate:'Hydration', brighten:'Pigment', exfoliate:'Texture' })[p._tags[0]] || 'Budget'
                  : 'Budget';
                return (
                  <div key={`budget-${p.brand}-${p.name}-${i}`} className="rounded-[14px] border p-3" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {dermChip && (
                          <div className="inline-flex items-center rounded-full px-2 py-0.5 mb-1 text-[8.5px] tracking-[0.14em] uppercase" style={{background:'var(--surface-selected-soft)', color:'var(--accent)', fontWeight:700}}>{dermChip}</div>
                        )}
                        <div className="text-[8.5px] tracking-[0.22em] uppercase mb-0.5" style={{color:'var(--accent)', fontWeight:700}}>{actionLabel}{concernLabel ? ` · ${concernLabel}` : ''}</div>
                        <div className="text-[8.5px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{p.brand}</div>
                        <div className="text-[13px] leading-tight mt-0.5" style={{color:'var(--ink)', fontWeight:700}}>{p.name}</div>
                        <div className="text-[10.5px] mt-1 leading-snug" style={{color:'var(--ink-soft)'}}>{p.actives || p.main || p.category}</div>
                        {p.evidence_tier && (
                          <div className="text-[9.5px] mt-1.5" style={{color:'var(--ink-soft)'}}>{String(p.evidence_tier).replace(/-/g, ' ')}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="rounded-full px-2.5 py-1 text-[8.5px] tracking-[0.14em] uppercase whitespace-nowrap" style={{background:'var(--accent)', color:'var(--cream)', fontWeight:700}}>Budget pick · $</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  })()}
</div>
  );
};
