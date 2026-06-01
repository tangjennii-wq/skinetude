// === PlanCommitStrip (May 30 2026 — Pattern C unified plan commit) ===
// Anchored at the bottom of any modal/page that follows the
// "AI proposes → user reviews → accept/discard" pattern. Replaces
// the ad-hoc Accept/Refine/Rebuild button cluster in Build, the
// silent auto-commit on Procedure/Event briefings, and the
// auto-discard on SkinLog modal close.
//
//   <PlanCommitStrip
//     state="draft"                      // 'draft' | 'accepted' | 'discarded' | 'error'
//     onAccept={() => ...}
//     onDiscard={() => ...}
//     onRetry={() => ...}                 // optional, for 'error' state
//     acceptLabel="Accept this plan"
//     discardLabel="Discard"
//     statusLabel="Draft"                 // e.g. "Draft", "Saved", "Pending"
//     errorMessage="..."
//   />
//
// Module-scope, no App-state coupling. Lives alongside Modal /
// ModalHeader / StickyModalFooter as a shared UI primitive.
const PlanCommitStrip = ({ state = 'draft', onAccept, onDiscard, onRetry, acceptLabel = 'Accept', discardLabel = 'Discard', statusLabel, errorMessage }) => {
  const palette = {
    draft:     { bg: 'rgba(199,231,245,0.42)', border: 'rgba(47,111,136,0.32)', fg: 'var(--accent-sage-dark)' },
    accepted:  { bg: 'rgba(199,231,245,0.42)', border: 'rgba(47,111,136,0.32)', fg: 'var(--accent-sage-dark)' },
    discarded: { bg: 'var(--cream-deep)',       border: 'var(--line)',          fg: 'var(--ink-soft)' },
    error:     { bg: 'rgba(229,60,45,0.06)',    border: 'var(--accent)',         fg: 'var(--accent)' },
  }[state];
  const computedStatus = statusLabel || (state === 'draft' ? 'Draft' : state === 'accepted' ? 'Accepted' : state === 'discarded' ? 'Discarded' : 'Error');
  return (
    <div className="rounded-[12px] border px-3.5 py-2.5 flex items-center justify-between gap-3 mt-3" style={{ background: palette.bg, borderColor: palette.border }}>
      <div className="min-w-0 flex items-center gap-2">
        {state === 'error' && errorMessage ? (
          <span className="text-[11.5px]" style={{ color: 'var(--ink)' }}>{errorMessage}</span>
        ) : (
          <>
            <span className="text-[9px] tracking-[0.28em] uppercase" style={{ color: palette.fg, fontWeight: 700 }}>{computedStatus}</span>
            {state === 'draft' && <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Review and accept to apply.</span>}
            {state === 'accepted' && <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Live across your routine.</span>}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {state === 'draft' && onAccept && (
          <button type="button" onClick={onAccept} className="text-[9.5px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-full" style={{ background: 'var(--ink)', color: 'var(--cream)', fontWeight: 700 }}>{acceptLabel}</button>
        )}
        {state === 'draft' && onDiscard && (
          <button type="button" onClick={onDiscard} className="text-[9.5px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-full" style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>{discardLabel}</button>
        )}
        {state === 'error' && onRetry && (
          <button type="button" onClick={onRetry} className="text-[9.5px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-full" style={{ background: 'var(--accent)', color: 'var(--cream)', fontWeight: 700 }}>Retry</button>
        )}
      </div>
    </div>
  );
};
