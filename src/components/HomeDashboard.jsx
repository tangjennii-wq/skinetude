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
  buildPlan,
  buildPlanAccepted,
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
  setShowGuidedCaptureModal,
  setGuidedCaptureCtx,
  setShowProductModal,
  setEditingProductId,
  setProductForm,
  setShowApiKeyModal,
  setActiveTab,
  setJournalViewOverride,
  setJournalMode,
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
  setShelfQuickAddOpen,
  setShowProcedureModal,
  setShowScoreExplainer,
  scoreExplainerSeen,
  setScoreExplainerSeen,
  setUserProfile,
  setShowTravelSetupModal,
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
  const [coverRitualMenuOpen, setCoverRitualMenuOpen] = useState(false);
  // === COVER HERO KEBAB (May 28 2026 per Jenni) ===
  // Three-dot menu in the upper-right of the cover Skin Snapshot card.
  // Carries the secondary navigation that used to live as a footer row
  // ("View journal · Compare photos") plus journal-timeline + insights
  // routes, plus a re-analyze escape hatch for the AI read. Replaces
  // the orphaned bottom-of-card link row that was duplicating top-nav
  // moves.
  const [coverHeroMenuOpen, setCoverHeroMenuOpen] = useState(false);
  const persistRegimenLogs = (nextLogs, label) => {
    saveData('regimenLogs', nextLogs).catch(e => {
      console.error(`[home regimen ${label}] saveData failed:`, e);
      toast(`Save error: ${e?.message || 'unknown'}`, 'error');
    });
  };
  // === PROCEDURE PROGRESS EXPORT (May 31 2026 per Jenni) ===
  // Ref attached to the Procedure Progress <section> so the kebab's
  // "Export / share" can render the card to a JPG via html2canvas
  // (CDN-loaded in index.html). See exportProcedureProgress below.
  const procedureProgressRef = useRef(null);
  // Bug #12 (May 31 2026): double-tap on Export → two html2canvas runs
  // against the same node → two downloads. Lock with a ref so the second
  // invocation is a no-op until the first finishes (cleared in finally).
  const isExportingRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => setCoverHydrated(true), 300);
    return () => clearTimeout(t);
  }, []);

  // === FIRST-TIME SCORE EXPLAINER AUTO-SHOW (REMOVED June 2026 per Jenni) ===
  // Was: useEffect that auto-opened the explainer 900ms after first
  // composite landed. User reported "shows analysis when not prompted" —
  // the auto-show felt like an unwelcome popup even with the 900ms delay
  // and per-device localStorage gate. Now: explainer NEVER auto-opens.
  // Still reachable from three explicit entry points (cover delta line,
  // cover kebab "How your score works", ProfileModal Settings link).
  // The `scoreExplainerSeen` localStorage flag is retained for back-compat
  // — kept in case we want to restore a first-time inline card later
  // (different surface than the popup, less intrusive).

  // Export the Procedure Progress card as a downloadable JPG. Triggered
  // from the kebab menu. Filename pattern keeps procedures organized in
  // the Downloads folder by date: procedure-progress-<slug>-<iso>.jpg.
  const exportProcedureProgress = async (procName) => {
    // Bug #12 race lock: bail if an export is already underway.
    if (isExportingRef.current) return;
    if (typeof window === 'undefined' || typeof window.html2canvas !== 'function') {
      toast && toast('Export not available offline', 'info');
      return;
    }
    const node = procedureProgressRef.current;
    if (!node) {
      toast && toast('Export failed — try again', 'error');
      return;
    }
    isExportingRef.current = true;
    try {
      const canvas = await window.html2canvas(node, { backgroundColor: '#FFFFFF', scale: 2 });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const slug = String(procName || 'procedure').toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'procedure';
      const iso = (typeof localDateISO === 'function') ? localDateISO() : new Date().toISOString().slice(0, 10);
      const filename = `procedure-progress-${slug}-${iso}.jpg`;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast && toast('Saved to downloads', 'success');
    } catch (err) {
      console.warn('[procedure-progress-export]', err);
      toast && toast('Export failed — try again', 'error');
    } finally {
      isExportingRef.current = false;
    }
  };

  // Pearl of the Day — deterministic by ISO date, rotates at midnight local.
  // Bug #19 (May 31 2026): when LESSONS is empty, `% 0` returns NaN and
  // LESSONS[NaN] is undefined — downstream `pearlOfDay.title` crashes.
  // Guard with a length check so we surface null when there's nothing to show.
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const pearlOfDay = LESSONS.length ? LESSONS[dayOfYear % LESSONS.length] : null;
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
  const startGuidedCheckIn = () => {
    if (typeof setGuidedCaptureCtx === 'function' && typeof setShowGuidedCaptureModal === 'function') {
      setGuidedCaptureCtx({ intent: 'check_in' });
      setShowGuidedCaptureModal(true);
      return;
    }
    setShowCheckInCamera(true);
  };

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
  //
  // T4 fix (May 31 2026): accepts an optional `snapshot` arg so the App-level
  // watcher at index.jsx.source:9685 can pass fresh values when this dashboard
  // hasn't re-rendered since the inputs changed (off-Home edits leave the
  // closure stale). Snapshot keys override closure values when provided.
  const buildCoverRoutine = async (snapshot = null) => {
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    const productsArg = (snapshot && Array.isArray(snapshot.products)) ? snapshot.products : products;
    const userConcernsArg = (snapshot && Array.isArray(snapshot.userConcerns)) ? snapshot.userConcerns : userConcerns;
    const sensitivitiesArg = (snapshot && Array.isArray(snapshot.sensitivities)) ? snapshot.sensitivities : sensitivities;
    const userProfileArg = (snapshot && snapshot.userProfile && typeof snapshot.userProfile === 'object') ? snapshot.userProfile : userProfile;
    const activePs = productsArg.filter(p => !p.endDate);
    if (activePs.length === 0) { toast('Add some products first', 'error'); return; }
    // Bug #3 fix (May 2026): capture identity at call-start so a
    // mid-call sign-out doesn't land the Claude response in the next
    // user's state. Check the snapshot before every setState/saveData.
    const userIdAtStart = user?.id;
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
      const concernsLine = (userConcernsArg || []).join(', ') || 'none specified';
      const sensLine = (sensitivitiesArg || []).join(', ') || 'none';
      // userProfileArg is captured for future barrier/Rx-aware prompting; not yet
      // threaded into the prompt template but available for the next iteration.
      void userProfileArg;

      // === DERMATOLOGY-GROUNDED ROUTINE PROMPT ===
      // Heavy guardrails: when the recent logs show redness/irritation/sensitivity, the
      // AI must downweight active acids/retinoids and prioritise barrier repair. When skin
      // is calm and improving, it can lean into actives. This is the difference between
      // a smart recommendation and "just put vitamin C on a flare-up".
      const prompt = `You are recommending today's AM and PM routine for a single user, choosing ONLY from their shelf below. This is an evidence-based decision — read the evidence first, THEN decide.

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
5. SPF is non-negotiable. Always include SPF in the AM ideal regardless of what's on the shelf. If the shelf has an SPF, slot it in AM. If the shelf has NO SPF, return a "criticalGap" field in the JSON output (see schema below) — DO NOT silently drop SPF from AM.
6. Order by derm best practice: cleanser → toner → serum (lightest first) → moisturizer → SPF (AM only). PM ends at moisturizer or treatment.

CRITICAL OUTPUT REQUIREMENTS:
- BOTH "am" and "pm" slots MUST contain at least 1 product if the shelf has any usable items. Empty slots are only acceptable when the shelf is genuinely empty.
- Return STRICT JSON only — no prose, no markdown fence, no explanation:
{
  "am": [{"product": "exact name from shelf"}],
  "pm": [{"product": "exact name from shelf"}],
  "criticalGap": { "type": "spf-missing", "message": "No sunscreen on your shelf — this is the single highest-leverage skincare gap. Even one drugstore mineral SPF 50 (e.g. EltaMD UV Clear, La Roche-Posay Anthelios) covers it." }
}
- Include the "criticalGap" field ONLY when the shelf has no sunscreen at all. Omit it otherwise.
- Each "product" must EXACTLY match a name from the shelf list.
- Max 5 products per slot.`;
      const result = await callClaude(prompt, '', null, { model: 'claude-haiku-4-5-20251001', maxTokens: 600 });
      // Bug #3 guard: bail if the user changed during the await.
      if (user?.id !== userIdAtStart) {
        console.warn('[buildCoverRoutine] user changed mid-call, bailing');
        return;
      }
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
      // Preserve criticalGap so the Home cover card can surface the
      // SPF-missing banner (only AI sets this; absent otherwise).
      if (parsed.criticalGap && typeof parsed.criticalGap === 'object' && parsed.criticalGap.type) {
        trimmed.criticalGap = {
          type: String(parsed.criticalGap.type),
          message: String(parsed.criticalGap.message || '')
        };
      }
      // Don't overwrite an existing routine with an empty one — protects against
      // AI returning [] when its decision tree skips everything (barrier-repair mode
      // with no gentle products on the shelf, etc.).
      if (trimmed.am.length === 0 && trimmed.pm.length === 0) {
        if (coverRoutine && typeof coverRoutine === 'object' && (((coverRoutine.am || []).length) || ((coverRoutine.pm || []).length))) {
          toast('Kept the previous routine — AI had nothing to swap to.', 'info');
        } else {
          toast('No routine fit your skin today — try again or check your shelf.', 'info');
          // Bug #3 guard: re-check identity before any cross-user write.
          if (user?.id !== userIdAtStart) {
            console.warn('[buildCoverRoutine] user changed mid-call, bailing');
            return;
          }
          setCoverRoutine(trimmed); // empty so UI shows the empty-state note
          await saveData('coverRoutine', trimmed);
        }
      } else {
        // Bug #3 guard: re-check identity before any cross-user write.
        if (user?.id !== userIdAtStart) {
          console.warn('[buildCoverRoutine] user changed mid-call, bailing');
          return;
        }
        setCoverRoutine(trimmed);
        await saveData('coverRoutine', trimmed);
        toast('Routine built ✨');
      }
    } catch (e) {
      console.warn('[buildCoverRoutine]', e);
      toast(`Build failed: ${e?.message || 'unknown error'}`, 'error');
    }
    setCoverRoutineLoading(false);
  };
  // Publish the latest closure for external triggers (modal submit, photo-log save).
  // T4 fix (May 31 2026): moved into useEffect — ref assignment during render
  // is a React anti-pattern (concurrent renders + Strict Mode double-invoke
  // could leave the ref pointing at a discarded closure). No dep array so it
  // refreshes on every render — cheap, since it's just a ref write.
  useEffect(() => {
    buildCoverRoutineRef.current = buildCoverRoutine;
  });
  // Display normalization — extract only product names (descriptors dropped per UX spec).
  const parsedCoverRoutine = (() => {
    if (!coverRoutine) return null;
    const trimSlot = (arr) => Array.isArray(arr)
      ? arr.map(it => ({ product: String(it.product || '').trim() })).filter(it => it.product)
      : [];
    if (typeof coverRoutine === 'object') {
      const out = { am: trimSlot(coverRoutine.am), pm: trimSlot(coverRoutine.pm) };
      if (coverRoutine.criticalGap && coverRoutine.criticalGap.type) out.criticalGap = coverRoutine.criticalGap;
      return out;
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
  // For positives: up = blue (good), down = rose (bad). For negatives: up = rose (bad), down = blue (good).
  const colorForPos = (dir) => dir === 'up' ? 'var(--accent-blue)' : dir === 'down' ? 'var(--rose)' : 'var(--ink-soft)';
  const colorForNeg = (dir) => dir === 'up' ? 'var(--rose)' : dir === 'down' ? 'var(--accent-blue)' : 'var(--ink-soft)';

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
    const stroke = trendDir === 'improving' ? 'var(--accent-blue)' : trendDir === 'worsening' ? 'var(--rose)' : 'var(--ink-soft)';
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
  // explore routines, Frida insight. Returning users with a
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
  const isFreshEmptyStart = (isExploring || isPartialProfile)
    && !completionInfo.hasPhotoCheckIn
    && !completionInfo.hasShelfProducts
    && !completionInfo.hasGeneratedRoutine;
  if (isFreshEmptyStart) {
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
    const freshPalette = {
      cream: '#ffffff',
      creamDeep: '#fffdf9',
      peach: '#fde6dc',
      blue: '#cfe7ee',
      red: 'var(--accent)',
      redSoft: 'rgba(229,60,45,0.10)',
      redLine: 'rgba(229,60,45,0.34)',
      redStrongLine: 'rgba(229,60,45,0.50)',
    };
    return (
      <div className="space-y-3 md:space-y-4 md:max-w-2xl md:mx-auto pb-6 px-4 md:px-6">
        {/* === GREETING (no name for fully empty users) === */}
        <section>
          <h1 className="font-sans text-[28px] md:text-[36px] leading-[1.05] tracking-tight" style={{color:'var(--ink)'}}>
            {greeting}{hasName ? `, ${firstName}` : '.'}
          </h1>
          <div className="text-[10px] tracking-[0.32em] uppercase mt-1.5" style={{color:'var(--ink-soft)'}}>
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </div>
        </section>

        {/* === TRAVEL MODE BANNER (June 2026 Phase 2) ===
            Surfaces when userProfile.travel.active === true. The whole
            row is tappable → opens TravelSetupModal so the user can
            edit destination/dates/packed routine. "End" link on the
            right flips travel.active = false (lightweight off switch
            without opening the modal). Banner uses --accent-blue tone
            (AWW powder blue) to read as travel-y without competing
            with the cover's red hero accent. */}
        {userProfile?.travel?.active && (
          <button
            type="button"
            onClick={() => { if (typeof setShowTravelSetupModal === 'function') setShowTravelSetupModal(true); }}
            className="w-full rounded-[14px] border px-3 py-2.5 flex items-center justify-between gap-3 text-left transition hover:opacity-90"
            style={{background:'color-mix(in srgb, var(--accent-blue) 12%, var(--cream))', borderColor:'color-mix(in srgb, var(--accent-blue) 28%, var(--line))', cursor:'pointer'}}
            aria-label="Travel mode active — tap to edit"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon name="Plane" size={13} style={{color:'var(--accent-blue)', flexShrink:0}} />
              <div className="min-w-0">
                <div className="text-[9.5px] tracking-[0.22em] uppercase" style={{color:'var(--accent-blue)', fontWeight:700}}>
                  Travel
                </div>
                <div className="text-[12px] leading-snug truncate" style={{color:'var(--ink)', fontWeight:600}}>
                  {userProfile.travel.destinationLabel || 'Trip routine on'}
                  {userProfile.travel.endDate ? (
                    <span style={{color:'var(--ink-soft)', fontWeight:400}}> · back {(() => {
                      try {
                        const d = new Date(userProfile.travel.endDate + 'T00:00:00');
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      } catch { return userProfile.travel.endDate; }
                    })()}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof setUserProfile === 'function') {
                  setUserProfile(prev => ({ ...prev, travel: { ...(prev?.travel || {}), active: false } }));
                }
                if (typeof saveData === 'function') {
                  try { saveData('userProfile', { ...userProfile, travel: { ...(userProfile.travel || {}), active: false } }); } catch (_) {}
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.currentTarget.click(); } }}
              className="text-[9px] tracking-[0.2em] uppercase flex-shrink-0"
              style={{color:'var(--ink-soft)', borderBottom:'1px dotted var(--ink-soft)', cursor:'pointer', fontWeight:650}}
            >
              End
            </span>
          </button>
        )}

        {/* === UPCOMING TRAVEL PREVIEW BANNER (June 2026 Phase 2.5) ===
            Shows when the user has pre-built a trip (startDate in future,
            products[] populated) but travel.active is still false. Tappable
            → opens TravelSetupModal so the user can refine the packing
            list before departure. Differs from the active banner with
            "Upcoming" eyebrow + days-until count. Hidden once auto-flip-ON
            kicks in (then the active banner above takes over). */}
        {(() => {
          const tr = userProfile?.travel;
          if (!tr || tr.active) return null;
          if (!tr.startDate) return null;
          if (!Array.isArray(tr.products) || tr.products.length === 0) return null;
          const today = (() => {
            try { return new Date().toISOString().slice(0, 10); } catch { return ''; }
          })();
          if (!today || tr.startDate <= today) return null;
          let daysUntil = 0;
          try {
            const ms = new Date(tr.startDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
            daysUntil = Math.max(0, Math.round(ms / 86400000));
          } catch {}
          let startLabel = tr.startDate;
          try {
            startLabel = new Date(tr.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          } catch {}
          return (
            <button
              type="button"
              onClick={() => { if (typeof setShowTravelSetupModal === 'function') setShowTravelSetupModal(true); }}
              className="w-full rounded-[14px] border px-3 py-2.5 flex items-center justify-between gap-3 text-left transition hover:opacity-90"
              style={{background:'color-mix(in srgb, var(--accent-blue) 6%, var(--cream))', borderColor:'color-mix(in srgb, var(--accent-blue) 22%, var(--line))', cursor:'pointer'}}
              aria-label="Upcoming travel — tap to view or refine"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name="Plane" size={13} style={{color:'var(--accent-blue)', flexShrink:0, opacity:0.7}} />
                <div className="min-w-0">
                  <div className="text-[9.5px] tracking-[0.22em] uppercase" style={{color:'var(--accent-blue)', fontWeight:700}}>
                    Upcoming · in {daysUntil}d
                  </div>
                  <div className="text-[12px] leading-snug truncate" style={{color:'var(--ink)', fontWeight:600}}>
                    {tr.destinationLabel || 'Trip'}
                    <span style={{color:'var(--ink-soft)', fontWeight:400}}> · {startLabel} · {tr.products.length} packed</span>
                  </div>
                </div>
              </div>
              <span className="text-[9px] tracking-[0.2em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)', borderBottom:'1px dotted var(--ink-soft)', fontWeight:650}}>
                View
              </span>
            </button>
          );
        })()}

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
        <section className="rounded-[16px] px-4 py-4 md:px-6 md:py-5" style={{
          background: '#ffffff',
          border: `1.5px solid ${freshPalette.redStrongLine}`,
          boxShadow: '0 8px 18px rgba(122, 75, 48, 0.045)',
        }}>
          {/* === EMPTY-STATE GRID (May 2026 v2 per Jenni) ===
              Was: 0.44 / 0.56 with a 132–200px tall oval — title
              "Your skin story starts here." wrapped into 5 narrow
              lines on mobile. Now: 0.32 / 0.68 with a square 108–132px
              circle. Frees ~50px for the text column so the title
              fits in 2 lines like the populated cover. */}
          <div
            className="grid items-center gap-4 md:gap-8"
            style={{gridTemplateColumns: 'minmax(112px, 0.36fr) minmax(0, 0.64fr)'}}
          >
            <div className="flex justify-start">
              <div className="flex flex-col items-center gap-1.5" style={{width: 'clamp(112px, 30vw, 132px)'}}>
                <button
                  type="button"
                  onClick={startGuidedCheckIn}
                  className="flex flex-col items-center justify-center transition hover:brightness-[0.97]"
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    background: '#ffffff',
                    border: `2px dashed ${freshPalette.redStrongLine}`,
                    boxShadow: 'none',
                    padding: '0 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Take a skin check-in"
                  title="Tap to take your first skin check-in"
                >
                  <Icon name="Camera" size={22} style={{color:'var(--accent)'}} />
                  <div style={{fontSize: 10, marginTop: 6, lineHeight: 1.2, color:'var(--ink)', fontWeight: 700, whiteSpace:'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase'}}>Tap to begin</div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHomeUploadPicker(true)}
                  className="inline-flex items-center justify-center transition hover:opacity-70"
                  style={{
                    gap: 5,
                    padding: '4px 0',
                    background: 'transparent',
                    border: '0',
                    color: 'var(--accent)',
                    fontSize: 9.5,
                    fontWeight: 750,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  aria-label="Upload photos from library"
                  title="Upload one or more existing photos to backfill your timeline"
                >
                  <Icon name="Upload" size={10} style={{color:'var(--accent)'}} />
                  <span>Upload</span>
                </button>
              </div>
            </div>
            <div className="min-w-0">
              <div style={{fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6, whiteSpace: 'nowrap'}}>Check-In</div>
              <h2
                className="text-[22px] md:text-[24px]"
                style={{lineHeight: 1.05, letterSpacing: '-0.022em', fontWeight: 750, color: 'var(--ink)', marginBottom: 8, whiteSpace: 'nowrap'}}
              >Start here.</h2>
              <p style={{fontSize: 12.5, lineHeight: 1.35, color: 'var(--ink-soft)', marginBottom: 10, whiteSpace:'nowrap'}}>One photo. Then routine.</p>
              <button
                type="button"
                onClick={() => setSampleRoutinePreview(FOUNDATIONAL_SAMPLE_ROUTINE)}
                className="inline-flex items-center transition hover:opacity-70"
                style={{
                  gap: 5, padding: '4px 0',
                  background: 'transparent', color: 'var(--accent)',
                  border: '0',
                  borderRadius: 0,
                  boxShadow: 'none',
                  fontSize: 10, fontWeight: 750, letterSpacing: '0.16em',
                  textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <span className="sm:hidden">Samples</span>
                <span className="hidden sm:inline">Explore sample routines</span>
                <Icon name="ArrowRight" size={10} />
              </button>
            </div>
          </div>
        </section>

        {/* === WHERE TO START + A SIMPLE START — 2-col side-by-side === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
          {/* === WHERE TO START — three-step progress card with INDIVIDUAL CTAs ===
              Replaces the static "Why Frida" card. Each step has its
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
                onClick: startGuidedCheckIn,
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
              <section className="rounded-[14px] px-5 py-5" style={{background:'#ffffff', border: `1.5px solid ${freshPalette.redLine}`, boxShadow: '0 6px 14px rgba(122,75,48,0.035)'}}>
                <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color:'var(--accent)', marginBottom: 6}}>Where to start</div>
                <h3 style={{fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.018em', fontWeight: 700, color:'var(--ink)', marginBottom: 14}}>Three moves today.</h3>
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
                              ? freshPalette.red
                              : freshPalette.redSoft,
                            border: s.done
                              ? `2px solid ${freshPalette.red}`
                              : `2px solid ${freshPalette.redLine}`,
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
                                background: 'transparent',
                                color: 'var(--accent)',
                                border: '0',
                                borderRadius: 0,
                                padding: '3px 0',
                                boxShadow: 'none',
                                fontWeight: 750,
                                fontSize: 10,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
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
          <section className="rounded-[14px] px-5 py-5" style={{background:'#ffffff', border: `1.5px solid ${freshPalette.redLine}`, boxShadow: '0 6px 14px rgba(122,75,48,0.035)'}}>
            <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color:'var(--accent)', marginBottom: 6}}>A Simple Start</div>
            <h3 style={{fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.018em', fontWeight: 700, color:'var(--ink)', marginBottom: 4}}>A sample routine.</h3>
            <p style={{fontSize: 12.5, lineHeight: 1.4, color:'var(--ink-soft)', marginBottom: 14}}>You can personalize anytime.</p>
            <div className="rounded-[10px] px-3.5 py-3.5 mb-3" style={{background:'#ffffff', border: `1.5px solid ${freshPalette.redLine}`}}>
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
                background:freshPalette.red,
                color:'var(--cream)',
                border:`2px solid ${freshPalette.red}`,
                boxShadow:'0 5px 12px rgba(229,60,45,0.16)',
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
            <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 650, color:'var(--accent)'}}>Explore Sample Routines</div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {SAMPLE_ROUTINES.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSampleRoutinePreview(r)}
                className="text-left transition hover:bg-[var(--cream-deep)] p-[10px] md:p-[14px]"
                style={{
                  background:'var(--cream)',
                  border: `1.5px solid ${freshPalette.redLine}`,
                  borderRadius: 12,
                  cursor:'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <span className="inline-flex items-center justify-center" style={{width: 26, height: 26, borderRadius: '50%', background:freshPalette.redSoft, border:`1.5px solid ${freshPalette.redLine}`, flexShrink: 0}}>
                  <Icon name={r.icon} size={12} style={{color:'var(--accent)'}} />
                </span>
                <div className="text-[11.5px] md:text-[13px]" style={{color:'var(--ink)', fontWeight: 600, letterSpacing:'-0.008em', lineHeight: 1.2}}>{r.label}</div>
                <div className="text-[10px] md:text-[11.5px]" style={{lineHeight: 1.3, color:'var(--ink-soft)'}}>{r.blurb}</div>
              </button>
            ))}
          </div>
        </section>

        {/* === FRIDA INSIGHT === quiet */}
        <section
          className="rounded-[14px] px-5 py-5"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(229,60,45,0.16)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} />
            <div style={{fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color:'var(--accent)'}}>Frida Insight</div>
          </div>
          <h3 style={{fontSize: 18, lineHeight: 1.15, letterSpacing: '-0.018em', fontWeight: 700, color:'var(--ink)', marginBottom: 6}}>Consistency is good.<br/>Smart consistency is better.</h3>
          <p style={{fontSize: 12.5, lineHeight: 1.45, color:'var(--ink-soft)'}}>Small, intentional choices compound into healthier skin over time.</p>
        </section>

        {/* === PARTIAL PROFILE — extra invite to add products === */}
        {isPartialProfile && (
          <section className="rounded-[14px] px-5 py-4 flex items-center gap-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
            <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
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
    // (May 28 2026 per Jenni) Added pt-3 md:pt-6 so the greeting has
    // breathing room beneath the sticky top nav — without it the page
    // header was being visually clipped on desktop scroll.
    <div className="space-y-3 md:space-y-4 md:max-w-[430px] md:mx-auto pt-3 md:pt-6 pb-6">
      {/* === GREETING === Date sits below as a small uppercase eyebrow.
           Leaf sprig removed 2026-05-31 per design-direction audit
           (one focal point per section). */}
      <section>
        <h1 className="font-sans text-[28px] md:text-[36px] leading-[1.05] tracking-tight" style={{color:'var(--ink)'}}>
          {greeting}, {(user?.name || 'friend').split(' ')[0]}
        </h1>
        {/* Date eyebrow — date only (May 29 v6 per Jenni).
            Streak moved into the Check-in card right column, under
            the View analysis link — pairs the daily focal info. */}
        <div className="flex items-center gap-2 mt-1.5 text-[10px] tracking-[0.32em] uppercase" style={{color:'var(--ink-soft)'}}>
          <span>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</span>
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
      // === NEWEST WINS (May 2026 bug fix per Jenni) ===
      // Was: strict area === 'full-face' filter ran first, so an OLD
      // full-face photo beat a NEW non-full-face photo. Adding a fresh
      // photo set (e.g. forehead close-ups) didn't update the cover
      // because nothing in the new set matched the strict filter.
      // Now: sort all of today's photos by id desc — newest wins by
      // default. The dailyCoverPick override still trumps everything
      // so a manual user pin sticks. Full-face is preferred only as a
      // soft tiebreaker when two photos share the same id (rare).
      const todaysByRecency = [...todaysPhotoLogs].sort((a, b) => (b.id || 0) - (a.id || 0));
      const overridePick = (heroIsViewingToday && dailyCoverPick && dailyCoverPick[todayStr])
        ? logs.find(l => l.id === dailyCoverPick[todayStr])
        : null;
      const todayLog = overridePick || todaysByRecency[0] || null;
      const hasTodayPhoto = hasPhoto(todayLog);
      // === WITHIN-DAY PHOTO PAGER (May 2026 per Jenni) ===
      // Index + total for the small "1 of N · see others" affordance
      // below the cover photo. Index follows the visible todayLog so
      // taps move the user through todaysByRecency in newest→oldest
      // order. Only renders when there are 2+ photos today.
      const todayPhotoIndex = todayLog ? todaysByRecency.findIndex(l => l.id === todayLog.id) : -1;
      const todayPhotoCount = todaysByRecency.length;
      // Metric quartet — shows AI-rated level word + arrow + % change vs the
      // most recent prior log with a snapshot. Score map normalizes each metric
      // to a 0-100 scale where higher = better outcome (cleaner skin, plumper
      // hydration, smoother texture, fewer breakouts). Two metric kinds:
      //   - pos (hydration, texture): higher score → MORE of a good thing → ↑ arrow + blue
      //   - neg (redness, breakouts): higher score → LESS of a bad thing → ↓ arrow + blue
      // Color is always blue for improvement, rose for worsening, ink-soft for flat.
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
      // === COMPOSITE INDEX v1 (June 2026 per Jenni) ===
      // Was: local unweighted mean of 6 categorical domains. Now: goal-
      // weighted blend of AI photo (50%) + noticed chips (30%) + 1-10
      // rating (20%), with sensitivity dropped as an outcome domain.
      // Uses the shared computeCompositeScore so cover + Skin Read
      // drawer + Compare + Journal can never disagree on the number.
      const goalKey = userProfile?.actionGoal || 'MAINTENANCE';
      const todayDisplay = todayLog ? displayScore(todayLog, goalKey) : null;
      const todayCompositeFull = todayLog ? computeCompositeScore(todayLog, goalKey) : null;
      const todayAvg = todayCompositeFull?.composite ?? null;
      // Find the most recent prior log (different date) for the metric-tile
      // delta arrows. Still uses metricSnapshot only (the tiles compare
      // visual deltas, not the full composite).
      const priorLogWithSnap = logs
        .filter(l => l.id !== todayLog?.id && l.metricSnapshot && l.date !== todayStr)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const priorSnap = priorLogWithSnap?.metricSnapshot || null;
      const priorAvg = priorSnap ? (() => {
        const vals = ['redness','hydration','texture','breakouts','barrier']
          .map(k => SCORE_MAP[k]?.[titleCase(priorSnap[k])])
          .filter(v => typeof v === 'number');
        return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      })() : null;
      // === BASELINE + DELTA (June 2026) ===
      // Baseline = median of first 10 qualifying logs. Mode-gated copy:
      //   establishing (n<7): "Anchoring baseline · Day X of 10"
      //   forming (7-9):      surface ONE most-benign pattern, no delta yet
      //   anchored (10+):     show delta vs baseline
      //   refreshing (90+d):  prompt re-anchor (UX in next pass)
      const baseline = computeBaseline(logs || [], goalKey);
      const baselineDelta = (baseline.mode === 'anchored' && todayCompositeFull?.composite != null)
        ? computeBaselineDelta(todayCompositeFull, baseline)
        : null;
      const mostBenignPattern = baseline.mode === 'forming'
        ? pickMostBenignPattern(logs || [], goalKey)
        : null;
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
            color = 'var(--accent-blue)';
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
      // === METRIC ICON MAPPER (May 28 2026 per Jenni) ===
      // Editorial glyphs for the delta + steady chips. Each metric
      // gets a Lucide icon that visually evokes its meaning, so the
      // chips read as scannable iconography rather than a row of
      // identical pills. Falls back to Circle for any unmapped label.
      const metricIcon = (label) => {
        const k = String(label || '').toLowerCase();
        if (k.includes('hydration')) return 'Droplet';
        if (k.includes('redness'))   return 'Flame';
        if (k.includes('texture'))   return 'Waves';
        if (k.includes('breakout'))  return 'CircleDot';
        if (k.includes('barrier'))   return 'Shield';
        if (k.includes('sensitiv'))  return 'Activity';
        if (k.includes('clear'))     return 'Check';
        return 'Circle';
      };
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
            const improved = m.color === 'var(--accent-blue)';
            return {
              label: m.label,
              from: priorWord || '—',
              to: m.level,
              dir: m.dir,           // 'up' | 'down'
              improved,             // true = blue, false = rose
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
      const openJournalTimeline = () => {
        setActiveTab('journal');
        if (typeof setJournalMode === 'function') setJournalMode('timeline');
        if (typeof setJournalViewOverride === 'function') setJournalViewOverride(null);
      };
      const openTodayRoutine = () => {
        setActiveTab('regimen');
        if (typeof setRegimenView === 'function') setRegimenView('today');
      };
      const todayRegimenLog = (regimenLogs || []).find(r => r.date === todayStr);
      // === DONE detection — slot-specific only (May 29 2026 v4 per Jenni) ===
      // The "submitted + slot has products" fallback got dropped — it
      // fired for PM the moment AM was committed (because pmProducts
      // is populated as soon as the log exists). False positive bug
      // worse than missing tier 3 entirely. Now strictly: slot is
      // done iff the writer marked the slot-specific fields. New
      // commits always set one of these; older logs that lack both
      // will read as not-done until the user re-confirms.
      const amDone = !!(todayRegimenLog && (
        (Array.isArray(todayRegimenLog.amDone) && todayRegimenLog.amDone.length > 0) ||
        todayRegimenLog.amBatchConfirmed === true
      ));
      const pmDone = !!(todayRegimenLog && (
        (Array.isArray(todayRegimenLog.pmDone) && todayRegimenLog.pmDone.length > 0) ||
        todayRegimenLog.pmBatchConfirmed === true
      ));
      // Done/Missing language (May 31 2026 per Jenni). Compact metric badge —
      // mirrors the regimen card eyebrow but trimmed for the 3-letter slot.
      const routineReadout = amDone && pmDone ? 'Done' : amDone ? 'AM done' : pmDone ? 'PM done' : 'Missing';
      const trendReadout = !priorSnap || !todaySnap
        ? '—'
        : (deltaChips || []).some(d => d.improved === false)
          ? 'watch'
          : (deltaChips || []).some(d => d.improved === true)
            ? 'improving'
            : 'steady';
      const signalReadout = (() => {
        if (!todaySnap) return '—';
        const redness = metricSpec.find(m => m.label === 'Redness' && m.level);
        const breakouts = metricSpec.find(m => m.label === 'Breakouts' && m.level);
        const hydration = metricSpec.find(m => m.label === 'Hydration' && m.level);
        if (redness) return `${redness.level.toLowerCase()} redness`;
        if (breakouts) return breakouts.level.toLowerCase() === 'clear' ? 'clear' : `${breakouts.level.toLowerCase()} breakouts`;
        if (hydration) return `${hydration.level.toLowerCase()} hydration`;
        return 'steady';
      })();
      const statusTiles = [
        {
          label: 'Read',
          value: todayAvg != null ? (todayAvg / 10).toFixed(1) : '—',
          tone: 'accent',
          action: hasTodayPhoto ? openTodayAnalysis : startGuidedCheckIn,
          title: hasTodayPhoto ? 'Open full skin read' : 'Take a skin check-in',
        },
        {
          label: 'Trend',
          value: trendReadout,
          tone: trendReadout === 'improving' ? 'blue' : 'accent',
          action: openJournalTimeline,
          title: 'Open skin timeline',
        },
        {
          label: 'Routine',
          value: routineReadout,
          tone: amDone || pmDone ? 'blue' : 'accent',
          action: openTodayRoutine,
          title: "Open today's routine",
        },
        {
          label: 'Signal',
          value: signalReadout,
          tone: 'accent',
          action: hasTodayPhoto ? openTodayAnalysis : startGuidedCheckIn,
          title: hasTodayPhoto ? 'Open metric details' : 'Take a skin check-in',
        },
      ];
      const steadyChips = priorSnap && todaySnap
        ? metricSpec
            .filter(m => m.level && !m.dir)
            .map(m => ({
              label: m.label === 'Breakouts' ? 'Breakouts' : m.label,
              value: m.label === 'Breakouts' && m.level.toLowerCase() === 'clear' ? 'clear' : m.level.toLowerCase(),
            }))
            .slice(0, 2)
        : [];
      const priorNudge = (() => {
        if (!priorSnap) return null;
        const r = titleCase(priorSnap.redness);
        const h = titleCase(priorSnap.hydration);
        const b = titleCase(priorSnap.breakouts);
        const t = titleCase(priorSnap.texture);
        const score = priorAvg != null ? (priorAvg / 10).toFixed(1) : null;
        const day = priorLogWithSnap?.date === heroYesterdayKey ? 'Yesterday' : 'Last read';
        if ((h === 'Plump' || h === 'Good') && (r === 'Clear' || r === 'Low')) {
          return `${day}${score ? ` ${score}` : ''}. See if it held.`;
        }
        if (r === 'High' || r === 'Moderate') {
          return `${day}: redness. Check before blaming routine.`;
        }
        if (b && b !== 'Clear') {
          return `${day}: breakout signal. Check if it cooled.`;
        }
        if (t === 'Smooth' || b === 'Clear') {
          return `${day}${score ? ` ${score}` : ''}. See if it holds.`;
        }
        return `${day}${score ? ` ${score}` : ''}. Fill in today.`;
      })();
      return (
        // === TAP-ANYWHERE (May 28 2026 per Jenni) ===
        // Whole card routes to the primary action for the state:
        //   - photo + analysis ready → opens analysis drawer
        //   - photo but still analyzing → opens drawer to loading state
        //   - no photo yet → starts guided check-in
        // Inner controls (date pager, score, routine chip, Read
        // Analysis pill, View journal, Compare photos, API key
        // prompt) all stopPropagation so they keep their own jobs.
        // Photo button and score button route to the same action so
        // their stopPropagation is for cleanliness, not correctness.
        <section
          className="atelier-card px-5 py-5 md:px-6 md:py-5"
          onClick={() => {
            if (hasTodayPhoto) {
              openTodayAnalysis();
            } else if (typeof setShowCheckInChooser === 'function') {
              setShowCheckInChooser(true);
            } else {
              startGuidedCheckIn();
            }
          }}
          style={{
            cursor: 'pointer',
            // === HERO RED BORDER — bold on outer only (May 30 v4 per Jenni) ===
            // Outer card wears 1.5px var(--accent). Inner card elements
            // (metric strip, AM/PM pill, dividers) use faint var(--line).
            border: '1.5px solid var(--accent)',
            boxShadow: '0 1px 2px rgba(229,60,45,0.06), 0 8px 22px rgba(229,60,45,0.06)',
          }}
        >
          {/* === STATUS EYEBROW (May 28 2026 v2 per Jenni) ===
              Today's glance: streak count + three subtle status
              indicators (check-in / routine AM / routine PM). No
              voice commentary — just the facts, small. Sage check
              when done, ink-soft x when not yet. The check-in dot
              shadows the photo oval (since the oval is already
              right there) but acts as a quiet "this counted"
              confirmation. */}
          {/* === STATUS EYEBROW (May 29 2026 v12 per Jenni) ===
              Sentence form. The Check-in card eyebrow only tracks
              check-in now — routine status moved to the Regimen card
              eyebrow (its job). Conversational copy, brand colors
              carry done vs missing. */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* === EYEBROW — always on, neutral ink (May 29 v5 per Jenni) ===
                Black text both states. Lets the red border + kebab
                carry the pop; eyebrow is the quiet status label. */}
            <div className="text-[9.5px] tracking-[0.04em]" style={{fontWeight:650, textTransform:'uppercase', color:'var(--ink)', whiteSpace:'nowrap'}}>
              {hasTodayPhoto ? 'Checked in ✓' : 'Ready to check-in?'}
            </div>
            <div className="flex items-center gap-2">
              <div className="date-pager">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); shiftHeroDay(-1); }}
                  disabled={heroDaysBack >= HERO_MAX_DAYS_BACK}
                  aria-label="Previous day"
                  title="Previous day"
                >
                  <Icon name="ChevronLeft" size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (!heroIsViewingToday) setRitualViewDate(todayStr); }}
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
                  onClick={(e) => { e.stopPropagation(); shiftHeroDay(1); }}
                  disabled={heroIsViewingToday}
                  aria-label="Next day"
                  title="Next day"
                >
                  <Icon name="ChevronRight" size={13} />
                </button>
              </div>
              {/* === HERO KEBAB MENU (May 28 2026 per Jenni) ===
                  Secondary nav for this card. Items vary by state
                  (today + photo vs today-empty vs past day). Closes
                  on item tap, same pattern as the Regimen kebab below.
                  Outside-click-close isn't wired (matches existing
                  cover-card pattern) — tap kebab again or tap item. */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCoverHeroMenuOpen(v => !v); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition"
                  style={{
                    // === KEBAB POP (May 29 v4 per Jenni) ===
                    // Red-on-white pop — echoes the hero accent border
                    // and gives the upper-right a punctuation mark.
                    color: 'var(--accent)',
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary-soft)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  aria-label="More options"
                  aria-expanded={coverHeroMenuOpen}
                  title="More"
                >
                  <Icon name="MoreHorizontal" size={14} />
                </button>
                {coverHeroMenuOpen && (
                  <div
                    className="absolute right-0 top-9 z-30 w-56 rounded-[14px] overflow-hidden shadow-xl"
                    style={{background:'var(--cream)', border: '1px solid var(--line)'}}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Today-only actions — hidden when paging back. */}
                    {heroIsViewingToday && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCoverHeroMenuOpen(false);
                            if (typeof setShowCheckInChooser === 'function') {
                              setShowCheckInChooser(true);
                            } else {
                              startGuidedCheckIn();
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                          style={{color:'var(--ink)', cursor:'pointer'}}
                        >
                          <Icon name="Camera" size={13} style={{color:'var(--accent)'}} />
                          <span className="text-[10.5px] tracking-[0.12em] uppercase">
                            {hasTodayPhoto ? 'Add another check-in' : 'Check in'}
                          </span>
                        </button>
                        {hasTodayPhoto && todayLog?.id != null && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverHeroMenuOpen(false);
                              if (typeof retryLogAnalysis === 'function') retryLogAnalysis(todayLog.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                            style={{color:'var(--ink-soft)', cursor:'pointer'}}
                          >
                            <Icon name="RefreshCw" size={13} />
                            <span className="text-[10.5px] tracking-[0.12em] uppercase">Re-analyze</span>
                          </button>
                        )}
                      </>
                    )}
                    {/* Navigation block — present on all states. Border-top
                        only renders when today-actions sit above it. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverHeroMenuOpen(false);
                        setActiveTab('journal');
                        if (typeof setJournalViewOverride === 'function') setJournalViewOverride(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                      style={{color:'var(--ink-soft)', cursor:'pointer', borderTop: heroIsViewingToday ? '1px solid var(--line)' : 'none'}}
                    >
                      <Icon name="BookOpen" size={13} />
                      <span className="text-[10.5px] tracking-[0.12em] uppercase">Open journal</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverHeroMenuOpen(false);
                        setActiveTab('journal');
                        if (typeof setJournalViewOverride === 'function') {
                          // Defer so journal mounts before override applies.
                          setTimeout(() => setJournalViewOverride('timeline'), 0);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                    >
                      <Icon name="Calendar" size={13} />
                      <span className="text-[10.5px] tracking-[0.12em] uppercase">Timeline</span>
                    </button>
                    {canComparePhotos && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCoverHeroMenuOpen(false);
                          setActiveTab('compare');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                        style={{color:'var(--ink-soft)', cursor:'pointer'}}
                      >
                        <Icon name="Eye" size={13} />
                        <span className="text-[10.5px] tracking-[0.12em] uppercase">Compare photos</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverHeroMenuOpen(false);
                        setActiveTab('insights');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                    >
                      <Icon name="Sparkles" size={13} />
                      <span className="text-[10.5px] tracking-[0.12em] uppercase">Insights</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* === BODY — photo column + text column (May 28 2026 per Jenni) ===
              Photo is the visual anchor — keep it. Text column to the
              right carries headline, voice, score, and view-analysis
              pill. (Earlier this session a stale comment claimed the
              oval was removed; Jenni confirmed she still wants it.
              Restored the flex layout and the photo column's normal
              dimensions.) */}
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
                width: hasTodayPhoto ? 'clamp(132px, 34vw, 166px)' : 'clamp(138px, 39vw, 180px)',
                height: hasTodayPhoto ? 'clamp(166px, 43vw, 210px)' : 'clamp(138px, 39vw, 180px)',
                marginBottom: heroIsViewingToday && hasTodayPhoto ? 22 : 0,
                transform: hasTodayPhoto ? 'translateY(-6px)' : 'none',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Tap behavior:
                  // - No photo today → opens the CHECK-IN CAMERA
                  //   directly. Previously this routed to the older
                  //   Log modal, but Jenni (May 29 2026) consolidated
                  //   the empty-state UI to a SINGLE entry: tap oval
                  //   → opens the chooser sheet where the user picks
                  //   between Camera / Upload. Removes the parallel
                  //   "Upload photo" pill that used to sit below.
                  // - Photo exists → ALSO opens the chooser now (May 29
                  //   v2 per Jenni). The camera icon on the photo
                  //   reads as "tap to take another," not "tap to
                  //   view." Analysis lives on the score badge + the
                  //   View analysis link — two clear paths there.
                  // - stopPropagation: section also has a tap-anywhere
                  //   handler; without this the action would fire twice.
                  if (typeof setShowCheckInChooser === 'function') {
                    setShowCheckInChooser(true);
                  } else {
                    startGuidedCheckIn();
                  }
                }}
                className="absolute inset-0 transition hover:opacity-90 focus:outline-none cursor-pointer"
                style={{cursor:'pointer'}}
                aria-label={hasTodayPhoto ? "View today's photo" : "Check in today"}
              >
                <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-dashed flex flex-col items-center justify-center" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                  {hasTodayPhoto ? (
                    <Photo item={todayLog} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <>
                      <Icon name="Camera" size={28} style={{color:'var(--ink-soft)'}} />
                      <div className="text-[10.5px] mt-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase'}}>Check in</div>
                    </>
                  )}
                </div>
              </button>
              {/* === SCORE BADGE (May 28 2026 per Jenni) ===
                  Score moves from the right column to a stamped badge
                  on the photo. Marries photo + score as one visual
                  unit so the eye reads them together instead of
                  treating the face and the number as competing
                  hero elements. Bottom-right corner, slight outside
                  offset for the "wax-seal" feel. Tappable → opens
                  analysis. */}
              {/* Score badge moved off the photo (May 29 2026 v5 per Jenni)
                  — now paired with View analysis in the right column.
                  Photo = check-in surface only; score circle + link =
                  analysis surface. One affordance per visual element. */}
              {/* Upload pill removed (May 29 2026 per Jenni) —
                  consolidated to a single empty-state CTA: tap the
                  oval opens the chooser sheet (Camera or Upload).
                  See the photo button's onClick above. */}
              {/* CHECK-IN pill removed from photo bottom (May 28 2026
                  v3 per Jenni) — moved to the right column under the
                  View analysis link. A subtle camera watermark sits
                  centered on the photo as a quiet brand mark instead
                  of a competing pill. Note: tap on photo still opens
                  the viewer drawer, so the camera mark is decorative,
                  not a button — kept low opacity to avoid implying
                  "tap me for camera." */}
              {/* === CAMERA WATERMARK (May 29 2026 v3 per Jenni) ===
                  Back as a subtle visual cue ONLY (pointer-events:
                  none). The whole photo is still the camera tap
                  target — the watermark just signals "this is a
                  photo-capture surface." Low opacity so it whispers
                  instead of competing with the face. */}
              {hasTodayPhoto && (
                // === CAMERA WATERMARK — circle (May 29 2026 v5 per Jenni) ===
                // Pill shape was inconsistent with the score badge's
                // circle. Both are round now. Camera icon + CHECK IN
                // caption stack inside. Still pointer-events:none —
                // photo body handles the tap.
                <div
                  className="absolute pointer-events-none flex flex-col items-center justify-center"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'rgba(28,25,23,0.32)',
                    border: '1px solid rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(2px)',
                    opacity: 0.6,
                    zIndex: 5,
                    gap: 2,
                  }}
                  aria-hidden
                >
                  <Icon name="Camera" size={16} style={{color:'rgba(255,251,244,1)'}} />
                  <span style={{
                    fontSize: 7,
                    color: 'rgba(255,251,244,1)',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}>Check in</span>
                </div>
              )}
            </div>
            {/* Text + score column — clamped at 180px so the score
                stack and the photo don't fight for horizontal space. */}
            <div className="flex-1 min-w-0 pt-0" style={{maxWidth: hasTodayPhoto ? 180 : undefined}}>
              {(() => {
                // === HEADLINE + VOICE LINE (May 2026 v4 — Tang & Gainey pass per Jenni) ===
                // Source: project_brand_voice memory. Two doctor best
                // friends texting about skincare. Gainey: sharp,
                // deadpan, 1-3 sentences, skips the warmup, "a little
                // dark." Tang: wry, observational, lands the read.
                // Blend (default): Gainey-led directness, Tang-soft
                // landing. The previous copy ("Steady read. Keep
                // going.") was generic-wellness. This pass rewrites
                // every line so it reads like an 11pm text to your
                // best friend after a shift.
                //
                // Voice rules applied:
                //   - No exclamation points (except genuine)
                //   - Never moralize about skipped routines
                //   - Never say "based on" / "looks like" — just say it
                //   - No "consult a dermatologist" — WE ARE the doctors
                //   - Brief: two short sentences beats five
                //   - Honest: don't pretend something worked if it didn't
                let headline = '', voice = '';
                const tc = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
                if (!hasTodayPhoto) {
                  // (May 29 2026 per Jenni) Headline now reads as
                  // a doctor-friend question instead of a flat label.
                  // Conversational, slightly nosy, brand-aligned.
                  headline = 'Where’s today?';
                  voice = priorNudge || 'One photo fills the read. Then the routine has context.';
                } else if (todayLog?.analyzing) {
                  headline = 'Reading.';
                  voice = 'Give us a second.';
                } else if (!todaySnap && !todayLog?.aiAnalysis) {
                  headline = 'Got the photo.';
                  voice = '';
                } else if (!todaySnap && todayLog?.aiAnalysis) {
                  const rescued = parseSkinMetrics(todayLog.aiAnalysis);
                  if (rescued) {
                    const r = tc(rescued.redness), s = tc(rescued.sensitivity), ba = tc(rescued.barrier);
                    if (r === 'High' || s === 'Inflamed' || ba === 'Stripped') headline = 'Skin’s flaring.';
                    else if (r === 'Moderate' || s === 'Reactive') headline = 'Redness is back.';
                    else headline = 'Read’s in.';
                    voice = 'Open the analysis for the full read.';
                  } else {
                    headline = 'Analysis ready.';
                    voice = 'Hit Read Analysis below.';
                  }
                } else {
                  const r = tc(todaySnap.redness), h = tc(todaySnap.hydration), t = tc(todaySnap.texture),
                        b = tc(todaySnap.breakouts), ba = tc(todaySnap.barrier), s = tc(todaySnap.sensitivity);
                  // === HEADLINE — Gainey-led: short, direct, observational ===
                  // Tone: doctor-friend at the end of a shift, not edgy.
                  // (May 27 — Jenni flagged "pissed" + "cocky" as too
                  // casual. Replaced with "flaring" and a softer
                  // landing on the smooth-clear branch.)
                  // === HEADLINE — warmer doctor-friend voice (May 29 2026 per Jenni) ===
                  // Was clinical one-words ("Holding.", "Glowing."). Now
                  // a conversational fragment so the editorial tone
                  // carries from empty state into filled state — no
                  // abrupt shift to AI-verdict mode.
                  if (r === 'High' || s === 'Inflamed' || ba === 'Stripped') headline = 'Skin’s flaring today.';
                  else if (r === 'Moderate' || s === 'Reactive') headline = 'Redness is back today.';
                  else if (b === 'Severe' || b === 'Many') headline = 'Breaking out today.';
                  else if (b === 'Some') headline = 'A couple of guests today.';
                  else if (h === 'Plump' && (r === 'Clear' || r === 'Low')) headline = 'Glowing today.';
                  else if (h === 'Good' && (r === 'Clear' || r === 'Low')) headline = 'Reads calm today.';
                  else if (t === 'Smooth' && b === 'Clear') headline = 'Behaving today.';
                  else headline = 'Skin’s holding today.';
                  // === VOICE — Tang & Gainey Blend: friend advice, not medical ===
                  // What one would text the other at 11pm. Direct fix,
                  // small dose of warmth, occasional dryness. Never
                  // moralize, never lecture, no slang.
                  // === VOICE LINES — one-line tight (May 29 v5 per Jenni) ===
                  // Right column is narrow (180px). Each line trimmed
                  // to ~25 chars so it never wraps at mobile width.
                  if (ba === 'Stripped' || ba === 'Compromised') voice = 'Ceramides only tonight.';
                  else if (r === 'High' || s === 'Inflamed') voice = 'Pause actives. Centella, bed.';
                  else if (r === 'Moderate' || s === 'Reactive') voice = 'Centella under moisturizer.';
                  else if (b === 'Severe' || b === 'Many') voice = 'Hands off. Patch the worst.';
                  else if (b === 'Some') voice = 'One BHA tonight. Just one.';
                  else if (h === 'Parched') voice = 'Humectant first, then cream.';
                  else if (h === 'Dry') voice = 'Double the moisturizer.';
                  else if (t === 'Bumpy' || t === 'Rough') voice = 'Squalane, ceramides, sleep.';
                  else if (s === 'Tender') voice = 'Gentle hands tonight.';
                  else if (b === 'Few') voice = 'Hands off. Picking worsens it.';
                  else if (h === 'Plump' && (r === 'Clear' || r === 'Low')) voice = 'No notes. Screenshot it.';
                  else if (h === 'Good' && (r === 'Clear' || r === 'Low')) voice = 'This is working. Keep going.';
                  else if (t === 'Smooth' && b === 'Clear') voice = 'Streak’s holding.';
                  else voice = 'Hold the routine.';
                  // Voice is NOT suppressed when delta chips are present.
                  // Chips report what changed (observation). Voice gives
                  // guidance (what to do). Different jobs — both belong.
                }
                return (
                  <>
                    {/* === SOFT CROSSFADE (May 2026 per Jenni) ===
                        Headline + voice swap on data settle. Key by the
                        headline text so React remounts the <p>s with a
                        fresh fade-in animation, smoothing the brief
                        "Steady today → More redness today" flicker that
                        happens when the cover picks a newer photo and
                        the snap resolves a moment later. The opacity
                        keyframe is short (220ms) so settled states still
                        feel instant on slow renders. */}
                    <div key={headline + '|' + voice} style={{animation: 'snapFade 220ms ease-out'}}>
                      {/* === HEADLINE — quieted (May 28 2026 per Jenni) ===
                          Was accent (same red as the score). With the
                          score as the focal point, the headline drops
                          to ink so only one element wears the brand
                          red. Letter-spacing and serif weight still
                          carry the editorial tone. */}
                      <h2
                        className="font-sans text-[18px] md:text-[22px] leading-[1.12] mb-2"
                        style={{color: 'var(--ink)', letterSpacing:'-0.022em', whiteSpace: hasTodayPhoto ? 'normal' : 'nowrap'}}
                      >
                        {headline}
                      </h2>
                      {voice && (
                        <p className="text-[12.5px] leading-snug font-light" style={{color:'var(--ink)', maxWidth: hasTodayPhoto ? undefined : 176}}>
                          {voice}
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
              {hasTodayPhoto ? (
                // === RIGHT COLUMN — text-link CTAs (restored May 28 2026 v11 per Jenni) ===
                // Tried action tiles below the photo+text row — too
                // loud, competed with the score badge and broke the
                // editorial quiet. Reverted to paired text links in
                // the right column: View analysis (accent, primary)
                // and Check-in (ink-soft, secondary).
                <div className="mt-3 flex flex-col gap-2" style={{maxWidth: 180}}>
                  {/* === SCORE BADGE + VIEW ANALYSIS (May 29 2026 v5 per Jenni) ===
                      Score badge moved off the photo, paired inline with
                      the View analysis link. Both tap → analysis drawer.
                      Photo = check-in surface only; this row = analysis
                      surface. */}
                  {todayLog?.id != null && (
                    <div className="inline-flex items-center gap-3" style={{whiteSpace: 'nowrap'}}>
                      {todayAvg != null && (() => {
                        // === Composite word descriptor (June 2026 per Jenni) ===
                        // Pairs the hero number with a one-word read. The word
                        // answers "what's going on?" in one glance — landing
                        // faster than the integer and avoiding the "6/10 feels
                        // like failure" trap. The number stays for trend
                        // tracking; together they're more honest than either
                        // alone.
                        //   90+  → Glowing      (great skin day)
                        //   65+  → Steady       (calm, healthy default)
                        //   45+  → Holding      (neutral, no alarm)
                        //   25+  → Off          (flag, worth watching)
                        //    <25 → Reactive     (clinical attention)
                        // Future iteration: vary by baseline mode (Calibrating
                        // when establishing, Settling during purge, etc.).
                        const compositeWord = (v) => {
                          if (v >= 90) return 'Glowing';
                          if (v >= 65) return 'Steady';
                          if (v >= 45) return 'Holding';
                          if (v >= 25) return 'Off';
                          return 'Reactive';
                        };
                        const word = compositeWord(todayAvg);
                        const scoreOutOf10 = (todayAvg / 10).toFixed(1);
                        return (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openTodayAnalysis(); }}
                              className="flex items-center justify-center transition hover:scale-105 focus:outline-none"
                              style={{
                                width: 68,
                                height: 68,
                                borderRadius: '50%',
                                background: 'var(--cream)',
                                border: '2px solid var(--accent)',
                                boxShadow: '0 2px 8px rgba(28,25,23,0.12)',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                              aria-label={`${word} · ${scoreOutOf10} out of 10. Tap to view analysis.`}
                              title={`${word} · ${scoreOutOf10} / 10 · tap to view analysis`}
                            >
                              <span style={{
                                fontSize: 26,
                                lineHeight: 1,
                                fontWeight: 700,
                                color: 'var(--accent)',
                                letterSpacing: '-0.025em',
                              }}>
                                {scoreOutOf10}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openTodayAnalysis(); }}
                              className="font-sans transition hover:opacity-80 focus:outline-none"
                              style={{
                                fontSize: 24,
                                lineHeight: 1.05,
                                fontWeight: 700,
                                letterSpacing: '-0.02em',
                                color: 'var(--ink)',
                                background: 'transparent',
                                border: 0,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              aria-label={`Today reads ${word}. Tap to view analysis.`}
                              title={`${word} · tap to view analysis`}
                            >
                              {word}
                            </button>
                          </>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openTodayAnalysis(); }}
                        className="inline-flex items-center gap-1 transition hover:opacity-75"
                        style={{
                          color: 'var(--accent)',
                          fontSize: 11.5,
                          fontWeight: analysisIsFresh ? 700 : 600,
                          letterSpacing: '0.01em',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                        disabled={todayLog?.id == null}
                        aria-label={analysisIsFresh ? 'Read new analysis' : 'View analysis'}
                      >
                        {todayLog?.analyzing ? (
                          <>
                            <Icon name="Loader2" size={12} className="spin" />
                            Reading…
                          </>
                        ) : (
                          <>
                            <Icon name="Sparkles" size={12} />
                            {analysisIsFresh ? 'Read analysis' : 'View analysis'}
                            <Icon name="ArrowRight" size={11} />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {/* === STREAK INLINE — moved above baseline (June 2026 per Jenni) ===
                      Was: streak rendered AFTER the baseline delta. Now: streak
                      sits directly under "View analysis" so the encouragement
                      lands before the delta number. Reads as: 7.9 → View
                      analysis → 2 day streak → +5 from baseline. Tiered
                      encouragement preserved (10+ "keep at it", 30+ "real
                      consistency"). */}
                  {loggingStreak >= 2 && (() => {
                    const milestone = loggingStreak >= 30 ? '— real consistency'
                                    : loggingStreak >= 10 ? '— keep at it'
                                    : '';
                    return (
                      <div className="mt-1 text-[11px]" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'0.01em'}}>
                        <span style={{fontWeight:700}}>{loggingStreak}</span>
                        <span style={{marginLeft:4}}>day streak{milestone ? ' ' + milestone : ''}</span>
                      </div>
                    );
                  })()}
                  {/* === BASELINE STATUS / DELTA / WARNING (June 2026 per Jenni) ===
                      A small text-only line beneath the streak. Shows
                      ONE of (in priority order):
                        1. AI-only warning if rating + chips missing
                        2. Most-benign pattern at day 7-9 (forming mode)
                        3. Delta from baseline at day 10+ (anchored mode)
                        4. Baseline-anchoring status at day 1-6 (establishing)
                      Editorial / terse. Tap → opens score explainer.
                      Copy update: "vs" → "from" per Jenni. */}
                  {todayLog?.id != null && todayAvg != null && (() => {
                    const open = () => setShowScoreExplainer && setShowScoreExplainer(true);
                    if (todayDisplay?.mode === 'ai-only') {
                      return (
                        <button
                          type="button"
                          onClick={open}
                          className="text-left inline-flex items-center gap-1 transition hover:opacity-75"
                          style={{color:'var(--ink-soft)', fontSize:10.5, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600, cursor:'pointer', background:'transparent', border:'none'}}
                          title="AI photo only — log a rating + chips to deepen the read"
                        >
                          <Icon name="Info" size={10} />
                          <span>Photo only · add a rating</span>
                        </button>
                      );
                    }
                    if (mostBenignPattern) {
                      return (
                        <button
                          type="button"
                          onClick={open}
                          className="text-left transition hover:opacity-75"
                          style={{color:'var(--ink-soft)', fontSize:11, lineHeight:1.35, cursor:'pointer', background:'transparent', border:'none', maxWidth:180, padding:0}}
                          title="How your score works"
                        >
                          {mostBenignPattern.copy}
                        </button>
                      );
                    }
                    if (baselineDelta?.composite_delta != null) {
                      const d = baselineDelta.composite_delta;
                      const sign = d > 0 ? '+' : '';
                      const color = d > 2 ? 'var(--accent-blue)' : d < -2 ? 'var(--rose)' : 'var(--ink-soft)';
                      return (
                        <button
                          type="button"
                          onClick={open}
                          className="text-left inline-flex items-center gap-1 transition hover:opacity-75"
                          style={{color, fontSize:11, fontWeight:600, letterSpacing:'-0.005em', cursor:'pointer', background:'transparent', border:'none'}}
                          title={`From ${baseline.n}-log baseline (${baseline.composite})`}
                        >
                          <span>{sign}{d} from baseline</span>
                          <Icon name="Info" size={10} style={{opacity:0.55}} />
                        </button>
                      );
                    }
                    if (baseline.mode === 'establishing') {
                      return (
                        <button
                          type="button"
                          onClick={open}
                          className="text-left transition hover:opacity-75"
                          style={{color:'var(--ink-soft)', fontSize:10.5, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600, cursor:'pointer', background:'transparent', border:'none'}}
                          title="Frida is anchoring your baseline"
                        >
                          Anchoring baseline · {baseline.n}/10
                        </button>
                      );
                    }
                    return null;
                  })()}
                  {/* Standalone "+ Check-in" link removed (May 29 v4
                      per Jenni) — photo watermark now carries a "CHECK
                      IN" label and the photo body is the tap target.
                      View analysis link stands alone here for the
                      analysis path. */}
                  {/* Dead "Check-in" button block removed 2026-05-31 (was gated {false &&}). */}
                </div>
              ) : (
                // === EMPTY-STATE CTA (May 30 2026 v13 per Jenni) ===
                // Mirror the filled state: empty score circle ("—") +
                // CTA link. Keeps the right column in the same shape
                // across states so the layout doesn't shift when a
                // photo arrives.
                <div className="mt-3">
                  <div className="flex flex-row items-center gap-2">
                    {/* Empty score circle — red dashed border, faded em-dash. */}
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'var(--cream)',
                        border: '2px dashed var(--accent)',
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      <span style={{fontSize:16, lineHeight:1, fontWeight:700, color:'var(--accent)', letterSpacing:'-0.025em', opacity:0.35}}>—</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof setShowCheckInChooser === 'function') {
                          setShowCheckInChooser(true);
                        } else {
                          startGuidedCheckIn();
                        }
                      }}
                      className="inline-flex max-w-full items-center gap-1 transition hover:opacity-75 text-left"
                      style={{
                        color: 'var(--accent)',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        cursor: 'pointer',
                      }}
                      aria-label="Add a photo for today's analysis"
                    >
                      <Icon name="Sparkles" size={12} />
                      <span className="sm:hidden">Analyze</span>
                      <span className="hidden sm:inline">Add for analysis</span>
                      <Icon name="ArrowRight" size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Action tiles tried + reverted May 28 2026 v11 — too loud
              for the editorial direction. CTAs back in right column
              as text links (see RIGHT COLUMN block above). */}
          {hasTodayPhoto && !todaySnap && !getApiKey() && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowApiKeyModal(true); }}
              className="w-full mt-4 mb-1 text-left text-[11px] px-3 py-2 rounded-[10px] flex items-center gap-2 transition hover:opacity-80"
              style={{background:'var(--cream)', border:'1px dashed var(--accent)', color:'var(--accent)'}}
            >
              <Icon name="Key" size={11} />
              <span>Set your Anthropic API key to generate skin metrics →</span>
            </button>
          )}
          {hasTodayPhoto && !todaySnap && getApiKey() && todayLog?.analyzing && (
            <div className="mt-4 mb-1 text-[11px] px-3 py-2 rounded-[10px] flex items-center gap-2" style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink-soft)'}}>
              <Icon name="Loader2" size={11} className="spin" />
              <span>Reading your skin…</span>
            </div>
          )}
          {/* === METRIC GRID (May 28 2026 v6 per Jenni) ===
              Always renders — including empty/pending state, where
              each tile shows a single "—" instead of arrow + verb.
              The point: the grid is a visual promise of what the
              user gets after checking in, so seeing the shape
              waiting for data is encouragement to check in.
              When today's snap is missing, tiles dim slightly and
              the dashes read as "pending." Once the snap arrives,
              the same tiles fill with arrow + verb. */}
          {(() => {
            // === CHIP RAIL ALIGNED TO COMPOSITE v1 (June 2026 per Jenni) ===
            // Was: 5 tiles incl sensitivity (which the AI no longer extracts).
            // Now: 5 tiles matching the 5 composite outcome domains —
            // hydration, barrier, redness, breakouts (labeled "Pores" for
            // brand-voice continuity), and texture. Sensitivity is dropped
            // here for the same reason it's dropped as a domain: a photo
            // can't see felt-sense reactivity. It remains as a check-in chip.
            const SCORE_MAP = {
              redness:    { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
              hydration:  { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
              texture:    { Smooth: 100, Even: 80, Uneven: 55, Rough: 30, Bumpy: 10 },
              breakouts:  { Clear: 100, Few: 75, Some: 50, Many: 25, Severe: 10 },
              barrier:    { Strong: 100, Steady: 80, Holding: 55, Compromised: 30, Stripped: 10 },
            };
            const tc = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : null;
            const scoreFor = (snap, k) => snap ? (SCORE_MAP[k]?.[tc(snap[k])] ?? null) : null;
            // === BACKFILL FROM HISTORY (June 2026 per Jenni) ===
            // The rail used to render "—" for any metric where today's snap
            // was missing the value (AI didn't extract a domain, or the
            // viewed date has no analyzed photo yet). Read as broken UI
            // even though it was technically "pending." Now: walk back the
            // log history once and remember the most recent value per key.
            // When today's snap is missing a key, render the carried value
            // with a subtle `carried` flag so the tile looks complete and
            // the user knows the rail reflects their running state.
            const findCarry = (() => {
              const sortedLogs = [...(logs || [])]
                .filter(l => l && l.metricSnapshot && l.id !== todayLog?.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
              return (key) => {
                for (const l of sortedLogs) {
                  const v = scoreFor(l.metricSnapshot, key);
                  if (v != null) return { value: v, fromDate: l.date };
                }
                return null;
              };
            })();
            const resolveTile = (snapKey, tileKey) => {
              const fresh = scoreFor(todaySnap, snapKey);
              if (fresh != null) return { value: fresh, carried: false, fromDate: null };
              const back = findCarry(snapKey);
              if (back) return { value: back.value, carried: true, fromDate: back.fromDate };
              return { value: null, carried: false, fromDate: null };
            };
            const tileState = {
              hydration: resolveTile('hydration', 'hydration'),
              barrier: resolveTile('barrier', 'barrier'),
              redness: resolveTile('redness', 'redness'),
              congestion: resolveTile('breakouts', 'congestion'),
              texture: resolveTile('texture', 'texture'),
            };
            const cur = {
              hydration: tileState.hydration.value,
              barrier: tileState.barrier.value,
              redness: tileState.redness.value,
              congestion: tileState.congestion.value,
              texture: tileState.texture.value,
            };
            const prev = priorSnap ? {
              hydration: scoreFor(priorSnap, 'hydration'),
              barrier: scoreFor(priorSnap, 'barrier'),
              redness: scoreFor(priorSnap, 'redness'),
              congestion: scoreFor(priorSnap, 'breakouts'),
              texture: scoreFor(priorSnap, 'texture'),
            } : null;
            const isPending = !todaySnap;
            const verbForMetric = (key, now, was) => {
              // Pending state: no snap → "—" arrow, "pending" direction.
              if (now == null) return { arrow: '—', dir: 'pending' };
              const delta = was == null ? 0 : (now - was);
              const better = delta > 5, worse = delta < -5;
              const dir = better ? 'pos' : worse ? 'neg' : 'flat';
              // Hydration / Barrier / Texture: pos = up (higher score better).
              // Redness / Congestion (breakouts): pos = down.
              const downIsBetter = key === 'redness' || key === 'congestion';
              const arrow = dir === 'flat' ? '—' : (downIsBetter ? (better ? '↓' : '↑') : (better ? '↑' : '↓'));
              return { arrow, dir };
            };
            // === STABLE 3-STATE VOCAB (May 29 v6 per Jenni) ===
            // When a metric isn't moving, the word reflects the
            // absolute level too — stably-good vs stably-bad both
            // matter, "Stable" alone doesn't say which.
            //   val >= 70 → stably good (blue text)
            //   val < 50  → stably bad  (rose text)
            //   else      → neutral     (ink-soft "Stable")
            // Scores are normalized so higher = better for all metrics
            // including redness/sensitivity (low score = bad).
            const verbFor = (key, dir, value) => {
              // Em-dash in pending state retired (May 31 2026 per Jenni) —
              // the row of em-dashes read as "broken UI" rather than
              // "awaiting check-in." Pending cells render icon + label only;
              // a single "Check in to see your score" line sits below.
              if (dir === 'pending') return { word: '', tone: 'pending' };
              if (dir === 'pos') {
                const w = key === 'hydration' ? 'Up'
                        : key === 'barrier' ? 'Strong'
                        : key === 'redness' ? 'Soft'
                        : key === 'congestion' ? 'Clear'
                        : key === 'texture' ? 'Smoother' : '';
                return { word: w, tone: 'pos' };
              }
              if (dir === 'neg') {
                const w = key === 'hydration' ? 'Down'
                        : key === 'barrier' ? 'Stressed'
                        : key === 'redness' ? 'Up'
                        : key === 'congestion' ? 'Up'
                        : key === 'texture' ? 'Rougher' : '';
                return { word: w, tone: 'neg' };
              }
              // flat — 3-state from absolute value. Neutral band is
              // "watching" in gold (palette caution color), with
              // metric-specific words instead of bland "Stable".
              const good = value != null && value >= 70;
              const bad  = value != null && value < 50;
              const tone = good ? 'pos' : bad ? 'neg' : 'watching';
              const w = key === 'hydration'  ? (good ? 'Plump'  : bad ? 'Dry'      : 'Okay')
                     : key === 'barrier'    ? (good ? 'Strong' : bad ? 'Tender'   : 'Holding')
                     : key === 'redness'    ? (good ? 'Calm'   : bad ? 'Flushed'  : 'Light')
                     : key === 'congestion' ? (good ? 'Clear'  : bad ? 'Busy'     : 'Even')
                     : key === 'texture'    ? (good ? 'Smooth' : bad ? 'Rough'    : 'Even')
                     : 'Okay';
              return { word: w, tone };
            };
            // === METRIC TILE COLOR MAP (June 2026 per Jenni — composite v1 align) ===
            // Five tiles matching the five composite outcome domains:
            // - hydration → powder blue (water)
            // - barrier   → mustard (protective)
            // - redness   → accent red (direct mapping)
            // - pores     → quiet stone (still maps to breakouts/congestion;
            //               kept the "Pores" label for editorial continuity)
            // - texture   → clay rose (replaces sensitivity — same warm-neutral
            //               temperature so the rail visually balances)
            const tiles = [
              { key: 'hydration',  label: 'Hydra',   icon: 'Droplet',  iconColor: 'var(--accent-blue)',    tintBg: 'rgba(134,202,231,0.14)' },
              { key: 'barrier',    label: 'Barrier', icon: 'Shield',   iconColor: 'var(--gold)',           tintBg: 'rgba(232,179,53,0.12)' },
              { key: 'redness',    label: 'Redness', icon: 'Flame',    iconColor: 'var(--accent)',         tintBg: 'rgba(229,60,45,0.08)' },
              { key: 'congestion', label: 'Pores',   icon: 'Circle',   iconColor: 'var(--text-tertiary)',  tintBg: 'rgba(156,143,134,0.12)' },
              { key: 'texture',    label: 'Texture', icon: 'Activity', iconColor: 'var(--rose)',           tintBg: 'rgba(184,86,72,0.10)' },
            ];
            return (
              <div
                className="mt-3 rounded-[14px] px-2 py-3 md:px-3"
                style={{
                  background:'var(--cream-deep)',
                  border: '1px solid var(--line)',
                  opacity: isPending ? 0.95 : 1,
                }}
              >
                <div className="grid grid-cols-5 gap-1 md:gap-2">
                  {tiles.map(t => {
                    const v = cur[t.key];
                    const direction = verbForMetric(t.key, v, prev?.[t.key]);
                    // === TILE TINT + DIM (May 29 v3) ===
                    // Moved tiles get a soft domain-tinted bg; steady
                    // tiles dim to 55% so the eye lands on what moved.
                    // Em-dash + "Steady" suppressed for flat tiles —
                    // they were reading as broken / noise.
                    const moved = direction.dir === 'pos' || direction.dir === 'neg';
                    const verb = verbFor(t.key, direction.dir, v);
                    // === Backfill flag (June 2026 per Jenni) ===
                    // Carried tiles render the most recent prior value with
                    // slight opacity reduction + a tiny dot marker so the
                    // rail looks complete but doesn't lie about freshness.
                    const carried = !!(tileState[t.key]?.carried);
                    const verbColor =
                      verb.tone === 'pos' ? 'var(--accent-blue,#86CAE7)' :
                      verb.tone === 'neg' ? 'var(--rose,#c9a094)' :
                      verb.tone === 'watching' ? 'var(--gold)' :
                      verb.tone === 'pending' ? 'var(--ink-soft)' :
                      'var(--ink-soft)';
                    return (
                      <div
                        key={t.key}
                        className="flex flex-col items-center text-center min-w-0 py-1.5 px-0.5"
                        style={{
                          opacity: isPending ? 0.85 : (carried ? 0.7 : 1),
                          transition: 'opacity 200ms ease',
                        }}
                        title={carried ? 'Carried over from your last reading' : undefined}
                      >
                        <Icon
                          name={t.icon}
                          size={13}
                          style={{color: t.iconColor, opacity: verb.tone === 'pending' ? 0.55 : (carried ? 0.75 : 1)}}
                        />
                        <span
                          className="text-[7.5px] tracking-[0.04em] uppercase mt-1 w-full leading-tight"
                          style={{color:'var(--ink-soft)', fontWeight:650, whiteSpace:'nowrap'}}
                        >
                          {t.label}
                        </span>
                        <div className="flex items-baseline gap-0.5 mt-1">
                          {moved && (
                            <span className="text-[10px]" style={{color: verbColor, fontWeight:600}}>
                              {direction.arrow}
                            </span>
                          )}
                          {verb.word && (
                            <span className="text-[10px]" style={{color: verbColor, fontWeight: moved ? 500 : 600, opacity: verb.tone === 'pending' ? 0.55 : 1}}>{verb.word}</span>
                          )}
                          {/* Carried-over dot — tiny visual cue that this
                              tile reflects a prior reading, not today's
                              fresh value. June 2026 per Jenni. */}
                          {carried && !moved && (
                            <span className="text-[9px]" style={{color:'var(--ink-soft)', fontWeight:600}}>·</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Empty-state CTA (May 31 2026 per Jenni): one quiet line
                    that explains what the strip will fill with once the user
                    checks in. Replaces the row of em-dashes. */}
                {isPending && (
                  <div className="text-center mt-2 text-[10px] tracking-[0.04em]" style={{color:'var(--accent)', fontWeight:600, opacity:0.75}}>
                    Check in to see your score
                  </div>
                )}
              </div>
            );
          })()}
          {/* === FOOTER LINKS REMOVED (May 28 2026 audit) ===
              "View journal · Compare photos" sat under the metric chips
              looking orphaned (they answered card-level nav, not
              metric questions). Both are top-tab destinations already.
              All nav for this card lives in the upper-right kebab menu
              now — see HERO KEBAB MENU at the top of this section. */}
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
            action: startGuidedCheckIn,
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
            style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}
          >
            <div className="px-5 pt-4 pb-1">
              <div className="text-[10px] tracking-[0.28em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>Next</div>
              <div className="font-sans text-[18px] leading-tight mt-0.5" style={{color:'var(--ink)', letterSpacing:'-0.01em'}}>
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
                        ? 'rgba(199, 231, 245, 0.42)'
                        : 'color-mix(in srgb, var(--accent) 8%, transparent)',
                      color: row.done ? 'var(--accent-blue)' : 'var(--accent)',
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
      // === TOMORROW PREVIEW (May 30 2026 per Jenni) ===
      // Forward chevron normally caps at today. If the user has built
      // a weekly pattern, allow advancing one day forward as a preview.
      // No further than +1 day. The label shows "TOMORROW · preview"
      // so the user knows they're peeking, not editing.
      const tKey = (() => {
        const d = new Date(); d.setDate(d.getDate() + 1);
        return localDateISO(d);
      })();
      const hasBuiltPattern = (typeof userHasBuiltPattern === 'function') ? userHasBuiltPattern(activeProducts) : false;
      const isPreviewingTomorrow = viewDate === tKey;
      const canPreviewTomorrow = hasBuiltPattern && isViewingToday;
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
        acceptedPlan: buildPlanAccepted ? buildPlan : null,
        userProfile, // June 2026 — enables travel.products swap when travel.active
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
        : isPreviewingTomorrow ? `Tomorrow · ${dateShort}`
        : viewDate === yKey ? `Yesterday · ${dateShort}`
        : new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      // Scrub controls — go back/forward in days. Past is unlimited;
      // future is capped at +1 day AND only allowed when the user has
      // a built weekly pattern (so tomorrow has something to preview).
      const shiftDay = (deltaDays) => {
        const d = new Date(viewDate + 'T00:00:00');
        d.setDate(d.getDate() + deltaDays);
        const next = localDateISO(d);
        if (next > tKey) return;                     // never beyond tomorrow
        if (next > todayStr && !hasBuiltPattern) return; // future requires a built pattern
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
        persistRegimenLogs(newList, 'repeat');
        setCoverRoutineRebuildToken(t => t + 1);
        const sourceLabel = repeatSourceLog === yesterdayCheckIn ? 'yesterday' : `last logged (${repeatSourceLog.date})`;
        toast(`Logged — same as ${sourceLabel} ✨`, 'info');
      };
      // Undo the just-clicked repeat — drops the view date's auto-created
      // check-in entirely so the pill flips back to its default state.
      const undoRepeatYesterday = () => {
        const newList = (regimenLogs || []).filter(r => r.date !== viewDate);
        setRegimenLogs(newList);
        persistRegimenLogs(newList, 'undo-repeat');
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
      const getCoverSlotMeta = () => {
        const todayKeyLocal = todayStr;
        const todayLog = (regimenLogs || []).find(r => r.date === todayKeyLocal);
        const slotKey = ritualSlot === 'pm' ? 'pmProducts' : 'amProducts';
        const activeList = ritualSlot === 'pm' ? pmList : amList;
        const slotEmpty = activeList.length === 0;
        const patternBuilt = userHasBuiltPattern(products);
        return { todayKeyLocal, todayLog, slotKey, slotEmpty, patternBuilt };
      };
      const clearCoverSlot = () => {
        const { todayKeyLocal, todayLog, slotKey } = getCoverSlotMeta();
        if (!todayLog) {
          const dow = new Date().getDay();
          const pat = getProductsForTodayFromPattern((products || []).filter(p => !p.endDate), dow);
          const oppositeIds = (ritualSlot === 'pm' ? pat.am : pat.pm).map(p => p.id);
          const emptyLog = {
            id: Date.now(),
            date: todayKeyLocal,
            amProducts: ritualSlot === 'am' ? [] : oppositeIds,
            pmProducts: ritualSlot === 'pm' ? [] : oppositeIds,
            amExtras: [], pmExtras: [],
            devices: [], sleep: '', supplements: [],
            submitted: false,
          };
          const newList = [...(regimenLogs || []), emptyLog];
          setRegimenLogs(newList);
          persistRegimenLogs(newList, 'clear-empty-slot');
          setCoverRoutineRebuildToken(t => t + 1);
          toast(`Cleared ${ritualSlot.toUpperCase()} for today`, 'info');
          return;
        }
        const newList = (regimenLogs || []).map(r => r.date === todayKeyLocal ? { ...r, [slotKey]: [] } : r);
        setRegimenLogs(newList);
        persistRegimenLogs(newList, 'clear-slot');
        setCoverRoutineRebuildToken(t => t + 1);
        toast(`Cleared ${ritualSlot.toUpperCase()} routine`, 'info');
      };
      const restoreCoverSlot = () => {
        const { todayKeyLocal, todayLog, slotKey } = getCoverSlotMeta();
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
          persistRegimenLogs(newList, 'restore-empty-slot');
          setCoverRoutineRebuildToken(t => t + 1);
          toast(`Restored ${ritualSlot.toUpperCase()} from your weekly plan`, 'info');
          return;
        }
        const newList = (regimenLogs || []).map(r => r.date === todayKeyLocal ? { ...r, [slotKey]: patIds } : r);
        setRegimenLogs(newList);
        persistRegimenLogs(newList, 'restore-slot');
        setCoverRoutineRebuildToken(t => t + 1);
        toast(`Restored ${ritualSlot.toUpperCase()} from your weekly plan`, 'info');
      };
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
        <section id="today-ritual-card" className="rounded-[20px] px-5 py-5 md:px-6 md:py-6 relative export-target" style={{background:'var(--cream-deep)', border: '1.5px solid var(--accent)', boxShadow: '0 1px 2px rgba(229,60,45,0.06), 0 8px 22px rgba(229,60,45,0.06)'}}>
          {/* === CRITICAL GAP BANNER (May 2026 — AI surfaces shelf gaps) ===
              When the AI cover-routine build detects the shelf has no
              SPF, it emits criticalGap:{type:'spf-missing'}. Render a
              prominent red banner at the top of the ritual card so the
              user sees the gap before scanning their routine. */}
          {coverRoutine?.criticalGap?.type === 'spf-missing' && (
            <div className="rounded-[12px] p-3 mb-3" style={{ background: 'rgba(229,60,45,0.06)', border: '1.5px solid var(--accent)' }}>
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" size={14} style={{ color: 'var(--accent)', marginTop: 2 }} />
                <div>
                  <div className="text-[10px] tracking-[0.24em] uppercase mb-1" style={{ color: 'var(--accent)', fontWeight: 700 }}>Critical gap</div>
                  <div className="text-[12px] leading-snug" style={{ color: 'var(--ink)' }}>{coverRoutine.criticalGap.message}</div>
                </div>
              </div>
            </div>
          )}
          {/* Header row — eyebrow + logged badge on left, quick-action
              icons (Repeat ↻ / Edit ✎) on the right. The icons are
              small but labeled with quiet uppercase text so the
              affordance reads from a glance — they're shortcuts so the
              user doesn't have to scan the pill row for routine ops. */}
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* === EYEBROW with AM/PM status (May 28 2026 v8 per Jenni) ===
                  REGIMEN label + sun/moon status indicators. Each
                  icon is tappable: sun → switch to AM slot, moon →
                  switch to PM slot. Semantic done colors: sun gold
                  (morning) when AM logged, moon blue (night) when
                  PM logged, dim ink-soft when open. Mirrors the
                  snapshot eyebrow above so the user sees the same
                  status language in both cards. amDone/pmDone
                  computed inline since this card has its own scope. */}
              {/* === REGIMEN STATUS — sentence form (May 29 2026 v3 per Jenni) ===
                  Was REGIMEN + sun/moon glyphs. Replaced with one
                  conversational line, color-coded by state:
                  sage = both done, gold = AM only, accent-blue = PM
                  only, ink-soft (faded) = neither. */}
              {(() => {
                const todayRegLog = (regimenLogs || []).find(r => r.date === todayStr);
                const amDoneR = !!(todayRegLog && (
                  (Array.isArray(todayRegLog.amDone) && todayRegLog.amDone.length > 0) ||
                  todayRegLog.amBatchConfirmed === true
                ));
                const pmDoneR = !!(todayRegLog && (
                  (Array.isArray(todayRegLog.pmDone) && todayRegLog.pmDone.length > 0) ||
                  todayRegLog.pmBatchConfirmed === true
                ));
                // Binary done/missing language per Jenni (May 31 2026) —
                // dropped "open" for "missing" so the two states use parallel
                // wording. Always shows both slots' status so the eyebrow is
                // scannable.
                let label = 'AM missing · PM missing';
                let color = 'var(--ink-soft)';
                let opacity = 0.7;
                if (amDoneR && pmDoneR) { label = 'AM done · PM done'; color = 'var(--accent-sage-dark)'; opacity = 1; }
                else if (amDoneR) { label = 'AM done · PM missing'; color = 'var(--gold)'; opacity = 1; }
                else if (pmDoneR) { label = 'AM missing · PM done'; color = 'var(--accent-blue)'; opacity = 1; }
                return (
                  <span className="text-[10px] tracking-[0.04em] uppercase" style={{color, opacity, fontWeight:600}}>
                    {label}
                  </span>
                );
              })()}
              {/* Old sun/moon glyph spans removed — sentence above replaces them. */}
            </div>
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setCoverRitualMenuOpen(v => !v)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--cream)]"
                style={{color:'var(--ink-soft)', border: '1px solid var(--line)', background:'transparent', cursor:'pointer'}}
                aria-label="Regimen actions"
                aria-expanded={coverRitualMenuOpen}
              >
                <Icon name="MoreHorizontal" size={16} />
              </button>
              {coverRitualMenuOpen && (
                <div
                  className="absolute right-0 top-9 z-30 w-56 rounded-[14px] overflow-hidden shadow-xl"
                  style={{background:'var(--cream)', border: '1px solid var(--line)'}}
                >
                  {isViewingToday && (() => {
                    const meta = getCoverSlotMeta();
                    const canSlotAction = !(meta.slotEmpty && !meta.patternBuilt);
                    return (
                      <>
                        {canSlotAction && (
                          <button
                            type="button"
                            onClick={() => {
                              meta.slotEmpty ? restoreCoverSlot() : clearCoverSlot();
                              setCoverRitualMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                            style={{color: meta.slotEmpty ? 'var(--accent)' : 'var(--ink-soft)', cursor:'pointer'}}
                          >
                            <Icon name={meta.slotEmpty ? 'RotateCcw' : 'Trash2'} size={13} />
                            <span className="text-[10.5px] tracking-[0.12em] uppercase">
                              {meta.slotEmpty ? `Restore ${ritualSlot.toUpperCase()}` : `Clear ${ritualSlot.toUpperCase()}`}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            submittedToday ? undoRepeatYesterday() : repeatYesterday();
                            setCoverRitualMenuOpen(false);
                          }}
                          disabled={!submittedToday && (!repeatSourceLog || !isViewingToday)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)] disabled:opacity-35"
                          style={{color: submittedToday ? 'var(--accent)' : 'var(--ink-soft)', cursor: (submittedToday || repeatSourceLog) ? 'pointer' : 'default'}}
                        >
                          <Icon name={submittedToday ? 'Check' : 'RotateCcw'} size={13} />
                          <span className="text-[10.5px] tracking-[0.12em] uppercase">{submittedToday ? 'Repeated' : 'Repeat yesterday'}</span>
                        </button>
                      </>
                    );
                  })()}
                  {/* === FILL IN SCHEDULED REGIMEN (June 2026 per Jenni) ===
                      One-tap "yes I did exactly what was planned today."
                      Pulls the user's scheduled AM+PM from resolveTodayRitual
                      (ignoring any existing log so it surfaces the PLAN, not
                      a partial save). Writes a fully-submitted regimenLog
                      with amDone/pmDone marked done. Disabled when no
                      pattern is built yet (nothing to schedule). */}
                  {isViewingToday && (() => {
                    const meta = getCoverSlotMeta();
                    if (!meta.patternBuilt) return null;  // no plan → no button
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setCoverRitualMenuOpen(false);
                          try {
                            const resolved = resolveTodayRitual({
                              products: products || [],
                              regimenLogs: [],   // ignore any existing log
                              date: todayStr,
                              acceptedPlan: buildPlanAccepted ? buildPlan : null,
                              userProfile,
                            });
                            const amIds = (resolved.am || []).map(p => p.id);
                            const pmIds = (resolved.pm || []).map(p => p.id);
                            if (amIds.length === 0 && pmIds.length === 0) {
                              toast('Nothing scheduled for today', 'info');
                              return;
                            }
                            const existing = (regimenLogs || []).find(r => r.date === todayStr);
                            const log = {
                              ...(existing || {}),
                              id: existing?.id || Date.now(),
                              date: todayStr,
                              amProducts: amIds,
                              pmProducts: pmIds,
                              amDone: amIds,
                              pmDone: pmIds,
                              submitted: true,
                              submittedAt: Date.now(),
                            };
                            const nextLogs = existing
                              ? (regimenLogs || []).map(r => r.date === todayStr ? log : r)
                              : [log, ...(regimenLogs || [])];
                            setRegimenLogs(nextLogs);
                            persistRegimenLogs(nextLogs, 'fill-scheduled');
                            setCoverRoutineRebuildToken(t => t + 1);
                            toast('Filled in from your schedule ✨', 'success');
                          } catch (e) {
                            console.warn('[fill-scheduled]', e);
                            toast('Couldn\'t fill — try again', 'error');
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                        style={{color:'var(--accent)', cursor:'pointer', borderTop:'1px solid var(--line)'}}
                        title="Save today's scheduled AM+PM as done"
                      >
                        <Icon name="Calendar" size={13} />
                        <span className="text-[10.5px] tracking-[0.12em] uppercase">Fill in scheduled</span>
                      </button>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => { setCoverRitualMenuOpen(false); setActiveTab('regimen'); setRegimenView('today'); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                    style={{color:'var(--ink-soft)', cursor:'pointer', borderTop:'1px solid var(--line)'}}
                  >
                    <Icon name="Layers" size={13} />
                    <span className="text-[10.5px] tracking-[0.12em] uppercase">Rebuild routine</span>
                  </button>
                  {/* === LOG PROCEDURE (June 2026) ===
                      Rehoused from the retired TodayRitualModal "Procedure today?"
                      block. Same trigger — opens ProcedureModal — but lives on the
                      cover kebab so it stays one tap from Today without crowding
                      the edit-routine flow. */}
                  {typeof setShowProcedureModal === 'function' && (
                    <button
                      type="button"
                      onClick={() => { setCoverRitualMenuOpen(false); setShowProcedureModal(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                    >
                      <Icon name="Sparkles" size={13} />
                      <span className="text-[10.5px] tracking-[0.12em] uppercase">Log procedure</span>
                    </button>
                  )}
                  {/* === HOW YOUR SCORE WORKS (June 2026) ===
                      Single entry to the explainer drawer. Same surface
                      reachable from the cover delta line and Profile. */}
                  {typeof setShowScoreExplainer === 'function' && (
                    <button
                      type="button"
                      onClick={() => { setCoverRitualMenuOpen(false); setShowScoreExplainer(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                    >
                      <Icon name="Info" size={13} />
                      <span className="text-[10.5px] tracking-[0.12em] uppercase">How your score works</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { handleCoverExport(e); setCoverRitualMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--cream-deep)]"
                    style={{color:'var(--ink-soft)', cursor:'pointer'}}
                  >
                    <Icon name="Download" size={13} />
                    <span className="text-[10.5px] tracking-[0.12em] uppercase">Export routine</span>
                  </button>
                </div>
              )}
            </div>
            {/* Dead quick-action stack (Clear / Restore / Repeat yesterday) removed 2026-05-31.
                Was gated {false &&} — these actions live in the kebab menu above and on the
                Regimen Today view. ~130 lines removed. */}
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
              <span className="font-sans text-[14px]" style={{color: isViewingToday ? 'var(--accent)' : 'var(--ink)'}}>{viewDayLabel}</span>
              {isPreviewingTomorrow && (
                <span className="text-[8.5px] tracking-[0.2em] uppercase px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent)', fontWeight: 700 }}>preview</span>
              )}
              {/* "Logged" badge retired May 2026 (Jenni): the
                  "Today logged" status pill near the primary CTA
                  already conveys submission; the inline date badge
                  was redundant clutter. */}
              {!isViewingToday && (
                <button
                  type="button"
                  onClick={() => setRitualViewDate(todayStr)}
                  className="text-[9px] tracking-[0.2em] uppercase transition hover:opacity-70"
                  style={{color:'var(--accent)'}}
                >
                  jump to today
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => shiftDay(1)}
              disabled={isPreviewingTomorrow || (isViewingToday && !canPreviewTomorrow)}
              title={isViewingToday && !hasBuiltPattern ? 'Build your weekly pattern to preview tomorrow' : ''}
              className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[var(--cream)] cursor-pointer disabled:opacity-30"
              style={{color:'var(--ink-soft)', cursor: (isPreviewingTomorrow || (isViewingToday && !canPreviewTomorrow)) ? 'default' : 'pointer'}}
              aria-label="Next day"
            >
              <Icon name="ChevronRight" size={14} />
            </button>
          </div>
          {/* Preview tomorrow — sits below the chevron row, right-aligned
              under the forward chevron. Cleaner hierarchy than inline next
              to "Today" (May 31 2026 per Jenni). */}
          {isViewingToday && canPreviewTomorrow && (
            <div className="flex justify-end -mt-2 mb-2 pr-1">
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="text-[9px] tracking-[0.2em] uppercase transition hover:opacity-70 flex items-center gap-0.5"
                style={{color:'var(--ink-soft)'}}
                aria-label="Preview tomorrow's regimen"
              >
                preview tmrw <Icon name="ChevronRight" size={9} />
              </button>
            </div>
          )}
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
              <div className="rounded-full flex p-1 gap-1 mb-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
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
                        background: active ? 'var(--accent-soft)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--ink-soft)',
                        boxShadow: 'none',
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
                // === DONE TRACKING (May 29 2026 per Jenni) ===
                // Circles now reflect explicit DONE state (not "absent
                // from skipped" — that was the old assume-done model
                // and conflicted with the blank-circle visual). Toggle
                // mutates amDone/pmDone arrays directly; save logic
                // below reads both done + skipped to commit the right
                // shape.
                const slotForRender = ritualSlot;
                const doneKey = slotForRender === 'pm' ? 'pmDone' : 'amDone';
                const doneList = sourceCheckIn && Array.isArray(sourceCheckIn[doneKey]) ? sourceCheckIn[doneKey] : [];
                const renderList = slotForRender === 'pm' ? pmList : amList;
                const renderOverflow = slotForRender === 'pm' ? pmOverflow : amOverflow;
                const renderHidden = slotForRender === 'pm' ? pmHidden : amHidden;
                const doneIdsForRender = doneList;
                return (
                  <div className="space-y-1 mb-2">
                    <RoutineSlotList
                      slot={slotForRender}
                      products={renderList}
                      overflow={renderOverflow}
                      hiddenProducts={renderHidden}
                      shelfProducts={products}
                      regimenLogs={regimenLogs}
                      canRepeat={canRepeatRitual}
                      onRepeat={repeatYesterday}
                      onRemove={removeFromSlot}
                      onOverflow={() => {}}
                      doneIds={doneIdsForRender}
                      onToggleDone={(product, slotKey) => {
                        if (!product || !product.id) return;
                        const dk = slotKey === 'pm' ? 'pmDone' : 'amDone';
                        // === LOCK SLOT TO USER'S CHOICE (May 31 2026 bug fix) ===
                        // Without this, tapping a PM circle could trigger the
                        // App-level auto-PM-switch effect (it re-runs on every
                        // regimenLogs change). When a log already had both
                        // amProducts and pmProducts populated and the clock
                        // was before 5pm, that effect would flip ritualSlot
                        // back to 'am' on the very next render — making the
                        // PM circle appear to "do nothing" because the AM
                        // slot view (with its OWN amDone state) re-rendered
                        // over the top. Calling setRitualSlot (which is the
                        // userSetRitualSlot wrapper at the App level) flips
                        // the manual ref so the auto-switch effect respects
                        // the slot the user is actively logging into.
                        if (typeof setRitualSlot === 'function') setRitualSlot(slotKey);
                        const currentList = (regimenLogs || []).find(r => r.date === viewDate);
                        const currentDone = currentList && Array.isArray(currentList[dk]) ? currentList[dk] : [];
                        // Toggle done membership directly. Empty circle
                        // → mark done. Filled circle → mark not done.
                        const nextDone = currentDone.includes(product.id)
                          ? currentDone.filter(x => x !== product.id)
                          : [...currentDone, product.id];
                        const updatedLog = currentList
                          ? { ...currentList, [dk]: nextDone }
                          : {
                              id: Date.now(),
                              date: viewDate,
                              amProducts: amList.map(p => p && p.id).filter(Boolean),
                              pmProducts: pmList.map(p => p && p.id).filter(Boolean),
                              amDone: slotKey === 'am' ? nextDone : [],
                              pmDone: slotKey === 'pm' ? nextDone : [],
                              amSkipped: [],
                              pmSkipped: [],
                              notes: '',
                              submitted: false,
                            };
                        const next = currentList
                          ? regimenLogs.map(r => r.date === viewDate ? updatedLog : r)
                          : [updatedLog, ...regimenLogs];
                        setRegimenLogs(next);
                        persistRegimenLogs(next, 'toggle-product-done');
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
              {(() => {
                const hasBuiltRoutine = userHasBuiltPattern(products) || !!(buildPlanAccepted && buildPlan);
                if (!hasBuiltRoutine) {
                  return (
                    <>
                      <h2 className="text-[17px] md:text-[18px] leading-[1.2] mb-2" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'-0.012em'}}>
                        No routine built yet.
                      </h2>
                      <p className="text-[12.5px] leading-relaxed mb-2" style={{color:'var(--ink)', fontWeight:400}}>
                        Tell Frida what you own, what your skin tolerates, and how often you want actives. We’ll turn the shelf into an actual week.
                      </p>
                      <p className="text-[11.5px] leading-relaxed mb-4" style={{color:'var(--ink-soft)', fontWeight:400}}>
                        You can still mark today as skipped, but building the routine is the useful next move.
                      </p>
                    </>
                  );
                }
                return (
                  <>
                    <h2 className="text-[17px] md:text-[18px] leading-[1.2] mb-2" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'-0.012em'}}>
                      Nothing in this slot yet.
                    </h2>
                    <p className="text-[12.5px] leading-relaxed mb-2" style={{color:'var(--ink)', fontWeight:400}}>
                      Your weekly routine exists; today’s {ritualSlot.toUpperCase()} just needs a product logged or added.
                    </p>
                    <p className="text-[11.5px] leading-relaxed mb-4" style={{color:'var(--ink-soft)', fontWeight:400}}>
                      Fill this slot from your shelf, or mark it skipped if bare was intentional.
                    </p>
                  </>
                );
              })()}
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
              <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full px-2.5 py-1" style={{background:'var(--cream-deep)', border: '1px solid var(--line)', width:'fit-content'}}>
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
                1. Primary filled CTA — "Yes, I did my AM/PM regimen"
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
              // === PAST-EMPTY DEDUPE (May 2026 per Jenni) ===
              // When the day has no log, the past-empty branch above
              // already renders a "Log retroactively" CTA. Stacking
              // "Edit log" under it created two redundant buttons.
              // Suppress this CTA when there's nothing to edit — the
              // user lands here only when a log already exists.
              if (coverResolved.source === 'past-empty') return null;
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
            //   1. all-checked (default)  → "Yes, I did my AM/PM regimen" (filled accent)
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
            //
            // === UNDO BUG FIX (June 2026 per Jenni) ===
            // Was: `|| pmHasItems` fallback meant slotSubmitted stayed
            // true even after undoSlotLog cleared pmDone, because
            // pmProducts (the schedule) still had items. Result: tap
            // to undo did nothing visible — UI never flipped back to
            // the primary CTA. Fix: require actual done items (or the
            // explicit slot-batch-confirmed flag) to flip slotSubmitted.
            const slotSubmitted = !!(submittedToday && sourceCheckIn && (
              ctaSlot === 'pm'
                ? ((Array.isArray(sourceCheckIn.pmDone) && sourceCheckIn.pmDone.length > 0) || sourceCheckIn.pmBatchConfirmed === true)
                : ((Array.isArray(sourceCheckIn.amDone) && sourceCheckIn.amDone.length > 0) || sourceCheckIn.amBatchConfirmed === true)
            ));
            // Skipped IDs for the current slot (from prompt 3 model).
            const skippedKeyForCta = ctaSlot === 'pm' ? 'pmSkipped' : 'amSkipped';
            const skippedListForCta = sourceCheckIn && Array.isArray(sourceCheckIn[skippedKeyForCta]) ? sourceCheckIn[skippedKeyForCta] : [];
            const skippedSetForCta = new Set(skippedListForCta);
            const skippedCount = ctaList.filter(p => p && p.id && skippedSetForCta.has(p.id)).length;
            const hasSomeSkipped = skippedCount > 0 && ctaList.length > 0;
            const mergeIds = (...lists) => {
              const seen = new Set();
              const out = [];
              lists.flat().forEach(id => {
                if (!id || seen.has(id)) return;
                seen.add(id);
                out.push(id);
              });
              return out;
            };
            // Done IDs (manually checked circles) for the current slot.
            const doneKeyForCta = ctaSlot === 'pm' ? 'pmDone' : 'amDone';
            const doneListForCta = sourceCheckIn && Array.isArray(sourceCheckIn[doneKeyForCta]) ? sourceCheckIn[doneKeyForCta] : [];
            const doneSetForCta = new Set(doneListForCta);
            const doneCount = ctaList.filter(p => p && p.id && doneSetForCta.has(p.id)).length;
            const hasSomeManualDone = doneCount > 0 && doneCount < ctaList.length;
            const totalCount = ctaList.length;
            const isEmptySlot = ctaList.length === 0;
            const hasBuiltRoutineForCta = userHasBuiltPattern(products) || !!(buildPlanAccepted && buildPlan);
            const ctaIcon = slotSubmitted ? 'Check' : (ctaSlot === 'pm' ? 'Moon' : 'Sun');
            // === SMART CTA LABEL (May 29 2026 v2 per Jenni) ===
            // Unified to plain-English "yes, I did" framing — was too
            // clinical ("Save AM check-in"). Three states:
            //   1. submitted                       → "✓ Today logged"
            //   2. empty slot                      → "Yes, I skipped {AM/PM} products"
            //   3. some circles manually checked   → "Save 3 of 6 done"
            //   4. default OR some X'd as skipped  → "Yes, I did today's {AM/PM} regimen"
            //      (tapping commits all planned minus any X'd skipped —
            //      the natural reading: "I did everything I didn't skip")
            // === SHORTER CTA LABELS (June 2026 per Jenni — two-pill layout) ===
            // Was full-width verbose labels. Shorter copy so the two pills
            // fit side-by-side at 380px without truncation.
            const ctaLabel = slotSubmitted
              ? 'Done today'
              : (isEmptySlot
                ? (ctaSlot === 'pm' ? 'Skip PM today' : 'Skip AM today')
                : (hasSomeManualDone
                  ? `Save ${doneCount}/${totalCount}`
                  : (ctaSlot === 'pm' ? "Yes, I did PM" : "Yes, I did AM")));
            // Inline save — writes the regimen log for viewDate with
            // exactly the checked products marked done (planned minus
            // skipped). Skipped IDs are preserved in the log so the
            // user can see what was missed without us mutating the
            // future routine. submitted=true commits today.
            const logRitualNow = () => {
              const amIds = amList.map(p => p && p.id).filter(Boolean);
              const pmIds = pmList.map(p => p && p.id).filter(Boolean);
              const existing = (regimenLogs || []).find(r => r.date === viewDate);
              const nextAmIds = mergeIds(existing?.amProducts || [], amIds);
              const nextPmIds = mergeIds(existing?.pmProducts || [], pmIds);
              const prevAmDone = existing && Array.isArray(existing.amDone) ? existing.amDone : [];
              const prevPmDone = existing && Array.isArray(existing.pmDone) ? existing.pmDone : [];
              const prevAmSkipped = existing && Array.isArray(existing.amSkipped) ? existing.amSkipped : [];
              const prevPmSkipped = existing && Array.isArray(existing.pmSkipped) ? existing.pmSkipped : [];
              // === COMMIT SHAPE (May 29 2026 per Jenni) ===
              // If user manually checked SOME circles (partial) → commit
              // only those as done. Otherwise → commit all planned minus
              // any explicitly skipped (the "Yes, I did my regimen"
              // catch-all path).
              const commitSkipped = ctaSlot === 'am' ? prevAmSkipped : prevPmSkipped;
              const commitPlanned = ctaSlot === 'am' ? nextAmIds : nextPmIds;
              const priorDoneForSlot = ctaSlot === 'am' ? prevAmDone : prevPmDone;
              const userMarkedPartial = priorDoneForSlot.length > 0 && priorDoneForSlot.length < commitPlanned.length;
              const skippedSet = new Set(commitSkipped);
              const commitDone = userMarkedPartial
                ? priorDoneForSlot
                : commitPlanned.filter(id => !skippedSet.has(id));
              // === BATCH-CONFIRM TAG (May 2026 per Jenni) ===
              // Marks this slot's commit as "user tapped Yes I did without
              // touching individual product checkboxes." If amSkipped/
              // pmSkipped came in empty (no per-product engagement), the
              // analyzer downstream treats the day's product list as
              // "planned but not verified" rather than "actively used."
              // This prevents AHA/retinoid that the user has stopped
              // touching from continuing to look like daily usage forever.
              const isAmBatchSlot = ctaSlot === 'am' && commitSkipped.length === 0;
              const isPmBatchSlot = ctaSlot === 'pm' && commitSkipped.length === 0;
              const nextLog = {
                ...(existing || {}),
                id: existing?.id || Date.now(),
                date: viewDate,
                amProducts: nextAmIds,
                pmProducts: nextPmIds,
                amDone: ctaSlot === 'am' ? commitDone : prevAmDone,
                pmDone: ctaSlot === 'pm' ? commitDone : prevPmDone,
                amSkipped: ctaSlot === 'am' ? commitSkipped : prevAmSkipped,
                pmSkipped: ctaSlot === 'pm' ? commitSkipped : prevPmSkipped,
                amExtras: existing?.amExtras || [],
                pmExtras: existing?.pmExtras || [],
                // Preserve prior batch flag on the OTHER slot; set on THIS slot.
                amBatchConfirmed: ctaSlot === 'am' ? isAmBatchSlot : (existing?.amBatchConfirmed ?? false),
                pmBatchConfirmed: ctaSlot === 'pm' ? isPmBatchSlot : (existing?.pmBatchConfirmed ?? false),
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
              toast(`${ctaSlot.toUpperCase()} regimen logged`, 'success');
            };
            // Undo for the submitted state — clears the slot's
            // submitted commit (resets amDone/pmDone for THIS slot,
            // preserves the other slot, flips submitted iff both
            // slots are now empty of done items).
            const undoSlotLog = () => {
              const existing = (regimenLogs || []).find(r => r.date === viewDate);
              if (!existing) return;
              const otherSlotBatchConfirmed = ctaSlot === 'am'
                ? !!existing.pmBatchConfirmed
                : !!existing.amBatchConfirmed;
              const otherSlotHasDone = ctaSlot === 'am'
                ? (Array.isArray(existing.pmDone) && existing.pmDone.length > 0)
                : (Array.isArray(existing.amDone) && existing.amDone.length > 0);
              const nextLog = {
                ...existing,
                amDone: ctaSlot === 'am' ? [] : (existing.amDone || []),
                pmDone: ctaSlot === 'pm' ? [] : (existing.pmDone || []),
                // June 2026: also clear the batch-confirmed flag for this
                // slot. Without this, slotSubmitted stayed true on undo.
                amBatchConfirmed: ctaSlot === 'am' ? false : existing.amBatchConfirmed,
                pmBatchConfirmed: ctaSlot === 'pm' ? false : existing.pmBatchConfirmed,
                submitted: otherSlotBatchConfirmed || otherSlotHasDone,
              };
              const next = regimenLogs.map(r => r.date === viewDate ? nextLog : r);
              setRegimenLogs(next);
              setCoverRoutineRebuildToken(t => t + 1);
              persistRegimenLogs(next, 'undo-slot-log');
              toast(`${ctaSlot.toUpperCase()} log undone`, 'info');
            };
            const buildStandingRoutine = () => {
              setActiveTab('regimen');
              setRegimenView('build');
            };
            const restoreEmptySlotFromRoutine = () => {
              const dow = new Date().getDay();
              const pat = getProductsForTodayFromPattern((products || []).filter(p => !p.endDate), dow);
              const patIds = (ctaSlot === 'am' ? pat.am : pat.pm).map(p => p.id);
              const slotKey = ctaSlot === 'pm' ? 'pmProducts' : 'amProducts';
              const existing = (regimenLogs || []).find(r => r.date === viewDate);
              if (!patIds.length) {
                toast(`No ${ctaSlot.toUpperCase()} products in today's routine`, 'info');
                return;
              }
              if (!existing) {
                const newLog = {
                  id: Date.now(),
                  date: viewDate,
                  amProducts: ctaSlot === 'am' ? patIds : [],
                  pmProducts: ctaSlot === 'pm' ? patIds : [],
                  amExtras: [], pmExtras: [],
                  devices: [], sleep: '', supplements: [],
                  submitted: false,
                };
                const next = [newLog, ...(regimenLogs || [])];
                setRegimenLogs(next);
                persistRegimenLogs(next, 'restore-empty-cta-slot');
                setCoverRoutineRebuildToken(t => t + 1);
                toast(`Restored ${ctaSlot.toUpperCase()} from your weekly plan`, 'info');
                return;
              }
              const next = (regimenLogs || []).map(r => r.date === viewDate ? { ...r, [slotKey]: patIds } : r);
              setRegimenLogs(next);
              persistRegimenLogs(next, 'restore-cta-slot');
              setCoverRoutineRebuildToken(t => t + 1);
              toast(`Restored ${ctaSlot.toUpperCase()} from your weekly plan`, 'info');
            };
            return (
              <>
                {/* === TWO-PILL CTA ROW (June 2026 per Jenni) ===
                    Was: stacked full-width buttons (Today logged / Log AM /
                    Used something else today? Add here). Now: two equal
                    pills side-by-side. Left pill is state-aware (logged
                    state vs primary CTA); right pill is the always-visible
                    "Something else?" shortcut. Empty slot path keeps its
                    own stacked layout since those are recovery affordances,
                    not the daily-execution pair. */}
                {isEmptySlot ? (
                  <>
                    <button
                      onClick={hasBuiltRoutineForCta ? restoreEmptySlotFromRoutine : buildStandingRoutine}
                      className="w-full rounded-full py-3 px-4 flex items-center justify-center gap-2 transition hover:opacity-90 mt-3"
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--cream)',
                        border: '1px solid var(--accent)',
                        fontWeight: 600, fontSize: 12.5, letterSpacing: '0.04em', cursor: 'pointer',
                      }}
                      title={hasBuiltRoutineForCta ? `Restore ${ctaSlot.toUpperCase()} from your weekly plan` : 'Build your standing routine'}
                      type="button"
                    >
                      <Icon name={hasBuiltRoutineForCta ? 'RotateCcw' : 'Sparkles'} size={13} />
                      <span className="truncate">{hasBuiltRoutineForCta ? `Restore ${ctaSlot.toUpperCase()}` : 'Build routine'}</span>
                    </button>
                    {hasBuiltRoutineForCta && (
                      <button
                        onClick={buildStandingRoutine}
                        className="w-full rounded-full py-2.5 px-4 flex items-center justify-center gap-1.5 transition hover:bg-[var(--cream)] mt-2"
                        style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11.5, letterSpacing:'0.02em', cursor:'pointer'}}
                        title="Rebuild your standing routine"
                        type="button"
                      >
                        <Icon name="Sparkles" size={12} />
                        <span>Rebuild routine</span>
                      </button>
                    )}
                    <button
                      onClick={logRitualNow}
                      className="w-full rounded-full py-2.5 px-4 flex items-center justify-center gap-1.5 transition hover:bg-[var(--cream)] mt-2"
                      style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11.5, letterSpacing:'0.02em', cursor:'pointer'}}
                      title={`Log ${ctaSlot.toUpperCase()} as bare for today`}
                      type="button"
                    >
                      <Icon name={ctaSlot === 'pm' ? 'Moon' : 'Sun'} size={12} />
                      <span>Skip {ctaSlot.toUpperCase()} today</span>
                    </button>
                  </>
                ) : (
                  // === Commit-pill-first layout (June 2026 per Jenni) ===
                  // Standalone full-width commit pill with circle indicator
                  // that fills as the user marks more rows done. Bottom grid
                  // is the edit-actions pair (Shelf + Used something else?).
                  // Was a crowded 3-button layout where commit + add + add
                  // shared real estate. Splitting commit (decisive action)
                  // from add (modifying action) reads cleaner.
                  <div className="mt-3 space-y-2">
                    {(() => {
                      const allDone = totalCount > 0 && doneCount === totalCount;
                      const partialDone = doneCount > 0 && doneCount < totalCount;
                      const circleFill = slotSubmitted ? 'var(--accent-blue)'
                        : allDone ? 'var(--accent)'
                        : 'transparent';
                      const circleIconName = (slotSubmitted || allDone) ? 'Check' : null;
                      const circleBorder = slotSubmitted ? 'var(--accent-blue)'
                        : allDone ? 'var(--accent)'
                        : 'rgba(255,255,255,0.85)';
                      return (
                        <button
                          type="button"
                          onClick={slotSubmitted ? undoSlotLog : logRitualNow}
                          className="w-full rounded-full py-3 px-4 flex items-center justify-center gap-2 transition hover:opacity-90"
                          style={{
                            background: slotSubmitted ? 'var(--cream-deep)' : 'var(--accent)',
                            color: slotSubmitted ? 'var(--ink)' : 'var(--cream)',
                            border: '1px solid ' + (slotSubmitted ? 'var(--line)' : 'var(--accent)'),
                            fontWeight: 700, fontSize: 12.5, letterSpacing: '0.02em', cursor: 'pointer',
                          }}
                          title={slotSubmitted
                            ? `Tap to undo today's ${ctaSlot.toUpperCase()} commit`
                            : (allDone ? `Save ${ctaSlot.toUpperCase()} — all done` : `Save ${ctaSlot.toUpperCase()} (${doneCount}/${totalCount} done)`)}
                          aria-label={slotSubmitted ? `${ctaSlot.toUpperCase()} logged today, tap to undo` : `Save ${ctaSlot.toUpperCase()} regimen`}
                        >
                          <span
                            className="inline-flex items-center justify-center flex-shrink-0"
                            style={{
                              width: 16, height: 16, borderRadius: '50%',
                              background: circleFill,
                              border: '1.5px solid ' + circleBorder,
                              color: (slotSubmitted || allDone) ? 'var(--cream)' : 'transparent',
                            }}
                          >
                            {circleIconName && <Icon name={circleIconName} size={9} strokeWidth={3} />}
                          </span>
                          <span className="truncate">
                            {slotSubmitted
                              ? `Done today · undo`
                              : allDone
                                ? `Save ${ctaSlot.toUpperCase()} · all done`
                                : partialDone
                                  ? `Save ${doneCount}/${totalCount}`
                                  : `Yes, I did ${ctaSlot.toUpperCase()}`}
                          </span>
                        </button>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-2">
                      {/* === June 2026 (per Jenni): direct Shelf entry ===
                          Most users adding to today are adding from their own
                          shelf. Was 3 taps (Something else? → From shelf →
                          +AM/+PM); now 1 tap → opens the shelf-quickadd sheet
                          directly with the current slot pre-set. */}
                      <button
                        onClick={() => { if (typeof setShelfQuickAddOpen === 'function') setShelfQuickAddOpen({ open: true, slot: ctaSlot, date: viewDate }); }}
                        className="rounded-full py-3 px-3 flex items-center justify-center gap-1.5 transition hover:opacity-90"
                        style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:700, fontSize:12, letterSpacing:'0.02em', cursor:'pointer'}}
                        title="Quick-add from your shelf or devices to today"
                        type="button"
                      >
                        <Icon name="Layers" size={12} />
                        <span className="truncate">Shelf</span>
                      </button>
                      <button
                        onClick={() => setUsedSomethingElseSheet({ open: true, slot: ctaSlot, date: viewDate })}
                        className="rounded-full py-3 px-3 flex items-center justify-center gap-1.5 transition hover:bg-[var(--cream)]"
                        style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.02em', cursor:'pointer'}}
                        title="Add a one-off product, procedure, supplement, or note for today only"
                        type="button"
                      >
                        <Icon name="Plus" size={12} />
                        <span className="truncate">Something else?</span>
                      </button>
                    </div>
                  </div>
                )}
                {/* === REFINE ROUTINE LINK (June 2026 per Jenni — bottom right) ===
                    Quiet text link that routes to Regimen → Refine view.
                    Repositioned to bottom-right: a footer link rather than
                    a full-width CTA. Sits visually subordinate to the
                    "Used something else?" outlined button above — Refine
                    is the "going forward" lever, used less often per
                    session than today-only edits. */}
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('regimen'); setRegimenView('build'); }}
                    className="inline-flex items-center gap-1 transition hover:opacity-70"
                    style={{background:'transparent', color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', cursor:'pointer', border:'none', padding:'4px 0'}}
                    title="Change your routine going forward"
                  >
                    <span>Refine routine</span>
                    <Icon name="ArrowRight" size={10} />
                  </button>
                </div>
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
                {/* Dead "Rebuild routine" button removed 2026-05-31 (was gated {false &&}). */}
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

      {/* === PROCEDURE PROGRESS (May 30 2026 per Jenni — relocated) ===
          Moved from above the regimen to below it. Reads as reference
          ("is this working?") rather than daily-action content, so it
          earns its real estate below today's routine. Kebab menu in
          the upper-right (export · view compare · view timeline)
          replaces the inline 'Open compare' link for a cleaner header. */}
      {(() => {
        const today = new Date();
        // T1 (May 31 2026): widened proc selection to include FUTURE-scheduled
        // procedures, not just past. Previously we only looked at proc.date <=
        // today; users who logged an upcoming appointment saw NOTHING here.
        // We now grab the most recent procedure (past or future). When the
        // resulting state has no real milestone tiles to render (future-only
        // appointment or daysSinceProc < 0), we render the small countdown
        // alternative card below instead of returning null.
        const sortedAll = (procedures || [])
          .filter(p => p && p.date)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const pastProc = sortedAll.find(p => new Date(p.date + 'T00:00:00') <= today);
        const upcomingProc = sortedAll
          .filter(p => new Date(p.date + 'T00:00:00') > today)
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
        const proc = pastProc || upcomingProc;
        if (!proc) return null;

        const procDate = new Date(proc.date + 'T00:00:00');
        const daysSinceProc = Math.floor((today.getTime() - procDate.getTime()) / 86400000);

        const MILESTONES = [
          { label: 'Day of',   off: 0   },
          { label: '1 week',   off: 7   },
          { label: '1 month',  off: 30  },
          { label: '2 months', off: 60  },
          { label: '3 months', off: 90  },
          { label: '6 months', off: 180 },
        ];
        const upcoming = MILESTONES.find(m => m.off > daysSinceProc);
        const visible = MILESTONES.filter(m => m.off <= daysSinceProc);
        if (upcoming) visible.push(upcoming);
        // T1 (May 31 2026): when there are no past milestones to render
        // (procedure is future-scheduled, daysSinceProc < 0), show a
        // small countdown alternative card instead of returning null.
        const noPastMilestones = !visible.some(m => m.off <= daysSinceProc && m.off >= 0 && daysSinceProc >= 0);
        if (!visible.length || noPastMilestones || daysSinceProc < 0) {
          const daysUntil = Math.max(0, Math.ceil((procDate.getTime() - today.getTime()) / 86400000));
          const procDateLabelFuture = procDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const countdownLine = daysUntil === 0
            ? 'today'
            : daysUntil === 1
              ? 'tomorrow'
              : `in ${daysUntil} days`;
          return (
            <section ref={procedureProgressRef} className="rounded-[14px] border p-4" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
              <div className="text-[10px] tracking-[0.28em] uppercase" style={{ color: 'var(--accent)', fontWeight: 700 }}>Procedure progress</div>
              <h3 className="text-[18px] leading-[1.1] mt-0.5 truncate" style={{ color: 'var(--ink)', fontWeight: 700, letterSpacing: '-0.02em' }}>{proc.name || 'Upcoming procedure'}</h3>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>Scheduled · {procDateLabelFuture} · {countdownLine}</div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                <Icon name="Calendar" size={12} style={{ color: 'var(--ink-soft)' }} />
                <span>Countdown to day 0</span>
              </div>
            </section>
          );
        }

        const photoLogs = (logs || []).filter(l => l && l.date && (l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'))));
        const fullFace = photoLogs.filter(l => l.area === 'full-face');
        const pool = fullFace.length ? fullFace : photoLogs;

        const findClosest = (targetDate, maxDaysOff) => {
          let best = null, bestDiff = Infinity;
          const tT = targetDate.getTime();
          pool.forEach(l => {
            const t = new Date(l.date + 'T00:00:00').getTime();
            const diff = Math.abs(t - tT);
            if (diff / 86400000 > maxDaysOff) return;
            if (diff < bestDiff) { best = l; bestDiff = diff; }
          });
          return best;
        };

        const tiles = visible.map(m => {
          const target = new Date(procDate.getTime() + m.off * 86400000);
          const isFuture = target > today;
          const tol = m.off === 0 ? 3 : Math.min(21, Math.max(5, Math.round(m.off * 0.15)));
          return {
            key: 'm' + m.off,
            label: m.label,
            targetDate: target,
            log: isFuture ? null : findClosest(target, tol),
            isFuture
          };
        });

        const procDateLabel = procDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Menu uses native <details>/<summary> so it doesn't need
        // additional React state to manage open/close. Closes on
        // outside-click via the global handler below.
        return (
          <section ref={procedureProgressRef} className="rounded-[14px] border p-4" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-[10px] tracking-[0.28em] uppercase" style={{ color: 'var(--accent)', fontWeight: 700 }}>Procedure progress</div>
                <h3 className="text-[18px] leading-[1.1] mt-0.5 truncate" style={{ color: 'var(--ink)', fontWeight: 700, letterSpacing: '-0.02em' }}>{proc.name || 'Recent procedure'}</h3>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{procDateLabel} · day {daysSinceProc}</div>
              </div>
              <details className="relative flex-shrink-0" style={{ listStyle: 'none' }}>
                <summary className="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition" style={{ borderColor: 'var(--line)', listStyle: 'none', color: 'var(--ink-soft)' }} aria-label="Procedure actions">
                  <Icon name="MoreHorizontal" size={14} />
                </summary>
                <div className="absolute right-0 top-[36px] z-20 rounded-[10px] border shadow-lg overflow-hidden min-w-[170px]" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
                  <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; exportProcedureProgress(proc.name); }} className="w-full text-left px-3 py-2.5 text-[12px] flex items-center gap-2 transition hover:bg-[var(--cream-deep)]" style={{ color: 'var(--ink)' }}>
                    <Icon name="Share2" size={12} style={{ color: 'var(--ink-soft)' }} /> Export / share
                  </button>
                  <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; setActiveTab('compare'); }} className="w-full text-left px-3 py-2.5 text-[12px] flex items-center gap-2 transition hover:bg-[var(--cream-deep)] border-t" style={{ color: 'var(--ink)', borderColor: 'var(--line)' }}>
                    <Icon name="GitCompare" size={12} style={{ color: 'var(--ink-soft)' }} /> View compare
                  </button>
                  <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; setActiveTab('journal'); }} className="w-full text-left px-3 py-2.5 text-[12px] flex items-center gap-2 transition hover:bg-[var(--cream-deep)] border-t" style={{ color: 'var(--ink)', borderColor: 'var(--line)' }}>
                    <Icon name="Calendar" size={12} style={{ color: 'var(--ink-soft)' }} /> View timeline
                  </button>
                </div>
              </details>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
              {tiles.map(t => (
                <div key={t.key} className="flex-shrink-0 flex flex-col items-center" style={{ width: 82 }}>
                  <div className="w-[82px] h-[104px] rounded-[10px] border overflow-hidden mb-1.5 flex items-center justify-center" style={{ background: 'var(--cream-deep)', borderColor: 'var(--line)' }}>
                    {t.log ? (
                      <Photo item={t.log} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[8.5px] tracking-[0.14em] uppercase text-center px-1 leading-tight" style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>
                        {t.isFuture ? 'soon' : 'no photo'}
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] tracking-[0.16em] uppercase leading-tight text-center" style={{ color: t.log ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: 700 }}>{t.label}</div>
                  {t.log && (
                    <div className="text-[8.5px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{new Date(t.log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* === TODAY'S NOTE ===
          Replaces the prior "Frida Insight: [pearl title]" strip,
          which read like a magazine article preview. Now it's a
          one-line observation keyed to the user's actual state —
          a friend with an opinion, not a content feed. Falls back
          to the pearl-of-day topic when nothing contextual fires.
          May 2026 per Jenni. */}
      {(() => {
      // Wave 8.3 fix (May 2026): pearlOfDay used to live in HomeDashboard's
      // outer scope. Re-derive here so the child stays self-contained.
      // Bug #19: same LESSONS empty-guard as the outer derivation — `% 0`
      // returns NaN → LESSONS[NaN] is undefined → `pearlOfDay.title` crash.
      const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const pearlOfDay = LESSONS.length ? LESSONS[dayOfYear % LESSONS.length] : null;
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
            why: "Most skincare reactions show up 24–72 hours after introduction. If sensitivity spiked today and you started or swapped a product in the last few days, that's the place to look first — not the products you've been using for months.",
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
            evidence: "Retinoid 3–4 nights/week with AHA/BHA on off-nights is the gentler cadence — especially in the first 8 weeks of retinoid use.",
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
        : 'Frida Insight';
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
          style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}
        >
          <button
            onClick={handleClick}
            className="w-full px-4 py-3 flex items-center gap-3 transition hover:opacity-95 text-left"
            style={{cursor: hasExplanation || !isContextual ? 'pointer' : 'default'}}
            aria-label={hasExplanation
              ? (expanded ? "Collapse explanation" : "Tap to see why")
              : (isContextual ? "Today's note" : `Open Frida insight on ${bodyText}`)
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
            <div className="px-4 pb-4 pt-1 border-t" style={{borderColor: 'var(--line)'}}>
              {contextual.why && (
                <div className="mt-3">
                  <div className="text-[8.5px] tracking-[0.28em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Why</div>
                  <p className="text-[12px] leading-relaxed" style={{color:'var(--ink)', fontWeight:400}}>
                    {contextual.why}
                  </p>
                </div>
              )}
              {contextual.evidence && (
                <div className="mt-3 pt-3 border-t" style={{borderColor: 'var(--line)'}}>
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

      {/* === THIS WEEK STRIP — REMOVED 2026-05-31 ===
          Weekly content lives in Journal → Sunday Digest. Previously
          wrapped in `false &&` so it never rendered; ~115 lines of
          dead UI + helpers removed. Restore from git history if
          weekly strip is ever brought back to the cover. */}

      {/* === HOME RECS LINK (May 2026) ===
          Home does NOT show full rec cards — that would crowd the
          hero. Instead, one quiet line at the bottom that routes to
          Journal where every state (SWAP / MISSING / CONCERN_GAP) is
          surfaced as a card. Per Jenni: "one comment with arrow at the
          bottom underneath regimen and user can go to the hero journal
          where all the recs can be given." */}
      {(() => {
        try {
          const ritual = resolveTodayRitual({ products, regimenLogs, date: todayStr, userProfile });
          const coverage = resolveCoverageStates({
            routine: { am: ritual.am, pm: ritual.pm },
            concerns: [],
            preferences: { routineSize: userProfile?.routineSize || 'standard' },
          }, deriveProductJobs);
          const missingCount    = coverage.missing?.length    || 0;
          const swapCount       = coverage.swap?.length       || 0;
          const concernGapCount = coverage.concernGap?.length || 0;
          const total = missingCount + swapCount + concernGapCount;
          if (total === 0) return null;
          // One-line hint that names the most significant gap if there
          // is one; otherwise a quiet "a few worth a look."
          let hint = '';
          if (missingCount > 0) {
            const firstJob = coverage.missing[0]?.job;
            const label = (typeof JOB_LABELS !== 'undefined' && JOB_LABELS[firstJob]) || firstJob;
            hint = `We'd add a ${label}`;
          } else if (swapCount > 0) {
            hint = 'A few things worth rethinking';
          } else {
            hint = 'A few gaps to close';
          }
          return (
            <button
              type="button"
              onClick={() => setActiveTab('journal')}
              className="w-full flex items-center justify-center gap-2 py-3 mt-2 transition hover:opacity-80"
              style={{color:'var(--ink-soft)', cursor:'pointer'}}
              aria-label="See recommendations in Journal"
            >
              <span className="text-[11px]">{hint}</span>
              <span style={{color:'var(--line)'}}>·</span>
              <span className="text-[10px] tracking-[0.22em] uppercase">See in Journal</span>
              <Icon name="ArrowRight" size={11} />
            </button>
          );
        } catch (e) {
          return null;
        }
      })()}
    </div>
  );
};
