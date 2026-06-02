// === GuidedPhotoCaptureModal (May 2026) ===
// Single source of truth for the 5-step guided skin photo set.
// Used by: onboarding selfie step, daily check-in, Home cover.
// NOT used by: bulk import from camera roll (that's PhotoImportQueue).
//
// Steps: front → left cheek → right cheek → T-zone → chin/jaw.
// Optional detailed areas: R eye, L eye, neck, back, spot (auto-advance and save with Done).
//
// Each saved photo carries metadata:
//   { angle, source: 'guided_capture', capturedAt }
//
// Borrows camera/snap/upload code patterns from CameraCaptureModal so the
// underlying mechanics (square crop to 800px @ 0.85 quality, mirror logic
// for front cam, NotAllowedError fallback to Upload) stay consistent
// across both surfaces. The user-facing UX is meaningfully different
// (per-step instructions, dotted face guide, thumbnail strip with
// progress), so it lives in its own component instead of being threaded
// through CameraCaptureModal as another mode flag.

const GUIDED_STEPS = [
  { angle: 'front',       label: 'Front',        instruction: 'Face forward.' },
  { angle: 'left_cheek',  label: 'Left cheek',   instruction: 'Left cheek in guide.' },
  { angle: 'right_cheek', label: 'Right cheek',  instruction: 'Right cheek in guide.' },
  { angle: 't_zone',      label: 'T-zone',       instruction: 'Forehead + nose.' },
  { angle: 'chin_jaw',    label: 'Chin / jaw',   instruction: 'Chin + jaw.' },
];

const DETAILED_STEPS = [
  { angle: 'right_eye', label: 'R eye', instruction: 'Right eye in guide.' },
  { angle: 'left_eye',  label: 'L eye',  instruction: 'Left eye in guide.' },
  { angle: 'neck',      label: 'Neck',   instruction: 'Neck in guide.' },
  { angle: 'back',      label: 'Back',   instruction: 'Back in guide.' },
  { angle: 'spot',      label: 'Spot',   instruction: 'Center spot.' },
];

// Short label used in dot/strip (mobile width budget is brutal).
const SHORT_LABEL = {
  front: 'Front', left_cheek: 'Left', right_cheek: 'Right',
  t_zone: 'T-zone', chin_jaw: 'Chin',
  eye_area: 'Eye', right_eye: 'R eye', left_eye: 'L eye',
  neck: 'Neck', back: 'Back', spot: 'Spot', custom: 'Custom',
};
const CORE_SET_LABEL = 'Full face · L cheek · R cheek · T-zone · Chin';

const GuidedPhotoCaptureModal = ({
  // Required: invoked once with the array of captured photos when user taps Done.
  // Each item: { angle, source: 'guided_capture', capturedAt, dataUrl }
  onComplete,
  onClose,
  // Optional: pre-seed captured shots (used by onboarding retake — when
  // the user comes back to the photo step we don't want them to lose
  // what they already captured).
  initialShots = [],
  // Optional: control whether the "detailed areas" extra sheet is reachable.
  // Onboarding wants the simpler 5-step; daily check-in may want detailed.
  allowDetailedAreas = true,
  // Daily check-ins can save after one full-face photo; baseline/set capture
  // can still require every guided angle when the caller asks for it.
  requireFullGuidedSet = false,
  // Pre-set context label (e.g. "Today's check-in" / "Baseline photos").
  contextLabel = '',
}) => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  // shots: indexed by step.angle. Stored as { dataUrl, capturedAt, source }.
  const seedFromInitial = () => {
    const map = {};
    for (const s of initialShots) {
      if (s && s.angle && s.dataUrl) map[s.angle] = { dataUrl: s.dataUrl, capturedAt: s.capturedAt || new Date().toISOString(), source: s.source || 'guided_capture' };
    }
    return map;
  };
  const [shotsByAngle, setShotsByAngle] = useState(seedFromInitial);
  const [stepIdx, setStepIdx] = useState(() => {
    // Land on the first step without a capture so users returning to retake
    // pick up exactly where they left off.
    const initial = seedFromInitial();
    const idx = GUIDED_STEPS.findIndex(s => !initial[s.angle]);
    return idx === -1 ? 0 : idx;
  });
  const [showDetailed, setShowDetailed] = useState(false);
  const [detailedIdx, setDetailedIdx] = useState(0);

  const activeSequence = showDetailed ? DETAILED_STEPS : GUIDED_STEPS;
  const activeIdx = showDetailed ? detailedIdx : stepIdx;
  const currentStep = activeSequence[activeIdx] || GUIDED_STEPS[0];
  const guidedCapturedCount = Object.keys(shotsByAngle).filter(k =>
    GUIDED_STEPS.some(s => s.angle === k) && shotsByAngle[k]
  ).length;
  const totalCapturedCount = Object.keys(shotsByAngle).filter(k => shotsByAngle[k]).length;
  const totalGuided = GUIDED_STEPS.length;
  const currentHasShot = !!shotsByAngle[currentStep.angle];
  const canFinish = showDetailed
    ? totalCapturedCount > 0
    : requireFullGuidedSet
      ? guidedCapturedCount >= totalGuided
      : guidedCapturedCount > 0;

  // Mirror front cam — same logic as CameraCaptureModal.
  const facingMode = 'user';
  const shouldMirror = true;

  useEffect(() => {
    let cancelled = false;
    setCameraReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          const markReady = () => setCameraReady(true);
          if (video.videoWidth > 0 && video.videoHeight > 0) markReady();
          else {
            video.addEventListener('loadedmetadata', markReady, { once: true });
            video.addEventListener('canplay', markReady, { once: true });
          }
          video.play().then(() => {
            if (video.videoWidth > 0 && video.videoHeight > 0) markReady();
          }).catch(() => {});
        }
      } catch (e) {
        const name = e && e.name;
        if (name === 'NotAllowedError') setError('Camera access blocked. Tap Upload to add an existing photo, or grant access in Settings.');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') setError('No camera available. Tap Upload to add an existing photo.');
        else setError('Camera didn’t open. Tap Upload to add an existing photo.');
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // The preview swaps between a captured image and the live <video> as the
  // user advances steps. When the video element remounts, reattach the
  // existing MediaStream so the next step does not appear as a black frame.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    video.play().catch(() => {});
  }, [currentStep.angle, currentHasShot, showDetailed]);

  // === snap() — square crop, downscaled to 800px @ 0.85. Same parameters
  // as CameraCaptureModal so photo payload size is consistent regardless
  // of which surface produced it. Compression here is NOT optional — we
  // never persist raw FileReader output anywhere in the app.
  const snap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      setCameraReady(false);
      return null;
    }
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
    if (!cameraReady) return;
    const dataUrl = snap();
    if (!dataUrl) return;
    const angle = currentStep.angle;
    setShotsByAngle(prev => ({
      ...prev,
      [angle]: { dataUrl, capturedAt: new Date().toISOString(), source: 'guided_capture' },
    }));
    // === AUTO-ADVANCE ===
    // Guided and detailed captures both move to the next requested area so
    // users can keep tapping through without manually choosing every step.
    if (!showDetailed && stepIdx < GUIDED_STEPS.length - 1) {
      setTimeout(() => setStepIdx(i => Math.min(i + 1, GUIDED_STEPS.length - 1)), 250);
    } else if (showDetailed && detailedIdx < DETAILED_STEPS.length - 1) {
      setTimeout(() => setDetailedIdx(i => Math.min(i + 1, DETAILED_STEPS.length - 1)), 250);
    }
  };

  const removeShot = (angle) => {
    setShotsByAngle(prev => {
      const next = { ...prev };
      delete next[angle];
      return next;
    });
  };

  const handleRetakeCurrent = () => {
    removeShot(currentStep.angle);
  };

  const handleSkip = () => {
    if (!showDetailed && currentHasShot && stepIdx < GUIDED_STEPS.length - 1) {
      setStepIdx(i => i + 1);
    } else if (showDetailed && detailedIdx < DETAILED_STEPS.length - 1) {
      setDetailedIdx(i => i + 1);
    }
  };

  const handleDone = async () => {
    if (totalCapturedCount === 0) {
      onClose && onClose();
      return;
    }
    if (!canFinish) return;
    // Flatten shotsByAngle into the array the parent expects, preserving
    // the canonical step order (guided first, then detailed).
    const ordered = [];
    for (const step of GUIDED_STEPS) {
      const s = shotsByAngle[step.angle];
      if (s) ordered.push({ angle: step.angle, source: s.source, capturedAt: s.capturedAt, dataUrl: s.dataUrl });
    }
    for (const step of DETAILED_STEPS) {
      const s = shotsByAngle[step.angle];
      if (s) ordered.push({ angle: step.angle, source: s.source, capturedAt: s.capturedAt, dataUrl: s.dataUrl });
    }
    if (onComplete) {
      await onComplete(ordered);
      return;
    }
    onClose && onClose();
  };

  // === UPLOAD-FROM-LIBRARY fallback for the camera-blocked case.
  // We can't ask the OS picker for the specific angle, so we apply each
  // uploaded file to the CURRENT step in order (first file → current
  // step, second file → next, etc.). Imperfect, but better than blocking
  // the user.
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const reader = new FileReader();
      const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Could not read file'));
        r.readAsDataURL(file);
      });
      // Compress each upload through the canvas pipeline so we never
      // persist a raw 4MB iPhone shot. (Guard 3.7 in check_build.js
      // would catch a regression here.)
      const compress = async (rawDataUrl) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const MAX_OUT = 800;
          const sourceSize = Math.min(img.width, img.height);
          const sx = (img.width - sourceSize) / 2;
          const sy = (img.height - sourceSize) / 2;
          const outSize = Math.min(sourceSize, MAX_OUT);
          const c = canvasRef.current || document.createElement('canvas');
          c.width = outSize; c.height = outSize;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, outSize, outSize);
          resolve(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(rawDataUrl); // fall back to raw on decode failure
        img.src = rawDataUrl;
      });
      const startStep = showDetailed ? detailedIdx : stepIdx;
      const sequence = activeSequence;
      const additions = {};
      for (let i = 0; i < files.length && (startStep + i) < sequence.length; i++) {
        const raw = await fileToDataUrl(files[i]);
        const compressed = await compress(raw);
        const angle = sequence[startStep + i].angle;
        additions[angle] = {
          dataUrl: compressed,
          capturedAt: files[i].lastModified ? new Date(files[i].lastModified).toISOString() : new Date().toISOString(),
          source: 'guided_capture',
        };
      }
      setShotsByAngle(prev => ({ ...prev, ...additions }));
    } catch (err) {
      console.warn('Guided upload failed:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };
  const openUploader = () => { if (uploadInputRef.current) uploadInputRef.current.click(); };

  const capturedGuidedSteps = GUIDED_STEPS.filter(s => shotsByAngle[s.angle]);
  const capturedDetailedSteps = DETAILED_STEPS.filter(s => shotsByAngle[s.angle]);
  const visibleCapturedSteps = showDetailed
    ? [...capturedGuidedSteps, ...capturedDetailedSteps]
    : capturedGuidedSteps;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center md:p-4" style={{background:'rgba(0,0,0,0.96)'}}>
      <canvas ref={canvasRef} style={{display:'none'}} />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        style={{display:'none'}}
      />

      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: 'min(100vw, 430px)',
          height: 'min(100dvh, 860px)',
          maxHeight: '100dvh',
          background:'#050505',
          boxShadow:'0 24px 80px rgba(0,0,0,0.45)',
          borderRadius: 'min(28px, 4vw)',
        }}
      >
        {/* === HEADER === X · simple current step · Done */}
        <div className="px-4 pt-3.5 pb-2 text-white" style={{minHeight: 78}}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => onClose && onClose()}
              className="flex items-center justify-center w-9 h-9 rounded-full transition hover:bg-white/10"
              style={{cursor:'pointer'}}
              aria-label="Close camera"
            >
              <Icon name="X" size={18} />
            </button>
            <div className="text-center">
              <div className="text-[10px] tracking-[0.28em] uppercase" style={{color:'rgba(255,255,255,0.85)', fontWeight:600}}>
                {showDetailed
                  ? `${activeIdx + 1} of ${activeSequence.length}`
                  : `${activeIdx + 1} of ${GUIDED_STEPS.length}`}
              </div>
              <div className="font-sans text-[17px] leading-tight mt-0.5" style={{color:'#fff', fontWeight:700}}>
                {currentStep.label}
              </div>
              {contextLabel ? <div className="text-[8px] mt-0.5 tracking-[0.2em] uppercase opacity-55">{contextLabel}</div> : null}
            </div>
            <button
              onClick={handleDone}
              disabled={!canFinish}
              className="text-[10.5px] tracking-[0.18em] uppercase px-3.5 py-2 rounded-full transition disabled:cursor-not-allowed"
              style={{
                background: canFinish ? 'var(--cream)' : 'rgba(255,255,255,0.08)',
                color: canFinish ? 'var(--ink)' : 'rgba(255,255,255,0.35)',
                border: '1px solid ' + (canFinish ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)'),
                boxShadow: canFinish ? '0 6px 18px rgba(0,0,0,0.28)' : 'none',
                fontWeight: 800,
                cursor: canFinish ? 'pointer' : 'not-allowed',
              }}
            >Done</button>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            {!showDetailed && (
              <div className="flex items-center justify-center gap-1.5" aria-label={`${guidedCapturedCount} of ${GUIDED_STEPS.length} guided photos captured`}>
                {GUIDED_STEPS.map((s, i) => {
                  const done = !!shotsByAngle[s.angle];
                  const active = i === stepIdx;
                  return (
                    <span
                      key={s.angle}
                      style={{
                        width: active ? 18 : 6,
                        height: 6,
                        borderRadius: 999,
                        background: done || active ? 'var(--accent)' : 'rgba(255,255,255,0.25)',
                        opacity: active || done ? 1 : 0.7,
                        transition:'all 160ms ease',
                      }}
                    />
                  );
                })}
              </div>
            )}
            </div>
          <div className="text-center text-[8.5px] mt-2 tracking-[0.14em] uppercase" style={{color:'rgba(255,255,255,0.55)'}}>
            {showDetailed ? 'Focus area · saved to Journal' : `Core · ${CORE_SET_LABEL}`}
          </div>
          {/* === ONE-IS-ENOUGH HINT (May 30 2026 per Jenni) ===
              Users were assuming all 5 dots had to fill before they
              could tap Done. Once 1+ photos are captured AND we don't
              require the full set, surface the optionality explicitly. */}
          {canFinish && !requireFullGuidedSet && (
            <div className="text-center text-[10px] mt-1.5" style={{color:'rgba(255,255,255,0.85)', fontWeight:500}}>
              One’s enough — tap Done. More is bonus.
            </div>
          )}
        </div>

        {/* === Live preview with dotted guide overlay === */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center" style={{minHeight:0}}>
        {error ? (
          <div className="text-white text-center px-6 max-w-sm">
            <p className="font-sans text-base mb-4 leading-relaxed">{error}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={openUploader}
                className="text-[10.5px] tracking-[0.18em] uppercase px-4 py-2 inline-flex items-center gap-1.5 rounded-full"
                style={{background:'var(--accent)', color:'var(--cream)', fontWeight:600, cursor:'pointer'}}
              >
                <Icon name="Upload" size={11} />
                Upload instead
              </button>
              <button
                onClick={onClose}
                className="text-[10px] tracking-[0.2em] uppercase border px-4 py-2 rounded-full"
                style={{borderColor:'rgba(255,255,255,0.5)', color:'#fff', cursor:'pointer'}}
              >Close</button>
            </div>
          </div>
        ) : (
          <>
            {currentHasShot ? (
              // Show the captured shot for review (instead of live preview)
              // when the current step already has a photo. Lets the user
              // glance at it before retaking or moving on.
              <img
                src={shotsByAngle[currentStep.angle].dataUrl}
                alt={currentStep.label}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  transform: shouldMirror ? 'scaleX(-1)' : 'none',
                }}
              />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  transform: shouldMirror ? 'scaleX(-1)' : 'none',
                }}
              />
            )}
            {/* Dotted face/zone guide overlay — pure SVG so it scales. */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}
            >
              {/* Outer face oval — always present. */}
              <ellipse cx="50" cy="48" rx="30" ry="40"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="0.5"
                strokeDasharray="1.2,1"
              />
              {/* Per-step zone highlight in accent color. */}
              {currentStep.angle === 'left_cheek' && (
                <ellipse cx="42" cy="55" rx="11" ry="13" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'right_cheek' && (
                <ellipse cx="58" cy="55" rx="11" ry="13" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 't_zone' && (
                <path d="M 38 25 L 62 25 L 58 50 L 52 62 L 48 62 L 42 50 Z" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'chin_jaw' && (
                <path d="M 30 60 Q 50 88 70 60" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'eye_area' && (
                <ellipse cx="50" cy="40" rx="22" ry="8" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'right_eye' && (
                <ellipse cx="42" cy="40" rx="13" ry="7" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'left_eye' && (
                <ellipse cx="58" cy="40" rx="13" ry="7" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'neck' && (
                <path d="M 38 74 Q 50 82 62 74 L 66 96 L 34 96 Z" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'back' && (
                <path d="M 34 18 Q 50 10 66 18 L 72 88 Q 50 96 28 88 Z" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
              {currentStep.angle === 'spot' && (
                <circle cx="50" cy="50" r="8" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1.2,1" />
              )}
            </svg>
            {/* Instruction caption */}
            <div className="absolute left-0 right-0 bottom-4 text-center px-8 pointer-events-none">
              <p className="font-sans text-[15px] leading-snug" style={{color:'#fff', textShadow:'0 1px 8px rgba(0,0,0,0.6)'}}>
                {currentStep.instruction}
              </p>
            </div>
          </>
        )}
        </div>

        {/* === Captured thumbnails + capture controls === */}
        <div className="px-4 pt-3 pb-4" style={{background:'rgba(0,0,0,0.4)'}}>
        {/* Only show review/focus controls after the first capture; before that, keep the camera path visually primary. */}
        {guidedCapturedCount > 0 && (
          <div className="flex items-end justify-between gap-3 mb-4 px-1 w-full">
            {visibleCapturedSteps.length > 0 && (
              <div className="flex-1 min-w-0 overflow-x-auto pb-1">
                <div className="flex items-center gap-3">
                  {visibleCapturedSteps.map((s) => {
                    const shot = shotsByAngle[s.angle];
                    const guidedIndex = GUIDED_STEPS.findIndex(step => step.angle === s.angle);
                    const detailedIndex = DETAILED_STEPS.findIndex(step => step.angle === s.angle);
                    const active = showDetailed
                      ? (detailedIndex >= 0 && detailedIndex === detailedIdx)
                      : (guidedIndex >= 0 && guidedIndex === stepIdx);
                    const reviewLabel = guidedIndex >= 0
                      ? `Review step ${guidedIndex + 1}: ${s.label}`
                      : `Review focus-area photo: ${s.label}`;
                    return (
                      <div key={s.angle} className="relative flex flex-col items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (guidedIndex >= 0) {
                              setShowDetailed(false);
                              setStepIdx(guidedIndex);
                            } else if (detailedIndex >= 0) {
                              setShowDetailed(true);
                              setDetailedIdx(detailedIndex);
                            }
                          }}
                          className="flex flex-col items-center gap-1"
                          style={{cursor:'pointer'}}
                          aria-label={reviewLabel}
                        >
                          <div
                            className="relative flex items-center justify-center"
                            style={{
                              width: active ? 48 : 44,
                              height: active ? 48 : 44,
                              borderRadius: '50%',
                              border: active ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.45)',
                              overflow: 'hidden',
                              boxShadow: active ? '0 0 0 3px rgba(255,255,255,0.16)' : 'none',
                              transition:'all 140ms ease',
                            }}
                          >
                            {shot ? (
                              <img
                                src={shot.dataUrl}
                                alt={s.label}
                                style={{
                                  width:'100%',
                                  height:'100%',
                                  objectFit:'cover',
                                  transform: shouldMirror ? 'scaleX(-1)' : 'none',
                                }}
                              />
                            ) : null}
                          </div>
                          <span
                            className="text-[9px] uppercase tracking-[0.15em]"
                            style={{
                              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {SHORT_LABEL[s.angle]}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeShot(s.angle);
                          }}
                          className="absolute flex items-center justify-center rounded-full"
                          style={{
                            top: -5,
                            right: 0,
                            width: 18,
                            height: 18,
                            background: 'rgba(5,5,5,0.86)',
                            border: '1px solid rgba(255,255,255,0.55)',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                          aria-label={`Remove ${s.label} photo`}
                        >
                          <Icon name="X" size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {allowDetailedAreas && (
              <button
                type="button"
                onClick={() => {
                  if (showDetailed) setShowDetailed(false);
                  else { setShowDetailed(true); setDetailedIdx(0); }
                }}
                className="flex-shrink-0 ml-auto inline-flex flex-col items-center justify-center gap-1 rounded-[14px] px-3 py-2 transition"
                style={{
                  alignSelf: 'flex-end',
                  background: showDetailed ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid ' + (showDetailed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.16)'),
                  color: '#fff',
                  minWidth: 82,
                  cursor: 'pointer',
                }}
                aria-label={showDetailed ? 'Return to core photo set' : 'Capture focus areas'}
              >
                <Icon name={showDetailed ? 'ChevronLeft' : 'Target'} size={15} />
                <span className="text-[8.5px] tracking-[0.14em] uppercase" style={{fontWeight:750}}>
                  {showDetailed ? 'Core set' : 'Add focus area'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Capture row: Library · Shutter · Retake/Skip */}
        <div className="flex items-center justify-between">
          <button
            onClick={openUploader}
            className="flex flex-col items-center gap-1"
            style={{cursor:'pointer'}}
            aria-label="Upload from library"
          >
            <div className="rounded-full flex items-center justify-center" style={{width:44, height:44, border:'1px solid rgba(255,255,255,0.35)'}}>
              <Icon name="Image" size={18} style={{color:'#fff'}} />
            </div>
            <span className="text-[9px] uppercase tracking-[0.15em]" style={{color:'rgba(255,255,255,0.65)'}}>Library</span>
          </button>

          <button
            onClick={handleShoot}
            disabled={!!error || !cameraReady}
            className="rounded-full flex items-center justify-center transition"
            style={{
              width: 72, height: 72,
              background: '#fff',
              border: '4px solid rgba(255,255,255,0.35)',
              cursor: (error || !cameraReady) ? 'not-allowed' : 'pointer',
              opacity: (error || !cameraReady) ? 0.45 : 1,
            }}
            aria-label={cameraReady ? 'Capture photo' : 'Camera warming up'}
            title={cameraReady ? 'Capture photo' : 'Camera warming up'}
          />

          <div className="flex items-center gap-2">
            {currentHasShot && (
              <button
                onClick={handleRetakeCurrent}
                className="flex flex-col items-center gap-1"
                style={{cursor:'pointer'}}
                aria-label="Retake current photo"
              >
                <div className="rounded-full flex items-center justify-center" style={{width:44, height:44, border:'1px solid rgba(255,255,255,0.35)'}}>
                  <Icon name="RotateCcw" size={18} style={{color:'#fff'}} />
                </div>
                <span className="text-[9px] uppercase tracking-[0.15em]" style={{color:'rgba(255,255,255,0.65)'}}>Retake</span>
              </button>
            )}
            <button
              onClick={handleSkip}
              disabled={showDetailed
                ? detailedIdx >= activeSequence.length - 1
                : (!currentHasShot || stepIdx >= activeSequence.length - 1)}
              className="flex flex-col items-center gap-1"
              style={{
                cursor: (showDetailed ? detailedIdx < activeSequence.length - 1 : (currentHasShot && stepIdx < activeSequence.length - 1)) ? 'pointer' : 'not-allowed',
                opacity: (showDetailed ? detailedIdx < activeSequence.length - 1 : (currentHasShot && stepIdx < activeSequence.length - 1)) ? 1 : 0.45,
              }}
              aria-label={showDetailed ? "Skip to next extra" : "Next core photo"}
            >
              <div className="rounded-full flex items-center justify-center" style={{width:44, height:44, border:'1px solid rgba(255,255,255,0.35)'}}>
                <Icon name={showDetailed ? "SkipForward" : "ChevronRight"} size={18} style={{color:'#fff'}} />
              </div>
              <span className="text-[9px] uppercase tracking-[0.15em]" style={{color:'rgba(255,255,255,0.65)'}}>
                {showDetailed ? 'Skip' : 'Next'}
              </span>
            </button>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
};
