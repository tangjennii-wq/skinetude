// === OnboardingBuildingPhases (Wave 2 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props.
// Behavior identical to prior inline definition.

// === ONBOARDING — BUILDING ROUTINE PHASES (May 2026) ===
// Step 9 of the onboarding flow. Renders an animated checklist that
// ticks off "phases" of routine construction. Each phase takes ~1.2s;
// the final fade-out happens after the last phase. onDone fires after
// the last phase completes so the parent flow advances. The phases are
// honest descriptions of the work the app is actually doing in the
// background (mapping goals to categories, ordering by recovery
// spacing, etc.) — not pure theater.
const OnboardingBuildingPhases = ({ phases = [], onDone }) => {
  const [completed, setCompleted] = useState(0);
  // Stash onDone in a ref so re-renders from the parent (which redefine
  // the inline arrow each pass) don't restart the phase timer mid-tick.
  // Without this, every parent re-render cleared the 1100ms timer and
  // started a fresh one — phases would stall on "Understanding your skin".
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => {
    if (!Array.isArray(phases) || phases.length === 0) {
      if (typeof onDoneRef.current === 'function') onDoneRef.current();
      return;
    }
    if (completed >= phases.length) {
      // Shortened from 700→500ms (May 2026 friend-demo polish) so the
      // wait between "phases done" and the onDone callback firing
      // doesn't drag. With 3 phases (down from 5), total wait is now
      // ~3.2s instead of ~6.2s.
      const t = setTimeout(() => { if (typeof onDoneRef.current === 'function') onDoneRef.current(); }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCompleted(c => c + 1), 900);
    return () => clearTimeout(t);
  }, [completed, phases.length]);
  return (
    <div>
      <div className="text-[10px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--accent)', fontWeight:600}}>7 · Your First Regimen</div>
      <h2 className="font-sans text-[24px] leading-tight mb-2" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.018em'}}>Drafting your regimen…</h2>
      <p className="text-[12.5px] leading-snug mb-5" style={{color:'var(--ink-soft)'}}>Spacing the right things, daily-ing the rest.</p>
      <ul className="space-y-2.5 mb-2">
        {phases.map((label, i) => {
          const isDone = i < completed;
          const isActive = i === completed;
          return (
            <li key={i} className="flex items-center gap-3 transition-opacity" style={{opacity: isDone || isActive ? 1 : 0.4}}>
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: isDone ? 'var(--accent)' : 'transparent',
                  border: '1.5px solid ' + (isDone ? 'var(--accent)' : isActive ? 'var(--accent)' : 'var(--line)'),
                }}
              >
                {isDone && <Icon name="Check" size={11} style={{color:'var(--cream)'}} />}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--accent)', animation:'pulse 1.2s ease-in-out infinite'}} />
                )}
              </span>
              <span className="text-[12.5px]" style={{color: isDone || isActive ? 'var(--ink)' : 'var(--ink-soft)', fontWeight:500}}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
