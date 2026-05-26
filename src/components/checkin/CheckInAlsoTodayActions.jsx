// === CheckInAlsoTodayActions (Phase 3A — extracted from CheckInDetailsModal) ===
// "Also Today?" row — three vertical ActionCard tiles for quick capture
// of adjacent events while the user is in the check-in modal:
//   - Procedure (facial, microneedling, etc.)
//   - Product used (started or used something new)
//   - Supplement / medication (started or changed)
//
// Each handler receives a `payload()` snapshot of the current form state
// at click time, so the parent surface (Journal / Compare / wherever)
// can attach the new item to the same date with matching rating /
// noticed / context / note. The payload is built lazily — only when a
// tile is tapped — so users who don't use these tiles incur no cost.
//
// Behavior preserved exactly: same conditional rendering when callers
// don't pass a handler, same ActionCard copy + direction, same 3-col
// grid. The whole row hides if no `onAdd*` callback is supplied so we
// don't render an empty section.
//
// Props
//   onAddProcedure   — (payload) => void | undefined.
//   onAddProduct     — (payload) => void | undefined.
//   onAddSupplement  — (payload) => void | undefined.
//   buildPayload     — () => object. Snapshots the current form state
//                      (date, rating, noticed, contextFactors, notes).
const CheckInAlsoTodayActions = ({ onAddProcedure, onAddProduct, onAddSupplement, buildPayload }) => {
  if (!onAddProcedure && !onAddProduct && !onAddSupplement) return null;
  return (
    <div>
      <CardHeader eyebrow="Also Today?" marginBottom={6} />
      <div className="grid grid-cols-3 gap-1.5">
        {onAddProcedure && (
          <ActionCard
            icon="Plus"
            title="Procedure"
            sub="Facial, microneedling, etc."
            direction="vertical"
            onClick={() => onAddProcedure(buildPayload())}
          />
        )}
        {onAddProduct && (
          <ActionCard
            icon="Plus"
            title="Product used"
            sub="Started or used something new."
            direction="vertical"
            onClick={() => onAddProduct(buildPayload())}
          />
        )}
        {onAddSupplement && (
          <ActionCard
            icon="Plus"
            title="Supplement / medication"
            sub="Started or changed."
            direction="vertical"
            onClick={() => onAddSupplement(buildPayload())}
          />
        )}
      </div>
    </div>
  );
};
