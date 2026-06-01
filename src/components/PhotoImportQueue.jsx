// === PhotoImportQueue (May 2026) ===
// Mobile-first 3-step bulk import: Select → Label → Save.
// Used for backfilling many older skin photos at once, with batch labels.
// Distinct from GuidedPhotoCaptureModal — guided is for today's structured
// 5-photo set; this is for many photos with date/time/zone labeling.
//
// Entry points:
//   - Home "Add a photo" picker → "Import photo history"
//   - Journal "Import photos"
//
// Data shape per pending item (before save):
//   { id, photo (compressed dataUrl), photoPath (null until uploaded),
//     date, timeBucket: 'am'|'pm'|'other',
//     zone: 'front'|'left_cheek'|'right_cheek'|'t_zone'|'chin_jaw'|
//           'eye_area'|'spot'|'other',
//     note, source: 'bulk_import', capturedAt, needsLabel }
//
// On save:
//   - Compress every photo (canvas → 800px @ 0.85)
//   - Upload to Supabase Storage if cloud user
//   - Persist as concrete `logs` array — never saveData('logs', fn)
//   - Preserve metadata on each log entry
//
// After save, confirmation panel:
//   "Photos added · {N} photos were added to your timeline"
//   Actions: Review timeline / Compare first and latest / Add notes / Done
//   If any need labels: "{K} photos need labels — Finish labeling"

const PHOTO_ZONES = [
  { id: 'front',       label: 'Front' },
  { id: 'left_cheek',  label: 'Left cheek' },
  { id: 'right_cheek', label: 'Right cheek' },
  { id: 't_zone',      label: 'T-zone' },
  { id: 'chin_jaw',    label: 'Chin / jaw' },
  { id: 'eye_area',    label: 'Eye area' },
  { id: 'spot',        label: 'Spot photo' },
  { id: 'other',       label: 'Other' },
];

const DEFAULT_ZONE_SEQUENCE = ['front', 'left_cheek', 'right_cheek', 't_zone', 'chin_jaw'];

const ZONE_LABEL = Object.fromEntries(PHOTO_ZONES.map(z => [z.id, z.label]));
const SHORT_ZONE = {
  front: 'front', left_cheek: 'left', right_cheek: 'right',
  t_zone: 't-zone', chin_jaw: 'chin', eye_area: 'eye',
  spot: 'spot', other: 'other',
};

const PhotoImportQueue = ({
  // Initial files (from file input). If empty, the queue opens at Select step.
  initialFiles = [],
  // App-scope bridges
  logs, setLogs, saveData, toast, user,
  uploadPhotoToStorage,
  // Navigation hooks for the confirmation actions
  onClose,
  onNavigateTimeline,
  onOpenCompare,
}) => {
  // Step machine: 'select' → 'label' → 'save' → 'done'
  const [step, setStep] = useState(initialFiles.length > 0 ? 'label' : 'select');
  // Pending items keyed by id.
  const [items, setItems] = useState([]);
  // Set of selected ids.
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Per-photo detail editor (id or null).
  const [editingId, setEditingId] = useState(null);
  // Batch drawer state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState('zone'); // 'date' | 'time' | 'zone'
  const [drawerDate, setDrawerDate] = useState('');
  const [drawerTime, setDrawerTime] = useState('am');
  const [drawerZone, setDrawerZone] = useState('front');
  // Save state
  const [saving, setSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState(null);
  const selectInputRef = useRef(null);

  // === FILE → ITEM PIPELINE ===
  // Read each file, downscale via canvas to 800px @ 0.85, capture EXIF date
  // (best-effort: File.lastModified is the fallback). Default selection ON.
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
  const compress = (rawDataUrl) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_OUT = 800;
      const scale = Math.min(1, MAX_OUT / Math.max(img.width, img.height));
      const outW = Math.max(1, Math.round(img.width * scale));
      const outH = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = outW; c.height = outH;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, outW, outH);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
  const today = localDateISO();
  const importFiles = async (files) => {
    if (!files || files.length === 0) return;
    const next = [];
    for (const f of files) {
      try {
        const raw = await fileToDataUrl(f);
        const compressed = await compress(raw);
        // EXIF parsing is heavy; for v1 use File.lastModified which is the
        // camera-roll capture time for most iPhone shots. Fall back to today.
        const capturedAt = f.lastModified ? new Date(f.lastModified).toISOString() : new Date().toISOString();
        const date = f.lastModified ? new Date(f.lastModified).toISOString().slice(0, 10) : today;
        next.push({
          id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          photo: compressed,
          photoPath: null,
          date,
          timeBucket: 'other',
          zone: null,
          note: '',
          source: 'bulk_import',
          capturedAt,
          // needsLabel = missing zone. Date defaults to capture date when
          // available so it's only the zone that flags as needing label.
          needsLabel: true,
        });
      } catch (e) {
        console.warn('PhotoImportQueue: file read failed', e);
      }
    }
    setItems(prev => [...prev, ...next]);
    setSelectedIds(prev => {
      const s = new Set(prev);
      for (const it of next) s.add(it.id);
      return s;
    });
    if (step === 'select') setStep('label');
  };

  // Bootstrap with initial files if caller provided any.
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      importFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === SELECTION HELPERS ===
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };
  const selectedCount = selectedIds.size;

  // === BATCH APPLY ===
  const applyDate = () => {
    if (!drawerDate) return;
    setItems(prev => prev.map(it => selectedIds.has(it.id) ? { ...it, date: drawerDate } : it));
    toast(`Date applied to ${selectedCount} photo${selectedCount !== 1 ? 's' : ''}`);
  };
  const applyTime = () => {
    setItems(prev => prev.map(it => selectedIds.has(it.id) ? { ...it, timeBucket: drawerTime } : it));
    toast(`Time applied to ${selectedCount} photo${selectedCount !== 1 ? 's' : ''}`);
  };
  const applyZone = () => {
    setItems(prev => prev.map(it => selectedIds.has(it.id) ? { ...it, zone: drawerZone, needsLabel: false } : it));
    toast(`Zone applied to ${selectedCount} photo${selectedCount !== 1 ? 's' : ''}`);
  };
  const applySequence = () => {
    // Apply DEFAULT_ZONE_SEQUENCE in order to selected items (in their
    // current display order). If more selected than sequence items, repeat.
    const seq = DEFAULT_ZONE_SEQUENCE;
    let n = 0;
    setItems(prev => prev.map(it => {
      if (!selectedIds.has(it.id)) return it;
      const z = seq[n % seq.length];
      n += 1;
      return { ...it, zone: z, needsLabel: false };
    }));
    toast(`Sequence applied to ${selectedCount} photo${selectedCount !== 1 ? 's' : ''}`);
  };
  const deleteSelected = () => {
    if (selectedCount === 0) return;
    setItems(prev => prev.filter(it => !selectedIds.has(it.id)));
    setSelectedIds(new Set());
  };

  // === PER-PHOTO EDIT ===
  const updateItem = (id, patch) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch, needsLabel: patch.zone === undefined ? it.needsLabel : !patch.zone } : it));
  };

  // === SAVE PATH ===
  // Build logs, optionally upload to Supabase, persist concrete logs array.
  const handleSave = async () => {
    if (items.length === 0) return;
    setSaving(true);
    try {
      const baseTime = Date.now();
      const newLogs = items.map((it, i) => ({
        id: baseTime + i,
        date: it.date,
        photo: it.photo,
        photoPath: null,
        concerns: [],
        rating: null,
        notes: it.note || '',
        context: '',
        zone: it.zone || 'other',
        angle: it.zone || 'other', // keep both fields for compatibility with guided logs
        timeBucket: it.timeBucket || 'other',
        source: 'bulk_import',
        capturedAt: it.capturedAt,
        aiAnalysis: null,
        analyzing: false,
      }));
      const updated = [...newLogs, ...(logs || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
      setLogs(updated);
      await saveData('logs', updated);
      // Background-upload to Supabase if cloud user — same pattern as
      // GuidedPhotoCaptureModal completion handler.
      if (user && user.cloud && uploadPhotoToStorage) {
        for (const log of newLogs) {
          try {
            // BUG FIX (May 2026): uploadPhotoToStorage returns
            // { path, error } — NOT a raw string. The previous version
            // captured the whole object into `path`, then wrote that
            // object into log.photoPath. hasPhoto stayed true (object
            // is truthy) but Photo couldn't resolve an object as a
            // URL — images silently failed. To the user it looked
            // like the bulk-imported photos had disappeared from
            // Journal/Compare/Timeline.
            const { path } = await uploadPhotoToStorage(user.id, log.photo);
            if (path) {
              setLogs(prev => {
                const next = prev.map(l => l.id === log.id ? { ...l, photoPath: path, photo: undefined } : l);
                saveData('logs', next).catch(() => {});
                return next;
              });
            }
          } catch (e) { /* keep local copy */ }
        }
      }
      const needsCount = items.filter(it => it.needsLabel).length;
      setSavedSummary({ total: items.length, needsCount });
      setStep('done');
    } catch (e) {
      toast('Save failed — try again', 'error');
      console.warn('PhotoImportQueue save failed', e);
    } finally {
      setSaving(false);
    }
  };

  // ----- RENDER -----
  return (
    <div className="fixed inset-0 z-[150] flex flex-col" style={{background:'var(--cream)'}}>
      <input
        ref={selectInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{display:'none'}}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) importFiles(files);
          if (e.target) e.target.value = '';
        }}
      />

      {/* === HEADER === */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <button
          onClick={() => onClose && onClose()}
          className="flex items-center justify-center w-9 h-9 rounded-full transition hover:bg-[var(--cream-deep)]"
          style={{cursor:'pointer', color:'var(--ink-soft)'}}
          aria-label="Close"
        >
          <Icon name="ArrowLeft" size={18} />
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-sans text-[22px] leading-tight" style={{color:'var(--ink)', fontWeight:700}}>Import photos</h1>
          <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>
            {step === 'done' ? `${savedSummary?.total || 0} added` : `${selectedCount} selected`}
          </div>
        </div>
        <div style={{width: 36}} />
      </div>

      {/* === STEP INDICATOR === */}
      <div className="flex items-center justify-center gap-2 px-4 pb-3">
        {['select', 'label', 'save'].map((s, i) => {
          const isCurrent = (step === s) || (step === 'done' && s === 'save');
          const isPast =
            (step === 'label' && s === 'select') ||
            (step === 'save' && s !== 'save') ||
            (step === 'done');
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div
                  className="rounded-full flex items-center justify-center text-[11px]"
                  style={{
                    width: 22, height: 22,
                    background: isCurrent ? 'var(--accent)' : (isPast ? 'var(--accent)' : 'transparent'),
                    color: isCurrent || isPast ? 'var(--cream)' : 'var(--ink-soft)',
                    border: isCurrent || isPast ? '1px solid var(--accent)' : '1px solid var(--line)',
                    fontWeight: 600,
                  }}
                >{i + 1}</div>
                <span className="text-[12px] capitalize" style={{color: isCurrent ? 'var(--accent)' : 'var(--ink-soft)', fontWeight: isCurrent ? 600 : 400}}>
                  {s}
                </span>
              </div>
              {i < 2 && <div style={{flex:'0 0 28px', height:1, background:'var(--line)'}} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* === BODY === */}
      <div className="flex-1 overflow-y-auto px-4 pb-[280px]">
        {step === 'select' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="Upload" size={28} style={{color:'var(--ink-soft)', marginBottom:12}} />
            <h2 className="font-sans text-[18px] mb-1" style={{color:'var(--ink)', fontWeight:700}}>Pick photos to import</h2>
            <p className="text-[12.5px] mb-5" style={{color:'var(--ink-soft)'}}>
              Choose many at once — we’ll let you label them next.
            </p>
            <button
              onClick={() => selectInputRef.current && selectInputRef.current.click()}
              className="rounded-full py-3 px-6 transition hover:opacity-90"
              style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, fontSize:12, letterSpacing:'0.16em', textTransform:'uppercase', cursor:'pointer'}}
            >Choose photos</button>
          </div>
        )}

        {step === 'label' && (
          <div>
            <h2 className="font-sans text-[18px] mb-1" style={{color:'var(--ink)', fontWeight:700}}>Review and label photos</h2>
            <p className="text-[12.5px] mb-4" style={{color:'var(--ink-soft)'}}>
              Tap a photo to review or change its label.
            </p>
            {items.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-[12.5px]" style={{color:'var(--ink-soft)'}}>No photos yet.</p>
                <button
                  onClick={() => selectInputRef.current && selectInputRef.current.click()}
                  className="mt-4 rounded-full py-2.5 px-5"
                  style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, fontSize:11, letterSpacing:'0.16em', textTransform:'uppercase', cursor:'pointer'}}
                >Choose photos</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {items.map(it => {
                  const isSel = selectedIds.has(it.id);
                  const niceDate = (() => {
                    try {
                      const d = new Date(it.date + 'T00:00:00');
                      return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
                    } catch { return it.date; }
                  })();
                  return (
                    <button
                      key={it.id}
                      onClick={() => setEditingId(it.id)}
                      onContextMenu={(e) => { e.preventDefault(); toggleSelect(it.id); }}
                      className="text-left"
                      style={{cursor:'pointer'}}
                    >
                      <div
                        className="relative rounded-[10px] overflow-hidden"
                        style={{aspectRatio:'1 / 1', border: isSel ? '2px solid var(--accent)' : '1px solid var(--line)'}}
                      >
                        <img src={it.photo} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleSelect(it.id); }}
                          className="absolute"
                          style={{
                            top: 6, right: 6,
                            width: 22, height: 22, borderRadius: 999,
                            background: isSel ? 'var(--accent)' : 'rgba(255,255,255,0.85)',
                            border: isSel ? '1px solid var(--accent)' : '1px solid rgba(0,0,0,0.1)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}
                        >
                          {isSel && <Icon name="Check" size={12} style={{color:'#fff'}} />}
                        </div>
                        {it.needsLabel && (
                          <div className="absolute" style={{top:6, left:6, background:'rgba(255, 220, 130, 0.95)', padding:'2px 6px', borderRadius:6, fontSize:9, fontWeight:600, color:'#5b4509', letterSpacing:'0.04em', textTransform:'uppercase'}}>
                            Needs label
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5 px-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                          <Icon name="Calendar" size={9} /> {niceDate}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 uppercase" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                          <Icon name="Moon" size={9} /> {it.timeBucket}
                        </span>
                        {it.zone && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>
                            <Icon name="Camera" size={9} /> {SHORT_ZONE[it.zone] || it.zone}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'done' && savedSummary && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div
              className="rounded-full flex items-center justify-center mb-4"
              style={{width:64, height:64, background:'rgba(192, 95, 60, 0.10)', border:'1px solid rgba(192, 95, 60, 0.18)'}}
            >
              <Icon name="Check" size={28} style={{color:'var(--accent)'}} />
            </div>
            <h2 className="font-sans text-[22px] mb-1" style={{color:'var(--ink)', fontWeight:700}}>Photos added</h2>
            <p className="text-[13px] mb-5" style={{color:'var(--ink-soft)'}}>
              {savedSummary.total} photos were added to your timeline.
            </p>
            {savedSummary.needsCount > 0 && (
              <div className="rounded-[12px] px-4 py-3 mb-5 w-full max-w-sm" style={{background:'rgba(255, 220, 130, 0.2)', border:'1px solid rgba(255, 220, 130, 0.5)'}}>
                <div className="text-[12px] font-medium mb-1" style={{color:'#5b4509'}}>{savedSummary.needsCount} photos need labels</div>
                <button
                  onClick={() => { setStep('label'); setSavedSummary(null); }}
                  className="text-[11px] underline"
                  style={{color:'#5b4509', cursor:'pointer'}}
                >Finish labeling</button>
              </div>
            )}
            <div className="flex flex-col gap-2 w-full max-w-sm">
              <button
                onClick={() => { onClose && onClose(); onNavigateTimeline && onNavigateTimeline(); }}
                className="rounded-full py-3 px-5"
                style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, fontSize:12, letterSpacing:'0.16em', textTransform:'uppercase', cursor:'pointer'}}
              >Review timeline</button>
              <button
                onClick={() => { onClose && onClose(); onOpenCompare && onOpenCompare(); }}
                className="rounded-full py-2.5 px-5"
                style={{background:'transparent', color:'var(--ink)', border: '1px solid var(--line)', fontWeight:600, fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', cursor:'pointer'}}
              >Compare first and latest</button>
              <button
                onClick={() => onClose && onClose()}
                className="py-2.5"
                style={{color:'var(--ink-soft)', fontWeight:600, fontSize:11, letterSpacing:'0.2em', textTransform:'uppercase', cursor:'pointer'}}
              >Done</button>
            </div>
          </div>
        )}
      </div>

      {/* === BATCH LABELS DRAWER (label step only) === */}
      {step === 'label' && items.length > 0 && (
        <div
          className="fixed left-0 right-0 bottom-0"
          style={{
            background:'var(--cream)',
            borderTop:'1px solid var(--line)',
            borderTopLeftRadius:18, borderTopRightRadius:18,
            boxShadow:'0 -12px 30px rgba(39, 31, 27, 0.08)',
            maxHeight: drawerOpen ? '60vh' : 48,
            transition: 'max-height 220ms ease-out',
          }}
        >
          <button
            onClick={() => setDrawerOpen(o => !o)}
            className="w-full flex items-center justify-center py-2"
            style={{cursor:'pointer'}}
            aria-label="Toggle batch labels drawer"
          >
            <div style={{width:36, height:4, borderRadius:4, background:'var(--line)'}} />
          </button>
          <div className="px-4 pb-4">
            <h3 className="font-sans text-[15px] mb-0.5" style={{color:'var(--ink)', fontWeight:700}}>Batch labels</h3>
            <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>
              Update labels for all {selectedCount} selected photos.
            </p>
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-3 rounded-full p-0.5" style={{background:'var(--cream-deep)'}}>
              {['date', 'time', 'zone'].map(t => {
                const active = drawerTab === t;
                const icon = t === 'date' ? 'Calendar' : t === 'time' ? 'Moon' : 'Camera';
                return (
                  <button
                    key={t}
                    onClick={() => setDrawerTab(t)}
                    className="flex-1 rounded-full py-2 flex items-center justify-center gap-1.5"
                    style={{
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--ink-soft)',
                      fontWeight: 600, fontSize: 11, letterSpacing: '0.02em',
                      cursor:'pointer',
                      boxShadow: 'none',
                    }}
                  >
                    <Icon name={icon} size={12} />
                    <span className="capitalize">{t === 'zone' ? 'Angle' : t}</span>
                  </button>
                );
              })}
            </div>
            {drawerTab === 'date' && (
              <div className="space-y-2">
                <input
                  type="date"
                  value={drawerDate}
                  onChange={(e) => setDrawerDate(e.target.value)}
                  className="w-full rounded-[10px] px-3 py-2 text-[12px]"
                  style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink)'}}
                />
                <button
                  onClick={applyDate}
                  disabled={!drawerDate || selectedCount === 0}
                  className="w-full rounded-full py-2.5 disabled:opacity-40"
                  style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', cursor:'pointer'}}
                >Apply date</button>
              </div>
            )}
            {drawerTab === 'time' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {['am', 'pm', 'other'].map(t => {
                    const on = drawerTime === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setDrawerTime(t)}
                        className="rounded-full py-2 uppercase"
                        style={{
                          background: on ? 'var(--accent)' : 'var(--cream)',
                          color: on ? 'var(--cream)' : 'var(--ink)',
                          border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                          fontWeight:600, fontSize:11, letterSpacing:'0.14em', cursor:'pointer',
                        }}
                      >{t}</button>
                    );
                  })}
                </div>
                <button
                  onClick={applyTime}
                  disabled={selectedCount === 0}
                  className="w-full rounded-full py-2.5 disabled:opacity-40"
                  style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', cursor:'pointer'}}
                >Apply time</button>
              </div>
            )}
            {drawerTab === 'zone' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {PHOTO_ZONES.map(z => {
                    const on = drawerZone === z.id;
                    return (
                      <button
                        key={z.id}
                        onClick={() => setDrawerZone(z.id)}
                        className="rounded-full px-3 py-1.5"
                        style={{
                          background: on ? 'var(--accent)' : 'var(--cream)',
                          color: on ? 'var(--cream)' : 'var(--ink)',
                          border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                          fontWeight:600, fontSize:11, letterSpacing:'-0.005em', cursor:'pointer',
                        }}
                      >{z.label}</button>
                    );
                  })}
                </div>
                <button
                  onClick={applyZone}
                  disabled={selectedCount === 0}
                  className="w-full rounded-full py-2.5 disabled:opacity-40"
                  style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', cursor:'pointer'}}
                >Apply angle</button>
                <div className="pt-2 border-t" style={{borderColor: 'var(--line)'}}>
                  <div className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{color:'var(--ink-soft)', fontWeight:600}}>Angle sequence</div>
                  <p className="text-[11px] mb-2" style={{color:'var(--ink-soft)'}}>
                    This will apply in order from first to last selected.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={applySequence}
                      disabled={selectedCount === 0}
                      className="flex-1 rounded-full py-2.5 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                      style={{background:'transparent', color:'var(--accent)', border:'1px solid var(--accent)', fontWeight:600, fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', cursor:'pointer'}}
                    >
                      <Icon name="Layers" size={12} />
                      Apply sequence
                    </button>
                    <button
                      onClick={deleteSelected}
                      disabled={selectedCount === 0}
                      className="rounded-full px-4 py-2.5 disabled:opacity-40 inline-flex items-center gap-1.5"
                      style={{background:'transparent', color:'var(--ink)', border: '1px solid var(--line)', fontWeight:600, fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer'}}
                    >
                      <Icon name="Trash2" size={12} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Sticky save row */}
          <div className="px-4 pb-4 pt-2 border-t flex items-center gap-3" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
            <button
              onClick={handleSave}
              disabled={saving || items.length === 0}
              className="flex-1 rounded-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40"
              style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, fontSize:12, letterSpacing:'0.16em', textTransform:'uppercase', cursor:'pointer'}}
            >
              <Icon name="Check" size={13} />
              {saving ? 'Saving…' : `Save ${items.length} photo${items.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => { /* save then jump to timeline */ handleSave().then(() => { if (onNavigateTimeline) onNavigateTimeline(); }); }}
              className="text-[11px] tracking-[0.14em] uppercase"
              style={{color:'var(--accent)', fontWeight:600, cursor:'pointer'}}
            >Review timeline</button>
          </div>
        </div>
      )}

      {/* === PER-PHOTO EDIT MODAL (lightweight) === */}
      {editingId && (() => {
        const it = items.find(x => x.id === editingId);
        if (!it) return null;
        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center px-4"
            style={{background:'rgba(20, 16, 14, 0.55)', backdropFilter:'blur(6px)'}}
            onClick={() => setEditingId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[20px] overflow-hidden"
              style={{background:'var(--cream)', border: '1px solid var(--line)'}}
            >
              <img src={it.photo} alt="" style={{width:'100%', aspectRatio:'1 / 1', objectFit:'cover'}} />
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Date</div>
                  <input
                    type="date"
                    value={it.date}
                    onChange={(e) => updateItem(it.id, { date: e.target.value })}
                    className="w-full rounded-[10px] px-3 py-2 text-[12px]"
                    style={{background:'var(--cream-deep)', border: '1px solid var(--line)', color:'var(--ink)'}}
                  />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Time</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['am', 'pm', 'other'].map(t => {
                      const on = it.timeBucket === t;
                      return (
                        <button
                          key={t}
                          onClick={() => updateItem(it.id, { timeBucket: t })}
                          className="rounded-full py-1.5 uppercase text-[11px]"
                          style={{
                            background: on ? 'var(--accent)' : 'var(--cream-deep)',
                            color: on ? 'var(--cream)' : 'var(--ink)',
                            border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                            fontWeight:600, letterSpacing:'0.12em', cursor:'pointer',
                          }}
                        >{t}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Angle</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PHOTO_ZONES.map(z => {
                      const on = it.zone === z.id;
                      return (
                        <button
                          key={z.id}
                          onClick={() => updateItem(it.id, { zone: z.id })}
                          className="rounded-full px-2.5 py-1 text-[10.5px]"
                          style={{
                            background: on ? 'var(--accent)' : 'var(--cream-deep)',
                            color: on ? 'var(--cream)' : 'var(--ink)',
                            border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                            fontWeight:600, cursor:'pointer',
                          }}
                        >{z.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.22em] mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Note</div>
                  <textarea
                    value={it.note}
                    onChange={(e) => updateItem(it.id, { note: e.target.value })}
                    rows={2}
                    placeholder="Optional"
                    className="w-full rounded-[10px] px-3 py-2 text-[12px]"
                    style={{background:'var(--cream-deep)', border: '1px solid var(--line)', color:'var(--ink)', fontFamily:'inherit'}}
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => { setItems(prev => prev.filter(x => x.id !== it.id)); setEditingId(null); }}
                    className="rounded-full px-4 py-2 text-[11px]"
                    style={{background:'transparent', color:'var(--ink-soft)', border: '1px solid var(--line)', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer'}}
                  >Remove</button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="ml-auto rounded-full px-5 py-2 text-[11px]"
                    style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', cursor:'pointer'}}
                  >Done</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
