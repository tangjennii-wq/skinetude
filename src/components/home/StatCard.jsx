// === StatCard (Wave 3.1 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const StatCard = ({ label, value, unit, trend, highlight }) => (
  <div className="p-6" style={{background: highlight ? 'linear-gradient(135deg, var(--cream), #f5e8d4)' : 'var(--cream)'}}>
    <div className="text-[9px] tracking-[0.3em] uppercase flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
      {label} {highlight && <Icon name="Flame" size={10} />}
    </div>
    <div className="font-serif text-4xl italic mt-2" style={{color:'var(--ink)'}}>{value}</div>
    <div className="text-xs mt-1 font-light" style={{color:'var(--ink-soft)'}}>
      {unit}
      {trend && <span style={{marginLeft:8, color: +trend > 0 ? '#5a7a4f' : +trend < 0 ? '#a04555' : 'inherit'}}>{+trend > 0 ? '↑' : +trend < 0 ? '↓' : '→'} {Math.abs(trend)}</span>}
    </div>
  </div>
);
