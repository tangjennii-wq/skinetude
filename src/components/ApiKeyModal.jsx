// === ApiKeyModal (Wave 4 extract — May 2026) ===
// Pulled out of App so the modal can be reasoned about independently.
// Behavior preserved exactly. All App-scope state + setters passed as props.

const ApiKeyModal = ({
  // Wave 4.2 (May 2026): App-scope dependencies as props.
  setApiKeyState,
  setShowApiKeyModal,
  setShowApiKeyModalRaw,
  clearApiKeyDismissal,
  toast,
}) => {
  const [tempKey, setTempKey] = useState(getApiKey());
  const save = () => {
    setApiKey(tempKey);
    setApiKeyState(tempKey);
    // Saving a fresh key resets the dismissal flag so future flows behave
    // normally (and the modal can re-open if the key is later cleared).
    clearApiKeyDismissal();
    setShowApiKeyModalRaw(false);
    toast('API key saved ✨', 'info');
  };
  return (
    <Modal onClose={() => setShowApiKeyModal(false)} eyebrow="Settings" title="Anthropic API key">
      <div className="space-y-5">
        <p className="text-sm font-light" style={{color:'var(--ink-soft)'}}>
          To enable AI counsel, makeup recommendations, product assessments, and event prep plans, paste your Anthropic API key. Your key is stored only in this browser — never sent anywhere except directly to Anthropic.
        </p>
        <p className="text-xs font-light" style={{color:'var(--ink-soft)'}}>
          Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noopener" className="underline italic" style={{color:'var(--ink)'}}>console.anthropic.com</a>.
        </p>
        <Field label="API Key">
          <input autoCapitalize="off" autoCorrect="off" spellCheck={false} type="password" value={tempKey} onChange={e => setTempKey(e.target.value)} placeholder="sk-ant-..." className={inputCls} />
        </Field>
        <button onClick={save} className={primaryBtn}>Save Key</button>
      </div>
    </Modal>
  );
};
