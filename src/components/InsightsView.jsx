// === InsightsView (Wave 7.4 extract — May 2026) ===
// The Insights tab body — extracted from App's inline IIFE
// `{activeTab === 'insights' && (() => { ... })()}`.
//
// All App-scope reads passed as explicit props.

const InsightsView = ({
  logs,
  hormonalContext,
  counselInsights,
  counselSubTab, setCounselSubTab,
  counselGenerating,
  counselExpanded, setCounselExpanded,
  insightMessages,
  insightQuery, setInsightQuery,
  insightLoading,
  handleGenerateCounselInsight,
  discussInsightInAsk,
  handleInsight,
  clearInsightChat,
  setOpenLesson,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  procedures,
  products,
  regimenLogs,
  // === LESSONS FILTER + AGE BRIDGE (May 30 2026 — Agent D-v3) ===
  // userProfile is the source of truth for goals (used as the focus
  // filter on Lessons) and the new `age` field. We read goals here
  // for default filter state; experience level is read from
  // onboardingState.experienceLevel (essential/balanced/advanced).
  userProfile, setUserProfile,
  onboardingState, updateOnboarding,
  saveData}) => {
  // === COUNSEL — Insights | Ask ===
  // Six magazine-style cards on the Insights tab; a persistent chat thread on the Ask tab.
  // Cards live in a small declarative array; cycleMap is gated on hormonalContext.
  const photoEntryCount = logs.filter(l => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'))).length;
  const fmtRelative = (ts) => {
    if (!ts) return '';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  };
  const titleCaseLocal = (w) => w ? String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase() : 'None yet';
  const getLogRating = (log) => {
    const n = Number(log?.rating ?? log?.overallRating ?? log?.score);
    return Number.isFinite(n) ? n : null;
  };
  const avgRating = (entries) => {
    const vals = entries.map(getLogRating).filter(v => v != null);
    return vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : null;
  };
  const recentLogs = [...(logs || [])]
    .filter(Boolean)
    .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  const last7Avg = avgRating(recentLogs.slice(0, 7));
  const prev7Avg = avgRating(recentLogs.slice(7, 14));
  const ratingDelta = last7Avg != null && prev7Avg != null ? last7Avg - prev7Avg : null;
  const concernLabels = {
    repair: 'Barrier',
    calm: 'Redness',
    hydrate: 'Hydration',
    clarify: 'Breakouts',
    pigment: 'Pigment',
    texture: 'Texture'};
  const concernTally = {};
  recentLogs.slice(0, 30).forEach(l => {
    (Array.isArray(l.concerns) ? l.concerns : []).forEach(c => {
      const k = String(c || '').trim();
      if (k) concernTally[k] = (concernTally[k] || 0) + 1;
    });
    const m = l.metricSnapshot || {};
    if (m.barrier && /compromised|stripped/i.test(m.barrier)) concernTally.repair = (concernTally.repair || 0) + 1;
    if ((m.sensitivity && /reactive|inflamed/i.test(m.sensitivity)) || (m.redness && /moderate|high/i.test(m.redness))) concernTally.calm = (concernTally.calm || 0) + 1;
    if (m.hydration && /dry|parched/i.test(m.hydration)) concernTally.hydrate = (concernTally.hydrate || 0) + 1;
    if (m.breakouts && /many|severe/i.test(m.breakouts)) concernTally.clarify = (concernTally.clarify || 0) + 1;
  });
  const topConcernKey = Object.entries(concernTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const topConcernLabel = topConcernKey ? (concernLabels[topConcernKey] || titleCaseLocal(topConcernKey)) : 'No recurring signal yet';
  const activeRoutineCount = (products || []).filter(p => {
    const days = p?.cadence && Array.isArray(p.cadence.days) ? p.cadence.days : [];
    return days.length > 0 && !p.endDate;
  }).length;
  const photoDepth = `${photoEntryCount}/30 photos`;
  const currentReadTitle = recentLogs.length === 0
    ? 'Start with two or three check-ins'
    : ratingDelta == null
      ? 'Your pattern is starting to form'
      : ratingDelta > 0.35
        ? 'Your recent entries are trending better'
        : ratingDelta < -0.35
          ? 'Your recent entries need a closer look'
          : 'Your recent entries look steady';
  const currentReadBody = recentLogs.length === 0
    ? 'Insights get useful once Frida has a few dated entries to compare against your routine.'
    : ratingDelta == null
      ? 'Keep logging this week; the first useful trend appears once there is a baseline to compare.'
      : ratingDelta > 0.35
        ? 'Something in the last week is lining up well. Use the deeper reads to see whether routine, timing, or context explains it.'
        : ratingDelta < -0.35
          ? 'There may be a trigger, spacing issue, or barrier wobble. Start with routine audit or ask what changed.'
          : 'Stable is useful data. The next move is identifying what is maintaining it and what still needs attention.';
  const quickAsk = (question) => {
    setCounselSubTab('ask');
    handleInsight(question);
  };
  const insightCardDefs = [
    { id: 'trajectory',         title: 'Skin trajectory',     subtitle: 'Slope, turning points, what changed.',           icon: 'TrendingUp', tone: 'blue' },
    { id: 'productPerformance', title: 'Product performance', subtitle: 'Co-occurrence with your best and worst days.',   icon: 'Sparkles', tone: 'pink', deepGate: photoEntryCount < 30 },
    { id: 'concernPatterns',    title: 'Concern patterns',    subtitle: 'Top recurring concerns and when they flare.',    icon: 'AlertCircle', tone: 'gold' },
    { id: 'routineAudit',       title: 'Routine audit',       subtitle: 'Coverage, redundancies, conflicts, evidence.',   icon: 'CheckCircle2', tone: 'white' },
    ...(hormonalContext === 'cycling'
      ? [{ id: 'cycleMap',      title: 'Cycle map',           subtitle: 'Phase-by-phase rating + concern patterns.',      icon: 'CircleDot', tone: 'blue' }]
      : []),
    { id: 'whatsNext',          title: 'What’s next',    subtitle: 'A 30-day forecast and one suggested move.',       icon: 'ArrowRight', tone: 'pink' },
  ];
  const expanded = counselExpanded ? counselInsights[counselExpanded] : null;
  const expandedDef = counselExpanded ? insightCardDefs.find(c => c.id === counselExpanded) : null;
  return (
    <div>
      <SectionHeader title="Insights" subtitle="A working read on your skin data: what changed, what matters, and what to do next." />

      {/* Insights | Ask tab toggle — unified with EditorialSubTabs. */}
      <div className="mb-6">
        <EditorialSubTabs
          tabs={[{ id: 'insights', label: 'Insights' }, { id: 'ask', label: 'Ask' }]}
          value={counselSubTab}
          onChange={setCounselSubTab}
        />
      </div>

      {counselSubTab === 'insights' && (
        <div>
          {/* === HERO HERO RETIRED (May 30 2026 — Agent D-v3) ===
              The giant "Current read" intro card + 3-stat strip + 3
              CTAs was the "Find the right next move" hero. Pulled per
              Part 1 of the Insights cleanup brief: get to the matches
              faster, less prose, more signal. The same "ask what
              changed" / "audit" / "generate trend" affordances still
              exist on the Lessons cards below (and persist on Ask). */}

          {/* === DATA-DRIVEN INSIGHTS BLOCK (June 2026 — post-critic cleanup) ===
              Computed from the user's own logs — no generation step, instant
              render, honest about gaps. Pared from 3 panels to 2:
                1. Four-week metric trends (sparklines)
                2. Frida is noticing (Signals — deeper multi-part observations)
              Removed in June 2026 cleanup:
                - PatternsPanel: same paradigm as Signals (collapsible dot+
                  chevron rows from same data), rendered twice.
                - AdherencePanel: streak duplicated Home cover; AM/PM/photo
                  days belong in Regimen per project_regimen_canonical.
              See: stratechery + design-direction critic outputs (June 2026). */}
          {/* MetricTrendsList: collapsible row paradigm (June 2026 redesign).
              Replaces MetricTrendsGrid (2x2 sparkline tiles). Each metric is
              a row with inline mini-sparkline; tap to expand the full chart.
              Matches SignalsPanel's row shape — Insights now reads as ONE
              paradigm (collapsible-row list) across the whole tab. */}
          <MetricTrendsList logs={logs} />
          <SignalsPanel
            logs={logs}
            products={products}
            regimenLogs={regimenLogs}
            onAsk={(q) => { setCounselSubTab('ask'); handleInsight(q); }}
          />

          {/* === WHAT WE'D TRY removed June 2026 (Batch 4 cleanup) ===
              CONCERN_GAP + COMPLEMENT recs were a third suggestion
              surface, on top of the two canonical ones (shelf-picks
              button + new-finds drawer, per project_two_suggestion_surfaces).
              Stratechery + design critics both flagged it as sprawl.
              Recs still discoverable via the existing surfaces. */}

          {/* === LESSONS + EXPANDED MODAL removed June 2026 (Batch 3 cleanup) ===
              Lessons section (magazine-card grid + filter chrome by focus +
              experience) and its expanded read modal both removed.
              Ask tab already covers the JTBD via 6 suggested prompts. Stratechery +
              design critics flagged Lessons as a content-discovery surface bolted
              onto a retrospective dashboard. If Lessons earns its own return-cause
              weight later, promote to a dedicated tab.
              Leaving state machinery (insightCardDefs, counselInsights cache,
              handleGenerateCounselInsight, counselExpanded) in scope as dead code —
              reversible. */}
        </div>
      )}

      {counselSubTab === 'ask' && (
        <div>
          <div className="flex justify-end mb-3">
            {insightMessages.length > 0 && (
              <button onClick={clearInsightChat} className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>New conversation</button>
            )}
          </div>
          {/* Conversation thread */}
          {insightMessages.length === 0 ? (
            <div className="border p-12 text-center" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
              <Icon name="Sparkles" size={28} className="mx-auto mb-4 opacity-40" />
              <h3 className="text-2xl mb-2" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.02em'}}>Ask from your data</h3>
              <p className="text-sm font-light max-w-md mx-auto" style={{color:'var(--ink-soft)'}}>Use this when you want a decision, not a generic answer. Frida reads your journal, routine, procedures, and color profile.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8 max-w-3xl mx-auto">
                {[
                  "What changed this week?",
                  "What should I do next?",
                  "Which product seems most useful?",
                  "Audit my routine for conflicts.",
                  "What might be triggering breakouts?",
                  "How do I protect my barrier?",
                ].map(q => (
                  <button key={q} onClick={() => handleInsight(q)} className="border p-4 text-left text-sm font-light transition hover:border-[var(--ink)]" style={{background:'var(--cream)', borderColor: 'var(--line)', color:'var(--ink)'}}>"{q}"</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="border p-5 md:p-6 space-y-4" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
              {insightMessages.map((m, i) => (
                <div key={i}>
                  {m.role === 'user' ? (
                    <div className="flex justify-end">
                      {/* User bubble — text-xs uniform with assistant + input */}
                      <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm text-xs font-light leading-relaxed" style={{background:'var(--ink)', color:'var(--cream)'}}>
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--ink)', color:'var(--cream)'}}>
                        <Icon name="Sparkles" size={10} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>Counsel</div>
                        {/* Assistant body — text-xs uniform across the whole chat */}
                        <div className="whitespace-pre-wrap leading-relaxed font-light text-xs" style={{color: m.error ? '#a04555' : 'var(--ink)'}}>{withPearls(m.content, setOpenLesson)}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {insightLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--ink)', color:'var(--cream)'}}>
                    <Icon name="Sparkles" size={10} />
                  </div>
                  <div className="flex-1 flex items-center gap-2 pulse-soft" style={{color:'var(--ink-soft)'}}>
                    <Icon name="Loader2" size={12} className="spin" />
                    <span className="text-[10px] tracking-[0.2em] uppercase">Consulting…</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Persistent input — text-xs to match the chat bubbles. Fixed
              rows so the textarea doesn't auto-grow and shift the layout
              while typing; user can still press Shift+Enter for newline
              and the textarea will scroll internally. */}
          <div className="mt-4 border" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
            <textarea autoCapitalize="off" autoCorrect="off" spellCheck={false}
              value={insightQuery}
              onChange={e => setInsightQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInsight(); } }}
              placeholder={insightMessages.length === 0 ? "What would you like to ask?" : "Continue the conversation…"}
              rows="2"
              className="w-full px-3 py-2.5 border-0 focus:outline-none font-light resize-none text-xs"
              style={{background:'transparent', color:'var(--ink)', minHeight:'56px', maxHeight:'56px'}}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t" style={{borderColor: 'var(--line)'}}>
              <span className="text-[9px] tracking-[0.15em] uppercase" style={{color:'var(--ink-soft)'}}>Enter to send · Shift+Enter for new line</span>
              <button onClick={() => handleInsight()} disabled={!insightQuery.trim() || insightLoading} className="px-3 py-1.5 tracking-[0.2em] text-[10px] uppercase transition disabled:opacity-40 flex items-center gap-1.5" style={{background:'var(--ink)', color:'var(--cream)'}}>
                {insightLoading ? <><Icon name="Loader2" size={10} className="spin" /></> : <><Icon name="ArrowUp" size={10} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
