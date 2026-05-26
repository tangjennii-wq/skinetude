// === RecurringConcerns (Wave 3.1 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

// Surfaces the most-frequent log.concerns[] across the last 30 days. Only renders when
// there are concerns appearing 3+ times — no awkward empty state for sparse data.
const RecurringConcerns = ({ logs }) => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const counts = {};
  logs.forEach(l => {
    const d = new Date(l.date).getTime();
    if (isNaN(d) || d < cutoff) return;
    (l.concerns || []).forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  });
  const ranked = Object.entries(counts).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (ranked.length === 0) return null;
  return (
    <div className="border-t border-b py-5" style={{borderColor:'var(--line)'}}>
      <div className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{color:'var(--ink-soft)'}}>Recurring this month</div>
      <div className="flex items-baseline gap-x-6 gap-y-2 flex-wrap">
        {ranked.map(([concern, n], i) => (
          <div key={concern} className="flex items-baseline gap-2">
            <span className="font-serif italic text-2xl lowercase" style={{color:'var(--ink)'}}>{concern}</span>
            <span className="text-[11px] tracking-[0.15em]" style={{color:'var(--ink-soft)'}}>· {n}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
