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
}) => {
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
  const insightCardDefs = [
    { id: 'trajectory',         title: 'Skin trajectory',     subtitle: 'Slope, turning points, what changed.',           icon: 'TrendingUp' },
    { id: 'productPerformance', title: 'Product performance', subtitle: 'Co-occurrence with your best and worst days.',   icon: 'Sparkles', deepGate: photoEntryCount < 30 },
    { id: 'concernPatterns',    title: 'Concern patterns',    subtitle: 'Top recurring concerns and when they flare.',    icon: 'AlertCircle' },
    { id: 'routineAudit',       title: 'Routine audit',       subtitle: 'Coverage, redundancies, conflicts, evidence.',   icon: 'CheckCircle2' },
    ...(hormonalContext === 'cycling'
      ? [{ id: 'cycleMap',      title: 'Cycle map',           subtitle: 'Phase-by-phase rating + concern patterns.',      icon: 'CircleDot' }]
      : []),
    { id: 'whatsNext',          title: 'What’s next',    subtitle: 'A 30-day forecast and one suggested move.',       icon: 'ArrowRight' },
  ];
  const expanded = counselExpanded ? counselInsights[counselExpanded] : null;
  const expandedDef = counselExpanded ? insightCardDefs.find(c => c.id === counselExpanded) : null;
  return (
    <div>
      <SectionHeader title="Counsel" subtitle="Evidence-based reads on your data — and a chat that knows you." />

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insightCardDefs.map(def => {
              const cached = counselInsights[def.id];
              const generating = !!counselGenerating[def.id];
              const preview = cached?.content
                ? cached.content.split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 220)
                : null;
              return (
                <div key={def.id} className="border flex flex-col" style={{background:'var(--cream)', borderColor:'var(--line)'}}>
                  <div className="px-4 py-3 border-b flex items-center justify-between gap-2" style={{borderColor:'var(--line)'}}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name={def.icon} size={14} style={{color:'var(--accent)'}} />
                      <h3 className="font-serif italic text-base leading-tight truncate" style={{color:'var(--ink)'}}>{def.title}</h3>
                    </div>
                    {cached && (
                      <span className="text-[8px] tracking-[0.2em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)'}}>{fmtRelative(cached.generatedAt)}</span>
                    )}
                  </div>
                  <div className="px-4 py-3 flex-1 flex flex-col gap-3">
                    <p className="text-[11px] tracking-[0.05em]" style={{color:'var(--ink-soft)'}}>{def.subtitle}</p>
                    {def.deepGate && (
                      <div className="text-[9px] tracking-[0.2em] uppercase italic px-2 py-1 inline-block self-start" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                        Simple mode · deep at 30 photos ({photoEntryCount}/30)
                      </div>
                    )}
                    {preview ? (
                      <p className="font-serif italic text-[12px] leading-snug line-clamp-3" style={{color:'var(--ink)'}}>{preview}…</p>
                    ) : (
                      <p className="font-serif italic text-[12px] leading-snug" style={{color:'var(--ink-soft)'}}>{generating ? 'Drawing your read…' : 'Tap Generate to draw this read from your data.'}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        {cached ? (
                          <button
                            onClick={() => setCounselExpanded(def.id)}
                            className="text-[10px] tracking-[0.2em] uppercase italic"
                            style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)'}}
                          >Read full</button>
                        ) : (
                          <button
                            onClick={() => handleGenerateCounselInsight(def.id)}
                            disabled={generating}
                            className="px-3 py-1.5 tracking-[0.2em] text-[10px] uppercase transition flex items-center gap-1.5 disabled:opacity-50"
                            style={{background:'var(--ink)', color:'var(--cream)'}}
                          >
                            {generating ? <><Icon name="Loader2" size={11} className="spin" /> Generating…</> : <><Icon name="Sparkles" size={11} /> Generate</>}
                          </button>
                        )}
                      </div>
                      {cached && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGenerateCounselInsight(def.id)}
                            disabled={generating}
                            className="text-[9px] tracking-[0.2em] uppercase italic disabled:opacity-50"
                            style={{color:'var(--ink-soft)'}}
                            title="Regenerate"
                          >
                            {generating ? <Icon name="Loader2" size={10} className="spin" /> : 'Refresh'}
                          </button>
                          <span style={{color:'var(--line)'}}>·</span>
                          <button
                            onClick={() => discussInsightInAsk(def.id)}
                            className="text-[9px] tracking-[0.2em] uppercase italic"
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

          {/* Footer note about data sources */}
          <p className="text-[9px] tracking-[0.2em] uppercase italic mt-6 text-center" style={{color:'var(--ink-soft)'}}>
            Insights derive from your check-ins + photo logs · not your shelf inventory
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
                <div className="flex items-center gap-3 pt-3 border-t" style={{borderColor:'var(--line)'}}>
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
              <button onClick={clearInsightChat} className="text-[10px] tracking-[0.2em] uppercase italic" style={{color:'var(--ink-soft)'}}>New conversation</button>
            )}
          </div>
          {/* Conversation thread */}
          {insightMessages.length === 0 ? (
            <div className="border p-12 text-center" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
              <Icon name="Sparkles" size={28} className="mx-auto mb-4 opacity-40" />
              <h3 className="font-serif text-2xl italic mb-2" style={{color:'var(--ink)'}}>Ask anything</h3>
              <p className="text-sm font-light max-w-md mx-auto" style={{color:'var(--ink-soft)'}}>Your counsel knows your full journal, products, procedures, and color profile — and reasons only from what you've actually been using.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8 max-w-3xl mx-auto">
                {[
                  "What patterns do you see in my journal?",
                  "Are my products evidence-based?",
                  "What's likely causing my breakouts?",
                  "Audit my current routine.",
                  "How do I improve my skin barrier?",
                  "What should I add for my top concern?",
                ].map(q => (
                  <button key={q} onClick={() => handleInsight(q)} className="border p-4 text-left text-sm font-light italic transition hover:border-[var(--ink)]" style={{background:'var(--cream)', borderColor:'var(--line)', color:'var(--ink)'}}>"{q}"</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="border p-5 md:p-6 space-y-4" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
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
          <div className="mt-4 border" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
            <textarea autoCapitalize="off" autoCorrect="off" spellCheck={false}
              value={insightQuery}
              onChange={e => setInsightQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInsight(); } }}
              placeholder={insightMessages.length === 0 ? "What would you like to ask?" : "Continue the conversation…"}
              rows="2"
              className="w-full px-3 py-2.5 border-0 focus:outline-none font-light italic resize-none text-xs"
              style={{background:'transparent', color:'var(--ink)', minHeight:'56px', maxHeight:'56px'}}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t" style={{borderColor:'var(--line)'}}>
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
