// === ModalHeader (Wave 1.3 UI primitive — extracted May 2026) ===
// Module-scope, no React state coupling. Lifted out of index.jsx.source
// so primitives can be reasoned about + reused without scrolling the sidecar.

// === ModalHeader (Phase 2 primitive) ===
// Eyebrow + title + close-button (or back-arrow) pattern. Optional
// trailing slot for date stickers, edit links, etc. Used by every
// floating modal (CheckInDetailsModal, AddPhotoModal, ContextSheet,
// SampleRoutinePreview, exit confirmations).
//   variant='back'  — left-aligned back-arrow + title block
//   variant='close' — eyebrow + title, X button top-right
const ModalHeader = ({ eyebrow, title, subtitle, onClose, trailing, variant = 'close', closeLabel = 'Close', className = '' }) => {
  if (variant === 'back') {
    return (
      <div className={`flex items-center gap-3 px-4 pt-4 pb-2 ${className}`}>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 -ml-1 p-1 transition hover:opacity-70"
          style={{color: 'var(--ink-soft)', cursor: 'pointer'}}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon name="ArrowLeft" size={16} />
        </button>
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div style={{
              fontSize: 9.5,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              fontWeight: T.weight.semibold,
              color: 'var(--ink-soft)',
            }}>{eyebrow}</div>
          )}
          {title && (
            <h3 style={{
              fontSize: 18, lineHeight: 1.2, marginTop: 2,
              color: 'var(--ink)', fontWeight: T.weight.bold,
              letterSpacing: '-0.014em',
            }}>{title}</h3>
          )}
          {subtitle && (
            <p style={{fontSize: 11.5, lineHeight: 1.4, marginTop: 6, color: 'var(--ink-soft)'}}>{subtitle}</p>
          )}
        </div>
        {trailing}
      </div>
    );
  }
  return (
    <div className={`px-5 pt-5 pb-3 border-b ${className}`} style={{borderColor: 'var(--line)'}}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div style={{
              fontSize: 9,
              letterSpacing: '0.26em',
              textTransform: 'uppercase',
              fontWeight: T.weight.semibold,
              color: 'var(--accent)',
              marginBottom: 6,
            }}>{eyebrow}</div>
          )}
          {title && (
            <h3 style={{
              fontSize: 18, lineHeight: 1.2,
              color: 'var(--ink)', fontWeight: T.weight.bold,
              letterSpacing: '-0.014em',
            }}>{title}</h3>
          )}
          {subtitle && (
            <p style={{fontSize: 11.5, lineHeight: 1.4, marginTop: 6, color: 'var(--ink-soft)'}}>{subtitle}</p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition hover:bg-[var(--cream-deep)]"
            style={{color: 'var(--ink-soft)', cursor: 'pointer'}}
            aria-label={closeLabel}
          >
            <Icon name="X" size={14} />
          </button>
        )}
        {!onClose && trailing}
      </div>
    </div>
  );
};
