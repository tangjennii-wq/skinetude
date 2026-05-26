// === ColorModal (Wave 4.1 extract — May 2026) ===
// Pulled out of App so the 244-line modal can be reasoned about
// independently and so App's render method is shorter. Behavior
// preserved exactly. All App-scope state + setters passed as props.

const ColorModal = ({
  // Wave 4.1 (May 2026): App-scope dependencies passed as props.
  // Module-scope helpers (getApiKey, fileToBase64) are loaded earlier
  // in the bundle and remain global; passed in as props too so the
  // component's dependency surface is explicit.
  colorProfile, setColorProfile,
  setShowColorModal,
  setShowApiKeyModal,
  callClaude,
  getApiKey,
  fileToBase64,
  saveData,
  toast,
  useModalScrollPreserve,
  // Codex audit (May 2026): these were referenced but undeclared.
  // user — needed for cloud photo upload path (skipped if signed-out)
  // uploadPhotoToStorage — Supabase Storage helper for the swap-to-photoPath path
  // modalScrollMemo — scroll preservation memo at App scope
  // openChat — opens counsel chat with a prefilled prompt
  user,
  uploadPhotoToStorage,
  modalScrollMemo,
  openChat,
}) => {
  const [form, setForm] = useState(colorProfile || { season: '', skinTone: '', undertone: '', eyeColor: '', hairColor: '', photo: null, aiAnalysis: null });
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef();
  // Scroll preservation across App-induced remounts.
    const scrollSentinelRef = (typeof useModalScrollPreserve === 'function') ? useModalScrollPreserve('color') : React.useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setForm(f => ({...f, photo: b64, aiAnalysis: null})); // reset AI analysis on new photo
    if (getApiKey()) {
      analyzePhoto(b64);
    }
  };

  const analyzePhoto = async (photoOverride) => {
    const photo = photoOverride || form.photo;
    if (!photo) return;
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    setAnalyzing(true);
    try {
      const userInputs = `User self-reported:
- Season: ${form.season || 'not specified'}
- Skin tone depth: ${form.skinTone || 'not specified'}
- Undertone: ${form.undertone || 'not specified'}
- Eye color: ${form.eyeColor || 'not specified'}
- Hair color: ${form.hairColor || 'not specified'}`;

      const prompt = `You are a professional color analyst trained in the 12-season system. Analyze this photo of a person to determine their color season independently. Then compare your analysis to what they self-reported.

${userInputs}

Look at the photo and assess these features visually:
1. Skin undertone (cool/warm/neutral/olive) — look at the wrist and jawline area, vein color cues, how the skin reads in the photo light
2. Skin tone depth (fair/light/medium/tan/deep/rich)
3. Hair color (be specific about pigment — ash, golden, copper, etc.)
4. Eye color and any notable features (limbal ring, flecks, etc.)
5. Overall contrast level (low/medium/high — between hair, skin, eyes)
6. Color season prediction with reasoning

IMPORTANT: Acknowledge limitations. Say if the photo lighting makes assessment hard, or if you'd want to see them in natural daylight to be sure.

Format response in this EXACT structure:

WHAT_I_SEE:
- Undertone: [cool/warm/neutral/olive — and brief reason from the photo]
- Skin depth: [fair/light/medium/tan/deep/rich]
- Hair: [specific description]
- Eyes: [specific description]
- Contrast: [low/medium/high — between features]

PREDICTED_SEASON: [one of: bright-spring, true-spring, light-spring, light-summer, true-summer, soft-summer, soft-autumn, true-autumn, dark-autumn, dark-winter, true-winter, bright-winter]

REASONING:
[2-3 sentences explaining why you predicted that season — what the dominant qualities are: warm vs cool, light vs deep, soft vs bright]

AGREEMENT_WITH_USER:
[Compare your analysis to the user's self-reported values. If they match, say "Your self-assessment aligns with what I see." If they differ, name the specific discrepancies and which interpretation seems more accurate based on the photo. Be diplomatic but honest.]

CONFIDENCE: [high/medium/low — and brief reason like "lighting is even and natural" or "indoor lighting makes undertone tricky to read confidently"]`;

      const result = await callClaude(prompt, '', photo, { voice: true });

      // Parse structured response
      const seasonMatch = result.match(/PREDICTED_SEASON:\s*([a-z-]+)/i);
      const confidenceMatch = result.match(/CONFIDENCE:\s*(\w+)/i);
      const predictedSeason = seasonMatch ? seasonMatch[1].toLowerCase().trim() : null;
      const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : null;

      setForm(f => ({...f, aiAnalysis: { fullText: result, predictedSeason, confidence, generatedAt: Date.now() }}));
    } catch (e) {
      console.error('Color analysis failed:', e);
      toast('Could not analyze photo — try again', 'error');
    }
    setAnalyzing(false);
  };

  const acceptAISeason = () => {
    if (form.aiAnalysis?.predictedSeason) {
      setForm(f => ({...f, season: f.aiAnalysis.predictedSeason}));
    }
  };

  const handleSubmit = async () => {
    setColorProfile(form);
    await saveData('color', form);
    setShowColorModal(false);
    toast('Color profile saved');

    // Background photo upload to Storage (cloud users only)
    if (form.photo && user?.cloud && user?.id && supabaseClient) {
      (async () => {
        const { path, error } = await uploadPhotoToStorage(user.id, form.photo);
        if (path) {
          setColorProfile(prev => {
            if (!prev) return prev;
            const { photo, ...rest } = prev;
            const next = { ...rest, photoPath: path };
            saveData('color', next);
            return next;
          });
        } else if (error) {
          console.error('Color photo upload failed:', error);
        }
      })();
    }
  };

  return (
    <Modal onClose={() => { setShowColorModal(false); modalScrollMemo.current.color = 0; }} eyebrow="Atelier de Couleur" title="Color analysis profile">
      <span ref={scrollSentinelRef} aria-hidden="true" style={{display:'none'}} />
      <div className="space-y-5">
        <div className="text-xs italic font-light p-3 rounded-md flex items-start gap-2" style={{background:'var(--cream-deep)', color:'var(--ink-soft)', border:'1px solid var(--line)'}}>
          <Icon name="Sparkles" size={12} />
          <span>Upload a natural-light photo and let the AI verify your color analysis before getting recommendations.</span>
        </div>

        <Field label="Color Season">
          <select value={form.season} onChange={e => setForm({...form, season: e.target.value})} className={inputCls}>
            <option value="">Not sure / Not analyzed</option>
            <optgroup label="Spring"><option value="bright-spring">Bright Spring</option><option value="true-spring">True Spring</option><option value="light-spring">Light Spring</option></optgroup>
            <optgroup label="Summer"><option value="light-summer">Light Summer</option><option value="true-summer">True Summer</option><option value="soft-summer">Soft Summer</option></optgroup>
            <optgroup label="Autumn"><option value="soft-autumn">Soft Autumn</option><option value="true-autumn">True Autumn</option><option value="dark-autumn">Dark Autumn</option></optgroup>
            <optgroup label="Winter"><option value="dark-winter">Dark Winter</option><option value="true-winter">True Winter</option><option value="bright-winter">Bright Winter</option></optgroup>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Skin Tone">
            <select value={form.skinTone} onChange={e => setForm({...form, skinTone: e.target.value})} className={inputCls}>
              <option value="">Select</option><option value="fair">Fair</option><option value="light">Light</option><option value="medium">Medium</option><option value="tan">Tan</option><option value="deep">Deep</option><option value="rich">Rich</option>
            </select>
          </Field>
          <Field label="Undertone">
            <select value={form.undertone} onChange={e => setForm({...form, undertone: e.target.value})} className={inputCls}>
              <option value="">Select</option><option value="cool">Cool</option><option value="warm">Warm</option><option value="neutral">Neutral</option><option value="olive">Olive</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Eye Color"><StableInput resetKey="color-new" value={form.eyeColor} onChange={(v) => setForm({...form, eyeColor: v})} placeholder="e.g. Brown, Hazel" className={inputCls} /></Field>
          <Field label="Hair Color"><StableInput resetKey="color-new" value={form.hairColor} onChange={(v) => setForm({...form, hairColor: v})} placeholder="e.g. Dark Brown" className={inputCls} /></Field>
        </div>
        <Field label="Reference Photo (natural light)">
          {form.photo ? (
            <div className="space-y-3">
              <div className="relative">
                <img src={form.photo} alt="" className="w-full h-48 object-cover rounded-md" />
                <button onClick={() => setForm({...form, photo: null, aiAnalysis: null})} className="absolute top-2 right-2 p-1.5 rounded-full" style={{background:'var(--ink)', color:'var(--cream)'}}><Icon name="X" size={14} /></button>
              </div>

              {/* Auto-analyzing state */}
              {analyzing && !form.aiAnalysis && (
                <div className="p-4 rounded-md border flex items-center gap-3 pulse-soft" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
                  <Icon name="Loader2" size={14} className="spin" />
                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>Analyzing your photo</div>
                    <div className="text-xs font-light italic mt-0.5" style={{color:'var(--ink)'}}>Reading undertone, hair, eyes, and contrast…</div>
                  </div>
                </div>
              )}

              {/* No API key — fallback */}
              {!analyzing && !form.aiAnalysis && !getApiKey() && (
                <button type="button" onClick={() => analyzePhoto()} className="w-full border py-3 tracking-widest text-xs uppercase transition flex items-center justify-center gap-2" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
                  <Icon name="Sparkles" size={14} /> Add API key to auto-analyze
                </button>
              )}

              {form.aiAnalysis && (
                <div className="p-4 rounded-md border space-y-3" style={{background:'var(--cream-deep)', borderColor:'var(--line)'}}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Icon name="Sparkles" size={12} />
                      <span className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{color:'var(--ink-soft)'}}>AI Color Analysis</span>
                    </div>
                    {form.aiAnalysis.confidence && (
                      <span className="text-[9px] tracking-[0.15em] uppercase" style={{
                        color: form.aiAnalysis.confidence === 'high' ? 'var(--sage)' : form.aiAnalysis.confidence === 'medium' ? 'var(--ink-soft)' : '#a04555'
                      }}>{form.aiAnalysis.confidence} confidence</span>
                    )}
                  </div>

                  {form.aiAnalysis.predictedSeason && (
                    <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded" style={{background:'var(--cream)'}}>
                      <div>
                        <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>AI predicts</div>
                        <div className="font-serif italic text-xl capitalize" style={{color:'var(--ink)'}}>{form.aiAnalysis.predictedSeason.replace(/-/g, ' ')}</div>
                        {form.season && form.season !== form.aiAnalysis.predictedSeason && (
                          <div className="text-[10px] mt-1 italic" style={{color:'#a04555'}}>≠ your selection: {form.season.replace(/-/g, ' ')}</div>
                        )}
                        {form.season === form.aiAnalysis.predictedSeason && (
                          <div className="text-[10px] mt-1 italic" style={{color:'var(--sage)'}}>✓ matches your selection</div>
                        )}
                      </div>
                      {form.season !== form.aiAnalysis.predictedSeason && (
                        <button type="button" onClick={acceptAISeason} className="text-[10px] tracking-[0.15em] uppercase italic underline" style={{color:'var(--ink)'}}>
                          Use AI's prediction
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-xs leading-relaxed font-light whitespace-pre-wrap" style={{color:'var(--ink)'}}>{form.aiAnalysis.fullText}</div>

                  <div className="flex items-center gap-3 pt-3 border-t flex-wrap" style={{borderColor:'var(--line)'}}>
                    <button type="button" onClick={() => openChat({
                      context: `Color analysis from photo:\n\n${form.aiAnalysis.fullText}`,
                      title: form.aiAnalysis.predictedSeason ? form.aiAnalysis.predictedSeason.replace(/-/g, ' ') : 'Color analysis',
                      subtitle: 'Color profile',
                      image: form.photo,
                      suggestions: [
                        'Recommend specific lipsticks for me',
                        'Best foundation shades to look at',
                        'What blush and bronzer should I try?',
                        'Which colors should I avoid wearing?',
                        'What metals (gold/silver/rose) suit me?',
                        'Build a daily natural makeup look'
                      ]
                    })} className="text-[10px] tracking-[0.15em] uppercase italic flex items-center gap-1" style={{color:'var(--ink)'}}>
                      <Icon name="MessageCircle" size={11} /> Ask follow-up
                    </button>
                    <span style={{color:'var(--ink-soft)'}}>·</span>
                    <button type="button" onClick={() => analyzePhoto()} disabled={analyzing} className="text-[10px] tracking-[0.15em] uppercase italic" style={{color:'var(--ink-soft)'}}>
                      {analyzing ? 'Re-analyzing…' : '↻ Re-analyze'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full border border-dashed rounded-md py-5 flex flex-col items-center gap-2 transition" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>
              <Icon name="Image" size={20} />
              <span className="text-xs tracking-widest uppercase">Upload</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        </Field>
        <button onClick={handleSubmit} className={primaryBtn} style={{background:'var(--ink)', color:'var(--cream)'}}>Save Profile</button>
      </div>
    </Modal>
  );
};
