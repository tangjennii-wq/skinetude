// === RegimenOccasionsView (Wave 8.1 sub-extract — May 2026) ===
// The `occasions` sub-view of RegimenView. Mounted when
// `regimenView === 'occasions'`. ~649 lines lifted.

const RegimenOccasionsView = ({
  logs,
  products,
  setBuildPlan,
  setRegimenView,
  setShowProductModal,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  rotationViewMode, setRotationViewMode,
  rotationTargetSlot, setRotationTargetSlot,
  setBuildPlanAccepted,
  setBuildStep,
  setWeeklyExpandedDay,
  weeklyExpandedDay,
  // === INSIGHT-DRIVEN REFINE PROMPT (May 2026 per Jenni) ===
  // Reads recent check-in metric snapshots, compares against current
  // routine, surfaces a single actionable observation with a Refine CTA
  // pre-scoped to the matching intent.
  setRefineIntent,
  setRefineSheetOpen,
}) => {
  const [rotationSlot, setRotationSlot] = useState('am');
  const [expandedRotationProductId, setExpandedRotationProductId] = useState(null);
  useEffect(() => {
    if (rotationTargetSlot !== 'am' && rotationTargetSlot !== 'pm') return;
    setRotationSlot(rotationTargetSlot);
    if (typeof setRotationTargetSlot === 'function') setRotationTargetSlot(null);
  }, [rotationTargetSlot]);
  return (() => {
  // === WEEKLY ROTATION VIEW (May 2026) ===
  // Replaces the old Occasions tab. Renders a 7-day grid derived
  // from product.cadence. Each day shows the AM + PM actives
  // scheduled for that day, with conflict warnings inline.
  // Read-only first pass — edit affordances come in Phase 2.
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayShort  = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const activeProducts = (products || []).filter(p => !p.endDate);
  // Build the existing weekly pattern: day → { am: [{product, family}], pm: [...] }
  // For each product, read cadence.days (array of 0-6 indices) and useTimes (['AM']|['PM']).
  // Default: if cadence is missing or 'daily', show every day.
  const buildWeeklyPattern = () => {
    const pattern = {};
    for (let d = 0; d < 7; d++) pattern[d] = { am: [], pm: [] };
    activeProducts.forEach(p => {
      // === EXPLICIT CADENCE ONLY (May 2026 bug fix per Jenni) ===
      // The previous "default to all 7 days" fallback flooded each day's
      // expand panel with every shelf product whose useTimes happened to
      // include AM or PM — even products the user hadn't actually slotted
      // into their built routine. That inflated the day view, the
      // weekly tally, and the conflict warnings simultaneously.
      // Fix: require an explicit cadence.days / cadenceDays. Products
      // without one (i.e. on the shelf but never built into the rotation)
      // don't appear in any day's panel. Daily-cadence products (all 7
      // days) still show up everywhere — that's correct.
      let days = null;
      if (p.cadence && Array.isArray(p.cadence.days) && p.cadence.days.length > 0) days = p.cadence.days;
      else if (Array.isArray(p.cadenceDays) && p.cadenceDays.length > 0) days = p.cadenceDays;
      if (!days) return; // unbuilt shelf product — skip
      const useTimes = Array.isArray(p.useTimes) ? p.useTimes.map(s => String(s).toUpperCase()) : [];
      // Also require an explicit useTimes — empty useTimes was previously
      // interpreted as "both slots," which fanned products into BOTH AM
      // and PM. Now empty useTimes = not slotted = skip.
      if (useTimes.length === 0) return;
      const isAM = useTimes.includes('AM');
      const isPM = useTimes.includes('PM');
      const family = detectActiveFamily(p.activeIngredients || p.actives || '');
      days.forEach(d => {
        if (d < 0 || d > 6) return;
        if (isAM) pattern[d].am.push({ product: p, family });
        if (isPM) pattern[d].pm.push({ product: p, family });
      });
    });
    return pattern;
  };
  const weeklyPattern = buildWeeklyPattern();
  // Conflict scan per day: report any HARD conflict between pairs in same slot.
  const findConflictsInSlot = (slotEntries) => {
    const conflicts = [];
    for (let i = 0; i < slotEntries.length; i++) {
      for (let j = i + 1; j < slotEntries.length; j++) {
        const c = lookupConflict(slotEntries[i].family, slotEntries[j].family);
        if (c && c.tier === 'hard') conflicts.push({ a: slotEntries[i], b: slotEntries[j], note: c.note });
      }
    }
    return conflicts;
  };
  const todayIdx = new Date().getDay();
  // === FOCUS-THEME DETECTION (May 2026) ===
  // Each day in the rotation gets a single focus label derived from
  // the highest-priority active family scheduled that day. Mirrors
  // the spec: "Sunday — Recovery / Monday — Exfoliate / Tuesday —
  // Brighten." Falls back to "Daily" when only basics/hydration
  // are scheduled.
  const FOCUS_PRIORITY = [
    { family: 'retinoid',    label: 'Retinoid' },
    { family: 'aha',         label: 'Exfoliate' },
    { family: 'bha',         label: 'Exfoliate' },
    { family: 'bpo',         label: 'Treat' },
    { family: 'vitc',        label: 'Brighten' },
    { family: 'azelaic',     label: 'Brighten' },
    { family: 'arbutin',     label: 'Brighten' },
    { family: 'tranexamic',  label: 'Brighten' },
    { family: 'kojic',       label: 'Brighten' },
    { family: 'bakuchiol',   label: 'Renew' },
    { family: 'peptide',     label: 'Firm' },
    { family: 'niacinamide', label: 'Barrier' },
    { family: 'ceramide',    label: 'Recovery' },
    { family: 'panthenol',   label: 'Recovery' },
    { family: 'centella',    label: 'Calm' },
    { family: 'humectant',   label: 'Hydrate' },
    { family: 'spf',         label: 'Protect' },
  ];
  const FAMILY_NICE = {
    retinoid: 'Retinoid', aha: 'AHA', bha: 'BHA', vitc: 'Vitamin C',
    azelaic: 'Azelaic Acid', arbutin: 'Arbutin', tranexamic: 'Tranexamic Acid',
    kojic: 'Kojic', niacinamide: 'Niacinamide', ceramide: 'Ceramides',
    panthenol: 'Panthenol', peptide: 'Peptides', centella: 'Centella',
    humectant: 'Hydration', spf: 'SPF', bakuchiol: 'Bakuchiol', bpo: 'BPO',
  };
  const getDayFocus = (amEntries, pmEntries) => {
    // Collect unique families across both slots
    const fams = new Set();
    [...(amEntries||[]), ...(pmEntries||[])].forEach(e => { if (e.family) fams.add(e.family); });
    if (fams.size === 0) return { label: 'Rest', families: [] };
    // Pick the highest-priority family present
    let label = 'Daily';
    for (const entry of FOCUS_PRIORITY) {
      if (fams.has(entry.family)) { label = entry.label; break; }
    }
    // Sort families by priority so the chip line reads naturally
    const order = FOCUS_PRIORITY.map(e => e.family);
    const families = Array.from(fams).sort((a, b) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return { label, families };
  };
  // === WHY THIS ROUTINE? — per-day clinical explanation (May 2026, slice 3) ===
  // Generates a single short sentence keyed off the day's focus,
  // the families present, and what else is scheduled across the
  // week. Tone: Apple Health + Aesop + derm planning notes.
  // Mirrors the buildSmartRationale voice from the Build wizard.
  const getDayExplanation = (focus, families, dayIdx) => {
    const famsHere = new Set(families);
    // Helper: does another day in the week contain any of these families?
    const otherDayHas = (...check) => {
      for (let d = 0; d < 7; d++) {
        if (d === dayIdx) continue;
        const fams = [...weeklyPattern[d].am, ...weeklyPattern[d].pm].map(e => e.family).filter(Boolean);
        if (check.some(f => fams.includes(f))) return true;
      }
      return false;
    };
    if (focus === 'Rest') return 'No actives scheduled — your skin gets a break.';
    if (focus === 'Retinoid') {
      if (otherDayHas('aha','bha')) return 'Retinoid spaced from exfoliation nights to protect your barrier.';
      return 'Retinoid scheduled with recovery nights nearby for barrier support.';
    }
    if (focus === 'Exfoliate') {
      if (otherDayHas('retinoid')) return 'Exfoliation kept on non-retinoid nights to minimize irritation.';
      return 'Exfoliation night — cellular turnover support.';
    }
    if (focus === 'Brighten') {
      if (famsHere.has('vitc') && (famsHere.has('spf') || otherDayHas('spf'))) {
        return 'Vitamin C stacks with SPF for UV synergy.';
      }
      if (famsHere.has('azelaic') && otherDayHas('retinoid')) {
        return 'Azelaic alternated with retinoid nights for pigmentation cadence.';
      }
      if (famsHere.has('vitc')) return 'Vitamin C kept to mornings for antioxidant lift.';
      return 'Brightening actives paired with barrier support.';
    }
    if (focus === 'Treat') return 'Spot treatment scheduled on a low-impact day.';
    if (focus === 'Renew') return 'Bakuchiol — gentle retinoid alternative, daily-safe.';
    if (focus === 'Firm') return 'Peptide support — daily-safe collagen building.';
    if (focus === 'Barrier') return 'Niacinamide stacks safely with the rest of your routine.';
    if (focus === 'Recovery') return 'Recovery night — barrier prioritized after active days.';
    if (focus === 'Calm') return 'Centella supports skin recovering from irritation.';
    if (focus === 'Hydrate') return 'Hydration anchor — pairs cleanly with everything.';
    if (focus === 'Protect') return 'SPF anchors the AM routine.';
    return 'Active spacing preserved across the week.';
  };
  // === VIEW-MODE TOGGLE — segmented pill (By day · By product) ===
  const ViewModeToggle = () => (
    <div
      className="inline-flex rounded-full p-0.5 mt-3"
      style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}
      role="tablist"
    >
      {[
        { id: 'product', label: 'Actives' },
        { id: 'day', label: 'Regimen' },
      ].map(opt => {
        const on = rotationViewMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setRotationViewMode(opt.id)}
            className="text-[10px] tracking-[0.22em] uppercase px-3 py-1.5 rounded-full transition"
            style={{
              background: on ? 'var(--ink)' : 'transparent',
              color: on ? 'var(--cream)' : 'var(--ink-soft)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >{opt.label}</button>
        );
      })}
    </div>
  );
  return (
    <div>
      <SectionHeader title="Rotation" subtitle="Your week first, then the active products underneath." />
      {activeProducts.length === 0 ? (
        <EmptyState icon="Calendar" text="Add products with a cadence to see your rotation." action={() => setShowProductModal(true)} actionText="Add Product" />
      ) : (
        <div className="mt-4 space-y-1">
          {/* ===== SMART WARNINGS (May 2026, slice 4) =====
              Calm intelligence notes at the top of Rotation when
              the week reads aggressive. Counts strong-active
              density, missing recovery, and stacking risks. Tone:
              observational, not alarmist. Only renders when at
              least one condition fires — never displays an empty
              panel. */}
          {false && (() => {
            const STRONG = new Set(['retinoid','aha','bha','bpo']);
            const SOFT = new Set(['ceramide','panthenol','centella','niacinamide','humectant']);
            let retinoidNights = 0, exfoliationNights = 0, recoveryDays = 0;
            let strongTotal = 0;
            const dayFams = [];
            for (let d = 0; d < 7; d++) {
              const fams = new Set();
              [...weeklyPattern[d].am, ...weeklyPattern[d].pm].forEach(e => e.family && fams.add(e.family));
              dayFams.push(fams);
              let strongHit = false;
              STRONG.forEach(f => { if (fams.has(f)) strongHit = true; });
              if (strongHit) strongTotal++;
              if (fams.has('retinoid')) retinoidNights++;
              if (fams.has('aha') || fams.has('bha')) exfoliationNights++;
              let softHit = false;
              SOFT.forEach(f => { if (fams.has(f)) softHit = true; });
              if (!strongHit && softHit) recoveryDays++;
            }
            const warnings = [];
            if (strongTotal >= 5) warnings.push({ tone: 'rose', icon: 'AlertCircle', text: 'Pattern noticed — your routine is dense this week. Consider trimming a strong night.' });
            if (strongTotal >= 1 && recoveryDays < 1) warnings.push({ tone: 'rose', icon: 'AlertCircle', text: 'No recovery nights this week — your barrier might struggle.' });
            if (retinoidNights >= 4) warnings.push({ tone: 'rose', icon: 'AlertCircle', text: 'Retinoid 4+ nights — push tolerance carefully.' });
            // Check for consecutive strong days (back-to-back retinoid + exfoliation)
            for (let d = 0; d < 7; d++) {
              const next = (d + 1) % 7;
              const curStrong = [...STRONG].some(f => dayFams[d].has(f));
              const nextStrong = [...STRONG].some(f => dayFams[next].has(f));
              if (curStrong && nextStrong) {
                const curHas = (f) => dayFams[d].has(f);
                const nextHas = (f) => dayFams[next].has(f);
                // Specifically flag retinoid + exfoliant on consecutive days
                if ((curHas('retinoid') && (nextHas('aha') || nextHas('bha'))) ||
                    ((curHas('aha') || curHas('bha')) && nextHas('retinoid'))) {
                  warnings.push({ tone: 'rose', icon: 'AlertCircle', text: 'Pattern: retinoid and exfoliation are landing on back-to-back nights. A recovery night between will protect your barrier.' });
                  break;
                }
              }
            }
            // No positive-balance toast on purpose — the absence
            // of warnings IS the positive signal. Restraint over
            // decoration (editorial apartment rule).
            if (warnings.length === 0) return null;
            return (
              <div className="mb-3 space-y-1.5">
                {warnings.map((w, i) => (
                  <div
                    key={i}
                    className="rounded-[12px] px-3 py-2 flex items-start gap-2"
                    style={{
                      background: w.tone === 'rose' ? 'rgba(193,87,103,0.06)' : 'rgba(139,154,108,0.08)',
                      border: `1px solid ${w.tone === 'rose' ? 'rgba(193,87,103,0.25)' : 'rgba(139,154,108,0.3)'}`,
                    }}
                  >
                    <Icon name={w.icon} size={12} style={{color: w.tone === 'rose' ? 'var(--rose)' : 'var(--accent-blue)', flexShrink:0, marginTop:1}} />
                    <p className="text-[11px] leading-snug" style={{color:'var(--ink)', fontWeight:500}}>{w.text}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ===== SYNERGIES IN YOUR WEEK (May 2026 — derm pass) =====
              Pulls evidence-based positive pairings from
              ACTIVE_SYNERGIES against the families currently
              scheduled across the week. Examples:
                Vit C + SPF      → photoprotection
                Niacinamide + Peptide → collagen
                Ceramide + Retinoid → barrier
              Card only renders when at least one synergy is
              present. Pure informational — does not influence
              scheduling. */}
          {false && (() => {
            const weeklyFams = new Set();
            for (let d = 0; d < 7; d++) {
              [...weeklyPattern[d].am, ...weeklyPattern[d].pm].forEach(e => {
                if (e.family) weeklyFams.add(e.family);
              });
            }
            const synergies = findSynergiesInFamilies(Array.from(weeklyFams));
            if (synergies.length === 0) return null;
            // Boost-tag color hint
            const boostColor = (boost) => {
              if (boost === 'pigment' || boost === 'collagen') return 'var(--accent)';
              if (boost === 'barrier' || boost === 'hydration') return 'var(--accent-blue)';
              return 'var(--ink-soft)';
            };
            const boostLabel = (boost) => {
              const map = {
                'photoprotection': 'Photoprotection',
                'collagen': 'Collagen',
                'barrier': 'Barrier',
                'tolerance': 'Tolerance',
                'pigment': 'Pigment',
                'oil-control': 'Oil control',
                'acne': 'Acne',
                'hydration': 'Hydration',
                'gentle-aging': 'Anti-aging',
              };
              return map[boost] || boost;
            };
            const FAMILY_NICE_INLINE = {
              retinoid:'Retinoid', aha:'AHA', bha:'BHA', vitc:'Vit C',
              azelaic:'Azelaic', arbutin:'Arbutin', tranexamic:'Tranexamic',
              kojic:'Kojic', niacinamide:'Niacinamide', ceramide:'Ceramides',
              panthenol:'Panthenol', peptide:'Peptides', centella:'Centella',
              humectant:'Hydration', spf:'SPF', bakuchiol:'Bakuchiol', bpo:'BPO',
            };
            return (
              <div className="mb-3 rounded-[14px] p-4" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.28em] uppercase mb-2.5" style={{color:'var(--ink-soft)', fontWeight:600}}>
                  Synergies in your week
                </div>
                <div className="space-y-2">
                  {synergies.slice(0, 6).map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Icon name="Sparkles" size={11} style={{color: boostColor(s.boost), flexShrink:0, marginTop:2, opacity:0.85}} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-[12px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.005em'}}>
                            {FAMILY_NICE_INLINE[s.pair[0]] || s.pair[0]} <span style={{color:'var(--ink-soft)', fontWeight:400}}>+</span> {FAMILY_NICE_INLINE[s.pair[1]] || s.pair[1]}
                          </span>
                          <span className="text-[8.5px] tracking-[0.18em] uppercase" style={{color: boostColor(s.boost), fontWeight:600}}>
                            {boostLabel(s.boost)}
                          </span>
                        </div>
                        <p className="text-[10.5px] leading-snug mt-0.5" style={{color:'var(--ink-soft)'}}>{s.note}</p>
                      </div>
                    </div>
                  ))}
                  {synergies.length > 6 && (
                    <div className="text-[10.5px]" style={{color:'var(--ink-soft)'}}>+{synergies.length - 6} more</div>
                  )}
                </div>
              </div>
            );
          })()}

          {false && rotationViewMode === 'product' && (() => {
            // === ACTIVE-FAMILY VIEW (May 2026 simplification) ===
            // First answer: "what actives am I working this week?"
            // Group scheduled products by active family, then show
            // the cadence in one scannable row per family. Basics
            // stay quiet unless they are the only thing scheduled.
            const dayShortLabels = ['S','M','T','W','T','F','S'];
            const familyMap = {};
            for (let d = 0; d < 7; d++) {
              [...weeklyPattern[d].am, ...weeklyPattern[d].pm].forEach(entry => {
                const family = entry.family || 'daily';
                if (!familyMap[family]) familyMap[family] = { family, days: new Set(), am: false, pm: false, products: new Map() };
                familyMap[family].days.add(d);
                if (weeklyPattern[d].am.includes(entry)) familyMap[family].am = true;
                if (weeklyPattern[d].pm.includes(entry)) familyMap[family].pm = true;
                familyMap[family].products.set(entry.product.id, entry.product);
              });
            }
            const softFamilies = new Set(['ceramide','panthenol','centella','humectant','spf','daily']);
            const rows = Object.values(familyMap)
              .filter(row => !softFamilies.has(row.family) || Object.keys(familyMap).length === 1)
              .sort((a, b) => {
                const order = FOCUS_PRIORITY.map(x => x.family);
                const ia = order.indexOf(a.family);
                const ib = order.indexOf(b.family);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
              });
            const basicsCount = Object.values(familyMap).filter(row => softFamilies.has(row.family)).length;
            const activeDayCount = new Set(rows.flatMap(row => Array.from(row.days))).size;
            return (
              <div className="mt-3 rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>This week</div>
                <h3 className="text-[20px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.018em'}}>
                  {rows.length > 0 ? `${rows.length} active ${rows.length === 1 ? 'lane' : 'lanes'}` : 'Daily basics only'}
                </h3>
                <p className="text-[11.5px] mb-4" style={{color:'var(--ink-soft)'}}>
                  {rows.length > 0
                    ? `Scheduled across ${activeDayCount} day${activeDayCount === 1 ? '' : 's'}. Toggle to Regimen for the full AM/PM list.`
                    : 'No stronger actives are scheduled yet.'}
                </p>
                <div className="space-y-2">
                  {rows.map(row => {
                    const days = Array.from(row.days).sort((a,b)=>a-b);
                    const dayTag = days.length === 7 ? 'Daily' : days.map(d => dayShortLabels[d]).join('·');
                    const slotTag = row.am && row.pm ? 'AM · PM' : row.pm ? 'PM' : 'AM';
                    const names = Array.from(row.products.values()).map(p => p.name).slice(0, 3).join(', ');
                    const extra = row.products.size > 3 ? ` +${row.products.size - 3}` : '';
                    return (
                      <div key={row.family} className="rounded-[12px] px-3 py-3" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="text-[13px]" style={{color:'var(--ink)', fontWeight:650}}>
                            {FAMILY_NICE[row.family] || 'Active'}
                          </div>
                          <div className="text-[9.5px] tracking-[0.18em] uppercase flex-shrink-0" style={{color:'var(--accent)', fontWeight:650}}>
                            {dayTag} {slotTag}
                          </div>
                        </div>
                        <div className="text-[10.5px] mt-1 truncate" style={{color:'var(--ink-soft)'}}>
                          {names}{extra}
                        </div>
                      </div>
                    );
                  })}
                  {basicsCount > 0 && rows.length > 0 && (
                    <div className="text-[10.5px] pt-1" style={{color:'var(--ink-soft)'}}>
                      Daily basics are tucked into the Regimen view.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {(() => {
            // === BY DAY VIEW — REBUILD-STYLE SUMMARY (May 2026) ===
            // Single card matching the Build/Rebuild "Your week,
            // set." card visual:
            //   1) Cadence list (product · M·T·W·T·F AM/PM)
            //   2) Horizontal S M T W T F S strip + dots
            //   3) Inline expand panel showing AM/PM for the
            //      selected day
            // Uses weeklyExpandedDay state for the inline expand
            // so the toggle persists across re-renders.
            const dayLetters = ['S','M','T','W','T','F','S'];
            const dayLongLabels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            // Ingredient-family drives the "active" read, not cadence.
            // A daily retinoid is still a scheduled active; the earlier
            // partial-week proxy made it read as "basics only."
            const compactProductName = (p) => {
              const brand = (p.brand || '').trim();
              const rawName = (p.name || '').trim();
              const withoutBrand = brand
                ? rawName.replace(new RegExp('^' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'), '').trim()
                : rawName;
              const generic = new Set(['the','a','an','fresh','day','night','advanced','treatment','serum','cream','lotion','solution','essence','ampoule','moisturizing','hydrating','repair','facial']);
              const tokens = withoutBrand.split(/\s+/).filter(Boolean);
              const meaningful = tokens.filter(t => !generic.has(t.toLowerCase().replace(/[^\w-]/g, '')));
              const handle = (meaningful.length ? meaningful : tokens).slice(0, 2).join(' ') || withoutBrand || rawName;
              return brand ? `${brand} ${handle}` : handle;
            };
            const productCardLabel = (p) => {
              const brand = (p.brand || '').trim();
              const name = (p.name || '').trim();
              if (brand && name && name.toLowerCase().startsWith(brand.toLowerCase())) {
                return { brand, name: name.slice(brand.length).trim() || name };
              }
              return { brand: brand || (p.category || 'Product'), name: name || brand || 'Product' };
            };
            const parseProductAnalysis = (raw = '') => {
              const sections = {};
              const labelRe = /^\s*(MECHANISM|EVIDENCE|REVIEWS|CONFLICTS|ALTERNATIVES|ASSESSMENT)\s*:\s*/gmi;
              let lastLabel = null;
              let lastIndex = 0;
              let m;
              while ((m = labelRe.exec(raw)) !== null) {
                if (lastLabel !== null) sections[lastLabel] = raw.slice(lastIndex, m.index).trim();
                lastLabel = m[1].toUpperCase();
                lastIndex = m.index + m[0].length;
              }
              if (lastLabel !== null) sections[lastLabel] = raw.slice(lastIndex).trim();
              const scrub = (text) => String(text || '')
                .split(/\n/)
                .filter(line => {
                  const t = line.trim();
                  return !/^\s*[12]\.\s*(CHEAPER|SIMILAR)/i.test(t)
                    && !/^\s*(CHEAPER|SIMILAR-OR-HIGHER)\s*\|/i.test(t);
                })
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              const splitSentences = (text) => scrub(text)
                .split(/(?<=[.!?])\s+(?=[A-Z\[])/)
                .map(s => s.trim())
                .filter(Boolean);
              return {
                mechanism: splitSentences(sections.MECHANISM || sections.ASSESSMENT || '').slice(0, 2),
                evidence: splitSentences(sections.EVIDENCE || '').slice(0, 1),
              };
            };
            const renderProductCard = (entry, kind) => {
              const p = entry.product;
              const label = productCardLabel(p);
              const familyLabel = FAMILY_NICE[entry.family] || p.category || (kind === 'basic' ? 'Basic' : 'Active');
              const activeText = String(p.activeIngredients || p.actives || p.main || '').trim();
              const supportingText = String(p.mainIngredients || '').trim();
              const rowKey = 'rotation-' + rotationSlot + '-' + (p.id || p.name) + '-' + kind;
              const isExpanded = expandedRotationProductId === rowKey;
              const analysis = parseProductAnalysis(p.aiAnalysis || '');
              const hasTags = Array.isArray(p.tags) && p.tags.length > 0;
              const hasDetail = activeText || supportingText || hasTags || p.frequency || p.startDate || analysis.mechanism.length > 0 || analysis.evidence.length > 0;
              return (
                <div key={rowKey} className="rounded-[14px] border overflow-hidden" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                  <button
                    type="button"
                    onClick={() => setExpandedRotationProductId(isExpanded ? null : rowKey)}
                    className="w-full p-3 text-left transition hover:opacity-90"
                    style={{cursor:'pointer'}}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[9px] tracking-[0.24em] uppercase mb-0.5" style={{color:'var(--ink-soft)', fontWeight:600}}>{label.brand}</div>
                        <div className="text-[13px] leading-tight" style={{color:'var(--ink)', fontWeight:650}}>{label.name}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="rounded-full border px-2 py-1 text-[8.5px] tracking-[0.14em] uppercase" style={{borderColor: 'var(--line)', color: kind === 'active' ? 'var(--accent)' : 'var(--ink-soft)', background:'var(--cream)'}}>
                          {familyLabel}
                        </span>
                        {hasDetail && <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={13} style={{color:'var(--ink-soft)'}} />}
                      </div>
                    </div>
                    {activeText && (
                      <div className="mt-2 text-[10.5px] leading-snug" style={{color:'var(--ink-soft)'}}>
                        {activeText.split(',').slice(0, 3).join(' · ')}
                      </div>
                    )}
                  </button>
                  {isExpanded && hasDetail && (
                    <div className="px-3 pb-3 pt-3 border-t" style={{background:'rgba(246,251,252,0.78)', borderColor: 'var(--line)'}}>
                      {label.brand && <div className="text-[9px] tracking-[0.2em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>{label.brand}</div>}
                      {(activeText || supportingText) && (
                        <div className="text-[10.5px] leading-snug mb-2" style={{color:'var(--ink-soft)'}}>
                          <span className="tracking-[0.2em] uppercase mr-1.5" style={{fontSize:9, color:'var(--ink-soft)', fontWeight:600}}>Also</span>
                          {[activeText, supportingText].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {hasTags && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {p.tags.slice(0, 8).map((t, tagIdx) => (
                            <span key={tagIdx} className="text-[9px] tracking-[0.1em] px-1.5 py-0.5 border rounded-full" style={{borderColor: 'var(--line)', color:'var(--ink-soft)', background:'var(--cream)'}}>{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] font-light mb-2" style={{color:'var(--ink-soft)'}}>
                        {p.frequency ? p.frequency.replace(/-/g, ' ') : (kind === 'active' ? 'scheduled active' : 'scheduled support')}
                        {Array.isArray(p.useTimes) && p.useTimes.length > 0 ? ' · ' + p.useTimes.map(t => String(t).toUpperCase()).join(' + ') : ''}
                        {p.startDate ? ' · started ' + new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </div>
                      {(analysis.mechanism.length > 0 || analysis.evidence.length > 0) && (
                        <div className="pt-2 mt-2 border-t space-y-2" style={{borderColor: 'var(--line)'}}>
                          {analysis.mechanism.length > 0 && (
                            <div>
                              <div className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:600}}>Mechanism</div>
                              <ul className="space-y-0.5">
                                {analysis.mechanism.map((line, idx) => (
                                  <li key={idx} className="flex gap-1.5 text-[11px] leading-snug font-light" style={{color:'var(--ink)'}}>
                                    <span style={{color:'var(--accent)'}}>·</span>
                                    <span className="flex-1" style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{line}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {analysis.evidence.length > 0 && (
                            <div>
                              <div className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--ink-soft)', fontWeight:600}}>Evidence</div>
                              <div className="flex gap-1.5 text-[11px] leading-snug font-light" style={{color:'var(--ink)'}}>
                                <span style={{color:'var(--accent)'}}>·</span>
                                <span className="flex-1">{analysis.evidence[0]}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            };
            const softFamiliesForActives = new Set(['ceramide','panthenol','centella','humectant','spf','daily']);
            const isActiveEntry = (entry) => entry?.family && !softFamiliesForActives.has(entry.family);
            const familyMap = {};
            for (let d = 0; d < 7; d++) {
              [...weeklyPattern[d].am, ...weeklyPattern[d].pm].forEach(entry => {
                const family = entry.family || 'daily';
                if (!familyMap[family]) familyMap[family] = { family, days: new Set(), am: false, pm: false, products: new Map() };
                familyMap[family].days.add(d);
                if (weeklyPattern[d].am.includes(entry)) familyMap[family].am = true;
                if (weeklyPattern[d].pm.includes(entry)) familyMap[family].pm = true;
                familyMap[family].products.set(entry.product.id, entry.product);
              });
            }
            const activeRows = Object.values(familyMap)
              .filter(row => !softFamiliesForActives.has(row.family) || Object.keys(familyMap).length === 1)
              .sort((a, b) => {
                const order = FOCUS_PRIORITY.map(x => x.family);
                const ia = order.indexOf(a.family);
                const ib = order.indexOf(b.family);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
              });
            // dot under each day = strong active scheduled
            const dayHasActive = Array.from({length: 7}, (_, d) => {
              return [...weeklyPattern[d].am, ...weeklyPattern[d].pm].some(isActiveEntry);
            });
            const scheduledProductIds = new Set();
            activeRows.forEach(row => row.products.forEach((_, id) => scheduledProductIds.add(id)));
            const scheduledActiveCount = scheduledProductIds.size;
            const expanded = weeklyExpandedDay;
            return (
              <div className="mt-3 rounded-[16px] px-5 py-5" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent)', fontWeight:600}}>Your routine</div>
                <h3 className="text-[20px] leading-tight mb-1" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.018em'}}>This week</h3>
                <p className="text-[11.5px] mb-3" style={{color:'var(--ink-soft)'}}>
                  {scheduledActiveCount === 0
                    ? 'Daily basics only — no scheduled actives.'
                    : `${scheduledActiveCount} active product${scheduledActiveCount === 1 ? '' : 's'} scheduled across the week.`}
                </p>
                {/* Horizontal week strip + inline expand. Theme
                    labels under each day per Jenni (May 2026 UX
                    pass) — uses getDayFocus so the label matches
                    what the inline expand panel shows above. */}
                <div>
                  <div className="text-[9px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Week at a glance</div>
                  <div className="grid grid-cols-7 gap-1">
                    {dayLetters.map((letter, d) => {
                      const hasActive = dayHasActive[d];
                      const isToday = d === todayIdx;
                      const isSelected = expanded === d;
                      const dayFocus = getDayFocus(weeklyPattern[d].am, weeklyPattern[d].pm);
                      const focusLabel = dayFocus.label || 'Rest';
                      const showFocus = focusLabel !== 'Daily';
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setWeeklyExpandedDay(prev => prev === d ? null : d)}
                          className="flex flex-col items-center gap-1 py-1 transition hover:opacity-80"
                          style={{cursor:'pointer'}}
                          title={`${dayLabels[d]} · ${focusLabel}`}
                        >
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px]"
                            style={{
                              background: isSelected ? 'var(--accent)' : (isToday ? 'var(--cream)' : 'transparent'),
                              color: isSelected ? 'var(--cream)' : 'var(--ink)',
                              border: '1px solid ' + (isSelected || isToday ? 'var(--accent)' : 'var(--line)'),
                              fontWeight: 600,
                            }}
                          >{letter}</span>
                          <span
                            className="text-[8px] tracking-[0.04em] uppercase leading-tight text-center"
                            style={{
                              color: hasActive ? 'var(--accent)' : 'var(--ink-soft)',
                              opacity: hasActive ? 0.85 : 0.5,
                              fontWeight: 500,
                              minHeight: '9px',
                            }}
                          >{showFocus ? focusLabel : '·'}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Inline expanded day panel */}
                  {expanded !== null && (() => {
                    const am = weeklyPattern[expanded].am;
                    const pm = weeklyPattern[expanded].pm;
                    const amConflicts = findConflictsInSlot(am);
                    const pmConflicts = findConflictsInSlot(pm);
                    const hasConflict = amConflicts.length > 0 || pmConflicts.length > 0;
                    const isTodaySelected = expanded === todayIdx;
                    const focus = getDayFocus(am, pm);
                    const explanation = (focus.label === 'Rest' && am.length === 0 && pm.length === 0)
                      ? null
                      : getDayExplanation(focus.label, focus.families, expanded);
                    return (
                      <div className="mt-2 rounded-[12px] px-3 py-2.5" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <div>
                            <span className="text-[9px] tracking-[0.22em] uppercase" style={{color:'var(--ink-soft)', fontWeight:600}}>{dayLongLabels[expanded]}{isTodaySelected ? ' · today' : ''}</span>
                            <span className="text-[11px] ml-2" style={{color:'var(--accent)', fontWeight:600, letterSpacing:'-0.01em'}}>{focus.label}</span>
                          </div>
                          <button
                            onClick={() => setWeeklyExpandedDay(null)}
                            className="text-[10px] tracking-[0.18em] uppercase"
                            style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                            type="button"
                          >Close</button>
                        </div>
                        {/* === ACTIVE vs SUPPORT SPLIT (May 2026 per Jenni) ===
                            The split must be ingredient-family based, not
                            cadence based. A daily retinoid is still a daily
                            active; cleanser/SPF/barrier support stay quieter
                            even when scheduled every day. Signal over noise. */}
                        {(() => {
                          const amActives = am.filter(isActiveEntry);
                          const pmActives = pm.filter(isActiveEntry);
                          const amBasics = am.filter(e => !isActiveEntry(e));
                          const pmBasics = pm.filter(e => !isActiveEntry(e));
                          const selectedActives = rotationSlot === 'am' ? amActives : pmActives;
                          const selectedBasics = rotationSlot === 'am' ? amBasics : pmBasics;
                          const selectedItems = [...selectedActives.map(e => ({ ...e, kind: 'active' })), ...selectedBasics.map(e => ({ ...e, kind: 'basic' }))];
                          return (
                            <div>
                              <div className="rounded-full p-1 grid grid-cols-2 gap-1 mb-3" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                                {[
                                  { id: 'am', label: 'AM routine', icon: 'Sun', count: am.length },
                                  { id: 'pm', label: 'PM routine', icon: 'Moon', count: pm.length },
                                ].map(slot => {
                                  const active = rotationSlot === slot.id;
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => setRotationSlot(slot.id)}
                                      className="rounded-full px-3 py-2 text-[9px] tracking-[0.18em] uppercase flex items-center justify-center gap-1.5 transition"
                                      style={{
                                        background: active ? 'var(--accent-soft)' : 'transparent',
                                        color: active ? 'var(--accent)' : 'var(--ink-soft)',
                                        boxShadow: 'none',
                                        fontWeight: 650,
                                      }}
                                    >
                                      <Icon name={slot.icon} size={11} style={{color: active ? 'var(--accent)' : 'var(--ink-soft)'}} />
                                      {slot.label}
                                      <span style={{color:'var(--ink-soft)', fontWeight:500}}>{slot.count}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {selectedItems.length === 0 ? (
                                <div className="rounded-[14px] border p-4 text-center" style={{background:'var(--cream-deep)', borderColor: 'var(--line)'}}>
                                  <div className="text-[13px] leading-snug" style={{color:'var(--ink)', fontWeight:650}}>No {rotationSlot.toUpperCase()} products planned.</div>
                                  <div className="text-[11px] leading-snug mt-1" style={{color:'var(--ink-soft)'}}>This slot is bare unless you add a product in Shelf or Refine.</div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {selectedActives.length === 0 && selectedBasics.length > 0 && (
                                    <div className="rounded-[14px] border px-3 py-2 text-[11px] leading-snug" style={{background:'var(--cream-deep)', borderColor: 'var(--line)', color:'var(--ink-soft)'}}>
                                      Basics only in this slot. No stronger active scheduled.
                                    </div>
                                  )}
                                  {selectedItems.map(e => renderProductCard(e, e.kind))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {hasConflict && (() => {
                          const slotConflicts = rotationSlot === 'am' ? amConflicts : pmConflicts;
                          if (slotConflicts.length === 0) return null;
                          // === DEDUPE BY FAMILY PAIR (May 2026 bug fix per Jenni) ===
                          // Previously [...amConflicts, ...pmConflicts] rendered one
                          // row per product-pair, so a slot with 3 retinoid-family
                          // products + 1 BHA produced 3 identical Retinoid + BHA
                          // warnings. Group by sorted family pair so we surface
                          // ONE row per unique active collision, listing every
                          // conflicting product on a single line.
                          const grouped = {};
                          slotConflicts.forEach(c => {
                            const aFam = c.a.family || c.a.product.id;
                            const bFam = c.b.family || c.b.product.id;
                            const key = [aFam, bFam].sort().join('|');
                            if (!grouped[key]) {
                              grouped[key] = { products: new Set(), note: c.note };
                            }
                            grouped[key].products.add(compactProductName(c.a.product));
                            grouped[key].products.add(compactProductName(c.b.product));
                          });
                          return (
                            <div className="mt-2.5 pt-2.5 border-t space-y-1" style={{borderColor: 'var(--line)'}}>
                              {Object.values(grouped).map((g, i) => (
                                <p key={i} className="text-[10px] leading-snug" style={{color:'var(--rose)'}}>
                                  <span style={{fontWeight:500}}>{Array.from(g.products).join(' + ')}:</span> {g.note}
                                </p>
                              ))}
                            </div>
                          );
                        })()}
                        {explanation && (
                          <div className="mt-2.5 pt-2.5 border-t flex gap-2" style={{borderColor: 'var(--line)'}}>
                            <Icon name="Sparkles" size={11} style={{color:'var(--accent)', flexShrink:0, marginTop:1, opacity:0.85}} />
                            <div className="min-w-0">
                              <div className="text-[8.5px] tracking-[0.26em] uppercase mb-0.5" style={{color:'var(--ink-soft)', fontWeight:600}}>Why this routine</div>
                              <p className="text-[10.5px] leading-snug" style={{color:'var(--ink-soft)'}}>{explanation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-4 pt-3 border-t" style={{borderColor: 'var(--line)'}}>
                  <div className="text-[9px] tracking-[0.26em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Actives this week</div>
                  {activeRows.length === 0 ? (
                    <div className="text-[11px]" style={{color:'var(--ink-soft)'}}>No stronger actives scheduled.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeRows.map(row => {
                        const days = Array.from(row.days).sort((a,b)=>a-b);
                        const dayTag = days.length === 7 ? 'Daily' : days.map(d => dayLetters[d]).join('·');
                        const slotTag = row.am && row.pm ? 'AM·PM' : row.pm ? 'PM' : 'AM';
                        const names = Array.from(row.products.values()).map(compactProductName).slice(0, 2).join(', ');
                        const extra = row.products.size > 2 ? ` +${row.products.size - 2}` : '';
                        return (
                          <div key={row.family} className="grid items-start gap-3 text-[11.5px]" style={{gridTemplateColumns:'minmax(0, 1fr) auto'}}>
                            <div className="min-w-0 leading-snug">
                              <span style={{color:'var(--ink)', fontWeight:600}}>{FAMILY_NICE[row.family] || 'Active'}</span>
                              <span className="ml-2" style={{color:'var(--ink-soft)', fontWeight:400}}>{names}{extra}</span>
                            </div>
                            <span className="text-[9.5px] tracking-[0.18em] uppercase flex-shrink-0" style={{color:'var(--accent)', fontWeight:600}}>
                              {dayTag} {slotTag}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ===== WEEKLY SUMMARY TALLY (May 2026 — slice 2) =====
              Compact card under the rail. Counts nights/days by
              category and shows a one-line spacing verdict.
              Days can overlap categories (a Brighten + Recovery
              day counts in both). Verdict is heuristic, not AI. */}
          {false && (() => {
            const STRONG = new Set(['retinoid','aha','bha','bpo']);
            const BRIGHT = new Set(['vitc','azelaic','arbutin','tranexamic','kojic']);
            const SOFT   = new Set(['ceramide','panthenol','centella','niacinamide','humectant']);
            let retinoid = 0, exfoliation = 0, brightening = 0, recovery = 0, rest = 0;
            for (let d = 0; d < 7; d++) {
              const fams = new Set();
              [...weeklyPattern[d].am, ...weeklyPattern[d].pm].forEach(e => e.family && fams.add(e.family));
              if (fams.size === 0) { rest++; continue; }
              if (fams.has('retinoid')) retinoid++;
              if (fams.has('aha') || fams.has('bha')) exfoliation++;
              let hasBright = false;
              BRIGHT.forEach(f => { if (fams.has(f)) hasBright = true; });
              if (hasBright) brightening++;
              let strongHit = false;
              STRONG.forEach(f => { if (fams.has(f)) strongHit = true; });
              // Recovery = a day WITHOUT any strong active AND with at least one soft barrier ingredient
              let softHit = false;
              SOFT.forEach(f => { if (fams.has(f)) softHit = true; });
              if (!strongHit && softHit) recovery++;
            }
            const tallyItems = [
              retinoid > 0 ? `${retinoid} retinoid` : null,
              exfoliation > 0 ? `${exfoliation} exfoliation` : null,
              brightening > 0 ? `${brightening} brightening` : null,
              recovery > 0 ? `${recovery} recovery` : null,
              rest === 7 ? '7 rest' : null,
            ].filter(Boolean);
            // Verdict heuristic
            const totalStrong = retinoid + exfoliation;
            let verdict, verdictTone;
            if (rest === 7) {
              verdict = 'No actives scheduled yet.';
              verdictTone = 'var(--ink-soft)';
            } else if (totalStrong >= 5) {
              verdict = 'Your routine is dense — a recovery night would help.';
              verdictTone = 'var(--rose)';
            } else if (totalStrong >= 1 && recovery < 1) {
              verdict = 'Stronger actives scheduled — add a recovery night.';
              verdictTone = 'var(--rose)';
            } else if (recovery >= 2 && totalStrong > 0) {
              verdict = 'Active spacing preserved. Stronger actives kept apart.';
              verdictTone = 'var(--accent)';
            } else if (recovery >= 2) {
              verdict = 'Recovery window maintained.';
              verdictTone = 'var(--accent)';
            } else {
              verdict = 'Cadence: steady.';
              verdictTone = 'var(--ink-soft)';
            }
            return (
              <section className="mt-5 rounded-[14px] px-4 py-4" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                <div className="text-[9px] tracking-[0.28em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>Weekly summary</div>
                {tallyItems.length > 0 ? (
                  <div className="text-[12.5px] leading-snug" style={{color:'var(--ink)', fontWeight:500}}>
                    {tallyItems.map((s, i) => (
                      <span key={i}>
                        {i > 0 && <span style={{color:'var(--ink-soft)', margin:'0 6px'}}>·</span>}
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12px]" style={{color:'var(--ink-soft)'}}>No actives scheduled.</div>
                )}
                <div className="text-[10.5px] mt-2" style={{color:verdictTone, fontWeight:500, letterSpacing:'0.01em'}}>
                  {verdict}
                </div>
              </section>
            );
          })()}

          {/* === FRIDA NOTICED — insight-driven refine prompt (May 2026 per Jenni) ===
              Single observation pulled from recent check-ins + current
              routine. Fires only when a real pattern is detected —
              silent restraint when the week reads steady. Tap opens
              the Refine sheet pre-scoped to the matching intent
              (calm / barrier / recovery / brighten / glow), which
              already knows how to populate shelf picks vs. surface
              curated alternatives. Rules ordered by clinical
              priority: barrier first, then irritation, then
              hydration, then concern-specific (glow / brighten).
              First match wins — one observation, not five. */}
          {false && (() => {
            const recentLogs = (logs || [])
              .filter(l => l && l.metricSnapshot)
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 7);
            if (recentLogs.length < 2) return null; // not enough data
            const tc = (w) => w ? String(w).trim().toLowerCase() : '';
            // === SIGNAL EXTRACTION ===
            // For each metric, count how often the last 7 check-ins
            // sat at a "needs attention" rating. ≥2/7 is the trigger
            // threshold — one bad day is noise.
            const counts = { redness: 0, hydration: 0, breakouts: 0, barrier: 0, sensitivity: 0, texture: 0 };
            for (const l of recentLogs) {
              const s = l.metricSnapshot || {};
              if (['inflamed','reactive','red'].includes(tc(s.redness))) counts.redness++;
              if (['low','very low','dry','dehydrated'].includes(tc(s.hydration))) counts.hydration++;
              if (['active','many','breaking out','flaring'].includes(tc(s.breakouts))) counts.breakouts++;
              if (['compromised','stripped','damaged'].includes(tc(s.barrier))) counts.barrier++;
              if (['inflamed','reactive','sensitive'].includes(tc(s.sensitivity))) counts.sensitivity++;
              if (['rough','uneven','bumpy'].includes(tc(s.texture))) counts.texture++;
            }
            // === SHELF FAMILY CHECK ===
            // What active families does the user already have on the
            // shelf? Drives copy — "you have centella, layer it more"
            // vs. "consider adding centella" — and ties into the
            // Refine intent shelf picker.
            const shelfFamilies = new Set(activeProducts
              .map(p => detectActiveFamily(p.activeIngredients || p.actives || ''))
              .filter(Boolean));
            const has = (...fams) => fams.some(f => shelfFamilies.has(f));
            // === RULE LADDER ===
            // Each rule: condition → { observation, intent, refineCard }.
            // refineCard maps to the quickRefinements list in
            // RegimenBuildView so the Refine sheet picker fires
            // correctly when the user taps the tile.
            const rules = [
              {
                fire: () => counts.barrier >= 2,
                observation: has('ceramide','panthenol')
                  ? 'Barrier readings keep coming back compromised. You already have ceramides — layer them earlier in the routine.'
                  : 'Barrier readings keep coming back compromised. No ceramides on your shelf — worth adding.',
                intent: { id: 'barrier', label: 'Strengthen Barrier', icon: 'Shield', prompt: 'My barrier feels compromised. Audit my routine and propose changes to reinforce ceramides, lipids, and reduce barrier stressors.' },
              },
              {
                fire: () => counts.redness >= 2 || counts.sensitivity >= 2,
                observation: has('centella','panthenol')
                  ? 'Redness or sensitivity showed up in multiple check-ins. You have centella — push it harder this week.'
                  : 'Redness or sensitivity showed up in multiple check-ins. No centella or panthenol on your shelf — worth adding for calming.',
                intent: { id: 'irritation', label: 'Reduce Irritation', icon: 'Leaf', prompt: 'My skin is irritated and I want to dial back. What in my current routine could be triggering it, and what would you swap or pause?' },
              },
              {
                fire: () => counts.hydration >= 2,
                observation: has('humectant','ceramide')
                  ? 'Hydration\'s been low. Layer a humectant under your moisturizer, not over.'
                  : 'Hydration\'s been low and you don\'t have a dedicated humectant. Worth adding hyaluronic acid or glycerin.',
                intent: { id: 'barrier', label: 'Strengthen Barrier', icon: 'Shield', prompt: 'My barrier feels compromised. Audit my routine and propose changes to reinforce ceramides, lipids, and reduce barrier stressors.' },
              },
              {
                fire: () => counts.breakouts >= 2 && !has('bha','bpo'),
                observation: 'Breakouts trending up. You don\'t have BHA or BPO on your shelf — worth considering.',
                intent: { id: 'glow', label: 'Increase Glow', icon: 'Sparkles', prompt: 'I want more glow. Where can I tighten my current routine to push radiance — actives, timing, or layering?' },
              },
              {
                fire: () => counts.texture >= 2 && !has('aha','retinoid'),
                observation: 'Texture\'s been uneven. No exfoliating actives in your rotation — worth adding glycolic or retinoid.',
                intent: { id: 'glow', label: 'Increase Glow', icon: 'Sparkles', prompt: 'I want more glow. Where can I tighten my current routine to push radiance — actives, timing, or layering?' },
              },
            ];
            const insight = rules.find(r => r.fire());
            if (!insight) return null;
            return (
              <section
                className="mt-5 rounded-[16px] px-5 py-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(199, 231, 245, 0.24) 0%, rgba(255, 246, 201, 0.18) 100%)',
                  border: '1px solid rgba(134, 202, 231, 0.34)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5" style={{background:'rgba(255, 246, 201, 0.58)'}}>
                    <Icon name="Sparkles" size={13} style={{color:'var(--accent-gold)'}} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] tracking-[0.32em] uppercase mb-1.5" style={{color:'var(--accent-gold)', fontWeight:600}}>Frida noticed</div>
                    <p className="text-[12.5px] leading-snug" style={{color:'var(--ink)', fontWeight:500}}>{insight.observation}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof setRefineIntent === 'function') setRefineIntent(insight.intent);
                        if (typeof setRefineSheetOpen === 'function') setRefineSheetOpen(true);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full transition hover:opacity-90"
                      style={{background:'var(--accent-blue)', color:'var(--ink)', fontWeight:600, cursor:'pointer'}}
                    >
                      <span>Refine for this</span>
                      <Icon name="ArrowRight" size={10} />
                    </button>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* === CHANGE YOUR WEEK FOOTER ===
              Quiet card at the bottom inviting a rebuild. Routes
              back to the Build wizard while preserving the user's
              selections (state isn't cleared), so they can adjust
              one piece without re-doing everything. Shown in both
              view modes — it's a global action, not view-specific. */}
          <section className="mt-5 rounded-[14px] px-4 py-4 flex items-center justify-between gap-3" style={{background:'var(--cream)', border: '1px solid var(--line)'}}>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.012em'}}>Want to change your week?</div>
              <div className="text-[11px] mt-0.5" style={{color:'var(--ink-soft)'}}>Refine from the wizard — your inputs are saved.</div>
            </div>
            <button
              onClick={() => { setBuildPlan(null); setBuildPlanAccepted(false); setBuildStep(1); setRegimenView('build'); }}
              className="flex-shrink-0 pill-btn secondary"
              type="button"
            >
              <Icon name="RotateCcw" size={12} style={{marginRight:6}} />
              Refine
            </button>
          </section>
        </div>
      )}
    </div>
  );
  })();
};
