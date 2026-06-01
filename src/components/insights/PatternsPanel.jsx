// === PatternsPanel (Insights — May 2026) ===
// Surface co-occurrence + day-of-week + trajectory observations from
// computePatternObservations. NEVER causal — descriptive only.
// (See memory/feedback_no_causal_claims.md.)

// === PatternsPanel — compacted (May 30 2026 — Agent D-v3) ===
// Part 2 of the Insights cleanup: kill the giant per-pattern headlines
// and per-card chrome. Each pattern is now a single one-line row:
//   ○ <metric or label> · <n readings> · <suggested move>
// Tap-to-expand reveals the original `body` copy. Saves ~60% of
// vertical space per pattern.
const PatternsPanel = ({ logs, onAsk }) => {
  const [openId, setOpenId] = React.useState(null);
  const obs = computePatternObservations(logs || []);
  const signalTone = (sig) => sig === 'redness' ? 'var(--accent)'
    : sig === 'hydration' ? 'var(--accent-blue)'
    : sig === 'breakouts' ? 'var(--gold)'
    : 'var(--ink)';

  // === ROW LABEL ===
  // The compact line replaces the big red "77 MATCHES" headline.
  // Format: <metric word> · <reading count> · <action hint>.
  // We pull a reading count from observation metadata when present;
  // fall back to "pattern" when the engine didn't carry a count.
  const rowLabel = (o) => {
    const metric = o.metric || o.signal || 'pattern';
    const metricCap = metric.charAt(0).toUpperCase() + metric.slice(1);
    const count = (typeof o.readingCount === 'number' && o.readingCount > 0)
      ? `${o.readingCount} reading${o.readingCount === 1 ? '' : 's'}`
      : 'pattern';
    // Action hint pulled from observation if engine surfaced one;
    // otherwise derived from the original title (lowercased, no
    // trailing punctuation).
    const hint = o.actionHint
      || (o.title || '').replace(/[.?!]+$/, '').toLowerCase();
    return { metric: metricCap, count, hint };
  };

  return (
    <section className="mb-7">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>
            Patterns we're noticing
          </div>
          <div className="text-[12px] mt-1" style={{color:'var(--ink-soft)'}}>
            One line per pattern. Tap to read the longer version.
          </div>
        </div>
      </div>
      {obs.length === 0 ? (
        <div className="rounded-[14px] px-4 py-5 text-center" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>
            Patterns surface once there are a handful of check-ins to compare. Keep going for a week or two.
          </p>
        </div>
      ) : (
        <ul className="rounded-[14px] divide-y" style={{background:'var(--cream-deep)', border:'1px solid var(--line)', borderColor:'var(--line)'}}>
          {obs.slice(0, 6).map(o => {
            const isOpen = openId === o.id;
            const { metric, count, hint } = rowLabel(o);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : o.id)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5"
                  style={{cursor:'pointer'}}
                  aria-expanded={isOpen}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background: signalTone(o.signal)}} />
                  <span className="text-[12px] leading-snug truncate flex-1" style={{color:'var(--ink)'}}>
                    <span style={{fontWeight:650}}>{metric}</span>
                    <span style={{color:'var(--ink-soft)'}}> · </span>
                    <span style={{color:'var(--ink-soft)'}}>{count}</span>
                    <span style={{color:'var(--ink-soft)'}}> · </span>
                    <span>{hint}</span>
                  </span>
                  <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={12} style={{color:'var(--ink-soft)', flexShrink:0}} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="text-[12px] leading-snug mb-2" style={{color:'var(--ink-soft)'}}>
                      {o.body}
                    </div>
                    {onAsk && (
                      <button
                        type="button"
                        onClick={() => onAsk(`Tell me more about: ${(o.title || '').toLowerCase()}`)}
                        className="text-[9px] tracking-[0.2em] uppercase"
                        style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)', fontWeight:600}}
                      >
                        Ask about this
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
