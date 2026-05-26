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
  setShowPhotoImportQueue,
}) => {
  // === COMPARE TAB ===
  // Three sub-tabs (May 2026 — Ask retired, moved to Counsel):
  //   1. Quick    — auto today + user picks prior; quick-pick presets; AI inline
  //   2. Product  — list of eligible products; opens ProductCompareModal
  //   3. Procedure — list of procedures with before/after photo anchors
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
  const presets = afterDate ? [
    { label: '1 week ago', target: 7, window: 4 },
    { label: '1 month ago', target: 30, window: 10 },
    { label: '3 months ago', target: 90, window: 21 },
    { label: '6 months ago', target: 180, window: 30 },
    { label: '1 year ago', target: 365, window: 45 },
  ].map(p => ({ ...p, log: findClosestLog(new Date(afterDate.getTime() - p.target * 86400000), afterLog?.area, p.window) })).filter(p => p.log) : [];

  const compareKey = beforeLog && afterLog ? `${beforeLog.id}-${afterLog.id}` : null;
  const cachedAnalysis = compareKey ? compareTimeAnalysis[compareKey] : null;

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Run AI on the chosen pair (Time tab only — Product/Procedure use their own modals).
  const runTimeAnalysis = async () => {
    if (!beforeLog || !afterLog) return;
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    setCompareTimeAnalyzing(true);
    try {
      const days = Math.abs(Math.ceil((new Date(afterLog.date) - new Date(beforeLog.date)) / 86400000));
      const usage30 = getActualUsage(products, regimenLogs, logs, { windowDays: Math.min(90, days + 14) });
      const procsBetween = (procedures || []).filter(p => {
        const pd = new Date(p.date);
        return pd >= new Date(beforeLog.date) && pd <= new Date(afterLog.date);
      }).map(p => `${p.date}: ${p.name}`).join('\n') || 'none';
      const prompt = `Compare two skin journal entries from the same person, ${days} days apart.

EARLIER (${beforeLog.date}, ${beforeLog.area}, rated ${beforeLog.rating}/10):
- Concerns: ${(beforeLog.concerns || []).join(', ') || 'none'}
- Notes: ${beforeLog.notes || 'none'}

LATER (${afterLog.date}, ${afterLog.area}, rated ${afterLog.rating}/10):
- Concerns: ${(afterLog.concerns || []).join(', ') || 'none'}
- Notes: ${afterLog.notes || 'none'}

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
        aiAnalysis: null, analyzing: false,
      };
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
    <div className="space-y-5 md:space-y-7 md:max-w-md md:mx-auto pb-6">
      {/* === EDITORIAL HEADER ===
          Reuses the shared EditorialPageHeader so Compare reads identically
          to Journal/Pearls/Counsel. Eyebrow + serif italic display + body. */}
      <EditorialPageHeader
        eyebrow="Compare"
        title="Two moments, side by side."
        body="See what's actually changing."
      />

      {/* Sparse-photo guard — wrapped in EditorialCard with a subtle terracotta
          hairline so it reads as a soft prompt, not an alarm. */}
      {needsMorePhotos && (
        <EditorialCard className="text-center" style={{borderColor:'var(--accent)'}}>
          <div className="flex justify-center mb-3" style={{color:'var(--accent)'}}><Icon name="Camera" size={28} /></div>
          <h3 className="font-serif italic text-[20px] md:text-[24px] leading-[1.1] mb-2" style={{color:'var(--ink)'}}>
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
            <EmptyState icon="Calendar" text="Log a photo to anchor the comparison." action={() => setShowCheckInChooser(true)} actionText="Add Photo" />
          ) : (
            <>
              {/* Side-by-side photo grid — Before on left, After (today) on right.
                  Rounded-[20px] cream-deep wrappers per the new editorial language. */}
              <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                {/* BEFORE — empty until user picks */}
                <div className="rounded-[18px] overflow-hidden" style={{border:'1px solid var(--line)', background:'var(--cream-deep)'}}>
                  <div className="text-[10px] tracking-[0.28em] uppercase px-3 pt-3 pb-1.5" style={{color:'var(--ink-soft)'}}>Before</div>
                  {beforeLog ? (
                    <>
                      <div className="aspect-square overflow-hidden" style={{background:'var(--cream-deep)'}}>
                        <Photo item={beforeLog} alt="" className="w-full h-full object-cover"
                          renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-serif italic text-5xl" style={{color:'var(--ink-soft)'}}>{beforeLog.rating}</span></div>}
                        />
                      </div>
                      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-serif italic text-base truncate" style={{color:'var(--ink)'}}>{fmt(beforeLog.date)}</div>
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
                      className="w-full aspect-square border-2 border-dashed flex flex-col items-center justify-center gap-2 transition hover:bg-[var(--cream-deep)]"
                      style={{borderColor:'var(--line)'}}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'var(--accent)', color:'var(--cream)'}}>
                        <Icon name="Plus" size={20} />
                      </div>
                      <span className="font-serif italic text-base" style={{color:'var(--ink)'}}>Pick a prior photo</span>
                      <span className="text-[10px] tracking-[0.2em] uppercase italic" style={{color:'var(--ink-soft)'}}>or use a quick-pick below</span>
                    </button>
                  )}
                </div>
                {/* AFTER — defaults to today's full-face but user can swap */}
                <div className="rounded-[18px] overflow-hidden" style={{border:'1.5px solid var(--accent)', background:'var(--cream-deep)'}}>
                  <div className="text-[10px] tracking-[0.28em] uppercase px-3 pt-3 pb-1.5 flex items-center gap-1.5" style={{color:'var(--accent)'}}>
                    <span className="w-1 h-1 rounded-full inline-block" style={{background:'var(--accent)'}} />
                    {compareTimeAfterId && afterLog?.id !== afterDefaultLog?.id ? 'After' : 'After · today'}
                  </div>
                  <div className="aspect-square overflow-hidden" style={{background:'var(--cream-deep)'}}>
                    <Photo item={afterLog} alt="" className="w-full h-full object-cover"
                      renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-serif italic text-5xl" style={{color:'var(--ink-soft)'}}>{afterLog.rating}</span></div>}
                    />
                  </div>
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-serif italic text-base truncate" style={{color:'var(--ink)'}}>{fmt(afterLog.date)}</div>
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
                  {/* === SHARE BUTTON ===
                      Renders a 1080×1350 PNG of the Compare card and either
                      opens the native share sheet (mobile / Web Share API
                      with files) or downloads the file (desktop fallback).
                      Distribution unlock — user posts the artifact to their
                      own socials, no Étude-side hosting needed. */}
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
                          metricDeltas,
                        });
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
                                title: 'Étude · Compare',
                                text: 'My skin, side by side. via Étude',
                              });
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
                    style={{borderColor:'var(--accent)', color:'var(--accent)', background:'transparent', cursor:'pointer'}}
                    title="Generate a shareable PNG of this Compare"
                  >
                    <Icon name="Share2" size={11} /> Share this compare
                  </button>
                  <EditorialCard>
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-2 flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                      <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} /> Étude analysis
                    </div>
                    {cachedAnalysis ? (
                      <>
                        <div className="text-sm md:text-base font-light leading-relaxed whitespace-pre-line" style={{color:'var(--ink)'}}>{withPearls(formatAnalysisText(cachedAnalysis), setOpenLesson)}</div>
                        <button onClick={runTimeAnalysis} disabled={compareTimeAnalyzing} className="mt-3 text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                          {compareTimeAnalyzing ? <><Icon name="Loader2" size={11} className="spin" /> Re-running</> : <>Refresh analysis</>}
                        </button>
                      </>
                    ) : compareTimeAnalyzing ? (
                      <p className="font-serif italic text-sm flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                        <Icon name="Loader2" size={13} className="spin" style={{color:'var(--accent)'}} /> Reading the difference between these two photos…
                      </p>
                    ) : !getApiKey() ? (
                      <button onClick={() => setShowApiKeyModal(true)} className="text-[11px] tracking-[0.18em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                        <Icon name="Key" size={11} /> Add API key to auto-analyze
                      </button>
                    ) : (
                      <button onClick={runTimeAnalysis} disabled={compareTimeAnalyzing} className="text-[11px] tracking-[0.18em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
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
                            color: active ? 'var(--cream)' : 'var(--ink-soft)',
                          }}
                        >{p.label}</button>
                      );
                    })}
                    <button
                      onClick={() => setCompareTimePickerFor('before')}
                      className="flex-shrink-0 px-3.5 py-2 rounded-full tracking-[0.18em] text-[10px] uppercase border italic transition whitespace-nowrap"
                      style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}
                    >Browse all <Icon name="ArrowRight" size={11} className="inline ml-1" /></button>
                  </div>
                </div>
              )}

              {/* === MONTH CALENDAR === photo calendar for picking other Before dates. */}
              <div className="mb-5">
                <div className="text-[10px] tracking-[0.25em] uppercase mb-2 flex items-baseline justify-between" style={{color:'var(--ink-soft)'}}>
                  <span>Calendar</span>
                  <span className="text-[9px] italic normal-case tracking-normal">tap to set as before</span>
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

      {/* === PRODUCT SUB-TAB (May 2026 editorial rebuild) ===
          Replaces the bare row list with:
            1. Étude Insight card (3 trend metrics + summary)
            2. By Product header with Sort:Recent
            3. Rich rows: ingredient-icon card + product meta +
               before/after thumbnails + status badge + AI insight
          Each row is fully clickable, opens the existing
          productCompare modal for the deeper read. Editorial-restrained
          per Jenni: ivory bg, soft borders, terracotta accents, no
          dashboards. */}
      {compareSubTab === 'product' && (() => {
        if (productRows.length === 0) {
          return <EmptyState icon="Package" text="Nothing logged means nothing learned. Start checking in." />;
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
        // === AI insight copy keyed off category + readiness ===
        // Heuristic prose so each row has substance without a per-row
        // Claude call. The deeper analysis still happens inside the
        // productCompare modal when the user taps in.
        const insightCopy = (anchors, product, readiness) => {
          const cat = (product.category || '').toLowerCase();
          if (readiness === 'tooEarly') {
            if (cat.includes('retinoid') || cat.includes('treatment')) {
              return { headline: 'Too early to assess', text: 'Retinoid changes typically take 3–8 weeks.' };
            }
            if (cat.includes('exfoliant') || cat.includes('acid')) {
              return { headline: 'Too early to assess', text: 'Acids show their hand after a few cycles of cell turnover.' };
            }
            return { headline: 'Collecting baseline', text: 'Not enough data yet to detect meaningful changes.' };
          }
          if (readiness === 'building') {
            if (cat.includes('moisturizer') || cat.includes('cream')) {
              return { headline: 'Barrier looks stronger', text: 'Flaking decreased and comfort has improved.' };
            }
            if (cat.includes('exfoliant') || cat.includes('acid') || cat.includes('bha') || cat.includes('aha')) {
              return { headline: 'Texture trend emerging', text: 'Pores look clearer. Continue consistent use.' };
            }
            if (cat.includes('serum') || cat.includes('ampoule') || cat.includes('peptide')) {
              return { headline: 'Early hydration signals', text: 'Skin looks plumper. Need more time for full assessment.' };
            }
            if (cat.includes('toner') || cat.includes('essence') || cat.includes('mist')) {
              return { headline: 'Surface calming', text: 'Hydration reads steady. Hold the routine.' };
            }
            return { headline: 'Early signals', text: 'Trend is forming. Keep logging.' };
          }
          // ready
          if (cat.includes('cleanser')) {
            return { headline: 'Visible improvement', text: 'Redness is down and texture looks more even.' };
          }
          if (cat.includes('moisturizer') || cat.includes('cream')) {
            return { headline: 'Barrier compounding', text: 'Hydration is holding and comfort is steady.' };
          }
          if (cat.includes('retinoid') || cat.includes('treatment')) {
            return { headline: 'Texture refining', text: 'Fine-line and tone evening visible across the window.' };
          }
          if (cat.includes('serum') || cat.includes('ampoule')) {
            return { headline: 'Tone shift detected', text: 'Pigment and brightness are trending up.' };
          }
          return { headline: 'Meaningful change', text: 'Tap to see the side-by-side read.' };
        };
        // === Étude Insight summary — 3 metrics from latest photo log ===
        // Computed from each user's actual photoLogs metricSnapshot
        // history. Compares the AVG of the latest 3 photos to the AVG
        // of the 3 photos from ~2 weeks earlier. Tiny but real.
        const buildSummaryMetrics = () => {
          const photoLogsWithSnap = (logs || [])
            .filter(l => l && l.metricSnapshot)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          if (photoLogsWithSnap.length < 4) return null;
          const recent = photoLogsWithSnap.slice(0, 3);
          const olderStart = Math.min(photoLogsWithSnap.length - 1, 10);
          const older = photoLogsWithSnap.slice(olderStart - 2, olderStart + 1);
          if (older.length === 0) return null;
          const METRIC_SCORE = {
            redness:    { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
            hydration:  { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
            barrier:    { Strong: 100, Steady: 80, Holding: 55, Compromised: 30, Stripped: 10 },
          };
          const tc = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : null;
          const avgFor = (group, key) => {
            const vals = group.map(l => METRIC_SCORE[key][tc(l.metricSnapshot?.[key])]).filter(v => typeof v === 'number');
            if (!vals.length) return null;
            return vals.reduce((s, v) => s + v, 0) / vals.length;
          };
          const classify = (recentV, olderV) => {
            if (recentV == null || olderV == null) return 'Stable';
            const delta = recentV - olderV;
            if (delta >= 8) return 'Improving';
            if (delta <= -8) return 'Worsening';
            return 'Stable';
          };
          return {
            hydration: classify(avgFor(recent, 'hydration'), avgFor(older, 'hydration')),
            barrier:   classify(avgFor(recent, 'barrier'),   avgFor(older, 'barrier')),
            redness:   classify(avgFor(recent, 'redness'),   avgFor(older, 'redness')),
          };
        };
        const summary = buildSummaryMetrics();
        const allImproving = summary && summary.hydration === 'Improving' && summary.barrier === 'Improving';
        const summaryHeadline = !summary
          ? 'Log more photos to see your trend.'
          : allImproving
            ? 'Your skin is trending in the right direction.'
            : Object.values(summary).filter(v => v === 'Improving').length >= 2
              ? 'Mostly upward across the past two weeks.'
              : Object.values(summary).some(v => v === 'Worsening')
                ? 'Mixed signals this stretch.'
                : 'Holding steady across your tracked axes.';
        const summarySubline = !summary
          ? 'Need at least 4 photos with metric snapshots for a trend read.'
          : (summary.hydration === 'Improving' && summary.barrier === 'Improving')
            ? 'Hydration and barrier comfort are improving.'
            : 'Trend reads based on the last 3 photos vs ~2 weeks ago.';
        const metricColor = (v) => v === 'Improving' ? 'var(--sage)' : v === 'Worsening' ? 'var(--rose)' : 'var(--ink-soft)';
        const metricIcon = (v) => v === 'Improving' ? 'ArrowUpRight' : v === 'Worsening' ? 'ArrowDownRight' : 'Minus';
        return (
          <div className="space-y-5">
            {/* === ÉTUDE INSIGHT CARD === stacked: headline on top, metrics row below */}
            <section className="rounded-[20px] px-5 py-5 md:px-6 md:py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream)', border:'1px solid var(--accent)', color:'var(--accent)'}}>
                  <Icon name="Sparkles" size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-[0.24em] uppercase mb-1" style={{color:'var(--accent)', fontWeight:600}}>Étude insight</div>
                  <h3 className="font-serif italic text-[18px] md:text-[20px] leading-[1.2] mb-1.5" style={{color:'var(--ink)'}}>{summaryHeadline}</h3>
                  <p className="text-[12px] leading-relaxed" style={{color:'var(--ink-soft)'}}>{summarySubline}</p>
                </div>
              </div>
              {summary && (
                <>
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t" style={{borderColor:'var(--line)'}}>
                    {[
                      { key: 'hydration', label: 'Hydration', icon: 'Droplet' },
                      { key: 'barrier', label: 'Barrier', icon: 'Shield' },
                      { key: 'redness', label: 'Redness', icon: 'CircleDot' },
                    ].map(m => (
                      <div key={m.key} className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1" style={{color:'var(--ink-soft)'}}>
                          <Icon name={m.icon} size={11} />
                          <span className="text-[9.5px] tracking-[0.18em] uppercase">{m.label}</span>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <Icon name={metricIcon(summary[m.key])} size={11} style={{color: metricColor(summary[m.key])}} />
                          <span className="text-[12px] italic" style={{color: metricColor(summary[m.key])}}>{summary[m.key]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => toast('Full summary coming soon', 'info')}
                    className="mt-3 text-[10.5px] tracking-[0.18em] uppercase italic transition hover:opacity-70 inline-flex items-center gap-1"
                    style={{color:'var(--accent)', cursor:'pointer'}}
                  >
                    See full summary <Icon name="ArrowRight" size={11} />
                  </button>
                </>
              )}
            </section>

            {/* === BY PRODUCT === header */}
            <div className="flex items-baseline justify-between gap-3 px-1">
              <div className="text-[10px] tracking-[0.28em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>By product</div>
              <div className="text-[10px] tracking-[0.18em] uppercase italic" style={{color:'var(--ink-soft)'}}>Sort: Recent</div>
            </div>

            {/* === PRODUCT ROWS === */}
            <div className="rounded-[20px] overflow-hidden" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              {productRows.map((row, idx) => {
                const { product, anchors } = row;
                const readiness = classifyReadiness(anchors, product);
                const insight = insightCopy(anchors, product, readiness);
                const weeks = anchors.daysActive >= 7 ? `${Math.round(anchors.daysActive / 7)}w` : `${anchors.daysActive}d`;
                const category = (product.category || 'product').replace(/-/g, ' ');
                const iconName = getCategoryIcon(product.category);
                const useTimes = (product.useTimes || []).map(s => s.toUpperCase()).join(' / ') || 'AM / PM';
                const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '';
                const beforeLog = anchors.anchorPhotoLog;
                const afterLog = anchors.latestPhotoLog;
                const statusStyle = readiness === 'ready'
                  ? { bg: 'rgba(138, 155, 126, 0.14)', color: 'var(--sage, #6b8364)', text: 'READY TO COMPARE' }
                  : readiness === 'building'
                    ? { bg: 'rgba(201, 95, 58, 0.10)', color: 'var(--accent)', text: 'BUILDING EVIDENCE' }
                    : { bg: 'rgba(78, 58, 44, 0.06)', color: 'var(--ink-soft)', text: 'TOO EARLY' };
                const ctaText = readiness === 'ready'
                  ? 'View comparison →'
                  : readiness === 'building'
                    ? '7+ more days'
                    : 'Need 14+ days';
                const ctaColor = readiness === 'ready' ? 'var(--accent)' : 'var(--ink-soft)';
                // === COMPACT ROW LAYOUT (May 2026 v2) ===
                // Was: stacked header + centered photos + analysis prose
                // block. Read ~180px tall per product — three rows fit
                // on screen and the "TOO EARLY · Collecting baseline ·
                // NEED 14+ DAYS" stack was three lines of nothing for
                // most products. New: single horizontal row, ~76px
                // tall. Status collapses to a tiny chip inline with
                // the meta. Full analysis lives in the modal that
                // opens on click (already does — just dropping the
                // duplicated preview prose from the card).
                const STATUS_LABEL = readiness === 'ready'
                  ? 'Ready'
                  : readiness === 'building'
                    ? 'Building'
                    : 'Too early';
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setProductCompareId(product.id)}
                    className="w-full text-left transition hover:bg-[var(--cream)] cursor-pointer flex items-center gap-3"
                    style={{
                      borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                    }}
                    title={`Open comparison for ${product.name}`}
                  >
                    {/* Category icon tile */}
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: '#FFFDFC',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)', flexShrink: 0,
                      }}
                    >
                      <Icon name={iconName} size={16} />
                    </div>

                    {/* Text column — brand / name / meta + status chip */}
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
                            letterSpacing: '0.12em',
                          }}
                        >{STATUS_LABEL}</span>
                      </div>
                    </div>

                    {/* Mini photo pair — before → after, no date labels */}
                    {beforeLog && afterLog ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div style={{width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: 'var(--cream)', border: '1px solid var(--line)'}}>
                          <Photo item={beforeLog} alt="" className="w-full h-full object-cover"
                            renderFallback={() => <div className="w-full h-full flex items-center justify-center" style={{color:'var(--ink-soft)'}}><Icon name="Camera" size={12} /></div>}
                          />
                        </div>
                        <Icon name="ArrowRight" size={11} style={{color:'var(--ink-soft)', flexShrink:0}} />
                        <div style={{width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: 'var(--cream)', border: '1.5px solid var(--accent)'}}>
                          <Photo item={afterLog} alt="" className="w-full h-full object-cover"
                            renderFallback={() => <div className="w-full h-full flex items-center justify-center" style={{color:'var(--ink-soft)'}}><Icon name="Camera" size={12} /></div>}
                          />
                        </div>
                      </div>
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
                      <Icon name="ChevronRight" size={14} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer — calibration note + how-comparisons-work link */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-1 pt-1">
              <div className="flex items-center gap-1.5 text-[10.5px]" style={{color:'var(--ink-soft)'}}>
                <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} />
                <span className="italic">Consistent check-ins make comparisons more accurate.</span>
              </div>
              <button
                onClick={() => toast('How comparisons work — full doc coming soon', 'info')}
                className="text-[10.5px] tracking-[0.16em] uppercase italic transition hover:opacity-70 inline-flex items-center gap-1"
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
              <h3 className="font-serif italic text-[20px] md:text-[24px] leading-[1.1] mb-2" style={{color:'var(--ink)'}}>No procedures logged yet.</h3>
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
                    <div key={procedure.id} className="rounded-[18px] overflow-hidden" style={{border:'1px solid var(--line)', background:'var(--cream-deep)'}}>
                      <div className="px-4 py-3 border-b flex items-baseline justify-between gap-3 flex-wrap" style={{borderColor:'var(--line)'}}>
                        <div>
                          <div className="text-[10px] tracking-[0.25em] uppercase" style={{color:'var(--ink-soft)'}}>{procedure.type || 'procedure'}</div>
                          <h3 className="font-serif italic text-lg md:text-xl leading-tight mt-0.5" style={{color:'var(--ink)'}}>{procedure.name}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{fmt(procedure.date)}</div>
                          <div className="text-xs italic mt-0.5" style={{color:'var(--ink-soft)'}}>{daysSince === 0 ? 'today' : daysSince === 1 ? '1 day ago' : `${daysSince} days ago`}</div>
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
                            <span className="italic" style={{color:'var(--ink-soft)'}}>Cost not logged</span>
                          )}
                          {aiDelta != null && (
                            <span style={{color: aiDelta > 0 ? 'var(--sage)' : aiDelta < 0 ? 'var(--rose)' : 'var(--ink-soft)'}}>
                              <span style={{color:'var(--accent)'}}>✦</span> {aiDelta > 0 ? '+' : ''}{aiDelta.toFixed(1)} pts
                            </span>
                          )}
                          {costPerPoint != null && aiDelta > 0 && (
                            <span className="italic" style={{color:'var(--ink-soft)'}}>{fmtCurrency(costPerPoint)} / point</span>
                          )}
                          {costPerPoint != null && aiDelta < 0 && (
                            <span className="italic" style={{color:'var(--rose)'}}>moved the wrong way</span>
                          )}
                          {procCost != null && aiDelta == null && (
                            <span className="italic" style={{color:'var(--ink-soft)'}}>log both photos to see the math</span>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-0">
                        {/* === BEFORE — day-of-procedure === */}
                        <div className="border-r" style={{borderColor:'var(--line)'}}>
                          <div className="text-[10px] tracking-[0.25em] uppercase px-3 pt-2.5 pb-1" style={{color:'var(--ink-soft)'}}>Day of</div>
                          {before ? (
                            <>
                              <div className="aspect-square overflow-hidden" style={{background:'var(--cream-deep)'}}>
                                <Photo item={before} alt="" className="w-full h-full object-cover"
                                  renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-serif italic text-5xl" style={{color:'var(--ink-soft)'}}>{aiScoreOut10(before) || before.rating}</span></div>}
                                />
                              </div>
                              <div className="px-3 py-2">
                                <div className="font-serif italic text-sm md:text-base" style={{color:'var(--ink)'}}>{fmt(before.date)}</div>
                                <div className="text-xs font-light" style={{color:'var(--ink-soft)'}}>
                                  {(before.area || 'full-face').replace(/-/g, ' ')}
                                  {aiScoreOut10(before) ? <> · <span style={{color:'var(--accent)'}}>✦</span> {aiScoreOut10(before)}/10</> : (before.rating != null ? ` · ${before.rating}/10` : '')}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <label htmlFor={beforeInputId} className="block aspect-square cursor-pointer transition hover:bg-[var(--cream-deep)]" style={{background:'var(--cream-deep)'}}>
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                                  <Icon name="Upload" size={18} />
                                  <span className="text-[9px] tracking-[0.25em] uppercase">Upload day-of</span>
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
                                <div className="font-serif italic text-xs" style={{color:'var(--ink-soft)'}}>{fmt(procedure.date)}</div>
                                <div className="text-[10px] italic" style={{color:'var(--ink-soft)'}}>no photo on this day</div>
                              </div>
                            </>
                          )}
                        </div>
                        {/* === AFTER — 30-day follow-up === */}
                        <div>
                          <div className="text-[10px] tracking-[0.25em] uppercase px-3 pt-2.5 pb-1" style={{color:'var(--accent)'}}>Day 30</div>
                          {after ? (
                            <>
                              <div className="aspect-square overflow-hidden" style={{background:'var(--cream-deep)'}}>
                                <Photo item={after} alt="" className="w-full h-full object-cover"
                                  renderFallback={() => <div className="w-full h-full flex items-center justify-center"><span className="font-serif italic text-5xl" style={{color:'var(--ink-soft)'}}>{aiScoreOut10(after) || after.rating}</span></div>}
                                />
                              </div>
                              <div className="px-3 py-2">
                                <div className="font-serif italic text-sm md:text-base" style={{color:'var(--ink)'}}>{fmt(after.date)}</div>
                                <div className="text-xs font-light" style={{color:'var(--ink-soft)'}}>
                                  {(after.area || 'full-face').replace(/-/g, ' ')}
                                  {aiScoreOut10(after) ? <> · <span style={{color:'var(--accent)'}}>✦</span> {aiScoreOut10(after)}/10</> : (after.rating != null ? ` · ${after.rating}/10` : '')}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <label htmlFor={afterInputId} className="block aspect-square cursor-pointer transition hover:bg-[var(--cream-deep)]" style={{background:'var(--cream-deep)'}}>
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                                  <Icon name="Upload" size={18} />
                                  <span className="text-[9px] tracking-[0.25em] uppercase">Upload day-30</span>
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
                                <div className="font-serif italic text-xs" style={{color:'var(--ink-soft)'}}>
                                  {(() => {
                                    const d = new Date(new Date(procedure.date).getTime() + 30 * 86400000);
                                    return fmt(localDateISO(d));
                                  })()}
                                </div>
                                <div className="text-[10px] italic" style={{color:'var(--ink-soft)'}}>30-day follow-up · upload</div>
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
                          <div className="border-t" style={{borderColor:'var(--line)'}}>
                            {/* Infographic — same metric quartet as Quick tab. */}
                            <div className="px-4 py-3">
                              <CompareMetricInfographic
                                before={before}
                                after={after}
                                ratingDelta={ratingDelta}
                                daysApart={Math.abs(Math.floor((new Date(after.date) - new Date(before.date)) / 86400000))}
                              />
                            </div>
                            {/* AI analysis — auto-runs on first render via useEffect. */}
                            <div className="px-4 pb-4">
                              <div className="text-[10px] tracking-[0.3em] uppercase mb-2 flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                                <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} /> Étude analysis
                              </div>
                              {procCached ? (
                                <div className="text-sm font-light leading-relaxed whitespace-pre-line" style={{color:'var(--ink)'}}>{withPearls(formatAnalysisText(procCached), setOpenLesson)}</div>
                              ) : compareTimeAnalyzing ? (
                                <p className="font-serif italic text-sm flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                                  <Icon name="Loader2" size={13} className="spin" style={{color:'var(--accent)'}} /> Reading the difference…
                                </p>
                              ) : !getApiKey() ? (
                                <button onClick={() => setShowApiKeyModal(true)} className="text-[11px] tracking-[0.18em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                                  <Icon name="Key" size={11} /> Add API key to auto-analyze
                                </button>
                              ) : (
                                <button onClick={() => runComparePairAnalysisShared(before, after)} className="text-[11px] tracking-[0.18em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                                  <Icon name="Sparkles" size={11} /> Analyze this procedure
                                </button>
                              )}
                            </div>
                            <div className="px-4 py-3 border-t flex items-center justify-between gap-2" style={{borderColor:'var(--line)'}}>
                              <div className="text-xs font-light italic" style={{color:'var(--ink-soft)'}}>{procedure.type || 'procedure'} · {procedure.name}</div>
                              <button
                                onClick={() => enterCompare?.(before.id, after.id)}
                                className="text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70"
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
    </div>
  );
};
