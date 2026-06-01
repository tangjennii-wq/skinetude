// === EvidenceDot (Wave 2 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props.
// Behavior identical to prior inline definition.

// === EVIDENCE DOT ===
// Three filled/hollow dots representing strength: ●●● strong, ●●○ moderate,
// ●○○ emerging. Tap to reveal a small tooltip with the source.
// Visual language stays quiet — terracotta dots so it sits in the editorial
// palette, not a clinical traffic-light. Source labels:
//   rct → "Strong RCT evidence", observational → "Consistent observation",
//   mechanism → "Mechanism-based", expert → "Clinician opinion".
const EvidenceDot = ({ evidence, IconComponent }) => {
  const [open, setOpen] = useState(false);
  if (!evidence) return null;
  const filled = evidence.level === 'strong' ? 3 : evidence.level === 'moderate' ? 2 : 1;
  const sourceLabel = {
    rct: 'Strong RCT evidence',
    observational: 'Consistent observational data',
    mechanism: 'Mechanism-based',
    expert: 'Clinician opinion'}[evidence.source] || 'Evidence noted';
  const levelLabel = evidence.level === 'strong' ? 'Strong' : evidence.level === 'moderate' ? 'Moderate' : 'Emerging';
  return (
    <span className="inline-flex items-center relative flex-shrink-0 align-middle ml-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center gap-[2px] px-1 py-0.5 rounded-full transition hover:opacity-80"
        style={{background: open ? 'var(--cream-deep)' : 'transparent'}}
        aria-label={`Evidence: ${levelLabel}, ${sourceLabel}`}
        title={`${levelLabel} · ${sourceLabel}`}
      >
        {[0,1,2].map(i => (
          <span key={i} style={{
            display:'inline-block', width:'5px', height:'5px', borderRadius:'50%',
            background: i < filled ? 'var(--accent)' : 'transparent',
            border: '1px solid var(--accent)'}} />
        ))}
      </button>
      {open && (
        <span
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          className="absolute z-30 left-0 top-full mt-1 px-2.5 py-1.5 rounded-[8px] whitespace-nowrap text-[10px] tracking-[0.05em]"
          style={{background:'var(--ink)', color:'var(--cream)', boxShadow:'0 4px 12px rgba(42,37,32,0.18)'}}
          role="tooltip"
        >
          <span className="font-sans" style={{color:'var(--cream)'}}>{levelLabel}</span>
          <span style={{opacity:0.75}}> · {sourceLabel}</span>
        </span>
      )}
    </span>
  );
};
