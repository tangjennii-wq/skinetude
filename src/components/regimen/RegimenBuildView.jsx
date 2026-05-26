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
  toggleProposalDay,
}) => {
  return (() => {
  // === BUILD WIZARD (sequential, May 2026) ===
  // Six sequential steps → one final weekly plan. Each step
  // owns its own screen; Back / Continue navigate between them.
  // The final plan view shows a compact summary of selections
  // (only what was picked, not the full library) and an
  // explicit Accept / Rebuild path.
  //   Step 1: Concerns
  //   Step 2: Actives the user wants to use
  //   Step 3: Tolerance for irritating actives
  //   Step 4: Budget
  //   Step 5: Home devices (May 2026 — derm pass)
  //   Step 6: Anchor basics check
  //   → Plan view (after Step 5)
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
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
    });
    setBuildPlan(plan);
    setBuildPlanAccepted(false);
  };
  const goNext = () => {
    if (buildStep < 6) setBuildStep(s => s + 1);
    else runGenerator();
  };
  const goBack = () => setBuildStep(s => Math.max(1, s - 1));
  const rebuildFromStart = () => {
    setBuildPlan(null);
    setBuildPlanAccepted(false);
    setBuildStep(1);
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
      experience: buildAnswers.experience || 'medium',
    });
    setBuildPlanAccepted(false);
    toast('Rhythm refreshed — review and accept.', 'info');
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
        });
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
      });
    });
    setProducts(updated);
    saveData('products', updated);
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
            pmSkipped: (existingLog.pmSkipped || []).filter(id => todayPmIds.includes(id)),
          }
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
            submitted: false,
          };
      const newRegimenLogs = existingLog
        ? (regimenLogs || []).map(r => r.date === todayKey ? nextLog : r)
        : [nextLog, ...(regimenLogs || [])];
      setRegimenLogs(newRegimenLogs);
      saveData('regimenLogs', newRegimenLogs).catch(() => {});
    } catch (e) {
      console.warn('[acceptPlan today-log refresh failed]', e);
    }
    // === Save wizard answers (May 2026 — rebuild cadence) ===
    // Persist the inputs that produced this plan so Refresh (1-tap
    // rebuild) and Tweak (pre-filled wizard) can replay later
    // without re-asking. lastBuiltAt drives the 4-week soft prompt.
    const newAnswers = {
      concerns: Array.isArray(userConcerns) ? userConcerns : [],
      actives: Array.from(buildSelectedActives || []),
      tolerance: buildTolerance,
      experience: buildExperience || 'medium',
      budget: buildBudget,
      devices: Array.isArray(homeDevices) ? homeDevices : [],
      lastBuiltAt: new Date().toISOString(),
      buildCount: ((buildAnswers && buildAnswers.buildCount) || 0) + 1,
    };
    setBuildAnswers(newAnswers);
    saveData('buildAnswers', newAnswers);
    // Reset the soft-prompt dismissal — we just built; the
    // nudge shouldn't reappear until the rhythm ages again.
    setBuildRefreshNudgeDismissed(false);
    setBuildPlanAccepted(true);
    toast('Plan accepted. Cadence saved to your shelf.', 'info');
    setCoverRoutineRebuildToken(t => t + 1);
  };
  // === Edit handlers (mutate buildPlan in place) ===
  // Let the user fine-tune the AI's suggestion BEFORE accepting.
  // The buildPlan state is the source of truth until acceptPlan
  // commits it to product.cadence + useTimes.
  const togglePlanDay = (productId, dayIdx) => {
    setBuildPlan(prev => prev ? {
      ...prev,
      slotted: prev.slotted.map(s => {
        if (s.product.id !== productId) return s;
        const has = s.days.includes(dayIdx);
        const days = has ? s.days.filter(d => d !== dayIdx) : [...s.days, dayIdx].sort();
        return { ...s, days };
      }),
    } : prev);
  };
  const togglePlanSlot = (productId, slotKey) => {
    setBuildPlan(prev => prev ? {
      ...prev,
      slotted: prev.slotted.map(s => {
        if (s.product.id !== productId) return s;
        return { ...s, [slotKey]: !s[slotKey] };
      }),
    } : prev);
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
            Tell Étude what you're working on, the actives you want to use, your patience, your budget — and we'll lay out a cadence that respects how your skin actually responds.
          </p>
          {!buildPlan && buildMode === 'guided' && (
            <div className="mt-3 flex items-center gap-1.5">
              {[1,2,3,4,5,6].map(n => (
                <div key={n} className="h-[3px] flex-1 rounded-full" style={{background: n <= buildStep ? 'var(--accent)' : 'var(--line)'}} />
              ))}
            </div>
          )}
        </section>
      )}
      {/* === REFINE PAGE (May 2026 v2 — consolidated) ===
          Post-build users land on this calm routine-evolution
          control center. THREE sections (cut from 4):
            1. Quick Refinements — 7 AI-prompt intent cards
               (irritation, glow, recovery, barrier, simplify,
               travel, climate). Climate moved here from the old
               Evolve section — it was always an AI prompt, not a
               profile update.
            2. Evolve Your Routine — discrete actions:
               Add product / device / Rx / procedure (additive
               events), plus one consolidated "Update your skin
               profile" tile that replaces three deep-link tiles
               (goals, sensitivity) AND the old standalone
               "Reassess your skin profile" card. Single door,
               full ProfileModal wizard behind it.
            3. Fresh Start — prominent CTA with confirmation.
          Pre-build users keep the wizard (block below). */}
      {!buildPlan && buildMode === 'choose' && userHasBuiltPattern(products) && (() => {
        const quickRefinements = [
          { id: 'irritation', label: 'Reduce Irritation', icon: 'Leaf',     prompt: 'My skin is irritated and I want to dial back. What in my current routine could be triggering it, and what would you swap or pause?' },
          { id: 'glow',       label: 'Increase Glow',     icon: 'Sparkles', prompt: 'I want more glow. Where can I tighten my current routine to push radiance — actives, timing, or layering?' },
          { id: 'recovery',   label: 'Add Recovery',      icon: 'Moon',     prompt: 'I need more recovery nights. Look at my rotation and suggest where to space actives further apart or add barrier-only evenings.' },
          { id: 'barrier',    label: 'Strengthen Barrier',icon: 'Shield',   prompt: 'My barrier feels compromised. Audit my routine and propose changes to reinforce ceramides, lipids, and reduce barrier stressors.' },
          { id: 'simplify',   label: 'Simplify Routine',  icon: 'Minus',    prompt: 'My routine feels heavy. What can I remove or consolidate without losing the effects I care about?' },
          { id: 'travel',     label: 'Prepare for Travel',icon: 'Plane',    prompt: 'I am traveling soon. Propose a pared-down version of my routine that holds the line — what stays, what goes, what changes about cadence.' },
          // Moved from Section 2 Evolve (May 2026 v2 per Jenni) — climate
          // was always an AI-prompt sheet, not a profile update. Living in
          // Quick Refinements matches its actual shape.
          { id: 'climate',    label: 'Climate / Season',  icon: 'Sun',      prompt: 'My climate or season has shifted. Walk me through how to adjust my routine — hydration, occlusives, SPF intensity, actives — for the change.' },
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
            onClick: () => { setEditingProductId(null); setProductForm(null); setShowProductModal(true); },
          },
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
            onClick: () => setAddDeviceSheet(true),
          },
          {
            id: 'add-rx',
            icon: 'FileText',
            title: 'Add or update prescription',
            sub: 'Topicals prescribed by your provider',
            // Curated Rx picker (May 2026 per Jenni): tretinoin,
            // spironolactone, accutane, etc. Custom routes to
            // manual ProductModal entry with prescription tag.
            onClick: () => setAddRxSheet(true),
          },
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
            },
          },
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
            onClick: () => { setProfileWizardStep(0); setShowProfileModal(true); },
          },
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
                border: '1px solid rgba(192, 95, 60, 0.22)',
              }}
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

            {/* === QUICK REFINEMENTS ===
                Single-row horizontal scroll on BOTH mobile and desktop
                (May 2026 per Jenni). 7 intents fit one row; users scroll
                horizontally rather than wrapping to multiple rows. Tile
                width is fixed (~108px) so spacing reads consistent. */}
            <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Quick Refinements</div>
              <p className="text-[12.5px] mb-4" style={{color:'var(--ink)', fontWeight:500}}>Small changes. Stronger results.</p>
              <div
                className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1"
                style={{scrollSnapType:'x proximity', WebkitOverflowScrolling:'touch'}}
              >
                {quickRefinements.map(qr => (
                  <button
                    key={qr.id}
                    type="button"
                    onClick={() => openRefineSheet(qr)}
                    className="flex-shrink-0 rounded-[12px] px-2.5 py-3.5 flex flex-col items-center justify-between gap-2 transition hover:bg-[var(--cream)] hover:border-[var(--accent-soft)]"
                    style={{background:'var(--cream)', border:'1px solid var(--line)', cursor:'pointer', minHeight:118, width:108, scrollSnapAlign:'start'}}
                    title={qr.label}
                  >
                    <Icon name={qr.icon} size={18} style={{color:'var(--ink-soft)'}} />
                    <div className="text-[10.5px] leading-tight text-center" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.005em'}}>{qr.label}</div>
                    <Icon name="ArrowRight" size={10} style={{color:'var(--ink-soft)'}} />
                  </button>
                ))}
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
                <div className="mt-3 pt-3 border-t text-[11.5px] leading-snug" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>
                  More intents land here — tone up acid days, reset retinol pace, switch to fragrance-free, prep for a procedure. Tell us what you want next and we'll add it.
                </div>
              )}
            </section>

            {/* === EVOLVE YOUR ROUTINE === */}
            <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Evolve Your Routine</div>
              <p className="text-[12.5px] mb-4" style={{color:'var(--ink)', fontWeight:500}}>Add new tools, update inputs, and adjust your regimen.</p>
              <div className="space-y-1">
                {evolveRows.map((row, i) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={row.onClick}
                    className="w-full text-left rounded-[12px] px-4 py-3.5 flex items-center gap-3 transition hover:bg-[var(--cream)]"
                    style={{background:'var(--cream)', border:'1px solid var(--line)', cursor:'pointer'}}
                  >
                    <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
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
            <div className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
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
                  style={{background:'var(--cream)', border:'1px solid var(--line)'}}
                >
                  <p className="text-[11px] leading-tight" style={{color:'var(--ink)'}}>
                    Rhythm is {lastBuiltLabel}. Worth a look — skin shifts.
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
                  <div className="mt-3 pt-3 border-t" style={{borderColor:'var(--line)'}}>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-[9px] tracking-[0.26em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>Week at a glance</div>
                      <button
                        type="button"
                        onClick={() => setRegimenView('occasions')}
                        className="text-[9px] tracking-[0.18em] uppercase italic transition hover:opacity-70"
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
                                fontWeight: 600,
                              }}
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
                        <div className="mt-2 rounded-[12px] px-3 py-2.5" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
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
                                <div className="text-[10.5px] italic" style={{color:'var(--ink-soft)', opacity:0.6}}>—</div>
                              ) : am.map(p => (
                                <div key={p.id} className="text-[11px] leading-tight mb-0.5 truncate" style={{color:'var(--ink)', fontWeight:500}}>{p.name}</div>
                              ))}
                            </div>
                            <div>
                              <div className="text-[8.5px] tracking-[0.22em] uppercase mb-1 flex items-center gap-1" style={{color:'var(--ink-soft)', fontWeight:600}}>
                                <Icon name="Moon" size={9} /> PM
                              </div>
                              {pm.length === 0 ? (
                                <div className="text-[10.5px] italic" style={{color:'var(--ink-soft)', opacity:0.6}}>—</div>
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
                      style={{background:'var(--cream)', border:'1px solid var(--line)'}}
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
                  border:'1px solid var(--line)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[9.5px] tracking-[0.24em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>
                    {buildAddStage === 'chooser' && 'Add a product'}
                    {buildAddStage === 'shelf-pick' && 'From your shelf'}
                    {buildAddStage === 'propose' && 'Étude suggests'}
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
                          style={{background:'var(--cream-deep)', border:'1px solid var(--line)', cursor:'pointer'}}
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="text-[13px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>From your shelf</span>
                            <span className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>{unscheduledCount} not in plan</span>
                          </div>
                          <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                            Activate something you already own. Étude will suggest a cadence.
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
                        style={{background:'var(--cream-deep)', border:'1px solid var(--line)', cursor:'pointer'}}
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
                            style={{borderColor:'var(--line)', background:'var(--cream-deep)', cursor:'pointer'}}
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
        <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
          <div className="text-[9px] tracking-[0.32em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>Step 1</div>
          <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>How do you want to build?</h3>
          <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Either path ends at the same weekly plan — pick whichever fits.</p>
          <div className="space-y-2">
            <button
              onClick={() => { setBuildMode('guided'); setBuildStep(1); }}
              className="w-full text-left rounded-[12px] px-4 py-3 transition flex items-start gap-3"
              style={{background:'var(--cream)', border:'1px solid var(--line)', cursor:'pointer'}}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{background:'var(--cream-deep)', color:'var(--accent)', border:'1px solid var(--line)'}}>
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
              style={{background:'var(--cream)', border:'1px solid var(--line)', cursor:'pointer'}}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{background:'var(--cream-deep)', color:'var(--accent)', border:'1px solid var(--line)'}}>
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
            <div className="rounded-[16px] px-5 py-4" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Expert mode</div>
              <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Set your week, product by product.</h3>
              <p className="text-[11.5px]" style={{color:'var(--ink-soft)'}}>Toggle AM/PM and tap the days you'll use it. Saves as you go.</p>
            </div>
            {activeShelf.length === 0 ? (
              <div className="rounded-[16px] px-5 py-6 text-center" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
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
                    <div key={p.id} className="rounded-[12px] overflow-hidden" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
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
                        <div className="px-4 pb-3 pt-1 border-t" style={{borderColor:'var(--line)'}}>
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
                                  cursor: 'pointer',
                                }}
                              >AM</button>
                              <button
                                onClick={() => toggleProductSlot(p.id, 'pm')}
                                className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full transition"
                                style={{
                                  background: inPM ? 'var(--accent)' : 'transparent',
                                  color: inPM ? 'var(--cream)' : 'var(--ink-soft)',
                                  border: '1px solid ' + (inPM ? 'var(--accent)' : 'var(--line)'),
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
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
                                      cursor: 'pointer',
                                    }}
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
                cadence — opens the shelf-pick sheet so Étude can
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
                    style={{borderColor:'var(--accent)', background:'transparent', color:'var(--accent)', cursor:'pointer', fontWeight:600}}
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
                      title="Activate a shelf product into your weekly plan — Étude will suggest a cadence"
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
      {/* === STEP 1: CONCERNS === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 1 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
        {stepEyebrow(1)}
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
                  cursor: 'pointer',
                }}
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
                cursor: 'pointer',
              }}
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
      {/* === STEP 2: ACTIVES YOU WANT TO USE === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 2 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
        {stepEyebrow(2)}
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
                  cursor: 'pointer',
                }}
              >{a.label}</button>
            );
          })}
        </div>
        <p className="text-[10.5px] mt-3" style={{color:'var(--ink-soft)'}}>Skip this and we'll pick for you from your shelf.</p>
      </section>
      )}
      {/* === STEP 3: TOLERANCE + EXPERIENCE (May 2026 paired) ===
          Two related questions on one screen: how irritating
          can the plan get, and how many steps. Both inform
          the cap logic in generateBuildPlan. */}
      {!buildPlan && buildMode === 'guided' && buildStep === 3 && (
      <section className="rounded-[16px] px-5 py-5 space-y-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
        {stepEyebrow(3)}
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
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center"
                    style={{
                      background: isActive ? 'var(--accent)' : 'transparent',
                      border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                    }}
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
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center"
                    style={{
                      background: isActive ? 'var(--accent)' : 'transparent',
                      border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                    }}
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
      {/* === STEP 4: BUDGET === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 4 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
        {stepEyebrow(4)}
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
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center"
                      style={{
                        background: isActive ? 'var(--accent)' : 'transparent',
                        border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--line)'),
                      }}
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
      {/* === STEP 5: HOME DEVICES (May 2026 — derm pass) ===
          Captures LED masks, microneedling, microcurrent, etc.
          Stored on user.homeDevices. Routine generation will use
          these in a future pass (microneedling = recovery night
          after, LED = daily-safe, etc.). For now: data capture
          only. */}
      {!buildPlan && buildMode === 'guided' && buildStep === 5 && (() => {
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
          <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
            {stepEyebrow(5)}
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
                      cursor: 'pointer',
                    }}
                    aria-pressed={on}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center transition"
                      style={{
                        background: on ? 'var(--accent)' : 'transparent',
                        border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                      }}
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
      {/* === STEP 6: ANCHOR BASICS CHECK === */}
      {!buildPlan && buildMode === 'guided' && buildStep === 6 && (
      <section className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
        {stepEyebrow(6)}
        <h3 className="text-[16px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>The basics, on shelf?</h3>
        <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>Cleanser, moisturizer, SPF. Without these, no routine is complete.</p>
        {(() => {
          const active = (products || []).filter(p => !p.endDate);
          const cleansers    = active.filter(p => normalizeProductCategory(p.category) === 'cleanser');
          const moisturizers = active.filter(p => normalizeProductCategory(p.category) === 'moisturizer');
          const spfs         = active.filter(p => normalizeProductCategory(p.category) === 'spf');
          const isOilC = (p) => /\b(oil|balm|butter|melt)\b/i.test(`${p.name || ''} ${p.mainIngredients || ''}`);
          // Sort cleansers oil/balm first for double-cleanse order display
          const orderedCleansers = [...cleansers].sort((a, b) => (isOilC(a) ? 0 : 1) - (isOilC(b) ? 0 : 1));
          // Per-product slot tag — "AM" / "PM" / "AM·PM" — read from useTimes.
          const slotTag = (p, defaultBoth = true) => {
            const useTimes = Array.isArray(p.useTimes) ? p.useTimes.map(s => String(s).toUpperCase()) : [];
            const hasAM = useTimes.includes('AM');
            const hasPM = useTimes.includes('PM');
            if (hasAM && hasPM) return 'AM · PM';
            if (hasAM) return 'AM';
            if (hasPM) return 'PM';
            return defaultBoth ? 'AM · PM' : 'AM';
          };
          const renderCategory = (label, list, defaultBoth = true, hint = null) => (
            <div className="rounded-[10px] px-3 py-2.5" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <Icon name={list.length > 0 ? 'Check' : 'X'} size={12} style={{color: list.length > 0 ? 'var(--sage)' : 'var(--rose)'}} />
                  <span className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:500}}>{label}</span>
                  {list.length > 1 && (
                    <span className="text-[9.5px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)', fontWeight:500}}>· {list.length}</span>
                  )}
                </div>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="text-[10px] tracking-[0.18em] uppercase flex-shrink-0 hover:opacity-80"
                  style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
                >+ Add</button>
              </div>
              {/* List of each product in this category, with its AM/PM tag */}
              {list.length > 0 ? (
                <div className="space-y-0.5 pl-[18px]">
                  {list.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="truncate" style={{color:'var(--ink-soft)'}}>
                        {list.length > 1 && label === 'Cleanser' && isOilC(p) && <span style={{color:'var(--accent)'}}>· step 1 </span>}
                        {list.length > 1 && label === 'Cleanser' && !isOilC(p) && i > 0 && <span style={{color:'var(--accent)'}}>· step 2 </span>}
                        {p.name}
                      </span>
                      <span className="text-[9.5px] tracking-[0.18em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)', fontWeight:600}}>{slotTag(p, defaultBoth)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10.5px] pl-[18px]" style={{color:'var(--rose)'}}>None yet — add one.</div>
              )}
              {hint && list.length > 1 && (
                <div className="text-[10px] pl-[18px] mt-1.5" style={{color:'var(--ink-soft)'}}>{hint}</div>
              )}
            </div>
          );
          return (
            <div className="space-y-1.5">
              {renderCategory('Cleanser', orderedCleansers, true, 'Two cleansers PM = double-cleanse. Oil first, foam/cream second.')}
              {renderCategory('Moisturizer', moisturizers, true, 'Tip: light AM, rich PM works for most.')}
              {renderCategory('SPF', spfs, false, null)}
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
              {buildStep === 6 ? (
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
          {buildStep < 6 && (
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
      {buildPlan && (
        <section className="space-y-4">
          {/* Selections summary — only what was picked */}
          <div className="rounded-[16px] px-5 py-4" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
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
          <div className="rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-[9px] tracking-[0.32em] uppercase mb-1" style={{color:'var(--accent)', fontWeight:600}}>Your weekly plan</div>
                <h3 className="text-[20px] leading-tight" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Your week.</h3>
              </div>
              {buildPlanAccepted && (
                <div className="text-[9.5px] tracking-[0.22em] uppercase px-2 py-1 rounded-full" style={{background:'var(--sage)', color:'var(--cream)', fontWeight:600}}>Accepted</div>
              )}
            </div>
            {/* === WEEK AT A GLANCE (May 2026 redesign per Jenni) ===
                Themed strip + tap-to-expand inline day detail.
                Today's day-of-week is expanded by default so the
                user lands with their current ritual visible —
                no extra tap required. Replaces the prior simple-
                dot strip; the duplicate themed strip that used
                to live under the per-product list was removed
                since this one renders here always (pre- and
                post-accept). Falls through to "Rest" labels for
                days with no slotted actives, which is correct
                for an empty/sparse plan. */}
            {(() => {
              const dayLetters = ['S','M','T','W','T','F','S'];
              const dayFullLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              const todayDow = new Date().getDay();
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
              const getDayFocusLocal = (dayIdx) => {
                const fams = new Set();
                (buildPlan?.slotted || []).forEach(s => {
                  if (!s.days.includes(dayIdx)) return;
                  const fam = detectActiveFamily(s.product.activeIngredients || s.product.actives || '');
                  if (fam) fams.add(fam);
                });
                if (fams.size === 0) return 'Rest';
                for (const e of FOCUS_PRIORITY_LOCAL) {
                  if (fams.has(e.family)) return e.label;
                }
                return 'Daily';
              };
              const productsForDay = (dayIdx) => {
                const am = [];
                const pm = [];
                (buildPlan?.slotted || []).forEach(s => {
                  if (!s.days.includes(dayIdx)) return;
                  if (s.am) am.push(s.product);
                  if (s.pm) pm.push(s.product);
                });
                return { am, pm };
              };
              return (
                <div className="mb-4 pb-4 border-b" style={{borderColor:'var(--line)'}}>
                  <div className="text-[9px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Week at a glance</div>
                  <div className="grid grid-cols-7 gap-1">
                    {dayLetters.map((letter, d) => {
                      const focus = getDayFocusLocal(d);
                      const isToday = d === todayDow;
                      const isSelected = postAcceptDay === d;
                      const hasActive = focus !== 'Rest' && focus !== 'Daily';
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPostAcceptDay(prev => prev === d ? null : d)}
                          className="flex flex-col items-center gap-1 py-1.5 px-0.5 transition"
                          style={{cursor:'pointer'}}
                        >
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px]"
                            style={{
                              background: isSelected ? 'var(--accent)' : (isToday ? 'var(--cream)' : 'transparent'),
                              color: isSelected ? 'var(--cream)' : 'var(--ink)',
                              border: '1px solid ' + (isSelected || isToday ? 'var(--accent)' : 'var(--line)'),
                              fontWeight: 600,
                            }}
                          >{letter}</span>
                          <span className="text-[8px] tracking-[0.04em] uppercase leading-tight text-center" style={{color: hasActive ? 'var(--accent)' : 'var(--ink-soft)', opacity: hasActive ? 0.8 : 0.5, fontWeight:500, minHeight:'9px'}}>
                            {focus === 'Daily' ? '·' : focus}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {postAcceptDay !== null && (() => {
                    const { am, pm } = productsForDay(postAcceptDay);
                    const focusLbl = getDayFocusLocal(postAcceptDay);
                    return (
                      <div className="mt-2 rounded-[12px] px-3 py-2.5" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <div>
                            <span className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{dayFullLabels[postAcceptDay]}{postAcceptDay === todayDow ? ' · today' : ''}</span>
                            <span className="text-[11px] ml-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'-0.01em'}}>{focusLbl}</span>
                          </div>
                          <button
                            onClick={() => setPostAcceptDay(null)}
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
            {buildPlan.slotted.length > 0 ? (
              <div className="space-y-2 mb-4">
                {!buildPlanAccepted && (
                  <p className="text-[10.5px] mb-1" style={{color:'var(--ink-soft)'}}>
                    AI's first pass — tweak any day or slot, then accept.
                  </p>
                )}
                {buildPlan.slotted.map((s, i) => {
                  const dayShortLabels = ['S','M','T','W','T','F','S'];
                  const expanded = isBuildCardExpanded(s.product.id, i);
                  const dayCodes = s.days.length === 7 ? 'Daily' : s.days.length === 0 ? '—' : s.days.map(d => dayShortLabels[d]).join('·');
                  const slotTag = s.am && s.pm ? 'AM · PM' : s.am ? 'AM' : s.pm ? 'PM' : '—';
                  return (
                    <div key={i} className="rounded-[12px] overflow-hidden" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
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
                          <div className="px-4 pb-3 pt-1 border-t" style={{borderColor:'var(--line)'}}>
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
                                    cursor: 'pointer',
                                  }}
                                >AM</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); togglePlanSlot(s.product.id, 'pm'); }}
                                  className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full transition"
                                  style={{
                                    background: s.pm ? 'var(--accent)' : 'transparent',
                                    color: s.pm ? 'var(--cream)' : 'var(--ink-soft)',
                                    border: '1px solid ' + (s.pm ? 'var(--accent)' : 'var(--line)'),
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
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
                                        cursor: 'pointer',
                                      }}
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
            {buildPlan.missingBasics.length > 0 && (
              <p className="text-[11.5px] mb-3 px-3 py-2 rounded-[10px]" style={{background:'rgba(201,138,138,0.08)', color:'var(--rose)', border:'1px solid rgba(201,138,138,0.28)'}}>
                <Icon name="AlertCircle" size={10} style={{marginRight:4, verticalAlign:'middle'}} />
                Missing from shelf: {buildPlan.missingBasics.join(', ')}. The plan still works — add these for a complete routine.
              </p>
            )}
            {!buildPlanAccepted && (
              <div className="flex gap-2">
                {buildPlan.slotted.length > 0 && (
                  <button
                    onClick={acceptPlan}
                    className="flex-1 pill-btn primary"
                    type="button"
                  >
                    <Icon name="Check" size={14} style={{marginRight:6}} />
                    Accept this plan
                  </button>
                )}
                <button
                  onClick={rebuildFromStart}
                  className="flex-1 pill-btn secondary"
                  type="button"
                >
                  <Icon name="RotateCcw" size={14} style={{marginRight:6}} />
                  Refine
                </button>
              </div>
            )}
            {buildPlanAccepted && (
              <div className="space-y-3">
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
                          ? 'Activate a shelf product — Étude will suggest a cadence'
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
                      border:'1px solid var(--line)',
                      marginTop:8,
                    }}
                  >
                    {/* Sheet header */}
                    <div className="flex items-center justify-between">
                      <div className="text-[9.5px] tracking-[0.24em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>
                        {buildAddStage === 'shelf-pick' && 'From your shelf'}
                        {buildAddStage === 'propose' && 'Étude suggests'}
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
                                style={{borderColor:'var(--line)', background:'var(--cream-deep)', cursor:'pointer'}}
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
    </div>
  );
  })();
};
