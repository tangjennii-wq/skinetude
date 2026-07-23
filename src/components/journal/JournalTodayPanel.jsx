// === JournalTodayPanel (Wave 8.2 sub-extract — May 2026) ===
// The `today` mode of JournalView. Mounted by the parent when
// `journalMode === 'today'` and there are logs to render.

const JournalTodayPanel = ({
  logs,
  products,
  regimenLogs,
  retryLogAnalysis,
  setShowApiKeyModal,
  setShowLogModal,
  setShowHomeUploadPicker,
  setShowCheckInChooser,
  setShowPhotoImportQueue,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  mainPhotoByDate,
  retryingLogId,
  setMainPhotoForDate,
  setMatchesDrawerFilter,
  setMatchesDrawerOpen,
  setOpenLesson,
  setSkinReadDrawerLogId,
  setSkinReadsCalendarOpen,
  setSkinReadsWeekOffset,
  skinReadsWeekOffset,
}) => {
  return (() => {
      const hasPhoto = (l) => l && (l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:')));
      const photoLogs = logs.filter(hasPhoto).sort((a, b) => new Date(b.date) - new Date(a.date));
      // === TODAY MAIN PHOTO PICKING ===
      // 1. If the user has explicitly picked a main → use it.
      // 2. Else prefer a full-face photo (most clinically useful).
      // 3. Else most recent for today.
      // The picker UI (rendered below) lets the user override #1.
      const todayKeyLocal = localDateISO();
      const todayLogs = photoLogs.filter(l => l.date === todayKeyLocal);
      const explicitMainId = mainPhotoByDate[todayKeyLocal];
      const todayLog = (() => {
        if (todayLogs.length === 0) return null;
        if (explicitMainId) {
          const explicit = todayLogs.find(l => l.id === explicitMainId);
          if (explicit) return explicit;
        }
        // Prefer full-face area
        const fullFace = todayLogs.find(l => !l.area || l.area === 'full-face' || l.area === 'face');
        if (fullFace) return fullFace;
        // Fall back to most recent (id desc since photoLogs is date-sorted but multiple-per-day need id tiebreak)
        return [...todayLogs].sort((a, b) => (b.id || 0) - (a.id || 0))[0];
      })();
      const todaySnap = todayLog?.metricSnapshot || null;
      const isExtraPhoto = (l) => ['eye-area', 'spot', 'other'].includes(l?.area);
      const areaLabel = (l) => (l?.area || 'full-face').replace(/-/g, ' ');
      // Score map: 0-100 normalized per metric (higher = better).
      // Barrier + Sensitivity now come directly from the AI snapshot
      // (was previously math-derived from Redness × Texture).
      const SCORE_MAP = {
        redness:    { Clear: 100, Low: 80, Mild: 55, Moderate: 30, High: 10 },
        hydration:  { Plump: 100, Good: 80, Balanced: 55, Dry: 30, Parched: 10 },
        texture:    { Smooth: 100, Even: 80, Uneven: 55, Rough: 30, Bumpy: 10 },
        breakouts:  { Clear: 100, Few: 75, Some: 50, Many: 25, Severe: 10 },
        barrier:    { Strong: 100, Steady: 80, Holding: 55, Compromised: 30, Stripped: 10 },
        sensitivity:{ Calm: 100, Settled: 80, Tender: 55, Reactive: 30, Inflamed: 10 },
      };
      const titleCase = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : null;
      // Snapshot summary line — 2-3 keywords picked from today's snapshot.
      // Falls back to a generic phrase when no snapshot yet.
      const snapshotPhrase = todaySnap
        ? [
            todaySnap.redness && /clear|low/i.test(todaySnap.redness) && 'Calm',
            todaySnap.hydration && /plump|good/i.test(todaySnap.hydration) && 'Hydrated',
            todaySnap.texture && /smooth|even/i.test(todaySnap.texture) && 'Smooth',
          ].filter(Boolean).join(', ') || 'Reading your skin…'
        : 'Tap to read your snapshot';
      // Breakout count derived from snapshot word.
      const breakoutMap = { Clear: 0, Few: 1, Some: 3, Many: 5, Severe: 8 };
      const breakoutCount = todaySnap ? (breakoutMap[titleCase(todaySnap.breakouts)] ?? 0) : 0;
      const breakoutLabel = breakoutCount === 0
        ? null
        : breakoutCount === 1
          ? '1 active breakout'
          : `${breakoutCount} active breakouts`;
      // Compute today's "skin score" — average of the 4 metrics
      // (redness, hydration, texture, breakouts). May 2026 reduced
      // from 6 → 4; barrier/sensitivity dropped because they
      // overlapped too heavily with redness in practice. Old logs
      // still parse those keys but the average no longer includes
      // them so the score is comparable across versions.
      const todayAvg = todaySnap ? (() => {
        const vals = ['redness','hydration','texture','breakouts']
          .map(k => SCORE_MAP[k][titleCase(todaySnap[k])])
          .filter(v => typeof v === 'number');
        return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      })() : null;
      // Last 7 days of avg scores → sparkline points.
      const last7 = (() => {
        const points = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const iso = localDateISO(d);
          const log = photoLogs.find(l => l.date === iso);
          const snap = log?.metricSnapshot;
          if (snap) {
            const vals = ['redness','hydration','texture','breakouts']
              .map(k => SCORE_MAP[k][titleCase(snap[k])])
              .filter(v => typeof v === 'number');
            points.push(vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null);
          } else {
            points.push(null);
          }
        }
        return points;
      })();
      // vs-last-week % delta on the average.
      const lastWeekLog = photoLogs.find(l => {
        const days = Math.floor((Date.now() - new Date(l.date).getTime()) / 86400000);
        return days >= 6 && days <= 9 && l.metricSnapshot;
      });
      const lastWeekAvg = lastWeekLog ? (() => {
        const vals = ['redness','hydration','texture','breakouts','barrier','sensitivity']
          .map(k => SCORE_MAP[k][titleCase(lastWeekLog.metricSnapshot[k])])
          .filter(v => typeof v === 'number');
        return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      })() : null;
      const weekDelta = (todayAvg != null && lastWeekAvg != null && lastWeekAvg > 0)
        ? Math.round(((todayAvg - lastWeekAvg) / lastWeekAvg) * 100)
        : null;

      // This Week at a Glance stats — derived from regimenLogs over the last 7 days.
      const todayK = localDateISO();
      const sevenDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return localDateISO(d); })();
      const thisWeekLogs = (regimenLogs || []).filter(r => r.date >= sevenDaysAgo && r.date <= todayK && r.submitted);
      const checkInDays = thisWeekLogs.length;
      const morningCount = thisWeekLogs.filter(r => (r.amProducts || []).length > 0).length;
      const nightCount = thisWeekLogs.filter(r => (r.pmProducts || []).length > 0).length;
      const skippedDay = Math.max(0, 7 - checkInDays);
      const weekRangeLabel = (() => {
        const start = new Date(); start.setDate(start.getDate() - 6);
        const end = new Date();
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      })();

      const JournalTodayActions = ({ className = '' } = {}) => (
        <div
          className={`flex items-center justify-center gap-2 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* === PILL BUTTONS (May 29 2026 v2 per Jenni) ===
              Was text-links with a vertical divider — felt like footer
              chrome. Pills give the actions weight without competing
              with View analysis above. Accent outline + accent text,
              uppercase tracking matches the brand button style. */}
          <button
            type="button"
            onClick={() => setShowCheckInChooser(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:bg-[var(--cream)]"
            style={{
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              background: 'transparent',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <Icon name="Plus" size={11} strokeWidth={2.5} />
            New entry
          </button>
          <button
            type="button"
            onClick={() => setShowPhotoImportQueue && setShowPhotoImportQueue(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:bg-[var(--cream)]"
            style={{
              color: 'var(--ink-soft)',
              border: '1px solid var(--line)',
              background: 'transparent',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <Icon name="Upload" size={11} strokeWidth={2.5} />
            Bulk upload
          </button>
        </div>
      );

      // Sparkline SVG — minimal polyline of last7 (treats nulls as gaps).
      const sparkW = 80, sparkH = 18;
      const sparkPoints = last7
        .map((v, i) => v == null ? null : `${(i / 6) * sparkW},${sparkH - ((v / 100) * sparkH * 0.8) - 2}`)
        .filter(Boolean).join(' ');

      if (!todayLog) {
        // === EMPTY HERO — Atelier-matched (May 29 2026 per Jenni) ===
        // Replaced the standalone "Camera shy today?" EditorialCard
        // with the same shell as the populated Journal hero (which
        // mirrors Atelier). Dashed CHECK IN oval on the left, status
        // eyebrow on top, conversational headline + voice + "Tap the
        // circle →" link on the right. Voice line picks a friendly
        // prompt from prior-log context. JournalTodayActions row at
        // the bottom stays as the explicit New entry / Bulk upload
        // affordances.
        const hasHistory = photoLogs.length > 0;
        const lastPrior = photoLogs[0] || null;
        const priorVoice = hasHistory && lastPrior
          ? `Last logged ${new Date(lastPrior.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}. Curious where today's at.`
          : 'One photo fills the score, trend, and signal. Then the routine has context.';
        const headline = hasHistory ? "Where's today at?" : 'First photo. Brave move.';
        const todayReg = (regimenLogs || []).find(r => r.date === todayKeyLocal);
        // Aligned with HomeDashboard tight logic — see populated-hero
        // version below for the full rationale. Photo daypart alone
        // does NOT mark routine complete.
        const amDoneJ = !!(todayReg && (
          (Array.isArray(todayReg.amDone) && todayReg.amDone.length > 0) ||
          todayReg.amBatchConfirmed === true
        ));
        const pmDoneJ = !!(todayReg && (
          (Array.isArray(todayReg.pmDone) && todayReg.pmDone.length > 0) ||
          todayReg.pmBatchConfirmed === true
        ));
        return (
          <div className="space-y-3 md:space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowCheckInChooser(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowCheckInChooser(true);
                }
              }}
              className="block w-full text-left transition hover:opacity-[0.99] focus:outline-none rounded-[20px] px-4 py-4 md:px-5 md:py-5"
              style={{
                background:'var(--cream-deep)',
                border: '1.5px solid var(--accent)',
                boxShadow: '0 1px 2px rgba(229,60,45,0.06), 0 8px 22px rgba(229,60,45,0.06)',
                cursor:'pointer',
              }}
              aria-label="Start today's check-in"
            >
              {/* Status eyebrow — sentence form */}
              <div className="text-[10px] tracking-[0.04em] mb-3" style={{fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)', opacity:0.7}}>
                Ready to check-in?
              </div>
              <div className="flex items-start gap-4">
                {/* Dashed CHECK IN oval — visual + tappable */}
                <div className="relative flex-shrink-0" style={{width:'clamp(138px, 39vw, 180px)', height:'clamp(138px, 39vw, 180px)'}}>
                  <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-dashed flex flex-col items-center justify-center" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
                    <Icon name="Camera" size={28} style={{color:'var(--ink-soft)'}} />
                    <div className="text-[10.5px] mt-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase'}}>Check in</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0" style={{maxWidth: 220}}>
                  <h2
                    className="font-sans text-[20px] md:text-[22px] leading-[1.15] mb-2"
                    style={{color: 'var(--ink)', letterSpacing:'-0.022em'}}
                  >
                    {headline}
                  </h2>
                  <p className="text-[13px] leading-snug font-light mb-3" style={{color:'var(--ink)'}}>{priorVoice}</p>
                  {/* === EMPTY-STATE CIRCLE + CTA (May 30 v2 per Jenni) ===
                      Mirrors Atelier Check-in card. Red dashed circle
                      placeholder + "Add for analysis" link. Keeps layout
                      stable across empty/filled states. */}
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: 'var(--cream)',
                        border: '2px dashed var(--accent)',
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      <span style={{fontSize:18, lineHeight:1, fontWeight:700, color:'var(--accent)', letterSpacing:'-0.025em', opacity:0.35}}>—</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCheckInChooser(true);
                      }}
                      className="inline-flex max-w-full items-center gap-1 transition hover:opacity-75 text-left"
                      style={{
                        color: 'var(--accent)',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        cursor: 'pointer',
                      }}
                      aria-label="Add a photo for today's analysis"
                    >
                      <Icon name="Sparkles" size={12} />
                      <span className="sm:hidden">Analyze</span>
                      <span className="hidden sm:inline">Add for analysis</span>
                      <Icon name="ArrowRight" size={11} />
                    </button>
                  </div>
                </div>
              </div>
              {/* === COMBINED HERO: metric strip + actions inside (May 30 v5 per Jenni) ===
                  Mirrors Home Check-in layout. Photo + text → metric
                  strip → actions at the bottom. All one card. */}
              <div className="mt-4 rounded-[12px] px-2 py-3 md:px-3" style={{background:'var(--cream)', border: '1px solid var(--line)', opacity:0.95}}>
                <div className="grid grid-cols-5 gap-1 md:gap-2">
                  {[
                    { key:'hydra',   label:'Hydration', icon:'Droplet',  iconColor:'var(--accent-blue)' },
                    { key:'barrier', label:'Barrier',   icon:'Shield',   iconColor:'var(--gold)' },
                    { key:'redness', label:'Redness',   icon:'Flame',    iconColor:'var(--accent)' },
                    { key:'pores',   label:'Pores',     icon:'Circle',   iconColor:'var(--text-tertiary)' },
                    { key:'texture', label:'Texture',   icon:'Activity', iconColor:'var(--rose)' },
                  ].map(t => (
                    <div key={t.key} className="flex flex-col items-center text-center min-w-0" style={{opacity:0.55}}>
                      <Icon name={t.icon} size={13} style={{color: t.iconColor}} />
                      <span className="text-[8px] tracking-[0.04em] uppercase mt-1 w-full leading-tight" style={{color:'var(--ink-soft)', fontWeight:600, wordBreak:'break-word'}}>{t.label}</span>
                      <div className="mt-1" style={{height:'14px'}} aria-hidden="true" />
                    </div>
                  ))}
                </div>
                {/* Empty-state CTA — paired with the Home strip, May 31 2026. */}
                <div className="text-center mt-2 text-[10px] tracking-[0.04em]" style={{color:'var(--accent)', fontWeight:600, opacity:0.75}}>
                  Check in to see your score
                </div>
              </div>
              <div className="mt-4 pt-3 border-t" style={{borderColor: 'var(--line)'}}>
                <JournalTodayActions />
              </div>
            </div>
          </div>
        );
      }

      // === EDITORIAL DESCRIPTORS ===
      // todayAvg is 0–100 (composite of metricSnapshot). We display
      // it as /10 (8.2) per Jenni's design — keeps it on the same
      // scale as the user's self-rating slider and avoids the
      // "85 vs 5/10" confusion from before. The /100 lives only
      // internally for chart math.
      const aiScoreOutOf10 = todayAvg != null ? (todayAvg / 10) : null;
      const aiScoreFmt = aiScoreOutOf10 != null
        ? (aiScoreOutOf10 >= 9.95 ? '10' : aiScoreOutOf10.toFixed(1))
        : null;
      // Editorial-grounded descriptor ladder (replaces the prior
      // Wes-Anderson-y Excellent/Watching/Tender). Maps to the
      // skin's tone, not its grade.
      const aiDescriptor = aiScoreOutOf10 == null
        ? null
        : aiScoreOutOf10 >= 8.7 ? 'Radiant'
        : aiScoreOutOf10 >= 7.5 ? 'Balanced'
        : aiScoreOutOf10 >= 6.5 ? 'Steady'
        : aiScoreOutOf10 >= 5.5 ? 'Tender'
        : 'Reactive';
      // Pull the 2-3 keyword sub-descriptor from the snapshot.
      const subDescriptors = todaySnap
        ? [
            todaySnap.redness && /clear|low/i.test(todaySnap.redness) && 'Calm',
            todaySnap.hydration && /plump|good/i.test(todaySnap.hydration) && 'Hydrated',
            todaySnap.texture && /smooth|even/i.test(todaySnap.texture) && 'Smooth',
            todaySnap.breakouts && /clear|few/i.test(todaySnap.breakouts) && 'Clear',
          ].filter(Boolean)
        : [];

      // === COMPUTE METRIC TILES ONCE — used by the strip + needs cards ===
      // Pull the five composite outcome domains from the AI snapshot.
      // Sensitivity is no longer extracted (June 2026 per Jenni —
      // see compositeIndex.js). Texture replaces it on the tile rail.
      const metricsRaw = todaySnap ? (() => {
        const m = (k) => SCORE_MAP[k]?.[titleCase(todaySnap[k])] ?? null;
        return {
          hydration: m('hydration'),
          barrier: m('barrier'),
          redness: m('redness'),
          congestion: m('breakouts'),     // breakouts → "Pores" label, congestion data key
          texture: m('texture'),
        };
      })() : null;

      // Compare to the most recent prior log to derive direction
      // (Improving / Holding / Slipping). Used by both the strip
      // and the "Frida observed" prose — DRY.
      const priorMetricsLog = todaySnap ? photoLogs.find(l =>
        l.id !== todayLog.id && l.metricSnapshot && new Date(l.date) < new Date(todayLog.date)
      ) : null;
      const priorMetricsRaw = priorMetricsLog ? (() => {
        const m = (k) => SCORE_MAP[k]?.[titleCase(priorMetricsLog.metricSnapshot[k])] ?? null;
        return {
          hydration: m('hydration'), barrier: m('barrier'),
          redness: m('redness'), congestion: m('breakouts'),
          texture: m('texture'),
        };
      })() : null;

      // Per-metric direction + verb. Verbs are skin-weather-style
      // (Improving / Holding / Slipping etc.) per Jenni's brief.
      // Direction: positive metrics (hydration, barrier) go ↑ on
      // improvement; negative (redness, congestion) go ↓.
      const verbForMetric = (key, now, prev) => {
        if (now == null) return { arrow: '—', verb: '—', dir: null };
        const delta = prev == null ? 0 : (now - prev);
        // Positive direction = "things got better"
        // For pos metrics (hydration, barrier, sensitivity): higher = better.
        //   But for the LABEL: hydration ↑ Improving / — Holding / ↓ Slipping
        //                      barrier   ↑ Steadying / — Holding / ↓ Compromised
        //                      sensitivity ↓ Lower / — Steady / ↑ Reactive (inverse-feel)
        // For neg-feel metrics (redness, congestion): higher number = clearer skin.
        //                      redness  ↓ Softening / — Steady / ↑ Flaring
        //                      congestion ↓ Clearing / — Steady / ↑ Active
        const better = delta > 5;
        const worse = delta < -5;
        const same = !better && !worse;
        if (key === 'hydration') return { arrow: better ? '↑' : worse ? '↓' : '—', verb: better ? 'Improving' : worse ? 'Slipping' : 'Holding', dir: better ? 'pos' : worse ? 'neg' : 'flat' };
        if (key === 'barrier')   return { arrow: better ? '↑' : worse ? '↓' : '—', verb: better ? 'Steadying' : worse ? 'Compromised' : 'Holding', dir: better ? 'pos' : worse ? 'neg' : 'flat' };
        if (key === 'redness')   return { arrow: better ? '↓' : worse ? '↑' : '—', verb: better ? 'Softening' : worse ? 'Flaring' : 'Steady', dir: better ? 'pos' : worse ? 'neg' : 'flat' };
        if (key === 'congestion')return { arrow: better ? '↓' : worse ? '↑' : '—', verb: better ? 'Clearing' : worse ? 'Active' : 'Steady', dir: better ? 'pos' : worse ? 'neg' : 'flat' };
        if (key === 'texture')   return { arrow: better ? '↑' : worse ? '↓' : '—', verb: better ? 'Smoothing' : worse ? 'Rougher' : 'Steady', dir: better ? 'pos' : worse ? 'neg' : 'flat' };
        return { arrow: '—', verb: '—', dir: 'flat' };
      };

      // === FRIDA OBSERVED — single editorial paragraph ===
      // Picks the 1-2 metrics that moved most, weaves them into one
      // sentence. Falls back to a softer "first reading" sentence
      // when nothing to compare to yet. Pulls from REAL deltas only.
      const fridaObserved = (() => {
        if (!metricsRaw || !priorMetricsRaw) return null;
        const moves = ['hydration','barrier','redness','congestion','texture']
          .map(k => {
            const now = metricsRaw[k];
            const prev = priorMetricsRaw[k];
            if (now == null || prev == null) return null;
            const dir = verbForMetric(k, now, prev);
            if (dir.dir === 'flat') return null;
            return { key: k, ...dir, delta: now - prev };
          })
          .filter(Boolean)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        if (moves.length === 0) return null;
        const phrase = (m) => {
          if (m.key === 'hydration') return m.dir === 'pos' ? 'hydration improved' : 'hydration slipped';
          if (m.key === 'barrier')   return m.dir === 'pos' ? 'barrier steadied' : 'barrier looked compromised';
          if (m.key === 'redness')   return m.dir === 'pos' ? 'redness softened' : 'redness lifted';
          if (m.key === 'congestion')return m.dir === 'pos' ? 'congestion cleared' : 'more congestion appeared';
          if (m.key === 'texture')   return m.dir === 'pos' ? 'texture smoothed' : 'texture roughened';
          return '';
        };
        if (moves.length === 1) return `${phrase(moves[0])} this week.`;
        return `${phrase(moves[0])} and ${phrase(moves[1])} this week.`;
      })();

      // === MECHANISM PICKS (drives the engine — May 2026 audit) ===
      // Derives 3 mechanism keys from the metric profile (low Barrier
      // → repair, low Hydration → hydrate, high Sensitivity/Redness →
      // calm). Used to be paired with a "What your skin needs" card
      // trio rendered below, but that surface duplicated the engine
      // cards under it — both were saying "you should layer this
      // mechanism." Standalone trio cut; mechanism framing now lives
      // in the engine card eyebrow ("Calm · this week"). This array
      // remains the feed for resolveCoverageStates.
      const needsToShow = (() => {
        if (!metricsRaw) return ['repair','calm','hydrate'];
        const picks = [];
        if ((metricsRaw.barrier ?? 100) < 50) picks.push('repair');
        if ((metricsRaw.redness ?? 100) < 50) picks.push('calm');
        if ((metricsRaw.hydration ?? 100) < 50) picks.push('hydrate');
        if ((metricsRaw.congestion ?? 100) < 50 && !picks.includes('calm')) picks.push('clarify');
        // Always show 3 — fill from the standard trio
        ['repair','calm','hydrate'].forEach(k => { if (!picks.includes(k) && picks.length < 3) picks.push(k); });
        return picks.slice(0, 3);
      })();

      // Pull a clean 1-line "AI note" from the existing aiAnalysis
      // (the bullet-list prose). Grab the first bullet, strip the
      // dash, and trim. Fallback to the snapshot phrase.
      const aiOneLineNote = (() => {
        const raw = todayLog.aiAnalysis || '';
        const first = raw.split(/\n+/).map(l => l.trim()).find(l => l && /^[-•]/.test(l));
        if (!first) return fridaObserved || (subDescriptors.length > 0 ? `Skin reads as ${subDescriptors.map(s => s.toLowerCase()).join(', ')} today.` : null);
        return first.replace(/^[-•\s]+/, '').replace(/\s*\[[A-C]\]\s*$/, '').trim();
      })();

      return (
        <div className="space-y-3 md:space-y-4">
          {/* === HERO — Atelier parity (May 28 2026 v6 per Jenni) ===
              Mirrors the Atelier Skin Snapshot card so Journal Today
              and Atelier feel like the same surface. Status eyebrow
              (Check-in / sun / moon — status only, not tappable in
              this panel), photo with score badge + camera watermark
              overlay, headline + voice on the right with a quiet
              "tap to open analysis" reading. Journal-specific bits
              (multi-photo MAIN selector, journal actions row) live
              underneath the hero so the top reads as Atelier first. */}
          {(() => {
            const tc = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
            // Mirror Atelier headline/voice logic — keeps the doctor-friend tone consistent.
            let headline = 'Skin’s holding today.', voice = 'Steady. Same routine tomorrow.';
            if (todaySnap) {
              const r = tc(todaySnap.redness), h = tc(todaySnap.hydration), t = tc(todaySnap.texture),
                    b = tc(todaySnap.breakouts), ba = tc(todaySnap.barrier), s = tc(todaySnap.sensitivity);
              if (r === 'High' || s === 'Inflamed' || ba === 'Stripped') { headline = 'Skin’s flaring today.'; voice = 'Pause the actives. Centella, barrier, bed.'; }
              else if (r === 'Moderate' || s === 'Reactive') { headline = 'Redness is back today.'; voice = 'Centella under the moisturizer, not on top. Lay off the actives for a beat.'; }
              else if (b === 'Severe' || b === 'Many') { headline = 'Breaking out today.'; voice = 'Hands off. Patch the worst one. Try again tomorrow.'; }
              else if (b === 'Some') { headline = 'A couple of guests today.'; voice = 'One BHA tonight, just one. Keep it simple.'; }
              else if (h === 'Plump' && (r === 'Clear' || r === 'Low')) { headline = 'Glowing today.'; voice = 'No notes. Screenshot for reference.'; }
              else if (h === 'Good' && (r === 'Clear' || r === 'Low')) { headline = 'Reads calm today.'; voice = 'This is working. Keep doing what you’re doing.'; }
              else if (h === 'Dry') { headline = 'Skin’s holding today.'; voice = 'Double up the moisturizer tonight. Maybe an oil over it.'; }
              else if (t === 'Smooth' && b === 'Clear') { headline = 'Behaving today.'; voice = 'Streak’s holding. Same routine tomorrow.'; }
            }
            const score10 = aiScoreFmt;
            // Today's routine status — for the sun/moon eyebrow icons.
            const todayReg = (regimenLogs || []).find(r => r.date === todayKeyLocal);
            // === AM/PM DONE — actual engagement only (May 29 2026 v5) ===
            // Aligned with HomeDashboard tight logic so the Atelier and
            // Journal status rows agree. Previous fallback used
            // `submitted && amProducts.length > 0` which fired for PM the
            // moment AM was logged (pmProducts holds the PLANNED PM
            // routine, populated as soon as the day's log exists). Same
            // trap caught me when I added a daypart-photo fallback —
            // PM read complete from generic photo timing. Done iff the
            // user explicitly batch-confirmed that slot OR marked
            // products done. Photo daypart alone does NOT mark routine
            // complete; the photo check-in shows up in "Today logged".
            const amDoneJ = !!(todayReg && (
              (Array.isArray(todayReg.amDone) && todayReg.amDone.length > 0) ||
              todayReg.amBatchConfirmed === true
            ));
            const pmDoneJ = !!(todayReg && (
              (Array.isArray(todayReg.pmDone) && todayReg.pmDone.length > 0) ||
              todayReg.pmBatchConfirmed === true
            ));
            const hasCheckIn = !!todayLog;
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSkinReadDrawerLogId(todayLog.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSkinReadDrawerLogId(todayLog.id);
                  }
                }}
                className="block w-full text-left transition hover:opacity-[0.99] focus:outline-none group rounded-[20px] px-4 py-4 md:px-5 md:py-5"
                style={{
                  // === HERO RED BORDER — restored 1.5px (May 30 v3 per Jenni) ===
                  background:'var(--cream-deep)',
                  border: '1.5px solid var(--accent)',
                  boxShadow: '0 1px 2px rgba(229,60,45,0.06), 0 8px 22px rgba(229,60,45,0.06)',
                  cursor:'pointer',
                }}
                aria-label="Open today's full Skin Read"
              >
                {/* === STATUS EYEBROW — sentence form (May 29 2026 v7 per Jenni) ===
                    Mirrors the Atelier Check-in card eyebrow. Journal
                    panel only tracks check-in status — routine status
                    lives on the Regimen card. Single conversational
                    line, color-coded. */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  {/* Eyebrow always-on black ink (May 29 v5 per Jenni) —
                      matches the Check-in card. Quiet status label. */}
                  <div className="text-[10px] tracking-[0.04em]" style={{fontWeight:600, textTransform:'uppercase', color:'var(--ink)'}}>
                    {hasCheckIn ? 'Checked in ✓' : 'Ready to check-in?'}
                  </div>
                  {/* === RECENT CHECK-IN SETS STRIP (Jun 1 2026 per Jenni) ===
                      Replaces the multi-today-photo MAIN picker. Now shows
                      up to 5 recent check-in *sets* — grouped by
                      (date, daypart) so AM and PM are separate sets but
                      multiple photos within one session collapse to a
                      single representative circle (full-face preferred).
                      Click → opens the analysis drawer for that set's
                      rep log. Today's set gets the accent outline. */}
                  {(() => {
                    const setKey = (l) => `${l.date}__${l.daypart || ''}`;
                    const setsMap = new Map();
                    photoLogs.forEach(l => {
                      const k = setKey(l);
                      if (!setsMap.has(k)) setsMap.set(k, []);
                      setsMap.get(k).push(l);
                    });
                    const pickRep = (group) => {
                      const fullFace = group.find(l => !l.area || l.area === 'full-face' || l.area === 'face');
                      if (fullFace) return fullFace;
                      return [...group].sort((a, b) => (b.id || 0) - (a.id || 0))[0];
                    };
                    const sets = Array.from(setsMap.entries())
                      .map(([k, group]) => {
                        const rep = pickRep(group);
                        return rep ? { key: k, rep, date: rep.date, daypart: rep.daypart || '', size: group.length } : null;
                      })
                      .filter(Boolean)
                      .sort((a, b) => {
                        if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
                        const order = { pm: 0, am: 1, '': 2 };
                        return (order[a.daypart] ?? 2) - (order[b.daypart] ?? 2);
                      })
                      .slice(0, 5);
                    if (sets.length <= 1) return null;
                    return (
                      <div className="flex items-center gap-1">
                        <span className="text-[8.5px] tracking-[0.22em] uppercase mr-1" style={{color:'var(--ink-soft)'}}>Recent</span>
                        {sets.map(s => {
                          const isToday = s.date === todayKeyLocal;
                          const dpLabel = s.daypart ? ' · ' + s.daypart.toUpperCase() : '';
                          const sizeLabel = s.size > 1 ? ` · ${s.size} photos` : '';
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSkinReadDrawerLogId(s.rep.id); }}
                              className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 transition hover:opacity-80"
                              style={{
                                border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                                boxShadow: isToday ? '0 0 0 1.5px var(--cream)' : 'none',
                                cursor: 'pointer',
                              }}
                              aria-label={`View analysis from ${s.date}${dpLabel}`}
                              title={`${s.date}${dpLabel}${sizeLabel}`}
                            >
                              <Photo item={s.rep} alt="" className="w-full h-full object-cover"
                                renderFallback={() => <div className="w-full h-full flex items-center justify-center text-[8px]" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>{s.rep.rating ?? '·'}</div>}
                              />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Photo + headline/voice row */}
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    {/* Photo as a tappable button → opens check-in chooser
                        (May 29 2026 per Jenni). Whole photo = camera. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (typeof setShowCheckInChooser === 'function') {
                          setShowCheckInChooser(true);
                        }
                      }}
                      className="block rounded-full overflow-hidden transition hover:opacity-90"
                      style={{width:'160px', height:'192px', background:'var(--cream)', border: '1px solid var(--line)', cursor:'pointer'}}
                      aria-label="Take a check-in photo"
                      title="Tap to check in"
                    >
                      <Photo item={todayLog} alt="" className="w-full h-full object-cover"
                        renderFallback={() => (
                          <div className="w-full h-full flex items-center justify-center font-sans text-4xl" style={{color:'var(--ink-soft)'}}>{todayLog.rating}</div>
                        )}
                      />
                    </button>
                    {/* Camera watermark — circle (May 29 v5) */}
                    <div
                      className="absolute pointer-events-none flex flex-col items-center justify-center"
                      style={{
                        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 60, height: 60, borderRadius: '50%',
                        background: 'rgba(28,25,23,0.32)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        backdropFilter: 'blur(2px)', opacity: 0.6, zIndex: 5,
                        gap: 2,
                      }}
                      aria-hidden
                    >
                      <Icon name="Camera" size={16} style={{color:'rgba(255,251,244,1)'}} />
                      <span style={{
                        fontSize: 7, color: 'rgba(255,251,244,1)', fontWeight: 700,
                        letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1,
                      }}>Check in</span>
                    </div>
                    {/* Score badge moved to right column (May 29 v5 per Jenni) */}
                  </div>
                  <div className="flex-1 min-w-0" style={{maxWidth: 220}}>
                    <h2
                      className="font-sans text-[20px] md:text-[22px] leading-[1.15] mb-2"
                      style={{color: 'var(--ink)', letterSpacing:'-0.022em'}}
                    >
                      {headline}
                    </h2>
                    {voice && (
                      <p className="text-[13px] leading-snug font-light mb-3" style={{color:'var(--ink)'}}>
                        {voice}
                      </p>
                    )}
                    {/* === SCORE BADGE + VIEW ANALYSIS (Jun 1 2026 per Jenni) ===
                        Mirrors HomeDashboard's single-line treatment: real
                        button (not a span), whiteSpace:nowrap + flexShrink:0
                        so "View analysis" never wraps inside the narrow
                        max-220px text column. */}
                    <div className="inline-flex items-center gap-1.5" style={{whiteSpace:'nowrap'}}>
                      {score10 != null && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSkinReadDrawerLogId(todayLog.id); }}
                          className="flex items-center justify-center transition hover:scale-105 focus:outline-none"
                          style={{
                            width: 50, height: 50, borderRadius: '50%',
                            background: 'var(--cream)',
                            border: '2px solid var(--accent)',
                            boxShadow: '0 2px 8px rgba(28,25,23,0.12)',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                          aria-label={`Skin read ${score10} out of 10. Tap to view analysis.`}
                          title={`${score10} / 10 · tap to view analysis`}
                        >
                          <span style={{fontSize:18, lineHeight:1, fontWeight:700, color:'var(--accent)', letterSpacing:'-0.025em'}}>{score10}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSkinReadDrawerLogId(todayLog.id); }}
                        className="inline-flex items-center gap-1 transition hover:opacity-75"
                        style={{
                          color:'var(--accent)', fontSize:11.5, fontWeight:600,
                          letterSpacing:'0.01em', cursor:'pointer',
                          whiteSpace:'nowrap', flexShrink:0,
                        }}
                        aria-label="View analysis"
                      >
                        <Icon name="Sparkles" size={12} />
                        View analysis
                        <Icon name="ArrowRight" size={11} />
                      </button>
                    </div>
                    {/* === WEEK-AT-A-GLANCE INLINE (May 29 2026 v3 per Jenni) ===
                        Mobile-fit pass: shortened "mornings/nights" to
                        AM/PM so the line stays on one row at 380px
                        viewport. Numbers stay bold + color-coded. */}
                    <div className="mt-3 text-[10.5px] leading-snug" style={{color:'var(--ink-soft)', fontWeight:500, letterSpacing:'0.01em'}}>
                      <span style={{fontWeight:600, color:'var(--ink)'}}>{checkInDays}</span> check-in{checkInDays === 1 ? '' : 's'},
                      {' '}<span style={{fontWeight:600, color: morningCount > 0 ? 'var(--gold)' : 'var(--ink-soft)'}}>{morningCount}</span> AM,
                      {' '}<span style={{fontWeight:600, color: nightCount > 0 ? 'var(--accent-blue)' : 'var(--ink-soft)'}}>{nightCount}</span> PM,
                      {' '}<span style={{fontWeight:600, color:'var(--ink-soft)'}}>{skippedDay}</span> skipped
                    </div>
                  </div>
                </div>
                {/* === TREND STRIP — FULL WIDTH (May 29 2026 v3 per Jenni) ===
                    Moved out of the right column so the line has room
                    to breathe. Layout: tiny eyebrow ("THIS WEEK · TREND")
                    + delta on the right, then a row with [first#] [line]
                    [last#] spanning full hero width. Quiet divider above
                    so it groups with the check-in tally as the
                    quantitative footer of the hero. */}
                {/* This week · trend mini-chart removed (May 29 2026 per Jenni) —
                    looked weird in the narrow column and duplicated info
                    that the inline week stats above + FRIDA OBSERVED
                    summary below already convey. */}
                {/* === ACTIONS + METRIC STRIP INSIDE HERO CARD (May 29 v5 per Jenni) ===
                    Combined into the same card so Journal mirrors the
                    Check-in page layout. Actions sit above the strip,
                    no divider — keeps it quiet. */}
                <div className="mt-4">
                  <JournalTodayActions />
                </div>
                {metricsRaw && (() => {
                  // === STABLE 3-STATE VOCAB (May 29 v6 — mirrors Atelier) ===
                  // val>=70 stably good (blue), <50 stably bad (rose),
                  // else neutral "Stable" (ink-soft).
                  const verbFor = (key, dir, value) => {
                    // Pending state: blank, not em-dash. Matches Home's
                    // May 31 2026 retirement — em-dashes read as
                    // "broken UI" rather than "awaiting check-in."
                    if (dir === 'pending') return { word: '', tone: 'pending' };
                    if (dir === 'pos') {
                      const w = key === 'hydration' ? 'Up' : key === 'barrier' ? 'Strong' : key === 'redness' ? 'Soft' : key === 'congestion' ? 'Clear' : key === 'texture' ? 'Smoother' : '';
                      return { word: w, tone: 'pos' };
                    }
                    if (dir === 'neg') {
                      const w = key === 'hydration' ? 'Down' : key === 'barrier' ? 'Stressed' : key === 'texture' ? 'Rougher' : 'Up';
                      return { word: w, tone: 'neg' };
                    }
                    const good = value != null && value >= 70;
                    const bad  = value != null && value < 50;
                    const tone = good ? 'pos' : bad ? 'neg' : 'watching';
                    const w = key === 'hydration'  ? (good ? 'Plump'  : bad ? 'Dry'      : 'Okay')
                           : key === 'barrier'    ? (good ? 'Strong' : bad ? 'Tender'   : 'Holding')
                           : key === 'redness'    ? (good ? 'Calm'   : bad ? 'Flushed'  : 'Light')
                           : key === 'congestion' ? (good ? 'Clear'  : bad ? 'Busy'     : 'Even')
                           : key === 'texture'    ? (good ? 'Smooth' : bad ? 'Rough'    : 'Even')
                           : 'Okay';
                    return { word: w, tone };
                  };
                  const tiles = [
                    { key: 'hydration',  label: 'Hydration', icon: 'Droplet', iconColor: 'var(--accent-blue)' },
                    { key: 'barrier',    label: 'Barrier',   icon: 'Shield',  iconColor: 'var(--gold)' },
                    { key: 'redness',    label: 'Redness',   icon: 'Flame',   iconColor: 'var(--accent)' },
                    { key: 'congestion', label: 'Pores',     icon: 'Circle',  iconColor: 'var(--text-tertiary)' },
                    { key: 'texture',    label: 'Texture',   icon: 'Activity', iconColor: 'var(--rose)' },
                  ];
                  return (
                    <div className="mt-4 rounded-[12px] px-2 py-3 md:px-3" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                      <div className="grid grid-cols-5 gap-0.5 md:gap-2">
                        {tiles.map(t => {
                          const v = metricsRaw[t.key];
                          const direction = verbForMetric(t.key, v, priorMetricsRaw?.[t.key]);
                          const moved = direction.dir === 'pos' || direction.dir === 'neg';
                          const verb = verbFor(t.key, direction.dir, v);
                          const verbColor = verb.tone === 'pos' ? 'var(--accent-blue,#86CAE7)' : verb.tone === 'neg' ? 'var(--accent)' : verb.tone === 'watching' ? 'var(--gold)' : 'var(--ink-soft)';
                          return (
                            <div key={t.key} className="flex flex-col items-center text-center min-w-0 py-1.5 px-0.5">
                              <Icon name={t.icon} size={13} style={{color: t.iconColor, opacity: verb.tone === 'pending' ? 0.55 : 1}} />
                              <span className="text-[8px] tracking-[0.04em] uppercase mt-1 w-full leading-tight" style={{color:'var(--ink-soft)', fontWeight:600, wordBreak:'break-word'}}>{t.label}</span>
                              <div className="flex items-baseline gap-0.5 mt-1">
                                {moved && (
                                  <span className="text-[10px]" style={{color: verbColor, fontWeight:600}}>{direction.arrow}</span>
                                )}
                                {verb.word && (
                                  <span className="text-[10px]" style={{color: verbColor, fontWeight: moved ? 500 : 600, opacity: verb.tone === 'pending' ? 0.55 : 1}}>{verb.word}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* === FRIDA OBSERVED ===
              Editorial single-paragraph "what changed" treatment.
              Replaces the boxed What Changed delta card. Italic
              serif, sage Sparkles emblem. Honest — only renders
              when there's a real prior reading to compare to. */}
          {fridaObserved && (
            <div className="px-1 md:px-2">
              <div className="flex items-center gap-1.5 mb-1.5" style={{color:'var(--accent)'}}>
                <Icon name="Sparkles" size={11} />
                <span className="text-[10px] tracking-[0.22em] uppercase">Frida observed</span>
              </div>
              <p className="font-sans text-[14px] leading-relaxed" style={{color:'var(--ink)'}}>{fridaObserved}</p>
            </div>
          )}

          {/* === FRIDA ANALYSIS — inline, no popup ===
              Per Jenni: today's tab should be self-contained, no
              drawer required. Renders the AI analysis bullets
              with the new tagged renderer (Observe / Why / Try
              icons), plus a quiet re-analyze affordance. */}
          {todayLog && (todayLog.aiAnalysis || todayLog.analyzing || (!todaySnap && canRunAnalysis())) && (
            <div className="rounded-[14px] px-4 py-4" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5" style={{color:'var(--accent)'}}>
                  <Icon name="Sparkles" size={11} />
                  <span className="text-[10px] tracking-[0.22em] uppercase">Frida analysis</span>
                </div>
                {todayLog.aiAnalysis && canRunAnalysis() && retryingLogId !== todayLog.id && (
                  <button
                    onClick={() => retryLogAnalysis(todayLog.id)}
                    className="text-[9.5px] tracking-[0.22em] uppercase flex items-center gap-1 transition hover:opacity-70"
                    style={{color:'var(--ink-soft)'}}
                  >
                    <Icon name="RefreshCw" size={10} /> Re-read
                  </button>
                )}
              </div>
              {retryingLogId === todayLog.id ? (
                <p className="font-sans text-[13px] flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                  <Icon name="Loader2" size={12} className="spin" style={{color:'var(--accent)'}} /> Reading your skin…
                </p>
              ) : todayLog.aiAnalysis ? (
                <TaggedAnalysisBullets
                  text={formatAnalysisText(todayLog.aiAnalysis)}
                  onOpen={setOpenLesson}
                  IconComponent={Icon}
                  withPearlsFn={withPearls}
                />
              ) : !canRunAnalysis() ? (
                <button onClick={() => setShowApiKeyModal(true)} className="text-[11px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                  <Icon name="Key" size={11} /> Add API key to read this photo
                </button>
              ) : todayLog.analyzing ? (
                <p className="font-sans text-[13px] flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                  <Icon name="Loader2" size={12} className="spin" style={{color:'var(--accent)'}} /> Reading your skin…
                </p>
              ) : (
                <button
                  onClick={() => retryLogAnalysis(todayLog.id)}
                  className="text-[11px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-70"
                  style={{color:'var(--accent)'}}
                >
                  <Icon name="Sparkles" size={11} /> Read this photo
                </button>
              )}
            </div>
          )}

          {/* === TREND CHART — pulled into hero card (May 29 2026) ===
              Was a standalone bordered card here; consolidated up into
              the hero card as a compact sparkline under the check-in
              tally so the daily report reads top-to-bottom Whoop-style.
              See the COMPACT TREND SPARKLINE block inside the hero card
              above. */}

          {/* === "What your skin needs" trio cut (May 2026 audit) ===
              The 3-card trio (Repair / Calm / Hydrate + static
              ingredient chips) duplicated the engine cards directly
              below it — both surfaces were answering "you should
              layer this mechanism." Engine cards now carry the
              mechanism framing in their eyebrow ("Calm · this week")
              so the abstraction and the action live in one card.
              The needsToShow array still feeds the engine — see the
              MECHANISM PICKS block at the top of this render. */}

          {/* === WHAT WE'D TRY · UMBRELLA HEADER (May 29 2026 v4) ===
              Per Jenni: both surfaces (shelf picks + new finds) are
              technically "what we'd try" — shelf items are the most
              attainable, new finds are the discovery layer. The
              umbrella eyebrow sits above both. Each surface keeps its
              own card-level eyebrow ("CALM · FROM YOUR SHELF" / "WORTH
              RETHINKING") so the section reads as a typed list, not
              two unrelated cards. */}
          {todaySnap && (
            <div className="text-[10px] tracking-[0.22em] uppercase mb-1 px-1" style={{color:'var(--ink-soft)'}}>
              What we'd try
            </div>
          )}

          {/* === PICKS FROM YOUR SHELF (May 29 2026 v3 per Jenni) ===
              MOVED to TOP of the recs stack (right after analysis,
              before new-finds) because shelf items are the most
              attainable + actionable action the user can take — they
              already own them. New-finds lives below as an
              aspirational discovery surface.
              Two states based on today's snapshot, NO causal claims:
                DEFICIT  → a metric is weak (<= 30): "X is lagging — pick
                            something from your shelf that closes the gap."
                          Opens drawer pre-filtered to the matching goal.
                HOLDING  → a metric is strong (>= 80) AND nothing lagging:
                            "X is holding — try a next-step active you own."
                          Opens drawer pre-filtered to the next-step goal.
                NEUTRAL → fallback: "Already on your shelf." Opens all.
              v1 used "What lifted Fri" — pulled because we don't actually
              have causal attribution data; we only know which day moved
              most. Don't reintroduce. KEPT SEPARATE from "What we'd try"
              below per the two-suggestion-surfaces brand rule. */}
          {todaySnap && (() => {
            // Map each metric → its drawer filter + display label + framing pairs.
            // For DEFICIT: open the drawer with the goal that closes the gap.
            // For HOLDING: open the drawer with the NEXT-step goal — e.g. if
            // barrier is holding, suggest brightening (vit C/niacinamide) as
            // the next layer the user can probably tolerate.
            const metricMeta = {
              redness:     { label: 'Calm',      deficitFilter: 'calm',     nextFilter: 'brighten'  },
              hydration:   { label: 'Hydration', deficitFilter: 'hydrate',  nextFilter: 'repair'    },
              barrier:     { label: 'Barrier',   deficitFilter: 'repair',   nextFilter: 'brighten'  },
              sensitivity: { label: 'Calm',      deficitFilter: 'calm',     nextFilter: 'brighten'  },
              breakouts:   { label: 'Pores',     deficitFilter: 'exfoliate',nextFilter: 'hydrate'   },
              texture:     { label: 'Texture',   deficitFilter: 'exfoliate',nextFilter: 'brighten'  },
            };
            const scored = Object.keys(metricMeta).map(k => {
              const raw = SCORE_MAP[k]?.[titleCase(todaySnap[k])];
              return typeof raw === 'number' ? { k, score: raw, meta: metricMeta[k] } : null;
            }).filter(Boolean);
            if (scored.length === 0) return null;
            const lowest  = [...scored].sort((a,b) => a.score - b.score)[0];
            const highest = [...scored].sort((a,b) => b.score - a.score)[0];
            let state;
            if (lowest.score <= 30) {
              state = {
                kind: 'deficit',
                filter: lowest.meta.deficitFilter,
                eyebrow: `${lowest.meta.label.toUpperCase()} · FROM YOUR SHELF`,
                title: `${lowest.meta.label} is lagging.`,
                body: `Pick something you already own that closes the gap.`,
              };
            } else if (highest.score >= 80) {
              state = {
                kind: 'holding',
                filter: highest.meta.nextFilter,
                eyebrow: `${highest.meta.label.toUpperCase()} · HOLDING`,
                title: `${highest.meta.label} is holding.`,
                body: `Try a next-step active you already own.`,
              };
            } else {
              state = {
                kind: 'neutral',
                filter: 'all',
                eyebrow: 'FROM YOUR SHELF',
                title: 'Already on your shelf.',
                body: 'A few worth another pass this week.',
              };
            }
            return (
              <button
                type="button"
                onClick={() => { setMatchesDrawerFilter(state.filter); setMatchesDrawerOpen(true); }}
                className="w-full text-left rounded-[14px] px-4 py-3 transition hover:opacity-95"
                style={{background:'var(--cream)', border: '1px solid var(--line)', cursor:'pointer'}}
                aria-label={`See picks from your shelf — ${state.title}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2" style={{color:'var(--accent)'}}>
                  <div className="inline-flex items-center gap-1.5">
                    <Icon name="Sparkles" size={11} />
                    <span className="text-[10px] tracking-[0.22em] uppercase">{state.eyebrow}</span>
                  </div>
                  <Icon name="ChevronRight" size={13} style={{color:'var(--ink-soft)'}} />
                </div>
                <div className="font-sans leading-snug mb-1.5 text-left" style={{color:'var(--ink)', fontSize:'15px'}}>
                  {state.title}
                </div>
                <div className="text-[11px] leading-snug text-left" style={{color:'var(--ink-soft)'}}>
                  {state.body}
                </div>
              </button>
            );
          })()}

          {/* === WHAT WE'D TRY (May 2026, reordered May 29 2026) ===
              Engine-driven NEW-FINDS cards: SWAP_SUGGESTED + CONCERN_GAP.
              Lives BELOW the shelf-picks card per Jenni's order: shelf
              items are more attainable (already owned), new finds are
              aspirational. SEPARATE from "Picks from your shelf" above
              per the two-suggestion-surfaces brand rule. Engine only
              fires when there's signal (concern flagged or SWAP rule
              trips). Silence = COVERED state. */}
          {todaySnap && (() => {
            try {
              const ritual = resolveTodayRitual({ products, regimenLogs, date: localDateISO() });
              const coverage = resolveCoverageStates({
                routine: { am: ritual.am, pm: ritual.pm },
                concerns: needsToShow,
                preferences: {},
              }, deriveProductJobs);
              if ((coverage.swap?.length || 0) === 0 && (coverage.concernGap?.length || 0) === 0) {
                return null;
              }
              return (
                <RecCardSection coverage={coverage} surface="journal" collapsible />
              );
            } catch (e) {
              return null;
            }
          })()}

          {/* === PHOTO LOG REMOVED (May 29 2026 per Jenni) ===
              Was a swipeable Mon→Sun week strip with day thumbnails +
              Expand→calendar. Redundant with the Sunday Digest hero
              already showing this week's photos at the top of Journal.
              The week-strip surface still lives elsewhere (Timeline
              tab) for users who want to scrub history. */}
          {false && (() => {
            const hasPhotoLocal = (l) => l && (l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:')));
            const tdy = new Date(); tdy.setHours(0,0,0,0);
            const dayIdx = tdy.getDay() === 0 ? 6 : tdy.getDay() - 1; // Mon = 0
            const baseWeekStart = new Date(tdy); baseWeekStart.setDate(tdy.getDate() - dayIdx);
            // Apply offset (in weeks). negative = past, positive = future (gated to 0).
            const weekStart = new Date(baseWeekStart);
            weekStart.setDate(baseWeekStart.getDate() + skinReadsWeekOffset * 7);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            const isCurrentWeek = skinReadsWeekOffset === 0;
            const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); d.setHours(0,0,0,0);
              const iso = localDateISO(d);
              const log = photoLogs.find(l => l.date === iso) || null;
              return {
                iso,
                name: ['M','T','W','T','F','S','S'][i],
                fullName: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
                dateNum: d.getDate(),
                isToday: d.getTime() === tdy.getTime(),
                isFuture: d.getTime() > tdy.getTime(),
                log,
              };
            });
            // Touch-swipe handler — fingers right (negative deltaX) = prev week.
            let touchStartX = null;
            const onTouchStart = (e) => { touchStartX = e.touches[0]?.clientX ?? null; };
            const onTouchEnd = (e) => {
              if (touchStartX == null) return;
              const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
              touchStartX = null;
              if (Math.abs(dx) < 40) return;
              if (dx > 0) setSkinReadsWeekOffset(o => o - 1);          // swipe right → past
              else if (skinReadsWeekOffset < 0) setSkinReadsWeekOffset(o => o + 1); // swipe left → future, but cap at this week
            };
            return (
              <EditorialCard pad="normal">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <Eyebrow>Photo log</Eyebrow>
                    <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>
                      {fmtShort(weekStart)} – {fmtShort(weekEnd)}{isCurrentWeek ? ' · This week' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSkinReadsWeekOffset(o => o - 1)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)]"
                      aria-label="Previous week"
                      style={{color:'var(--ink-soft)'}}
                    >
                      <Icon name="ChevronLeft" size={14} />
                    </button>
                    <button
                      onClick={() => setSkinReadsWeekOffset(o => Math.min(0, o + 1))}
                      disabled={isCurrentWeek}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--cream-deep)] disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Next week"
                      style={{color:'var(--ink-soft)'}}
                    >
                      <Icon name="ChevronRight" size={14} />
                    </button>
                    <button
                      onClick={() => setSkinReadsCalendarOpen(true)}
                      className="ml-1 px-2.5 py-1 text-[9px] tracking-[0.18em] uppercase flex items-center gap-1 transition hover:opacity-70"
                      style={{color:'var(--accent)', border: '1px solid var(--line)'}}
                      aria-label="Open month calendar"
                    >
                      <Icon name="Calendar" size={10} /> Expand
                    </button>
                  </div>
                </div>
                <div
                  className="grid grid-cols-7 gap-1 select-none"
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                >
                  {days.map((d, i) => (
                    <button
                      key={d.iso}
                      onClick={() => d.log && setSkinReadDrawerLogId(d.log.id)}
                      disabled={!d.log}
                      className="flex flex-col items-center gap-1 py-1 transition hover:opacity-80 disabled:cursor-default"
                      aria-label={d.log ? `Open analysis for ${d.fullName} ${d.dateNum}` : `${d.fullName} ${d.dateNum} (no photo)`}
                    >
                      <div className="text-[8.5px] tracking-[0.15em] uppercase" style={{color: d.isToday ? 'var(--accent)' : 'var(--ink-soft)'}}>{d.name}</div>
                      <div
                        className="w-full aspect-square rounded-[6px] overflow-hidden flex items-center justify-center"
                        style={{
                          background: d.log ? 'var(--cream-deep)' : (d.isFuture ? 'transparent' : 'var(--cream)'),
                          border: d.isToday ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                          opacity: d.isFuture ? 0.35 : 1,
                        }}
                      >
                        {d.log ? (
                          <Photo item={d.log} alt="" className="w-full h-full object-cover"
                            renderFallback={() => <span className="font-sans text-[11px]" style={{color:'var(--ink-soft)'}}>{d.log.rating}</span>}
                          />
                        ) : (
                          <span className="text-[10px] font-sans" style={{color:'var(--ink-soft)'}}>{d.dateNum}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="text-[9.5px] mt-2 text-center" style={{color:'var(--ink-soft)'}}>
                  Swipe or use arrows to navigate · tap any day for its analysis
                </div>
              </EditorialCard>
            );
          })()}

          {/* "This week at a glance" card removed (May 29 2026 per Jenni) —
              stats now live as a tight inline row inside the hero
              right-column under View analysis. See WEEK-AT-A-GLANCE
              INLINE block above. */}
        </div>
      );
  })();
};
