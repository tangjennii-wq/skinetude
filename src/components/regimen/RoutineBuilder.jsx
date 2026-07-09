// === RoutineBuilder (Wave 3.2 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const RoutineBuilder = ({ products, logs = [], procedures = [], regimenLogs = [], sensitivities = [], userConcerns = [], setUserConcerns, hormonalContext, callClaude, setShowApiKeyModal, setShowProductModal, setRegimenView, setActiveTab, setShowProcedureModal, setShowCheckInModal, toast, onOpenLesson, regenToken = 0 }) => {
  const hormonalContextNote = (() => {
    if (!hormonalContext || hormonalContext === 'unspecified') return '';
    const map = {
      'cycling': 'The user has a menstrual cycle. Tailor for cyclic skin variation: barrier-supporting through luteal/menstrual phases, more comfortable with stronger actives in follicular.',
      'post-menopausal': 'The user is post-menopausal. Estrogen decline drives dryness, dermal thinning, slower wound healing — emphasize barrier support, retinoid for collagen stimulation, ceramide-rich formulations.',
      'androgen-pattern': 'The user has testosterone-pattern skin (higher sebum production, thicker dermis, persistent acne risk along jawline/back). Lean toward lighter textures, salicylic acid for pore congestion, retinoid for collagen and acne.',
      'pregnancy': 'The user is pregnant or breastfeeding. AVOID: retinoids (tretinoin, adapalene, retinol), high-dose salicylic acid (>2%), hydroquinone, oral isotretinoin. Safe: azelaic acid, niacinamide, glycolic/lactic acid (low %), hyaluronic acid, ceramides, mineral sunscreen, vitamin C, low-dose benzoyl peroxide.',
      'hormone-therapy': 'The user is on hormone therapy. Tailor with awareness that exogenous hormones reshape skin behavior — confirm context (estrogen-direction or testosterone-direction) before specifying further; default to evidence-based stack.'};
    return '\n\n' + (map[hormonalContext] || '');
  })();
  const [routine, setRoutine] = useState(null);
  const [expandedRoutineKey, setExpandedRoutineKey] = useState(null); // hover/tap reveal of "why" per row
  // Auto-rebuild Ritual Recommended when upstream inputs change (new photo, regimen check-in,
  // product add/edit, sensitivity change, concern change). Triggered via the parent's
  // coverRoutineRebuildToken which is bumped from those callsites. Skip the initial mount.
  const skipFirstRoutineRebuildRef = useRef(true);
  useEffect(() => {
    if (skipFirstRoutineRebuildRef.current) {
      skipFirstRoutineRebuildRef.current = false;
      return;
    }
    if (!routine) return; // only refresh if user has built one
    // Defer slightly so the parent state has fully settled before regenerate fires.
    const t = setTimeout(() => { generateRoutine(); }, 100);
    return () => clearTimeout(t);
  }, [regenToken]);
  const [loading, setLoading] = useState(false);
  const [starterMode, setStarterMode] = useState(false);
  const activeProducts = products.filter(p => !p.endDate);
  const ROTATION_PRODUCT_INPUT_CAP = 8;
  const WHAT_TO_ADD_ITEM_CAP = 5;
  const compactWhatToAdd = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return '';
    const items = text
      .split(/\n+|(?:^|\s)(?:[-*•]|\d+[.)])\s+/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (items.length > 1) return items.slice(0, WHAT_TO_ADD_ITEM_CAP).join(' ');
    return text.split(/\s+/).slice(0, 70).join(' ');
  };

  // Pull dominant skin concerns from the last 14 days of logs. Two signals:
  // explicit concerns[] tags, plus keywords mined from ratingExplanation/aiAnalysis text.
  const recentConcernSummary = () => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recent = logs.filter(l => new Date(l.date).getTime() >= cutoff);
    if (recent.length === 0) return null;
    const tagCounts = {};
    recent.forEach(l => (l.concerns || []).forEach(c => { tagCounts[c] = (tagCounts[c] || 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
    const aiNotes = recent.map(l => l.aiAnalysis || l.ratingExplanation).filter(Boolean).slice(-3).join('\n---\n');
    return { topTags, aiNotes, count: recent.length };
  };

  const generateRoutine = async () => {
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    if (activeProducts.length === 0) { toast('Add some products first', 'error'); return; }
    setLoading(true);
    try {
      const productList = activeProducts.map(p => {
        const days = (p.useDays && p.useDays.length < 7) ? `, ${p.useDays.length}/7 days` : '';
        const times = (p.useTimes && p.useTimes.length > 0) ? `, ${p.useTimes.join('+').toUpperCase()}` : '';
        const targets = (p.concerns && p.concerns.length) ? `, targets: ${p.concerns.join('/')}` : '';
        return `${p.name} (${p.activeIngredients || 'unknown actives'}) — ${p.category}${times}${days}${targets}`;
      }).join('\n');
      const concerns = recentConcernSummary();
      // Merge user-selected concerns with auto-detected (user's are primary)
      const mergedConcerns = [...new Set([...(userConcerns || []), ...(concerns?.topTags || [])])];
      const concernBlock = (mergedConcerns.length > 0 || concerns)
        ? `\nUSER CONCERNS being addressed: ${mergedConcerns.join(', ') || '(none specified)'}.\n${concerns?.aiNotes ? 'Recent AI observations from journal:\n' + concerns.aiNotes : ''}\n\nTailor the routine to address these specifically. If barrier concerns are present (redness, dryness, sensitivity), push barrier-supporting steps higher and pause aggressive actives. If active breakouts are present, prioritize comedolytic ordering. If hyperpigmentation, emphasize tinted SPF and tyrosinase inhibitors.\n`
        : '';
      const sensBlock = (sensitivities && sensitivities.length > 0)
        ? `\nUSER REPORTED SENSITIVITIES (must avoid or flag): ${sensitivities.join(', ')}.\nIf any owned product contains these triggers (or related ingredients), call it out in OVERUSE/FLAGS and recommend a swap.\n`
        : '';
      const prompt = `Build an optimal AM and PM skincare routine using ONLY these products the user owns:

${productList}
${concernBlock}${sensBlock}${hormonalContextNote}

Order them following dermatological best practices: thinnest to thickest, water-based before oil-based, treatments after cleansing, sunscreen always last in AM. Account for ingredient interactions (e.g., Vit C in AM, retinoids in PM, alternate exfoliants).

Be especially attentive to OVERUSE PATTERNS:
- Daily retinoid use without rotation → recommend MWF or every-other-night protocol
- Multiple exfoliants stacking (AHA + BHA + scrub) → recommend rotation
- Multiple vitamin C products → suggest consolidation
- Retinoid + AHA same night → suggest separation
- Daily sheet masks of same active → suggest rotation

Format response as:

AM ROUTINE:
1. [Product name] — [why this step, brief evidence-based reason]
2. ...

PM ROUTINE:
1. [Product name] — [reason]
2. ...

LAYERING NOTES:
[2-3 sentences about pH, wait times between steps, frequency rotations]

OVERUSE / FLAGS:
[List specific overuse patterns or sensitivity conflicts with concrete recommendations, e.g. "You're using Tretinoin nightly + Glycolic Acid 2x/week — separate to alternating nights for the next 2 weeks." If nothing concerning, write "No overuse patterns detected."]

GAPS DETECTED:
[Critical missing pieces in the routine — e.g., "No SPF logged. A broad-spectrum SPF 30+ is essential for any AM routine." If the routine is complete, write "Routine appears complete."]`;
      const result = await callClaude(prompt, '', null, { voice: true });
      setRoutine(result);
      toast('Routine optimized.');
    } catch (e) {
      toast('Unable to build routine', 'error');
    }
    setLoading(false);
  };

  // Parse sections
  const parseSection = (header) => {
    if (!routine) return null;
    const headers = ['AM ROUTINE', 'PM ROUTINE', 'LAYERING NOTES', 'OVERUSE / FLAGS', 'GAPS DETECTED'];
    const idx = headers.indexOf(header);
    const escaped = (h) => h.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    const next = headers.slice(idx + 1).map(escaped).join('|');
    const regex = next ? new RegExp(`${escaped(header)}:\\s*([\\s\\S]*?)(?=(${next}):)`, 'i') : new RegExp(`${escaped(header)}:\\s*([\\s\\S]*)`, 'i');
    const match = routine.match(regex);
    return match ? match[1].trim() : null;
  };

  // === DERIVE "Your routine" from product schedule fields ===
  // Group user's products by AM/PM and detect cadence (daily / weekly / monthly).
  const dayName = (i) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i];
  const productSchedule = (p) => {
    const days = (p.useDays && p.useDays.length > 0) ? p.useDays : [0,1,2,3,4,5,6];
    const times = (p.useTimes && p.useTimes.length > 0) ? p.useTimes : ['am','pm'];
    return { days, times };
  };
  const cadenceFor = (p) => {
    const f = (p.frequency || 'daily').toLowerCase();
    const sched = productSchedule(p);
    if (f === 'monthly' || f === 'as-needed') return 'monthly';
    if (f === 'weekly' || f === '2-3x-week' || f === 'every-other-day') return 'weekly';
    if (sched.days.length <= 3) return 'weekly';
    return 'daily';
  };
  // Only include products the user has explicitly assigned to AM/PM (mirror cover-page filter).
  // If the viewed date's check-in was submitted via the modal, narrow further to ONLY the
  // products the user ticked in that submission. Otherwise show the full intended routine.
  const todayKeyForRitual = localDateISO();
  // ritualViewDate is the day being viewed in the daily routine card. Defaults to today.
  // The header has ◀ ▶ chevrons that step through prior/next days; future is disabled.
  const [ritualViewDate, setRitualViewDate] = useState(todayKeyForRitual);
  const viewKeyForRitual = ritualViewDate;
  const isViewingToday = viewKeyForRitual === todayKeyForRitual;
  const submittedRitualLog = (regimenLogs || []).find(r => r.date === viewKeyForRitual && r.submitted);
  const resolvedRitualForView = resolveTodayRitual({
    products,
    regimenLogs,
    date: viewKeyForRitual});
  // Pretty-print the viewed date (Today / Yesterday / Mon, Apr 27 etc.)
  const ritualDateLabel = (() => {
    const [y, m, d] = viewKeyForRitual.split('-').map(Number);
    const viewed = new Date(y, m - 1, d);
    const t = new Date(); t.setHours(0,0,0,0);
    const diffDays = Math.round((t.getTime() - viewed.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return viewed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  })();
  // Step ritual view by ±N days. Forward is disabled past today.
  const stepRitualDate = (delta) => {
    const [y, m, d] = viewKeyForRitual.split('-').map(Number);
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + delta);
    const t = new Date(); t.setHours(0,0,0,0);
    if (next.getTime() > t.getTime()) return; // no future dates
    setRitualViewDate(localDateISO(next));
  };
  const dailyAM = resolvedRitualForView.am || [];
  const dailyPM = resolvedRitualForView.pm || [];
  const dailyAMOverflow = resolvedRitualForView.amOverflow || 0;
  const dailyPMOverflow = resolvedRitualForView.pmOverflow || 0;
  const weeklyProducts = activeProducts.filter(p => cadenceFor(p) === 'weekly');
  const monthlyProducts = activeProducts.filter(p => cadenceFor(p) === 'monthly');
  // Procedures inferred as "monthly" cadence by default — they show up alongside monthly products
  const recentProcedures = procedures.slice(0, 6);

  // Starter routine for users with no products yet — produces an AAD-aligned plan
  // (cleanser → vitamin C → moisturizer → SPF in AM; cleanser → retinoid → moisturizer in PM)
  // with category guidance instead of named products. Users can swap real products in later.
  const generateStarterRoutine = async () => {
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    setLoading(true);
    setStarterMode(true);
    try {
      const concerns = recentConcernSummary();
      const concernNote = concerns?.topTags?.length
        ? `\nThe user's recent journal shows these concerns: ${concerns.topTags.join(', ')}. Tailor the starter routine accordingly.`
        : '';
      const prompt = `Build a defensible AAD-aligned starter skincare routine for someone who hasn't tracked any products yet. Use category-level recommendations (not specific brands). Standard derm-approved structure: gentle cleanser → vitamin C → moisturizer → broad-spectrum SPF in AM; gentle cleanser → retinoid (or alternative if irritated/pregnant) → moisturizer in PM. Keep it simple — five to six steps maximum across both routines.${concernNote}

Format response as:

AM ROUTINE:
1. [Step name with category] — [why this step, brief evidence-based reason]
2. ...

PM ROUTINE:
1. ...

LAYERING NOTES:
[2-3 sentences about wait times, frequency for retinoid build-up, when to skip an active]

GAPS DETECTED:
"This is a starter framework — once you add specific products to your shelf, rebuild the routine for personalized ordering."`;
      const result = await callClaude(prompt, '', null, { voice: true });
      setRoutine(result);
      toast('Starter routine generated.');
      // ALSO generate the Mon-Sun weekly rotation in the background — empty-shelf mode
      // produces a fully [suggested]-driven 7-day grid that mirrors the swipeable
      // weekly view shown when the user has products. This gives empty-profile users
      // a complete picture (per-step layering AND day-by-day cadence) in one tap.
      generateWeeklyRotation([], []);
    } catch (e) {
      toast('Unable to build starter routine', 'error');
    }
    setLoading(false);
  };

  // === SEPARATE: WEEKLY ROTATION ===
  // Different from generateRoutine. Focuses on cadence — which products on which days,
  // not on AM/PM stack ordering.
  const [weeklyRotation, setWeeklyRotation] = useState(null);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [showRotationBuilder, setShowRotationBuilder] = useState(false);
  const [rotationSelectedProductIds, setRotationSelectedProductIds] = useState([]);
  const [rotationSelectedDevices, setRotationSelectedDevices] = useState([]);
  // Default to a capped set when first opened so "Build my week" cannot
  // accidentally feed the entire shelf into the AI prompt.
  React.useEffect(() => {
    if (showRotationBuilder && rotationSelectedProductIds.length === 0) {
      setRotationSelectedProductIds(activeProducts.slice(0, ROTATION_PRODUCT_INPUT_CAP).map(p => p.id));
    }
  }, [showRotationBuilder]);
  const generateWeeklyRotation = async (productIdsToUse, devicesToUse) => {
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    const rawIdList = productIdsToUse || activeProducts.slice(0, ROTATION_PRODUCT_INPUT_CAP).map(p => p.id);
    const idList = rawIdList.slice(0, ROTATION_PRODUCT_INPUT_CAP);
    const selected = activeProducts.filter(p => idList.includes(p.id)).slice(0, ROTATION_PRODUCT_INPUT_CAP);
    const excludedCount = Math.max(0, activeProducts.length - selected.length);
    // Empty-shelf mode (starter): produce a fully [suggested]-driven Mon-Sun rotation
    // based on cover concerns + Currently Addressing, no real product names. This is the
    // path the "Starter Routine" button takes when the user has nothing on their shelf.
    const emptyShelf = selected.length === 0;
    setRotationLoading(true);
    try {
      const productList = emptyShelf
        ? '(none — user has not added any products yet; build the routine entirely from category-level "[suggested]" items)'
        : selected.map(p => `${p.name} (${p.category}, actives: ${p.activeIngredients || 'unknown'}, current freq: ${p.frequency || 'daily'})`).join('\n');
      const concerns = recentConcernSummary();
      const mergedConcerns = [...new Set([...(userConcerns || []), ...(concerns?.topTags || [])])];
      const sensList = (sensitivities || []).join(', ') || 'none';
      const devList = (devicesToUse || []).join(', ') || 'none';
      const sparseShelf = !emptyShelf && selected.length < 6;
      const emptyInstruction = emptyShelf
        ? `\nThe user has NO products on their shelf yet. Build the entire 7-day rotation using ONLY category-level "[suggested]" items (e.g. "[suggested] gentle cleanser", "[suggested] vitamin C 10-15%", "[suggested] barrier moisturizer", "[suggested] mineral SPF 30+", "[suggested] retinoid (low-strength to start)"). Every product on every day must be prefixed with "[suggested]". Tailor the rotation to the user concerns listed above. Keep cadence sensible — retinoid 2-3 nights, exfoliation 1-2 nights, recovery night, daily SPF in AM. WHAT TO ADD section must list no more than 5 anchor product categories they should source first.\n`
        : '';
      const sparseInstruction = sparseShelf
        ? `\nThe user has only ${selected.length} product(s) on their shelf — that's not enough for a full rotation. SUGGEST 2-4 generic product types (no brand) that would round out the week (e.g. "vitamin C serum", "gentle cleanser", "barrier moisturizer"). PREFIX each suggested product with "[suggested]" (literal) so the UI can mark it as a recommendation, not a real shelf item. Mix suggestions with their existing products across the week.\n`
        : '';
      const prompt = `Build a 7-day product ROTATION schedule (Mon-Sun) optimizing CADENCE — when to use what, NOT which order to layer. The user owns these products:

${productList}
${excludedCount ? `\n${excludedCount} additional shelf products were intentionally excluded from this rotation pass. Do not list, schedule, or recommend them unless the user explicitly selects them.` : ''}

Devices/tools to incorporate: ${devList}
User concerns: ${mergedConcerns.join(', ') || 'none specified'}
User sensitivities: ${sensList}
${hormonalContextNote}${emptyInstruction}${sparseInstruction}

Goals: avoid overuse, separate antagonistic actives across nights, build up tolerance for retinoids over the week, schedule heavier exfoliation 1-2× max, give the skin recovery nights. If devices are listed, suggest day(s) to use them (e.g. red light 3-4×/week PM).
Never list more than 5 items in WHAT TO ADD. Do not output long shopping lists.

ALSO add brief per-day RECOMMENDATIONS — concise (5-12 word) tactical notes for any day that needs them (e.g. "buffer retinoid with moisturizer", "skip extras — barrier rest"). Leave blank for days with no special note.

Format response as:

MON AM: [products separated by " · ", prefix any AI-suggested items with "[suggested]"]
MON PM: ...
MON NOTE: [optional 5-12 word recommendation, blank if none]
TUE AM: ...
TUE PM: ...
TUE NOTE: ...
WED AM: ...
WED PM: ...
WED NOTE: ...
THU AM: ...
THU PM: ...
THU NOTE: ...
FRI AM: ...
FRI PM: ...
FRI NOTE: ...
SAT AM: ...
SAT PM: ...
SAT NOTE: ...
SUN AM: ...
SUN PM: ...
SUN NOTE: ...

WHY THIS CADENCE:
[2-3 sentence rationale — what's spaced and why, what's daily and why, what's recovery night]
${(sparseShelf || emptyShelf) ? '\nWHAT TO ADD:\n[' + (emptyShelf ? '1-2 sentences with no more than 5 anchor product CATEGORIES to source first and why these form the AAD-aligned foundation.' : '1 sentence with 2-4 generic product types that would best fill the gaps — no brands and no long list.') + ']' : ''}`;
      const result = await callClaude(prompt, '', null, { voice: true });
      setWeeklyRotation(result);
      toast('Weekly rotation generated.');
    } catch (e) {
      console.error(e);
      toast('Unable to build weekly rotation', 'error');
    }
    setRotationLoading(false);
  };

  // Parse a specific cell of the weekly rotation
  const parseRotationDay = (day, slot) => {
    if (!weeklyRotation) return null;
    const re = new RegExp(`${day}\\s+${slot}:\\s*(.+)`);
    const m = weeklyRotation.match(re);
    return m ? m[1].trim() : null;
  };

  // === ACTIVES SUMMARY ===
  // Cross-reference current week's regimenLogs with each product's activeIngredients
  // to count how many times each major active (retinoid, AHA, BHA, vitamin C, niacinamide, azelaic, etc.) was used.
  const ACTIVE_PATTERNS = [
    { label: 'Retinoid', regex: /(retinol|retin[\s-]?a|tretinoin|adapalene|retinaldehyde|retinoic|retinyl|granactive)/i },
    { label: 'Vitamin C', regex: /(vitamin\s*c|ascorbic\s*acid|ascorbyl|tetrahexyldecyl|ethyl\s*ascorbate|ascorbate)/i },
    { label: 'Niacinamide', regex: /niacinamide/i },
    { label: 'AHA', regex: /(glycolic|lactic|mandelic|alpha[\s-]?hydroxy|aha)/i },
    { label: 'BHA', regex: /(salicylic|bha|beta[\s-]?hydroxy)/i },
    { label: 'Azelaic acid', regex: /azelaic/i },
    { label: 'Peptides', regex: /peptide/i },
    { label: 'Hyaluronic acid', regex: /hyaluronic/i },
    { label: 'Ceramides', regex: /ceramide/i },
    { label: 'SPF', regex: /(spf|zinc\s*oxide|titanium\s*dioxide|sunscreen|tinosorb|avobenzone|octinoxate|octisalate)/i },
  ];
  // Helper: get logs from this week (Mon-Sun, today inclusive)
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1; // 0=Mon
  const weekStart = new Date(todayDate); weekStart.setDate(todayDate.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    weekDays.push(d);
  }
  const dateKey = (d) => localDateISO(d);
  const isFuture = (d) => d > todayDate;
  const logForDate = (d) => regimenLogs.find(r => r.date === dateKey(d));
  // Count actives this week
  const activesThisWeek = (() => {
    const counts = {};
    weekDays.forEach(d => {
      const log = logForDate(d);
      if (!log) return;
      const usedIds = [...(log.amProducts || []), ...(log.pmProducts || [])];
      const usedActives = usedIds.map(id => {
        const p = products.find(pp => pp.id === id);
        return p ? `${p.activeIngredients || ''} ${p.mainIngredients || ''}` : '';
      }).join(' ');
      ACTIVE_PATTERNS.forEach(({ label, regex }) => {
        if (regex.test(usedActives)) counts[label] = (counts[label] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  // Prior 3 weeks (relative week starts)
  const priorWeekStarts = [1, 2, 3].map(i => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() - 7 * i);
    return d;
  });
  const [expandedPriorWeek, setExpandedPriorWeek] = useState(null);

  // Monthly calendar — navigable month grid
  const [monthStart, setMonthStart] = useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const monthEndDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const monthFirstWeekday = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const monthCells = [];
  for (let i = 0; i < monthFirstWeekday; i++) monthCells.push(null);
  for (let d = 1; d <= monthEndDate; d++) monthCells.push(d);
  while (monthCells.length % 7 !== 0) monthCells.push(null);
  const [expandedMonthDate, setExpandedMonthDate] = useState(null);
  // Selected week for inline expansion (start-of-week date string)
  const [expandedWeekStart, setExpandedWeekStart] = useState(null);
  const goPrevMonth = () => { const d = new Date(monthStart); d.setMonth(d.getMonth() - 1); setMonthStart(d); setExpandedMonthDate(null); setExpandedWeekStart(null); };
  const goNextMonth = () => { const d = new Date(monthStart); d.setMonth(d.getMonth() + 1); setMonthStart(d); setExpandedMonthDate(null); setExpandedWeekStart(null); };
  const goThisMonth = () => { setMonthStart(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); setExpandedMonthDate(null); setExpandedWeekStart(null); };
  // Disable forward beyond current month (no future months)
  const isCurrentMonth = monthStart.getFullYear() === todayDate.getFullYear() && monthStart.getMonth() === todayDate.getMonth();

  const POPULAR_CONCERNS = ['redness', 'hyperpigmentation', 'dark spots', 'sensitivity', 'sunburn', 'dryness', 'oiliness', 'breakout', 'aging', 'fine lines', 'enlarged pores', 'dullness'];
  const [customConcernInput, setCustomConcernInput] = useState('');
  // Currently Addressing concerns — open by default so the user always sees what they're
  // targeting and can edit inline without an extra tap.
  const [concernsExpanded, setConcernsExpanded] = useState(true);
  const detectedConcerns = recentConcernSummary()?.topTags || [];
  // Concerns shown as suggestions in addition to popular
  const suggestedConcerns = detectedConcerns.filter(c => !userConcerns.includes(c.toLowerCase()) && !POPULAR_CONCERNS.includes(c.toLowerCase()));
  const toggleUserConcern = (c) => {
    const lc = c.toLowerCase();
    const next = (userConcerns || []).includes(lc)
      ? userConcerns.filter(x => x !== lc)
      : [...userConcerns, lc];
    setUserConcerns?.(next);
  };
  const addCustomConcern = () => {
    const v = customConcernInput.trim().toLowerCase();
    if (!v || (userConcerns || []).includes(v)) { setCustomConcernInput(''); return; }
    setUserConcerns?.([...(userConcerns || []), v]);
    setCustomConcernInput('');
  };

  return (
    <div>
      {/* === CONCERNS SELECTOR — collapsible: preview row + edit on expand === */}
      <div className="mb-5 pb-4 border-b" style={{borderColor: 'var(--line)'}}>
        {/* Preview row — always visible. Shows selected concerns inline + chevron to edit. */}
        <button
          type="button"
          onClick={() => setConcernsExpanded(v => !v)}
          className="w-full flex items-center gap-2 text-left"
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{background:'var(--accent)'}} />
          <span className="text-[10px] tracking-[0.18em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)', whiteSpace:'nowrap'}}>Currently addressing</span>
          <span className="font-sans text-[11px] flex-1 min-w-0 truncate" style={{color: (userConcerns || []).length > 0 ? 'var(--ink)' : 'var(--ink-soft)'}}>
            {(userConcerns || []).length > 0
              ? (userConcerns || []).slice(0, 6).join(' · ')
              : 'tap to set concerns'}
          </span>
          <Icon name={concernsExpanded ? 'ChevronUp' : 'ChevronDown'} size={11} style={{color:'var(--ink-soft)', flexShrink:0}} />
        </button>

        {/* Edit panel */}
        {concernsExpanded && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_CONCERNS.map(c => {
                const active = (userConcerns || []).includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleUserConcern(c)} className="text-[10px] tracking-[0.05em] px-2.5 py-1 border rounded-full transition" style={{
                    borderColor: active ? 'var(--accent)' : 'var(--line)',
                    background: active ? 'var(--accent)' : 'var(--cream)',
                    color: active ? 'var(--cream)' : 'var(--ink-soft)'
                  }}>{c}</button>
                );
              })}
              {(userConcerns || []).filter(c => !POPULAR_CONCERNS.includes(c)).map(c => (
                <span key={c} className="inline-flex items-center gap-1 text-[10px] tracking-[0.05em] px-2.5 py-1 border rounded-full" style={{borderColor: 'var(--line)', background:'var(--accent)', color:'var(--cream)'}}>
                  {c}
                  <button onClick={() => toggleUserConcern(c)} className="opacity-70 hover:opacity-100"><Icon name="X" size={9} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input autoCapitalize="off" autoCorrect="off" spellCheck={false}
                value={customConcernInput}
                onChange={e => setCustomConcernInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomConcern(); } }}
                placeholder="+ Add a concern not listed (e.g. melasma)"
                className="flex-1 px-2 py-1 text-[11px] border rounded-sm focus:outline-none"
                style={{borderColor: 'var(--line)', background:'var(--cream)', color:'var(--ink)'}}
              />
              <button onClick={addCustomConcern} disabled={!customConcernInput.trim()} className="px-2 text-[9px] tracking-[0.15em] uppercase border disabled:opacity-40" style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}>Add</button>
            </div>
          </div>
        )}
      </div>

      {activeProducts.length === 0 && !routine && (() => {
        // === EMPTY-SHELF STARTER ROUTINE PRESET ===
        // Hardcoded AAD-aligned routine that renders WITHOUT any AI call.
        // Each step has a $ (drugstore) and $$ (mid-range) pick from the
        // local product DB. User can hover/tap any step to see the picks.
        // This means Build/Start does something useful even when the user
        // has no API key set yet.
        const PRESET = [
          { slot: 'AM', n: 1, step: 'Gentle cleanser', why: 'Sets a clean canvas without stripping the barrier.', budget: 'Cetaphil Gentle Skin Cleanser', mid: 'CeraVe Hydrating Cleanser' },
          { slot: 'AM', n: 2, step: 'Vitamin C serum', why: 'Antioxidant + brightening. Apply on dry skin before moisturizer. [B]', budget: 'Klairs Freshly Juiced Vitamin Drop', mid: 'SkinCeuticals C E Ferulic' },
          { slot: 'AM', n: 3, step: 'Moisturizer', why: 'Reinforces barrier, locks in hydration.', budget: 'CeraVe Moisturizing Cream', mid: 'Drunk Elephant Lala Retro Whipped Cream' },
          { slot: 'AM', n: 4, step: 'Broad-spectrum SPF 30+', why: 'Non-negotiable. Pigment + photoaging prevention. [A]', budget: 'CeraVe AM Facial Moisturizing Lotion SPF 30', mid: 'EltaMD UV Clear Broad-Spectrum SPF 46' },
          { slot: 'PM', n: 1, step: 'Gentle cleanser', why: 'Removes the day. Double-cleanse if you wear sunscreen + makeup.', budget: 'Cetaphil Gentle Skin Cleanser', mid: 'Beauty of Joseon Radiance Cleansing Balm' },
          { slot: 'PM', n: 2, step: 'Retinoid (start 2x/week)', why: 'Gold standard for photoaging + acne. Build tolerance slowly. [A]', budget: 'Differin Adapalene Gel 0.1%', mid: 'Medik8 Crystal Retinal 3' },
          { slot: 'PM', n: 3, step: 'Moisturizer', why: 'Buffers retinoid irritation, restores overnight.', budget: 'CeraVe Moisturizing Cream', mid: 'AESTURA Atobarrier 365 Cream' },
        ];
        const am = PRESET.filter(p => p.slot === 'AM');
        const pm = PRESET.filter(p => p.slot === 'PM');
        const renderStep = (p, idx) => {
          const expanded = expandedRoutineKey === `${p.slot}-${p.n}`;
          return (
            <div key={`${p.slot}-${p.n}`} className="border-t" style={{borderColor: idx === 0 ? 'transparent' : 'var(--line)'}}>
              <button
                type="button"
                onClick={() => setExpandedRoutineKey(expanded ? null : `${p.slot}-${p.n}`)}
                className="w-full flex items-baseline gap-3 px-4 py-3 text-left transition hover:bg-[var(--cream-deep)]"
              >
                <span className="font-sans text-[14px] flex-shrink-0" style={{color:'var(--ink-soft)', minWidth:'18px'}}>{p.n}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-[13px]" style={{color:'var(--ink)'}}>{p.step}</span>
                </span>
                <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={11} style={{color:'var(--ink-soft)', flexShrink:0}} />
              </button>
              {expanded && (
                <div className="px-4 pb-3 -mt-1 space-y-2">
                  <p className="text-[11.5px] leading-relaxed" style={{color:'var(--ink-soft)'}}>{p.why}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-[10px] border px-3 py-2" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                      <div className="text-[8.5px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>$ Budget</div>
                      <div className="text-[11.5px] mt-0.5 font-sans leading-tight" style={{color:'var(--ink)'}}>{p.budget}</div>
                    </div>
                    <div className="rounded-[10px] border px-3 py-2" style={{borderColor: 'var(--line)', background:'var(--accent-soft)'}}>
                      <div className="text-[8.5px] tracking-[0.18em] uppercase" style={{color:'var(--accent)'}}>$$ Mid-range</div>
                      <div className="text-[11.5px] mt-0.5 font-sans leading-tight" style={{color:'var(--ink)'}}>{p.mid}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        };
        return (
          <div className="border" style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
            <div className="px-4 py-3 border-b text-center" style={{borderColor: 'var(--line)', background:'var(--cream-deep)'}}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Icon name="Sparkles" size={12} style={{color:'var(--accent)'}} />
                <span className="text-[10px] tracking-[0.25em] uppercase" style={{color:'var(--accent)'}}>Starter routine</span>
              </div>
              <h3 className="font-sans text-[18px] mb-1" style={{color:'var(--ink)'}}>AAD-aligned starting point</h3>
              <p className="text-[11px] leading-relaxed max-w-md mx-auto" style={{color:'var(--ink-soft)'}}>
                Tap any step for a $ budget pick + a $$ mid-range pick.
              </p>
            </div>
            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
              <Icon name="Sun" size={11} style={{color:'var(--accent)'}} />
              <span className="text-[10px] tracking-[0.22em] uppercase">Morning</span>
            </div>
            <div>{am.map((p, i) => renderStep(p, i))}</div>
            <div className="px-4 pt-4 pb-1 flex items-center gap-1.5 border-t" style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}>
              <Icon name="Moon" size={11} style={{color:'var(--accent)'}} />
              <span className="text-[10px] tracking-[0.22em] uppercase">Evening</span>
            </div>
            <div>{pm.map((p, i) => renderStep(p, i))}</div>
            <div className="px-4 py-4 border-t flex flex-col sm:flex-row gap-2 justify-center" style={{borderColor: 'var(--line)', background:'var(--cream-deep)'}}>
              <button onClick={() => setShowProductModal(true)} className="px-4 py-2 tracking-[0.2em] text-[10px] uppercase transition" style={{background:'var(--ink)', color:'var(--cream)'}}>
                <Icon name="Plus" size={11} className="inline mr-1" /> Add my products
              </button>
              <button onClick={generateStarterRoutine} disabled={loading} className="px-4 py-2 tracking-[0.2em] text-[10px] uppercase border transition disabled:opacity-50 flex items-center gap-1.5 justify-center" style={{borderColor: 'var(--line)', color:'var(--ink)'}}>
                {loading ? <><Icon name="Loader2" size={11} className="spin" /> Building</> : <><Icon name="Sparkles" size={11} /> AI personalize</>}
              </button>
            </div>
          </div>
        );
      })()}

      {/* (Weekly rotation block was here — now sits below Today, see further down) */}

      {/* === ROTATION BUILDER MODAL === */}
      {showRotationBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4" style={{background:'rgba(28,25,23,0.5)', backdropFilter:'blur(4px)'}} onClick={() => setShowRotationBuilder(false)}>
          <div onClick={e => e.stopPropagation()} className="rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl" style={{background:'var(--cream)'}}>
            <div className="sticky top-0 border-b px-4 py-2.5 flex justify-between items-center z-10" style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
              <h2 className="font-sans text-[18px] md:text-[19px] leading-[1.1] tracking-tight" style={{color:'var(--ink)'}}>Build weekly rotation</h2>
              <button onClick={() => setShowRotationBuilder(false)} style={{color:'var(--ink-soft)'}}><Icon name="X" size={16} /></button>
            </div>
            <div className="px-4 py-3 space-y-3">
              {/* Concerns — read-only summary linking back to top-of-Ritual */}
              <div className="border p-2.5" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                <div className="text-[8px] tracking-[0.25em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>Targeting</div>
                {(userConcerns || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {userConcerns.map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full" style={{background:'var(--accent-soft)', color:'var(--accent)'}}>{c}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px]" style={{color:'var(--ink-soft)'}}>No concerns selected. Edit the row at the top of Regimen to set what AI should target.</p>
                )}
              </div>

              {/* Products from shelf */}
              <div>
                <div className="text-[9px] tracking-[0.25em] uppercase mb-1.5 flex items-center justify-between" style={{color:'var(--ink-soft)'}}>
                  <span>Products</span>
                  <span className="text-[8px] normal-case tracking-normal" style={{color:'var(--accent)'}}>{rotationSelectedProductIds.length}/{activeProducts.length} selected</span>
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {activeProducts.map(p => {
                    const checked = rotationSelectedProductIds.includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => setRotationSelectedProductIds(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id])} className="w-full flex items-center gap-2 px-2 py-1 text-left transition" style={{background: checked ? 'var(--accent-soft)' : 'transparent'}}>
                        <span className="w-3.5 h-3.5 border rounded-sm flex items-center justify-center flex-shrink-0" style={{borderColor: checked ? 'var(--accent)' : 'var(--line)', background: checked ? 'var(--accent)' : 'transparent'}}>
                          {checked && <Icon name="Check" size={9} style={{color:'var(--cream)'}} />}
                        </span>
                        <span className="text-[11px] flex-1 min-w-0 truncate" style={{color:'var(--ink)'}}>{p.name}</span>
                        <span className="text-[9px] tracking-[0.15em] uppercase" style={{color:'var(--ink-soft)'}}>{p.category}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Devices */}
              <div>
                <div className="text-[9px] tracking-[0.25em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>Devices &amp; tools</div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'red-light', label: 'Red light / LED panel' },
                    { id: 'led-mask', label: 'LED mask' },
                    { id: 'gua-sha', label: 'Gua sha' },
                    { id: 'ice-roller', label: 'Ice roller' },
                    { id: 'derma-roller', label: 'Derma roller' },
                    { id: 'high-frequency', label: 'High-frequency wand' },
                    { id: 'microcurrent', label: 'Microcurrent' },
                  ].map(d => {
                    const active = rotationSelectedDevices.includes(d.id);
                    return (
                      <button key={d.id} type="button" onClick={() => setRotationSelectedDevices(prev => active ? prev.filter(x => x !== d.id) : [...prev, d.id])} className="text-[10px] tracking-[0.05em] px-2 py-1 border rounded-full transition" style={{
                        borderColor: active ? 'var(--accent)' : 'var(--line)',
                        background: active ? 'var(--accent)' : 'var(--cream)',
                        color: active ? 'var(--cream)' : 'var(--ink-soft)'
                      }}>{d.label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Build */}
              <button onClick={async () => { await generateWeeklyRotation(rotationSelectedProductIds, rotationSelectedDevices); setShowRotationBuilder(false); }} disabled={rotationLoading || rotationSelectedProductIds.length === 0} className="w-full py-2 tracking-[0.2em] text-[10px] uppercase transition disabled:opacity-50" style={{background:'var(--ink)', color:'var(--cream)'}}>
                {rotationLoading ? 'Building…' : 'Build my week'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === TODAY: Your routine vs AI Recommended ===
           Constrained to max-w-2xl on desktop so it reads as a focused
           editorial card-pair, not a full-width data dashboard. The previous
           layout took the whole page width which felt unbalanced next to
           the rest of the app's tighter content rhythm. */}
      {activeProducts.length > 0 && (
        <div className="mb-10 md:max-w-2xl md:mx-auto">
          {/* Date navigator — ◀ Date label ▶. Forward arrow disabled when viewing today.
              Pretty label switches: Today / Yesterday / Mon, Apr 27 etc. Tap label to
              jump back to today when not currently viewing it. */}
          <div className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase border-b pb-2 mb-3 flex items-center justify-between gap-2" style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}>
            <button
              onClick={() => stepRitualDate(-1)}
              className="p-1 transition hover:opacity-60"
              style={{color:'var(--ink-soft)'}}
              aria-label="Previous day"
              title="Previous day"
            >
              <Icon name="ChevronLeft" size={13} />
            </button>
            <button
              onClick={() => !isViewingToday && setRitualViewDate(todayKeyForRitual)}
              className="flex items-center gap-2 transition hover:opacity-70"
              style={{color: isViewingToday ? 'var(--ink-soft)' : 'var(--ink)'}}
              title={isViewingToday ? '' : 'Back to today'}
              disabled={isViewingToday}
            >
              {isViewingToday && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />}
              {ritualDateLabel}
            </button>
            <button
              onClick={() => stepRitualDate(1)}
              disabled={isViewingToday}
              className="p-1 transition hover:opacity-60 disabled:opacity-25 disabled:cursor-not-allowed"
              style={{color:'var(--ink-soft)'}}
              aria-label="Next day"
              title={isViewingToday ? "Can't go forward past today" : 'Next day'}
            >
              <Icon name="ChevronRight" size={13} />
            </button>
          </div>
          {/* Cards: tighter padding (px-3.5 py-3.5 mobile, px-4 py-4 desktop)
              and serif headings dropped from text-2xl to text-base/lg so they
              don't dominate the card. Numbered list rows use text-[12px] +
              tighter spacing for a denser, editorial read. */}
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {/* === YOUR ROUTINE === */}
            <div className="border rounded-[14px] px-3.5 py-3.5 md:px-4 md:py-4" style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
              <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
                <h3 className="font-sans text-base md:text-lg leading-tight" style={{color:'var(--ink)'}}>
                  {isViewingToday ? 'Your routine' : (submittedRitualLog ? 'Logged that day' : 'Not logged')}
                </h3>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[8.5px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{dailyAM.length + dailyPM.length} steps</span>
                  {/* Edit button only shows when viewing today — past-day views are read-only snapshots. */}
                  {isViewingToday && setShowCheckInModal && (
                    <button
                      onClick={() => setShowCheckInModal(true)}
                      className="text-[9px] tracking-[0.18em] uppercase flex items-center gap-1 transition hover:opacity-70"
                      style={{color:'var(--ink)'}}
                      title="Edit today"
                    >
                      <Icon name="Edit2" size={9} /> Edit
                    </button>
                  )}
                </div>
              </div>
              {/* Past day with NO submitted check-in — show clear empty state instead of pretending intended routine was used */}
              {!isViewingToday && !submittedRitualLog ? (
                <p className="text-[12px] font-light" style={{color:'var(--ink-soft)'}}>
                  No regimen check-in recorded for {ritualDateLabel.toLowerCase()}.
                </p>
              ) : (dailyAM.length === 0 && dailyPM.length === 0) ? (
                <p className="text-[12px] font-light" style={{color:'var(--ink-soft)'}}>{isViewingToday ? 'No daily products tagged. Add usage schedule on your shelf items.' : 'Nothing was ticked AM or PM that day.'}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-[8.5px] tracking-[0.25em] uppercase mb-1.5 flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                      <Icon name="Sun" size={9} /> Morning
                    </div>
                    {dailyAM.length === 0 ? (
                      <p className="text-[11px]" style={{color:'var(--ink-soft)'}}>No AM products yet.</p>
                    ) : (
                      <ol className="space-y-1">
                        {dailyAM.map((p, i) => {
                          const sched = productSchedule(p);
                          return (
                            <li key={p.id} className="text-[12px] font-light leading-snug flex items-baseline gap-1.5">
                              <span className="text-[9px] font-medium" style={{color:'var(--accent)'}}>{i + 1}.</span>
                              <span style={{color:'var(--ink)'}}>{p.name}</span>
                              <span className="text-[8.5px] tracking-wider uppercase" style={{color:'var(--ink-soft)'}}>{p.category}</span>
                              {sched.days.length < 7 && <span className="text-[8.5px]" style={{color:'var(--accent)'}}>{sched.days.map(dayName).join('·')}</span>}
                            </li>
                          );
                        })}
                        {dailyAMOverflow > 0 && (
                          <li className="text-[11px]" style={{color:'var(--accent)'}}>+{dailyAMOverflow} more hidden by routine cap</li>
                        )}
                      </ol>
                    )}
                  </div>
                  <div>
                    <div className="text-[8.5px] tracking-[0.25em] uppercase mb-1.5 flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                      <Icon name="Moon" size={9} /> Evening
                    </div>
                    {dailyPM.length === 0 ? (
                      <p className="text-[11px]" style={{color:'var(--ink-soft)'}}>No PM products yet.</p>
                    ) : (
                      <ol className="space-y-1">
                        {dailyPM.map((p, i) => {
                          const sched = productSchedule(p);
                          return (
                            <li key={p.id} className="text-[12px] font-light leading-snug flex items-baseline gap-1.5">
                              <span className="text-[9px] font-medium" style={{color:'var(--accent)'}}>{i + 1}.</span>
                              <span style={{color:'var(--ink)'}}>{p.name}</span>
                              <span className="text-[8.5px] tracking-wider uppercase" style={{color:'var(--ink-soft)'}}>{p.category}</span>
                              {sched.days.length < 7 && <span className="text-[8.5px]" style={{color:'var(--accent)'}}>{sched.days.map(dayName).join('·')}</span>}
                            </li>
                          );
                        })}
                        {dailyPMOverflow > 0 && (
                          <li className="text-[11px]" style={{color:'var(--accent)'}}>+{dailyPMOverflow} more hidden by routine cap</li>
                        )}
                      </ol>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* === RECOMMENDED === */}
            <div className="border rounded-[14px] px-3.5 py-3.5 md:px-4 md:py-4" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
              <div className="flex items-baseline justify-between mb-3 gap-2">
                <h3 className="font-sans text-base md:text-lg flex items-center gap-1.5 leading-tight" style={{color:'var(--ink)'}}>
                  <Icon name="Sparkles" size={12} /> Recommended
                </h3>
                {!routine && (
                  <button onClick={generateRoutine} disabled={loading} className="text-[9px] tracking-[0.18em] uppercase flex items-center gap-1 disabled:opacity-50" style={{color:'var(--accent)'}}>
                    {loading ? <><Icon name="Loader2" size={10} className="spin" /> Building</> : <>Build <Icon name="ArrowRight" size={10} /></>}
                  </button>
                )}
                {routine && (
                  <button onClick={generateRoutine} disabled={loading} className="text-[9px] tracking-[0.18em] uppercase flex items-center gap-1 disabled:opacity-50" style={{color:'var(--ink-soft)'}}>
                    {loading ? <><Icon name="Loader2" size={10} className="spin" /></> : <>Refine</>}
                  </button>
                )}
              </div>
              {!routine && !loading && (
                <p className="text-[12px] font-light leading-snug" style={{color:'var(--ink-soft)'}}>
                  Tap Build for an AI routine — properly ordered, tailored to your concerns, flagged for overuse.
                </p>
              )}
              {loading && !routine && (
                <p className="text-[12px] font-light pulse-soft" style={{color:'var(--ink-soft)'}}>Reading your shelf, concerns, sensitivities…</p>
              )}
              {routine && (() => {
                /* === Parse each routine line into { product, why } so the list collapses to names. ===
                 * Hover (desktop) or tap (mobile) reveals the why. State `expandedRoutineKey`
                 * tracks which row is currently expanded for the tap path. */
                const parseRoutineLines = (raw) => {
                  if (!raw) return [];
                  return raw.trim().split(/\n/).map(l => l.trim()).filter(Boolean).map(line => {
                    const cleaned = line.replace(/^\d+\.\s*/, '').replace(/^[-•·]\s*/, '');
                    const dashIdx = cleaned.search(/\s+[—–-]\s+/);
                    if (dashIdx > -1) {
                      return {
                        product: cleaned.slice(0, dashIdx).trim(),
                        why: cleaned.slice(dashIdx).replace(/^\s+[—–-]\s+/, '').trim()};
                    }
                    return { product: cleaned, why: '' };
                  }).filter(it => it.product);
                };
                const amItems = parseRoutineLines(parseSection('AM ROUTINE'));
                const pmItems = parseRoutineLines(parseSection('PM ROUTINE'));
                const renderSlot = (label, icon, items, slotKey) => (
                  <div>
                    <div className="text-[8.5px] tracking-[0.25em] uppercase mb-1.5 flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                      <Icon name={icon} size={9} /> {label}
                    </div>
                    {items.length === 0 ? (
                      <div className="text-[12px] font-sans" style={{color:'var(--ink-soft)'}}>—</div>
                    ) : (
                      <ol className="space-y-1">
                        {items.map((it, i) => {
                          const rowKey = `${slotKey}-${i}`;
                          const expanded = expandedRoutineKey === rowKey;
                          const hasWhy = !!it.why;
                          return (
                            <li key={rowKey}>
                              <button
                                type="button"
                                onClick={() => hasWhy && setExpandedRoutineKey(expanded ? null : rowKey)}
                                onMouseEnter={() => hasWhy && setExpandedRoutineKey(rowKey)}
                                onMouseLeave={() => hasWhy && setExpandedRoutineKey(prev => prev === rowKey ? null : prev)}
                                className="w-full text-left flex items-baseline gap-2 group"
                                disabled={!hasWhy}
                              >
                                <span className="font-sans text-[12px] md:text-[13px] leading-tight" style={{color:'var(--ink)'}}>{it.product}</span>
                                {hasWhy && <Icon name="Info" size={9} style={{color:'var(--ink-soft)', opacity: expanded ? 1 : 0.4}} />}
                              </button>
                              {expanded && it.why && (() => {
                                /* Concise reveal — keep only the first sentence
                                   (or 140 chars max). The previous render dumped
                                   the full multi-sentence "why" which felt like a
                                   wall of text after a small tap target. */
                                const trimmed = it.why.split(/(?<=[.!?])\s+/)[0] || it.why;
                                const concise = trimmed.length > 140 ? trimmed.slice(0, 138).trim() + '…' : trimmed;
                                return (
                                  <div className="text-[11px] leading-snug font-light mt-0.5 pl-2 border-l line-clamp-2" style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}>{withPearls(concise, onOpenLesson)}</div>
                                );
                              })()}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                );
                return (
                  <div className="space-y-3">
                    {renderSlot('Morning', 'Sun', amItems, 'am')}
                    {renderSlot('Evening', 'Moon', pmItems, 'pm')}
                    <p className="text-[8.5px]" style={{color:'var(--ink-soft)'}}>Hover or tap any product for the why.</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* AI flags below the side-by-side — tightened to match the
              compact card pair (rounded-[14px], smaller padding + text). */}
          {routine && (
            <>
              {parseSection('OVERUSE / FLAGS') && parseSection('OVERUSE / FLAGS') !== 'No overuse patterns detected.' && (
                <div className="border rounded-[14px] px-3.5 py-3 mt-3" style={{background:'var(--accent-soft)', borderColor: 'var(--line)'}}>
                  <div className="text-[9px] tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1.5" style={{color:'var(--accent)'}}>
                    <Icon name="AlertTriangle" size={10} /> Overuse / Flags
                  </div>
                  <div className="text-[12px] font-light leading-relaxed whitespace-pre-wrap" style={{color:'var(--ink)'}}>{withPearls(parseSection('OVERUSE / FLAGS'), onOpenLesson)}</div>
                </div>
              )}
              {parseSection('LAYERING NOTES') && (
                <div className="border rounded-[14px] px-3.5 py-3 mt-3" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                  <div className="text-[9px] tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                    <Icon name="Info" size={10} /> Layering Notes
                  </div>
                  <div className="text-[12px] font-light leading-relaxed whitespace-pre-wrap" style={{color:'var(--ink)'}}>{withPearls(parseSection('LAYERING NOTES'), onOpenLesson)}</div>
                </div>
              )}
              {parseSection('GAPS DETECTED') && parseSection('GAPS DETECTED') !== 'Routine appears complete.' && (
                <div className="border rounded-[14px] px-3.5 py-3 mt-3" style={{background:'#fef0ef', borderColor:'#d4a094'}}>
                  <div className="text-[9px] tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1" style={{color:'#a04555'}}>
                    <Icon name="AlertCircle" size={10} /> Gaps Detected
                  </div>
                  <div className="text-[12px] font-light leading-relaxed whitespace-pre-wrap" style={{color:'var(--ink)'}}>{withPearls(parseSection('GAPS DETECTED'), onOpenLesson)}</div>
                </div>
              )}
            </>
          )}

          {/* === LAYERING PEARL — small derm tip based on today's actives === */}
          {(() => {
            const am = [...dailyAM, ...dailyPM]; // both routines factored in
            const haystack = am.map(p => `${p.name} ${p.activeIngredients || ''} ${(p.tags || []).join(' ')}`).join(' ').toLowerCase();
            const tips = [];
            if (/vitamin\s*c|ascorbic|ascorbate/.test(haystack)) tips.push('Vitamin C goes on damp skin in the AM, before SPF — let it dry 60s before the next layer.');
            if (/(retinol|tretinoin|adapalene|retinaldehyde|retinoid)/.test(haystack)) tips.push('Apply retinoid to fully dry skin (wait 10 min after cleansing) and follow with moisturizer to buffer.');
            if (/(niacinamide)/.test(haystack)) tips.push('Niacinamide layers well with everything — put it before heavier creams.');
            if (/(hyaluronic|glycerin)/.test(haystack)) tips.push('Hyaluronic acid works on damp skin only — apply before it dries to draw moisture in.');
            if (/(salicylic|bha|glycolic|lactic|aha)/.test(haystack)) tips.push('Acids on dry, clean skin — wait 10-15 min before the next active to let pH settle.');
            if (/(spf|sunscreen|zinc|titanium)/.test(haystack)) tips.push('SPF is always last in the AM. Two finger-lengths for face + neck, reapply every 2 hours outdoors.');
            if (/(peptide)/.test(haystack)) tips.push('Peptides are best in PM after retinoid is fully absorbed, or in AM before SPF.');
            if (tips.length === 0) tips.push('Apply thinnest to thickest — water-based serums first, oils and balms last. Wait ~60 seconds between layers.');
            return tips.length > 0 ? (
              <div className="mt-4 px-3 py-2 border-l-2 text-[10px] md:text-[11px] font-light leading-snug" style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}>
                <span className="text-[8px] tracking-[0.25em] uppercase mr-2" style={{color:'var(--accent)'}}>Pearl</span>
                {tips.slice(0, 2).join(' ')}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* === WEEKLY — rotation builder, now below Today.
           Shows for both empty-profile users (driven by Starter Routine, all [suggested]
           items) and users with products. Only hides if no rotation has been built AND
           shelf is empty AND nothing is loading — avoids an empty header. */}
      {(activeProducts.length > 0 || weeklyRotation || rotationLoading) && (
        <div className="mb-8">
          <div className="flex items-baseline justify-between border-b pb-2 mb-3" style={{borderColor: 'var(--line)'}}>
            <div className="text-[10px] tracking-[0.3em] uppercase flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
              Weekly{activeProducts.length === 0 && weeklyRotation ? <span className="ml-1 normal-case tracking-normal font-sans text-[11px]" style={{color:'var(--accent)'}}>· starter</span> : null}
            </div>
            {activeProducts.length > 0 && (
              <button onClick={() => setShowRotationBuilder(true)} disabled={rotationLoading} className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1 disabled:opacity-50" style={{color:'var(--accent)'}}>
                {rotationLoading ? <><Icon name="Loader2" size={10} className="spin" /> Building</> : (weeklyRotation ? <>Rebuild rotation <Icon name="RefreshCw" size={10} /></> : <>Build rotation <Icon name="ArrowRight" size={10} /></>)}
              </button>
            )}
            {activeProducts.length === 0 && weeklyRotation && (
              <button onClick={() => generateWeeklyRotation([], [])} disabled={rotationLoading} className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1 disabled:opacity-50" style={{color:'var(--accent)'}}>
                {rotationLoading ? <><Icon name="Loader2" size={10} className="spin" /> Rebuilding</> : <>Rebuild <Icon name="RefreshCw" size={10} /></>}
              </button>
            )}
          </div>
          {!weeklyRotation && !rotationLoading && activeProducts.length > 0 && (
            <p className="text-[11px] font-light" style={{color:'var(--ink-soft)'}}>Optimal cadence — which actives on which days, recovery nights spaced, antagonistic actives separated.{activeProducts.length < 6 && <span style={{color:'var(--accent)'}}> AI will also suggest products to round out the week since your shelf is light.</span>} Tap Build to pick the products and devices to include.</p>
          )}
          {rotationLoading && <p className="text-[11px] pulse-soft" style={{color:'var(--ink-soft)'}}>Reading shelf, concerns, sensitivities…</p>}
          {weeklyRotation && (
            <div className="border overflow-x-auto" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
              <div className="grid grid-cols-7" style={{minWidth: '420px'}}>
                {['MON','TUE','WED','THU','FRI','SAT','SUN'].map((day, i) => {
                  const am = parseRotationDay(day, 'AM');
                  const pm = parseRotationDay(day, 'PM');
                  // Per-day note from AI assessment, rendered terracotta
                  const noteMatch = weeklyRotation.match(new RegExp(`${day}\\s+NOTE:\\s*(.+)`));
                  const note = noteMatch ? noteMatch[1].trim() : '';
                  // Letter labels: M T W T F S S (no number, per spec)
                  const letter = ['M','T','W','T','F','S','S'][i];
                  // Render line — distinguish [suggested] items as terracotta
                  const renderLine = (line) => {
                    if (!line || line === '—') return <>—</>;
                    const parts = line.split(/\s*·\s*/);
                    return parts.map((p, idx) => {
                      const isSuggested = /^\[suggested\]/i.test(p);
                      const clean = p.replace(/^\[suggested\]\s*/i, '');
                      return (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span style={{color:'var(--ink-soft)'}}> · </span>}
                          <span style={{color: isSuggested ? 'var(--accent)' : 'var(--ink)'}}>{clean}</span>
                        </React.Fragment>
                      );
                    });
                  };
                  return (
                    <div key={day} className="border-r last:border-r-0 px-1.5 py-2" style={{borderColor: 'var(--line)'}}>
                      <div className="text-[10px] tracking-[0.15em] uppercase text-center mb-1.5 font-medium" style={{color:'var(--accent)'}}>{letter}</div>
                      <div className="space-y-1.5">
                        <div>
                          <div className="text-[7px] tracking-[0.2em] uppercase mb-0.5" style={{color:'var(--ink-soft)'}}>AM</div>
                          <div className="text-[9px] leading-tight">{renderLine(am)}</div>
                        </div>
                        <div>
                          <div className="text-[7px] tracking-[0.2em] uppercase mb-0.5" style={{color:'var(--ink-soft)'}}>PM</div>
                          <div className="text-[9px] leading-tight">{renderLine(pm)}</div>
                        </div>
                        {note && (
                          <div className="pt-1 mt-1 border-t text-[8px] leading-snug" style={{borderColor: 'var(--line)', color:'var(--accent)'}}>
                            {note}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const why = weeklyRotation.match(/WHY THIS CADENCE:\s*([\s\S]*?)(?=WHAT TO ADD:|$)/);
                const add = weeklyRotation.match(/WHAT TO ADD:\s*([\s\S]+)/);
                return (
                  <>
                    {why && (
                      <div className="border-t px-3 py-2 text-[10px] font-light leading-snug" style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}>
                        {why[1].trim()}
                      </div>
                    )}
                    {add && (
                      <div className="border-t px-3 py-2 text-[10px] leading-snug flex items-start gap-1.5" style={{borderColor: 'var(--line)', background:'var(--accent-soft)', color:'var(--ink)'}}>
                        <Icon name="Sparkles" size={10} style={{color:'var(--accent)', flexShrink:0, marginTop:'2px'}} />
                        <span><span className="text-[8px] tracking-[0.25em] uppercase mr-1.5" style={{color:'var(--accent)'}}>Round out</span><span className="">{compactWhatToAdd(add[1])}</span></span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* === THIS WEEK — 7-day horizontal row from regimenLogs === */}
      {activeProducts.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] tracking-[0.3em] uppercase border-b pb-2 mb-3 flex items-center justify-between" style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
              This week
            </span>
            <span className="text-[9px] tracking-[0.2em] normal-case">
              {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {/* Mobile: horizontal-scroll one-row strip; Desktop: 7-col grid */}
          <div className="md:hidden overflow-x-auto no-scrollbar snap-x snap-mandatory" style={{WebkitOverflowScrolling:'touch'}}>
            <div className="flex gap-1.5" style={{width:'max-content'}}>
              {weekDays.map((d, i) => {
                const log = logForDate(d);
                const isToday = dateKey(d) === dateKey(todayDate);
                const future = isFuture(d);
                const dayLetter = ['M','T','W','T','F','S','S'][i];
                const amNamesShort = log ? [
                  ...(log.amProducts || []).map(id => products.find(p => p.id === id)).filter(Boolean).map(p => `${p.brand ? p.brand.split(' ')[0] + ' ' : ''}${p.name}`),
                  ...(log.amExtras || [])
                ] : [];
                const pmNamesShort = log ? [
                  ...(log.pmProducts || []).map(id => products.find(p => p.id === id)).filter(Boolean).map(p => `${p.brand ? p.brand.split(' ')[0] + ' ' : ''}${p.name}`),
                  ...(log.pmExtras || [])
                ] : [];
                return (
                  <button
                    key={i}
                    onClick={() => { if (isToday) setShowCheckInModal && setShowCheckInModal(true); else if (log) setExpandedMonthDate(dateKey(d)); }}
                    disabled={future && !log}
                    className="snap-start text-left flex-shrink-0 border px-2 py-2 flex flex-col disabled:cursor-default"
                    style={{
                      width:'112px',
                      minHeight:'92px',
                      borderColor: isToday ? 'var(--accent)' : 'var(--line)',
                      background: isToday ? 'var(--accent-soft)' : (log ? 'var(--cream-deep)' : 'var(--cream)'),
                      opacity: future && !log ? 0.5 : 1}}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{color: isToday ? 'var(--accent)' : 'var(--ink-soft)'}}>{dayLetter}</span>
                      <span className="font-sans text-xs" style={{color:'var(--ink-soft)'}}>{d.getDate()}</span>
                    </div>
                    <div className="mt-1.5 flex-1 space-y-1">
                      <div>
                        <div className="text-[8px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>AM</div>
                        <div className="text-[10px] leading-tight line-clamp-2" style={{color: amNamesShort.length ? 'var(--ink)' : 'var(--ink-soft)'}}>
                          {amNamesShort.length ? amNamesShort.slice(0, 2).join(', ') : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>PM</div>
                        <div className="text-[10px] leading-tight line-clamp-2" style={{color: pmNamesShort.length ? 'var(--ink)' : 'var(--ink-soft)'}}>
                          {pmNamesShort.length ? pmNamesShort.slice(0, 2).join(', ') : '—'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Desktop: traditional 7-column grid */}
          <div className="hidden md:grid grid-cols-7 gap-1.5">
            {weekDays.map((d, i) => {
              const log = logForDate(d);
              const isToday = dateKey(d) === dateKey(todayDate);
              const future = isFuture(d);
              const dayLetter = ['M','T','W','T','F','S','S'][i];
              const amNamesShort = log ? [
                ...(log.amProducts || []).map(id => products.find(p => p.id === id)).filter(Boolean).map(p => `${p.brand ? p.brand.split(' ')[0] + ' ' : ''}${p.name}`),
                ...(log.amExtras || [])
              ] : [];
              const pmNamesShort = log ? [
                ...(log.pmProducts || []).map(id => products.find(p => p.id === id)).filter(Boolean).map(p => `${p.brand ? p.brand.split(' ')[0] + ' ' : ''}${p.name}`),
                ...(log.pmExtras || [])
              ] : [];
              return (
                <button
                  key={i}
                  onClick={() => { if (isToday) setShowCheckInModal && setShowCheckInModal(true); else if (log) setExpandedMonthDate(dateKey(d)); }}
                  disabled={future && !log}
                  className="text-left px-1.5 py-1.5 border transition disabled:cursor-default flex flex-col"
                  style={{
                    borderColor: isToday ? 'var(--accent)' : 'var(--line)',
                    background: isToday ? 'var(--accent-soft)' : (log ? 'var(--cream-deep)' : 'var(--cream)'),
                    color: future ? 'var(--line)' : 'var(--ink)',
                    opacity: future && !log ? 0.5 : 1,
                    minHeight: '70px'}}
                >
                  <div className="text-[10px] tracking-[0.15em] uppercase font-medium text-center" style={{color: isToday ? 'var(--accent)' : 'var(--ink-soft)'}}>{dayLetter}</div>
                  <div className="mt-1 space-y-0.5 flex-1">
                    <div>
                      <div className="text-[7px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>AM</div>
                      <div className="text-[8px] leading-tight line-clamp-2" style={{color: amNamesShort.length ? 'var(--ink)' : 'var(--ink-soft)'}}>
                        {amNamesShort.length ? amNamesShort.slice(0, 2).join(', ') : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[7px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>PM</div>
                      <div className="text-[8px] leading-tight line-clamp-2" style={{color: pmNamesShort.length ? 'var(--ink)' : 'var(--ink-soft)'}}>
                        {pmNamesShort.length ? pmNamesShort.slice(0, 2).join(', ') : '—'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Actives summary */}
          {activesThisWeek.length > 0 && (
            <div className="mt-2.5 text-[10px] font-light leading-snug" style={{color:'var(--ink-soft)'}}>
              <span className="text-[8px] tracking-[0.25em] uppercase mr-2" style={{color:'var(--ink-soft)'}}>This week</span>
              {activesThisWeek.map(([label, count], i) => (
                <span key={label}>
                  {i > 0 && <span className="mx-1" style={{color:'var(--line)'}}>·</span>}
                  <span style={{color:'var(--ink)'}}>{label}</span> <span style={{color:'var(--accent)'}}>{count}×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* (Weekly rotation builder moved above Daily, see top of return) */}
      {/* Prior weeks removed — superseded by the navigable monthly calendar below. */}

      {/* === MONTH CALENDAR — navigable, click day or week to expand === */}
      <div className="mb-8">
        <div className="border-b pb-2 mb-3 flex items-center justify-between" style={{borderColor: 'var(--line)'}}>
          <button onClick={goPrevMonth} className="p-1.5" style={{color:'var(--ink-soft)'}} aria-label="Previous month">
            <Icon name="ChevronLeft" size={14} />
          </button>
          <div className="flex items-baseline gap-2">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
            <span className="font-sans text-base" style={{color:'var(--ink)'}}>{monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            {!isCurrentMonth && <button onClick={goThisMonth} className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>Today</button>}
          </div>
          <button onClick={goNextMonth} disabled={isCurrentMonth} className="p-1.5 disabled:opacity-30" style={{color:'var(--ink-soft)'}} aria-label="Next month">
            <Icon name="ChevronRight" size={14} />
          </button>
        </div>
        {/* Header row: tiny "wk" gutter + 7 day letters */}
        <div className="grid gap-0.5 mb-1" style={{gridTemplateColumns:'18px repeat(7, minmax(0, 1fr))'}}>
          <div />
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} className="text-center text-[8px] tracking-[0.2em] uppercase py-0.5" style={{color:'var(--ink-soft)'}}>{d}</div>
          ))}
        </div>
        {/* Week-row layout: each row gets a clickable week-handle on the left + 7 day cells */}
        {(() => {
          const rows = [];
          for (let r = 0; r < monthCells.length / 7; r++) {
            rows.push(monthCells.slice(r * 7, r * 7 + 7));
          }
          return rows.map((row, ri) => {
            // Find first non-null day to compute a week start date for this row.
            const firstDay = row.find(d => d != null);
            if (!firstDay) return null;
            const firstDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), firstDay);
            // Snap firstDate back to nearest Monday for a stable week-start key
            const weekStart = new Date(firstDate);
            weekStart.setDate(firstDate.getDate() - ((firstDate.getDay() + 6) % 7));
            const weekKey = dateKey(weekStart);
            const expanded = expandedWeekStart === weekKey;
            return (
              <div key={ri} className="mb-0.5">
                <div className="grid gap-0.5" style={{gridTemplateColumns:'18px repeat(7, minmax(0, 1fr))'}}>
                  <button onClick={() => setExpandedWeekStart(expanded ? null : weekKey)} className="text-[8px] tracking-[0.15em] flex items-center justify-center transition" style={{color: expanded ? 'var(--accent)' : 'var(--ink-soft)'}} aria-label={`Toggle week starting ${weekKey}`}>
                    wk
                  </button>
                  {row.map((day, ci) => {
                    if (!day) return <div key={ci} className="aspect-square" />;
                    const cellDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
                    const cellKey = dateKey(cellDate);
                    const log = logForDate(cellDate);
                    const isFutureCell = cellDate > todayDate;
                    const isTodayCell = cellKey === dateKey(todayDate);
                    const amDone = log && (log.amProducts?.length || 0) + (log.amExtras?.length || 0) > 0;
                    const pmDone = log && (log.pmProducts?.length || 0) + (log.pmExtras?.length || 0) > 0;
                    const procsHere = (procedures || []).filter(p => p.date === cellKey);
                    const hasAny = log || procsHere.length > 0;
                    const isSelectedDay = expandedMonthDate === cellKey;
                    return (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => hasAny && setExpandedMonthDate(isSelectedDay ? null : cellKey)}
                        disabled={isFutureCell || !hasAny}
                        className="aspect-square flex flex-col items-center justify-center transition relative disabled:cursor-default"
                        style={{
                          background: isSelectedDay ? 'var(--accent)' : (isTodayCell ? 'var(--accent-soft)' : (hasAny ? 'var(--cream-deep)' : 'transparent')),
                          border: isTodayCell || isSelectedDay ? '1px solid var(--accent)' : '1px solid transparent',
                          color: isSelectedDay ? 'var(--cream)' : (isFutureCell ? 'var(--line)' : 'var(--ink)')}}
                      >
                        <span className="text-[10px] font-light leading-none">{day}</span>
                        {hasAny && (
                          <span className="flex items-center gap-0.5 mt-0.5">
                            {log && <span className="w-1 h-1 rounded-full" style={{background: isSelectedDay ? 'var(--cream)' : (amDone ? 'var(--accent)' : 'var(--line)')}} />}
                            {log && <span className="w-1 h-1 rounded-full" style={{background: isSelectedDay ? 'var(--cream)' : (pmDone ? 'var(--accent)' : 'var(--line)')}} />}
                            {procsHere.length > 0 && <span className="w-1 h-1 rounded-full" style={{background: isSelectedDay ? 'var(--cream)' : 'var(--rose)'}} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Inline week summary */}
                {expanded && (() => {
                  const wkDays = [];
                  for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); wkDays.push(d); }
                  const wkLogs = wkDays.map(d => logForDate(d)).filter(Boolean);
                  const wkProcs = (procedures || []).filter(p => {
                    const pd = new Date(p.date);
                    return pd >= weekStart && pd <= wkDays[6];
                  });
                  // Aggregate distinct product names used across the week
                  const productSet = new Set();
                  wkLogs.forEach(l => {
                    [...(l.amProducts || []), ...(l.pmProducts || [])].forEach(id => {
                      const p = products.find(pp => pp.id === id);
                      if (p) productSet.add(p.name);
                    });
                    [...(l.amExtras || []), ...(l.pmExtras || [])].forEach(n => productSet.add(n));
                  });
                  const productNames = [...productSet].slice(0, 12);
                  return (
                    <div className="mt-1 mb-2 border p-3" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="font-sans text-sm" style={{color:'var(--ink)'}}>
                          Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {wkDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <button onClick={() => setExpandedWeekStart(null)} className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>Close</button>
                      </div>
                      <div className="text-[10px] font-light leading-snug" style={{color:'var(--ink-soft)'}}>
                        {wkLogs.length} {wkLogs.length === 1 ? 'day' : 'days'} logged
                        {wkProcs.length > 0 && <> · <span style={{color:'var(--rose)'}}>{wkProcs.length} {wkProcs.length === 1 ? 'procedure' : 'procedures'}</span></>}
                      </div>
                      {productNames.length > 0 && (
                        <div className="mt-2 text-[10px] leading-snug" style={{color:'var(--ink)'}}>
                          <span className="text-[8px] tracking-[0.25em] uppercase mr-1.5" style={{color:'var(--ink-soft)'}}>Products</span>
                          <span className="font-light">{productNames.join(' · ')}</span>
                        </div>
                      )}
                      {wkProcs.length > 0 && (
                        <div className="mt-1.5 text-[10px] leading-snug">
                          <span className="text-[8px] tracking-[0.25em] uppercase mr-1.5" style={{color:'var(--rose)'}}>Procedures</span>
                          {wkProcs.map((p, i) => (
                            <span key={p.id} style={{color:'var(--ink)'}}>
                              {i > 0 && <span style={{color:'var(--line)'}}> · </span>}
                              <span className="font-sans">{p.name}</span> <span className="text-[9px]" style={{color:'var(--ink-soft)'}}>· {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          });
        })()}
        {/* Expanded day detail */}
        {expandedMonthDate && (() => {
          const log = regimenLogs.find(r => r.date === expandedMonthDate);
          const procsHere = (procedures || []).filter(p => p.date === expandedMonthDate);
          if (!log && procsHere.length === 0) return null;
          const amNames = log ? [
            ...(log.amProducts || []).map(id => products.find(p => p.id === id)?.name).filter(Boolean),
            ...(log.amExtras || [])
          ] : [];
          const pmNames = log ? [
            ...(log.pmProducts || []).map(id => products.find(p => p.id === id)?.name).filter(Boolean),
            ...(log.pmExtras || [])
          ] : [];
          return (
            <div className="border p-3 mt-2" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-sans text-base" style={{color:'var(--ink)'}}>{new Date(expandedMonthDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                <button onClick={() => setExpandedMonthDate(null)} className="text-[9px] tracking-widest uppercase" style={{color:'var(--ink-soft)'}}>Close</button>
              </div>
              {log ? (
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <div className="text-[8px] tracking-[0.2em] uppercase mb-1 flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                      <Icon name="Sun" size={9} /> Morning
                    </div>
                    {amNames.length === 0 ? <div className="" style={{color:'var(--ink-soft)'}}>—</div> : amNames.map(n => <div key={n} className="font-light" style={{color:'var(--ink)'}}>{n}</div>)}
                  </div>
                  <div>
                    <div className="text-[8px] tracking-[0.2em] uppercase mb-1 flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                      <Icon name="Moon" size={9} /> Evening
                    </div>
                    {pmNames.length === 0 ? <div className="" style={{color:'var(--ink-soft)'}}>—</div> : pmNames.map(n => <div key={n} className="font-light" style={{color:'var(--ink)'}}>{n}</div>)}
                  </div>
                </div>
              ) : (
                <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>No regimen check-in logged.</div>
              )}
              {log && (log.devices?.length > 0 || log.sleep || log.supplements?.length > 0) && (
                <div className="mt-2 pt-2 border-t text-[10px]" style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}>
                  {log.devices?.length > 0 && <span>Devices: {log.devices.join(', ')} · </span>}
                  {log.sleep && <span>Sleep: {log.sleep}h · </span>}
                  {log.supplements?.length > 0 && <span>Supplements: {log.supplements.join(', ')}</span>}
                </div>
              )}
              {procsHere.length > 0 && (
                <div className="mt-2 pt-2 border-t" style={{borderColor: 'var(--line)'}}>
                  <div className="text-[8px] tracking-[0.25em] uppercase mb-1" style={{color:'var(--rose)'}}>Procedure</div>
                  {procsHere.map(p => (
                    <div key={p.id} className="text-[11px] font-sans" style={{color:'var(--ink)'}}>
                      {p.name} <span className="text-[10px] font-light" style={{color:'var(--ink-soft)'}}>· {p.type?.replace(/-/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* === WEEKLY === */}
      {activeProducts.length > 0 && weeklyProducts.length > 0 && (
        <div className="mb-10">
          <div className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase border-b pb-2 mb-4 flex items-center gap-2" style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
            Weekly cadence
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weeklyProducts.map(p => {
              const sched = productSchedule(p);
              return (
                <div key={p.id} className="border p-4" style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{p.brand} · {p.category}</div>
                      <div className="font-sans text-base leading-tight mt-0.5" style={{color:'var(--ink)'}}>{p.name}</div>
                    </div>
                    <div className="text-[9px] tracking-[0.15em] uppercase whitespace-nowrap" style={{color:'var(--accent)'}}>
                      {p.frequency.replace(/-/g, ' ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {[0,1,2,3,4,5,6].map(d => {
                      const on = sched.days.includes(d);
                      return (
                        <span key={d} className="w-5 h-5 text-[9px] flex items-center justify-center rounded-full" style={{
                          background: on ? 'var(--accent)' : 'transparent',
                          border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                          color: on ? 'var(--cream)' : 'var(--ink-soft)'
                        }}>{['S','M','T','W','T','F','S'][d]}</span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === MONTHLY === */}
      {(monthlyProducts.length > 0 || recentProcedures.length > 0) && (
        <div className="mb-6">
          <div className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase border-b pb-2 mb-4 flex items-center justify-between" style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
              Monthly cadence
            </span>
            {setShowProcedureModal && (
              <button onClick={() => setShowProcedureModal(true)} className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink)'}}>
                + Log procedure
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {monthlyProducts.map(p => (
              <div key={p.id} className="border p-4" style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
                <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{p.brand} · {p.category}</div>
                <div className="font-sans text-base leading-tight mt-0.5" style={{color:'var(--ink)'}}>{p.name}</div>
                <div className="text-[10px] mt-1.5" style={{color:'var(--accent)'}}>{p.frequency.replace(/-/g, ' ')}</div>
              </div>
            ))}
            {recentProcedures.map(pr => {
              const ago = Math.floor((Date.now() - new Date(pr.date).getTime()) / (24 * 60 * 60 * 1000));
              return (
                <button key={pr.id} onClick={() => setActiveTab && setActiveTab('procedures')} className="border p-4 text-left transition hover:bg-[var(--cream-deep)]" style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
                  <div className="text-[9px] tracking-[0.2em] uppercase flex items-center gap-1" style={{color:'var(--accent)'}}>
                    <Icon name="Activity" size={9} /> Procedure
                  </div>
                  <div className="font-sans text-base leading-tight mt-0.5" style={{color:'var(--ink)'}}>{pr.name}</div>
                  <div className="text-[10px] mt-1.5" style={{color:'var(--ink-soft)'}}>
                    {new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {ago >= 0 && <> · {ago === 0 ? 'today' : `${ago} days ago`}</>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
