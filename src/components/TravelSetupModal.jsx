// === TravelSetupModal (June 2026 per Jenni — Travel mode Phase 1) ===
// Sets userProfile.travel when the user is about to leave for a trip.
// Captures dates, destination, time zone, location kind, the pared-down
// product list they're bringing, and any notes. While travel.active,
// the cover ritual reads from travel.products instead of the weekly
// pattern. Tagged logs (regimenLog + photo logs) get travel:true so
// Journal + Compare can filter.
//
// Opens from two entry points:
//   1. "Used something else? → Going traveling" sheet option
//   2. Tap on the cover travel banner (edit-mode)
//
// Module-scope component. No useState bridging — modal-local state lives
// in the component itself; the only state mutation that escapes is the
// final save to userProfile.travel via setUserProfile.

// Curated common destinations — covers 90% of trips without IANA picker
// overload. "Other" lets the user type a city + we leave timezone blank.
const TRAVEL_DESTINATIONS = [
  { label: 'New York',     tz: 'America/New_York' },
  { label: 'Los Angeles',  tz: 'America/Los_Angeles' },
  { label: 'Chicago',      tz: 'America/Chicago' },
  { label: 'Mexico City',  tz: 'America/Mexico_City' },
  { label: 'London',       tz: 'Europe/London' },
  { label: 'Paris',        tz: 'Europe/Paris' },
  { label: 'Rome',         tz: 'Europe/Rome' },
  { label: 'Istanbul',     tz: 'Europe/Istanbul' },
  { label: 'Dubai',        tz: 'Asia/Dubai' },
  { label: 'Mumbai',       tz: 'Asia/Kolkata' },
  { label: 'Bangkok',      tz: 'Asia/Bangkok' },
  { label: 'Singapore',    tz: 'Asia/Singapore' },
  { label: 'Hong Kong',    tz: 'Asia/Hong_Kong' },
  { label: 'Tokyo',        tz: 'Asia/Tokyo' },
  { label: 'Seoul',        tz: 'Asia/Seoul' },
  { label: 'Sydney',       tz: 'Australia/Sydney' },
  { label: 'Honolulu',     tz: 'Pacific/Honolulu' },
];

const LOCATION_KINDS = [
  { id: 'beach',  label: 'Beach',  hint: 'Sun, salt, sand. SPF heavy.' },
  { id: 'cold',   label: 'Cold',   hint: 'Dry indoor heat. Layer hydration.' },
  { id: 'humid',  label: 'Humid',  hint: 'Tropical. Less occlusive.' },
  { id: 'dry',    label: 'Dry',    hint: 'Desert / high altitude. Barrier first.' },
  { id: 'normal', label: 'Normal', hint: 'Same as home, just a different bathroom.' },
];

// Estimate timezone offset in hours between two IANA strings. Uses
// Intl.DateTimeFormat to read the current offset for each — accurate
// enough for the "is this jetlag-significant?" check (|Δ| ≥ 3).
const estimateTzDelta = (homeTz, destTz) => {
  if (!homeTz || !destTz || homeTz === destTz) return 0;
  try {
    const now = new Date();
    const opts = { hour: 'numeric', hour12: false, timeZone: '' };
    const homeHour = parseInt(new Intl.DateTimeFormat('en-US', { ...opts, timeZone: homeTz }).format(now), 10);
    const destHour = parseInt(new Intl.DateTimeFormat('en-US', { ...opts, timeZone: destTz }).format(now), 10);
    let delta = destHour - homeHour;
    if (delta > 12) delta -= 24;
    if (delta < -12) delta += 24;
    return delta;
  } catch {
    return 0;
  }
};

// Compute duration hint from start/end dates so we don't have to ask
// the user to pick it manually. Editable in the modal.
const deriveDurationHint = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  try {
    const ms = new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime();
    const days = Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
    if (days <= 3) return 'weekend';
    if (days <= 9) return 'week';
    if (days <= 16) return '2-weeks';
    return 'longer';
  } catch { return ''; }
};

const TravelSetupModal = ({
  userProfile,
  setUserProfile,
  products,
  saveData,
  toast,
  onClose,
}) => {
  const existing = userProfile?.travel || {};
  const isEditing = !!existing.active;
  const [startDate, setStartDate] = useState(existing.startDate || localDateISO());
  const [endDate, setEndDate] = useState(existing.endDate || '');
  const [destinationLabel, setDestinationLabel] = useState(existing.destinationLabel || '');
  const [destinationTz, setDestinationTz] = useState(existing.destinationTz || '');
  const [locationKind, setLocationKind] = useState(existing.locationKind || '');
  const [productIds, setProductIds] = useState(Array.isArray(existing.products) ? existing.products : []);
  const [notes, setNotes] = useState(existing.notes || '');
  const [showProductPicker, setShowProductPicker] = useState(false);

  const homeTz = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
    catch { return ''; }
  })();

  const durationHint = deriveDurationHint(startDate, endDate);
  const durationDays = (() => {
    if (!startDate || !endDate) return 0;
    try {
      const ms = new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime();
      return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
    } catch { return 0; }
  })();
  const tzDeltaHours = estimateTzDelta(homeTz, destinationTz);
  const jetlagSignificant = Math.abs(tzDeltaHours) >= 3;
  const activeProductsList = (products || []).filter(p => !p.endDate);
  const selectedProducts = productIds.map(id => activeProductsList.find(p => p.id === id)).filter(Boolean);

  const toggleProduct = (id) => {
    setProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // === Travel Phase 2.5 — auto-build packing list (June 2026) ===
  // Runs the suggestTravelRegimen heuristic against the current context
  // (climate + duration + actionGoal + jetlag). Replaces productIds with
  // the curated set; user can still uncheck items or add more via the
  // shelf picker. Reachable via the "Suggest packing list" button OR
  // auto-runs on first open if the user hasn't picked anything yet AND
  // they've already set dates + climate (so the suggestion has signal).
  const runAutoBuild = () => {
    if (typeof suggestTravelRegimen !== 'function') return;
    const suggested = suggestTravelRegimen({
      products: activeProductsList,
      locationKind: locationKind || 'normal',
      durationDays: durationDays || 7,
      actionGoal: userProfile?.actionGoal || '',
      jetlag: jetlagSignificant,
    });
    setProductIds(suggested);
    if (suggested.length > 0) toast(`Packed ${suggested.length} essentials ✈`, 'success');
  };
  // Auto-run on first open when modal is fresh (no products yet) AND we
  // have enough signal (dates + climate). useRef guard so it only fires
  // once per modal lifecycle, even on rerenders.
  const autoBuildRanRef = useRef(false);
  useEffect(() => {
    if (autoBuildRanRef.current) return;
    if (productIds.length > 0) return;            // user already has picks
    if (!startDate || !endDate) return;            // no duration signal
    if (!locationKind) return;                     // no climate signal
    autoBuildRanRef.current = true;
    runAutoBuild();
  }, [startDate, endDate, locationKind]);

  const canSave = startDate && endDate && endDate >= startDate;

  const handleSave = async () => {
    if (!canSave) {
      toast('Pick a start and end date first', 'info');
      return;
    }
    const today = localDateISO();
    // active = true when today falls inside the date range; otherwise the
    // user is setting it up early and travel mode flips on automatically
    // once today reaches startDate (via the App-level effect).
    const isActive = today >= startDate && today <= endDate;
    const nextTravel = {
      active: isActive,
      startDate,
      endDate,
      durationHint,
      products: productIds,
      locationKind,
      destinationLabel: destinationLabel.trim(),
      destinationTz,
      homeTz,
      tzDeltaHours,
      notes: notes.trim(),
    };
    setUserProfile(prev => {
      const next = { ...prev, travel: nextTravel };
      saveData('userProfile', next).catch(() => {});
      return next;
    });
    toast(isActive ? `Travel mode on · ${destinationLabel || 'have fun'} ✈` : `Travel set · starts ${startDate}`, 'success');
    onClose();
  };

  const handleCancelTravel = async () => {
    if (!isEditing) return;
    setUserProfile(prev => {
      const next = { ...prev, travel: { ...(prev.travel || {}), active: false } };
      saveData('userProfile', next).catch(() => {});
      return next;
    });
    toast('Travel mode off', 'info');
    onClose();
  };

  return (
    <Modal
      compact
      onClose={onClose}
      eyebrow={isEditing ? 'Edit travel' : 'New trip'}
      title={isEditing ? 'Travel mode' : 'Going traveling'}
      actionLabel={canSave ? (isEditing ? 'Save' : 'Start') : 'Save'}
      action={handleSave}
    >
      <div className="space-y-5">
        {/* === DATES === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Dates</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] mb-1" style={{color:'var(--ink-soft)'}}>Start</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-[13px] rounded-[10px]"
                style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink)'}}
              />
            </div>
            <div>
              <div className="text-[10px] mb-1" style={{color:'var(--ink-soft)'}}>End</div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 text-[13px] rounded-[10px]"
                style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink)'}}
              />
            </div>
          </div>
          {durationHint && (
            <div className="text-[10.5px] mt-2" style={{color:'var(--ink-soft)'}}>
              That's a <span style={{color:'var(--ink)', fontWeight:600}}>{durationHint.replace('-', ' ')}</span>.
            </div>
          )}
        </section>

        {/* === DESTINATION + TZ === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Where to</div>
          <input
            type="text"
            value={destinationLabel}
            onChange={(e) => setDestinationLabel(e.target.value)}
            placeholder="City or region"
            className="w-full px-3 py-2 text-[13px] rounded-[10px] mb-2"
            style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink)'}}
          />
          <div className="flex flex-wrap gap-1.5">
            {TRAVEL_DESTINATIONS.map(d => {
              const active = destinationTz === d.tz;
              return (
                <button
                  key={d.tz}
                  type="button"
                  onClick={() => { setDestinationLabel(d.label); setDestinationTz(d.tz); }}
                  className="text-[10.5px] px-2.5 py-1 rounded-full border transition"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--line)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--ink-soft)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >{d.label}</button>
              );
            })}
          </div>
          {jetlagSignificant && (
            <div className="text-[10.5px] mt-2 rounded-[10px] px-2.5 py-1.5" style={{background:'var(--accent-soft)', color:'var(--ink)'}}>
              <span style={{fontWeight:600}}>{Math.abs(tzDeltaHours)}h time difference.</span> Your barrier needs a beat to catch up — skip new actives for the first 2 days.
            </div>
          )}
        </section>

        {/* === LOCATION KIND === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Climate</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {LOCATION_KINDS.map(k => {
              const active = locationKind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setLocationKind(k.id)}
                  className="rounded-[10px] px-2.5 py-2 text-left transition"
                  style={{
                    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--line)'),
                    background: active ? 'var(--accent-soft)' : 'var(--cream)',
                    cursor: 'pointer',
                  }}
                >
                  <div className="text-[11.5px]" style={{color: active ? 'var(--accent)' : 'var(--ink)', fontWeight:600}}>{k.label}</div>
                  <div className="text-[9.5px] mt-0.5 leading-tight" style={{color:'var(--ink-soft)'}}>{k.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* === PRODUCTS PACKED === */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9.5px] tracking-[0.26em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>
              What you're packing · {productIds.length}
            </div>
            <div className="flex items-center gap-3">
              {/* Travel Phase 2.5 (June 2026): one-tap auto-build. Pares
                  the user's shelf to ~5–7 essentials biased by climate +
                  duration + action goal + jetlag. Re-runnable. */}
              <button
                type="button"
                onClick={runAutoBuild}
                disabled={!startDate || !endDate || !locationKind}
                className="text-[10px] tracking-[0.16em] uppercase transition hover:opacity-70 disabled:opacity-40"
                style={{color:'var(--accent)', fontWeight:600, background:'transparent', border:'none', cursor:'pointer'}}
                title={!startDate || !endDate ? 'Add dates first' : !locationKind ? 'Pick a climate first' : 'Auto-build essentials'}
              >
               . Suggest
              </button>
              <button
                type="button"
                onClick={() => setShowProductPicker(v => !v)}
                className="text-[10px] tracking-[0.16em] uppercase transition hover:opacity-70"
                style={{color:'var(--accent)', fontWeight:600, background:'transparent', border:'none', cursor:'pointer'}}
              >
                {showProductPicker ? 'Done picking' : '+ Pick from shelf'}
              </button>
            </div>
          </div>
          {selectedProducts.length > 0 && (
            <div className="space-y-1 mb-2">
              {selectedProducts.map(p => (
                <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px]" style={{background:'var(--accent-soft)'}}>
                  <Icon name="Check" size={11} style={{color:'var(--accent)'}} />
                  <span className="text-[11.5px] flex-1 truncate" style={{color:'var(--ink)'}}>
                    {p.brand}{p.brand && p.name ? ' · ' : ''}{p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className="text-[10px] tracking-[0.18em] uppercase"
                    style={{color:'var(--ink-soft)', cursor:'pointer'}}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {showProductPicker && (
            <div className="rounded-[12px] p-2 max-h-[200px] overflow-y-auto" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              {activeProductsList.length === 0 ? (
                <div className="text-[11px] text-center py-4" style={{color:'var(--ink-soft)'}}>
                  Your shelf is empty. Add products first, then pick travel essentials.
                </div>
              ) : activeProductsList.map(p => {
                const selected = productIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-left transition hover:bg-[var(--cream)]"
                    style={{cursor:'pointer'}}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: selected ? 'var(--accent)' : 'transparent',
                        border: '1.5px solid ' + (selected ? 'var(--accent)' : 'var(--line)'),
                      }}
                    >
                      {selected && <Icon name="Check" size={9} style={{color:'var(--cream)'}} strokeWidth={3} />}
                    </span>
                    <span className="text-[11.5px] flex-1 truncate" style={{color:'var(--ink)'}}>
                      {p.brand}{p.brand && p.name ? ' · ' : ''}{p.name}
                    </span>
                    {p.category && (
                      <span className="text-[9px] tracking-[0.12em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)'}}>
                        {p.category}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* === NOTES === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember? Hotel water hardness, hand-carry limits, etc."
            rows={2}
            className="w-full px-3 py-2 text-[12.5px] rounded-[10px]"
            style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink)', resize:'vertical'}}
          />
        </section>

        {/* === CANCEL TRAVEL (only when editing) === */}
        {isEditing && (
          <section className="pt-3 border-t" style={{borderColor:'var(--line)'}}>
            <button
              type="button"
              onClick={handleCancelTravel}
              className="w-full py-2 text-[10.5px] tracking-[0.18em] uppercase transition hover:opacity-70"
              style={{background:'transparent', color:'var(--ink-soft)', border:'1px solid var(--line)', borderRadius:'9999px', fontWeight:600, cursor:'pointer'}}
            >
              Turn off travel mode
            </button>
          </section>
        )}
      </div>
    </Modal>
  );
};
