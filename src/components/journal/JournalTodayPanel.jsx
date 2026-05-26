// === JournalTodayPanel (Wave 8.2 sub-extract — May 2026) ===
// The `today` mode of JournalView. Mounted by the parent when
// `journalMode === 'today'` and there are logs to render.

const JournalTodayPanel = ({
  logs,
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
          className={`flex items-center justify-center gap-4 text-[11px] ${className}`}
          style={{color:'var(--accent)', fontWeight:600}}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setShowCheckInChooser(true)}
            className="inline-flex items-center gap-1 transition hover:opacity-75"
          >
            <Icon name="Plus" size={11} />
            New entry
          </button>
          <span style={{color:'var(--line)'}}>|</span>
          <button
            type="button"
            onClick={() => setShowPhotoImportQueue && setShowPhotoImportQueue(true)}
            className="inline-flex items-center gap-1 transition hover:opacity-75"
          >
            <Icon name="Upload" size={11} />
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
        // Differentiate between first-ever upload vs. just no upload today.
        // If photoLogs has entries, the user has historic photos but not one
        // for today specifically — prompt them to add today's, surface the
        // most recent prior log as a small reference card.
        const hasHistory = photoLogs.length > 0;
        const lastPrior = photoLogs[0] || null;
        return (
          <EditorialCard className="text-center py-7">
            <div className="flex justify-center mb-3" style={{color:'var(--accent)'}}><Icon name="Camera" size={26} /></div>
            <h3 className="font-serif italic text-[20px] md:text-[22px] leading-[1.1] mb-1.5" style={{color:'var(--ink)'}}>
              {hasHistory ? "Camera shy today?" : 'First photo. Brave move.'}
            </h3>
            <p className="text-[12px] leading-relaxed mb-4" style={{color:'var(--ink-soft)'}}>
              {hasHistory
                ? `Last logged ${new Date(lastPrior.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}. We can’t read what we can’t see.`
                : "Take the first one. The rest get easier."}
            </p>
            <div className="flex justify-center gap-2">
              <EditorialPill onClick={() => setShowCheckInChooser(true)} icon="Plus">Log today's</EditorialPill>
              {hasHistory && (
                <button
                  onClick={() => setSkinReadDrawerLogId(lastPrior.id)}
                  className="px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase italic transition hover:opacity-70"
                  style={{color:'var(--ink-soft)', border:'1px solid var(--line)'}}
                >
                  View last
                </button>
              )}
            </div>
            <div className="mt-4 pt-3 border-t" style={{borderColor:'var(--line)'}}>
              <JournalTodayActions />
            </div>
          </EditorialCard>
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
      // Pull all six metrics directly from the AI snapshot now that
      // Barrier and Sensitivity are scored independently. Falls back
      // to null when a metric is missing (older logs, etc.) — UI
      // always renders an em-dash placeholder rather than NaN.
      const metricsRaw = todaySnap ? (() => {
        const m = (k) => SCORE_MAP[k]?.[titleCase(todaySnap[k])] ?? null;
        return {
          hydration: m('hydration'),
          barrier: m('barrier'),
          redness: m('redness'),
          congestion: m('breakouts'),     // breakouts → "Congestion" (gentler word)
          sensitivity: m('sensitivity'),
        };
      })() : null;

      // Compare to the most recent prior log to derive direction
      // (Improving / Holding / Slipping). Used by both the strip
      // and the "Étude observed" prose — DRY.
      const priorMetricsLog = todaySnap ? photoLogs.find(l =>
        l.id !== todayLog.id && l.metricSnapshot && new Date(l.date) < new Date(todayLog.date)
      ) : null;
      const priorMetricsRaw = priorMetricsLog ? (() => {
        const m = (k) => SCORE_MAP[k]?.[titleCase(priorMetricsLog.metricSnapshot[k])] ?? null;
        return {
          hydration: m('hydration'), barrier: m('barrier'),
          redness: m('redness'), congestion: m('breakouts'),
          sensitivity: m('sensitivity'),
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
        if (key === 'sensitivity')return{ arrow: better ? '↓' : worse ? '↑' : '—', verb: better ? 'Lower' : worse ? 'Reactive' : 'Steady', dir: better ? 'pos' : worse ? 'neg' : 'flat' };
        return { arrow: '—', verb: '—', dir: 'flat' };
      };

      // === ÉTUDE OBSERVED — single editorial paragraph ===
      // Picks the 1-2 metrics that moved most, weaves them into one
      // sentence. Falls back to a softer "first reading" sentence
      // when nothing to compare to yet. Pulls from REAL deltas only.
      const etudeObserved = (() => {
        if (!metricsRaw || !priorMetricsRaw) return null;
        const moves = ['hydration','barrier','redness','congestion','sensitivity']
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
          if (m.key === 'sensitivity')return m.dir === 'pos' ? 'sensitivity calmed' : 'skin read more reactive';
          return '';
        };
        if (moves.length === 1) return `${phrase(moves[0])} this week.`;
        return `${phrase(moves[0])} and ${phrase(moves[1])} this week.`;
      })();

      // === WHAT YOUR SKIN NEEDS — pick 3 mechanism cards ===
      // Derives from the metric profile: low Barrier → Repair, low
      // Hydration → Hydrate, high Sensitivity/Redness → Calm. We
      // always render 3 cards, fallback to the standard trio when
      // nothing is acute. Ingredients are static derm-canon — no
      // AI call needed.
      const NEEDS_CATALOG = {
        repair:  { label: 'Repair',  body: 'Strengthen & support', ingredients: ['Ceramides', 'Cholesterol', 'Fatty Acids'], icon: 'Shield' },
        calm:    { label: 'Calm',    body: 'Soothe & reduce',      ingredients: ['Centella', 'Panthenol', 'Allantoin'],      icon: 'Heart' },
        hydrate: { label: 'Hydrate', body: 'Replenish & support',  ingredients: ['Glycerin', 'Hyaluronic Acid', 'Squalane'], icon: 'Droplet' },
        brighten:{ label: 'Brighten',body: 'Even & clarify',       ingredients: ['Niacinamide', 'Vitamin C', 'Tranexamic'],   icon: 'Sun' },
        clarify: { label: 'Clarify', body: 'Decongest pores',      ingredients: ['Salicylic', 'Niacinamide', 'Azelaic'],      icon: 'Sparkles' },
      };
      const needsToShow = (() => {
        if (!metricsRaw) return ['repair','calm','hydrate'];
        const picks = [];
        if ((metricsRaw.barrier ?? 100) < 70) picks.push('repair');
        if ((metricsRaw.sensitivity ?? 100) < 70 || (metricsRaw.redness ?? 100) < 70) picks.push('calm');
        if ((metricsRaw.hydration ?? 100) < 70) picks.push('hydrate');
        if ((metricsRaw.congestion ?? 100) < 70 && !picks.includes('calm')) picks.push('clarify');
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
        if (!first) return etudeObserved || (subDescriptors.length > 0 ? `Skin reads as ${subDescriptors.map(s => s.toLowerCase()).join(', ')} today.` : null);
        return first.replace(/^[-•\s]+/, '').replace(/\s*\[[A-C]\]\s*$/, '').trim();
      })();

      return (
        <div className="space-y-3 md:space-y-4">
          {/* === HERO — cover-style: small upper-left photo + content right ===
              Mirrors the Cover Skin Snapshot composition. Whole
              block tappable. Multi-photo MAIN selector chip in
              the eyebrow row. Photo stays small (144x144) so
              the score + descriptors + analysis breathe and the
              page doesn't feel photo-heavy.  */}
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
            style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}
            aria-label="Open today's full Skin Read"
          >
            {/* Eyebrow row — date + multi-photo MAIN selector */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[9px] tracking-[0.32em] uppercase" style={{color:'var(--ink-soft)'}}>
                Today, {new Date(todayLog.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              {todayLogs.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-[8.5px] tracking-[0.22em] uppercase italic mr-1" style={{color:'var(--ink-soft)'}}>Main</span>
                  {todayLogs.map(l => {
                    const isMain = l.id === todayLog.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMainPhotoForDate(todayKeyLocal, l.id); }}
                        className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 transition hover:opacity-80"
                        style={{
                          border: isMain ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                          boxShadow: isMain ? '0 0 0 1.5px var(--cream)' : 'none',
                        }}
                        aria-label={`Set ${l.area || 'photo'} as today's main`}
                        title={`${l.area || 'full-face'}${l.daypart ? ' · ' + l.daypart.toUpperCase() : ''}${l.rating != null ? ' · ' + l.rating + '/10' : ''}`}
                      >
                        <Photo item={l} alt="" className="w-full h-full object-cover"
                          renderFallback={() => <div className="w-full h-full flex items-center justify-center text-[8px]" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>{l.rating ?? '·'}</div>}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Photo (upper-left, oval like cover but slightly larger ~160x192) + content right */}
            <div className="flex items-start gap-3.5">
              <div className="flex-shrink-0">
                <div className="rounded-full overflow-hidden" style={{width:'160px', height:'192px', background:'var(--cream)', border:'1px solid var(--line)'}}>
                  <Photo item={todayLog} alt="" className="w-full h-full object-cover"
                    renderFallback={() => (
                      <div className="w-full h-full flex items-center justify-center font-serif italic text-4xl" style={{color:'var(--ink-soft)'}}>{todayLog.rating}</div>
                    )}
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {aiScoreFmt != null ? (
                  <div className="flex items-baseline gap-1.5">
                    <div className="font-serif italic leading-none" style={{color:'var(--ink)', fontSize:'34px'}}>{aiScoreFmt}</div>
                    <div className="font-serif italic leading-none text-[12px]" style={{color:'var(--ink-soft)'}}>/10</div>
                  </div>
                ) : (
                  <div className="font-serif italic" style={{color:'var(--ink-soft)', fontSize:'28px'}}>—</div>
                )}
                {aiDescriptor && (
                  <div className="font-serif italic text-[15px] leading-none mt-1.5" style={{color:'var(--accent)'}}>{aiDescriptor}</div>
                )}
                {subDescriptors.length > 0 && (
                  <div className="text-[11px] italic mt-2 leading-snug" style={{color:'var(--ink)'}}>{subDescriptors.join(' · ')}</div>
                )}
                {aiOneLineNote && (
                  <div className="text-[11px] italic mt-2 leading-snug line-clamp-3" style={{color:'var(--ink-soft)'}}>{aiOneLineNote}</div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t" style={{borderColor:'var(--line)'}}>
              <JournalTodayActions />
            </div>
          </div>

          {/* === METRIC STRIP — mobile-clean ===
              Five metrics, vertical stack per tile so words never
              overlap on a 380px viewport. Each tile:
                row 1: icon (top, centered)
                row 2: shortened label ("Hydra") in tiny tracking
                row 3: arrow + verb (verb dropped on phone if tight)
              Verbs use shortened forms on mobile (Steady not
              Steadying). Color stays sage/rose/ink-soft for direction. */}
          {metricsRaw && (() => {
            // Short verb forms — fit on a 65px-wide tile without wrapping.
            const verbShortFor = (key, dir) => {
              if (key === 'hydration')   return dir === 'pos' ? 'Up' : dir === 'neg' ? 'Down' : 'Steady';
              if (key === 'barrier')     return dir === 'pos' ? 'Steady' : dir === 'neg' ? 'Stress' : 'Hold';
              if (key === 'redness')     return dir === 'pos' ? 'Soft' : dir === 'neg' ? 'Up' : 'Steady';
              if (key === 'congestion')  return dir === 'pos' ? 'Clear' : dir === 'neg' ? 'Up' : 'Steady';
              if (key === 'sensitivity') return dir === 'pos' ? 'Calm' : dir === 'neg' ? 'Up' : 'Steady';
              return '';
            };
            const tiles = [
              { key: 'hydration',  label: 'Hydra',  icon: 'Droplet' },
              { key: 'barrier',    label: 'Barrier',icon: 'Shield' },
              { key: 'redness',    label: 'Redness',icon: 'Flame' },
              { key: 'congestion', label: 'Pores',  icon: 'Circle' },
              { key: 'sensitivity',label: 'Sens.',  icon: 'Activity' },
            ];
            return (
              <div className="rounded-[16px] px-2 py-3 md:px-3" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
                <div className="grid grid-cols-5 gap-0.5 md:gap-2">
                  {tiles.map(t => {
                    const v = metricsRaw[t.key];
                    const direction = verbForMetric(t.key, v, priorMetricsRaw?.[t.key]);
                    const verbColor = direction.dir === 'pos' ? 'var(--sage,#8a9b7e)' : direction.dir === 'neg' ? 'var(--rose,#c9a094)' : 'var(--ink-soft)';
                    const shortVerb = verbShortFor(t.key, direction.dir);
                    return (
                      <div key={t.key} className="flex flex-col items-center text-center min-w-0">
                        <Icon name={t.icon} size={11} style={{color:'var(--ink-soft)'}} />
                        <span className="text-[8.5px] tracking-[0.08em] uppercase mt-1 truncate w-full" style={{color:'var(--ink-soft)'}}>{t.label}</span>
                        <div className="flex items-baseline gap-0.5 mt-1">
                          <span className="text-[10px]" style={{color: verbColor}}>{direction.arrow}</span>
                          <span className="text-[9.5px] italic" style={{color: verbColor}}>{shortVerb}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* === ÉTUDE OBSERVED ===
              Editorial single-paragraph "what changed" treatment.
              Replaces the boxed What Changed delta card. Italic
              serif, sage Sparkles emblem. Honest — only renders
              when there's a real prior reading to compare to. */}
          {etudeObserved && (
            <div className="px-1 md:px-2">
              <div className="flex items-center gap-1.5 mb-1.5" style={{color:'var(--accent)'}}>
                <Icon name="Sparkles" size={11} />
                <span className="text-[10px] tracking-[0.22em] uppercase">Étude observed</span>
              </div>
              <p className="font-serif italic text-[14px] leading-relaxed" style={{color:'var(--ink)'}}>{etudeObserved}</p>
            </div>
          )}

          {/* === ÉTUDE ANALYSIS — inline, no popup ===
              Per Jenni: today's tab should be self-contained, no
              drawer required. Renders the AI analysis bullets
              with the new tagged renderer (Observe / Why / Try
              icons), plus a quiet re-analyze affordance. */}
          {todayLog && (todayLog.aiAnalysis || todayLog.analyzing || (!todaySnap && getApiKey())) && (
            <div className="rounded-[14px] px-4 py-4" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5" style={{color:'var(--accent)'}}>
                  <Icon name="Sparkles" size={11} />
                  <span className="text-[10px] tracking-[0.22em] uppercase">Étude analysis</span>
                </div>
                {todayLog.aiAnalysis && getApiKey() && retryingLogId !== todayLog.id && (
                  <button
                    onClick={() => retryLogAnalysis(todayLog.id)}
                    className="text-[9.5px] tracking-[0.22em] uppercase italic flex items-center gap-1 transition hover:opacity-70"
                    style={{color:'var(--ink-soft)'}}
                  >
                    <Icon name="RefreshCw" size={10} /> Re-read
                  </button>
                )}
              </div>
              {retryingLogId === todayLog.id ? (
                <p className="font-serif italic text-[13px] flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                  <Icon name="Loader2" size={12} className="spin" style={{color:'var(--accent)'}} /> Reading your skin…
                </p>
              ) : todayLog.aiAnalysis ? (
                <TaggedAnalysisBullets
                  text={formatAnalysisText(todayLog.aiAnalysis)}
                  onOpen={setOpenLesson}
                  IconComponent={Icon}
                  withPearlsFn={withPearls}
                />
              ) : !getApiKey() ? (
                <button onClick={() => setShowApiKeyModal(true)} className="text-[11px] tracking-[0.18em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70" style={{color:'var(--accent)'}}>
                  <Icon name="Key" size={11} /> Add API key to read this photo
                </button>
              ) : todayLog.analyzing ? (
                <p className="font-serif italic text-[13px] flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                  <Icon name="Loader2" size={12} className="spin" style={{color:'var(--accent)'}} /> Reading your skin…
                </p>
              ) : (
                <button
                  onClick={() => retryLogAnalysis(todayLog.id)}
                  className="text-[11px] tracking-[0.18em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70"
                  style={{color:'var(--accent)'}}
                >
                  <Icon name="Sparkles" size={11} /> Read this photo
                </button>
              )}
            </div>
          )}

          {/* === TREND CHART — last week, inline ===
              7-day AI rating sparkline shown inline so the user
              doesn't have to open the drawer to see their trend.
              Reuses the same /10 scale as the hero score. */}
          {todaySnap && (() => {
            // Build last7 from logs that have a snapshot. Avg
            // across all 6 metrics (matches hero score math).
            const photoLogsLocal = (logs || []).filter(l => l.metricSnapshot);
            const last7 = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(); d.setDate(d.getDate() - i);
              const iso = localDateISO(d);
              const found = photoLogsLocal.find(l => l.date === iso);
              if (found?.metricSnapshot) {
                const vals = ['redness','hydration','texture','breakouts','barrier','sensitivity']
                  .map(k => SCORE_MAP[k]?.[titleCase(found.metricSnapshot[k])])
                  .filter(v => typeof v === 'number');
                last7.push(vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null);
              } else last7.push(null);
            }
            const validIdx = last7.map((v, i) => v == null ? null : i).filter(i => i != null);
            if (validIdx.length < 2) return null; // Not enough data to chart
            const chartW = 280, chartH = 60;
            const padTop = 8, padBot = 14, padLR = 6;
            const innerW = chartW - padLR * 2;
            const innerH = chartH - padTop - padBot;
            const xAt = (i) => padLR + (i / 6) * innerW;
            const yAt = (v) => padTop + innerH - (v / 100) * innerH;
            const pathPts = last7.map((v, i) => v == null ? null : ({ i, v, x: xAt(i), y: yAt(v) })).filter(Boolean);
            const polyline = pathPts.map(p => `${p.x},${p.y}`).join(' ');
            const firstP = pathPts[0];
            const lastP = pathPts[pathPts.length - 1];
            const dayLabels = last7.map((_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (6 - i));
              return ['S','M','T','W','T','F','S'][d.getDay()];
            });
            return (
              <div className="rounded-[14px] px-4 py-3" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-[10px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)'}}>AI rating · last week</div>
                  <div className="text-[9.5px] italic" style={{color:'var(--ink-soft)'}}>you {todayLog?.rating ?? '·'}/10</div>
                </div>
                <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" style={{display:'block'}}>
                  <line x1={padLR} y1={chartH - padBot} x2={chartW - padLR} y2={chartH - padBot} stroke="var(--line)" strokeWidth="0.6" />
                  {pathPts.length >= 2 && (
                    <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {pathPts.map(p => (
                    <circle key={p.i} cx={p.x} cy={p.y} r={p.i === 6 ? 2.5 : 1.6} fill={p.i === 6 ? 'var(--accent)' : 'var(--ink-soft)'} />
                  ))}
                  {firstP && (
                    <text x={firstP.x} y={firstP.y - 4} fontSize="7" fill="var(--ink-soft)" textAnchor="middle">{(firstP.v / 10).toFixed(1)}</text>
                  )}
                  {lastP && lastP !== firstP && (
                    <text x={lastP.x} y={lastP.y - 4} fontSize="7.5" fontWeight="600" fill="var(--accent)" textAnchor="middle">{(lastP.v / 10).toFixed(1)}</text>
                  )}
                  {dayLabels.map((d, i) => (
                    <text key={i} x={xAt(i)} y={chartH - 3} fontSize="6.5" fill="var(--ink-soft)" textAnchor="middle">{d}</text>
                  ))}
                </svg>
              </div>
            );
          })()}

          {/* === WHAT YOUR SKIN NEEDS — 3 cards ===
              Picked dynamically from the metric profile (low
              barrier → Repair, low hydration → Hydrate, etc.).
              Each card: serif label, short body line, ingredient
              chips. Tap a card → jumps to the matches drawer,
              pre-filtered to that need. */}
          {todaySnap && (
            <div>
              <div className="text-[10px] tracking-[0.22em] uppercase mb-2.5 px-1" style={{color:'var(--ink-soft)'}}>What your skin needs</div>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {needsToShow.map(key => {
                  const need = NEEDS_CATALOG[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setMatchesDrawerFilter(key); setMatchesDrawerOpen(true); }}
                      className="text-left rounded-[14px] px-3 py-3 transition hover:opacity-95 flex flex-col"
                      style={{background:'var(--cream)', border:'1px solid var(--line)'}}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5" style={{color:'var(--accent)'}}>
                        <Icon name={need.icon} size={11} />
                        <span className="font-serif italic text-[14px] leading-none" style={{color:'var(--ink)'}}>{need.label}</span>
                      </div>
                      <div className="text-[10px] italic mb-2 leading-snug" style={{color:'var(--ink-soft)'}}>{need.body}</div>
                      <div className="text-[9.5px] tracking-[0.05em] leading-tight mt-auto" style={{color:'var(--ink)'}}>
                        {need.ingredients.map((ing, i) => (
                          <div key={ing}>{ing}</div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* === SUGGESTED MATCHES LINK === */}
          {todaySnap && (
            <button
              type="button"
              onClick={() => { setMatchesDrawerFilter('all'); setMatchesDrawerOpen(true); }}
              className="w-full text-center py-3 transition hover:opacity-80 flex items-center justify-center gap-2"
              style={{color:'var(--accent)'}}
            >
              <Icon name="Sparkles" size={11} />
              <span className="text-[10.5px] tracking-[0.32em] uppercase italic">Suggested matches</span>
              <Icon name="ChevronRight" size={11} />
            </button>
          )}

          {/* === SWIPEABLE WEEK STRIP ===
              Horizontal Mon→Sun row of the selected week. Arrow buttons
              step the offset; touch swipe also navigates. Each day cell
              shows the photo thumbnail (or empty state) + tappable to
              open the Skin Read drawer for that day. The Expand button
              opens the full-month calendar overlay. */}
          {(() => {
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
                    <div className="text-[11px] italic mt-0.5" style={{color:'var(--ink-soft)'}}>
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
                      className="ml-1 px-2.5 py-1 text-[9px] tracking-[0.18em] uppercase italic flex items-center gap-1 transition hover:opacity-70"
                      style={{color:'var(--accent)', border:'1px solid var(--line)'}}
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
                            renderFallback={() => <span className="font-serif italic text-[11px]" style={{color:'var(--ink-soft)'}}>{d.log.rating}</span>}
                          />
                        ) : (
                          <span className="text-[10px] font-serif italic" style={{color:'var(--ink-soft)'}}>{d.dateNum}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="text-[9.5px] italic mt-2 text-center" style={{color:'var(--ink-soft)'}}>
                  Swipe or use arrows to navigate · tap any day for its analysis
                </div>
              </EditorialCard>
            );
          })()}

          {/* This Week at a Glance — 4 stat tiles per mockup. */}
          <EditorialCard pad="normal">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <Eyebrow>This week at a glance</Eyebrow>
                <div className="text-[11px] italic mt-0.5" style={{color:'var(--ink-soft)'}}>{weekRangeLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Check-\nins', value: checkInDays },
                { label: 'Mornings\nlogged', value: morningCount },
                { label: 'Nights\nlogged', value: nightCount },
                { label: 'Skipped\nday', value: skippedDay },
              ].map((s, i) => (
                <div key={i} className="rounded-[12px] py-3 px-1.5 text-center" style={{background:'var(--cream)', border:'1px solid var(--line)'}}>
                  <div className="font-serif italic text-[28px] md:text-[32px] leading-none" style={{color:'var(--ink)'}}>{s.value}</div>
                  <div className="text-[9.5px] tracking-[0.1em] uppercase mt-1.5 leading-tight whitespace-pre-line" style={{color:'var(--ink-soft)'}}>{s.label}</div>
                </div>
              ))}
            </div>
          </EditorialCard>
        </div>
      );
  })();
};
