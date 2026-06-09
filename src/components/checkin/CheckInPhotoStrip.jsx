// === CheckInPhotoStrip (Phase 3A — extracted from CheckInDetailsModal) ===
// The "photos row" at the top of the check-in modal.
//
// May 2026 addition (per Jenni): each photo gets a compact region picker.
// Keep the daily check-in set to the core five regions only.
// The region tag flows into the saved log's `area` field and drives which
// photo becomes today's cover photo (the first full-face wins). Tapping a
// thumbnail selects which photo the single compact picker controls.
//
// Props
//   photos — Array<{ dataUrl, capturedAt, source }>.
//   onEdit — () => void. Reopens the upstream capture surface.
//   regions — Array<string> aligned by index to photos. Default 'full-face'.
//   onRegionChange — (index, region) => void. Caller updates state.
const REGION_OPTS = [
  { id: 'full-face',   label: 'Full face' },
  { id: 'left-cheek',  label: 'L cheek' },
  { id: 'right-cheek', label: 'R cheek' },
  { id: 't-zone',      label: 'T-zone' },
  { id: 'chin',        label: 'Chin' },
  { id: 'eye-area',    label: 'Eye area' },
  { id: 'right-eye',   label: 'R eye' },
  { id: 'left-eye',    label: 'L eye' },
  { id: 'neck',        label: 'Neck' },
  { id: 'back',        label: 'Back' },
  { id: 'spot',        label: 'Spot' },
  { id: 'other',       label: 'Other' },
];
const getRegionLabel = (id) => (REGION_OPTS.find(r => r.id === id) || REGION_OPTS[0]).label;

const CheckInPhotoStrip = ({ photos = [], onEdit, regions = [], onRegionChange }) => {
  const queueLen = photos.length;
  const photoCountLabel = `${queueLen} ${queueLen === 1 ? 'PHOTO' : 'PHOTOS'}`;
  const [selectedPhotoIdx, setSelectedPhotoIdx] = React.useState(0);
  const [lightboxIndex, setLightboxIndex] = React.useState(null);
  const supportsRegions = typeof onRegionChange === 'function';
  const visiblePhotos = photos.slice(0, 5);
  const selectedIdx = Math.min(selectedPhotoIdx, Math.max(queueLen - 1, 0));
  const selectedRegion = regions[selectedIdx] || 'full-face';
  const selectedRegionLabel = getRegionLabel(selectedRegion);
  const lightboxPhotos = photos.map((p, i) => ({
    item: p,
    src: p.dataUrl || p.photoPath || p.photo,
    label: `Photo ${i + 1}`,
    sub: getRegionLabel(regions[i] || 'full-face'),
  }));

  React.useEffect(() => {
    if (selectedPhotoIdx >= queueLen && queueLen > 0) setSelectedPhotoIdx(0);
  }, [queueLen, selectedPhotoIdx]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[9.5px] tracking-[0.28em] uppercase" style={{color:'var(--accent)', fontWeight:600}}>{photoCountLabel}</div>
        {supportsRegions && queueLen > 1 && (
          <div className="text-[9px] tracking-[0.22em] uppercase text-right" style={{color:'var(--muted)', fontWeight:700}}>
            Tap to view
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center flex-shrink-0" style={{paddingLeft: 4}}>
          {visiblePhotos.map((p, i) => {
            const isOverflowSlot = i === 4 && photos.length > 5;
            const overflow = photos.length - 5;
            const selected = supportsRegions && selectedIdx === i;
            return (
              <button
                type="button"
                key={i}
                className="relative flex-shrink-0 p-0 m-0"
                style={{
                  width: 52, height: 52,
                  marginLeft: i === 0 ? 0 : -10,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: `${selected ? 3 : 2}px solid ${selected ? 'var(--accent)' : 'var(--cream)'}`,
                  boxShadow: selected ? '0 0 0 3px rgba(229,60,45,0.18), 0 6px 16px rgba(0,0,0,0.16)' : '0 1px 3px rgba(0,0,0,0.06)',
                  transform: selected ? 'scale(1.1)' : 'scale(1)',
                  transformOrigin: 'center center',
                  transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                  zIndex: selected ? 20 : 10 - i,
                  background: 'transparent',
                  cursor: 'zoom-in',
                }}
                onClick={() => {
                  setSelectedPhotoIdx(i);
                  setLightboxIndex(i);
                }}
                title="Open larger photo"
                aria-label={`Open photo ${i + 1}`}
              >
                <Photo
                  item={p}
                  src={p.dataUrl || p.photoPath || p.photo}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {isOverflowSlot && (
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: 'rgba(28,25,23,0.55)',
                      color: 'var(--cream)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >+{overflow}</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-[10px] tracking-[0.18em] uppercase transition hover:opacity-70"
          style={{color:'var(--accent)', fontWeight:600, cursor:'pointer', flexShrink: 0}}
          title="Reopen camera to retake or add"
          aria-label="Edit photos"
        >Edit</button>
      </div>
      {/* === REGION PICKER === One compact picker for the selected photo.
           This keeps the daily check-in short even for 5-photo sets. */}
      {supportsRegions && photos.length > 0 && (
        <div
          className="mt-3 rounded-[14px]"
          style={{background:'var(--cream-deep)', border: '1px solid var(--line)', padding:'10px 10px 9px'}}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[9.5px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)', fontWeight:700}}>
              Photo {selectedIdx + 1}
            </span>
            <span className="text-[11px]" style={{color:'var(--accent)', fontWeight:700}}>{selectedRegionLabel}</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{scrollbarWidth:'none', WebkitOverflowScrolling:'touch'}}>
            {REGION_OPTS.map(opt => {
              const on = selectedRegion === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onRegionChange(selectedIdx, opt.id)}
                  className="rounded-full px-2.5 py-1 transition flex-shrink-0 whitespace-nowrap"
                  style={{
                    background: on ? 'var(--accent)' : 'var(--cream)',
                    color: on ? 'var(--cream)' : 'var(--ink)',
                    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                    fontSize: 10.5,
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
        </div>
      )}
      {queueLen > 1 && (
        <p className="text-[10px] mt-2 leading-snug" style={{color:'var(--ink-soft)'}}>
          {queueLen > 5
            ? 'Same rating + context. Extras can change in Journal.'
            : 'Same rating + context for this set.'}
        </p>
      )}
      {lightboxIndex != null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};
