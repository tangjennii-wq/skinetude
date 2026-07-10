// === ApiKeyModal (Wave 4 extract — May 2026; multi-provider July 2026) ===
// One modal, three optional keys. Any single key unlocks the full AI
// feature set — the universal funnel routes to whichever is present
// (Anthropic first, then OpenAI, then Gemini). No key at all still gets
// the core loop (scan + photo analysis) through Frida's built-in
// allowance with per-device daily caps.

const ApiKeyModal = ({
  setApiKeyState,
  setShowApiKeyModal,
  setShowApiKeyModalRaw,
  clearApiKeyDismissal,
  toast}) => {
  const [tempKey, setTempKey] = useState(getApiKey());
  const [tempOpenai, setTempOpenai] = useState(getOpenaiKey());
  const [tempGemini, setTempGemini] = useState(getGeminiKey());
  const save = () => {
    setApiKey(tempKey.trim());
    setApiKeyState(tempKey.trim());
    setOpenaiKey(tempOpenai.trim());
    setGeminiKey(tempGemini.trim());
    // Saving a fresh key resets the dismissal flag so future flows behave
    // normally (and the modal can re-open if the key is later cleared).
    clearApiKeyDismissal();
    setShowApiKeyModalRaw(false);
    const n = [tempKey, tempOpenai, tempGemini].filter(k => k.trim()).length;
    toast(n === 0 ? 'Keys cleared. Core features keep working on the built-in allowance.' : 'Saved.', 'info');
  };
  const field = (label, hint, value, onChange, placeholder) => (
    <Field label={label}>
      <input autoCapitalize="off" autoCorrect="off" spellCheck={false} type="password" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      <div className="text-[10px] mt-1" style={{color:'var(--ink-soft)'}}>{hint}</div>
    </Field>
  );
  return (
    <Modal onClose={() => setShowApiKeyModal(false)} eyebrow="Settings" title="AI keys">
      <div className="space-y-4">
        <p className="text-sm font-light" style={{color:'var(--ink-soft)'}}>
          Any one key unlocks everything — counsel, pattern analysis, compare narratives, event prep. Bring whichever you already have. Keys live only in this browser and go directly to the provider; anyone with access to this device could read them, so use keys with a spend cap you're comfortable with.
        </p>
        <p className="text-xs font-light" style={{color:'var(--ink-soft)'}}>
          No key? Check-ins, photo reads, and product scans still work on Frida's built-in daily allowance.
        </p>
        {field('Anthropic', <>Best voice. <a href="https://console.anthropic.com" target="_blank" rel="noopener" className="underline" style={{color:'var(--ink)'}}>console.anthropic.com</a></>, tempKey, setTempKey, 'sk-ant-...')}
        {field('OpenAI', <>GPT-4o. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline" style={{color:'var(--ink)'}}>platform.openai.com</a></>, tempOpenai, setTempOpenai, 'sk-...')}
        {field('Gemini', <>Also lifts the daily scan caps. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline" style={{color:'var(--ink)'}}>aistudio.google.com</a></>, tempGemini, setTempGemini, 'AIza...')}
        <button onClick={save} className={primaryBtn}>Save</button>
      </div>
    </Modal>
  );
};
