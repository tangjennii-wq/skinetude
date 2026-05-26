// === OnboardingOverlay (Wave 6.1 extract — May 2026) ===
// Lifted out of App's render tree as an IIFE. The overlay covers the
// entire app while onboardingState.stage !== 'done'.
//
// May 2026 v2 — 11 → 7 stages.
// New order: welcome → photo → key → about → context → shelf → reveal.
// Rationale: photo precedes key so the user has a personal artifact in
// hand before the API-key ask (justifies the friction). The skin read
// fires from the key card the moment a key lands, in-place — that is
// the magic moment. `goals + tolerance` pack into one `about` card;
// `experience + clinical` pack into one `context` card. `fallback` no
// longer needs a standalone slot (foundational logic lives inside the
// reveal stage); `building + first-routine` collapse into the single
// `reveal` stage that morphs in place (phases ticker → routine card).
//
// All App-scope state + setters are passed as explicit props. Render
// site in App: `<OnboardingOverlay ... />` gated by the same stage check.
//
// Module-scope (no prop bridge): Icon, Modal, Photo, all the named
// onboarding child components (OnboardingBuildingPhases, etc.),
// localDateISO, fileToBase64, callClaude/etc., setApiKey, getApiKey.

const OnboardingOverlay = ({
  onboardingState,
  updateOnboarding,
  userProfile, setUserProfile,
  userConcerns, setUserConcerns,
  products, setProducts,
  logs,
  regimenLogs, setRegimenLogs,
  homeUploadInputRef,
  setCameraDestination,
  setShowGuidedCaptureModal,
  setGuidedCaptureCtx,
  setShowProductModal,
  setCoverRoutineRebuildToken,
  saveData,
  toast,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  setProductEntryMode,
  // === V2 PROP BRIDGES (May 2026 — onboarding rework) ===
  // retryLogAnalysis fires the AI read on the photo log the user
  // just captured. We trigger it from the new key card the instant
  // the user saves their key (or on mount if they already have one),
  // so the read lands inline on the card and the chips populate via
  // the existing photoChips watcher.
  retryLogAnalysis,
  // setApiKeyState updates the React `apiKey` state alongside the
  // localStorage write. Without it, the cover stays in its no-key
  // shape until the user hard-reloads.
  setApiKeyState,
  // === UPLOAD-FROM-LIBRARY BRIDGES (May 2026 v2) ===
  // The hasPhoto branch of the photo step adds an "Upload from
  // library" affordance for re-doing onboarding. ≤4 files become
  // supplementary guided shots; >4 files route to the bulk import
  // queue (PhotoImportQueue) which already owns label-and-save UX.
  setLogs,
  user,
  uploadPhotoToStorage,
  setShowPhotoImportQueue,
  // fileToBase64 is App-scope (index.jsx.source line ~7387) and must be
  // bridged in. The header comment that listed it as "module-scope" was
  // wrong; handleUploadMore below calls it, so it has to be in scope.
  fileToBase64,
  // === REVEAL-STAGE WAYFINDING (May 2026 v2) ===
  // The final "Your first regimen is built" card's secondary CTA now
  // routes the user to the Regimen tab's build view so they understand
  // that's the canonical surface for ongoing refinement (rather than a
  // one-shot product modal). Both setters guarded at call site.
  setActiveTab,
  setRegimenView,
}) => {
  // Hidden file input ref for the "Upload from library" button in
  // the hasPhoto branch. Separate from the empty-state file input
  // (which lives in homeUploadInputRef and routes through the App's
  // existing onboarding-upload handler at line 4265).
  const uploadMoreRef = React.useRef(null);
  const handleUploadMore = async (e) => {
    const files = Array.from(e.target.files || []);
    try { e.target.value = ''; } catch (_) {}
    if (files.length === 0) return;
    // >4 → route to bulk import queue. We don't pre-populate the
    // queue with these files (would require extending its API); the
    // user re-selects inside the queue. Toast tells them why.
    if (files.length > 4) {
      toast(`That's a lot of photos — opening import where you can label them all at once.`, 'info');
      setShowPhotoImportQueue && setShowPhotoImportQueue(true);
      return;
    }
    // ≤4 → save inline as supplementary guided shots. The user
    // already has a baseline (hasPhoto branch is the only place
    // this fires from), so these don't claim area:'full-face' —
    // they're alternates the user can compare/cycle through later.
    try {
      const shots = await Promise.all(files.map(async (f) => {
        const dataUrl = await fileToBase64(f);
        const originalCapturedAt = f.lastModified ? new Date(f.lastModified).toISOString() : null;
        // Onboarding snapshot uploads are part of the current setup moment;
        // historical camera-roll dates belong in the bulk import timeline.
        const capturedAt = new Date().toISOString();
        return { dataUrl, capturedAt, originalCapturedAt };
      }));
      const today = localDateISO();
      const baseTime = Date.now();
      const newLogs = shots.map((s, i) => ({
        id: baseTime + i,
        date: today,
        photo: s.dataUrl,
        photoPath: null,
        concerns: [],
        rating: null,
        notes: '',
        context: '',
        source: 'upload',
        capturedAt: s.capturedAt,
        originalCapturedAt: s.originalCapturedAt,
        aiAnalysis: null,
        analyzing: false,
      }));
      const updated = [...newLogs, ...(logs || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
      setLogs && setLogs(updated);
      saveData('logs', updated).catch(err => console.warn('[onboarding upload-more save]', err?.message));
      toast(`${shots.length} photo${shots.length > 1 ? 's' : ''} added`, 'success');
      // Background upload to Supabase Storage for cloud users.
      if (user && user.cloud && uploadPhotoToStorage) {
        for (const log of newLogs) {
          try {
            // uploadPhotoToStorage returns { path, error } — must
            // destructure or we'd write the whole object into
            // photoPath and break the Photo renderer.
            const { path } = await uploadPhotoToStorage(user.id, log.photo);
            if (path) {
              setLogs && setLogs(prev => {
                const next = prev.map(l => l.id === log.id ? { ...l, photoPath: path, photo: undefined } : l);
                saveData('logs', next).catch(() => {});
                return next;
              });
            }
          } catch (_) { /* swallow — local copy still good */ }
        }
      }
    } catch (err) {
      console.error('[onboarding upload-more]', err);
      toast('Upload failed. Try again?', 'error');
    }
  };
  const o = onboardingState;
  const set = updateOnboarding;
  const goTo = (stage) => set({ stage });
  // Linear order — 7 stages. Drives progress dashes + back arrow.
  // Welcome itself has no progress bar (full bleed brand moment).
  const ORDER = ['welcome','photo','key','about','context','shelf','reveal'];
  const stepIdx = Math.max(0, ORDER.indexOf(o.stage));
  const totalSteps = ORDER.length;
  // Step → next-stage map. No conditional branching anymore — the
  // foundational fallback got absorbed into the reveal stage.
  const nextStage = (from) => {
    switch (from) {
      case 'welcome': return 'photo';
      case 'photo':   return 'key';
      case 'key':     return 'about';
      case 'about':   return 'context';
      case 'context': return 'shelf';
      case 'shelf':   return 'reveal';
      case 'reveal':  return 'done';
      default: return 'done';
    }
  };
  const advance = () => goTo(nextStage(o.stage));
  // Back navigation — straight linear walk now that fallback is gone.
  const goBack = () => {
    const idx = ORDER.indexOf(o.stage);
    if (idx <= 0) return;
    goTo(ORDER[idx - 1]);
  };
  const exploreFirst = () => {
    // User opted to skip onboarding entirely. Mark done + skipped
    // so Home can show progressive empty-state cards later.
    const skippedState = { ...o, stage: 'done', skipped: true };
    set(skippedState);
    saveData('onboardingState', skippedState).catch(() => {});
  };

  // === DATA — GOALS ===
  const GOAL_OPTIONS = [
    { id: 'calm-redness',  label: 'Calm redness',   icon: 'Leaf' },
    { id: 'brighten',      label: 'Brighten tone',  icon: 'Sun' },
    { id: 'barrier',       label: 'Support barrier',icon: 'Shield' },
    { id: 'breakouts',     label: 'Prevent breakouts', icon: 'Droplet' },
    { id: 'texture',       label: 'Improve texture',icon: 'Sparkles' },
    { id: 'age-gracefully',label: 'Age gracefully', icon: 'Moon' },
    { id: 'sensitivity',   label: 'Reduce sensitivity', icon: 'Heart' },
    { id: 'simplify',      label: 'Simplify routine', icon: 'Minus' },
  ];
  const toggleGoal = (id) => {
    const exists = (o.goals || []).includes(id);
    set({ goals: exists ? o.goals.filter(g => g !== id) : [...(o.goals || []), id] });
  };

  // === DATA — TOLERANCE ===
  const TOLERANCE_OPTIONS = [
    { id: 'very_sensitive',         label: 'Very sensitive',         sub: 'Easily irritated' },
    { id: 'occasionally_reactive',  label: 'Occasionally reactive',  sub: 'Sometimes sensitive' },
    { id: 'resilient',              label: 'Generally resilient',    sub: 'Rarely reacts' },
    { id: 'unsure',                 label: 'Not sure yet',           sub: "We'll learn together" },
  ];

  // === DATA — EXPERIENCE ===
  const EXPERIENCE_LEVELS = [
    { id: 'essential', label: 'Essential', sub: '3–4 products. Keep it simple.' },
    { id: 'balanced',  label: 'Balanced',  sub: '5–7 products. Enjoy it without overdoing.' },
    { id: 'advanced',  label: 'Advanced',  sub: '7+ products. Comfortable with actives.' },
  ];

  // === DATA — CLINICAL ===
  const CONDITION_OPTIONS = [
    'Acne-prone', 'Rosacea', 'Eczema', 'Melasma',
    'Hyperpigmentation', 'Perioral dermatitis', 'Hormonal acne', 'None of these',
  ];
  const RX_OPTIONS = [
    'Tretinoin / Retinoids',
    'Spironolactone',
    'Isotretinoin (Accutane)',
    'None',
  ];
  const toggleCondition = (val) => {
    if (val === 'None of these') {
      set({ skinConditions: (o.skinConditions || []).includes(val) ? [] : ['None of these'] });
      return;
    }
    const cleaned = (o.skinConditions || []).filter(x => x !== 'None of these');
    set({ skinConditions: cleaned.includes(val) ? cleaned.filter(x => x !== val) : [...cleaned, val] });
  };
  const toggleRx = (val) => {
    if (val === 'None') {
      set({ currentRxOrHistory: (o.currentRxOrHistory || []).includes(val) ? [] : ['None'] });
      return;
    }
    const cleaned = (o.currentRxOrHistory || []).filter(x => x !== 'None');
    set({ currentRxOrHistory: cleaned.includes(val) ? cleaned.filter(x => x !== val) : [...cleaned, val] });
  };

  // === FOUNDATIONAL FALLBACK ROUTINE ===
  // Used inside the reveal stage when the user has no shelf products
  // (the prior standalone `fallback` stage rolled into this).
  const FOUNDATIONAL = {
    am: [
      { name: 'Cleanser', sub: 'Gentle cleanse' },
      { name: 'Moisturizer', sub: 'Hydrate & support' },
      { name: 'Sunscreen', sub: 'Daily protection' },
    ],
    pm: [
      { name: 'Cleanser', sub: 'Gentle cleanse' },
      { name: 'Moisturizer', sub: 'Recover & nourish' },
    ],
  };

  // === REVEAL PHASES ===
  // Plays in the reveal stage before the routine card morphs in.
  const REVEAL_PHASES = [
    'Reading your sensitivity',
    'Pairing with your shelf',
    'Drafting your routine',
  ];

  // === ACTIONS ===
  const finishOnboarding = () => {
    try {
      // Write goals → primaryConcerns + goals (UI uses both fields
      // in different surfaces; keep them in sync).
      const goalLabels = (o.goals || []).map(id => (GOAL_OPTIONS.find(g => g.id === id) || {}).label).filter(Boolean);
      // Map skinTolerance → barrierScale (closest existing field).
      const toleranceToBarrier = {
        very_sensitive: 'very-reactive',
        occasionally_reactive: 'sensitive',
        resilient: 'resilient',
        unsure: '',
      };
      const newProfile = {
        ...userProfile,
        primaryConcerns: Array.from(new Set([...(userProfile.primaryConcerns || []), ...goalLabels])),
        goals: Array.from(new Set([...(userProfile.goals || []), ...goalLabels])).slice(0, 5),
        barrierScale: toleranceToBarrier[o.skinTolerance] || userProfile.barrierScale,
        diagnosedConditions: Array.from(new Set([
          ...(userProfile.diagnosedConditions || []),
          ...((o.skinConditions || []).filter(c => c !== 'None of these')),
        ])),
        currentRx: Array.from(new Set([
          ...(userProfile.currentRx || []),
          ...((o.currentRxOrHistory || []).filter(x => x !== 'None')),
        ])),
      };
      if (o.timeZone) newProfile.environment = { ...(userProfile.environment || {}), timeZone: o.timeZone };
      setUserProfile(newProfile);
      // === CLOUD PERSISTENCE (May 2026 bug fix) ===
      // Without explicit saveData, returning users on another device
      // would see an empty profile and get re-prompted to onboard.
      saveData('userProfile', newProfile).catch(() => {});
      // Also mirror goals into userConcerns (used by Home + Build).
      const mergedConcerns = Array.from(new Set([...(userConcerns || []), ...goalLabels]));
      setUserConcerns(mergedConcerns);
      saveData('userConcerns', mergedConcerns).catch(() => {});
      set({ stage: 'done' });
      // Persist onboardingState to cloud as well so the "done"
      // signal follows the user across devices.
      saveData('onboardingState', { ...o, stage: 'done' }).catch(() => {});
      // === SEED TODAY'S REGIMEN (May 2026 — F14 friend-demo handoff) ===
      // If user added shelf products during onboarding, seed today's
      // regimenLog with their non-body face products split by useTimes.
      // Default to both slots when useTimes is unset.
      try {
        const todayKey = localDateISO();
        const activeFace = (products || []).filter(p => !p.endDate && !isBodyProduct(p));
        // Category-aware slot inference.
        const inSlot = (p, slot) => {
          const ut = (p.useTimes || []).map(t => String(t).toLowerCase());
          if (ut.length > 0) return ut.includes(slot);
          const cat = String(p.category || '').toLowerCase();
          if (/sunscreen|spf|sun(?!flower)/.test(cat)) return slot === 'am';
          if (/retinoid|retinol|aha|bha|acid|exfoliant|treatment/.test(cat)) return slot === 'pm';
          return true;
        };
        if (activeFace.length > 0) {
          // Commit useTimes + cadence to products so the shelf is the
          // single source of truth for today + the pattern-derived
          // routine the cover/Regimen Today/Build all read from.
          const activeFaceIds = new Set(activeFace.map(p => p.id));
          const updatedProducts = (products || []).map(p => {
            if (!activeFaceIds.has(p.id)) return p;
            const inferred = { am: inSlot(p, 'am'), pm: inSlot(p, 'pm') };
            const nextUseTimes = [];
            if (inferred.am) nextUseTimes.push('am');
            if (inferred.pm) nextUseTimes.push('pm');
            const hasCadence = p.cadence && Array.isArray(p.cadence.days) && p.cadence.days.length > 0;
            const nextCadence = hasCadence ? p.cadence : { days: [0,1,2,3,4,5,6], frequency: 7 };
            return sanitizeProductForSave({
              ...p,
              useTimes: nextUseTimes,
              cadence: nextCadence,
            });
          });
          setProducts(updatedProducts);
          saveData('products', updatedProducts).catch(() => {});
          // Seed (or REFRESH) today's regimenLog. Overwrite planned
          // products to match the freshly-committed shelf; preserve
          // any user-entered done/skipped/extras/notes from a prior
          // log on the same date so re-onboarding doesn't wipe a
          // partial check-in.
          const existingLog = (regimenLogs || []).find(r => r.date === todayKey);
          const amIds = activeFace.filter(p => inSlot(p, 'am')).map(p => p.id);
          const pmIds = activeFace.filter(p => inSlot(p, 'pm')).map(p => p.id);
          const nextLog = existingLog
            ? { ...existingLog, amProducts: amIds, pmProducts: pmIds }
            : {
                id: Date.now(),
                date: todayKey,
                amProducts: amIds,
                pmProducts: pmIds,
                amDone: [], pmDone: [],
                amSkipped: [], pmSkipped: [],
                amExtras: [], pmExtras: [],
                devices: [], sleep: '', supplements: [],
                hydration: false, sunscreenReapply: false,
                notes: '',
                submitted: false,
              };
          const newList = existingLog
            ? (regimenLogs || []).map(r => r.date === todayKey ? nextLog : r)
            : [nextLog, ...(regimenLogs || [])];
          setRegimenLogs(newList);
          saveData('regimenLogs', newList).catch(() => {});
        }
        // Bump the cover refresh token so any cover-side derived
        // routine recomputes.
        setCoverRoutineRebuildToken(t => t + 1);
      } catch (e) {
        // Seed is nice-to-have. If it throws, swallow.
        console.warn('[onboarding] commit + seed regimen failed:', e);
      }
      toast('First draft saved. We’ll refine as you check in.', 'success');
    } catch (e) {
      console.error('[onboarding finish]', e);
      set({ stage: 'done' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{background:'var(--cream)'}}
    >
      <div className="w-full max-w-[460px] mx-auto">
        {/* === PHASED PROGRESS BAR (May 2026 v2) ===
            Three named phases instead of 7 mystery dashes. Same 7
            cards under the hood; the visual just groups them so the
            user reads the journey as three beats: Snapshot → About
            you → Regimen. Per-phase active dot count = sub-steps
            done inside that phase. Phase label appears below the
            dashes; the active phase label gets the accent color.
            Welcome hides the whole bar (full-bleed brand moment). */}
        {o.stage !== 'welcome' && (() => {
          // Phase metadata. The ORDER array is
          //   ['welcome','photo','key','about','context','shelf','reveal']
          // welcome doesn't appear in the bar; the other 6 stages split
          // into three phases of two stages each.
          const PHASES = [
            { id: 'snapshot', label: 'Snapshot', stages: ['photo', 'key'] },
            { id: 'about',    label: 'About you', stages: ['about', 'context'] },
            { id: 'regimen',  label: 'Regimen',  stages: ['shelf', 'reveal'] },
          ];
          const currentPhaseIdx = PHASES.findIndex(p => p.stages.includes(o.stage));
          return (
            <div className="mb-5">
              <div className="flex items-center gap-3 mb-2">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={stepIdx <= 0}
                  className="flex items-center justify-center w-7 h-7 rounded-full transition hover:bg-[var(--cream-deep)] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{color:'var(--ink-soft)', cursor: stepIdx <= 0 ? 'not-allowed' : 'pointer'}}
                  aria-label="Back to previous step"
                  title="Back"
                >
                  <Icon name="ArrowLeft" size={14} />
                </button>
                <div className="flex-1 flex items-center gap-3">
                  {PHASES.map((phase, pi) => {
                    const isPhasePast = pi < currentPhaseIdx;
                    const isPhaseActive = pi === currentPhaseIdx;
                    return (
                      <div key={phase.id} className="flex-1 flex items-center gap-1">
                        {phase.stages.map((stageId, si) => {
                          const stageIdxInOrder = ORDER.indexOf(stageId);
                          const isFilled = stageIdxInOrder <= stepIdx;
                          return (
                            <div
                              key={stageId}
                              className="h-[2px] flex-1 rounded-full"
                              style={{
                                background: isFilled
                                  ? 'var(--accent)'
                                  : (isPhaseActive ? 'rgba(78,58,44,0.22)' : 'rgba(78,58,44,0.10)'),
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Phase labels — aligned under each phase's dash cluster.
                  Active phase label gets accent color; past phases get
                  ink-soft; future phases get a quieter ink-soft.
                  Left-padded to clear the back arrow above. */}
              <div className="flex items-center gap-3 pl-10">
                {PHASES.map((phase, pi) => {
                  const isPhasePast = pi < currentPhaseIdx;
                  const isPhaseActive = pi === currentPhaseIdx;
                  return (
                    <div
                      key={phase.id}
                      className="flex-1 text-[9.5px] tracking-[0.18em] uppercase text-center"
                      style={{
                        color: isPhaseActive
                          ? 'var(--accent)'
                          : (isPhasePast ? 'var(--ink-soft)' : 'rgba(78,58,44,0.4)'),
                        fontWeight: isPhaseActive ? 600 : 500,
                      }}
                    >
                      {phase.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* === FLOATING CARD === */}
        <div
          className="rounded-[20px] px-6 py-7 md:px-8 md:py-9"
          style={{
            background: 'var(--cream-deep)',
            border: '1px solid var(--line)',
            boxShadow: '0 12px 36px rgba(28,25,23,0.06)',
          }}
        >
          {/* === STEP 1 — WELCOME === */}
          {o.stage === 'welcome' && (
            <div className="text-center">
              <div className="text-[10px] tracking-[0.22em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:500}}>Welcome to</div>
              <h1 className="font-serif text-[44px] leading-[1] mb-5" style={{color:'var(--accent)', letterSpacing:'-0.02em'}}>étude</h1>
              <div className="inline-flex items-center justify-center w-8 h-8 mb-5">
                <Icon name="Sparkles" size={18} style={{color:'var(--ink-soft)'}} />
              </div>
              <p className="text-[13px] leading-relaxed max-w-[360px] mx-auto" style={{color:'var(--ink)'}}>
                Built by two best friends — both doctors — who are always helping each other with their skin care routine.
              </p>
              <p className="font-serif text-[15px] leading-relaxed mt-4 max-w-[360px] mx-auto" style={{color:'var(--ink)'}}>
                Let's optimize the skin you're in.
              </p>
              <div className="mt-7 space-y-2.5">
                <button
                  type="button"
                  onClick={advance}
                  className="w-full rounded-full py-3 px-5 transition hover:opacity-90"
                  style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
                >Begin</button>
                <button
                  type="button"
                  onClick={exploreFirst}
                  className="w-full transition hover:opacity-70 py-2"
                  style={{color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.22em', cursor:'pointer', textTransform:'uppercase'}}
                >Explore first</button>
              </div>
            </div>
          )}

          {/* === STEP 2 — SKIN SNAPSHOT (photo before key) ===
              Was step 3 in v1. Moved up so the user invests a personal
              artifact BEFORE the API-key ask. Guided capture saves
              real logs entries (becomes the user's first journal
              entry automatically), then advances to the key card
              where the read fires inline. */}
          {o.stage === 'photo' && (() => {
            const hasPhoto = o.photoProvided && (o.photoDataUrl || o.photoLogId);
            return (
              <div>
                <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>2 · Skin Snapshot</div>
                <h2 className="font-serif text-[28px] leading-tight mb-2" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.018em'}}>
                  {!hasPhoto ? 'Your skin story starts here.' : 'Photo saved.'}
                </h2>
                <p className="text-[12.5px] leading-snug mb-5" style={{color:'var(--ink-soft)'}}>
                  {!hasPhoto
                    ? 'Bare face, natural light. This becomes your first journal entry.'
                    : 'Next we’ll read it — needs an AI key on the next step.'}
                </p>

                {/* === PLACEHOLDER / CAPTURED PHOTO === */}
                <div
                  role={!hasPhoto ? 'button' : undefined}
                  tabIndex={!hasPhoto ? 0 : undefined}
                  onClick={!hasPhoto ? () => {
                    set({ photoSource: 'guided' });
                    setCameraDestination('onboarding');
                    setGuidedCaptureCtx({ intent: 'onboarding_baseline' });
                    setShowGuidedCaptureModal(true);
                  } : undefined}
                  onKeyDown={!hasPhoto ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      set({ photoSource: 'guided' });
                      setCameraDestination('onboarding');
                      setGuidedCaptureCtx({ intent: 'onboarding_baseline' });
                      setShowGuidedCaptureModal(true);
                    }
                  } : undefined}
                  className={"aspect-square rounded-full mx-auto mb-5 flex flex-col items-center justify-center relative overflow-hidden" + (!hasPhoto ? ' transition hover:opacity-90 active:opacity-80' : '')}
                  style={{
                    maxWidth: 200,
                    border: hasPhoto ? '2px solid var(--line)' : '2px dashed var(--line)',
                    background: 'var(--cream)',
                    cursor: !hasPhoto ? 'pointer' : 'default',
                  }}
                >
                  {hasPhoto && o.photoDataUrl ? (
                    <img src={o.photoDataUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  ) : (
                    <>
                      <Icon name="Camera" size={32} style={{color:'var(--ink-soft)'}} />
                      <span className="mt-2" style={{color:'var(--accent)', fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase'}}>Take selfie</span>
                    </>
                  )}
                </div>

                {!hasPhoto && (
                  <>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          set({ photoSource: 'upload' });
                          setCameraDestination('onboarding');
                          if (typeof homeUploadInputRef !== 'undefined' && homeUploadInputRef && homeUploadInputRef.current) {
                            homeUploadInputRef.current.click();
                          }
                        }}
                        className="w-full rounded-[12px] py-3 px-4 flex items-center justify-center gap-2 transition hover:bg-[var(--cream)]"
                        style={{background:'var(--cream)', color:'var(--ink)', border:'1px solid var(--line)', fontWeight:600, fontSize:12, letterSpacing:'0.06em', cursor:'pointer'}}
                      >
                        <Icon name="Upload" size={13} />
                        <span>Upload photos</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { set({ photoSource: 'skipped' }); advance(); }}
                      className="mt-4 w-full text-center transition hover:opacity-70 py-2"
                      style={{color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.22em', cursor:'pointer', textTransform:'uppercase'}}
                    >Skip for now</button>
                  </>
                )}

                {hasPhoto && (
                  <>
                    {(() => {
                      const today = localDateISO();
                      const guidedShots = (logs || []).filter(l => l && l.date === today && l.source === 'guided_capture' && (l.photo || l.photoDataUrl));
                      if (guidedShots.length === 0) return null;
                      return (
                        <div className="flex items-center justify-center gap-1.5 mb-4 flex-wrap">
                          {guidedShots.map(s => (
                            <div
                              key={s.id}
                              className="rounded-md overflow-hidden"
                              style={{width:48, height:48, border:'1px solid var(--line)'}}
                              title={s.angle || ''}
                            >
                              <img src={s.photo || s.photoDataUrl} alt={s.angle || ''} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={advance}
                      className="w-full rounded-full py-3 px-5 transition hover:opacity-90 mb-2"
                      style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
                    >Continue</button>
                    <button
                      type="button"
                      onClick={() => {
                        set({ photoSource: 'guided' });
                        setCameraDestination('onboarding');
                        setGuidedCaptureCtx({ intent: 'onboarding_baseline' });
                        setShowGuidedCaptureModal(true);
                      }}
                      className="w-full rounded-[12px] py-2.5 px-4 transition hover:bg-[var(--cream)] flex items-center justify-center gap-2 mb-2"
                      style={{background:'transparent', color:'var(--ink)', border:'1px solid var(--line)', fontWeight:600, fontSize:11, letterSpacing:'0.12em', cursor:'pointer', textTransform:'uppercase'}}
                    >
                      <Icon name="RotateCcw" size={12} />
                      <span>Retake photo set</span>
                    </button>
                    {/* === UPLOAD FROM LIBRARY (May 2026 v2) ===
                        Lets returning users add supplementary photos
                        (e.g. before/after shots from camera roll)
                        without leaving onboarding. ≤4 files save
                        inline; >4 routes to PhotoImportQueue (bulk
                        select/label/save) so user labels in one pass
                        instead of one-by-one in this step. */}
                    <button
                      type="button"
                      onClick={() => uploadMoreRef.current && uploadMoreRef.current.click()}
                      className="w-full rounded-[12px] py-2.5 px-4 transition hover:bg-[var(--cream)] flex items-center justify-center gap-2"
                      style={{background:'transparent', color:'var(--ink)', border:'1px solid var(--line)', fontWeight:600, fontSize:11, letterSpacing:'0.12em', cursor:'pointer', textTransform:'uppercase'}}
                    >
                      <Icon name="Upload" size={12} />
                      <span>Upload from library</span>
                    </button>
                    <input
                      ref={uploadMoreRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadMore}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* === STEP 3 — AI KEY + FIRST READ (magic moment) ===
              Was step 2 in v1. The user already took a photo last step,
              so the key ask is justified by an imminent payoff — the
              read fires the moment they save. Chips populate inline
              via the existing photoChips watcher in App. If no key,
              Continue still advances; AI features stay quiet until
              the user sets one later from the Home header. */}
          {o.stage === 'key' && (() => {
            const draft = o.apiKeyDraft || '';
            const trimmed = draft.trim();
            const looksValid = trimmed.startsWith('sk-');
            const chips = Array.isArray(o.photoChips) ? o.photoChips : null;
            const isAnalyzing = !!o.photoAnalyzing;
            const hasPhotoToRead = !!o.photoLogId;
            const saveKey = () => {
              if (trimmed && looksValid) {
                try { setApiKey(trimmed); } catch (_) {}
                try { if (typeof setApiKeyState === 'function') setApiKeyState(trimmed); } catch (_) {}
                // Kick the read on the just-captured photo. The existing
                // watcher in App (photoLogId + photoAnalyzing → photoChips)
                // populates chips below as soon as metricSnapshot lands.
                if (hasPhotoToRead && typeof retryLogAnalysis === 'function') {
                  set({ photoAnalyzing: true, photoChips: null, apiKeyDraft: '' });
                  retryLogAnalysis(o.photoLogId).catch(() => {});
                } else {
                  set({ apiKeyDraft: '' });
                }
              }
            };
            return (
              <div>
                <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>3 · Your AI Key</div>
                <h2 className="font-serif text-[28px] leading-tight mb-2" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.018em'}}>
                  {chips && chips.length > 0 ? 'First read.' : (isAnalyzing ? 'Reading your skin…' : 'Want a read on what we see?')}
                </h2>
                <p className="text-[12.5px] leading-snug mb-4" style={{color:'var(--ink-soft)'}}>
                  {chips && chips.length > 0
                    ? 'Here’s what we see in your photo.'
                    : (isAnalyzing
                      ? 'A moment. You can keep going — this finishes in the background.'
                      : 'Drop your Anthropic key and we’ll read the photo you just took. Skip for now and AI stays quiet until you add one later.')}
                </p>

                {/* Key input — only shown until a key is saved + read is firing/done */}
                {!isAnalyzing && (!chips || chips.length === 0) && (
                  <>
                    <input
                      type="text"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={draft}
                      onChange={(e) => set({ apiKeyDraft: e.target.value })}
                      placeholder="sk-ant-…"
                      className="w-full rounded-[12px] px-3 py-2.5 mb-2 text-[12px]"
                      style={{
                        background:'var(--cream)',
                        border: trimmed && !looksValid ? '1px solid var(--rose)' : '1px solid var(--line)',
                        color:'var(--ink)',
                        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}
                    />
                    {trimmed && !looksValid && (
                      <p className="text-[10.5px] mb-3" style={{color:'var(--rose)'}}>
                        That doesn't look like an Anthropic key (should start with "sk-").
                      </p>
                    )}
                    <p className="text-[10.5px] mb-4 leading-snug" style={{color:'var(--ink-soft)'}}>
                      Get one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline" style={{color:'var(--accent)'}}>console.anthropic.com</a>. Stored locally — never sent anywhere except Anthropic.
                    </p>
                    <button
                      type="button"
                      onClick={saveKey}
                      disabled={!trimmed || !looksValid}
                      className="w-full rounded-full py-3 px-5 transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed mb-2"
                      style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
                    >{hasPhotoToRead ? 'Save & Read' : 'Save Key'}</button>
                  </>
                )}

                {/* Analyzing pulse */}
                {isAnalyzing && (
                  <div className="flex items-center justify-center mb-5" style={{height: 80}}>
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{background:'var(--accent)', animation:'pulse-soft 1.4s ease-in-out infinite'}}
                    />
                  </div>
                )}

                {/* First-read chips */}
                {chips && chips.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                    {chips.map((c, i) => (
                      <span
                        key={i}
                        className="rounded-full px-3 py-1.5"
                        style={{
                          background: 'var(--cream)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink)',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '-0.005em',
                        }}
                      >
                        <span style={{color:'var(--ink-soft)', marginRight: 6, fontSize: 9.5, letterSpacing: '0.12em', textTransform:'uppercase'}}>{c.kind}</span>
                        {c.word}
                      </span>
                    ))}
                  </div>
                )}

                {/* Continue — always available so a slow read never traps the user */}
                <button
                  type="button"
                  onClick={advance}
                  className="w-full rounded-full py-3 px-5 transition hover:opacity-90"
                  style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
                >{chips && chips.length > 0 ? 'Continue' : (isAnalyzing ? 'Continue without waiting' : 'Continue')}</button>
                {!isAnalyzing && (!chips || chips.length === 0) && (
                  <button
                    type="button"
                    onClick={() => { set({ apiKeyDraft: '' }); advance(); }}
                    className="w-full text-center transition hover:opacity-70 py-2 mt-2"
                    style={{color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.22em', cursor:'pointer', textTransform:'uppercase'}}
                  >Skip for now</button>
                )}
              </div>
            );
          })()}

          {/* === STEP 4 — ABOUT YOUR SKIN ===
              Packs the v1 `goals` + `tolerance` stages onto one card.
              Two pill rows. Both optional — Continue is always enabled. */}
          {o.stage === 'about' && (
            <div>
              <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>4 · About Your Skin</div>
              <h2 className="font-serif text-[28px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.018em'}}>Two quick questions.</h2>
              <p className="text-[12px] leading-snug mb-5" style={{color:'var(--ink-soft)'}}>Both optional. Skip what doesn’t fit.</p>

              {/* Goals row — MULTI-SELECT → soft-tinted selected.
                  Selected gets a 10% plum wash + 26% plum border so the
                  pick reads as "softly marked" rather than filled. Ink
                  text stays dark so the label remains the focal point.
                  Editorial calm, not app-y high-contrast.  */}
              <p className="text-[14px] mb-3" style={{color:'var(--ink)', fontWeight:750, letterSpacing:'-0.01em', lineHeight:1.25}}>What are you working on?</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {GOAL_OPTIONS.map(g => {
                  const active = (o.goals || []).includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGoal(g.id)}
                      className="rounded-[12px] px-3 py-2.5 flex items-center gap-2 transition"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--cream))' : 'var(--cream)',
                        color: active ? 'var(--accent)' : 'var(--ink)',
                        border: active
                          ? '1px solid color-mix(in srgb, var(--accent) 42%, var(--line))'
                          : '1px solid var(--line)',
                        boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon
                        name={g.icon}
                        size={12}
                        style={{color: active ? 'var(--accent)' : 'var(--ink-soft)'}}
                      />
                      <span className="text-[11px]" style={{fontWeight:600, letterSpacing:'-0.005em'}}>{g.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tolerance row — SINGLE-SELECT.
                  Selected uses the same soft accent treatment as
                  multi-select pills so the page reads as one system. */}
              <p className="text-[14px] mb-3" style={{color:'var(--ink)', fontWeight:750, letterSpacing:'-0.01em', lineHeight:1.25}}>How reactive is your skin?</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {TOLERANCE_OPTIONS.map(tl => {
                  const active = o.skinTolerance === tl.id;
                  return (
                    <button
                      key={tl.id}
                      type="button"
                      onClick={() => set({ skinTolerance: active ? '' : tl.id })}
                      className="rounded-full px-3 py-1.5 transition"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--cream))' : 'var(--cream)',
                        color: active ? 'var(--accent)' : 'var(--ink)',
                        border: active ? '1px solid color-mix(in srgb, var(--accent) 42%, var(--line))' : '1px solid var(--line)',
                        boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent)' : 'none',
                        fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', cursor: 'pointer',
                      }}
                      title={tl.sub}
                    >{tl.label}</button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={advance}
                className="w-full rounded-full py-3 px-5 transition hover:opacity-90"
                style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
              >Continue</button>
              <button
                type="button"
                onClick={advance}
                className="w-full text-center transition hover:opacity-70 py-2 mt-2"
                style={{color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.22em', cursor:'pointer', textTransform:'uppercase'}}
              >Skip for now</button>
            </div>
          )}{/* end of about — pill text harmonized to 600/11 to match Context (May 2026 v2) */}

          {/* === STEP 5 — A BIT OF CONTEXT ===
              Packs the v1 `experience` + `clinical` stages onto one card.
              Experience as a 3-chip pick; clinical as condition + Rx chips.
              Everything optional. */}
          {o.stage === 'context' && (
            <div>
              <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>5 · A Bit of Context</div>
              <h2 className="font-serif text-[28px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.018em'}}>Anything we should know?</h2>
              <p className="text-[12px] leading-snug mb-5" style={{color:'var(--ink-soft)'}}>All optional. Helps us tune the routine.</p>

              {/* Experience row — SINGLE-SELECT.
                  Same soft selected treatment as the other chips. */}
              <p className="text-[14px] mb-3" style={{color:'var(--ink)', fontWeight:750, letterSpacing:'-0.01em', lineHeight:1.25}}>How involved is your routine?</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {EXPERIENCE_LEVELS.map(lv => {
                  const active = o.experienceLevel === lv.id;
                  return (
                    <button
                      key={lv.id}
                      type="button"
                      onClick={() => set({ experienceLevel: active ? '' : lv.id })}
                      className="rounded-full px-3 py-1.5 transition"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--cream))' : 'var(--cream)',
                        color: active ? 'var(--accent)' : 'var(--ink)',
                        border: active ? '1px solid color-mix(in srgb, var(--accent) 42%, var(--line))' : '1px solid var(--line)',
                        boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent)' : 'none',
                        fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', cursor: 'pointer',
                      }}
                      title={lv.sub}
                    >{lv.label}</button>
                  );
                })}
              </div>

              {/* Conditions — MULTI-SELECT → soft-tinted selected.
                  Same wash treatment as goals; multi-pick reads calmer
                  without the solid fill stack. */}
              <p className="text-[14px] mb-3" style={{color:'var(--ink)', fontWeight:750, letterSpacing:'-0.01em', lineHeight:1.25}}>Any skin conditions?</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {CONDITION_OPTIONS.map(c => {
                  const active = (o.skinConditions || []).includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCondition(c)}
                      className="rounded-full px-3 py-1.5 transition"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--cream))' : 'var(--cream)',
                        color: active ? 'var(--accent)' : 'var(--ink)',
                        border: active
                          ? '1px solid color-mix(in srgb, var(--accent) 42%, var(--line))'
                          : '1px solid var(--line)',
                        boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent)' : 'none',
                        fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', cursor: 'pointer',
                      }}
                    >{c}</button>
                  );
                })}
              </div>

              {/* Rx / history — MULTI-SELECT → soft-tinted selected. */}
              <p className="text-[14px] mb-3" style={{color:'var(--ink)', fontWeight:750, letterSpacing:'-0.01em', lineHeight:1.25}}>Currently using or have used?</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {RX_OPTIONS.map(rx => {
                  const active = (o.currentRxOrHistory || []).includes(rx);
                  return (
                    <button
                      key={rx}
                      type="button"
                      onClick={() => toggleRx(rx)}
                      className="rounded-full px-3 py-1.5 transition"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--cream))' : 'var(--cream)',
                        color: active ? 'var(--accent)' : 'var(--ink)',
                        border: active
                          ? '1px solid color-mix(in srgb, var(--accent) 42%, var(--line))'
                          : '1px solid var(--line)',
                        boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent)' : 'none',
                        fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', cursor: 'pointer',
                      }}
                    >{rx}</button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={advance}
                className="w-full rounded-full py-3 px-5 transition hover:opacity-90"
                style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
              >Continue</button>
              <button
                type="button"
                onClick={advance}
                className="w-full text-center transition hover:opacity-70 py-2 mt-2"
                style={{color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.22em', cursor:'pointer', textTransform:'uppercase'}}
              >Skip for now</button>
            </div>
          )}

          {/* === STEP 6 — BUILD YOUR SHELF ===
              Scan / Search-by-name / Search-by-brand entry paths. Each
              pre-sets ProductModal's productEntryMode so the modal
              lands directly on the right screen. Modal lives on top
              of the overlay; closing it returns here. */}
          {o.stage === 'shelf' && (() => {
            const shelfCount = (products || []).filter(p => !p.endDate).length;
            return (
            <div>
              <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>6 · Build Your Shelf</div>
              <h2 className="font-serif text-[28px] leading-tight mb-2" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.018em'}}>Let's start with a few products.</h2>
              {shelfCount > 0 ? (
                <div className="flex items-center gap-2 mb-5 rounded-[10px] px-3 py-2"
                  style={{background:'rgba(138, 155, 126, 0.10)', border:'1px solid rgba(138, 155, 126, 0.32)'}}
                >
                  <Icon name="CheckCircle" size={14} style={{color:'var(--sage)'}} />
                  <span className="text-[12px] leading-snug" style={{color:'var(--ink)'}}>
                    <span style={{fontWeight:600}}>{shelfCount} product{shelfCount === 1 ? '' : 's'} saved.</span>
                    <span style={{color:'var(--ink-soft)'}}> Add more or continue.</span>
                  </span>
                </div>
              ) : (
                <p className="text-[12.5px] leading-snug mb-5" style={{color:'var(--ink-soft)'}}>
                  Add products you currently use so we can personalize your routine.
                </p>
              )}
              <div className="space-y-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    set({ productEntryMethod: 'scan', shelfStarted: true });
                    setProductEntryMode && setProductEntryMode('scan');
                    setShowProductModal && setShowProductModal(true);
                  }}
                  className="w-full rounded-[12px] py-3 px-4 flex items-center gap-3 transition hover:bg-[var(--cream)]"
                  style={{background:'var(--cream)', color:'var(--ink)', border:'1px solid var(--line)', fontWeight:600, fontSize:12, cursor:'pointer'}}
                >
                  <Icon name="Camera" size={14} style={{color:'var(--ink-soft)'}} />
                  <span>Scan product</span>
                  <Icon name="ChevronRight" size={13} style={{color:'var(--ink-soft)', marginLeft:'auto'}} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    set({ productEntryMethod: 'search', shelfStarted: true });
                    setProductEntryMode && setProductEntryMode('manual');
                    setShowProductModal && setShowProductModal(true);
                  }}
                  className="w-full rounded-[12px] py-3 px-4 flex items-center gap-3 transition hover:bg-[var(--cream)]"
                  style={{background:'var(--cream)', color:'var(--ink)', border:'1px solid var(--line)', fontWeight:600, fontSize:12, cursor:'pointer'}}
                >
                  <Icon name="Search" size={14} style={{color:'var(--ink-soft)'}} />
                  <span>Search by name</span>
                  <Icon name="ChevronRight" size={13} style={{color:'var(--ink-soft)', marginLeft:'auto'}} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    set({ productEntryMethod: 'brand', shelfStarted: true });
                    setProductEntryMode && setProductEntryMode('brand');
                    setShowProductModal && setShowProductModal(true);
                  }}
                  className="w-full rounded-[12px] py-3 px-4 flex items-center gap-3 transition hover:bg-[var(--cream)]"
                  style={{background:'var(--cream)', color:'var(--ink)', border:'1px solid var(--line)', fontWeight:600, fontSize:12, cursor:'pointer'}}
                >
                  <Icon name="Sparkles" size={14} style={{color:'var(--ink-soft)'}} />
                  <span>Search by brand</span>
                  <Icon name="ChevronRight" size={13} style={{color:'var(--ink-soft)', marginLeft:'auto'}} />
                </button>
              </div>
              {shelfCount > 0 ? (
                <button
                  type="button"
                  onClick={advance}
                  className="w-full rounded-full py-3 px-5 transition hover:opacity-90 mt-2"
                  style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
                >Continue</button>
              ) : (
                <button
                  type="button"
                  onClick={() => { set({ productEntryMethod: 'later' }); advance(); }}
                  className="w-full rounded-full py-3 px-5 transition hover:bg-[var(--cream)] mt-2"
                  style={{background:'transparent', color:'var(--ink-soft)', border:'1px solid var(--line)', fontWeight:600, fontSize:11, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
                >Add later</button>
              )}
            </div>
            );
          })()}

          {/* === STEP 7 — REVEAL (building + first-routine collapsed) ===
              Plays the phases ticker, then morphs in place into the
              routine card. Sub-state via o.revealSubstate: 'building'
              (default on mount) → 'routine' (once phases finish).
              If user has no shelf products, falls back to FOUNDATIONAL
              preview (absorbed from the v1 standalone fallback stage). */}
          {o.stage === 'reveal' && (() => {
            const sub = o.revealSubstate || 'building';
            if (sub === 'building') {
              return (
                <OnboardingBuildingPhases
                  phases={REVEAL_PHASES}
                  onDone={() => {
                    const hasProducts = (products || []).filter(p => !p.endDate).length > 0;
                    set({
                      generatedRoutineType: hasProducts ? 'personalized' : 'foundational',
                      generatedRoutine: o.generatedRoutine || FOUNDATIONAL,
                      revealSubstate: 'routine',
                    });
                  }}
                />
              );
            }
            // sub === 'routine' — derive preview from shelf when personalized.
            const routineKind = o.generatedRoutineType || 'foundational';
            const inferSlot = (p) => {
              const ut = (p.useTimes || []).map(t => String(t).toLowerCase());
              if (ut.length > 0) {
                return { am: ut.includes('am'), pm: ut.includes('pm') };
              }
              const cat = String(p.category || '').toLowerCase();
              if (/sunscreen|spf|sun(?!flower)/.test(cat)) return { am: true, pm: false };
              if (/retinoid|retinol|aha|bha|acid|exfoliant|treatment/.test(cat)) return { am: false, pm: true };
              return { am: true, pm: true };
            };
            const activeFace = (products || []).filter(p => !p.endDate && !isBodyProduct(p));
            let r;
            if (routineKind === 'personalized' && activeFace.length > 0) {
              const amProducts = activeFace.filter(p => inferSlot(p).am).map(p => ({
                name: p.name || p.brand || 'Product',
                sub: p.brand || p.category || '',
              }));
              const pmProducts = activeFace.filter(p => inferSlot(p).pm).map(p => ({
                name: p.name || p.brand || 'Product',
                sub: p.brand || p.category || '',
              }));
              r = { am: amProducts, pm: pmProducts };
            } else {
              r = o.generatedRoutine || FOUNDATIONAL;
            }
            return (
              <div>
                <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>7 · Your First Regimen</div>
                <h2 className="font-serif text-[28px] leading-tight mb-2" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.018em'}}>Your first regimen is built.</h2>
                <p className="text-[12.5px] leading-snug mb-1" style={{color:'var(--ink-soft)'}}>
                  {routineKind === 'personalized'
                    ? 'Regimen saved from your shelf.'
                    : 'Starter preview — add products to make this real.'}
                </p>
                <p className="text-[11px] leading-snug mb-5" style={{color:'var(--ink-soft)'}}>
                  First draft. Rebuild or refine anytime from the <span style={{color:'var(--accent)', fontWeight:600}}>Regimen</span> tab — we’ll learn as you check in.
                </p>
                <div className="rounded-[14px] p-4 mb-4" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[9px] tracking-[0.24em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>AM</div>
                      <ul className="space-y-1.5">
                        {(r.am || []).map((p, i) => (
                          <li key={i}>
                            <div className="text-[11.5px]" style={{color:'var(--ink)', fontWeight:600}}>{p.name}</div>
                            <div className="text-[10px]" style={{color:'var(--ink-soft)'}}>{p.sub || p.category || ''}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[9px] tracking-[0.24em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>PM</div>
                      <ul className="space-y-1.5">
                        {(r.pm || []).map((p, i) => (
                          <li key={i}>
                            <div className="text-[11.5px]" style={{color:'var(--ink)', fontWeight:600}}>{p.name}</div>
                            <div className="text-[10px]" style={{color:'var(--ink-soft)'}}>{p.sub || p.category || ''}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={finishOnboarding}
                  className="w-full rounded-full py-3 px-5 transition hover:opacity-90 mb-2"
                  style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase'}}
                >Let's get started</button>
                {/* Secondary: send the user straight to Regimen so they know
                    that's the canonical surface for ongoing rebuilds. The old
                    "Add products to personalize" pointed at the product modal,
                    which felt like a one-shot. Regimen is the durable home for
                    refinement. May 2026 v2 — Jenni's wayfinding clarification. */}
                <button
                  type="button"
                  onClick={() => { finishOnboarding(); setTimeout(() => { try { setActiveTab && setActiveTab('regimen'); setRegimenView && setRegimenView('build'); } catch (_) {} }, 200); }}
                  className="w-full text-center transition hover:opacity-70 py-2 flex items-center justify-center gap-1"
                  style={{color:'var(--accent)', fontWeight:600, fontSize:11, cursor:'pointer'}}
                >
                  <span>Rebuild anytime in Regimen</span>
                  <Icon name="ArrowRight" size={11} />
                </button>
              </div>
            );
          })()}
        </div>

        {/* === SAFETY STRIP (bottom, all steps) === */}
        <div className="mt-5 text-center text-[10px] leading-snug max-w-[420px] mx-auto" style={{color:'var(--ink-soft)'}}>
          Your photos and information stay private. You can always refine later.
        </div>
      </div>
    </div>
  );
};
