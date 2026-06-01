// === SplitHalfCompare (Wave 3.4 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

// Renders two photo entries as the left and right halves of a single image — a magazine-
// style before/after split. Photos are signed-URL fetched via the existing Photo wrapper;
// clip-path divides the frame at the midline. A small button between them swaps which side
// shows which entry.
// Full side-by-side compare — two photos in one row, no clip-path. Replaces the older half-face split.
const SplitHalfCompare = ({ before, after, onSwap, onClear }) => {
  if (!before || !after) return null;
  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {/* BEFORE — primary score is AI-derived; falls back to user rating only when no metricSnapshot exists */}
        <div className="relative aspect-[3/4] overflow-hidden" style={{background:'var(--cream-deep)'}}>
          <Photo item={before} alt="" className="w-full h-full object-cover"
            renderFallback={() => <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}><span className="font-sans text-5xl md:text-7xl" style={{color:'var(--ink-soft)'}}>{aiScoreOut10(before) || before.rating}</span></div>}
          />
          <div className="absolute top-2 left-2 text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-sm font-medium" style={{background:'rgba(245,240,232,0.92)', color:'var(--ink)'}}>Before · {fmt(before.date)}</div>
          <div className="absolute bottom-2 left-2 font-sans text-base md:text-lg leading-none px-2 py-0.5 rounded-sm flex items-baseline gap-1" style={{background:'rgba(245,240,232,0.92)', color:'var(--accent)'}}>
            {aiScoreOut10(before) && <span style={{fontSize:'10px'}}>✦</span>}
            {aiScoreOut10(before) || before.rating}<span className="text-[10px]" style={{color:'var(--ink-soft)'}}>/10</span>
          </div>
        </div>
        {/* AFTER */}
        <div className="relative aspect-[3/4] overflow-hidden" style={{background:'var(--cream-deep)'}}>
          <Photo item={after} alt="" className="w-full h-full object-cover"
            renderFallback={() => <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}><span className="font-sans text-5xl md:text-7xl" style={{color:'var(--ink-soft)'}}>{aiScoreOut10(after) || after.rating}</span></div>}
          />
          <div className="absolute top-2 left-2 text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-sm font-medium" style={{background:'var(--ink)', color:'var(--cream)'}}>After · {fmt(after.date)}</div>
          <div className="absolute bottom-2 left-2 font-sans text-base md:text-lg leading-none px-2 py-0.5 rounded-sm flex items-baseline gap-1" style={{background:'rgba(245,240,232,0.92)', color:'var(--accent)'}}>
            {aiScoreOut10(after) && <span style={{fontSize:'10px'}}>✦</span>}
            {aiScoreOut10(after) || after.rating}<span className="text-[10px]" style={{color:'var(--ink-soft)'}}>/10</span>
          </div>
        </div>
      </div>
      {/* Swap + clear chrome below */}
      {(onSwap || onClear) && (
        <div className="flex items-center justify-end gap-3 mt-2">
          {onSwap && (
            <button onClick={onSwap} className="text-[10px] tracking-[0.15em] uppercase flex items-center gap-1" style={{color:'var(--ink)'}} title="Swap sides">
              <Icon name="ArrowLeftRight" size={11} /> Swap
            </button>
          )}
          {onClear && (
            <button onClick={onClear} className="text-[10px] tracking-[0.15em] uppercase flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
              <Icon name="X" size={11} /> Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
};
