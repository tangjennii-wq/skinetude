// === CompareAnalysis (Wave 3.4 extract — May 2026) ===
// Module-scope, no App-state coupling. Inputs via props.

// === SUBCOMPONENTS ===
const CompareAnalysis = ({ a, b, products, procedures, callClaude, setShowApiKeyModal, onOpenLesson }) => {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!getApiKey()) { setShowApiKeyModal(true); return; }
    setLoading(true);
    try {
      // Determine which is earlier (before) and later (after)
      const earlier = new Date(a.date) < new Date(b.date) ? a : b;
      const later = earlier === a ? b : a;
      const days = Math.abs(Math.ceil((new Date(later.date) - new Date(earlier.date)) / (1000 * 60 * 60 * 24)));

      // Find products started during the gap
      const productsStartedBetween = products.filter(p => {
        const ps = new Date(p.startDate);
        return ps >= new Date(earlier.date) && ps <= new Date(later.date);
      }).map(p => `${p.name} (${p.activeIngredients || 'no actives listed'}) — started ${p.startDate}`);

      const proceduresBetween = procedures.filter(p => {
        const pd = new Date(p.date);
        return pd >= new Date(earlier.date) && pd <= new Date(later.date);
      }).map(p => `${p.name} on ${p.date}`);

      // Resolve photo bytes — legacy base64 in the log, or fetched from Storage via path.
      const resolveB64 = async (item) => {
        if (item.photo && typeof item.photo === 'string' && item.photo.startsWith('data:')) {
          return item.photo.replace(/^data:image\/\w+;base64,/, '');
        }
        if (item.photoPath) {
          const dataUrl = await fetchPhotoAsBase64(item.photoPath);
          if (dataUrl) return dataUrl.replace(/^data:image\/\w+;base64,/, '');
        }
        return null;
      };
      const earlierHasPhoto = !!(earlier.photo || earlier.photoPath);
      const laterHasPhoto = !!(later.photo || later.photoPath);

      const prompt = `Compare these two skin journal entries from the same person, ${days} days apart. Note specific visible differences, possible causes, and what's working or not.

BEFORE (${earlier.date}, ${earlier.area}, rated ${earlier.rating}/10):
- Concerns: ${earlier.concerns?.join(', ') || 'none'}
- Notes: ${earlier.notes || 'none'}

AFTER (${later.date}, ${later.area}, rated ${later.rating}/10):
- Concerns: ${later.concerns?.join(', ') || 'none'}
- Notes: ${later.notes || 'none'}

Products added in this window: ${productsStartedBetween.length ? productsStartedBetween.join('; ') : 'none'}
Procedures during this window: ${proceduresBetween.length ? proceduresBetween.join('; ') : 'none'}

${(earlierHasPhoto && laterHasPhoto) ? 'Two photos are provided. Describe the visible differences in skin texture, redness, blemishes, hydration, and overall complexion.' : ''}

Format response as 3 short sections:
WHAT CHANGED: [specific visible/reported differences]
LIKELY DRIVERS: [what factors likely contributed — products, procedures, or other patterns]
NEXT STEPS: [one or two specific evidence-based suggestions]`;

      // === ROUTE THROUGH callClaude (May 2026 v2) ===
      // Was: raw api.anthropic.com fetch with custom system prompt +
      // labeled before/after image pair. Centralized via callClaude
      // for one source of truth on headers/timeout/proxy migration.
      let result;
      if (earlierHasPhoto && laterHasPhoto) {
        const before64 = await resolveB64(earlier);
        const after64 = await resolveB64(later);
        if (!before64 || !after64) {
          result = await callClaude(prompt, '', null, { voice: true });
        } else {
          result = await callClaude(
            prompt,
            "You are an obsessed educational skin advisor (informational observation, not a diagnosis), comparing two photos of the same person's skin. Be specific and evidence-based.",
            null,
            {
              images: [
                { label: 'BEFORE photo:', b64: before64 },
                { label: 'AFTER photo:',  b64: after64 },
              ]}
          );
        }
      } else {
        result = await callClaude(prompt, '', null, { voice: true });
      }
      setAnalysis(result);
    } catch (e) {
      setAnalysis('Unable to analyze. Try again.');
    }
    setLoading(false);
  };

  return (
    <div className="mt-6 p-8 border" style={{background:'linear-gradient(135deg, var(--cream-deep), var(--cream))', borderColor: 'var(--line)'}}>
      <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>Visual Analysis</div>
          <h3 className="font-sans text-2xl mt-1" style={{color:'var(--ink)'}}>What changed?</h3>
        </div>
        {!analysis && (
          <button onClick={analyze} disabled={loading} className="text-[10px] tracking-[0.2em] uppercase border px-4 py-2 disabled:opacity-50 flex items-center gap-2" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
            {loading ? <><Icon name="Loader2" size={11} className="spin" /> Analyzing</> : <><Icon name="Sparkles" size={11} /> Compare with AI</>}
          </button>
        )}
      </div>
      {!analysis && !loading && <p className="text-sm font-light" style={{color:'var(--ink-soft)'}}>{(a.photo && b.photo) ? 'Both entries have photos — the AI will describe visible differences.' : 'AI will analyze the rating, concerns, and routine changes between these entries.'}</p>}
      {analysis && <div className="text-sm leading-relaxed font-light whitespace-pre-wrap" style={{color:'var(--ink)'}}>{withPearls(analysis, onOpenLesson)}</div>}
    </div>
  );
};
