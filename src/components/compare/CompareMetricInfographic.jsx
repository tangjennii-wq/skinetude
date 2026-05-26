// === CompareMetricInfographic (Wave 3.4 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const CompareMetricInfographic = ({ before, after, ratingDelta = null, daysApart = null }) => {
  const beforeSnap = before?.metricSnapshot || null;
  const afterSnap = after?.metricSnapshot || null;
  const metricFor = (key) => {
    const word = compareNormalizeWord(key, afterSnap?.[key]);
    if (!word) return { label: key, level: null, dir: null, pct: null, color: 'var(--ink-soft)' };
    const priorWord = compareNormalizeWord(key, beforeSnap?.[key]);
    const score = COMPARE_SCORE_MAP[key][word];
    const priorScore = priorWord ? COMPARE_SCORE_MAP[key][priorWord] : null;
    const kind = COMPARE_METRIC_KIND[key];
    let pct = null, dir = null, color = 'var(--ink-soft)';
    if (priorScore != null && priorScore !== score) {
      const rawDelta = ((score - priorScore) / priorScore) * 100;
      pct = Math.min(99, Math.round(Math.abs(rawDelta)));
      const improving = score > priorScore;
      if (improving) {
        dir = kind === 'pos' ? 'up' : 'down';
        color = 'var(--sage)';
      } else {
        dir = kind === 'pos' ? 'down' : 'up';
        color = 'var(--rose)';
      }
    }
    return { level: word, dir, pct, color };
  };
  const metricSpec = [
    { key: 'redness',   label: 'Redness',   ...metricFor('redness') },
    { key: 'hydration', label: 'Hydration', ...metricFor('hydration') },
    { key: 'texture',   label: 'Texture',   ...metricFor('texture') },
    { key: 'breakouts', label: 'Breakouts', ...metricFor('breakouts') },
  ];
  // If neither snapshot exists, render a quiet placeholder so the layout still feels intentional.
  const hasAny = metricSpec.some(m => m.level);
  return (
    <div className="rounded-[16px] px-4 py-4 md:px-5 md:py-5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>Skin shift</div>
        {(daysApart != null || ratingDelta != null) && (
          <div className="text-[10px] tracking-[0.18em] uppercase italic flex items-center gap-3" style={{color:'var(--ink-soft)'}}>
            {daysApart != null && <span>{daysApart} {daysApart === 1 ? 'day' : 'days'} apart</span>}
            {ratingDelta != null && (
              <span style={{color: ratingDelta > 0 ? 'var(--sage)' : ratingDelta < 0 ? 'var(--rose)' : 'var(--ink-soft)'}}>
                Rating {ratingDelta > 0 ? '+' : ''}{ratingDelta}
              </span>
            )}
          </div>
        )}
      </div>
      {hasAny ? (
        <div className="grid grid-cols-4 gap-2 md:gap-3">
          {metricSpec.map(m => (
            <div key={m.key} className="text-center">
              <div className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>{m.label}</div>
              <div className="font-serif italic text-[18px] md:text-[20px] leading-tight" style={{color: m.level ? 'var(--ink)' : 'var(--ink-soft)'}}>
                {m.level || '—'}
              </div>
              <div className="text-[10px] tracking-[0.05em] mt-0.5 flex items-center justify-center gap-0.5" style={{color: m.color}}>
                {m.dir && <span>{m.dir === 'up' ? '↑' : '↓'}</span>}
                <span>{m.pct != null ? `${m.pct}%` : (m.level ? '—' : '·')}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] italic text-center py-2" style={{color:'var(--ink-soft)'}}>
          No metric snapshots on these photos yet — Skin Reads will fill in once both photos have analyses.
        </p>
      )}
    </div>
  );
};
