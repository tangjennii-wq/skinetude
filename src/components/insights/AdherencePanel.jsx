// === AdherencePanel (Insights — May 2026) ===
// Streak + AM/PM adherence + check-in cadence over the last 30 days.
// Quiet, museum-shelf — one focal number per cell, no emoji, no
// motivational copy.

const AdherencePanel = ({ regimenLogs, logs }) => {
  const adh = computeAdherence(regimenLogs || [], 30);
  // Photo cadence — count of distinct dates with photo entries in the
  // same 30-day window. Pulled here (not in computeAdherence) because
  // it's about journal logs, not routine logs.
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 29);
  const windowStartTs = windowStart.getTime();
  const photoDays = new Set();
  (logs || []).forEach(l => {
    if (!l || !l.date) return;
    const hasPhoto = l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
    if (!hasPhoto) return;
    const t = new Date(l.date).getTime();
    if (t >= windowStartTs && t <= today.getTime()) photoDays.add(l.date);
  });

  const streakWord = adh.currentStreak === 0
    ? 'No active run'
    : adh.currentStreak === 1
      ? '1 day'
      : `${adh.currentStreak} days`;

  // Honesty rule: if both rates are null AND no streak, the panel is
  // mostly empty — say so plainly rather than render a wall of dashes.
  const empty = adh.amRate == null && adh.pmRate == null && adh.currentStreak === 0 && adh.checkInDays === 0;

  if (empty) {
    return (
      <section className="mb-7">
        <div className="text-[10px] tracking-[0.22em] uppercase mb-3" style={{color:'var(--ink-soft)', fontWeight:600}}>
          Cadence
        </div>
        <div className="rounded-[14px] px-4 py-5 text-center" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>
            Mark a few AM or PM products done and we'll start tracking the run here.
          </p>
        </div>
      </section>
    );
  }

  // Border policy:
  //   mobile (2-col): every even-index cell gets a left border;
  //                   rows after row 1 get a top border.
  //   desktop (4-col): every cell after the first gets a left border.
  // borderClass is supplied per-cell below.
  const Cell = ({ label, value, sub, accent, borderClass = '' }) => (
    <div
      className={`px-3 py-3 flex-1 min-w-0 ${borderClass}`}
      style={{borderColor: 'var(--line)'}}
    >
      <div className="text-[9px] tracking-[0.22em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:600}}>{label}</div>
      <div className="text-[20px] leading-none" style={{color: accent || 'var(--ink)', fontWeight:700, letterSpacing:'-0.02em'}}>
        {value}
      </div>
      {sub && <div className="text-[10px] mt-1" style={{color:'var(--ink-soft)'}}>{sub}</div>}
    </div>
  );

  return (
    <section className="mb-7">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>
            Cadence
          </div>
          <div className="text-[12px] mt-1" style={{color:'var(--ink-soft)'}}>
            Last 30 days. Not a grade — just where you've been showing up.
          </div>
        </div>
      </div>
      <div className="rounded-[14px] overflow-hidden" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        <div className="grid grid-cols-2 md:grid-cols-4">
          <Cell
            label="Current run"
            value={streakWord}
            sub={adh.currentStreak >= adh.longestStreak && adh.currentStreak > 1 ? 'longest in 30' : adh.longestStreak > 1 ? `best: ${adh.longestStreak}` : null}
            accent={adh.currentStreak >= 7 ? 'var(--accent)' : 'var(--ink)'}
          />
          <Cell
            label="AM done"
            value={adh.amRate == null ? '—' : `${adh.amRate}%`}
            sub={adh.amCount > 0 ? `${adh.amCount} planned` : 'no AM plan yet'}
            borderClass="border-l"
          />
          <Cell
            label="PM done"
            value={adh.pmRate == null ? '—' : `${adh.pmRate}%`}
            sub={adh.pmCount > 0 ? `${adh.pmCount} planned` : 'no PM plan yet'}
            borderClass="border-t md:border-t-0 md:border-l"
          />
          <Cell
            label="Photo days"
            value={`${photoDays.size}/30`}
            sub={photoDays.size >= 20 ? 'strong baseline' : photoDays.size >= 10 ? 'getting there' : 'thin baseline'}
            borderClass="border-t border-l md:border-t-0"
          />
        </div>
      </div>
    </section>
  );
};
