// === ProcedureModal (Wave 4 extract — May 2026) ===
// Pulled out of App so the modal can be reasoned about independently.
// Behavior preserved exactly. All App-scope state + setters passed as props.

const ProcedureModal = ({
  // Wave 4.5 (May 2026): App-scope dependencies as props.
  procedures, setProcedures,
  editingProcedureId, setEditingProcedureId,
  logs,
  callClaude,
  saveData,
  toast,
  user,
  setShowProcedureModal,
  modalScrollMemo,
  useModalScrollPreserve,
  uploadPhotoToStorage,
  fileToBase64,
  withTimeout,
  getApiKey,
  onProcedureLogged}) => {
  const editingProcedure = editingProcedureId ? procedures.find(p => p.id === editingProcedureId) : null;
  const isEditingProc = !!editingProcedure;
  const [form, setForm] = useState(editingProcedure ? {
    name: editingProcedure.name || '',
    type: editingProcedure.type || 'facial',
    date: editingProcedure.date || localDateISO(),
    provider: editingProcedure.provider || '',
    cost: editingProcedure.cost || '',
    notes: editingProcedure.notes || '',
    results: editingProcedure.results || '',
    followUp: editingProcedure.followUp || ''
  } : {
    name: '', type: 'facial', date: localDateISO(),
    provider: '', cost: '', notes: '', results: '', followUp: ''
  });
  // Scroll preservation across App-induced remounts.
  const scrollSentinelRef = useModalScrollPreserve('procedure');
  const handleSubmit = async () => {
    if (!form.name) return;
    // === EDIT MODE ===
    if (isEditingProc) {
      const updated = procedures.map(p => p.id === editingProcedureId ? { ...p, ...form } : p)
        .sort((a,b) => new Date(b.date) - new Date(a.date));
      setProcedures(updated);
      await saveData('procedures', updated);
      setEditingProcedureId(null);
      setShowProcedureModal(false);
      toast(`${form.name} updated`);
      return;
    }
    const id = Date.now();
    const newProc = { ...form, id, aiAnalysis: null, analyzing: getApiKey() ? true : false, analyzingStartedAt: getApiKey() ? Date.now() : undefined };
    const updated = [...procedures, newProc].sort((a,b) => new Date(b.date) - new Date(a.date));
    setProcedures(updated);
    await saveData('procedures', updated);
    setShowProcedureModal(false);
    if (!getApiKey()) {
      // === T4 FIX (May 2026) ===
      // Without an API key the modal closed silently — no toast
      // meant the user couldn't tell if the procedure had saved.
      // Always fire a confirmation toast in the no-key branch.
      toast(`${form.name} logged`, 'success');
    }
    // === REBUILD-PROMPT FIRE (June 2026 per Jenni) ===
    // Surface the "Rebuild routine in Refine?" banner at App level. Post-
    // procedure skin needs gentler actives + careful sequencing, so we
    // nudge the user to refine. Auto-dismisses after 8s. Edit-mode path
    // above returns early so this only fires for NEW procedure logs.
    if (typeof onProcedureLogged === 'function') {
      onProcedureLogged(newProc);
    }
    if (getApiKey()) {
      toast('Generating evidence-based briefing…', 'info');
      (async () => {
        try {
          const concerns = logs.slice(0, 10).flatMap(l => l.concerns || []);
          const concernSummary = concerns.length ? [...new Set(concerns)].slice(0, 5).join(', ') : 'none specified';
          const pastProcs = procedures.map(p => `${p.name} (${p.date})`).join(', ') || 'none';
          const prompt = `Provide a comprehensive evidence-based briefing for this procedure. The user just had/is logging:

Procedure: ${form.name}
Type: ${form.type}
Date: ${form.date}
Provider: ${form.provider || 'not specified'}
User notes: ${form.notes || 'none'}
User-reported results: ${form.results || 'not yet noted'}

Context: User's recent skin concerns include ${concernSummary}. Past procedures: ${pastProcs}.

Cover these specific points concisely (use the exact section headers below):

WHAT IT DOES: [2-3 sentence mechanism — how this procedure works at the skin level]

EXPECTED TIMELINE: [Day 0 to week 8+ what to expect — initial response, peak results, when to assess]

RECOVERY & DOWNTIME: [Specific timeline for redness, peeling, sensitivity, when to resume normal activities and exercise]

POST-CARE PROTOCOL: [What to do for 1 week after — sun protection level, products to avoid (e.g., retinoids, AHAs), what to use instead (e.g., bland moisturizer, peptides), sleep position if relevant]

RECOMMENDED FREQUENCY: [How often to repeat for optimal results — be specific: "every 4-6 weeks for a series of 3-6 sessions, then maintenance every 3-6 months"]

COMPLEMENTARY TREATMENTS: [2-3 procedures or product additions that pair well and timing — e.g., "LED red light at week 2 boosts collagen response" or "topical growth factor serum during healing"]

RED FLAGS: [Specific warning signs that warrant calling the provider]

EVIDENCE NOTE: [Brief note on the strength of clinical evidence for this procedure]`;
          const aiAnalysis = await callClaude(prompt, '', null, { voice: true });
          setProcedures(prev => {
            const next = prev.map(p => p.id === id ? { ...p, aiAnalysis, analyzing: false } : p);
            saveData('procedures', next);
            return next;
          });
          toast(`${form.name} briefing ready.`);
        } catch (e) {
          setProcedures(prev => {
            const next = prev.map(p => p.id === id ? { ...p, analyzing: false } : p);
            saveData('procedures', next);
            return next;
          });
        }
      })();
    }
  };
  return (
    <Modal compact onClose={() => { setShowProcedureModal(false); setEditingProcedureId(null); modalScrollMemo.current.procedure = 0; }} eyebrow="Procedures" title={isEditingProc ? 'Edit procedure' : 'Log procedure'}>
      <span ref={scrollSentinelRef} aria-hidden="true" style={{display:'none'}} />
      {/* === REDESIGNED May 2026 per Jenni — match Search Product visual ===
          Style language now mirrors ProductModal: accent eyebrow hint with
          sparkle icon, cream-deep field wrappers with soft 14px radius, no
          grey utilitarian look. Picker tiles for Type replace the dropdown.
          Save pill matches the accent-fill pattern with letter-spacing. */}
      <div className="space-y-4">
        {/* AI auto-briefing reassurance — matches the ProductModal autofill
            hint visually (small accent line with sparkle icon). */}
        <div className="flex items-start gap-1.5 text-[10px] leading-snug" style={{color:'var(--accent)'}}>
          <Icon name="Sparkles" size={10} className="flex-shrink-0 mt-0.5" />
          <span>AI auto-generates the briefing — recovery timeline, post-care, frequency, complementary treatments.</span>
        </div>

        {/* === Procedure name — primary input. Match search-product card visual:
            cream-deep tile, serif name input, no grey form aesthetic. */}
        <div className="rounded-[14px] px-3 py-2.5 flex items-center gap-2.5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          <div className="flex-shrink-0 w-7 h-9 flex items-end justify-center" style={{color:'var(--ink-soft)'}}>
            <Icon name="Sparkles" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <StableInput
              resetKey={editingProcedureId || 'new'}
              value={form.name}
              onChange={(v) => setForm({...form, name: v})}
              placeholder="Procedure name (e.g. Hydrafacial)"
              className="w-full font-sans text-[14px] leading-tight bg-transparent border-0 focus:outline-none px-0 py-0"
              style={{color:'var(--ink)', fontWeight:600}}
            />
          </div>
        </div>

        {/* === Type — chip picker (replaces grey dropdown) === */}
        <div>
          <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Type</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id:'facial', label:'Facial' },
              { id:'chemical-peel', label:'Peel' },
              { id:'microneedling', label:'Microneedling' },
              { id:'laser', label:'Laser' },
              { id:'injectable', label:'Injectable' },
              { id:'extraction', label:'Extraction' },
              { id:'led', label:'LED' },
              { id:'dermaplaning', label:'Dermaplaning' },
              { id:'rf', label:'RF' },
              { id:'other', label:'Other' },
            ].map(t => {
              const on = form.type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({...form, type: t.id})}
                  className="rounded-full px-3 py-1.5 transition"
                  style={{
                    background: on ? 'var(--accent)' : 'var(--cream)',
                    color: on ? 'var(--cream)' : 'var(--ink)',
                    border: on ? '1px solid var(--accent)' : '1px solid var(--line)',
                    fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', cursor: 'pointer'}}
                >{t.label}</button>
              );
            })}
          </div>
        </div>

        {/* === Date + Cost row — matches search-product grid pairs === */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Date</div>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
              className="w-full rounded-[10px] px-3 py-2 text-[12px]"
              style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink)'}}
            />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Cost</div>
            <StableInput
              resetKey={editingProcedureId || 'new'}
              value={form.cost}
              onChange={(v) => setForm({...form, cost: v})}
              placeholder="$"
              className="w-full rounded-[10px] px-3 py-2 text-[12px]"
              style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink)'}}
            />
          </div>
        </div>

        {/* === Provider === */}
        <div>
          <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Provider</div>
          <StableInput
            resetKey={editingProcedureId || 'new'}
            value={form.provider}
            onChange={(v) => setForm({...form, provider: v})}
            placeholder="Who performed it"
            className="w-full rounded-[10px] px-3 py-2 text-[12px]"
            style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink)'}}
          />
        </div>

        {/* === Notes === */}
        <div>
          <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Notes</div>
          <StableInput
            as="textarea"
            resetKey={editingProcedureId || 'new'}
            value={form.notes}
            onChange={(v) => setForm({...form, notes: v})}
            rows={2}
            placeholder="Any details to factor into the briefing"
            className="w-full rounded-[10px] px-3 py-2 text-[12px]"
            style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink)', fontFamily:'inherit'}}
          />
        </div>

        {/* === Results === */}
        <div>
          <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Results so far</div>
          <StableInput
            as="textarea"
            resetKey={editingProcedureId || 'new'}
            value={form.results}
            onChange={(v) => setForm({...form, results: v})}
            rows={2}
            placeholder="What you noticed afterward…"
            className="w-full rounded-[10px] px-3 py-2 text-[12px]"
            style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink)', fontFamily:'inherit'}}
          />
        </div>

        {/* === Primary save — matches search-product Save pill === */}
        <button
          onClick={handleSubmit}
          disabled={!form.name}
          className="w-full py-3 rounded-full tracking-[0.2em] text-[10.5px] uppercase transition mt-1 cursor-pointer flex items-center justify-center gap-1.5"
          style={{
            background: 'var(--accent)',
            color: 'var(--cream)',
            opacity: !form.name ? 0.5 : 1,
            cursor: !form.name ? 'not-allowed' : 'pointer'}}
        >
          {isEditingProc ? 'Save changes' : 'Save procedure'}
        </button>
      </div>
    </Modal>
  );
};
