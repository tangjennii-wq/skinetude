// === SignalsPanel (Insights — May 2026) ===
// Deeper, multi-part observations for the Insights page. Expands the
// Journal "Frida observed" treatment from a single editorial line into
// a section of Signal cards, each with up to four parts:
//
//   - Observation     (what happened — descriptive, no causal claim)
//   - Connection      (what else moved alongside — co-occurrence only)
//   - Possible factor (what was different in that window — never "because")
//   - Suggested action (a concrete try, framed as a probe)
//
// Hard rules (memory: feedback_no_causal_claims):
//   - No "because", "thanks to", "X caused Y", "X lifted Y".
//   - Connections are co-occurrence ONLY ("alongside", "on the same days").
//   - Suggestions use "try", "consider", "watch for".
//
// Voice (memory: project_brand_voice): direct, warm, dry, brief, doctor-
// friend, NOT clinical / NOT influencer. Two sentences beats five.
//
// Mobile-first 380px; one focal point per card. No italics. Figtree.

// === SignalsRow — single collapsible signal (May 30 2026, Agent D-v3) ===
// Part 3 of the Insights cleanup: each Signal card is a one-line
// headline + chevron in its collapsed state. Tap to expand and reveal
// the connection / possible factor / suggested action. Cuts the
// always-on per-card chrome from ~6 stacked blocks to one row.
const SignalRow = ({ s, onAsk }) => {
  const [expanded, setExpanded] = React.useState(false);
  // June 2026 cleanup: dropped sensitivity branch (--rose not in locked AWW
  // palette; also sensitivity was dropped from AI extraction per CLAUDE.md
  // composite rules — branch was dead). Falls through to --ink.
  const signalTone = (sig) => sig === 'redness' ? 'var(--accent)'
    : sig === 'hydration' ? 'var(--accent-blue)'
    : sig === 'breakouts' ? 'var(--gold)'
    : sig === 'barrier' ? 'var(--gold)'
    : 'var(--ink)';
  const categoryLabel = (c) => c === 'trend' ? 'Trend'
    : c === 'product' ? 'Product'
    : c === 'co-movement' ? 'Co-movement'
    : c === 'overlap' ? 'Shelf overlap'
    : c === 'adherence' ? 'Cadence'
    : 'Signal';
  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left flex items-center gap-2 px-3 py-2.5"
        style={{cursor:'pointer'}}
        aria-expanded={expanded}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background: signalTone(s.signal)}} />
        <span className="text-[12px] leading-snug flex-1 min-w-0" style={{color:'var(--ink)'}}>
          <span className="text-[9px] tracking-[0.18em] uppercase mr-2" style={{color:'var(--ink-soft)', fontWeight:650}}>
            {categoryLabel(s.category)}
          </span>
          <span style={{fontWeight:650}}>{s.observation}</span>
        </span>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={12} style={{color:'var(--ink-soft)', flexShrink:0}} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0 flex flex-col gap-2">
          {(s.connection || s.possibleFactor) && (
            <div className="flex flex-col gap-2 pl-2.5" style={{borderLeft:'1.5px solid var(--line)'}}>
              {s.connection && (
                <div>
                  <div className="text-[8.5px] tracking-[0.22em] uppercase mb-0.5" style={{color:'var(--ink-soft)', fontWeight:650}}>
                    Alongside
                  </div>
                  <p className="text-[12px] leading-snug" style={{color:'var(--ink)'}}>
                    {s.connection}
                  </p>
                </div>
              )}
              {s.possibleFactor && (
                <div>
                  <div className="text-[8.5px] tracking-[0.22em] uppercase mb-0.5" style={{color:'var(--ink-soft)', fontWeight:650}}>
                    On those days
                  </div>
                  <p className="text-[12px] leading-snug" style={{color:'var(--ink)'}}>
                    {s.possibleFactor}
                  </p>
                </div>
              )}
            </div>
          )}
          {s.suggestedAction && (
            <div className="flex items-start gap-2 rounded-[10px] px-3 py-2"
              style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
              <Icon name="ArrowRight" size={11} style={{color:'var(--accent)', marginTop:'3px', flexShrink:0}} />
              <div className="flex-1 min-w-0">
                <div className="text-[8.5px] tracking-[0.22em] uppercase mb-0.5" style={{color:'var(--accent)', fontWeight:650}}>
                  Try
                </div>
                <p className="text-[12px] leading-snug" style={{color:'var(--ink)'}}>
                  {s.suggestedAction}
                </p>
              </div>
            </div>
          )}
          {onAsk && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onAsk(`Tell me more about: ${s.observation}`)}
                className="text-[9px] tracking-[0.2em] uppercase"
                style={{color:'var(--ink-soft)', borderBottom:'1px dotted var(--ink-soft)', fontWeight:600}}
              >
                Ask about this
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

const SignalsPanel = ({ logs, products, regimenLogs, onAsk }) => {
  const signals = computeSignals({ logs, products, regimenLogs });

  return (
    <section className="mb-7">
      {/* Section header — mirrors the "Frida observed" eyebrow on Journal */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1" style={{color:'var(--accent)'}}>
            <Icon name="Sparkles" size={11} />
            <span className="text-[10px] tracking-[0.22em] uppercase" style={{fontWeight:650}}>
              Frida is noticing
            </span>
          </div>
          <div className="text-[12px]" style={{color:'var(--ink-soft)', maxWidth:'34rem'}}>
            One row per signal. Tap to see the connection and a next move.
          </div>
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="rounded-[14px] px-4 py-5 text-center" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          <p className="text-[12px]" style={{color:'var(--ink-soft)'}}>
            Signals show up once there are a week or two of check-ins to compare. Keep going.
          </p>
        </div>
      ) : (
        <ul className="rounded-[14px] divide-y" style={{background:'var(--cream-deep)', border:'1px solid var(--line)', borderColor:'var(--line)'}}>
          {signals.map(s => (
            <SignalRow key={s.id} s={s} onAsk={onAsk} />
          ))}
        </ul>
      )}

      {/* Data-honesty footer — only when signals are showing, so users
          know what the engine can and can't see today. */}
      {signals.length > 0 && (
        <p className="text-[9px] tracking-[0.2em] uppercase mt-3 text-center" style={{color:'var(--ink-soft)'}}>
          Signals read from check-ins + shelf rotation · day-by-day product use not yet wired
        </p>
      )}
    </section>
  );
};
