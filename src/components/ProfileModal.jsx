// === ProfileModal (extracted from index.jsx.source — May 2026 per Jenni) ===
// Stable component identity prevents the remount cascade that made wizard
// clicks feel dead from the hamburger entry. Everything the modal needs
// is passed in via props (state, setters, helpers). DEFAULT_USER_PROFILE
// is duplicated locally so the file is self-contained — keep it in sync
// with the App-scope definition if you change either.
//
// Codex noted (May 2026): the prior inline-inside-App definition was
// recreated on every App render → React reconciler saw a fresh elementType
// at the same JSX position → unmount + remount the entire wizard subtree
// mid-interaction. Lifting the implementation out of App makes the
// elementType stable, so the wizard survives parent re-renders
// triggered by toasts, cloud sync, log saves, etc.
const PROFILE_MODAL_DEFAULT_USER_PROFILE = {
sunReactivity: '',
fitzpatrick: '',
monkSkinTone: '',
undertone: '',
skinType: '',
skinModifiers: [],
primaryConcerns: [],
pigmentBiology: { redness: null, flushing: null, freckles: null, darkMarks: null, melasma: null, unevenTone: null },
barrierScale: '',
triggers: [],
diagnosedConditions: [],
currentRx: [],
environment: { city: '', humidity: '', uv: '', altitude: '', seasonality: '', pollution: '', hardWater: '' },
location: '',
goals: [],
ageBand: '',
// === AGE (May 30 2026 — Agent D-v3) ===
// Numeric age. Distinct from `ageBand` (legacy free-text range).
// Onboarding writes it; ProfileModal step 8 makes it editable;
// Insights reads it for context. Null when the user hasn't set it.
age: null,
// === EXPERIENCE LEVEL (mirror, May 30 2026) ===
// Mirrored from onboardingState.experienceLevel at the end of
// onboarding so post-flow surfaces (Insights Lessons filter,
// future profile-aware AI prompts) have a single source of
// truth without reaching into onboardingState directly.
experienceLevel: ''};
const ProfileModal = ({
// === State + setters (lifted from App) ===
profileWizardForm, setProfileWizardForm,
profileWizardStep, setProfileWizardStep,
profileTonePhoto, setProfileTonePhoto,
profileTonePhotoSource, setProfileTonePhotoSource,
profileToneSuggestion, setProfileToneSuggestion,
profileToneSuggesting, setProfileToneSuggesting,
profileToneError, setProfileToneError,
profileAiSummary, setProfileAiSummary,
profileSummaryLoading, setProfileSummaryLoading,
// === App-level dependencies ===
userProfile, setUserProfile,
logs,
hormonalContext, setHormonalContext,
sensitivities, setSensitivities,
// === Helpers (some are App-scope so must be passed in) ===
callClaude,
callGeminiVision,
// fetchPhotoAsBase64 + getApiKey are module-scope in the runtime bundle
// (concatenated before this component), but accepting them as props makes
// the dependency surface explicit and matches the prop bridge App uses
// for every other helper. The render site passes the same module-scope
// reference, so behavior is identical to using the global.
fetchPhotoAsBase64,
getApiKey,
toast,
saveData,
setShowProfileModal,
onOpenScoreExplainer,
DEFAULT_USER_PROFILE = PROFILE_MODAL_DEFAULT_USER_PROFILE}) => {
  // === STATE COMES FROM APP-LEVEL REFS (see comment near profileWizardStep) ===
  // ProfileModal is recreated on every App render; using local useState would
  // reset progress whenever a toast/log/auto-save fires. The lifted state lives
  // in App so it survives remounts. We seed `profileWizardForm` lazily on the
  // first render where it's still null — keeps the "open the modal fresh from
  // saved profile" behavior intact. To clear when the modal closes, see the
  // setShowProfileModal(false) callsites — they reset stepIdx + form.
  // Scroll preservation across App-induced remounts.
  const scrollSentinelRef = useRef(null);
  // State is now eagerly seeded at App level — profileWizardForm is
  // always a real object. Defensive `|| DEFAULT_USER_PROFILE` added
  // May 2026 after Jenni reported clicks dead from the hamburger entry
  // — if any code path ever leaves profileWizardForm in a null/undefined
  // state, the modal would still render but every `profileForm.foo === x`
  // comparison would throw a TypeError silently (caught by React's
  // error boundary) and the button onClicks would never paint a
  // selected state. The fallback keeps the render path safe.
  const profileForm = profileWizardForm || DEFAULT_USER_PROFILE;
  const setProfileForm = (updater) => setProfileWizardForm(prev => {
    const base = (prev && typeof prev === 'object') ? prev : { ...DEFAULT_USER_PROFILE };
    return typeof updater === 'function' ? updater(base) : updater;
  });
  const stepIdx = profileWizardStep;
  const setStepIdx = setProfileWizardStep;
  // === TOTAL_STEPS = 12 (May 2026) ===
  // Section 12 is a "How Frida reads you" summary that maps each profile
  // answer to a concrete change in how the app's AI surfaces recommendations.
  // Distinct from Section 11 (which is the editorial Skin Summary) — Section
  // 12 is the impact-on-analysis explainer the user can review before saving.
  const TOTAL_STEPS = 12;
  // Lazy-seed effect retired — state is now eagerly seeded at App level
  // so profileWizardForm is always a real object. Reset on close happens
  // in the showProfileModal useEffect above.

  // === MONK SKIN TONE PHOTO + AI SUGGESTION ===
  // Same lifted-state treatment so the photo + suggestion survive remounts.
  const tonePhoto = profileTonePhoto;
  const setTonePhoto = setProfileTonePhoto;
  const tonePhotoSource = profileTonePhotoSource;
  const setTonePhotoSource = setProfileTonePhotoSource;
  const toneSuggestion = profileToneSuggestion;
  const setToneSuggestion = setProfileToneSuggestion;
  const toneSuggesting = profileToneSuggesting;
  const setToneSuggesting = setProfileToneSuggesting;
  const toneError = profileToneError;
  const setToneError = setProfileToneError;
  const toneFileInputRef = useRef(null);
  // === HANG-FIX: INLINE ERROR STATE (May 31 2026 per Jenni) ===
  // Local state — does NOT need to persist across App remounts because
  // it's only meaningful in the moment a failed/timed-out AI call lands.
  // When set, the AI summary block (bottom of the wizard) renders a
  // banner with "try again" / "close" instead of either the spinner
  // (which used to hang forever on network failure) or nothing (which
  // left the user staring at a dead modal with no signal). The X in
  // Modal.jsx is always clickable regardless — see Modal.jsx onClose.
  const [profileSummaryError, setProfileSummaryError] = useState(null);
  // 15s AI timeout cap — anything longer feels broken to the user even
  // if the network is technically still alive. Surfaces a clean error
  // banner with retry instead of spinning indefinitely.
  const PROFILE_AI_TIMEOUT_MS = 15000;

  // Auto-pull most recent skin photo when the user lands on the Monk step
  // for the first time (and only if they haven't already loaded a photo).
  // We do NOT call Gemini here — that's the next effect, scoped to fire
  // exactly once per loaded photo.
  useEffect(() => {
    if (stepIdx !== 1) return;
    if (tonePhoto) return;
    const photoLogs = (logs || []).filter(l => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:')));
    if (photoLogs.length === 0) return;
    const recent = photoLogs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    let cancelled = false;
    (async () => {
      let dataUrl = null;
      if (typeof recent.photo === 'string' && recent.photo.startsWith('data:')) {
        dataUrl = recent.photo;
      } else if (recent.photoPath) {
        dataUrl = await fetchPhotoAsBase64(recent.photoPath);
      }
      if (!cancelled && dataUrl) {
        setTonePhoto(dataUrl);
        setTonePhotoSource('auto');
      }
    })();
    return () => { cancelled = true; };
  }, [stepIdx]);

  // Run Gemini Vision to suggest a Monk swatch whenever the loaded photo
  // changes. Strict JSON contract; we never auto-set the user's pick — the
  // suggestion lives as a quiet "Frida's best guess" chip they can tap to
  // accept. Lighting variance makes this advisory at best.
  useEffect(() => {
    if (stepIdx !== 1) return;
    if (!tonePhoto || toneSuggestion || toneSuggesting) return;
    // July 2026: getApiKey() gate removed — this runs on callGeminiVision,
    // which works keyless via the proxy. The old gate silently hid the
    // tone suggestion from every keyless user.
    let cancelled = false;
    setToneSuggesting(true);
    setToneError(null);
    const swatchDescr = '1 (very light/cool) → 5 (medium/warm) → 10 (very deep)';
    const prompt = `You are reading a face photo to estimate the closest Monk Skin Tone (MST) scale match.

Monk Skin Tone scale: ${swatchDescr}. Pick a single integer 1–10.

CRITICAL CONTEXT:
- Photo lighting may be off (warm indoor / cool daylight / harsh shadow). Bias your guess toward the more CONSERVATIVE midpoint when lighting is uncertain.
- If the face is occluded, in dark shadow, or you cannot read the tone clearly, respond with confidence "low" and pick the middle tone (5).
- Estimate the natural cheek tone, not lip/eye/clothing color.

Respond ONLY with this JSON, no prose, no code fences:
{"swatch":"<1-10>","confidence":"low|medium|high","note":"<one short sentence about lighting or what you observed, max 14 words>"}`;
    // 15s race — if the vision call hangs (rate-limit retry storm, dead
    // network), surface a soft "unavailable" message instead of leaving
    // the tone suggestion chip spinning.
    Promise.race([
      callGeminiVision(tonePhoto, prompt, { temperature: 0.1, maxTokens: 200 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Vision request timed out after 15s')), PROFILE_AI_TIMEOUT_MS))
    ])
      .then(text => {
        if (cancelled) return;
        try {
          const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
          const start = cleaned.indexOf('{');
          const end = cleaned.lastIndexOf('}');
          if (start === -1 || end === -1) throw new Error('No JSON in response');
          const parsed = JSON.parse(cleaned.slice(start, end + 1));
          const swatch = String(parsed.swatch);
          if (!/^([1-9]|10)$/.test(swatch)) throw new Error('Invalid swatch number');
          setToneSuggestion({
            swatch,
            confidence: ['low','medium','high'].includes(parsed.confidence) ? parsed.confidence : 'medium',
            note: String(parsed.note || '').slice(0, 120)});
        } catch (e) {
          setToneError("Couldn't read the photo cleanly.");
        }
      })
      .catch(e => {
        if (cancelled) return;
        // Quietly degrade — never block the wizard. Most likely cause is
        // rate-limit (200/day) or no Gemini key configured for this device.
        setToneError(/limit/i.test(e?.message || '') ? 'Daily AI limit reached.' : 'Tone suggestion unavailable.');
      })
      .finally(() => { if (!cancelled) setToneSuggesting(false); });
    return () => { cancelled = true; };
  }, [stepIdx, tonePhoto]);

  // === PROFILE UPDATE — DIAGNOSTIC WRAPPER (May 2026) ===
  // Jenni reports clicks on answer buttons don't visibly register on the
  // Skin Profile wizard. The state path looks correct (update → setProfileForm
  // → setProfileWizardForm at App scope), so if this still fails after a
  // hard refresh the issue is either (a) a transparent overlay covering
  // the buttons, (b) the wizard rendering against a different render tree
  // than the App scope state, or (c) a browser-cached old bundle. The
  // console traces below surface what's happening at click time so the
  // user can paste the output if the bug persists.
  const update = (key, value) => {
    setProfileForm(prev => ({ ...prev, [key]: value }));
  };
  const updateNested = (group, key, value) => setProfileForm(prev => ({ ...prev, [group]: { ...(prev[group] || {}), [key]: value } }));
  const toggleArrayItem = (key, value) => {
    setProfileForm(prev => {
      const arr = prev[key] || [];
      const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };
  const toggleArrayCapped = (key, value, max) => setProfileForm(prev => {
    const arr = prev[key] || [];
    if (arr.includes(value)) return { ...prev, [key]: arr.filter(x => x !== value) };
    if (max && arr.length >= max) return prev;
    return { ...prev, [key]: [...arr, value] };
  });
  // === PER-STEP AUTO-SAVE ===
  // Silently persists the in-progress form to userProfile on every step
  // change. Means the user can close the modal any time (via X / back
  // gesture / accidental dismiss) and resume exactly where they left
  // off — no lost work. Saves to localStorage + Supabase via saveData.
  const persistProfileDraft = (form) => {
    const sunToFitz = { 'always-burns':'I', 'usually-burns':'II', 'sometimes-burns':'III', 'rarely-burns':'IV', 'very-rarely':'V', 'never-burns':'VI' };
    const draft = { ...form, fitzpatrick: form.fitzpatrick || sunToFitz[form.sunReactivity] || '' };
    setUserProfile(draft);
    saveData('userProfile', draft);
  };
  useEffect(() => {
    // Auto-save whenever stepIdx changes (i.e. user clicked Next/Back).
    if (profileWizardForm) persistProfileDraft(profileWizardForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  // === FINAL SAVE — commits + generates AI analysis ===
  // On the last-step "Save Profile" click: commit, generate a < 50 word
  // AI impact summary in the background, surface it inline, then close.
  const handleSave = async () => {
    const sunToFitz = { 'always-burns':'I', 'usually-burns':'II', 'sometimes-burns':'III', 'rarely-burns':'IV', 'very-rarely':'V', 'never-burns':'VI' };
    const finalProfile = { ...profileForm, fitzpatrick: profileForm.fitzpatrick || sunToFitz[profileForm.sunReactivity] || '' };
    setUserProfile(finalProfile);
    // Bug #8 (May 31 2026): if saveData rejects (storage full, Supabase
    // offline, etc.) control never reached the AI block below — the
    // modal hung with no signal, no toast, no banner. Wrap so we surface
    // a clean inline error banner + toast and bail out before the AI
    // summary code path. profileSummaryLoading is explicitly cleared
    // (Agent C added the inline error state above).
    try {
      await saveData('userProfile', finalProfile);
    } catch (e) {
      console.warn('[ProfileModal handleSave saveData]', e);
      try { toast('Profile save failed — please retry', 'error'); } catch (_) {}
      setProfileSummaryError('Could not save profile. Please retry.');
      setProfileSummaryLoading(false);
      return;
    }
    // Kick off AI summary — non-blocking, shows inline on the wizard.
    if (getApiKey()) {
      setProfileSummaryLoading(true);
      setProfileSummaryError(null);
      const profileLines = [];
      if (finalProfile.skinType) profileLines.push(`Skin type: ${finalProfile.skinType}`);
      if (finalProfile.fitzpatrick) profileLines.push(`Fitzpatrick: ${finalProfile.fitzpatrick}`);
      if (finalProfile.monkSkinTone) profileLines.push(`Monk skin tone: ${finalProfile.monkSkinTone}`);
      if (finalProfile.ageBand) profileLines.push(`Age: ${finalProfile.ageBand}`);
      if (finalProfile.barrierScale) profileLines.push(`Barrier: ${finalProfile.barrierScale}`);
      if ((finalProfile.skinModifiers || []).length) profileLines.push(`Modifiers: ${finalProfile.skinModifiers.join(', ')}`);
      if ((finalProfile.primaryConcerns || []).length) profileLines.push(`Concerns: ${finalProfile.primaryConcerns.join(', ')}`);
      if ((finalProfile.diagnosedConditions || []).length) profileLines.push(`Diagnosed: ${finalProfile.diagnosedConditions.join(', ')}`);
      if ((finalProfile.currentRx || []).length) profileLines.push(`Rx: ${finalProfile.currentRx.join(', ')}`);
      if ((finalProfile.goals || []).length) profileLines.push(`Goals: ${finalProfile.goals.join(', ')}`);
      if (hormonalContext) profileLines.push(`Hormonal context: ${hormonalContext}`);
      const aiPrompt = `The user just filled in their clinical skin profile. Write ONE short read — UNDER 50 WORDS TOTAL — explaining what their inputs change about how we'll read their skin going forward.\n\nProfile:\n${profileLines.join('\n')}\n\nLead with the most consequential trait (e.g. "Fitzpatrick II + barrier-stripped" or "Tretinoin user with retinoid sensitivity"). Then in one sentence say what we'll watch for, in one sentence say what we'll skip recommending. 50 words max. No greeting, no signoff.`;
      try {
        // 15s timeout (was 20s) — both via withTimeout AND a defensive
        // Promise.race in case withTimeout's underlying impl ever changes.
        // Belt-and-suspenders here matters because this is the spot Jenni
        // reported the modal hanging with no recourse.
        const claudeCall = callClaude(aiPrompt, '', null, { model: 'claude-haiku-4-5-20251001', maxTokens: 200, voice: true });
        const raced = Promise.race([
          claudeCall,
          new Promise((_, rej) => setTimeout(() => rej(new Error('AI request timed out after 15s')), PROFILE_AI_TIMEOUT_MS))
        ]);
        const summary = await withTimeout(raced, PROFILE_AI_TIMEOUT_MS, 'profile-summary');
        const cleaned = String(summary || '').trim();
        setProfileAiSummary(cleaned);
        setProfileSummaryError(null);
        // Also persist on userProfile so future opens can show the prior summary.
        const withSummary = { ...finalProfile, aiSummary: cleaned, aiSummaryAt: Date.now() };
        setUserProfile(withSummary);
        saveData('userProfile', withSummary);
      } catch (e) {
        console.warn('[profile-ai-summary]', e?.message);
        setProfileAiSummary(null);
        // Inline banner — replaces the toast-then-hang behavior. Profile
        // is already saved (above), so user can safely close or retry.
        setProfileSummaryError(e?.message || 'AI read unavailable');
      } finally {
        setProfileSummaryLoading(false);
      }
    } else {
      // No API key — just close with a toast.
      setShowProfileModal(false);
      toast('Skin profile saved.', 'info');
    }
  };

  // === Editorial summary generator ===
  // Produces the "Frida understands your skin as…" sentence on step 11.
  // Reads from current profileForm (not saved profile yet) so user sees a
  // live preview as they go back to tweak.
  const buildSummary = () => {
    const f = profileForm;
    const fragments = [];
    // Lead with skin type + modifiers
    const typeFrag = f.skinType ? f.skinType : null;
    const modFrag = (f.skinModifiers || []).slice(0, 2).map(m => m.replace(/-/g, ' ')).join(' & ') || null;
    if (typeFrag && modFrag) fragments.push(`${modFrag} ${typeFrag} skin`);
    else if (typeFrag) fragments.push(`${typeFrag} skin`);
    else if (modFrag) fragments.push(`${modFrag} skin`);
    // Pigment / redness lens
    if ((f.primaryConcerns || []).includes('hyperpigmentation') || (f.primaryConcerns || []).includes('PIH') || (f.primaryConcerns || []).includes('melasma')) fragments.push('with pigment sensitivity');
    else if ((f.primaryConcerns || []).includes('redness') || (f.primaryConcerns || []).includes('flushing')) fragments.push('with mild redness tendency');
    // Barrier
    if (f.barrierScale === 'compromised-barrier' || (f.skinModifiers || []).includes('compromised-barrier') || (f.primaryConcerns || []).includes('barrier-repair')) fragments.push('compromised barrier');
    else if (f.barrierScale === 'reactive' || f.barrierScale === 'very-reactive') fragments.push('reactive barrier');
    // Goals
    const topGoals = (f.goals || []).slice(0, 2).map(g => g.replace(/-/g, ' '));
    if (topGoals.length > 0) fragments.push(`with ${topGoals.join(' + ')} goals`);
    // Climate
    const env = f.environment || {};
    const climateBits = [];
    if (env.humidity) climateBits.push(env.humidity);
    if (env.city || f.location) climateBits.push((env.city || f.location).split(',')[0].trim());
    if (climateBits.length > 0) fragments.push(`in a ${climateBits.join(' ')} climate`);
    if (fragments.length === 0) return 'Skin profile in progress — fill in a few sections to get a tailored read.';
    return fragments.join(', ').replace(/, with/g, ', with') + '.';
  };
  // Bullet-point clinical highlights for the summary card.
  const buildHighlights = () => {
    const f = profileForm;
    const hi = [];
    if ((f.pigmentBiology?.darkMarks || 0) >= 4 || (f.primaryConcerns || []).includes('hyperpigmentation')) hi.push({ icon: 'Sparkles', text: 'High pigment sensitivity' });
    if ((f.pigmentBiology?.redness || 0) >= 3 || (f.primaryConcerns || []).includes('redness')) hi.push({ icon: 'Activity', text: 'Mild redness tendency' });
    if ((f.skinModifiers || []).includes('dehydrated') || (f.skinModifiers || []).includes('congestion-prone')) hi.push({ icon: 'Droplet', text: 'Dehydrated & congestion-prone' });
    if ((f.barrierScale === 'reactive') || (f.barrierScale === 'very-reactive') || (f.skinModifiers || []).includes('compromised-barrier')) hi.push({ icon: 'Shield', text: 'Barrier needs support' });
    if ((f.goals || []).includes('fade-pigmentation') || (f.goals || []).includes('glow')) hi.push({ icon: 'Sun', text: 'Brightening & even tone goals' });
    if ((f.goals || []).includes('clear-acne') || (f.skinModifiers || []).includes('acne-prone')) hi.push({ icon: 'CircleDot', text: 'Acne management priority' });
    return hi.slice(0, 5);
  };

  // === REUSABLE OPTION BLOCKS ===
  const SUN_OPTS = [
    { id: 'always-burns',    label: 'Always burns, never tans',         icon: 'Sun' },
    { id: 'usually-burns',   label: 'Usually burns, tans minimally',    icon: 'Sun' },
    { id: 'sometimes-burns', label: 'Sometimes burns, gradually tans',  icon: 'Sun' },
    { id: 'rarely-burns',    label: 'Rarely burns, tans easily',        icon: 'Sun' },
    { id: 'very-rarely',     label: 'Very rarely burns',                icon: 'Sun' },
    { id: 'never-burns',     label: 'Never burns deeply / richly pigmented skin', icon: 'Sun' },
  ];
  const MONK_TONES = [
    { id: '1',  hex: '#f6ede4' }, { id: '2',  hex: '#f3e7db' },
    { id: '3',  hex: '#f7ead0' }, { id: '4',  hex: '#eadaba' },
    { id: '5',  hex: '#d7bd96' }, { id: '6',  hex: '#a07e56' },
    { id: '7',  hex: '#825c43' }, { id: '8',  hex: '#604134' },
    { id: '9',  hex: '#3a312a' }, { id: '10', hex: '#292420' },
  ];
  const UNDERTONE_OPTS = [
    { id: 'warm', label: 'Warm' }, { id: 'cool', label: 'Cool' },
    { id: 'neutral', label: 'Neutral' }, { id: 'olive', label: 'Olive' },
    { id: 'unsure', label: 'Unsure' },
  ];
  const SKIN_TYPE_OPTS = [
    { id: 'dry', label: 'Dry' }, { id: 'oily', label: 'Oily' },
    { id: 'combination', label: 'Combination' },
    { id: 'balanced', label: 'Balanced' }, { id: 'sensitive', label: 'Sensitive' },
  ];
  const SKIN_MODIFIER_OPTS = [
    'dehydrated', 'congestion-prone', 'reactive', 'easily-flushed', 'acne-prone', 'compromised-barrier',
  ];
  const PRIMARY_CONCERN_OPTS = [
    'acne', 'congestion', 'texture', 'enlarged-pores', 'redness', 'flushing',
    'hyperpigmentation', 'PIH', 'melasma', 'dullness', 'dehydration',
    'fine-lines', 'wrinkles', 'laxity', 'barrier-repair', 'dark-circles', 'puffiness',
  ];
  const PIGMENT_BIO_KEYS = [
    { key: 'redness',     label: 'Redness tendency' },
    { key: 'flushing',    label: 'Flushing tendency' },
    { key: 'freckles',    label: 'Freckles easily' },
    { key: 'darkMarks',   label: 'Dark marks linger' },
    { key: 'melasma',     label: 'Melasma tendency' },
    { key: 'unevenTone',  label: 'Uneven tone tendency' },
  ];
  const BARRIER_SCALE_OPTS = [
    { id: 'resilient',         label: 'Resilient' },
    { id: 'mildly-sensitive',  label: 'Mildly sensitive' },
    { id: 'sensitive',         label: 'Sensitive' },
    { id: 'reactive',          label: 'Reactive' },
    { id: 'very-reactive',     label: 'Very reactive' },
    { id: 'eczema-prone',      label: 'Eczema-prone' },
  ];
  const TRIGGER_OPTS = [
    'fragrance', 'acids', 'retinoids', 'sunscreens', 'oils', 'exfoliation', 'weather', 'stress',
  ];
  const HORMONAL_OPTS = [
    { id: 'puberty', label: 'Puberty' }, { id: 'cycling', label: 'Cycling' },
    { id: 'pcos', label: 'PCOS' }, { id: 'pregnancy', label: 'Pregnancy / breastfeeding' },
    { id: 'postpartum', label: 'Postpartum' }, { id: 'perimenopause', label: 'Perimenopause' },
    { id: 'menopause', label: 'Menopause / post-menopause' },
    { id: 'testosterone-therapy', label: 'Testosterone therapy' },
    { id: 'hormone-therapy', label: 'HRT / estrogen' },
    { id: 'none', label: 'None' }, { id: 'unspecified', label: 'Prefer not to say' },
  ];
  const DIAGNOSED_OPTS = [
    'acne vulgaris', 'rosacea', 'eczema / atopic dermatitis', 'seborrheic dermatitis',
    'psoriasis', 'melasma', 'perioral dermatitis', 'hidradenitis suppurativa',
    'keratosis pilaris', 'PIH', 'PCOS', 'vitiligo', 'none',
  ];
  const RX_OPTS = [
    'tretinoin', 'adapalene', 'tazarotene', 'azelaic acid (Rx)',
    'benzoyl peroxide', 'hydroquinone', 'isotretinoin (current)',
    'spironolactone', 'oral antibiotics', 'biologics',
    'topical steroids', 'tranexamic acid (oral)', 'hormonal birth control',
    'HRT / estrogen', 'GLP-1', 'metformin', 'none',
  ];
  const HUMIDITY_OPTS = ['arid', 'dry', 'temperate', 'humid', 'tropical'];
  const SEASONALITY_OPTS = ['four-season', 'mostly-warm', 'mostly-cold', 'monsoon'];
  const POLLUTION_OPTS = ['low', 'medium', 'high', 'urban-high'];
  const GOAL_OPTS = [
    'clear-acne', 'calm-redness', 'fade-pigmentation', 'strengthen-barrier',
    'glow', 'anti-aging', 'simplify-routine', 'indulgent-routine', 'science-first-results',
  ];

  // === SHARED STEP CHROME ===
  const stepHeader = (n, title, q) => (
    <div className="mb-5">
      {/* Progress dots — current step filled in terracotta. */}
      <div className="flex items-center justify-center gap-1.5 mb-5 px-1 flex-wrap">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <button
            key={i}
            onClick={() => setStepIdx(i)}
            className="w-6 h-6 rounded-full text-[9px] tracking-wider transition flex items-center justify-center"
            style={{
              background: i === n ? 'var(--accent)' : 'transparent',
              color: i === n ? 'var(--cream)' : 'var(--ink-soft)',
              border: i === n ? '1px solid var(--accent)' : '1px solid var(--line)'}}
            aria-label={`Step ${i + 1}`}
          >{i + 1}</button>
        ))}
      </div>
      <h2 className="font-sans text-[24px] md:text-[26px] leading-tight mb-2" style={{color:'var(--ink)'}}>{title}</h2>
      <p className="text-[12px] leading-relaxed" style={{color:'var(--ink-soft)'}}>{q}</p>
    </div>
  );

  // === STEP RENDERERS ===
  const renderStep = () => {
    switch (stepIdx) {
      // Step 1 — Sun Reactivity
      case 0:
        return (
          <>
            {stepHeader(0, 'Sun Reactivity', 'How does your skin usually respond to sun exposure?')}
            <div className="space-y-2">
              {SUN_OPTS.map(o => {
                const on = profileForm.sunReactivity === o.id;
                return (
                  <button key={o.id} type="button" onClick={() => update('sunReactivity', on ? '' : o.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[14px] border transition text-left"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent-soft)' : 'var(--cream)',
                      color: 'var(--ink)'}}
                  >
                    <span className="flex items-center gap-2 text-[12.5px]">
                      <Icon name="Sun" size={11} style={{color:'var(--ink-soft)'}} />
                      {o.label}
                    </span>
                    {on && <Icon name="Check" size={12} style={{color:'var(--accent)'}} />}
                  </button>
                );
              })}
              <div className="text-[10px] mt-2 px-4 py-2 rounded-[10px]" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                Why we ask: sun reactivity helps us estimate UV sensitivity, pigmentation response, and irritation risk.
              </div>
            </div>
          </>
        );
      // Step 2 — Visible Skin Tone (photo-assisted)
      case 1:
        return (
          <>
            {stepHeader(1, 'Visible Skin Tone', 'Select the swatch that best matches your natural skin tone.')}

            {/* === REFERENCE PHOTO STRIP ===
                Pulls the user's most recent skin log automatically (if any
                exists) so they have a side-by-side anchor while picking.
                No photo on file → soft prompt to upload one. Always: a small
                "Replace" link so they can swap to a fresh photo where the
                lighting is better. Hidden file input handles both cases. */}
            <div className="mb-4 rounded-[14px] p-3 flex items-center gap-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              {tonePhoto ? (
                <>
                  <img src={tonePhoto} alt="Your reference" className="w-14 h-14 rounded-full object-cover flex-shrink-0" style={{border: '1px solid var(--line)'}} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[9.5px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>
                      {tonePhotoSource === 'fresh' ? 'Fresh reference photo' : 'From your recent photo'}
                    </div>
                    <div className="font-sans text-[12.5px] mt-0.5 leading-snug" style={{color:'var(--ink)'}}>
                      Compare your face to the swatches below.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toneFileInputRef.current?.click()}
                    className="text-[9.5px] tracking-[0.22em] uppercase flex-shrink-0 underline"
                    style={{color:'var(--accent)'}}
                  >Replace</button>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream)', border:'1px dashed var(--line)', color:'var(--ink-soft)'}}>
                    <Icon name="Camera" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9.5px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Optional · helpful</div>
                    <div className="font-sans text-[12.5px] mt-0.5 leading-snug" style={{color:'var(--ink)'}}>
                      Add a face photo and Frida will suggest the closest swatch.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toneFileInputRef.current?.click()}
                    className="text-[9.5px] tracking-[0.22em] uppercase flex-shrink-0 px-3 py-1.5 rounded-full"
                    style={{background:'var(--accent)', color:'var(--cream)'}}
                  >Add photo</button>
                </>
              )}
              <input
                ref={toneFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setTonePhoto(reader.result);
                    setTonePhotoSource('fresh');
                    setToneSuggestion(null);
                    setToneError(null);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>

            {/* === SUGGESTION CHIP ===
                Three states: in-flight (small ticker), result (tappable
                chip with the swatch dot + confidence), or soft error (one
                line saying "pick yourself"). Result chip never auto-sets the
                user's choice — they have to tap to accept. Confidence
                surfaces honestly; lighting variance is real. */}
            {toneSuggesting && (
              <div className="mb-3 flex items-center gap-2 text-[11px]" style={{color:'var(--ink-soft)'}}>
                <Icon name="Sparkles" size={11} /> Frida is reading your photo…
              </div>
            )}
            {toneSuggestion && !toneSuggesting && (() => {
              const sug = MONK_TONES.find(t => t.id === toneSuggestion.swatch);
              if (!sug) return null;
              const alreadyAccepted = profileForm.monkSkinTone === toneSuggestion.swatch;
              return (
                <button
                  type="button"
                  onClick={() => update('monkSkinTone', toneSuggestion.swatch)}
                  disabled={alreadyAccepted}
                  className="mb-3 w-full text-left rounded-[12px] px-3 py-2.5 flex items-center gap-2.5 transition hover:opacity-90 disabled:opacity-100 disabled:cursor-default"
                  style={{background:'var(--cream)', border:'1px solid var(--accent)'}}
                >
                  <div className="w-9 h-9 rounded-full flex-shrink-0" style={{background: sug.hex, border: '1px solid var(--line)'}} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[9.5px] tracking-[0.22em] uppercase" style={{color:'var(--accent)'}}>
                      {alreadyAccepted ? 'Frida’s guess · accepted' : 'Frida’s best guess · adjust if needed'}
                    </div>
                    <div className="font-sans text-[12.5px] mt-0.5 leading-snug" style={{color:'var(--ink)'}}>
                      Closest match · MST-{toneSuggestion.swatch}
                      {toneSuggestion.confidence === 'low' ? ' · low confidence' : toneSuggestion.confidence === 'high' ? '' : ' · medium confidence'}
                    </div>
                    {toneSuggestion.note && (
                      <div className="text-[10px] mt-0.5" style={{color:'var(--ink-soft)'}}>{toneSuggestion.note}</div>
                    )}
                  </div>
                  {!alreadyAccepted && (
                    <span className="text-[9.5px] tracking-[0.22em] uppercase flex-shrink-0 flex items-center gap-1" style={{color:'var(--accent)'}}>
                      Use <Icon name="ChevronRight" size={10} />
                    </span>
                  )}
                </button>
              );
            })()}
            {toneError && !toneSuggesting && (
              <div className="mb-3 text-[10.5px]" style={{color:'var(--ink-soft)'}}>
                {toneError} Pick from the swatches yourself — you know your skin best.
              </div>
            )}

            {/* === SWATCH GRID ===
                The suggested swatch (if any) gets a soft dashed accent ring
                so the user's eye lands on it without it looking selected.
                Tapping the swatch (or the suggestion chip above) sets it. */}
            <div className="grid grid-cols-5 gap-3 mb-4">
              {MONK_TONES.map(t => {
                const on = profileForm.monkSkinTone === t.id;
                const isSuggested = !on && toneSuggestion?.swatch === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => update('monkSkinTone', on ? '' : t.id)}
                    className="flex flex-col items-center gap-1.5 relative"
                    aria-label={`Skin tone ${t.id}${isSuggested ? ' (suggested)' : ''}`}
                  >
                    <div
                      className="w-full aspect-square rounded-full transition"
                      style={{
                        background: t.hex,
                        border: on ? '2px solid var(--accent)'
                                : isSuggested ? '1.5px dashed var(--accent)'
                                : '1px solid var(--line)',
                        transform: on ? 'scale(1.08)' : isSuggested ? 'scale(1.04)' : 'scale(1)',
                        boxShadow: on ? '0 4px 10px rgba(58,51,40,0.12)' : 'none'}}
                    />
                    <span className="text-[10px] tracking-wider" style={{color: on ? 'var(--accent)' : isSuggested ? 'var(--accent)' : 'var(--ink-soft)'}}>{t.id}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] tracking-[0.18em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Undertone (optional)</div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {UNDERTONE_OPTS.map(o => {
                const on = profileForm.undertone === o.id;
                return (
                  <button key={o.id} type="button" onClick={() => update('undertone', on ? '' : o.id)}
                    className="px-3 py-1.5 text-[11px] tracking-[0.05em] rounded-full border transition"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: 'var(--ink)'}}
                  >{o.label}</button>
                );
              })}
            </div>
            <div className="text-[10px] px-4 py-2 rounded-[10px]" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
              Why we ask: this helps Frida better understand pigmentation, redness, sunscreen cast, and tone changes over time.
            </div>
          </>
        );
      // Step 3 — Skin Type + Modifiers
      case 2:
        return (
          <>
            {stepHeader(2, 'Skin Type', 'Select your primary skin type.')}
            <div className="space-y-2 mb-4">
              {SKIN_TYPE_OPTS.map(o => {
                const on = profileForm.skinType === o.id;
                return (
                  <button key={o.id} type="button" onClick={() => update('skinType', on ? '' : o.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-[14px] border transition text-left"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent-soft)' : 'var(--cream)',
                      color: 'var(--ink)'}}
                  >
                    <span className="text-[12.5px]">{o.label}</span>
                    {on && <Icon name="Check" size={12} style={{color:'var(--accent)'}} />}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] tracking-[0.18em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Modifiers (select all that apply)</div>
            <div className="flex flex-wrap gap-1.5">
              {SKIN_MODIFIER_OPTS.map(m => {
                const on = (profileForm.skinModifiers || []).includes(m);
                return (
                  <button key={m} type="button" onClick={() => toggleArrayItem('skinModifiers', m)}
                    className="px-2.5 py-1 text-[11px] rounded-full border transition flex items-center gap-1"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: 'var(--ink)'}}
                  >
                    {m.replace(/-/g, ' ')}
                    {on && <Icon name="Check" size={10} style={{color:'var(--accent)'}} />}
                  </button>
                );
              })}
            </div>
          </>
        );
      // Step 4 — Primary Concerns
      case 3:
        return (
          <>
            {stepHeader(3, 'Primary Concerns', 'What are your main skin concerns? (Select all that apply)')}
            <div className="flex flex-wrap gap-1.5">
              {PRIMARY_CONCERN_OPTS.map(c => {
                const on = (profileForm.primaryConcerns || []).includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleArrayItem('primaryConcerns', c)}
                    className="px-2.5 py-1 text-[11px] rounded-full border transition flex items-center gap-1"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'transparent' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--ink)'}}
                  >
                    {c.replace(/-/g, ' ')}
                    {on && <Icon name="Check" size={10} />}
                  </button>
                );
              })}
            </div>
          </>
        );
      // Step 5 — Pigment Biology (sliders 1-5)
      case 4:
        return (
          <>
            {stepHeader(4, 'Pigment Biology', 'Quick read on how your skin tends to behave. Drag each to your usual tendency.')}
            <div className="space-y-4">
              {PIGMENT_BIO_KEYS.map(({ key, label }) => {
                const val = profileForm.pigmentBiology?.[key];
                return (
                  <div key={key}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[12px]" style={{color:'var(--ink)'}}>{label}</span>
                      <span className="font-sans text-[11px]" style={{color: val != null ? 'var(--accent)' : 'var(--ink-soft)'}}>
                        {val != null ? `${val}/5` : '—'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => {
                        const on = val != null && n <= val;
                        return (
                          <button key={n} type="button" onClick={() => updateNested('pigmentBiology', key, val === n ? null : n)}
                            className="flex-1 h-6 rounded-sm border transition"
                            style={{
                              borderColor: on ? 'var(--accent)' : 'var(--line)',
                              background: on ? 'var(--accent)' : 'transparent'}}
                            aria-label={`${label} ${n} of 5`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      // Step 6 — Barrier / Sensitivity
      case 5:
        return (
          <>
            {stepHeader(5, 'Barrier & Sensitivity', 'How reactive is your skin most days?')}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {BARRIER_SCALE_OPTS.map(o => {
                const on = profileForm.barrierScale === o.id;
                return (
                  <button key={o.id} type="button" onClick={() => update('barrierScale', on ? '' : o.id)}
                    className="px-3 py-1.5 text-[11px] tracking-[0.05em] rounded-full border transition"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent)' : 'transparent',
                      color: on ? 'var(--cream)' : 'var(--ink)'}}
                  >{o.label}</button>
                );
              })}
            </div>
            <div className="text-[11px] tracking-[0.18em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Common triggers</div>
            <div className="flex flex-wrap gap-1.5">
              {TRIGGER_OPTS.map(t => {
                const on = (profileForm.triggers || []).includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleArrayItem('triggers', t)}
                    className="px-2.5 py-1 text-[11px] rounded-full border transition"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: 'var(--ink)'}}
                  >{t}</button>
                );
              })}
            </div>
          </>
        );
      // Step 7 — Hormonal Context (links to top-level hormonalContext)
      case 6:
        return (
          <>
            {stepHeader(6, 'Hormonal Context', 'Optional — but it changes safe-active recommendations. Pick your closest match.')}
            <div className="flex flex-wrap gap-1.5">
              {HORMONAL_OPTS.map(h => {
                const on = hormonalContext === h.id;
                return (
                  <button key={h.id} type="button" onClick={() => setHormonalContext(on ? null : h.id)}
                    className="px-3 py-1.5 text-[11px] tracking-[0.05em] rounded-full border transition"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent)' : 'transparent',
                      color: on ? 'var(--cream)' : 'var(--ink)'}}
                  >{h.label}</button>
                );
              })}
            </div>
          </>
        );
      // Step 8 — Diagnosed Conditions + Age
      case 7:
        return (
          <>
            {stepHeader(7, 'Diagnosed Conditions', 'Anything you’ve been formally diagnosed with? (Select all that apply)')}
            <div className="flex flex-wrap gap-1.5">
              {DIAGNOSED_OPTS.map(d => {
                const on = (profileForm.diagnosedConditions || []).includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggleArrayItem('diagnosedConditions', d)}
                    className="px-2.5 py-1 text-[11px] rounded-full border transition"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: 'var(--ink)'}}
                  >{d}</button>
                );
              })}
            </div>
            {/* === AGE (May 30 2026 — Agent D-v3) ===
                Editable here so the user can update post-onboarding.
                Reads/writes profileForm.age (number). ageBand is the
                legacy free-text range field still surfaced in the
                editorial summary — leaving it untouched for now so
                existing summaries don't break. */}
            <div className="mt-5">
              <div className="text-[11px] tracking-[0.18em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Age</div>
              <input
                type="number"
                inputMode="numeric"
                min="13"
                max="100"
                step="1"
                value={profileForm.age == null ? '' : profileForm.age}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') { update('age', null); return; }
                  const n = parseInt(raw, 10);
                  if (Number.isFinite(n) && n >= 0 && n <= 120) update('age', n);
                }}
                placeholder="e.g. 34"
                className={inputCls + ' !py-1.5 !text-[11px]'}
              />
              <p className="text-[10px] mt-1.5" style={{color:'var(--ink-soft)'}}>Used to read sun damage, collagen, and hormonal patterns in context. Optional.</p>
            </div>
          </>
        );
      // Step 9 — Current Treatments
      case 8:
        return (
          <>
            {stepHeader(8, 'Current Treatments', 'Anything you currently use that the AI should respect contraindications around.')}
            <div className="flex flex-wrap gap-1.5">
              {RX_OPTS.map(r => {
                const on = (profileForm.currentRx || []).includes(r);
                return (
                  <button key={r} type="button" onClick={() => toggleArrayItem('currentRx', r)}
                    className="px-2.5 py-1 text-[11px] rounded-full border transition"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--line)',
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: 'var(--ink)'}}
                  >{r}</button>
                );
              })}
            </div>
            <div className="mt-4">
              <div className="text-[11px] tracking-[0.18em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Known sensitivities</div>
              <div className="text-[10px] mb-1.5" style={{color:'var(--ink-soft)'}}>
                {sensitivities?.length > 0 ? sensitivities.join(' · ') : 'None listed yet.'}
              </div>
              <input autoCapitalize="off"
                type="text"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Type irritant + Enter (e.g. fragrance, denatured alcohol)"
                className={inputCls + ' !py-1.5 !text-[11px]'}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = e.target.value.trim();
                    if (v && !sensitivities.includes(v)) {
                      const next = [...sensitivities, v];
                      setSensitivities(next);
                      saveData('sensitivities', next);
                    }
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </>
        );
      // Step 10 — Environment
      case 9:
        return (
          <>
            {stepHeader(9, 'Environment', 'Climate matters for barrier strategy as much as any product.')}
            <div className="space-y-3">
              <div>
                <div className="text-[11px] tracking-[0.18em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>City / region</div>
                {/* === STABLE-FOCUS TEXT INPUT ===
                    ProfileModal re-mounts whenever App re-renders (a known
                    anti-pattern — ProfileModal is defined inside App, so it
                    gets a new component reference each parent render). That
                    yanks input focus on every keystroke, which let users type
                    only one letter at a time here. Fix: use a defaultValue +
                    onBlur pattern so React treats this as an uncontrolled
                    input. Local DOM state holds the typing; we commit to App
                    state only when the user moves on. */}
                <input autoCapitalize="off"
                  type="text" autoCorrect="off" spellCheck={false}
                  key="env-city"
                  defaultValue={profileForm.environment?.city || profileForm.location || ''}
                  onBlur={e => { updateNested('environment', 'city', e.target.value); update('location', e.target.value); }}
                  placeholder="e.g. NYC, Phoenix, Tokyo"
                  className={inputCls + ' !py-1.5 !text-[11px]'}
                />
              </div>
              <div>
                <div className="text-[11px] tracking-[0.18em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>Humidity</div>
                <div className="flex flex-wrap gap-1.5">
                  {HUMIDITY_OPTS.map(h => {
                    const on = profileForm.environment?.humidity === h;
                    return (
                      <button key={h} type="button" onClick={() => updateNested('environment', 'humidity', on ? '' : h)}
                        className="px-2.5 py-1 text-[11px] rounded-full border transition"
                        style={{ borderColor: on ? 'var(--accent)' : 'var(--line)', background: on ? 'var(--accent-soft)' : 'transparent', color: 'var(--ink)' }}
                      >{h}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.18em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>Seasonality</div>
                <div className="flex flex-wrap gap-1.5">
                  {SEASONALITY_OPTS.map(h => {
                    const on = profileForm.environment?.seasonality === h;
                    return (
                      <button key={h} type="button" onClick={() => updateNested('environment', 'seasonality', on ? '' : h)}
                        className="px-2.5 py-1 text-[11px] rounded-full border transition"
                        style={{ borderColor: on ? 'var(--accent)' : 'var(--line)', background: on ? 'var(--accent-soft)' : 'transparent', color: 'var(--ink)' }}
                      >{h.replace(/-/g, ' ')}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.18em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>Pollution exposure</div>
                <div className="flex flex-wrap gap-1.5">
                  {POLLUTION_OPTS.map(h => {
                    const on = profileForm.environment?.pollution === h;
                    return (
                      <button key={h} type="button" onClick={() => updateNested('environment', 'pollution', on ? '' : h)}
                        className="px-2.5 py-1 text-[11px] rounded-full border transition"
                        style={{ borderColor: on ? 'var(--accent)' : 'var(--line)', background: on ? 'var(--accent-soft)' : 'transparent', color: 'var(--ink)' }}
                      >{h.replace(/-/g, ' ')}</button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-full border text-[11px] cursor-pointer" style={{borderColor: profileForm.environment?.altitude ? 'var(--accent)' : 'var(--line)'}}>
                  <input type="checkbox" checked={!!profileForm.environment?.altitude} onChange={e => updateNested('environment', 'altitude', e.target.checked ? 'high-altitude' : '')} />
                  High altitude
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-full border text-[11px] cursor-pointer" style={{borderColor: profileForm.environment?.hardWater ? 'var(--accent)' : 'var(--line)'}}>
                  <input type="checkbox" checked={!!profileForm.environment?.hardWater} onChange={e => updateNested('environment', 'hardWater', e.target.checked ? 'hard-water' : '')} />
                  Hard water
                </label>
              </div>
            </div>
          </>
        );
      // Step 11 — Goals + summary
      case 10:
        return (
          <>
            {stepHeader(10, 'Your Clinical Skin Summary', 'Frida understands your skin as…')}
            {/* Goals selector — pick top 3 */}
            <div className="mb-4">
              <div className="text-[11px] tracking-[0.18em] uppercase mb-2 flex items-baseline justify-between" style={{color:'var(--ink-soft)'}}>
                <span>Top goals (pick up to 3)</span>
                <span className="text-[10px] normal-case tracking-normal">{(profileForm.goals || []).length}/3</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_OPTS.map(g => {
                  const on = (profileForm.goals || []).includes(g);
                  return (
                    <button key={g} type="button" onClick={() => toggleArrayCapped('goals', g, 3)}
                      className="px-2.5 py-1 text-[11px] rounded-full border transition"
                      style={{
                        borderColor: on ? 'var(--accent)' : 'var(--line)',
                        background: on ? 'var(--accent)' : 'transparent',
                        color: on ? 'var(--cream)' : 'var(--ink)'}}
                    >{g.replace(/-/g, ' ')}</button>
                  );
                })}
              </div>
            </div>
            {/* Editorial summary card */}
            <div className="rounded-[14px] px-5 py-5 mb-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <p className="font-sans text-[16px] md:text-[17px] leading-relaxed mb-4" style={{color:'var(--ink)'}}>
                {buildSummary()}
              </p>
              {buildHighlights().length > 0 && (
                <div className="space-y-1.5 pt-3 border-t" style={{borderColor: 'var(--line)'}}>
                  {buildHighlights().map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]" style={{color:'var(--ink)'}}>
                      <Icon name={h.icon} size={11} style={{color:'var(--ink-soft)'}} />
                      {h.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-center" style={{color:'var(--ink-soft)'}}>You can update this anytime.</p>
          </>
        );
      // === STEP 12 — "How Frida Reads You" ===
      // Concrete mapping from profile answers → analysis-time behavior.
      // Tells the user, in plain language, what each answer changes about
      // how Frida evaluates their photos / suggests products / flags
      // conflicts. Distinct from step 11 (skin-type summary) — this is the
      // "impact" page, NOT the "identity" page.
      case 11:
        return (() => {
          const f = profileForm;
          const impacts = [];
          // Sun reactivity → SPF / actives titration logic.
          if (f.sunReactivity === 'always-burns' || f.sunReactivity === 'usually-burns') {
            impacts.push({ icon: 'Sun', label: 'Sun reactivity', detail: 'Sunscreen-heavy AM ordering; mineral SPF surfaced over chemical; physical-exfoliant frequency capped.' });
          } else if (f.sunReactivity === 'never-burns') {
            impacts.push({ icon: 'Sun', label: 'Sun reactivity', detail: 'PIH risk weighted higher in pigmentation reads; tyrosinase-pathway actives prioritized.' });
          } else if (f.sunReactivity) {
            impacts.push({ icon: 'Sun', label: 'Sun reactivity', detail: 'SPF reminders calibrated to your burn tendency; pigment changes interpreted in that context.' });
          }
          // Monk tone / undertone → pigment reading + shade matching.
          if (f.monkSkinTone || f.undertone) {
            impacts.push({ icon: 'Palette', label: 'Tone + undertone', detail: 'Photo redness/PIH calls anchored to your baseline; recommended actives + shades chosen for your undertone.' });
          }
          // Skin type / modifiers → texture/oil read + recommendation bias.
          if (f.skinType || (f.skinModifiers || []).length) {
            const mods = (f.skinModifiers || []).join(', ');
            impacts.push({ icon: 'Droplet', label: 'Skin type + modifiers', detail: `Reads of "oily", "dry", "uneven" tuned to your ${f.skinType || 'skin'} baseline${mods ? ` (${mods})` : ''}. Suggestions skew accordingly.` });
          }
          // Pigment biology → what we look for in photos.
          const pb = f.pigmentBiology || {};
          const pbHigh = Object.entries(pb).filter(([k, v]) => v >= 3).map(([k]) => k);
          if (pbHigh.length) {
            impacts.push({ icon: 'Sparkles', label: 'Pigment biology', detail: `Higher sensitivity for ${pbHigh.join(', ')} — photo analysis flags these earlier; recommendations favor gentle pathways.` });
          }
          // Primary concerns → which axes the AI weights in the daily read.
          if ((f.primaryConcerns || []).length) {
            impacts.push({ icon: 'Target', label: 'Primary concerns', detail: `Daily read prioritizes ${f.primaryConcerns.slice(0, 3).join(', ')}. Other axes still surface but get less screen real estate.` });
          }
          // Barrier scale + triggers → conflict flagging.
          if (f.barrierScale === 'reactive' || f.barrierScale === 'very-reactive' || f.barrierScale === 'eczema-prone') {
            impacts.push({ icon: 'Shield', label: 'Barrier state', detail: 'Strong-actives (high-% retinoids, AHAs >10%) get a friction warning. Barrier-first ordering applied in routines.' });
          }
          if ((f.triggers || []).length) {
            impacts.push({ icon: 'AlertTriangle', label: 'Triggers', detail: `Frida won't recommend products containing ${(f.triggers || []).join(', ')} — and flags those if you add them manually.` });
          }
          // Hormonal context → cycle-aware patterns.
          if (f.hormonalContext && f.hormonalContext !== 'none' && f.hormonalContext !== 'unspecified') {
            impacts.push({ icon: 'Activity', label: 'Hormonal context', detail: `${(f.hormonalContext || '').replace(/-/g, ' ')} — breakout patterns + hydration drops interpreted in this lens.` });
          }
          // Diagnosed conditions → contraindication respect.
          if ((f.diagnosedConditions || []).filter(c => c !== 'none').length) {
            impacts.push({ icon: 'Stethoscope', label: 'Diagnosed conditions', detail: `${f.diagnosedConditions.filter(c => c !== 'none').join(', ')} — actives that don’t mix well auto-excluded; flares flagged in photo reads.` });
          }
          // Current Rx → no doubling actives.
          if ((f.currentRx || []).filter(r => r !== 'none').length) {
            impacts.push({ icon: 'Pill', label: 'Current prescriptions', detail: `${f.currentRx.filter(r => r !== 'none').join(', ')} — Frida won't recommend overlapping OTC equivalents. Suggests complementary, not redundant.` });
          }
          // Environment → barrier + SPF intensity.
          const env = f.environment || {};
          if (env.humidity || env.seasonality || env.pollution) {
            const bits = [env.humidity, env.seasonality, env.pollution].filter(Boolean).join(' / ');
            impacts.push({ icon: 'Cloud', label: 'Climate', detail: `${bits} — moisture/occlusive balance recalibrated; antioxidant priority adjusts with pollution load.` });
          }
          // Goals → what gets surfaced first in Frida Suggests.
          if ((f.goals || []).length) {
            impacts.push({ icon: 'Compass', label: 'Goals', detail: `Frida Suggests leads with ${f.goals.slice(0, 2).map(g => g.replace(/-/g, ' ')).join(' + ')} — other goals stay in rotation but later in the list.` });
          }
          return (
            <>
              {stepHeader(11, 'How Frida reads you', 'Your answers, mapped to what changes in the app.')}
              {impacts.length === 0 ? (
                <div className="rounded-[14px] px-5 py-6 text-center" style={{background:'var(--cream-deep)', border:'1px dashed var(--line)'}}>
                  <p className="font-sans text-[14px] mb-1.5" style={{color:'var(--ink)'}}>Nothing locked in yet.</p>
                  <p className="text-[11px]" style={{color:'var(--ink-soft)'}}>Go back through the sections and fill a few — we'll show you exactly what each one changes here.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {impacts.map((it, i) => (
                      <div key={i} className="rounded-[14px] px-4 py-3 flex items-start gap-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream)', color:'var(--accent)', border: '1px solid var(--line)'}}>
                          <Icon name={it.icon} size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] tracking-[0.22em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>{it.label}</div>
                          <p className="text-[12px] leading-relaxed" style={{color:'var(--ink)'}}>{it.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10.5px] text-center mb-1" style={{color:'var(--ink-soft)'}}>
                    Tap Save Profile to lock these mappings in. Frida will start using them on your next photo read.
                  </p>
                </>
              )}
            </>
          );
        })();
      default:
        return null;
    }
  };

  return (
    <Modal compact onClose={() => { setShowProfileModal(false); /* scroll reset no-op — extracted modal does not remount */ }} eyebrow="Settings" title="Skin Profile">
      <span ref={scrollSentinelRef} aria-hidden="true" style={{display:'none'}} />
      <div style={{color:'var(--ink)'}}>
        {renderStep()}
        {/* === AI IMPACT SUMMARY PANEL ===
            Surfaces after final save. Inline so the user sees what their
            answers actually change about how Frida reads their skin —
            not just "saved ✓" toast disappearing. 50-word cap enforced
            in the prompt. Tap "Done" to close the wizard. */}
        {(profileSummaryLoading || profileAiSummary || profileSummaryError) && (
          <div className="mt-5 rounded-[14px] px-4 py-3" style={{background:'var(--cream-deep)', border:`1px solid ${profileSummaryError ? 'var(--rose, #c44a4a)' : 'var(--accent)'}`}}>
            <div className="text-[10px] tracking-[0.22em] uppercase mb-1.5 flex items-center gap-1.5" style={{color: profileSummaryError ? 'var(--rose, #c44a4a)' : 'var(--accent)'}}>
              <Icon name={profileSummaryError ? 'AlertTriangle' : 'Sparkles'} size={11} /> {profileSummaryError ? 'Something went wrong' : 'What this changes'}
            </div>
            {profileSummaryLoading ? (
              <p className="font-sans text-[13px] flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                <Icon name="Loader2" size={12} className="spin" /> Reading your profile…
              </p>
            ) : profileSummaryError ? (
              <>
                {/* === INLINE ERROR BANNER ===
                    Replaces the silent toast-and-hang behavior. The
                    profile itself is already saved (handleSave commits
                    BEFORE the AI call), so the user can safely close or
                    retry without losing anything. */}
                <p className="text-[12.5px] leading-relaxed mb-3" style={{color:'var(--ink)'}}>
                  Something went wrong — try again or close.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    className="flex-1 py-2 text-[10px] tracking-[0.2em] uppercase transition hover:opacity-90"
                    style={{background:'var(--ink)', color:'var(--cream)', borderRadius:'9999px'}}
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => { setProfileSummaryError(null); setShowProfileModal(false); }}
                    className="flex-1 py-2 text-[10px] tracking-[0.2em] uppercase transition hover:opacity-90"
                    style={{background:'transparent', color:'var(--ink)', border:'1px solid var(--line)', borderRadius:'9999px'}}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed" style={{color:'var(--ink)'}}>{profileAiSummary}</p>
            )}
            {profileAiSummary && !profileSummaryError && (
              <button
                onClick={() => { setShowProfileModal(false); setProfileAiSummary(null); /* scroll reset no-op — extracted modal does not remount */ }}
                className="mt-3 w-full py-2 text-[10px] tracking-[0.2em] uppercase transition hover:opacity-90"
                style={{background:'var(--ink)', color:'var(--cream)', borderRadius:'9999px'}}
              >
                Done
              </button>
            )}
          </div>
        )}
        {/* Sticky footer nav — Back / Next / Save & close (per-step) / Save Profile (last step) */}
        <div className="flex items-center gap-2 pt-5 mt-5 border-t" style={{borderColor: 'var(--line)'}}>
          <button
            onClick={() => setStepIdx(i => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            className="px-4 py-2.5 text-[10px] tracking-[0.2em] uppercase transition hover:opacity-70 disabled:opacity-30"
            style={{color:'var(--ink-soft)'}}
          >
            ‹ Back
          </button>
          {stepIdx < TOTAL_STEPS - 1 ? (
            <>
              <button
                onClick={() => setStepIdx(i => Math.min(TOTAL_STEPS - 1, i + 1))}
                className="flex-1 py-2.5 text-[10px] tracking-[0.2em] uppercase transition hover:opacity-90"
                style={{background:'var(--ink)', color:'var(--cream)'}}
              >
                Next
              </button>
              {/* Save & close — exits the wizard at any step, keeping
                  everything entered so far. Resume on next open. */}
              <button
                onClick={() => {
                  persistProfileDraft(profileForm);
                  setShowProfileModal(false);
                  /* scroll reset no-op — extracted modal does not remount */
                  toast('Saved — pick up where you left off', 'info');
                }}
                className="px-3 py-2.5 text-[10px] tracking-[0.18em] uppercase transition hover:opacity-70"
                style={{color:'var(--accent)'}}
                title="Save what you've entered and come back to finish later"
              >
                Save & close
              </button>
            </>
          ) : (
            <button
              onClick={handleSave}
              disabled={profileSummaryLoading}
              className="flex-1 py-2.5 text-[10px] tracking-[0.2em] uppercase transition hover:opacity-90 disabled:opacity-50"
              style={{background:'var(--ink)', color:'var(--cream)'}}
            >
              {profileSummaryLoading ? 'Reading your profile…' : (profileAiSummary ? 'Re-run read' : 'Save Profile')}
            </button>
          )}
        </div>
        {/* === HOW YOUR SCORE WORKS (June 2026 per Jenni) ===
            Quiet link surfacing the score explainer from Settings. Same
            drawer is reachable from the cover delta line + kebab. */}
        {typeof onOpenScoreExplainer === 'function' && (
          <div className="mt-4 pt-4 border-t" style={{borderColor:'var(--line)'}}>
            <button
              type="button"
              onClick={() => { setShowProfileModal(false); setTimeout(() => onOpenScoreExplainer(), 100); }}
              className="w-full flex items-center justify-between gap-2 transition hover:opacity-75"
              style={{background:'transparent', border:'none', cursor:'pointer', padding:'6px 2px'}}
            >
              <div className="flex items-center gap-2">
                <Icon name="Info" size={13} style={{color:'var(--ink-soft)'}} />
                <span className="text-[11px] tracking-[0.14em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>How your score works</span>
              </div>
              <Icon name="ArrowRight" size={11} style={{color:'var(--ink-soft)'}} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
