// === SkinLogModal (Wave 5.2 extract — May 2026) ===
// Pulled out of App so the ~1027-line modal can be reasoned about
// independently and so App's render method is shorter. Behavior preserved
// exactly. All App-scope state + setters passed as props.
//
// This modal is the single-entry skin log: photo capture/upload → AI
// rating suggestion → manual rating slider → concerns chips → notes
// (with #hashtag parsing) → "Also today" inline procedure/product-start
// rail. Save path supports both single-photo and multi-photo sessions
// (multi fans out to N log entries sharing date/rating/concerns/notes).
//
// Module-scope (no prop bridge needed): Modal, Icon, CameraCaptureModal,
// supabaseClient, PHOTO_BUCKET, _signedUrlCache, computePhotoCleanup,
// getApiKey, fileToBase64, uploadPhotoToStorage, localDateISO,
// getActualUsage, formatUsageForPrompt, parseSkinRegion,
// stripAnalysisStructuredLines, parseSkinMetrics.

const SkinLogModal = ({
  // === DATA ===
  logs, setLogs,
  products, setProducts,
  procedures, setProcedures,
  regimenLogs,
  sensitivities,
  user,
  // === FORM STATE (kept at App scope so the form survives App re-renders) ===
  editingLogId, setEditingLogId,
  skinLogForm, setSkinLogForm,
  skinLogFormRef,
  skinLogSuggesting, setSkinLogSuggesting,
  skinLogShowCamera, setSkinLogShowCamera,
  setShowLogModal,
  // === COVER REBUILD TRIGGER ===
  setCoverRoutineRebuildToken,
  // === POST-SAVE SUGGESTION BANNER ===
  setPostSaveSuggestion,
  // === SISTER MODALS ===
  setShowApiKeyModal,
  setShowPhotoImportQueue,
  // === App-scope helpers ===
  buildUserProfileBlock,
  modalScrollMemo,
  useModalScrollPreserve,
  toast,
  saveData,
  callClaude}) => {
  const editingLog = editingLogId ? logs.find(l => l.id === editingLogId) : null;
  const isEditingLog = !!editingLog;
  // === HOISTED FORM STATE ===
  // SkinLogModal recreates on every App render. Aliasing form to App-scope
  // state keeps it alive across re-renders. Initial seeding is handled by
  // the App-level useEffect on showLogModal/editingLogId.
  const formSeed = editingLog ? {
    date: editingLog.date,
    area: editingLog.area || 'full-face',
    rating: editingLog.rating || 5,
    notes: editingLog.notes || '',
    concerns: editingLog.concerns || [],
    photo: editingLog.photo || null,
    photoPath: editingLog.photoPath || null,
    ratingExplanation: editingLog.ratingExplanation || null,
    suggestedRating: editingLog.suggestedRating || null,
    usedProducts: editingLog.usedProducts || [],
    usedTags: editingLog.usedTags || [],
    inlineProc: null,
    inlineProductStart: null} : {
    date: localDateISO(),
    area: 'full-face', rating: 5, notes: '', concerns: [], photo: null,
    photoPath: null,
    ratingExplanation: null, suggestedRating: null,
    usedProducts: [],
    usedTags: [],
    inlineProc: null,
    inlineProductStart: null};
  const form = skinLogFormRef.current || skinLogForm || formSeed;
  const setForm = (updater) => {
    const base = skinLogFormRef.current || skinLogForm || formSeed;
    const next = typeof updater === 'function' ? updater(base) : updater;
    skinLogFormRef.current = next;
    setSkinLogForm(next);
  };
  const suggestingRating = skinLogSuggesting;
  const setSuggestingRating = setSkinLogSuggesting;
  const showCamera = skinLogShowCamera;
  const setShowCamera = setSkinLogShowCamera;
  const [tagInput, setTagInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const fileRef = useRef();
  const scrollSentinelRef = useModalScrollPreserve('skinLog');
  const concernOptions = ['Acne', 'Redness', 'Dryness', 'Oiliness', 'Texture', 'Dark Spots', 'Fine Lines', 'Dullness', 'Sensitivity', 'Breakout'];
  const activeProductsForLog = products.filter(p => !p.endDate);

  const toggleProductUsed = (id) => {
    setForm(f => ({ ...f, usedProducts: f.usedProducts.includes(id) ? f.usedProducts.filter(x => x !== id) : [...f.usedProducts, id] }));
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.usedTags.includes(t)) {
      setForm(f => ({ ...f, usedTags: [...f.usedTags, t] }));
    }
    setTagInput('');
  };
  const removeTag = (t) => {
    setForm(f => ({ ...f, usedTags: f.usedTags.filter(x => x !== t) }));
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setForm(f => ({ ...f, photo: b64, ratingExplanation: null, suggestedRating: null }));
    if (canRunAnalysis()) {
      suggestRating(b64);
    }
  };

  const suggestRating = async (photoOverride) => {
    const photo = photoOverride || form.photo;
    if (!photo) return;
    if (!canRunAnalysis()) { setShowApiKeyModal(true); return; }
    setSuggestingRating(true);
    try {
      const prompt = `You are an educational skin analyzer reviewing a photo of someone's ${form.area.replace(/-/g, ' ')} for a personal tracking app. This is a visual observation, not a medical diagnosis. Rate the visible skin condition objectively on a 1–10 scale where:

1–3: Significant active issues (heavy acne, severe inflammation, broken skin, severe dryness/peeling)
4–5: Moderate concerns (visible breakouts, redness, uneven texture, dullness)
6–7: Generally healthy with minor concerns (small blemishes, slight uneven tone)
8–9: Clear, balanced, even-toned, healthy
10: Exceptionally clear, glowing, optimal

Be honest and specific. Don't be falsely positive. Look at: texture, blemishes/breakouts, redness, hyperpigmentation, hydration cues, evenness, pore visibility, and overall complexion.

Respond in this EXACT format:

RATING: [single number 1-10]

WHAT I SEE:
[2-3 short sentences MAX describing specifically what's visible — texture, blemishes, tone, redness, hydration. Be specific about location like "small clusters near the chin" or "redness across the cheeks". Don't make up things you can't see. Keep it tight, no fluff.]

KEY CONCERNS:
[2-3 short bullet points of the most notable visible issues, or "No notable concerns" if 8+]

WHAT'S WORKING:
[1-2 short bullet points of what looks healthy/good]

PRODUCT RECOMMENDATIONS:
[2-3 specific evidence-based product recommendations addressing the key concerns. Include both a drugstore option and a higher-end option where relevant. Be specific with named products and active ingredients (e.g., "The Ordinary Niacinamide 10% + Zinc 1% — addresses oiliness and uneven tone, $7"). If skin is 8+, suggest 1-2 products to maintain.]`;

      const result = await callClaude(prompt, '', photo, { voice: true });
      const ratingMatch = result.match(/RATING:\s*(\d+)/);
      const suggestedRating = ratingMatch ? Math.min(10, Math.max(1, parseInt(ratingMatch[1]))) : null;
      const explanation = result.replace(/RATING:\s*\d+\s*/, '').trim();
      setForm(f => ({ ...f, suggestedRating, ratingExplanation: explanation, rating: suggestedRating || f.rating }));
    } catch (e) {
      console.error('Rating suggestion failed:', e);
      toast('Could not analyze photo — try again', 'error');
    }
    setSuggestingRating(false);
  };

  const acceptSuggestion = () => {
    if (form.suggestedRating) {
      setForm(f => ({ ...f, rating: f.suggestedRating }));
    }
  };

  // === HASHTAG PARSER ===
  const parseHashtagsFromNotes = (notes, existingTags) => {
    const found = [...String(notes || '').matchAll(/#([a-zA-Z0-9_\-]{2})/g)]
      .map(m => m[1].toLowerCase());
    const merged = new Set([...(existingTags || []).map(t => String(t).toLowerCase()), ...found]);
    return [...merged];
  };

  const handleSubmit = async () => {
    const safeForm = skinLogFormRef.current || skinLogForm || form || formSeed;
    console.log('[SkinLog] handleSubmit start', { hasPhoto: !!safeForm.photo, photoLen: safeForm.photo?.length || 0, isEditingLog, user: !!user, refMatch: skinLogFormRef.current === safeForm });
    if (safeForm.photo) {
      const kb = Math.round((safeForm.photo.length * 0.75) / 1024);
      toast(`Saving photo · ${kb} KB`, 'info');
    } else {
      toast('Saving entry (no photo)', 'info');
    }
    // === EDIT MODE ===
    if (isEditingLog) {
      try {
        const mergedTags = parseHashtagsFromNotes(safeForm.notes, safeForm.usedTags);
        const photoChanged = !!(safeForm.photo && safeForm.photo !== editingLog?.photo) || (!safeForm.photo && editingLog?.photo);
        const enriched = {
          ...safeForm,
          usedTags: mergedTags,
          ...(photoChanged && canRunAnalysis() ? { aiAnalysis: null, analyzing: true, analyzingStartedAt: Date.now() } : {})};
        const updated = logs.map(l => l.id === editingLogId ? { ...l, ...enriched } : l)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        setLogs(updated);
        setCoverRoutineRebuildToken(t => t + 1);
        setEditingLogId(null);
        setShowLogModal(false);
        setSkinLogForm(null);
        skinLogFormRef.current = null;
        setSkinLogSuggesting(false);
        setSkinLogShowCamera(false);
        // === T5 FIX (May 2026) ===
        // Old wording named only the photo re-analysis. The user
        // also needs to know cross-surface reads (Skin Snapshot,
        // last7Avg, concern tally) will refresh — "Snapshot
        // refreshing" surfaces that without listing each surface.
        toast(photoChanged && canRunAnalysis() ? 'Entry updated — Snapshot refreshing' : 'Entry updated · Snapshot refreshing');
        saveData('logs', updated).catch(e => {
          console.error('[SkinLog] edit saveData failed:', e);
          toast(`Save error: ${e?.message || 'unknown'}`, 'error');
        });

        if (photoChanged && canRunAnalysis() && safeForm.photo) {
          (async () => {
            try {
              const recentContext = logs.slice(0, 5).map(l => `${l.date}: ${l.area} ${l.rating}/10 [${l.concerns?.join(',') || ''}]`).join('; ') || 'no prior entries';
              const tagged = (safeForm.usedProducts || []).map(uid => products.find(p => p.id === uid)).filter(Boolean);
              const taggedBlock = tagged.length > 0
                ? tagged.map(p => `• ${p.name}${p.brand ? ` (${p.brand})` : ''} — ${p.activeIngredients || 'no actives listed'}`).join('\n')
                : 'none tagged on this entry';
              const usage30 = getActualUsage(products, regimenLogs, logs, { windowDays: 30 });
              const prompt = `Analyze this skin journal entry. Output 3-4 short bullets — the reader is scanning, not reading.

FORMAT (strict):
- Each line starts with "- " (dash + space). One observation per bullet.
- NO markdown bold (no **text**), NO headers, NO paragraphs.
- Each bullet ≤ 15 words. TOTAL ≤ 50 words.
- Prefix EVERY bullet with a type tag in brackets: [OBSERVE] for visual reading of the skin, [CAUSE] for mechanism / why this is happening, [ACTION] for what to do next. Example: "- [OBSERVE] forehead congestion mild today". Pick the most-fitting single tag per bullet.
- Bake evidence quality into the prose itself in plain language: "well-studied for…", "evidence suggests…", "limited data, mechanism-based…", "emerging evidence…". Don't use letter grades.
- For [ACTION] bullets ONLY, also append a parseable evidence tag at the END in this exact format: [ev:strong|moderate|emerging:source] where source is one of RCT, observational, mechanism, expert. Example: "- [ACTION] Try azelaic 10% — well-studied for PIH. [ev:strong:RCT]". Skip this tag for [OBSERVE] and [CAUSE] bullets.
- Be specific and mechanism-anchored. No fluff, no preamble, no signoff.

CONTENT: cover one pattern vs prior entries OR a likely cause for the concerns, plus one concrete actionable suggestion.

CRITICAL: only consider products listed under TODAY'S TAGGED PRODUCTS or USER'S ACTIVE ROUTINE below. Do NOT assume any other product is being used. The user has products on their shelf that they OWN but are NOT currently using.

Date: ${safeForm.date}
Area: ${safeForm.area}
Rating: ${safeForm.rating}/10
Concerns: ${safeForm.concerns?.join(', ') || 'none'}
User notes: ${safeForm.notes || '(none)'}

Recent context: ${recentContext}

TODAY'S TAGGED PRODUCTS (specifically marked as used for this photo):
${taggedBlock}

USER'S ACTUAL ROUTINE (from check-ins + photo logs, last 30 days):
${formatUsageForPrompt(usage30)}`;
              const aiAnalysis = await callClaude(prompt, '', safeForm.photo, { voice: true });
              setLogs(prev => {
                const next = prev.map(l => l.id === editingLogId ? { ...l, aiAnalysis, analyzing: false } : l);
                saveData('logs', next);
                return next;
              });
            } catch (e) {
              // Bug #9 (May 31 2026): used to only console.warn — user
              // never knew the re-analysis failed and JournalView had no
              // breadcrumb to render a retry control. Now: stash error
              // marker fields on the log so JournalView can find them
              // (aiAnalysisError + aiAnalysisFailedAt), and toast.
              console.error('Edit re-analysis failed:', e);
              try { toast('Re-analysis failed — tap to retry', 'error'); } catch (_) {}
              setLogs(prev => {
                const next = prev.map(l => l.id === editingLogId ? {
                  ...l,
                  analyzing: false,
                  aiAnalysisError: (e && e.message) ? e.message : 'Analysis unavailable',
                  aiAnalysisFailedAt: Date.now(),
                } : l);
                saveData('logs', next);
                return next;
              });
            }
          })();
        }

        if (photoChanged && safeForm.photo && typeof safeForm.photo === 'string' && safeForm.photo.startsWith('data:') && user?.cloud && user?.id && supabaseClient) {
          (async () => {
            try {
              const { path, error } = await uploadPhotoToStorage(user.id, safeForm.photo);
              if (path) {
                setLogs(prev => {
                  const swapped = prev.map(l => {
                    if (l.id !== editingLogId) return l;
                    const { photo, ...rest } = l;
                    return { ...rest, photoPath: path };
                  });
                  saveData('logs', swapped);
                  return swapped;
                });
              } else if (error) {
                console.error('[SkinLog] edit photo upload failed:', error);
              }
            } catch (e) { console.error('[SkinLog] edit upload exception:', e); }
          })();
        }
      } catch (e) {
        console.error('[SkinLog] handleSubmit edit-mode error:', e);
        toast(`Save failed: ${e?.message || 'unknown error'}`, 'error');
      }
      return;
    }
    // === CREATE MODE ===
    const isMulti = Array.isArray(safeForm.photos) && safeForm.photos.length > 1;
    const id = Date.now();
    try {
      const mergedTags = parseHashtagsFromNotes(safeForm.notes, safeForm.usedTags);
      let updated;
      let newEntries;
      if (isMulti) {
        const { photos: _drop, photo: _dropPhoto, ...sharedFields } = safeForm;
        newEntries = safeForm.photos.map((p, i) => ({
          ...sharedFields,
          usedTags: mergedTags,
          photo: p.dataUrl,
          area: p.area || 'full-face',
          id: id + i,
          daypart: sharedFields.daypart || (new Date().getHours() < 12 ? 'am' : 'pm'),
          aiAnalysis: null,
          analyzing: canRunAnalysis() ? true : false,
          analyzingStartedAt: canRunAnalysis() ? Date.now() : undefined}));
        updated = [...logs, ...newEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
        toast(`${newEntries.length} entries saved`, 'info');
      } else {
        const newLog = {
          ...safeForm,
          usedTags: mergedTags,
          id,
          daypart: safeForm.daypart || (new Date().getHours() < 12 ? 'am' : 'pm'),
          aiAnalysis: null,
          analyzing: canRunAnalysis() ? true : false,
          analyzingStartedAt: canRunAnalysis() ? Date.now() : undefined};
        delete newLog.photos;
        delete newLog.inlineProc;
        delete newLog.inlineProductStart;
        newEntries = [newLog];
        updated = [...logs, newLog].sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      // === A: Inline procedure / product creation ===
      const inlineProcData = safeForm.inlineProc;
      const inlineProductData = safeForm.inlineProductStart;
      let didCreateInlineProc = false;
      let didCreateInlineProduct = false;
      if (inlineProcData && (inlineProcData.name || '').trim()) {
        const newProc = {
          id: Date.now() + 1,
          name: inlineProcData.name.trim(),
          type: inlineProcData.type || 'other',
          date: safeForm.date,
          notes: '',
          beforePhotos: [],
          afterPhotos: []};
        const updatedProcs = [...procedures, newProc];
        setProcedures(updatedProcs);
        saveData('procedures', updatedProcs).catch(e => console.error('[SkinLog inline-proc] save failed:', e));
        didCreateInlineProc = true;
      }
      if (inlineProductData && (inlineProductData.name || '').trim()) {
        const newProduct = {
          id: Date.now() + 2,
          name: inlineProductData.name.trim(),
          brand: '',
          category: '',
          startDate: safeForm.date,
          useTimes: [],
          useDays: [0,1,2,3,4,5,6],
          frequency: 'daily',
          activeIngredients: '',
          mainIngredients: '',
          tags: [],
          concerns: [],
          notes: ''};
        // products is read-only in this scope; we use the prop to read and
        // the App-scope setter to write. Append at App scope via prop.
        // NB: we don't call setProducts directly here because products is
        // passed in by value; instead we let the inline flow handle this.
        // Actual write path: the create handler at App level. For now,
        // we rely on the prop passed in for read; products updates here
        // require the App-level setter. Since the original modal did this
        // by calling setProducts directly at App scope, we need that
        // setter too. (Added to props below.)
        const updatedProducts = [...products, newProduct];
        // setProducts is passed in via props
        if (typeof setProducts === 'function') {
          setProducts(updatedProducts);
          saveData('products', updatedProducts).catch(e => console.error('[SkinLog inline-product] save failed:', e));
          didCreateInlineProduct = true;
        }
      }
      setLogs(updated);
      setCoverRoutineRebuildToken(t => t + 1);
      setShowLogModal(false);
      setSkinLogForm(null);
      skinLogFormRef.current = null;
      setSkinLogSuggesting(false);
      setSkinLogShowCamera(false);
      const userHasLoggedProcedureBefore = (procedures || []).length > 0;
      const suggestProcedure = !didCreateInlineProc && userHasLoggedProcedureBefore;
      const suggestProductStart = !didCreateInlineProduct;
      if (suggestProcedure || suggestProductStart) {
        setPostSaveSuggestion({
          date: safeForm.date,
          suggestProcedure,
          suggestProductStart});
      }
      console.log('[SkinLog] state updated, modal closed; persisting in background', { logsCount: updated.length, newEntryIds: newEntries.map(n => n.id) });
      saveData('logs', updated).catch(e => {
        console.error('[SkinLog] create saveData failed:', e);
        toast(`Save error: ${e?.message || 'unknown'}`, 'error');
      });

      // === BACKGROUND: Photo upload to Supabase, per entry ===
      for (const entry of newEntries) {
        if (entry.photo && user?.cloud && user?.id && supabaseClient) {
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
                console.error('[SkinLog] photo upload failed:', error);
                toast(`Photo cloud upload failed: ${error}`, 'error');
              }
            } catch (uErr) {
              console.error('[SkinLog] photo upload exception:', uErr);
            }
          })(entry.id, entry.photo);
        }
      }
    } catch (e) {
      console.error('[SkinLog] handleSubmit create-mode error:', e);
      toast(`Save failed: ${e?.message || 'unknown error'}`, 'error');
      return;
    }

    // === BACKGROUND AI per-entry analysis ===
    if (canRunAnalysis() && newEntries.length > 0) {
      if (newEntries.length === 1) {
        // === T5 FIX (May 2026) === — append the cross-surface cue.
        toast('Entry saved — analyzing in the background… · Snapshot refreshing', 'info');
      } else {
        toast(`Analyzing ${newEntries.length} photos in the background… · Snapshot refreshing`, 'info');
      }
      const usage30 = getActualUsage(products, regimenLogs, logs, { windowDays: 30 });
      const recentContext = logs.slice(0, 5).map(l => `${l.date}: ${l.area} ${l.rating}/10 [${l.concerns?.join(',') || ''}]`).join('; ') || 'no prior entries';
      const sensList = (sensitivities || []).join(', ') || 'none recorded';
      const todaysProductDetail = (safeForm.usedProducts || []).map(uid => {
        const p = products.find(pp => pp.id === uid);
        if (!p) return null;
        return `• ${p.name} (${p.brand || '—'}, ${p.category}) — actives: ${p.activeIngredients || 'unknown'}; tags: ${(p.tags || []).join(', ') || 'none'}`;
      }).filter(Boolean).join('\n') || 'none recorded';
      const usageBlock = formatUsageForPrompt(usage30);
      for (const entry of newEntries) {
        (async (entryId, entryArea, entryPhoto) => {
          try {
            const irritationKws = ['redness', 'irritation', 'irritated', 'inflamed', 'breakout', 'blemish', 'acne', 'burning', 'stinging', 'sensitive', 'rash', 'erythema'];
            const hasIrritation = (safeForm.concerns || []).some(c => irritationKws.some(kw => c.toLowerCase().includes(kw)))
              || (safeForm.rating != null && Number(safeForm.rating) <= 5);
            const culpritSection = hasIrritation
              ? `\n\nIrritation flagged (low rating or redness/breakout-type concern). Examine TODAY'S TAGGED PRODUCTS and the ACTIVELY USED section against the user's known SENSITIVITIES and against common irritant ingredients (fragrance, denatured alcohol, high-strength acids, retinoids if new, physical exfoliants). If a product is worth flagging to watch, name it specifically — quote the exact product name. If nothing in the routine plausibly fits, say so honestly. DO NOT suggest products from the LAPSED or UNUSED sections.`
              : '';
            const prompt = `Analyze this skin journal entry. Focus on the AREA shown in this photo specifically.

FORMAT (strict):
- Output 3-4 short bullets only. Each line starts with "- " (dash + space).
- NO markdown bold (no **text**), NO headers, NO paragraphs.
- Each bullet ≤ 15 words. TOTAL ≤ 50 words.
- Prefix EVERY bullet with a type tag in brackets: [OBSERVE] for visual reading of the skin, [CAUSE] for mechanism / why this is happening, [ACTION] for what to do next. Example: "- [OBSERVE] forehead congestion mild today". Pick the most-fitting single tag per bullet.
- Bake evidence quality into the prose itself in plain language: "well-studied for…", "evidence suggests…", "limited data, mechanism-based…", "emerging evidence…". Don't use letter grades.
- For [ACTION] bullets ONLY, also append a parseable evidence tag at the END in this exact format: [ev:strong|moderate|emerging:source] where source is one of RCT, observational, mechanism, expert. Example: "- [ACTION] Try azelaic 10% — well-studied for PIH. [ev:strong:RCT]". Skip this tag for [OBSERVE] and [CAUSE] bullets.
- Be specific and mechanism-anchored. No fluff, no preamble, no signoff.

CONTENT: one pattern OR one thing worth watching, plus one concrete actionable suggestion.${culpritSection}

CRITICAL CONSTRAINT: only consider products in TODAY'S TAGGED PRODUCTS or in the ACTIVELY USED section. Products in OCCASIONAL/LAPSED/UNUSED are owned but NOT in current routine.

Today's entry:
- Date: ${safeForm.date}
- Area: ${entryArea} ← ANALYZE THIS AREA SPECIFICALLY
- Rating: ${safeForm.rating}/10
- Concerns: ${safeForm.concerns?.join(', ') || 'none'}
- Notes: ${safeForm.notes || 'none'}
- Photo provided (analyze the visible ${entryArea.replace(/-/g, ' ')} skin)

TODAY'S TAGGED PRODUCTS:
${todaysProductDetail}

USER-REPORTED SENSITIVITIES: ${sensList}
${buildUserProfileBlock ? buildUserProfileBlock() : ''}
Recent context: ${recentContext}

USER'S ACTUAL ROUTINE (from check-ins + photo tagging, NOT shelf):
${usageBlock}${hasIrritation ? `

If you identify a product worth flagging, end the response with: "WATCH: <product name> — <one-sentence why>".` : ''}

After the bullets, on TWO SEPARATE FINAL LINES (not bullets, no dashes), append:
METRICS: redness=<Clear|Low|Mild|Moderate|High>, hydration=<Plump|Good|Balanced|Dry|Parched>, texture=<Smooth|Even|Uneven|Rough|Bumpy>, breakouts=<Clear|Few|Some|Many|Severe>
REGION: <Full Face|R Cheek|L Cheek|Forehead|T-zone|Chin|Nose|Jaw|Hairline|Neck|Back|Body|Other>

Pick the SINGLE most accurate word per METRIC based on what's actually visible. Pick ONE REGION based on what's framed (Full Face when whole face is shown; Other when off-face/specific spot). Capitalize as shown. Do not skip either line.`;
            const snapPrompt = `Look at this skincare progress photo and rate the visible skin on six dimensions. Reply with ONLY this JSON object, no prose, no code fences:
{"redness":"<Clear|Low|Mild|Moderate|High>","hydration":"<Plump|Good|Balanced|Dry|Parched>","texture":"<Smooth|Even|Uneven|Rough|Bumpy>","breakouts":"<Clear|Few|Some|Many|Severe>","barrier":"<Strong|Steady|Holding|Compromised|Stripped>","sensitivity":"<Calm|Settled|Tender|Reactive|Inflamed>"}
Pick the single most accurate level per metric. Use the exact capitalized word.`;
            const [bulletsRes, metricsRes] = await Promise.allSettled([
              callClaude(prompt, '', entryPhoto, { model: 'claude-haiku-4-5-20251001', maxTokens: 400, voice: true, timeoutMs: 35000 }),
              callClaude(snapPrompt, '', entryPhoto, { model: 'claude-haiku-4-5-20251001', maxTokens: 200, timeoutMs: 35000 }),
            ]);
            const aiAnalysis = bulletsRes.status === 'fulfilled' ? bulletsRes.value : '';
            const cleanProse = stripAnalysisStructuredLines(aiAnalysis);
            const inlineRegion = parseSkinRegion(aiAnalysis);
            let finalSnapshot = null;
            if (metricsRes.status === 'fulfilled') {
              try {
                const cleaned = metricsRes.value.replace(/```(?:json)?/g, '').trim();
                const start = cleaned.indexOf('{');
                const end = cleaned.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                  finalSnapshot = JSON.parse(cleaned.slice(start, end + 1));
                }
              } catch (snapErr) {
                console.warn('[metrics-parse]', snapErr.message);
              }
            }
            if (!finalSnapshot && aiAnalysis) {
              finalSnapshot = parseSkinMetrics(aiAnalysis);
            }
            setLogs(prev => {
              const next = prev.map(l => l.id === entryId ? {
                ...l,
                aiAnalysis: cleanProse,
                metricSnapshot: finalSnapshot,
                region: inlineRegion || l.region || null,
                analyzing: false,
                analyzingStartedAt: undefined} : l);
              saveData('logs', next);
              return next;
            });
          } catch (e) {
            console.error('[BgAnalysis] entry', entryId, 'failed:', e?.message);
            setLogs(prev => {
              const next = prev.map(l => l.id === entryId ? { ...l, analyzing: false, analyzingStartedAt: undefined } : l);
              saveData('logs', next);
              return next;
            });
          }
        })(entry.id, entry.area, entry.photo);
      }
    }
  };

  const todayKey = localDateISO();
  const isBackdate = form.date !== todayKey;
  const dayPills = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateISO(d);
    dayPills.push({
      key,
      label: i === 0 ? 'Today' : i === 1 ? 'Yest.' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate()
    });
  }
  const isBeyond7 = isBackdate && !dayPills.some(p => p.key === form.date);
  return (
    <Modal compact onClose={() => {
      setShowLogModal(false);
      setEditingLogId(null);
      setSkinLogForm(null);
      skinLogFormRef.current = null;
      setSkinLogSuggesting(false);
      setSkinLogShowCamera(false);
      modalScrollMemo.current.skinLog = 0;
    }} eyebrow={isEditingLog ? 'Atelier · entry' : 'New skin log'} title={isEditingLog ? 'Edit entry' : 'Log skin'}>
      <span ref={scrollSentinelRef} aria-hidden="true" style={{display:'none'}} />
      <div className="space-y-2">
        {Array.isArray(form.photos) && form.photos.length > 1 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>
                {form.photos.length} photos · categorize each
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, photo: null, photos: null, ratingExplanation: null, suggestedRating: null })}
                className="text-[9px] tracking-[0.2em] uppercase"
                style={{color:'var(--ink-soft)'}}
              >Start over</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {form.photos.map((p, idx) => (
                <div key={idx} className="border rounded-md overflow-hidden" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                  <div className="relative aspect-square">
                    <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.photos.filter((_, i) => i !== idx);
                        setForm({
                          ...form,
                          photos: next.length > 1 ? next : null,
                          photo: next.length > 0 ? next[0].dataUrl : null});
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full"
                      style={{background:'rgba(28,25,23,0.85)', color:'var(--cream)'}}
                      aria-label="Remove photo"
                    ><Icon name="X" size={10} /></button>
                  </div>
                  <select
                    value={p.area}
                    onChange={e => {
                      const next = [...form.photos];
                      next[idx] = { ...next[idx], area: e.target.value };
                      setForm({ ...form, photos: next });
                    }}
                    className="w-full px-1.5 py-1 text-[10px] border-0 border-t focus:outline-none"
                    style={{background:'var(--cream)', color:'var(--ink)', borderColor: 'var(--line)'}}
                  >
                    <option value="full-face">Full Face</option>
                    <option value="hairline">Hairline</option>
                    <option value="forehead">Forehead</option>
                    <option value="cheeks">Cheeks</option>
                    <option value="chin">Chin</option>
                    <option value="nose-tzone">T-Zone</option>
                    <option value="neck">Neck</option>
                    <option value="body">Body</option>
                    <option value="back">Back</option>
                  </select>
                </div>
              ))}
            </div>
            <p className="text-[9px] tracking-[0.05em]" style={{color:'var(--ink-soft)'}}>
              Saving creates one entry per photo · rating, concerns, notes apply to all
            </p>
          </div>
        ) : form.photo ? (
          <div className="space-y-2">
            <div className="relative">
              <img src={form.photo} alt="" className="w-full h-32 object-cover rounded-md" />
              <button onClick={() => setForm({ ...form, photo: null, photos: null, ratingExplanation: null, suggestedRating: null })} className="absolute top-1.5 right-1.5 p-1 rounded-full" style={{background:'var(--ink)', color:'var(--cream)'}}>
                <Icon name="X" size={12} />
              </button>
            </div>
            {suggestingRating && !form.ratingExplanation && (
              <div className="p-2 rounded-md border flex items-center gap-2 pulse-soft" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                <Icon name="Loader2" size={11} className="spin" />
                <div className="text-[10px]" style={{color:'var(--ink-soft)'}}>Analyzing photo…</div>
              </div>
            )}
            {!suggestingRating && !form.ratingExplanation && form.photo && (
              <button type="button" onClick={() => suggestRating()} className="w-full border py-1.5 tracking-widest text-[10px] uppercase transition flex items-center justify-center gap-1.5" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
                <Icon name="Sparkles" size={11} /> Analyze photo
              </button>
            )}
            {form.ratingExplanation && (
              <div className="p-2 rounded-md border" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                  <span className="text-[9px] tracking-[0.2em] uppercase flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                    <Icon name="Sparkles" size={10} /> AI · {form.suggestedRating || form.rating}/10
                  </span>
                  {form.suggestedRating && form.rating !== form.suggestedRating && (
                    <button type="button" onClick={acceptSuggestion} className="text-[9px] tracking-[0.15em] uppercase underline" style={{color:'var(--ink)'}}>
                      Use {form.suggestedRating}/10
                    </button>
                  )}
                </div>
                <div className="text-[10px] leading-snug font-light whitespace-pre-wrap line-clamp-3" style={{color:'var(--ink)'}}>{form.ratingExplanation}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="flex-1 rounded-md py-4 flex flex-col items-center gap-1.5 transition hover:opacity-90"
              style={{background:'var(--accent)', color:'var(--cream)'}}
            >
              <Icon name="Camera" size={18} />
              <span className="text-[10px] tracking-[0.22em] uppercase">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => { setShowLogModal(false); setShowPhotoImportQueue(true); }}
              className="flex-1 border border-dashed rounded-md py-4 flex flex-col items-center gap-1 transition hover:bg-[var(--cream-deep)]"
              style={{borderColor: 'var(--line)', color:'var(--accent)'}}
              title="Upload one or many photos"
            >
              <Icon name="Upload" size={18} />
              <span className="text-[10px] tracking-[0.22em] uppercase">Upload</span>
              <span className="text-[8.5px] tracking-normal lowercase" style={{color:'var(--ink-soft)'}}>one or many</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>
        )}
        {showCamera && (
          <CameraCaptureModal
            multi={!isEditingLog}
            onClose={() => setShowCamera(false)}
            onCapture={(dataUrl, finalShots) => {
              if (Array.isArray(finalShots) && finalShots.length > 1) {
                setForm(f => ({
                  ...f,
                  photo: finalShots[0].dataUrl,
                  photos: finalShots.map(s => ({ dataUrl: s.dataUrl, area: 'full-face' })),
                  ratingExplanation: null,
                  suggestedRating: null}));
              } else {
                const url = dataUrl || (finalShots && finalShots[0]?.dataUrl);
                if (!url) return;
                setForm(f => ({ ...f, photo: url, photos: null, ratingExplanation: null, suggestedRating: null }));
                if (canRunAnalysis()) {
                  setTimeout(() => suggestRating(url), 0);
                }
              }
            }}
          />
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '10px',
            alignItems: 'end'}}
        >
          <div style={{minWidth: 0}}>
            <div
              className="text-[10px] tracking-[0.22em] uppercase"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '4px',
                marginBottom: '6px',
                color: 'var(--ink-soft)'}}
            >
              <span>Day</span>
              <span className="font-sans text-[10px] normal-case tracking-normal truncate" style={{color: form.date === todayKey ? 'var(--ink-soft)' : 'var(--accent)'}}>
                {form.date === todayKey ? 'today' : 'backdated'}
              </span>
            </div>
            <input
              type="date"
              value={form.date}
              max={todayKey}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="focus:outline-none"
              style={{
                width: '100%',
                height: '44px',
                boxSizing: 'border-box',
                border: `1px solid ${form.date !== todayKey ? 'var(--accent)' : 'var(--line)'}`,
                borderRadius: '10px',
                background: form.date !== todayKey ? 'var(--accent-soft)' : 'var(--cream)',
                color: 'var(--ink)',
                padding: '0 12px',
                fontSize: '13px',
                lineHeight: 1,
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none'}}
            />
          </div>
          <div style={{minWidth: 0}}>
            <div className="text-[10px] tracking-[0.22em] uppercase" style={{marginBottom: '6px', color: 'var(--ink-soft)'}}>Area</div>
            {Array.isArray(form.photos) && form.photos.length > 1 ? (
              <div
                style={{
                  width: '100%',
                  height: '44px',
                  boxSizing: 'border-box',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  background: 'var(--cream)',
                  color: 'var(--ink-soft)',
                  padding: '0 12px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center'}}
              >Per-photo above</div>
            ) : (
              <select
                value={form.area}
                onChange={e => setForm({ ...form, area: e.target.value })}
                className="focus:outline-none"
                style={{
                  width: '100%',
                  height: '44px',
                  boxSizing: 'border-box',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  background: 'var(--cream)',
                  color: 'var(--ink)',
                  padding: '0 12px',
                  fontSize: '13px',
                  lineHeight: 1}}
              >
                <option value="full-face">Full Face</option>
                <option value="hairline">Hairline</option>
                <option value="forehead">Forehead</option>
                <option value="cheeks">Cheeks</option>
                <option value="chin">Chin</option>
                <option value="nose-tzone">Nose / T-Zone</option>
                <option value="neck">Neck</option>
                <option value="body">Body</option>
                <option value="back">Back</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <div className="text-[8px] tracking-[0.2em] uppercase mb-0.5 flex justify-between" style={{color:'var(--ink-soft)'}}>
            <span>Rating · {form.rating}/10</span>
            <span className="text-[8px] normal-case tracking-normal" style={{color:'var(--ink-soft)'}}>rough → glowing</span>
          </div>
          <input type="range" min="1" max="10" value={form.rating} onChange={e => setForm({ ...form, rating: +e.target.value })} className="w-full" />
        </div>

        <div>
          <div className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>Concerns</div>
          <div className="flex flex-wrap gap-1">
            {concernOptions.map(c => (
              <button key={c} type="button" onClick={() => {
                const set = form.concerns.includes(c) ? form.concerns.filter(x => x !== c) : [...form.concerns, c];
                setForm({ ...form, concerns: set });
              }} className="px-1.5 py-0.5 text-[9px] tracking-[0.05em] rounded-full border transition" style={{
                background: form.concerns.includes(c) ? 'var(--accent)' : 'transparent',
                color: form.concerns.includes(c) ? 'var(--cream)' : 'var(--ink-soft)',
                borderColor: form.concerns.includes(c) ? 'var(--accent)' : 'var(--line)'
              }}>{c.toLowerCase()}</button>
            ))}
          </div>
        </div>

        <input autoCapitalize="off" autoCorrect="off" spellCheck={false}
          key={`notes-${editingLogId || 'new'}`}
          defaultValue={form.notes}
          onChange={e => { skinLogFormRef.current = { ...(skinLogFormRef.current || form), notes: e.target.value }; }}
          placeholder="Notes (optional)"
          className="w-full px-2.5 py-1.5 border rounded-md focus:outline-none"
          style={{borderColor: 'var(--line)', background:'var(--cream)', color:'var(--ink)', fontSize:'13px'}}
        />

        <div className="text-[9px] tracking-[0.2em] uppercase text-center py-1" style={{color: form.photo ? 'var(--accent)' : 'var(--ink-soft)'}}>
          {form.photo ? `✓ Photo ready · ${Math.round((form.photo.length * 0.75) / 1024)} KB` : 'No photo attached'}
        </div>
        <button onClick={handleSubmit} className="w-full py-1.5 tracking-[0.2em] text-[10px] uppercase transition" style={{background:'var(--ink)', color:'var(--cream)'}}>
          {isEditingLog ? 'Save changes' : 'Save Entry'}
        </button>

        {!isEditingLog && (
          <div className="pt-2 mt-1 border-t space-y-2" style={{borderColor: 'var(--line)'}}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Also today</span>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, inlineProc: f.inlineProc ? null : { name: '', type: '' } }))}
                className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 border rounded-full transition flex items-center gap-1"
                style={{
                  borderColor: form.inlineProc ? 'var(--accent)' : 'var(--line)',
                  background: form.inlineProc ? 'var(--accent)' : 'transparent',
                  color: form.inlineProc ? 'var(--cream)' : 'var(--ink-soft)'}}
              >
                {form.inlineProc ? <Icon name="X" size={9} /> : '+'} procedure
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, inlineProductStart: f.inlineProductStart ? null : { name: '' } }))}
                className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 border rounded-full transition flex items-center gap-1"
                style={{
                  borderColor: form.inlineProductStart ? 'var(--accent)' : 'var(--line)',
                  background: form.inlineProductStart ? 'var(--accent)' : 'transparent',
                  color: form.inlineProductStart ? 'var(--cream)' : 'var(--ink-soft)'}}
              >
                {form.inlineProductStart ? <Icon name="X" size={9} /> : '+'} new product
              </button>
            </div>
            {form.inlineProc && (
              <div className="grid grid-cols-2 gap-1.5">
                <input autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  defaultValue={form.inlineProc.name}
                  onChange={e => { skinLogFormRef.current = { ...(skinLogFormRef.current || form), inlineProc: { ...(skinLogFormRef.current?.inlineProc || form.inlineProc), name: e.target.value } }; }}
                  placeholder="Procedure name"
                  className="px-2 py-1.5 border rounded-md focus:outline-none"
                  style={{borderColor: 'var(--line)', background:'var(--cream)', color:'var(--ink)', fontSize:'13px'}}
                />
                <select
                  value={form.inlineProc.type}
                  onChange={e => setForm(f => ({ ...f, inlineProc: { ...f.inlineProc, type: e.target.value } }))}
                  className="px-2 py-1.5 border rounded-md focus:outline-none"
                  style={{borderColor: 'var(--line)', background:'var(--cream)', color:'var(--ink)', fontSize:'13px'}}
                >
                  <option value="">Type…</option>
                  <option value="laser">Laser</option>
                  <option value="microneedling">Microneedling</option>
                  <option value="rf-microneedling">RF microneedling</option>
                  <option value="chemical-peel">Chemical peel</option>
                  <option value="hydrafacial">HydraFacial</option>
                  <option value="injectables">Injectables</option>
                  <option value="ipl">IPL</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
            {form.inlineProductStart && (
              <input autoCapitalize="off" autoCorrect="off" spellCheck={false}
                defaultValue={form.inlineProductStart.name}
                onChange={e => { skinLogFormRef.current = { ...(skinLogFormRef.current || form), inlineProductStart: { ...(skinLogFormRef.current?.inlineProductStart || form.inlineProductStart), name: e.target.value } }; }}
                placeholder="Product name (e.g. Skinceuticals CE Ferulic)"
                className="w-full px-2 py-1.5 border rounded-md focus:outline-none"
                style={{borderColor: 'var(--line)', background:'var(--cream)', color:'var(--ink)', fontSize:'13px'}}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
