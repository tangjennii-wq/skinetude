// === JournalCompactPanel (Wave 8.2 sub-extract — May 2026) ===
// The `compact` mode of JournalView. Mounted by the parent when
// `journalMode === 'compact'` and there are logs to render.

const JournalCompactPanel = ({
  callClaude,
  logs,
  procedures,
  products,
  regimenLogs,
  saveData,
  setActiveTab,
  setShowApiKeyModal,
  toast,
  weeklyInsights,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  exitSelectMode,
  selectMode,
  selectedIds,
  setCompareSubTab,
  setCompareTimeAfterId,
  setCompareTimeBeforeId,
  setJournalDayDetail,
  setOpenLesson,
  setStoryFilter,
  setStorySearch,
  setWeeklyInsightLoading,
  setWeeklyInsights,
  storyFilter,
  storySearch,
  toggleSelectId,
  weeklyInsightLoading}) => {
  return (() => {
      const hasPhoto = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
      const photoLogs = logs.filter(hasPhoto).sort((a, b) => new Date(b.date) - new Date(a.date));
      const fmtRange = (start, end) => {
        const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${s} – ${e}`;
      };
      const fmtRel = (ts) => {
        if (!ts) return '';
        const d = Math.round((Date.now() - ts) / 86400000);
        if (d === 0) return 'today';
        if (d === 1) return '1d ago';
        return `${d}d ago`;
      };
      // Build last-4-weeks groups: most recent week first.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weeks = [];
      for (let w = 0; w < 4; w++) {
        const end = new Date(today.getTime() - w * 7 * 86400000);
        const start = new Date(end.getTime() - 6 * 86400000);
        const startISO = localDateISO(start);
        const endISO = localDateISO(end);
        // Photos in this week
        const wkPhotos = photoLogs.filter(l => l.date >= startISO && l.date <= endISO).sort((a, b) => new Date(b.date) - new Date(a.date));
        // Products that started in this week (explicit startDate only)
        const newProducts = (products || []).filter(p => p.startDate && p.startDate >= startISO && p.startDate <= endISO);
        // Procedures in this week
        const wkProcs = (procedures || []).filter(p => p.date >= startISO && p.date <= endISO);
        // Avg rating
        const wkRated = logs.filter(l => l.date >= startISO && l.date <= endISO && l.rating != null);
        const avg = wkRated.length > 0 ? (wkRated.reduce((s, l) => s + Number(l.rating), 0) / wkRated.length) : null;
        // ISO week key for cache
        const yr = end.getFullYear();
        const dayOfYear = Math.floor((end - new Date(yr, 0, 0)) / 86400000);
        const wkNum = Math.ceil(dayOfYear / 7);
        const weekKey = `${yr}-W${String(wkNum).padStart(2, '0')}-${startISO}`;
        weeks.push({ start, end, startISO, endISO, photos: wkPhotos, newProducts, procedures: wkProcs, avg, weekKey });
      }

      const generateWeekInsight = async (week) => {
        if (!canRunAnalysis()) { setShowApiKeyModal(true); return; }
        setWeeklyInsightLoading(prev => ({ ...prev, [week.weekKey]: true }));
        try {
          const usage = getActualUsage(products, regimenLogs, logs, { windowDays: 30 });
          const photoBlock = week.photos.slice(0, 5).map(l => `${l.date}: ${l.area} ${l.rating}/10 [${(l.concerns || []).join(',') || '-'}]${l.notes ? ' · ' + l.notes.slice(0, 80) : ''}`).join('\n') || 'No photos this week.';
          const newProdBlock = week.newProducts.length > 0
            ? week.newProducts.map(p => `${p.name} (${p.activeIngredients || 'no actives listed'})`).join(', ')
            : 'none';
          const procBlock = week.procedures.length > 0
            ? week.procedures.map(p => `${p.date}: ${p.name}`).join('; ')
            : 'none';
          const prompt = `You are an educational skincare advisor writing a tight one-paragraph weekly read for a single user (3-4 sentences MAX). Voice: editorial, magazine register, no bullet points. Anchor in mechanism + grade [A]/[B]/[C] when relevant. Reason ONLY from ACTIVELY USED. This is observation and education, not diagnosis — if you note something that warrants medical attention (severe, painful, infected, rapidly changing), say so directly.

Week: ${fmtRange(week.start, week.end)}
Avg rating: ${week.avg != null ? week.avg.toFixed(1) + '/10' : 'no ratings logged'}
Photos this week:
${photoBlock}
New products started: ${newProdBlock}
Procedures: ${procBlock}

USER'S ACTUAL ROUTINE (last 30 days):
${formatUsageForPrompt(usage)}

Write one paragraph: what defined this week, one likely contributor (cite the routine, a new start, or a procedure), and one specific suggested move for the next 7 days. Be specific. Don't pad.`;
          const result = await callClaude(prompt, '', null, { maxTokens: 500, voice: true });
          const next = { ...weeklyInsights, [week.weekKey]: { content: result, generatedAt: Date.now() } };
          setWeeklyInsights(next);
          await saveData('weeklyInsights', next);
        } catch (e) {
          console.error('[Weekly insight] failed:', e);
          toast(`Insight failed: ${e?.message?.slice(0, 80) || 'unknown'}`, 'error');
        }
        setWeeklyInsightLoading(prev => ({ ...prev, [week.weekKey]: false }));
      };

      // Calendar — last 30 days, mirroring Compare's calendar
      const calDays = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const iso = localDateISO(d);
        const onDay = photoLogs.filter(l => l.date === iso);
        const dayLog = onDay.find(l => l.area === 'full-face') || onDay[0] || null;
        calDays.push({ date: d, iso, log: dayLog, isToday: i === 0 });
      }

      // Quick compare CTA (top of compact view) — "Compare today vs 1 month ago" small widget.
      const tdyLog = photoLogs[0] || null;
      const monthAgoTarget = new Date(today.getTime() - 30 * 86400000);
      const monthAgoLog = (() => {
        if (!tdyLog) return null;
        const cands = photoLogs
          .filter(l => l.id !== tdyLog.id)
          .map(l => ({ log: l, diff: Math.abs(new Date(l.date) - monthAgoTarget) / 86400000 }))
          .filter(c => c.diff <= 14)
          .sort((a, b) => a.diff - b.diff);
        return cands[0]?.log || null;
      })();

      // === Editorial card feed: search + filter the unified item stream. ===
      const q = (storySearch || '').trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      const matches = (haystack) => {
        if (tokens.length === 0) return true;
        const text = String(haystack).toLowerCase();
        return tokens.every(t => text.includes(t));
      };
      const items = [];
      if (storyFilter === 'all' || storyFilter === 'photos') {
        logs.forEach(l => {
          const productNames = (l.usedProducts || [])
            .map(id => products.find(p => p.id === id)?.name)
            .filter(Boolean).join(' ');
          const haystack = [l.notes, l.aiAnalysis, l.ratingExplanation, (l.concerns || []).join(' '), (l.usedTags || []).join(' '), productNames, l.area].join(' ');
          if (matches(haystack)) items.push({ kind: 'log', date: l.date, id: l.id, sortKey: `${l.date}-${String(l.id).padStart(15, '0')}`, payload: l });
        });
      }
      if (storyFilter === 'all' || storyFilter === 'procedures') {
        (procedures || []).forEach(p => {
          const haystack = [p.name, p.type, p.notes, p.results, p.aiAnalysis].join(' ');
          if (matches(haystack)) items.push({ kind: 'procedure', date: p.date, id: `proc-${p.id}`, sortKey: `${p.date}-proc-${p.id}`, payload: p });
        });
      }
      if (storyFilter === 'all' || storyFilter === 'newproducts') {
        (products || []).forEach(p => {
          if (!p.startDate) return;
          const haystack = [p.name, p.brand, p.activeIngredients, (p.tags || []).join(' ')].join(' ');
          if (matches(haystack)) items.push({ kind: 'product-start', date: p.startDate, id: `prod-${p.id}`, sortKey: `${p.startDate}-prod-${p.id}`, payload: p });
        });
      }
      items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
      // Date headline format per spec: "Saturday, May 2".
      const fmtDateHeadline = (d) => {
        const dt = new Date(d);
        const month = dt.toLocaleDateString('en-US', { month: 'long' });
        const day = dt.getDate();
        const weekday = dt.toLocaleDateString('en-US', { weekday: 'long' });
        return `${weekday}, ${month} ${day}`;
      };
      // Pull the current week (most recent of the 4) for the recap card.
      const recapWeek = weeks[0];
      const recapInsight = weeklyInsights[recapWeek?.weekKey];
      const recapLoading = !!weeklyInsightLoading[recapWeek?.weekKey];
      const filterChips = [
        { id: 'all', label: 'All' },
        { id: 'photos', label: 'Photos' },
        { id: 'procedures', label: 'Procedures' },
        { id: 'newproducts', label: 'New products' },
      ];

      return (
        <div className="space-y-6">
          {/* === HERO SEARCH === */}
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--ink-soft)'}} />
            <input autoCapitalize="off" autoCorrect="off" spellCheck={false}
              type="text"
              value={storySearch}
              onChange={e => setStorySearch(e.target.value)}
              placeholder="Search notes, tags, products, concerns…"
              className="w-full pl-9 pr-3 py-2.5 border text-sm font-light focus:outline-none"
              style={{borderColor: 'var(--line)', background:'var(--cream)', color:'var(--ink)'}}
            />
          </div>

          {/* === FILTER CHIPS === */}
          <div className="flex gap-2 flex-wrap">
            {filterChips.map(f => {
              const active = storyFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStoryFilter(f.id)}
                  className="px-3.5 py-1.5 rounded-full tracking-[0.18em] text-[10px] uppercase border transition"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--line)',
                    background: active ? 'var(--accent)' : 'var(--cream)',
                    color: active ? 'var(--cream)' : 'var(--ink-soft)'}}
                >{f.label}</button>
              );
            })}
          </div>

          {/* === WEEKLY RECAP CARD ===
              Pinned at top — this week's date range, avg rating, photo
              count, and an AI Frida Note for the week (lazy generated). */}
          {recapWeek && (
            <EditorialCard pad="normal">
              <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                <div>
                  <Eyebrow>This week</Eyebrow>
                  <div className="font-sans text-base md:text-lg mt-0.5" style={{color:'var(--ink)'}}>
                    {fmtRange(recapWeek.start, recapWeek.end)}
                  </div>
                </div>
                {recapWeek.avg != null && (
                  <div className="text-right">
                    <div className="font-sans text-2xl md:text-3xl leading-none" style={{color:'var(--accent)'}}>{recapWeek.avg.toFixed(1)}</div>
                    <div className="text-[9px] tracking-[0.2em] uppercase mt-1" style={{color:'var(--ink-soft)'}}>/10 avg</div>
                  </div>
                )}
              </div>

              {/* Stat strip — quick read on the week. */}
              <div className="flex items-center gap-4 text-[11px] flex-wrap" style={{color:'var(--ink-soft)'}}>
                <span><span className="font-sans text-base mr-1" style={{color:'var(--ink)'}}>{recapWeek.photos.length}</span>photos</span>
                {recapWeek.newProducts.length > 0 && (
                  <span><span className="font-sans text-base mr-1" style={{color:'var(--ink)'}}>{recapWeek.newProducts.length}</span>new product{recapWeek.newProducts.length === 1 ? '' : 's'}</span>
                )}
                {recapWeek.procedures.length > 0 && (
                  <span><span className="font-sans text-base mr-1" style={{color:'var(--ink)'}}>{recapWeek.procedures.length}</span>procedure{recapWeek.procedures.length === 1 ? '' : 's'}</span>
                )}
              </div>

              {/* AI Frida Note for the week. */}
              {(recapWeek.photos.length > 0 || recapWeek.newProducts.length > 0 || recapWeek.procedures.length > 0) && (
                <div className="border-l-2 pl-4 py-1 mt-4" style={{borderColor: 'var(--line)'}}>
                  {recapInsight ? (
                    <>
                      <div className="text-[10px] tracking-[0.25em] uppercase mb-1.5 flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                        <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} /> Frida Note · {fmtRel(recapInsight.generatedAt)}
                      </div>
                      <p className="font-sans text-sm md:text-[15px] leading-relaxed" style={{color:'var(--ink)'}}>{withPearls(recapInsight.content, setOpenLesson)}</p>
                      <button
                        onClick={() => generateWeekInsight(recapWeek)}
                        disabled={recapLoading}
                        className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1 mt-2 disabled:opacity-50"
                        style={{color:'var(--ink-soft)'}}
                      >{recapLoading ? <><Icon name="Loader2" size={11} className="spin" /> Re-running</> : <>Refresh</>}</button>
                    </>
                  ) : (
                    <button
                      onClick={() => generateWeekInsight(recapWeek)}
                      disabled={recapLoading}
                      className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1.5 disabled:opacity-50"
                      style={{color:'var(--accent)'}}
                    >{recapLoading ? <><Icon name="Loader2" size={11} className="spin" /> Generating…</> : <><Icon name="Sparkles" size={11} /> Generate this week's note</>}</button>
                  )}
                </div>
              )}
            </EditorialCard>
          )}

          {/* === SELECT-MODE STATUS BAR ===
              When tapping a card from select mode, show the prompt and Compare CTA. */}
          {selectMode && (
            <div className="px-4 py-3 border flex justify-between items-center gap-3 flex-wrap" style={{background:'var(--cream-deep)', borderColor:'var(--ink)'}}>
              <div className="text-xs font-light" style={{color:'var(--ink)'}}>
                {selectedIds.length === 0 && 'Tap any two photo entries to compare.'}
                {selectedIds.length === 1 && 'One selected — pick one more.'}
                {selectedIds.length === 2 && 'Two selected — ready when you are.'}
              </div>
              <button
                onClick={() => {
                  const compareEntries = selectedIds.map(id => logs.find(l => l.id === id)).filter(Boolean);
                  if (compareEntries.length !== 2) return;
                  const [a, b] = compareEntries;
                  const earlier = new Date(a.date) < new Date(b.date) ? a : b;
                  const later = earlier === a ? b : a;
                  setCompareTimeBeforeId(earlier.id);
                  setCompareTimeAfterId(later.id);
                  setActiveTab('compare');
                  setCompareSubTab('time');
                  exitSelectMode();
                }}
                disabled={selectedIds.length !== 2}
                className="text-[10px] tracking-[0.2em] uppercase px-3 py-2 disabled:opacity-30 transition flex items-center gap-1.5"
                style={{background:'var(--ink)', color:'var(--cream)'}}
              >
                Compare these <Icon name="ArrowRight" size={11} />
              </button>
            </div>
          )}

          {/* === EDITORIAL CARD FEED ===
              Per spec: date headline, photo, short reflection, mini tags,
              optional Frida Note (AI analysis). Procedure + product-start
              items render as compact accent-bordered markers. */}
          {items.length === 0 ? (
            <p className="font-sans text-base py-12 text-center" style={{color:'var(--ink-soft)'}}>
              {q || storyFilter !== 'all' ? 'Nothing matches. Try less.' : 'Story starts with the first photo.'}
            </p>
          ) : (
            <div className="space-y-6">
              {items.map(item => {
                // Procedure marker — compact accent-bordered card.
                if (item.kind === 'procedure') {
                  const p = item.payload;
                  return (
                    <article key={item.id} className="border-l-2 pl-5 py-3" style={{borderColor: 'var(--line)'}}>
                      <div className="text-[10px] tracking-[0.3em] uppercase flex items-center gap-1.5" style={{color:'var(--accent)'}}>
                        <Icon name="Activity" size={11} /> Procedure
                      </div>
                      <h3 className="font-sans text-lg md:text-xl mt-1" style={{color:'var(--ink)'}}>{p.name}</h3>
                      <div className="text-[11px] font-light mt-0.5" style={{color:'var(--ink-soft)'}}>{fmtDateHeadline(p.date)}{p.type ? ` · ${(p.type || '').replace(/-/g, ' ')}` : ''}</div>
                      {p.results && <p className="text-sm font-light mt-2 leading-relaxed" style={{color:'var(--ink)'}}>{p.results}</p>}
                    </article>
                  );
                }
                // Product-start marker — compact ink-soft bordered card.
                if (item.kind === 'product-start') {
                  const p = item.payload;
                  return (
                    <article key={item.id} className="border-l-2 pl-5 py-3" style={{borderColor:'var(--ink-soft)'}}>
                      <div className="text-[10px] tracking-[0.3em] uppercase flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                        <Icon name="Plus" size={11} /> Started using
                      </div>
                      <h3 className="font-sans text-base md:text-lg mt-1" style={{color:'var(--ink)'}}>{p.name}</h3>
                      <div className="text-[11px] font-light mt-0.5" style={{color:'var(--ink-soft)'}}>{fmtDateHeadline(item.date)}{p.brand ? ` · ${p.brand}` : ''}{p.activeIngredients ? ` · ${p.activeIngredients}` : ''}</div>
                    </article>
                  );
                }
                // === Editorial photo entry card ===
                const l = item.payload;
                const hasPhoto = l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
                const isSelected = selectedIds.includes(l.id);
                // Mini tags: hashtags from notes + concerns.
                const tagSet = new Set();
                (l.usedTags || []).forEach(t => t && tagSet.add(t.toLowerCase().replace(/^#/, '')));
                (l.concerns || []).forEach(c => c && tagSet.add(c.toLowerCase()));
                const tags = Array.from(tagSet).slice(0, 6);
                // Reflection text — prefer notes, fall back to ratingExplanation, then a one-liner.
                const reflection = l.notes || l.ratingExplanation || null;
                const handleCardClick = () => {
                  if (selectMode) { toggleSelectId(l.id); }
                  else { setJournalDayDetail(l.date); }
                };
                return (
                  <article
                    key={item.id}
                    onClick={handleCardClick}
                    className="border cursor-pointer transition hover:opacity-95"
                    style={{
                      borderColor: isSelected ? 'var(--accent)' : 'var(--line)',
                      background: 'var(--cream)',
                      boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'none'}}
                  >
                    {/* Date headline — eyebrow style, top of card. */}
                    <div className="px-5 pt-4 pb-2 flex items-baseline justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>{fmtDateHeadline(l.date)}</div>
                        {l.area && l.area !== 'full-face' && (
                          <div className="text-[11px] font-light mt-0.5" style={{color:'var(--ink-soft)'}}>{l.area}</div>
                        )}
                      </div>
                      {l.rating != null && (
                        <div className="text-right">
                          <span className="font-sans text-xl" style={{color:'var(--accent)'}}>{l.rating}</span>
                          <span className="text-[10px] tracking-[0.2em] uppercase ml-1" style={{color:'var(--ink-soft)'}}>/10</span>
                        </div>
                      )}
                    </div>

                    {/* Photo — full-bleed within card. */}
                    {hasPhoto && (
                      <div className="aspect-[4/3] md:aspect-[16/10] overflow-hidden" style={{background:'var(--cream-deep)'}}>
                        <Photo item={l} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Body — reflection + tags + Frida Note. */}
                    <div className="px-5 py-4 space-y-3">
                      {/* Short reflection */}
                      {reflection && (
                        <p className="text-sm font-light leading-relaxed" style={{color:'var(--ink)'}}>{reflection}</p>
                      )}

                      {/* Mini tag chips */}
                      {tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {tags.map(t => (
                            <span
                              key={t}
                              className="text-[10px] tracking-[0.05em] px-2 py-0.5 rounded-full"
                              style={{background:'var(--cream-deep)', color:'var(--ink-soft)', border: '1px solid var(--line)'}}
                            >#{t}</span>
                          ))}
                        </div>
                      )}

                      {/* Optional Frida Note — AI analysis as prose with accent bar. */}
                      {l.aiAnalysis && (
                        <div className="border-l-2 pl-3 py-1 mt-2" style={{borderColor: 'var(--line)'}}>
                          <div className="text-[10px] tracking-[0.25em] uppercase mb-1 flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                            <Icon name="Sparkles" size={10} style={{color:'var(--accent)'}} /> Frida Note
                          </div>
                          <p className="font-sans text-sm leading-relaxed line-clamp-3" style={{color:'var(--ink)'}}>{withPearls(formatAnalysisText(l.aiAnalysis), setOpenLesson)}</p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* === CALENDAR === photo calendar — tap a date to open the entry. */}
          <section className="border-t pt-6 mt-2" style={{borderColor: 'var(--line)'}}>
            <div className="text-[10px] tracking-[0.3em] uppercase mb-3 flex items-baseline justify-between" style={{color:'var(--ink-soft)'}}>
              <span>Calendar</span>
              <span className="text-[9px] normal-case tracking-normal">tap a day with a photo</span>
            </div>
            <MiniMonthCalendar
              logs={logs}
              procedures={procedures}
              showThumbs={true}
              onDayClick={(log, dKey) => setJournalDayDetail(dKey)}
            />
          </section>
        </div>
      );
  })();
};
