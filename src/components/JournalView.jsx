// === JournalView (Wave 7.2 extract — May 2026) ===
// The Journal tab body — extracted from App's inline IIFE
// `{activeTab === 'journal' && (() => { ... })()}`. ~2750 lines: timeline,
// extended-mode, suggestions, photo grid, journal-mode toggle, etc.

const JournalView = ({
  activeTab,
  logs,
  products,
  procedures,
  regimenLogs,
  weeklyInsights,
  dailyCoverPick,
  journalViewOverride, setJournalViewOverride,
  selectMode, setSelectMode,
  selectedIds, setSelectedIds,
  journalMode, setJournalMode,
  setShowLogModal,
  setEditingLogId,
  openCheckInDetailsForLog,
  setShowProcedureModal,
  setEditingProcedureId,
  setShowApiKeyModal,
  setShowHomeUploadPicker,
  setShowCheckInChooser,
  setShowPhotoImportQueue,
  setSkinReadDrawerLogId,
  setCompareTimeBeforeId,
  setCompareTimeAfterId,
  setOpenLesson,
  setProductCompareId,
  setActiveTab,
  toggleSelectId,
  deleteLog,
  enterCompare,
  handleAddPriorPhoto,
  retryLogAnalysis,
  callClaude,
  saveData,
  toast,
  openChat,
  // fileToBase64 is App-scope (line 7270 of index.jsx.source) — needs
  // explicit prop bridge. Passed through to PhotoTimeline. Was already
  // passed at the render site; just missing from the destructure here.
  fileToBase64,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  deleteProcedure,
  exitSelectMode,
  journalDigestWeekOffset, setJournalDigestWeekOffset,
  setJournalDayDetail,
  setStoryFilter, storyFilter,
  setTimelineLimit, timelineLimit,
  setTimelineViewMode, timelineViewMode,
  storySearch, setStorySearch,
  updateProcedure,
  // For pass-through to JournalTodayPanel:
  mainPhotoByDate,
  retryingLogId,
  setMainPhotoForDate,
  setMatchesDrawerFilter,
  setMatchesDrawerOpen,
  setSkinReadsCalendarOpen,
  setSkinReadsWeekOffset,
  skinReadsWeekOffset,
  setCompareSubTab,
  setWeeklyInsightLoading,
  setWeeklyInsights,
  weeklyInsightLoading}) => {
  // Local date formatter — `fmt` used to come from the parent IIFE scope when
  // this was inlined. Define it here so the extracted component is
  // self-contained. Format matches the original ("May 16, 2026").
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  // Effective view inside Extended mode: defaults to 'story' (long-form scroll with
  // search + filter chips) — was 'timeline' before, but Story is the canonical
  // chronological read for the journal. Timeline (calendar grid) and Procedures
  // remain available via the sub-toggle.
  const effectiveView = journalViewOverride || 'story';
  const compareEntries = selectedIds.map(id => logs.find(l => l.id === id)).filter(Boolean);
  const canCompare = compareEntries.length === 2;

  // === COMPARE VIEW ===
  if (effectiveView === 'compare' && canCompare) {
    const [a, b] = compareEntries;
    const earlier = new Date(a.date) < new Date(b.date) ? a : b;
    const later = earlier === a ? b : a;
    const days = Math.abs(Math.ceil((new Date(later.date) - new Date(earlier.date)) / (1000 * 60 * 60 * 24)));

    return (
      <div className="md:max-w-md md:mx-auto pb-6">
        <AccentLink onClick={() => setJournalViewOverride(null)} icon="ChevronLeft" iconAfter={null} tone="soft" className="mb-4">
          Back to Journal
        </AccentLink>
        <EditorialPageHeader
          eyebrow="Side by side"
          title="Two moments compared."
          body={`${days} ${days === 1 ? 'day' : 'days'} apart — see what's actually changing.`}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7">
          {[earlier, later].map((entry, i) => (
            <EditorialCard key={entry.id} pad="none" className="overflow-hidden">
              <Eyebrow className="px-5 pt-5 mb-2.5">{i === 0 ? 'Before' : 'After'}</Eyebrow>
              {/* Tap photo → opens the same SkinReadDrawer as the Journal flow,
                  so the user can read the per-photo analysis from Compare too. */}
              <button
                type="button"
                onClick={() => setSkinReadDrawerLogId(entry.id)}
                className="relative w-full block focus:outline-none transition hover:opacity-95"
                aria-label={`Open analysis for ${new Date(entry.date).toLocaleDateString()}`}
              >
                <Photo item={entry} alt="" className="w-full h-64 object-cover"
                  renderFallback={() => (
                    <div className="w-full h-64 flex items-center justify-center text-7xl font-sans" style={{background:'var(--cream)', color:'var(--ink-soft)'}}>{aiScoreOut10(entry) || entry.rating}</div>
                  )}
                />
                <span
                  className="absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase flex items-center gap-1.5"
                  style={{background:'rgba(250,250,246,0.92)', color:'var(--ink)', backdropFilter:'blur(4px)'}}
                >
                  <Icon name="Sparkles" size={10} style={{color:'var(--accent)'}} /> Tap for analysis
                </span>
              </button>
              <div className="px-5 py-4">
                <h3 className="font-sans text-[20px] leading-[1.15]" style={{color:'var(--ink)'}}>
                  {new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <div className="text-[10px] tracking-[0.2em] uppercase mt-1.5" style={{color:'var(--ink-soft)'}}>
                  {(entry.area || 'full-face').replace(/-/g, ' ')}
                  {aiScoreOut10(entry) ? <> · <span style={{color:'var(--accent)'}}>✦</span> {aiScoreOut10(entry)}/10</> : (entry.rating != null ? ` · ${entry.rating}/10` : '')}
                </div>
                {entry.concerns?.length > 0 && <div className="text-[11px] mt-2 leading-relaxed" style={{color:'var(--ink-soft)'}}>{entry.concerns.join(' · ')}</div>}
                {entry.notes && <p className="text-[12px] mt-2 leading-relaxed" style={{color:'var(--ink)'}}>"{entry.notes}"</p>}
              </div>
            </EditorialCard>
          ))}
        </div>

        <EditorialCard eyebrow="Progress notes" title="The arithmetic of change.">
          <div className="grid grid-cols-3 gap-4 text-center mt-2">
            <div>
              <Eyebrow className="mb-1">Rating</Eyebrow>
              <div className="font-sans text-[28px] md:text-[32px] leading-none" style={{color: later.rating > earlier.rating ? 'var(--accent-blue)' : later.rating < earlier.rating ? 'var(--rose)' : 'var(--ink)'}}>
                {later.rating > earlier.rating ? '+' : ''}{later.rating - earlier.rating}
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1">Days apart</Eyebrow>
              <div className="font-sans text-[28px] md:text-[32px] leading-none" style={{color:'var(--ink)'}}>{days}</div>
            </div>
            <div>
              <Eyebrow className="mb-1">Trend</Eyebrow>
              <div className="font-sans text-[28px] md:text-[32px] leading-none" style={{color: later.rating > earlier.rating ? 'var(--accent-blue)' : later.rating < earlier.rating ? 'var(--rose)' : 'var(--ink-soft)'}}>
                {later.rating > earlier.rating ? '↑' : later.rating < earlier.rating ? '↓' : '→'}
              </div>
            </div>
          </div>
        </EditorialCard>
        <CompareAnalysis a={earlier} b={later} products={products} procedures={procedures} callClaude={callClaude} setShowApiKeyModal={setShowApiKeyModal} onOpenLesson={setOpenLesson} />
      </div>
    );
  }

  // === GRID OR TIMELINE VIEW ===
  // The whole Skin Read tab uses a phone-width wrapper (md:max-w-md)
  // to keep Today / Library / Signals feeling like the mobile app on
  // a desktop browser. The Timeline tab is the exception — it has a
  // proper right rail (calendar + week summary) that needs room, so
  // we widen the wrapper to lg:max-w-4xl whenever Timeline is active.
  // Mobile (<md) is still 100% width either way, which is the design.
  const isTimelineTab = journalMode === 'timeline' || journalMode === 'extended';
  return (
    <div className={`md:max-w-[430px] md:mx-auto pb-6 ${isTimelineTab ? 'lg:!max-w-4xl' : ''}`}>
      {/* === EDITORIAL HEADER ===
          Matches the new mockup: small "Journal" eyebrow + serif
          display "Your skin story. Captured daily." + body line. */}
      {/* Slim header — was 3 lines (eyebrow + title + body) which
          ate the top half of the viewport. Now just the eyebrow +
          title; "Over time. With intelligence." body line dropped
          to bring the photo + score block higher on first paint. */}
      <EditorialPageHeader
        eyebrow="Journal"
        title="Understand your skin."
      />

      {/* Sunday Digest lives at the bottom of Journal — see the
          relocated block further down. (~160 lines of `{false && (() => {...})()}`
          dead code removed May 2026 audit pass.) */}

      {/* === SKIN READ — 4 SUB-TABS ===
          today    = hero analysis card (today's photo, dual scores, metrics, what changed, top matches)
          timeline = chronological story (Skin Reads + Products Started + Procedures + Lifestyle filter chips)
          signals  = real-data patterns (no fabricated correlations) + locked tiles for missing streams
          library  = month-grouped editorial photo gallery (long-press to compare)
          Old IDs (skinReads / procedures / select / compact / extended) are mapped here so
          deep links and saved state still resolve — no orphan tab errors. */}
      {logs.length > 0 && (
        <div className="mb-4">
          <EditorialSubTabs
            tabs={[
              { id: 'today', label: 'Today' },
              { id: 'timeline', label: 'Timeline' },
              { id: 'signals', label: 'Signals' },
              { id: 'library', label: 'Library' },
            ]}
            value={(() => {
              // Map legacy → new tab IDs.
              if (journalMode === 'skinReads' || journalMode === 'compact') return 'today';
              if (journalMode === 'extended') return 'timeline';
              if (journalMode === 'procedures') return 'timeline';   // Procedures is now a Timeline filter
              if (journalMode === 'select') return 'library';        // Select mode lives inside Library
              return ['today','timeline','signals','library'].includes(journalMode) ? journalMode : 'today';
            })()}
            onChange={(id) => {
              setJournalMode(id);
              // Side-effects per new tab:
              // - Library: enable select mode (was the old 'select' tab)
              // - Timeline: clear any procedures override so the full feed shows
              if (id === 'library') {
                // Library defaults to browse mode; long-press will trigger select
              } else if (selectMode) {
                setSelectMode(false); setSelectedIds([]);
              }
              if (journalViewOverride === 'procedures') setJournalViewOverride(null);
            }}
          />
        </div>
      )}

      {/* === TODAY TAB ===
          The flagship analysis view: today's photo as the hero with
          whole-card tap to open the full Skin Read drawer, dual scoring
          ( serif AI 8.2 / 10 with descriptor + a separate self-rating
          chip), 5-metric grid, what-changed delta, and the swipeable
          week strip below. Old 'skinReads' / 'compact' state still
          lands here so existing users don't see an empty tab. */}
      {logs.length > 0 && (journalMode === 'today' || journalMode === 'skinReads' || journalMode === 'compact' || !journalMode) && (

        <JournalTodayPanel
          logs={logs}
          products={products}
          regimenLogs={regimenLogs}
          retryLogAnalysis={retryLogAnalysis}
          setShowApiKeyModal={setShowApiKeyModal}
          setShowLogModal={setShowLogModal}
          setShowHomeUploadPicker={setShowHomeUploadPicker}
          setShowCheckInChooser={setShowCheckInChooser}
          setShowPhotoImportQueue={setShowPhotoImportQueue}
          mainPhotoByDate={mainPhotoByDate}
          retryingLogId={retryingLogId}
          setMainPhotoForDate={setMainPhotoForDate}
          setMatchesDrawerFilter={setMatchesDrawerFilter}
          setMatchesDrawerOpen={setMatchesDrawerOpen}
          setOpenLesson={setOpenLesson}
          setSkinReadDrawerLogId={setSkinReadDrawerLogId}
          setSkinReadsCalendarOpen={setSkinReadsCalendarOpen}
          setSkinReadsWeekOffset={setSkinReadsWeekOffset}
          skinReadsWeekOffset={skinReadsWeekOffset}
        />
      )}

      {/* === TIMELINE MODE === editorial cards per entry, per the latest spec.
          - Hero search bar across notes / tags / products / concerns
          - Filter chips: All / Photos / Procedures / New products
          - Weekly recap card pinned at top (current week stats + AI insight)
          - Editorial cards per entry with: date headline, photo, short
            reflection text, mini tag chips, optional Frida Note (AI prose)
          - Photo calendar at the bottom for jump-to-date
          Select-mode aware: when active, tapping a card toggles selection. */}
      {/* JournalCompactPanel deleted 2026-05-31: dual-render bug for legacy
          'compact' state — JournalTodayPanel (line 236) already tolerates
          journalMode === 'compact', so removing this branch fixes the
          stacking and removes a redundant surface per the audit. */}

      {logs.length === 0 ? (
        <EmptyState icon="Calendar" text="Your journal awaits its first entry." action={() => setShowCheckInChooser(true)} actionText="Add Photo" />
      ) : (journalMode === 'extended' || journalMode === 'timeline') ? (
        <>
          {/* === LEGACY TOOLBAR REMOVED ===
              The Story/Timeline/Procedures view toggle and Select
              button were duplicating the new 5-pill filter row inside
              the compact timeline below — and on desktop they were
              causing the cramped overlap Jenni flagged. The compact
              timeline handles all entry types via its own filter
              pills; long-press → Compare lives in Library now. */}

          {/* Selection status bar */}
          {selectMode && (
            <div className="mb-6 p-4 border flex justify-between items-center gap-4 flex-wrap" style={{background:'var(--cream-deep)', borderColor:'var(--ink)'}}>
              <div className="text-sm font-light" style={{color:'var(--ink)'}}>
                {selectedIds.length === 0 && 'Tap any two entries to compare them.'}
                {selectedIds.length === 1 && 'One selected — pick one more.'}
                {selectedIds.length === 2 && 'Two selected — ready when you are.'}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    if (!canCompare) return;
                    // Open the floating chat with both photos as compare context.
                    const [a, b] = compareEntries;
                    const earlier = new Date(a.date) < new Date(b.date) ? a : b;
                    const later = earlier === a ? b : a;
                    const days = Math.abs(Math.ceil((new Date(later.date) - new Date(earlier.date)) / 86400000));
                    openChat({
                      context: `Comparing two journal entries — ${days} days apart.\n\nEarlier (${earlier.date}, ${earlier.area || 'full-face'}, rated ${earlier.rating}/10): ${(earlier.concerns || []).join(', ') || 'no concerns logged'}.${earlier.notes ? ' Notes: ' + earlier.notes : ''}\n\nLater (${later.date}, ${later.area || 'full-face'}, rated ${later.rating}/10): ${(later.concerns || []).join(', ') || 'no concerns logged'}.${later.notes ? ' Notes: ' + later.notes : ''}`,
                      title: `Compare · ${days}d`,
                      subtitle: `${earlier.date} → ${later.date}`,
                      compareEntries: [earlier, later],
                      suggestions: [
                        "What's visibly different?",
                        'What shifted between these two?',
                        'Should I keep doing what I changed?',
                        'Anything here worth watching?',
                      ]});
                    exitSelectMode();
                  }}
                  disabled={!canCompare}
                  className="text-[10px] tracking-[0.2em] uppercase px-3 py-2 disabled:opacity-30 transition flex items-center gap-1.5 border"
                  style={{borderColor:'var(--ink)', color:'var(--ink)'}}
                  title="Discuss the comparison in chat"
                >
                  <Icon name="MessageCircle" size={11} /> Discuss
                </button>
                <button onClick={() => setJournalViewOverride('compare')} disabled={!canCompare} className="text-[10px] tracking-[0.2em] uppercase px-3 py-2 disabled:opacity-30 transition flex items-center gap-1.5" style={{background:'var(--ink)', color:'var(--cream)'}}>
                  Compare these <Icon name="ArrowRight" size={11} />
                </button>
              </div>
            </div>
          )}

          {/* === COMPACT TIMELINE ===
           * Editorial spine + small terracotta nodes.
           * Each entry = one ~90-120px tall row.
           * 5 filter pills (All / Skin Reads / Products / Procedures / Notes)
           * Frida observations injected every 6 entries.
           * Load more pagination — initial 30, +30 per click.
           * Right rail on ≥lg: mini calendar + week summary.
           * Mobile: pinned week summary at top.
           */}
          {effectiveView === 'story' && (() => {
            const hasPhoto = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
            const q = storySearch.trim().toLowerCase();
            const tokens = q.split(/\s+/).filter(Boolean);
            const matchesQ = (haystack) => {
              if (tokens.length === 0) return true;
              const text = String(haystack).toLowerCase();
              return tokens.every(t => text.includes(t));
            };
            // Build the unified feed. New: 'note' kind for lifestyle
            // notes — a regimenLogs entry that has notes text but no
            // photo/products counts as a Note.
            const items = [];
            if (storyFilter === 'all' || storyFilter === 'photos' || storyFilter === 'skinReads') {
              logs.forEach(l => {
                const productNames = (l.usedProducts || [])
                  .map(id => products.find(p => p.id === id)?.name)
                  .filter(Boolean).join(' ');
                const haystack = [l.notes, l.aiAnalysis, l.ratingExplanation, (l.concerns || []).join(' '), (l.usedTags || []).join(' '), productNames, l.area].join(' ');
                if (matchesQ(haystack)) items.push({ kind: 'log', date: l.date, id: l.id, sortKey: `${l.date}-${String(l.id).padStart(15, '0')}`, payload: l });
              });
            }
            if (storyFilter === 'all' || storyFilter === 'procedures') {
              (procedures || []).forEach(p => {
                const haystack = [p.name, p.type, p.notes, p.results, p.aiAnalysis].join(' ');
                if (matchesQ(haystack)) items.push({ kind: 'procedure', date: p.date, id: `proc-${p.id}`, sortKey: `${p.date}-proc-${p.id}`, payload: p });
              });
            }
            if (storyFilter === 'all' || storyFilter === 'newproducts' || storyFilter === 'products') {
              (products || []).forEach(p => {
                if (!p.startDate) return;
                const haystack = [p.name, p.brand, p.activeIngredients, (p.tags || []).join(' ')].join(' ');
                if (matchesQ(haystack)) items.push({ kind: 'product-start', date: p.startDate, id: `prod-${p.id}`, sortKey: `${p.startDate}-prod-${p.id}`, payload: p });
              });
            }
            if (storyFilter === 'all' || storyFilter === 'notes') {
              (regimenLogs || []).forEach(r => {
                // Only surface as a note if it has actual text content
                // (avoids cluttering the feed with empty check-ins).
                const noteTxt = (r.notes || '').trim();
                if (!noteTxt) return;
                if (matchesQ(noteTxt)) items.push({ kind: 'note', date: r.date, id: `note-${r.id}`, sortKey: `${r.date}-note-${r.id}`, payload: r });
              });
            }
            items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

            // Inject Frida observation cards every 6 entries when the
            // surrounding data has enough deltas to derive one.
            // We compute a simple month-over-month signal across the
            // photo logs nearest to each insertion point.
            const itemsWithObservations = (() => {
              if (items.length < 6) return items;
              const out = [];
              let count = 0;
              items.forEach((item, i) => {
                out.push(item);
                count++;
                if (count >= 6 && i < items.length - 1) {
                  // Find the nearest photo log going forward + back
                  // to compute a simple weekly trend phrase.
                  const nearbyLogs = items.slice(i + 1, i + 8).filter(it => it.kind === 'log').map(it => it.payload);
                  if (nearbyLogs.length >= 2) {
                    const ratings = nearbyLogs.map(l => l.rating).filter(r => r != null);
                    const phrase = ratings.length >= 2
                      ? (ratings[0] > ratings[ratings.length - 1] + 0.5 ? 'Skin reads steadier this week — fewer concerns flagged.'
                        : ratings[0] < ratings[ratings.length - 1] - 0.5 ? 'Last week ran tender — worth slowing actives.'
                        : 'Steady week — barrier holding.')
                      : null;
                    if (phrase) out.push({ kind: 'observation', date: item.date, id: `obs-${i}`, sortKey: `${item.date}-obs-${i}`, payload: { text: phrase } });
                  }
                  count = 0;
                }
              });
              return out;
            })();

            const visibleItems = itemsWithObservations.slice(0, timelineLimit);
            const hasMore = itemsWithObservations.length > timelineLimit;

            // Date label format — compact "MAY 4 / Today" stack used
            // in the gutter beside the spine.
            const fmtDateGutter = (iso) => {
              const d = new Date(iso + 'T00:00:00');
              const today = new Date(); today.setHours(0,0,0,0);
              const days = Math.floor((today - d) / 86400000);
              const main = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
              let sub = '';
              if (days === 0) sub = 'Today';
              else if (days === 1) sub = 'Yesterday';
              else if (days < 7) sub = `${days}d ago`;
              else if (days < 30) sub = `${Math.floor(days / 7)}w ago`;
              else sub = d.getFullYear() === today.getFullYear() ? '' : String(d.getFullYear());
              return { main, sub };
            };

            // Compact week summary for the right rail / pinned card
            const todayKL = localDateISO();
            const weekStartK = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return localDateISO(d); })();
            const weekLogs = logs.filter(l => l.date >= weekStartK && l.date <= todayKL);
            const weekRated = weekLogs.filter(l => l.rating != null);
            const weekAvg = weekRated.length ? (weekRated.reduce((s, l) => s + Number(l.rating), 0) / weekRated.length) : null;
            const weekConcerns = {};
            weekLogs.forEach(l => (l.concerns || []).forEach(c => { weekConcerns[c] = (weekConcerns[c] || 0) + 1; }));
            const weekTopConcern = Object.entries(weekConcerns).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
            const weekRangeFmt = (() => {
              const start = new Date(); start.setDate(start.getDate() - 6);
              const end = new Date();
              return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            })();

            // Shorter labels to fit 5 pills on a 380px mobile row.
            // "Skin Reads" → "Reads", "Procedures" → "Procs". Keeps
            // the filter row to a single horizontal scroll on phone.
            const FILTER_PILLS = [
              { id: 'all',        label: 'All' },
              { id: 'skinReads',  label: 'Reads' },
              { id: 'products',   label: 'Products' },
              { id: 'procedures', label: 'Procs' },
              { id: 'notes',      label: 'Notes' },
            ];

            // Group items by ISO date for compact view rendering.
            // Each day = one horizontal scrollable row.
            const itemsByDay = (() => {
              const grouped = {};
              visibleItems.forEach(item => {
                if (item.kind === 'observation') return; // observations skip grouping in compact
                (grouped[item.date] = grouped[item.date] || []).push(item);
              });
              return Object.entries(grouped)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, items]) => ({ date, items }));
            })();

            return (
              <div className="lg:flex lg:gap-6 lg:items-start">
                {/* === LEFT COLUMN: filter pills + timeline === */}
                <div className="flex-1 min-w-0">
                  {/* Filter pills — single horizontal scroll on mobile.
                      No-wrap, overflow-x-auto so all 5 fit. "+ Add entry"
                      moved out (lives in the page header now). */}
                  <div className="mb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {FILTER_PILLS.map(f => {
                      const active = storyFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => { setStoryFilter(f.id); setTimelineLimit(30); }}
                          className="px-2.5 py-1 rounded-full text-[9.5px] tracking-[0.16em] uppercase transition flex-shrink-0 whitespace-nowrap"
                          style={{
                            background: active ? 'var(--ink)' : 'var(--cream-deep)',
                            color: active ? 'var(--cream)' : 'var(--ink-soft)',
                            border: '1px solid ' + (active ? 'var(--ink)' : 'var(--line)')}}
                        >{f.label}</button>
                      );
                    })}
                  </div>

                  {/* Compact / Extended toggle — small ghost segmented
                      control on the right side, sits below the filter
                      pills so the filter row gets its own clean line. */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-[9.5px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>
                      {timelineViewMode === 'compact' ? 'Day at a glance' : 'Every entry'}
                    </div>
                    <div className="inline-flex rounded-full overflow-hidden" style={{border: '1px solid var(--line)'}}>
                      {[
                        { id: 'compact',  label: 'Compact' },
                        { id: 'extended', label: 'Extended' },
                      ].map(v => {
                        const active = timelineViewMode === v.id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => setTimelineViewMode(v.id)}
                            className="px-2.5 py-1 text-[9px] tracking-[0.18em] uppercase transition"
                            style={{
                              background: active ? 'var(--ink)' : 'transparent',
                              color: active ? 'var(--cream)' : 'var(--ink-soft)'}}
                          >{v.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mobile-only pinned week summary card */}
                  <div className="lg:hidden mb-4 rounded-[14px] px-4 py-3 flex items-center gap-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Week summary</div>
                      <div className="font-sans text-[12px] mt-0.5" style={{color:'var(--ink)'}}>{weekRangeFmt}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>Reads</div>
                      <div className="font-sans text-[16px] leading-none" style={{color:'var(--ink)'}}>{weekRated.length}</div>
                    </div>
                    {weekAvg != null && (
                      <div className="text-right">
                        <div className="text-[10px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>Avg</div>
                        <div className="font-sans text-[16px] leading-none" style={{color:'var(--accent)'}}>{weekAvg.toFixed(1)}</div>
                      </div>
                    )}
                  </div>

                  {visibleItems.length === 0 ? (
                    <p className="font-sans text-[14px] py-12 text-center" style={{color:'var(--ink-soft)'}}>
                      {q || storyFilter !== 'all' ? 'Nothing matches. Try less.' : 'Story starts with the first photo.'}
                    </p>
                  ) : timelineViewMode === 'compact' ? (
                    // === COMPACT VIEW (matches Extended row height) ===
                    // Each day card uses the SAME outer styling as an
                    // Extended event row (rounded-[14px] p-3, cream bg,
                    // line border). Inside: a horizontal scrollable
                    // strip of 64×64 chips (same dimensions as the
                    // photo thumb in an Extended Skin Read row). Net
                    // effect: toggling between Compact and Extended
                    // changes density without changing row height —
                    // visually seamless.
                    <div className="relative" style={{paddingLeft:'74px'}}>
                      <div className="absolute left-[68px] top-2 bottom-2 w-px" style={{background:'var(--line)'}} />
                      <div className="space-y-2">
                        {itemsByDay.map(({ date, items }) => {
                          const gutter = fmtDateGutter(date);
                          const hasRead = items.some(it => it.kind === 'log');
                          const nodeColor = hasRead ? 'var(--accent)' : 'var(--ink-soft)';
                          return (
                            <div key={date} className="relative">
                              {/* Date gutter — matches extended */}
                              <div className="absolute -left-[74px] top-2 w-[60px] text-right">
                                <div className="text-[9px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>{gutter.main}</div>
                                {gutter.sub && <div className="text-[9px]" style={{color:'var(--ink-soft)'}}>{gutter.sub}</div>}
                              </div>
                              {/* Node — matches extended */}
                              <div className="absolute -left-[10px] top-3 w-2.5 h-2.5 rounded-full" style={{background: nodeColor, border:'2px solid var(--cream)'}} />
                              {/* Day card — same outer style as an Extended row */}
                              <div className="rounded-[14px] p-3 flex items-center gap-2" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
                                  {items.map(item => {
                                    if (item.kind === 'log') {
                                      const l = item.payload;
                                      const hasPhotoNow = l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
                                      return (
                                        <button
                                          key={item.id}
                                          onClick={() => setSkinReadDrawerLogId(l.id)}
                                          className="flex-shrink-0 w-16 h-16 rounded-[10px] overflow-hidden transition hover:opacity-90 relative"
                                          style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}
                                          title={`Skin Read · ${(l.area || 'full-face').replace(/-/g, ' ')}${l.rating != null ? ' · ' + l.rating + '/10' : ''}`}
                                        >
                                          {hasPhotoNow ? (
                                            <Photo item={l} alt="" className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center font-sans text-[16px]" style={{color:'var(--ink-soft)'}}>{l.rating ?? '·'}</div>
                                          )}
                                          {l.rating != null && (
                                            <div className="absolute bottom-0 inset-x-0 text-center font-sans text-[10px] leading-tight py-0.5" style={{background:'rgba(245,240,232,0.85)', color:'var(--ink)'}}>{Number(l.rating).toFixed(1)}</div>
                                          )}
                                        </button>
                                      );
                                    }
                                    if (item.kind === 'product-start') {
                                      const p = item.payload;
                                      return (
                                        <div key={item.id} className="flex-shrink-0 w-16 h-16 rounded-[10px] flex flex-col items-center justify-center px-1" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}} title={`Product · ${p.name}`}>
                                          <Icon name="Package" size={16} style={{color:'var(--accent)'}} />
                                          <div className="text-[8px] tracking-[0.05em] mt-1 text-center line-clamp-2 leading-tight" style={{color:'var(--ink-soft)'}}>{(p.brand || p.name || '').slice(0, 12)}</div>
                                        </div>
                                      );
                                    }
                                    if (item.kind === 'procedure') {
                                      const p = item.payload;
                                      return (
                                        <div key={item.id} className="flex-shrink-0 w-16 h-16 rounded-[10px] flex flex-col items-center justify-center px-1" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}} title={`Procedure · ${p.name}`}>
                                          <Icon name="Activity" size={16} style={{color:'var(--accent)'}} />
                                          <div className="text-[8px] tracking-[0.05em] mt-1 text-center line-clamp-2 leading-tight" style={{color:'var(--ink-soft)'}}>{(p.name || '').slice(0, 12)}</div>
                                        </div>
                                      );
                                    }
                                    if (item.kind === 'note') {
                                      const r = item.payload;
                                      return (
                                        <div key={item.id} className="flex-shrink-0 w-16 h-16 rounded-[10px] flex flex-col items-center justify-center px-1.5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}} title={r.notes}>
                                          <Icon name="FileText" size={14} style={{color:'var(--ink-soft)'}} />
                                          <div className="text-[8px] mt-1 text-center line-clamp-2 leading-tight" style={{color:'var(--ink-soft)'}}>{(r.notes || 'note').slice(0, 18)}</div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                                {/* Right meta — count + scroll affordance */}
                                <div className="flex-shrink-0 flex flex-col items-end justify-between h-16 pl-1">
                                  <div className="text-[8.5px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>{items.length}</div>
                                  {items.length > 4 && <Icon name="ChevronRight" size={10} style={{color:'var(--ink-soft)'}} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {hasMore && (
                        <div className="text-center mt-6">
                          <button
                            onClick={() => setTimelineLimit(n => n + 30)}
                            className="text-[10.5px] tracking-[0.22em] uppercase flex items-center gap-1.5 mx-auto px-4 py-2"
                            style={{color:'var(--ink-soft)'}}
                          >
                            Load more <Icon name="ChevronDown" size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative" style={{paddingLeft:'74px'}}>
                      {/* The spine — 1px terracotta hairline anchored to a fixed
                          left offset so date gutter sits to its left and rows to
                          its right. */}
                      <div className="absolute left-[68px] top-2 bottom-2 w-px" style={{background:'var(--line)'}} />

                      <div className="space-y-2">
                        {visibleItems.map((item, idx) => {
                          const gutter = fmtDateGutter(item.date);
                          // Render the row + the absolutely-positioned date gutter + node.
                          const rowWrap = (children, opts = {}) => (
                            <div key={item.id} className="relative">
                              {/* Date gutter — absolute, sits left of spine */}
                              <div className="absolute -left-[74px] top-2 w-[60px] text-right">
                                <div className="text-[9px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>{gutter.main}</div>
                                {gutter.sub && <div className="text-[9px]" style={{color:'var(--ink-soft)'}}>{gutter.sub}</div>}
                              </div>
                              {/* Node — small terracotta dot on the spine */}
                              <div className="absolute -left-[10px] top-3 w-2.5 h-2.5 rounded-full" style={{background: opts.nodeColor || 'var(--accent)', border:'2px solid var(--cream)'}} />
                              {children}
                            </div>
                          );

                          // === SKIN READ ROW ===
                          if (item.kind === 'log') {
                            const l = item.payload;
                            // Primary score is now the AI-derived score (averaged across all 6
                            // metric axes). User self-rating is shown as a quiet "you read: X.X"
                            // beneath the AI line so the comparison is visible without competing.
                            const aiScore = aiScoreOut10(l);              // string "8.4" or null
                            const userScore = l.rating != null ? Number(l.rating).toFixed(1) : null;
                            const primaryScore = aiScore || userScore;     // fallback if no snapshot yet
                            const isAiPrimary = !!aiScore;
                            const numericPrimary = aiScore ? parseFloat(aiScore) : (l.rating != null ? Number(l.rating) : null);
                            // Pull descriptors from snapshot if available
                            const subDescriptors = l.metricSnapshot ? [
                              /clear|low/i.test(l.metricSnapshot.redness) && 'Calm',
                              /plump|good/i.test(l.metricSnapshot.hydration) && 'Hydrated',
                              /smooth|even/i.test(l.metricSnapshot.texture) && 'Smooth',
                            ].filter(Boolean) : [];
                            const note = (l.notes || l.ratingExplanation || '').trim().slice(0, 90);
                            const displayBalance = numericPrimary != null
                              ? (numericPrimary >= 8 ? 'Balanced' : numericPrimary >= 6 ? 'Steady' : numericPrimary >= 4 ? 'Tender' : 'Reactive')
                              : null;
                            return rowWrap(
                              <button
                                type="button"
                                onClick={() => setSkinReadDrawerLogId(l.id)}
                                className="w-full text-left rounded-[14px] p-3 flex items-center gap-3 transition hover:opacity-95"
                                style={{background:'var(--cream)', border: '1px solid var(--line)'}}
                              >
                                {hasPhoto(l) ? (
                                  <div className="w-16 h-16 rounded-[10px] overflow-hidden flex-shrink-0" style={{background:'var(--cream-deep)'}}>
                                    <Photo item={l} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                                    <span className="font-sans text-[18px]">{primaryScore ?? '·'}</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[9px] tracking-[0.22em] uppercase flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                                    Skin Read{isAiPrimary && <span style={{color:'var(--accent)', fontSize:'9px'}} title="AI-derived score">✦</span>}
                                  </div>
                                  <div className="flex items-baseline gap-2 mt-0.5">
                                    {primaryScore != null && (
                                      <span className="font-sans text-[18px] leading-none" style={{color:'var(--ink)'}}>{primaryScore}<span className="text-[10px]" style={{color:'var(--ink-soft)'}}> /10</span></span>
                                    )}
                                    {displayBalance && (
                                      <span className="font-sans text-[12px]" style={{color:'var(--accent)'}}>{displayBalance}</span>
                                    )}
                                    {/* Show user self-rating as quiet companion when both exist and they differ */}
                                    {isAiPrimary && userScore && userScore !== aiScore && (
                                      <span className="text-[9.5px]" style={{color:'var(--ink-soft)', opacity:0.7}}>you: {userScore}</span>
                                    )}
                                  </div>
                                  {subDescriptors.length > 0 && (
                                    <div className="text-[10.5px] mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>{subDescriptors.join(' · ')}</div>
                                  )}
                                  {note && (
                                    <div className="text-[10.5px] mt-0.5 truncate" style={{color:'var(--ink)'}}>{note}</div>
                                  )}
                                </div>
                                <span className="text-[9.5px] tracking-[0.22em] uppercase flex items-center gap-0.5 flex-shrink-0" style={{color:'var(--accent)'}}>
                                  View <Icon name="ChevronRight" size={10} />
                                </span>
                              </button>
                            );
                          }

                          // === PRODUCT ROW ===
                          if (item.kind === 'product-start') {
                            const p = item.payload;
                            const why = p.activeIngredients ? p.activeIngredients.split(',').slice(0, 2).map(s => s.trim()).join(' · ') : (p.tags || []).slice(0, 2).join(' · ');
                            const slot = (p.useTimes || []).map(t => t.toUpperCase()).join('+');
                            return rowWrap(
                              <div className="rounded-[14px] p-3 flex items-center gap-3" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                                {(p.photo || p.photoPath) ? (
                                  <div className="w-12 h-14 rounded-[8px] overflow-hidden flex-shrink-0 flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                                    <Photo item={p} alt={p.name} className="h-full w-auto max-w-full object-contain" />
                                  </div>
                                ) : (
                                  <div className="w-12 h-14 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                                    <Icon name="Package" size={14} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Product Added</div>
                                  {p.brand && <div className="text-[10px] tracking-[0.05em] uppercase mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>{p.brand}</div>}
                                  <div className="font-sans text-[13px] leading-tight mt-0.5 truncate" style={{color:'var(--ink)'}}>{p.name}</div>
                                  {(slot || why) && (
                                    <div className="text-[10px] mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>
                                      {slot && <span style={{color:'var(--accent)'}}>{slot} routine</span>}{slot && why ? ' · ' : ''}{why}
                                    </div>
                                  )}
                                </div>
                              </div>,
                              { nodeColor: 'var(--ink-soft)' }
                            );
                          }

                          // === PROCEDURE ROW ===
                          if (item.kind === 'procedure') {
                            const p = item.payload;
                            return rowWrap(
                              <div className="rounded-[14px] p-3 flex items-center gap-3" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--accent-soft, #FCE8EE)', color:'var(--accent)'}}>
                                  <Icon name="Activity" size={15} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Procedure</div>
                                  <div className="font-sans text-[13px] leading-tight mt-0.5 truncate" style={{color:'var(--ink)'}}>{p.name}</div>
                                  {(p.results || p.notes) && (
                                    <div className="text-[10.5px] mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>{(p.results || p.notes).slice(0, 80)}</div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // === NOTE (lifestyle) ROW ===
                          if (item.kind === 'note') {
                            const r = item.payload;
                            return rowWrap(
                              <div className="rounded-[14px] p-3 flex items-center gap-3" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                                  <Icon name="FileText" size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Note</div>
                                  <div className="font-sans text-[12.5px] leading-snug mt-0.5 line-clamp-2" style={{color:'var(--ink)'}}>{r.notes}</div>
                                </div>
                              </div>,
                              { nodeColor: 'var(--ink-soft)' }
                            );
                          }

                          // === FRIDA OBSERVATION (injected every 6) ===
                          if (item.kind === 'observation') {
                            return rowWrap(
                              <div className="rounded-[14px] p-3 flex items-start gap-2.5" style={{background:'var(--cream-deep)', border:'1px solid var(--accent)'}}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--accent)', color:'var(--cream)'}}>
                                  <Icon name="Sparkles" size={11} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--accent)'}}>Frida Note</div>
                                  <div className="font-sans text-[12.5px] leading-snug mt-0.5" style={{color:'var(--ink)'}}>{item.payload.text}</div>
                                </div>
                              </div>,
                              { nodeColor: 'var(--accent)' }
                            );
                          }
                          return null;
                        })}
                      </div>

                      {hasMore && (
                        <div className="text-center mt-6">
                          <button
                            onClick={() => setTimelineLimit(n => n + 30)}
                            className="text-[10.5px] tracking-[0.22em] uppercase flex items-center gap-1.5 mx-auto px-4 py-2"
                            style={{color:'var(--ink-soft)'}}
                          >
                            Load more <Icon name="ChevronDown" size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* === RIGHT RAIL (≥lg only): mini calendar + week summary === */}
                <aside className="hidden lg:block lg:w-[260px] lg:flex-shrink-0 space-y-3">
                  <div className="rounded-[14px] p-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                    <div className="text-[9.5px] tracking-[0.22em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                    <MiniMonthCalendar
                      logs={logs}
                      procedures={procedures}
                      showThumbs={false}
                      onDayClick={(log, dKey) => log && setSkinReadDrawerLogId(log.id)}
                    />
                  </div>
                  <div className="rounded-[14px] p-3.5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                    <div className="text-[9.5px] tracking-[0.22em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>Week summary</div>
                    <div className="font-sans text-[13px] mb-3" style={{color:'var(--ink)'}}>{weekRangeFmt}</div>
                    <div className="space-y-2 text-[11px]" style={{color:'var(--ink)'}}>
                      <div className="flex justify-between"><span style={{color:'var(--ink-soft)'}}>Reads completed</span><span className="font-sans">{weekRated.length}</span></div>
                      {weekAvg != null && (
                        <div className="flex justify-between"><span style={{color:'var(--ink-soft)'}}>Avg score</span><span className="font-sans"><span style={{color:'var(--accent)'}}>{weekAvg.toFixed(1)}</span> /10</span></div>
                      )}
                      {weekTopConcern && (
                        <div className="flex justify-between"><span style={{color:'var(--ink-soft)'}}>Top concern</span><span className="font-sans" style={{color:'var(--ink)'}}>{weekTopConcern.replace(/-/g, ' ')}</span></div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            );
          })()}
          {/* Legacy "story" fallback block retired May 2026 (audit pass) —
              ~110 lines of {false && (() => {...})()} dead code removed. */}

          {/* === TIMELINE VIEW (calendar grid alternative) === */}
          {effectiveView === 'timeline' && (
            <PhotoTimeline logs={logs} products={products} procedures={procedures} regimenLogs={regimenLogs} dailyCoverPick={dailyCoverPick} setActiveTab={setActiveTab} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelectId} onOpenLesson={setOpenLesson} deleteLog={deleteLog} enterCompare={enterCompare} fileToBase64={fileToBase64} onAddPriorPhoto={handleAddPriorPhoto} onEditLog={(id) => {
              const log = logs.find(l => l.id === id);
              if (openCheckInDetailsForLog && log) openCheckInDetailsForLog(log);
              else { setEditingLogId(id); setShowLogModal(true); }
            }} />
          )}

          {/* === COMPARE PRESETS VIEW === */}
          {effectiveView === 'compare' && !canCompare && (
            <ComparePresets logs={logs} products={products} procedures={procedures} regimenLogs={regimenLogs} callClaude={callClaude} setShowApiKeyModal={setShowApiKeyModal} onOpenLesson={setOpenLesson} enterCompare={enterCompare} onCompareProduct={setProductCompareId} />
          )}

          {/* === PROCEDURES SUB-TAB — full list with briefings === */}
          {effectiveView === 'procedures' && (
            <div>
              <div className="flex items-baseline justify-between mb-4 border-b pb-3" style={{borderColor: 'var(--line)'}}>
                <p className="text-sm font-light" style={{color:'var(--ink-soft)'}}>A timeline of your treatments — auto-surfaced on the calendar above.</p>
                <button onClick={() => setShowProcedureModal(true)} className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1" style={{color:'var(--accent)'}}>
                  <Icon name="Plus" size={11} /> Log procedure
                </button>
              </div>
              {logs.length >= 5 && <ProcedureRecommendations logs={logs} procedures={procedures} callClaude={callClaude} setShowApiKeyModal={setShowApiKeyModal} />}
              {procedures.length === 0 ? (
                <EmptyState icon="Activity" text="No procedures logged yet." action={() => setShowProcedureModal(true)} actionText="Log First" />
              ) : (
                <div className="relative pl-5 mt-6" style={{borderLeft:'1px solid var(--line)'}}>
                  {procedures.map(p => (
                    <ProcedureCard
                      key={p.id}
                      procedure={p}
                      logs={logs}
                      onOpenLesson={setOpenLesson}
                      onPhotoClick={() => setJournalViewOverride('timeline')}
                      onDelete={deleteProcedure}
                      onUpdate={updateProcedure}
                      onEdit={() => { setEditingProcedureId(p.id); setShowProcedureModal(true); }}
                      onOpenChat={(proc) => openChat({
                        context: `Briefing for ${proc.name} (${proc.type.replace(/-/g, ' ')}) on ${proc.date}:\n\n${proc.aiAnalysis}`,
                        title: proc.name,
                        subtitle: `${proc.type.replace(/-/g, ' ')} · ${new Date(proc.date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}`,
                        suggestions: [
                          'What should I avoid doing this week?',
                          'When should I schedule the next session?',
                          'What products will help my recovery?',
                          'Is this normal or a red flag?'
                        ]
                      })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════
          SIGNALS TAB — Real-data patterns only.
          Derived strictly from: photos, timeline entries, products,
          procedures, notes, and time. No fabricated correlations
          for sleep / cycle / weather / wearables — those render as
          locked tiles inviting the user to add a data source.
          ═══════════════════════════════════════════════════════════════ */}
      {logs.length > 0 && journalMode === 'signals' && (() => {
        // ───── DATA PREP ─────
        const photoLogs = logs.filter(l => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'))).sort((a, b) => new Date(b.date) - new Date(a.date));
        // Concern frequency — what does the user keep flagging?
        const concernCount = {};
        logs.forEach(l => (l.concerns || []).forEach(c => { concernCount[c] = (concernCount[c] || 0) + 1; }));
        const topConcerns = Object.entries(concernCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
        // Product responsiveness — for each product, look at average rating
        // of logs from the 14 days AFTER it was started vs the 14 days BEFORE.
        const productResponse = (products || []).filter(p => p.startDate).map(p => {
          const start = new Date(p.startDate);
          const before = logs.filter(l => {
            const d = new Date(l.date);
            return d < start && (start - d) <= 14 * 86400000 && l.rating != null;
          });
          const after = logs.filter(l => {
            const d = new Date(l.date);
            return d >= start && (d - start) <= 14 * 86400000 && l.rating != null;
          });
          if (before.length < 1 || after.length < 1) return null;
          const beforeAvg = before.reduce((s, l) => s + Number(l.rating), 0) / before.length;
          const afterAvg = after.reduce((s, l) => s + Number(l.rating), 0) / after.length;
          return { product: p, delta: afterAvg - beforeAvg, before: beforeAvg, after: afterAvg };
        }).filter(Boolean);
        const responders = [...productResponse].sort((a, b) => b.delta - a.delta).filter(r => r.delta > 0.4).slice(0, 3);
        const watchers = [...productResponse].sort((a, b) => a.delta - b.delta).filter(r => r.delta < -0.4).slice(0, 3);
        // Time-based stats: most-logged area, longest streak
        const areaCount = {};
        logs.forEach(l => { if (l.area) areaCount[l.area] = (areaCount[l.area] || 0) + 1; });
        const topArea = Object.entries(areaCount).sort((a, b) => b[1] - a[1])[0] || null;
        const dataPoints = logs.length;
        const photoCount = photoLogs.length;
        const procCount = (procedures || []).length;
        const productCount = (products || []).length;
        const enoughData = dataPoints >= 5;

        return (
          <div className="space-y-5 pb-6">
            {/* === EYEBROW + LEAD === */}
            <div>
              <div className="text-[10px] tracking-[0.32em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>From your data</div>
              <h2 className="font-sans text-[24px] leading-[1.1]" style={{color:'var(--ink)'}}>Patterns, quietly observed.</h2>
              <p className="text-[12px] mt-2 leading-relaxed" style={{color:'var(--ink-soft)'}}>
                Drawn only from what you've logged — {dataPoints} entr{dataPoints === 1 ? 'y' : 'ies'}, {photoCount} photo{photoCount === 1 ? '' : 's'}, {procCount} procedure{procCount === 1 ? '' : 's'}, {productCount} product{productCount === 1 ? '' : 's'}. Nothing inferred or invented.
              </p>
            </div>

            {/* === EMERGING PATTERNS — compact (May 30 v3 per Jenni) ===
                Each concern is a one-line row with title + count.
                No expand needed — count + label is the signal. */}
            <EditorialCard pad="normal">
              {/* === SECTION TITLE — bigger + accent (May 30 v4 per Jenni) === */}
              <div className="mb-3 text-[14px] tracking-[0.18em] uppercase" style={{color:'var(--accent)', fontWeight:700}}>Emerging patterns</div>
              {!enoughData ? (
                <p className="text-[13px]" style={{color:'var(--ink-soft)'}}>
                  A few more readings and patterns will surface. ({5 - dataPoints} more to go.)
                </p>
              ) : topConcerns.length === 0 ? (
                <p className="text-[13px]" style={{color:'var(--ink-soft)'}}>No recurring concerns yet — steady.</p>
              ) : (
                <div className="space-y-2">
                  {topConcerns.map(([concern, n]) => (
                    <div key={concern} className="flex items-baseline gap-2 text-[14px]" style={{color:'var(--ink)'}}>
                      <span className="capitalize" style={{fontWeight:700}}>{concern.replace(/-/g, ' ')}</span>
                      <span style={{color:'var(--ink-soft)'}}>·</span>
                      <span style={{color:'var(--ink-soft)'}}>{n} reading{n === 1 ? '' : 's'}</span>
                    </div>
                  ))}
                </div>
              )}
            </EditorialCard>

            {/* === MOST RESPONSIVE — compact, bigger title === */}
            <EditorialCard pad="normal">
              <div className="mb-3 text-[14px] tracking-[0.18em] uppercase" style={{color:'var(--accent-blue,#86CAE7)', fontWeight:700}}>Most responsive</div>
              {responders.length === 0 ? (
                <p className="text-[13px]" style={{color:'var(--ink-soft)'}}>
                  {(productResponse.length === 0)
                    ? 'Add start dates to your products and we can show which are working.'
                    : 'Nothing has moved the needle convincingly yet — keep logging.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {responders.map((r) => (
                    <div key={r.product.id} className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="truncate" style={{color:'var(--ink)', fontWeight:650}}>{r.product.name}</span>
                      <span className="flex-shrink-0" style={{color:'var(--accent-blue,#86CAE7)', fontWeight:800, fontSize:'16px'}}>+{r.delta.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </EditorialCard>

            {/* === WATCH — compact, bigger title, gold for caution === */}
            {watchers.length > 0 && (
              <EditorialCard pad="normal">
                <div className="mb-3 text-[14px] tracking-[0.18em] uppercase" style={{color:'var(--gold)', fontWeight:700}}>Watch</div>
                <div className="space-y-2">
                  {watchers.map((r) => (
                    <div key={r.product.id} className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="truncate" style={{color:'var(--ink)', fontWeight:650}}>{r.product.name}</span>
                      <span className="flex-shrink-0" style={{color:'var(--rose,#c9a094)', fontWeight:800, fontSize:'16px'}}>{r.delta.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] mt-3 pt-3" style={{color:'var(--ink-soft)', borderTop:'1px solid var(--line)'}}>
                  Correlation, not causation.
                </div>
              </EditorialCard>
            )}

            {/* === UNLOCK MORE SIGNALS — locked tiles === */}
            <div>
              <Eyebrow className="mb-3">Unlock more signals</Eyebrow>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Cycle phase', icon: 'Moon', body: 'Map flares to your hormonal week.' },
                  { label: 'Sleep',       icon: 'Cloud', body: 'See how rest shapes your barrier.' },
                  { label: 'Weather',     icon: 'Sun', body: 'Connect humidity, UV, and dryness.' },
                  { label: 'Wearables',   icon: 'Activity', body: 'HRV, stress — what your body says.' },
                ].map(t => (
                  <div key={t.label} className="rounded-[14px] p-3.5 relative overflow-hidden" style={{background:'var(--cream)', border:'1px dashed var(--line)'}}>
                    <div className="flex items-center gap-1.5 mb-1.5" style={{color:'var(--ink-soft)'}}>
                      <Icon name={t.icon} size={11} />
                      <div className="text-[9px] tracking-[0.22em] uppercase">{t.label}</div>
                    </div>
                    <div className="font-sans text-[12.5px] leading-tight" style={{color:'var(--ink-soft)'}}>{t.body}</div>
                    <div className="absolute top-2 right-2" style={{color:'var(--ink-soft)', opacity:0.5}}>
                      <Icon name="Lock" size={10} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] mt-3 text-center" style={{color:'var(--ink-soft)'}}>Coming next — we won't fake what we can't measure.</div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════
          LIBRARY TAB — Editorial photo gallery grouped by month.
          - Month buckets, soft "See all" arrow per month
          - 4-up grid with subtle rounding
          - Tap a photo → opens the SkinReadDrawer for that day
          - "Select" toggle reveals checkboxes; pick 2 → Compare
          ═══════════════════════════════════════════════════════════════ */}
      {logs.length > 0 && journalMode === 'library' && (() => {
        const photoLogs = logs.filter(l => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'))).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (photoLogs.length === 0) {
          return (
            <EditorialCard className="text-center py-10">
              <div className="flex justify-center mb-3" style={{color:'var(--accent)'}}><Icon name="Camera" size={26} /></div>
              <h3 className="font-sans text-[20px] leading-[1.1] mb-1.5" style={{color:'var(--ink)'}}>Your library begins with the first photo.</h3>
              <p className="text-[12px] mb-4" style={{color:'var(--ink-soft)'}}>Capture today's skin — your gallery will fill from here.</p>
              <div className="flex justify-center"><EditorialPill onClick={() => setShowCheckInChooser(true)} icon="Plus">Take today's photo</EditorialPill></div>
            </EditorialCard>
          );
        }
        // Group by YYYY-MM
        const byMonth = {};
        photoLogs.forEach(l => {
          const d = new Date(l.date + 'T00:00:00');
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          (byMonth[key] = byMonth[key] || []).push(l);
        });
        const monthKeys = Object.keys(byMonth).sort().reverse();
        const monthLabel = (key) => {
          const [y, m] = key.split('-').map(Number);
          return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        };

        return (
          <div className="space-y-6 pb-6">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] tracking-[0.32em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Library</div>
                <h2 className="font-sans text-[24px] leading-[1.1]" style={{color:'var(--ink)'}}>Every photo, kept.</h2>
                <p className="text-[12px] mt-1.5" style={{color:'var(--ink-soft)'}}>{photoLogs.length} photo{photoLogs.length === 1 ? '' : 's'} · tap to read · long-press to select for compare</p>
              </div>
              {photoLogs.length >= 2 && (
                <button
                  onClick={() => { setSelectMode(s => !s); setSelectedIds([]); }}
                  className="text-[9.5px] tracking-[0.22em] uppercase px-3 py-1.5 transition flex items-center gap-1"
                  style={{color: selectMode ? 'var(--cream)' : 'var(--ink-soft)', background: selectMode ? 'var(--ink)' : 'transparent', border:'1px solid ' + (selectMode ? 'var(--ink)' : 'var(--line)')}}
                >
                  <Icon name={selectMode ? 'X' : 'CheckSquare'} size={10} /> {selectMode ? 'Cancel' : 'Select'}
                </button>
              )}
            </div>

            {selectMode && selectedIds.length === 2 && (
              <div className="rounded-[12px] p-3 flex items-center justify-between gap-3" style={{background:'var(--cream-deep)', border:'1px solid var(--ink)'}}>
                <div className="text-[11px]" style={{color:'var(--ink)'}}>Two selected — open them side by side?</div>
                <button
                  onClick={() => { setJournalViewOverride('compare'); }}
                  className="text-[10px] tracking-[0.22em] uppercase px-3 py-1.5 flex items-center gap-1"
                  style={{background:'var(--ink)', color:'var(--cream)'}}
                >
                  Compare <Icon name="ArrowRight" size={10} />
                </button>
              </div>
            )}

            {monthKeys.map(key => (
              <div key={key}>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-sans text-[18px] leading-none" style={{color:'var(--ink)'}}>{monthLabel(key)}</div>
                  <div className="text-[10px]" style={{color:'var(--ink-soft)'}}>{byMonth[key].length} photo{byMonth[key].length === 1 ? '' : 's'}</div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {byMonth[key].map(l => {
                    const isSelected = selectMode && selectedIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => {
                          if (selectMode) {
                            setSelectedIds(prev => {
                              if (prev.includes(l.id)) return prev.filter(x => x !== l.id);
                              if (prev.length >= 2) return [prev[1], l.id];
                              return [...prev, l.id];
                            });
                          } else {
                            setSkinReadDrawerLogId(l.id);
                          }
                        }}
                        className="relative block aspect-square overflow-hidden rounded-[6px] transition"
                        style={{
                          border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                          outline: isSelected ? '2px solid var(--cream)' : 'none',
                          outlineOffset: '-4px'}}
                        aria-label={`Photo ${new Date(l.date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}`}
                      >
                        <Photo item={l} alt="" className="w-full h-full object-cover"
                          renderFallback={() => <div className="w-full h-full flex items-center justify-center font-sans text-[18px]" style={{background:'var(--cream)', color:'var(--ink-soft)'}}>{l.rating}</div>}
                        />
                        <div className="absolute bottom-1 left-1 right-1 text-[8.5px] tracking-[0.05em] uppercase px-1 py-0.5 text-center rounded-sm" style={{background:'rgba(245,240,232,0.85)', color:'var(--ink)'}}>
                          {new Date(l.date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{background:'var(--accent)', color:'var(--cream)'}}>
                            <Icon name="Check" size={8} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* === SUNDAY DIGEST — TODAY TAB ONLY (May 30 v2 per Jenni) ===
          Was rendering on every Journal sub-tab. Now gated to Today
          so Signals / Timeline / Library don't carry the weekly card. */}
      {(journalMode === 'today' || journalMode === 'skinReads' || journalMode === 'compact' || !journalMode) && (() => {
        const hasPhotoFn = (l) => l && (l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:')));
        const tdy = new Date(); tdy.setHours(0,0,0,0);
        const dayIdx = tdy.getDay() === 0 ? 6 : tdy.getDay() - 1;
        const baseWeekStart = new Date(tdy); baseWeekStart.setDate(tdy.getDate() - dayIdx);
        const weekStart = new Date(baseWeekStart);
        weekStart.setDate(baseWeekStart.getDate() + journalDigestWeekOffset * 7);
        const isCurrentDigestWeek = journalDigestWeekOffset === 0;
        const weekDaysArr = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
          return {
            iso: localDateISO(d),
            name: ['MON','TUE','WED','THU','FRI','SAT','SUN'][i],
            isToday: d.getTime() === tdy.getTime(),
            isFuture: d.getTime() > tdy.getTime()};
        });
        const weekStartLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
        const weekEndLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const logsThisWeek = weekDaysArr
          .map(d => ({ ...d, log: (logs || []).find(l => l.date === d.iso && hasPhotoFn(l)) }))
          .map(d => ({ ...d, score: d.log ? aiScoreOut10(d.log) : null }));
        const checkInDays = logsThisWeek.filter(d => d.log).length;
        const scoresOnly = logsThisWeek.filter(d => d.score != null).map(d => Number(d.score));
        const avgScore = scoresOnly.length ? (scoresOnly.reduce((s, v) => s + v, 0) / scoresOnly.length).toFixed(1) : null;
        const biggestMover = (() => {
          if (scoresOnly.length < 2 || !avgScore) return null;
          const avgN = Number(avgScore);
          let best = null;
          logsThisWeek.forEach(d => {
            if (d.score == null) return;
            const delta = Number(d.score) - avgN;
            if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { day: d, delta };
          });
          return best;
        })();
        return (
          <section className="rounded-[20px] mt-6 mb-2 overflow-hidden" style={{background:'var(--cream-deep)', border: '1.5px solid var(--accent)', boxShadow: '0 1px 2px rgba(229,60,45,0.06), 0 8px 22px rgba(229,60,45,0.06)'}}>
            <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-2">
              <div>
                <Eyebrow tone="accent">✦ Sunday Digest</Eyebrow>
                <h2 className="font-sans text-[22px] leading-tight mt-0.5" style={{color:'var(--ink)'}}>
                  Your week.
                </h2>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                <button
                  type="button"
                  onClick={() => setJournalDigestWeekOffset(o => o - 1)}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition hover:bg-[var(--cream)] cursor-pointer"
                  style={{color:'var(--ink-soft)', cursor:'pointer'}}
                  aria-label="Previous week"
                  title="Previous week"
                >
                  <Icon name="ChevronLeft" size={12} />
                </button>
                <div className="flex flex-col items-center min-w-[92px]">
                  <span className="text-[10px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>
                    {weekStartLabel} – {weekEndLabel}
                  </span>
                  {!isCurrentDigestWeek && (
                    <button
                      type="button"
                      onClick={() => setJournalDigestWeekOffset(0)}
                      className="text-[8.5px] tracking-[0.2em] uppercase transition hover:opacity-70 mt-0.5"
                      style={{color:'var(--accent)', cursor:'pointer'}}
                    >
                      this week
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setJournalDigestWeekOffset(o => Math.min(0, o + 1))}
                  disabled={isCurrentDigestWeek}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition hover:bg-[var(--cream)] cursor-pointer disabled:opacity-30"
                  style={{color:'var(--ink-soft)', cursor: isCurrentDigestWeek ? 'default' : 'pointer'}}
                  aria-label="Next week"
                  title={isCurrentDigestWeek ? 'Already on current week' : 'Next week'}
                >
                  <Icon name="ChevronRight" size={12} />
                </button>
              </div>
            </div>
            <div className="px-3 pb-3">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" style={{scrollSnapType:'x mandatory'}}>
                {logsThisWeek.map(d => (
                  <button
                    key={d.iso}
                    onClick={() => {
                      if (d.log) setSkinReadDrawerLogId(d.log.id);
                      else setJournalDayDetail && setJournalDayDetail(d.iso);
                    }}
                    className="flex-shrink-0 rounded-[12px] overflow-hidden transition hover:opacity-95 text-left"
                    style={{width:'72px', scrollSnapAlign:'start', background:'var(--cream)', border: d.isToday ? '1.5px solid var(--accent)' : '1px solid var(--line)'}}
                    title={d.log ? `${d.name} · tap to read` : `${d.name} · no photo`}
                  >
                    <div className="text-[8.5px] tracking-[0.22em] uppercase pt-1.5 pb-0.5 text-center font-medium" style={{color: d.isToday ? 'var(--accent)' : 'var(--ink-soft)'}}>
                      {d.isToday ? 'TODAY' : d.name}
                    </div>
                    <div className="aspect-[3/4] mx-1 rounded-[6px] overflow-hidden flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                      {d.log ? (
                        <Photo item={d.log} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-sans text-[10px]" style={{color:'var(--ink-soft)'}}>{d.isFuture ? '—' : 'rest'}</span>
                      )}
                    </div>
                    <div className="text-center pt-1 pb-1.5 leading-none">
                      {d.score ? (
                        <span className="font-sans text-[11px]" style={{color:'var(--accent)'}}>✦ {d.score}</span>
                      ) : (
                        <span className="text-[9px]" style={{color:'var(--ink-soft)'}}>—</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 flex items-baseline gap-5 flex-wrap" style={{borderTop:'1px solid var(--line)'}}>
              <div>
                <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Avg</div>
                <div className="font-sans text-[18px] leading-none mt-0.5" style={{color: avgScore ? 'var(--ink)' : 'var(--ink-soft)'}}>
                  {avgScore ? <><span style={{color:'var(--accent)'}}>✦</span> {avgScore}<span className="text-[10px]" style={{color:'var(--ink-soft)'}}>/10</span></> : '—'}
                </div>
              </div>
              <div>
                <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Reads</div>
                <div className="font-sans text-[18px] leading-none mt-0.5" style={{color:'var(--ink)'}}>
                  {checkInDays} <span className="text-[10px]" style={{color:'var(--ink-soft)'}}>/ 7</span>
                </div>
              </div>
              {biggestMover && (
                <div>
                  <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Biggest move</div>
                  <div className="font-sans text-[14px] leading-none mt-0.5" style={{color: biggestMover.delta > 0 ? 'var(--accent-blue)' : 'var(--rose)'}}>
                    {biggestMover.day.name} {biggestMover.delta > 0 ? '+' : ''}{biggestMover.delta.toFixed(1)}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{borderTop:'1px solid var(--line)', background:'var(--cream)'}}>
              <div className="text-[11px] leading-snug flex-1 min-w-0" style={{color:'var(--ink-soft)'}}>
                <span className="">Pin every Sunday at 9 AM →</span> drops a recurring event into your calendar.
              </div>
              <button
                onClick={() => {
                  downloadIcsReminder({
                    title: 'Frida · Sunday Digest',
                    description: 'Open Frida → Journal for your weekly skin read. https://tangjennii-wq.github.io/skinetude/',
                    hour: 9,
                    minute: 0});
                  toast('Reminder added to your downloads — open it to drop into your calendar', 'info');
                }}
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase flex items-center gap-1.5 transition hover:opacity-90 cursor-pointer border"
                style={{borderColor: 'var(--line)', color:'var(--accent)', background:'transparent', cursor:'pointer'}}
              >
                <Icon name="Calendar" size={11} /> Add to calendar
              </button>
            </div>
          </section>
        );
      })()}
    </div>
  );
};
