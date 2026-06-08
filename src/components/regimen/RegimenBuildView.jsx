// === RegimenBuildView (Wave 8.1a extract — May 2026) ===
// The Build/Refine sub-view of RegimenView. Includes the build wizard
// (concerns → actives → tolerance → budget → home devices → anchors),
// the final plan view, the refine page (post-accept), and the expert
// editor. ~2250 lines lifted from RegimenView.jsx.
//
// Mounted by RegimenView when `regimenView === 'build'`. Receives all
// the App-scope state + setters it needs as props (forwarded from the
// outer RegimenView prop bridge).

const RegimenBuildView = ({
  products, setProducts,
  regimenLogs, setRegimenLogs,
  buildAnswers, setBuildAnswers,
  buildPlan, setBuildPlan,
  regimenView, setRegimenView,
  postAcceptDay, setPostAcceptDay,
  homeDevices, setHomeDevices,
  sensitivities,
  userProfile,
  cycleData,
  hormonalContext,
  userConcerns, setUserConcerns,
  setEditingProductId,
  setProductForm,
  setShowProductModal,
  setShowProcedureModal,
  setEditingProcedureId,
  setShowProfileModal,
  setCoverRoutineRebuildToken,
  saveData,
  toast,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
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
  toggleProposalDay}) => {
  return (() => {
  // === BUILD WIZARD (sequential, May 2026) ===
  // Seven sequential steps → one final weekly plan. Each step
  // owns its own screen; Back / Continue navigate between them.
  // The final plan view shows a compact summary of selections
  // (only what was picked, not the full library) and an
  // explicit Accept / Rebuild path.
  //   Step 1: Action goal (May 2026 — adds direction to the plan)
  //   Step 2: Concerns
  //   Step 3: Actives the user wants to use
  //   Step 4: Tolerance for irritating actives
  //   Step 5: Budget
  //   Step 6: Home devices (May 2026 — derm pass)
  //   Step 7: Anchor basics check
  //   → Plan view (after final step)
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Single-select action goal: anchors the rest of the wizard
  // and biases scheduling toward the user's primary intent.
  const ACTION_GOALS = [
    { id: 'BARRIER',    label: 'Barrier',     sub: 'Repair sensitive, reactive skin' },
    { id: 'CALM',       label: 'Calm',        sub: 'Quiet redness and inflammation' },
    { id: 'HYDRATION',  label: 'Hydration',   sub: 'Lock in moisture, prevent flakiness' },
    { id: 'PIGMENT',    label: 'Pigment',     sub: 'Even tone, reduce dark spots' },
    { id: 'PIH',        label: 'Dark spots (PIH)', sub: 'Post-inflammatory hyperpigmentation — azelaic, tranexamic, tinted SPF' },
    { id: 'TEXTURE',    label: 'Texture',     sub: 'Smooth roughness and bumps' },
    { id: 'ACNE',       label: 'Acne',        sub: 'Adapalene + BPO + niacinamide for active breakouts' },
    { id: 'AGING',      label: 'Photoaging',  sub: 'Vit C, retinoid, peptides — anti-trend evidence stack' },
    { id: 'ROSACEA',    label: 'Rosacea / flush', sub: 'Azelaic + barrier + mineral SPF' },
    { id: 'SEBORRHEIC', label: 'Oily / breakout-prone', sub: 'BHA + niacinamide + gel cream' },
  ];
  const COMMON_CONCERNS = ['pigmentation', 'acne', 'texture', 'fine lines', 'sensitivity', 'dryness', 'dullness', 'redness', 'oiliness', 'aging'];
  // 15 most common actives, mapped to family IDs the generator
  // understands. Some families have multiple representative
  // members (e.g. glycolic + lactic both → aha).
  const COMMON_ACTIVES = [
    { id: 'niacinamide', label: 'Niacinamide' },
    { id: 'vitc',        label: 'Vitamin C' },
    { id: 'retinoid',    label: 'Retinol' },
    { id: 'humectant',   label: 'Hyaluronic Acid' },
    { id: 'bha',         label: 'Salicylic Acid' },
    { id: 'aha-glycolic',label: 'Glycolic Acid' },
    { id: 'aha-lactic',  label: 'Lactic Acid' },
    { id: 'azelaic',     label: 'Azelaic Acid' },
    { id: 'bpo',         label: 'Benzoyl Peroxide' },
    { id: 'arbutin',     label: 'Alpha Arbutin' },
    { id: 'tranexamic',  label: 'Tranexamic Acid' },
    { id: 'peptide',     label: 'Peptides' },
    { id: 'ceramide',    label: 'Ceramides' },
    { id: 'centella',    label: 'Centella' },
    { id: 'bakuchiol',   label: 'Bakuchiol' },
  ];
  const BASIC_RECOMMENDATIONS = {
    cleanser: [
      { brand: 'CeraVe', name: 'Hydrating Cleanser', priceLevel: 1, note: 'gentle cream cleanse' },
      { brand: 'La Roche-Posay', name: 'Toleriane Hydrating Cleanser', priceLevel: 2, note: 'barrier-safe daily wash' },
      { brand: 'Vanicream', name: 'Gentle Facial Cleanser', priceLevel: 1, note: 'plain, low-drama' },
    ],
    moisturizer: [
      { brand: 'Vanicream', name: 'Daily Facial Moisturizer', priceLevel: 1, note: 'light barrier support' },
      { brand: 'La Roche-Posay', name: 'Toleriane Double Repair', priceLevel: 2, note: 'ceramide + niacinamide' },
      { brand: 'Aveeno', name: 'Calm + Restore Oat Gel', priceLevel: 2, note: 'light, calming gel' },
    ],
    spf: [
      { brand: 'Vanicream', name: 'Mineral Facial SPF 30', priceLevel: 1, note: 'sensitive-skin mineral' },
      { brand: 'Beauty of Joseon', name: 'Relief Sun SPF50+', priceLevel: 2, note: 'soft, everyday finish' },
      { brand: 'La Roche-Posay', name: 'Anthelios Melt-In Milk SPF 60', priceLevel: 2, note: 'classic high protection' },
    ]};
  const priceMarks = (level) => String.fromCharCode(36).repeat(Math.max(1, Math.min(3, Number(level) || 1)));
  const getBasicsBuckets = () => {
    const active = (products || []).filter(p => !p.endDate);
    return {
      cleanser: active.filter(p => normalizeProductCategory(p.category) === 'cleanser'),
      moisturizer: active.filter(p => normalizeProductCategory(p.category) === 'moisturizer'),
      spf: active.filter(p => normalizeProductCategory(p.category) === 'spf')};
  };
  const getMissingBasics = () => {
    const buckets = getBasicsBuckets();
    return [
      { id: 'cleanser', label: 'Cleanser', list: buckets.cleanser },
      { id: 'moisturizer', label: 'Moisturizer', list: buckets.moisturizer },
      { id: 'spf', label: 'SPF', list: buckets.spf },
    ].filter(row => row.list.length === 0);
  };
  const toggleActive = (id) => {
    setBuildSelectedActives(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleConcern = (c) => {
    const k = c.toLowerCase();
    const exists = (userConcerns || []).some(x => x.toLowerCase() === k);
    const next = exists
      ? (userConcerns || []).filter(x => x.toLowerCase() !== k)
      : [...(userConcerns || []), c];
    setUserConcerns(next);
    saveData('userConcerns', next).catch(() => {});
  };
  const addCustomConcern = (raw) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return;
    if (!(userConcerns || []).some(x => x.toLowerCase() === trimmed.toLowerCase())) {
      const next = [...(userConcerns || []), trimmed];
      setUserConcerns(next);
      saveData('userConcerns', next).catch(() => {});
    }
    setBuildConcernInputValue('');
    setBuildConcernInputOpen(false);
  };
  // runGenerator accepts optional overrides so Refresh can replay
  // saved answers without waiting for setState to settle. When
  // called without args, reads from current wizard state (the
  // normal wizard "Finish" path).
  const runGenerator = (overrides = {}) => {
    const plan = generateBuildPlan({
      products,
      concerns: overrides.concerns || userConcerns || [],
      tolerance: overrides.tolerance || buildTolerance,
      selectedActives: overrides.selectedActives !== undefined ? overrides.selectedActives : Array.from(buildSelectedActives),
      homeDevices: overrides.homeDevices || homeDevices || [],
      experience: overrides.experience || buildExperience || 'medium',
      actionGoal: overrides.actionGoal || (buildAnswers && buildAnswers.actionGoal) || null,
      // Optional safety-filter inputs — filters silently no-op when
      // these are missing (props not yet threaded from App).
      userProfile: overrides.userProfile || (typeof userProfile !== 'undefined' ? userProfile : null),
      sensitivities: overrides.sensitivities || (typeof sensitivities !== 'undefined' ? sensitivities : null),
      cycleData: overrides.cycleData || (typeof cycleData !== 'undefined' ? cycleData : null)});
    setBuildPlan(plan);
    setBuildPlanAccepted(false);
  };
  const missingBasics = getMissingBasics();
  const needsBasicsStep = missingBasics.length > 0;
  // +1 vs prior: new Step 1 (Action goal) shifts everything by one.
  const finalBuildStep = needsBasicsStep ? 7 : 6;
  useEffect(() => {
    if (!buildPlan && buildMode === 'guided' && buildStep > finalBuildStep) {
      setBuildStep(finalBuildStep);
    }
  }, [buildPlan, buildMode, buildStep, finalBuildStep, setBuildStep]);

  // === ROUTINE PREVIEW MODAL (May 30 2026 per Jenni) ===
  // Build + Refine pages stay clean — the final routine renders in a
  // modal. Two ways to open it:
  //   1. Always-visible "See full routine" button (top of the page)
  //   2. Quiet "Plan updated · view routine" banner that fades in for
  //      ~7s after buildPlan changes from a refinement or rebuild.
  // Detection uses a slot+day signature so day/time tweaks count as
  // updates but the very first plan generation doesn't (avoids a
  // confusing banner during the initial wizard flow).
  const [routinePreviewOpen, setRoutinePreviewOpen] = useState(false);
  const [planJustUpdated, setPlanJustUpdated] = useState(false);
  // === Multi-select Quick Refinements (June 2026 per Jenni) ===
  // User picks up to 3 focuses (e.g. Barrier + Pores + Hydration) then
  // taps "Run refinement" which fires one combined prompt. Cap at 3 so
  // the refinement stays focused — beyond 3 the LLM loses tight intent
  // and the cards re-stack as a generic "fix everything" pass.
  const [quickRefineSelected, setQuickRefineSelected] = useState([]);
  const toggleQuickRefine = (id) => {
    setQuickRefineSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) {
        if (typeof toast === 'function') toast('Pick up to 3 focuses', 'info');
        return prev;
      }
      return [...prev, id];
    });
  };
  // Move a focus up or down in the priority list. June 2026 per Jenni:
  // tap-order sets initial rank; explicit ↑/↓ buttons let users reorder
  // after the fact (e.g. realize Barrier should be #1 instead of Aging).
  const moveQuickRefine = (idx, dir) => {
    setQuickRefineSelected(prev => {
      const j = idx + (dir === 'up' ? -1 : 1);
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const planSigRef = useRef(null);
  useEffect(() => {
    const sig = (() => {
      if (!buildPlan) return '';
      // === T4 FIX (May 2026) ===
      // Old sig was slotted-only — basics-only refines (no slotted
      // actives) had an empty sig forever, so the "Plan updated"
      // banner never fired after basics changes. Now we include
      // missingBasics count + per-day AM/PM ID lists so any change
      // to the plan surface flips the signature.
      const slottedSig = Array.isArray(buildPlan.slotted)
        ? buildPlan.slotted.map(s => `${s.product && s.product.id}|${s.am?1:0}|${s.pm?1:0}|${(s.days||[]).join(',')}`).join(';')
        : '';
      const mb = Array.isArray(buildPlan.missingBasics) ? buildPlan.missingBasics.length : 0;
      const amSig = Array.from({ length: 7 }, (_, d) => ((buildPlan.am || {})[d] || []).join(',')).join('|');
      const pmSig = Array.from({ length: 7 }, (_, d) => ((buildPlan.pm || {})[d] || []).join(',')).join('|');
      return `slot:${slottedSig}#mb:${mb}#am:${amSig}#pm:${pmSig}`;
    })();
    // Bug #10 fix (May 2026): gate the "Plan updated" banner on
    // buildPlanAccepted. Every runGenerator() flips the sig, so the
    // banner used to fire on initial wizard generation too (e.g. user
    // hits Back, re-finishes). Now: silently track the sig while the
    // plan is unaccepted, only fire the banner AFTER acceptance when
    // a subsequent change lands.
    if (!buildPlanAccepted) {
      planSigRef.current = sig;
      return;
    }
    if (planSigRef.current !== null && planSigRef.current !== sig && sig) {
      setPlanJustUpdated(true);
      const t = setTimeout(() => setPlanJustUpdated(false), 7000);
      planSigRef.current = sig;
      return () => clearTimeout(t);
    }
    planSigRef.current = sig;
  }, [buildPlan, buildPlanAccepted]);

  const goNext = () => {
    if (buildStep < finalBuildStep) setBuildStep(s => s + 1);
    else runGenerator();
  };
  const goBack = () => setBuildStep(s => Math.max(1, s - 1));
  const rebuildFromStart = () => {
    // === T1 FIX (May 2026) ===
    // Was: silent clear. Now: route through the App-scope
    // startOverConfirmOpen modal so the user gets an explicit
    // confirmation dialog before the plan is wiped. That modal
    // owns the clearing path AND fires a toast on commit, so
    // we just open it here. Fallback to window.confirm if the
    // prop setter isn't threaded (shouldn't happen, defensive).
    if (typeof setStartOverConfirmOpen === 'function') {
      setStartOverConfirmOpen(true);
      return;
    }
    if (typeof window !== 'undefined' && window.confirm && !window.confirm('Clear your current plan and start fresh?')) {
      return;
    }
    setBuildPlan(null);
    setBuildPlanAccepted(false);
    setBuildStep(1);
    try { toast('Plan cleared — start fresh', 'info'); } catch {}
  };
  // === Rebuild cadence helpers (May 2026) ===
  // Three flavors of "rebuild" once a plan has been accepted:
  // Refresh = 1-tap, replay saved answers; Tweak = pre-fill the
  // wizard with last answers; Start fresh = blank wizard.
  const applyAnswersToWizardState = (a) => {
    if (!a) return;
    if (Array.isArray(a.actives)) setBuildSelectedActives(new Set(a.actives));
    if (a.tolerance) setBuildTolerance(a.tolerance);
    if (a.experience) setBuildExperience(a.experience);
    if (a.budget) setBuildBudget(a.budget);
  };
  const refreshRhythm = () => {
    if (!buildAnswers) {
      setBuildMode('guided'); setBuildStep(1);
      return;
    }
    applyAnswersToWizardState(buildAnswers);
    // Pass the saved answers directly so we don't depend on
    // setState batching. concerns + devices come from App state
    // but we prefer the saved snapshot if available.
    runGenerator({
      concerns: Array.isArray(buildAnswers.concerns) && buildAnswers.concerns.length > 0 ? buildAnswers.concerns : (userConcerns || []),
      tolerance: buildAnswers.tolerance,
      selectedActives: Array.isArray(buildAnswers.actives) ? buildAnswers.actives : [],
      homeDevices: Array.isArray(buildAnswers.devices) ? buildAnswers.devices : (homeDevices || []),
      experience: buildAnswers.experience || 'medium'});
    setBuildPlanAccepted(false);
    toast('Routine refreshed — review and accept.', 'info');
  };
  const tweakAnswers = () => {
    if (buildAnswers) applyAnswersToWizardState(buildAnswers);
    setBuildPlan(null);
    setBuildPlanAccepted(false);
    setBuildMode('guided');
    setBuildStep(1);
  };
  const startFreshWizard = () => {
    setBuildSelectedActives(new Set());
    setBuildTolerance('standard');
    setBuildExperience('medium');
    setBuildBudget('mix');
    setBuildPlan(null);
    setBuildPlanAccepted(false);
    setBuildMode('guided');
    setBuildStep(1);
  };
  // Days since last build — drives the 4-week soft prompt and chip.
  const daysSinceLastBuild = (() => {
    if (!buildAnswers || !buildAnswers.lastBuiltAt) return null;
    const then = new Date(buildAnswers.lastBuiltAt);
    if (isNaN(then.getTime())) return null;
    const ms = Date.now() - then.getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  })();
  const lastBuiltLabel = (() => {
    if (daysSinceLastBuild === null) return null;
    if (daysSinceLastBuild === 0) return 'today';
    if (daysSinceLastBuild === 1) return 'yesterday';
    if (daysSinceLastBuild < 7) return `${daysSinceLastBuild}d ago`;
    const weeks = Math.floor(daysSinceLastBuild / 7);
    if (weeks === 1) return '1 wk ago';
    if (weeks < 8) return `${weeks} wks ago`;
    const months = Math.floor(daysSinceLastBuild / 30);
    return months === 1 ? '1 mo ago' : `${months} mo ago`;
  })();
  const showRefreshNudge = daysSinceLastBuild !== null && daysSinceLastBuild >= 28;
  // For Final summary: friendly label lookup for actives by id
  const activeLabelFor = (id) => (COMMON_ACTIVES.find(a => a.id === id) || {}).label || id;
  const acceptPlan = () => {
    if (!buildPlan) return;
    // === COMPREHENSIVE PLAN COMMIT (May 2026) ===
    // Derive each product's day-pattern + AM/PM directly from
    // the buildPlan's am/pm day arrays — NOT just the slotted
    // actives list. This is critical: basics (cleansers,
    // moisturizers, SPF, etc.) are pushed into buildPlan.am[d]
    // and buildPlan.pm[d] but NEVER into buildPlan.slotted
    // (only actives live there). Without this, basics never
    // got useTimes set, which made them fail the strict
    // productIsInBuiltRoutine check and disappear from Today.
    //
    // Build per-product Sets of am-days and pm-days from the
    // plan, then write cadence (union of am+pm days) + useTimes
    // (which slots appeared at all) for every product that
    // shows up anywhere in the plan.
    const productAmDays = new Map();  // productId → Set<dayIdx>
    const productPmDays = new Map();
    for (let d = 0; d < 7; d++) {
      ((buildPlan.am || {})[d] || []).forEach(id => {
        if (!productAmDays.has(id)) productAmDays.set(id, new Set());
        productAmDays.get(id).add(d);
      });
      ((buildPlan.pm || {})[d] || []).forEach(id => {
        if (!productPmDays.has(id)) productPmDays.set(id, new Set());
        productPmDays.get(id).add(d);
      });
    }
    const inPlanIds = new Set([...productAmDays.keys(), ...productPmDays.keys()]);
    const updated = (products || []).map(p => {
      if (!inPlanIds.has(p.id)) {
        // === STALE-CADENCE FIX (May 2026 cap bug) ===
        // Product NOT included in this new plan. Clear any
        // prior cadence + useTimes from previous builds so it
        // doesn't continue to appear in Today's regimen via
        // getProductsForTodayFromPattern. Without this clear,
        // products from older plans accumulate and the daily
        // routine exceeds CATEGORY_CAPS / SLOT_TOTAL_CAP.
        // User can still re-add manually after Build.
        return sanitizeProductForSave({
          ...p,
          cadence: undefined,
          useTimes: [],
          routineManaged: false});
      }
      const amDays = productAmDays.get(p.id) || new Set();
      const pmDays = productPmDays.get(p.id) || new Set();
      const nextUseTimes = [];
      if (amDays.size > 0) nextUseTimes.push('am');
      if (pmDays.size > 0) nextUseTimes.push('pm');
      const allDays = Array.from(new Set([...amDays, ...pmDays])).sort((a, b) => a - b);
      return sanitizeProductForSave({
        ...p,
        cadence: { days: allDays, frequency: allDays.length },
        useTimes: nextUseTimes,
        routineManaged: true});
    });
    setProducts(updated);
    // === T2 FIX (May 2026) ===
    // Wrap each saveData in its own try/catch so a single
    // persistence rejection no longer corrupts the rest of the
    // accept flow (shelf vs today vs answers used to silently
    // diverge if the middle write failed). Each branch surfaces
    // the same toast and logs the error.
    try {
      const productsResult = saveData('products', updated);
      if (productsResult && typeof productsResult.catch === 'function') {
        productsResult.catch(err => {
          console.warn('[acceptPlan saveData(products) failed]', err);
          toast("Plan saved — couldn't refresh today's log, try once more", 'error');
        });
      }
    } catch (err) {
      console.warn('[acceptPlan saveData(products) threw]', err);
      toast("Plan saved — couldn't refresh today's log, try once more", 'error');
    }
    // === REFRESH TODAY'S REGIMENLOG FROM NEW PLAN (May 2026) ===
    // Symptom Jenni reported: rebuilding via Refine updated the
    // shelf cadence but Home cover kept showing the OLD products
    // for today. Root cause: today's existing regimenLog beats
    // the pattern fallback in resolveTodayRitual, so until that
    // log is rewritten the cover renders stale slots.
    // Fix: compute today's AM/PM ids straight from the new
    // buildPlan's day arrays (which already account for cadence
    // intent), and overwrite today's amProducts/pmProducts.
    // Preserve done/skipped/extras/notes so a partial check-in
    // earlier today survives the rebuild.
    try {
      const todayKey = localDateISO();
      const todayDow = new Date().getDay();
      const todayAmIds = ((buildPlan.am || {})[todayDow] || []).filter(Boolean);
      const todayPmIds = ((buildPlan.pm || {})[todayDow] || []).filter(Boolean);
      const existingLog = (regimenLogs || []).find(r => r.date === todayKey);
      const nextLog = existingLog
        ? {
            ...existingLog,
            amProducts: todayAmIds,
            pmProducts: todayPmIds,
            // Reset done/skipped for the new slot membership —
            // ids that are no longer planned shouldn't carry
            // forward as done. Extras + notes preserved.
            amDone: (existingLog.amDone || []).filter(id => todayAmIds.includes(id)),
            pmDone: (existingLog.pmDone || []).filter(id => todayPmIds.includes(id)),
            amSkipped: (existingLog.amSkipped || []).filter(id => todayAmIds.includes(id)),
            pmSkipped: (existingLog.pmSkipped || []).filter(id => todayPmIds.includes(id))}
        : {
            id: Date.now(),
            date: todayKey,
            amProducts: todayAmIds,
            pmProducts: todayPmIds,
            amDone: [], pmDone: [],
            amSkipped: [], pmSkipped: [],
            amExtras: [], pmExtras: [],
            devices: [], sleep: '', supplements: [],
            notes: '',
            submitted: false};
      const newRegimenLogs = existingLog
        ? (regimenLogs || []).map(r => r.date === todayKey ? nextLog : r)
        : [nextLog, ...(regimenLogs || [])];
      setRegimenLogs(newRegimenLogs);
      // T2: surface a toast on regimenLogs persistence failure so
      // the user knows today's log may be stale even though the
      // shelf write landed.
      saveData('regimenLogs', newRegimenLogs).catch(err => {
        console.warn('[acceptPlan saveData(regimenLogs) failed]', err);
        toast("Plan saved — couldn't refresh today's log, try once more", 'error');
      });
    } catch (e) {
      console.warn('[acceptPlan today-log refresh failed]', e);
      toast("Plan saved — couldn't refresh today's log, try once more", 'error');
    }
    // === Save wizard answers (May 2026 — rebuild cadence) ===
    // Persist the inputs that produced this plan so Refresh (1-tap
    // rebuild) and Tweak (pre-filled wizard) can replay later
    // without re-asking. lastBuiltAt drives the 4-week soft prompt.
    const newAnswers = {
      // Preserve actionGoal from prior wizard pass so the new Step 1
      // selection survives accept + future Refresh.
      actionGoal: (buildAnswers && buildAnswers.actionGoal) || null,
      concerns: Array.isArray(userConcerns) ? userConcerns : [],
      actives: Array.from(buildSelectedActives || []),
      tolerance: buildTolerance,
      experience: buildExperience || 'medium',
      budget: buildBudget,
      devices: Array.isArray(homeDevices) ? homeDevices : [],
      lastBuiltAt: new Date().toISOString(),
      buildCount: ((buildAnswers && buildAnswers.buildCount) || 0) + 1,
      acceptedPlan: buildPlan};
    setBuildAnswers(newAnswers);
    // T2: same defensive try/catch for buildAnswers persistence.
    try {
      const answersResult = saveData('buildAnswers', newAnswers);
      if (answersResult && typeof answersResult.catch === 'function') {
        answersResult.catch(err => {
          console.warn('[acceptPlan saveData(buildAnswers) failed]', err);
          toast("Plan saved — couldn't refresh today's log, try once more", 'error');
        });
      }
    } catch (err) {
      console.warn('[acceptPlan saveData(buildAnswers) threw]', err);
      toast("Plan saved — couldn't refresh today's log, try once more", 'error');
    }
    // Reset the soft-prompt dismissal — we just built; the
    // nudge shouldn't reappear until the rhythm ages again.
    setBuildRefreshNudgeDismissed(false);
    setBuildPlanAccepted(true);
    toast('Plan accepted. Cadence saved to your shelf.', 'info');
    setCoverRoutineRebuildToken(t => t + 1);
  };
  // === Edit handlers (mutate buildPlan in place) ===
  // May 2026 refine-commit fix: small tweaks (day / slot toggles)
  // now auto-save AND auto-accept so the change goes live instantly.
  // Full rebuilds (rebuildFromStart) still require an explicit
  // "Accept this plan" tap — that boundary remains intact.
  const persistRefinedPlan = async (nextBuildPlan) => {
    if (!nextBuildPlan) return;
    // Bug #4 fix (May 2026): the old impl silently swallowed saveData
    // failures yet still toasted '✓ Saved' and flipped accepted=true,
    // misleading the user that a refine landed. Mirror acceptPlan's
    // structured logging and bail before accepting on failure.
    const nextAnswers = { ...(buildAnswers || {}), acceptedPlan: nextBuildPlan };
    setBuildAnswers(nextAnswers);
    try {
      await saveData('buildAnswers', nextAnswers);
    } catch (e) {
      console.warn('[persistRefinedPlan]', e);
      try { toast('Refine save failed — try again', 'error'); } catch {}
      return;
    }
    setBuildPlanAccepted(true);
    try { toast('✓ Saved', 'success'); } catch {}
  };
  const togglePlanDay = (productId, dayIdx) => {
    setBuildPlan(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        slotted: prev.slotted.map(s => {
          // Bug #17 fix (May 2026): optional chain on s.product —
          // malformed plans from older saves can have slots missing
          // their product reference, which would otherwise throw.
          if (s.product?.id !== productId) return s;
          const has = s.days.includes(dayIdx);
          const days = has ? s.days.filter(d => d !== dayIdx) : [...s.days, dayIdx].sort();
          return { ...s, days };
        })};
      persistRefinedPlan(next);
      return next;
    });
  };
  const togglePlanSlot = (productId, slotKey) => {
    setBuildPlan(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        slotted: prev.slotted.map(s => {
          // Bug #17 fix (May 2026): optional chain on s.product.
          if (s.product?.id !== productId) return s;
          return { ...s, [slotKey]: !s[slotKey] };
        })};
      persistRefinedPlan(next);
      return next;
    });
  };
  const tolOptions = [
    { id: 'cautious', label: 'Cautious', sub: 'Start low and slow' },
    { id: 'standard', label: 'Standard', sub: 'Clinical doses, alternating actives' },
    { id: 'push',     label: 'Push',     sub: 'Daily actives, higher strengths' },
  ];
  const stepEyebrow = (n) => (
    <div className="text-[9px] tracking-[0.32em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>Step {n}</div>
  );
  return (
    <div className="space-y-4">
      {/* === ROUTINE PREVIEW SUMMONERS (May 30 2026 per Jenni) ===
          Persistent button at the top of the Build/Refine page so the
          final routine is always one tap away without cluttering the
          page itself. Banner below appears for ~7s when buildPlan
          changes from a refinement, with a "view routine" CTA. */}
      {buildPlan && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border px-3.5 py-2.5" style={{ background: 'var(--cream-deep)', borderColor: 'var(--line)' }}>
          <div className="min-w-0">
            <div className="text-[9.5px] tracking-[0.24em] uppercase" style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Current plan</div>
            <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--ink)' }}>{buildPlan.slotted && buildPlan.slotted.length ? `${buildPlan.slotted.length} product${buildPlan.slotted.length === 1 ? '' : 's'} scheduled` : 'Basics-only plan'}</div>
          </div>
          <button
            type="button"
            onClick={() => setRoutinePreviewOpen(true)}
            className="text-[9.5px] tracking-[0.2em] uppercase px-3 py-2 rounded-full whitespace-nowrap flex-shrink-0 transition"
            style={{ background: 'var(--ink)', color: 'var(--cream)', fontWeight: 700 }}
          >
            See full routine →
          </button>
        </div>
      )}
      {planJustUpdated && buildPlan && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5" style={{ background: 'rgba(199,231,245,0.42)', border: '1px solid rgba(47,111,136,0.32)' }}>
          <div className="min-w-0 flex items-center gap-2">
            <Icon name="Check" size={12} style={{ color: 'var(--accent-sage-dark)' }} />
            <span className="text-[11.5px]" style={{ color: 'var(--ink)' }}>Plan updated.</span>
          </div>
          <button
            type="button"
            onClick={() => { setRoutinePreviewOpen(true); setPlanJustUpdated(false); }}
            className="text-[9.5px] tracking-[0.2em] uppercase whitespace-nowrap flex-shrink-0"
            style={{ color: 'var(--accent-sage-dark)', fontWeight: 700 }}
          >
            View routine →
          </button>
        </div>
      )}

      {/* === HERO ===
          First-time copy ("Build your week" + wizard pitch) only
          appears when the user has nothing built yet. Post-build
          users skip this entirely — the Refine page below carries
          its own header. The wizard-progress dots still render
          when guided mode is active. */}
      {!userHasBuiltPattern(products) && (
        <section>
          <div className="text-[9.5px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>Build</div>
          <h2 className="text-[26px] leading-[1.05] mb-1" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.022em'}}>Shape your weekly routine.</h2>
          <p className="text-[12.5px] leading-relaxed max-w-[520px]" style={{color:'var(--ink-soft)'}}>
            Tell Frida what you're working on, the actives you want to use, your patience, your budget — and we'll lay out a cadence that respects how your skin actually responds.
          </p>
          {!buildPlan && buildMode === 'guided' && (
            <div className="mt-3 flex items-center gap-1.5">
              {Array.from({ length: finalBuildStep }, (_, i) => i + 1).map(n => (
                <div key={n} className="h-[3px] flex-1 rounded-full" style={{background: n <= buildStep ? 'var(--accent)' : 'var(--line)'}} />
              ))}
            </div>
          )}
        </section>
      )}
      {/* === REFINE PAGE (June 2026 — final list per Jenni + audit) ===
          Post-build users land on this calm routine-evolution control
          center. Quick Refinements are now MULTI-SELECT (up to 3) so the
          user can pick a combination like Barrier + Pores + Hydration
          rather than the old single-pick model. Focus list (8 options,
          audit-driven):
            Hydration / Barrier / Redness / Breakouts (was "Acne") /
            Pores (NEW) / Hyperpigmentation (was "Pigment") /
            Texture / Aging (NEW, covers fine-lines + sun-damage).
          Simplify was retired in this pass — useful intent but earned
          its own action in Evolve below; routing it through Refine made
          the focus list lopsided. Plan rows (Trip / Event / Sick / etc.)
          unchanged. */}
      {userHasBuiltPattern(products) && (buildPlanAccepted || !buildPlan) && (() => {
        const quickRefinements = [
          { id: 'hydration',  label: 'Hydration',           icon: 'Droplets', prompt: 'My skin feels dry or dehydrated. Refine my current routine for more hydration without making it heavy.' },
          { id: 'barrier',    label: 'Barrier',             icon: 'Shield',   prompt: 'My barrier feels compromised. Audit my routine and propose changes to reinforce ceramides, lipids, and reduce barrier stressors.' },
          { id: 'irritation', label: 'Redness',             icon: 'Leaf',     prompt: 'My skin is irritated, red, or reactive. What should I pause, space out, or swap in my current routine?' },
          { id: 'breakouts',  label: 'Breakouts',           icon: 'Target',   prompt: 'I am breaking out. Refine my routine for acne control without over-stripping my barrier.' },
          { id: 'pores',      label: 'Pores',               icon: 'Circle',   prompt: 'I want to focus on enlarged pores and congestion. Refine my routine around one decongestant (BHA, retinoid, or azelaic) with barrier support.' },
          { id: 'pigment',    label: 'Hyperpigmentation',   icon: 'Sun',      prompt: 'I want to focus on hyperpigmentation and dark spots. Refine my routine for pigment support and SPF discipline.' },
          { id: 'texture',    label: 'Texture',             icon: 'Sparkles', prompt: 'My texture feels uneven. Refine my active cadence for smoother skin without stacking too much irritation.' },
          { id: 'aging',      label: 'Aging / Fine lines',  icon: 'Hourglass',prompt: 'I want to focus on fine lines, firmness, and signs of aging. Refine my routine for retinoid + peptide support without over-stripping the barrier.' },
        ];
        const planRows = [
          { id: 'travel', icon: 'Plane', title: 'Trip / travel week', sub: 'Pack-light routine, climate shift, fewer steps', prompt: 'I am traveling soon. Build a temporary week from my current routine: what to pack, what to pause, and how cadence should change.' },
          { id: 'event', icon: 'CalendarHeart', title: 'Event prep', sub: 'Wedding, shoot, date, presentation, photos', prompt: 'I have an event coming up. Build a temporary prep week from my current routine that favors calm, glow, and low risk.' },
          { id: 'sick', icon: 'Thermometer', title: 'Sick / low-energy week', sub: 'Minimum viable routine while recovering', prompt: 'I am sick or low-energy. Build the simplest temporary routine that protects my skin while I recover.' },
          { id: 'routine-change', icon: 'RefreshCw', title: 'Routine change', sub: 'New schedule, gym, sleep, work, climate', prompt: 'My daily routine changed. Adapt my current skincare week to the new schedule without rebuilding everything from scratch.' },
          { id: 'procedure-plan', icon: 'Sparkles', title: 'Procedure recovery', sub: 'Peel, facial, microneedling, laser', prompt: 'I have a procedure or recovery window. Build a temporary week that avoids irritation and supports repair.' },
        ];
        const openRefineSheet = (intent) => {
          setRefineIntent(intent);
          setRefineSheetOpen(true);
        };
        const evolveRows = [
          {
            id: 'add-product',
            icon: 'Plus',
            title: 'Add a product',
            sub: 'Introduce a new product to your routine',
            onClick: () => { setEditingProductId(null); setProductForm(null); setShowProductModal(true); }},
          {
            id: 'add-device',
            icon: 'Cpu',
            title: 'Add a device',
            sub: 'LED, microcurrent, cleansing tools, and more',
            // Open the curated device picker (May 2026 per Jenni):
            // user selects from a list (red light, microcurrent,
            // etc.) or chooses Custom to free-type. Each picker
            // option pre-fills ProductModal with the device name
            // + device tag + manual entry mode.
            onClick: () => setAddDeviceSheet(true)},
          {
            id: 'add-rx',
            icon: 'FileText',
            title: 'Add or update prescription',
            sub: 'Topicals prescribed by your provider',
            // Curated Rx picker (May 2026 per Jenni): tretinoin,
            // spironolactone, accutane, etc. Custom routes to
            // manual ProductModal entry with prescription tag.
            onClick: () => setAddRxSheet(true)},
          {
            id: 'add-procedure',
            icon: 'Sparkles',
            title: 'Had a procedure',
            sub: 'Facial, microneedling, peel, laser, etc.',
            onClick: () => {
              // Route to ProcedureModal so the user can log a
              // procedure with date, provider, cost, results.
              // Previously procedures had no entry from Refine —
              // this closes that gap (Jenni, May 2026).
              if (typeof setEditingProcedureId === 'function') setEditingProcedureId(null);
              if (typeof setShowProcedureModal === 'function') setShowProcedureModal(true);
            }},
          {
            // === CONSOLIDATED PROFILE TILE (May 2026 v2 per Jenni) ===
            // Replaces three deep-link tiles (Update goals → step 3,
            // Adjust skin sensitivity → step 5) AND the standalone
            // Section 3 "Reassess your skin profile" card. One coherent
            // entry point for everything declarative about the user:
            // goals, sensitivity, conditions, skin type, color, history.
            // ProfileModal at step 0 is the full 12-step wizard, where
            // the user can skip/jump as needed. Same destination as the
            // old "Retake questionnaire" link.
            id: 'update-profile',
            icon: 'UserCog',
            title: 'Update your skin profile',
            sub: 'Goals, sensitivity, conditions — change anytime',
            onClick: () => { setProfileWizardStep(0); setShowProfileModal(true); }},
        ];
        return (
          <div className="space-y-5">
            {/* === HEADER === */}
            <section className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[28px] md:text-[32px] leading-[1.05] mb-1" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.022em'}}>Refine your routine</h2>
                <p className="text-[12.5px] leading-snug" style={{color:'var(--ink-soft)'}}>Optimize and evolve your skin system.</p>
              </div>
              <button
                type="button"
                onClick={() => setRefineHowItWorks(true)}
                className="flex-shrink-0 flex items-center gap-1.5 text-[9.5px] tracking-[0.22em] uppercase transition hover:opacity-70 mt-1"
                style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                title="How Refine works"
              >
                <Icon name="Info" size={11} />
                <span>How it works</span>
              </button>
            </section>

            {/* === FRESH START (moved to top, May 2026 v3 per Jenni) ===
                Promoted from Section 3 to top-level so the "rebuild from
                scratch" path is visible up front. Copy clarifies that
                small adjustments don't need a full rebuild — Quick
                Refinements or concern-based refinements below handle
                partial intent (e.g. just increase glow) without nuking
                the user's current routine. */}
            <section
              className="rounded-[16px] px-5 py-4"
              style={{
                background: 'linear-gradient(135deg, rgba(192, 95, 60, 0.12) 0%, rgba(192, 95, 60, 0.04) 100%)',
                border: '1px solid rgba(192, 95, 60, 0.22)'}}
            >
              <div className="flex items-center gap-4">
                <span className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{background:'rgba(192, 95, 60, 0.16)', border:'1px solid rgba(192, 95, 60, 0.22)'}}>
                  <Icon name="RotateCcw" size={16} style={{color:'var(--accent)'}} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] leading-tight" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Want a fresh start?</div>
                  <p className="text-[11.5px] mt-1 leading-snug" style={{color:'var(--ink-soft)'}}>Clear your routine and build a new one from scratch.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStartOverConfirmOpen(true)}
                  className="flex-shrink-0 rounded-full py-2.5 px-4 flex items-center justify-center gap-1.5 transition hover:opacity-90"
                  style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11, letterSpacing:'0.08em', cursor:'pointer', textTransform:'uppercase'}}
                >
                  <span>Start over</span>
                  <Icon name="ArrowRight" size={11} />
                </button>
              </div>
              {/* Partial-refine guidance — most users don't need a rebuild. */}
              <p className="text-[10.5px] leading-snug mt-3 pt-3 border-t" style={{color:'var(--ink-soft)', borderColor:'rgba(192, 95, 60, 0.16)'}}>
                Only want a small change — like more glow or fewer breakouts? Use a Quick Refinement or concern-based refinement below instead. No need to rebuild from scratch.
              </p>
            </section>

            {missingBasics.length > 0 && (
              <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Basics gap</div>
                <p className="text-[12.5px] mb-4" style={{color:'var(--ink)', fontWeight:500}}>
                  Add these later after you buy them. We’ll keep planning around what’s actually on your shelf.
                </p>
                <div className="space-y-2">
                  {missingBasics.map(row => (
                    <div key={row.id} className="rounded-[12px] px-3.5 py-3" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Icon name="AlertCircle" size={13} style={{color:'var(--accent)'}} />
                          <span className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600}}>{row.label} missing</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setEditingProductId(null); setProductForm({ category: row.label }); setShowProductModal(true); }}
                          className="text-[10px] tracking-[0.18em] uppercase transition hover:opacity-70"
                          style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                        >
                          Add when bought
                        </button>
                      </div>
                      <div className="space-y-1">
                        {(BASIC_RECOMMENDATIONS[row.id] || []).map(rec => (
                          <div key={`${row.id}-${rec.brand}-${rec.name}`} className="flex items-baseline justify-between gap-3 text-[11px]">
                            <span className="min-w-0">
                              <span style={{color:'var(--ink)', fontWeight:600}}>{rec.brand}</span>
                              <span style={{color:'var(--ink-soft)'}}> {rec.name} · {rec.note}</span>
                            </span>
                            <span className="flex-shrink-0 tracking-[0.16em]" style={{color:'var(--accent)', fontWeight:700}}>{priceMarks(rec.priceLevel)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* === QUICK REFINEMENTS ===
                Single-row horizontal scroll on BOTH mobile and desktop
                (May 2026 per Jenni). 7 intents fit one row; users scroll
                horizontally rather than wrapping to multiple rows. Tile
                width is fixed (~108px) so spacing reads consistent. */}
            <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Quick Refinements</div>
              <p className="text-[12.5px] mb-4" style={{color:'var(--ink)', fontWeight:500}}>Small changes. Stronger results.</p>
              <div
                className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1"
                style={{scrollSnapType:'x proximity', WebkitOverflowScrolling:'touch'}}
              >
                {quickRefinements.map(qr => {
                  const selected = quickRefineSelected.includes(qr.id);
                  return (
                    <button
                      key={qr.id}
                      type="button"
                      onClick={() => toggleQuickRefine(qr.id)}
                      className="flex-shrink-0 rounded-[10px] px-2 py-2.5 flex flex-col items-center justify-center gap-1.5 transition"
                      style={{
                        background: selected ? 'var(--accent)' : 'var(--cream)',
                        border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--line)'),
                        cursor:'pointer', minHeight:82, width:82, scrollSnapAlign:'start',
                      }}
                      title={qr.label}
                      aria-pressed={selected}
                    >
                      <Icon name={qr.icon} size={15} style={{color: selected ? 'var(--cream)' : 'var(--ink-soft)'}} />
                      <div className="text-[9.5px] leading-tight text-center" style={{color: selected ? 'var(--cream)' : 'var(--ink)', fontWeight:600, letterSpacing:'-0.005em'}}>{qr.label}</div>
                    </button>
                  );
                })}
              </div>
              {/* === Priority order list (June 2026 per Jenni) ===
                  When ≥1 focus is selected, show it ranked 1→3 with up/down
                  arrows so the user can reorder. Tap order sets initial
                  rank. The "Run refinement" prompt uses this order so the
                  LLM weights rank-1 most heavily ("treat the first focus
                  as the dominant lane"). */}
              {quickRefineSelected.length > 0 && (
                <div className="mt-3 rounded-[12px] border px-3 py-2.5" style={{background:'var(--cream)', borderColor:'var(--line)'}}>
                  <div className="text-[9px] tracking-[0.22em] uppercase mb-1.5" style={{color:'var(--ink-soft)', fontWeight:700}}>Priority order</div>
                  <div className="space-y-1">
                    {quickRefineSelected.map((id, idx) => {
                      const qr = quickRefinements.find(q => q.id === id);
                      if (!qr) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-[8px]" style={{background:'var(--cream-deep)'}}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]" style={{background:'var(--accent)', color:'var(--cream)', fontWeight:700}}>{idx + 1}</span>
                          <Icon name={qr.icon} size={12} style={{color:'var(--ink-soft)', flexShrink:0}} />
                          <span className="text-[12px] flex-1 min-w-0 truncate" style={{color:'var(--ink)', fontWeight:600}}>{qr.label}</span>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveQuickRefine(idx, 'up')}
                            aria-label="Move up"
                            className="w-6 h-6 rounded-full flex items-center justify-center transition disabled:opacity-30"
                            style={{color:'var(--ink-soft)', cursor: idx === 0 ? 'not-allowed' : 'pointer'}}
                          >
                            <Icon name="ChevronUp" size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === quickRefineSelected.length - 1}
                            onClick={() => moveQuickRefine(idx, 'down')}
                            aria-label="Move down"
                            className="w-6 h-6 rounded-full flex items-center justify-center transition disabled:opacity-30"
                            style={{color:'var(--ink-soft)', cursor: idx === quickRefineSelected.length - 1 ? 'not-allowed' : 'pointer'}}
                          >
                            <Icon name="ChevronDown" size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleQuickRefine(id)}
                            aria-label="Remove"
                            className="w-6 h-6 rounded-full flex items-center justify-center transition"
                            style={{color:'var(--ink-soft)', cursor:'pointer'}}
                          >
                            <Icon name="X" size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* June 2026: multi-select run button — fires a priority-ordered
                  prompt from the selected focuses. Disabled until ≥1 picked.
                  Picks order now respects quickRefineSelected (tap/reorder
                  order) instead of the static quickRefinements array order. */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-[10.5px]" style={{color:'var(--ink-soft)'}}>
                  {quickRefineSelected.length === 0
                    ? 'Pick up to 3 focuses'
                    : `${quickRefineSelected.length} focus${quickRefineSelected.length === 1 ? '' : 'es'} selected · drag-rank above`}
                </div>
                <button
                  type="button"
                  disabled={quickRefineSelected.length === 0}
                  onClick={() => {
                    // Preserve user's priority order (1st pick = highest weight).
                    const picks = quickRefineSelected
                      .map(id => quickRefinements.find(qr => qr.id === id))
                      .filter(Boolean);
                    if (picks.length === 0) return;
                    const labels = picks.map(p => p.label).join(' + ');
                    const orderedList = picks.map((p, i) => `${i + 1}) ${p.label.toLowerCase()}`).join(', ');
                    const promptsByRank = picks.map((p, i) => `Priority ${i + 1} (${p.label.toLowerCase()}): ${p.prompt}`).join(' ');
                    openRefineSheet({
                      id: picks.map(p => p.id).join('-'),
                      label: labels,
                      icon: picks[0].icon,
                      prompt: `I want to focus on, in priority order: ${orderedList}. ${promptsByRank} Treat priority 1 as the dominant lane and weight changes accordingly; only secondary support for the others. Combine into ONE coherent refinement; don't stack conflicting active classes.`,
                    });
                  }}
                  className="rounded-full px-4 py-1.5 text-[10.5px] tracking-[0.18em] uppercase transition disabled:opacity-40"
                  style={{background: quickRefineSelected.length > 0 ? 'var(--accent)' : 'var(--cream-deep)', color: quickRefineSelected.length > 0 ? 'var(--cream)' : 'var(--ink-soft)', fontWeight:700, cursor: quickRefineSelected.length > 0 ? 'pointer' : 'not-allowed', border:'1px solid ' + (quickRefineSelected.length > 0 ? 'var(--accent)' : 'var(--line)')}}
                >Run refinement</button>
              </div>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setRefineMoreOptions(v => !v)}
                  className="text-[10px] tracking-[0.22em] uppercase transition hover:opacity-70 inline-flex items-center gap-1.5"
                  style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                >
                  <span>{refineMoreOptions ? 'Hide options' : 'View more options'}</span>
                  <Icon name="ArrowRight" size={10} />
                </button>
              </div>
              {refineMoreOptions && (
                <div className="mt-3 pt-3 border-t text-[11.5px] leading-snug" style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}>
                  More intents land here — tone up acid days, reset retinol pace, switch to fragrance-free, prep for a procedure. Tell us what you want next and we'll add it.
                </div>
              )}
            </section>

            {/* === EVOLVE YOUR ROUTINE === */}
            <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Evolve Your Routine</div>
              <p className="text-[12.5px] mb-4" style={{color:'var(--ink)', fontWeight:500}}>Add new tools, update inputs, and adjust your regimen.</p>
              <div className="space-y-1">
                {evolveRows.map((row, i) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={row.onClick}
                    className="w-full text-left rounded-[12px] px-4 py-3.5 flex items-center gap-3 transition hover:bg-[var(--cream)]"
                    style={{background:'var(--cream)', border: '1px solid var(--line)', cursor:'pointer'}}
                  >
                    <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                      <Icon name={row.icon} size={14} style={{color:'var(--ink-soft)'}} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>{row.title}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{color:'var(--ink-soft)'}}>{row.sub}</span>
                    </span>
                    <Icon name="ChevronRight" size={14} style={{color:'var(--ink-soft)', flexShrink:0}} />
                  </button>
                ))}
              </div>
            </section>

            {/* === PLAN FOR SOMETHING === */}
            <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Plan for something</div>
              <p className="text-[12.5px] mb-4" style={{color:'var(--ink)', fontWeight:500}}>Temporary weeks for real life, without wrecking your standing routine.</p>
              <div className="space-y-1">
                {planRows.map(row => {
                  // June 2026 Phase 2.5: the travel row routes to the
                  // dedicated TravelSetupModal (auto-build flow with
                  // dates / climate / packed list / upcoming preview)
                  // instead of the legacy LLM-driven refineSheet. Same
                  // entry point as "Used something else? → Going
                  // traveling" so all travel paths converge. Existing
                  // trip pre-fills the modal — user can edit dates,
                  // climate, or replace the packing list with a fresh
                  // auto-build for a new destination.
                  const isTravel = row.id === 'travel';
                  // Safe ref — upcomingTripCount is optional prop; not yet wired.
                  const tripCountSafe = (typeof upcomingTripCount === 'number') ? upcomingTripCount : 0;
                  const subtitle = isTravel && tripCountSafe
                    ? `${row.sub} · ${tripCountSafe} trip on file — tap to edit or plan another`
                    : row.sub;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        if (isTravel && typeof setShowTravelSetupModal === 'function') {
                          setShowTravelSetupModal(true);
                          return;
                        }
                        openRefineSheet({ id: row.id, label: row.title, icon: row.icon, prompt: row.prompt });
                      }}
                      className="w-full text-left rounded-[12px] px-4 py-3.5 flex items-center gap-3 transition hover:bg-[var(--cream)]"
                      style={{background:'var(--cream)', border: '1px solid var(--line)', cursor:'pointer'}}
                    >
                      <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                        <Icon name={row.icon} size={14} style={{color:'var(--ink-soft)'}} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>{row.title}</span>
                        <span className="block text-[11px] mt-0.5 leading-snug" style={{color:'var(--ink-soft)'}}>{subtitle}</span>
                      </span>
                      <Icon name="ChevronRight" size={14} style={{color:'var(--ink-soft)', flexShrink:0}} />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        );
      })()}
      {/* === LEGACY POST-BUILD SUMMARY (May 2026 — dead under Refine) ===
          Preserved as a code reference while the new Refine page
          bakes. Removed entirely once Refine is confirmed stable.
          Gate kept as `false &&` so React never renders it. */}
      {false && !buildPlan && buildMode === 'choose' && userHasBuiltPattern(products) && (() => {
        const dayCodes = ['S','M','T','W','T','F','S'];
        const active = (products || []).filter(p => !p.endDate);
        // Surface only products with non-default cadence (the
        // ones the user has actually scheduled). Cleansers /
        // moisturizers / SPFs default to daily — those don't
        // need to occupy the summary list.
        const scheduled = active.filter(p => {
          const days = (p.cadence && Array.isArray(p.cadence.days)) ? p.cadence.days
                      : Array.isArray(p.cadenceDays) ? p.cadenceDays : null;
          return Array.isArray(days) && days.length > 0 && days.length < 7;
        });
        return (
          <section className="space-y-3">
            <div className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="text-[9px] tracking-[0.32em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>Your routine</div>
                {lastBuiltLabel && (
                  <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:500}}>
                    Built {lastBuiltLabel}
                  </div>
                )}
              </div>
              <h3 className="text-[20px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.018em'}}>Your week, set.</h3>
              <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>
                {scheduled.length === 0
                  ? 'Cadence set across your shelf — daily basics only.'
                  : `${scheduled.length} active${scheduled.length === 1 ? '' : 's'} scheduled across the week.`}
              </p>
              {/* 4-week soft prompt: subtle nudge to refresh once
                  the rhythm is a month old. Voice = Jenni:
                  observational, not pushy. Two actions: dismiss
                  (close inline) or refresh (1-tap rebuild). */}
              {showRefreshNudge && !buildRefreshNudgeDismissed && (
                <div
                  className="mb-3 rounded-[12px] px-3 py-2.5 flex items-center justify-between gap-3"
                  style={{background:'var(--cream)', border: '1px solid var(--line)'}}
                >
                  <p className="text-[11px] leading-tight" style={{color:'var(--ink)'}}>
                    Routine is {lastBuiltLabel}. Worth a look — skin shifts.
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => refreshRhythm()}
                      className="text-[10px] tracking-[0.16em] uppercase"
                      style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                    >Refresh</button>
                    <button
                      type="button"
                      onClick={() => setBuildRefreshNudgeDismissed(true)}
                      className="text-[10px] tracking-[0.16em] uppercase"
                      style={{color:'var(--ink-soft)', fontWeight:500, cursor:'pointer'}}
                    >Later</button>
                  </div>
                </div>
              )}
              {scheduled.length > 0 && (
                <div className="space-y-1 mb-1">
                  {scheduled.slice(0, 5).map(p => {
                    const days = (p.cadence && Array.isArray(p.cadence.days)) ? p.cadence.days
                                : Array.isArray(p.cadenceDays) ? p.cadenceDays : [];
                    const ut = Array.isArray(p.useTimes) ? p.useTimes.map(s => String(s).toUpperCase()) : [];
                    const slot = ut.includes('AM') && ut.includes('PM') ? 'AM·PM' : (ut.includes('PM') ? 'PM' : 'AM');
                    return (
                      <div key={p.id} className="flex items-baseline justify-between gap-3 text-[11.5px]">
                        <span className="truncate" style={{color:'var(--ink)', fontWeight:500}}>{p.name}</span>
                        <span className="text-[9.5px] tracking-[0.18em] uppercase flex-shrink-0" style={{color:'var(--accent)', fontWeight:600}}>
                          {days.map(d => dayCodes[d]).join('·')} {slot}
                        </span>
                      </div>
                    );
                  })}
                  {scheduled.length > 5 && (
                    <div className="text-[10.5px]" style={{color:'var(--ink-soft)'}}>+{scheduled.length - 5} more</div>
                  )}
                </div>
              )}

              {/* === WEEK AT A GLANCE (May 2026, revised) ===
                  Tap a day → expands inline showing AM/PM
                  products for that day. Stays on Build summary;
                  does NOT navigate to Rotation. View rotation →
                  link still available for the deep view. */}
              {(() => {
                const dayLetters = ['S','M','T','W','T','F','S'];
                const dayFullLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const dayLongLabels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                const todayDow = new Date().getDay();
                const dayHasActive = Array.from({length: 7}, (_, d) => {
                  return active.some(p => {
                    if (!p.cadence || !Array.isArray(p.cadence.days)) return false;
                    if (!p.cadence.days.includes(d)) return false;
                    const fam = detectActiveFamily(p.activeIngredients || p.actives || '');
                    return fam && !['ceramide','panthenol','humectant','centella'].includes(fam);
                  });
                });
                // Derive AM/PM products + focus for the selected day
                const productsForDay = (dayIdx) => {
                  const am = [];
                  const pm = [];
                  active.forEach(p => {
                    if (!p.cadence || !Array.isArray(p.cadence.days)) return;
                    if (!p.cadence.days.includes(dayIdx)) return;
                    const ut = Array.isArray(p.useTimes) ? p.useTimes.map(s => String(s).toLowerCase()) : [];
                    if (ut.includes('am')) am.push(p);
                    if (ut.includes('pm')) pm.push(p);
                  });
                  return { am, pm };
                };
                const FOCUS_PRIORITY_LOCAL = [
                  { family:'retinoid',label:'Retinoid' },{ family:'aha',label:'Exfoliate' },
                  { family:'bha',label:'Exfoliate' },{ family:'bpo',label:'Treat' },
                  { family:'vitc',label:'Brighten' },{ family:'azelaic',label:'Brighten' },
                  { family:'arbutin',label:'Brighten' },{ family:'tranexamic',label:'Brighten' },
                  { family:'kojic',label:'Brighten' },{ family:'bakuchiol',label:'Renew' },
                  { family:'peptide',label:'Firm' },{ family:'niacinamide',label:'Barrier' },
                  { family:'ceramide',label:'Recovery' },{ family:'panthenol',label:'Recovery' },
                  { family:'centella',label:'Calm' },{ family:'humectant',label:'Hydrate' },
                  { family:'spf',label:'Protect' },
                ];
                const focusForDay = (dayIdx) => {
                  const fams = new Set();
                  const { am, pm } = productsForDay(dayIdx);
                  [...am, ...pm].forEach(p => {
                    const fam = detectActiveFamily(p.activeIngredients || p.actives || '');
                    if (fam) fams.add(fam);
                  });
                  if (fams.size === 0) return 'Rest';
                  for (const e of FOCUS_PRIORITY_LOCAL) {
                    if (fams.has(e.family)) return e.label;
                  }
                  return 'Daily';
                };
                return (
                  <div className="mt-3 pt-3 border-t" style={{borderColor: 'var(--line)'}}>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-[9px] tracking-[0.26em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>Week at a glance</div>
                      <button
                        type="button"
                        onClick={() => setRegimenView('occasions')}
                        className="text-[9px] tracking-[0.18em] uppercase transition hover:opacity-70"
                        style={{color:'var(--ink-soft)', cursor:'pointer'}}
                      >
                        View rotation →
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {dayLetters.map((letter, d) => {
                        const hasActive = dayHasActive[d];
                        const isToday = d === todayDow;
                        const isSelected = persistentSummaryDay === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setPersistentSummaryDay(prev => prev === d ? null : d)}
                            className="flex flex-col items-center gap-1 py-1 transition hover:opacity-80"
                            style={{cursor:'pointer'}}
                            title={`${dayFullLabels[d]}${hasActive ? ' · active scheduled' : ' · rest'}`}
                          >
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px]"
                              style={{
                                background: isSelected ? 'var(--accent)' : (isToday ? 'var(--cream)' : 'transparent'),
                                color: isSelected ? 'var(--cream)' : 'var(--ink)',
                                border: '1px solid ' + (isSelected || isToday ? 'var(--accent)' : 'var(--line)'),
                                fontWeight: 600}}
                            >{letter}</span>
                            <span
                              className="w-1 h-1 rounded-full"
                              style={{background: hasActive ? 'var(--accent)' : 'transparent', opacity: hasActive ? 0.7 : 0}}
                            />
                          </button>
                        );
                      })}
                    </div>
                    {/* Inline expanded panel — stays on this page */}
                    {persistentSummaryDay !== null && (() => {
                      const { am, pm } = productsForDay(persistentSummaryDay);
                      const focusLbl = focusForDay(persistentSummaryDay);
                      const isTodaySelected = persistentSummaryDay === todayDow;
                      return (
                        <div className="mt-2 rounded-[12px] px-3 py-2.5" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <div>
                              <span className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{dayLongLabels[persistentSummaryDay]}{isTodaySelected ? ' · today' : ''}</span>
                              <span className="text-[11px] ml-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'-0.01em'}}>{focusLbl}</span>
                            </div>
                            <button
                              onClick={() => setPersistentSummaryDay(null)}
                              className="text-[10px] tracking-[0.18em] uppercase"
                              style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                              type="button"
                            >Close</button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[8.5px] tracking-[0.22em] uppercase mb-1 flex items-center gap-1" style={{color:'var(--ink-soft)', fontWeight:600}}>
                                <Icon name="Sun" size={9} /> AM
                              </div>
                              {am.length === 0 ? (
                                <div className="text-[10.5px]" style={{color:'var(--ink-soft)', opacity:0.6}}>—</div>
                              ) : am.map(p => (
                                <div key={p.id} className="text-[11px] leading-tight mb-0.5 truncate" style={{color:'var(--ink)', fontWeight:500}}>{p.name}</div>
                              ))}
                            </div>
                            <div>
                              <div className="text-[8.5px] tracking-[0.22em] uppercase mb-1 flex items-center gap-1" style={{color:'var(--ink-soft)', fontWeight:600}}>
                                <Icon name="Moon" size={9} /> PM
                              </div>
                              {pm.length === 0 ? (
                                <div className="text-[10.5px]" style={{color:'var(--ink-soft)', opacity:0.6}}>—</div>
                              ) : pm.map(p => (
                                <div key={p.id} className="text-[11px] leading-tight mb-0.5 truncate" style={{color:'var(--ink)', fontWeight:500}}>{p.name}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
            {/* ===== CONSOLIDATED ACTION ROW (May 2026 — IA pivot) =====
                Three peer actions: Adjust (tweak current plan),
                + Add product (chooser — From shelf or New), and
                Rebuild (opens flavor sheet). The shelf-pick pill
                and Tonight/Tomorrow preview cards were retired
                from this surface — Rebuild is for changing the
                rhythm, not previewing it. Today owns previews. */}
            {!buildAddSheet && (() => {
              // Detect unscheduled shelf items for the chooser badge
              const scheduledIds = new Set(scheduled.map(p => p.id));
              const unscheduledCount = (products || []).filter(p => !p.endDate && !scheduledIds.has(p.id)).length;
              return (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setBuildMode('expert'); }}
                      className="pill-btn primary"
                      type="button"
                      title="Adjust day-by-day cadence for each shelf product"
                    >
                      <Icon name="Calendar" size={13} style={{marginRight:6}} />
                      Adjust
                    </button>
                    <button
                      onClick={() => {
                        // Open the chooser sheet — user picks
                        // between adding from shelf or adding a
                        // brand-new product. If everything on the
                        // shelf is already scheduled, jump
                        // straight to ProductModal.
                        if (unscheduledCount === 0) {
                          setBuildAddPriorIds(new Set((products || []).map(p => p.id)));
                          setBuildPendingAdd(true);
                          setEditingProductId(null);
                          setShowProductModal(true);
                        } else {
                          setBuildAddSheet(true);
                          setBuildAddStage('chooser');
                          setBuildAddProposal(null);
                          setBuildAddQueue([]);
                        }
                      }}
                      className="pill-btn secondary"
                      type="button"
                      title="Add a product to your routine — from shelf or new"
                    >
                      <Icon name="Plus" size={13} style={{marginRight:6}} />
                      Add product
                    </button>
                    <button
                      onClick={() => {
                        // If we have saved answers, show the
                        // flavor sheet (Refresh/Tweak/Start fresh).
                        // Otherwise default to wizard from step 1.
                        if (buildAnswers) {
                          setBuildRebuildSheetOpen(true);
                        } else {
                          setBuildMode('guided'); setBuildStep(1);
                        }
                      }}
                      className="pill-btn secondary"
                      type="button"
                      title={buildAnswers ? 'Choose how to refine — refresh, tweak, or start fresh' : 'Refine from the wizard'}
                    >
                      <Icon name="RotateCcw" size={12} style={{marginRight:6}} />
                      Refine
                    </button>
                  </div>
                  {/* Rebuild flavor sheet — inline, three choices.
                      Editorial: one column, generous padding,
                      no decorative chrome. Each row = title +
                      one-line description. */}
                  {buildRebuildSheetOpen && (
                    <div
                      className="rounded-[16px] p-1"
                      style={{background:'var(--cream)', border: '1px solid var(--line)'}}
                    >
                      <div className="flex items-baseline justify-between px-4 pt-3 pb-2">
                        <div className="text-[9px] tracking-[0.26em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>How to rebuild</div>
                        <button
                          type="button"
                          onClick={() => setBuildRebuildSheetOpen(false)}
                          className="text-[10px] tracking-[0.18em] uppercase"
                          style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                        >Close</button>
                      </div>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => { setBuildRebuildSheetOpen(false); refreshRhythm(); }}
                          className="w-full text-left px-4 py-3 rounded-[12px] transition hover:bg-[var(--cream-deep)]"
                          style={{cursor:'pointer'}}
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="text-[13px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>Refresh</span>
                            <span className="text-[9px] tracking-[0.18em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>1-tap</span>
                          </div>
                          <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                            Same answers, new cadence across your current shelf.
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBuildRebuildSheetOpen(false); tweakAnswers(); }}
                          className="w-full text-left px-4 py-3 rounded-[12px] transition hover:bg-[var(--cream-deep)]"
                          style={{cursor:'pointer'}}
                        >
                          <div className="text-[13px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>Tweak</div>
                          <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                            Wizard, pre-filled with your last answers. Change a thing or two.
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBuildRebuildSheetOpen(false); startFreshWizard(); }}
                          className="w-full text-left px-4 py-3 rounded-[12px] transition hover:bg-[var(--cream-deep)]"
                          style={{cursor:'pointer'}}
                        >
                          <div className="text-[13px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>Start fresh</div>
                          <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                            Blank wizard. For when something's changed — pregnancy, procedure, season.
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {buildAddSheet && (
              <div
                className="rounded-[18px] p-4 space-y-3"
                style={{
                  background:'var(--cream)',
                  border: '1px solid var(--line)'}}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[9.5px] tracking-[0.24em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>
                    {buildAddStage === 'chooser' && 'Add a product'}
                    {buildAddStage === 'shelf-pick' && 'From your shelf'}
                    {buildAddStage === 'propose' && 'Frida suggests'}
                  </div>
                  <button
                    onClick={() => { setBuildAddSheet(false); setBuildAddStage('chooser'); setBuildAddProposal(null); setBuildAddQueue([]); }}
                    className="text-[10px] tracking-[0.18em] uppercase"
                    style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                {/* === CHOOSER STAGE (May 2026 — IA pivot) ===
                    Two paths in one consolidated sheet: pick
                    from shelf (only when there are unscheduled
                    shelf items) OR add a brand-new product via
                    ProductModal (scan / search / brand). */}
                {buildAddStage === 'chooser' && (() => {
                  const scheduledIds = new Set(scheduled.map(p => p.id));
                  const unscheduledCount = (products || []).filter(p => !p.endDate && !scheduledIds.has(p.id)).length;
                  return (
                    <div className="space-y-1.5">
                      {unscheduledCount > 0 && (
                        <button
                          type="button"
                          onClick={() => { setBuildAddStage('shelf-pick'); }}
                          className="w-full text-left p-3.5 rounded-[12px] transition hover:bg-[var(--cream-deep)]"
                          style={{background:'var(--cream-deep)', border: '1px solid var(--line)', cursor:'pointer'}}
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="text-[13px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>From your shelf</span>
                            <span className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>{unscheduledCount} not in plan</span>
                          </div>
                          <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                            Activate something you already own. Frida will suggest a cadence.
                          </div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setBuildAddSheet(false);
                          setBuildAddStage('chooser');
                          setBuildAddPriorIds(new Set((products || []).map(p => p.id)));
                          setBuildPendingAdd(true);
                          setEditingProductId(null);
                          setShowProductModal(true);
                        }}
                        className="w-full text-left p-3.5 rounded-[12px] transition hover:bg-[var(--cream-deep)]"
                        style={{background:'var(--cream-deep)', border: '1px solid var(--line)', cursor:'pointer'}}
                      >
                        <div className="text-[13px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>New product</div>
                        <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                          Scan a barcode, search a name, or browse by brand.
                        </div>
                      </button>
                    </div>
                  );
                })()}

                {buildAddStage === 'shelf-pick' && (() => {
                  // Shelf candidates = active products that aren't already in the persistent plan
                  const scheduledIds = new Set(scheduled.map(p => p.id));
                  const candidates = (products || []).filter(p => !p.endDate && !scheduledIds.has(p.id));
                  if (candidates.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>Everything on your shelf is already in the plan.</p>
                        <button
                          onClick={() => setBuildAddStage('chooser')}
                          className="mt-3 text-[10px] tracking-[0.18em] uppercase"
                          style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                          type="button"
                        >
                          Back
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {candidates.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setBuildAddQueue([p.id]);
                              setBuildAddStage('propose');
                            }}
                            className="w-full p-3 rounded-[12px] border text-left transition hover:bg-[var(--cream-deep)] flex items-center gap-3"
                            style={{borderColor: 'var(--line)', background:'var(--cream-deep)', cursor:'pointer'}}
                            type="button"
                          >
                            <div className="flex-1 min-w-0">
                              {p.brand && (
                                <div className="text-[9px] tracking-[0.2em] uppercase truncate" style={{color:'var(--ink-soft)', fontWeight:600}}>{p.brand}</div>
                              )}
                              <div className="text-[12.5px] truncate" style={{color:'var(--ink)', fontWeight:600}}>{p.name}</div>
                            </div>
                            <Icon name="ChevronRight" size={13} style={{color:'var(--ink-soft)'}} />
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setBuildAddStage('chooser')}
                        className="text-[10px] tracking-[0.18em] uppercase"
                        style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                        type="button"
                      >
                        ← Back
                      </button>
                    </div>
                  );
                })()}

                {/* Propose stage → uses the shared <ProposeSlotCard />.
                    Note: the parent buildAddSheet wrapper already
                    provides its own header + Close, so we render
                    the card content directly (it includes its
                    own header but visually they don't conflict). */}
                {buildAddStage === 'propose' && buildAddProposal && (
                  <ProposeSlotCard
                    proposal={buildAddProposal}
                    queue={buildAddQueue}
                    products={products}
                    onClose={closeProposal}
                    onCancel={cancelProposal}
                    onAccept={runAcceptProposal}
                    onToggleDay={toggleProposalDay}
                    onFlipSlot={flipProposalSlot}
                  />
                )}
              </div>
            )}

            {/* Tonight + Tomorrow preview cards and the
                "See your full week" link were removed from
                this surface in the May 2026 IA pivot.
                Previews belong on Today; the week is already
                visible above via the inline week-at-a-glance. */}

          </section>
        );
      })()}
      {/* === STEP 0: MODE PICKER ===
          Only renders for first-time builders (no cadence on
          any product). Once the user has built, the post-build
          summary above takes the entry surface and the mode
          picker is hidden. */}
      {!buildPlan && buildMode === 'choose' && !userHasBuiltPattern(products) && (
        <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          <div className="text-[9px] tracking-[0.32em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>Step 1</div>
          <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>How do you want to build?</h3>
          <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Either path ends at the same weekly plan — pick whichever fits.</p>
          <div className="space-y-2">
            <button
              onClick={() => { setBuildMode('guided'); setBuildStep(1); }}
              className="w-full text-left rounded-[12px] px-4 py-3 transition flex items-start gap-3"
              style={{background:'var(--cream)', border: '1px solid var(--line)', cursor:'pointer'}}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{background:'var(--cream-deep)', color:'var(--accent)', border: '1px solid var(--line)'}}>
                <Icon name="Sparkles" size={13} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:600}}>Build for me</div>
                <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>Guided wizard — concerns, actives, tolerance, budget, basics. We propose the days.</div>
              </div>
            </button>
            <button
              onClick={() => { setBuildMode('expert'); }}
              className="w-full text-left rounded-[12px] px-4 py-3 transition flex items-start gap-3"
              style={{background:'var(--cream)', border: '1px solid var(--line)', cursor:'pointer'}}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{background:'var(--cream-deep)', color:'var(--accent)', border: '1px solid var(--line)'}}>
                <Icon name="Calendar" size={13} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:600}}>I already know what I want</div>
                <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>Set AM/PM and the days for each product yourself. We'll flag any conflicts.</div>
              </div>
            </button>
          </div>
        </section>
      )}
      {/* === EXPERT EDITOR ===
          Power-user path. Lists every active shelf product with
          AM/PM toggles + a 7-day picker per product. Writes to
          product.cadence on every change so the Weekly view
          updates live. After setup, "Run assessment" routes to
          Weekly with the conflict scan applied. */}
      {!buildPlan && buildMode === 'expert' && (() => {
        const dayShortLabels = ['S','M','T','W','T','F','S'];
        const activeShelf = (products || []).filter(p => !p.endDate);
        const getCadenceDays = (p) => {
          if (p.cadence && Array.isArray(p.cadence.days)) return p.cadence.days;
          if (Array.isArray(p.cadenceDays)) return p.cadenceDays;
          return [0,1,2,3,4,5,6]; // default: daily
        };
        const setCadenceDays = (productId, days) => {
          const updated = products.map(p => p.id === productId
            ? { ...p, cadence: { ...(p.cadence || {}), days, frequency: days.length } }
            : p
          );
          setProducts(updated);
          saveData('products', updated);
        };
        const toggleProductDay = (productId, dayIdx) => {
          const p = products.find(x => x.id === productId);
          if (!p) return;
          const current = getCadenceDays(p);
          const next = current.includes(dayIdx)
            ? current.filter(d => d !== dayIdx)
            : [...current, dayIdx].sort();
          setCadenceDays(productId, next);
        };
        const toggleProductSlot = (productId, slot) => {
          const p = products.find(x => x.id === productId);
          if (!p) return;
          const current = Array.isArray(p.useTimes) ? p.useTimes.map(s => String(s).toUpperCase()) : [];
          const tag = slot.toUpperCase();
          const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
          const updated = products.map(x => x.id === productId ? { ...x, useTimes: next } : x);
          setProducts(updated);
          saveData('products', updated);
        };
        return (
          <section className="space-y-3">
            <div className="rounded-[16px] px-5 py-4" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Expert mode</div>
              <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Set your week, product by product.</h3>
              <p className="text-[11.5px]" style={{color:'var(--ink-soft)'}}>Toggle AM/PM and tap the days you'll use it. Saves as you go.</p>
            </div>
            {activeShelf.length === 0 ? (
              <div className="rounded-[16px] px-5 py-6 text-center" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>No products on your shelf yet. Add some, then come back.</p>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="mt-3 pill-btn primary"
                  type="button"
                >+ Add Product</button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Compact-row pattern (May 2026, Option C):
                    each product collapses to a tappable summary.
                    Tap reveals the AM/PM toggle row + day circles.
                    First 3 expanded by default until user
                    interacts (see isBuildCardExpanded). */}
                {activeShelf.map((p, index) => {
                  const days = getCadenceDays(p);
                  const useTimes = Array.isArray(p.useTimes) ? p.useTimes.map(s => String(s).toUpperCase()) : [];
                  const inAM = useTimes.includes('AM');
                  const inPM = useTimes.includes('PM');
                  const expanded = isBuildCardExpanded(p.id, index);
                  const dayCodes = days.length === 7 ? 'Daily' : days.length === 0 ? '—' : days.map(d => dayShortLabels[d]).join('·');
                  const slotTag = inAM && inPM ? 'AM · PM' : inAM ? 'AM' : inPM ? 'PM' : '—';
                  return (
                    <div key={p.id} className="rounded-[12px] overflow-hidden" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                      <button
                        type="button"
                        onClick={() => toggleBuildEditExpand(p.id)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition hover:opacity-95"
                        style={{cursor:'pointer'}}
                      >
                        <div className="flex-1 min-w-0">
                          {p.brand && <div className="text-[8.5px] tracking-[0.22em] uppercase truncate" style={{color:'var(--ink-soft)', fontWeight:600}}>{p.brand}</div>}
                          <div className="text-[12.5px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500}}>{p.name}</div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-[9.5px] tracking-[0.18em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>{dayCodes}</span>
                            <span className="text-[9.5px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{slotTag}</span>
                          </div>
                        </div>
                        <Icon name="ChevronDown" size={12} style={{color:'var(--ink-soft)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.18s', flexShrink:0}} />
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 pt-1 border-t" style={{borderColor: 'var(--line)'}}>
                          {/* Single row: AM/PM toggles + day circles */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleProductSlot(p.id, 'am')}
                                className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full transition"
                                style={{
                                  background: inAM ? 'var(--accent)' : 'transparent',
                                  color: inAM ? 'var(--cream)' : 'var(--ink-soft)',
                                  border: '1px solid ' + (inAM ? 'var(--accent)' : 'var(--line)'),
                                  fontWeight: 600,
                                  cursor: 'pointer'}}
                              >AM</button>
                              <button
                                onClick={() => toggleProductSlot(p.id, 'pm')}
                                className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full transition"
                                style={{
                                  background: inPM ? 'var(--accent)' : 'transparent',
                                  color: inPM ? 'var(--cream)' : 'var(--ink-soft)',
                                  border: '1px solid ' + (inPM ? 'var(--accent)' : 'var(--line)'),
                                  fontWeight: 600,
                                  cursor: 'pointer'}}
                              >PM</button>
                            </div>
                            <div className="flex gap-1">
                              {[0,1,2,3,4,5,6].map(d => {
                                const on = days.includes(d);
                                return (
                                  <button
                                    key={d}
                                    onClick={() => toggleProductDay(p.id, d)}
                                    className="w-6 h-6 rounded-full text-[9.5px] transition flex items-center justify-center"
                                    style={{
                                      background: on ? 'var(--accent)' : 'transparent',
                                      color: on ? 'var(--cream)' : 'var(--ink-soft)',
                                      border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                                      fontWeight: 600,
                                      cursor: 'pointer'}}
                                  >{dayShortLabels[d]}</button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ===== EXPERT MODE: ADD-A-PRODUCT + PICK-FROM-SHELF =====
                Dashed "Add a product" handles new products via
                ProductModal. "Pick from shelf · N inactives" only
                renders when there are shelf items with no specific
                cadence — opens the shelf-pick sheet so Frida can
                propose a slot for them. */}
            {activeShelf.length > 0 && !buildAddSheet && (() => {
              // Inactives = active shelf products without a non-default cadence
              const inactivesCount = activeShelf.filter(p => {
                const days = (p.cadence && Array.isArray(p.cadence.days)) ? p.cadence.days
                          : Array.isArray(p.cadenceDays) ? p.cadenceDays : null;
                return !Array.isArray(days) || days.length === 0 || days.length === 7;
              }).length;
              return (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setBuildAddPriorIds(new Set((products || []).map(p => p.id)));
                      setBuildPendingAdd(true);
                      setEditingProductId(null);
                      setShowProductModal(true);
                    }}
                    className="w-full p-3 rounded-[14px] border-2 border-dashed transition flex items-center justify-center gap-2 hover:bg-[var(--cream-deep)]"
                    style={{borderColor: 'var(--line)', background:'transparent', color:'var(--accent)', cursor:'pointer', fontWeight:600}}
                    type="button"
                  >
                    <Icon name="Plus" size={14} />
                    <span className="text-[12px] tracking-[0.04em]">Add a product</span>
                  </button>
                  {inactivesCount > 0 && (
                    <button
                      onClick={() => { setBuildAddSheet(true); setBuildAddStage('shelf-pick'); setBuildAddProposal(null); setBuildAddQueue([]); }}
                      className="w-full pill-btn secondary"
                      type="button"
                      title="Activate a shelf product into your weekly plan — Frida will suggest a cadence"
                    >
                      <Icon name="Package" size={13} style={{marginRight:6}} />
                      Pick from shelf · {inactivesCount} {inactivesCount === 1 ? 'not in plan' : 'not in plan'}
                    </button>
                  )}
                </div>
              );
            })()}
            {/* Expert-mode propose stage → shared component */}
            {activeShelf.length > 0 && buildAddSheet && buildAddStage === 'propose' && buildAddProposal && (
              <ProposeSlotCard
                proposal={buildAddProposal}
                queue={buildAddQueue}
                products={products}
                onClose={closeProposal}
                onCancel={cancelProposal}
                onAccept={runAcceptProposal}
                onToggleDay={toggleProposalDay}
                onFlipSlot={flipProposalSlot}
              />
            )}

            <section className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setBuildMode('choose')}
                className="text-[10px] tracking-[0.22em] uppercase flex items-center gap-1.5 transition hover:opacity-70"
                style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
              >
                <Icon name="ArrowLeft" size={12} /> Back
              </button>
              <button
                onClick={() => setRegimenView('occasions')}
                className="pill-btn primary"
                type="button"
                style={{minWidth:'200px'}}
                disabled={activeShelf.length === 0}
              >
                See my week
                <Icon name="ArrowRight" size={14} style={{marginLeft:6}} />
              </button>
            </section>
          </section>
        );
      })()}
      {/* === STEP 1: ACTION GOAL (May 2026 — new first step) ===
          Single-select primary intent. Anchors the rest of the
          wizard and lets the generator bias scheduling toward the
          chosen direction. Persisted on buildAnswers.actionGoal so
          returning users land pre-selected. */}
      {!buildPlan && buildMode === 'guided' && buildStep === 1 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {stepEyebrow(1)}
        <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Where do you want this to head?</h3>
        <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Pick the single direction that matters most. We'll bias the plan that way.</p>
        <div className="space-y-2">
          {ACTION_GOALS.map(opt => {
            const isActive = (buildAnswers && buildAnswers.actionGoal) === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBuildAnswers({ ...(buildAnswers || {}), actionGoal: opt.id })}
                className="w-full text-left rounded-[12px] px-4 py-3 transition flex items-start gap-3"
                style={{
                  background: 'var(--cream)',
                  border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                  cursor: 'pointer'}}
                aria-pressed={isActive}
              >
                <span
                  className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center"
                  style={{
                    background: isActive ? 'var(--accent)' : 'transparent',
                    border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)')}}
                >
                  {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--cream)'}} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:isActive?600:500}}>{opt.label}</div>
                  <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>{opt.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] mt-3" style={{color:'var(--ink-soft)'}}>One goal up front keeps the rest of the questions focused.</p>
      </section>
      )}
      {/* === STEP 2: CONCERNS === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 2 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {stepEyebrow(2)}
        <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>What's bothering you?</h3>
        <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Pick anything that resonates. We'll skew the plan toward these.</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_CONCERNS.map(c => {
            const k = c.toLowerCase();
            const isActive = (userConcerns || []).some(x => x.toLowerCase() === k);
            return (
              <button
                key={c}
                onClick={() => toggleConcern(c)}
                className="px-3 py-1.5 rounded-full text-[11px] transition"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--cream)',
                  color: isActive ? 'var(--cream)' : 'var(--ink)',
                  border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                  fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer'}}
              >{c}</button>
            );
          })}
          {/* Custom concerns added by user */}
          {(userConcerns || []).filter(c => !COMMON_CONCERNS.some(cc => cc.toLowerCase() === c.toLowerCase())).map(c => (
            <button
              key={c}
              onClick={() => toggleConcern(c)}
              className="px-3 py-1.5 rounded-full text-[11px] transition flex items-center gap-1"
              style={{
                background: 'var(--accent)',
                color: 'var(--cream)',
                border: '1px solid var(--accent)',
                fontWeight: 500,
                cursor: 'pointer'}}
            >
              {c}
              <Icon name="X" size={9} style={{opacity:0.7}} />
            </button>
          ))}
          {/* + Add custom */}
          {buildConcernInputOpen ? (
            <input
              autoFocus
              type="text"
              value={buildConcernInputValue}
              onChange={(e) => setBuildConcernInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addCustomConcern(buildConcernInputValue); }
                else if (e.key === 'Escape') { setBuildConcernInputOpen(false); setBuildConcernInputValue(''); }
              }}
              onBlur={() => {
                if (buildConcernInputValue.trim()) addCustomConcern(buildConcernInputValue);
                else setBuildConcernInputOpen(false);
              }}
              placeholder="e.g. rosacea"
              className="text-[11px] px-3 py-1.5 rounded-full outline-none"
              style={{ background:'var(--cream)', border:'1px solid var(--accent)', color:'var(--ink)', width:'130px' }}
            />
          ) : (
            <button
              onClick={() => setBuildConcernInputOpen(true)}
              className="px-3 py-1.5 rounded-full text-[11px] transition flex items-center gap-1 hover:opacity-80"
              style={{ background:'transparent', color:'var(--accent)', border:'1px dashed var(--accent)', cursor:'pointer' }}
            >
              <Icon name="Plus" size={9} /> Add concern
            </button>
          )}
        </div>
      </section>
      )}
      {/* === STEP 3: ACTIVES YOU WANT TO USE === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 3 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {stepEyebrow(3)}
        <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Actives you want to use.</h3>
        <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Pick what you actually want in your plan. We'll schedule them around conflicts.</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_ACTIVES.map(a => {
            const isActive = buildSelectedActives.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggleActive(a.id)}
                className="px-3 py-1.5 rounded-full text-[11px] transition"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--cream)',
                  color: isActive ? 'var(--cream)' : 'var(--ink)',
                  border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                  fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer'}}
              >{a.label}</button>
            );
          })}
        </div>
        <p className="text-[10.5px] mt-3" style={{color:'var(--ink-soft)'}}>Skip this and we'll pick for you from your shelf.</p>
      </section>
      )}
      {/* === STEP 4: TOLERANCE + EXPERIENCE (May 2026 paired) ===
          Two related questions on one screen: how irritating
          can the plan get, and how many steps. Both inform
          the cap logic in generateBuildPlan. */}
      {!buildPlan && buildMode === 'guided' && buildStep === 4 && (
      <section className="rounded-[16px] px-5 py-5 space-y-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {stepEyebrow(4)}
        {/* Question 1: Tolerance */}
        <div>
          <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Your tolerance for actives.</h3>
          <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>How often the plan schedules irritating actives like retinoids + acids.</p>
          <div className="space-y-2">
            {tolOptions.map(opt => {
              const isActive = buildTolerance === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setBuildTolerance(opt.id)}
                  className="w-full text-left rounded-[12px] px-4 py-3 transition flex items-start gap-3"
                  style={{
                    background: 'var(--cream)',
                    border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                    cursor: 'pointer'}}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center"
                    style={{
                      background: isActive ? 'var(--accent)' : 'transparent',
                      border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)')}}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--cream)'}} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:isActive?600:500}}>{opt.label}</div>
                    <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>{opt.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtle divider */}
        <div style={{borderTop:'1px solid var(--line)'}} />

        {/* Question 2: Experience / step count */}
        <div>
          <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>How many steps feels right?</h3>
          <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Caps your routine length. You can always add more later.</p>
          <div className="space-y-2">
            {[
              { id: 'beginner', label: 'Beginner', sub: '3–4 steps · cleanser, treatment, moisturizer, SPF' },
              { id: 'medium',   label: 'Medium',   sub: '4–5 steps · adds a toner / hydrating layer' },
              { id: 'advanced', label: 'Advanced', sub: '5–7 steps · the full lineup (toner + essence + serum + oil)' },
            ].map(opt => {
              const isActive = buildExperience === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setBuildExperience(opt.id)}
                  className="w-full text-left rounded-[12px] px-4 py-3 transition flex items-start gap-3"
                  style={{
                    background: 'var(--cream)',
                    border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                    cursor: 'pointer'}}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center"
                    style={{
                      background: isActive ? 'var(--accent)' : 'transparent',
                      border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)')}}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--cream)'}} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:isActive?600:500}}>{opt.label}</div>
                    <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>{opt.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      )}
      {/* === STEP 5: BUDGET === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 5 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {stepEyebrow(5)}
        <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>What's your budget?</h3>
        <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Shapes which products we'd suggest if your shelf is missing pieces. Doesn't affect what you already own.</p>
        {(() => {
          const budgetOptions = [
            { id: 'drugstore', label: 'Drugstore', sub: 'Under $20 per product. CeraVe, The Ordinary, Cetaphil.' },
            { id: 'midrange',  label: 'Mid-range', sub: '$20–50. Paula\'s Choice, La Roche-Posay, Inkey List.' },
            { id: 'splurge',   label: 'Splurge',   sub: '$50+. SkinCeuticals, Drunk Elephant, Augustinus Bader.' },
            { id: 'mix',       label: 'Mix',       sub: 'Splurge where it earns it, save where it doesn\'t.' },
          ];
          return (
            <div className="space-y-2">
              {budgetOptions.map(opt => {
                const isActive = buildBudget === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setBuildBudget(opt.id)}
                    className="w-full text-left rounded-[12px] px-4 py-3 transition flex items-start gap-3"
                    style={{
                      background: 'var(--cream)',
                      border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                      cursor: 'pointer'}}
                  >
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center"
                      style={{
                        background: isActive ? 'var(--accent)' : 'transparent',
                        border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)')}}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--cream)'}} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:isActive?600:500}}>{opt.label}</div>
                      <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>{opt.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </section>
      )}
      {/* === STEP 6: HOME DEVICES (May 2026 — derm pass) ===
          Captures LED masks, microneedling, microcurrent, etc.
          Stored on user.homeDevices. Routine generation will use
          these in a future pass (microneedling = recovery night
          after, LED = daily-safe, etc.). For now: data capture
          only. */}
      {!buildPlan && buildMode === 'guided' && buildStep === 6 && (() => {
        const COMMON_DEVICES = [
          { id: 'led-mask',       label: 'Red light therapy mask',     sub: 'Full-face LED · daily-safe' },
          { id: 'led-eye',        label: 'Red light eye mask',         sub: 'Eye-area LED · daily-safe' },
          { id: 'microneedling',  label: 'Home microneedling',         sub: 'Qure-style, 0.25–0.5mm · 1–2×/week · recovery night after' },
          { id: 'microcurrent',   label: 'Microcurrent device',        sub: 'NuFACE, Solawave · up to 5×/week' },
          { id: 'high-frequency', label: 'High-frequency wand',        sub: 'Acne treatment · 2–3×/week' },
          { id: 'ice-roller',     label: 'Ice roller',                 sub: 'De-puffing · daily AM' },
          { id: 'gua-sha',        label: 'Gua sha',                    sub: 'Lymphatic + tension · daily' },
          { id: 'dermaplane',     label: 'Dermaplaning blade',         sub: 'Manual exfoliation · 1×/week max' },
        ];
        const toggleDevice = (id) => {
          const next = (homeDevices || []).includes(id)
            ? (homeDevices || []).filter(x => x !== id)
            : [...(homeDevices || []), id];
          setHomeDevices(next);
          saveData('homeDevices', next);
        };
        return (
          <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
            {stepEyebrow(6)}
            <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Any home devices?</h3>
            <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>LED, microneedling, microcurrent, dermaplane — we'll factor them into your week. Skip if none.</p>
            <div className="space-y-1.5">
              {COMMON_DEVICES.map(d => {
                const on = (homeDevices || []).includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDevice(d.id)}
                    className="w-full text-left rounded-[12px] px-3.5 py-2.5 flex items-start gap-3 transition hover:opacity-95"
                    style={{
                      background: on ? 'var(--cream)' : 'transparent',
                      border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                      cursor: 'pointer'}}
                    aria-pressed={on}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center transition"
                      style={{
                        background: on ? 'var(--accent)' : 'transparent',
                        border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line)')}}
                    >
                      {on && <Icon name="Check" size={9} style={{color:'var(--cream)'}} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px]" style={{color:'var(--ink)', fontWeight:on ? 600 : 500, letterSpacing:'-0.005em'}}>{d.label}</div>
                      <div className="text-[10.5px] mt-0.5" style={{color:'var(--ink-soft)'}}>{d.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] mt-3" style={{color:'var(--ink-soft)', fontStyle:'normal'}}>
              You can add or remove devices later from your profile. Selecting nothing is fine — we'll plan without devices.
            </p>
          </section>
        );
      })()}
      {/* === STEP 7: ANCHOR BASICS CHECK === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 7 && needsBasicsStep && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        {stepEyebrow(7)}
        <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Missing a basic.</h3>
        <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>We’ll build around what you own now. If you buy one later, come back and add it.</p>
        {(() => {
          const renderCategory = (row) => (
            <div className="rounded-[10px] px-3 py-2.5" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <Icon name="AlertCircle" size={12} style={{color:'var(--accent)'}} />
                  <span className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600}}>{row.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingProductId(null); setProductForm({ category: row.label }); setShowProductModal(true); }}
                  className="text-[10px] tracking-[0.18em] uppercase flex-shrink-0 hover:opacity-80"
                  style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                >Add later</button>
              </div>
              <div className="space-y-1 pl-[18px] pt-1">
                {(BASIC_RECOMMENDATIONS[row.id] || []).map(rec => (
                  <div key={`${row.id}-${rec.brand}-${rec.name}`} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="min-w-0">
                      <span style={{color:'var(--ink)', fontWeight:600}}>{rec.brand}</span>
                      <span style={{color:'var(--ink-soft)'}}> {rec.name} · {rec.note}</span>
                    </span>
                    <span className="text-[9.5px] tracking-[0.16em] uppercase flex-shrink-0" style={{color:'var(--accent)', fontWeight:700}}>{priceMarks(rec.priceLevel)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] pl-[18px] mt-2" style={{color:'var(--ink-soft)'}}>
                Buy whenever; add it here when it’s physically on your shelf.
              </p>
            </div>
          );
          return (
            <div className="space-y-1.5">
              {missingBasics.map(renderCategory)}
            </div>
          );
        })()}
      </section>
      )}
      {/* === NAV FOOTER (guided wizard, all steps) ===
          Back on Step 1 → mode picker. Back on later → walks
          backward. "Skip to build →" jumps straight to plan
          generation with whatever defaults the user has set
          (no obligation to answer every step). */}
      {!buildPlan && buildMode === 'guided' && (
        <>
          <section className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={() => { if (buildStep > 1) goBack(); else setBuildMode('choose'); }}
              className="text-[10px] tracking-[0.22em] uppercase flex items-center gap-1.5 transition hover:opacity-70"
              style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
            >
              <Icon name="ArrowLeft" size={12} /> Back
            </button>
            <button
              onClick={goNext}
              className="pill-btn primary"
              type="button"
              style={{minWidth:'180px'}}
            >
              {buildStep === finalBuildStep ? (
                <>
                  <Icon name="Sparkles" size={14} style={{marginRight:6}} />
                  Shape my routine
                </>
              ) : (
                <>
                  Continue
                  <Icon name="ArrowRight" size={14} style={{marginLeft:6}} />
                </>
              )}
            </button>
          </section>
          {/* Skip-to-build link — always available except on
              the final step (where Continue IS the build). */}
          {buildStep < finalBuildStep && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={runGenerator}
                className="text-[10px] tracking-[0.22em] uppercase transition hover:opacity-70"
                style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                title="Skip remaining questions — build with what you've answered so far"
              >
                <Icon name="Sparkles" size={11} style={{marginRight:6, verticalAlign:'middle'}} />
                Skip to build →
              </button>
            </div>
          )}
        </>
      )}
      {/* === FINAL PLAN VIEW ===
          Sequential wizard concludes here. Shows compact summary
          of ONLY the selected concerns + actives + tolerance +
          budget (per Jenni: not full library), the generated
          week-by-rhythm plan, and explicit Accept / Rebuild
          actions. Rebuild routes back to Step 1 with selections
          preserved (state isn't cleared), so the user can edit
          one piece without re-doing the whole wizard. */}
      {buildPlan && !buildPlanAccepted && (
        <section className="space-y-4">
          {/* Selections summary — only what was picked */}
          <div className="rounded-[16px] px-5 py-4" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
            <div className="text-[9px] tracking-[0.32em] uppercase mb-3" style={{color:'var(--ink-soft)', fontWeight:600}}>Your inputs</div>
            <div className="space-y-2">
              {/* Concerns */}
              {(userConcerns || []).length > 0 && (
                <div className="flex items-baseline gap-3">
                  <div className="text-[10px] tracking-[0.18em] uppercase flex-shrink-0 w-[80px]" style={{color:'var(--ink-soft)', fontWeight:600}}>Concerns</div>
                  <div className="text-[12px] leading-snug" style={{color:'var(--ink)', fontWeight:500}}>{(userConcerns || []).join(', ')}</div>
                </div>
              )}
              {/* Actives */}
              {buildSelectedActives.size > 0 && (
                <div className="flex items-baseline gap-3">
                  <div className="text-[10px] tracking-[0.18em] uppercase flex-shrink-0 w-[80px]" style={{color:'var(--ink-soft)', fontWeight:600}}>Actives</div>
                  <div className="text-[12px] leading-snug" style={{color:'var(--ink)', fontWeight:500}}>{Array.from(buildSelectedActives).map(activeLabelFor).join(', ')}</div>
                </div>
              )}
              {/* Tolerance */}
              <div className="flex items-baseline gap-3">
                <div className="text-[10px] tracking-[0.18em] uppercase flex-shrink-0 w-[80px]" style={{color:'var(--ink-soft)', fontWeight:600}}>Tolerance</div>
                <div className="text-[12px] leading-snug" style={{color:'var(--ink)', fontWeight:500, textTransform:'capitalize'}}>{buildTolerance}</div>
              </div>
              {/* Budget */}
              <div className="flex items-baseline gap-3">
                <div className="text-[10px] tracking-[0.18em] uppercase flex-shrink-0 w-[80px]" style={{color:'var(--ink-soft)', fontWeight:600}}>Budget</div>
                <div className="text-[12px] leading-snug" style={{color:'var(--ink)', fontWeight:500, textTransform:'capitalize'}}>{buildBudget === 'midrange' ? 'Mid-range' : buildBudget}</div>
              </div>
            </div>
          </div>
          {/* Plan output */}
          <div className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-[9px] tracking-[0.32em] uppercase mb-1" style={{color:'var(--accent)', fontWeight:600}}>Your weekly plan</div>
                <h3 className="text-[20px] leading-tight" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Your week.</h3>
              </div>
              {buildPlanAccepted && (
                <div className="text-[9.5px] tracking-[0.22em] uppercase px-2 py-1 rounded-full" style={{background:'var(--accent-blue)', color:'var(--ink)', fontWeight:600}}>Accepted</div>
              )}
            </div>
            {/* === Week-at-a-glance strip removed June 2026 (per Jenni) ===
                The 7-day strip + per-day expander was duplicating the
                canonical by-day grid in the Rotation sub-tab (RegimenOccasionsView).
                Refine should be about "edit the routine," not "preview the week"
                — that lens lives in Rotation. */}
            {/* === June 2026 (per Jenni): post-accept full daily plan ===
                Before this, the accepted-state view rendered only
                `buildPlan.slotted` which is actives-only by design (see
                acceptPlan comment block — basics like cleanser / SPF /
                moisturizer go into buildPlan.am[d] / pm[d] but never into
                slotted). User couldn't tell what the full daily routine
                was after accepting. Now: when accepted, render a Full Plan
                card listing every unique product across am/pm across days
                — with AM/PM/AM·PM tags + day codes — derived from the
                union of buildPlan.am + buildPlan.pm IDs resolved through
                products[]. The slotted list still renders pre-accept for
                tweaking the AI's first pass. */}
            {buildPlanAccepted && buildPlan && (() => {
              const dayShortLabels = ['S','M','T','W','T','F','S'];
              const collect = {};
              const stamp = (slot, id, dow) => {
                if (!id) return;
                if (!collect[id]) collect[id] = { am: new Set(), pm: new Set() };
                collect[id][slot].add(dow);
              };
              for (let d = 0; d < 7; d++) {
                (buildPlan.am?.[d] || []).forEach(id => stamp('am', id, d));
                (buildPlan.pm?.[d] || []).forEach(id => stamp('pm', id, d));
              }
              const rows = Object.entries(collect)
                .map(([id, slots]) => {
                  const product = (products || []).find(p => p.id === id);
                  if (!product) return null;
                  const amDays = [...slots.am].sort((a, b) => a - b);
                  const pmDays = [...slots.pm].sort((a, b) => a - b);
                  const allDays = [...new Set([...amDays, ...pmDays])].sort((a, b) => a - b);
                  const slotTag = amDays.length && pmDays.length ? 'AM · PM'
                    : amDays.length ? 'AM' : pmDays.length ? 'PM' : '—';
                  const dayCodes = allDays.length === 7 ? 'Daily'
                    : allDays.length === 0 ? '—'
                    : allDays.map(d => dayShortLabels[d]).join('·');
                  return { product, slotTag, dayCodes, amDays, pmDays };
                })
                .filter(Boolean)
                .sort((a, b) => {
                  // Cleanser → toner → essence → serum → moisturizer → oil → SPF
                  const order = ['cleanser','toner','essence','serum','treatment','moisturizer','oil','sunscreen','spf'];
                  const ai = order.findIndex(o => (a.product.category || '').toLowerCase().includes(o));
                  const bi = order.findIndex(o => (b.product.category || '').toLowerCase().includes(o));
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                });
              if (rows.length === 0) return null;
              return (
                <div className="rounded-[14px] border p-3 mb-4" style={{background:'var(--cream)', borderColor:'var(--line)'}}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[10px] tracking-[0.22em] uppercase" style={{color:'var(--accent)', fontWeight:700}}>Full daily plan</div>
                    <div className="text-[10px]" style={{color:'var(--ink-soft)'}}>{rows.length} products</div>
                  </div>
                  <div className="space-y-1.5">
                    {rows.map((r, i) => (
                      <div key={r.product.id} className="rounded-[10px] border px-3 py-2 flex items-center gap-3" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
                        <div className="flex-1 min-w-0">
                          <div className="text-[8.5px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{r.product.brand || (r.product.category || '').toUpperCase()}</div>
                          <div className="text-[12.5px] leading-tight" style={{color:'var(--ink)', fontWeight:650}}>{r.product.name || r.product.displayName}</div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span className="text-[8.5px] tracking-[0.14em] uppercase rounded-full px-2 py-0.5" style={{background:'var(--accent-blue)', color:'var(--ink)', fontWeight:700}}>{r.slotTag}</span>
                          <span className="text-[9px]" style={{color:'var(--ink-soft)'}}>{r.dayCodes}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {buildPlan.slotted.length > 0 && !buildPlanAccepted ? (
              <div className="space-y-2 mb-4">
                <p className="text-[10.5px] mb-1" style={{color:'var(--ink-soft)'}}>
                  AI's first pass — tweak any day or slot, then accept.
                </p>
                {buildPlan.slotted.map((s, i) => {
                  const dayShortLabels = ['S','M','T','W','T','F','S'];
                  const expanded = isBuildCardExpanded(s.product.id, i);
                  const dayCodes = s.days.length === 7 ? 'Daily' : s.days.length === 0 ? '—' : s.days.map(d => dayShortLabels[d]).join('·');
                  const slotTag = s.am && s.pm ? 'AM · PM' : s.am ? 'AM' : s.pm ? 'PM' : '—';
                  return (
                    <div key={i} className="rounded-[12px] overflow-hidden" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                      <button
                        type="button"
                        onClick={() => buildPlanAccepted ? null : toggleBuildEditExpand(s.product.id)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3"
                        style={{cursor: buildPlanAccepted ? 'default' : 'pointer'}}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500}}>{s.product.name}</div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-[9.5px] tracking-[0.18em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>{dayCodes}</span>
                            <span className="text-[9.5px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{slotTag}</span>
                          </div>
                        </div>
                        {!buildPlanAccepted && (
                          <Icon name="ChevronDown" size={12} style={{color:'var(--ink-soft)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.18s', flexShrink:0}} />
                        )}
                      </button>
                      {!buildPlanAccepted && expanded && (() => {
                        // Strip the redundant day prefix from the
                        // generator's explanation (e.g. "Mon/Wed/Fri
                        // — every other day for recovery time" →
                        // "every other day for recovery time").
                        // The days are already shown in the collapsed
                        // row header, no need to repeat them.
                        const rationale = (s.explanation || '').split(/\s—\s/).slice(1).join(' — ') || s.explanation || '';
                        return (
                          <div className="px-4 pb-3 pt-1 border-t" style={{borderColor: 'var(--line)'}}>
                            {/* One row: AM/PM toggles + day circles */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); togglePlanSlot(s.product.id, 'am'); }}
                                  className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full transition"
                                  style={{
                                    background: s.am ? 'var(--accent)' : 'transparent',
                                    color: s.am ? 'var(--cream)' : 'var(--ink-soft)',
                                    border: '1px solid ' + (s.am ? 'var(--accent)' : 'var(--line)'),
                                    fontWeight: 600,
                                    cursor: 'pointer'}}
                                >AM</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); togglePlanSlot(s.product.id, 'pm'); }}
                                  className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full transition"
                                  style={{
                                    background: s.pm ? 'var(--accent)' : 'transparent',
                                    color: s.pm ? 'var(--cream)' : 'var(--ink-soft)',
                                    border: '1px solid ' + (s.pm ? 'var(--accent)' : 'var(--line)'),
                                    fontWeight: 600,
                                    cursor: 'pointer'}}
                                >PM</button>
                              </div>
                              <div className="flex gap-1">
                                {[0,1,2,3,4,5,6].map(d => {
                                  const on = s.days.includes(d);
                                  return (
                                    <button
                                      key={d}
                                      onClick={(e) => { e.stopPropagation(); togglePlanDay(s.product.id, d); }}
                                      className="w-6 h-6 rounded-full text-[9.5px] transition flex items-center justify-center"
                                      style={{
                                        background: on ? 'var(--accent)' : 'transparent',
                                        color: on ? 'var(--cream)' : 'var(--ink-soft)',
                                        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                                        fontWeight: 600,
                                        cursor: 'pointer'}}
                                    >{dayShortLabels[d]}</button>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Rationale only — days stripped */}
                            {rationale && (
                              <div className="text-[10px] mt-2" style={{color:'var(--ink-soft)'}}>{rationale}</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] mb-4" style={{color:'var(--ink-soft)'}}>No actives on your shelf yet — your basics are still scheduled. Add a few products and rebuild.</p>
            )}
            {/* === ADVISORIES (May 2026 — clinical pass) ===
                Soft user-facing notes from generateBuildPlan: cycle-aware
                retinoid sting, tolerance auto-preset, under-18 protocol,
                post-menopausal guidance. Distinct from the hard skipped
                list below and from missing-basics — these don't change
                scheduling, they just keep the user informed. */}
            {buildPlan.advisories && buildPlan.advisories.length > 0 && (
              <div className="rounded-[12px] border p-3 mb-3" style={{ background: 'var(--surface-info)', borderColor: 'rgba(47,111,136,0.32)' }}>
                <div className="text-[9px] tracking-[0.28em] uppercase mb-1.5" style={{ color: 'var(--accent-sage-dark)', fontWeight: 700 }}>Notes</div>
                {buildPlan.advisories.map((a, i) => (
                  <div key={i} className="text-[11.5px] leading-snug mb-1" style={{ color: 'var(--ink)' }}>
                    <strong style={{ color: 'var(--accent-sage-dark)' }}>{(a.kind || '').toUpperCase().replace(/-/g, ' ')}:</strong> {a.message}
                  </div>
                ))}
              </div>
            )}
            {buildPlan.missingBasics.length > 0 && (
              <p className="text-[11.5px] mb-3 px-3 py-2 rounded-[10px]" style={{background:'rgba(201,138,138,0.08)', color:'var(--rose)', border:'1px solid rgba(201,138,138,0.28)'}}>
                <Icon name="AlertCircle" size={10} style={{marginRight:4, verticalAlign:'middle'}} />
                Missing from shelf: {buildPlan.missingBasics.join(', ')}. The plan still works — add these for a complete routine.
              </p>
            )}
            {/* === SKIPPED (May 2026 — safety filters) ===
                Products dropped from the plan by the safety filters
                (pregnancy, fragrance sensitivity, Rx conflict). Quiet
                muted card so the user sees why a product they own
                didn't make it in. */}
            {Array.isArray(buildPlan.skipped) && buildPlan.skipped.length > 0 && (
              <div className="text-[11px] mb-3 px-3 py-2 rounded-[10px]" style={{background:'var(--cream)', color:'var(--ink-soft)', border:'1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.24em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:700}}>Skipped from your plan</div>
                <ul className="space-y-0.5">
                  {buildPlan.skipped.map((s, i) => (
                    <li key={`skipped-${i}`} className="leading-snug">
                      <span style={{color:'var(--ink)', fontWeight:600}}>{s.productName || 'Product'}</span>
                      <span> — {s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* === PLAN COMMIT (Wave 11, May 30 2026 — Pattern C) ===
                Was: ad-hoc Accept/Refine button cluster + bespoke
                "Plan accepted" confirm card. Now: shared
                <PlanCommitStrip /> primitive that Build, Procedure
                briefing, Event prep, and SkinLog will all adopt for
                a unified commit grammar. The "See full routine"
                affordance moves below the strip as a quiet link so
                the strip stays generic across surfaces. */}
            {!buildPlanAccepted && buildPlan.slotted.length > 0 && (
              <PlanCommitStrip
                state="draft"
                onAccept={acceptPlan}
                onDiscard={rebuildFromStart}
                acceptLabel="Accept this plan"
                discardLabel="Start over"
              />
            )}
            {!buildPlanAccepted && buildPlan.slotted.length === 0 && (
              <div className="flex gap-2">
                <button
                  onClick={rebuildFromStart}
                  className="flex-1 pill-btn secondary"
                  type="button"
                >
                  <Icon name="RotateCcw" size={14} style={{marginRight:6}} />
                  Start over
                </button>
              </div>
            )}
            {buildPlanAccepted && (
              <div className="space-y-3">
                <PlanCommitStrip
                  state="accepted"
                  statusLabel="Plan accepted"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRoutinePreviewOpen(true)}
                    className="text-[9.5px] tracking-[0.2em] uppercase whitespace-nowrap"
                    style={{ color: 'var(--accent-sage-dark)', fontWeight: 700 }}
                  >
                    See full routine →
                  </button>
                </div>

                {/* Cadence-saved caption + duplicate week strip +
                    See today / See your week buttons retired May
                    2026 per Jenni — the Week at a glance above
                    handles peek-by-day, and the two surface-
                    routing buttons added noise. The add-product
                    pills below are the next action. */}

                {/* ===== ADD A PRODUCT — both pills always visible =====
                    Per Jenni (May 2026): "Pick from shelf" used to
                    only appear when shelf had inactive items. Always
                    showing it keeps the pair predictable; if there
                    are no inactives the user can still tap to open
                    the picker (which will explain the empty state
                    inline). */}
                {!buildAddSheet && (() => {
                  const scheduledIds = new Set((buildPlan?.slotted || []).map(s => s.product.id));
                  const inactivesCount = (products || []).filter(p => !p.endDate && !scheduledIds.has(p.id)).length;
                  return (
                    <div className="space-y-2" style={{marginTop:8}}>
                      <button
                        onClick={() => {
                          setBuildAddPriorIds(new Set((products || []).map(p => p.id)));
                          setBuildPendingAdd(true);
                          setEditingProductId(null);
                          setShowProductModal(true);
                        }}
                        className="w-full pill-btn secondary"
                        type="button"
                      >
                        <Icon name="Plus" size={13} style={{marginRight:6}} />
                        Add new product
                      </button>
                      <button
                        onClick={() => { setBuildAddSheet(true); setBuildAddStage('shelf-pick'); setBuildAddProposal(null); setBuildAddQueue([]); }}
                        className="w-full pill-btn secondary"
                        type="button"
                        title={inactivesCount > 0
                          ? 'Activate a shelf product — Frida will suggest a cadence'
                          : 'Open the shelf picker'}
                      >
                        <Icon name="Plus" size={13} style={{marginRight:6}} />
                        Pick from shelf{inactivesCount > 0 ? ` · ${inactivesCount} not in plan` : ''}
                      </button>
                    </div>
                  );
                })()}

                {buildAddSheet && (
                  <div
                    className="rounded-[18px] p-4 space-y-3"
                    style={{
                      background:'var(--cream)',
                      border: '1px solid var(--line)',
                      marginTop:8}}
                  >
                    {/* Sheet header */}
                    <div className="flex items-center justify-between">
                      <div className="text-[9.5px] tracking-[0.24em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>
                        {buildAddStage === 'shelf-pick' && 'From your shelf'}
                        {buildAddStage === 'propose' && 'Frida suggests'}
                      </div>
                      <button
                        onClick={() => { setBuildAddSheet(false); setBuildAddStage('chooser'); setBuildAddProposal(null); setBuildAddQueue([]); }}
                        className="text-[10px] tracking-[0.18em] uppercase"
                        style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                        type="button"
                      >
                        Close
                      </button>
                    </div>

                    {/* === STAGE: SHELF PICKER === */}
                    {buildAddStage === 'shelf-pick' && (() => {
                      const scheduledIds = new Set((buildPlan?.slotted || []).map(s => s.product.id));
                      const candidates = (products || []).filter(p => !p.endDate && !scheduledIds.has(p.id));
                      if (candidates.length === 0) {
                        return (
                          <div className="text-center py-6">
                            <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>Everything on your shelf is already in the plan.</p>
                            <button
                              onClick={() => setBuildAddStage('chooser')}
                              className="mt-3 text-[10px] tracking-[0.18em] uppercase"
                              style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                              type="button"
                            >
                              Back
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                            {candidates.map(p => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setBuildAddQueue([p.id]);
                                  setBuildAddStage('propose');
                                }}
                                className="w-full p-3 rounded-[12px] border text-left transition hover:bg-[var(--cream-deep)] flex items-center gap-3"
                                style={{borderColor: 'var(--line)', background:'var(--cream-deep)', cursor:'pointer'}}
                                type="button"
                              >
                                <div className="flex-1 min-w-0">
                                  {p.brand && (
                                    <div className="text-[9px] tracking-[0.2em] uppercase truncate" style={{color:'var(--ink-soft)', fontWeight:600}}>{p.brand}</div>
                                  )}
                                  <div className="text-[12.5px] truncate" style={{color:'var(--ink)', fontWeight:600}}>{p.name}</div>
                                </div>
                                <Icon name="ChevronRight" size={13} style={{color:'var(--ink-soft)'}} />
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setBuildAddStage('chooser')}
                            className="text-[10px] tracking-[0.18em] uppercase"
                            style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                            type="button"
                          >
                            ← Back
                          </button>
                        </div>
                      );
                    })()}

                    {/* === STAGE 3: PROPOSE SLOT — shared component */}
                    {buildAddStage === 'propose' && buildAddProposal && (
                      <ProposeSlotCard
                        proposal={buildAddProposal}
                        queue={buildAddQueue}
                        products={products}
                        onClose={closeProposal}
                        onCancel={cancelProposal}
                        onAccept={runAcceptProposal}
                        onToggleDay={toggleProposalDay}
                        onFlipSlot={flipProposalSlot}
                      />
                    )}
                  </div>
                )}

                <button
                  onClick={rebuildFromStart}
                  className="w-full text-[10px] tracking-[0.22em] uppercase transition hover:opacity-70 py-2"
                  type="button"
                  style={{color:'var(--ink-soft)', fontWeight:600}}
                >
                  <Icon name="RotateCcw" size={11} style={{marginRight:6, verticalAlign:'middle'}} />
                  Build a different plan
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* === ROUTINE PREVIEW MODAL ===
          Renders the full plan grouped into AM + PM lists. Each row
          shows the product, the days-of-week cadence as small day
          pills, and the explanation. Read-only — edits still happen
          on the Build page itself. */}
      {routinePreviewOpen && buildPlan && (() => {
        const dayShort = ['S','M','T','W','T','F','S'];
        const slotted = Array.isArray(buildPlan.slotted) ? buildPlan.slotted : [];
        const amItems = slotted.filter(s => s && s.am);
        const pmItems = slotted.filter(s => s && s.pm);
        const RowList = ({ items, label }) => (
          <div>
            <div className="text-[9.5px] tracking-[0.28em] uppercase mb-2" style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>{label}</div>
            {items.length === 0 ? (
              <p className="text-[12px] mb-3" style={{ color: 'var(--ink-soft)' }}>Nothing scheduled for {label.toLowerCase()} yet.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {items.map((s, i) => {
                  const cadence = (s.days && s.days.length === 7) ? 'Daily' : (s.days && s.days.length === 0) ? '—' : (s.days || []).map(d => dayShort[d]).join('·');
                  const rationale = (s.explanation || '').split(/\s—\s/).slice(1).join(' — ') || s.explanation || '';
                  return (
                    <div key={(s.product && s.product.id) + '-' + label + '-' + i} className="rounded-[10px] border p-3" style={{ background: 'var(--cream-deep)', borderColor: 'var(--line)' }}>
                      <div className="text-[12.5px] leading-tight" style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.product && s.product.name}</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-[9.5px] tracking-[0.18em] uppercase" style={{ color: 'var(--accent)', fontWeight: 700 }}>{cadence}</span>
                        <div className="flex gap-0.5">
                          {[0,1,2,3,4,5,6].map(d => {
                            const on = s.days && s.days.includes(d);
                            return (
                              <span key={d} className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center" style={{ background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--cream)' : 'var(--ink-soft)', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), fontWeight: 700 }}>{dayShort[d]}</span>
                            );
                          })}
                        </div>
                      </div>
                      {rationale && <div className="text-[10.5px] mt-1.5 leading-snug" style={{ color: 'var(--ink-soft)' }}>{rationale}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
        return (
          <Modal
            eyebrow="Routine"
            title="Your full week"
            onClose={() => setRoutinePreviewOpen(false)}
          >
            <div className="p-4 md:p-6">
              <p className="text-[11.5px] mb-4 leading-snug" style={{ color: 'var(--ink-soft)' }}>
                {buildPlanAccepted ? 'Your accepted plan.' : 'Preview before accepting. Tweak any row on the Build page.'}
              </p>
              <div className="space-y-4">
                <RowList items={amItems} label="AM" />
                <RowList items={pmItems} label="PM" />
              </div>
              {buildPlan.missingBasics && buildPlan.missingBasics.length > 0 && (
                <div className="mt-4 px-3 py-2 rounded-[10px] text-[11px] leading-snug" style={{ background: 'rgba(201,138,138,0.08)', color: 'var(--rose)', border: '1px solid rgba(201,138,138,0.28)' }}>
                  <strong>Missing from shelf:</strong> {buildPlan.missingBasics.join(', ')}. The plan still works — add these for a complete routine.
                </div>
              )}
              {/* === T3 FIX (May 2026) ===
                  Safety-net pill for any unsaved tweak the user made
                  inside the preview. After Agent A's auto-save day
                  toggles SHOULD commit instantly, but if a code path
                  ever bypasses persistRefinedPlan the user still gets
                  a visible cue to Accept on the Build page. */}
              {!buildPlanAccepted && buildPlan && Array.isArray(buildPlan.slotted) && buildPlan.slotted.length > 0 && (
                <div className="text-[10px] tracking-[0.2em] uppercase mt-3" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  Tweaks unsaved — Accept to apply
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setRoutinePreviewOpen(false)}
                  className="text-[10px] tracking-[0.2em] uppercase px-4 py-2 rounded-full"
                  style={{ background: 'var(--ink)', color: 'var(--cream)', fontWeight: 700 }}
                >
                  Back to refine
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
  })();
};
