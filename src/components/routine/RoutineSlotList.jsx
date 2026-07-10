// === RoutineSlotList (Phase 3C — extracted from cover surface) ===
// Composes a slot's product display end-to-end:
//   - If products is empty → EmptyRoutineState (the dashed placeholder)
//   - Otherwise → numbered RoutineProductRow list + optional overflow pill
// The overflow pill appears when resolveTodayRitual capped the slot at
// MAX_FACE_ROUTINE_SLOT_PRODUCTS. It expands inline so users can inspect
// all planned products without being thrown into rebuild/refine.
//
// IMPORTANT: this component consumes the OUTPUT of resolveTodayRitual.
// Callers MUST NOT pre-filter products by `useTimes` here — the resolver
// already does that, body-product filters, dedupes, and applies the cap.
// Any caller that wants to display a slot must pass `products` and
// `overflow` straight from `resolveTodayRitual(...)`'s return shape.
//
// Today this is cover-only. The Regimen Today surface has its own list
// renderer (bottle thumbnails) and won't share this component until a
// future design pass unifies the two visual models. The audit at the
// top of CheckInDetailsModal / SkinLogModal-manifest tracks similar
// deferred unifications.
//
// Props
//   slot          — 'am' | 'pm'.
//   products      — Array<Product>. The capped+deduped+body-filtered list
//                   from resolveTodayRitual(...).am | .pm.
//   overflow      — number. resolveTodayRitual(...).amOverflow | pmOverflow.
//   canRepeat     — boolean. Forwarded to EmptyRoutineState.
//   onRepeat      — () => void. Forwarded to EmptyRoutineState.
//   onRemove      — (product, slot) => void. Forwarded to each row's X.
//   hiddenProducts — Array<Product>. Products hidden behind the safe six-item cap.
//   onOverflow      — legacy no-op prop. Overflow now expands inline.
const RoutineSlotList = ({ slot, products = [], overflow = 0, hiddenProducts = [], canRepeat, onRepeat, onRemove, onMove, onInfo, editMode = false, onOverflow, doneIds = [], onToggleDone, shelfProducts, regimenLogs }) => {
  const [showAll, setShowAll] = React.useState(false);
  const safeHidden = Array.isArray(hiddenProducts) ? hiddenProducts : [];
  const visibleProducts = showAll ? [...products, ...safeHidden] : products;
  if (!Array.isArray(products) || products.length === 0) {
    return (
      <EmptyRoutineState
        slot={slot}
        canRepeat={canRepeat}
        onRepeat={onRepeat}
        products={shelfProducts}
        regimenLogs={regimenLogs}
      />
    );
  }
  return (
    <div className="mb-2">
      <div className="text-[9px] tracking-[0.3em] uppercase mb-1.5 flex items-baseline justify-between" style={{color:'var(--ink-soft)'}}>
        <span>{slot.toUpperCase()} regimen</span>
        <span className="font-sans text-[10px] normal-case tracking-normal" style={{color:'var(--ink-soft)'}}>{visibleProducts.length}</span>
      </div>
      <div className="regimen-shelf-list">
        {visibleProducts.map((p, i) => (
          <RoutineProductRow
            key={p && p.isExtra ? `extra-${slot}-${i}` : `${slot}-${p && p.id}-${i}`}
            product={p}
            index={i}
            slot={slot}
            onRemove={onRemove}
            onMove={onMove}
            onInfo={onInfo}
            editMode={editMode}
            done={!!(p && doneIds && doneIds.includes(p.id))}
            onToggleDone={onToggleDone}
          />
        ))}
      </div>
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => {
            setShowAll(v => !v);
            if (typeof onOverflow === 'function') onOverflow();
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] transition hover:opacity-80 mt-2"
          style={{background:'rgba(125,23,58,0.055)', border:'1px dashed rgba(125,23,58,0.22)', color:'var(--accent)', fontWeight:600, fontSize:10.5, letterSpacing:'0.04em', cursor:'pointer'}}
          title={showAll ? 'Collapse extra routine items' : 'Show every product planned for this slot'}
        >
          <Icon name={showAll ? 'ChevronUp' : 'ChevronDown'} size={11} />
          <span>{showAll ? 'Show fewer' : `+${overflow} more items`}</span>
        </button>
      )}
    </div>
  );
};
