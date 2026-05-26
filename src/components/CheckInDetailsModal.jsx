// === CHECK-IN DETAILS MODAL (May 2026 — diary redesign) ===
// Opens after every camera capture or library upload. Reframed from
// a form-feeling capture screen into a calm diary entry. Aesthetic
// changes:
//   - Top-LEFT back arrow (not top-right "Close")
//   - Editorial header: "Skin check-in" / "How does your skin feel today?"
//   - Date as small editorial sticker, opens date picker on tap
//   - Photos: overlapping circular thumbnails (~52px) — Polaroid layered feel
//   - Rating: 1–5 connected pill rail with word labels (Struggling / Okay / Glowing) anchored below
//   - Noticed chips: neutral nouns (redness, dryness, breakouts, sensitivity, dullness, texture, enlarged pores, other)
//   - "+ Add context" link opens bottom sheet for lifestyle/context factors (sleep, stress, travel, etc.)
//   - Selected context renders as muted metadata chips below the noticed row
//   - Quick note: notebook-paper style — single underline, italic placeholder
//   - "Also today?" row: Procedure + New product action tiles only
//     (Travel + Other moved into the context sheet)
//   - Footer: sticky on mobile, single "Save check-in" button (no Save All N, no Save draft)
// Data:
//   - rating stored as 1–5 with ratingScale:'5' field on the log
//   - noticed: same data as old `concerns` field (kept compatible)
//   - contextFactors: new field, list of context chip keys
//   - note: free-text, same as old `notes`
//
// === FILE STRUCTURE (PR 1b — May 2026 split) ===
// Extracted from index.jsx.source. Concatenated by build_current.js
// AFTER index.jsx.source primitives (Icon, T, CardHeader, Chip,
// Button, RatingPills, ActionCard, ModalHeader, StickyModalFooter)
// and AFTER src/constants + src/resolvers, so all dependencies are
// in module scope at runtime. Identical to inline definition.
//
// === PHASE 3A SUB-EXTRACTION (May 2026) ===
// The four self-contained body sections moved into src/components/checkin/:
//   - CheckInPhotoStrip       — photos row + Edit affordance
//   - CheckInObservationChips — noticed chips + "Add context" + preview row
//   - CheckInContextSheet     — bottom sheet for context factors + quick note
//   - CheckInAlsoTodayActions — Procedure / Product / Supplement tiles
// They're concatenated by build_current.js BEFORE this file so this
// modal's JSX can reference them. Each one is independent — no
// cross-references between the four — which means a future redesign of
// any single section is a local change. Behavior here is byte-equivalent
// to the inline pre-3A version; only the JSX physical location changed.
//
// A CheckInRatingPills wrapper was considered and intentionally NOT
// extracted: the rating section is 3 lines of CardHeader + RatingPills
// composition with no shared logic. Adding a wrapper file would create
// indirection without abstraction. The CardHeader / RatingPills
// primitives already live at module scope and can be reused directly.
const CheckInDetailsModal = ({ photos = [], userConcerns = [], onSave, onCancel, onAddProcedure, onAddProduct, onAddSupplement }) => {
  // photos is an array of { dataUrl, capturedAt, source }. Single shared
  // form applies the SAME rating / noticed / context / note / date to ALL
  // photos in the batch (Jenni's call — keep multi-capture simple).
  const safePhotos = Array.isArray(photos) && photos.length > 0 ? photos : [];
  const queueLen = safePhotos.length;
  const firstPhoto = safePhotos[0] || { dataUrl: '', capturedAt: new Date().toISOString(), source: 'capture' };
  // Default date: capturedAt of the first photo → YYYY-MM-DD.
  const defaultDate = (firstPhoto.capturedAt || new Date().toISOString()).split('T')[0];
  const [date, setDate] = useState(defaultDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rating, setRating] = useState(null); // 1–5
  const [noticed, setNoticed] = useState(new Set()); // keys from OBSERVATION_CHIPS_BASE
  const [contextFactors, setContextFactors] = useState(new Set()); // keys from CONTEXT_FACTORS
  const [note, setNote] = useState('');
  const [showContextSheet, setShowContextSheet] = useState(false);
  const CHECK_IN_REGION_SEQUENCE = ['full-face', 'right-cheek', 'left-cheek', 't-zone', 'chin'];

  // Per-photo region tags (May 2026 per Jenni). The first five daily
  // check-in photos default to the core sequence, then users can correct
  // any one photo from the compact picker in CheckInPhotoStrip.
  const [photoRegions, setPhotoRegions] = useState(() => safePhotos.map((p, idx) => {
    const angleToRegion = {
      front: 'full-face',
      left_cheek: 'left-cheek',
      right_cheek: 'right-cheek',
      t_zone: 't-zone',
      chin_jaw: 'chin',
      eye_area: 'eye-area',
      spot: 'other',
    };
    return p?.area || angleToRegion[p?.angle] || CHECK_IN_REGION_SEQUENCE[idx] || 'full-face';
  }));
  const setPhotoRegion = (idx, region) => {
    setPhotoRegions(prev => {
      const next = [...prev];
      next[idx] = region;
      return next;
    });
  };
  // Local context-sheet draft (so cancel doesn't apply mid-edit).
  const [sheetContext, setSheetContext] = useState(new Set());
  const [sheetNote, setSheetNote] = useState('');

  const toggleNoticed = (key) => {
    setNoticed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleSheetContext = (key) => {
    setSheetContext(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const openContextSheet = () => {
    setSheetContext(new Set(contextFactors));
    setSheetNote(note);
    setShowContextSheet(true);
  };
  const applyContextSheet = () => {
    setContextFactors(new Set(sheetContext));
    if (sheetNote.trim()) setNote(sheetNote.trim());
    setShowContextSheet(false);
  };
  const dateLabel = (() => {
    try {
      const d = new Date(date + 'T12:00:00');
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
      return `${weekday} · ${monthDay}`;
    } catch { return 'TODAY'; }
  })();

  // Payload snapshot shared between Save and the Also-Today action tiles.
  // Built lazily — both call sites invoke it at click time so the latest
  // form state is captured.
  const buildPayload = () => ({
    date: new Date(date + 'T12:00:00').toISOString(), // noon-anchored ISO to avoid TZ drift
    rating, // 1–5 going forward
    ratingScale: '5', // version tag — read-side normalizeRatingTo5 handles legacy 1–10
    // `concerns` kept for back-compat with display surfaces that still
    // read it. Mirror noticed → concerns so Compare/Journal/etc. don't
    // need to change for the noticed rename.
    concerns: Array.from(noticed).map(k => {
      const found = OBSERVATION_CHIPS_BASE.find(c => c.key === k);
      return found ? found.label : k;
    }),
    noticed: Array.from(noticed),
    contextFactors: Array.from(contextFactors),
    notes: note.trim(),
    // Per-photo region tags — caller uses these to set each log's `area`.
    // Length matches photos (or empty if no photos).
    photoRegions: Array.isArray(photoRegions) ? [...photoRegions] : [],
  });

  const handleSave = () => onSave(buildPayload());

  return (
    <>
    <div className="fixed inset-0 z-[65] flex items-center justify-center px-3 py-6" style={{background:'rgba(0,0,0,0.55)'}}>
      <div
        className="relative w-full max-w-md rounded-[20px] overflow-hidden flex flex-col"
        style={{background:'var(--cream)', border:'1px solid var(--line)', maxHeight:'92vh'}}
      >
        {/* === HEADER === Back arrow top-left, editorial title. Photos + date sticker sit in the body. */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-shrink-0 -ml-1 p-1 transition hover:opacity-70"
            style={{color:'var(--ink-soft)', cursor:'pointer'}}
            aria-label="Close check-in"
            title="Close"
          >
            <Icon name="ArrowLeft" size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] tracking-[0.28em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>Skin Check-In</div>
            <h3 className="text-[18px] leading-tight mt-0.5" style={{color:'var(--ink)', fontWeight:700, letterSpacing:'-0.014em'}}>
              How does your skin feel today?
            </h3>
          </div>
          {/* Date sticker — small editorial chip, opens picker on tap. */}
          <button
            type="button"
            onClick={() => setShowDatePicker(s => !s)}
            className="flex-shrink-0 rounded-full px-2.5 py-1 transition hover:opacity-80"
            style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink-soft)', fontWeight:600, fontSize:9.5, letterSpacing:'0.18em', cursor:'pointer'}}
            title="Tap to change date"
          >{dateLabel}</button>
        </div>
        {showDatePicker && (
          <div className="px-4 pb-3">
            <input
              type="date"
              value={date}
              max={(new Date()).toISOString().split('T')[0]}
              onChange={(e) => { setDate(e.target.value); setShowDatePicker(false); }}
              className="w-full px-3 py-2 rounded-[10px] text-[13px]"
              style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink)'}}
            />
          </div>
        )}

        {/* === BODY === scrollable; sticky save bar pinned below.
            space-y-4 keeps editorial breathing room without feeling form-y. */}
        <div className="flex-1 overflow-y-auto px-5 pt-1 pb-5 space-y-4">
          {/* === PHOTOS STRIP === Phase 3A — uses CheckInPhotoStrip.
              May 2026: per-photo region tagging wired through regions +
              onRegionChange. Default 'full-face' for each photo. */}
          <CheckInPhotoStrip
            photos={safePhotos}
            onEdit={onCancel}
            regions={photoRegions}
            onRegionChange={setPhotoRegion}
          />
          {/* Hairline section divider — matches the structured feel of the vision mockup */}
          <div style={{height:1, background:'var(--line)', opacity:0.7}} />

          {/* === RATING (1–5) === inline — trivial composition of primitives;
              extracting to its own file adds indirection without abstraction. */}
          <div>
            <CardHeader eyebrow="Overall Skin Today" marginBottom={T.space.md} />
            <RatingPills value={rating} onChange={setRating} labels={RATING_5_WORDS} />
          </div>

          {/* Hairline divider */}
          <div style={{height:1, background:'var(--line)', opacity:0.7}} />
          {/* === NOTICED CHIPS + ADD CONTEXT === Phase 3A — uses CheckInObservationChips */}
          <CheckInObservationChips
            noticed={noticed}
            toggleNoticed={toggleNoticed}
            contextFactors={contextFactors}
            note={note}
            onAddContext={openContextSheet}
          />

          {/* === ALSO TODAY? — REMOVED May 2026 per Jenni ===
              The Procedure / Product / Supplement tiles used to live here
              but duplicated the "Used something else?" sheet on the Home
              Regimen card, forcing the user to hold two parallel mental
              models of "what I did today". Mental model now:
                - Skin check-in   = how my skin LOOKS + FEELS today.
                - Today's Regimen = what I DID today (planned ritual
                                    + "Used something else?" for one-offs).
              The onAddProcedure / onAddProduct / onAddSupplement props are
              kept on the function signature so callers don't crash; they
              just aren't rendered. */}

          {/* Hairline divider */}
          <div style={{height:1, background:'var(--line)', opacity:0.7}} />
          {/* === QUICK NOTE === soft-bordered textarea (replaced underline-only).
              Now the final form step (May 2026) — sits right above the
              sticky Save bar so the user's last thought before commit is
              the freeform diary line. */}
          <div>
            <div className="text-[9.5px] tracking-[0.28em] uppercase mb-1.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Quick Note</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else worth writing down?"
              rows={2}
              className="w-full px-3 py-2 text-[13px] resize-none focus:outline-none transition"
              style={{
                background:'var(--cream-deep)',
                border:'1px solid var(--line)',
                borderRadius: 10,
                color:'var(--ink)',
                fontFamily:'inherit',
                fontStyle: note ? 'normal' : 'italic',
              }}
            />
          </div>
        </div>

        {/* === STICKY SAVE BAR === Phase 2 — uses StickyModalFooter + Button primitives */}
        <StickyModalFooter>
          <Button
            variant="primary"
            onClick={() => handleSave()}
            trailingIcon="ArrowRight"
            maxWidth={9999}
            fullWidth
          >Save skin check-in</Button>
        </StickyModalFooter>
      </div>
    </div>

      {/* === CONTEXT SHEET === Phase 3A — uses CheckInContextSheet */}
      <CheckInContextSheet
        open={showContextSheet}
        sheetContext={sheetContext}
        toggleSheetContext={toggleSheetContext}
        sheetNote={sheetNote}
        setSheetNote={setSheetNote}
        onApply={applyContextSheet}
        onCancel={() => setShowContextSheet(false)}
      />
    </>
  );
};
