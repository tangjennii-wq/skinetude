// === MetricTrendsList (Insights — June 2026, post-critic redesign) ===
// Replaces MetricTrendsGrid (2x2 sparkline tiles). Matches the Signals
// row paradigm — one collapsible row per metric. Collapsed: dot + name +
// inline mini-sparkline + current value + delta + chevron. Tap to expand
// to the full-width MetricSparkline with week labels.
//
// Why the redesign:
//   - Stratechery critic: trends + signals are the two MUST panels for
//     the retrospective "how has my skin moved" job.
//   - Design critic: 2x2 sparkline grid was four watchface-sized charts
//     at 9px labels — chartjunk. The narrative ("Redness, settling")
//     reads better as one line than four thumbnails.
// Result: canonical Insights render shape = collapsible row list.
// Visual matches SignalsPanel exactly so the tab reads as one paradigm.
//
// Mini sparkline lives inline in the row. Tones are per-metric (accent
// for redness, blue for hydration, ink for texture, gold for breakouts)
// to match SignalsPanel's signal tones — palette-clean.

const MetricTrendsRow = ({ label, values, weekLabels, tone }) => {
  const [expanded, setExpanded] = React.useState(false);
  const dotColor = tone === 'accent' ? 'var(--accent)'
    : tone === 'blue' ? 'var(--accent-blue)'
    : tone === 'gold' ? 'var(--gold)'
    : 'var(--ink)';
  const latest = [...values].reverse().find(v => v != null);
  const earliest = values.find(v => v != null);
  const delta = (latest != null && earliest != null && latest !== earliest)
    ? latest - earliest : null;
  const arrow = delta == null ? null : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const noData = values.every(v => v == null);

  // === Inline mini-sparkline geometry (compact, fits the row) ===
  // Same segment/null-bridge logic as MetricSparkline but smaller and
  // without the baseline reference line or week labels. Tap-to-expand
  // shows the full version.
  const W = 64, H = 16, PAD_X = 2, PAD_Y = 2;
  const n = values.length;
  const xFor = (i) => n <= 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (n - 1);
  const yFor = (v) => PAD_Y + (1 - v / 100) * (H - PAD_Y * 2);
  const segments = [];
  let cur = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) { segments.push(cur); cur = []; }
    } else {
      cur.push({ x: xFor(i), y: yFor(v) });
    }
  });
  if (cur.length) segments.push(cur);

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left flex items-center gap-2 px-3 py-2.5"
        style={{cursor:'pointer'}}
        aria-expanded={expanded}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background: dotColor}} />
        <span className="text-[12px] flex-1 min-w-0" style={{color:'var(--ink)', fontWeight:650}}>
          {label}
        </span>
        {!noData && (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{flexShrink:0}}>
            {segments.map((pts, i) => pts.length === 1 ? null : (
              <polyline key={i}
                fill="none"
                stroke={dotColor}
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              />
            ))}
          </svg>
        )}
        {!noData && latest != null && (
          <span className="text-[10px] flex items-baseline gap-1 flex-shrink-0" style={{color:'var(--ink)', fontWeight:600}}>
            <span>{latest}</span>
            {delta != null && (
              <span className="text-[9px]" style={{color:'var(--ink-soft)'}}>{arrow}{Math.abs(delta)}</span>
            )}
          </span>
        )}
        {noData && (
          <span className="text-[9px] flex-shrink-0" style={{color:'var(--ink-soft)'}}>—</span>
        )}
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={12} style={{color:'var(--ink-soft)', flexShrink:0}} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <MetricSparkline
            label={label}
            values={values}
            weekLabels={weekLabels}
            tone={tone}
          />
        </div>
      )}
    </li>
  );
};

const MetricTrendsList = ({ logs }) => {
  const data = computeMetricTrends(logs || [], 4);
  const weekLabels = data.weeks.map(w => w.label);
  const tones = { redness: 'accent', hydration: 'blue', texture: 'ink', breakouts: 'gold' };
  const hasAnyData = data.totals.entryCount > 0;
  return (
    <section className="mb-7">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>
            Four-week trends
          </div>
          <div className="text-[12px] mt-1" style={{color:'var(--ink-soft)'}}>
            Weekly averages. Tap a row to open the chart.
          </div>
        </div>
        {hasAnyData && (
          <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>
            {data.totals.entryCount} {data.totals.entryCount === 1 ? 'reading' : 'readings'}
          </div>
        )}
      </div>
      {hasAnyData ? (
        <ul className="rounded-[14px] divide-y" style={{background:'var(--cream-deep)', border:'1px solid var(--line)', borderColor:'var(--line)'}}>
          {data.metrics.map(m => (
            <MetricTrendsRow
              key={m}
              label={data.labels[m]}
              values={data.series[m]}
              weekLabels={weekLabels}
              tone={tones[m] || 'ink'}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-[14px] px-4 py-6 text-center" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>
            Trends fill in once you have a few check-ins with photos. Keep going.
          </p>
        </div>
      )}
    </section>
  );
};
