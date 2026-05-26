// === HomeDashboard (Wave 6.2 extract — May 2026) ===
// Lifted out of App's render tree where it lived as an inline IIFE
// `{activeTab === 'dashboard' && (() => { ... })()}`. ~2790 lines of the
// Home cover surface — daily ritual command center, today's photo strip,
// week-at-a-glance, suggestions, journal preview, etc.
//
// All App-scope state + setters are passed as explicit props. Render
// site in App: `<HomeDashboard ... />` gated by the same activeTab check.
//
// Module-scope (no prop bridge): Icon, Modal, Photo, all named Home child
// components (already extracted in Wave 3.1), resolveTodayRitual,
// localDateISO, withTimeout, getActualUsage, formatUsageForPrompt, etc.

const HomeDashboard = ({
  activeTab,
  user,
  userProfile,
  userConcerns,
  onboardingState,
  logs,
  products,
  procedures,
  events,
  regimenLogs, setRegimenLogs,
  coverRoutine, setCoverRoutine,
  cycleData,
  hormonalContext,
  sensitivities,
  homeDevices,
  generatedProductArt,
  dailyCoverPick,
  todayStr,
  ritualViewDate, setRitualViewDate,
  ritualSlot, setRitualSlot,
  setShowCheckInModal,
  setShowCheckInChooser,
  setShowCheckInCamera,
  setShowHomeUploadPicker,
  setShowProductModal,
  setEditingProductId,
  setProductForm,
  setShowApiKeyModal,
  setActiveTab,
  setJournalViewOverride,
  setRegimenView,
  setCoverRoutineRebuildToken,
  homeUploadInputRef,
  retryLogAnalysis,
  callClaude,
  saveData,
  toast,
    setSkinReadDrawerLogId,
    buildCoverRoutineRef,
  coverRoutineLoading, setCoverRoutineLoading,
  coverBuildPromptDismissed, dismissCoverBuildPrompt,
  noteCardExpanded, setNoteCardExpanded,
  setSampleRoutinePreview,
  setJournalDayDetail,
  setOpenLesson,
  setRemoveScopePrompt,
  setUsedSomethingElseSheet,
}) => {
  // === BOOT HYDRATION GRACE (May 2026 v2 per Jenni) ===
  // Briefly suppresses the fresh-user empty-state cover while
  // loadFromSupabase is still settling. Without this, returning
  // cloud users saw a flash of "Your skin story starts here." in
  // the moment between setLoading(false) and logs/products landing
  // in React state. 300ms is enough for the typical cloud read.
  // For genuinely fresh users, the empty cover appears 300ms late —
  // imperceptible.
  const [coverHydrated, setCoverHydrated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCoverHydrated(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Pearl of the Day — deterministic by ISO date, rotates at midnight local
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const pearlOfDay = LESSONS[dayOfYear % LESSONS.length];
  const today = new Date();
  // Note: `todayStr` is destructured from props above (passed by App).
  // Don't redeclare locally — that would collide with the prop.
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date());
  // Upcoming procedure follow-up checkpoints within next 14 days (1w/2w/3w/4w + monthly markers up to 6mo)
  const upcomingFollowUps = (() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 86400000);
    const items = [];
    (procedures || []).forEach(p => {
      const start = new Date(p.date);
      const slots = [
        { weeks: 1, label: '1 week post' },
        { weeks: 2, label: '2 weeks post' },
        { weeks: 3, label: '3 weeks post' },
        { weeks: 4, label: '4 weeks post' },
      ];
      slots.forEach(({ weeks, label }) => {
        const d = new Date(start.getTime() + weeks * 7 * 86400000);
        if (d >= now && d <= horizon) items.push({ id: `fu-${p.id}-w${weeks}`, date: localDateISO(d), dateObj: d, label, name: p.name });
      });
      for (let m = 2; m <= 6; m++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + m);
        if (d >= now && d <= horizon) items.push({ id: `fu-${p.id}-m${m}`, date: localDateISO(d), dateObj: d, label: `${m} months post`, name: p.name });
      }
    });
    return items.sort((a, b) => a.dateObj - b.dateObj);
  })();
  const activeProducts = products.filter(p => !p.endDate);
  const hasPhoto = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
  // === TODAY'S HERO PHOTO ===
  // Selection priority (full-face always wins when it exists today):
  // 1. Newest full-face photo for today  ← canonical hero, always preferred
  // 2. dailyCoverPick override for today (user explicitly elevated a non-full-face shot)
  // 3. nothing — empty state surfaces (with picker chip if other-area photos exist)
  // Why: the cover should reflect "today's face read." If the user logs a chin/cheek
  // shot first and then takes their daily full-face, the hero must auto-snap to the
  // full-face. Previous order (override-first) caused the chin photo to stay
  // pinned even after a full-face was logged. Override only applies on days when
  // no full-face exists yet.
  // === VIEW DATE TOGGLE ===
  // The hero (snapshot) AND the ritual card both follow ritualViewDate.
  // When the user taps ◀/▶ in the hero's top-right (or in the legacy
  // ritual pager) every "today*" derivation below resolves to the
  // viewed day. Today is the natural default; max 4 days back so the
  // pager doesn't become an open-ended history scrubber (use the
  // Journal tab for that). Future days are disabled.
  const heroViewDate = ritualViewDate || todayStr;
  const heroIsViewingToday = heroViewDate === todayStr;
  const HERO_MAX_DAYS_BACK = 4;
  const heroDaysBack = (() => {
    const a = new Date(heroViewDate + 'T00:00:00');
    const b = new Date(todayStr + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  })();
  const todaysPhotoLogs = logs.filter(l => l.date === heroViewDate && hasPhoto(l));
  const todaysFullFace = todaysPhotoLogs
    .filter(l => l.area === 'full-face')
    .sort((a, b) => (b.id || 0) - (a.id || 0));
  const todaysOtherAreas = todaysPhotoLogs.filter(l => l.area !== 'full-face');
  // Override pick only applies on today (past days lock to that day's full-face).
  const overridePick = (heroIsViewingToday && dailyCoverPick[todayStr])
    ? logs.find(l => l.id === dailyCoverPick[todayStr])
    : null;
  // Explicit pick wins. This lets a later PM upload take over the
  // Home snapshot without deleting the AM photo from the timeline.
  const todayLog = overridePick || todaysFullFace[0] || todaysPhotoLogs.sort((a, b) => (b.id || 0) - (a.id || 0))[0] || null;
  const priorPhotoLog = logs.filter(l => l.date !== todayStr && hasPhoto(l) && l.area === 'full-face').sort((a,b) => new Date(b.date) - new Date(a.date))[0]
    || logs.filter(l => l.date !== todayStr && hasPhoto(l)).sort((a,b) => new Date(b.date) - new Date(a.date))[0];

  // Recurring-concern severity over last 30 days, with 14-day sparkline trend
  const concernRows = (() => {
    const cutoff30 = Date.now() - 30 * 86400000;
    const cutoff14 = Date.now() - 14 * 86400000;
    const counts30 = {};
    logs.forEach(l => {
      if (new Date(l.date).getTime() < cutoff30) return;
      (l.concerns || []).forEach(c => { counts30[c] = (counts30[c] || 0) + 1; });
    });
    const top = Object.entries(counts30).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
    return top.map(concern => {
      // 14-day daily severity: count of logs in window with this concern, day by day
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = localDateISO(d);
        const hit = logs.find(l => l.date === key && (l.concerns || []).includes(concern));
        // severity: 0 if no log, otherwise 11 - rating (worse rating = higher severity)
        days.push(hit ? Math.max(1, 11 - (+hit.rating || 5)) : 0);
      }
      // Trend: compare first half avg vs second half avg of the 14-day window
      const firstHalf = days.slice(0, 7).reduce((a,b) => a+b, 0) / 7;
      const secondHalf = days.slice(7).reduce((a,b) => a+b, 0) / 7;
      const trendDir = secondHalf < firstHalf - 0.3 ? 'improving' : secondHalf > firstHalf + 0.3 ? 'worsening' : 'flat';
      return { concern, days, trendDir, totalIn30: counts30[concern] };
    });
  })();

  // In-rotation products with weeks-in counter
  const rotationProducts = activeProducts
    .map(p => {
      const start = p.startDate ? new Date(p.startDate) : null;
      const weeks = start ? Math.max(0, Math.floor((today - start) / (7 * 86400000))) : null;
      return { ...p, weeks };
    })
    .sort((a,b) => (b.weeks || 0) - (a.weeks || 0))
    .slice(0, 4);

  // === COVER ROUTINE BUILDER ===
  // Builds an inline AM/PM routine right on the cover, persists across sessions.
  // Note: we publish the latest closure to a ref so external triggers (modal submit,
  // new photo log) can call the build without rendering the dashboard tab.
  const buildCoverRoutine = async () => {
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    const activePs = products.filter(p => !p.endDate);
    if (activePs.length === 0) { toast('Add some products first', 'error'); return; }
    setCoverRoutineLoading(true);
    try {
      // === ASSEMBLE EVIDENCE FROM RECENT LOGS ===
      // Recent 14 days of skin logs feed the AI so the recommendation is
      // grounded in what's actually happening, not generic shelf-ordering.
      const recent14 = logs
        .filter(l => (Date.now() - new Date(l.date).getTime()) <= 14 * 86400000)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
      const recentLogSummary = recent14.length === 0
        ? 'No recent photo logs.'
        : recent14.map(l => {
            const obs = (l.aiAnalysis || l.ratingExplanation || '').toString().slice(0, 220);
            const cs = (l.concerns || []).join(', ') || '—';
            return `· ${l.date} (${l.rating}/10) concerns: ${cs}${obs ? ` | obs: ${obs}` : ''}`;
          }).join('\n');

      // Trend signals — leverage already-computed skinIndex + 7-day average direction
      const trendLines = [];
      if (skinIndex && skinIndex.hasData) {
        const fmt = (label, dir) => `${label}: ${dir}`;
        trendLines.push(`Positives — barrier ${skinIndex.positives.barrier}, calm ${skinIndex.positives.calm}, glow ${skinIndex.positives.glow}`);
        trendLines.push(`Negatives — pores ${skinIndex.negatives.pores}, breakouts ${skinIndex.negatives.breakouts}, redness ${skinIndex.negatives.redness}`);
      }
      if (recent7Avg && trend) trendLines.push(`7-day avg: ${recent7Avg} (Δ${trend})`);
      const trendSummary = trendLines.length ? trendLines.join('\n') : 'No trend data yet.';

      const productList = activePs.map(p => `· ${p.name} by ${p.brand || 'unknown'} — ${p.category} — actives: ${p.activeIngredients || 'none listed'} — concerns: ${(p.concerns || []).join(', ') || 'general'}`).join('\n');
      const concernsLine = (userConcerns || []).join(', ') || 'none specified';
      const sensLine = (sensitivities || []).join(', ') || 'none';

      // === DERMATOLOGY-GROUNDED ROUTINE PROMPT ===
      // Heavy guardrails: when the recent logs show redness/irritation/sensitivity, the
      // AI must downweight active acids/retinoids and prioritise barrier repair. When skin
      // is calm and improving, it can lean into actives. This is the difference between
      // a smart recommendation and "just put vitamin C on a flare-up".
      const prompt = `You are recommending today's AM and PM routine for a single user, choosing ONLY from their shelf below. This is a clinical decision — read the evidence first, THEN decide.

USER STATED CONCERNS: ${concernsLine}
SENSITIVITIES (must avoid these triggers): ${sensLine}

RECENT 14 DAYS OF SKIN LOGS:
${recentLogSummary}

CURRENT TREND:
${trendSummary}

SHELF (use ONLY these products):
${productList}

DECISION RULES — apply in order:
1. If recent logs show redness, irritation, stinging, broken skin, sensitivity, or ratings ≤ 5: bias toward BARRIER REPAIR. Lead with gentle cleanser, hydrating layers, ceramide/peptide moisturizer, mineral SPF. Downweight (do not entirely exclude) retinoids, vitamin C, acids, exfoliants — only include them if there's nothing else on the shelf for that step.
2. If breakouts are trending up: keep niacinamide, zinc, salicylic acid spot use, but skip stronger acids. Don't pair with retinoids same night.
3. If skin is calm and ratings ≥ 7 with no flags: lean into actives — vitamin C in AM, retinoid in PM, exfoliants 2-3x/week.
4. NEVER recommend a product that contains an ingredient in the user's sensitivities list.
5. SPF is mandatory in AM if the shelf has one. If the shelf has no sunscreen, the AM slot still includes everything else.
6. Order by derm best practice: cleanser → toner → serum (lightest first) → moisturizer → SPF (AM only). PM ends at moisturizer or treatment.

CRITICAL OUTPUT REQUIREMENTS:
- BOTH "am" and "pm" slots MUST contain at least 1 product if the shelf has any usable items. Empty slots are only acceptable when the shelf is genuinely empty.
- Return STRICT JSON only — no prose, no markdown fence, no explanation:
{
  "am": [{"product": "exact name from shelf"}],
  "pm": [{"product": "exact name from shelf"}]
}
- Each "product" must EXACTLY match a name from the shelf list.
- Max 5 products per slot.`;
      const result = await callClaude(prompt, '', null, { model: 'claude-haiku-4-5-20251001', maxTokens: 600 });
      // === MULTI-STRATEGY JSON EXTRACTION ===
      // Tolerates: code fences, leading/trailing prose, multiple {} blocks in the response.
      const stripFences = (s) => String(s || '').replace(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g, '$1').trim();
      const cleaned = stripFences(result);
      let parsed = null;
      // Strategy 1: try the largest balanced object
      try {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch (_) {}
      // Strategy 2: walk the string for balanced {} blocks and try each
      if (!parsed || (typeof parsed === 'object' && !Array.isArray(parsed.am) && !Array.isArray(parsed.pm))) {
        let depth = 0, startIdx = -1;
        for (let i = 0; i < cleaned.length; i++) {
          const c = cleaned[i];
          if (c === '{') { if (depth === 0) startIdx = i; depth++; }
          else if (c === '}') {
            depth--;
            if (depth === 0 && startIdx !== -1) {
              try {
                const obj = JSON.parse(cleaned.slice(startIdx, i + 1));
                if (obj && (Array.isArray(obj.am) || Array.isArray(obj.pm))) { parsed = obj; break; }
              } catch (_) {}
              startIdx = -1;
            }
          }
        }
      }
      if (!parsed || (!Array.isArray(parsed.am) && !Array.isArray(parsed.pm))) {
        console.warn('Cover routine — could not parse:', String(result).slice(0, 300));
        throw new Error('Bad JSON shape');
      }
      // Strip any descriptors — we only render product names now.
      const trim = (slot) => Array.isArray(slot)
        ? slot.map(it => ({ product: String(it.product || '').trim() })).filter(it => it.product)
        : [];
      const trimmed = { am: trim(parsed.am), pm: trim(parsed.pm) };
      // Don't overwrite an existing routine with an empty one — protects against
      // AI returning [] when its decision tree skips everything (barrier-repair mode
      // with no gentle products on the shelf, etc.).
      if (trimmed.am.length === 0 && trimmed.pm.length === 0) {
        if (coverRoutine && typeof coverRoutine === 'object' && (((coverRoutine.am || []).length) || ((coverRoutine.pm || []).length))) {
          toast('Kept the previous routine — AI had nothing to swap to.', 'info');
        } else {
          toast('No routine fit your skin today — try again or check your shelf.', 'info');
          setCoverRoutine(trimmed); // empty so UI shows the empty-state note
          await saveData('coverRoutine', trimmed);
        }
      } else {
        setCoverRoutine(trimmed);
        await saveData('coverRoutine', trimmed);
        toast('Routine built ✨');
      }
    } catch (e) {
      console.error(e);
      toast('Build failed', 'error');
    }
    setCoverRoutineLoading(false);
  };
  // Publish the latest closure for external triggers (modal submit, photo-log save).
  buildCoverRoutineRef.current = buildCoverRoutine;
  // Display normalization — extract only product names (descriptors dropped per UX spec).
  const parsedCoverRoutine = (() => {
    if (!coverRoutine) return null;
    const trimSlot = (arr) => Array.isArray(arr)
      ? arr.map(it => ({ product: String(it.product || '').trim() })).filter(it => it.product)
      : [];
    if (typeof coverRoutine === 'object') {
      return { am: trimSlot(coverRoutine.am), pm: trimSlot(coverRoutine.pm) };
    }
    // Legacy text fallback — parse "AM:\n1. X — y" and drop the descriptor.
    const sections = { am: [], pm: [] };
    ['AM', 'PM'].forEach(label => {
      const re = label === 'AM' ? /AM:\s*([\s\S]*?)(?=PM:|$)/ : /PM:\s*([\s\S]*)/;
      const m = coverRoutine.match(re);
      if (!m) return;
      const lines = m[1].trim().split(/\n/).map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
        const cleaned = line.replace(/^\d+\.\s*/, '');
        const dashIdx = cleaned.indexOf('—');
        const productName = (dashIdx > -1 ? cleaned.slice(0, dashIdx) : cleaned).trim();
        if (productName) sections[label.toLowerCase()].push({ product: productName });
      });
    });
    return sections;
  })();

  // === SKIN INDEX METRICS ===
  // Visual indicators replacing the For Today AI prose. Last 7 days vs prior 7.
  const skinIndex = (() => {
    // Today's index — today's log if exists, else most recent rating
    const ratingFor = todayLog || logs.sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    const score = ratingFor ? Number(ratingFor.rating) : null;
    // Compute trend per concern category — recent 7 days vs prior 7 days
    const cutoffNow = Date.now() - 7 * 86400000;
    const cutoffPrior = Date.now() - 14 * 86400000;
    const recent = logs.filter(l => new Date(l.date).getTime() >= cutoffNow);
    const prior = logs.filter(l => {
      const t = new Date(l.date).getTime();
      return t >= cutoffPrior && t < cutoffNow;
    });
    const countMatching = (logSet, regex) => logSet.filter(l => {
      const text = `${l.aiAnalysis || ''} ${l.ratingExplanation || ''} ${(l.concerns || []).join(' ')}`.toLowerCase();
      return regex.test(text);
    }).length;
    // For positives: up arrow = improving. For negatives: up arrow = worsening (more flags).
    const posDir = (rCount, pCount) => {
      if (recent.length === 0 || prior.length === 0) return 'flat';
      const diff = rCount - pCount;
      if (Math.abs(diff) < 1) return 'flat';
      // For "barrier strength", "calm", "glow" — fewer negative flags = up.
      return diff < 0 ? 'up' : 'down';
    };
    const negDir = (rCount, pCount) => {
      if (recent.length === 0 || prior.length === 0) return 'flat';
      const diff = rCount - pCount;
      if (Math.abs(diff) < 1) return 'flat';
      // For pores / breakouts / redness — more flags = up (worsening).
      return diff > 0 ? 'up' : 'down';
    };
    // POSITIVES (up = improving)
    const barrierR = countMatching(recent, /(redness|inflam|sensit|dry|flak|tight|sting)/);
    const barrierP = countMatching(prior, /(redness|inflam|sensit|dry|flak|tight|sting)/);
    const barrier = posDir(barrierR, barrierP);
    const calmR = countMatching(recent, /(inflam|irritat|stinging|burning|reactive)/);
    const calmP = countMatching(prior, /(inflam|irritat|stinging|burning|reactive)/);
    const calm = posDir(calmR, calmP);
    // GLOW: higher avg rating dominates; fall back to positive keywords
    const ratingDir = (() => {
      if (recent.length === 0 || prior.length === 0) return 'flat';
      const ra = recent.reduce((s, l) => s + Number(l.rating || 0), 0) / recent.length;
      const pa = prior.reduce((s, l) => s + Number(l.rating || 0), 0) / prior.length;
      const d = ra - pa;
      return Math.abs(d) < 0.3 ? 'flat' : (d > 0 ? 'up' : 'down');
    })();
    const glowR = countMatching(recent, /(glow|bright|clear|smooth|hydrate|even|radian|luminou|dewy)/);
    const glowP = countMatching(prior, /(glow|bright|clear|smooth|hydrate|even|radian|luminou|dewy)/);
    // For glow, MORE positive keywords = up (improving) — invert posDir intent
    const glowKwDir = (() => {
      if (recent.length === 0 || prior.length === 0) return 'flat';
      const diff = glowR - glowP;
      if (Math.abs(diff) < 1) return 'flat';
      return diff > 0 ? 'up' : 'down';
    })();
    const glow = ratingDir !== 'flat' ? ratingDir : glowKwDir;

    // NEGATIVES (up = worsening)
    const poresR = countMatching(recent, /(pore|enlarged|congest|texture|bumpy|rough)/);
    const poresP = countMatching(prior, /(pore|enlarged|congest|texture|bumpy|rough)/);
    const pores = negDir(poresR, poresP);
    const breakoutsR = countMatching(recent, /(breakout|blemish|acne|pimple|cyst|whitehead|blackhead|pustule|papule)/);
    const breakoutsP = countMatching(prior, /(breakout|blemish|acne|pimple|cyst|whitehead|blackhead|pustule|papule)/);
    const breakouts = negDir(breakoutsR, breakoutsP);
    const rednessR = countMatching(recent, /(redness|red|flush|rosacea|erythema)/);
    const rednessP = countMatching(prior, /(redness|red|flush|rosacea|erythema)/);
    const redness = negDir(rednessR, rednessP);

    return {
      score,
      positives: { barrier, calm, glow },
      negatives: { pores, breakouts, redness },
      hasData: recent.length > 0 || prior.length > 0
    };
  })();
  const arrowFor = (dir) => dir === 'up' ? '↑' : dir === 'down' ? '↓' : '';
  // For positives: up = sage (good), down = rose (bad). For negatives: up = rose (bad), down = sage (good).
  const colorForPos = (dir) => dir === 'up' ? 'var(--sage)' : dir === 'down' ? 'var(--rose)' : 'var(--ink-soft)';
  const colorForNeg = (dir) => dir === 'up' ? 'var(--rose)' : dir === 'down' ? 'var(--sage)' : 'var(--ink-soft)';

  // Procedures — most recent (past) and next upcoming (if scheduled in future).
  // Reads live from `procedures` state, so any edit in Procedures tab reflects here immediately.
  const sortedProcs = [...procedures].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentProc = sortedProcs.find(p => new Date(p.date) <= today);
  const upcomingProc = sortedProcs.filter(p => new Date(p.date) > today).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const procLine = (() => {
    if (upcomingProc) {
      const days = Math.ceil((new Date(upcomingProc.date) - today) / 86400000);
      return { name: upcomingProc.name, label: `in ${days} ${days === 1 ? 'day' : 'days'}`, accent: true };
    }
    if (recentProc) {
      const daysAgo = Math.floor((today - new Date(recentProc.date)) / 86400000);
      return { name: recentProc.name, label: daysAgo === 0 ? 'today' : `${daysAgo}d ago`, accent: false };
    }
    return null;
  })();

  // Cycle line (only when relevant)
  const cycleLine = (() => {
    if (hormonalContext !== 'cycling') return null;
    if (!cycleData?.periods?.length) return null;
    const last = cycleData.periods.sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    const cycleLen = cycleData.cycleLength || 28;
    const dayOfCycle = Math.floor((today - new Date(last.date)) / 86400000) + 1;
    if (dayOfCycle < 1 || dayOfCycle > cycleLen + 7) return null;
    const phase =
      dayOfCycle <= 5 ? 'Menstrual · barrier sensitive' :
      dayOfCycle <= 13 ? 'Follicular · stronger actives tolerated' :
      dayOfCycle <= 16 ? 'Ovulatory · peak skin' :
      dayOfCycle <= 22 ? 'Early luteal · sebum rising' :
      'Late luteal · premenstrual breakouts approaching';
    return `Cycle · day ${dayOfCycle} · ${phase}`;
  })();

  // Tiny inline sparkline as SVG
  const Sparkline = ({ days, trendDir }) => {
    const max = Math.max(1, ...days);
    const w = 56, h = 14;
    const step = w / (days.length - 1);
    const pts = days.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ');
    const stroke = trendDir === 'improving' ? 'var(--sage)' : trendDir === 'worsening' ? 'var(--rose)' : 'var(--ink-soft)';
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
        <polyline fill="none" stroke={stroke} strokeWidth="1.25" points={pts} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // === ADAPTIVE HOME — EMPTY / PARTIAL STATE (May 2026) ===
  // Derives the user's completion state and returns a focused
  // empty-state Home for users who haven't built up enough data
  // yet. Skips the heavy skin-snapshot + today's routine + weekly
  // rotation surfaces (which all show their own empty states)
  // and replaces them with: value-prop card, sample routine,
  // explore routines, étude insight. Returning users with a
  // built routine fall through to the standard dashboard below.
  const completionInfo = getUserCompletionState({
    products, logs, regimenLogs, userProfile, userConcerns, onboardingState,
  });
  const isExploring = completionInfo.state === 'exploring';
  const isPartialProfile = completionInfo.state === 'partial_profile';
  // Photo-having users always fall through to the normal Home so
  // their skin snapshot + auto-generated metric columns render.
  // The empty-state oval only shows when there's literally nothing
  // logged yet AND no questionnaire data.
  if ((isExploring || isPartialProfile) && !completionInfo.hasPhotoCheckIn) {
    // === HYDRATION GRACE GUARD ===
    // During the 300ms hydration window, suppress the fresh-user
    // empty cover entirely. If the user actually has data, it lands
    // before the grace expires and the populated cover renders below.
    // If they're truly fresh, the empty cover appears after the grace.
    if (!coverHydrated) {
      return <div className="pb-6" style={{minHeight: '60vh'}} />;
    }
    const firstName = (user?.name || '').split(' ')[0];
    const hasName = !!firstName && firstName.toLowerCase() !== 'friend';
    return (
      <div className="space-y-3 md:space-y-4 md:max-w-2xl md:mx-auto pb-6 px-4 md:px-6">
        {/* === GREETING (no name for fully empty users) === */}
        <section>
          <h1 className="font-serif italic text-[28px] md:text-[36px] leading-[1.05] tracking-tight" style={{color:'var(--ink)'}}>
            {greeting}{hasName ? `, ${firstName}` : '.'}
            <span className="ml-1.5 inline-block align-middle" style={{color:'var(--sage)', fontSize:'0.65em', verticalAlign:'middle'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{display:'inline-block'}} xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21 L12 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M12 11 C7 9, 6 5, 8 3 C11 4, 13 7, 12 11 Z" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="0.8"/>
                <path d="M12 14 C16 12, 17 9, 16 6 C13 7, 11 10, 12 14 Z" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="0.8"/>
              </svg>
            </span>
          </h1>
          <div className="text-[10px] tracking-[0.32em] uppercase mt-1.5" style={{color:'var(--ink-soft)'}}>
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </div>
        </section>

        {/* === SKIN CHECK-IN CARD — Codex spec, mockup-matched ===
            Horizontal layout: oval LEFT (~320px tall, vertically
            centered), content RIGHT (eyebrow + headline + body + CTAs).
            Stacks single-column under md (768px). */}
        {/* === SKIN CHECK-IN CARD — clickable oval, no big CTA buttons ===
            The OVAL is the primary tap-target (opens camera).
            Small upload icon sits at lower-right of the oval for
            the secondary "upload existing photo" path. Right
            column is just headline + body + sample routines link
            so it stays editorial / quiet — the oval is the only
            action surface. */}
        {/* === SKIN CHECK-IN CARD — stable 2-col on mobile (May 2026 fix) ===
            Previous version used `grid-cols-1 md:grid-cols-[...]` which
            stacked oval-above-text on mobile and made the oval
            dominate the entire viewport. The desktop arrangement
            (oval left / text right / upload pill overlapping the
            oval bottom) is the intended composition at EVERY width
            — mobile just gets scaled-down proportions, not a
            different layout. Spec from Jenni:
              - left 44% / right 56% on mobile
              - oval clamp(132px, 38vw, 220px), aspect 0.72/1
              - card padding tighter (px-4) on mobile
              - title 28px mobile / 26px desktop, 2-3 lines max
              - upload pill remains overlapping the oval bottom */}
        <section className="rounded-[18px] px-4 py-4 md:px-7 md:py-6" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
          {/* === EMPTY-STATE GRID (May 2026 v2 per Jenni) ===
              Was: 0.44 / 0.56 with a 132–200px tall oval — title
              "Your skin story starts here." wrapped into 5 narrow
              lines on mobile. Now: 0.32 / 0.68 with a square 108–132px
              circle. Frees ~50px for the text column so the title
              fits in 2 lines like the populated cover. */}
          <div
            className="grid items-center gap-3 md:gap-8"
            style={{gridTemplateColumns: 'minmax(108px, 0.32fr) minmax(0, 0.68fr)'}}
          >
            <div className="flex justify-start">
              <div className="relative" style={{width: 'clamp(108px, 28vw, 132px)', paddingBottom: 18}}>
                <button
                  type="button"
                  onClick={() => setShowCheckInCamera(true)}
                  className="flex flex-col items-center justify-center transition hover:brightness-[0.97]"
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    background: 'radial-gradient(ellipse at 40% 35%, rgba(192,95,60,0.12), rgba(192,95,60,0.03))',
                    border: '1.5px dashed rgba(192,95,60,0.42)',
                    padding: '0 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Take a skin check-in"
                  title="Tap to take your first skin check-in"
                >
                  <Icon name="Camera" size={20} style={{color:'var(--accent)'}} />
                  <div style={{fontSize: 10, marginTop: 5, lineHeight: 1.3, color:'var(--ink)', fontWeight: 600, whiteSpace:'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase'}}>Tap to begin</div>
                </button>
                {/* Upload pill — overlaps the oval bottom on every viewport.
                    May 2026: opens the 3-path picker instead of the direct
                    file input. Users now choose between guided capture,
                    today-only upload, and bulk history import. */}
                <button
                  type="button"
                  onClick={() => setShowHomeUploadPicker(true)}
                  className="absolute inline-flex items-center transition hover:bg-[var(--cream-deep)]"
                  style={{
                    left: '50%',
                    bottom: 0,
                    transform: 'translateX(-50%)',
                    height: 30,
                    gap: 5,
                    padding: '0 11px',
                    borderRadius: 999,
                    background: 'var(--cream)',
                    border: '1px solid var(--line)',
                    boxShadow: '0 2px 6px rgba(28,25,23,0.08)',
                    color: 'var(--ink)',
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  aria-label="Upload photos from library"
                  title="Upload one or more existing photos to backfill your timeline"
                >
                  <Icon name="Upload" size={10} style={{color:'var(--ink-soft)'}} />
                  <span>Upload photos</span>
                </button>
              </div>
            </div>
            {/* RIGHT: eyebrow + headline + body + sample-routines link.
                Title responsive via Tailwind text-[..] / md:text-[..]
                — explicit two sizes rather than clamp() so mobile
                and desktop are independently tuneable. Removed the
                <br/> so the title wraps naturally to 2-3 lines in
                the narrower mobile column without weird splits.
                min-w-0 lets the column actually shrink inside the
                grid (without this, long words push the column
                wider than its 56% share). */}
            <div className="min-w-0">
              <div style={{fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 6}}>Skin Check-In</div>
              <h2
                className="text-[24px] md:text-[26px]"
                style={{lineHeight: 1.05, letterSpacing: '-0.022em', fontWeight: 700, color: 'var(--ink)', marginBottom: 8}}
              >Your skin story starts here.</h2>
              <p style={{fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-soft)', marginBottom: 12, maxWidth: 340}}>A quick check-in helps Étude personalize your routine.</p>
              <button
                type="button"
                onClick={() => setSampleRoutinePreview(FOUNDATIONAL_SAMPLE_ROUTINE)}
                className="inline-flex items-center transition hover:opacity-70"
                style={{
                  gap: 5, padding: '4px 0',
                  background: 'transparent', color: 'var(--accent)',
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.16em',
                  textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'normal',
                }}
              >
                <span>Explore sample routines</span>
                <Icon name="ArrowRight" size={10} />
              </button>
            </div>
          </div>
        </section>

        {/* === WHERE TO START + A SIMPLE START — 2-col side-by-side === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
          {/* === WHERE TO START — three-step progress card with INDIVIDUAL CTAs ===
              Replaces the static "Why Étude" card. Each step has its
              own button and completion state derived from
              completionInfo. As the user finishes a step, ✓ replaces
              the number and the next step gains the terracotta
              "current" focus. Motivates completion via visible
              progress without feeling like a setup wizard. */}
          {(() => {
            const steps = [
              {
                n: 1,
                done: !!completionInfo.hasPhotoCheckIn,
                title: 'Check in',
                sub: 'Snap your first photo. We start reading from day one.',
                icon: 'Camera',
                ctaLabel: 'Open camera',
                onClick: () => setShowCheckInCamera(true),
              },
              {
                n: 2,
                done: !!completionInfo.hasShelfProducts,
                title: 'Build your shelf',
                sub: "Add what you're already using.",
                icon: 'Layers',
                ctaLabel: 'Add product',
                onClick: () => { setEditingProductId(null); setProductForm(null); setShowProductModal(true); },
              },
              {
                n: 3,
                done: !!completionInfo.hasGeneratedRoutine,
                title: 'Generate routine',
                sub: "We'll lay out your AM and PM.",
                icon: 'Sparkles',
                ctaLabel: 'Build my week',
                onClick: () => { setActiveTab('regimen'); setRegimenView('build'); },
              },
            ];
            // Current step = first not-done step. Used to highlight
            // which CTA reads as the "next move" the user should make.
            const currentStepIdx = steps.findIndex(s => !s.done);
            return (
              <section className="rounded-[14px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
                <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color:'var(--accent)', marginBottom: 6}}>Where to start</div>
                <h3 style={{fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.018em', fontWeight: 700, color:'var(--ink)', marginBottom: 14}}>Three moves to make today.</h3>
                <div className="space-y-3">
                  {steps.map((s, i) => {
                    const isCurrent = i === currentStepIdx;
                    return (
                      <div
                        key={s.n}
                        className="flex items-start gap-3"
                      >
                        <span
                          className="flex-shrink-0 flex items-center justify-center"
                          style={{
                            width: 24, height: 24,
                            borderRadius: '50%',
                            // Done = filled. Current = strong tint. Future = soft tint
                            // (not pure gray) so the step still reads as actionable.
                            background: s.done
                              ? 'var(--accent)'
                              : 'rgba(192,95,60,0.10)',
                            border: s.done
                              ? '1px solid var(--accent)'
                              : '1px solid rgba(192,95,60,0.22)',
                            color: s.done ? 'var(--cream)' : 'var(--accent)',
                            fontSize: 11,
                            fontWeight: 700,
                            marginTop: 2,
                          }}
                        >
                          {s.done ? <Icon name="Check" size={13} /> : s.n}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div style={{fontSize: 13, lineHeight: 1.2, color:'var(--ink)', fontWeight: 600, letterSpacing:'-0.008em'}}>{s.title}</div>
                            {s.done && (
                              <span style={{fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color:'var(--ink-soft)', fontWeight: 600}}>Done</span>
                            )}
                          </div>
                          <div style={{fontSize: 12, marginTop: 2, lineHeight: 1.4, marginBottom: 6, color:'var(--ink-soft)'}}>{s.sub}</div>
                          {!s.done && (
                            <button
                              type="button"
                              onClick={s.onClick}
                              className="inline-flex items-center transition hover:opacity-80"
                              style={{
                                gap: 6,
                                // All non-done CTAs read as terracotta links so steps 2/3 don't look inactive.
                                color: 'var(--accent)',
                                fontWeight: 600,
                                fontSize: 10,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                              }}
                            >
                              <span>{s.ctaLabel}</span>
                              <Icon name="ArrowRight" size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}
          {/* A SIMPLE START — sample routine preview (compact) */}
          <section className="rounded-[14px] px-5 py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
            <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color:'var(--ink-soft)', marginBottom: 6}}>A Simple Start</div>
            <h3 style={{fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.018em', fontWeight: 700, color:'var(--ink)', marginBottom: 4}}>A sample routine.</h3>
            <p style={{fontSize: 12.5, lineHeight: 1.4, color:'var(--ink-soft)', marginBottom: 14}}>You can personalize anytime.</p>
            <div className="rounded-[10px] px-3.5 py-3.5 mb-3" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1px 1fr', columnGap:12}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, color:'var(--accent)', marginBottom: 8}}>AM</div>
                  {FOUNDATIONAL_SAMPLE_ROUTINE.am.map((p, i) => (
                    <div key={i} style={{marginBottom: 7}}>
                      <div style={{fontSize: 12, color:'var(--ink)', fontWeight: 600, lineHeight: 1.2}}>{p.name}</div>
                      <div style={{fontSize: 10.5, color:'var(--ink-soft)', lineHeight: 1.3, marginTop: 1}}>{p.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:'var(--line)', alignSelf:'stretch'}} />
                <div style={{minWidth:0}}>
                  <div style={{fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, color:'var(--ink-soft)', marginBottom: 8}}>PM</div>
                  {FOUNDATIONAL_SAMPLE_ROUTINE.pm.map((p, i) => (
                    <div key={i} style={{marginBottom: 7}}>
                      <div style={{fontSize: 12, color:'var(--ink)', fontWeight: 600, lineHeight: 1.2}}>{p.name}</div>
                      <div style={{fontSize: 10.5, color:'var(--ink-soft)', lineHeight: 1.3, marginTop: 1}}>{p.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSampleRoutinePreview(FOUNDATIONAL_SAMPLE_ROUTINE)}
              className="w-full transition hover:opacity-90 text-center"
              style={{
                height: 38, borderRadius: 999,
                background:'rgba(192,95,60,0.06)',
                color:'var(--accent)',
                border:'1px solid rgba(192,95,60,0.16)',
                fontWeight: 600, fontSize: 10.5,
                letterSpacing:'0.14em',
                cursor:'pointer', textTransform:'uppercase',
                whiteSpace: 'nowrap',
              }}
            >View full example routine</button>
          </section>
        </div>

        {/* === EXPLORE SAMPLE ROUTINES — stable 3-col row at every width (May 2026) ===
            Previous version was `grid-cols-1 sm:grid-cols-3` which
            stacked the three cards into huge full-width tiles on
            mobile. Per Jenni: a horizontal row at every viewport.
            Tightened padding + sizes so the cards fit in iPhone
            390px width (each card ≈ 110px wide after page padding
            and gaps). Desktop loses some breathing room compared
            to before — acceptable trade for mobile correctness. */}
        <section>
          <div className="mb-2.5">
            <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color:'var(--ink-soft)'}}>Explore Sample Routines</div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {SAMPLE_ROUTINES.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSampleRoutinePreview(r)}
                className="text-left transition hover:bg-[var(--cream-deep)] p-[10px] md:p-[14px]"
                style={{
                  background:'var(--cream-deep)',
                  border:'1px solid var(--line)',
                  borderRadius: 12,
                  cursor:'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <span className="inline-flex items-center justify-center" style={{width: 26, height: 26, borderRadius: '50%', background:'rgba(192,95,60,0.08)', border:'1px solid rgba(192,95,60,0.16)', flexShrink: 0}}>
                  <Icon name={r.icon} size={12} style={{color:'var(--accent)'}} />
                </span>
                <div className="text-[11.5px] md:text-[13px]" style={{color:'var(--ink)', fontWeight: 600, letterSpacing:'-0.008em', lineHeight: 1.2}}>{r.label}</div>
                <div className="text-[10px] md:text-[11.5px]" style={{lineHeight: 1.3, color:'var(--ink-soft)'}}>{r.blurb}</div>
              </button>
            ))}
          </div>
        </section>

        {/* === ÉTUDE INSIGHT === quiet */}
        <section
          className="rounded-[14px] px-5 py-5"
          style={{
            background: 'linear-gradient(135deg, rgba(192,95,60,0.08) 0%, rgba(192,95,60,0.02) 100%)',
            border: '1px solid rgba(192,95,60,0.16)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} />
            <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color:'var(--accent)'}}>Étude Insight</div>
          </div>
          <h3 style={{fontSize: 18, lineHeight: 1.15, letterSpacing: '-0.018em', fontWeight: 700, color:'var(--ink)', marginBottom: 6}}>Consistency is good.<br/>Smart consistency is better.</h3>
          <p style={{fontSize: 12.5, lineHeight: 1.45, color:'var(--ink-soft)'}}>Small, intentional choices compound into healthier skin over time.</p>
        </section>

        {/* === PARTIAL PROFILE — extra invite to add products === */}
        {isPartialProfile && (
          <section className="rounded-[14px] px-5 py-4 flex items-center gap-3" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
            <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
              <Icon name="Plus" size={13} style={{color:'var(--ink-soft)'}} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Add products to personalize</div>
              <div className="text-[11px] mt-0.5 leading-snug" style={{color:'var(--ink-soft)'}}>The sample routine above tightens as your shelf fills in.</div>
            </div>
            <button
              type="button"
              onClick={() => { setEditingProductId(null); setProductForm(null); setShowProductModal(true); }}
              className="flex-shrink-0 rounded-full py-1.5 px-3 transition hover:opacity-90"
              style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:10, letterSpacing:'0.12em', cursor:'pointer', textTransform:'uppercase'}}
            >Add</button>
          </section>
        )}

        {/* === FOOTER MICRO-COPY === */}
        <p className="text-[10px] text-center leading-snug pt-2" style={{color:'var(--ink-soft)'}}>
          You're in control. Add your products, edit your routine, and learn as you go.
        </p>
      </div>
    );
  }

  return (
    // Keep Home in a phone-like reading column on desktop. The app is
    // designed around mobile proportions, so the cover should not expand
    // into a wide desktop composition.
    <div className="space-y-3 md:space-y-4 md:max-w-[430px] md:mx-auto pb-6">
      {/* === GREETING === editorial serif italic with a sage botanical accent.
           Date sits below as a small uppercase eyebrow. */}
      <section>
        <h1 className="font-serif italic text-[28px] md:text-[36px] leading-[1.05] tracking-tight" style={{color:'var(--ink)'}}>
          {greeting}, {(user?.name || 'friend').split(' ')[0]}
          <span className="ml-1.5 inline-block align-middle" style={{color:'var(--sage)', fontSize:'0.65em', verticalAlign:'middle'}}>
            {/* Small botanical sprig SVG to match the mockup's leaf accent. */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{display:'inline-block'}} xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21 L12 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M12 11 C7 9, 6 5, 8 3 C11 4, 13 7, 12 11 Z" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="0.8"/>
              <path d="M12 14 C16 12, 17 9, 16 6 C13 7, 11 10, 12 14 Z" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="0.8"/>
            </svg>
          </span>
        </h1>
        <div className="text-[10px] tracking-[0.32em] uppercase mt-1.5" style={{color:'var(--ink-soft)'}}>
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
        </div>
      </section>

      {/* === SKIN SNAPSHOT CARD === */}
      {(() => {
      // Wave 8.3 fix: re-derive locals that used to live in HomeDashboard's
      // outer scope. Each is computable from props the child already has.
      const today = new Date();
      const heroViewDate = ritualViewDate || todayStr;
      const heroIsViewingToday = heroViewDate === todayStr;
      const HERO_MAX_DAYS_BACK = 4;
      const heroDaysBack = (() => {
        const a = new Date(heroViewDate + 'T00:00:00');
        const b = new Date(todayStr + 'T00:00:00');
        return Math.round((b - a) / 86400000);
      })();
      const hasPhoto = (l) => l && (l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:')));
      const photoLogs = logs.filter(hasPhoto);
      const hasPhotoHistory = photoLogs.length > 0;
      const canComparePhotos = photoLogs.length >= 2;
      const todaysPhotoLogs = logs.filter(l => l.date === heroViewDate && hasPhoto(l));
      const todaysFullFace = todaysPhotoLogs
        .filter(l => l.area === 'full-face')
        .sort((a, b) => (b.id || 0) - (a.id || 0));
      const overridePick = (heroIsViewingToday && dailyCoverPick && dailyCoverPick[todayStr])
        ? logs.find(l => l.id === dailyCoverPick[todayStr])
        : null;
      const todayLog = overridePick || todaysFullFace[0] || todaysPhotoLogs.sort((a, b) => (b.id || 0) - (a.id || 0))[0] || null;
      const hasTodayPhoto = hasPhoto(todayLog);
      // Metric quartet — shows AI-rated level word + arrow + % change vs the
      // most recent prior log with a snapshot. Score map normalizes each metric
      // to a 0-100 scale where higher = better outcome (cleaner skin, plumper
      // hydration, smoother texture, fewer breakouts). Two metric kinds:
      //   - pos (hydration, texture): higher score → MORE of a good thing → ↑ arrow + green
      //   - neg (redness, breakouts): higher score → LESS of a bad thing → ↓ arrow + green
      // Color is always green for improvement, rose for worsening, ink-soft for flat.
      const SCORE_MAP = {
        redness:    { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
        hydration:  { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
        texture:    { Smooth: 100, Even: 80, Uneven: 55, Rough: 30, Bumpy: 10 },
        breakouts:  { Clear: 100, Few: 75, Some: 50, Many: 25, Severe: 10 },
        barrier:    { Strong: 100, Steady: 80, Holding: 55, Compromised: 30, Stripped: 10 },
        sensitivity:{ Calm: 100, Settled: 80, Tender: 55, Reactive: 30, Inflamed: 10 },
      };
      const titleCase = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : null;
      const normalizeWord = (key, raw) => {
        if (!raw) return null;
        const tc = titleCase(String(raw).trim());
        return SCORE_MAP[key] && tc in SCORE_MAP[key] ? tc : null;
      };
      const todaySnap = todayLog?.metricSnapshot || null;
      // todayAvg = composite 0-100 across ALL SIX metrics.
      // Must match what the Skin Read drawer computes so the cover
      // readout and the drawer's hero score show the SAME number.
      // (Earlier mismatch: cover used 4 metrics → 7.9, drawer used 6
      // → 8.5. Standardized on 6 here since we now score Barrier +
      // Sensitivity independently.)
      const todayAvg = todaySnap ? (() => {
        const vals = ['redness','hydration','texture','breakouts','barrier','sensitivity']
          .map(k => SCORE_MAP[k]?.[titleCase(todaySnap[k])])
          .filter(v => typeof v === 'number');
        return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      })() : null;
      // Find the most recent prior log (different date) that has a snapshot.
      const priorLogWithSnap = logs
        .filter(l => l.id !== todayLog?.id && l.metricSnapshot && l.date !== todayStr)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const priorSnap = priorLogWithSnap?.metricSnapshot || null;
      const metricFor = (key, kind) => {
        const word = normalizeWord(key, todaySnap?.[key]);
        if (!word) return { label: key, level: null, dir: null, pct: null, color: 'var(--ink-soft)' };
        const priorWord = normalizeWord(key, priorSnap?.[key]);
        const score = SCORE_MAP[key][word];
        const priorScore = priorWord ? SCORE_MAP[key][priorWord] : null;
        // Compute % change in score; pct is only meaningful with a prior log.
        let pct = null;
        let dir = null;
        let color = 'var(--ink-soft)';
        if (priorScore != null && priorScore !== score) {
          const rawDelta = ((score - priorScore) / priorScore) * 100;
          const absPct = Math.min(99, Math.round(Math.abs(rawDelta)));
          pct = absPct;
          const improving = score > priorScore; // higher score = always good
          // Arrow direction: matches the actual METRIC direction the user feels.
          // pos metrics: improvement = more = ↑. neg metrics: improvement = less = ↓.
          if (improving) {
            dir = kind === 'pos' ? 'up' : 'down';
            color = 'var(--sage)';
          } else {
            dir = kind === 'pos' ? 'down' : 'up';
            color = 'var(--rose)';
          }
        }
        return { label: key, level: word, dir, pct, color };
      };
      const metricSpec = [
        { ...metricFor('redness',   'neg'), label: 'Redness' },
        { ...metricFor('hydration', 'pos'), label: 'Hydration' },
        { ...metricFor('texture',   'pos'), label: 'Texture' },
        { ...metricFor('breakouts', 'neg'), label: 'Breakouts' },
      ];
      // Profile completeness — counts the meaningful fields the
      // user has filled. Threshold of 3 keeps the prompt visible
      // until they've actually taken the wizard seriously, not just
      // tapped one chip.
      const profileFieldCount = [
        userProfile.sunReactivity,
        userProfile.fitzpatrick,
        userProfile.monkSkinTone,
        userProfile.skinType,
        userProfile.ageBand,
        userProfile.barrierScale,
        (userProfile.primaryConcerns || []).length > 0,
        (userProfile.skinModifiers || []).length > 0,
        (userProfile.diagnosedConditions || []).length > 0,
        (userProfile.currentRx || []).length > 0,
        (userProfile.goals || []).length > 0,
        hormonalContext,
      ].filter(Boolean).length;
      const profileIncomplete = profileFieldCount < 3;
      // === DAY LABEL for the hero pager ===
      const heroYesterdayKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDateISO(d); })();
      const heroDateShort = new Date(heroViewDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const heroDayLabel = heroIsViewingToday
        ? 'Today'
        : heroViewDate === heroYesterdayKey
          ? 'Yesterday'
          : heroDateShort;
      const shiftHeroDay = (deltaDays) => {
        const d = new Date(heroViewDate + 'T00:00:00');
        d.setDate(d.getDate() + deltaDays);
        const next = localDateISO(d);
        if (next > todayStr) return;          // no future
        // Cap at HERO_MAX_DAYS_BACK days back from today.
        const backDays = Math.round((new Date(todayStr + 'T00:00:00') - new Date(next + 'T00:00:00')) / 86400000);
        if (backDays > HERO_MAX_DAYS_BACK) return;
        setRitualViewDate(next);
      };
      // === LOGGING STREAK ===
      // Count consecutive days (going back from today) where the user
      // has any kind of log — a skin photo OR a regimen entry. Both
      // signal "I showed up." Used in the streak ribbon under the
      // greeting to acknowledge consistency without gamification.
      const computeStreak = () => {
        const dateHasActivity = new Set();
        (logs || []).forEach(l => l.date && dateHasActivity.add(l.date));
        (regimenLogs || []).forEach(r => r.date && dateHasActivity.add(r.date));
        let streak = 0;
        const d = new Date(todayStr + 'T00:00:00');
        while (true) {
          const key = localDateISO(d);
          if (dateHasActivity.has(key)) {
            streak += 1;
            d.setDate(d.getDate() - 1);
          } else break;
          if (streak > 365) break; // safety cap
        }
        return streak;
      };
      const loggingStreak = computeStreak();
      // === SINCE-LAST-READING DELTAS ===
      // Pulls the metrics that actually shifted relative to the
      // previous logged reading (priorSnap), sorts by magnitude,
      // and surfaces the top 2 as small chips. Empty array means
      // no prior reading exists yet OR nothing meaningful changed
      // (the band hides gracefully in that case). This is the
      // "teach + recognize change" passive surface.
      const deltaChips = (() => {
        if (!priorSnap || !todaySnap) return [];
        // metricSpec already carries dir/pct/color from metricFor.
        // Re-derive prior level word for the "X → Y" copy.
        return metricSpec
          .filter(m => m.dir && m.level) // had a change AND have a current level
          .map(m => {
            const priorWord = normalizeWord(m.label.toLowerCase(), priorSnap?.[m.label.toLowerCase()]);
            const improved = m.color === 'var(--sage)';
            return {
              label: m.label,
              from: priorWord || '—',
              to: m.level,
              dir: m.dir,           // 'up' | 'down'
              improved,             // true = sage, false = rose
              pct: m.pct || 0,
            };
          })
          .sort((a, b) => (b.pct || 0) - (a.pct || 0))
          .slice(0, 2); // keep Home calm: max 2 deltas on the cover
      })();
      const currentSummary = (() => {
        if (!todaySnap) return null;
        const bits = metricSpec
          .filter(m => m.level)
          .map(m => {
            const level = (m.level || '').toLowerCase();
            if (m.label === 'Redness') return `${level} redness`;
            if (m.label === 'Hydration') return `${level} hydration`;
            if (m.label === 'Texture') return `${level} texture`;
            if (m.label === 'Breakouts') return level === 'clear' ? 'clear skin' : `${level} breakouts`;
            return null;
          })
          .filter(Boolean);
        return bits.slice(0, 3).join(' · ');
      })();
      const analysisSeenKey = todayLog?.id && todayLog?.aiAnalysis
        ? `etude:analysis-seen:${todayLog.id}:${String(todayLog.aiAnalysis).length}`
        : null;
      const analysisHasBeenOpened = (() => {
        if (!analysisSeenKey) return false;
        try { return localStorage.getItem(analysisSeenKey) === '1'; } catch (_) { return false; }
      })();
      const analysisIsFresh = hasTodayPhoto && heroIsViewingToday && !!todayLog?.aiAnalysis && !analysisHasBeenOpened;
      const openTodayAnalysis = () => {
        if (todayLog?.id == null) return;
        if (!todayLog.aiAnalysis && !todayLog.analyzing && getApiKey()) {
          retryLogAnalysis(todayLog.id);
        }
        if (analysisSeenKey) {
          try { localStorage.setItem(analysisSeenKey, '1'); } catch (_) {}
        }
        setSkinReadDrawerLogId(todayLog.id);
      };
      return (
        <section className="atelier-card px-5 py-5 md:px-6 md:py-5">
          {/* === STREAK RIBBON ===
              Tiny line above the eyebrow row acknowledging
              consecutive days the user has shown up (photo or
              regimen entry). Quiet Figtree 500, ink-soft.
              Hides at 0 (nothing to celebrate) and 1 (single
              day isn't a streak). Tang & Gainey voice: dry,
              observational, never congratulatory. */}
          {loggingStreak >= 2 && (
            <div className="mb-2.5 text-[10px] tracking-[0.04em]" style={{color:'var(--ink-soft)', fontWeight:500}}>
              {loggingStreak} days in a row · {loggingStreak >= 7 ? 'this is the consistency' : 'showing up'}
            </div>
          )}
          {/* Eyebrow row: SKIN SNAPSHOT on left, date pager on right.
              Pager is enabled within HERO_MAX_DAYS_BACK days of today
              and disabled at the bounds. Tapping the label resets to
              today when on a past day.
              NOTE (May 2026): tried a fully centered Wes Anderson
              bilateral version and it read as too symmetric/sterile.
              Reverted to the original asymmetric editorial layout. */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>Skin Snapshot</div>
            <div className="date-pager">
              <button
                type="button"
                onClick={() => shiftHeroDay(-1)}
                disabled={heroDaysBack >= HERO_MAX_DAYS_BACK}
                aria-label="Previous day"
                title="Previous day"
              >
                <Icon name="ChevronLeft" size={13} />
              </button>
              <button
                type="button"
                onClick={() => !heroIsViewingToday && setRitualViewDate(todayStr)}
                style={{
                  color: heroIsViewingToday ? 'var(--accent)' : 'var(--ink)',
                  padding: '0 6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  textTransform: 'none',
                  width: 'auto',
                  minWidth: '56px',
                }}
                title={heroIsViewingToday ? 'Today' : 'Jump back to today'}
              >
                {heroDayLabel}
              </button>
              <button
                type="button"
                onClick={() => shiftHeroDay(1)}
                disabled={heroIsViewingToday}
                aria-label="Next day"
                title="Next day"
              >
                <Icon name="ChevronRight" size={13} />
              </button>
            </div>
          </div>
          {/* === Photo on left, text column on right (original layout) === */}
          <div className="flex items-start gap-4">
            <div
              className="relative flex-shrink-0"
              style={{
                // === EMPTY-STATE LAYOUT FIX (May 2026 v2 per Jenni) ===
                // Empty state was using the same oval dimensions as the
                // populated photo (132–166w × 166–210h). With the long
                // empty-state title "Your skin story starts here." the
                // text column shrank to ~130px and broke onto 5 narrow
                // lines. Empty state now uses a square ~120px circle
                // so the text column gets ~50px more width and the
                // title fits in 2 lines. Populated stays at the wider
                // oval since the face photo + score chip need the room.
                width: hasTodayPhoto ? 'clamp(132px, 34vw, 166px)' : 'clamp(108px, 28vw, 124px)',
                height: hasTodayPhoto ? 'clamp(166px, 43vw, 210px)' : 'clamp(108px, 28vw, 124px)',
                marginBottom: heroIsViewingToday && hasTodayPhoto ? 22 : 0,
                transform: hasTodayPhoto ? 'translateY(-6px)' : 'none',
              }}
            >
              <button
                onClick={() => {
                  // Tap behavior:
                  // - No photo today → opens the CHECK-IN CAMERA
                  //   directly. Previously this routed to the older
                  //   Log modal, but Jenni (May 2026) collapsed the
                  //   empty-state UI to "oval IS the check-in" —
                  //   no separate pill, no chooser sheet. Tap oval
                  //   → camera. Upload remains a small affordance
                  //   to the side of the oval for file-picker users.
                  // - Photo exists → opens the SkinReadDrawer for the
                  //   current cover photo, where the user can sibling-
                  //   toggle through today's other shots and use the
                  //   "Set as main photo" button. Camera affordance at
                  //   4 o'clock still goes to a chooser for retake.
                  if (hasTodayPhoto && todayLog?.id != null) {
                    setSkinReadDrawerLogId(todayLog.id);
                  } else {
                    setShowCheckInCamera(true);
                  }
                }}
                className="absolute inset-0 transition hover:opacity-90 focus:outline-none cursor-pointer"
                style={{cursor:'pointer'}}
                aria-label={hasTodayPhoto ? "View today's photo" : "Check in today"}
              >
                <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-dashed flex flex-col items-center justify-center" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
                  {hasTodayPhoto ? (
                    <Photo item={todayLog} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <>
                      <Icon name="Camera" size={28} style={{color:'var(--ink-soft)'}} />
                      <div className="text-[10.5px] mt-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase'}}>Check-in today</div>
                    </>
                  )}
                </div>
              </button>
              {/* === UPLOAD AFFORDANCE — slim pill (May 2026) ===
                  No photo today → keep the oval as the take-photo action,
                  but label the secondary upload path explicitly so the
                  upload arrow does not read as mystery chrome. */}
              {heroIsViewingToday && !hasTodayPhoto && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCheckInChooser(true); }}
                  className="absolute inline-flex items-center justify-center transition hover:opacity-90 cursor-pointer z-10"
                  style={{
                    left: '50%',
                    bottom: '-15px',
                    transform: 'translateX(-50%)',
                    height: 30,
                    gap: 6,
                    padding: '0 12px',
                    borderRadius: 999,
                    background: 'var(--cream)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                    boxShadow: '0 2px 6px rgba(28,25,23,0.12)',
                    fontSize: 11,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  aria-label="Upload photo from library"
                  title="Upload photo"
                >
                  <Icon name="Upload" size={13} style={{color:'var(--ink-soft)'}} />
                  <span>Upload photo</span>
                </button>
              )}
              {heroIsViewingToday && hasTodayPhoto && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCheckInChooser(true); }}
                  className="absolute flex items-center justify-center transition hover:opacity-90 cursor-pointer z-10"
                  style={{
                    left: '50%',
                    bottom: '-19px',
                    transform: 'translateX(-50%)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  aria-label="Add a new photo today"
                  title="Add photo"
                >
                  <span
                    className="flex items-center gap-1.5 rounded-full"
                    style={{
                      height: 27,
                      padding: '0 12px',
                      background: 'var(--cream)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink)',
                      boxShadow: '0 2px 6px rgba(28,25,23,0.12)',
                      fontSize: '10.5px',
                      fontWeight: 500,
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon name="Camera" size={12} />
                    <span>Add photo</span>
                  </span>
                </button>
              )}
              {hasTodayPhoto && todayAvg != null && (
                <div
                  className="absolute rounded-[20px] px-3 py-2 text-center"
                  style={{
                    right: '-12px',
                    bottom: '10px',
                    background: 'var(--cream-deep)',
                    border: '1px solid var(--line)',
                    boxShadow: '0 8px 18px rgba(54,42,34,0.12)',
                    minWidth: '54px',
                  }}
                >
                  <div className="font-serif leading-none" style={{color:'var(--accent)', fontSize:'24px', fontWeight:700, letterSpacing:'-0.03em'}}>
                    {(todayAvg / 10).toFixed(1)}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{color:'var(--accent)', fontWeight:500}}>today</div>
                </div>
              )}
            </div>
            {/* Text column. Populated state stays clamped at 178px so
                the score chip + face photo don't fight for space.
                Empty state lifts the clamp so the longer title
                ("Your skin story") flows naturally next to the
                smaller empty-state circle. (May 2026 v2 per Jenni —
                empty-state layout was wrapping 5 narrow lines.) */}
            <div className="flex-1 min-w-0 pt-0" style={{maxWidth: hasTodayPhoto ? 178 : undefined}}>
              <h2 className="font-serif text-[24px] md:text-[27px] leading-[1.05] mb-2" style={{color: hasTodayPhoto ? 'var(--accent)' : 'var(--ink)', letterSpacing:'-0.025em'}}>
                {hasTodayPhoto ? 'Today' : 'Your skin story'}
              </h2>
              {(() => {
                // === Two-line description ===
                // Line 1 = primary AI read (or instruction if no photo)
                // Line 2 = supporting AI observation OR contextual nudge
                let line1 = '', line2 = '';
                const tc = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
                if (!hasTodayPhoto) {
                  line1 = 'No photo logged yet.';
                  line2 = 'Camera or upload — either works.';
                } else if (todayLog?.analyzing) {
                  line1 = 'Reading your skin…';
                  line2 = 'A moment.';
                } else if (!todaySnap && !todayLog?.aiAnalysis) {
                  // No metrics AND no prose. If API key isn't set,
                  // the auto-fire never runs and the state persists
                  // — but per Jenni: no CTA, no retry buttons, no
                  // "tap to generate." Just acknowledge the photo
                  // was saved and stay quiet. The auto-fire at the
                  // bottom of the daily save handler kicks
                  // retryLogAnalysis when keys exist; users without
                  // keys see this peaceful state and the analysis
                  // simply doesn't load. (No CTA = no broken
                  // promise.)
                  line1 = 'Photo logged.';
                  line2 = '';
                } else if (!todaySnap && todayLog?.aiAnalysis) {
                  // DEFENSIVE FALLBACK: prose exists but the metric parser
                  // came back empty (rare — Claude wrote bullets without
                  // any inline metric pairs). Try one more rescue pass via
                  // parseSkinMetrics. If still nothing, at least don't
                  // pretend the analysis didn't happen — surface that it
                  // did and route the user to read it.
                  const rescued = parseSkinMetrics(todayLog.aiAnalysis);
                  if (rescued) {
                    const r = tc(rescued.redness), h = tc(rescued.hydration), t = tc(rescued.texture),
                          b = tc(rescued.breakouts), ba = tc(rescued.barrier), s = tc(rescued.sensitivity);
                    if (r === 'High' || s === 'Inflamed' || ba === 'Stripped') line1 = 'Skin is reactive today.';
                    else if (r === 'Moderate' || s === 'Reactive') line1 = 'More redness today.';
                    else line1 = 'Reading captured.';
                    line2 = 'Tap Read Analysis for the full read.';
                  } else {
                    line1 = 'Analysis ready.';
                    line2 = 'Tap Read Analysis below.';
                  }
                } else {
                  const r = tc(todaySnap.redness), h = tc(todaySnap.hydration), t = tc(todaySnap.texture),
                        b = tc(todaySnap.breakouts), ba = tc(todaySnap.barrier), s = tc(todaySnap.sensitivity);
                  // Pick line 1 (dominant primary read)
                  if (r === 'High' || s === 'Inflamed' || ba === 'Stripped') line1 = 'Skin is reactive today.';
                  else if (r === 'Moderate' || s === 'Reactive') line1 = 'More redness today.';
                  else if (b === 'Severe' || b === 'Many') line1 = 'Active breakouts today.';
                  else if (b === 'Some') line1 = 'A few breakouts today.';
                  else if (h === 'Plump' && (r === 'Clear' || r === 'Low')) line1 = 'Glowing today.';
                  else if (h === 'Good' && (r === 'Clear' || r === 'Low')) line1 = 'Calm complexion today.';
                  else if (t === 'Smooth' && b === 'Clear') line1 = 'Even and clear today.';
                  else line1 = 'Steady today.';
                  // === Line 2: layered fallback ===
                  // Priority order:
                  //   1. delta-based cause→effect (most teaching value)
                  //   2. specific concern from today's snapshot
                  //   3. first-log encouragement (no prior reading exists)
                  //   4. consistent-reading observation (prior exists, nothing shifted)
                  // The old "Routine is working." string was almost
                  // always firing because no other branch matched —
                  // now it only appears when truly nothing else fits.
                  if (deltaChips.length > 0) {
                    // The "Since last reading" chips already carry the
                    // change story. Keep the headline copy from repeating
                    // the same signal twice.
                    line2 = '';
                  } else if (h === 'Parched') line2 = 'Skin reads as dehydrated.';
                  else if (h === 'Dry') line2 = 'Slight dehydration noted.';
                  else if (ba === 'Compromised') line2 = 'Barrier asking for support.';
                  else if (t === 'Bumpy' || t === 'Rough') line2 = 'Texture a touch rougher.';
                  else if (s === 'Tender') line2 = 'Tender to the touch.';
                  else if (b === 'Few' && line1 !== 'A few breakouts today.') line2 = 'A small spot or two.';
                  else if (!priorSnap) {
                    // First reading — no prior to compare against.
                    // Per Jenni (May 2026): leave the second line blank
                    // here. The "Log again tomorrow" prompt was reading
                    // text-heavy on the cover; the message lands better
                    // when the headline stands alone.
                    line2 = '';
                  } else {
                    // Have a prior reading but nothing shifted.
                    line2 = '';
                  }
                }
                const supportingLine = line2;
                return (
                  <div className="mb-2">
                    <p className="text-[15px] leading-snug font-light" style={{color:'var(--ink)'}}>
                      {line1}
                    </p>
                    {supportingLine && (
                      <p className="text-[13px] leading-snug mt-2 font-light" style={{color:'var(--ink-soft)'}}>
                        {supportingLine}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          {hasTodayPhoto && !todaySnap && !getApiKey() && (
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="w-full mt-4 mb-1 text-left text-[11px] italic px-3 py-2 rounded-[10px] flex items-center gap-2 transition hover:opacity-80"
              style={{background:'var(--cream)', border:'1px dashed var(--accent)', color:'var(--accent)'}}
            >
              <Icon name="Key" size={11} />
              <span>Set your Anthropic API key to generate skin metrics →</span>
            </button>
          )}
          {hasTodayPhoto && !todaySnap && getApiKey() && todayLog?.analyzing && (
            <div className="mt-4 mb-1 text-[11px] italic px-3 py-2 rounded-[10px] flex items-center gap-2" style={{background:'var(--cream)', border:'1px solid var(--line)', color:'var(--ink-soft)'}}>
              <Icon name="Loader2" size={11} className="spin" />
              <span>Reading your skin…</span>
            </div>
          )}
          {hasTodayPhoto && todaySnap && (
            <div className="mt-3 pt-3 border-t" style={{borderColor:'var(--line)'}}>
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {metricSpec
                  .filter(m => m.level)
                  .map(m => {
                    const level = (m.level || '').toLowerCase();
                    const copy =
                      m.label === 'Redness' ? `${level} redness` :
                      m.label === 'Hydration' ? `${level} hydration` :
                      m.label === 'Texture' ? `${level} texture` :
                      level === 'clear' ? 'clear' : `${level} breakouts`;
                    return (
                      <span
                        key={m.label}
                        className="rounded-full px-3 py-1 text-[11px] flex-shrink-0 whitespace-nowrap"
                        style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink)'}}
                      >
                        {copy}
                      </span>
                    );
                  })}
              </div>
            </div>
          )}
          {/* === DELTA BAND — "since last reading" ===
              Per Jenni (May 2026): show significant shifts in either
              direction. Sage chips for improvements, rose chips for
              regressions. Only the "no shift" / "no prior" cases hide the
              band entirely — so the cover stays quiet on first reads and
              on steady days, but calls out real changes (good or bad)
              when they happen. */}
          {hasTodayPhoto && todaySnap && priorSnap && (deltaChips || []).length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{borderColor:'var(--line)'}}>
              <div className="text-[8.5px] tracking-[0.28em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Since last reading</div>
              <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {deltaChips.map(d => (
                  <div
                    key={d.label}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                    style={{
                      background: d.improved ? 'rgba(138, 155, 126, 0.12)' : 'rgba(201, 138, 138, 0.10)',
                      color: d.improved ? 'var(--sage)' : 'var(--rose)',
                      border: '1px solid ' + (d.improved ? 'rgba(138, 155, 126, 0.30)' : 'rgba(201, 138, 138, 0.28)'),
                    }}
                  >
                    <Icon name={d.dir === 'up' ? 'ArrowUpRight' : 'ArrowDownRight'} size={10} />
                    <span className="text-[10px]" style={{fontWeight:500}}>{d.label}</span>
                    <span className="text-[10px]" style={{opacity:0.75}}>{(d.from || '').toLowerCase()} → {(d.to || '').toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasTodayPhoto && heroIsViewingToday && (
            <>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={openTodayAnalysis}
                  className={analysisIsFresh ? "pill-btn primary w-full" : "pill-btn secondary w-full"}
                  disabled={todayLog?.id == null}
                >
                  {todayLog?.analyzing ? (
                    <>
                      <Icon name="Loader2" size={14} className="spin" style={{marginRight:6}} />
                      Reading…
                    </>
                  ) : (
                    <>
                      <Icon name="Sparkles" size={14} style={{marginRight:6}} />
                      {analysisIsFresh ? 'Read Analysis' : 'View Analysis'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
          {heroIsViewingToday && hasPhotoHistory && (
            <div className={hasTodayPhoto ? "mt-3 flex items-center justify-center gap-4 text-[11px]" : "mt-4 pt-3 border-t flex items-center justify-center gap-4 text-[11px]"} style={{color:'var(--accent)', fontWeight:500, borderColor:'var(--line)'}}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('journal');
                  setTimeout(() => setJournalViewOverride && setJournalViewOverride('timeline'), 0);
                }}
                className="inline-flex items-center gap-1 transition hover:opacity-75"
              >
                View timeline <Icon name="ArrowRight" size={11} />
              </button>
              {canComparePhotos && (
                <>
                  <span style={{color:'var(--line)'}}>|</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('compare')}
                    className="inline-flex items-center gap-1 transition hover:opacity-75"
                  >
                    Compare photos <Icon name="ArrowRight" size={11} />
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      );
  })()}

      {/* === EMPTY-STATE BUILD PROMPT (cover) ===
          Fires for users who have never built a weekly pattern AND
          haven't logged a regimen yet. Soft card above the ritual
          surface — routes to Build wizard. Dismissable; once
          dismissed it stays hidden (per-device localStorage). For
          manual-logging users who never want the wizard, one tap on
          the X gets them peace. */}
      {!coverBuildPromptDismissed
        && !userHasBuiltPattern(products)
        && (regimenLogs || []).length === 0
        && (
        <section className="atelier-card px-5 py-4 md:px-6 md:py-5 mb-4 relative">
          <button
            onClick={dismissCoverBuildPrompt}
            className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)]"
            style={{color:'var(--ink-soft)'}}
            aria-label="Dismiss"
          ><Icon name="X" size={11} /></button>
          <div className="text-[9.5px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>First time?</div>
          <h3 className="text-[18px] leading-tight mb-1.5 pr-8" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Build your weekly routine.</h3>
          <p className="text-[12px] leading-relaxed mb-3 pr-8" style={{color:'var(--ink-soft)'}}>
            Tell us your concerns, what actives you want to use, and we'll lay out a week that fits. Or skip and log day by day.
          </p>
          <button
            onClick={() => { setActiveTab('regimen'); setRegimenView('build'); }}
            className="pill-btn primary"
            style={{padding:'8px 18px'}}
            type="button"
          >
            <Icon name="Sparkles" size={13} style={{marginRight:6}} />
            Build my week
          </button>
        </section>
      )}

      {/* === WAYFINDING CARD — three pillars (May 2026 v2) ===
          Re-enabled after blank-page root cause (Supabase auth hang
          on file://) was fixed with a getSession timeout race. */}
      {(() => {
        const snapshotDone = (logs || []).some(hasPhoto);
        const shelfDone = (products || []).some(p => !p.endDate);
        const regimenDone = (regimenLogs || []).some(r =>
          ((r.amProducts || []).length + (r.pmProducts || []).length) > 0
        );
        const undoneCount = [snapshotDone, shelfDone, regimenDone].filter(d => !d).length;
        const onlySnapshotUndone = !snapshotDone && shelfDone && regimenDone;
        if (undoneCount === 0) return null;
        if (onlySnapshotUndone) return null;
        const rows = [
          {
            id: 'snapshot',
            num: '01',
            label: 'Check in',
            sub: 'Snap your first selfie',
            icon: 'Camera',
            done: snapshotDone,
            action: () => setShowCheckInCamera && setShowCheckInCamera(true),
          },
          {
            id: 'shelf',
            num: '02',
            label: 'Stock your shelf',
            sub: 'Add what you actually use',
            icon: 'Layers',
            done: shelfDone,
            action: () => { setActiveTab && setActiveTab('regimen'); setRegimenView && setRegimenView('build'); },
          },
          {
            id: 'regimen',
            num: '03',
            label: 'Compose your regimen',
            sub: 'We’ll draft a first routine',
            icon: 'Sparkles',
            done: regimenDone,
            action: () => { setActiveTab && setActiveTab('regimen'); setRegimenView && setRegimenView('build'); },
          },
        ];
        return (
          <section
            className="mb-6 rounded-[20px] overflow-hidden"
            style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}
          >
            <div className="px-5 pt-4 pb-1">
              <div className="text-[10px] tracking-[0.28em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>Next</div>
              <div className="font-serif text-[18px] leading-tight mt-0.5" style={{color:'var(--ink)', letterSpacing:'-0.01em'}}>
                A few steps to make this yours.
              </div>
            </div>
            <div className="px-2 py-2">
              {rows.map((row, i) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={row.done ? undefined : row.action}
                  disabled={row.done}
                  className="w-full text-left px-3 py-3 rounded-[14px] flex items-center gap-3 transition"
                  style={{
                    background: 'transparent',
                    cursor: row.done ? 'default' : 'pointer',
                    opacity: row.done ? 0.65 : 1,
                  }}
                  aria-label={row.done ? `${row.label} — done` : row.label}
                >
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px]"
                    style={{
                      background: row.done
                        ? 'rgba(138, 155, 126, 0.16)'
                        : 'color-mix(in srgb, var(--accent) 8%, transparent)',
                      color: row.done ? 'var(--sage)' : 'var(--accent)',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {row.done ? <Icon name="Check" size={12} /> : row.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px]"
                      style={{
                        color: 'var(--ink)',
                        fontWeight: 600,
                        textDecoration: row.done ? 'line-through' : 'none',
                        textDecorationColor: 'rgba(78,58,44,0.30)',
                        textDecorationThickness: '1px',
                      }}
                    >
                      {row.label}
                    </div>
                    {!row.done && (
                      <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                        {row.sub}
                      </div>
                    )}
                  </div>
                  {!row.done && (
                    <Icon name="ChevronRight" size={14} style={{color:'var(--ink-soft)', flexShrink:0}} />
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {/* === TODAY'S RITUAL CARD === */}
      {(() => {
      // Wave 8.3 fix (May 2026): these used to live in HomeDashboard's
      // outer scope. Re-derive locally so the sub-extracted child
      // stays self-contained — localDateISO is a module-scope global.
      const today = new Date();
      const activeProducts = (products || []).filter(p => !p.endDate);
      // Date being viewed/edited — defaults to today, user scrubs
      // ◀ ▶ to navigate prior days. The card title + bottles + Edit
      // target update accordingly.
      const viewDate = ritualViewDate || todayStr;
      const isViewingToday = viewDate === todayStr;
      const todayCheckIn = (regimenLogs || []).find(r => r.date === viewDate);
      const submittedToday = !!(todayCheckIn && todayCheckIn.submitted);
      // Yesterday's regimen — used by "Same as yesterday" button to copy AM/PM picks.
      const yKey = (() => {
        const d = new Date(); d.setDate(d.getDate() - 1);
        return localDateISO(d);
      })();
      const yesterdayCheckIn = (regimenLogs || []).find(r => r.date === yKey && r.submitted);
      const canRepeatYesterday = !!yesterdayCheckIn && !submittedToday && isViewingToday;
      // === Build AM and PM product lists separately ===
      // Source priority: ANY regimenLog for viewDate → shelf-default by useTimes.
      // BUG FIX (May 2026): previously gated on `submittedToday`,
      // which meant From Shelf adds + cover X removes (both write
      // submitted:false) silently rendered the OLD shelf-default
      // list — making it look like the X "didn't work" and like
      // newly-added bottles didn't show. The single source of truth
      // for "what's in today's routine" is now the regimenLog
      // (regardless of submitted), so the UI always matches storage.
      const sourceCheckIn = todayCheckIn || null;
      // === COVER RITUAL FALLBACK (May 2026 revision per Jenni) ===
      // Previously the cover ritual started EMPTY when no log
      // existed — useTimes was treated as a tag, not a roster.
      // That was right for users who hadn't built a routine.
      //
      // NEW behavior with the built-pattern system:
      //   - Has log → show log products
      //   - No log + user has built a real weekly pattern →
      //     show today's pattern (auto-derived from cadence.days
      //     + useTimes for today's day-of-week). User sees their
      //     plan reflected on the cover without re-logging.
      //   - No log + no built pattern → still empty (no implicit
      //     dump of useTimes-tagged shelf products).
      // Manual cover adds still write to today's log; they don't
      // auto-propagate to tomorrow because tomorrow reads its
      // own (empty) log → falls through to pattern.
      // === SINGLE RESOLVER (May 2026 bug fix) ===
      // Replaces the inline buildSlot. Every today's-ritual
      // surface MUST use resolveTodayRitual so display fixes
      // here don't drift from Regimen Today / Check-in Modal.
      // Body filter, dedupe, hard cap + hidden overflow all live in the resolver.
      const coverResolved = resolveTodayRitual({
        products: activeProducts,
        regimenLogs,
        date: viewDate,
      });
      const amList = coverResolved.am;
      const pmList = coverResolved.pm;
      const amOverflow = coverResolved.amOverflow;
      const pmOverflow = coverResolved.pmOverflow;
      const amHidden = coverResolved.amHidden || [];
      const pmHidden = coverResolved.pmHidden || [];
      const isCoverFromPattern = coverResolved.source === 'pattern';
      // Day label for header. "Today" / "Yesterday" / "Mon, May 5".
      // Day label includes the actual date for any non-today
      // view, so the user never wonders "wait, is this today or
      // yesterday?" when scrubbing. "Today" stays bare; everything
      // else carries the calendar date.
      const dateShort = new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const viewDayLabel = isViewingToday ? 'Today'
        : viewDate === yKey ? `Yesterday · ${dateShort}`
        : new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      // Scrub controls — go back/forward in days, capped at today.
      const shiftDay = (deltaDays) => {
        const d = new Date(viewDate + 'T00:00:00');
        d.setDate(d.getDate() + deltaDays);
        const next = localDateISO(d);
        // Don't allow scrubbing into the future.
        if (next > todayStr) return;
        setRitualViewDate(next);
      };
      // displayProducts is kept for the legacy 4-slot lineup downstream + Gemini art generation.
      const displayProducts = [...amList, ...pmList].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i).slice(0, 4);
      const slotsToFill = Math.max(0, 4 - displayProducts.length);
      // Last logged ritual — fallback for the Repeat pill when
      // yesterday doesn't have a submitted log. Pulls the most
      // recent submitted prior log. Surfaces Repeat capability
      // even when users skip a few days.
      const lastLoggedRitual = (regimenLogs || [])
        .filter(r => r.submitted && r.date < viewDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
      const repeatSourceLog = yesterdayCheckIn || lastLoggedRitual;
      const canRepeatRitual = !submittedToday && !!repeatSourceLog && isViewingToday;
      const repeatYesterday = () => {
        const src = repeatSourceLog;
        if (!src) return;
        const next = {
          id: todayCheckIn?.id || Date.now(),
          date: viewDate,
          amProducts: [...(src.amProducts || [])],
          pmProducts: [...(src.pmProducts || [])],
          amExtras: [...(src.amExtras || [])],
          pmExtras: [...(src.pmExtras || [])],
          devices: [...(src.devices || [])],
          sleep: src.sleep || '',
          supplements: [...(src.supplements || [])],
          hydration: src.hydration || false,
          sunscreenReapply: src.sunscreenReapply || false,
          notes: '',
          submitted: true,
        };
        const newList = todayCheckIn
          ? regimenLogs.map(r => r.date === viewDate ? next : r)
          : [next, ...(regimenLogs || [])];
        setRegimenLogs(newList);
        saveData('regimenLogs', newList);
        setCoverRoutineRebuildToken(t => t + 1);
        const sourceLabel = repeatSourceLog === yesterdayCheckIn ? 'yesterday' : `last logged (${repeatSourceLog.date})`;
        toast(`Logged — same as ${sourceLabel} ✨`, 'info');
      };
      // Undo the just-clicked repeat — drops the view date's auto-created
      // check-in entirely so the pill flips back to its default state.
      const undoRepeatYesterday = () => {
        const newList = (regimenLogs || []).filter(r => r.date !== viewDate);
        setRegimenLogs(newList);
        saveData('regimenLogs', newList);
        setCoverRoutineRebuildToken(t => t + 1);
        toast('Undone', 'info');
      };
      // === Render a single product as a bottle thumbnail ===
      // Same priority chain: real photo → user-product Gemini art → fallback dashed outline.
      // Bumped to w-14 h-20 for a more premium visual presence on the cover.
      // === Remove product from a slot ===
      // ALWAYS writes to today's regimenLog (auto-save). If no log
      // exists yet for today, we synthesize one from the current
      // shelf-default view so the X feels like a direct mutation
      // of what's on screen — not a side-channel toggle on
      // useTimes. Symmetric with the From Shelf sheet's +AM/+PM
      // auto-save: tap to add, X to remove, regimenLogs is the
      // single source of truth.
      // === REMOVE — opens scope prompt (May 2026 Tier 2) ===
      // Was: silently writing to today's log only. Now asks the
      // user whether they want "Just for today" or "Remove from
      // routine." The prompt state is at App scope and the
      // actual mutations happen via the prompt's handlers
      // below this render block. amList/pmList from the cover
      // closure get passed through so the cancel path doesn't
      // wipe the on-screen state.
      const removeFromSlot = (product, slot) => {
        if (!product) return;
        setRemoveScopePrompt({
          product,
          slot,
          today: localDateISO(),
          seedAmIds: amList.map(p => p.id),
          seedPmIds: pmList.map(p => p.id),
        });
      };
      // === COVER PRODUCT TILE (May 2026 — rectangular tile redesign) ===
      // Per Jenni: no more big texture sphere. Each product is a
      // rectangular text-forward tile:
      //   - small ingredient icon at top (no sphere wrapper)
      //   - brand on line 1
      //   - product name on line 2
      //   - category as uppercase footer
      //   - X remove in upper-right corner
      // Tile is 110px wide so 2-3 fit per mobile viewport, scrolls
      // horizontally for more. Subtle border + shadow, cream fill.
      //
      // FOLLOW-UP: curated SVG ingredient illustrations per category
      // (Option A, deferred). See project_texture_swatch_followup.md.
      const renderBottle = (product, key, slot) => {
        const brand = (product?.brand || '').trim();
        const name = (product?.name || '').trim();
        const category = (product?.category || 'product').replace(/-/g, ' ');
        const iconName = getCategoryIcon(product?.category);
        const primary = brand || name || 'Product';
        const secondary = (brand && name && brand !== name) ? name : '';
        return (
          <article
            key={key}
            className="flex-shrink-0 relative group"
            style={{
              width: 102,
              minHeight: 152,
              border: '1px solid rgba(78, 58, 44, 0.10)',
              borderRadius: 14,
              // White tile (vs the ritual card's cream-deep bg) carves
              // each tile out cleanly rather than blending. Stronger
              // shadow gives lift without heaviness.
              background: '#FFFDFC',
              padding: '12px 10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              boxShadow: '0 4px 14px rgba(44, 31, 25, 0.06), 0 1px 2px rgba(44, 31, 25, 0.04)',
            }}
          >
            {/* X-remove — corner chip */}
            {product && slot && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFromSlot(product, slot); }}
                className="transition hover:opacity-90 cursor-pointer"
                style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 18, height: 18, borderRadius: '999px',
                  background: 'var(--cream-deep)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink-soft)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 2,
                }}
                title={`Remove from ${slot.toUpperCase()}`}
                aria-label={`Remove ${product.name} from ${slot.toUpperCase()}`}
              >
                <Icon name="X" size={9} />
              </button>
            )}
            {/* Ingredient icon */}
            <div
              style={{
                width: 24, height: 24, borderRadius: '999px',
                border: '1px solid var(--line)',
                background: 'var(--cream-deep)',
                color: 'var(--accent)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 3,
              }}
            >
              <Icon name={iconName} size={12} />
            </div>
            {/* Brand / product name (primary) — softened to 13px medium.
                Earlier 15px crowded the tile; this gives the layout
                the airier "Aestura / A-Barrier Cream" rhythm Jenni's
                reference mockup shows. */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--ink)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
              }}
              title={primary}
            >
              {primary}
            </div>
            {/* Product name (secondary) — 11.5px subtle */}
            {secondary && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--ink-soft)',
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                }}
                title={secondary}
              >
                {secondary}
              </div>
            )}
            {/* Category footer — tighter tracking (0.14em vs 0.22em)
                and wraps to 2 lines if needed so "Moisturizer" and
                "Exfoliant" don't truncate as "MOISTURI…" */}
            <div
              style={{
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'var(--ink-soft)',
                fontWeight: 600,
                marginTop: 'auto',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
              }}
            >
              {category}
            </div>
          </article>
        );
      };
      // Empty-state lineup (4 starter bottles) when user has nothing in AM/PM yet.
      const emptyLineup = STARTER_PRODUCT_PREVIEWS.map((starter, i) => {
        const starterArt = generatedProductArt && generatedProductArt[starter.slug];
        const caption = starter.brand || starter.name || '';
        return (
          <div key={`starter-${i}`} className="flex-shrink-0 w-14 flex flex-col items-center">
            <div className="h-20 flex items-end justify-center overflow-hidden">
              {starterArt
                ? <img src={starterArt} alt={starter.name} className="h-full w-auto max-w-full object-contain" />
                : <DashedBottleOutline />}
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
      });
      const hasAnyRoutine = amList.length > 0 || pmList.length > 0;
      const handleCoverExport = async (e) => {
        const card = e.currentTarget.closest('.export-target');
        if (!card) { toast('Couldn’t find the card to export', 'error'); return; }
        try {
          await exportNodeAsJpg(card, `etude-cover-${localDateISO()}`);
          toast('Saved to your downloads', 'success');
        } catch (err) {
          toast(err?.message || 'Export failed', 'error');
        }
      };
      return (
        <section className="rounded-[20px] px-5 py-5 md:px-6 md:py-6 relative export-target" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
          {/* Header row — eyebrow + logged badge on left, quick-action
              icons (Repeat ↻ / Edit ✎) on the right. The icons are
              small but labeled with quiet uppercase text so the
              affordance reads from a glance — they're shortcuts so the
              user doesn't have to scan the pill row for routine ops. */}
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10.5px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>Regimen</span>
              {/* LOGGED badge moved to bottom-right of card (below action
                  pills) so the header reads cleaner. */}
            </div>
            {/* Quick-action stack — today only. Past days are read-only
                snapshots, so we hide both. Per Jenni (May 2026):
                Clear AM/PM sits on top, Repeat yesterday below it
                (vertical stack, right-aligned) so the destructive +
                recovery actions read as a small column of utilities
                rather than competing peers across the top of the card. */}
            {isViewingToday && (
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {/* === CLEAR ↔ RESTORE (May 2026, mirrors Regimen Today) ===
                    Per-slot: clears active slot for today, OR restores
                    from the weekly pattern when the slot is empty +
                    a pattern exists. Same single-source helpers as
                    Regimen Today — written inline because handlers
                    need closure on cover-scope state setters. */}
                {(() => {
                  const todayKeyLocal = todayStr;
                  const todayLog = (regimenLogs || []).find(r => r.date === todayKeyLocal);
                  const slotKey = ritualSlot === 'pm' ? 'pmProducts' : 'amProducts';
                  const activeList = ritualSlot === 'pm' ? pmList : amList;
                  const slotEmpty = activeList.length === 0;
                  const patternBuilt = userHasBuiltPattern(products);
                  if (slotEmpty && !patternBuilt) return null;
                  const clearSlot = () => {
                    if (!todayLog) {
                      // === OPPOSITE-SLOT PRESERVE (May 2026 per Codex) ===
                      // Pre-fix: clearing AM with no log written an
                      // empty record for BOTH slots — which silently
                      // killed today's PM pattern fallback too.
                      // Fix: when no log exists, copy the OPPOSITE
                      // slot's pattern-derived ids into the new log
                      // so only the selected slot ends up empty.
                      const dow = new Date().getDay();
                      const pat = getProductsForTodayFromPattern((products || []).filter(p => !p.endDate), dow);
                      const oppositeKey = ritualSlot === 'pm' ? 'amProducts' : 'pmProducts';
                      const oppositeIds = (ritualSlot === 'pm' ? pat.am : pat.pm).map(p => p.id);
                      const emptyLog = {
                        id: Date.now(),
                        date: todayKeyLocal,
                        amProducts: ritualSlot === 'am' ? [] : (oppositeKey === 'amProducts' ? oppositeIds : []),
                        pmProducts: ritualSlot === 'pm' ? [] : (oppositeKey === 'pmProducts' ? oppositeIds : []),
                        amExtras: [], pmExtras: [],
                        devices: [], sleep: '', supplements: [],
                        submitted: false,
                      };
                      const newList = [...(regimenLogs || []), emptyLog];
                      setRegimenLogs(newList);
                      saveData('regimenLogs', newList);
                      setCoverRoutineRebuildToken(t => t + 1);
                      toast(`Cleared ${ritualSlot.toUpperCase()} for today`, 'info');
                      return;
                    }
                    const newList = (regimenLogs || []).map(r => r.date === todayKeyLocal ? { ...r, [slotKey]: [] } : r);
                    setRegimenLogs(newList);
                    saveData('regimenLogs', newList);
                    setCoverRoutineRebuildToken(t => t + 1);
                    toast(`Cleared ${ritualSlot.toUpperCase()} routine`, 'info');
                  };
                  const restoreSlot = () => {
                    const dow = new Date().getDay();
                    const pat = getProductsForTodayFromPattern((products || []).filter(p => !p.endDate), dow);
                    const patIds = (ritualSlot === 'am' ? pat.am : pat.pm).map(p => p.id);
                    if (!todayLog) {
                      const newLog = {
                        id: Date.now(),
                        date: todayKeyLocal,
                        amProducts: ritualSlot === 'am' ? patIds : [],
                        pmProducts: ritualSlot === 'pm' ? patIds : [],
                        amExtras: [], pmExtras: [],
                        devices: [], sleep: '', supplements: [],
                        submitted: false,
                      };
                      const newList = [...(regimenLogs || []), newLog];
                      setRegimenLogs(newList);
                      saveData('regimenLogs', newList);
                      setCoverRoutineRebuildToken(t => t + 1);
                      toast(`Restored ${ritualSlot.toUpperCase()} from your weekly plan`, 'info');
                      return;
                    }
                    const newList = (regimenLogs || []).map(r => r.date === todayKeyLocal ? { ...r, [slotKey]: patIds } : r);
                    setRegimenLogs(newList);
                    saveData('regimenLogs', newList);
                    setCoverRoutineRebuildToken(t => t + 1);
                    toast(`Restored ${ritualSlot.toUpperCase()} from your weekly plan`, 'info');
                  };
                  if (slotEmpty) {
                    return (
                      <button
                        type="button"
                        onClick={restoreSlot}
                        className="flex items-center gap-1 transition hover:opacity-70"
                        style={{color:'var(--accent)', cursor:'pointer'}}
                        title={`Restore ${ritualSlot.toUpperCase()} from your weekly plan`}
                        aria-label={`Restore ${ritualSlot.toUpperCase()}`}
                      >
                        <Icon name="RotateCcw" size={12} />
                        <span className="text-[10.5px] tracking-[0.18em] uppercase">Restore {ritualSlot.toUpperCase()}</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={clearSlot}
                      className="flex items-center gap-1 transition hover:opacity-70"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                      title={`Clear ${ritualSlot.toUpperCase()} routine for today`}
                      aria-label={`Clear ${ritualSlot.toUpperCase()}`}
                    >
                      <Icon name="Trash2" size={12} />
                      <span className="text-[10.5px] tracking-[0.18em] uppercase">Clear {ritualSlot.toUpperCase()}</span>
                    </button>
                  );
                })()}
                {/* Repeat yesterday — moved underneath Clear AM
                    per Jenni (May 2026). Renamed from "Repeat" to
                    "Repeat yesterday" so the action is explicit
                    about its source (the previous day's submitted
                    log). Toggles to "Repeated" with check when
                    today's log has already been submitted; tap
                    again to undo. */}
                <button
                  type="button"
                  onClick={submittedToday ? undoRepeatYesterday : repeatYesterday}
                  disabled={!submittedToday && (!repeatSourceLog || !isViewingToday)}
                  className="flex items-center gap-1 transition hover:opacity-70 disabled:opacity-30"
                  style={{color: submittedToday ? 'var(--accent)' : 'var(--ink-soft)', cursor: (submittedToday || (repeatSourceLog && isViewingToday)) ? 'pointer' : 'default'}}
                  title={submittedToday ? 'Repeated — tap to clear' : (repeatSourceLog ? (repeatSourceLog === yesterdayCheckIn ? "Repeat yesterday's AM/PM picks" : `Repeat last logged regimen (${repeatSourceLog?.date || ''})`) : 'No prior regimen to repeat')}
                  aria-label="Repeat yesterday's regimen"
                >
                  <Icon name={submittedToday ? 'Check' : 'RotateCcw'} size={12} />
                  <span className="text-[10.5px] tracking-[0.18em] uppercase">{submittedToday ? 'Repeated' : 'Repeat yesterday'}</span>
                </button>
                {/* Export icon moved to bottom-right of card (May 2026).
                    See export button rendered after the action pills. */}
              </div>
            )}
          </div>
          {/* Day scrubber — ◀ DAY LABEL ▶. Lets the user
              navigate to prior days to view + edit their regimen.
              "Today" link returns instantly when on a prior day.
              Forward arrow disabled when on today (no future). */}
          <div className="flex items-center justify-between mb-3 gap-2 px-1">
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
              <span className="font-serif italic text-[14px]" style={{color: isViewingToday ? 'var(--accent)' : 'var(--ink)'}}>{viewDayLabel}</span>
              {/* "Logged" badge retired May 2026 (Jenni): the
                  "Today logged" status pill near the primary CTA
                  already conveys submission; the inline date badge
                  was redundant clutter. */}
              {!isViewingToday && (
                <button
                  type="button"
                  onClick={() => setRitualViewDate(todayStr)}
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
          {/* "From your current routine · Edit plan" subline retired
              May 2026 per Jenni: redundant with the Edit routine link
              at the bottom of the card, and added a third meta-line
              between the day scrubber and AM/PM toggle that crowded
              the surface. The bottom Edit routine link is the single
              canonical entry point to the plan editor now. */}

          {hasAnyRoutine ? (
            <>
              {/* Actives chip row moved BELOW the action pills per Jenni —
                  see "TODAY'S ACTIVES CHIP ROW (moved)" further down. */}
              {/* === AM / PM TOGGLE (May 2026 single-slot view) ===
                  Replaces the cramped 2-column grid. One slot at a time,
                  tiles span full card width — 3+ visible per scroll,
                  no edge clipping. ritualSlot is shared with the Edit
                  modal and Regimen page so AM/PM choice persists. */}
              <div className="rounded-full flex p-1 gap-1 mb-3" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
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
                      <span className="text-[10.5px] tracking-[0.22em] uppercase">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              {/* === SLIM NUMBERED LIST (May 2026) ===
                  Replaces the 168px horizontal scroll row of bottle
                  tiles with a compact vertical numbered list. Each
                  row is one product, ~36–44px tall, two lines:
                  brand eyebrow + product name. Category sits as
                  a small uppercase tag at the right edge. X
                  removes from the slot (same removeFromSlot
                  handler the old tile cards used). Cuts the cover
                  ritual card footprint by ~40% vs the old layout. */}
              {/* === SLIM NUMBERED LIST (Phase 3C — RoutineSlotList) ===
                  Composes EmptyRoutineState + RoutineProductRow + overflow
                  pill. All inputs come from resolveTodayRitual via the
                  amList/pmList + amOverflow/pmOverflow already computed
                  above — no separate useTimes filtering. */}
              {/* === DEFAULT-CHECKED MODEL (May 2026, prompt 3) ===
                  Planned products render as CHECKED by default. The
                  user explicitly skips a row by tapping its circle,
                  which writes the product id into amSkipped/pmSkipped
                  on today's log. doneIds passed to the row component
                  is the inverse of that set against the planned list.
                  Why this matters: the "I did everything as planned"
                  path is one tap (the primary CTA). The "I missed a
                  step" path is two taps (skip + save). The previous
                  model required the user to check every row before
                  saving, which collapsed the daily-execution loop. */}
              {(() => {
                const slotForRender = ritualSlot;
                const skippedKey = slotForRender === 'pm' ? 'pmSkipped' : 'amSkipped';
                const skippedList = sourceCheckIn && Array.isArray(sourceCheckIn[skippedKey]) ? sourceCheckIn[skippedKey] : [];
                const skippedSet = new Set(skippedList);
                const renderList = slotForRender === 'pm' ? pmList : amList;
                const renderOverflow = slotForRender === 'pm' ? pmOverflow : amOverflow;
                const renderHidden = slotForRender === 'pm' ? pmHidden : amHidden;
                const doneIdsForRender = [...renderList, ...renderHidden]
                  .filter(p => p && p.id && !skippedSet.has(p.id))
                  .map(p => p.id);
                return (
                  <div className="space-y-1 mb-2">
                    <RoutineSlotList
                      slot={slotForRender}
                      products={renderList}
                      overflow={renderOverflow}
                      hiddenProducts={renderHidden}
                      canRepeat={canRepeatRitual}
                      onRepeat={repeatYesterday}
                      onRemove={removeFromSlot}
                      onOverflow={() => {}}
                      doneIds={doneIdsForRender}
                      onToggleDone={(product, slotKey) => {
                        if (!product || !product.id) return;
                        const sk = slotKey === 'pm' ? 'pmSkipped' : 'amSkipped';
                        const currentList = (regimenLogs || []).find(r => r.date === viewDate);
                        const currentSkipped = currentList && Array.isArray(currentList[sk]) ? currentList[sk] : [];
                        // Toggle skipped membership. Default-checked
                        // means: if not currently in skipped → add
                        // (user is un-checking); else → remove.
                        const nextSkipped = currentSkipped.includes(product.id)
                          ? currentSkipped.filter(x => x !== product.id)
                          : [...currentSkipped, product.id];
                        const updatedLog = currentList
                          ? { ...currentList, [sk]: nextSkipped }
                          : {
                              id: Date.now(),
                              date: viewDate,
                              amProducts: amList.map(p => p && p.id).filter(Boolean),
                              pmProducts: pmList.map(p => p && p.id).filter(Boolean),
                              amDone: [],
                              pmDone: [],
                              amSkipped: slotKey === 'am' ? nextSkipped : [],
                              pmSkipped: slotKey === 'pm' ? nextSkipped : [],
                              notes: '',
                              submitted: false,
                            };
                        const next = currentList
                          ? regimenLogs.map(r => r.date === viewDate ? updatedLog : r)
                          : [updatedLog, ...regimenLogs];
                        setRegimenLogs(next);
                        saveData('regimenLogs', next).catch(() => {});
                      }}
                    />
                  </div>
                );
              })()}
            </>
          ) : coverResolved.source === 'past-empty' ? (
            <>
              {/* === PAST-DAY EMPTY (May 2026 per Jenni) ===
                  Past days without a log don't fall back to the
                  shelf pattern anymore (the pattern is what's
                  planned, not what happened — see resolver). Show
                  a minimal "missing log" state with one CTA that
                  opens the Used-something-else sheet pre-scoped
                  to that day so the user can retroactively log
                  whatever they remember. */}
              <h2 className="text-[15px] md:text-[16px] leading-[1.3] mb-2" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'-0.012em'}}>
                No log for {new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
              </h2>
              <p className="text-[12px] leading-relaxed mb-4" style={{color:'var(--ink-soft)', fontWeight:400}}>
                We didn't record what you used that day. Add it now if you remember — or leave the day as-is.
              </p>
              <button
                type="button"
                onClick={() => setUsedSomethingElseSheet({ open: true, slot: ritualSlot || 'am', date: viewDate })}
                className="rounded-full px-4 py-2 inline-flex items-center gap-1.5 transition hover:opacity-90"
                style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11, letterSpacing:'0.08em', cursor:'pointer', textTransform:'uppercase'}}
              >
                <Icon name="Plus" size={11} />
                <span>Log retroactively</span>
              </button>
            </>
          ) : (
            <>
              {/* === EMPTY STATE — Tang & Gainey scaffolding ===
                  Replaces the prior "What did you use today?"
                  generic prompt. Now teaches the canonical AM/PM
                  template so a fresh user has a real path, not
                  just an open form. Only fires for TODAY/FUTURE
                  empty (past-empty has its own branch above). */}
              <h2 className="text-[17px] md:text-[18px] leading-[1.2] mb-2" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'-0.012em'}}>
                Stepping out bare? Brave.
              </h2>
              <p className="text-[12.5px] leading-relaxed mb-2" style={{color:'var(--ink)', fontWeight:400}}>
                The basics — cleanser <span style={{color:'var(--ink-soft)'}}>→</span> moisturizer <span style={{color:'var(--ink-soft)'}}>→</span> SPF for morning, cleanser <span style={{color:'var(--ink-soft)'}}>→</span> treatment <span style={{color:'var(--ink-soft)'}}>→</span> moisturizer for night. Three steps each, that's enough.
              </p>
              <p className="text-[11.5px] leading-relaxed mb-4" style={{color:'var(--ink-soft)', fontWeight:400}}>
                Pull from your shelf below, or add something new.
              </p>
              {/* Bottle silhouettes intentionally removed (May 2026
                  per Jenni's "no bottle imagery" rule). The empty
                  state is just text-led now — the motivating
                  message owns the surface. */}
            </>
          )}

          {/* === DEVICES TODAY REMINDER (May 2026 — derm pass) ===
              Surfaces which home devices are scheduled for the
              current day + slot. Only renders when the user owns
              at least one device matching today's schedule. Tap
              opens nothing — pure reminder. */}
          {isViewingToday && (homeDevices || []).length > 0 && (() => {
            const todayDow = new Date().getDay();
            const allTodayDevices = getDevicesForDay(homeDevices, todayDow);
            // Slot-aware: only show devices that match the active
            // AM/PM tab. ritualSlot is shared with the toggle.
            const slotDevices = allTodayDevices.filter(d => d.slot === ritualSlot);
            if (slotDevices.length === 0) return null;
            return (
              <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full px-2.5 py-1" style={{background:'var(--cream-deep)', border:'1px solid var(--line)', width:'fit-content'}}>
                <Icon name="Sparkles" size={10} style={{color:'var(--accent)', flexShrink:0, opacity:0.8}} />
                <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] leading-snug" style={{color:'var(--ink)', fontWeight:500}}>
                  <span className="tracking-[0.14em] uppercase mr-1.5" style={{color:'var(--ink-soft)', fontSize:8, fontWeight:650}}>
                    Device
                  </span>
                  {slotDevices.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && <span style={{color:'var(--line)', margin:'0 5px'}}>·</span>}
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* === Daily Ritual action hierarchy (May 2026 — Jenni redesign) ===
              For users who already have a built regimen, Home is the
              EXECUTION/CHECK-IN surface, not a product-building one.
              Hierarchy:
                1. Primary filled CTA — "Yes, I did my AM/PM ritual"
                   commits the slot's items as done + submitted=true.
                2. Secondary outlined — "Used something else?" opens
                   a today-only bottom sheet (From shelf / New product /
                   Procedure / Supplement-medication / Note only).
                3. Quiet text link — "Edit routine →" routes to
                   Regimen tab for future-plan changes.
              Removed from this surface (moved behind "Used something
              else?"): peer "+ From Shelf" + "+ New Product" pills.
              Those made Home read as setup-incomplete instead of
              execute-today. Functionality preserved via the sheet. */}
          {(() => {
            if (!isViewingToday) {
              return (
                <div className="grid grid-cols-1 gap-2 mt-4">
                  <button
                    onClick={() => setShowCheckInModal(true)}
                    className="pill-btn primary"
                    title={`Edit log for ${viewDayLabel}`}
                  >
                    <Icon name="Edit2" size={11} style={{marginRight:4}} />
                    <span className="truncate">Edit log</span>
                  </button>
                </div>
              );
            }
            // === State-aware CTA per Jenni's prompts 1, 3, 4 (May 2026) ===
            // Three states, three labels:
            //   1. all-checked (default)  → "Yes, I did my AM/PM ritual" (filled accent)
            //   2. some-skipped           → "Save AM/PM check-in" (filled accent)
            //   3. empty slot             → "Yes, I skipped AM/PM products" (filled accent)
            // Plus a fourth, terminal state:
            //   4. submitted today        → "✓ Today logged" status pill
            //                               (non-interactive — does NOT open the old
            //                               TodayRitualModal. Per Jenni: tapping
            //                               that surface "shouldn't be able to
            //                               pop up". User can still un-log with a
            //                               tiny adjacent "undo" link, or use
            //                               Used something else? / Edit routine.)
            const amHasItems = !!(sourceCheckIn && Array.isArray(sourceCheckIn.amProducts) && sourceCheckIn.amProducts.length > 0);
            const pmHasItems = !!(sourceCheckIn && Array.isArray(sourceCheckIn.pmProducts) && sourceCheckIn.pmProducts.length > 0);
            const ctaSlot = (amHasItems && !pmHasItems && !submittedToday) ? 'pm' : ritualSlot;
            const ctaList = ctaSlot === 'pm' ? pmList : amList;
            // Was this slot already submitted today? Read amDone/pmDone
            // on submitted logs to decide. amHasItems/pmHasItems only
            // tells us products exist; submittedSlot tells us this
            // specific slot has been committed.
            const slotSubmitted = !!(submittedToday && sourceCheckIn && (
              ctaSlot === 'pm'
                ? (Array.isArray(sourceCheckIn.pmDone) && sourceCheckIn.pmDone.length > 0) || pmHasItems
                : (Array.isArray(sourceCheckIn.amDone) && sourceCheckIn.amDone.length > 0) || amHasItems
            ));
            // Skipped IDs for the current slot (from prompt 3 model).
            const skippedKeyForCta = ctaSlot === 'pm' ? 'pmSkipped' : 'amSkipped';
            const skippedListForCta = sourceCheckIn && Array.isArray(sourceCheckIn[skippedKeyForCta]) ? sourceCheckIn[skippedKeyForCta] : [];
            const skippedSetForCta = new Set(skippedListForCta);
            const skippedCount = ctaList.filter(p => p && p.id && skippedSetForCta.has(p.id)).length;
            const hasSomeSkipped = skippedCount > 0 && ctaList.length > 0;
            const isEmptySlot = ctaList.length === 0;
            const ctaIcon = slotSubmitted ? 'Check' : (ctaSlot === 'pm' ? 'Moon' : 'Sun');
            const ctaLabel = slotSubmitted
              ? 'Today logged'
              : (isEmptySlot
                ? (ctaSlot === 'pm' ? 'Yes, I skipped PM products' : 'Yes, I skipped AM products')
                : (hasSomeSkipped
                  ? (ctaSlot === 'pm' ? 'Save PM check-in' : 'Save AM check-in')
                  : (ctaSlot === 'pm' ? 'Yes, I did my PM regimen' : 'Yes, I did my AM regimen')));
            // Inline save — writes the regimen log for viewDate with
            // exactly the checked products marked done (planned minus
            // skipped). Skipped IDs are preserved in the log so the
            // user can see what was missed without us mutating the
            // future routine. submitted=true commits today.
            const logRitualNow = () => {
              const amIds = amList.map(p => p && p.id).filter(Boolean);
              const pmIds = pmList.map(p => p && p.id).filter(Boolean);
              const existing = (regimenLogs || []).find(r => r.date === viewDate);
              const prevAmDone = existing && Array.isArray(existing.amDone) ? existing.amDone : [];
              const prevPmDone = existing && Array.isArray(existing.pmDone) ? existing.pmDone : [];
              const prevAmSkipped = existing && Array.isArray(existing.amSkipped) ? existing.amSkipped : [];
              const prevPmSkipped = existing && Array.isArray(existing.pmSkipped) ? existing.pmSkipped : [];
              // For the slot being committed: done = planned minus skipped.
              const commitSkipped = ctaSlot === 'am' ? prevAmSkipped : prevPmSkipped;
              const commitPlanned = ctaSlot === 'am' ? amIds : pmIds;
              const skippedSet = new Set(commitSkipped);
              const commitDone = commitPlanned.filter(id => !skippedSet.has(id));
              const nextLog = {
                ...(existing || {}),
                id: existing?.id || Date.now(),
                date: viewDate,
                amProducts: existing?.amProducts || amIds,
                pmProducts: existing?.pmProducts || pmIds,
                amDone: ctaSlot === 'am' ? commitDone : prevAmDone,
                pmDone: ctaSlot === 'pm' ? commitDone : prevPmDone,
                amSkipped: ctaSlot === 'am' ? commitSkipped : prevAmSkipped,
                pmSkipped: ctaSlot === 'pm' ? commitSkipped : prevPmSkipped,
                amExtras: existing?.amExtras || [],
                pmExtras: existing?.pmExtras || [],
                notes: existing?.notes || '',
                submitted: true,
                submittedAt: Date.now(),
              };
              const next = existing
                ? regimenLogs.map(r => r.date === viewDate ? nextLog : r)
                : [nextLog, ...regimenLogs];
              setRegimenLogs(next);
              setCoverRoutineRebuildToken(t => t + 1);
              saveData('regimenLogs', next).catch(e => {
                console.error('[ritual quick-log] saveData failed:', e);
                toast(`Save error: ${e?.message || 'unknown'}`, 'error');
              });
              toast(`${ctaSlot.toUpperCase()} ritual logged ✨`, 'success');
            };
            // Undo for the submitted state — clears the slot's
            // submitted commit (resets amDone/pmDone for THIS slot,
            // preserves the other slot, flips submitted iff both
            // slots are now empty of done items).
            const undoSlotLog = () => {
              const existing = (regimenLogs || []).find(r => r.date === viewDate);
              if (!existing) return;
              const nextLog = {
                ...existing,
                amDone: ctaSlot === 'am' ? [] : (existing.amDone || []),
                pmDone: ctaSlot === 'pm' ? [] : (existing.pmDone || []),
                submitted: ctaSlot === 'am'
                  ? ((existing.pmDone || []).length > 0)
                  : ((existing.amDone || []).length > 0),
              };
              const next = regimenLogs.map(r => r.date === viewDate ? nextLog : r);
              setRegimenLogs(next);
              setCoverRoutineRebuildToken(t => t + 1);
              saveData('regimenLogs', next).catch(() => {});
              toast(`${ctaSlot.toUpperCase()} log undone`, 'info');
            };
            return (
              <>
                {slotSubmitted ? (
                  // Tap-to-undo pill (May 2026 per Jenni). The
                  // status pill IS the undo trigger now — the
                  // separate Undo link below was extra noise.
                  // Tapping the pill reverts amDone/pmDone for
                  // this slot. Tooltip telegraphs the action.
                  // Does NOT open the old TodayRitualModal.
                  <button
                    type="button"
                    onClick={undoSlotLog}
                    className="w-full rounded-full py-3 px-4 flex items-center justify-center gap-2 mt-3 transition hover:opacity-80"
                    style={{
                      background: 'var(--cream-deep)',
                      color: 'var(--ink)',
                      border: '1px solid var(--line)',
                      fontWeight: 600, fontSize: 12.5, letterSpacing: '0.04em',
                      cursor: 'pointer',
                    }}
                    aria-label={`${ctaSlot.toUpperCase()} ritual logged for today — tap to undo`}
                    title={`Tap to undo today's ${ctaSlot.toUpperCase()} commit`}
                  >
                    <Icon name="Check" size={13} style={{color:'var(--sage)'}} />
                    <span className="truncate">Today logged</span>
                  </button>
                ) : (
                  <button
                    onClick={logRitualNow}
                    className="w-full rounded-full py-3 px-4 flex items-center justify-center gap-2 transition hover:opacity-90 mt-3"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--cream)',
                      border: '1px solid var(--accent)',
                      fontWeight: 600, fontSize: 12.5, letterSpacing: '0.04em', cursor: 'pointer',
                    }}
                    title={isEmptySlot
                      ? `Log ${ctaSlot.toUpperCase()} as bare for today (no products)`
                      : (hasSomeSkipped
                        ? `Save today's ${ctaSlot.toUpperCase()} check-in (${ctaList.length - skippedCount} done, ${skippedCount} skipped)`
                        : `Mark all ${ctaSlot.toUpperCase()} products as done for today`)}
                    type="button"
                  >
                    <Icon name={ctaIcon} size={13} />
                    <span className="truncate">{ctaLabel}</span>
                  </button>
                )}
                {/* Secondary — opens today-only bottom sheet. */}
                <button
                  onClick={() => setUsedSomethingElseSheet({ open: true, slot: ctaSlot, date: viewDate })}
                  className="w-full rounded-full py-2.5 px-4 flex items-center justify-center gap-1.5 transition hover:bg-[var(--cream)] mt-2"
                  style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11.5, letterSpacing:'0.02em', cursor:'pointer'}}
                  title="Add a one-off product, procedure, supplement, or note for today only"
                  type="button"
                >
                  <Icon name="Plus" size={12} />
                  <span>Used something else today? Add here</span>
                </button>
                {/* Quiet link — routes to Regimen tab → current
                    routine edit surface (NOT full rebuild) per
                    Jenni prompt 5. Sets regimenView to 'today'
                    which is the canonical edit-current-routine
                    surface. The Refine link inside that view
                    handles bigger strategy changes. */}
                {/* "Rebuild routine" (May 2026 v2 per Jenni) — clearer
                    than "Edit" because it sets expectation that this is
                    the place to redo the routine wholesale, not just nudge
                    a single product. Routes to the Regimen tab's editor
                    where add/remove/cadence all live. */}
                <button
                  onClick={() => { setActiveTab('regimen'); setRegimenView('today'); }}
                  className="w-full text-[10px] tracking-[0.22em] uppercase mt-3 transition hover:opacity-70 py-1 flex items-center justify-end gap-1"
                  style={{color:'var(--ink-soft)', cursor:'pointer', fontWeight:600}}
                  title="Rebuild your standing routine — add, remove, change cadence"
                  type="button"
                >
                  <span>Rebuild routine</span>
                  <Icon name="ArrowRight" size={10} />
                </button>
              </>
            );
          })()}
          {/* === TODAY'S ACTIVES CHIP ROW — REMOVED May 2026 ===
              Dropped from the cover per Jenni — redundant on this
              surface (product names already imply the actives, and
              the Rotation tab covers ingredient-pattern at depth).
              Cover stays focused on the ordered list. */}

          {/* === EXPORT — REMOVED May 2026 ===
              Dropped per Jenni — not useful right now. Cover ends
              cleanly with the action pills. handleCoverExport
              function left in place in case we want it back. */}
          {/* === LOGGED/GO TO REGIMEN FOOTER — REMOVED May 2026 ===
              Per Jenni: redundant on the cover. Logged state is
              implicit when products are shown; Regimen is one tap
              in the bottom nav. Footer dropped to give the
              ritual card more breathing room. */}
          {/* "Painting bottles…" indicator removed — runs silently. */}
          {/* Manual paint trigger removed — bottles auto-load via the
              useEffect that watches products + regimen. Inline error
              block also removed; quota / failure surfaces as a small
              floating chip near the bottom-right corner via a global
              renderer below. Keeps the cover free of mid-page error
              clutter. */}
        </section>
      );
  })()}

      {/* === TODAY'S NOTE ===
          Replaces the prior "Étude Insight: [pearl title]" strip,
          which read like a magazine article preview. Now it's a
          one-line observation keyed to the user's actual state —
          a friend with an opinion, not a content feed. Falls back
          to the pearl-of-day topic when nothing contextual fires.
          May 2026 per Jenni. */}
      {(() => {
      // Wave 8.3 fix (May 2026): pearlOfDay used to live in HomeDashboard's
      // outer scope. Re-derive here so the child stays self-contained.
      const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const pearlOfDay = LESSONS[dayOfYear % LESSONS.length];
      // Pull what we know about today to pick a contextual note.
      const todayKey = localDateISO();
      const tlog = (logs || []).find(l => l.date === todayKey);
      const snap = tlog?.metricSnapshot;
      const tc = (w) => w ? String(w).trim().charAt(0).toUpperCase() + String(w).trim().slice(1).toLowerCase() : '';
      const actives = (products || []).filter(p => !p.endDate)
        .flatMap(p => (p.activeIngredients || '').toLowerCase().split(/[,;]/));
      const hasActive = (re) => actives.some(a => re.test(a));
      // Pick ONE contextual note from a small library, ordered by
      // signal strength. First match wins. Each line is one
      // declarative observation in Tang & Gainey voice — direct,
      // dry, brief.
      const pickNote = () => {
        if (!snap) return null;
        const r  = tc(snap.redness);
        const h  = tc(snap.hydration);
        const t  = tc(snap.texture);
        const b  = tc(snap.breakouts);
        const ba = tc(snap.barrier);
        const s  = tc(snap.sensitivity);
        // Each note ships with three layers:
        //   body     = the headline observation (always visible)
        //   why      = mechanism / reasoning paragraph (on tap)
        //   evidence = single-line evidence anchor (on tap)
        // Keep WHY ≤2 sentences and EVIDENCE ≤1 sentence.
        if (ba === 'Stripped' || ba === 'Compromised') {
          return {
            eyebrow: 'Note',
            body: "Hold off on actives tonight. Barrier needs a beat to rebuild.",
            why: "A compromised barrier means the stratum corneum's lipid matrix is leaking water and letting irritants in. Adding actives (retinoids, acids, vit C) compounds the inflammation instead of treating it — the barrier has to heal first before anything else can land.",
            evidence: "Standard derm protocol: 3–7 days of barrier-only care (gentle cleanser, ceramide-rich moisturizer, SPF) reliably restores transepidermal water loss to baseline.",
          };
        }
        if (s === 'Inflamed' || s === 'Reactive') {
          return {
            eyebrow: 'Note',
            body: "Reactive day. Anything new this week is a suspect.",
            why: "Most skincare reactions show up 24–72 hours after introduction. If sensitivity spiked today and you started or swapped a product in the last few days, that's the likely culprit — not the products you've been using for months.",
            evidence: "Patch-test convention is 48 hours for a reason — delayed-type hypersensitivity peaks around day 2–3 post-exposure.",
          };
        }
        if (h === 'Parched' || h === 'Dry') {
          return {
            eyebrow: 'Note',
            body: "Hydration's down. Layer a humectant under the moisturizer, not over.",
            why: "Humectants (hyaluronic acid, glycerin, urea) pull water — from the air if humid, from your dermis if not. Without an occlusive layer trapping that water in, they can actually pull water OUT in dry environments. Moisturizer on top seals the gain.",
            evidence: "Hyaluronic acid serum followed by an occlusive moisturizer outperforms either alone in transepidermal water loss studies.",
          };
        }
        if (hasActive(/niacinamide/) && hasActive(/ascorb|vitamin\s*c/)) {
          return {
            eyebrow: 'Note',
            body: "You're stacking niacinamide with vitamin C. Despite the internet, that's fine.",
            why: "The incompatibility myth comes from a 1960s study using pure ascorbic acid + niacin at high heat — that produces niacin (flushing). At ambient temps, with stable ascorbyl derivatives or buffered C, the reaction doesn't happen meaningfully on skin.",
            evidence: "Commercial products have formulated these together for 20+ years (Olay Total Effects, SkinCeuticals AGE Eye Complex) without clinical issue.",
          };
        }
        if (hasActive(/retinol|tretinoin|adapalene|tazarotene/) && hasActive(/salicylic|glycolic|lactic|aha|bha/)) {
          return {
            eyebrow: 'Note',
            body: "Retinoid + acid — strong combo. Alternate nights or you'll feel it.",
            why: "Both increase cell turnover and can compromise the barrier independently. Stacked nightly, the cumulative irritation often exceeds the benefit. Alternating gives the skin a recovery window without sacrificing the actives' work.",
            evidence: "Most dermatologists recommend retinoid 3–4 nights/week with AHA/BHA on off-nights, especially during the first 8 weeks of retinoid use.",
          };
        }
        if (b === 'Many' || b === 'Severe') {
          return {
            eyebrow: 'Note',
            body: "Active breakouts. Spot-treat, don't whole-face. Be surgical.",
            why: "Whole-face benzoyl peroxide or salicylic dries skin that isn't breaking out, compromising barrier and ironically triggering more breakouts in the dry zones. Spot treatment targets the lesion without collateral.",
            evidence: "AAD guidelines: localized BPO 2.5–5% applied directly to inflammatory lesions performs comparably to full-face application with less irritation.",
          };
        }
        if (r === 'High' || r === 'Moderate') {
          return {
            eyebrow: 'Note',
            body: "Redness is louder today. Centella or zinc would earn its keep.",
            why: "Centella asiatica (madecassoside) reduces inflammatory cytokines and supports microcirculation. Zinc oxide is anti-inflammatory and barrier-supportive. Both calm vascular reactivity faster than just waiting it out.",
            evidence: "Centella has multiple RCTs for rosacea-prone redness; topical zinc has strong data in seborrheic dermatitis and post-inflammatory erythema.",
          };
        }
        if (t === 'Smooth' && b === 'Clear' && (r === 'Clear' || r === 'Low')) {
          return {
            eyebrow: 'Note',
            body: "Nothing's screaming today. Good week to bank the routine.",
            why: "When skin is calm, the routine you're on is working. This is the time to log it precisely (photo + products), not to switch things. The data you capture during a good stretch is what you'll reference when things get reactive later.",
            evidence: "Consistency, not novelty, drives skincare outcomes — most clinical trials show meaningful results only at 8–12 weeks of stable routine.",
          };
        }
        return null;
      };
      // === INGREDIENT TEACHING LIBRARY ===
      // Fires when the rule-based contextual note pickNote()
      // returns null (skin is calm, nothing urgent to flag).
      // Picks ONE ingredient the user isn't currently using
      // and introduces it conversationally: "Have you heard
      // of X? Here's why." Maps user's known concerns/goals
      // to a relevant ingredient teaching.
      const pickIngredientTeaching = () => {
        if (!snap) return null;
        // Concerns we can infer from today's snap + saved concerns
        const concerns = new Set((userConcerns || []).map(c => c.toLowerCase()));
        const r  = tc(snap.redness);
        const t  = tc(snap.texture);
        const b  = tc(snap.breakouts);
        // === INGREDIENT TEACHING TABLE ===
        // Each entry: gate (when to surface), name, intro line,
        // why, evidence. Order = priority. The "have you heard
        // of X?" voice is intentional — it's introductory,
        // teaching, not prescriptive.
        const teachings = [
          {
            // Hyperpigmentation — alpha arbutin
            gate: () => concerns.has('dark spots') || concerns.has('hyperpigmentation') || concerns.has('melasma'),
            ingredient: 'Alpha Arbutin',
            body: "Have you heard of alpha arbutin? Quieter than hydroquinone, similar end result.",
            why: "Alpha arbutin is a hydroquinone derivative that releases hydroquinone slowly over hours instead of all at once. The slower release means tyrosinase inhibition (the enzyme that makes melanin) without the irritation and rebound risk of straight HQ. Especially useful for melasma and PIH.",
            evidence: "At 2%, alpha arbutin matches HQ 4% for hyperpigmentation in 12-week trials — without the photosensitivity or rebound. The Ordinary's 2% Alpha Arbutin is well-formulated and inexpensive.",
          },
          {
            // Hyperpigmentation alt — tranexamic acid
            gate: () => (concerns.has('dark spots') || concerns.has('melasma') || concerns.has('hyperpigmentation')) && !hasActive(/tranexamic/),
            ingredient: 'Tranexamic Acid',
            body: "Have you heard of tranexamic acid? The internal-medicine drug that doubles as a melasma treatment.",
            why: "Originally used to slow bleeding, tranexamic acid (topically at 2–5%) interrupts the signaling between keratinocytes and melanocytes — it stops the call for pigment rather than blocking the pigment-making enzyme. That makes it useful for stubborn melasma where tyrosinase inhibitors plateau.",
            evidence: "RCTs show topical 3% tranexamic acid comparable to HQ 3% for melasma without the rebound. The Inkey List has a well-priced version.",
          },
          {
            // Texture / fine lines — bakuchiol
            gate: () => (concerns.has('fine lines') || concerns.has('aging') || concerns.has('texture')) && !hasActive(/retinol|tretinoin|retinaldehyde|adapalene|tazarotene|bakuchiol/),
            ingredient: 'Bakuchiol',
            body: "Have you heard of bakuchiol? Retinoid effect without the retinoid mess.",
            why: "Bakuchiol is a plant compound that activates the same gene-expression pathways as retinol (specifically, retinoic acid receptors) but without the photosensitivity, dryness, or pregnancy contraindication. Useful when retinoids don't fit your routine but you want the same downstream effect.",
            evidence: "A 2018 randomized split-face trial found bakuchiol 0.5% comparable to retinol 0.5% on wrinkles and pigmentation at 12 weeks — with significantly fewer side effects.",
          },
          {
            // Calm / sensitivity — centella
            gate: () => (concerns.has('redness') || concerns.has('sensitivity') || r === 'Mild' || r === 'Moderate') && !hasActive(/centella|cica|madecassoside/),
            ingredient: 'Centella Asiatica',
            body: "Have you heard of centella asiatica? Korean dermatology's quiet workhorse.",
            why: "Centella (also called 'cica' or 'gotu kola') contains four active compounds — madecassoside, asiaticoside, madecassic acid, and asiatic acid — that together reduce inflammatory cytokines, support collagen synthesis, and accelerate wound healing. Especially useful for rosacea-prone or post-procedure skin.",
            evidence: "Multiple RCTs for rosacea and atopic dermatitis. Skin1004's Madagascar Centella Ampoule is the gold-standard, but Purito and COSRX both formulate it well.",
          },
          {
            // Barrier — panthenol
            gate: () => !hasActive(/panthenol|provitamin\s*b5/),
            ingredient: 'Panthenol',
            body: "Have you heard of panthenol? Pro-vitamin B5 — boring on the label, quietly excellent.",
            why: "Panthenol converts to pantothenic acid (vitamin B5) once it's in the skin. It's both a humectant (binds water) and a barrier-supporter (boosts ceramide synthesis), and it has mild anti-inflammatory effect. Almost never causes irritation, which makes it useful in formulas where everything else might.",
            evidence: "Decades of clinical use in wound-care products (Bepanthen, Bepanthol). Modern serums like La Roche-Posay Cicaplast and Eucerin Aquaphor use it as the barrier-rebuild anchor.",
          },
          {
            // Universal — niacinamide if not using
            gate: () => !hasActive(/niacinamide/),
            ingredient: 'Niacinamide',
            body: "Have you heard of niacinamide? The multi-tasker that does five things at once.",
            why: "Vitamin B3 derivative. Hits five mechanisms in one molecule: reduces sebum, supports ceramide synthesis (barrier), inhibits melanin transfer (pigmentation), reduces inflammation (redness), and improves elasticity. At 5%, it's the most well-studied multi-tasker in skincare.",
            evidence: "Bissett et al. 2005 RCT: 5% niacinamide reduced hyperpigmentation, fine lines, and redness over 12 weeks. The Ordinary's 10% is overkill but cheap; Paula's Choice 10% Booster is well-buffered.",
          },
        ];
        return teachings.find(t => t.gate()) || null;
      };
      const ingredientTeaching = pickIngredientTeaching();
      // === Priority cascade ===
      //   1. Contextual NOTE (flags issues — "your barrier is compromised")
      //   2. Ingredient TEACHING (when skin is steady — introduces relevant ingredients)
      //   3. Pearl-of-day fallback (when even teaching doesn't fire)
      const contextual = pickNote() || ingredientTeaching;
      const isTeaching = !pickNote() && !!ingredientTeaching; // teaching mode = different eyebrow
      const eyebrowText = contextual
        ? (isTeaching ? `Did you know · ${ingredientTeaching.ingredient}` : contextual.eyebrow)
        : 'Étude Insight';
      const bodyText = contextual ? contextual.body : (pearlOfDay?.title || 'Consistency');
      const isContextual = !!contextual;
      const hasExplanation = isContextual && (contextual.why || contextual.evidence);
      const expanded = noteCardExpanded && hasExplanation;
      // Tap behavior:
      //   contextual + has explanation → toggle expansion
      //   contextual + no explanation  → no-op
      //   fallback (pearl)             → open the Lesson modal
      const handleClick = () => {
        if (hasExplanation) {
          setNoteCardExpanded(v => !v);
        } else if (!isContextual && pearlOfDay) {
          setOpenLesson(pearlOfDay);
        }
      };
      return (
        <div
          className="w-full rounded-[14px] overflow-hidden"
          style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}
        >
          <button
            onClick={handleClick}
            className="w-full px-4 py-3 flex items-center gap-3 transition hover:opacity-95 text-left"
            style={{cursor: hasExplanation || !isContextual ? 'pointer' : 'default'}}
            aria-label={hasExplanation
              ? (expanded ? "Collapse explanation" : "Tap to see why")
              : (isContextual ? "Today's note" : `Open Étude insight on ${bodyText}`)
            }
            aria-expanded={hasExplanation ? expanded : undefined}
          >
            <Icon name="Sparkles" size={14} style={{color:'var(--accent)', flexShrink:0}} />
            <div className="flex-1 min-w-0">
              <div className="text-[9.5px] tracking-[0.24em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>
                {eyebrowText}
              </div>
              <div className="text-[13px] leading-snug mt-0.5" style={{color:'var(--ink)', fontWeight: isContextual ? 400 : 500}}>
                {bodyText}
              </div>
            </div>
            {/* Right-side affordance — "Why" for contextual notes,
                "Read more" for the pearl fallback. Chevron rotates
                when expanded so the state is legible. */}
            {hasExplanation ? (
              <span className="text-[10px] tracking-[0.18em] uppercase flex items-center gap-1 flex-shrink-0 transition" style={{color:'var(--accent)', fontWeight:600}}>
                {expanded ? 'Close' : 'Why'}
                <Icon name="ChevronDown" size={11} style={{transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s'}} />
              </span>
            ) : !isContextual ? (
              <span className="text-[10px] tracking-[0.18em] uppercase flex items-center gap-1 flex-shrink-0" style={{color:'var(--accent)', fontWeight:600}}>
                Read more <Icon name="ArrowRight" size={11} />
              </span>
            ) : null}
          </button>
          {/* === EXPANDED EXPLANATION ===
              The why + evidence layer. Mechanism paragraph
              first (the reasoning), then a hairline divider,
              then a single-line evidence anchor. Quiet
              editorial styling — no accent fill, ink-soft
              for the eyebrows, var(--ink) for the prose. */}
          {expanded && (
            <div className="px-4 pb-4 pt-1 border-t" style={{borderColor:'var(--line)'}}>
              {contextual.why && (
                <div className="mt-3">
                  <div className="text-[8.5px] tracking-[0.28em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Why</div>
                  <p className="text-[12px] leading-relaxed" style={{color:'var(--ink)', fontWeight:400}}>
                    {contextual.why}
                  </p>
                </div>
              )}
              {contextual.evidence && (
                <div className="mt-3 pt-3 border-t" style={{borderColor:'var(--line)'}}>
                  <div className="text-[8.5px] tracking-[0.28em] uppercase mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Evidence</div>
                  <p className="text-[11.5px] leading-relaxed" style={{color:'var(--ink-soft)', fontWeight:400}}>
                    {contextual.evidence}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      );
  })()}

      {/* === THIS WEEK STRIP — REMOVED ===
          Standalone weekly glance card was duplicated against the
          Sunday Digest section in Journal. Per spec, weekly content
          has one canonical home now: Journal → Sunday Digest at the
          top of the page. The cover stays focused on today.
          Original render is wrapped in `false &&` below so the data
          computations are tree-shaken; restore by removing the gate. */}
      {false && (() => {
        const hasPhotoFn = (l) => l && (l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:')));
        // Build the current week (Mon–Sun) anchored to today.
        const tdy = new Date(); tdy.setHours(0,0,0,0);
        const dayIdx = tdy.getDay() === 0 ? 6 : tdy.getDay() - 1; // 0=Mon
        const weekStart = new Date(tdy); weekStart.setDate(tdy.getDate() - dayIdx);
        const weekDaysArr = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
          return {
            iso: localDateISO(d),
            name: ['MON','TUE','WED','THU','FRI','SAT','SUN'][i],
            isToday: d.getTime() === tdy.getTime(),
            isFuture: d.getTime() > tdy.getTime(),
          };
        });
        const weekStartLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
        const weekEndLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <section>
            <div className="flex items-baseline justify-between mb-3 px-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink)'}}>This Week</span>
                <span className="font-serif italic text-[12px]" style={{color:'var(--ink-soft)'}}>{weekStartLabel} – {weekEndLabel}</span>
              </div>
              <button
                onClick={() => setActiveTab('journal')}
                className="text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1 transition hover:opacity-70"
                style={{color:'var(--accent)'}}
              >
                View full week <Icon name="ArrowRight" size={11} />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1.5" style={{scrollSnapType:'x mandatory'}}>
              {weekDaysArr.map(d => {
                const dlog = (logs || []).find(l => l.date === d.iso && hasPhotoFn(l));
                const dreg = (regimenLogs || []).find(r => r.date === d.iso);
                const slot = dreg?.amProducts?.length > 0 ? 'am' : (dreg?.pmProducts?.length > 0 ? 'pm' : null);
                return (
                  <button
                    key={d.iso}
                    onClick={() => { setJournalDayDetail && setJournalDayDetail(d.iso); }}
                    className="flex-shrink-0 rounded-xl overflow-hidden transition hover:opacity-95 text-left"
                    style={{width:'82px', scrollSnapAlign:'start', background:'var(--cream)', border: d.isToday ? '1.5px solid var(--accent)' : '1px solid var(--line)'}}
                  >
                    <div className="text-[9px] tracking-[0.22em] uppercase pt-2 pb-1 text-center font-medium" style={{color: d.isToday ? 'var(--accent)' : 'var(--ink-soft)'}}>
                      {d.isToday ? 'TODAY' : d.name}
                    </div>
                    <div className="aspect-[3/4] mx-1.5 rounded-md overflow-hidden flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                      {dlog ? (
                        <Photo item={dlog} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center px-1">
                          <div className="font-serif italic text-[11px] leading-tight" style={{color:'var(--ink-soft)'}}>{d.isFuture ? 'Soon' : 'Rest Day'}</div>
                          <svg width="14" height="14" viewBox="0 0 24 24" className="mx-auto mt-1" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 21 L12 9" stroke="#9ca888" strokeWidth="1.4" strokeLinecap="round"/>
                            <path d="M12 13 C8 11, 7 8, 9 6 C12 7, 13 9, 12 13 Z" fill="#9ca888" fillOpacity="0.6"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-center pt-1 pb-2">
                      <Icon name={slot === 'pm' ? 'Moon' : 'Sun'} size={11} style={{color: dreg ? 'var(--accent)' : 'var(--ink-soft)'}} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* === Weekly summary footer ===
                 "N check-ins this week" + concern delta chips. Deltas come from
                 the existing skinIndex helpers, mapped to the mockup's wording
                 (Hydration improved / Redness calmed / Breakouts unchanged). */}
            {(() => {
              const checkInDays = weekDaysArr.filter(d => {
                const dlog = (logs || []).find(l => l.date === d.iso && hasPhotoFn(l));
                const dreg = (regimenLogs || []).find(r => r.date === d.iso);
                return !!(dlog || dreg?.submitted);
              }).length;
              // Translate skinIndex direction strings into mockup-style chips.
              const summarize = (label, dir, kind) => {
                // kind: 'pos' = up is good (hydration/texture); 'neg' = down is good (redness/breakouts).
                if (!dir || dir === 'flat') return { label, status: 'unchanged', color: 'var(--ink-soft)' };
                const improving = (kind === 'pos' && dir === 'up') || (kind === 'neg' && dir === 'down');
                const verb = kind === 'neg'
                  ? (improving ? 'calmed' : 'flared')
                  : (improving ? 'improved' : 'dipped');
                return { label, status: verb, color: improving ? 'var(--sage)' : 'var(--rose)' };
              };
              const chips = [
                summarize('Hydration', skinIndex?.positives?.barrier, 'pos'),
                summarize('Redness',   skinIndex?.negatives?.redness, 'neg'),
                summarize('Breakouts', skinIndex?.negatives?.breakouts, 'neg'),
              ];
              return (
                <div className="mt-4 pt-3 border-t" style={{borderColor:'var(--line)'}}>
                  <div className="flex items-center gap-1.5 mb-2 text-[11px]" style={{color:'var(--ink)'}}>
                    <Icon name="Check" size={11} style={{color:'var(--sage)'}} />
                    <span className="italic">
                      {checkInDays} check-{checkInDays === 1 ? 'in' : 'ins'} this week
                    </span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {chips.map(c => (
                      <div key={c.label} className="flex items-baseline gap-1 text-[10.5px]" style={{color:'var(--ink-soft)'}}>
                        <span className="font-medium" style={{color:'var(--ink)'}}>{c.label}</span>
                        <span className="italic" style={{color: c.color}}>{c.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        );
      })()}
    </div>
  );
};
