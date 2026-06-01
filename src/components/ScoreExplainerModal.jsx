// === ScoreExplainerModal (June 2026 per Jenni) ===
// The single source of truth for "what does this 8.4 actually mean?"
// Surfaces from THREE entry points, all with the same content:
//   1. First-time inline card on the cover (auto-shown the first time
//      a composite renders; dismissable; never auto-shown again)
//   2. Cover ritual kebab → "How your score works"
//   3. ProfileModal Settings → "How your score works"
//
// Editorial / Tang-Gainey voice. Three layers:
//   - What the number IS (composite of 5 outcome domains)
//   - HOW it's computed (50% AI photo + 30% noticed chips + 20% rating)
//   - WHY baseline + delta matter (the methodologically honest framing)
//
// Mobile-first: 380px wide, scrollable body, sticky header.

const ScoreExplainerModal = ({
  onClose,
  baseline,           // optional: shows the user's specific baseline state
  goal,               // optional: shows which goal weighting is in effect
}) => {
  const baselineLabel = (() => {
    if (!baseline) return null;
    if (baseline.mode === 'establishing') return `Anchoring (${baseline.n}/10 logs)`;
    if (baseline.mode === 'forming') return `Forming (${baseline.n}/10 logs)`;
    if (baseline.mode === 'anchored') return `Anchored at ${baseline.composite}/100`;
    if (baseline.mode === 'refreshing') return `Anchored at ${baseline.composite}/100 · ${baseline.ageDays}d old`;
    return null;
  })();

  const goalLabel = (() => {
    if (!goal || goal === 'MAINTENANCE') return 'Maintenance (balanced weighting)';
    return goal.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  })();

  return (
    <Modal
      compact
      onClose={onClose}
      eyebrow="How your score works"
      title="The Frida read"
    >
      <div className="space-y-5" style={{ maxWidth: 560 }}>

        {/* === ANCHOR — what the number is === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>
            What it is
          </div>
          <p className="text-[13px] leading-relaxed" style={{color:'var(--ink)'}}>
            Your score blends what the AI sees in your photo with what you noticed and how you felt. It's a single read that captures three angles of the same skin.
          </p>
        </section>

        {/* === HOW it's computed — the blend === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>
            The blend
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2.5">
              <div className="text-[14px] font-semibold tabular-nums" style={{color:'var(--accent)', minWidth:34}}>50%</div>
              <div className="flex-1">
                <div className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600}}>What the AI sees</div>
                <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>Gemini 2.5 Pro rates 5 visible domains from your photo.</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2.5">
              <div className="text-[14px] font-semibold tabular-nums" style={{color:'var(--accent)', minWidth:34}}>30%</div>
              <div className="flex-1">
                <div className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600}}>What you noticed</div>
                <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>The chips you tap at check-in flag domain-specific deficits.</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2.5">
              <div className="text-[14px] font-semibold tabular-nums" style={{color:'var(--accent)', minWidth:34}}>20%</div>
              <div className="flex-1">
                <div className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600}}>How you felt</div>
                <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>Your 1-10 rating is the felt-sense gestalt no photo can read.</div>
              </div>
            </div>
          </div>
        </section>

        {/* === THE 5 DOMAINS === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>
            The 5 outcome domains
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
            <div style={{color:'var(--ink)'}}>· Redness</div>
            <div style={{color:'var(--ink)'}}>· Hydration</div>
            <div style={{color:'var(--ink)'}}>· Texture</div>
            <div style={{color:'var(--ink)'}}>· Breakouts</div>
            <div style={{color:'var(--ink)'}}>· Barrier</div>
          </div>
          <p className="text-[11px] mt-2 leading-relaxed" style={{color:'var(--ink-soft)'}}>
            Sensitivity used to be here. We dropped it as a score domain — a photo can see redness, not whether a product stung. It stays as a chip you can tap at check-in.
          </p>
        </section>

        {/* === BASELINE — why delta matters === */}
        <section>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>
            Your baseline
          </div>
          <p className="text-[13px] leading-relaxed mb-2" style={{color:'var(--ink)'}}>
            Skin scores are noisy day-to-day — lighting shifts, cycle phase, even how rested you look. The honest signal is the <em style={{fontStyle:'normal', fontWeight:600}}>change from baseline</em>.
          </p>
          <p className="text-[12px] leading-relaxed" style={{color:'var(--ink-soft)'}}>
            We anchor your baseline as the median of your first 10 strong logs. At day 7 you'll see one early pattern. By day 10, you'll see deltas — your score against your own normal.
          </p>
          {baselineLabel && (
            <div className="mt-3 rounded-[10px] p-2.5" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              <div className="text-[9.5px] tracking-[0.22em] uppercase mb-0.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Yours right now</div>
              <div className="text-[12px]" style={{color:'var(--ink)'}}>{baselineLabel}</div>
            </div>
          )}
        </section>

        {/* === GOAL WEIGHTING === */}
        {goal && goal !== 'MAINTENANCE' && (
          <section>
            <div className="text-[9.5px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>
              Your goal weighting
            </div>
            <p className="text-[12px] leading-relaxed" style={{color:'var(--ink-soft)'}}>
              You picked <span style={{color:'var(--ink)', fontWeight:600}}>{goalLabel}</span> as your action goal, so the domains that matter most to it count for more in your composite.
            </p>
          </section>
        )}

        {/* === HONESTY NOTE === */}
        <section className="rounded-[12px] p-3" style={{background:'var(--accent-soft)'}}>
          <div className="text-[9.5px] tracking-[0.26em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>
            Honest framing
          </div>
          <p className="text-[11.5px] leading-relaxed" style={{color:'var(--ink)'}}>
            A single day's score isn't a diagnosis. We're tracking your skin against itself over time. Trust the trend, not the snapshot.
          </p>
        </section>
      </div>
    </Modal>
  );
};
