// === Chip (Wave 1.3 UI primitive — extracted May 2026) ===
// Module-scope, no React state coupling. Lifted out of index.jsx.source
// so primitives can be reasoned about + reused without scrolling the sidecar.

// === Chip (Phase 1 primitive) ===
// Selectable pill button. Used for "What did you notice?" tags,
// context factors, conditions, Rx history, etc. Standardizes the
// rounded-full filled/outlined pattern.
const Chip = ({ children, active = false, onClick, size = 'md', ...rest }) => {
  const sizes = {
    sm: { fontSize: 10.5, padding: '4px 10px' },
    md: { fontSize: 11.5, padding: '5px 12px' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full transition"
      style={{
        ...s,
        background: active ? 'var(--surface-selected)' : 'var(--surface-card)',
        color: active ? 'var(--accent)' : 'var(--ink)',
        border: `1px solid ${active ? 'var(--border-mid)' : 'var(--line)'}`,
        fontWeight: active ? T.weight.semibold : T.weight.medium,
        letterSpacing: '-0.005em',
        cursor: 'pointer',
        lineHeight: 1.25,
      }}
      {...rest}
    >{children}</button>
  );
};
