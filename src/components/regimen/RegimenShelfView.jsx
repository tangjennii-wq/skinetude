// === RegimenShelfView (Wave 8.1 sub-extract — May 2026) ===
// The `shelf` sub-view of RegimenView. Mounted when
// `regimenView === 'shelf'`. ~760 lines lifted.

const RegimenShelfView = ({
  generatedProductArt,
  logs,
  openChat,
  products,
  regimenLogs,
  saveData,
  setCoverRoutineRebuildToken,
  setEditingProductId,
  setProducts,
  setShowProductModal,
  toast,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  assessProduct,
  assessingProduct,
  deleteProduct,
  expandedShelfProductId, setExpandedShelfProductId,
  productAssessment,
  regenerateProductAlternatives,
  setMatchesDrawerFilter,
  setMatchesDrawerOpen,
  setOpenLesson,
  setProductCompareId,
  setShelfTagFilter,
  setShowInactiveProducts, showInactiveProducts,
}) => {
  return (() => {
  // Categorize: a product flagged as a retinoid (active or tag) gets its own group regardless of stored category.
  // Otherwise we use the stored category.
  const RETINOID_RE = /(retinol|retinaldehyde|retinoid|tretinoin|adapalene|trifarotene|tazarotene|granactive)/i;
  const ACID_RE = /(salicylic|glycolic|lactic|mandelic|azelaic|citric|aha|bha|pha)/i;
  const VITC_RE = /(ascorbic|ascorbyl|ascorbate|vitamin\s*c|c.?ferulic)/i;
  const groupOf = (p) => {
    const hay = `${p.activeIngredients || ''} ${(p.tags || []).join(' ')} ${p.name || ''}`;
    if (RETINOID_RE.test(hay)) return 'retinoid';
    if (VITC_RE.test(hay)) return 'vitamin-c';
    if (ACID_RE.test(hay)) return 'acid';
    return (p.category || 'other').toLowerCase();
  };
  // Display order — clinical/derm-friendly: morning-y to night-y, treatments grouped.
  const ORDER = ['cleanser', 'toner', 'vitamin-c', 'serum', 'moisturizer', 'sunscreen', 'retinoid', 'acid', 'treatment', 'exfoliant', 'mask', 'oil', 'other'];
  const LABEL = {
    cleanser: 'Cleansers',
    toner: 'Toners',
    'vitamin-c': 'Vitamin C',
    serum: 'Serums',
    moisturizer: 'Moisturizers',
    sunscreen: 'Sunscreens',
    retinoid: 'Retinoids',
    acid: 'Acids · Exfoliants',
    treatment: 'Treatments',
    exfoliant: 'Exfoliants',
    mask: 'Masks',
    oil: 'Oils',
    other: 'Other',
  };
  // Active = currently in routine (no endDate). Inactive = retired (endDate set).
  // We render active first, grouped by category. Inactive sits in a collapsed
  // section at the bottom so big shelves don't drown in retired clutter.
  const activeProductsList = products.filter(p => !p.endDate);
  const inactiveProductsList = products.filter(p => p.endDate);
  // === WASTED-SPEND LOOKUP ===
  // Build map of productId → most recent regimen-log date the product
  // appeared in (AM or PM). Products on the shelf with no recent usage
  // get a quiet "Xd unused" chip + "Not earning its place" warning if
  // it's been 30+ days. Return-cause #5 (save money / flag waste).
  // Threshold: 30 days untouched = flagged. 60+ = "wasted."
  const todayISO = localDateISO();
  const todayMs = new Date(todayISO).getTime();
  const lastUsedById = (() => {
    const map = {};
    (regimenLogs || []).forEach(r => {
      [...(r.amProducts || []), ...(r.pmProducts || [])].forEach(pid => {
        if (!map[pid] || r.date > map[pid]) map[pid] = r.date;
      });
    });
    return map;
  })();
  const usageStatusFor = (p) => {
    const last = lastUsedById[p.id];
    if (!last) {
      // Never logged. Use the product's createdAt / startDate / id timestamp
      // as the "added" anchor so a product added yesterday isn't flagged.
      const added = p.startDate ? new Date(p.startDate).getTime()
                  : p.id ? Number(p.id) // id is Date.now() at create
                  : todayMs;
      const ageDays = Math.floor((todayMs - added) / 86400000);
      if (ageDays >= 30) return { kind: 'wasted', label: 'Never used' };
      if (ageDays >= 14) return { kind: 'idle', label: 'Not used yet' };
      return null;
    }
    const lastMs = new Date(last).getTime();
    const days = Math.floor((todayMs - lastMs) / 86400000);
    if (days >= 60) return { kind: 'wasted', label: `${days}d unused` };
    if (days >= 30) return { kind: 'idle', label: `${days}d unused` };
    return null;
  };
  const grouped = {};
  activeProductsList.forEach(p => {
    const g = groupOf(p);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(p);
  });
  const sortedGroups = ORDER.filter(g => grouped[g] && grouped[g].length > 0)
    .concat(Object.keys(grouped).filter(g => !ORDER.includes(g)));

  return (
    <>
      {products.length === 0 ? (
        <EmptyState icon="Package" text="Empty shelf, empty mind. One product to start." action={() => setShowProductModal(true)} actionText="+ Product" />
      ) : (
        /* === GROUPED COMPACT LISTS — category headings + expand-on-click rows ===
            Removed the big full-width +Product CTA — the upper-right
            pill in EditorialPageHeader is now the single canonical
            add affordance, uniform across Today/Shelf/Build/Occasions. */
        <div className="space-y-5">
          {sortedGroups.map(groupKey => {
            const items = grouped[groupKey];
            return (
              <div key={groupKey}>
                <div className="text-[9px] tracking-[0.3em] uppercase mb-1.5 flex items-baseline justify-between" style={{color:'var(--ink-soft)'}}>
                  <span>{LABEL[groupKey] || groupKey}</span>
                  <span className="font-serif italic text-[10px] normal-case tracking-normal" style={{color:'var(--ink-soft)'}}>{items.length}</span>
                </div>
                <div className="border" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
                  {items.map((product, idx) => {
            const expanded = expandedShelfProductId === product.id;
            // First active = main active for the compact row preview
            const firstActive = product.activeIngredients
              ? product.activeIngredients.split(',').map(a => a.trim()).filter(Boolean)[0]
              : null;
            const inAM = Array.isArray(product.useTimes) && product.useTimes.includes('am');
            const inPM = Array.isArray(product.useTimes) && product.useTimes.includes('pm');
            const toggleSlot = (slot) => {
              const cur = Array.isArray(product.useTimes) ? product.useTimes : [];
              const next = cur.includes(slot) ? cur.filter(t => t !== slot) : [...cur, slot];
              const updated = products.map(pp => pp.id === product.id ? { ...pp, useTimes: next } : pp);
              setProducts(updated);
              saveData('products', updated);
              // AM/PM membership shifts the cover Recommended inputs.
              setCoverRoutineRebuildToken(t => t + 1);
            };
            return (
              <div key={product.id} style={{borderTop: idx === 0 ? 'none' : '1px solid var(--line)'}}>
                <div
                  className="w-full flex items-center gap-2 px-3 py-2 transition"
                  style={{background: expanded ? 'var(--cream-deep)' : 'transparent'}}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedShelfProductId(expanded ? null : product.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0 hover:opacity-80"
                  >
                    {/* Shelf thumbnail — real photo > AI bottle > dashed outline.
                        Mirrors the regimen / cover lineup so every product
                        surface shows the same icon and the user can scan by sight. */}
                    {(() => {
                      const aiArt = generatedProductArt && generatedProductArt[`prod-${product.id}`];
                      const hasReal = product.photo || product.photoPath;
                      return (
                        <div className="flex-shrink-0 w-9 h-12 flex items-end justify-center overflow-hidden">
                          {hasReal ? (
                            <Photo item={product} alt={product.name || ''} className="h-full w-auto max-w-full object-contain"
                              renderFallback={() => aiArt
                                ? <img src={aiArt} alt="" className="h-full w-auto max-w-full object-contain" />
                                : <DashedBottleOutline />}
                            />
                          ) : aiArt ? (
                            <img src={aiArt} alt="" className="h-full w-auto max-w-full object-contain" />
                          ) : (
                            <DashedBottleOutline />
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      {/* Brand eyebrow — small uppercase tracked label
                          above the product name. Surfaces the brand
                          identity that was missing from the shelf row
                          (per Jenni: every product needs the brand or
                          common name visible, not just the descriptor). */}
                      {product.brand && (
                        <div className="text-[9px] tracking-[0.22em] uppercase truncate" style={{color:'var(--ink-soft)'}}>{product.brand}</div>
                      )}
                      <span className="text-[13px] md:text-sm leading-tight block truncate" style={{color:'var(--ink)', fontWeight:500, letterSpacing:'-0.01em'}}>{product.name || 'Unnamed product'}</span>
                      {(() => {
                        // Wasted-spend chip — fires when 30+ days since
                        // last use, or never used after 14d on shelf.
                        // 'wasted' = rose tone (60+ days or never used 30+).
                        // 'idle' = soft ink-soft (30-59 days).
                        const status = usageStatusFor(product);
                        if (!status && !firstActive) return null;
                        return (
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            {status && (
                              <span
                                className="text-[8.5px] tracking-[0.05em] italic px-1.5 py-0.5 rounded-full"
                                style={{
                                  color: status.kind === 'wasted' ? 'var(--rose)' : 'var(--ink-soft)',
                                  background: status.kind === 'wasted' ? 'rgba(192,138,138,0.08)' : 'var(--cream-deep)',
                                  border: `1px solid ${status.kind === 'wasted' ? 'var(--rose)' : 'var(--line)'}`,
                                }}
                                title={status.kind === 'wasted' ? 'Not earning its place — consider retiring or restarting' : 'Hasn\'t been used in your recent regimen'}
                              >
                                {status.label}
                              </span>
                            )}
                            {firstActive && (
                              <span className="text-[10px] font-light truncate hidden md:block max-w-[40%]" style={{color:'var(--ink-soft)'}}>{firstActive}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </button>
                  {/* Inline AM/PM toggles — controls Today's Regimen visibility per product. */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSlot('am'); }}
                    className="text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full border transition flex items-center gap-1 flex-shrink-0"
                    style={{
                      borderColor: inAM ? 'var(--accent)' : 'var(--line)',
                      background: inAM ? 'var(--accent)' : 'transparent',
                      color: inAM ? 'var(--cream)' : 'var(--ink-soft)',
                    }}
                    title={inAM ? 'Used in morning routine — tap to remove' : 'Tap to add to morning routine'}
                  >
                    <Icon name="Sun" size={8} /> AM
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSlot('pm'); }}
                    className="text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full border transition flex items-center gap-1 flex-shrink-0"
                    style={{
                      borderColor: inPM ? 'var(--accent)' : 'var(--line)',
                      background: inPM ? 'var(--accent)' : 'transparent',
                      color: inPM ? 'var(--cream)' : 'var(--ink-soft)',
                    }}
                    title={inPM ? 'Used in evening routine — tap to remove' : 'Tap to add to evening routine'}
                  >
                    <Icon name="Moon" size={8} /> PM
                  </button>
                  {/* === ACTIVE STATE AFFORDANCE ===
                      Per Jenni (May 2026): the green "ON" pill was
                      visual clutter when AM and PM weren't selected
                      — a product with no usage time is effectively
                      not in rotation, so a CTA-to-retire reads more
                      honestly than a green active badge.
                      • If AM or PM is selected → keep the green ON
                        pill (genuinely active in routine).
                      • If neither → show italicized small grey
                        "Make inactive" link as the CTA to retire.
                      • If product is already inactive → small grey
                        "Inactive · undo" link as the path back. */}
                  {(() => {
                    const isActive = !product.endDate;
                    const hasUsageSlot = inAM || inPM;
                    const toggleActive = (e) => {
                      e.stopPropagation();
                      const today = localDateISO();
                      const updated = products.map(pp => pp.id === product.id ? { ...pp, endDate: isActive ? today : null } : pp);
                      setProducts(updated);
                      saveData('products', updated);
                      toast(isActive ? `${product.name} marked inactive` : `${product.name} reactivated`, 'info');
                    };
                    // === SHELF ROW ACTIVE-STATE AFFORDANCE ===
                    // Per Jenni (May 2026): the green "ON" pill was
                    // visual clutter — when AM or PM is selected the
                    // pill itself indicates the product is in rotation,
                    // so a redundant ON badge added nothing. Only show
                    // an affordance in the TWO states that need user
                    // attention:
                    //   • inactive → small grey "Inactive · undo"
                    //   • active + no slot selected → "Make inactive"
                    // Active + at least one slot → nothing (the AM/PM
                    // pill already telegraphs "in rotation").
                    if (!isActive) {
                      return (
                        <button
                          type="button"
                          onClick={toggleActive}
                          className="text-[9.5px] italic flex-shrink-0 hover:underline transition"
                          style={{color:'var(--ink-soft)'}}
                          title="Tap to reactivate"
                        >Inactive · undo</button>
                      );
                    }
                    if (hasUsageSlot) {
                      // In rotation. No extra badge needed — AM/PM
                      // pills carry the meaning.
                      return null;
                    }
                    // Active but no slot selected — the "limbo" state.
                    return (
                      <button
                        type="button"
                        onClick={toggleActive}
                        className="text-[9.5px] italic flex-shrink-0 hover:underline transition"
                        style={{color:'var(--ink-soft)'}}
                        title="No AM/PM slot. Tap to retire."
                      >Make inactive</button>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => setExpandedShelfProductId(expanded ? null : product.id)}
                    className="flex-shrink-0 p-0.5 hover:opacity-70"
                    style={{color:'var(--ink-soft)'}}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                  >
                    <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={11} />
                  </button>
                </div>

                {/* Expanded detail panel */}
                {expanded && (
                  <div className="px-3 pb-3 pt-1 border-t" style={{borderColor:'var(--line)', background:'var(--cream-deep)'}}>
                    {/* === NO BOTTLE IMAGERY ===
                        Per Jenni's "no bottle images" rule (May 2026):
                        the Photo + Package-fallback block that used to
                        sit here is intentionally deleted. The analysis
                        is text-forward — let the content carry the
                        card, no decorative bottle/cube. */}
                    <div className="flex gap-3 flex-wrap md:flex-nowrap mt-2">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{product.brand}</div>
                        {/* Actives — single horizontal scroll row.
                            Wrapping caused the chips to take 2-3 lines on
                            mobile when product had 4+ actives (e.g. AESTURA
                            with niacinamide + 3 ceramides). One-row scroll
                            keeps the card compact. */}
                        {product.activeIngredients && (
                          <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
                            {product.activeIngredients.split(',').map(a => a.trim()).filter(Boolean).map((a, i) => {
                              const pct = a.match(/\b(\d+(?:\.\d+)?)\s*%/);
                              const label = a.replace(/\s*\b\d+(?:\.\d+)?\s*%/, '').trim();
                              return (
                                <span key={i} className="inline-flex items-baseline gap-1 text-[10px] px-1.5 py-0.5 border rounded-sm flex-shrink-0 whitespace-nowrap" style={{borderColor:'var(--ink)', color:'var(--ink)', background:'var(--cream)'}}>
                                  <span className="font-medium">{label || a}</span>
                                  {pct && <span className="font-serif italic text-[10px]" style={{color:'var(--accent)'}}>{pct[1]}%</span>}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {/* Main supporting ingredients */}
                        {product.mainIngredients && (
                          <div className="text-[10px] font-light leading-snug" style={{color:'var(--ink-soft)'}}>
                            <span className="text-[8px] tracking-[0.2em] uppercase mr-1.5">Also</span>
                            {product.mainIngredients}
                          </div>
                        )}
                        {/* Tags */}
                        {product.tags && product.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {product.tags.map((t, i) => (
                              <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setShelfTagFilter(t); }} className="text-[9px] tracking-[0.1em] px-1.5 py-0.5 border rounded-full transition" style={{borderColor:'var(--accent)', color:'var(--accent)', background:'var(--cream)'}}>{t}</button>
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] font-light" style={{color:'var(--ink-soft)'}}>
                          {product.frequency.replace(/-/g, ' ')}
                          {product.startDate
                            ? ` · started ${new Date(product.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                            : ' · not started yet'}
                          {product.endDate && ` · stopped ${new Date(product.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </div>
                        {product.notes && <p className="text-[11px] italic font-light" style={{color:'var(--ink-soft)'}}>"{product.notes}"</p>}

                        {/* === AI Assessment block — sectioned render ===
                             Parses the structured output from assessProduct() into
                             Mechanism / Evidence / Alternatives. NEVER dumps raw text.
                             Two hard gates added to fix the "full-length raw blob"
                             bug: (1) while assessingProduct === product.id, show ONLY
                             the "Analyzing…" pulse — suppress any stale or in-flight
                             content. (2) If the response can't be parsed into sections
                             (legacy format, malformed AI output), render NOTHING here
                             — better to hide than to leak raw text into the UI. */}
                        {assessingProduct === product.id ? (
                          <div className="pt-2 mt-2 border-t flex items-center gap-1.5 pulse-soft" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>
                            <Icon name="Loader2" size={10} className="spin" />
                            <span className="text-[9px] tracking-[0.2em] uppercase">Analyzing…</span>
                          </div>
                        ) : (product.aiAnalysis || productAssessment[product.id]) && (() => {
                          const raw = productAssessment[product.id] || product.aiAnalysis || '';
                          // === Robust section walker ===
                          // Find every line-start LABEL: occurrence in the raw text and
                          // slice between them. This is more reliable than per-section
                          // regex because it forces a strict label-boundary cut — no
                          // way for "alternatives"-related prose to leak into earlier
                          // sections like Mechanism/Evidence/Reviews even if the AI
                          // accidentally name-drops them mid-sentence.
                          const sections = {};
                          const labelRe = /^\s*(MECHANISM|EVIDENCE|REVIEWS|CONFLICTS|ALTERNATIVES|ASSESSMENT)\s*:\s*/gmi;
                          let lastLabel = null;
                          let lastIndex = 0;
                          let m;
                          while ((m = labelRe.exec(raw)) !== null) {
                            if (lastLabel !== null) {
                              sections[lastLabel] = raw.slice(lastIndex, m.index).trim();
                            }
                            lastLabel = m[1].toUpperCase();
                            lastIndex = m.index + m[0].length;
                          }
                          if (lastLabel !== null) {
                            sections[lastLabel] = raw.slice(lastIndex).trim();
                          }
                          // Defensive scrub — strip any stray "ALTERNATIVES" content if
                          // it accidentally got captured under another label (e.g. AI
                          // wrote run-on prose). For non-ALTERNATIVES sections, drop
                          // any line starting with "1." or "2." or matching the
                          // CHEAPER/SIMILAR-OR-HIGHER tier markers.
                          const scrubAltLeak = (text) => {
                            if (!text) return '';
                            return text.split(/\n/).filter(l => {
                              const t = l.trim();
                              return !/^\s*[12]\.\s*(CHEAPER|SIMILAR)/i.test(t)
                                  && !/^\s*(CHEAPER|SIMILAR-OR-HIGHER)\s*\|/i.test(t);
                            }).join('\n').trim();
                          };
                          const mechanism = scrubAltLeak(sections.MECHANISM || sections.ASSESSMENT || ''); // backwards-compat
                          const evidence = scrubAltLeak(sections.EVIDENCE || '');
                          const alternativesRaw = sections.ALTERNATIVES || '';
                          const isStructured = !!(mechanism && (evidence || alternativesRaw));
                          // Parse alternatives lines: "1. CHEAPER | Brand X | ~$Y | active | rationale"
                          const altLines = isStructured
                            ? alternativesRaw.split(/\n/).map(l => l.trim()).filter(l => /^\s*[12]\./.test(l))
                            : [];
                          const parsedAlts = altLines.map(line => {
                            const cleaned = line.replace(/^\s*[12]\.\s*/, '');
                            const parts = cleaned.split(/\s*\|\s*/).map(s => s.trim());
                            return {
                              tier: parts[0] || '',
                              name: parts[1] || '',
                              price: parts[2] || '',
                              active: parts[3] || '',
                              rationale: parts.slice(4).join(' | ') || '',
                            };
                          });
                          const isRegenAlts = assessingProduct === product.id;
                          // Split mechanism + evidence into bullets.
                          // Mechanism: keep the first 2 sentences max, render
                          // as bullet list (the AI tends to give 1-3 short
                          // sentences; 2 is a tight visual cap).
                          // Evidence: collapse to a single bullet (one
                          // sentence, or join multiple with " · ").
                          const splitSentences = (text) => (text || '')
                            .replace(/\n+/g, ' ')
                            .split(/(?<=[.!?])\s+(?=[A-Z\[])/)
                            .map(s => s.trim())
                            .filter(Boolean);
                          const mechanismBullets = splitSentences(mechanism).slice(0, 2);
                          const evidenceBullets = splitSentences(evidence).slice(0, 1);
                          return (
                            <div className="pt-2 mt-2 border-t space-y-2" style={{borderColor:'var(--line)'}}>
                              {/* Sectioned render — Mechanism (max 2 bullets) +
                                  Evidence (1 bullet) inline, Alternatives in a
                                  compact stacked list below. The "Pharmacist +
                                  derm read" eyebrow was redundant given the
                                  section labels and was dropped for compactness. */}
                              {isStructured ? (
                                <div className="space-y-2">
                                  {mechanismBullets.length > 0 && (
                                    <div>
                                      <div className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--accent)'}}>Mechanism</div>
                                      <ul className="space-y-0.5">
                                        {mechanismBullets.map((b, i) => (
                                          <li key={i} className="flex gap-1.5 text-[11px] leading-snug font-light" style={{color:'var(--ink)'}}>
                                            <span style={{color:'var(--accent)'}}>·</span>
                                            <span
                                              className="flex-1"
                                              style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                              }}
                                            >{withPearls(b, setOpenLesson)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {evidenceBullets.length > 0 && (
                                    <div>
                                      <div className="text-[8px] tracking-[0.2em] uppercase mb-1" style={{color:'var(--accent)'}}>Evidence</div>
                                      <div className="flex gap-1.5 text-[11px] leading-snug font-light" style={{color:'var(--ink)'}}>
                                        <span style={{color:'var(--accent)'}}>·</span>
                                        <span className="flex-1">{withPearls(evidenceBullets[0], setOpenLesson)}</span>
                                      </div>
                                    </div>
                                  )}
                                  {parsedAlts.length > 0 && (
                                    <div className="mt-2.5">
                                      {/* Alternatives — compact stacked list, NOT a
                                          bordered grid. Each row: tier label + price
                                          on left, italic name + active + rationale
                                          flowing right. Hairline divider between rows
                                          only — no surrounding heavy border. */}
                                      <div className="flex items-baseline justify-between mb-1.5">
                                        <div className="text-[8px] tracking-[0.2em] uppercase" style={{color:'var(--accent)'}}>Alternatives</div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); regenerateProductAlternatives(product); }}
                                          disabled={isRegenAlts}
                                          className="text-[9px] tracking-[0.18em] uppercase italic flex items-center gap-1 transition hover:opacity-70 disabled:opacity-50"
                                          style={{color:'var(--accent)'}}
                                          title="Get a different pair of alternatives"
                                        >
                                          {isRegenAlts ? <><Icon name="Loader2" size={9} className="spin" /> Re-roll</> : <><Icon name="RefreshCw" size={9} /> Re-roll</>}
                                        </button>
                                      </div>
                                      {/* Side-by-side grid (2 cols on mobile too — fits because
                                          each card is compact). Each cell stacks tier label, price,
                                          product name, and a short pill with the active. The wordy
                                          rationale was killed — kept the tier + price + name + active
                                          so the swap suggestion reads at a glance. */}
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {parsedAlts.map((a, i) => {
                                          const isCheap = a.tier.toLowerCase().includes('cheap');
                                          return (
                                            <div
                                              key={i}
                                              className="rounded-[10px] px-2.5 py-2 min-w-0"
                                              style={{background:'var(--cream)', border:'1px solid var(--line)'}}
                                            >
                                              <div className="flex items-baseline justify-between gap-1.5 mb-1">
                                                <span className="text-[8px] tracking-[0.15em] uppercase" style={{color:'var(--ink-soft)'}}>
                                                  {isCheap ? '↓ Cheap' : '↑ Premium'}
                                                </span>
                                                {a.price && <span className="font-serif italic text-[10.5px] leading-none" style={{color:'var(--accent)'}}>{a.price}</span>}
                                              </div>
                                              <div className="font-serif italic text-[11.5px] leading-tight mb-1" style={{color:'var(--ink)'}}>{a.name}</div>
                                              {a.active && (
                                                <div className="text-[9.5px] leading-tight" style={{color:'var(--ink-soft)'}}>{a.active}</div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // BUG FIX: Was dumping raw `whitespace-pre-wrap` text
                                // when the AI response didn't match the strict
                                // MECHANISM:/EVIDENCE:/ALTERNATIVES: format. That
                                // produced the long ugly blob ("picture 2"). Render
                                // nothing here instead — the next assessment run will
                                // produce a clean structured pass.
                                null
                              )}
                            </div>
                          );
                        })()}
                        {product.analyzing && !product.aiAnalysis && (
                          <div className="pt-2 mt-2 border-t flex items-center gap-1.5 pulse-soft" style={{borderColor:'var(--line)', color:'var(--ink-soft)'}}>
                            <Icon name="Loader2" size={10} className="spin" />
                            <span className="text-[9px] tracking-[0.2em] uppercase">{product.photo ? 'Reading label…' : 'Looking up…'}</span>
                          </div>
                        )}

                        {/* Compare summary line — only shown if there's a usage anchor (explicit
                             startDate, regimen check-ins, or photo-tag). The Compare button gates
                             on hasEnoughData to avoid promising a comparison the data can't sustain. */}
                        {(() => {
                          const a = findProductCompareAnchors(product, products, regimenLogs, logs);
                          if (!a.startDate) return null;
                          const weeks = a.daysActive >= 7 ? `${Math.round(a.daysActive / 7)}w` : `${a.daysActive}d`;
                          const sourceLabel = a.startSource === 'explicit' ? 'started' : 'first logged';
                          return (
                            <div className="pt-2 mt-2 border-t flex items-center justify-between gap-2 flex-wrap" style={{borderColor:'var(--line)'}}>
                              <div className="text-[10px] font-light" style={{color:'var(--ink-soft)'}}>
                                <span className="font-serif italic" style={{color:'var(--ink)'}}>{sourceLabel} ~{weeks} ago</span>
                                <span> · {a.photoCount} {a.photoCount === 1 ? 'photo' : 'photos'} since</span>
                              </div>
                              {a.hasEnoughData ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setProductCompareId(product.id); }}
                                  className="text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1.5 transition hover:opacity-70"
                                  style={{color:'var(--accent)'}}
                                >
                                  Compare <Icon name="ArrowRight" size={11} />
                                </button>
                              ) : (
                                <span className="text-[10px] italic" style={{color:'var(--ink-soft)'}}>{a.reasonShort}</span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Action row */}
                        <div className="flex gap-1.5 pt-1.5 flex-wrap">
                          <button onClick={(e) => { e.stopPropagation(); assessProduct(product); }} disabled={assessingProduct === product.id} className="text-[9px] tracking-[0.18em] uppercase border px-2 py-1 transition disabled:opacity-50 flex items-center gap-1" style={{borderColor:'var(--ink)', color:'var(--ink)'}}>
                            {assessingProduct === product.id ? <><Icon name="Loader2" size={9} className="spin" /> Analyzing</> : <><Icon name="Sparkles" size={9} /> {product.aiAnalysis || productAssessment[product.id] ? 'Re-analyze' : 'Assess'}</>}
                          </button>
                          {(product.aiAnalysis || productAssessment[product.id]) && (
                            <button onClick={(e) => { e.stopPropagation(); openChat({
                              context: `Assessment of ${product.name} by ${product.brand} (${product.category}, ${product.activeIngredients || 'unknown actives'}):\n\n${productAssessment[product.id] || product.aiAnalysis}`,
                              title: product.name,
                              subtitle: 'Product assessment',
                              image: product.photo, imagePath: product.photoPath,
                              suggestions: [
                                'Where in my routine should I use this?',
                                'What pairs well with this?',
                                'What should I avoid combining?',
                                'Worth keeping?'
                              ]
                            }); }} className="text-[9px] tracking-[0.18em] uppercase italic flex items-center gap-1 px-2 py-1" style={{color:'var(--ink)'}}>
                              <Icon name="MessageCircle" size={9} /> Ask
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setEditingProductId(product.id); setShowProductModal(true); }} className="text-[9px] tracking-[0.18em] uppercase italic flex items-center gap-1 px-2 py-1" style={{color:'var(--ink-soft)'}}><Icon name="Edit2" size={9} /> Edit</button>
                          {/* Active/inactive toggle — sets endDate to today to mark as retired
                              (uses existing endDate field, no schema change). Inactive products
                              live in their own group on the shelf to reduce active-list clutter. */}
                          {product.endDate ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = products.map(p => p.id === product.id ? { ...p, endDate: null } : p);
                                setProducts(updated);
                                saveData('products', updated);
                                toast(`${product.name} reactivated`);
                              }}
                              className="text-[9px] tracking-[0.18em] uppercase italic flex items-center gap-1 px-2 py-1"
                              style={{color:'var(--accent)'}}
                            ><Icon name="RotateCcw" size={9} /> Reactivate</button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const today = localDateISO();
                                const updated = products.map(p => p.id === product.id ? { ...p, endDate: today } : p);
                                setProducts(updated);
                                saveData('products', updated);
                                toast(`${product.name} marked inactive`);
                              }}
                              className="text-[9px] tracking-[0.18em] uppercase italic flex items-center gap-1 px-2 py-1"
                              style={{color:'var(--ink-soft)'}}
                              title="Move to inactive — hides from daily routine but keeps in journal history"
                            ><Icon name="Archive" size={9} /> Make inactive</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); deleteProduct(product.id); }} className="text-[9px] tracking-[0.18em] uppercase italic flex items-center gap-1 px-2 py-1" style={{color:'var(--ink-soft)'}}><Icon name="Trash2" size={9} /> Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
                  })}
                </div>
              </div>
            );
          })}

          {/* === INACTIVE PRODUCTS — collapsed by default ===
              Retired products kept here so they don't pollute the active routine
              but stay accessible for compare/journal history. */}
          {inactiveProductsList.length > 0 && (
            <div className="border-t pt-4 mt-2" style={{borderColor:'var(--line)'}}>
              <button
                onClick={() => setShowInactiveProducts(v => !v)}
                className="w-full flex items-baseline justify-between text-left"
              >
                <span className="text-[10px] tracking-[0.3em] uppercase italic" style={{color:'var(--ink-soft)'}}>
                  Inactive · {inactiveProductsList.length}
                </span>
                <span className="text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1" style={{color:'var(--ink-soft)'}}>
                  {showInactiveProducts ? <>Hide <Icon name="ChevronUp" size={11} /></> : <>Show <Icon name="ChevronDown" size={11} /></>}
                </span>
              </button>
              {showInactiveProducts && (
                <div className="border mt-2" style={{borderColor:'var(--line)', background:'var(--cream)'}}>
                  {inactiveProductsList.map((product, idx) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-2 px-3 py-2"
                      style={{borderTop: idx === 0 ? 'none' : '1px solid var(--line)', opacity: 0.7}}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-serif italic text-[13px] truncate" style={{color:'var(--ink)'}}>{product.name}</div>
                        <div className="text-[10px] font-light" style={{color:'var(--ink-soft)'}}>
                          Retired {new Date(product.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const updated = products.map(p => p.id === product.id ? { ...p, endDate: null } : p);
                          setProducts(updated);
                          saveData('products', updated);
                          toast(`${product.name} reactivated`);
                        }}
                        className="text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1 px-2 py-1 flex-shrink-0"
                        style={{color:'var(--accent)'}}
                      ><Icon name="RotateCcw" size={10} /> Reactivate</button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="text-[10px] tracking-[0.2em] uppercase italic flex items-center gap-1 px-2 py-1 flex-shrink-0"
                        style={{color:'var(--ink-soft)'}}
                      ><Icon name="Trash2" size={10} /> Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* === WHAT WE'D TRY (Shelf footer — May 2026) ===
          Migrated from Atelier cover + Build sub-tab. Sits at
          the bottom of Shelf as a designed section with breathing
          room. Five focus-area tiles open the matches drawer
          (same component as before — just relocated). */}
      {(() => {
        const categories = [
          { id: 'repair',   label: 'Barrier',  icon: 'Shield',   blurb: 'Ceramides, Squalane' },
          { id: 'calm',     label: 'Calm',     icon: 'Leaf',     blurb: 'Centella, Panthenol' },
          { id: 'hydrate',  label: 'Hydrate',  icon: 'Droplet',  blurb: 'Hyaluronic, Glycerin' },
          { id: 'brighten', label: 'Brighten', icon: 'Sun',      blurb: 'Niacinamide, Vit C' },
          { id: 'exfoliate', label: 'Exfoliate', icon: 'Zap',    blurb: 'AHA, BHA' },
        ];
        const openCategory = (catId) => {
          const filterId = catId === 'exfoliate' ? 'brighten' : catId;
          setMatchesDrawerFilter(filterId);
          setMatchesDrawerOpen(true);
        };
        return (
          <section className="mt-12 mb-4 rounded-[20px] px-5 py-6 md:px-6 md:py-7" style={{background:'var(--cream-deep)', border:'1px solid var(--line)'}}>
            <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
              <div>
                <div className="text-[9.5px] tracking-[0.32em] uppercase mb-2" style={{color:'var(--ink-soft)', fontWeight:600}}>What we'd try</div>
                <div className="text-[22px] leading-tight" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.018em'}}>Add to your shelf.</div>
                <div className="text-[11.5px] mt-1.5 leading-snug max-w-[460px]" style={{color:'var(--ink-soft)'}}>Pick a focus area — tap to see new finds we'd reach for.</div>
              </div>
              <button
                onClick={() => { setMatchesDrawerFilter('all'); setMatchesDrawerOpen(true); }}
                className="text-[10px] tracking-[0.22em] uppercase flex items-center gap-1 transition hover:opacity-70 flex-shrink-0 mt-1"
                style={{color:'var(--accent)', cursor:'pointer', fontWeight:600}}
                title="See everything"
              >
                See all <Icon name="ArrowRight" size={11} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => openCategory(c.id)}
                  className="relative rounded-[14px] px-3 pt-3 pb-7 text-left transition hover:bg-[var(--cream)] hover:border-[var(--accent)] group"
                  style={{background:'var(--cream)', border:'1px solid var(--line)', cursor:'pointer'}}
                  type="button"
                  title={`See ${c.label.toLowerCase()} matches`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{background:'var(--cream-deep)', color:'var(--accent)', border:'1px solid var(--line)'}}>
                    <Icon name={c.icon} size={14} />
                  </div>
                  <div className="text-[14px] leading-tight" style={{color:'var(--ink)', fontWeight:600, letterSpacing:'-0.01em'}}>{c.label}</div>
                  <div
                    className="text-[10.5px] mt-0.5 leading-snug"
                    style={{
                      color:'var(--ink-soft)',
                      fontWeight:400,
                      height:'2.6em',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      textAlign:'center',
                    }}
                  >{c.blurb}</div>
                  <span
                    aria-hidden
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 transition group-hover:opacity-100 group-hover:translate-x-[calc(-50%+2px)]"
                    style={{color:'var(--accent)', opacity:0.55}}
                  >
                    <Icon name="ArrowRight" size={12} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })()}
    </>
  );
  })();
};
