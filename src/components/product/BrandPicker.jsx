// === BrandPicker (Wave 2 extract — May 2026) ===
// Module-scope, no App-state coupling. All inputs via props.
// Behavior identical to prior inline definition.

// === BRAND PICKER (module scope) ===
// Owns the search-typing state LOCALLY so each keystroke renders only this
// component, not the entire ProductModal. Without this, typing in the brand
// search felt like "one letter at a time" because each setState in App
// recreated the ProductModal subtree and re-mounted the input.
//
// ⚠️ ALL BRAND ORDERING MUST GO THROUGH sortBrandsForPicker /
// scoreBrandForPicker (src/resolvers/brandRanking.js). Do not sort
// brands by count or alphabet alone. The check_build.js guard fails the
// build if `counts[b] - counts[a]` reappears here or if BrandPicker
// stops referencing the shared helpers — previous regressions had each
// picker invent its own scoring and drift apart over time.
//
// === RANKING (Phase 2 — May 2026) ===
// All sort logic delegated to sortBrandsForPicker / scoreBrandForPicker
// from src/resolvers/brandRanking.js (Phase 1). This component does not
// invent its own ordering anymore — that was the source of past drift
// where brand browse, product search, scan results, and shelf
// suggestions each ranked things slightly differently.
//   - No query: list ranked by priority + popularity (Rhode, Summer
//     Fridays, CeraVe, etc. at the top). Label "Popular brands."
//   - With query: scoreBrandForPicker returns +800 exact / +400 prefix /
//     +200 word-start / +100 substring / −1000 no-match. We keep only
//     brands with a positive score (i.e., something matched).
//   - User's shelf brands get +60 — small bump so a user already
//     using CeraVe sees CeraVe a little higher when browsing.
const BrandPicker = React.memo(function BrandPicker({ brands, counts, onPick, onBack, products }) {
  const [q, setQ] = React.useState('');
  const ql = (q || '').trim();
  // Derive shelf-brand set once per `products` change. memoized so each
  // keystroke doesn't rebuild the Set.
  const shelfBrands = React.useMemo(() => {
    const s = new Set();
    if (Array.isArray(products)) {
      for (const p of products) {
        if (p && p.brand && !p.endDate) s.add(p.brand);
      }
    }
    return s;
  }, [products]);
  // Score each brand, filter out no-match when query is active, sort by
  // score descending. Recomputed on every keystroke (O(n) per render
  // with ~50 brands — cheap, no debounce needed).
  const ranked = React.useMemo(() => {
    const list = Array.isArray(brands) ? brands : [];
    const scored = list.map(b => ({ b, score: scoreBrandForPicker(b, ql, counts, shelfBrands) }));
    const filtered = ql ? scored.filter(s => s.score > 0) : scored;
    filtered.sort((a, b) => b.score - a.score);
    return filtered.map(s => s.b);
  }, [brands, ql, counts, shelfBrands]);
  return (
    <div className="space-y-2.5">
      <button
        onClick={onBack}
        className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-90 border cursor-pointer"
        style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream-deep)', cursor:'pointer'}}
      >
        <Icon name="ArrowLeft" size={11} /> Back
      </button>
      <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
        <Icon name="Search" size={12} style={{color:'var(--ink-soft)'}} />
        <input
          type="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for a brand…"
          className="flex-1 bg-transparent border-0 focus:outline-none text-[12.5px]"
          style={{color:'var(--ink)'}}
        />
      </div>
      {/* Label rule (Phase 2): "Popular brands" only appears when the
          list IS actually priority/popular sorted — which is only true
          with no query. Query active → count + "match" / "matches". */}
      <div className="text-[8.5px] tracking-[0.25em] uppercase mt-1.5" style={{color:'var(--ink-soft)'}}>
        {ql ? `${ranked.length} ${ranked.length === 1 ? 'match' : 'matches'}` : 'Popular brands'}
      </div>
      <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
        {ranked.slice(0, 80).map(b => {
          const initials = b.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <button
              key={b}
              onClick={() => onPick(b)}
              className="w-full flex items-center gap-3 py-2.5 px-1 border-b transition hover:bg-[var(--cream-deep)] cursor-pointer text-left"
              style={{borderColor: 'var(--line)', cursor:'pointer'}}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-sans text-[10px]" style={{background:'var(--cream-deep)', color:'var(--ink-soft)', border: '1px solid var(--line)'}}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-sans text-[13px] leading-tight truncate" style={{color:'var(--ink)'}}>{b}</div>
                <div className="text-[9.5px] mt-0.5" style={{color:'var(--ink-soft)'}}>{counts[b]} {counts[b] === 1 ? 'product' : 'products'}</div>
              </div>
              <Icon name="ChevronRight" size={12} style={{color:'var(--ink-soft)'}} />
            </button>
          );
        })}
        {ranked.length === 0 && (
          <p className="text-[11px] py-3 text-center" style={{color:'var(--ink-soft)'}}>Nothing matches. Try less.</p>
        )}
      </div>
    </div>
  );
});


// Editorial Modal frame — replaces the old Modal. Same API (children/onClose/title/
// compact) plus optional `eyebrow` and `action`/`actionLabel` for a primary CTA in the
// sticky header. Body sits on cream; sticky header is cream too with a hairline rule
// for visual continuity. Title gets the cover's serif display treatment.
