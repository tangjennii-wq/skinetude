// === Modal (Wave 1.3 UI primitive — extracted May 2026) ===
// Module-scope, no React state coupling. Lifted out of index.jsx.source
// so primitives can be reasoned about + reused without scrolling the sidecar.

// === ESC-TO-CLOSE (July 2026 Day 4) ===
// Module-level stack so stacked modals (e.g. ProductModal opened from the
// regimen editor) close one at a time, top-most first — a global listener
// per instance would close the whole stack on one keypress.
const __modalEscStack = [];

const Modal = ({ children, onClose, title, eyebrow, action, actionLabel, compact = false, elevated = false }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const id = {};
    __modalEscStack.push(id);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (__modalEscStack[__modalEscStack.length - 1] !== id) return; // only the top modal responds
      if (onCloseRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      const idx = __modalEscStack.indexOf(id);
      if (idx >= 0) __modalEscStack.splice(idx, 1);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
  // === Centered floating card (both mobile + desktop) ===
  // Modal floats in the middle of the page on every viewport. Capped at
  // 92dvh so the iOS keyboard doesn't push it past the visible area.
  // (The full-bleed bottom-sheet pattern is reserved for the SkinReadDrawer
  // — Modals stay editorial-card-style.)
  // `elevated` lifts this Modal above other Modals (z-1015 vs base z-50)
  // so a Modal opened from inside another Modal stacks correctly. Used by
  // ProductModal when launched from the regimen editor's "+ New Product".
  <div
    className={`fixed inset-0 ${elevated ? 'z-[1015]' : 'z-50'} flex items-center justify-center p-3 md:p-4`}
    style={{background:'rgba(28,25,23,0.5)', backdropFilter:'blur(4px)'}}
    onClick={onClose}
  >
    <div
      onClick={e => e.stopPropagation()}
      className="modal-card rounded-[20px] max-w-xl w-full overflow-y-auto shadow-2xl"
      style={{background:'var(--cream)', maxHeight:'92dvh'}}
    >
      <div className={`sticky top-0 border-b ${compact ? 'px-3 py-2 md:px-4 md:py-2.5' : 'px-4 py-3 md:px-6 md:py-4'} flex items-center justify-between gap-3 z-10`} style={{background:'var(--cream)', borderColor: 'var(--line)'}}>
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-0.5 truncate">{eyebrow}</Eyebrow>}
          <h2 className={`${compact ? 'text-[16px] md:text-[19px]' : 'text-[19px] md:text-[24px]'} font-sans leading-[1.1] tracking-tight truncate`} style={{color:'var(--ink)'}}>{title}</h2>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {action && actionLabel && (
            <button
              onClick={action}
              className="text-[10.5px] tracking-[0.18em] uppercase flex items-center gap-1 transition hover:opacity-70"
              style={{color:'var(--accent)'}}
            >
              {actionLabel} <Icon name="Check" size={11} />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition hover:opacity-90 cursor-pointer"
            style={{background:'var(--cream-deep)', border: '1px solid var(--line)', color:'var(--ink)', cursor:'pointer'}}
            aria-label="Close"
          >
            <span style={{display:'inline-block', width: 14, height: 14}} dangerouslySetInnerHTML={{__html: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`}} />
          </button>
        </div>
      </div>
      <div className={compact ? 'px-3 py-2.5 md:px-4 md:py-3' : 'px-4 py-4 md:p-6'}>{children}</div>
    </div>
  </div>
  );
};
