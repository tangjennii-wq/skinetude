// === StickyModalFooter (Wave 1.3 UI primitive — extracted May 2026) ===
// Module-scope, no React state coupling. Lifted out of index.jsx.source
// so primitives can be reasoned about + reused without scrolling the sidecar.

// === StickyModalFooter (Phase 2 primitive) ===
// Bottom footer pinned to a modal. Two patterns:
//   children passed directly — render whatever
//   primary + cancel props — auto-render a Cancel + primary button row
const StickyModalFooter = ({ children, primary, cancel, className = '' }) => {
  if (primary || cancel) {
    return (
      <div className={`px-4 py-3 border-t flex items-center gap-2 ${className}`} style={{borderColor: 'var(--line)', background: 'var(--cream-deep)'}}>
        {cancel && (
          <button
            type="button"
            onClick={cancel.onClick}
            className="text-[10px] tracking-[0.18em] uppercase px-3 py-2.5 transition hover:opacity-70"
            style={{color: 'var(--ink-soft)', fontWeight: T.weight.semibold, cursor: 'pointer'}}
          >{cancel.label || 'Cancel'}</button>
        )}
        {primary && (
          <Button
            variant="primary"
            onClick={primary.onClick}
            icon={primary.icon}
            trailingIcon={primary.trailingIcon}
            maxWidth={primary.maxWidth || 9999}
            fullWidth
          >{primary.label}</Button>
        )}
      </div>
    );
  }
  return (
    <div className={`px-4 py-3 border-t ${className}`} style={{borderColor: 'var(--line)', background: 'rgba(252,250,247,0.96)', backdropFilter: 'blur(6px)'}}>
      {children}
    </div>
  );
};
