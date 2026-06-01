// === EventModal (Wave 4 extract — May 2026) ===
// Pulled out of App so the modal can be reasoned about independently.
// Behavior preserved exactly. All App-scope state + setters passed as props.
//
// T6 (May 31 2026): retry-button polish. When the modal is opened on an
// EXISTING event (via the `existingEvent` prop) whose background prep
// plan failed (Agent E stashed `planError` + `planFailedAt` on the event
// in handleSubmit's catch), surface a small retry banner inside the
// modal — "Prep plan failed — tap to retry" + Retry button. On click we
// clear the error fields, re-run the same Claude prompt, and write the
// resulting plan back onto the event. Same prompt as handleSubmit's
// background path so the regenerated plan matches what the user would
// have gotten on first attempt.

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
  // T6 (May 31 2026): optional existing event being viewed. When set,
  // the modal renders in "view existing" mode with a retry affordance
  // for failed prep plans instead of the create-event form.
  existingEvent = null,
}) => {
  const [form, setForm] = useState({ name: '', date: localDateISO(), priority: 'medium', notes: '' });
  const [plan, setPlan] = useState('');
  const [planning, setPlanning] = useState(false);
  // T6: when retrying an existing event's failed plan, we set this so
  // the banner can flip to a spinner while the request is in flight.
  const [retrying, setRetrying] = useState(false);
  // Scroll preservation across App-induced remounts.
  const scrollSentinelRef = useModalScrollPreserve('event');

  // Shared prompt builder — used by both the synchronous "Preview" path
  // and the background generator in handleSubmit, and by retryExisting.
  // Centralizing it ensures a retry produces the same output a first
  // attempt would have.
  const buildPlanPrompt = (ev) => {
    const skinHistory = logs.slice(0, 10).map(l => `${l.date}: ${l.area} rated ${l.rating}/10, concerns: ${l.concerns?.join(', ') || 'none'}`).join('\n');
    const _eventUsage = getActualUsage(products, regimenLogs, logs, { windowDays: 30 });
    // Bug #6/#7 (May 31 2026): `ev.date` is 'YYYY-MM-DD'; bare `new Date()`
    // parses it as UTC midnight, then arithmetic vs local-now drifts by the
    // tz offset (off-by-one for anyone west of UTC). Pin to local midnight
    // with the 'T00:00:00' suffix so the day delta is honest.
    const days = Math.ceil((new Date(ev.date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
    return `My event "${ev.name}" is in ${days} days (on ${ev.date}). I want my skin to look its absolute best.\n\nMy recent skin status:\n${skinHistory || 'No logs yet.'}\n\nMy CURRENT routine (from check-ins, NOT shelf inventory):\n${formatUsageForPrompt(_eventUsage)}\n\nNotes: ${ev.notes || ''}\n\nGive me an evidence-based prep timeline. Include: what to start now, what to avoid, when to stop actives, hydration strategy, day-of routine, and red flags to watch for. Be specific about timing. Only reference products from the ACTIVELY USED section — products in LAPSED/UNUSED are not currently in my routine.`;
  };

  // Bug #7 (May 31 2026): past events leak a negative day count into the
  // prompt ("in -3 days") which produces nonsense plans. Helper so both
  // the synchronous preview and the background generator skip the AI call.
  const isPastEvent = (ev) => {
    if (!ev || !ev.date) return false;
    const evDate = new Date(ev.date + 'T00:00:00');
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return evDate < todayMidnight;
  };

  const generatePlan = async () => {
    // Bug #7: past events don't need prep plans — skip the AI call entirely.
    if (isPastEvent(form)) {
      setPlan('This event is in the past — no prep plan to build.');
      return;
    }
    setPlanning(true);
    try {
      const prompt = buildPlanPrompt(form);
      const result = await callClaude(prompt, '', null, { voice: true });
      setPlan(result);
    } catch (e) {
      // Bug #18 (May 31 2026): non-Error rejections (null/string) had no
      // .message → TypeError in the catch. Defensive String(e?.message || '').
      setPlan(String(e?.message || '').includes('API key') ? '' : 'Unable to generate plan. Please try again.');
    }
    setPlanning(false);
  };

  // T6 retry handler — invoked from the planError banner. Clears the
  // stashed error, flips the event to `analyzing`, re-runs the prompt,
  // and writes the plan (or a fresh error) back into the events array.
  // Closes the modal on success so the EventCard can show the new plan
  // inline; keeps the modal open on failure so the user can retry again.
  const retryExistingPlan = async () => {
    if (!existingEvent || retrying) return;
    const ev = existingEvent;
    setRetrying(true);
    // Optimistically mark as analyzing + clear the error so the card
    // and any other listeners flip into the spinner state immediately.
    setEvents(prev => {
      const next = prev.map(x => x.id === ev.id ? { ...x, analyzing: true, planError: null, planFailedAt: null } : x);
      saveData('events', next);
      return next;
    });
    try {
      const prompt = buildPlanPrompt(ev);
      const finalPlan = await callClaude(prompt, '', null, { voice: true });
      setEvents(prev => {
        const next = prev.map(x => x.id === ev.id ? { ...x, plan: finalPlan, analyzing: false, planError: null, planFailedAt: null } : x);
        saveData('events', next);
        return next;
      });
      try { toast(`Prep plan for ${ev.name} ready`, 'info'); } catch (_) {}
      setShowEventModal(false);
    } catch (e) {
      console.warn('[EventModal] retry prep plan failed', e);
      setEvents(prev => {
        const next = prev.map(x => x.id === ev.id ? {
          ...x,
          analyzing: false,
          planError: (e && e.message) ? e.message : 'Prep plan unavailable',
          planFailedAt: Date.now(),
        } : x);
        saveData('events', next);
        return next;
      });
      try { toast('Retry failed — try again in a moment', 'error'); } catch (_) {}
    }
    setRetrying(false);
  };

  const handleSubmit = async () => {
    if (!form.name) return;
    const id = Date.now();
    // Bug #7 (May 31 2026): past events skip the AI prep-plan pipeline
    // entirely. No analyzing flag, no Claude call — they get saved as
    // plain records so the AI doesn't receive "in -3 days" garbage.
    const eventIsPast = isPastEvent(form);
    const newEvent = { ...form, id, plan: plan || null, analyzing: !plan && getApiKey() && !eventIsPast ? true : false };
    const updated = [...events, newEvent].sort((a,b) => new Date(a.date) - new Date(b.date));
    setEvents(updated);
    await saveData('events', updated);
    setShowEventModal(false);
    // Generate plan in background if not already done — and only for future events.
    if (!plan && getApiKey() && !eventIsPast) {
      toast(`Building prep plan for ${form.name}…`, 'info');
      (async () => {
        try {
          const prompt = buildPlanPrompt(form);
          const finalPlan = await callClaude(prompt, '', null, { voice: true });
          setEvents(prev => {
            const next = prev.map(ev => ev.id === id ? { ...ev, plan: finalPlan, analyzing: false, planError: null } : ev);
            saveData('events', next);
            return next;
          });
          toast(`Prep plan for ${form.name} ready ✨`);
        } catch (e) {
          // === T6 FIX (May 2026) ===
          // Was: silent failure — `analyzing` cleared, but the user
          // had no idea the prep plan never landed and no retry hint.
          // Now: stash the error on the event so the event card / modal
          // can surface a small "Retry" affordance, and toast the user
          // with the retry hint.
          console.warn('[EventModal] background prep plan failed', e);
          setEvents(prev => {
            const next = prev.map(ev => ev.id === id ? {
              ...ev,
              analyzing: false,
              planError: (e && e.message) ? e.message : 'Prep plan unavailable',
              planFailedAt: Date.now(),
            } : ev);
            saveData('events', next);
            return next;
          });
          try { toast('Prep plan unavailable — tap to retry', 'error'); } catch {}
        }
      })();
    }
  };

  // T6: existing-event view mode. Renders the event metadata + a retry
  // banner when planError is stashed. No form fields — this surface
  // exists only to recover from a failed background plan.
  if (existingEvent) {
    const ev = existingEvent;
    const hasError = !!(ev.planError || ev.planFailedAt);
    return (
      <Modal onClose={() => { setShowEventModal(false); modalScrollMemo.current.event = 0; }} eyebrow="Occasions" title={ev.name || 'Event'}>
        <span ref={scrollSentinelRef} aria-hidden="true" style={{display:'none'}} />
        <div className="space-y-5">
          <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>
            {/* Bug #6: pin YYYY-MM-DD to local midnight before toLocaleDateString
                so the rendered day matches what the user picked. */}
            {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {ev.priority} priority
          </div>
          {ev.notes && <p className="text-sm font-light" style={{color:'var(--ink)'}}>{ev.notes}</p>}
          {hasError && (
            <div className="p-4 rounded-md border flex items-start gap-3" style={{background:'var(--cream-deep)', borderColor:'var(--accent)'}}>
              <Icon name="AlertCircle" size={14} style={{color:'var(--accent)', marginTop:2, flexShrink:0}} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--accent)'}}>Prep plan failed</div>
                <div className="text-sm font-light leading-relaxed" style={{color:'var(--ink)'}}>
                  Tap to retry — we’ll rebuild the timeline from your latest skin reads.
                </div>
                <button
                  onClick={retryExistingPlan}
                  disabled={retrying}
                  className="mt-3 border py-2 px-4 tracking-widest text-[10px] uppercase transition disabled:opacity-50 flex items-center gap-2"
                  style={{borderColor:'var(--ink)', color:'var(--ink)'}}
                >
                  {retrying ? <><Icon name="Loader2" size={11} className="spin" /> Retrying…</> : <><Icon name="RefreshCw" size={11} /> Retry plan</>}
                </button>
              </div>
            </div>
          )}
          {ev.plan && !hasError && (
            <div className="p-5 rounded-md border max-h-72 overflow-y-auto" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
              <h4 className="text-xs uppercase tracking-widest mb-3 font-medium" style={{color:'var(--ink-soft)'}}>Prep Plan</h4>
              <div className="text-sm whitespace-pre-wrap leading-relaxed font-light" style={{color:'var(--ink)'}}>{withPearls(ev.plan, setOpenLesson)}</div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

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
          <div className="p-5 rounded-md border max-h-72 overflow-y-auto" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
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
