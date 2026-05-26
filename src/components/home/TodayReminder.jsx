// === TodayReminder (Wave 3.1 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

const TodayReminder = ({ logs, products, procedures, events, cycleData, setActiveTab, setShowLogModal }) => {
  // Build context-aware reminder list
  const reminders = [];
  const today = new Date();
  const todayStr = localDateISO(today);

  // 1. Cycle-aware tip
  const lastPeriod = cycleData?.periods?.[0];
  if (lastPeriod) {
    const day = Math.floor((today - new Date(lastPeriod.date)) / (1000*60*60*24)) + 1;
    const len = cycleData.cycleLength || 28;
    if (day >= len - 5 && day <= len) {
      reminders.push({ icon: 'Moon', title: 'Approaching luteal-end', text: 'Hormonal breakouts are most likely now, especially around the chin. A salicylic acid spot treatment can help if needed.' });
    } else if (day >= 7 && day <= 14) {
      reminders.push({ icon: 'Sparkles', title: 'Follicular phase advantage', text: 'Estrogen is rising — your skin tolerates actives best now. Good window for retinoid increases or chemical exfoliation.' });
    }
  }

  // 2. Procedure follow-up — last procedure was >25 days ago and was a series-type
  const lastProc = procedures[0];
  if (lastProc) {
    const days = Math.floor((today - new Date(lastProc.date)) / (1000*60*60*24));
    const seriesProc = ['microneedling', 'laser', 'rf', 'chemical-peel'].includes(lastProc.type);
    if (seriesProc && days >= 25 && days <= 45) {
      reminders.push({ icon: 'Activity', title: `${days} days since ${lastProc.name}`, text: `For best results with ${lastProc.type.replace(/-/g, ' ')}, follow-up sessions are typically every 4–6 weeks. Consider scheduling round 2.`, action: () => setActiveTab('procedures') });
    }
  }

  // 3. Upcoming event prep
  const upcomingEvent = events.filter(e => new Date(e.date) > today).sort((a,b) => new Date(a.date) - new Date(b.date))[0];
  if (upcomingEvent) {
    const days = Math.ceil((new Date(upcomingEvent.date) - today) / (1000*60*60*24));
    if (days <= 14 && days >= 0) {
      reminders.push({ icon: 'Star', title: `${upcomingEvent.name} in ${days} days`, text: days <= 3 ? 'Stop all actives, focus on hydration. Your prep plan has more details.' : days <= 7 ? 'Time to taper actives if you haven\'t. Avoid new products.' : 'Maintain your routine, no big changes.', action: () => setActiveTab('events') });
    }
  }

  // 4. Sun protection reminder (if no SPF logged in active products)
  const hasSPF = products.some(p => !p.endDate && (p.category === 'sunscreen' || p.activeIngredients?.toLowerCase().match(/spf|zinc oxide|titanium|avobenzone/)));
  if (!hasSPF && products.filter(p => !p.endDate).length > 0) {
    reminders.push({ icon: 'Sun', title: 'No sunscreen in your routine', text: 'Daily broad-spectrum SPF 30+ is the single most important step for preventing skin aging and hyperpigmentation. Add one to your shelf.', action: () => setActiveTab('regimen') });
  }

  // 5. Consistency: if avg rating dropped below 5 in last 3 entries
  const last3 = logs.slice(0, 3);
  if (last3.length === 3 && last3.every(l => l.rating <= 4)) {
    reminders.push({ icon: 'AlertCircle', title: 'Three rough days in a row', text: 'Worth pausing actives for a few days and focusing on barrier repair — bland moisturizer, ceramides, no exfoliants.', action: () => { setActiveTab('pearls'); setPearlsTab('qa'); } });
  }

  // 6. New product feedback prompt — if a product was added in last 14 days
  const recentProduct = products.find(p => {
    const age = (today - new Date(p.startDate)) / (1000*60*60*24);
    return age >= 10 && age <= 21 && !p.endDate;
  });
  if (recentProduct && reminders.length < 3) {
    reminders.push({ icon: 'Package', title: `How is ${recentProduct.name} doing?`, text: `It's been about 2 weeks since you started — typically when initial reactions settle. Worth a journal entry to note any changes.`, action: () => setShowLogModal(true) });
  }

  if (reminders.length === 0) return null;

  // Show top 1-2 reminders to keep dashboard clean
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reminders.slice(0, 2).map((r, i) => (
        <div key={i} className="border p-5 flex gap-4 items-start" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream)', color:'var(--ink)'}}>
            <Icon name={r.icon} size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>For today</div>
            <div className="font-serif italic text-lg mt-0.5" style={{color:'var(--ink)'}}>{r.title}</div>
            <p className="text-xs font-light leading-relaxed mt-1" style={{color:'var(--ink-soft)'}}>{r.text}</p>
            {r.action && (
              <button onClick={r.action} className="mt-2 text-[10px] tracking-[0.15em] uppercase italic" style={{color:'var(--ink)'}}>
                Open →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
