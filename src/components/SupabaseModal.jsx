// === SupabaseModal (Wave 4 extract — May 2026) ===
// Pulled out of App so the modal can be reasoned about independently.
// Behavior preserved exactly. All App-scope state + setters passed as props.

const SupabaseModal = ({
  // Wave 4.3 (May 2026): App-scope dependencies as props. Cloud sync logic
  // (setSupabaseConfig, retrySupabaseInit, supabaseClient mutation, etc.)
  // remains module-scope and is referenced directly via the global bundle.
  user, setUser,
  supaEnabled,
  setShowSupabaseModal,
  setLogs, setProducts, setProcedures, setEvents, setColorProfile,
  setPatternInsight, setCycleData, setHormonalContext, setSensitivities,
  setRegimenLogs, setUserConcerns, setCoverRoutine, setCounselInsights,
  setDailyCoverPick, setWeeklyInsights,
  toast,
}) => {
  const cfg = getSupabaseConfig();
  const [tempUrl, setTempUrl] = useState(cfg.url);
  const [tempAnonKey, setTempAnonKey] = useState(cfg.anonKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const test = async () => {
    if (!tempUrl || !tempAnonKey) { setTestResult({ ok: false, msg: 'Both fields are required' }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const testClient = window.supabase.createClient(tempUrl, tempAnonKey);
      // Just test that we can reach the API with this key
      const { error } = await testClient.from('user_data').select('user_id').limit(1);
      if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
        setTestResult({ ok: false, msg: 'Connected, but the user_data table is missing. Did you run the SQL setup?' });
      } else if (error && error.code === '42501') {
        // RLS blocks unauthenticated reads — this means it's actually working correctly
        setTestResult({ ok: true, msg: 'Connection works! Save and sign in.' });
      } else if (error) {
        setTestResult({ ok: false, msg: error.message });
      } else {
        setTestResult({ ok: true, msg: 'Connection works! Save and sign in.' });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message });
    }
    setTesting(false);
  };

  const save = async () => {
    setSupabaseConfig(tempUrl, tempAnonKey);
    // Force re-init with new credentials
    supabaseClient = null;
    retrySupabaseInit();
    // Wait briefly for init to settle, then check status
    setTimeout(() => {
      if (supabaseClient) {
        toast('Cloud sync enabled — sign in with your account');
      }
    }, 500);
    // Sign out current local session to force re-auth via Supabase
    if (user && !user.cloud) {
      await storage.delete('session');
      setUser(null);
    }
    setShowSupabaseModal(false);
  };

  const disable = async () => {
    if (!confirm('Disable cloud sync? Your account will revert to device-only.')) return;
    localStorage.removeItem('lumiere:supabaseUrl');
    localStorage.removeItem('lumiere:supabaseKey');
    supabaseClient = null;
    supabaseInitState = 'disabled';
    _notifySupabaseListeners();
    toast('Cloud sync disabled');
    setShowSupabaseModal(false);
  };

  const wipeLocal = async () => {
    const ok = confirm('Wipe all locally cached data from this browser?\n\nThis removes journal entries, products, photos, and other data from this device only. Cloud-synced data (if any) is unaffected and will reload on next sign-in.\n\nThis cannot be undone for browser-only accounts.');
    if (!ok) return;
    wipeLocalUserData();
    // Reset live state too
    setLogs([]); setProducts([]); setProcedures([]); setEvents([]); setColorProfile(null); setPatternInsight(null); setCycleData({ periods: [], cycleLength: 28 }); setHormonalContext(null); setSensitivities([]); setRegimenLogs([]); setUserConcerns([]); setCoverRoutine(''); setCounselInsights({}); setDailyCoverPick({}); setWeeklyInsights({});
    toast('Local data wiped from this browser');
    setShowSupabaseModal(false);
  };

  return (
    <Modal onClose={() => setShowSupabaseModal(false)} eyebrow="Settings" title="Cloud sync">
      <div className="space-y-5">
        <p className="text-sm font-light leading-relaxed" style={{color:'var(--ink-soft)'}}>
          Enable cloud sync so your account works across all your devices. Your journal, photos, and products will sync automatically.
        </p>
        <div className="text-xs font-light p-3 rounded-md" style={{background:'var(--cream-deep)', border:'1px solid var(--line)', color:'var(--ink-soft)'}}>
          <strong>How to get these:</strong> In your Supabase project, go to <strong>Project Settings → API</strong>. Copy your <strong>Project URL</strong> and the <strong>anon / public</strong> key.
        </div>
        <Field label="Project URL">
          <input autoCapitalize="off" autoCorrect="off" spellCheck={false} value={tempUrl} onChange={e => setTempUrl(e.target.value)} placeholder="https://xxxxx.supabase.co" className={inputCls} />
        </Field>
        <Field label="Anon Key">
          <textarea autoCapitalize="off" autoCorrect="off" spellCheck={false} value={tempAnonKey} onChange={e => setTempAnonKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1..." rows="3" className={inputCls} style={{fontFamily:'monospace', fontSize:'11px'}} />
        </Field>

        <button onClick={test} disabled={testing || !tempUrl || !tempAnonKey} className="w-full border py-3 tracking-widest text-xs uppercase transition disabled:opacity-50 flex items-center justify-center gap-2" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
          {testing ? <><Icon name="Loader2" size={14} className="spin" /> Testing</> : <><Icon name="Zap" size={14} /> Test Connection</>}
        </button>

        {testResult && (
          <div className="text-xs font-light p-3 rounded-md flex items-start gap-2" style={{
            background: testResult.ok ? '#e8f0e4' : '#fef0ef',
            border: `1px solid ${testResult.ok ? '#9bbf8f' : '#d4a094'}`,
            color: testResult.ok ? '#2d5a1e' : '#a04555'
          }}>
            <Icon name={testResult.ok ? 'Check' : 'AlertCircle'} size={14} />
            <div>{testResult.msg}</div>
          </div>
        )}

        <button onClick={save} disabled={!tempUrl || !tempAnonKey} className={primaryBtn} style={{background:'var(--ink)', color:'var(--cream)', opacity: (!tempUrl || !tempAnonKey) ? 0.5 : 1}}>
          {supaEnabled ? 'Update Cloud Settings' : 'Enable Cloud Sync'}
        </button>

        {supaEnabled && (
          <button onClick={disable} className="w-full text-xs tracking-widest uppercase italic py-2" style={{color:'#a04555'}}>
            Disable Cloud Sync
          </button>
        )}

        <div className="pt-4 mt-2 border-t" style={{borderColor:'var(--line)'}}>
          <div className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{color:'var(--ink-soft)'}}>Privacy</div>
          <p className="text-xs font-light leading-relaxed mb-3" style={{color:'var(--ink-soft)'}}>
            Photos and entries are cached in this browser for speed. If you share this device, or just want a clean slate, you can wipe the local cache. Cloud-synced data is unaffected.
          </p>
          <button type="button" onClick={wipeLocal} className="w-full border py-2.5 text-xs tracking-[0.2em] uppercase transition flex items-center justify-center gap-2" style={{borderColor:'#a04555', color:'#a04555'}}>
            <Icon name="Trash2" size={12} /> Wipe Local Data
          </button>
        </div>
      </div>
    </Modal>
  );
};
