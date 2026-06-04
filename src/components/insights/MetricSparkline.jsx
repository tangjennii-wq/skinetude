// === MetricSparkline (Insights — May 2026) ===
// Small SVG line chart for a single metric across N weeks.
// Mobile-first 380px. No external chart lib. Values are 0-100 (higher
// is better for ALL metrics — the score map already inverts redness +
// breakouts). Nulls render as gaps with a soft dotted segment.

const MetricSparkline = ({
  label,
  values,        // [number|null, ...]
  weekLabels,    // ['3w ago', '2w ago', ...]
  tone = 'ink',  // 'ink' | 'accent' | 'blue' | 'gold'
}) => {
  const W = 152;       // chart inner width (fits 2-col grid at 380px)
  const H = 56;        // chart inner height
  const PAD_X = 6;
  const PAD_Y = 8;
  const n = values.length;
  const xFor = (i) => n <= 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (n - 1);
  const yFor = (v) => PAD_Y + (1 - v / 100) * (H - PAD_Y * 2);
  const stroke = tone === 'accent' ? 'var(--accent)'
    : tone === 'blue' ? 'var(--accent-blue)'
    : tone === 'gold' ? 'var(--gold)'
    : 'var(--ink)';
  // Build path from contiguous non-null segments. Gaps become dotted.
  const segments = [];
  let cur = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) { segments.push({ kind: 'solid', pts: cur }); cur = []; }
    } else {
      cur.push({ x: xFor(i), y: yFor(v) });
    }
  });
  if (cur.length) segments.push({ kind: 'solid', pts: cur });
  // Dotted bridge between disjoint segments.
  const bridges = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i].pts[segments[i].pts.length - 1];
    const b = segments[i + 1].pts[0];
    bridges.push({ a, b });
  }
  const latest = [...values].reverse().find(v => v != null);
  const earliest = values.find(v => v != null);
  const delta = (latest != null && earliest != null && latest !== earliest)
    ? latest - earliest : null;
  const arrow = delta == null ? null : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  // June 2026 cleanup: dropped --rose (not in locked AWW palette). Up/down/
  // null all neutralize to --ink-soft; the arrow itself carries direction.
  // Avoids implying up=good / down=bad — matches no-causal-claims rule.
  const deltaColor = 'var(--ink-soft)';
  const noData = values.every(v => v == null);
  return (
    <div className="rounded-[14px] px-3 py-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{label}</div>
        {!noData && latest != null && (
          <div className="text-[10px] flex items-baseline gap-1" style={{color:'var(--ink)', fontWeight:600}}>
            <span>{latest}</span>
            {delta != null && (
              <span className="text-[9px]" style={{color: deltaColor}}>{arrow}{Math.abs(delta)}</span>
            )}
          </div>
        )}
      </div>
      {noData ? (
        <div className="text-[10px] text-center py-4" style={{color:'var(--ink-soft)'}}>
          No readings yet
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{display:'block'}}>
          {/* baseline at neutral mid (55) */}
          <line
            x1={PAD_X} x2={W - PAD_X}
            y1={yFor(55)} y2={yFor(55)}
            stroke="var(--line)"
            strokeDasharray="2 3"
            strokeWidth="1"
          />
          {bridges.map((b, i) => (
            <line key={`b${i}`} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y}
              stroke={stroke} strokeOpacity="0.35"
              strokeWidth="1.25" strokeDasharray="2 3" strokeLinecap="round" />
          ))}
          {segments.map((seg, i) => (
            seg.pts.length === 1 ? null : (
              <polyline key={`s${i}`}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={seg.pts.map(p => `${p.x},${p.y}`).join(' ')}
              />
            )
          ))}
          {segments.flatMap((seg, si) => seg.pts.map((p, i) => (
            <circle key={`d${si}-${i}`} cx={p.x} cy={p.y} r="2.25"
              fill={stroke} stroke="var(--cream-deep)" strokeWidth="1" />
          )))}
        </svg>
      )}
      {!noData && weekLabels && weekLabels.length === values.length && (
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[8px]" style={{color:'var(--ink-soft)'}}>{weekLabels[0]}</span>
          <span className="text-[8px]" style={{color:'var(--ink-soft)'}}>{weekLabels[weekLabels.length - 1]}</span>
        </div>
      )}
    </div>
  );
};
