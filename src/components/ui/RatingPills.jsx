// === RatingPills (Wave 1.3 UI primitive — extracted May 2026) ===
// Module-scope, no React state coupling. Lifted out of index.jsx.source
// so primitives can be reasoned about + reused without scrolling the sidecar.

const RatingPills = ({ value, onChange, labels = RATING_5_LABELS, max = 5 }) => (
  <div className="relative">
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map(n => {
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className="flex-1 flex items-center justify-center transition"
            style={{
              height: 32,
              borderRadius: T.radius.pill,
              background: on ? 'var(--accent)' : 'var(--cream-deep)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
              color: on ? 'var(--cream)' : 'var(--ink-soft)',
              fontWeight: on ? T.weight.bold : T.weight.semibold,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
            aria-label={`Rate ${n} of ${max}`}
            title={labels[n] || `${n}`}
          >{n}</button>
        );
      })}
    </div>
    <div className={`grid grid-cols-${max} mt-1.5 px-0.5`} style={{display: 'grid', gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))`}}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => {
        const w = labels[n];
        const focused = value === n;
        return (
          <div key={n} className="text-center" style={{ visibility: w ? 'visible' : 'hidden' }}>
            <div style={{
              fontSize: 9.5,
              color: focused ? 'var(--accent)' : 'var(--ink-soft)',
              fontWeight: focused ? T.weight.bold : T.weight.medium,
              letterSpacing: '0.04em',
              transition: 'color 0.15s',
            }}>{w || ''}</div>
          </div>
        );
      })}
    </div>
  </div>
);
