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
  procedures,
  regimenLogs, setRegimenLogs,
  buildAnswers, setBuildAnswers,
  buildPlan, setBuildPlan,
  regimenView, setRegimenView,
  postAcceptDay, setPostAcceptDay,
  generatedProductArt,
  homeDevices, setHomeDevices,
  sensitivities, setSensitivities,
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
  setWeeklyExpandedDay, weeklyExpandedDay,
}) => (
<div className="md:max-w-md md:mx-auto pb-6">
  {/* === EDITORIAL HEADER ===
      Eyebrow + serif italic display. The Shelf "Add Product" CTA moves
      inline to the Shelf view itself instead of living in the global
      page header — keeps the title clean and matches the cover language. */}
  <EditorialPageHeader
    eyebrow="Étude"
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
  <div className="mb-4 md:mb-3">
    <EditorialSubTabs
      tabs={[
        { id: 'today', label: 'Today' },
        { id: 'occasions', label: 'Rotation' },
        { id: 'shelf', label: 'Shelf' },
        { id: 'build', label: userHasBuiltPattern(products) ? 'Refine' : 'Build' },
      ]}
      value={regimenView}
      onChange={setRegimenView}
    />
  </div>

  {/* === RITUAL TODAY VIEW (Page 1) ===
      The hero of Ritual. Composed of:
        1. Today's Ritual editorial card — AM + PM thumbnail rows,
           progress ring, Continue CTA, Why-this-today italic link.
        2. Weekly Rotation card — horizontal day strip Mon→Sun, each
           tile shows hero theme + AM/PM micro icons. TAP A TILE to
           open the magical day-detail bottom sheet (signature UX).
      Data sources are derived from existing state — today's regimenLog
      for what was actually used, active products as fallback, and a
      themed 7-day strip computed from logs + product cadence. No new
      AI calls required for first paint; tap-to-detail can call AI for
      the per-day reasoning if a key is set. */}
  {regimenView === 'today' && (
    <RegimenTodayView
      generatedProductArt={{}}
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
    />
  )}

  {/* === BUILD VIEW ===
      Étude Formulary panel at the top (inline version of the same
      drawer on the Journal page) + the existing RoutineBuilder
      wizard below. Both surfaces share matchesDrawerFilter state so
      pill selection persists across the two views. */}
  {regimenView === 'build' && (
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
  )}

  {regimenView === 'shelf' && (
    <RegimenShelfView
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

  {regimenView === 'occasions' && (
    <RegimenOccasionsView
      logs={logs}
      products={products}
      setBuildPlan={setBuildPlan}
      setRegimenView={setRegimenView}
      setShowProductModal={setShowProductModal}
      rotationViewMode={rotationViewMode}
      setRotationViewMode={setRotationViewMode}
      setBuildPlanAccepted={setBuildPlanAccepted}
      setBuildStep={setBuildStep}
      setWeeklyExpandedDay={setWeeklyExpandedDay}
      weeklyExpandedDay={weeklyExpandedDay}
      setRefineIntent={setRefineIntent}
      setRefineSheetOpen={setRefineSheetOpen}
    />
  )}

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
        <div className="border p-5 md:p-6" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
          <div className="text-[9px] tracking-[0.3em] uppercase mb-2 flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
            Why this matters
          </div>
          <p className="text-sm font-light italic leading-relaxed" style={{color:'var(--ink)'}}>
            Anything you list here is fed into AI photo and product analysis. If a product contains a trigger, you'll get flagged. If your skin reacts on a logged day, the AI will look here first when deciding what's likely the culprit.
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
                <button key={t} disabled={already} onClick={() => addSensitivity(t)} className="text-[10px] tracking-[0.1em] px-2.5 py-1 border rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed" style={{borderColor:'var(--line)', color: already ? 'var(--ink-soft)' : 'var(--ink)', background:'var(--cream)'}}>
                  {already ? '✓ ' : '+ '}{t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current list */}
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase mb-2 border-b pb-2" style={{color:'var(--ink-soft)', borderColor:'var(--line)'}}>Your list ({sensitivities.length})</div>
          {sensitivities.length === 0 ? (
            <p className="text-sm font-light italic" style={{color:'var(--ink-soft)'}}>Nothing flagged yet. Add anything that's burned, stung, or broken you out.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sensitivities.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 border rounded-full" style={{borderColor:'var(--accent)', color:'var(--accent)', background:'var(--cream)'}}>
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
              <div className="text-[10px] tracking-[0.2em] uppercase mb-2 border-b pb-2 flex items-center gap-2" style={{color:'var(--accent)', borderColor:'var(--line)'}}>
                <Icon name="AlertTriangle" size={11} /> Products on your shelf that touch these triggers
              </div>
              <div className="space-y-2">
                {flagged.map(p => {
                  const haystack = `${p.name || ''} ${p.activeIngredients || ''} ${p.mainIngredients || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
                  const matches = sensitivities.filter(s => haystack.includes(s));
                  return (
                    <div key={p.id} className="border p-3" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
                      <div className="flex justify-between items-baseline gap-2 flex-wrap">
                        <div>
                          <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{p.brand}</div>
                          <div className="font-serif italic text-sm" style={{color:'var(--ink)'}}>{p.name}</div>
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
</div>
);
