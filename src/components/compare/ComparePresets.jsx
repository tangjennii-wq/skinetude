// === ComparePresets (Wave 3.4 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

// Compare presets — automatically pairs the most recent photo log with one from a target
// time-window in the past (1 week, 1 month, 2/3/6/12 months ago). Each card shows two
// photos, the rating swing, product changes in the window, and an on-demand AI analysis
// that's cached per pair in localStorage so re-opening doesn't burn API calls.
const ComparePresets = ({ logs, products, procedures, regimenLogs = [], callClaude, setShowApiKeyModal, onOpenLesson, enterCompare, onCompareProduct }) => {
  const hasPhoto = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
  const photoLogs = logs.filter(hasPhoto).sort((a, b) => new Date(b.date) - new Date(a.date));

  const [analysisByKey, setAnalysisByKey] = useState({});
  const [loadingByKey, setLoadingByKey] = useState({});

  // Find the photo log closest to a target date (within ±maxDaysWindow), preferring same area
  const findClosestLog = (targetDate, anchorArea, maxDaysWindow = 14) => {
    const candidates = photoLogs.map(l => ({
      log: l,
      diffDays: Math.abs((new Date(l.date) - targetDate) / 86400000),
      sameArea: l.area === anchorArea})).filter(c => c.diffDays <= maxDaysWindow);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      if (a.sameArea && !b.sameArea) return -1;
      if (!a.sameArea && b.sameArea) return 1;
      return a.diffDays - b.diffDays;
    });
    return candidates[0].log;
  };

  if (photoLogs.length < 2) {
    return <EmptyState icon="Eye" text="Log at least two entries with photos to use Compare." />;
  }

  const anchor = photoLogs[0]; // most recent photo log
  const anchorDate = new Date(anchor.date);
  // Week-start vs week-end: the most-recent-in-week and earliest-in-week within the past 7 days
  const weekStart = new Date(anchorDate.getTime() - 6 * 86400000);
  const weekRange = photoLogs.filter(l => new Date(l.date) >= weekStart && new Date(l.date) <= anchorDate);
  const weekEarliest = weekRange.length >= 2 ? weekRange[weekRange.length - 1] : null;

  const presets = [
    weekEarliest && weekEarliest.id !== anchor.id ? { label: 'This week', subtitle: 'start vs. end', earlier: weekEarliest, later: anchor } : null,
    { label: '1 month ago', subtitle: 'today vs. 30 days back', earlier: findClosestLog(new Date(anchorDate.getTime() - 30 * 86400000), anchor.area, 10), later: anchor },
    { label: '2 months ago', subtitle: 'today vs. 60 days back', earlier: findClosestLog(new Date(anchorDate.getTime() - 60 * 86400000), anchor.area, 14), later: anchor },
    { label: '3 months ago', subtitle: 'today vs. 90 days back', earlier: findClosestLog(new Date(anchorDate.getTime() - 90 * 86400000), anchor.area, 21), later: anchor },
    { label: '6 months ago', subtitle: 'today vs. 180 days back', earlier: findClosestLog(new Date(anchorDate.getTime() - 180 * 86400000), anchor.area, 30), later: anchor },
    { label: '1 year ago', subtitle: 'today vs. 365 days back', earlier: findClosestLog(new Date(anchorDate.getTime() - 365 * 86400000), anchor.area, 45), later: anchor },
  ].filter(p => p && p.earlier && p.later && p.earlier.id !== p.later.id);

  const cacheKey = (e, l) => `lumiere:compareAnalysis:${e.id}:${l.id}`;

  // Pre-load any cached analyses on mount
  useEffect(() => {
    presets.forEach(p => {
      const key = `${p.earlier.id}-${p.later.id}`;
      if (analysisByKey[key]) return;
      try {
        const cached = localStorage.getItem(cacheKey(p.earlier, p.later));
        if (cached) setAnalysisByKey(prev => ({ ...prev, [key]: cached }));
      } catch (_) {}
    });
  }, [presets.map(p => `${p.earlier.id}-${p.later.id}`).join(',')]);

  const runAnalysis = async (preset) => {
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    const key = `${preset.earlier.id}-${preset.later.id}`;
    setLoadingByKey(prev => ({ ...prev, [key]: true }));
    try {
      const earlier = preset.earlier;
      const later = preset.later;
      const days = Math.abs(Math.ceil((new Date(later.date) - new Date(earlier.date)) / 86400000));
      const productsAdded = products.filter(p => {
        const ps = new Date(p.startDate);
        return ps >= new Date(earlier.date) && ps <= new Date(later.date);
      }).map(p => `${p.name} (${p.activeIngredients || 'no actives listed'})`);
      const productsStopped = products.filter(p => {
        if (!p.endDate) return false;
        const pe = new Date(p.endDate);
        return pe >= new Date(earlier.date) && pe <= new Date(later.date);
      }).map(p => `${p.name}`);
      const proceduresBetween = procedures.filter(p => {
        const pd = new Date(p.date);
        return pd >= new Date(earlier.date) && pd <= new Date(later.date);
      }).map(p => `${p.name} on ${p.date}`);

      const earlierHasPhoto = hasPhoto(earlier);
      const laterHasPhoto = hasPhoto(later);

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

      const prompt = `Compare two skin journal entries from the same person, ${days} days apart.

EARLIER (${earlier.date}, ${earlier.area}, rated ${earlier.rating}/10):
- Concerns: ${earlier.concerns?.join(', ') || 'none'}
- Notes: ${earlier.notes || 'none'}

LATER (${later.date}, ${later.area}, rated ${later.rating}/10):
- Concerns: ${later.concerns?.join(', ') || 'none'}
- Notes: ${later.notes || 'none'}

Products added in this window: ${productsAdded.length ? productsAdded.join('; ') : 'none'}
Products stopped in this window: ${productsStopped.length ? productsStopped.join('; ') : 'none'}
Procedures during this window: ${proceduresBetween.length ? proceduresBetween.join('; ') : 'none'}

${(earlierHasPhoto && laterHasPhoto) ? 'Two photos provided. Describe visible differences in texture, redness, blemishes, hydration, and overall complexion.' : ''}

Format response in three short sections:
WHAT CHANGED: specific visible/reported differences
LIKELY DRIVERS: what factors likely contributed (products added/stopped, procedures, time)
NEXT STEPS: one or two specific evidence-based suggestions`;

      // === ROUTE THROUGH callClaude (May 2026 v2) ===
      // Centralized for the same reasons as CompareAnalysis above.
      let result;
      if (earlierHasPhoto && laterHasPhoto) {
        const before64 = await resolveB64(earlier);
        const after64 = await resolveB64(later);
        if (before64 && after64) {
          result = await callClaude(
            prompt,
            "You are an obsessed educational skin advisor (informational observation, not a diagnosis), comparing two photos of the same person's skin. Be specific and evidence-based.",
            null,
            {
              images: [
                { label: 'EARLIER photo:', b64: before64 },
                { label: 'LATER photo:',   b64: after64 },
              ]}
          );
        } else {
          result = await callClaude(prompt, '', null, { voice: true });
        }
      } else {
        result = await callClaude(prompt, '', null, { voice: true });
      }

      setAnalysisByKey(prev => ({ ...prev, [key]: result }));
      try { localStorage.setItem(cacheKey(earlier, later), result); } catch (_) {}
    } catch (e) {
      console.error('Compare analysis failed:', e);
    }
    setLoadingByKey(prev => ({ ...prev, [key]: false }));
  };

  // === BY PRODUCT ===
  // For each shelf product with enough usage data, surface a row that opens the shared
  // ProductCompareModal via onCompareProduct(productId). Eligibility uses the same
  // findProductCompareAnchors helper as the shelf view, so the two surfaces stay in sync.
  const byProductRows = (products || [])
    .filter(p => !p.endDate)
    .map(p => ({ product: p, anchors: findProductCompareAnchors(p, products, regimenLogs, logs) }))
    .filter(r => r.anchors.startDate) // any usage signal
    .sort((a, b) => (b.anchors.daysActive || 0) - (a.anchors.daysActive || 0));

  return (
    <div>
      <div className="text-sm font-light mb-8 max-w-2xl" style={{color:'var(--ink-soft)'}}>
        Pre-paired comparisons across time. Today's most recent reflection set against itself days, weeks, and months ago. Tap any card for an evidence-based read on what's changed.
      </div>

      {/* === BY PRODUCT === */}
      {byProductRows.length > 0 && (
        <div className="mb-12">
          <div className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>By product</div>
          <h3 className="font-sans text-2xl mb-5" style={{color:'var(--ink)'}}>Has anything changed since you started?</h3>
          <div className="border" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
            {byProductRows.map((row, idx) => {
              const { product, anchors } = row;
              const weeks = anchors.daysActive >= 7 ? `${Math.round(anchors.daysActive / 7)}w` : `${anchors.daysActive}d`;
              return (
                <div key={product.id} className="flex items-center gap-3 px-4 py-3" style={{borderTop: idx === 0 ? 'none' : '1px solid var(--line)'}}>
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-base leading-tight truncate" style={{color:'var(--ink)'}}>{product.name}</div>
                    <div className="text-[11px] font-light mt-0.5" style={{color:'var(--ink-soft)'}}>
                      {anchors.startSource === 'explicit' ? 'started' : 'first logged'} ~{weeks} ago · {anchors.photoCount} {anchors.photoCount === 1 ? 'photo' : 'photos'}
                    </div>
                  </div>
                  {anchors.hasEnoughData ? (
                    <button
                      onClick={() => onCompareProduct?.(product.id)}
                      className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1.5 transition hover:opacity-70 flex-shrink-0"
                      style={{color:'var(--accent)'}}
                    >
                      Compare <Icon name="ArrowRight" size={11} />
                    </button>
                  ) : (
                    <span className="text-[10px] flex-shrink-0" style={{color:'var(--ink-soft)'}}>{anchors.reasonShort}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-10">
        {presets.length === 0 && (
          <p className="font-sans text-xl" style={{color:'var(--ink-soft)'}}>Not enough history yet for these comparisons. Keep logging — they'll surface as your timeline grows.</p>
        )}
        {presets.map(preset => {
          const key = `${preset.earlier.id}-${preset.later.id}`;
          const analysis = analysisByKey[key];
          const loading = loadingByKey[key];
          const days = Math.abs(Math.ceil((new Date(preset.later.date) - new Date(preset.earlier.date)) / 86400000));
          const ratingDelta = +preset.later.rating - +preset.earlier.rating;
          const productsAdded = products.filter(p => {
            const ps = new Date(p.startDate);
            return ps >= new Date(preset.earlier.date) && ps <= new Date(preset.later.date);
          });
          const productsStopped = products.filter(p => {
            if (!p.endDate) return false;
            const pe = new Date(p.endDate);
            return pe >= new Date(preset.earlier.date) && pe <= new Date(preset.later.date);
          });
          return (
            <div key={key} className="border-t pt-8" style={{borderColor: 'var(--line)'}}>
              <div className="flex items-baseline justify-between gap-3 mb-5 flex-wrap">
                <div>
                  <div className="text-[10px] tracking-[0.4em] uppercase" style={{color:'var(--ink-soft)'}}>{preset.label}</div>
                  <h3 className="font-sans text-2xl mt-1" style={{color:'var(--ink)'}}>{preset.subtitle}</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{days} days · rating {ratingDelta > 0 ? '+' : ''}{ratingDelta}</div>
                  <button onClick={() => enterCompare?.(preset.earlier.id, preset.later.id)} className="text-[10px] tracking-[0.2em] uppercase mt-2" style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)'}}>Open side-by-side</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-6 mb-6 max-w-2xl">
                {[preset.earlier, preset.later].map((entry, i) => (
                  <div key={entry.id}>
                    <div className="text-[9px] md:text-[10px] tracking-[0.25em] md:tracking-[0.3em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>{i === 0 ? `Earlier · ${new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Later · ${new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</div>
                    <div className="aspect-square overflow-hidden">
                      <Photo item={entry} alt="" className="w-full h-full object-cover"
                        renderFallback={() => (
                          <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                            <span className="font-sans text-3xl md:text-5xl" style={{color:'var(--ink-soft)'}}>{entry.rating}</span>
                          </div>
                        )}
                      />
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-sans text-lg md:text-2xl" style={{color:'var(--ink)'}}>{entry.rating}<span className="text-xs" style={{color:'var(--ink-soft)'}}>/10</span></span>
                      {entry.concerns?.length > 0 && <span className="text-xs font-light" style={{color:'var(--ink-soft)'}}>{entry.concerns.slice(0, 3).join(' · ')}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {(productsAdded.length > 0 || productsStopped.length > 0) && (
                <div className="text-xs font-light leading-relaxed mb-4" style={{color:'var(--ink-soft)'}}>
                  {productsAdded.length > 0 && <span><span className="tracking-[0.15em] uppercase text-[10px] mr-1.5">+ Added</span>{productsAdded.map(p => p.name).join(', ')}</span>}
                  {productsAdded.length > 0 && productsStopped.length > 0 && <span> · </span>}
                  {productsStopped.length > 0 && <span><span className="tracking-[0.15em] uppercase text-[10px] mr-1.5">– Stopped</span>{productsStopped.map(p => p.name).join(', ')}</span>}
                </div>
              )}

              {analysis ? (
                <div className="mt-2 p-5 border" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-3 flex items-center gap-2" style={{color:'var(--accent)'}}>
                    <Icon name="Sparkles" size={11} style={{color:'var(--accent)'}} /> Frida analysis
                  </div>
                  <TaggedAnalysisBullets
                    text={formatAnalysisText(analysis)}
                    onOpen={onOpenLesson}
                    IconComponent={Icon}
                    withPearlsFn={withPearls}
                  />
                  <button onClick={() => runAnalysis(preset)} disabled={loading} className="mt-3 text-[10px] tracking-[0.2em] uppercase flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                    {loading ? <><Icon name="Loader2" size={11} className="spin" /> Re-running</> : <>Refresh analysis</>}
                  </button>
                </div>
              ) : (
                <button onClick={() => runAnalysis(preset)} disabled={loading} className="text-[10px] tracking-[0.2em] uppercase border px-4 py-2.5 disabled:opacity-50 flex items-center gap-2" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
                  {loading ? <><Icon name="Loader2" size={11} className="spin" /> Analyzing</> : <><Icon name="Sparkles" size={11} /> Analyze the difference</>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
