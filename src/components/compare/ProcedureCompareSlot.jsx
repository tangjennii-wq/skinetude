// === ProcedureCompareSlot (Wave 3.4 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

// === SHARED MINI MONTH CALENDAR ===
// Compact navigable month grid used across the app (Compact Journal, Compare Time, etc.)
// to replace ad-hoc 30-day swipe strips. Mobile-first: cells are aspect-square, the entire
// component fits in a single mobile screenshot without scrolling.
//
// Props:
//   logs        — array of photo logs (will index by date, prefer full-face per day)
//   onDayClick  — (log, dateISO) => void; triggered when a day with a photo is tapped
//   showThumbs  — when true, render the photo as a thumbnail with the date overlay; when
//                 false (default), render the date number + a small rating beneath
//   procedures  — optional array; days with procedures get a rose marker dot
//   compact     — when true, cells render at min size (used in modals); default true
// === ProcedureCompareSlot ===
// One side of the Compare → Procedure custom upload pair. Tap to upload a photo, then
// surfaces inline date + note inputs. Borderless on the LEFT side; left-bordered on the
// RIGHT to match the existing two-column procedure card aesthetic.
const ProcedureCompareSlot = ({ slot, label, labelColor, value, onChange, fileToBase64, leftBorder = false }) => {
  const fileRef = useRef();
  const todayKey = localDateISO();
  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      onChange({
        photo: b64,
        date: value?.date || todayKey,
        note: value?.note || '',
      });
    } catch (err) { console.error('[ProcedureCompareSlot] read failed', err); }
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <div className={leftBorder ? 'border-l' : ''} style={{borderColor: 'var(--line)'}}>
      <div className="text-[10px] tracking-[0.25em] uppercase px-3 pt-2.5 pb-1" style={{color: labelColor}}>{label}</div>
      <div className="aspect-square overflow-hidden relative" style={{background:'var(--cream-deep)'}}>
        {value?.photo ? (
          <>
            <img src={value.photo} alt={label} className="w-full h-full object-cover" />
            <button
              onClick={() => onChange(null)}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition hover:opacity-90"
              style={{background:'rgba(250,250,246,0.85)', color:'var(--ink-soft)'}}
              title="Remove photo"
            >
              <Icon name="X" size={11} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-1.5 transition hover:bg-[var(--cream)]"
            style={{color:'var(--ink-soft)'}}
          >
            <Icon name="Upload" size={20} />
            <span className="text-[9px] tracking-[0.25em] uppercase">Tap to upload</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePick} className="hidden" />
      </div>
      {value?.photo && (
        <div className="px-3 py-2 space-y-1.5">
          <input
            type="date"
            value={value.date}
            max={todayKey}
            onChange={e => onChange({ ...value, date: e.target.value })}
            className="w-full px-1.5 py-0.5 text-[10px] border rounded-sm"
            style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream)'}}
          />
          <input autoCapitalize="off" autoCorrect="off" spellCheck={false}
            type="text"
            placeholder="Note (optional)"
            value={value.note || ''}
            onChange={e => onChange({ ...value, note: e.target.value })}
            className="w-full px-1.5 py-0.5 text-[10px] border rounded-sm"
            style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream)'}}
          />
        </div>
      )}
    </div>
  );
};
