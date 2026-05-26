// === PhotoTimeline (Wave 3.3 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props (logs,
// products, procedures, regimenLogs, dailyCoverPick, setActiveTab,
// selectMode, selectedIds, onToggleSelect, onOpenLesson, deleteLog,
// enterCompare, fileToBase64, onAddPriorPhoto, onEditLog).

const PhotoTimeline = ({ logs, products = [], procedures = [], regimenLogs = [], dailyCoverPick = {}, setActiveTab, selectMode = false, selectedIds = [], onToggleSelect, onOpenLesson, deleteLog, enterCompare, fileToBase64, onAddPriorPhoto, onEditLog }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [insightsExpanded, setInsightsExpanded] = useState(false); // Notion-style hover/tap reveal
  // Smart search across notes, AI analysis text, used product names, and used tags.
  const [timelineSearch, setTimelineSearch] = useState('');
  const hasPhoto = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
  const photoLogs = logs.filter(hasPhoto);
  const [filterArea, setFilterArea] = useState('all');
  const [tagFilter, setTagFilter] = useState(null); // null = all; otherwise { kind: 'product'|'tag', value }
  const [yearOverride, setYearOverride] = useState(null); // null = current year; or specific year number
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // Split-half compare state — Before is picker-chosen; After is today's log
  const [splitBeforeId, setSplitBeforeId] = useState(null);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [splitSwapped, setSplitSwapped] = useState(false);
  // Prior-photo upload from inside the picker — file → review (date prompt) → save → set as Before
  const [pickerStage, setPickerStage] = useState('browse'); // 'browse' | 'review'
  const [pendingPhoto, setPendingPhoto] = useState(null); // { base64, date }
  const [savingPrior, setSavingPrior] = useState(false);
  const fileUploadRef = useRef();

  const handlePriorFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !fileToBase64) return;
    const b64 = await fileToBase64(file);
    setPendingPhoto({ base64: b64, date: '' }); // empty date — user picks
    setPickerStage('review');
    e.target.value = ''; // allow re-pick
  };

  const handlePriorSave = async () => {
    if (!pendingPhoto?.base64 || !pendingPhoto?.date || !onAddPriorPhoto) return;
    setSavingPrior(true);
    try {
      const newId = await onAddPriorPhoto(pendingPhoto.base64, pendingPhoto.date);
      setSplitBeforeId(newId);
      setSplitSwapped(false);
      setShowSplitPicker(false);
      setPickerStage('browse');
      setPendingPhoto(null);
    } catch (err) {
      console.error('Prior photo save failed:', err);
    }
    setSavingPrior(false);
  };

  const handlePriorCancel = () => {
    setPickerStage('browse');
    setPendingPhoto(null);
  };

  // Apply both area filter and tag filter
  const matchesTag = (l) => {
    if (!tagFilter) return true;
    if (tagFilter.kind === 'product') return (l.usedProducts || []).includes(tagFilter.value);
    if (tagFilter.kind === 'tag') return (l.usedTags || []).map(t => t.toLowerCase()).includes(String(tagFilter.value).toLowerCase());
    return true;
  };
  // Smart search — matches across notes, AI analysis, used product names, and used tags.
  // Multi-token: 'centella mask' matches logs that contain BOTH 'centella' AND 'mask' anywhere
  // in the searchable surface. Empty query passes everything through.
  const matchesSearch = (l) => {
    const q = (timelineSearch || '').trim().toLowerCase();
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    const productNames = (l.usedProducts || [])
      .map(id => products.find(p => p.id === id))
      .filter(Boolean)
      .map(p => `${p.name || ''} ${p.brand || ''} ${p.activeIngredients || ''} ${(p.tags || []).join(' ')}`)
      .join(' ');
    const haystack = [
      l.notes || '',
      l.aiAnalysis || '',
      l.ratingExplanation || '',
      (l.concerns || []).join(' '),
      (l.usedTags || []).join(' '),
      productNames,
      l.area || '',
    ].join(' ').toLowerCase();
    return tokens.every(t => haystack.includes(t));
  };
  const filteredAll = (filterArea === 'all' ? logs : logs.filter(l => l.area === filterArea))
    .filter(matchesTag)
    .filter(matchesSearch);

  // Date helpers
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ymd = (d) => localDateISO(new Date(d));
  const todayISO = ymd(today);
  const yesterdayISO = ymd(new Date(today.getTime() - 86400000));
  const dayBeforeISO = ymd(new Date(today.getTime() - 2 * 86400000));
  const dayLabel = (d) => {
    const dd = new Date(d); dd.setHours(0,0,0,0);
    const diff = Math.round((today - dd) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff === 2) return 'Day before';
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short' });
  };
  const dateShort = (d) => new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  const dateMed = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Year tab options — distinct years across logs
  const yearsAvailable = [...new Set(logs.map(l => new Date(l.date).getFullYear()))].sort((a, b) => b - a);
  const currentYear = today.getFullYear();
  const viewingYear = yearOverride || currentYear;

  // For each log, derive concern keywords (from log.concerns plus AI-mined keywords from analysis text)
  const KEYWORD_VOCAB = ['redness', 'irritation', 'dryness', 'hydrated', 'glowy', 'breakout', 'blemish', 'blemishes', 'acne', 'oily', 'shiny', 'flaky', 'rough', 'smooth', 'calm', 'inflamed', 'sensitive', 'clear', 'dull', 'dehydrated', 'puffy', 'bright'];
  const keywordsFor = (log) => {
    const tags = new Set();
    (log.concerns || []).forEach(c => tags.add(c.toLowerCase()));
    const text = `${log.aiAnalysis || ''} ${log.ratingExplanation || ''}`.toLowerCase();
    KEYWORD_VOCAB.forEach(kw => { if (text.includes(kw)) tags.add(kw); });
    return [...tags].slice(0, 4);
  };

  // Match procedures to a given date (same day)
  const proceduresOn = (iso) => procedures.filter(p => p.date === iso);

  // Compute post-procedure follow-up checkpoints (1w / 2w / 3w / 4w / then monthly).
  // For each procedure, generate checkpoint dates with their milestone label.
  // Cap monthly follow-ups at 6 months out so we don't pollute the timeline forever.
  const checkpointsFor = (procedure) => {
    const start = new Date(procedure.date);
    const checkpoints = [];
    // weekly markers
    [
      { weeks: 1, label: '1 week post' },
      { weeks: 2, label: '2 weeks post' },
      { weeks: 3, label: '3 weeks post' },
      { weeks: 4, label: '4 weeks post' },
    ].forEach(({ weeks, label }) => {
      const d = new Date(start.getTime() + weeks * 7 * 86400000);
      checkpoints.push({ date: ymd(d), label, procedure, sortDate: d });
    });
    // monthly markers from month 2 through month 6
    for (let m = 2; m <= 6; m++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + m);
      checkpoints.push({ date: ymd(d), label: `${m} months post`, procedure, sortDate: d });
    }
    return checkpoints;
  };
  const allFollowUps = procedures.flatMap(checkpointsFor);
  // Look up follow-up checkpoints landing on a given iso date
  const followUpsOn = (iso) => allFollowUps.filter(f => f.date === iso);

  // Look up the "primary" log for a given date — full-face by default. Same priority as the
  // cover's todayLog so cover and timeline never disagree on what represents a day:
  //   1. dailyCoverPick override for that date (user explicitly elevated a non-full-face).
  //   2. Newest full-face WITH a photo.
  //   3. Newest full-face without a photo (rating-only entry).
  //   4. Newest non-full-face WITH a photo (so the day still surfaces if there's anything visible).
  //   5. Newest entry overall.
  const logsByDate = {};
  filteredAll.forEach(l => {
    if (!logsByDate[l.date]) logsByDate[l.date] = [];
    logsByDate[l.date].push(l);
  });
  const _hasPhotoLocal = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
  const primaryLogForDate = (iso) => {
    const day = logsByDate[iso] || [];
    if (day.length === 0) return null;
    // 1. Honor explicit per-day override if it exists in this date bucket.
    const overrideId = dailyCoverPick?.[iso];
    if (overrideId) {
      const picked = day.find(l => l.id === overrideId);
      if (picked) return picked;
    }
    // 2. Newest full-face WITH a photo wins.
    const fullFaceWithPhoto = day.filter(l => l.area === 'full-face' && _hasPhotoLocal(l)).sort((a, b) => (b.id || 0) - (a.id || 0));
    if (fullFaceWithPhoto.length > 0) return fullFaceWithPhoto[0];
    // 3. Newest full-face without a photo.
    const fullFace = day.filter(l => l.area === 'full-face').sort((a, b) => (b.id || 0) - (a.id || 0));
    if (fullFace.length > 0) return fullFace[0];
    // 4. Newest non-full-face entry with a photo (so days with only T-zone/cheek shots still show).
    const anyWithPhoto = day.filter(_hasPhotoLocal).sort((a, b) => (b.id || 0) - (a.id || 0));
    if (anyWithPhoto.length > 0) return anyWithPhoto[0];
    // 5. Newest entry overall.
    return [...day].sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  };

  const todayLog = primaryLogForDate(todayISO);
  const yesterdayLog = primaryLogForDate(yesterdayISO);
  const dayBeforeLog = primaryLogForDate(dayBeforeISO);

  // Past 7 days
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    weekDays.push({ date: d, iso: ymd(d), log: primaryLogForDate(ymd(d)) });
  }
  const weekRangeLabel = `${dateShort(weekDays[0].date)} – ${dateShort(weekDays[6].date)}`;

  // This month
  const thisMonth = today.getMonth();
  const thisMonthYear = today.getFullYear();
  const thisMonthLogs = filteredAll.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisMonthYear;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
  const thisMonthRangeLabel = (() => {
    const start = new Date(thisMonthYear, thisMonth, 1);
    const end = new Date(thisMonthYear, thisMonth + 1, 0);
    return `${dateShort(start)} – ${dateShort(end)}`;
  })();

  // Prior months in viewingYear (excludes current month if viewing current year)
  const priorMonthsLogs = filteredAll.filter(l => {
    const d = new Date(l.date);
    if (d.getFullYear() !== viewingYear) return false;
    if (viewingYear === currentYear && d.getMonth() === thisMonth) return false;
    return true;
  });
  const priorByMonth = {};
  priorMonthsLogs.forEach(l => {
    const d = new Date(l.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    if (!priorByMonth[key]) priorByMonth[key] = { label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), entries: [] };
    priorByMonth[key].entries.push(l);
  });
  const priorMonthsSorted = Object.entries(priorByMonth).sort((a, b) => b[0].localeCompare(a[0]));

  const areas = ['all', ...new Set(photoLogs.map(l => l.area))];

  // Compute distinct used products and tags across logs for the filter row
  const distinctProducts = [...new Set(logs.flatMap(l => l.usedProducts || []))]
    .map(id => products.find(p => p.id === id)).filter(Boolean);
  const distinctTags = [...new Set(logs.flatMap(l => l.usedTags || []))];

  // Product-start events removed from timeline. Product initiation is tracked elsewhere
  // (Insights panel, Shelf detail). See task #211 + the brainstorm for next-gen integration.
  const recentProductEvents = [];

  // The Before photo for the today split-compare. After is always today's log.
  const splitBefore = splitBeforeId ? logs.find(l => l.id === splitBeforeId) : null;

  const renderHeroLog = (log) => {
    if (!log) return null;
    const procs = proceduresOn(log.date);
    const followUps = followUpsOn(log.date);
    const isSelected = selectedIds.includes(log.id);
    const kws = keywordsFor(log);
    return (
      <button onClick={() => selectMode ? onToggleSelect?.(log.id) : setSelectedPhoto(log)} className="block w-full text-left group transition" style={{
        outline: isSelected ? '3px solid var(--ink)' : 'none',
        outlineOffset: '-3px'
      }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          <div className="md:col-span-3 relative aspect-[4/3] overflow-hidden">
            <Photo item={log} alt="" className="w-full h-full object-cover transition group-hover:scale-[1.02]"
              renderFallback={() => (
                <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                  <span className="font-serif italic text-[120px] leading-none" style={{color:'var(--ink-soft)'}}>{log.rating}</span>
                </div>
              )}
            />
            {selectMode && (
              <div className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center" style={{
                background: isSelected ? 'var(--ink)' : 'rgba(245,240,232,0.95)',
                color: isSelected ? 'var(--cream)' : 'var(--ink-soft)',
                border: '1px solid ' + (isSelected ? 'var(--ink)' : 'var(--line)')
              }}>
                {isSelected && <Icon name="Check" size={14} />}
              </div>
            )}
          </div>
          <div className="md:col-span-2 space-y-3">
            <div className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>{log.area.replace(/-/g, ' ')}</div>
            <div className="font-serif text-6xl italic leading-none" style={{color:'var(--ink)'}}>{log.rating}<span className="text-2xl" style={{color:'var(--ink-soft)'}}>/10</span></div>
            {kws.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2">
                {kws.map(k => <span key={k} className="font-serif italic text-lg" style={{color:'var(--ink)'}}>{k}</span>)}
              </div>
            )}
            {procs.length > 0 && (
              <div className="pt-3 border-t" style={{borderColor:'var(--line)'}}>
                <div className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{color:'var(--ink-soft)'}}>Procedure</div>
                {procs.map(p => <div key={p.id} className="font-serif italic text-base" style={{color:'var(--ink)'}}>{p.name} <span className="text-xs not-italic" style={{color:'var(--ink-soft)'}}>· {p.type?.replace(/-/g, ' ')}</span></div>)}
              </div>
            )}
            {followUps.length > 0 && (
              <div className="pt-3 border-t" style={{borderColor:'var(--line)'}}>
                <div className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{color:'var(--accent)'}}>Follow-up</div>
                {followUps.map((f, i) => <div key={i} className="font-serif italic text-sm" style={{color:'var(--ink)'}}>{f.label} <span className="text-xs not-italic" style={{color:'var(--ink-soft)'}}>· {f.procedure.name}</span></div>)}
              </div>
            )}
            {log.notes && <p className="text-sm font-light italic leading-relaxed pt-2" style={{color:'var(--ink-soft)'}}>"{log.notes}"</p>}
          </div>
        </div>
      </button>
    );
  };

  const renderCompactLog = (log, opts = {}) => {
    if (!log) return null;
    const isSelected = selectedIds.includes(log.id);
    const kws = keywordsFor(log).slice(0, 3);
    const procs = proceduresOn(log.date);
    return (
      <button onClick={() => selectMode ? onToggleSelect?.(log.id) : setSelectedPhoto(log)} className="block w-full text-left group transition" style={{
        outline: isSelected ? '3px solid var(--ink)' : 'none',
        outlineOffset: '-3px'
      }}>
        <div className="relative aspect-[4/5] overflow-hidden">
          <Photo item={log} alt="" className="w-full h-full object-cover transition group-hover:scale-[1.02]"
            renderFallback={() => (
              <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                <span className="font-serif italic text-7xl" style={{color:'var(--ink-soft)'}}>{log.rating}</span>
              </div>
            )}
          />
          {selectMode && (
            <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center" style={{
              background: isSelected ? 'var(--ink)' : 'rgba(245,240,232,0.95)',
              color: isSelected ? 'var(--cream)' : 'var(--ink-soft)',
              border: '1px solid ' + (isSelected ? 'var(--ink)' : 'var(--line)')
            }}>
              {isSelected && <Icon name="Check" size={12} />}
            </div>
          )}
        </div>
        <div className="mt-3">
          {opts.label && <div className="text-[9px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>{opts.label}</div>}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-3xl italic leading-none" style={{color:'var(--ink)'}}>{log.rating}<span className="text-xs" style={{color:'var(--ink-soft)'}}>/10</span></span>
          </div>
          {kws.length > 0 && (
            <div className="text-sm font-light italic mt-1.5" style={{color:'var(--ink-soft)'}}>{kws.join(' · ')}</div>
          )}
          {procs.length > 0 && (
            <div className="text-[10px] tracking-[0.2em] uppercase mt-1.5" style={{color:'var(--ink)'}}>+ {procs[0].name}</div>
          )}
          {(() => {
            const fus = followUpsOn(log.date);
            return fus.length > 0 ? (
              <div className="text-[9px] tracking-[0.25em] uppercase italic mt-1" style={{color:'var(--accent)'}}>{fus[0].label} · {fus[0].procedure.name}</div>
            ) : null;
          })()}
        </div>
      </button>
    );
  };

  return (
    <div>
      {/* Year tabs (only when there's data across years) */}
      {yearsAvailable.length > 1 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>Year</span>
          {yearsAvailable.map(y => (
            <button key={y} onClick={() => setYearOverride(y === currentYear ? null : y)} className="text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 transition" style={{
              background: viewingYear === y ? 'var(--ink)' : 'transparent',
              color: viewingYear === y ? 'var(--cream)' : 'var(--ink-soft)',
              border: '1px solid ' + (viewingYear === y ? 'var(--ink)' : 'var(--line)')
            }}>{y}</button>
          ))}
        </div>
      )}

      {/* Smart search — matches notes, AI analysis text, used product names, and tags.
          Multi-token: typing 'centella mask' filters to logs that contain both terms anywhere
          in the searchable surface. */}
      <div className="mb-3">
        <div className="relative">
          <Icon name="Search" size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--ink-soft)'}} />
          <input autoCapitalize="off" autoCorrect="off" spellCheck={false}
            type="text"
            value={timelineSearch}
            onChange={e => setTimelineSearch(e.target.value)}
            placeholder="Search photos by note, product, tag, concern…"
            className="w-full pl-8 pr-8 py-2 border bg-transparent text-[11px] md:text-[12px] font-light focus:outline-none transition"
            style={{
              borderColor: timelineSearch ? 'var(--accent)' : 'var(--line)',
              color: 'var(--ink)',
            }}
          />
          {timelineSearch && (
            <button
              type="button"
              onClick={() => setTimelineSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:opacity-70"
              style={{color:'var(--ink-soft)'}}
              aria-label="Clear search"
            >
              <Icon name="X" size={11} />
            </button>
          )}
        </div>
        {timelineSearch && (
          <div className="text-[10px] font-light italic mt-1.5 leading-snug" style={{color:'var(--ink-soft)'}}>
            {filteredAll.length === 0
              ? <>No photos match <span style={{color:'var(--accent)'}}>{timelineSearch}</span>.</>
              : <>{filteredAll.length} {filteredAll.length === 1 ? 'photo' : 'photos'} matching <span style={{color:'var(--accent)'}}>{timelineSearch}</span>.</>
            }
          </div>
        )}
      </div>

      {/* Area filter */}
      {/* === FILTERS: Area, Products, Tags === */}
      <div className="flex flex-col gap-3 mb-8 md:mb-10">
        <div className="flex gap-2 flex-wrap">
          {areas.map(a => (
            <button key={a} onClick={() => setFilterArea(a)} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border transition" style={{
              background: filterArea === a ? 'var(--ink)' : 'transparent',
              color: filterArea === a ? 'var(--cream)' : 'var(--ink-soft)',
              borderColor: filterArea === a ? 'var(--ink)' : 'var(--line)'
            }}>{a === 'all' ? 'All Areas' : a.replace(/-/g, ' ')}</button>
          ))}
        </div>
        {(distinctProducts.length > 0 || distinctTags.length > 0) ? (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[9px] tracking-[0.25em] uppercase mr-1" style={{color:'var(--ink-soft)'}}>Filter by</span>
            <button onClick={() => setTagFilter(null)} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border transition" style={{
              background: !tagFilter ? 'var(--ink)' : 'transparent',
              color: !tagFilter ? 'var(--cream)' : 'var(--ink-soft)',
              borderColor: !tagFilter ? 'var(--ink)' : 'var(--line)'
            }}>All</button>
            {distinctProducts.map(p => {
              const active = tagFilter?.kind === 'product' && tagFilter?.value === p.id;
              return (
                <button key={`p-${p.id}`} onClick={() => setTagFilter(active ? null : { kind: 'product', value: p.id })} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border transition flex items-center gap-1" style={{
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--cream)' : 'var(--ink-soft)',
                  borderColor: active ? 'var(--ink)' : 'var(--line)'
                }}><Icon name="Package" size={10} />{p.name}</button>
              );
            })}
            {distinctTags.map(t => {
              const active = tagFilter?.kind === 'tag' && tagFilter?.value === t;
              return (
                <button key={`t-${t}`} onClick={() => setTagFilter(active ? null : { kind: 'tag', value: t })} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border transition" style={{
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--cream)' : 'var(--ink-soft)',
                  borderColor: active ? 'var(--ink)' : 'var(--line)'
                }}>#{t}</button>
              );
            })}
          </div>
        ) : (
          // No tags or products yet — show illustrative examples to prompt the user
          <div className="flex gap-2 flex-wrap items-center" title="When you log photos, tag them with the products you used. Tags appear here for filtering.">
            <span className="text-[9px] tracking-[0.25em] uppercase mr-1" style={{color:'var(--ink-soft)'}}>Tags · examples</span>
            {['SK-II', 'tretinoin', 'biodance mask', "kiehl's overnight cream"].map(ex => (
              <span key={ex} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 italic" style={{borderStyle:'dashed', borderWidth:'1px', borderColor:'var(--line)', color:'var(--ink-soft)', opacity:0.55}}>#{ex}</span>
            ))}
            <span className="text-[10px] font-light italic ml-1" style={{color:'var(--ink-soft)'}}>— add tags when logging photos to filter your timeline by them.</span>
          </div>
        )}
      </div>

      {logs.length === 0 ? (
        <EmptyState icon="Image" text="Your timeline awaits its first entry." />
      ) : (
        <>
          {/* === INSIGHTS — product↔outcome associations from logs + regimen check-ins === */}
          {(() => {
            // Window: when did the user use a product? Inputs from two sources:
            //   1. logs[i].usedProducts — products tagged on a skin log
            //   2. regimenLogs[i].amProducts/pmProducts — products checked off in daily check-in
            // For each (productId, useDate), look at logs in the next 1-5 days and score:
            //   - rating delta vs the user's overall mean rating
            //   - presence of negative keywords (redness/irritation/sensitivity/breakout)
            //   - presence of positive keywords (glow/bright/clear/calm/even)
            // A product earns an insight only with ≥2 evidence points and a clear majority direction.
            const NEG_RE = /(redness|irritat|stinging|burning|reactive|inflam|broke\s*out|breakout|blemish|acne|dry|flak|tight|sensit)/i;
            const POS_RE = /(glow|bright|clear|smooth|hydrate|even|radian|luminou|dewy|calm)/i;
            // 1. Build use map: productId → set of YYYY-MM-DD use dates
            const useMap = new Map();
            const addUse = (id, date) => {
              if (!id || !date) return;
              if (!useMap.has(id)) useMap.set(id, new Set());
              useMap.get(id).add(date);
            };
            (logs || []).forEach(l => (l.usedProducts || []).forEach(id => addUse(id, l.date)));
            (regimenLogs || []).forEach(r => {
              [...(r.amProducts || []), ...(r.pmProducts || [])].forEach(id => addUse(id, r.date));
            });
            if (useMap.size === 0) return null;
            // 2. Pre-compute mean rating across all rated logs for delta comparison.
            const ratedLogs = logs.filter(l => Number(l.rating));
            if (ratedLogs.length < 3) return null;
            const meanRating = ratedLogs.reduce((s, l) => s + Number(l.rating), 0) / ratedLogs.length;
            // 3. For each used product with ≥2 use dates, score outcomes 1-5 days after.
            const associations = [];
            useMap.forEach((dateSet, productId) => {
              const product = products.find(p => p.id === productId);
              if (!product) return;
              const useDates = [...dateSet].sort();
              if (useDates.length < 2) return;
              let neg = 0, pos = 0, evidenceCount = 0;
              const exemplars = []; // sample dates for the tooltip
              useDates.forEach(useDate => {
                const useMs = new Date(useDate).getTime();
                const winStart = useMs + 86400000; // next day
                const winEnd = useMs + 5 * 86400000; // up to 5 days after
                const followLogs = logs.filter(l => {
                  const ms = new Date(l.date).getTime();
                  return ms >= winStart && ms <= winEnd;
                });
                if (followLogs.length === 0) return;
                evidenceCount++;
                followLogs.forEach(l => {
                  const text = `${l.aiAnalysis || ''} ${l.ratingExplanation || ''} ${(l.concerns || []).join(' ')}`;
                  const hasNeg = NEG_RE.test(text);
                  const hasPos = POS_RE.test(text);
                  const r = Number(l.rating);
                  // Rating delta vs mean: ≥0.7 above = positive, ≤0.7 below = negative.
                  const ratingPos = r && r >= meanRating + 0.7;
                  const ratingNeg = r && r <= meanRating - 0.7;
                  if (hasNeg || ratingNeg) { neg++; exemplars.push({ date: l.date, dir: 'neg', rating: r }); }
                  if (hasPos || ratingPos) { pos++; exemplars.push({ date: l.date, dir: 'pos', rating: r }); }
                });
              });
              if (evidenceCount < 2) return;
              // Need a clear majority — at least 2 net votes in one direction.
              const net = pos - neg;
              if (Math.abs(net) < 2) return;
              associations.push({
                product,
                direction: net > 0 ? 'positive' : 'negative',
                pos, neg, evidenceCount,
                strength: Math.abs(net),
                exemplars: exemplars.slice(0, 3),
              });
            });
            associations.sort((a, b) => b.strength - a.strength);

            // === NEWLY STARTED PRODUCTS — first 14 days, paired with current trend ===
            // For each product whose startDate falls in the past 14 days, look at logs
            // SINCE the start and compare against logs PRIOR. If keywords or rating
            // shifted, surface a directional flag. Otherwise show a "watching" reassurance.
            const nowMs = Date.now();
            const TWO_WEEKS = 14 * 86400000;
            const newlyStarted = (products || [])
              .filter(p => p.startDate && (nowMs - new Date(p.startDate).getTime()) <= TWO_WEEKS && (nowMs - new Date(p.startDate).getTime()) >= 0)
              .map(p => {
                const startMs = new Date(p.startDate).getTime();
                const daysSince = Math.max(1, Math.floor((nowMs - startMs) / 86400000));
                const sinceLogs = logs.filter(l => new Date(l.date).getTime() >= startMs);
                // Look back the same window length so we compare like-with-like.
                const priorWindow = TWO_WEEKS;
                const priorLogs = logs.filter(l => {
                  const ms = new Date(l.date).getTime();
                  return ms < startMs && ms >= startMs - priorWindow;
                });
                const negSince = sinceLogs.filter(l => NEG_RE.test(`${l.aiAnalysis || ''} ${l.ratingExplanation || ''} ${(l.concerns || []).join(' ')}`)).length;
                const posSince = sinceLogs.filter(l => POS_RE.test(`${l.aiAnalysis || ''} ${l.ratingExplanation || ''} ${(l.concerns || []).join(' ')}`)).length;
                const negPrior = priorLogs.filter(l => NEG_RE.test(`${l.aiAnalysis || ''} ${l.ratingExplanation || ''} ${(l.concerns || []).join(' ')}`)).length;
                const posPrior = priorLogs.filter(l => POS_RE.test(`${l.aiAnalysis || ''} ${l.ratingExplanation || ''} ${(l.concerns || []).join(' ')}`)).length;
                const ratingSince = sinceLogs.filter(l => Number(l.rating)).reduce((s, l) => s + Number(l.rating), 0) / Math.max(1, sinceLogs.filter(l => Number(l.rating)).length);
                const ratingPrior = priorLogs.filter(l => Number(l.rating)).reduce((s, l) => s + Number(l.rating), 0) / Math.max(1, priorLogs.filter(l => Number(l.rating)).length);
                const hasRatingShift = ratingSince && ratingPrior && Math.abs(ratingSince - ratingPrior) >= 0.7;
                const hasNegShift = sinceLogs.length >= 2 && (negSince - negPrior) >= 2;
                const hasPosShift = sinceLogs.length >= 2 && ((posSince - posPrior) >= 2 || (ratingSince > ratingPrior + 0.7));
                let direction = 'watching';
                let note = '';
                if (hasNegShift || (hasRatingShift && ratingSince < ratingPrior)) {
                  direction = 'negative';
                  note = 'flags up — early reaction to watch';
                } else if (hasPosShift || (hasRatingShift && ratingSince > ratingPrior)) {
                  direction = 'positive';
                  note = 'looking better — keep going';
                } else if (sinceLogs.length < 2) {
                  direction = 'watching';
                  note = 'too early to tell — log a photo';
                } else {
                  direction = 'neutral';
                  note = 'no shift yet — settling in';
                }
                return { product: p, daysSince, direction, note };
              })
              .sort((a, b) => a.daysSince - b.daysSince);

            if (associations.length === 0 && newlyStarted.length === 0) return null;
            // Cap at 3 total: prefer Newly Started first, fill remainder with associations.
            const cap = 3;
            const newlyTopped = newlyStarted.slice(0, cap);
            const assocTopped = associations.slice(0, Math.max(0, cap - newlyTopped.length));
            const totalCount = newlyTopped.length + assocTopped.length;
            // Floating button bottom-right of the timeline. Tap pops a panel with up to 3 insights.
            // Stays out of the way until the user wants them.
            return (
              <>
                {/* Floating trigger pill */}
                <button
                  type="button"
                  onClick={() => setInsightsExpanded(v => !v)}
                  className="fixed bottom-40 right-4 md:bottom-24 md:right-8 z-30 px-3 py-2 rounded-full shadow-md flex items-center gap-1.5 transition hover:scale-105"
                  style={{background:'var(--ink)', color:'var(--cream)'}}
                  title="View insights"
                  aria-label="View insights"
                >
                  <Icon name="Sparkles" size={12} />
                  <span className="text-[10px] tracking-[0.2em] uppercase">Insights</span>
                  <span className="font-serif italic text-[10px] normal-case tracking-normal opacity-80">· {totalCount}</span>
                </button>
                {/* Panel — overlays the page when expanded */}
                {insightsExpanded && (
                  <div
                    className="fixed inset-0 z-30 flex items-end md:items-center md:justify-end"
                    style={{background:'rgba(28,25,23,0.4)', backdropFilter:'blur(2px)'}}
                    onClick={() => setInsightsExpanded(false)}
                  >
                    <div
                      onClick={e => e.stopPropagation()}
                      className="w-full md:w-96 md:m-8 rounded-t-2xl md:rounded-lg shadow-xl"
                      style={{background:'var(--cream)'}}
                    >
                      <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:'var(--line)'}}>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
                          <span className="text-[10px] tracking-[0.3em] uppercase" style={{color:'var(--ink-soft)'}}>Insights</span>
                          <span className="font-serif italic text-[10px] normal-case tracking-normal" style={{color:'var(--ink-soft)'}}>· top {totalCount}</span>
                        </div>
                        <button onClick={() => setInsightsExpanded(false)} className="p-1" style={{color:'var(--ink-soft)'}} aria-label="Close insights">
                          <Icon name="X" size={14} />
                        </button>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {newlyTopped.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[8px] tracking-[0.25em] uppercase" style={{color:'var(--ink-soft)'}}>Newly started</div>
                            {newlyTopped.map(n => {
                              const colorMap = {
                                positive: 'var(--sage)',
                                negative: 'var(--rose)',
                                watching: 'var(--accent)',
                                neutral: 'var(--ink-soft)',
                              };
                              const signMap = { positive: '↑', negative: '↓', watching: '·', neutral: '·' };
                              return (
                                <div key={n.product.id} className="flex items-baseline gap-2 leading-snug">
                                  <span className="not-italic text-[14px] flex-shrink-0" style={{color: colorMap[n.direction]}}>{signMap[n.direction]}</span>
                                  <span className="font-serif italic text-[12px] md:text-sm" style={{color:'var(--ink)'}}>Day {n.daysSince} on {n.product.name}</span>
                                  <span className="text-[10px] font-light italic flex-1 min-w-0" style={{color:'var(--ink-soft)'}}>
                                    — {n.note}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {assocTopped.length > 0 && (
                          <div className="space-y-1">
                            {newlyTopped.length > 0 && (
                              <div className="text-[8px] tracking-[0.25em] uppercase pt-1" style={{color:'var(--ink-soft)'}}>Patterns over time</div>
                            )}
                            {assocTopped.map(a => {
                              const sign = a.direction === 'positive' ? '↑' : '↓';
                              const color = a.direction === 'positive' ? 'var(--sage)' : 'var(--rose)';
                              const verb = a.direction === 'positive'
                                ? 'often followed by improvement'
                                : 'often followed by flare';
                              return (
                                <div key={a.product.id} className="flex items-baseline gap-2 leading-snug">
                                  <span className="not-italic text-[14px] flex-shrink-0" style={{color}}>{sign}</span>
                                  <span className="font-serif italic text-[12px] md:text-sm" style={{color:'var(--ink)'}}>{a.product.name}</span>
                                  <span className="text-[10px] font-light italic flex-1 min-w-0" style={{color:'var(--ink-soft)'}}>
                                    — {verb} <span style={{color:'var(--ink-soft)', opacity: 0.65}}>· {a.evidenceCount} {a.evidenceCount === 1 ? 'use' : 'uses'}</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-[9px] italic pt-1.5 border-t" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>
                          Correlation, not causation. Watch for the same signal twice before changing your routine.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* === TODAY (smaller hero + dotted compare slot for split-half) === */}
          {viewingYear === currentYear && (
            <div className="mb-12">
              <div className="flex items-baseline justify-between border-b pb-3 mb-5" style={{borderColor:'var(--line)'}}>
                <div>
                  <div className="text-[9px] md:text-[10px] tracking-[0.4em] uppercase flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
                    Today
                  </div>
                  <h2 className="font-serif text-2xl md:text-3xl italic mt-1" style={{color:'var(--ink)'}}>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                </div>
              </div>
              {todayLog ? (
                splitBefore ? (
                  // Split-half compare mode — Before is picked, After is today's log
                  <div className="space-y-3 max-w-sm">
                    <SplitHalfCompare
                      before={splitSwapped ? todayLog : splitBefore}
                      after={splitSwapped ? splitBefore : todayLog}
                      onSwap={() => setSplitSwapped(s => !s)}
                      onClear={() => { setSplitBeforeId(null); setSplitSwapped(false); }}
                    />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <button onClick={() => setSelectedPhoto(todayLog)} className="text-[10px] tracking-[0.2em] uppercase italic" style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)'}}>See today's analysis</button>
                      <button onClick={() => enterCompare?.(splitBefore.id, todayLog.id)} className="text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1" style={{color:'var(--ink)'}}>Open full compare <Icon name="ArrowRight" size={11} /></button>
                    </div>
                  </div>
                ) : (
                  // Normal today: photo + dotted compare slot — capped to a compact row for mobile
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button onClick={() => setSelectedPhoto(todayLog)} className="relative aspect-square overflow-hidden text-left">
                      <Photo item={todayLog} alt="" className="w-full h-full object-cover transition hover:scale-[1.02]"
                        renderFallback={() => (
                          <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                            <span className="font-serif italic text-5xl" style={{color:'var(--ink-soft)'}}>{todayLog.rating}</span>
                          </div>
                        )}
                      />
                      <div className="absolute inset-x-0 bottom-0 p-1.5" style={{background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'}}>
                        <div className="text-white text-[8px] tracking-[0.2em] uppercase">Today</div>
                        <div className="text-white font-serif italic text-lg leading-none">{todayLog.rating}<span className="text-[10px] opacity-70">/10</span></div>
                      </div>
                    </button>
                    <button onClick={() => setShowSplitPicker(true)} className="relative aspect-square flex flex-col items-center justify-center text-center px-2 transition hover:bg-[var(--cream-deep)]" style={{border:'2px dashed var(--line)', background:'transparent'}}>
                      <Icon name="Plus" size={14} className="opacity-50 mb-1" />
                      <div className="text-[9px] tracking-[0.2em] uppercase leading-tight" style={{color:'var(--ink-soft)'}}>Tap to compare</div>
                      <div className="text-[9px] font-light italic mt-1 leading-tight" style={{color:'var(--ink-soft)'}}>Pick a photo for half-face before/after.</div>
                    </button>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <div className="aspect-square flex flex-col items-center justify-center" style={{background:'var(--cream-deep)', border:'1px dashed var(--line)'}}>
                    <span className="font-serif italic text-sm" style={{color:'var(--ink-soft)'}}>Not logged yet.</span>
                  </div>
                  <button onClick={() => setShowSplitPicker(true)} className="relative aspect-square flex flex-col items-center justify-center text-center px-2 transition hover:bg-[var(--cream-deep)]" style={{border:'2px dashed var(--line)'}}>
                    <Icon name="Plus" size={14} className="opacity-50 mb-1" />
                    <div className="text-[9px] tracking-[0.2em] uppercase leading-tight" style={{color:'var(--ink-soft)'}}>Compare two days</div>
                    <div className="text-[9px] font-light italic mt-1 leading-tight" style={{color:'var(--ink-soft)'}}>Pick two photos.</div>
                  </button>
                </div>
              )}
              {todayLog && (todayLog.usedProducts?.length > 0 || todayLog.usedTags?.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(todayLog.usedProducts || []).map(id => {
                    const p = products.find(pp => pp.id === id);
                    if (!p) return null;
                    return <span key={id} className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 border" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>{p.name}</span>;
                  })}
                  {(todayLog.usedTags || []).map(t => (
                    <span key={t} className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 border" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>#{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === THIS WEEK === */}
          {viewingYear === currentYear && (
            <div className="mb-16">
              <div className="flex items-baseline justify-between border-b pb-3 mb-6" style={{borderColor:'var(--line)'}}>
                <div>
                  <div className="text-[10px] tracking-[0.4em] uppercase" style={{color:'var(--ink-soft)'}}>This week</div>
                  <h2 className="font-serif text-3xl italic mt-1" style={{color:'var(--ink)'}}>{weekRangeLabel}</h2>
                </div>
                <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{weekDays.filter(w => w.log).length} of 7 logged</div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(({ date, iso, log }) => {
                  const isSelected = log && selectedIds.includes(log.id);
                  const procs = proceduresOn(iso);
                  const fus = followUpsOn(iso);
                  if (log) {
                    return (
                      <button key={iso} onClick={() => selectMode ? onToggleSelect?.(log.id) : setSelectedPhoto(log)} className="relative group aspect-square overflow-hidden transition" style={{
                        outline: isSelected ? '3px solid var(--ink)' : 'none',
                        outlineOffset: '-3px'
                      }}>
                        <Photo item={log} alt="" className="w-full h-full object-cover transition group-hover:scale-105" />
                        <div className="absolute inset-0 flex flex-col justify-end p-2" style={{background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent 50%)'}}>
                          <div className="text-white text-[9px] tracking-[0.15em] uppercase font-medium">{dayLabel(date)} · {dateShort(date)}</div>
                          <div className="text-white font-serif italic text-base leading-none">{log.rating}<span className="text-[9px] opacity-70">/10</span></div>
                        </div>
                        {procs.length > 0 && (
                          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-sm" style={{background:'rgba(245,240,232,0.95)'}}>
                            <Icon name="Activity" size={10} />
                          </div>
                        )}
                        {fus.length > 0 && procs.length === 0 && (
                          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{background:'var(--accent)'}} title={`${fus[0].label} — ${fus[0].procedure.name}`}></div>
                        )}
                        {selectMode && (
                          <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{
                            background: isSelected ? 'var(--ink)' : 'rgba(245,240,232,0.95)',
                            color: isSelected ? 'var(--cream)' : 'var(--ink-soft)',
                            border: '1px solid ' + (isSelected ? 'var(--ink)' : 'var(--line)')
                          }}>
                            {isSelected && <Icon name="Check" size={12} />}
                          </div>
                        )}
                      </button>
                    );
                  }
                  return (
                    <div key={iso} className="relative aspect-square flex flex-col items-center justify-center" style={{background:'var(--cream-deep)', border:'1px dashed var(--line)'}}>
                      <div className="text-[9px] tracking-[0.15em] uppercase" style={{color:'var(--ink-soft)'}}>{dayLabel(date)}</div>
                      <div className="text-[8px] tracking-wider" style={{color:'var(--ink-soft)', opacity:0.7}}>{dateShort(date)}</div>
                      {fus.length > 0 && (
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{background:'var(--accent)'}} title={`${fus[0].label} — ${fus[0].procedure.name}`}></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Product starts + procedures + follow-up checkpoints within the past 7 / next 7 days, mixed chronologically */}
              {(() => {
                const sevenAgo = new Date(today.getTime() - 6 * 86400000);
                const sevenAhead = new Date(today.getTime() + 7 * 86400000);
                const productEvents = recentProductEvents.filter(e => new Date(e.date) >= sevenAgo).map(e => ({ ...e, sortDate: new Date(e.date) }));
                const procedureEvents = procedures.filter(p => {
                  const pd = new Date(p.date);
                  return pd >= sevenAgo && pd <= today;
                }).map(p => ({ kind: 'procedure', date: p.date, procedure: p, key: `proc-${p.id}`, sortDate: new Date(p.date) }));
                // Follow-up checkpoints landing in the past 7 days OR upcoming 7 days
                const followUpEvents = allFollowUps.filter(f => f.sortDate >= sevenAgo && f.sortDate <= sevenAhead).map(f => ({
                  kind: 'follow-up', date: f.date, label: f.label, procedure: f.procedure, key: `fu-${f.procedure.id}-${f.date}`, sortDate: f.sortDate
                }));
                const events = [...productEvents, ...procedureEvents, ...followUpEvents].sort((a, b) => b.sortDate - a.sortDate);
                if (events.length === 0) return null;
                return (
                  <div className="mt-5 space-y-2">
                    {events.map(e => {
                      if (e.kind === 'procedure') {
                        return (
                          <button key={e.key} onClick={() => { setActiveTab('journal'); setTimeout(() => { try { window.dispatchEvent(new CustomEvent('etude:journal-view', { detail: 'procedures' })); } catch (_) {} }, 0); }} className="w-full flex items-center gap-3 p-3 border text-left transition hover:opacity-90" style={{borderColor:'var(--line)', background:'var(--cream-deep)'}}>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:'var(--rose)'}}></div>
                            <div className="text-[9px] tracking-[0.25em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)'}}>{dayLabel(new Date(e.date))} · {dateShort(new Date(e.date))}</div>
                            <div className="text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 border flex-shrink-0" style={{borderColor:'var(--rose)', color:'var(--rose)'}}>Procedure</div>
                            <div className="font-serif italic text-sm md:text-base flex-1 min-w-0 truncate" style={{color:'var(--ink)'}}>{e.procedure.name} <span className="text-xs not-italic" style={{color:'var(--ink-soft)'}}>· {e.procedure.type?.replace(/-/g, ' ')}</span></div>
                          </button>
                        );
                      }
                      if (e.kind === 'follow-up') {
                        const isToday = e.date === todayISO;
                        const isPast = e.sortDate < today;
                        return (
                          <div key={e.key} className="flex items-center gap-3 p-3 border" style={{borderColor:'var(--line)', background:'var(--cream)', opacity: isPast ? 0.7 : 1}}>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:'var(--accent)'}}></div>
                            <div className="text-[9px] tracking-[0.25em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)'}}>{isToday ? 'Today' : dateShort(e.sortDate)}</div>
                            <div className="text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 border flex-shrink-0" style={{borderColor:'var(--accent)', color:'var(--accent)'}}>{e.label}</div>
                            <div className="font-serif italic text-sm md:text-base flex-1 min-w-0 truncate" style={{color:'var(--ink)'}}>{e.procedure.name}</div>
                          </div>
                        );
                      }
                      return (
                        <div key={e.key} className="flex items-center gap-3 p-3 border" style={{borderColor:'var(--line)', background:'var(--cream-deep)'}}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:'var(--sage)'}}></div>
                          <div className="text-[9px] tracking-[0.25em] uppercase flex-shrink-0" style={{color:'var(--ink-soft)'}}>{dayLabel(new Date(e.date))} · {dateShort(new Date(e.date))}</div>
                          <div className="text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 border flex-shrink-0" style={{borderColor:'var(--sage)', color:'var(--sage)'}}>Product started</div>
                          <div className="font-serif italic text-sm md:text-base flex-1 min-w-0 truncate" style={{color:'var(--ink)'}}>{e.product.name} <span className="text-xs not-italic" style={{color:'var(--ink-soft)'}}>· {e.product.category}</span></div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* === THIS MONTH === */}
          {viewingYear === currentYear && thisMonthLogs.length > 0 && (
            <div className="mb-16">
              <div className="flex items-baseline justify-between border-b pb-3 mb-6" style={{borderColor:'var(--line)'}}>
                <div>
                  <div className="text-[10px] tracking-[0.4em] uppercase" style={{color:'var(--ink-soft)'}}>This month</div>
                  <h2 className="font-serif text-2xl italic mt-1" style={{color:'var(--ink)'}}>{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
                </div>
                <div className="text-[10px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{thisMonthLogs.length} entries · avg {(thisMonthLogs.reduce((s,l) => s + +l.rating, 0) / thisMonthLogs.length).toFixed(1)}</div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                {thisMonthLogs.map(log => {
                  const isSelected = selectedIds.includes(log.id);
                  const procs = proceduresOn(log.date);
                  return (
                    <button key={log.id} onClick={() => selectMode ? onToggleSelect?.(log.id) : setSelectedPhoto(log)} className="relative group aspect-square overflow-hidden transition" style={{
                      outline: isSelected ? '3px solid var(--ink)' : 'none',
                      outlineOffset: '-3px'
                    }}>
                      <Photo item={log} alt="" className="w-full h-full object-cover transition group-hover:scale-105"
                        renderFallback={() => (
                          <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                            <span className="font-serif italic text-2xl" style={{color:'var(--ink-soft)'}}>{log.rating}</span>
                          </div>
                        )}
                      />
                      <div className="absolute inset-0 flex flex-col justify-end p-1.5" style={{background:'linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%)'}}>
                        <div className="text-white text-[9px] font-medium">{new Date(log.date).getDate()}</div>
                      </div>
                      {procs.length > 0 && (
                        <div className="absolute top-1 right-1 w-3 h-3 rounded-full" style={{background:'var(--sage)'}}></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* === PRIOR MONTHS === */}
          {priorMonthsSorted.length > 0 && (
            <div className="mb-16">
              <div className="border-b pb-3 mb-6" style={{borderColor:'var(--line)'}}>
                <div className="text-[10px] tracking-[0.4em] uppercase" style={{color:'var(--ink-soft)'}}>{viewingYear === currentYear ? 'Earlier this year' : viewingYear}</div>
              </div>
              <div className="space-y-10">
                {priorMonthsSorted.map(([key, { label, entries }]) => (
                  <div key={key}>
                    <div className="flex items-baseline gap-3 mb-3">
                      <h3 className="font-serif text-xl italic" style={{color:'var(--ink)'}}>{label}</h3>
                      <span className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{entries.length} entries · avg {(entries.reduce((s, l) => s + +l.rating, 0) / entries.length).toFixed(1)}</span>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-15 gap-1">
                      {entries.sort((a, b) => new Date(b.date) - new Date(a.date)).map(log => {
                        const isSelected = selectedIds.includes(log.id);
                        return (
                          <button key={log.id} onClick={() => selectMode ? onToggleSelect?.(log.id) : setSelectedPhoto(log)} className="relative group aspect-square overflow-hidden transition" style={{
                            outline: isSelected ? '2px solid var(--ink)' : 'none',
                            outlineOffset: '-2px'
                          }} title={`${log.date} · ${log.rating}/10`}>
                            <Photo item={log} alt="" className="w-full h-full object-cover transition group-hover:opacity-80"
                              renderFallback={() => (
                                <div className="w-full h-full flex items-center justify-center" style={{background:'var(--cream-deep)'}}>
                                  <span className="font-serif italic text-sm" style={{color:'var(--ink-soft)'}}>{log.rating}</span>
                                </div>
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* === COMPACT MONTH CALENDAR — at the bottom of the timeline === */}
      {photoLogs.length > 0 && (() => {
        const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const todayKey = ym(today);
        const photoByDate = {};
        photoLogs.forEach(l => { photoByDate[l.date] = l; });
        const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const firstWeekday = calendarMonth.getDay();
        const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstWeekday; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
        const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
        const goToday = () => setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        const isFutureMonth = calendarMonth.getFullYear() > today.getFullYear()
          || (calendarMonth.getFullYear() === today.getFullYear() && calendarMonth.getMonth() >= today.getMonth());
        // Tapping a date opens that day's photo in the detail modal — which has built-in "Compare with prior" button.
        // For prior days, we ALSO set splitBeforeId so opening Compare picks today as After automatically.
        const onDayClick = (day) => {
          if (!day) return;
          const dKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const log = photoByDate[dKey];
          if (!log) return;
          if (dKey !== todayKey) {
            setSplitBeforeId(log.id);
            setSplitSwapped(false);
          }
          // Always open the photo modal — the user immediately sees the photo and analysis
          setSelectedPhoto(log);
        };
        return (
          <div className="border mt-10 md:mt-12" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
            <div className="flex items-center justify-between px-3 md:px-4 py-2.5 border-b" style={{borderColor:'var(--line)'}}>
              <button onClick={prevMonth} className="p-1.5" style={{color:'var(--ink-soft)'}} aria-label="Previous month"><Icon name="ChevronLeft" size={14} /></button>
              <div className="flex items-baseline gap-3">
                <div className="text-[9px] tracking-[0.3em] uppercase flex items-center gap-2" style={{color:'var(--ink-soft)'}}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'var(--accent)'}} />
                  Calendar
                </div>
                <h3 className="font-serif italic text-base md:text-lg" style={{color:'var(--ink)'}}>{monthLabel}</h3>
                <button onClick={goToday} className="text-[9px] tracking-[0.2em] uppercase italic" style={{color:'var(--ink-soft)'}}>Today</button>
              </div>
              <button onClick={nextMonth} disabled={isFutureMonth} className="p-1.5 disabled:opacity-30" style={{color:'var(--ink-soft)'}} aria-label="Next month"><Icon name="ChevronRight" size={14} /></button>
            </div>
            <div className="grid grid-cols-7 px-2 md:px-3 pt-2">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[8px] tracking-[0.2em] uppercase py-1" style={{color:'var(--ink-soft)'}}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 px-2 md:px-3 pb-3">
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="aspect-square" />;
                const dKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const log = photoByDate[dKey];
                const procOnDay = proceduresOn(dKey);
                const fuOnDay = followUpsOn(dKey);
                const isToday = dKey === todayKey;
                const isFuture = new Date(dKey) > today;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onDayClick(day)}
                    disabled={!log || isFuture}
                    className="aspect-square flex flex-col items-center justify-center transition relative disabled:cursor-default"
                    style={{
                      background: isToday ? 'var(--accent-soft)' : (log ? 'var(--cream-deep)' : 'transparent'),
                      color: isFuture ? 'var(--line)' : (log ? 'var(--ink)' : 'var(--ink-soft)'),
                      border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                    }}
                    title={
                      log ? `${dKey} · ${log.rating}/10 — tap to view & compare`
                      : procOnDay.length > 0 ? `${dKey} — ${procOnDay[0].name}`
                      : fuOnDay.length > 0 ? `${dKey} — ${fuOnDay[0].label}: ${fuOnDay[0].procedure.name}`
                      : dKey
                    }
                  >
                    <span className="text-[11px] font-light leading-none">{day}</span>
                    {log && (
                      <span className="font-serif italic text-[10px] mt-0.5 leading-none" style={{color:'var(--accent)'}}>{log.rating}</span>
                    )}
                    {/* Marker dots row, bottom of cell */}
                    <span className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                      {log && <span className="w-1 h-1 rounded-full" style={{background:'var(--accent)'}} />}
                      {procOnDay.length > 0 && <span className="w-1 h-1 rounded-full" style={{background:'var(--rose)'}} />}
                      {fuOnDay.length > 0 && !log && procOnDay.length === 0 && <span className="w-1 h-1 rounded-full" style={{background:'var(--accent)', opacity:0.55}} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[9px] italic px-3 md:px-4 pb-2.5" style={{color:'var(--ink-soft)'}}>
              Tap any photo day to open it — use the Compare button inside to see it next to today.
            </div>
          </div>
        );
      })()}

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4" style={{background:'rgba(28,25,23,0.85)', backdropFilter:'blur(8px)'}} onClick={() => setSelectedPhoto(null)}>
          <div className="max-w-md md:max-w-2xl w-full max-h-[92vh] overflow-y-auto relative shadow-2xl" style={{background:'var(--cream)'}} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedPhoto(null)} className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md" style={{background:'rgba(245,240,232,0.95)', color:'var(--ink)'}} aria-label="Close">
              <Icon name="X" size={14} />
            </button>
            <Photo item={selectedPhoto} alt="" className="w-full max-h-[40vh] md:max-h-[55vh] object-contain" style={{background:'var(--cream-deep)'}} />
            <div className="px-4 py-3 md:px-5 md:py-4">
              <div className="flex justify-between items-baseline gap-3 pb-2.5 border-b" style={{borderColor:'var(--line)'}}>
                <div className="min-w-0">
                  <div className="text-[9px] tracking-[0.25em] uppercase flex items-center gap-1.5" style={{color:'var(--ink-soft)'}}>
                    <span className="w-1 h-1 rounded-full inline-block" style={{background:'var(--accent)'}} />
                    {selectedPhoto.area.replace(/-/g, ' ')}
                  </div>
                  <h3 className="font-serif text-lg md:text-xl italic leading-tight mt-0.5" style={{color:'var(--ink)'}}>{new Date(selectedPhoto.date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</h3>
                </div>
                <div className="font-serif italic flex-shrink-0" style={{color:'var(--accent)'}}>
                  <span className="text-2xl md:text-3xl">{selectedPhoto.rating}</span>
                  <span className="text-[10px]" style={{color:'var(--ink-soft)'}}>/10</span>
                </div>
              </div>
              {selectedPhoto.notes && <p className="text-xs mt-2 font-light italic" style={{color:'var(--ink-soft)'}}>"{selectedPhoto.notes}"</p>}
              {selectedPhoto.concerns?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedPhoto.concerns.map(c => <span key={c} className="text-[9px] tracking-wider px-1.5 py-0.5 rounded-full" style={{background:'var(--cream-deep)', color:'var(--ink-soft)'}}>{c}</span>)}
                </div>
              )}
              {selectedPhoto.ratingExplanation && (
                <div className="mt-2.5 pt-2.5 border-t" style={{borderColor:'var(--line)'}}>
                  <div className="text-[8px] tracking-[0.25em] uppercase mb-1 flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                    <Icon name="Eye" size={9} /> Why this rating
                  </div>
                  <div className="text-[11px] md:text-xs leading-snug font-light whitespace-pre-wrap" style={{color:'var(--ink)'}}>{withPearls(selectedPhoto.ratingExplanation, onOpenLesson)}</div>
                </div>
              )}
              {selectedPhoto.aiAnalysis && (
                <div className="mt-2.5 pt-2.5 border-t" style={{borderColor:'var(--line)'}}>
                  <div className="text-[8px] tracking-[0.25em] uppercase mb-1 flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                    <Icon name="Sparkles" size={9} /> Observation
                  </div>
                  <div className="text-[11px] md:text-xs leading-snug font-light whitespace-pre-line" style={{color:'var(--ink)'}}>{withPearls(formatAnalysisText(selectedPhoto.aiAnalysis), onOpenLesson)}</div>
                </div>
              )}
              {/* Footer actions inside the detail modal */}
              <div className="mt-2.5 pt-2 border-t flex items-center justify-between gap-3 flex-wrap" style={{borderColor:'var(--line)'}}>
                {(() => {
                  const hp = (l) => l.photoPath || (typeof l.photo === 'string' && l.photo.startsWith('data:'));
                  const previousPhotoLog = hp(selectedPhoto) ? logs.filter(l => l.id !== selectedPhoto.id && hp(l) && new Date(l.date) < new Date(selectedPhoto.date)).sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;
                  return previousPhotoLog ? (
                    <button onClick={() => { enterCompare?.(previousPhotoLog.id, selectedPhoto.id); setSelectedPhoto(null); }} className="text-[9px] tracking-[0.2em] uppercase italic flex items-center gap-1" style={{color:'var(--ink)', borderBottom:'1px dotted var(--ink)'}}>
                      <Icon name="Eye" size={10} /> Compare with {new Date(previousPhotoLog.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </button>
                  ) : <span />;
                })()}
                <div className="flex items-center gap-3 ml-auto">
                  {onEditLog && (
                    <button onClick={() => { onEditLog(selectedPhoto.id); setSelectedPhoto(null); }} className="text-[9px] tracking-widest uppercase italic flex items-center gap-1" style={{color:'var(--ink)'}}>
                      <Icon name="Edit2" size={10} /> Edit
                    </button>
                  )}
                  {deleteLog && (
                    <button onClick={() => { if (confirm('Remove this entry?')) { deleteLog(selectedPhoto.id); setSelectedPhoto(null); } }} className="text-[9px] tracking-widest uppercase" style={{color:'var(--ink-soft)'}}>Remove</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SPLIT-COMPARE PICKER === */}
      {showSplitPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(28,25,23,0.6)', backdropFilter:'blur(4px)'}} onClick={() => { setShowSplitPicker(false); handlePriorCancel(); }}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" style={{background:'var(--cream)'}}>
            <div className="sticky top-0 border-b px-6 py-4 flex justify-between items-center z-10" style={{background:'var(--cream)', borderColor:'var(--line)'}}>
              <h3 className="text-xl font-serif italic" style={{color:'var(--ink)'}}>{pickerStage === 'review' ? 'When was this photo from?' : 'Pick a photo to compare'}</h3>
              <button onClick={() => { setShowSplitPicker(false); handlePriorCancel(); }} style={{color:'var(--ink-soft)'}}><Icon name="X" size={18} /></button>
            </div>
            <div className="p-6">
              {pickerStage === 'browse' && (
                <>
                  <p className="text-sm font-light italic mb-4" style={{color:'var(--ink-soft)'}}>Tap any photo from your timeline, or upload an old one from your camera library. It becomes the "Before" half against today's photo.</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {/* Upload-from-library tile — always first */}
                    <button onClick={() => fileUploadRef.current?.click()} className="relative aspect-square flex flex-col items-center justify-center text-center px-2 transition hover:bg-[var(--cream-deep)]" style={{border:'2px dashed var(--line)'}}>
                      <Icon name="Upload" size={16} className="opacity-60 mb-1" />
                      <div className="text-[9px] tracking-[0.2em] uppercase leading-tight" style={{color:'var(--ink-soft)'}}>Upload an old photo</div>
                    </button>
                    <input ref={fileUploadRef} type="file" accept="image/*" className="hidden" onChange={handlePriorFileSelected} />
                    {photoLogs.filter(l => l.id !== todayLog?.id).slice(0, 60).map(log => (
                      <button key={log.id} onClick={() => { setSplitBeforeId(log.id); setShowSplitPicker(false); setSplitSwapped(false); }} className="relative aspect-square overflow-hidden transition hover:opacity-80" title={`${log.date} · ${log.rating}/10`}>
                        <Photo item={log} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 px-1.5 py-1" style={{background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'}}>
                          <div className="text-white text-[8px] tracking-[0.15em] uppercase">{new Date(log.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</div>
                          <div className="text-white font-serif italic text-xs leading-none">{log.rating}<span className="text-[8px] opacity-70">/10</span></div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {photoLogs.filter(l => l.id !== todayLog?.id).length === 0 && (
                    <p className="font-serif text-sm italic mt-4" style={{color:'var(--ink-soft)'}}>No earlier photos in your timeline yet — upload an old one to compare today against your past.</p>
                  )}
                </>
              )}

              {pickerStage === 'review' && pendingPhoto && (
                <div className="space-y-4">
                  <p className="text-sm font-light italic" style={{color:'var(--ink-soft)'}}>This photo will be saved to your journal as a backdated entry. Pick the date it was taken.</p>
                  <div className="aspect-[4/3] overflow-hidden" style={{background:'var(--cream-deep)'}}>
                    <img src={pendingPhoto.base64} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-[0.2em] uppercase mb-2 font-medium" style={{color:'var(--ink-soft)'}}>Date this photo was taken</label>
                    <input
                      type="date"
                      value={pendingPhoto.date}
                      max={localDateISO()}
                      onChange={e => setPendingPhoto(p => ({ ...p, date: e.target.value }))}
                      autoFocus
                      className={inputCls}
                      style={{background:'var(--cream-deep)', borderColor:'var(--line)', color:'var(--ink)'}}
                    />
                    <div className="text-[10px] font-light italic mt-1.5" style={{color:'var(--ink-soft)'}}>The photo will save with this date so it appears in the right place on your timeline. Defaults to full-face — edit later in the journal entry if needed.</div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handlePriorCancel} disabled={savingPrior} className="flex-1 py-2.5 tracking-[0.2em] text-[10px] uppercase border transition disabled:opacity-50" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>Cancel</button>
                    <button onClick={handlePriorSave} disabled={!pendingPhoto.date || savingPrior} className="flex-1 py-2.5 tracking-[0.2em] text-[10px] uppercase transition disabled:opacity-40 flex items-center justify-center gap-1.5" style={{background:'var(--ink)', color:'var(--cream)'}}>
                      {savingPrior ? <><Icon name="Loader2" size={11} className="spin" /> Saving</> : <>Use this photo</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
