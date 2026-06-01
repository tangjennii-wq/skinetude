// === SundayDigestModal (May 2026) ==================================
// Standalone modal that previews the current week's Sunday Digest and
// offers a one-tap "Add to Calendar" action. Built as a non-design-
// surface entry so it can be opened from the hamburger menu without
// disturbing Home / Journal / Regimen / Insights iteration.
//
// Voice rules:
//   - Tang & Gainey: direct, brief, dry. No exclamation points.
//   - No "rhythm" / "ritual" words.
//   - No emojis (other than the existing ✦ glyph already used app-wide).
//   - No causal claims.
//
// Mobile-first: built to look right at 380px, scales up.
// Typography: relies on the global Figtree +-kill from
// index.html, so even literal `font-sans` classes render
// flat per the typography system memo.
//
// Depends on:
//   - <Modal />, <Icon />, <Eyebrow /> — module-scope primitives.
//   - buildDigest()           — src/digest/buildDigest.js
//   - downloadSundayDigest()  — src/digest/buildDigestIcs.js
// ===================================================================

const SundayDigestModal = ({
  open,
  onClose,
  logs,
  regimenLogs,
  products,
  toast}) => {
  if (!open) return null;

  // useMemo would be ideal but Modal here is rendered conditionally
  // so a plain compute is fine — runs once per open.
  let digest = null;
  let buildError = null;
  try {
    digest = buildDigest({ logs, regimenLogs, products });
  } catch (e) {
    buildError = e && e.message ? e.message : 'Could not assemble this week.';
  }

  const handleDownload = () => {
    if (!digest) return;
    try {
      downloadSundayDigest(digest);
      if (typeof toast === 'function') {
        toast('Calendar file downloaded — open it to drop into your calendar', 'info');
      }
    } catch (e) {
      if (typeof toast === 'function') {
        toast('Could not generate the calendar file', 'error');
      }
    }
  };

  const handleCopy = async () => {
    if (!digest) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(digest.plaintext);
        if (typeof toast === 'function') toast('Digest copied to clipboard', 'success');
      }
    } catch (_) {
      if (typeof toast === 'function') toast('Could not copy — long-press the text instead', 'info');
    }
  };

  return (
    <Modal compact onClose={onClose} eyebrow="This week" title="Sunday Digest">
      <div style={{color:'var(--ink)'}}>
        {buildError && (
          <div className="rounded-[12px] px-3 py-3 mb-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
            <div className="text-[12px]" style={{color:'var(--ink-soft)'}}>{buildError}</div>
          </div>
        )}

        {digest && (
          <>
            <div className="mb-3">
              <Eyebrow>{digest.window.label}</Eyebrow>
            </div>

            {/* === THE READ — Tang & Gainey voice paragraph === */}
            <div className="rounded-[14px] px-4 py-3.5 mb-4" style={{background:'var(--cream-deep)', border:'1px solid var(--accent)'}}>
              <div className="text-[10px] tracking-[0.22em] uppercase mb-1.5" style={{color:'var(--accent)'}}>
                The read
              </div>
              <p className="text-[13px] leading-relaxed" style={{color:'var(--ink)'}}>
                {digest.read}
              </p>
            </div>

            {/* === STATS STRIP === */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-[12px] px-3 py-2.5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Reads</div>
                <div className="text-[18px] leading-none mt-1" style={{color:'var(--ink)', fontWeight:700}}>
                  {digest.checkIns}<span className="text-[10px] ml-0.5" style={{color:'var(--ink-soft)'}}>/7</span>
                </div>
              </div>
              <div className="rounded-[12px] px-3 py-2.5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Avg</div>
                <div className="text-[18px] leading-none mt-1" style={{color: digest.avgScore != null ? 'var(--ink)' : 'var(--ink-soft)', fontWeight:700}}>
                  {digest.avgScore != null ? (
                    <><span style={{color:'var(--accent)'}}>✦</span> {digest.avgScore.toFixed(1)}</>
                  ) : '—'}
                </div>
              </div>
              <div className="rounded-[12px] px-3 py-2.5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>Logged</div>
                <div className="text-[18px] leading-none mt-1" style={{color:'var(--ink)', fontWeight:700}}>
                  {digest.adherence.days}<span className="text-[10px] ml-0.5" style={{color:'var(--ink-soft)'}}>/7</span>
                </div>
              </div>
            </div>

            {/* === DAY-BY-DAY DOTS === */}
            <div className="mb-4">
              <div className="text-[9px] tracking-[0.22em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>
                Days
              </div>
              <div className="flex items-center gap-1">
                {digest.days.map(d => (
                  <div
                    key={d.iso}
                    className="flex-1 rounded-[8px] px-0.5 py-2 text-center"
                    style={{
                      background: d.hasLog ? 'var(--cream-deep)' : 'transparent',
                      border: '1px solid var(--line)',
                      opacity: d.hasLog ? 1 : 0.55,
                      minWidth: 0}}
                    title={`${d.weekday} · ${d.hasLog ? `score ${d.score}` : 'no photo'}`}
                  >
                    <div className="text-[8.5px] tracking-[0.1em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600, whiteSpace:'nowrap'}}>
                      {d.weekday}
                    </div>
                    <div className="text-[11px] leading-none mt-1" style={{color: d.hasLog ? 'var(--accent)' : 'var(--ink-soft)', fontWeight:700, whiteSpace:'nowrap'}}>
                      {d.hasLog && d.score != null ? d.score.toFixed(1) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* === TOP PRODUCTS === */}
            {digest.topProducts.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] tracking-[0.22em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>
                  Most-used
                </div>
                <ul className="space-y-1">
                  {digest.topProducts.map((p, i) => (
                    <li key={i} className="text-[12px] flex items-baseline justify-between gap-3" style={{color:'var(--ink)'}}>
                      <span className="truncate">
                        {p.brand && <span style={{color:'var(--ink-soft)'}}>{p.brand} </span>}
                        {p.name}
                      </span>
                      <span className="text-[10px] flex-shrink-0" style={{color:'var(--ink-soft)'}}>
                        {p.count}× this week
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* === METRIC MOVEMENT === */}
            {digest.drifts.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] tracking-[0.22em] uppercase mb-1.5" style={{color:'var(--ink-soft)'}}>
                  Movement
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {digest.drifts.map(d => (
                    <span
                      key={d.key}
                      className="text-[11px] rounded-full px-2.5 py-1"
                      style={{
                        background: 'var(--cream-deep)',
                        border: '1px solid var(--line)',
                        color: d.delta > 0 ? 'var(--accent-blue)' : 'var(--rose)'}}
                    >
                      {d.key} {d.delta > 0 ? '+' : ''}{d.delta}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* === ACTIONS === */}
            <div className="pt-3 mt-2 border-t flex items-center gap-2 flex-wrap" style={{borderColor: 'var(--line)'}}>
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 px-3 text-[10px] tracking-[0.2em] uppercase rounded-full flex items-center justify-center gap-1.5 transition hover:opacity-90 cursor-pointer"
                style={{background:'var(--ink)', color:'var(--cream)', cursor:'pointer', fontWeight:600}}
              >
                <Icon name="Calendar" size={11} /> Add to calendar
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-2.5 text-[10px] tracking-[0.18em] uppercase rounded-full flex items-center justify-center gap-1.5 transition hover:opacity-70 cursor-pointer border"
                style={{borderColor: 'var(--line)', color:'var(--ink-soft)', background:'transparent', cursor:'pointer'}}
                title="Copy digest text"
              >
                <Icon name="Copy" size={11} /> Copy
              </button>
            </div>
            <p className="text-[10.5px] mt-3 leading-relaxed" style={{color:'var(--ink-soft)'}}>
              Calendar file lands in your downloads — open it once and the week-of summary drops into Apple Calendar, Google Calendar, or Outlook. A recurring weekly reminder rides along.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};
