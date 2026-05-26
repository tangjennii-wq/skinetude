// === MiniMonthCalendar (Wave 3.4 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const MiniMonthCalendar = ({ logs = [], onDayClick, showThumbs = false, procedures = [] }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const hasPhoto = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
  // Index by date; prefer full-face photo per day for the cell representation.
  const photoByDate = {};
  (logs || []).forEach(l => {
    if (!hasPhoto(l)) return;
    const cur = photoByDate[l.date];
    if (!cur || (l.area === 'full-face' && cur.area !== 'full-face') || (l.area === cur.area && (l.id || 0) > (cur.id || 0))) {
      photoByDate[l.date] = l;
    }
  });
  const procByDate = {};
  (procedures || []).forEach(p => { if (!procByDate[p.date]) procByDate[p.date] = p; });

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const todayKey = localDateISO(today);
  const isFutureMonth = month.getFullYear() > today.getFullYear()
    || (month.getFullYear() === today.getFullYear() && month.getMonth() >= today.getMonth());
  const prevMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const nextMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const goToday = () => setMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="border" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{borderColor:'var(--line)'}}>
        <button onClick={prevMonth} className="p-1.5" style={{color:'var(--ink-soft)'}} aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex items-baseline gap-2">
          <h3 className="font-serif italic text-sm md:text-base" style={{color:'var(--ink)'}}>{monthLabel}</h3>
          <button onClick={goToday} className="text-[9px] tracking-[0.2em] uppercase italic" style={{color:'var(--ink-soft)'}}>Today</button>
        </div>
        <button onClick={nextMonth} disabled={isFutureMonth} className="p-1.5 disabled:opacity-30" style={{color:'var(--ink-soft)'}} aria-label="Next month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 px-1.5 pt-1.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[8px] tracking-[0.2em] uppercase py-0.5" style={{color:'var(--ink-soft)'}}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 px-1.5 pb-2">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />;
          const dKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const log = photoByDate[dKey];
          const proc = procByDate[dKey];
          const isToday = dKey === todayKey;
          const isFuture = new Date(dKey) > today;
          return (
            <button
              key={i}
              type="button"
              onClick={() => log && onDayClick && onDayClick(log, dKey)}
              disabled={!log || isFuture}
              className="aspect-square flex flex-col items-center justify-center transition relative disabled:cursor-default overflow-hidden"
              style={{
                background: isToday ? 'var(--accent-soft)' : (log && !showThumbs ? 'var(--cream-deep)' : 'transparent'),
                color: isFuture ? 'var(--line)' : (log ? 'var(--ink)' : 'var(--ink-soft)'),
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
              }}
              title={log ? `${dKey} · ${log.rating}/10` : (proc ? `${dKey} · ${proc.name}` : dKey)}
            >
              {log && showThumbs && (
                <Photo item={log} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <span
                className="text-[10px] font-light leading-none relative z-10"
                style={{
                  color: log && showThumbs ? '#fff' : undefined,
                  textShadow: log && showThumbs ? '0 1px 2px rgba(0,0,0,0.6)' : undefined,
                }}
              >{day}</span>
              {log && !showThumbs && (
                <span className="font-serif italic text-[10px] mt-0.5 leading-none" style={{color:'var(--accent)'}}>{log.rating}</span>
              )}
              {/* Marker dots — bottom of cell */}
              <span className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5 z-10">
                {proc && <span className="w-1 h-1 rounded-full" style={{background:'var(--rose)'}} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
