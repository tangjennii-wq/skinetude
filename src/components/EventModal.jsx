// === EventModal (Wave 4 extract — May 2026) ===
// Pulled out of App so the modal can be reasoned about independently.
// Behavior preserved exactly. All App-scope state + setters passed as props.

const EventModal = ({
  // Wave 4.4 (May 2026): App-scope dependencies as props.
  events, setEvents,
  logs, products, regimenLogs,
  callClaude,
  saveData,
  toast,
  setShowEventModal,
  modalScrollMemo,
  useModalScrollPreserve,
  setOpenLesson,
  getActualUsage,
  formatUsageForPrompt,
  withPearls,
  getApiKey,
}) => {
  const [form, setForm] = useState({ name: '', date: localDateISO(), priority: 'medium', notes: '' });
  const [plan, setPlan] = useState('');
  const [planning, setPlanning] = useState(false);
  // Scroll preservation across App-induced remounts.
  const scrollSentinelRef = useModalScrollPreserve('event');

  const generatePlan = async () => {
    setPlanning(true);
    try {
      const skinHistory = logs.slice(0, 10).map(l => `${l.date}: ${l.area} rated ${l.rating}/10, concerns: ${l.concerns?.join(', ') || 'none'}`).join('\n');
      // Use actual-usage routine, not shelf — prep timeline must reflect what's truly in play.
      const _eventUsage = getActualUsage(products, regimenLogs, logs, { windowDays: 30 });
      const days = Math.ceil((new Date(form.date) - new Date()) / (1000 * 60 * 60 * 24));
      const prompt = `My event "${form.name}" is in ${days} days (on ${form.date}). I want my skin to look its absolute best.\n\nMy recent skin status:\n${skinHistory || 'No logs yet.'}\n\nMy CURRENT routine (from check-ins, NOT shelf inventory):\n${formatUsageForPrompt(_eventUsage)}\n\nNotes: ${form.notes}\n\nGive me an evidence-based prep timeline. Include: what to start now, what to avoid, when to stop actives, hydration strategy, day-of routine, and red flags to watch for. Be specific about timing. Only reference products from the ACTIVELY USED section — products in LAPSED/UNUSED are not currently in my routine.`;
      const result = await callClaude(prompt, '', null, { voice: true });
      setPlan(result);
    } catch (e) { setPlan(e.message.includes('API key') ? '' : 'Unable to generate plan. Please try again.'); }
    setPlanning(false);
  };

  const handleSubmit = async () => {
    if (!form.name) return;
    const id = Date.now();
    const newEvent = { ...form, id, plan: plan || null, analyzing: !plan && getApiKey() ? true : false };
    const updated = [...events, newEvent].sort((a,b) => new Date(a.date) - new Date(b.date));
    setEvents(updated);
    await saveData('events', updated);
    setShowEventModal(false);
    // Generate plan in background if not already done
    if (!plan && getApiKey()) {
      toast(`Building prep plan for ${form.name}…`, 'info');
      (async () => {
        try {
          const skinHistory = logs.slice(0, 10).map(l => `${l.date}: ${l.area} rated ${l.rating}/10, concerns: ${l.concerns?.join(', ') || 'none'}`).join('\n');
          const _eventUsage = getActualUsage(products, regimenLogs, logs, { windowDays: 30 });
          const days = Math.ceil((new Date(form.date) - new Date()) / (1000 * 60 * 60 * 24));
          const prompt = `My event "${form.name}" is in ${days} days (on ${form.date}). I want my skin to look its absolute best.\n\nMy recent skin status:\n${skinHistory || 'No logs yet.'}\n\nMy CURRENT routine (from check-ins, NOT shelf inventory):\n${formatUsageForPrompt(_eventUsage)}\n\nNotes: ${form.notes}\n\nGive me an evidence-based prep timeline. Include: what to start now, what to avoid, when to stop actives, hydration strategy, day-of routine, and red flags to watch for. Be specific about timing. Only reference products from ACTIVELY USED.`;
          const finalPlan = await callClaude(prompt, '', null, { voice: true });
          setEvents(prev => {
            const next = prev.map(ev => ev.id === id ? { ...ev, plan: finalPlan, analyzing: false } : ev);
            saveData('events', next);
            return next;
          });
          toast(`Prep plan for ${form.name} ready ✨`);
        } catch (e) {
          setEvents(prev => {
            const next = prev.map(ev => ev.id === id ? { ...ev, analyzing: false } : ev);
            saveData('events', next);
            return next;
          });
        }
      })();
    }
  };

  return (
    <Modal onClose={() => { setShowEventModal(false); modalScrollMemo.current.event = 0; }} eyebrow="Occasions" title="Optimize for event">
      <span ref={scrollSentinelRef} aria-hidden="true" style={{display:'none'}} />
      <div className="space-y-5">
        <Field label="Event Name *"><StableInput resetKey="event-new" value={form.name} onChange={(v) => setForm({...form, name: v})} placeholder="e.g. Wedding, Photoshoot, Reunion" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Event Date"><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputCls} /></Field>
          <Field label="Priority">
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className={inputCls}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High Stakes</option>
            </select>
          </Field>
        </div>
        <Field label="Goals & Notes"><StableInput as="textarea" resetKey="event-new" value={form.notes} onChange={(v) => setForm({...form, notes: v})} rows={2} placeholder="Concerns, areas to focus on..." className={inputCls} /></Field>
        {!plan && (
          <button onClick={generatePlan} disabled={!form.name || planning} className="w-full border py-3 tracking-widest text-xs uppercase transition disabled:opacity-50 flex items-center justify-center gap-2" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
            {planning ? <><Icon name="Loader2" size={14} className="spin" /> Generating...</> : <><Icon name="Sparkles" size={14} /> Preview Prep Plan (optional)</>}
          </button>
        )}
        {plan && (
          <div className="p-5 rounded-md border max-h-72 overflow-y-auto" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
            <h4 className="text-xs uppercase tracking-widest mb-3 font-medium" style={{color:'var(--ink-soft)'}}>Prep Plan</h4>
            <div className="text-sm whitespace-pre-wrap leading-relaxed font-light" style={{color:'var(--ink)'}}>{withPearls(plan, setOpenLesson)}</div>
          </div>
        )}
        <button onClick={handleSubmit} disabled={!form.name} className={primaryBtn} style={{background:'var(--ink)', color:'var(--cream)', opacity: !form.name ? 0.6 : 1}}>
          Save Event
        </button>
      </div>
    </Modal>
  );
};
