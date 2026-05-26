// === CycleAwareCard (Wave 3.1 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

// Reads cycle data, computes which phase the user is currently in, and surfaces phase-
// appropriate skin guidance. Only renders when the user has logged at least one period.
// Phase mapping is based on a 28-day default cycle length, adjustable via cycleData.cycleLength.
const CycleAwareCard = ({ cycleData, onOpenLesson }) => {
  if (!cycleData?.periods?.length) return null;
  const cycleLength = cycleData.cycleLength || 28;
  // periods are stored as { date: 'YYYY-MM-DD', id }, sorted desc by date
  const sorted = [...cycleData.periods].sort((a, b) => new Date(b.date) - new Date(a.date));
  const lastPeriodDate = new Date(sorted[0].date);
  if (isNaN(lastPeriodDate.getTime())) return null;
  const today = new Date();
  const daysSince = Math.floor((today - lastPeriodDate) / (1000 * 60 * 60 * 24));
  // Project forward across multiple cycles if no recent log
  const cycleDay = ((daysSince % cycleLength) + cycleLength) % cycleLength + 1;

  let phase, guidance;
  if (cycleDay <= 5) {
    phase = 'Menstrual';
    guidance = 'Estrogen and progesterone are at their lowest. Skin barrier function is measurably weaker — pull back on aggressive actives, prioritize ceramides and niacinamide. Sensitivity peaks here; not the week to introduce a new retinoid.';
  } else if (cycleDay <= 13) {
    phase = 'Follicular';
    guidance = 'Estrogen rising, skin at its most resilient. Healing capacity is highest in this window — the right time to introduce a new active, step up retinoid frequency, or schedule a procedure.';
  } else if (cycleDay <= 15) {
    phase = 'Ovulation';
    guidance = 'Estrogen at peak. Collagen synthesis is highest right now and dermal hydration is at its best — your skin will likely look its best. Maintain the routine; no need to push.';
  } else if (cycleDay <= 23) {
    phase = 'Early Luteal';
    guidance = 'Progesterone rising. Sebum production accelerates around days 21–24 — the premenstrual breakout window is approaching. Worth scaling up salicylic acid for the jawline area and easing off photosensitizing actives.';
  } else {
    phase = 'Late Luteal';
    guidance = 'Both hormones falling, skin more reactive. Premenstrual breakout window — niacinamide, salicylic acid, gentle barrier care. Skip new actives this week.';
  }

  return (
    <div className="border p-6" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
      <div className="flex items-start gap-5 flex-wrap">
        <div className="flex-shrink-0 min-w-[120px]">
          <div className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>Cycle day {cycleDay}</div>
          <div className="font-serif text-2xl italic mt-1" style={{color:'var(--ink)'}}>{phase}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-light leading-relaxed" style={{color:'var(--ink)'}}>{guidance}</p>
          <button onClick={() => {
            const lesson = LESSONS.find(l => l.id === 'skin-through-the-cycle');
            if (lesson) onOpenLesson(lesson);
          }} className="mt-3 text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1.5" style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)'}}>
            <Icon name="BookOpen" size={11} /> Read the cycle lesson
          </button>
        </div>
      </div>
    </div>
  );
};
