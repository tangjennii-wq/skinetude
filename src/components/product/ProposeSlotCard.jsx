// === ProposeSlotCard (Wave 2 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props.
// Behavior identical to prior inline definition.

// === <ProposeSlotCard /> — shared component (May 2026) ===
// Previously duplicated as ~120 lines of JSX in three Build surfaces
// (post-accept summary, persistent summary, Expert mode). Extracted here
// so future edits only touch one place. Props are kept minimal: the
// proposal object, queue array, products array, and a handful of
// callbacks. Renders nothing when there's no proposal.
const ProposeSlotCard = ({
  proposal, queue, products,
  onClose, onCancel, onAccept,
  onToggleDay, onFlipSlot,
}) => {
  if (!proposal) return null;
  const product = (products || []).find(p => p.id === proposal.productId);
  if (!product) return null;
  const dayCodes = ['S','M','T','W','T','F','S'];
  const queueCount = (queue || []).length;
  return (
    <div className="rounded-[18px] p-4 space-y-3" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
      <div className="flex items-center justify-between">
        <div className="text-[9.5px] tracking-[0.24em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>Étude suggests</div>
        <button onClick={onClose} className="text-[10px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}} type="button">Close</button>
      </div>
      {queueCount > 1 && (
        <div className="text-[10.5px]" style={{color:'var(--ink-soft)'}}>{queueCount} products to slot — one at a time.</div>
      )}
      <div className="p-3 rounded-[12px]" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
        {product.brand && (
          <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{product.brand}</div>
        )}
        <div className="text-[13.5px] mt-0.5" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.01em'}}>{product.name}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9.5px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full" style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600}}>
          {proposal.slot.toUpperCase()}
        </span>
        {[0,1,2,3,4,5,6].map(d => {
          const on = proposal.days.includes(d);
          return (
            <button
              key={d}
              onClick={() => onToggleDay(d)}
              className="w-6 h-6 rounded-full text-[9.5px] transition flex items-center justify-center"
              style={{
                background: on ? 'var(--accent)' : 'transparent',
                color: on ? 'var(--cream)' : 'var(--ink-soft)',
                border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                fontWeight: 600, cursor: 'pointer',
              }}
              type="button"
            >{dayCodes[d]}</button>
          );
        })}
        <button
          onClick={onFlipSlot}
          className="text-[9.5px] tracking-[0.18em] uppercase ml-auto"
          style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
          type="button"
        >Flip {proposal.slot === 'am' ? 'PM' : 'AM'}</button>
      </div>
      <div className="text-[11.5px]" style={{color:'var(--ink-soft)', lineHeight:1.5}}>{proposal.rationale}</div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onCancel} className="pill-btn secondary" type="button">Cancel</button>
        <button
          onClick={onAccept}
          disabled={proposal.days.length === 0}
          className="pill-btn primary"
          type="button"
          style={{opacity: proposal.days.length === 0 ? 0.5 : 1}}
        >
          <Icon name="Check" size={13} style={{marginRight:6}} />
          Accept
        </button>
      </div>
    </div>
  );
};
