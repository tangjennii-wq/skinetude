// === Button (Wave 1.3 UI primitive — extracted May 2026) ===
// Module-scope, no React state coupling. Lifted out of index.jsx.source
// so primitives can be reasoned about + reused without scrolling the sidecar.

// === Button (Phase 1 primitive) ===
// Three variants:
//   primary   — terracotta fill, uppercase tracking, used as dominant CTA
//   secondary — outlined cream/ink, used as alternate CTA
//   tertiary  — text-only terracotta link with optional arrow
// All pills are nowrap + capped at maxWidth (default 260) so they
// don't sprawl in horizontal layouts.
const Button = ({ children, onClick, variant = 'primary', icon, trailingIcon, maxWidth = 260, height, fullWidth = true, ...rest }) => {
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--cream)',
      border: '1px solid var(--accent)',
      fontWeight: T.weight.semibold,
      fontSize: 11,
      letterSpacing: T.tracking.cta,
      textTransform: 'uppercase',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
      fontWeight: T.weight.mediumPlus,
      fontSize: 10.5,
      letterSpacing: T.tracking.cta,
      textTransform: 'uppercase',
    },
    tertiary: {
      background: 'transparent',
      color: 'var(--accent)',
      border: 'none',
      fontWeight: T.weight.semibold,
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      padding: '4px 0',
    },
  };
  const v = variants[variant] || variants.primary;
  const h = height || (variant === 'tertiary' ? 'auto' : T.buttonHeight[variant === 'primary' ? 'primary' : 'secondary']);
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center transition hover:brightness-95"
      style={{
        ...v,
        height: h,
        width: fullWidth ? '100%' : 'auto',
        maxWidth,
        gap: 7,
        padding: variant === 'tertiary' ? v.padding : '0 16px',
        borderRadius: T.radius.pill,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={12} />}
      <span>{children}</span>
      {trailingIcon && <Icon name={trailingIcon} size={11} />}
    </button>
  );
};
