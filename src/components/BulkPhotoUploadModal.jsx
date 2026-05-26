// === BULK PHOTO UPLOAD MODAL (Wave 1.2 extract — May 2026) ===
// Same DOM, same behavior. App passes state/helpers via props.

// === BULK PHOTO UPLOAD MODAL ===
// For onboarding or back-filling history. User picks many photos in one shot, assigns a
// default date to all (or sets per-photo dates), then we create one log entry per photo.
// No AI analysis upfront — kept fast for batches. User can run analyze later via cover.
const BulkPhotoUploadModal = ({
  // Wave 1.2 (May 2026): App-scope state/helpers now passed as props so
  // the component can live outside App without recreating its dependencies.
  // Codex audit (May 2026): setCoverRoutineRebuildToken was missing — the
  // bulk save couldn't trigger the cover ritual refresh after a backfill.
  // Module-scope helpers (PHOTO_BUCKET, computePhotoCleanup, extractPhotoDate,
  // localDateISO, supabaseClient, uploadPhotoToStorage) remain global and
  // resolve from the runtime bundle.
  logs, setLogs,
  saveData,
  toast,
  user,
  setShowBulkUploadModal,
  setCoverRoutineRebuildToken,
}) => {
  const [items, setItems] = useState([]); // [{ photo: b64, date: 'YYYY-MM-DD', area: 'full-face' }]
  const [defaultDate, setDefaultDate] = useState(localDateISO());
  const [perPhotoMode, setPerPhotoMode] = useState(false); // false = all share defaultDate
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const todayKey = localDateISO();

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const todayK = localDateISO();
    const next = [];
    let exifHits = 0;
    for (const f of files) {
      try {
        // Try EXIF DateTimeOriginal first; fall back to file.lastModified; final
        // fallback is the manually-set defaultDate. Future dates are clamped to today.
        let detected = await extractPhotoDate(f);
        let auto = !!detected;
        if (!detected && f.lastModified) {
          const d = new Date(f.lastModified);
          if (!isNaN(d.getTime())) {
            detected = localDateISO(d);
            auto = true;
          }
        }
        if (detected && detected > todayK) detected = todayK;
        const finalDate = detected || defaultDate;
        if (auto) exifHits++;
        const b64 = await fileToBase64(f);
        next.push({ photo: b64, date: finalDate, area: 'full-face', autoDated: auto });
      } catch (err) {
        console.error('[BulkUpload] failed to read file', err);
      }
    }
    setItems(prev => [...prev, ...next]);
    // If any photos came in with detected dates, auto-flip to per-photo mode so the
    // user sees the inferred dates and can override individually if needed. Without
    // this, the defaultDate sync useEffect would clobber the EXIF dates immediately.
    if (exifHits > 0) {
      setPerPhotoMode(true);
      toast(`${exifHits}/${files.length} photo${files.length === 1 ? '' : 's'} auto-dated from metadata`, 'info');
    }
    // Reset the input so picking the same file again will retrigger.
    if (fileRef.current) fileRef.current.value = '';
  };

  const updateItem = (idx, patch) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };
  // When defaultDate changes and we're NOT in per-photo mode, sync all items to it.
  React.useEffect(() => {
    if (perPhotoMode) return;
    setItems(prev => prev.map(it => ({ ...it, date: defaultDate })));
  }, [defaultDate, perPhotoMode]);

  const close = () => { setShowBulkUploadModal(false); };

  const handleSave = async () => {
    if (items.length === 0) { toast('Pick some photos first', 'error'); return; }
    setSaving(true);
    try {
      const newEntries = items.map((it, i) => ({
        id: Date.now() + i,
        date: it.date,
        area: it.area || 'full-face',
        rating: 5,
        notes: '',
        concerns: [],
        photo: it.photo,
        photoPath: null,
        ratingExplanation: null,
        suggestedRating: null,
        usedProducts: [],
        usedTags: [],
        aiAnalysis: null,
        analyzing: false,
      }));
      const updated = [...logs, ...newEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
      // Close fast then persist. Same pattern as SkinLogModal create-path.
      setLogs(updated);
      setCoverRoutineRebuildToken(t => t + 1);
      close();
      toast(`${newEntries.length} ${newEntries.length === 1 ? 'photo' : 'photos'} saved`, 'info');
      saveData('logs', updated).catch(e => {
        console.error('[BulkUpload] saveData failed:', e);
        toast(`Save error: ${e?.message || 'unknown'}`, 'error');
      });
      // Background photo uploads to Supabase Storage (cloud users only).
      if (user?.cloud && user?.id && supabaseClient) {
        for (const entry of newEntries) {
          if (!entry.photo) continue;
          (async (entryId, entryPhoto) => {
            try {
              const { path, error } = await uploadPhotoToStorage(user.id, entryPhoto);
              if (path) {
                setLogs(prev => {
                  const swapped = prev.map(l => {
                    if (l.id !== entryId) return l;
                    const { photo, ...rest } = l;
                    return { ...rest, photoPath: path };
                  });
                  const { toDeletePaths, updatedLogs, trimmed } = computePhotoCleanup(swapped);
                  if (toDeletePaths.length > 0) {
                    supabaseClient.storage.from(PHOTO_BUCKET).remove(toDeletePaths)
                      .then(() => toDeletePaths.forEach(p => _signedUrlCache.delete(p)))
                      .catch(e => console.error('Bulk photo delete error:', e));
                  }
                  if (trimmed > 0) {
                    setTimeout(() => toast(`Trimmed ${trimmed} oldest photo${trimmed > 1 ? 's' : ''} — one anchor preserved per month`, 'info'), 100);
                  }
                  saveData('logs', updatedLogs);
                  return updatedLogs;
                });
              } else if (error) {
                console.error('[BulkUpload] photo upload failed:', error);
              }
            } catch (uErr) {
              console.error('[BulkUpload] photo upload exception:', uErr);
            }
          })(entry.id, entry.photo);
        }
      }
    } catch (e) {
      console.error('[BulkUpload] save error:', e);
      toast(`Save failed: ${e?.message || 'unknown'}`, 'error');
    }
    setSaving(false);
  };

  return (
    <Modal compact onClose={close} eyebrow="Atelier" title="Bulk upload">
      <div className="space-y-3">
        <p className="text-[12px] leading-relaxed" style={{color:'var(--ink-soft)'}}>
          Add many photos at once and date them. Defaults to all on one day; flip <span className="italic">set per photo</span> to tag dates individually.
        </p>

        {/* Default-date picker + mode toggle — compact one-row layout */}
        <div className="border px-2.5 py-2 space-y-1.5" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[8px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>Default date</div>
            <button
              type="button"
              onClick={() => setPerPhotoMode(v => !v)}
              className="text-[8px] tracking-[0.2em] uppercase italic flex items-center gap-1"
              style={{color: perPhotoMode ? 'var(--accent)' : 'var(--ink-soft)'}}
            >
              {perPhotoMode ? <><Icon name="Check" size={9} /> Per-photo</> : 'Set per photo'}
            </button>
          </div>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={() => setDefaultDate(todayKey)}
              disabled={perPhotoMode}
              className="px-3 py-1 text-[9px] tracking-[0.18em] uppercase rounded-full border transition disabled:opacity-40"
              style={{
                borderColor: defaultDate === todayKey ? 'var(--ink)' : 'var(--line)',
                background: defaultDate === todayKey ? 'var(--ink)' : 'transparent',
                color: defaultDate === todayKey ? 'var(--cream)' : 'var(--ink-soft)',
              }}
            >Today</button>
            <input
              type="date"
              value={defaultDate}
              max={todayKey}
              disabled={perPhotoMode}
              onChange={e => setDefaultDate(e.target.value)}
              className="flex-1 px-1.5 py-1 text-[10px] border rounded-full min-w-0 disabled:opacity-40 italic text-center"
              style={{
                borderColor: defaultDate !== todayKey ? 'var(--accent)' : 'var(--line)',
                background: defaultDate !== todayKey ? 'var(--accent-soft)' : 'var(--cream)',
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>

        {/* File picker */}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed py-5 flex flex-col items-center gap-1.5 transition hover:bg-[var(--cream-deep)]"
            style={{borderColor:'var(--line)', color:'var(--ink-soft)', background:'var(--cream)'}}
          >
            <Icon name="Upload" size={20} />
            <span className="text-[10px] tracking-[0.25em] uppercase">{items.length === 0 ? 'Pick photos' : 'Add more'}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
        </div>

        {/* Thumbnail grid with per-photo controls */}
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="text-[9px] tracking-[0.2em] uppercase flex items-center justify-between" style={{color:'var(--ink-soft)'}}>
              <span>{items.length} photo{items.length === 1 ? '' : 's'} ready</span>
              <button onClick={() => setItems([])} className="italic underline" style={{color:'var(--ink-soft)'}}>Clear all</button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="border" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
                  <div className="relative w-full aspect-square overflow-hidden" style={{background:'var(--cream-deep)'}}>
                    <img src={it.photo} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeItem(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition hover:opacity-90"
                      style={{background:'rgba(250,250,246,0.85)', color:'var(--ink-soft)'}}
                      title="Remove"
                    >
                      <Icon name="X" size={10} />
                    </button>
                  </div>
                  {/* Per-thumbnail controls — compact, uniform 10px text. To dodge
                      iOS Safari's force-bump-to-16px rule for native inputs, we render
                      BUTTONS as the visible UI; the actual date/select inputs sit
                      invisible behind them and are triggered programmatically. */}
                  <div className="p-1.5 space-y-1">
                    {(() => {
                      const fmtShort = (d) => {
                        if (!d) return '—';
                        const [y, m, day] = d.split('-').map(Number);
                        const dt = new Date(y, m - 1, day);
                        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      };
                      const areaLabel = it.area === 'full-face' ? 'Full face'
                        : it.area === 'nose-tzone' ? 'T-zone'
                        : (it.area || 'Full face').charAt(0).toUpperCase() + (it.area || 'full-face').slice(1).replace(/-/g, ' ');
                      const dateInputId = `bulk-date-${idx}`;
                      const areaSelectId = `bulk-area-${idx}`;
                      const triggerDate = () => {
                        const el = document.getElementById(dateInputId);
                        if (!el) return;
                        if (typeof el.showPicker === 'function') el.showPicker();
                        else el.click();
                      };
                      const triggerArea = () => {
                        const el = document.getElementById(areaSelectId);
                        if (!el) return;
                        if (typeof el.showPicker === 'function') el.showPicker();
                        else el.click();
                      };
                      return (
                        <>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={triggerDate}
                              className="w-full px-1 py-0.5 text-[9px] italic border rounded-sm flex items-center justify-center gap-1 transition hover:bg-[var(--cream-deep)]"
                              style={{borderColor: it.autoDated ? 'var(--accent)' : 'var(--line)', color: it.autoDated ? 'var(--accent)' : 'var(--ink)', background:'var(--cream)'}}
                              title={it.autoDated ? 'Auto-detected from photo metadata — tap to edit' : 'Tap to edit date'}
                            >
                              {it.autoDated && <Icon name="Sparkles" size={7} />} {fmtShort(it.date)}
                            </button>
                            <input
                              id={dateInputId}
                              type="date"
                              value={it.date}
                              max={todayKey}
                              onChange={e => updateItem(idx, { date: e.target.value, autoDated: false })}
                              className="absolute inset-0 opacity-0 pointer-events-none"
                              tabIndex={-1}
                            />
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={triggerArea}
                              className="w-full px-1 py-0.5 text-[9px] border rounded-sm flex items-center justify-center transition hover:bg-[var(--cream-deep)]"
                              style={{borderColor:'var(--line)', color:'var(--ink-soft)', background:'var(--cream)'}}
                              title="Tap to change area"
                            >
                              {areaLabel}
                            </button>
                            <select
                              id={areaSelectId}
                              value={it.area}
                              onChange={e => updateItem(idx, { area: e.target.value })}
                              className="absolute inset-0 opacity-0 pointer-events-none"
                              tabIndex={-1}
                            >
                              <option value="full-face">Full face</option>
                              <option value="hairline">Hairline</option>
                              <option value="forehead">Forehead</option>
                              <option value="cheeks">Cheeks</option>
                              <option value="chin">Chin</option>
                              <option value="nose-tzone">Nose / T-zone</option>
                              <option value="neck">Neck</option>
                              <option value="body">Body</option>
                              <option value="back">Back</option>
                            </select>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || items.length === 0}
          className="w-full py-2 tracking-[0.2em] text-[10px] uppercase transition disabled:opacity-50"
          style={{background:'var(--ink)', color:'var(--cream)'}}
        >
          {saving ? 'Saving…' : items.length === 0 ? 'Pick photos to begin' : `Save ${items.length} ${items.length === 1 ? 'photo' : 'photos'}`}
        </button>
      </div>
    </Modal>
  );
};
