// === CompareView (Wave 7.3 extract — May 2026) ===
// The Compare tab body — extracted from App's inline IIFE
// `{activeTab === 'compare' && (() => { ... })()}`. Subtabs: time analysis,
// ask Claude about your skin progress, procedure compare. ~1300 lines.
//
// All App-scope state + setters are passed as explicit props.

const CompareView = ({
  activeTab,
  user,
  logs, setLogs,
  products,
  procedures,
  regimenLogs,
  compareSubTab, setCompareSubTab,
  compareTimeBeforeId, setCompareTimeBeforeId,
  compareTimeAfterId, setCompareTimeAfterId,
  compareTimeAnalysis, setCompareTimeAnalysis,
  compareTimeAnalyzing, setCompareTimeAnalyzing,
  compareTimePickerFor, setCompareTimePickerFor,
  compareAskInput, setCompareAskInput,
  setShowApiKeyModal,
  setShowLogModal,
  setShowHomeUploadPicker,
  setShowCheckInChooser,
  setShowProcedureModal,
  setProductCompareId,
  setOpenLesson,
  enterCompare,
  fetchPhotoAsBase64,
  fileToBase64,
  callClaude,
  saveData,
  toast,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  compareAskLoading,
  compareAskMessages, setCompareAskMessages,
  handleCompareAsk,
  runComparePairAnalysisShared,
  setShowPhotoImportQueue}) => {
  // === COMPARE TAB ===
  // Three sub-tabs (May 2026 — Ask retired, moved to Counsel):
  //   1. Quick    — auto today + user picks prior; quick-pick presets; AI inline
  //   2. Product  — list of eligible products; opens ProductCompareModal
  //   3. Procedure — list of procedures with before/after photo anchors
  // === Photo lightbox (June 2026 per Jenni) ===
  // Tap either Before or After photo → opens the PhotoLightbox with both
  // side-by-side at a much larger size. Lets users actually see deltas
  // they can't tell from the small thumbnails. Same component handles
  // single-photo zoom elsewhere; passing 2 photos triggers pair mode.
  const [lightboxPhotos, setLightboxPhotos] = React.useState(null);
  const photoSrcOf = (l) => {
    if (!l) return null;
    if (typeof l.photo === 'string' && l.photo.startsWith('data:')) return l.photo;
    return l.photo || null;
  };
  const openCompareLightbox = () => {
    const bSrc = photoSrcOf(beforeLog);
    const aSrc = photoSrcOf(afterLog);
    if (!beforeLog && !afterLog) return;
    const photos = [];
    if (beforeLog) photos.push({
      item: beforeLog, src: bSrc, label: 'Before', sub: fmt(beforeLog.date),
      area: beforeLog?.area || 'full-face', score: aiScoreOut10(beforeLog) || 0,
    });
    if (afterLog) photos.push({
      item: afterLog, src: aSrc, label: compareTimeAfterId && afterLog?.id !== afterDefaultLog?.id ? 'After' : 'After · today',
      sub: fmt(afterLog.date),
      area: afterLog?.area || 'full-face', score: aiScoreOut10(afterLog) || 0,
    });
    setLightboxPhotos(photos);
  };
  const hasPhoto = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
  const photoLogs = logs.filter(hasPhoto).sort((a, b) => new Date(b.date) - new Date(a.date));
  const fullFacePhotoLogs = photoLogs.filter(l => l.area === 'full-face');
  // Default "after" = most recent full-face (mirrors cover/timeline rules), fall back to any photo.
  const afterDefaultLog = fullFacePhotoLogs[0] || photoLogs[0] || null;
  const afterLog = compareTimeAfterId
    ? photoLogs.find(l => l.id === compareTimeAfterId) || afterDefaultLog
    : afterDefaultLog;
  const beforeLog = compareTimeBeforeId
    ? photoLogs.find(l => l.id === compareTimeBeforeId) || null
    : null;
  // Time-window presets — find closest photo around N days before "after"
  const findClosestLog = (targetDate, anchorArea, maxDays = 14) => {
    const cands = photoLogs
      .filter(l => l.id !== afterLog?.id)
      .map(l => ({ log: l, diff: Math.abs((new Date(l.date) - targetDate) / 86400000), sameArea: l.area === anchorArea }))
      .filter(c => c.diff <= maxDays);
    if (cands.length === 0) return null;
    cands.sort((a, b) => {
      if (a.sameArea !== b.sameArea) return a.sameArea ? -1 : 1;
      return a.diff - b.diff;
    });
    return cands[0].log;
  };
  const afterDate = afterLog ? new Date(afterLog.date) : null;
  // Quick-pick presets trimmed 5 → 3 (May 2026 audit). The 6-month and
  // 1-year chips almost never fire for a real user — even with a wide
  // ±30/45-day window most accounts don't have a matching photo that
  // far back, so they show up empty and clutter the strip. Keep 1w /
  // 1m / 3m, which cover the windows where Compare is actually useful.
  const presets = afterDate ? [
    { label: '1 week ago', target: 7, window: 4 },
    { label: '1 month ago', target: 30, window: 10 },
    { label: '3 months ago', target: 90, window: 21 },
  ].map(p => ({ ...p, log: findClosestLog(new Date(afterDate.getTime() - p.target * 86400000), afterLog?.area, p.window) })).filter(p => p.log) : [];

  const compareKey = beforeLog && afterLog ? `${beforeLog.id}-${afterLog.id}` : null;
  const cachedAnalysis = compareKey ? compareTimeAnalysis[compareKey] : null;

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // === ROUTINE DELTA (May 2026 audit) ===
  // Compare's biggest missing piece per the audit: it didn't know
  // about routine changes. Now it does — between the two photo
  // dates, surface what was added, what was dropped, and any
  // procedures in the window. Ties photo deltas to causal changes.
  //
  // Heuristics:
  //   added   = product.startDate is in (beforeDate, afterDate]
  //   dropped = product.endDate is in (beforeDate, afterDate]
  //             OR product had ≥3 regimenLog appearances in the 14
  //             days before beforeDate, but 0 in the 14 days before
  //             afterDate (silent drop — user just stopped using it)
  //   procs   = procedure.date is in [beforeDate, afterDate]
  const buildRoutineDelta = (beforeISO, afterISO) => {
    if (!beforeISO || !afterISO) return null;
    const bT = new Date(beforeISO).getTime();
    const aT = new Date(afterISO).getTime();
    if (!(aT > bT)) return null;
    const ms14 = 14 * 86400000;
    const countUsesInWindow = (productId, fromT, toT) => {
      let n = 0;
      (regimenLogs || []).forEach(r => {
        if (!r.date) return;
        const t = new Date(r.date).getTime();
        if (t < fromT || t > toT) return;
        if ((r.amProducts || []).includes(productId)) n++;
        if ((r.pmProducts || []).includes(productId)) n++;
      });
      return n;
    };
    const added = [];
    const droppedExplicit = [];
    const droppedSilent = [];
    (products || []).forEach(p => {
      const startT = p.startDate ? new Date(p.startDate).getTime() : null;
      const endT = p.endDate ? new Date(p.endDate).getTime() : null;
      if (startT && startT > bT && startT <= aT) {
        added.push(p);
      }
      if (endT && endT > bT && endT <= aT) {
        droppedExplicit.push(p);
        return;
      }
      // Silent-drop check — only for products that existed on the
      // shelf BEFORE the before-photo. Avoids flagging products that
      // were added in-window but barely used as "dropped."
      if (startT && startT < bT) {
        const beforeWindowUses = countUsesInWindow(p.id, bT - ms14, bT);
        const afterWindowUses = countUsesInWindow(p.id, aT - ms14, aT);
        if (beforeWindowUses >= 3 && afterWindowUses === 0) {
          droppedSilent.push(p);
        }
      }
    });
    const proceduresInWindow = (procedures || []).filter(p => {
      if (!p.date) return false;
      const t = new Date(p.date).getTime();
      return t >= bT && t <= aT;
    });
    const isEmpty = added.length === 0
      && droppedExplicit.length === 0
      && droppedSilent.length === 0
      && proceduresInWindow.length === 0;
    return {
      added,
      dropped: [...droppedExplicit, ...droppedSilent],
      droppedSilentIds: new Set(droppedSilent.map(p => p.id)),
      procedures: proceduresInWindow,
      isEmpty};
  };

  // Run AI on the chosen pair (Time tab only — Product/Procedure use their own modals).
  const runTimeAnalysis = async () => {
    if (!beforeLog || !afterLog) return;
    if (!canRunAnalysis()) { setShowApiKeyModal(true); return; }
    setCompareTimeAnalyzing(true);
    try {
      const days = Math.abs(Math.ceil((new Date(afterLog.date) - new Date(beforeLog.date)) / 86400000));
      const usage30 = getActualUsage(products, regimenLogs, logs, { windowDays: Math.min(90, days + 14) });
      const procsBetween = (procedures || []).filter(p => {
        const pd = new Date(p.date);
        return pd >= new Date(beforeLog.date) && pd <= new Date(afterLog.date);
      }).map(p => `${p.date}: ${p.name}`).join('\n') || 'none';
      // === ROUTINE CHANGES BLOCK (May 2026 audit) ===
      // Hand the AI an explicit list of what was added/dropped between
      // the two photo dates. Lets the analysis tie photo deltas to
      // causal product changes ("the new niacinamide is reading on the
      // redness drop") instead of guessing from current routine alone.
      const routineDelta = buildRoutineDelta(beforeLog.date, afterLog.date);
      const formatDeltaList = (arr) => arr.length === 0 ? null : arr.map(p => {
        const active = p.activeIngredients ? ` (${p.activeIngredients})` : '';
        return `${p.name}${active}`;
      }).join('; ');
      const addedLine = routineDelta ? formatDeltaList(routineDelta.added) : null;
      const droppedLine = routineDelta ? formatDeltaList(routineDelta.dropped) : null;
      const routineChangesBlock = (!addedLine && !droppedLine)
        ? 'No routine changes between these two dates.'
        : `${addedLine ? `Added: ${addedLine}` : ''}${addedLine && droppedLine ? '\n' : ''}${droppedLine ? `Dropped: ${droppedLine}` : ''}`;
      const prompt = `Compare two skin journal entries from the same person, ${days} days apart.

EARLIER (${beforeLog.date}, ${beforeLog.area}, rated ${beforeLog.rating}/10):
- Concerns: ${(beforeLog.concerns || []).join(', ') || 'none'}
- Notes: ${beforeLog.notes || 'none'}

LATER (${afterLog.date}, ${afterLog.area}, rated ${afterLog.rating}/10):
- Concerns: ${(afterLog.concerns || []).join(', ') || 'none'}
- Notes: ${afterLog.notes || 'none'}

ROUTINE CHANGES IN THIS WINDOW (causal candidates — weight these heavily when explaining what's different):
${routineChangesBlock}

CURRENT ROUTINE (active use, not shelf):
${formatUsageForPrompt(usage30)}

PROCEDURES IN WINDOW:
${procsBetween}

PRODUCT NAME RULE (strict):
- When you reference a product the user has on their shelf, use the EXACT product name AND active ingredient as listed in their data. Do NOT substitute a different product or invent one. (Example bug to avoid: user has Arazlo / tazarotene 0.045%, AI wrote "Effaclar Adapalene" — wrong product, wrong active.)
- If you suggest a NEW product the user doesn't have yet, say so explicitly: "Add a tazarotene 0.045% (e.g. Arazlo)…" — never imply they have it on their shelf when they don't.

VOICE — this matters as much as the read:
You are speaking in the combined voice of Dr. Jenni Tang and Dr. Christiana Gainey — two doctor best friends, internal medicine + GI + nephrology, USC + LA County trained. Lead with Gainey's directness, land with Jenni's warmth. The user should feel seen and slightly called out.
- Direct. "Skin looks dry," not "your skin shows signs of dehydration."
- Warm but dry. Affection in the subtext, not exclamation points.
- Funny in a clinical, observational way. Never quirky or peppy.
- Brief. Two sentences beats five.
- Honest. Never pretend something worked when the data doesn't show it.
- A little dark when it lands — these doctors have worked LA County nights.
- NEVER start a bullet with "I," "Based on," or "It looks like." Just say it.
- NO emojis. NO exclamation points unless something is genuinely exciting.
- This is educational skin guidance, not a medical diagnosis. Stay direct and confident on routine skincare. When something is severe, painful, infected, rapidly changing, or lesion-like, recommend in-person evaluation by a dermatologist or urgent care directly: "This needs an in-person look — see someone this week."

FORMAT (strict):
- Output 4-5 short bullets only. Each line starts with "- " (dash + space).
- NO markdown bold (no **text**), NO headers, NO paragraphs.
- Each bullet ≤ 16 words. TOTAL ≤ 65 words.
- Prefix EVERY bullet with a type tag in brackets: [OBSERVE] for visual reading of the skin, [CAUSE] for mechanism / why this is happening, [ACTION] for what to do next. Example: "- [OBSERVE] forehead congestion mild today". Pick the most-fitting single tag per bullet.
- Bake evidence quality into the prose itself in plain language: "well-studied for…", "evidence suggests…", "limited data, mechanism-based…", "emerging evidence…". Don't use letter grades.
- For [ACTION] bullets ONLY, also append a parseable evidence tag at the END in this exact format: [ev:strong|moderate|emerging:source] where source is one of RCT, observational, mechanism, expert. Example: "- [ACTION] Try azelaic 10% — well-studied for PIH. [ev:strong:RCT]". Skip this tag for [OBSERVE] and [CAUSE] bullets.
- Be specific, mechanism-anchored, no padding. Two doctor friends texting, not a textbook.

CONTENT: cover (1) what visibly changed and the most likely contributor — cite the routine or procedure, (2) one pattern or risk to watch, (3) one concrete adjustment for the next 4 weeks.`;
      // Pull base64 of both photos for vision
      const resolveB64 = async (item) => {
        if (item.photo && typeof item.photo === 'string' && item.photo.startsWith('data:')) {
          return item.photo.replace(/^data:image\/\w+;base64,/, '');
        }
        if (item.photoPath) {
          const dataUrl = await fetchPhotoAsBase64(item.photoPath);
          if (dataUrl) return dataUrl.replace(/^data:image\/\w+;base64,/, '');
        }
        return null;
      };
      // === ROUTE THROUGH callClaude (May 2026 v2) ===
      // Was: raw fetch to api.anthropic.com — duplicated headers,
      // no timeout guard, drifted from App's canonical caller.
      // Now: callClaude handles BYOK, timeout, and (when shipped)
      // backend proxy migration in one place.
      const [b64Before, b64After] = await Promise.all([resolveB64(beforeLog), resolveB64(afterLog)]);
      const images = [];
      if (b64Before) images.push(b64Before);
      if (b64After) images.push(b64After);
      const text = await callClaude(prompt, '', null, { images, maxTokens: 1500 });
      setCompareTimeAnalysis(prev => ({ ...prev, [compareKey]: text }));
    } catch (e) {
      console.error('[Compare Time] AI failed:', e);
      toast(`Analysis failed: ${e?.message?.slice(0, 80) || 'unknown'}`, 'error');
    }
    setCompareTimeAnalyzing(false);
  };

  // Build the procedure list with before/after photo anchors.
  // BEFORE = photo on (or nearest to) the procedure DAY itself — that's the
  //          authoritative pre-treatment baseline. Snap to ±3 days; null if none.
  // AFTER  = photo at the 30-DAY mark — the meaningful follow-up window for
  //          most procedures (laser/chemical peel/RF/microneedling all settle
  //          by week 3-4). Snap to ±7 days around procDate+30; if no photo
  //          falls in that window, fall back to most recent post-procedure photo.
  const procRows = (procedures || [])
    .map(p => {
      const procDate = new Date(p.date);
      const day0 = procDate.getTime();
      const day30 = day0 + 30 * 86400000;
      const beforeWindow = [...photoLogs]
        .map(l => ({ l, diff: Math.abs(new Date(l.date).getTime() - day0) }))
        .filter(x => x.diff <= 3 * 86400000)
        .sort((a, b) => a.diff - b.diff);
      const before = beforeWindow[0]?.l || null;
      const afterWindow = [...photoLogs]
        .map(l => ({ l, diff: Math.abs(new Date(l.date).getTime() - day30) }))
        .filter(x => x.diff <= 7 * 86400000 && new Date(x.l.date).getTime() > day0)
        .sort((a, b) => a.diff - b.diff);
      const after = afterWindow[0]?.l
        || [...photoLogs].filter(l => new Date(l.date).getTime() > day0).sort((a, b) => new Date(b.date) - new Date(a.date))[0]
        || null;
      const daysSince = Math.floor((Date.now() - procDate.getTime()) / 86400000);
      return { procedure: p, before, after, daysSince };
    })
    .sort((a, b) => new Date(b.procedure.date) - new Date(a.procedure.date));

  // === HELPER: inline upload for a procedure slot ===
  // Creates a journal log entry dated to either the procedure day (before) or
  // procedure-day + 30 (after). This way the photo also appears in the timeline.
  const handleProcedureSlotUpload = async (file, procedure, slot) => {
    try {
      const b64 = await fileToBase64(file);
      const procDate = new Date(procedure.date);
      const targetDate = slot === 'before'
        ? procedure.date
        : (() => {
            const d = new Date(procDate.getTime() + 30 * 86400000);
            const t = new Date(); t.setHours(0,0,0,0);
            return localDateISO(d > t ? t : d);
          })();
      const newLog = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        date: targetDate,
        area: 'full-face',
        rating: 5, notes: slot === 'before' ? `Before: ${procedure.name}` : `Day-30 follow-up: ${procedure.name}`,
        concerns: [],
        photo: b64, photoPath: null,
        ratingExplanation: null, suggestedRating: null,
        usedProducts: [], usedTags: [slot === 'before' ? 'procedure-before' : 'procedure-after'],
        aiAnalysis: null, analyzing: false};
      const updated = [...logs, newLog].sort((a, b) => new Date(b.date) - new Date(a.date));
      setLogs(updated);
      saveData('logs', updated);
      toast(`${slot === 'before' ? 'Before' : 'Day-30'} photo saved`, 'info');
      // Cloud upload in background — same pattern as SkinLogModal
      if (user?.cloud && user?.id && supabaseClient) {
        (async () => {
          try {
            const { path } = await uploadPhotoToStorage(user.id, b64);
            if (path) {
              setLogs(prev => prev.map(l => {
                if (l.id !== newLog.id) return l;
                const { photo, ...rest } = l;
                return { ...rest, photoPath: path };
              }));
            }
          } catch (e) { console.error('[procedure-slot] cloud upload failed:', e); }
        })();
      }
    } catch (e) {
      console.error('[procedure-slot] upload failed:', e);
      // May 2026: surface the actual error so silent ReferenceErrors
      // (e.g. unbridged App-scope helper) don't hide behind a generic toast.
      toast(`Upload failed: ${e?.message || 'unknown'}`, 'error');
    }
  };

  // Eligible products for the Product sub-tab — same gating as the shelf surface.
  const productRows = (products || [])
    .filter(p => !p.endDate)
    .map(p => ({ product: p, anchors: findProductCompareAnchors(p, products, regimenLogs, logs) }))
    .filter(r => r.anchors.startDate)
    .sort((a, b) => (b.anchors.daysActive || 0) - (a.anchors.daysActive || 0));

  // === SPARSE-PHOTO GUARD ===
  // Comparing requires at least 2 photos. If the user is below that threshold,
  // surface an encouraging prompt explaining the math instead of letting them
  // hit half-empty Time/Product/Procedure sub-tabs that look broken.
  const needsMorePhotos = photoLogs.length < 2;

  return (
    <div className="space-y-3 md:space-y-7 md:max-w-md md:mx-auto pb-6">
      {/* === EDITORIAL HEADER ===
          Reuses the shared EditorialPageHeader so Compare reads identically
          to Journal/Pearls/Counsel. Eyebrow + serif display + body. */}
      <EditorialPageHeader
        eyebrow="Compare"
        title="Two moments, side by side."
        body="See what's actually changing."
      />

      {/* Sparse-photo guard — wrapped in EditorialCard with a subtle terracotta
          hairline so it reads as a soft prompt, not an alarm. */}
      {needsMorePhotos && (
        <EditorialCard className="text-center" style={{borderColor: 'var(--line)'}}>
          <div className="flex justify-center mb-3" style={{color:'var(--accent)'}}><Icon name="Camera" size={28} /></div>
          <h3 className="font-sans text-[20px] md:text-[24px] leading-[1.1] mb-2" style={{color:'var(--ink)'}}>
            {photoLogs.length === 0 ? 'Log your first photo' : 'One more photo to begin'}
          </h3>
          <p className="text-[12px] leading-relaxed max-w-sm mx-auto mb-4" style={{color:'var(--ink-soft)'}}>
            {photoLogs.length === 0
              ? 'Compare needs at least two photos to work — one to anchor and one to read against.'
              : "You're one photo away. Log another and we'll line them up automatically."}
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <EditorialPill onClick={() => setShowCheckInChooser(true)} icon="Camera">Log a photo</EditorialPill>
            <EditorialPill onClick={() => setShowPhotoImportQueue(true)} icon="Upload" tone="ghost">Bulk upload</EditorialPill>
          </div>
        </EditorialCard>
      )}

      {/* Sub-tab toggle — uses the shared EditorialSubTabs primitive (pill track
          with cream-on-cream-deep). Replaces the heavier ink-fill version so
          Compare's nav matches Journal's Compact/Extended toggle. */}
      {/* Compare → Ask sub-tab retired May 2026 — Counsel's Ask covers the
          conversational surface. Sub-tabs are Quick / Product / Procedure. */}
      <EditorialSubTabs
        tabs={[
          { id: 'time', label: 'Quick' },
          { id: 'product', label: 'Product' },
          { id: 'procedure', label: 'Procedure' },
        ]}
        value={compareSubTab === 'ask' ? 'time' : compareSubTab}
        onChange={setCompareSubTab}
      />

      {/* === QUICK SUB-TAB === */}
      {compareSubTab === 'time' && (() => {
        // AI score helper — averages metricSnapshot via COMPARE_SCORE_MAP for /10 display.
        // Falls back to '—' when snapshot missing so user sees AI rating, not self-rating.
        const aiScoreOut10 = (log) => {
          const snap = log?.metricSnapshot;
          if (!snap) return null;
          const vals = ['redness','hydration','texture','breakouts','barrier','sensitivity']
            .map(k => COMPARE_SCORE_MAP[k]?.[compareTitleCase(snap[k])])
            .filter(v => typeof v === 'number');
          return vals.length ? (Math.round(vals.reduce((s,v) => s+v, 0) / vals.length) / 10).toFixed(1) : null;
        };
        return (
        <div className="space-y-4">
          {!afterLog ? (
            /* === ATELIER-STYLE EMPTY (May 29 2026 per Jenni) ===
               Was the plain EmptyState (border + ink-fill button) —
               replaced with the cream-deep editorial card pattern
               used on the Atelier hero. Same dashed CHECK IN circle,
               same conversational tone, same "Start your first
               check-in" CTA wording. First-week users land on this
               surface; we want it inviting, not "no data." */
            <div
              className="rounded-[20px] px-5 py-7 md:px-6 md:py-8 text-center"
              style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}
            >
              <div
                className="inline-flex flex-col items-center justify-center rounded-full mb-4"
                style={{
                  width: 120, height: 120,
                  border: '2px dashed var(--line)',
                  background: 'var(--cream)',
                  color: 'var(--ink-soft)'}}
              >
                <Icon name="Camera" size={28} />
                <div className="text-[10.5px] mt-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase'}}>
                  Check in
                </div>
              </div>
              <h2 className="font-sans text-[20px] md:text-[22px] leading-[1.15] mb-2" style={{color:'var(--ink)', letterSpacing:'-0.022em'}}>
                Need two photos to compare.
              </h2>
              <p className="text-[13px] leading-snug font-light mb-5 mx-auto" style={{color:'var(--ink-soft)', maxWidth: 280}}>
                Check in today, then again next week. We'll show you what moved.
              </p>
              <button
                type="button"
                onClick={() => setShowCheckInChooser(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full transition hover:opacity-90"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--cream)',
                  border: '1px solid var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 6px rgba(229,60,45,0.18)',
                  cursor: 'pointer'}}
              >
                <Icon name="Camera" size={12} strokeWidth={2.5} />
                Start your first check-in
                <Icon name="ArrowRight" size={11} />
              </button>
            </div>
          ) : (
            <>
              {/* Side-by-side photo grid — Before on left, After (today) on right.
                  Rounded-[20px] cream-deep wrappers per the new editorial language. */}
              <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                {/* BEFORE — empty until user picks */}
                <div className="rounded-[18px] overflow-hidden" style={{border: '1.5px solid var(--accent)', boxShadow: '0 1px 2px rgba(229,60,45,0.06), 0 8px 22px rgba(229,60,45,0.06)', background:'var(--cream-deep)'}}>
                  <div className="text-[10px] tracking-[0.28em] uppercase px-3 pt-3 pb-1.5" style={{color:'var(--ink-soft)'}}>Before</div>
                  {beforeLog ? (
                    <>
                      <button
                        type="button"
                        onClick={openCompareLightbox}
                        aria-label="Zoom in on photos"
                        className="block w-full p-0 m-0 border-0 transition hover:opacity-95"
                        style={{background:'transparent', cursor:'zoom-in'}}
                      >
                        <div className="aspect-[4/3] overflow-hidden" style={{background:'var(--cream-deep)'}}>
                          <Photo item={beforeLog} alt="" className="w-full h-full object-cover"
                            renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-sans text-4xl" style={{color:'var(--ink-soft)'}}>{beforeLog.rating}</span></div>}
                          />
                        </div>
                      </button>
                      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-sans text-base truncate" style={{color:'var(--ink)'}}>{fmt(beforeLog.date)}</div>
                          <div className="text-xs font-light truncate" style={{color:'var(--ink-soft)'}}>
                            {(beforeLog.area || 'full-face').replace(/-/g, ' ')}
                            {aiScoreOut10(beforeLog) ? <> · <span style={{color:'var(--accent)'}}>✦</span> {aiScoreOut10(beforeLog)}/10</> : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => setCompareTimeBeforeId(null)}
                          className="shrink-0 px-3 py-1 rounded-full text-[10px] tracking-[0.18em] uppercase font-medium transition hover:opacity-90"
                          style={{border:'1px solid var(--accent)', color:'var(--accent)', background:'var(--cream)'}}
                        >Change</button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setCompareTimePickerFor('before')}
                      className="w-full aspect-square border-2 border-dashed flex flex-col items-center justify-center gap-2 px-2 transition hover:bg-[var(--cream-deep)]"
                      style={{borderColor: 'var(--line)'}}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'var(--accent)', color:'var(--cream)'}}>
                        <Icon name="Plus" size={20} />
                      </div>
                      <span className="font-sans text-[14px] md:text-base text-center leading-tight" style={{color:'var(--ink)'}}>Pick a prior photo</span>
                      <span className="text-[9px] tracking-[0.14em] uppercase text-center leading-tight" style={{color:'var(--ink-soft)'}}>or quick-pick below</span>
                    </button>
                  )}
                </div>
                {/* AFTER — defaults to today's full-face but user can swap */}
                <div className="rounded-[18px] overflow-hidden" style={{border: '1.5px solid var(--accent)', boxShadow: '0 1px 2px rgba(229,60,45,0.06), 0 8px 22px rgba(229,60,45,0.06)', background:'var(--cream-deep)'}}>
                  <div className="text-[10px] tracking-[0.28em] uppercase px-3 pt-3 pb-1.5 flex items-center gap-1.5" style={{color:'var(--accent)'}}>
                    <span className="w-1 h-1 rounded-full inline-block" style={{background:'var(--accent)'}} />
                    {compareTimeAfterId && afterLog?.id !== afterDefaultLog?.id ? 'After' : 'After · today'}
                  </div>
                  <button
                    type="button"
                    onClick={openCompareLightbox}
                    aria-label="Zoom in on photos"
                    className="block w-full p-0 m-0 border-0 transition hover:opacity-95"
                    style={{background:'transparent', cursor:'zoom-in'}}
                  >
                    <div className="aspect-[4/3] overflow-hidden" style={{background:'var(--cream-deep)'}}>
                      <Photo item={afterLog} alt="" className="w-full h-full object-cover"
                        renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-sans text-4xl" style={{color:'var(--ink-soft)'}}>{afterLog.rating}</span></div>}
                      />
                    </div>
                  </button>
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-sans text-base truncate" style={{color:'var(--ink)'}}>{fmt(afterLog.date)}</div>
                      <div className="text-xs font-light truncate" style={{color:'var(--ink-soft)'}}>
                        {(afterLog.area || 'full-face').replace(/-/g, ' ')}
                        {aiScoreOut10(afterLog) ? <> · <span style={{color:'var(--accent)'}}>✦</span> {aiScoreOut10(afterLog)}/10</> : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setCompareTimePickerFor('after')}
                      className="shrink-0 px-3 py-1 rounded-full text-[10px] tracking-[0.18em] uppercase font-medium transition hover:opacity-90"
                      style={{border:'1px solid var(--accent)', color:'var(--accent)', background:'var(--cream)'}}
                    >Change</button>
                  </div>
                </div>
              </div>

              {/* === COMPARE INFOGRAPHIC + AI ANALYSIS ===
                  Lifted to sit DIRECTLY UNDER the two photos — the analysis is
                  the headline insight, not an afterthought. Quick picks +
                  calendar follow below for picking other Before dates.
                  Auto-runs analysis the moment both photos are picked. */}
              {beforeLog && afterLog && (
                <div className="space-y-3">
                  <CompareMetricInfographic
                    before={beforeLog}
                    after={afterLog}
                    ratingDelta={Number(afterLog.rating) - Number(beforeLog.rating)}
                    daysApart={Math.abs(Math.floor((new Date(afterLog.date) - new Date(beforeLog.date)) / 86400000))}
                  />
                  {/* === ROUTINE DELTA CARD ===
                      Bridges "here's the photo delta" → "here's the
                      routine context" before the AI analysis runs.
                      Compare used to be photo-only — this ties visible
                      change to what the user actually changed. Quiet
                      editorial card, eyebrow + up to three short rows.
                      Hidden entirely if nothing changed AND no
                      procedures sat in the window (keeps the section
                      from feeling padded). */}
                  {(() => {
                    const delta = buildRoutineDelta(beforeLog.date, afterLog.date);
                    if (!delta || delta.isEmpty) return null;
                    const nameList = (arr, max = 3) => {
                      if (arr.length === 0) return null;
                      const shown = arr.slice(0, max).map(p => p.name).filter(Boolean);
                      const extra = arr.length - shown.length;
                      return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ');
                    };
                    const addedText = nameList(delta.added);
                    const droppedText = nameList(delta.dropped);
                    const procText = delta.procedures.length === 0
                      ? null
                      : delta.procedures.length === 1
                        ? `${delta.procedures[0].name} · ${new Date(delta.procedures[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        : `${delta.procedures.length} treatments`;
                    return (
                      <EditorialCard>
                        <div className="text-[10px] tracking-[0.3em] uppercase mb-3 flex items-center gap-2" style={{color:'var(--ink-soft)', fontWeight:600}}>
                          <Icon name="GitBranch" size={11} style={{color:'var(--accent)'}} /> Between these photos
                        </div>
                        <div className="space-y-2">
                          {addedText && (
                            <div className="flex items-baseline gap-2.5 text-[13px] leading-snug" style={{color:'var(--ink)'}}>
                              <span className="text-[9px] tracking-[0.22em] uppercase shrink-0 pt-[3px]" style={{color:'var(--sage, #6b8364)', fontWeight:600, minWidth:'52px'}}>Added</span>
                              <span style={{fontWeight:400}}>{addedText}</span>
                            </div>
                          )}
                          {droppedText && (
                            <div className="flex items-baseline gap-2.5 text-[13px] leading-snug" style={{color:'var(--ink)'}}>
                              <span className="text-[9px] tracking-[0.22em] uppercase shrink-0 pt-[3px]" style={{color:'var(--ink-soft)', fontWeight:600, minWidth:'52px'}}>Dropped</span>
                              <span style={{fontWeight:400}}>
                                {droppedText}
                                {delta.droppedSilentIds.size > 0 && delta.dropped.some(p => delta.droppedSilentIds.has(p.id)) && (
                                  <span className="text-[10px] ml-1.5" style={{color:'var(--ink-soft)'}}>· quietly</span>
                                )}
                              </span>
                            </div>
                          )}
                          {procText && (
                            <div className="flex items-baseline gap-2.5 text-[13px] leading-snug" style={{color:'var(--ink)'}}>
                              <span className="text-[9px] tracking-[0.22em] uppercase shrink-0 pt-[3px]" style={{color:'var(--accent)', fontWeight:600, minWidth:'52px'}}>In-clinic</span>
                              <span style={{fontWeight:400}}>{procText}</span>
                            </div>
                          )}
                        </div>
                      </EditorialCard>
                    );
                  })()}
                  {/* === SHARE BUTTON ===
                      Renders a 1080×1350 PNG of the Compare card and either
                      opens the native share sheet (mobile / Web Share API
                      with files) or downloads the file (desktop fallback).
                      Distribution unlock — user posts the artifact to their
                      own socials, no Frida-side hosting needed. */}
                  <button
                    onClick={async () => {
                      try {
                        toast('Generating your Compare card…', 'info');
                        // Resolve photo data URLs (handles both inline data
                        // URLs and Supabase Storage paths).
                        const resolveB = async (l) => {
                          if (l?.photo && String(l.photo).startsWith('data:')) return l.photo;
                          if (l?.photoPath) {
                            const b64 = await fetchPhotoAsBase64(l.photoPath);
                            return b64 ? `data:image/jpeg;base64,${b64.replace(/^data:image\/\w+;base64,/, '')}` : null;
                          }
                          return null;
                        };
                        const [bUrl, aUrl] = await Promise.all([resolveB(beforeLog), resolveB(afterLog)]);
                        const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        // Build metric deltas using the COMPARE_SCORE_MAP.
                        const beforeSnap = beforeLog?.metricSnapshot || null;
                        const afterSnap = afterLog?.metricSnapshot || null;
                        const metricDeltas = ['hydration','redness','texture'].map(key => {
                          const before = beforeSnap?.[key] ? compareTitleCase(beforeSnap[key]) : null;
                          const after = afterSnap?.[key] ? compareTitleCase(afterSnap[key]) : null;
                          const bv = before ? COMPARE_SCORE_MAP[key]?.[before] : null;
                          const av = after ? COMPARE_SCORE_MAP[key]?.[after] : null;
                          if (bv == null || av == null) return { label: key, dir: '—', color: '#9c9080' };
                          const kind = COMPARE_METRIC_KIND[key];
                          const improving = kind === 'pos' ? av > bv : av < bv;
                          const arrow = av === bv ? '→' : improving ? '↑' : '↓';
                          const color = av === bv ? '#9c9080' : improving ? '#7d8b6b' : '#a8635c';
                          return { label: key, dir: arrow, color };
                        });
                        const canvas = await generateCompareShareCanvas({
                          beforeUrl: bUrl, afterUrl: aUrl,
                          beforeScore: aiScoreOut10(beforeLog),
                          afterScore: aiScoreOut10(afterLog),
                          daysApart: Math.abs(Math.floor((new Date(afterLog.date) - new Date(beforeLog.date)) / 86400000)),
                          beforeDate: fmtDate(beforeLog.date),
                          afterDate: fmtDate(afterLog.date),
                          metricDeltas});
                        canvas.toBlob(async (blob) => {
                          if (!blob) { toast('Could not generate image', 'error'); return; }
                          const filename = `etude-compare-${beforeLog.date}-to-${afterLog.date}.png`;
                          // Web Share API with file (mobile Safari, Chrome
                          // Android). Falls back to download if not
                          // supported or if the user cancels.
                          if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'image/png' })] })) {
                            try {
                              await navigator.share({
                                files: [new File([blob], filename, { type: 'image/png' })],
                                title: 'Frida · Compare',
                                text: 'My skin, side by side. via Frida'});
                              return;
                            } catch (shareErr) {
                              // User cancelled or share failed — fall through to download.
                              if (shareErr.name === 'AbortError') return;
                            }
                          }
                          // Desktop fallback — download.
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                          toast('Saved to downloads', 'info');
                        }, 'image/png');
                      } catch (err) {
                        console.error('[CompareShare]', err);
                        toast('Could not generate image', 'error');
                      }
                    }}
                    className="w-full rounded-full px-4 py-2.5 text-[10.5px] tracking-[0.18em] uppercase flex items-center justify-center gap-1.5 transition hover:opacity-90 cursor-pointer border"
                    style={{borderColor: 'var(--line)', color:'var(--accent)', background:'transparent', cursor:'pointer'}}
                    title="Generate a shareable PNG of this Compare"
                  >
                    <Icon name="Share2" size={11} /> Share this compare
                  </button>
                  <EditorialCard>
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-3 flex items-center gap-2" style={{color:'var(--accent)'}}>
                      <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} /> Frida analysis
                    </div>
                    {cachedAnalysis ? (
                      <>
                        <TaggedAnalysisBullets
                          text={formatAnalysisText(cachedAnalysis)}
                          onOpen={setOpenLesson}
                          IconComponent={Icon}
                          withPearlsFn={withPearls}
                        />
                        <button onClick={runTimeAnalysis} disabled={compareTimeAnalyzing} className="mt-3 text-[10px] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                          {compareTimeAnalyzing ? <><Icon name="Loader2" size={11} className="spin" /> Re-running</> : <>Refresh analysis</>}
                        </button>
                      </>
                    ) : compareTimeAnalyzing ? (
                      <p className="font-sans text-sm flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                        <Icon name="Loader2" size={13} className="spin" style={{color:'var(--accent)'}} /> Reading the difference between these two photos…
                      </p>
                    ) : !canRunAnalysis() ? (
                      <button onClick={() => setShowApiKeyModal(true)} className="text-[11px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                        <Icon name="Key" size={11} /> Add API key to auto-analyze
                      </button>
                    ) : (
                      <button onClick={runTimeAnalysis} disabled={compareTimeAnalyzing} className="text-[11px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                        <Icon name="Sparkles" size={11} /> Analyze the difference
                      </button>
                    )}
                  </EditorialCard>
                </div>
              )}

              {/* Quick-pick presets — pick a different Before date fast.
                  Tap a pill to set the Before photo; "Browse all" opens the picker modal. */}
              {presets.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Quick picks</div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                    {presets.map(p => {
                      const active = beforeLog?.id === p.log.id;
                      return (
                        <button
                          key={p.label}
                          onClick={() => setCompareTimeBeforeId(p.log.id)}
                          className="flex-shrink-0 px-3.5 py-2 rounded-full tracking-[0.18em] text-[10px] uppercase border transition whitespace-nowrap"
                          style={{
                            borderColor: active ? 'var(--accent)' : 'var(--line)',
                            background: active ? 'var(--accent)' : 'var(--cream)',
                            color: active ? 'var(--cream)' : 'var(--ink-soft)'}}
                        >{p.label}</button>
                      );
                    })}
                    <button
                      onClick={() => setCompareTimePickerFor('before')}
                      className="flex-shrink-0 px-3.5 py-2 rounded-full tracking-[0.18em] text-[10px] uppercase border transition whitespace-nowrap"
                      style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}
                    >Browse all <Icon name="ArrowRight" size={11} className="inline ml-1" /></button>
                  </div>
                </div>
              )}

              {/* === MONTH CALENDAR === photo calendar for picking other Before dates. */}
              <div className="mb-5">
                <div className="text-[10px] tracking-[0.25em] uppercase mb-2 flex items-baseline justify-between" style={{color:'var(--ink-soft)'}}>
                  <span>Calendar</span>
                  <span className="text-[9px] normal-case tracking-normal">tap to set as before</span>
                </div>
                <MiniMonthCalendar
                  logs={photoLogs}
                  procedures={procedures}
                  showThumbs={true}
                  onDayClick={(log) => setCompareTimeBeforeId(log.id)}
                />
              </div>
            </>
          )}
        </div>
        );
      })()}

      {/* === PRODUCT SUB-TAB (May 2026 editorial rebuild + audit pass) ===
          One job: a list of products with a clickable row each. Header is
          "By product" + Sort:Recent. Rows are ingredient-icon card +
          product meta + before/after thumbs + readiness chip. The trend
          summary card above the list was cut (audit) — it duplicated
          Home Snapshot, Sunday Digest, and Insights trajectory. Each
          row opens the productCompare modal for the deeper read. */}
      {compareSubTab === 'product' && (() => {
        if (productRows.length === 0) {
          return (
            <div
              className="rounded-[20px] px-5 py-7 md:px-6 md:py-8 text-center"
              style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}
            >
              <div
                className="inline-flex flex-col items-center justify-center rounded-full mb-4"
                style={{
                  width: 120, height: 120,
                  border: '2px dashed var(--line)',
                  background: 'var(--cream)',
                  color: 'var(--ink-soft)'}}
              >
                <Icon name="Package" size={28} />
                <div className="text-[10.5px] mt-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase'}}>
                  Check in
                </div>
              </div>
              <h2 className="font-sans text-[20px] md:text-[22px] leading-[1.15] mb-2" style={{color:'var(--ink)', letterSpacing:'-0.022em'}}>
                Nothing logged, nothing learned.
              </h2>
              <p className="text-[13px] leading-snug font-light mb-5 mx-auto" style={{color:'var(--ink-soft)', maxWidth: 280}}>
                A few weeks of check-ins and we'll show you which products are actually moving the needle.
              </p>
              <button
                type="button"
                onClick={() => setShowCheckInChooser(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full transition hover:opacity-90"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--cream)',
                  border: '1px solid var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 6px rgba(229,60,45,0.18)',
                  cursor: 'pointer'}}
              >
                <Icon name="Camera" size={12} strokeWidth={2.5} />
                Start your first check-in
                <Icon name="ArrowRight" size={11} />
              </button>
            </div>
          );
        }
        // === Readiness classification per row ===
        // Used for the status badge + AI insight tone. Three states
        // matching Jenni's spec: "Ready to compare" / "Building
        // evidence" / "Too early".
        const classifyReadiness = (anchors, product) => {
          if (anchors.hasEnoughData && (anchors.daysActive || 0) >= 21 && (anchors.photoCount || 0) >= 5) {
            return 'ready';
          }
          if ((anchors.daysActive || 0) < 14 || (anchors.photoCount || 0) < 3) {
            return 'tooEarly';
          }
          return 'building';
        };
        // === Per-row copy, keyed off category + readiness ===
        // Voice: obsessed friend who happens to be a doctor. Direct,
        // dry, brief, no derm-coded prose ("collecting baseline,"
        // "tone shift detected" — that was the old copy). Deeper
        // analysis lives inside the productCompare modal.
        const insightCopy = (anchors, product, readiness) => {
          const cat = (product.category || '').toLowerCase();
          if (readiness === 'tooEarly') {
            if (cat.includes('retinoid') || cat.includes('treatment')) {
              return { headline: 'Give it a minute', text: 'Retinoids show their hand at 3–8 weeks.' };
            }
            if (cat.includes('exfoliant') || cat.includes('acid')) {
              return { headline: 'Give it a minute', text: 'Acids need a few turnover cycles before the verdict.' };
            }
            return { headline: 'Too soon to call', text: 'Not enough check-ins yet.' };
          }
          if (readiness === 'building') {
            if (cat.includes('moisturizer') || cat.includes('cream')) {
              return { headline: 'Barrier looks happier', text: 'Less flake, more comfort.' };
            }
            if (cat.includes('exfoliant') || cat.includes('acid') || cat.includes('bha') || cat.includes('aha')) {
              return { headline: 'Texture is moving', text: 'Pores look clearer. Keep at it.' };
            }
            if (cat.includes('serum') || cat.includes('ampoule') || cat.includes('peptide')) {
              return { headline: 'Plumper already', text: "Skin's filling out. Give it more time for the full read." };
            }
            if (cat.includes('toner') || cat.includes('essence') || cat.includes('mist')) {
              return { headline: 'Quieter surface', text: "Hydration's steady. Don't change anything." };
            }
            return { headline: "Something's moving", text: "Trend's forming. Keep checking in." };
          }
          // ready
          if (cat.includes('cleanser')) {
            return { headline: 'Yeah, this is working', text: 'Less red, more even.' };
          }
          if (cat.includes('moisturizer') || cat.includes('cream')) {
            return { headline: 'Barrier is compounding', text: "Hydration holds, comfort's steady." };
          }
          if (cat.includes('retinoid') || cat.includes('treatment')) {
            return { headline: 'Texture is refining', text: 'Fine lines softer, tone more even across the window.' };
          }
          if (cat.includes('serum') || cat.includes('ampoule')) {
            return { headline: 'Tone shifted', text: "Pigment's lifting, brightness up." };
          }
          return { headline: 'Something real', text: 'Tap for the side-by-side.' };
        };
        // === FRIDA INSIGHT CARD REMOVED (May 2026 audit) ===
        // The hydration / barrier / redness trend trio duplicated:
        //   - Home Skin Snapshot "SINCE LAST" chips
        //   - Journal Sunday Digest weekly recap
        //   - Insights "Skin trajectory" card
        // Card + buildSummaryMetrics helper + summary/headline/subline/
        // metricColor/metricIcon vars all pruned. Compare's job is
        // product- and photo-pair-level reads, not yet-another trend
        // summary.

        // === EXPANDABLE PRODUCT ROW (May 29 2026 per Jenni) ===
        // Was: a single button → opens the ProductCompareModal directly.
        // Now: tap toggles inline expansion → preview insight headline +
        // insight body + "Full side-by-side →" button (opens the modal).
        // Two-step gives the user the gist before committing to the
        // deeper modal, and the chip is now visibly part of a tappable
        // expand surface (rotates chevron) instead of static metadata.
        const ProductCompareRow = ({ row, idx }) => {
          // === HYBRID: row expands inline, photo opens modal (May 30 v3 per Jenni) ===
          // Row click → toggle inline commentary (quick read).
          // Photo tap → opens the full popup modal (expanded view).
          // Best of both: peek without leaving the list, OR dive in.
          const [expanded, setExpanded] = React.useState(false);
          const { product, anchors } = row;
          const readiness = classifyReadiness(anchors, product);
          const insight = insightCopy(anchors, product, readiness);
          const category = (product.category || 'product').replace(/-/g, ' ');
          const iconName = getCategoryIcon(product.category);
          const beforeLog = anchors.anchorPhotoLog;
          const afterLog = anchors.latestPhotoLog;
          const statusStyle = readiness === 'ready'
            ? { bg: 'rgba(199, 231, 245, 0.42)', color: 'var(--accent-blue, #86CAE7)' }
            : readiness === 'building'
              ? { bg: 'rgba(201, 95, 58, 0.10)', color: 'var(--accent)' }
              : { bg: 'rgba(78, 58, 44, 0.06)', color: 'var(--ink-soft)' };
          const STATUS_LABEL = readiness === 'ready'
            ? 'Ready' : readiness === 'building' ? 'Coming together' : 'Too soon';
          const fullCtaLabel = readiness === 'ready'
            ? 'Full side-by-side'
            : readiness === 'building'
              ? 'Preview side-by-side'
              : 'Preview anyway';
          return (
            <div style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--line)' }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(v => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}
                className="w-full text-left transition hover:bg-[var(--cream)] flex items-center gap-3"
                style={{ padding: '14px 16px', cursor: 'pointer' }}
                aria-expanded={expanded}
                title={expanded ? `Collapse ${product.name}` : `Quick read for ${product.name}`}
              >
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 10,
                    border: '1px solid var(--line)',
                    background: '#FFFDFC',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', flexShrink: 0}}
                >
                  <Icon name={iconName} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[13.5px] leading-tight truncate" style={{color:'var(--ink)'}}>
                    {product.brand || product.name}
                  </div>
                  {product.brand && product.name && product.brand !== product.name && (
                    <div className="text-[11.5px] leading-tight mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>
                      {product.name}
                    </div>
                  )}
                  <div className="text-[9.5px] tracking-[0.16em] uppercase mt-1 flex items-center gap-1.5 flex-wrap" style={{color:'var(--ink-soft)'}}>
                    <span>{category}</span>
                    <span>·</span>
                    <span>{anchors.photoCount}{anchors.photoCount === 1 ? ' photo' : ' photos'}</span>
                    <span>·</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full"
                      style={{
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        fontWeight: 600,
                        letterSpacing: '0.12em'}}
                    >{STATUS_LABEL}</span>
                  </div>
                </div>
                {beforeLog && afterLog ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setProductCompareId(product.id); }}
                    className="flex items-center gap-1 flex-shrink-0 rounded-lg transition hover:opacity-80"
                    style={{cursor:'pointer'}}
                    title="Open full side-by-side"
                    aria-label={`Open full side-by-side for ${product.name}`}
                  >
                    <div style={{width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: 'var(--cream)', border: '1px solid var(--line)'}}>
                      <Photo item={beforeLog} alt="" className="w-full h-full object-cover"
                        renderFallback={() => <div className="w-full h-full flex items-center justify-center" style={{color:'var(--ink-soft)'}}><Icon name="Camera" size={12} /></div>}
                      />
                    </div>
                    <Icon name="ArrowRight" size={11} style={{color:'var(--ink-soft)', flexShrink:0}} />
                    <div style={{width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: 'var(--cream)', border: '1px solid var(--line)'}}>
                      <Photo item={afterLog} alt="" className="w-full h-full object-cover"
                        renderFallback={() => <div className="w-full h-full flex items-center justify-center" style={{color:'var(--ink-soft)'}}><Icon name="Camera" size={12} /></div>}
                      />
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-50">
                    {[0, 1].map(i => (
                      <div key={i} style={{width: 36, height: 36, borderRadius: 8, background:'var(--cream)', border:'1px dashed var(--line)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-soft)'}}>
                        <Icon name="Camera" size={11} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex-shrink-0" style={{color:'var(--ink-soft)'}}>
                  <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} />
                </div>
              </div>
              {expanded && (
                <div className="px-4 pb-4 pt-1" style={{borderTop:'1px dashed var(--line)'}}>
                  <div className="pt-3">
                    <div className="font-sans text-[14px] leading-snug" style={{color:'var(--ink)'}}>
                      {insight.headline}
                    </div>
                    <div className="text-[11.5px] mt-1 leading-snug" style={{color:'var(--ink-soft)'}}>
                      {insight.text}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setProductCompareId(product.id); }}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:opacity-85"
                      style={{
                        background: readiness === 'ready' ? 'var(--accent)' : 'transparent',
                        color: readiness === 'ready' ? 'var(--cream)' : 'var(--accent)',
                        border: '1px solid var(--accent)',
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer'}}
                    >
                      <Icon name="Sparkles" size={11} />
                      {fullCtaLabel}
                      <Icon name="ArrowRight" size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-5">
            {/* === BY PRODUCT === header */}
            <div className="flex items-baseline justify-between gap-3 px-1">
              <div className="text-[10px] tracking-[0.28em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>By product</div>
              <div className="text-[10px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>Sort: Recent</div>
            </div>

            {/* === PRODUCT ROWS === */}
            <div className="rounded-[20px] overflow-hidden" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              {productRows.map((row, idx) => (
                <ProductCompareRow key={row.product.id} row={row} idx={idx} />
              ))}
            </div>

            {/* Footer — calibration note + how-comparisons-work link */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-1 pt-1">
              <div className="flex items-center gap-1.5 text-[10.5px]" style={{color:'var(--ink-soft)'}}>
                <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} />
                <span className="">Consistent check-ins make comparisons more accurate.</span>
              </div>
              <button
                onClick={() => toast('How comparisons work — full doc coming soon', 'info')}
                className="text-[10.5px] tracking-[0.16em] uppercase transition hover:opacity-70 inline-flex items-center gap-1"
                style={{color:'var(--accent)', cursor:'pointer'}}
              >
                Learn how comparisons work <Icon name="ArrowRight" size={11} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* === PROCEDURE SUB-TAB === */}
      {compareSubTab === 'procedure' && (
        <div>
          {procRows.length === 0 ? (
            /* Empty state — editorial card. */
            <EditorialCard className="text-center">
              <div className="flex justify-center mb-3" style={{color:'var(--accent)'}}><Icon name="Activity" size={28} /></div>
              <h3 className="font-sans text-[20px] md:text-[24px] leading-[1.1] mb-2" style={{color:'var(--ink)'}}>No procedures logged yet.</h3>
              <p className="text-[12px] leading-relaxed max-w-sm mx-auto mb-5" style={{color:'var(--ink-soft)'}}>
                Log a treatment — laser, peel, microneedling, RF — and we'll pair it with the day-of photo and a 30-day follow-up automatically.
              </p>
              <div className="flex justify-center">
                <EditorialPill onClick={() => setShowProcedureModal(true)} icon="Plus">Log a procedure</EditorialPill>
              </div>
            </EditorialCard>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3 mb-5 flex-wrap">
                <p className="text-[12px] leading-relaxed max-w-2xl" style={{color:'var(--ink-soft)'}}>
                  Tap a procedure to see the day-of photo and the 30-day follow-up. Missing a photo? Upload it inline and it'll land in the timeline too.
                </p>
                <AccentLink onClick={() => setShowProcedureModal(true)} icon="Plus" iconAfter={null}>
                  Log new
                </AccentLink>
              </div>
              <div className="space-y-6">
                {procRows.map(({ procedure, before, after, daysSince }) => {
                  const ratingDelta = (after && before) ? (Number(after.rating) - Number(before.rating)) : null;
                  // === COST-PER-RESULT MATH ===
                  // When the user has logged both photos AND a cost, surface the
                  // value-per-AI-point calc as a primary signal. Return-cause #1:
                  // "are my procedures working / save money." Use AI score deltas
                  // (not user self-rating) for honest math. Parses cost flexibly —
                  // the cost field is a string ("$1200", "1,200", "1200 USD" all OK).
                  const parseCost = (s) => {
                    if (!s) return null;
                    const m = String(s).replace(/[$,]/g, '').match(/(\d+(?:\.\d+)?)/);
                    return m ? Number(m[1]) : null;
                  };
                  const procCost = parseCost(procedure.cost);
                  const beforeAi = before ? aiScoreOut10(before) : null;
                  const afterAi = after ? aiScoreOut10(after) : null;
                  const aiDelta = (beforeAi && afterAi) ? (Number(afterAi) - Number(beforeAi)) : null;
                  const costPerPoint = (procCost != null && aiDelta != null && Math.abs(aiDelta) >= 0.1)
                    ? Math.round(procCost / Math.abs(aiDelta))
                    : null;
                  const fmtCurrency = (n) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                  // Pre-build the upload-input refs for each slot so the inline
                  // upload button works without per-slot extra state.
                  const beforeInputId = `proc-${procedure.id}-before`;
                  const afterInputId = `proc-${procedure.id}-after`;
                  return (
                    <div key={procedure.id} className="rounded-[14px] overflow-hidden max-w-[560px] mx-auto" style={{border: '1px solid var(--line)', background:'var(--cream-deep)'}}>
                      <div className="px-4 py-2.5 border-b flex items-baseline justify-between gap-3 flex-wrap" style={{borderColor: 'var(--line)'}}>
                        <div>
                          <div className="text-[10px] tracking-[0.25em] uppercase" style={{color:'var(--ink-soft)'}}>{procedure.type || 'procedure'}</div>
                          <h3 className="font-sans text-lg md:text-xl leading-tight mt-0.5" style={{color:'var(--ink)'}}>{procedure.name}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{fmt(procedure.date)}</div>
                          <div className="text-xs mt-0.5" style={{color:'var(--ink-soft)'}}>{daysSince === 0 ? 'today' : daysSince === 1 ? '1 day ago' : `${daysSince} days ago`}</div>
                        </div>
                      </div>
                      {/* Cost-per-result strip — only when we have everything to do
                          the math. Sage when improving, rose when worsening,
                          ink-soft when flat. Reads at a glance. */}
                      {(procCost != null || aiDelta != null) && (
                        <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap text-[10.5px]" style={{borderBottom:'1px solid var(--line)', background:'var(--cream)'}}>
                          {procCost != null ? (
                            <span style={{color:'var(--ink)'}}>{fmtCurrency(procCost)}</span>
                          ) : (
                            <span className="" style={{color:'var(--ink-soft)'}}>Cost not logged</span>
                          )}
                          {aiDelta != null && (
                            <span style={{color: aiDelta > 0 ? 'var(--accent-blue)' : aiDelta < 0 ? 'var(--rose)' : 'var(--ink-soft)'}}>
                              <span style={{color:'var(--accent)'}}>✦</span> {aiDelta > 0 ? '+' : ''}{aiDelta.toFixed(1)} pts
                            </span>
                          )}
                          {costPerPoint != null && aiDelta > 0 && (
                            <span className="" style={{color:'var(--ink-soft)'}}>{fmtCurrency(costPerPoint)} / point</span>
                          )}
                          {costPerPoint != null && aiDelta < 0 && (
                            <span className="" style={{color:'var(--rose)'}}>moved the wrong way</span>
                          )}
                          {procCost != null && aiDelta == null && (
                            <span className="" style={{color:'var(--ink-soft)'}}>log both photos to see the math</span>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-0">
                        {/* === BEFORE — day-of-procedure === */}
                        <div className="border-r" style={{borderColor: 'var(--line)'}}>
                          <div className="text-[10px] tracking-[0.25em] uppercase px-3 pt-2.5 pb-1" style={{color:'var(--ink-soft)'}}>Day of</div>
                          {before ? (
                            <>
                              <div className="aspect-[4/3] overflow-hidden" style={{background:'var(--cream-deep)'}}>
                                <Photo item={before} alt="" className="w-full h-full object-cover"
                                  renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-sans text-4xl" style={{color:'var(--ink-soft)'}}>{aiScoreOut10(before) || before.rating}</span></div>}
                                />
                              </div>
                              <div className="px-3 py-2">
                                <div className="font-sans text-sm md:text-base" style={{color:'var(--ink)'}}>{fmt(before.date)}</div>
                                <div className="text-xs font-light" style={{color:'var(--ink-soft)'}}>
                                  {(before.area || 'full-face').replace(/-/g, ' ')}
                                  {aiScoreOut10(before) ? <> · <span style={{color:'var(--accent)'}}>✦</span> {aiScoreOut10(before)}/10</> : (before.rating != null ? ` · ${before.rating}/10` : '')}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <label htmlFor={beforeInputId} className="block aspect-[4/3] cursor-pointer transition hover:bg-[var(--cream-deep)]" style={{background:'var(--cream-deep)'}}>
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                                  <Icon name="Upload" size={18} />
                                  <span className="text-[9px] tracking-[0.18em] uppercase" style={{whiteSpace:'nowrap'}}>Day-of</span>
                                </div>
                              </label>
                              <input
                                id={beforeInputId}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handleProcedureSlotUpload(f, procedure, 'before');
                                  e.target.value = '';
                                }}
                              />
                              <div className="px-3 py-2">
                                <div className="font-sans text-xs" style={{color:'var(--ink-soft)'}}>{fmt(procedure.date)}</div>
                                <div className="text-[10px]" style={{color:'var(--ink-soft)'}}>no photo on this day</div>
                              </div>
                            </>
                          )}
                        </div>
                        {/* === AFTER — 30-day follow-up === */}
                        <div>
                          <div className="text-[10px] tracking-[0.25em] uppercase px-3 pt-2.5 pb-1" style={{color:'var(--accent)'}}>Day 30</div>
                          {after ? (
                            <>
                              <div className="aspect-[4/3] overflow-hidden" style={{background:'var(--cream-deep)'}}>
                                <Photo item={after} alt="" className="w-full h-full object-cover"
                                  renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-sans text-4xl" style={{color:'var(--ink-soft)'}}>{aiScoreOut10(after) || after.rating}</span></div>}
                                />
                              </div>
                              <div className="px-3 py-2">
                                <div className="font-sans text-sm md:text-base" style={{color:'var(--ink)'}}>{fmt(after.date)}</div>
                                <div className="text-xs font-light" style={{color:'var(--ink-soft)'}}>
                                  {(after.area || 'full-face').replace(/-/g, ' ')}
                                  {aiScoreOut10(after) ? <> · <span style={{color:'var(--accent)'}}>✦</span> {aiScoreOut10(after)}/10</> : (after.rating != null ? ` · ${after.rating}/10` : '')}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <label htmlFor={afterInputId} className="block aspect-[4/3] cursor-pointer transition hover:bg-[var(--cream-deep)]" style={{background:'var(--cream-deep)'}}>
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                                  <Icon name="Upload" size={18} />
                                  <span className="text-[9px] tracking-[0.18em] uppercase" style={{whiteSpace:'nowrap'}}>Day-30</span>
                                </div>
                              </label>
                              <input
                                id={afterInputId}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handleProcedureSlotUpload(f, procedure, 'after');
                                  e.target.value = '';
                                }}
                              />
                              <div className="px-3 py-2">
                                <div className="font-sans text-xs" style={{color:'var(--ink-soft)'}}>
                                  {(() => {
                                    const d = new Date(new Date(procedure.date).getTime() + 30 * 86400000);
                                    return fmt(localDateISO(d));
                                  })()}
                                </div>
                                <div className="text-[10px]" style={{color:'var(--ink-soft)'}}>30-day follow-up · upload</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {before && after && ratingDelta != null && (() => {
                        // Procedure-specific AI analysis cache key (stored in same
                        // compareTimeAnalysis bag so it auto-shares across tabs).
                        const procKey = `${before.id}-${after.id}`;
                        const procCached = compareTimeAnalysis[procKey];
                        return (
                          <div className="border-t" style={{borderColor: 'var(--line)'}}>
                            {/* Infographic — same metric quartet as Quick tab. */}
                            <div className="px-4 py-2.5">
                              <CompareMetricInfographic
                                before={before}
                                after={after}
                                ratingDelta={ratingDelta}
                                daysApart={Math.abs(Math.floor((new Date(after.date) - new Date(before.date)) / 86400000))}
                              />
                            </div>
                            {/* AI analysis — auto-runs on first render via useEffect. */}
                            <div className="px-4 pb-4">
                              <div className="text-[10px] tracking-[0.3em] uppercase mb-3 flex items-center gap-2" style={{color:'var(--accent)'}}>
                                <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} /> Frida analysis
                              </div>
                              {procCached ? (
                                <TaggedAnalysisBullets
                                  text={formatAnalysisText(procCached)}
                                  onOpen={setOpenLesson}
                                  IconComponent={Icon}
                                  withPearlsFn={withPearls}
                                />
                              ) : compareTimeAnalyzing ? (
                                <p className="font-sans text-sm flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                                  <Icon name="Loader2" size={13} className="spin" style={{color:'var(--accent)'}} /> Reading the difference…
                                </p>
                              ) : !canRunAnalysis() ? (
                                <button onClick={() => setShowApiKeyModal(true)} className="text-[11px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                                  <Icon name="Key" size={11} /> Add API key to auto-analyze
                                </button>
                              ) : (
                                <button onClick={() => runComparePairAnalysisShared(before, after)} className="text-[11px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                                  <Icon name="Sparkles" size={11} /> Analyze this procedure
                                </button>
                              )}
                            </div>
                            <div className="px-4 py-3 border-t flex items-center justify-between gap-2" style={{borderColor: 'var(--line)'}}>
                              <div className="text-xs font-light" style={{color:'var(--ink-soft)'}}>{procedure.type || 'procedure'} · {procedure.name}</div>
                              <button
                                onClick={() => enterCompare?.(before.id, after.id)}
                                className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1.5 transition hover:opacity-70"
                                style={{color:'var(--accent)'}}
                              >Open full <Icon name="ArrowRight" size={11} /></button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* === ASK SUB-TAB RETIRED (May 2026) ===
          Removed in favor of Counsel's Ask, which has the user's full context
          (journal + shelf + procedures + color) and a richer toolset. The
          compareAsk* state survives in App scope as dead state for one
          release in case any deep link routes here. */}

      {/* === Photo lightbox (June 2026 per Jenni) ===
          Renders when user taps either Before or After photo. Side-by-side
          pair view at full size — actually usable for spotting deltas. */}
      {lightboxPhotos && lightboxPhotos.length > 0 && (
        <PhotoLightbox photos={lightboxPhotos} onClose={() => setLightboxPhotos(null)} />
      )}
    </div>
  );
};
