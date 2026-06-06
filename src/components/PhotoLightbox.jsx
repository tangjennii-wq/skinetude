// === PhotoLightbox (June 2026 per Jenni) ===
// Generic tap-to-zoom modal used across Compare / Journal / Read Analysis.
// Two render modes derived from the `photos` array length:
//   - 1 photo  → single full-bleed view (centered, max-width container)
//   - 2 photos → side-by-side pair (Before/After, kept editorial — same
//                rounded shells as the in-page cards, just bigger)
//
// Each photo entry: { src, label?, sub?, area?, score? }
//   src   — image URL or data URL (required)
//   label — eyebrow text (e.g. "Before" / "After · today")
//   sub   — primary caption (e.g. formatted date)
//   area  — small meta line (e.g. "full face")
//   score — composite score 0-10 (renders as ✦ N/10 if present)
//
// Backdrop tap or X button closes. ESC also closes (handler in useEffect).
// Mobile-first 380px; on md+ the pair grid scales up gracefully.

const PhotoLightbox = ({ photos = [], onClose }) => {
  // ESC to close
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const list = (Array.isArray(photos) ? photos : []).filter(p => p && p.src);
  if (list.length === 0) return null;
  const isPair = list.length >= 2;
  const renderCaption = (p) => (
    <div className="px-3 py-2.5 flex items-baseline justify-between gap-2" style={{background:'var(--cream)'}}>
      <div className="min-w-0">
        {p.label && (
          <div className="text-[9.5px] tracking-[0.28em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:650}}>{p.label}</div>
        )}
        {p.sub && (
          <div className="text-[14px] leading-tight" style={{color:'var(--ink)', fontWeight:600}}>{p.sub}</div>
        )}
        {(p.area || (typeof p.score === 'number' && p.score > 0)) && (
          <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
            {(p.area || '').replace(/-/g, ' ')}
            {(p.area && typeof p.score === 'number' && p.score > 0) ? ' · ' : ''}
            {typeof p.score === 'number' && p.score > 0 ? <><span style={{color:'var(--accent)'}}>✦</span> {p.score}/10</> : null}
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
      style={{background:'rgba(20,18,16,0.78)', backdropFilter:'blur(6px)'}}
      role="dialog"
      aria-label="Photo view"
    >
      {/* Close button — top-right of viewport so it's always findable */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo view"
        className="absolute top-3 right-3 md:top-5 md:right-5 w-9 h-9 rounded-full flex items-center justify-center transition hover:opacity-80"
        style={{background:'var(--cream)', color:'var(--ink)', cursor:'pointer', border:'1px solid var(--line)'}}
      >
        <Icon name="X" size={14} />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className={isPair
          ? 'w-full max-w-[920px] grid grid-cols-2 gap-2 md:gap-3'
          : 'w-full max-w-[640px]'}
      >
        {list.slice(0, 2).map((p, i) => (
          <div
            key={i}
            className="rounded-[18px] overflow-hidden"
            style={{background:'var(--cream)', border:'1.5px solid var(--accent)', boxShadow:'0 6px 28px rgba(0,0,0,0.25)'}}
          >
            <div className="overflow-hidden" style={{background:'var(--cream-deep)', aspectRatio:'4 / 5'}}>
              <img
                src={p.src}
                alt={p.label || 'Skin photo'}
                className="w-full h-full object-cover"
                style={{display:'block'}}
              />
            </div>
            {renderCaption(p)}
          </div>
        ))}
      </div>
    </div>
  );
};
