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

          {/* === DATA-DRIVEN INSIGHTS BLOCK (May 2026) ===
              These three sections live ABOVE the AI magazine cards and
              the "what we'd try" block because they are computed from
              the user's own logs — no generation step, instant render,
              honest about gaps. Order:
                1. Four-week metric trends (sparklines)
                2. Patterns we're noticing (descriptive observations —
                   NEVER causal per memory feedback_no_causal_claims)
                3. Cadence (streak + AM/PM adherence)
              Each section quiets itself when there isn't enough data. */}
          <MetricTrendsGrid logs={logs} />
          {/* SignalsPanel — deeper "Frida is noticing" cards (May 2026).
              Sits ABOVE PatternsPanel because it's the richer surface
              (4-part: observation / connection / possible factor / try).
              PatternsPanel stays for the lighter one-line co-occurrence
              reads that don't graduate into a full Signal card. */}
          <SignalsPanel
            logs={logs}
            products={products}
            regimenLogs={regimenLogs}
            onAsk={(q) => { setCounselSubTab('ask'); handleInsight(q); }}
          />
          <PatternsPanel
            logs={logs}
            onAsk={(q) => { setCounselSubTab('ask'); handleInsight(q); }}
          />
          <AdherencePanel logs={logs} regimenLogs={regimenLogs} />

          {/* === WHAT WE'D TRY (May 2026) ===
              Engine-driven CONCERN_GAP + COMPLEMENT recs on a 30-day
              window. Sits ABOVE the magazine cards because it's
              actionable, not generative — and the magazine cards are
              the deeper analytical surface. Quiet when there's nothing
              meaningful to surface. Per RECOMMENDATIONS.md §5. */}
          {(() => {
            try {
              if (!Array.isArray(products) || products.length === 0) return null;
              const dateKey = (typeof localDateISO === 'function') ? localDateISO() : new Date().toISOString().slice(0, 10);
              const ritual = resolveTodayRitual({ products, regimenLogs: regimenLogs || [], date: dateKey });
              // Derive 30-day concerns from the most recent logs that carry metric snapshots.
              const recent = (logs || []).filter(l => l && l.metricSnapshot).slice(0, 30);
              const concernSet = new Set();
              recent.forEach(l => {
                const m = l.metricSnapshot || {};
                if (m.barrier && /compromised|stripped/i.test(m.barrier)) concernSet.add('repair');
                if (m.sensitivity && /reactive|inflamed/i.test(m.sensitivity)) concernSet.add('calm');
                if (m.redness && /moderate|high/i.test(m.redness)) concernSet.add('calm');
                if (m.hydration && /dry|parched/i.test(m.hydration)) concernSet.add('hydrate');
                if (m.breakouts && /many|severe/i.test(m.breakouts)) concernSet.add('clarify');
              });
              const concerns = [...concernSet];
              const coverage = resolveCoverageStates({
                routine: { am: ritual.am, pm: ritual.pm },
                concerns,
                preferences: {}}, deriveProductJobs);
              if ((coverage.concernGap?.length || 0) === 0 && (coverage.complement?.length || 0) === 0) return null;
              return (
                <div className="mb-6">
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[10px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:650}}>
                        What we'd try
                      </div>
                      <div className="text-[12px] mt-1" style={{color:'var(--ink-soft)'}}>
                        Product and routine ideas based on current gaps.
                      </div>
                    </div>
                  </div>
                  <RecCardSection coverage={coverage} surface="insights" collapsible />
                </div>
              );
            } catch (e) {
              return null;
            }
          })()}

          {/* === LESSONS (May 30 2026 — Agent D-v3) ===
              The magazine-card grid is the Lessons section. Filter
              bar above it lets the user narrow by focus area (reads
              from / writes to userProfile.goals — the existing field;
              no new focusAreas field per the brief's pushback note)
              and experience level (Beginner / Intermediate /
              Advanced, mapped to onboarding's essential / balanced /
              advanced). A "Starter Kit" tile is added to the grid
              and surfaces first when experience === beginner. */}
          {(() => {
            // === FOCUS_OPTIONS — display label / id mapping ===
            // The Lessons filter uses the brand's "focus area" lens
            // (anti-aging, barrier, acne, pigment, texture, glow,
            // sensitivity) but reads/writes against userProfile.goals
            // so we don't fork the data model. Mapping:
            //   anti-aging  ↔ age-gracefully
            //   barrier     ↔ barrier
            //   acne        ↔ breakouts
            //   pigment     ↔ brighten          (covers PIH, melasma, tone)
            //   texture     ↔ texture
            //   glow        ↔ brighten          (shares the brighten goal)
            //   sensitivity ↔ calm-redness / sensitivity (both map in)
            // Two focus ids can point at the same goal id; that's fine
            // — when the user toggles a focus pill we just union/diff
            // the corresponding goal ids on userProfile.goals.
            const FOCUS_OPTIONS = [
              { id: 'anti-aging',  label: 'Anti-aging',  goals: ['age-gracefully'] },
              { id: 'barrier',     label: 'Barrier',     goals: ['barrier'] },
              { id: 'acne',        label: 'Acne',        goals: ['breakouts'] },
              { id: 'pigment',     label: 'Pigment',     goals: ['brighten'] },
              { id: 'texture',     label: 'Texture',     goals: ['texture'] },
              { id: 'glow',        label: 'Glow',        goals: ['brighten'] },
              { id: 'sensitivity', label: 'Sensitivity', goals: ['sensitivity', 'calm-redness'] },
            ];
            const EXP_OPTIONS = [
              { id: 'essential', label: 'Beginner' },
              { id: 'balanced',  label: 'Intermediate' },
              { id: 'advanced',  label: 'Advanced' },
            ];
            // Derive active focus pills from saved goals.
            const savedGoals = Array.isArray(userProfile?.goals) ? userProfile.goals : [];
            const activeFocus = FOCUS_OPTIONS.filter(f => f.goals.some(g => savedGoals.includes(g))).map(f => f.id);
            // Default experience from onboardingState or userProfile fallback.
            const activeExp = (onboardingState?.experienceLevel) || (userProfile?.experienceLevel) || '';
            // Focus-id → lesson card-id allowlist. Anything not listed
            // is "general" and shows for any focus selection.
            const FOCUS_TO_LESSON = {
              'anti-aging':  ['trajectory', 'whatsNext', 'routineAudit', 'concernPatterns'],
              barrier:       ['routineAudit', 'productPerformance', 'whatsNext', 'starterKit'],
              acne:          ['concernPatterns', 'productPerformance', 'whatsNext', 'cycleMap'],
              pigment:       ['trajectory', 'concernPatterns', 'whatsNext'],
              texture:       ['concernPatterns', 'productPerformance', 'trajectory'],
              glow:          ['trajectory', 'whatsNext'],
              sensitivity:   ['routineAudit', 'concernPatterns', 'whatsNext', 'starterKit'],
            };
            // Lesson-id → minimum experience to surface (so we don't
            // bury the basics for beginners or push noise on advanced
            // users). All cards still reachable when user clears
            // filters. starterKit is beginner-only.
            const EXP_GATE = {
              starterKit:        ['essential'],
              trajectory:        ['essential','balanced','advanced'],
              productPerformance:['balanced','advanced'],
              concernPatterns:   ['essential','balanced','advanced'],
              routineAudit:      ['essential','balanced','advanced'],
              cycleMap:          ['balanced','advanced'],
              whatsNext:         ['essential','balanced','advanced'],
            };
            const toggleFocusPill = (focusId) => {
              if (!setUserProfile && !saveData) {
                // Read-only fallback — let App handle persistence on
                // its own loop if neither setter bridged in.
                return;
              }
              const opt = FOCUS_OPTIONS.find(f => f.id === focusId);
              if (!opt) return;
              const isOn = opt.goals.some(g => savedGoals.includes(g));
              const next = isOn
                ? savedGoals.filter(g => !opt.goals.includes(g))
                : Array.from(new Set([...savedGoals, ...opt.goals])).slice(0, 5);
              if (typeof setUserProfile === 'function') setUserProfile(prev => ({ ...(prev || {}), goals: next }));
              if (typeof saveData === 'function') { try { saveData('userProfile', { ...(userProfile || {}), goals: next }); } catch (_) {} }
            };
            const setExpPill = (expId) => {
              if (typeof updateOnboarding === 'function') updateOnboarding({ experienceLevel: expId });
              else if (typeof setUserProfile === 'function') setUserProfile(prev => ({ ...(prev || {}), experienceLevel: expId }));
            };
            // === STARTER KIT — synthetic lesson tile ===
            // Same basics content the killed "NEW USER PATHWAY"
            // covered (barrier first / daily SPF / one active /
            // refine), but framed as a Starter Kit lesson card. Lives
            // in the grid only when no experience selected OR the
            // user is on Beginner. Tap → opens a small Modal-style
            // expanded card (Counsel Insights modal flow piggybacked
            // for consistency — we stash it under counselInsights
            // with a stable id at render time so the expander reads
            // it like a generated lesson).
            const STARTER_KIT_LESSON = {
              id: 'starterKit',
              title: 'Starter Kit',
              subtitle: 'Four moves to build the foundation: barrier first, daily SPF, one active, then refine.',
              icon: 'Sparkles',
              tone: 'white',
              starterContent: [
                '1. Barrier first. Cleanser + moisturizer that don\'t fight you. If skin feels tight, the rest doesn\'t land.',
                '2. Daily SPF. Mineral or chemical — the one you\'ll actually reapply. AM, every day, even cloudy.',
                '3. One active. Pick the one that maps to your top focus (retinoid for texture, vitamin C for tone, etc). Three nights a week to start.',
                '4. Refine. After two weeks of the same routine, look at photos + check-ins. Adjust one thing at a time.',
              ].join('\n\n'),
            };
            // Build the filtered lesson list. If no focus pills are
            // active, show everything that passes the experience
            // gate. If focuses are active, show their union.
            const allLessons = [STARTER_KIT_LESSON, ...insightCardDefs];
            const filtered = allLessons.filter(def => {
              if (activeExp) {
                const allowed = EXP_GATE[def.id] || ['essential','balanced','advanced'];
                if (!allowed.includes(activeExp)) return false;
              } else if (def.id === 'starterKit') {
                // Hide Starter Kit unless explicit beginner — keeps
                // the section clean for returning users.
                return false;
              }
              if (activeFocus.length === 0) return true;
              return activeFocus.some(fid => (FOCUS_TO_LESSON[fid] || []).includes(def.id));
            });
            return (
              <>
                {/* Section eyebrow + filter bar */}
                <div className="mb-3">
                  <div className="text-[10px] tracking-[0.22em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:650}}>
                    Lessons
                  </div>
                  <div className="text-[12px]" style={{color:'var(--ink-soft)'}}>
                    Filter by focus and experience. Tap a tile for the deeper read.
                  </div>
                </div>
                <div className="mb-4 rounded-[14px] px-3 py-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                  <div className="text-[9px] tracking-[0.22em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:650}}>Focus</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {FOCUS_OPTIONS.map(f => {
                      const on = activeFocus.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFocusPill(f.id)}
                          className="rounded-full px-3 py-1.5 transition"
                          style={{
                            background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--cream))' : 'var(--cream)',
                            color: on ? 'var(--accent)' : 'var(--ink)',
                            border: on
                              ? '1px solid color-mix(in srgb, var(--accent) 42%, var(--line))'
                              : '1px solid var(--line)',
                            fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', cursor: 'pointer',
                          }}
                        >{f.label}</button>
                      );
                    })}
                  </div>
                  <div className="text-[9px] tracking-[0.22em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:650}}>Experience</div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXP_OPTIONS.map(ex => {
                      const on = activeExp === ex.id;
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => setExpPill(on ? '' : ex.id)}
                          className="rounded-full px-3 py-1.5 transition"
                          style={{
                            background: on ? 'var(--ink)' : 'var(--cream)',
                            color: on ? 'var(--cream)' : 'var(--ink)',
                            border: on ? '1px solid var(--ink)' : '1px solid var(--line)',
                            fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', cursor: 'pointer',
                          }}
                        >{ex.label}</button>
                      );
                    })}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="rounded-[14px] px-4 py-5 text-center mb-4" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                    <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>
                      No lessons under that combination. Clear a filter to see more.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map(def => {
                      // Starter Kit gets its own renderer — synthetic
                      // content (no Counsel cache), single tap = small
                      // expander. Everything else uses the original
                      // magazine-card render.
                      if (def.id === 'starterKit') {
                        return (
                          <div key="starterKit" className="border flex flex-col rounded-[20px] overflow-hidden" style={{background:'var(--surface-card)', borderColor:'var(--line)'}}>
                            <div className="px-4 py-3 border-b flex items-center justify-between gap-2" style={{borderColor:'var(--line)'}}>
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon name={def.icon} size={14} style={{color:'var(--accent)'}} />
                                <h3 className="font-sans text-base leading-tight truncate" style={{color:'var(--ink)'}}>{def.title}</h3>
                              </div>
                              <span className="text-[8px] tracking-[0.2em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)'}}>Basics</span>
                            </div>
                            <div className="px-4 py-3 flex-1 flex flex-col gap-3">
                              <p className="text-[11px] leading-snug" style={{color:'var(--ink-soft)'}}>{def.subtitle}</p>
                              <div className="whitespace-pre-line text-[12px] leading-relaxed" style={{color:'var(--ink)'}}>
                                {def.starterContent}
                              </div>
                              <div className="mt-auto pt-2">
                                <button
                                  onClick={() => quickAsk('Walk me through the starter kit for my skin: barrier, SPF, one active, refine.')}
                                  className="text-[10px] tracking-[0.2em] uppercase"
                                  style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)'}}
                                >Ask how this applies to me</button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const cached = counselInsights[def.id];
                      const generating = !!counselGenerating[def.id];
                      const preview = cached?.content
                        ? cached.content.split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 220)
                        : null;
                      // T2 (May 31 2026): staleness pill triggers at 14+ days.
                      // Counsel cards summarize trends — past 14d any read is
                      // stale enough that the recommendation may no longer
                      // match the user's current skin state.
                      const isStale = cached?.generatedAt && (Date.now() - cached.generatedAt > 14 * 86400000);
                      const toneBg = def.tone === 'pink'
                        ? 'var(--surface-selected-soft)'
                        : def.tone === 'blue'
                          ? 'var(--surface-info)'
                          : def.tone === 'gold'
                            ? 'var(--surface-caution)'
                            : 'var(--surface-card)';
                      return (
                        <div key={def.id} className="border flex flex-col rounded-[20px] overflow-hidden" style={{background:toneBg, borderColor:'var(--line)'}}>
                          <div className="px-4 py-3 border-b flex items-center justify-between gap-2" style={{borderColor:'var(--line)'}}>
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon name={def.icon} size={14} style={{color:'var(--accent)'}} />
                              <h3 className="font-sans text-base leading-tight truncate" style={{color:'var(--ink)'}}>{def.title}</h3>
                            </div>
                            {cached && (
                              <span className="text-[8px] tracking-[0.2em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)'}}>{fmtRelative(cached.generatedAt)}</span>
                            )}
                          </div>
                          <div className="px-4 py-3 flex-1 flex flex-col gap-3">
                            {/* T2 (May 31 2026): stale-read Refresh pill.
                                Surfaces at the top of the card when the
                                cached read is more than 14 days old —
                                the user's skin state has likely shifted
                                enough that the recommendation needs a
                                redraw. Calls the same regenerate handler
                                used by the bottom "Refresh" link. */}
                            {isStale && (
                              <button
                                onClick={() => handleGenerateCounselInsight(def.id)}
                                disabled={generating}
                                className="self-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] tracking-[0.18em] uppercase border transition disabled:opacity-50"
                                style={{ borderColor:'var(--accent)', color:'var(--accent)', background:'rgba(229,60,45,0.06)', fontWeight:600 }}
                                title="This read is more than 14 days old — refresh it"
                              >
                                {generating ? <Icon name="Loader2" size={10} className="spin" /> : <Icon name="RefreshCw" size={10} />}
                                Refresh
                              </button>
                            )}
                            <p className="text-[11px] leading-snug" style={{color:'var(--ink-soft)'}}>{def.subtitle}</p>
                            {def.deepGate && (
                              <div className="text-[9px] tracking-[0.2em] uppercase px-2 py-1 inline-block self-start rounded-full" style={{background:'rgba(255,255,255,0.72)', color:'var(--ink-soft)'}}>
                                Simple mode · deep at 30 photos ({photoEntryCount}/30)
                              </div>
                            )}
                            {preview ? (
                              <p className="font-sans text-[12px] leading-snug line-clamp-3" style={{color:'var(--ink)'}}>{preview}…</p>
                            ) : (
                              <p className="text-[12px] leading-snug" style={{color:'var(--ink-soft)'}}>{generating ? 'Drawing your read…' : 'Generate when you want the deeper read.'}</p>
                            )}
                            {cached?.generatedAt && (
                              <div className="text-[9px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>
                                Generated {fmtRelative(cached.generatedAt)}
                              </div>
                            )}
                            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                              <div className="flex items-center gap-2">
                                {cached ? (
                                  <button
                                    onClick={() => setCounselExpanded(def.id)}
                                    className="text-[10px] tracking-[0.2em] uppercase"
                                    style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)'}}
                                  >Read full</button>
                                ) : (
                                  <button
                                    onClick={() => handleGenerateCounselInsight(def.id)}
                                    disabled={generating}
                                    className="px-3 py-1.5 tracking-[0.2em] text-[10px] uppercase transition flex items-center gap-1.5 disabled:opacity-50"
                                    style={{background:'var(--action-primary)', color:'#FFFFFF'}}
                                  >
                                    {generating ? <><Icon name="Loader2" size={11} className="spin" /> Generating…</> : <><Icon name="Sparkles" size={11} /> Generate read</>}
                                  </button>
                                )}
                              </div>
                              {cached && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleGenerateCounselInsight(def.id)}
                                    disabled={generating}
                                    className="text-[9px] tracking-[0.2em] uppercase disabled:opacity-50"
                                    style={{color:'var(--ink-soft)'}}
                                    title="Regenerate"
                                  >
                                    {generating ? <Icon name="Loader2" size={10} className="spin" /> : 'Refresh'}
                                  </button>
                                  <span style={{color:'var(--line)'}}>·</span>
                                  <button
                                    onClick={() => discussInsightInAsk(def.id)}
                                    className="text-[9px] tracking-[0.2em] uppercase"
                                    style={{color:'var(--ink-soft)'}}
                                    title="Discuss in Ask"
                                  >Discuss</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}

          {/* Dead magazine-grid block removed May 30 v3 — Lessons
              now lives in the filter-aware block above. */}

          {/* Footer note about data sources */}
          <p className="text-[9px] tracking-[0.2em] uppercase mt-6 text-center" style={{color:'var(--ink-soft)'}}>
            Pattern reads use check-ins and photos · product ideas also use your routine and shelf
          </p>

          {/* Expanded read modal */}
          {expanded && expandedDef && (
            <Modal onClose={() => setCounselExpanded(null)} title={expandedDef.title}>
              <div className="space-y-4">
                <div className="text-[9px] tracking-[0.25em] uppercase" style={{color:'var(--ink-soft)'}}>
                  Generated {fmtRelative(expanded.generatedAt)} · from {expanded.entryCount || 0} entries
                </div>
                <div className="whitespace-pre-wrap leading-relaxed font-light text-[14px]" style={{color:'var(--ink)'}}>
                  {withPearls(expanded.content, setOpenLesson)}
                </div>
                <div className="flex items-center gap-3 pt-3 border-t" style={{borderColor: 'var(--line)'}}>
                  <button
                    onClick={() => { handleGenerateCounselInsight(counselExpanded); }}
                    disabled={!!counselGenerating[counselExpanded]}
                    className="px-3 py-1.5 tracking-[0.2em] text-[10px] uppercase transition flex items-center gap-1.5 disabled:opacity-50 border"
                    style={{borderColor:'var(--ink)', color:'var(--ink)'}}
                  >
                    {counselGenerating[counselExpanded] ? <><Icon name="Loader2" size={11} className="spin" /> Refreshing…</> : <><Icon name="RefreshCw" size={11} /> Refresh</>}
                  </button>
                  <button
                    onClick={() => { discussInsightInAsk(counselExpanded); setCounselExpanded(null); }}
                    className="px-3 py-1.5 tracking-[0.2em] text-[10px] uppercase transition flex items-center gap-1.5"
                    style={{background:'var(--ink)', color:'var(--cream)'}}
                  >
                    <Icon name="MessageCircle" size={11} /> Discuss in Ask
                  </button>
                </div>
              </div>
            </Modal>
          )}
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
