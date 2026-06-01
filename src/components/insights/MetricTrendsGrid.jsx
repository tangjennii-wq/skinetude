// === MetricTrendsGrid (Insights — May 2026) ===
// 2x2 grid of MetricSparkline tiles (mobile, 380px) → 4-up on md.
// Pulls trends from computeMetricTrends. One focal point per tile.

const MetricTrendsGrid = ({ logs }) => {
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
            Weekly averages. Dotted line is the neutral middle.
          </div>
        </div>
        {hasAnyData && (
          <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>
            {data.totals.entryCount} {data.totals.entryCount === 1 ? 'reading' : 'readings'}
          </div>
        )}
      </div>
      {hasAnyData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {data.metrics.map(m => (
            <MetricSparkline
              key={m}
              label={data.labels[m]}
              values={data.series[m]}
              weekLabels={weekLabels}
              tone={tones[m] || 'ink'}
            />
          ))}
        </div>
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
