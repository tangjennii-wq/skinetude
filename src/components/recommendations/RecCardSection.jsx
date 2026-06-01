// === RecCardSection (May 2026) ===
// Reusable rec card UI used by Home, Journal, Regimen, and Insights.
// Takes resolved coverage + a surface name; renders the appropriate
// card stack with voice-checked copy from recCopy.buildRecCards.
//
// Single visual model across surfaces — consistency is the point.
// Surface-specific routing (which card states show where) lives in
// recCopy.SURFACE_CAPS / buildRecCards. This component just renders
// what it's handed.
//
// Props
//   coverage   — output of resolveCoverageStates (required)
//   surface    — 'home' | 'journal' | 'regimen' | 'insights'
//   slot       — 'am' | 'pm' (optional; filters MISSING to this slot only — used by Regimen empty-slot)
//   maxCards   — override default surface cap
//   onPickClick — (pick, card) => void   tap handler for an individual product pick
//   onSwapClick — (card) => void         tap handler for a SWAP card
//   compact    — boolean; tightens spacing for inline regimen slot use
// === RecCard — single card (May 29 2026 per Jenni) ===
// Extracted so each card can hold its own collapse state. When
// collapsible=true, the header (eyebrow + title + body + chevron)
// is a tappable button; picks render only when expanded.
const RecCard = ({ card, padX, padY, compact, collapsible, onPickClick, onSwapClick }) => {
  const [expanded, setExpanded] = React.useState(!collapsible);
  const accent = card.state === 'SWAP_SUGGESTED'
    ? 'var(--rose,#c9a094)'
    : 'var(--accent)';
  const icon =
    card.state === 'SWAP_SUGGESTED' ? 'AlertCircle'
    : card.state === 'MISSING'      ? 'Plus'
    : card.state === 'CONCERN_GAP'  ? 'Sparkles'
    : 'Eye'; /* COMPLEMENT */
  const interactive = typeof onPickClick === 'function';
  const hasPicks = card.picks && card.picks.length > 0;

  const header = (
    <>
      <div className="flex items-center justify-between gap-2 mb-2" style={{ color: accent }}>
        <div className="inline-flex items-center gap-1.5">
          <Icon name={icon} size={11} />
          <span className="text-[10px] tracking-[0.22em] uppercase">{card.eyebrow}</span>
        </div>
        {collapsible && hasPicks && (
          <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={13} style={{ color: 'var(--ink-soft)' }} />
        )}
      </div>
      <div
        className="font-sans leading-snug mb-1.5 text-left"
        style={{ color: 'var(--ink)', fontSize: compact ? '14px' : '15px' }}
      >
        {card.title}
      </div>
      <div
        className="text-[11px] leading-snug text-left"
        style={{ color: 'var(--ink-soft)', whiteSpace: 'pre-line' }}
      >
        {card.body}
      </div>
    </>
  );

  return (
    <section
      className={`rounded-[14px] ${padX} ${padY}`}
      style={{ background: 'var(--cream)', border: '1px solid var(--line)' }}
    >
      {collapsible && hasPicks ? (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full text-left transition hover:opacity-90"
          style={{ cursor: 'pointer' }}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${card.eyebrow}` : `Expand ${card.eyebrow}`}
        >
          {header}
        </button>
      ) : (
        header
      )}

      {card.state === 'SWAP_SUGGESTED' && typeof onSwapClick === 'function' && (
        <button
          type="button"
          onClick={() => onSwapClick(card)}
          className="mt-2 text-[10px] tracking-[0.22em] uppercase transition hover:opacity-80"
          style={{ color: 'var(--ink)', borderBottom: '1px dotted var(--ink)' }}
        >
          Show me why
        </button>
      )}

      {hasPicks && expanded && (
        <div className="space-y-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
          {card.picks.map(pick => {
            const Tag = interactive ? 'button' : 'div';
            const tagProps = interactive
              ? { type: 'button', onClick: () => onPickClick(pick, card) }
              : {};
            return (
              <Tag
                key={pick.id}
                {...tagProps}
                className={`w-full text-left ${interactive ? 'transition hover:opacity-90' : ''}`}
                style={interactive ? { cursor: 'pointer' } : { cursor: 'default' }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-medium" style={{ color: 'var(--ink)' }}>
                    {pick.brand} <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>·</span> {pick.name}
                  </span>
                  <span className="text-[9px] tracking-[0.15em] uppercase flex-shrink-0" style={{ color: 'var(--ink-soft)' }}>
                    {pick.priceTier}
                  </span>
                </div>
                <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--ink-soft)' }}>
                  {pick.blurb}
                </div>
              </Tag>
            );
          })}
        </div>
      )}
    </section>
  );
};

const RecCardSection = ({
  coverage,
  surface = 'journal',
  slot = null,
  maxCards,
  onPickClick,
  onSwapClick,
  compact = false,
  // === collapsible (May 29 2026 per Jenni) ===
  // When true, each card renders as a preview (eyebrow + title + body
  // + chevron). Tapping anywhere on the header expands to reveal the
  // picks list. Used on Journal Today so "What we'd try" reads as a
  // scannable list of mechanisms instead of a wall of products.
  collapsible = false} = {}) => {
  if (!coverage) return null;

  // recCopy.buildRecCards reads JOB_LABELS / MECHANISM_LABELS / pickFromCatalog
  // from module scope (sidecar concat) — no imports needed.
  let cards = buildRecCards(coverage, {
    surface,
    ...(typeof maxCards === 'number' ? { maxCards } : {})});

  // Slot scope — Regimen renders one section per empty slot. Filter
  // MISSING entries to the slot in question; pass other states through.
  if (slot) {
    cards = cards.filter(c => c.state !== 'MISSING' || c.meta?.slot === slot);
  }

  if (!cards.length) return null;

  const padY = compact ? 'py-3' : 'py-4';
  const padX = compact ? 'px-4' : 'px-5';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {cards.map((card, idx) => (
        <RecCard
          key={`${card.state}-${idx}`}
          card={card}
          padX={padX}
          padY={padY}
          compact={compact}
          collapsible={collapsible}
          onPickClick={onPickClick}
          onSwapClick={onSwapClick}
        />
      ))}
    </div>
  );
};
