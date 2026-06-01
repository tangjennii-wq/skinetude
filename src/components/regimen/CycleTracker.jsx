// === CycleTracker (Wave 3.2 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const CycleTracker = ({ cycleData, setCycleData, saveData, logs, toast }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState(localDateISO());

  const addPeriod = async () => {
    if (!newDate) return;
    const updated = { ...cycleData, periods: [...(cycleData.periods || []), { date: newDate, id: Date.now() }].sort((a,b) => new Date(b.date) - new Date(a.date)) };
    setCycleData(updated);
    await saveData('cycle', updated);
    setShowAdd(false);
    toast('Period start logged');
  };

  const removePeriod = async (id) => {
    const updated = { ...cycleData, periods: cycleData.periods.filter(p => p.id !== id) };
    setCycleData(updated);
    await saveData('cycle', updated);
  };

  // Predict next period
  const periods = cycleData.periods || [];
  const lastPeriod = periods[0];
  const cycleLen = cycleData.cycleLength || 28;
  const nextPredicted = lastPeriod ? new Date(new Date(lastPeriod.date).getTime() + cycleLen * 24*60*60*1000) : null;
  const today = new Date();
  const dayOfCycle = lastPeriod ? Math.floor((today - new Date(lastPeriod.date)) / (1000*60*60*24)) + 1 : null;
  const phase = dayOfCycle ? (
    dayOfCycle <= 5 ? { name: 'Menstrual', desc: 'Skin can feel drier and more sensitive. Focus on hydration.' } :
    dayOfCycle <= 13 ? { name: 'Follicular', desc: 'Estrogen rising — skin tends to look its best. Good time for actives.' } :
    dayOfCycle <= 16 ? { name: 'Ovulatory', desc: 'Peak glow phase. Estrogen at its highest.' } :
    dayOfCycle <= cycleLen ? { name: 'Luteal', desc: 'Progesterone rises — oil production increases. Hormonal breakouts common, especially around the chin.' } :
    { name: 'Cycle delayed', desc: 'You may want to log a new period start.' }
  ) : null;

  // Correlate skin scores with cycle days
  const correlationData = lastPeriod ? logs.filter(l => {
    const logDate = new Date(l.date);
    return logDate >= new Date(lastPeriod.date) && logDate <= today;
  }).map(l => ({
    day: Math.floor((new Date(l.date) - new Date(lastPeriod.date)) / (1000*60*60*24)) + 1,
    rating: +l.rating,
    concerns: l.concerns || []
  })) : [];

  return (
    <div>
      <SectionHeader title="The Cycle" subtitle="Track how your hormones affect your skin." action={() => setShowAdd(true)} actionLabel="Log Period Start" />

      {periods.length === 0 ? (
        <EmptyState icon="Moon" text="Log a period start to begin tracking cycle-skin correlations." action={() => setShowAdd(true)} actionText="Log First Period" />
      ) : (
        <>
          {/* Current Phase Card */}
          {phase && (
            <div className="border p-5 md:p-8 mb-6 md:mb-8" style={{background:'linear-gradient(135deg, var(--cream-deep), #f0e0e8)', borderColor: 'var(--line)'}}>
              <div className="flex items-start justify-between gap-3 md:gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', whiteSpace:'nowrap'}}>Day {dayOfCycle} of {cycleLen}</div>
                  <h3 className="font-sans text-2xl md:text-3xl mt-1" style={{color:'var(--ink)'}}>{phase.name} Phase</h3>
                  <p className="text-sm font-light mt-2 max-w-md" style={{color:'var(--ink-soft)'}}>{phase.desc}</p>
                </div>
                {nextPredicted && (
                  <div className="text-right">
                    <div className="text-[10px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)', whiteSpace:'nowrap'}}>Next Period</div>
                    <div className="font-sans text-xl md:text-2xl mt-1" style={{color:'var(--ink)', whiteSpace:'nowrap'}}>~ {nextPredicted.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>
                    <div className="text-xs font-light mt-1" style={{color:'var(--ink-soft)'}}>{Math.ceil((nextPredicted - today) / (1000*60*60*24))} days away</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Correlation chart */}
          {correlationData.length >= 3 && (
            <div className="border p-4 md:p-6 mb-6 md:mb-8" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
              <h3 className="font-sans text-xl mb-4" style={{color:'var(--ink)'}}>Skin scores this cycle</h3>
              <div className="relative h-32 flex items-end gap-1">
                {Array.from({length: cycleLen}, (_, i) => {
                  const day = i + 1;
                  const dataPoint = correlationData.find(d => d.day === day);
                  const height = dataPoint ? (dataPoint.rating / 10) * 100 : 0;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center justify-end" style={{height: '100%'}}>
                      {dataPoint && (
                        <div className="w-full transition" style={{
                          height: `${height}%`,
                          background: dataPoint.rating >= 7 ? 'var(--accent-blue)' : dataPoint.rating >= 5 ? '#c9a094' : '#a04555',
                          borderRadius: '2px 2px 0 0'
                        }} title={`Day ${day}: ${dataPoint.rating}/10`}></div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] tracking-[0.15em] uppercase mt-2" style={{color:'var(--ink-soft)'}}>
                <span>Day 1</span><span>Day {Math.floor(cycleLen/2)}</span><span>Day {cycleLen}</span>
              </div>
            </div>
          )}

          {/* Cycle length setting */}
          <div className="border p-5 mb-8 flex items-center gap-4 flex-wrap" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>Cycle Length</span>
            <input type="number" min="20" max="40" value={cycleLen} onChange={async e => {
              const updated = { ...cycleData, cycleLength: +e.target.value };
              setCycleData(updated);
              await saveData('cycle', updated);
            }} className="w-20 px-3 py-1.5 border text-sm font-light" />
            <span className="text-xs font-light" style={{color:'var(--ink-soft)'}}>days (default 28)</span>
          </div>

          {/* Period History */}
          <h3 className="font-sans text-2xl mb-4" style={{color:'var(--ink)'}}>Period History</h3>
          <div className="space-y-2">
            {periods.map((p, i) => {
              const next = periods[i + 1];
              const cycleLenActual = next ? Math.floor((new Date(p.date) - new Date(next.date)) / (1000*60*60*24)) : null;
              return (
                <div key={p.id} className="flex justify-between items-center p-4 border" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                  <div>
                    <div className="font-sans text-lg" style={{color:'var(--ink)'}}>{new Date(p.date).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</div>
                    {cycleLenActual && <div className="text-xs font-light mt-0.5" style={{color:'var(--ink-soft)'}}>{cycleLenActual} days from previous</div>}
                  </div>
                  <button onClick={() => removePeriod(p.id)} style={{color:'var(--ink-soft)'}}><Icon name="Trash2" size={14} /></button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Period Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(28,25,23,0.5)', backdropFilter:'blur(4px)'}} onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="rounded-lg max-w-sm w-full p-6 shadow-2xl" style={{background:'var(--cream)'}}>
            <h2 className="font-sans text-[18px] md:text-[19px] leading-[1.1] tracking-tight mb-4" style={{color:'var(--ink)'}}>Log Period Start</h2>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-md text-sm font-light mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 tracking-widest text-xs uppercase border" style={{borderColor: 'var(--line)', color:'var(--ink-soft)'}}>Cancel</button>
              <button onClick={addPeriod} className="flex-1 py-3 tracking-widest text-xs uppercase" style={{background:'var(--ink)', color:'var(--cream)'}}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
