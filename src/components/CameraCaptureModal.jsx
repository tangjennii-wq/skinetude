// === FACE-ID-STYLE CAMERA CAPTURE ===
// Live getUserMedia preview with an oval positioning guide. Captures a still frame at a fixed
// crop so every photo is the same size and framing — making before/after comparisons clean.
// Optional `angles` prop cycles the user through positions: front → left → right.
// Returns base64 data URL via onCapture(dataUrl).
const CameraCaptureModal = ({ onCapture, onClose, angles = ['front'], multi = false, mode = 'face', allowUpload = true }) => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);
  const uploadInputRef = useRef(null);
  const [error, setError] = useState('');
  const [angleIdx, setAngleIdx] = useState(0);
  // capturedShots accumulates either by angle (legacy multi-angle mode) or freely (`multi`).
  const [capturedShots, setCapturedShots] = useState([]);
  // === MULTI-SHOT SLOTS (May 2026 redesign) ===
  // 4-slot tray with auto-assigned labels (Front/Left/Right/Down).
  // activeSlot: null means "append next capture to end"; a number means
  // "next capture REPLACES this slot." User taps a thumbnail or empty
  // slot to set activeSlot.
  const [activeSlot, setActiveSlot] = useState(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const SLOT_LABELS = ['Front', 'Left', 'Right', 'Down'];
  const labelForIndex = (i) => SLOT_LABELS[i] || `Detail ${i - SLOT_LABELS.length + 1}`;
  const isProductMode = mode === 'product';
  // === FLIP CAMERA STATE ===
  // Tracks which lens is currently active. Default = environment (rear) for
  // product mode, user (front/selfie) for face mode. User can flip via the
  // ⟳ button — handy for back-of-head shots, mirror selfies, or scanning a
  // product that's behind the device.
  const [facingMode, setFacingMode] = useState(isProductMode ? 'environment' : 'user');
  const angleLabels = {
    front: 'Look forward',
    left: 'Turn left — show your right cheek',
    right: 'Turn right — show your left cheek',
    up: 'Tilt up — show your jawline',
    down: 'Tilt down — show your forehead'};
  const currentAngle = angles[angleIdx] || 'front';
  // Mirror only when using front-facing camera (user expects selfie view to
  // mirror; rear-facing should NOT mirror so text stays readable).
  const shouldMirror = facingMode === 'user' && !isProductMode;

  // Re-acquire the stream whenever facingMode changes (flip-camera path).
  useEffect(() => {
    let cancelled = false;
    // Stop any existing stream FIRST so the new request isn't denied for
    // already-in-use device.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    (async () => {
      try {
        const constraints = {
          video: isProductMode || facingMode === 'environment'
            ? { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } }
            : { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
          audio: false};
        // Honor explicit override when user flips manually.
        if (facingMode) constraints.video.facingMode = facingMode === 'environment' ? { ideal: 'environment' } : 'user';
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn('Camera access failed:', e);
        // Distinguish denial (user said no, can re-grant in OS settings)
        // from missing-device (desktop with no camera, or browser doesn't
        // support getUserMedia). Both fall back to Upload, but messaging
        // is different. NotAllowedError is the iOS Safari + Chrome
        // denial code; NotFoundError is no device.
        const name = e && e.name;
        if (name === 'NotAllowedError') {
          setError('Camera access blocked. Tap Upload to add an existing photo, or grant access in Settings.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('No camera available. Tap Upload to add an existing photo.');
        } else {
          setError('Camera didn’t open. Tap Upload to add an existing photo.');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const flipCamera = () => setFacingMode(prev => prev === 'user' ? 'environment' : 'user');

  // Capture a square frame. Mirror only when the front-facing camera is
  // active in face mode — keeps text legibility for product/rear shots.
  const snap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    // Crop to a centered square out of the video stream (matches the on-screen
    // guide the user sees), then downscale that square to MAX_OUT for storage +
    // AI analysis. Camera streams on modern phones are 1080p+ which is ~1-2MB
    // per shot at quality 0.92 — way more than skin analysis needs. 800px @
    // quality 0.85 keeps detail strong while cutting payload to ~150-300KB.
    // Drops Haiku inference time noticeably and makes upload feel instant.
    const MAX_OUT = 800;
    const sourceSize = Math.min(vw, vh);
    const sx = (vw - sourceSize) / 2;
    const sy = (vh - sourceSize) / 2;
    const outSize = Math.min(sourceSize, MAX_OUT);
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    if (shouldMirror) {
      ctx.translate(outSize, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, outSize, outSize);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleShoot = () => {
    const dataUrl = snap();
    if (!dataUrl) return;
    // === MULTI-SHOT MODE ===
    // Either appends to the next open slot OR replaces activeSlot if
    // the user tapped a slot to retake. NO slot-based labels — AI
    // labels each photo by region on save (or leaves them unlabeled
    // when no API key). Slots are purely positional.
    if (multi) {
      setCapturedShots(prev => {
        // Replace mode: user tapped a thumbnail/slot to retake.
        if (activeSlot !== null && activeSlot < prev.length) {
          const next = prev.slice();
          next[activeSlot] = { dataUrl, capturedAt: new Date().toISOString(), source: 'camera' };
          return next;
        }
        // Replace empty slot (user tapped a dashed circle past current length).
        if (activeSlot !== null && activeSlot >= prev.length) {
          const padded = prev.slice();
          while (padded.length < activeSlot) padded.push(null);
          padded.push({ dataUrl, capturedAt: new Date().toISOString(), source: 'camera' });
          return padded.filter(Boolean);
        }
        // Default: append to end.
        return [...prev, { dataUrl, capturedAt: new Date().toISOString(), source: 'camera' }];
      });
      setActiveSlot(null);
      return;
    }
    if (angles.length > 1 && angleIdx < angles.length - 1) {
      // Multi-angle mode — collect and advance.
      setCapturedShots(prev => [...prev, { angle: currentAngle, dataUrl }]);
      setAngleIdx(angleIdx + 1);
    } else {
      // Single-angle or last shot — return to caller.
      const finalShots = angles.length > 1
        ? [...capturedShots, { angle: currentAngle, dataUrl }]
        : null;
      onCapture(dataUrl, finalShots);
      onClose && onClose();
    }
  };
  // Multi mode "Done" — return the accumulated shots.
  const handleMultiDone = () => {
    if (capturedShots.length === 0) { onClose && onClose(); return; }
    if (capturedShots.length === 1) {
      // Single result — keep the simple single-photo callback shape.
      onCapture(capturedShots[0].dataUrl, null);
    } else {
      // Multiple results — pass `null` for first arg (no single-photo shortcut)
      // and the array for finalShots.
      onCapture(null, capturedShots);
    }
    onClose && onClose();
  };
  const removeShot = (idx) => {
    setCapturedShots(prev => prev.filter((_, i) => i !== idx));
    setActiveSlot(prev => {
      if (prev === null) return null;
      if (prev === idx) return null;
      return prev > idx ? prev - 1 : prev;
    });
  };

  // === UPLOAD-FROM-LIBRARY (May 2026) ===
  // Lets users add photos from their phone roll or desktop. Supports
  // multi-select regardless of `multi` capture mode — uploading a week's
  // worth of skin pics retroactively is a real use case. Date auto-fills
  // from the File.lastModified timestamp per file (good enough for v1;
  // EXIF parsing is a future refinement). Output shape matches camera
  // capture so the downstream handler doesn't need to fork.
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const shots = await Promise.all(files.map(async (f) => {
        const dataUrl = await fileToDataUrl(f);
        // File.lastModified is a millisecond UTC timestamp. For camera-
        // roll photos this is usually when the photo was taken; for
        // edited or downloaded files it may differ. Good-enough default.
        const capturedAt = f.lastModified ? new Date(f.lastModified).toISOString() : new Date().toISOString();
        return { dataUrl, capturedAt, source: 'upload' };
      }));
      // Single file → keep the simple single-photo callback shape.
      if (shots.length === 1) {
        onCapture(shots[0].dataUrl, shots);
      } else {
        // Multi → null first arg + the array (matches existing multi-shot signature).
        onCapture(null, shots);
      }
      onClose && onClose();
    } catch (err) {
      console.warn('Upload failed:', err);
      // Toast handled at App level if onClose triggers a re-render with no shots.
    } finally {
      // Reset the input so re-uploading the same file fires onChange again.
      if (e.target) e.target.value = '';
    }
  };
  const openUploader = () => {
    if (uploadInputRef.current) uploadInputRef.current.click();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-stretch justify-center md:items-center" style={{background:'rgba(0,0,0,0.95)'}}>
      <canvas ref={canvasRef} style={{display:'none'}} />
      {/* Hidden file input — always allows multi for upload, even when
          live capture is single-shot. */}
      {allowUpload && (
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          style={{display:'none'}}
        />
      )}
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-black md:h-[min(100dvh,860px)] md:max-h-[100dvh] md:w-[min(100vw,430px)] md:rounded-[28px] md:shadow-2xl">
      {/* === HEADER === X · count · Done. Black bar, terracotta Done when >=1 photo. */}
      <div className="flex items-center justify-between px-4 py-3.5 text-white" style={{minHeight: 56}}>
        <button
          onClick={() => {
            if (multi && capturedShots.length > 0) { setExitConfirmOpen(true); }
            else { onClose && onClose(); }
          }}
          className="flex items-center justify-center w-9 h-9 rounded-full transition hover:bg-white/10"
          style={{cursor:'pointer'}}
          aria-label="Close camera"
        >
          <Icon name="X" size={18} />
        </button>
        <div className="text-[10px] tracking-[0.3em] uppercase" style={{color:'rgba(255,255,255,0.85)', fontWeight:600}}>
          {multi
            ? `${capturedShots.length} captured`
            : (angles.length > 1 ? `${angleIdx + 1} / ${angles.length}` : 'TODAY')}
        </div>
        {multi ? (
          <button
            onClick={handleMultiDone}
            disabled={capturedShots.length === 0}
            className="text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full transition disabled:cursor-not-allowed"
            style={{
              color: capturedShots.length > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.35)',
              fontWeight: 600,
              cursor: capturedShots.length > 0 ? 'pointer' : 'not-allowed'}}
            aria-label="Review captured photos"
          >Done</button>
        ) : allowUpload ? (
          <button
            onClick={openUploader}
            className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1.5 transition hover:opacity-80"
            style={{color:'#fff', cursor:'pointer'}}
            title="Upload one or more photos from your library"
            aria-label="Upload from library"
          >
            <Icon name="Upload" size={11} />
            Upload
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Live preview with oval overlay */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-white text-center px-6 max-w-sm">
            <p className="font-sans text-base mb-4 leading-relaxed">{error}</p>
            {/* Show Upload as the primary affordance when allowUpload —
                the error message tells the user to tap Upload, so surface
                it as a visible button right here instead of making them
                hunt for the small "Upload" link in the header. */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {allowUpload && (
                <button
                  onClick={openUploader}
                  className="text-[10.5px] tracking-[0.18em] uppercase px-4 py-2 inline-flex items-center gap-1.5 rounded-full"
                  style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, cursor:'pointer'}}
                >
                  <Icon name="Upload" size={11} />
                  Upload instead
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[10px] tracking-[0.2em] uppercase border px-4 py-2 rounded-full"
                style={{borderColor:'rgba(255,255,255,0.5)', color:'#fff', cursor:'pointer'}}
              >Close</button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
              style={shouldMirror ? {transform:'scaleX(-1)'} : {}}
            />
            {/* Flip-camera button — top-right floating chip. Toggles between
                front (selfie) and rear (environment) lenses. Useful for
                back-of-head shots, mirror selfies, or scanning a label
                while pointed at the back of the device. */}
            <button
              onClick={flipCamera}
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition hover:opacity-80 cursor-pointer z-10"
              style={{background:'rgba(0,0,0,0.5)', color:'#fff', border:'1px solid rgba(255,255,255,0.4)', backdropFilter:'blur(4px)', cursor:'pointer'}}
              aria-label="Flip camera"
              title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
            >
              <Icon name="RefreshCw" size={16} />
            </button>
            {/* Visual guide — oval for face, rounded-rect for product. Both
                 punch a transparent shape into a dim overlay so the user sees
                 what they're framing. The product rect is wider/taller (75%
                 each side) so they can frame multiple bottles or a close-up
                 of one label. */}
            {isProductMode ? (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                <defs>
                  <mask id="rectMask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect x="12.5%" y="20%" width="75%" height="60%" rx="14" ry="14" fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#rectMask)" />
                <rect x="12.5%" y="20%" width="75%" height="60%" rx="14" ry="14" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeDasharray="6 4" />
              </svg>
            ) : (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                <defs>
                  <mask id="ovalMask">
                    <rect width="100%" height="100%" fill="white" />
                    <ellipse cx="50%" cy="50%" rx="35%" ry="42%" fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#ovalMask)" />
                <ellipse cx="50%" cy="50%" rx="35%" ry="42%" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeDasharray="6 4" />
              </svg>
            )}
            {/* === MINIMAL PROMPT === face mode shows nothing (just the oval guide).
                Product mode keeps a small label-framing nudge. Multi-angle mode
                (Compare flow) keeps its angle label. May 2026 redesign: no
                "Take your first shot" / "Categorize areas after" — keep camera
                clean. */}
            {isProductMode && (
              <div className="absolute top-4 left-0 right-0 text-center pointer-events-none">
                <div className="font-sans text-white text-lg md:text-xl drop-shadow-md">
                  {multi && capturedShots.length > 0 ? 'Tap for another · or Done' : 'Frame the label'}
                </div>
              </div>
            )}
            {!isProductMode && !multi && angles.length > 1 && (
              <div className="absolute top-4 left-0 right-0 text-center pointer-events-none">
                <div className="font-sans text-white text-lg md:text-xl drop-shadow-md">
                  {angleLabels[currentAngle] || 'Look forward'}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* === 6-SLOT THUMBNAIL TRAY (multi mode) ===
          Numbered slots only — AI tags each face photo on save
          (region: Full Face / R Cheek / etc.) and surfaces that
          label in Journal/Compare, not in the live capture.
          May 2026 v2 — product mode now shows the tray too. Without
          a visible preview while taking bottle shots, users couldn't
          tell whether the last frame caught the label and were
          tapping Done blind. The angle hint above stays face-only. */}
      {multi && !error && (
        <div className="px-4 pt-2 pb-2">
          {/* Soft angle suggestion — face-only (front/right/left/forehead).
              Product mode skips it: no canonical "angles" to a label,
              just a label you want to fit in the dashed rect. */}
          {!isProductMode && (
            <div className="text-center mb-2">
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.5)'}}
              >
                Try front · right · left · forehead
              </span>
            </div>
          )}
          {/* 6 slots (May 2026 per Jenni — bumped from 4 so users feel
              encouraged to capture more angles in one session). Tray
              still fits a 380px viewport with the tighter gap. */}
          <div className="flex items-end justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map(i => {
              const shot = capturedShots[i];
              const isActive = activeSlot === i;
              const isNext = activeSlot === null && i === capturedShots.length;
              const ring = isActive || isNext ? 'var(--accent)' : (shot ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)');
              return (
                <div
                  key={i}
                  className="relative flex flex-col items-center"
                  style={{width: 58, height: 58}}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSlot(i)}
                    className="flex flex-col items-center"
                    style={{cursor:'pointer'}}
                    aria-label={shot ? `Retake photo ${i + 1}` : `Add photo ${i + 1}`}
                    title={shot ? `Tap to retake` : `Next photo`}
                  >
                    <span
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 54, height: 54, borderRadius: '50%',
                        border: `2px ${shot ? 'solid' : 'dashed'} ${ring}`,
                        background: shot ? 'transparent' : 'rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s'}}
                    >
                      {shot ? (
                        <img src={shot.dataUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                      ) : (
                        <span style={{color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600}}>{i + 1}</span>
                      )}
                    </span>
                  </button>
                  {shot && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeShot(i);
                      }}
                      className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full transition hover:scale-105"
                      style={{
                        width: 20,
                        height: 20,
                        background: 'rgba(0,0,0,0.78)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.72)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                        cursor: 'pointer'}}
                      aria-label={`Remove photo ${i + 1}`}
                      title="Remove this photo"
                    >
                      <Icon name="X" size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === BOTTOM CONTROL BAR === Gallery (left) · Shutter (center) · Flip-camera (right). */}
      {!error && (
        <div className="flex items-center justify-between px-8 py-5" style={{minHeight: 140}}>
          {allowUpload ? (
            <button
              onClick={openUploader}
              className="w-11 h-11 rounded-full flex items-center justify-center transition hover:bg-white/10"
              style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', cursor:'pointer'}}
              aria-label="Upload from library"
              title="Upload from library"
            >
              <Icon name="Image" size={16} />
            </button>
          ) : (
            <div style={{width: 44}} />
          )}
          <button
            onClick={handleShoot}
            className="w-16 h-16 rounded-full transition active:scale-95 flex items-center justify-center"
            style={{
              border: '4px solid #fff',
              background: 'rgba(255,255,255,0.08)',
              cursor: 'pointer'}}
            aria-label="Capture photo"
          >
            <span style={{display:'block', width: 50, height: 50, borderRadius: '50%', background:'#fff'}} />
          </button>
          {/* Multi-shot indicator/toggle. Currently multi is set by caller; this
              is informational ("you can take multiple"). Tapping does nothing
              in v1 — kept as a visual anchor so the layout is balanced. */}
          {multi ? (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff'}}
              title="Multi-shot mode is on"
              aria-label="Multi-shot mode active"
            >
              <Icon name="Layers" size={15} />
            </div>
          ) : (
            <div style={{width: 44}} />
          )}
        </div>
      )}
      </div>

      {/* === EXIT CONFIRMATION === Only renders when user tries to close with shots present. */}
      {exitConfirmOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-end md:items-center justify-center px-4 py-6"
          style={{background:'rgba(0,0,0,0.75)'}}
          onClick={() => setExitConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] overflow-hidden"
            style={{background:'var(--cream)', border: '1px solid var(--line)'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b" style={{borderColor: 'var(--line)'}}>
              <h3 className="text-[18px] leading-tight" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.014em'}}>
                Keep these photos?
              </h3>
              <p className="text-[12px] mt-1.5 leading-snug" style={{color:'var(--ink-soft)'}}>
                You can save them as a check-in or discard them.
              </p>
            </div>
            <div className="px-5 py-4 space-y-2">
              <button
                type="button"
                onClick={() => { setExitConfirmOpen(false); handleMultiDone(); }}
                className="w-full rounded-full py-3 px-4 flex items-center justify-center gap-1.5 transition hover:opacity-90"
                style={{background:'var(--accent)', color:'var(--cream)', border:'1px solid var(--accent)', fontWeight:600, fontSize:12, letterSpacing:'0.12em', cursor:'pointer', textTransform:'uppercase'}}
              >
                <span>Review photos</span>
                <Icon name="ArrowRight" size={12} />
              </button>
              <button
                type="button"
                onClick={() => { setExitConfirmOpen(false); setCapturedShots([]); onClose && onClose(); }}
                className="w-full rounded-full py-2.5 px-4 transition hover:bg-[var(--cream-deep)]"
                style={{background:'transparent', color:'var(--ink)', border: '1px solid var(--line)', fontWeight:600, fontSize:11.5, letterSpacing:'0.04em', cursor:'pointer'}}
              >Discard</button>
              <button
                type="button"
                onClick={() => setExitConfirmOpen(false)}
                className="w-full text-center py-2 transition hover:opacity-70"
                style={{color:'var(--ink-soft)', fontWeight:600, fontSize:10, letterSpacing:'0.22em', cursor:'pointer', textTransform:'uppercase'}}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
