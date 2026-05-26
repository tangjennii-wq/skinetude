// === RoutineProductRow (May 2026 — Daily Ritual redesign) ===
// One row in the cover's numbered slim-list rendering of today's ritual.
// Two visual variants share this row:
//   - REGULAR — a real shelf product. Shows a leading circle (visual
//               checklist cue, marks done when product is in the slot's
//               done array), the numbered name + category, and a quiet
//               "Skip today" text link in place of the previous X icon.
//               Per Jenni (May 2026): the X read as "delete this product
//               from my routine"; users want it to read clearly as
//               today-only. "Skip today" telegraphs that.
//   - EXTRA   — an AI-suggested product not yet on the shelf
//               (product.isExtra === true). Shows name + "AI · not on
//               shelf" italic tag. No remove control.
//
// Today this is cover-only. The Regimen Today surface still renders
// bottle thumbnails (separate visual model). When/if Regimen Today
// migrates to the same compact list layout, this row component is
// already in place to be shared.
//
// Props
//   product   — Product. The shelf entry. If product.isExtra, render
//               the AI/text variant instead.
//   index     — number. Used for the "1.", "2." prefix.
//   slot      — 'am' | 'pm'. Used for aria-label and the remove handler.
//   onRemove  — (product, slot) => void. Tapped from "Skip today".
//   done      — boolean (optional). If true, the leading circle renders
//               filled with a check.
//   onToggleDone — (product, slot) => void (optional). Tapped from the
//               leading circle. When omitted, the circle still renders
//               (visual placeholder) but is non-interactive.
const RoutineProductRow = ({ product, index, slot, onRemove, done = false, onToggleDone }) => {
  if (product && product.isExtra) {
    return (
      <div
        className="flex items-center gap-2.5 px-2 py-2 rounded-[10px]"
        style={{background:'rgba(255, 253, 250, 0.6)', border:'1px dashed var(--line)'}}
      >
        <span className="text-[10.5px] tabular-nums w-4 text-center flex-shrink-0" style={{color:'var(--ink-soft)', fontWeight:600}}>{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500}}>{product.name}</div>
          <div className="text-[9px] tracking-[0.18em] uppercase mt-0.5" style={{color:'var(--ink-soft)'}}>AI · not on shelf</div>
        </div>
        <span style={{width:60}} />
      </div>
    );
  }
  const brand = (product && product.brand || '').trim();
  const name = (product && product.name || '').trim();
  const category = ((product && product.category) || 'product').replace(/-/g,' ');
  const circleInteractive = typeof onToggleDone === 'function';
  const CircleTag = circleInteractive ? 'button' : 'div';
  return (
    <div
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-[10px]"
      style={{background:'var(--cream)', border:'1px solid var(--line)'}}
    >
      {/* Leading checklist circle. Filled with accent + check when done.
          Non-interactive fallback renders the same circle so the row layout
          stays stable whether or not the parent passes a toggle handler. */}
      <CircleTag
        type={circleInteractive ? 'button' : undefined}
        onClick={circleInteractive ? (e) => { e.stopPropagation(); onToggleDone(product, slot); } : undefined}
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '1.5px solid ' + (done ? 'var(--accent)' : 'var(--line)'),
          background: done ? 'var(--accent)' : 'transparent',
          color: 'var(--cream)',
          cursor: circleInteractive ? 'pointer' : 'default',
        }}
        title={done ? 'Marked done — tap to undo' : 'Mark this step done'}
        aria-label={done ? 'Marked done' : 'Mark this step done'}
      >
        {done && <Icon name="Check" size={11} />}
      </CircleTag>
      <span className="text-[10.5px] tabular-nums w-4 text-center flex-shrink-0" style={{color:'var(--ink-soft)', fontWeight:600}}>{index + 1}</span>
      <div className="flex-1 min-w-0">
        {brand && (
          <div className="text-[8.5px] tracking-[0.18em] uppercase truncate" style={{color:'var(--ink-soft)', fontWeight:600}}>{brand}</div>
        )}
        <div className="text-[12px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'-0.005em', opacity: done ? 0.65 : 1}}>{name || brand || 'Product'}</div>
        {category && (
          <div className="text-[8.5px] tracking-[0.16em] uppercase mt-0.5" style={{color:'var(--ink-soft)', fontWeight:500}}>{category}</div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove && onRemove(product, slot); }}
        className="flex-shrink-0 transition hover:opacity-70"
        style={{
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '4px 6px',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          textDecorationStyle: 'dotted',
          background: 'transparent',
          border: 0,
        }}
        title={`Skip ${name || 'this step'} for today only — stays in your routine going forward`}
        aria-label={`Skip ${name} today`}
      >
        Skip
      </button>
    </div>
  );
};
