// === StatCard (Wave 3.1 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const StatCard = ({ label, value, unit, trend, highlight }) => (
  <div className="p-4 md:p-6" style={{background: highlight ? 'linear-gradient(135deg, var(--cream), #f5e8d4)' : 'var(--cream)'}}>
    <div className="text-[9px] tracking-[0.22em] uppercase flex items-center gap-1" style={{color:'var(--ink-soft)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
      {label} {highlight && <Icon name="Flame" size={10} />}
    </div>
    <div className="font-sans text-4xl mt-2" style={{color:'var(--ink)'}}>{value}</div>
    <div className="text-xs mt-1 font-light flex items-baseline gap-2 flex-wrap" style={{color:'var(--ink-soft)'}}>
      <span>{unit}</span>
      {trend && <span style={{color: +trend > 0 ? '#5a7a4f' : +trend < 0 ? '#a04555' : 'inherit', whiteSpace:'nowrap'}}>{+trend > 0 ? '↑' : +trend < 0 ? '↓' : '→'} {Math.abs(trend)}</span>}
    </div>
  </div>
);
