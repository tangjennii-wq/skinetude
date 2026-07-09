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
//               shelf" tag. No remove control.
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
// === MECHANISM/EVIDENCE TRUNCATION HELPER (May 31 2026 per Jenni) ===
// Newly-added user products get the full raw Claude analysis dumped into
// `product.aiAnalysis`, which can be 400+ words despite the prompt asking
// for ≤30. Catalog products use pre-curated concise strings. To bring both
// to parity, cap the displayed mechanism/evidence to ~1 sentence (≤240
// chars at a sentence boundary) and offer a "Show more" toggle for the
// rare reader who wants the full text.
const truncateAtSentence = (text, maxChars = 240) => {
  if (!text) return { concise: '', isTruncated: false };
  const trimmed = String(text).trim();
  if (trimmed.length <= maxChars) return { concise: trimmed, isTruncated: false };
  // Prefer a sentence boundary within the first maxChars chars.
  const window = trimmed.slice(0, maxChars + 40);
  const match = window.match(/^(.{60,}?[.!?])(?:\s|$)/);
  if (match) return { concise: match[1].trim(), isTruncated: true };
  // Fallback: hard cut at the last word boundary within maxChars.
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return { concise: (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim() + '…', isTruncated: true };
};

const RoutineProductRow = ({ product, index, slot, onRemove, onMove, editMode = false, done = false, onToggleDone }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [mechFull, setMechFull] = React.useState(false);
  const [evFull, setEvFull] = React.useState(false);
  const rowActionColor = 'var(--ink-soft)';
  const categoryColor = 'var(--ink-soft)';
  if (product && product.isExtra) {
    return (
      <div style={{borderTop: index === 0 ? 'none' : '1px solid var(--line)'}}>
        <div className="regimen-row regimen-shelf-row">
          <span className="text-[10.5px] tabular-nums w-4 text-center flex-shrink-0" style={{color:'var(--ink-soft)', fontWeight:600}}>{index + 1}</span>
          <button type="button" onClick={() => setExpanded(v => !v)} className="flex-1 min-w-0 text-left transition hover:opacity-80" style={{cursor:'pointer'}}>
            <div className="text-[12px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500}}>{product.name}</div>
            <div className="text-[9px] tracking-[0.18em] uppercase mt-0.5" style={{color:'var(--ink-soft)'}}>AI · not on shelf</div>
          </button>
          <button type="button" onClick={() => setExpanded(v => !v)} className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)] justify-self-end" style={{color: rowActionColor, cursor:'pointer'}} title={expanded ? 'Collapse details' : 'Expand details'} aria-label={expanded ? 'Collapse details' : 'Expand details'}>
            <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={13} />
          </button>
        </div>
        {expanded && (
          <div className="regimen-shelf-detail">
            <div className="text-[9px] tracking-[0.2em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>Suggestion</div>
            <div className="text-[10.5px] leading-snug" style={{color:'var(--ink-soft)'}}>This item is not on your shelf yet. Add it if you used it today.</div>
          </div>
        )}
      </div>
    );
  }
  const brand = (product && product.brand || '').trim();
  const name = (product && product.name || '').trim();
  const category = ((product && product.category) || 'product').replace(/-/g,' ');
  const actives = (product && (product.activeIngredients || product.mainIngredients)) || '';
  const rawAnalysis = (product && product.aiAnalysis) || '';
  const sectionText = (label) => {
    if (!rawAnalysis) return '';
    const re = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:MECHANISM|EVIDENCE|REVIEWS|CONFLICTS|ALTERNATIVES|ASSESSMENT)\\s*:|$)`, 'i');
    const m = rawAnalysis.match(re);
    return m ? m[1].trim().replace(/\n+/g, ' ') : '';
  };
  const mechanism = sectionText('MECHANISM') || sectionText('ASSESSMENT');
  const evidence = sectionText('EVIDENCE');
  // === LEADING CHECK TOGGLE (May 29 2026 per Jenni) ===
  // The "biggest thing" per Jenni is letting users confirm they
  // actually did each step. The leading slot is dual-purpose now:
  // shows the step number when not done; when tapped, marks the
  // product done and the slot fills with a sage check. Re-tap to
  // undo. Falls back to a static number when no onToggleDone is
  // supplied (read-only callers).
  const handleToggleDone = (e) => {
    e.stopPropagation();
    if (typeof onToggleDone === 'function') onToggleDone(product, slot);
  };
  return (
    <div style={{borderTop: index === 0 ? 'none' : '1px solid var(--line)'}}>
      <div className="regimen-row regimen-shelf-row">
        {typeof onToggleDone === 'function' ? (() => {
          // Slot-aware done color: AM routine = gold (sun), PM = blue
          // (moon). Mirrors the eyebrow sun/moon palette so the check
          // tells you which routine the step belongs to at a glance.
          // Empty state = blank circle (reads as "tap me", universal
          // checkbox pattern). Position in the list conveys step
          // order, so no number needed inside.
          const doneColor = slot === 'pm' ? 'var(--accent-blue)' : 'var(--gold)';
          return (
            <button
              type="button"
              onClick={handleToggleDone}
              className="w-6 h-6 rounded-full flex items-center justify-center transition flex-shrink-0 hover:opacity-80 hover:border-[var(--ink-soft)]"
              style={{
                background: done ? doneColor : 'transparent',
                border: '1.5px solid ' + (done ? doneColor : 'var(--line)'),
                color: done ? 'var(--cream)' : 'transparent',
                cursor: 'pointer'}}
              aria-label={done ? `Mark step ${index + 1} as not done` : `Mark step ${index + 1} as done today`}
              title={done ? 'Tap to mark not done' : 'Tap to mark done today'}
            >
              {done && <Icon name="Check" size={12} strokeWidth={2.5} />}
            </button>
          );
        })() : (
          <span className="text-[10.5px] tabular-nums w-4 text-center flex-shrink-0" style={{color:'var(--ink-soft)', fontWeight:600}}>{index + 1}</span>
        )}
        <button type="button" onClick={() => setExpanded(v => !v)} className="flex-1 min-w-0 text-left transition hover:opacity-80" style={{cursor:'pointer'}}>
          {/* Single combined eyebrow — BRAND · CATEGORY (May 31 2026 per Jenni)
              to halve grey-text density. If only one exists, show that one. */}
          {(brand || category) && (
            <div className="text-[8.5px] tracking-[0.18em] uppercase truncate" style={{color:'var(--ink-soft)', fontWeight:600, opacity: done ? 0.55 : 1}}>
              {brand}{brand && category ? ' · ' : ''}{category}
            </div>
          )}
          <div className="text-[12px] leading-tight truncate" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'-0.005em', opacity: done ? 0.55 : 1}}>{name || brand || 'Product'}</div>
        </button>
        <div className="flex items-center justify-end gap-0.5">
          {/* July 2026 (quick-edit layer): default mode is calm — just the
              expand chevron. Edit mode swaps in the move (AM⇄PM today) and
              skip/remove controls. */}
          {!editMode && (
            <button type="button" onClick={() => setExpanded(v => !v)} className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)]" style={{color: rowActionColor, cursor:'pointer'}} title={expanded ? 'Collapse details' : 'Expand details'} aria-label={expanded ? 'Collapse details' : 'Expand details'}>
              <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={13} />
            </button>
          )}
          {/* July 2026 Day 7 (mobile QA P1): edit-mode controls bumped from
              28px to 36px — these are primary interactions in the quick-edit
              flow, not incidental icons. Negative margin keeps row height. */}
          {editMode && typeof onMove === 'function' && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onMove(product, slot); }} className="w-9 h-9 -my-1 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)]" style={{color: rowActionColor, cursor:'pointer'}} title={`Move to ${slot === 'am' ? 'PM' : 'AM'} for today only`} aria-label={`Move ${name} to ${slot === 'am' ? 'PM' : 'AM'} for today`}>
              <Icon name={slot === 'am' ? 'Moon' : 'Sun'} size={14} />
            </button>
          )}
          {editMode && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove && onRemove(product, slot); }} className="w-9 h-9 -my-1 rounded-full flex items-center justify-center transition hover:bg-[rgba(201,138,138,0.10)] hover:text-[var(--rose)]" style={{color: rowActionColor, opacity: 0.65, cursor:'pointer'}} title={`Skip ${name || 'this step'} today, or remove it from the plan`} aria-label={`Skip or remove ${name}`}>
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="regimen-shelf-detail">
          {brand && <div className="text-[9px] tracking-[0.2em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>{brand}</div>}
          {actives && (
            <div className="text-[10.5px] leading-snug mb-2" style={{color:'var(--ink-soft)'}}>
              <span className="tracking-[0.2em] uppercase mr-1.5" style={{fontSize:9, color:'var(--ink-soft)', fontWeight:600}}>Also</span>
              {actives}
            </div>
          )}
          {product && product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {product.tags.map((t, tagIdx) => <span key={tagIdx} className="text-[9px] tracking-[0.1em] px-1.5 py-0.5 border rounded-full" style={{borderColor: 'var(--line)', color:'var(--ink-soft)', background:'var(--cream)'}}>{t}</span>)}
            </div>
          )}
          <div className="text-[10px] font-light mb-2" style={{color:'var(--ink-soft)'}}>
            {product && product.frequency ? product.frequency.replace(/-/g, ' ') : 'as needed'}
            {product && Array.isArray(product.useTimes) && product.useTimes.length > 0 ? ` · ${product.useTimes.map(t => t.toUpperCase()).join(' + ')}` : ''}
            {product && product.startDate ? ` · started ${new Date(product.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
          </div>
          {(mechanism || evidence) && (
            <div className="pt-2 mt-2 border-t space-y-2" style={{borderColor: 'var(--line)'}}>
              {mechanism && (() => {
                const { concise, isTruncated } = truncateAtSentence(mechanism);
                return (
                  <div>
                    <div className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>Mechanism</div>
                    <div className="flex gap-1.5 text-[11px] leading-snug font-light" style={{color:'var(--ink)'}}>
                      <span style={{color:'var(--accent)'}}>·</span>
                      <span className="flex-1">
                        {mechFull ? mechanism : concise}
                        {isTruncated && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setMechFull(v => !v); }} className="ml-1.5 text-[9.5px] tracking-[0.14em] uppercase" style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}>
                            {mechFull ? 'Less' : 'More'}
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}
              {evidence && (() => {
                const { concise, isTruncated } = truncateAtSentence(evidence);
                return (
                  <div>
                    <div className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>Evidence</div>
                    <div className="flex gap-1.5 text-[11px] leading-snug font-light" style={{color:'var(--ink)'}}>
                      <span style={{color:'var(--accent)'}}>·</span>
                      <span className="flex-1">
                        {evFull ? evidence : concise}
                        {isTruncated && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setEvFull(v => !v); }} className="ml-1.5 text-[9.5px] tracking-[0.14em] uppercase" style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}>
                            {evFull ? 'Less' : 'More'}
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {product && product.notes && <div className="mt-2 text-[11px] font-light" style={{color:'var(--ink-soft)'}}>{product.notes}</div>}
        </div>
      )}
    </div>
  );
};
