// === ProductModal (Wave 5.1 extract — May 2026) ===
// Pulled out of App so the ~2300-line modal can be reasoned about
// independently. Previously lived inside App as a useMemo wrapper around
// a productModalImplRef.current closure — a workaround for the in-App
// component-identity bug that closed mobile-Safari's keyboard. With the
// component extracted to module scope, identity is stable by default and
// the impl-ref workaround is unnecessary; the component takes plain
// props and React reconciles in-place.
//
// All App-scope state + setters are passed as explicit props.
// Module-scope helpers (Modal, Icon, BrandPicker, ProposeSlotCard,
// StarterProductPreview, DashedBottleOutline, Photo, StableInput,
// localDateISO, fileToBase64, getApiKey, callClaude/etc.) stay global.

const ProductModal = ({
  logs,
  products, setProducts,
  regimenLogs, setRegimenLogs,
  user,
  editingProductId, setEditingProductId,
  productForm, setProductForm,
  productModalRegimenContext, setProductModalRegimenContext,
  setShowProductModal,
  setShowApiKeyModal,
  setCoverRoutineRebuildToken,
  setActiveTab,
  setRegimenView,
  ritualForm, ritualFormRef, setRitualForm,
  modalScrollMemo,
  useModalScrollPreserve,
  callClaude,
  saveData,
  toast,
  // === MECHANICAL PROP BRIDGE (May 2026 audit) ===
  // Wave 5.1 left these App-scope refs unbridged. Each is touched by some
  // ProductModal flow (scan, brand picker, dupe check, deep fill, etc.).
  onboardingState,
  brandSelectedKeys, setBrandSelectedKeys,
  bypassDupeCheckRef,
  callGeminiVision,
  cleanProductPhotoWithGemini,
  productBrandCatFilter, setProductBrandCatFilter,
  productBrandSelected, setProductBrandSelected,
  setProductBrandSearch,
  productDeepFilling, setProductDeepFilling,
  productDetected, setProductDetected,
  productDupeWarning, setProductDupeWarning,
  productEntryMode, setProductEntryMode,
  productHasSearched, setProductHasSearched,
  productNameSearching, setProductNameSearching,
  productNameSuggestions, setProductNameSuggestions,
  productNeedsLabelHelp, setProductNeedsLabelHelp,
  productReadingLabel, setProductReadingLabel,
  productSaveFlash, setProductSaveFlash,
  productScanBatch, setProductScanBatch,
  productScanBatchProgress, setProductScanBatchProgress,
  productScanError, setProductScanError,
  productScanPhoto, setProductScanPhoto,
  productScanning, setProductScanning,
  productSearchError, setProductSearchError,
  productSearchInput, setProductSearchInput,
  productSearchInputResetKey, setProductSearchInputResetKey,
  productUrlFetchError, setProductUrlFetchError,
  productUrlFetching, setProductUrlFetching,
  setExpandedShelfProductId,
  setUseTodayPrompt,
  setPromoteToRoutinePrompt,
  addMenuReturnContext,
  onReturnToAddMenu}) => {
  const editingProduct = editingProductId ? products.find(p => p.id === editingProductId) : null;
  const isEditing = !!editingProduct;
  // === HOISTED FORM STATE ===
  // Same fix pattern as scan: ProductModal recreates on each App re-render and would wipe
  // local form state. By aliasing the App-scope productForm + setters, the form survives
  // re-renders triggered by toasts, async API responses, and other parent activity.
  // Initial seeding is handled by the useEffect at App scope (runs when modal opens).
  // Stable seed object — same safety pattern as SkinLogModal. Used for display
  // before productForm is hydrated AND as the safe base for functional setForm
  // updates so spreads never operate on null.
  const productFormSeed = editingProduct ? {
    name: editingProduct.name || '',
    brand: editingProduct.brand || '',
    category: editingProduct.category || 'serum',
    startDate: editingProduct.startDate || '',
    endDate: editingProduct.endDate || '',
    activeIngredients: editingProduct.activeIngredients || '',
    mainIngredients: editingProduct.mainIngredients || '',
    tags: editingProduct.tags || [],
    concerns: editingProduct.concerns || [],
    useDays: editingProduct.useDays || [0,1,2,3,4,5,6],
    useTimes: editingProduct.useTimes || ['am','pm'],
    frequency: editingProduct.frequency || 'daily',
    notes: editingProduct.notes || '',
    photo: editingProduct.photo || null,
    photoPath: editingProduct.photoPath || null,
    status: editingProduct.status || 'active'} : {
    name: '', brand: '', category: 'serum', startDate: '',
    endDate: '', activeIngredients: '', mainIngredients: '', tags: [], concerns: [],
    // useTimes starts EMPTY so the user must explicitly tap Morning or
    // Evening — making the AM/PM placement an intentional choice instead
    // of an auto-selected default.
    useDays: [0,1,2,3,4,5,6], useTimes: [],
    frequency: 'daily', notes: '', photo: null, photoPath: null, status: 'active'
  };
  const form = productForm || productFormSeed;
  const setForm = (updater) => {
    setProductForm(prev => {
      const base = prev || productFormSeed;
      return typeof updater === 'function' ? updater(base) : updater;
    });
  };
  const searchInput = productSearchInput;
  const setSearchInput = setProductSearchInput;
  const searchInputResetKey = productSearchInputResetKey;
  const bumpSearchReset = () => setProductSearchInputResetKey(k => k + 1);
  const urlFetching = productUrlFetching;
  const setUrlFetching = setProductUrlFetching;
  const urlFetchError = productUrlFetchError;
  const setUrlFetchError = setProductUrlFetchError;
  const nameSuggestions = productNameSuggestions;
  const setNameSuggestions = setProductNameSuggestions;
  const nameSearching = productNameSearching;
  const setNameSearching = setProductNameSearching;
  const deepFilling = productDeepFilling;
  const setDeepFilling = setProductDeepFilling;
  const readingLabel = productReadingLabel;
  const setReadingLabel = setProductReadingLabel;
  const needsLabelHelp = productNeedsLabelHelp;
  const setNeedsLabelHelp = setProductNeedsLabelHelp;
  // === Scan state — hoisted to parent so it survives App re-renders. ===
  // ProductModal is recreated every render (it's declared inside App), which means React
  // sees a different component type and unmounts/remounts on every parent state change.
  // Local useState here would wipe between Claude's vision call returning and the user
  // being able to interact with the result. Aliasing to the hoisted state keeps it stable.
  const entryMode = isEditing ? 'manual' : productEntryMode;
  const setEntryMode = setProductEntryMode;
  const scanPhoto = productScanPhoto;
  const setScanPhoto = setProductScanPhoto;
  const scanning = productScanning;
  const setScanning = setProductScanning;
  const scanError = productScanError;
  const setScanError = setProductScanError;
  const detectedProducts = productDetected;
  const setDetectedProducts = setProductDetected;
  const scanFileRef = useRef();
  const scanGalleryRef = useRef();
  // Webcam-capture state for the desktop / browser path. On mobile the
  // file-input with capture="environment" still triggers iOS Safari's
  // native camera; on desktop we open CameraCaptureModal in product mode.
  const [scanShowCamera, setScanShowCamera] = useState(false);
  // T3 (May 31 2026): "Just added" chip strip. After a successful single-add
  // we land back on the entry-mode picker — without this chip the user has
  // no acknowledgement of what they just saved (no row, no name, no edit
  // affordance). Clearing happens when the user chooses a new entry mode
  // or explicitly taps the chip to edit. Stores {id, brand, name} so the
  // chip can render and route into edit mode without an extra products lookup.
  const [lastAddedProduct, setLastAddedProduct] = useState(null);
  const isTouchDevice = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
  const openProductScanCamera = () => {
    setScanError('');
    // Mobile: native file input with capture="environment" opens the phone camera
    // and returns directly to this modal. Desktop: open the in-app getUserMedia
    // camera instead of Finder. If camera APIs are unavailable, fall back to files.
    const hasBrowserCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    if (!isTouchDevice && hasBrowserCamera) {
      setScanShowCamera(true);
      return;
    }
    scanFileRef.current?.click();
  };
  const nameSearchCacheRef = useRef({});
  const fileRef = useRef();
  // Scroll preservation across App-induced remounts.
  const scrollSentinelRef = useModalScrollPreserve('product');
  const isUrl = (s) => /^https?:\/\//i.test(s.trim()) || /^www\./i.test(s.trim()) || /\.(com|net|co|io|store|shop)\b/i.test(s.trim());

  // === DEEP FILL ===
  // Called after the user picks a suggestion or pastes a URL. Asks Claude for a complete
  // structured fill — actives w/ %, main ingredients, tags, concerns — guaranteed by a
  // dedicated targeted call (rather than relying on partial JSON from the search step).
  const deepFillProduct = async ({ name, brand, category, url }) => {
    const seedLine = url
      ? `Product URL: ${url}`
      : `Product: ${brand ? brand + ' — ' : ''}${name || ''}${category ? ' (' + category + ')' : ''}`;
    const prompt = `${seedLine}

Return EXACTLY this format using your knowledge of this real-world skincare product.

CRITICAL — CONCENTRATION HONESTY (May 2026 — Frida rule):
• If the brand LABELS or PUBLISHES the concentration, return the number as-is: "Niacinamide 10%"
• If the concentration is INDUSTRY-STANDARD or WIDELY-CITED but not on the label, prefix with a tilde + add "(est.)": "Niacinamide ~10% (est.)"
• If you don't know the concentration with reasonable confidence, return the ingredient WITHOUT a number: "Niacinamide"
• NEVER invent a number. A confidently-wrong percentage is worse than no percentage.
• For products without any specific actives, return empty ACTIVES — that's a real answer.

NAME: [product name only, no brand]
BRAND: [brand name]
CATEGORY: [exactly one of: cleanser, toner, serum, moisturizer, sunscreen, treatment, exfoliant, mask, oil, other]
ACTIVES: [comma-separated, following the concentration rule above. Examples: "Niacinamide 10%, Zinc PCA 1%" (labeled) | "Vitamin C ~15% (est.), Vitamin E ~1% (est.), Ferulic Acid ~0.5% (est.)" (commonly-cited but not on label) | "Snail Secretion Filtrate" (no labeled concentration)]
MAIN_INGREDIENTS: [3-6 supporting ingredients beyond actives — humectants, emollients, soothers, comma-separated]
TAGS: [4-7 short lowercase-hyphenated tags, e.g. "brightening, vitamin-c, antioxidant, anti-aging, hydrating"]
CONCERNS: [comma-separated concerns this product targets, ONLY from this list: hyperpigmentation, redness, enlarged-pores, dark-circles, wrinkles, sun-damage, dryness, dullness, oiliness, sensitivity, texture, blemishes, fine-lines. Empty if no clear target.]`;
    // === D: Deep-fill — Opus 4.6 ===
    // One-shot per product, latency is acceptable here (no typing UX). Opus's broader
    // ingredient/concentration knowledge produces noticeably tighter actives + concerns
    // mapping than Haiku, especially for Korean/Japanese brands.
    const result = await callClaude(prompt, '', null, { model: 'claude-opus-4-6', maxTokens: 800 });
    const grab = (k) => { const m = result.match(new RegExp(k + ':\\s*(.+)')); return m ? m[1].trim() : ''; };
    const validCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
    const VALID_CONCERNS = ['oil-control','pores','redness','uneven-tone','dullness','texture','hyperpigmentation','sensitivity','barrier','acne','dryness','dark-circles','wrinkles','fine-lines','sun-damage'];
    const parseList = (s, validList) => s.split(',').map(x => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean).filter(x => !validList || validList.includes(x)).slice(0, 8);
    const catRaw = grab('CATEGORY').toLowerCase();
    return {
      name: grab('NAME') || name || '',
      brand: grab('BRAND') || brand || '',
      category: validCats.includes(catRaw) ? catRaw : (category || 'serum'),
      activeIngredients: grab('ACTIVES'),
      mainIngredients: grab('MAIN_INGREDIENTS'),
      tags: parseList(grab('TAGS')),
      concerns: parseList(grab('CONCERNS'), VALID_CONCERNS)};
  };

  // Debounced name lookup. Hits Claude with the partial name and asks for 5 likely matches.
  // Cached client-side per query string to avoid re-fetching the same partials.
  // Manual name search — fired by the user explicitly tapping the Search button or pressing Enter.
  // No auto-debounce. Result caches per query so re-tapping the same string is instant.
  const searchError = productSearchError;
  const setSearchError = setProductSearchError;
  const hasSearched = productHasSearched;
  const setHasSearched = setProductHasSearched;
  const runNameSearch = async () => {
    const q = (searchInput || '').trim();
    if (!q) return;
    if (isUrl(q)) { handleFetchFromUrl(); return; }
    if (q.length < 2) { setSearchError('Type at least a couple of characters first.'); return; }
    if (!getApiKey()) { setSearchError('Add your Anthropic API key first.'); setShowApiKeyModal(true); return; }
    setSearchError('');
    setHasSearched(true);
    // Cache hit
    if (nameSearchCacheRef.current[q]) {
      setNameSuggestions(nameSearchCacheRef.current[q]);
      if (nameSearchCacheRef.current[q].length === 0) setSearchError('No matches — try a different name or paste a link.');
      return;
    }
    setNameSearching(true);
    try {
      const prompt = `User is searching for a skincare product. They typed: "${q}"

FIRST, classify what the user typed:
(A) BRAND-ONLY (e.g. "anua", "cerave", "skinceuticals", "beauty of joseon") — return that brand's 5 most popular / hero products. ALL 5 results MUST share that brand.
(B) BRAND + PRODUCT (e.g. "anua niacinamide", "cerave moisturizer") — return up to 5 matching products, all from that brand if possible.
(C) PRODUCT NAME or INGREDIENT (e.g. "niacinamide serum", "vitamin c") — return up to 5 popular products famous for that, across multiple brands.
(D) URL or PRODUCT URL FRAGMENT — treat as B and return the closest match.

Prioritize well-known brands (CeraVe, La Roche-Posay, The Ordinary, Drunk Elephant, SkinCeuticals, Paula's Choice, Anua, Beauty of Joseon, COSRX, Glow Recipe, Sunday Riley, AESTURA, REJURAN, SK-II, Dr. Jart, Innisfree, Laneige, Tower 28, Versed, Youth To The People, etc.).

CRITICAL — CONCENTRATION HONESTY (May 2026 — Frida rule):
• If the brand LABELS or PUBLISHES the concentration, return the number as-is: "Niacinamide 10%"
• If it's INDUSTRY-STANDARD or WIDELY-CITED but not on the label, prefix with a tilde + "(est.)": "Vitamin C ~15% (est.), Vitamin E ~1% (est.), Ferulic Acid ~0.5% (est.)"
• If you don't know the concentration with reasonable confidence, return the ingredient WITHOUT a number: "Snail Secretion Filtrate"
• NEVER invent a number. A confidently-wrong percentage is worse than no percentage.
• For products without any meaningful actives (basic hydrating cleanser, plain moisturizer), return empty actives — that's a real answer.

Return ONLY a JSON array (no prose, no code fences). Each item must have these exact keys:
- "name": product name (no brand)
- "brand": brand name
- "category": one of cleanser, toner, serum, moisturizer, sunscreen, treatment, exfoliant, mask, oil, other
- "actives": active ingredients WITH PERCENTAGES, comma-separated string. Always include %. E.g. "Niacinamide 10%, Zinc PCA 1%" — NEVER just "Niacinamide" alone.
- "main": 3-5 supporting/structural ingredients (humectants, emollients, soothers), comma-separated. E.g. "Hyaluronic Acid, Ceramide NP, Glycerin, Squalane"
- "tags": array of 4-6 short lowercase-hyphenated benefit tags. E.g. ["niacinamide","oil-control","blemish-prone","texture"]
- "concerns": array of skin concerns this product targets, from this list ONLY: ["hyperpigmentation","redness","enlarged-pores","dark-circles","wrinkles","sun-damage","dryness","dullness","oiliness","sensitivity","texture","blemishes","fine-lines"]

Example output:
[{"name":"Niacinamide 10% + Zinc 1%","brand":"The Ordinary","category":"serum","actives":"Niacinamide 10%, Zinc PCA 1%","main":"Pentylene Glycol, Tamarindus Indica, Glycerin","tags":["niacinamide","oil-control","blemish-prone","texture"],"concerns":["enlarged-pores","oiliness","texture","blemishes"]}]`;
      // Haiku 4.5 — fast for structured product lookups
      const result = await callClaude(prompt, '', null, { model: 'claude-haiku-4-5-20251001', maxTokens: 1200 });
      let parsed = [];
      try {
        const cleaned = result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(cleaned.slice(start, end + 1));
        }
      } catch (e) {
        console.warn('Suggestion parse failed:', e);
      }
      const safe = (Array.isArray(parsed) ? parsed : []).slice(0, 5).map(p => ({
        name: String(p.name || ''),
        brand: String(p.brand || ''),
        category: String(p.category || 'serum'),
        actives: String(p.actives || ''),
        main: String(p.main || ''),
        tags: Array.isArray(p.tags) ? p.tags.map(t => String(t).toLowerCase().replace(/\s+/g, '-')).slice(0, 8) : [],
        concerns: Array.isArray(p.concerns) ? p.concerns.map(c => String(c).toLowerCase().replace(/\s+/g, '-')).slice(0, 8) : []
      })).filter(p => p.name && p.brand);
      // Merge with local matches (local first, Claude fills the rest, dedupe by brand+name).
      const localFirst = searchLocalProducts(q);
      const seen = new Set(localFirst.map(p => `${p.brand}::${p.name}`.toLowerCase()));
      const claudeUnique = safe.filter(p => !seen.has(`${p.brand}::${p.name}`.toLowerCase()));
      const merged = [...localFirst, ...claudeUnique].slice(0, 10);
      nameSearchCacheRef.current[q] = merged;
      setNameSuggestions(merged);
      if (merged.length === 0) setSearchError('No matches — try a different name or paste a link.');
    } catch (e) {
      console.error('Name search failed:', e);
      setSearchError('Search failed. Check your API key or try again.');
    }
    setNameSearching(false);
  };

  // === LOCAL DB MATCH ===
  // ⚠️ ALL PRODUCT ORDERING MUST GO THROUGH sortProductsForSearch /
  // scoreProductForSearch (src/resolvers/brandRanking.js). Do not
  // invent local scoring here — that's what kept "cerave" returning
  // obscure CeraVe SKUs ahead of hero items for months. The
  // check_build.js guard fails the build if this function stops
  // referencing one of the shared helpers.
  //
  // Synchronous fuzzy match against the bundled POPULAR_PRODUCTS list. No
  // network, returns instantly.
  //
  // Two-step:
  //   1. Token-AND filter — `${brand} ${name}` must contain EVERY token
  //      in the query. Keeps multi-word queries like "anua niac"
  //      reachable. This is the EXISTENCE check.
  //   2. Rank via sortProductsForSearch (Phase 1 helper) — applies
  //      brand priority, hero boost (+100 per product.hero), popular
  //      flag, query relevance, and user shelf-brand boost (+60). One
  //      shared ranking source across BrandPicker, ProductModal local
  //      search, and any future scan-result list.
  //
  // Phase 3 (May 2026) replaced the inline scoring (brand-prefix > name-
  // prefix > +20 brand-token > +40 hero) with the shared scorer. The old
  // inline rules drifted from BrandPicker's; the helper keeps them in
  // sync. Acceptance: searching "cicapair" puts Dr. Jart+ Cicapair first;
  // "cerave" surfaces CeraVe hero products before obscure CeraVe items;
  // "skin" does not bury SkinCeuticals/Skinbetter behind low-priority
  // brands.
  const searchLocalProducts = (q) => {
    const query = (q || '').toLowerCase().trim();
    if (!query || query.length < 2) return [];
    const tokens = query.split(/\s+/).filter(Boolean);
    const matched = (POPULAR_PRODUCTS || []).filter(p => {
      const haystack = `${(p.brand || '').toLowerCase()} ${(p.name || '').toLowerCase()}`;
      return tokens.every(t => haystack.includes(t));
    });
    // sortProductsForSearch derives shelf brands from `products` (the
    // user's current shelf in App scope, captured by the ProductModal
    // closure) — no need to pre-build the Set here.
    return sortProductsForSearch(matched, query, products).slice(0, 8);
  };

  // === TYPEAHEAD AUTO-SEARCH ===
  // Two-stage:
  //   1. INSTANT (debounced 120ms): match against POPULAR_PRODUCTS in JS — no API call.
  //      User sees results almost as they type.
  //   2. CLAUDE FALLBACK (debounced 600ms): if local match returned < 3 results
  //      AND the query hasn't already been Claude-searched, fire a Claude call to
  //      fill in obscure brands. Skipped entirely when local matches are abundant.
  // The manual Search button still forces a Claude call regardless.
  const lastSearchedQRef = useRef('');
  useEffect(() => {
    if (isEditing) return;
    const q = (searchInput || '').trim();
    if (q.length < 2) return;
    if (isUrl(q)) return;

    // Stage 1: instant local match (cheap; just runs JS).
    // Dedupe state writes — only update when results actually change OR
    // hasSearched flips. Without this, every keystroke re-set the same
    // suggestions array, causing a visible re-render flicker on the dropdown.
    const localTimer = setTimeout(() => {
      const local = searchLocalProducts(q);
      if (local.length === 0) return;
      const fp = local.map(p => `${p.brand}|${p.name}`).join(';');
      const prevFp = (nameSuggestions || []).map(p => `${p.brand}|${p.name}`).join(';');
      if (fp !== prevFp) setNameSuggestions(local);
      if (!hasSearched) setHasSearched(true);
    }, 200);

    // Stage 2: Claude fallback if the local hit is sparse.
    const claudeTimer = setTimeout(() => {
      if (q.length < 3) return;
      if (q === lastSearchedQRef.current) return;
      if (nameSearching || deepFilling || urlFetching) return;
      const local = searchLocalProducts(q);
      // Skip Claude entirely when we already have plenty of local hits.
      if (local.length >= 5) return;
      lastSearchedQRef.current = q;
      runNameSearch();
    }, 600);

    return () => { clearTimeout(localTimer); clearTimeout(claudeTimer); };
  }, [searchInput, isEditing, nameSearching, deepFilling, urlFetching, nameSuggestions, hasSearched]);

  // === VISION LABEL READ ===
  // Used when (a) user uploads a bottle photo, or (b) deep fill came back empty. Reads the
  // label visually and fills any missing fields without overwriting what the user has typed.
  const readLabelFromPhoto = async (photoB64) => {
    if (!photoB64) return;
    if (!getApiKey()) { setShowApiKeyModal && setShowApiKeyModal(true); return; }
    setReadingLabel(true);
    try {
      const prompt = `A bottle/label photo is attached. Read the label visually and extract the product details. Use OCR + your training knowledge of skincare products. Prefer evidence-based answers — but DO NOT invent percentages, ingredients, or claims that the brand does not publicly disclose. When a value is not on the label and not publicly disclosed by the brand, return "unknown" for that field. Honesty about gaps is more useful than guessed numbers.

Return EXACTLY this format:
NAME: [product name only, no brand]
BRAND: [brand name as printed on the label, or "unknown"]
CATEGORY: [exactly one of: cleanser, toner, serum, moisturizer, sunscreen, treatment, exfoliant, mask, oil, other]
ACTIVES: [comma-separated active ingredients WITH PERCENTAGES only if visible on the label or publicly disclosed by the brand, e.g. "Niacinamide 10%, Zinc PCA 1%". If a percentage is not disclosed, list the ingredient without a percentage: "Niacinamide, Zinc PCA". If actives are entirely unknown, write "unknown".]
MAIN_INGREDIENTS: [3-6 supporting ingredients beyond actives — humectants, emollients, soothers. Use "unknown" if not visible.]
TAGS: [4-7 short lowercase-hyphenated benefit tags]
CONCERNS: [comma-separated concerns this product targets, ONLY from this list: hyperpigmentation, redness, enlarged-pores, dark-circles, wrinkles, sun-damage, dryness, dullness, oiliness, sensitivity, texture, blemishes, fine-lines]`;
      // === C: Single-bottle label read — Gemini 2.5 Flash, Claude fallback ===
      // Gemini's vision wins on small label text + Korean/Japanese brand recognition.
      // If Gemini fails (key missing, network, or quota), fall back to Haiku so the
      // flow never silently breaks.
      let result;
      try {
        result = await callGeminiVision(photoB64, prompt, { maxTokens: 1000 });
      } catch (gErr) {
        console.warn('[Gemini single-label] failed, falling back to Claude:', gErr.message);
        result = await callClaude(prompt, '', photoB64, { model: 'claude-haiku-4-5-20251001', maxTokens: 700 });
      }
      const grab = (k) => { const m = result.match(new RegExp(k + ':\\s*(.+)')); return m ? m[1].trim() : ''; };
      const validCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
      const VALID_CONCERNS = ['oil-control','pores','redness','uneven-tone','dullness','texture','hyperpigmentation','sensitivity','barrier','acne','dryness','dark-circles','wrinkles','fine-lines','sun-damage'];
      const parseList = (s, validList) => s.split(',').map(x => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean).filter(x => !validList || validList.includes(x)).slice(0, 8);
      const catRaw = grab('CATEGORY').toLowerCase();
      const newName = grab('NAME');
      const newBrand = grab('BRAND');
      const newActives = grab('ACTIVES');
      const newMain = grab('MAIN_INGREDIENTS');
      const newTags = parseList(grab('TAGS'));
      const newConcerns = parseList(grab('CONCERNS'), VALID_CONCERNS);
      // Only fill what's empty — don't overwrite the user's edits
      setForm(prev => ({
        ...prev,
        name: prev.name || newName,
        brand: prev.brand || newBrand,
        category: (validCats.includes(catRaw) && (!prev.category || prev.category === 'serum')) ? catRaw : prev.category,
        activeIngredients: prev.activeIngredients || newActives,
        mainIngredients: prev.mainIngredients || newMain,
        tags: (prev.tags && prev.tags.length) ? prev.tags : newTags,
        concerns: (prev.concerns && prev.concerns.length) ? prev.concerns : newConcerns}));
      if (newActives || newMain) setNeedsLabelHelp(false);
      // Per Jenni: silent on Gemini work — the form fields auto-fill,
      // which is visible feedback. No toast needed for success.
    } catch (e) {
      console.warn('Label read failed:', e);
      // Soft inline state instead of a toast so users still get the cue
      // when nothing autofilled — kept brief, no Gemini brand reference.
      setNeedsLabelHelp(true);
    }
    setReadingLabel(false);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setForm(prev => ({...prev, photo: b64}));
    // Auto-trigger vision read whenever the user uploads a photo.
    readLabelFromPhoto(b64);
    // Background: clean up the product photo via Gemini ("Nano Banana") so
    // it ends up on a uniform cream background, no clutter. Silent-fail on
    // any error so the original photo stays. Counts against the image cap.
    (async () => {
      try {
        const cleaned = await cleanProductPhotoWithGemini(b64);
        if (cleaned && cleaned !== b64) {
          setForm(prev => ({ ...prev, photo: cleaned }));
          toast('Photo cleaned ✨', 'info');
        }
      } catch (err) {
        console.warn('[product-photo cleanup] failed:', err.message);
        // Keep original photo silently.
      }
    })();
  };

  // === SCAN MULTIPLE PRODUCTS FROM ONE PHOTO (batched version) ===
  // Same prompt + parsing as detectProductsFromPhoto, but RETURNS the
  // parsed array instead of mutating state. Used by analyzeAllScanPhotos
  // to process each photo in a multi-photo batch without clobbering the
  // accumulated detected list.
  const detectProductsFromPhotoBatched = async (photoB64) => {
    // === GEMINI-FIRST (May 2026 v2 — Codex flagged) ===
    // Was: `if (!photoB64 || !getApiKey()) return [];` — the Anthropic-
    // key gate blocked Gemini from even being tried. Gemini's proxy
    // routes through Supabase + device-id, so it works WITHOUT a user
    // key. New users (no Anthropic key) get a fully functional scan
    // via Gemini. Users WITH a key get Gemini-first → Claude fallback.
    if (!photoB64) return [];
    const prompt = `A photo of one or more skincare products is attached. Identify EVERY visible product. For each, read the label, brand, and any active ingredients you can see.

CRITICAL: Respond with ONLY a JSON array. No markdown fences, no preamble, no explanation. Just the array.

Each entry must have these exact keys:
- "name": product name (no brand)
- "brand": brand name as printed
- "category": one of cleanser, toner, serum, moisturizer, sunscreen, treatment, exfoliant, mask, oil, other
- "actives": active ingredients with %, comma-separated. If you can't read precisely, give your best evidence-based guess for this real product.
- "confidence": "high" | "medium" | "low"

Up to 10 products. If you genuinely cannot identify any product, return [].`;
    // === PROVIDER FALLBACK CHAIN ===
    // 1. Gemini proxy (no user key needed — Frida pays via Supabase function).
    // 2. Claude with user's Anthropic key (only if they brought one).
    // 3. Return [] gracefully so the batch loop continues; caller decides
    //    how to surface the dead end (manual entry route).
    let result = null;
    try {
      result = await callGeminiVision(photoB64, prompt, { maxTokens: 2048 });
    } catch (gErr) {
      console.warn('[scan-batch] Gemini failed, trying Claude:', gErr?.message);
      if (getApiKey()) {
        try {
          result = await callClaude(prompt, '', photoB64, { model: 'claude-haiku-4-5-20251001', maxTokens: 1500 });
        } catch (cErr) {
          console.warn('[scan-batch] Claude also failed:', cErr?.message);
        }
      }
    }
    if (!result) return [];
    const stripFences = (s) => String(s || '').replace(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g, '$1').trim();
    const cleaned = stripFences(result);
    let arr = null;
    try {
      const start = cleaned.indexOf('['); const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end !== -1) arr = JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {}
    if (!Array.isArray(arr)) arr = [];
    const validCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
    return arr.slice(0, 10).map(p => {
      const cat = String(p.category || 'serum').toLowerCase().trim();
      return {
        name: String(p.name || '').trim(),
        brand: String(p.brand || '').trim(),
        category: validCats.includes(cat) ? cat : 'serum',
        actives: String(p.actives || '').trim(),
        confidence: String(p.confidence || 'medium').toLowerCase(),
        checked: true,
        amSel: false,
        pmSel: false,
        savingState: 'idle'};
    }).filter(p => p.name || p.brand);
  };

  // === SCAN MULTIPLE PRODUCTS FROM ONE PHOTO ===
  const detectProductsFromPhoto = async (photoB64) => {
    if (!photoB64) return;
    // === GEMINI-FIRST (May 2026 v2) ===
    // Removed: `if (!getApiKey()) { ... setShowApiKeyModal(true); }`
    // Gemini proxy doesn't need a user Anthropic key. Drop the gate
    // so users without a key can still scan. Claude fallback below
    // requires the key; we gracefully skip it when absent.
    setScanning(true);
    setScanError('');
    let rawForDebug = '';
    try {
      const prompt = `A photo of one or more skincare products is attached. Identify EVERY visible product. For each, read the label, brand, and any active ingredients you can see.

CRITICAL: Respond with ONLY a JSON array. No markdown fences, no preamble, no explanation. Just the array.

Each entry must have these exact keys:
- "name": product name (no brand)
- "brand": brand name as printed
- "category": one of cleanser, toner, serum, moisturizer, sunscreen, treatment, exfoliant, mask, oil, other
- "actives": active ingredients with %, comma-separated. If you can't read precisely, give your best evidence-based guess for this real product.
- "confidence": "high" | "medium" | "low"

Up to 10 products. If you genuinely cannot identify any product, return [].

Example response (just this, nothing else):
[{"name":"C-Firma Day Serum","brand":"Drunk Elephant","category":"serum","actives":"L-Ascorbic Acid 15%, Ferulic Acid 0.5%, Vitamin E","confidence":"high"}]`;
      // === B: Multi-product shelf scan — Gemini 2.5 Flash, Claude fallback ===
      // The most demanding vision task in the app: distinguishing 2-10 separate
      // bottles in a single photo and extracting brand + actives for each. Gemini's
      // product-recall (trained on Google Shopping data) materially outperforms
      // Claude here, especially for K-beauty brands. Claude fallback preserves the
      // flow when Gemini errors.
      // Provider fallback: Gemini (no key) → Claude (BYOK if available) → throw.
      // Caller's outer try/catch turns a thrown error into the manual-entry
      // route via setScanError.
      let result = null;
      try {
        result = await callGeminiVision(photoB64, prompt, { maxTokens: 2048 });
      } catch (gErr) {
        console.warn('[Gemini multi-scan] failed:', gErr.message);
        if (getApiKey()) {
          try {
            result = await callClaude(prompt, '', photoB64, { model: 'claude-haiku-4-5-20251001', maxTokens: 1500 });
          } catch (cErr) {
            console.warn('[Claude fallback] failed:', cErr.message);
          }
        }
      }
      if (!result) throw new Error('NO_PROVIDER');
      rawForDebug = String(result || '');
      // === Multi-strategy JSON extraction ===
      // 1. Strip markdown fences anywhere in the response.
      // 2. Try to parse the largest balanced [...] block.
      // 3. Fall back to extracting individual {...} objects if the array is malformed.
      const stripFences = (s) => s.replace(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g, '$1').trim();
      let parsed = [];
      const tryParseArray = (s) => {
        const start = s.indexOf('[');
        const end = s.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            const arr = JSON.parse(s.slice(start, end + 1));
            if (Array.isArray(arr)) return arr;
          } catch (_) {}
        }
        return null;
      };
      const cleaned = stripFences(rawForDebug);
      let arr = tryParseArray(cleaned);
      if (!arr) {
        // Fall back: extract each {...} balanced block individually
        const objects = [];
        let depth = 0, startIdx = -1;
        for (let i = 0; i < cleaned.length; i++) {
          const c = cleaned[i];
          if (c === '{') {
            if (depth === 0) startIdx = i;
            depth++;
          } else if (c === '}') {
            depth--;
            if (depth === 0 && startIdx !== -1) {
              try {
                const obj = JSON.parse(cleaned.slice(startIdx, i + 1));
                if (obj && typeof obj === 'object') objects.push(obj);
              } catch (_) {}
              startIdx = -1;
            }
          }
        }
        if (objects.length > 0) arr = objects;
      }
      parsed = Array.isArray(arr) ? arr : [];

      const validCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
      const safe = parsed.slice(0, 10).map(p => {
        const cat = String(p.category || 'serum').toLowerCase().trim();
        return {
          name: String(p.name || '').trim(),
          brand: String(p.brand || '').trim(),
          category: validCats.includes(cat) ? cat : 'serum',
          actives: String(p.actives || '').trim(),
          confidence: String(p.confidence || 'medium').toLowerCase(),
          // ALL detected items default to checked — user can uncheck what's wrong.
          checked: true,
          // amSel / pmSel — explicit AM/PM picks per detected product. Both default false
          // so the user MUST tap to put the product into Today's Regimen. Saving with
          // neither set keeps the product on the shelf only.
          amSel: false,
          pmSel: false,
          savingState: 'idle'};
      }).filter(p => p.name || p.brand);

      setDetectedProducts(safe);
      if (safe.length === 0) {
        // If we got a non-empty response but parsing failed, surface a hint.
        if (rawForDebug && rawForDebug.length > 8 && !/^\[\s*\]\s*$/.test(rawForDebug.trim())) {
          console.warn('Scan returned content that did not parse:', rawForDebug.slice(0, 500));
          setScanError('Couldn\'t read the labels — try a clearer photo with each label visible.');
        } else {
          setScanError('Couldn’t read it. Better light, tighter shot.');
        }
      } else {
        toast(`Detected ${safe.length} product${safe.length === 1 ? '' : 's'}`);
      }
    } catch (e) {
      console.error('Scan failed:', e, 'raw:', rawForDebug.slice(0, 300));
      setScanError('Scan failed. Try again or enter manually.');
    }
    setScanning(false);
  };

  const appendScanPhotosToBatch = (photos) => {
    const urls = (photos || [])
      .map(p => typeof p === 'string' ? p : (p && (p.dataUrl || p.photo || p.url)))
      .filter(p => typeof p === 'string' && /^data:image\//i.test(p));
    if (urls.length === 0) return false;
    setProductScanBatch(prev => [...(prev || []), ...urls]);
    setScanPhoto(urls[urls.length - 1]);
    setScanError('');
    return true;
  };

  const handleScanPhoto = async (e) => {
    // MULTI-FILE: Library picker has `multiple` attribute, so user can
    // select N photos in one operation. Camera capture path passes a
    // single-file event (synthesized in onCapture), which still works
    // here — Array.from of a single-file FileList yields [file].
    // Mirrors SkinLog's handleFiles pattern. Don't refactor back to
    // single-file — Jenni explicitly asked for "take all photos first,
    // then return to this screen for analysis."
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Convert in parallel — fileToBase64 is async I/O, no rate concern.
    const b64s = await Promise.all(files.map(f => fileToBase64(f)));
    appendScanPhotosToBatch(b64s);
    // Reset the file input value so picking the same file twice still fires onChange.
    try { e.target.value = ''; } catch (_) {}
  };

  // === BRIDGE: CameraCaptureModal (multi mode) → handleScanPhoto ===
  // CameraCaptureModal with multi={true} returns EITHER:
  //   - onCapture(dataUrl, null)       single shot
  //   - onCapture(null, shots[])       array of { dataUrl } objects
  // CameraCaptureModal already returns compressed JPEG data URLs. Do not
  // round-trip those through File/Blob/FileReader again; that path is fragile
  // in local file:// and some mobile browsers, and was causing captured
  // product photos to be rejected before analysis.
  const processScanCameraResult = async (dataUrl, shots) => {
    try {
      const list = Array.isArray(shots) && shots.length > 0
        ? shots
        : (dataUrl ? [dataUrl] : []);
      if (!appendScanPhotosToBatch(list)) return;
    } catch (err) {
      console.error('[scan] camera capture append failed', err);
      setScanError('Photo captured, but Frida could not prepare it. Try again or use Library.');
    }
  };

  // === BATCH ANALYSIS ===
  // Loops through every captured photo, sends each to Claude vision,
  // accumulates the detected products into one list. Sequential (not
  // parallel) so we don't blow up the Anthropic rate limit on bulk
  // captures of 5-10 photos. Progress state drives the inline status
  // ("Reading photo 3 of 7…"). On finish, the user sees one combined
  // review list and saves selectively from there.
  const analyzeAllScanPhotos = async () => {
    const batch = productScanBatch || [];
    if (batch.length === 0) return;
    // === GEMINI-FIRST (May 2026 v2 — Codex flagged) ===
    // Was: pre-flight NO_KEY gate that blocked the whole batch when
    // no Anthropic key was set. Removed — Gemini works for everyone
    // via the shared Frida proxy. If both Gemini AND Claude fail for
    // every photo, the loop ends with combined=[] and the generic
    // "couldn't read" error fires, which now offers manual routes.
    setDetectedProducts([]);
    setScanError('');
    setScanning(true);
    const combined = [];
    const seen = new Set(); // dedupe across photos by brand+name normalized
    for (let i = 0; i < batch.length; i++) {
      setProductScanBatchProgress({ current: i + 1, total: batch.length });
      try {
        const photo = batch[i];
        // Reuse existing detection by calling Claude directly with the same
        // prompt shape detectProductsFromPhoto uses, but accumulating into
        // a local list instead of overwriting state per photo.
        // (Falling back to setDetectedProducts via the existing function
        // would clobber prior photos' results.)
        const detected = await detectProductsFromPhotoBatched(photo);
        for (const p of (detected || [])) {
          const k = `${(p.brand || '').toLowerCase().trim()}::${(p.name || '').toLowerCase().trim()}`;
          if (seen.has(k)) continue;
          seen.add(k);
          combined.push(p);
        }
      } catch (err) {
        console.warn('[scan-batch] photo', i + 1, 'failed:', err?.message);
      }
    }
    setProductScanBatchProgress(null);
    setScanning(false);
    setDetectedProducts(combined);
    if (combined.length === 0) {
      // Both Gemini AND Claude (if available) failed for every photo.
      // Most likely: image quality (blur/glare/distance). Surface the
      // manual entry routes inline via the NO_RESULTS sentinel so the
      // user has a clear exit instead of staring at an error.
      setScanError('NO_RESULTS');
    }
  };

  // Save selected detected products. Each one gets added to shelf with quick fields,
  // then enriched with deepFillProduct in background to round out actives/main/concerns/tags.
  const saveScannedProducts = async () => {
    const toSave = detectedProducts.filter(p => p.checked && p.name);
    if (toSave.length === 0) return;
    const validCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
    const newProducts = toSave.map(p => {
      // Build useTimes from the explicit AM/PM picks. If neither is set, useTimes = []
      // so the product lands on the shelf only (hidden from Today's Regimen).
      const useTimes = [];
      if (p.amSel) useTimes.push('am');
      if (p.pmSel) useTimes.push('pm');
      // Route through sanitizer so cadence.days is guaranteed + useTimes
      // is lowercase. Without this, Today's filter would miss the new row.
      return sanitizeProductForSave({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: p.name,
        brand: p.brand,
        category: validCats.includes(p.category) ? p.category : 'serum',
        // startDate is set the first time the user marks this product as used in daily check-in.
        startDate: '',
        endDate: '',
        activeIngredients: p.actives || '',
        mainIngredients: '',
        tags: [],
        concerns: [],
        useDays: [0,1,2,3,4,5,6],
        useTimes,
        frequency: 'daily',
        notes: '',
        photo: null,
        photoPath: null,
        status: 'active',
        aiAnalysis: null,
        analyzing: getApiKey() ? true : false});
    });
    const updated = [...newProducts, ...products];
    setProducts(updated);
    await saveData('products', updated);
    // Inputs to AI recommendations changed → trigger reactive ritual regen.
    setCoverRoutineRebuildToken(t => t + 1);
    // STAY OPEN — return to the entry-mode picker (scan vs manual) so the
    // user can immediately add the next product. Most multi-add sessions
    // happen in batches (a shelf scan, then a few manual entries). Toast
    // confirms the save; user closes via the X when they're done.
    setProductEntryMode('choose');
    setProductScanPhoto(null);
    setProductScanning(false);
    setProductScanError('');
    setProductDetected([]);
    // Also clear the batch so the next scan starts fresh.
    setProductScanBatch([]);
    setProductScanBatchProgress(null);
    setProductForm(null);
    setProductSearchInput('');
    setProductNameSuggestions([]);
    toast(`Saved ${newProducts.length} ✨ Add another or close`, 'info');
    // Background deep-fill to enrich each
    if (getApiKey()) {
      newProducts.forEach(async (np) => {
        try {
          const filled = await deepFillProduct({ name: np.name, brand: np.brand, category: np.category });
          setProducts(prev => {
            const next = prev.map(pp => pp.id === np.id ? {
              ...pp,
              activeIngredients: pp.activeIngredients || filled.activeIngredients,
              mainIngredients: filled.mainIngredients,
              tags: filled.tags.length ? filled.tags : pp.tags,
              concerns: filled.concerns.length ? filled.concerns : pp.concerns,
              analyzing: false} : pp);
            saveData('products', next);
            return next;
          });
        } catch (e) {
          console.warn('Deep fill failed for', np.name, e);
        }
      });
    }
  };

  // === SELECT A SUGGESTION ===
  // Pulls Stage 1 metadata, then runs deepFillProduct() so every field is guaranteed populated.
  const applySuggestion = async (s) => {
    setDeepFilling(true);
    // Pre-fill what we already have so the user sees something while the deep call runs
    setForm(prev => ({
      ...prev,
      name: s.name || prev.name,
      brand: s.brand || prev.brand,
      category: s.category || prev.category,
      activeIngredients: s.actives || prev.activeIngredients,
      mainIngredients: s.main || prev.mainIngredients,
      tags: (s.tags && s.tags.length) ? s.tags : (prev.tags || []),
      concerns: (s.concerns && s.concerns.length) ? s.concerns : (prev.concerns || [])
    }));
    // Hide the suggestion list once one is picked.
    // CRITICAL: clear searchInput AND hasSearched together, AND bump the
    // resetKey so the debounced LocalSearchInput's internal val is also
    // wiped (it ignores upstream setState mid-typing by design).
    setNameSuggestions([]);
    setHasSearched(false);
    setSearchInput('');
    bumpSearchReset();
    try {
      const filled = await deepFillProduct({ name: s.name, brand: s.brand, category: s.category });
      // === SMART SCHEDULE ON AUTOFILL (June 2026 per Jenni) ===
      // After deep-fill resolves the category + actives, auto-apply the
      // suggested cadence so masks don't default to daily, retinol drops to
      // 3×/week, etc. User can still override via the Schedule chips.
      const sug = suggestedCadence(
        filled.category || s.category,
        filled.activeIngredients || s.actives || ''
      );
      setForm(prev => ({
        ...prev,
        name: filled.name || prev.name,
        brand: filled.brand || prev.brand,
        category: filled.category || prev.category,
        activeIngredients: filled.activeIngredients || prev.activeIngredients,
        mainIngredients: filled.mainIngredients || prev.mainIngredients,
        tags: filled.tags.length ? filled.tags : (prev.tags || []),
        concerns: filled.concerns.length ? filled.concerns : (prev.concerns || []),
        useDays: sug.days,
        useTimes: sug.times,
      }));
      // If the deep call couldn't recover real ingredients, prompt for a label photo
      if (!filled.activeIngredients && !filled.mainIngredients) {
        setNeedsLabelHelp(true);
      }
      toast(`Filled in ${filled.name} ✨`);
    } catch (e) {
      console.warn('Deep fill failed:', e);
      setNeedsLabelHelp(true);
      toast('Used quick fill — review and edit if needed.', 'info');
    }
    setDeepFilling(false);
  };
  const handleFetchFromUrl = async () => {
    const url = searchInput.trim();
    if (!url || !isUrl(url)) return;
    if (!getApiKey()) { setUrlFetchError('Add your Anthropic API key first.'); return; }
    setUrlFetching(true);
    setUrlFetchError('');
    try {
      const filled = await deepFillProduct({ url });
      if (!filled.name && !filled.brand && !filled.activeIngredients) {
        setUrlFetchError("Couldn't identify this product from the URL. Try the name instead.");
      } else {
        // June 2026: auto-apply smart schedule on URL autofill too.
        const sug = suggestedCadence(filled.category, filled.activeIngredients);
        setForm(prev => ({
          ...prev,
          name: filled.name,
          brand: filled.brand,
          category: filled.category,
          activeIngredients: filled.activeIngredients,
          mainIngredients: filled.mainIngredients,
          tags: filled.tags.length ? filled.tags : (prev.tags || []),
          concerns: filled.concerns.length ? filled.concerns : (prev.concerns || []),
          useDays: sug.days,
          useTimes: sug.times}));
        if (!filled.activeIngredients && !filled.mainIngredients) setNeedsLabelHelp(true);
        toast(`Found ${filled.name || filled.brand} ✨`);
      }
    } catch (e) {
      console.error('URL fetch failed:', e);
      setUrlFetchError('Lookup failed. Try again or type the name.');
    }
    setUrlFetching(false);
  };
  // Reset all hoisted ProductModal state — call after a successful save so reopening starts clean.
  const resetHoistedProductState = () => {
    setProductEntryMode('choose');
    setProductScanPhoto(null);
    setProductScanning(false);
    setProductScanError('');
    setProductDetected([]);
    setProductScanBatch([]);
    setProductScanBatchProgress(null);
    setProductForm(null);
    setProductSearchInput('');
    setProductNameSuggestions([]);
    setProductNameSearching(false);
    setProductUrlFetching(false);
    setProductUrlFetchError('');
    setProductSearchError('');
    setProductHasSearched(false);
    setProductDeepFilling(false);
    setProductReadingLabel(false);
    setProductNeedsLabelHelp(false);
  };
  const handleSubmit = async () => {
    if (!form.name && !form.photo) return;
    // === EDIT MODE: update in place, skip AI re-analysis ===
    if (isEditing) {
      // Route through sanitizeProductForSave to guarantee useTimes is
      // lowercase + cadence.days exists. Prevents the "I added it but
      // Today doesn't show it" bug from mixed-case writes.
      const updated = products.map(p => p.id === editingProductId
        ? sanitizeProductForSave({ ...p, ...form, id: editingProductId })
        : p);
      setProducts(updated);
      await saveData('products', updated);
      setEditingProductId(null);
      setShowProductModal(false);
      resetHoistedProductState();
      // Product edit can change AM/PM, actives, concerns — regenerate cover Recommended.
      setCoverRoutineRebuildToken(t => t + 1);
      toast(`${form.name} updated`);
      // If a new photo was added in edit mode, push it to Storage
      if (form.photo && form.photo !== editingProduct?.photo && user?.cloud && user?.id && supabaseClient) {
        (async () => {
          const { path, error } = await uploadPhotoToStorage(user.id, form.photo);
          if (path) {
            setProducts(prev => {
              const next = prev.map(p => {
                if (p.id !== editingProductId) return p;
                const { photo, ...rest } = p;
                return { ...rest, photoPath: path };
              });
              saveData('products', next);
              return next;
            });
          } else if (error) {
            console.error('Product photo upload failed:', error);
          }
        })();
      }
      return;
    }
    // === CREATE MODE ===
    // Dedupe guard — if a near-match already exists on the shelf, show
    // a confirmation banner instead of creating a duplicate. The bypass
    // ref is set to true when the user clicks "Save anyway" so a second
    // call to handleSubmit skips this check.
    if (!bypassDupeCheckRef.current) {
      // findSimilarShelfProduct now returns { product, reason } or null.
      // reason ∈ 'same-name' | 'same-active-strength' so we can show
      // differentiated copy in the warning banner below.
      const match = findSimilarShelfProduct(form, products);
      if (match) {
        setProductDupeWarning({ existing: match.product, reason: match.reason, attempt: { ...form } });
        return;
      }
    }
    bypassDupeCheckRef.current = false;
    const id = Date.now();
    // Sanitize on create — guarantees useTimes is lowercase + cadence.days
    // is set, so Today's filter (which reads productInAM/productInPM +
    // productCadenceDays) immediately includes the new product on the
    // right day. Eliminates the May 2026 "saved but invisible" bug.
    const tempProduct = sanitizeProductForSave({ ...form, name: form.name || 'Identifying…', id, aiAnalysis: null, analyzing: getApiKey() ? true : false, analyzingStartedAt: getApiKey() ? Date.now() : undefined });
    const updated = [tempProduct, ...products];
    setProducts(updated);
    await saveData('products', updated);
    // === REGIMEN-ADD CONTEXT ===
    // Two entry paths land here:
    //   1. Regimen tab → Edit Today editor (ritualForm is mounted). We append
    //      the new product id to the active slot's form state so the editor
    //      reflects it. saveData('regimenLogs') runs when the editor is saved.
    //   2. Home cover → "Used something else?" → "Started a new product" on
    //      ANY day (today or past). ritualForm is null because the Regimen
    //      tab isn't open. May 2026 bug: previously the code only touched
    //      ritualForm, so this path was a silent no-op for the regimenLog —
    //      the product hit the shelf but never appeared in the day's log.
    // Fix (May 2026 per Jenni): when productModalRegimenContext.date is set,
    // write the new product id directly to regimenLogs[date] for the slot.
    // We do this REGARDLESS of whether ritualForm is open so both surfaces
    // get the write. (The Regimen tab editor path keeps the ritualForm
    // append too so its in-flight edit state stays consistent.)
    if (productModalRegimenContext) {
      const ctxSlot = productModalRegimenContext.slot; // 'am' | 'pm'
      const ctxDate = productModalRegimenContext.date || localDateISO();
      const slotKey = ctxSlot === 'am' ? 'amProducts' : 'pmProducts';
      const otherKey = ctxSlot === 'am' ? 'pmProducts' : 'amProducts';
      // Path 1: Regimen-tab editor open → append to ritualForm
      const baseForm = ritualFormRef.current || ritualForm || null;
      if (baseForm) {
        const current = baseForm[slotKey] || [];
        if (!current.includes(id)) {
          const nextForm = { ...baseForm, [slotKey]: [...current, id] };
          ritualFormRef.current = nextForm;
          setRitualForm(nextForm);
        }
      }
      // Path 2: write to regimenLogs[date] directly. This is the load-bearing
      // line for the Home-cover "Started a new product" flow. Without it the
      // product saves to the shelf but never appears in the day's log.
      if (typeof setRegimenLogs === 'function') {
        const existingLog = (regimenLogs || []).find(r => r.date === ctxDate);
        let nextLogs;
        if (existingLog) {
          const currentSlot = existingLog[slotKey] || [];
          if (!currentSlot.includes(id)) {
            nextLogs = regimenLogs.map(r => r.date === ctxDate
              ? { ...r, [slotKey]: [...currentSlot, id] }
              : r
            );
          }
        } else {
          nextLogs = [
            {
              id: Date.now(),
              date: ctxDate,
              amProducts: ctxSlot === 'am' ? [id] : [],
              pmProducts: ctxSlot === 'pm' ? [id] : [],
              amDone: [],
              pmDone: [],
              amExtras: [],
              pmExtras: [],
              notes: '',
              submitted: false},
            ...(regimenLogs || []),
          ];
        }
        if (nextLogs) {
          setRegimenLogs(nextLogs);
          saveData('regimenLogs', nextLogs).catch(e => console.error('[product regimen-add]', e));
        }
      }
      // Close ProductModal + clear its hoisted state (regimen editor remains mounted).
      setShowProductModal(false);
      setProductModalRegimenContext(null);
      resetHoistedProductState();
      // Date-aware toast — explicit when not today so the user knows which
      // day's log they just touched.
      const todayKey = localDateISO();
      if (ctxDate === todayKey) {
        toast(`Added to ${ctxSlot.toUpperCase()} routine ✨`, 'success');
        // === PROMOTE-TO-ROUTINE BANNER (May 2026 per Jenni) ===
        // Today-only adds default to one-off. Surface a quiet banner that
        // offers to make it a standing weekly routine entry.
        // June 2026 refinement: when the user explicitly chose the
        // "Today only" schedule chip (useDays + useTimes both empty),
        // skip the banner — they already declared intent. Banner only
        // fires when the user picked Suggested / Pick days / Daily,
        // meaning they DO want a weekly schedule and we're nudging them
        // to refine it. Past-day adds don't get the prompt either —
        // those are historical retroactive logs, not forward routine.
        const userPickedTodayOnly =
          (Array.isArray(tempProduct.useDays) && tempProduct.useDays.length === 0) &&
          (Array.isArray(tempProduct.useTimes) && tempProduct.useTimes.length === 0);
        if (!userPickedTodayOnly && typeof setPromoteToRoutinePrompt === 'function') {
          setPromoteToRoutinePrompt({
            productIds: [id],
            productNames: [tempProduct.name || 'New product'],
            slot: ctxSlot});
        }
      } else {
        const dLabel = new Date(ctxDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        toast(`Added to ${ctxSlot.toUpperCase()} for ${dLabel} ✨`, 'success');
      }
      setCoverRoutineRebuildToken(t => t + 1);
    } else {
      // STAY OPEN after a single-add too — same multi-add UX as scan flow.
      // User typically adds several products at once, so reset and show the
      // entry-mode picker again. Closes via X.
      resetHoistedProductState();
      // T3 (May 31 2026): stash a "Just added" chip for the next render so
      // the entry-mode picker shows what was just saved + a quick edit link.
      setLastAddedProduct({
        id,
        brand: tempProduct.brand || '',
        name: tempProduct.name || 'New product',
      });
      // Pill flash — see productSaveFlash state declaration above. Auto-clear
      // after 1.4s so the next add starts with a fresh SAVE TO SHELF label.
      setProductSaveFlash(true);
      setTimeout(() => setProductSaveFlash(false), 1400);
      toast(`Added ${tempProduct.name} ✨ Add another or close`, 'info');
      // New product = new shelf inputs to the AI → regenerate cover Recommended.
      setCoverRoutineRebuildToken(t => t + 1);
      // === USE-TODAY PROMPT (May 2026) ===
      // Fire the "use today?" banner so the user can one-tap slot this
      // into AM or PM today. Skipped for the Today's-regimen path above
      // (productModalRegimenContext was set → already slotted). Cover
      // and Check-in-bridge paths land here.
      setUseTodayPrompt({
        product: {
          id: tempProduct.id,
          name: tempProduct.name || 'New product',
          category: tempProduct.category}});
    }

    // Background photo upload to Storage (cloud users only). Same pattern as SkinLogModal.
    if (form.photo && user?.cloud && user?.id && supabaseClient) {
      (async () => {
        const { path, error } = await uploadPhotoToStorage(user.id, form.photo);
        if (path) {
          setProducts(prev => {
            const next = prev.map(p => {
              if (p.id !== id) return p;
              const { photo, ...rest } = p;
              return { ...rest, photoPath: path };
            });
            saveData('products', next);
            return next;
          });
        } else if (error) {
          console.error('Product photo upload failed:', error);
        }
      })();
    }
    if (getApiKey()) {
      toast(form.photo ? 'Reading label & analyzing in background…' : 'Looking up product in background…', 'info');
      (async () => {
        try {
          // Conflict check uses ACTUAL routine, not shelf — a layering conflict only
          // matters with products genuinely in current use.
          const _u = getActualUsage(products, regimenLogs, logs, { windowDays: 30 });
          const otherActives = _u.actuallyUsed.length > 0
            ? _u.actuallyUsed.map(u => `${u.product.name}: ${u.product.activeIngredients || 'unknown'} (used ${u.amCount}× AM, ${u.pmCount}× PM in last 30d)`).join('; ')
            : 'no products in active use yet';
          const visionInstruction = form.photo ? 'A product photo is attached. Read the bottle/label to identify the product name, brand, and full active ingredient list. Use this to override the user input below if it conflicts with what you see on the label.' : '';
          const prompt = `${visionInstruction}

User-provided info:
- Product: ${form.name || '(unknown — read from photo)'}
- Brand: ${form.brand || '(unknown — read from photo)'}
- Category: ${form.category}
- Active ingredients: ${form.activeIngredients || '(not specified — look up or read from label)'}
- Frequency: ${form.frequency}
- User notes: ${form.notes || 'none'}

User's other active products: ${otherActives}

Provide a comprehensive evidence-based assessment in this exact format:

DETECTED_NAME: [product name as best identified]
DETECTED_BRAND: [brand as best identified]
DETECTED_CATEGORY: [exactly one of: cleanser, toner, serum, moisturizer, sunscreen, treatment, exfoliant, mask, oil, other]
DETECTED_ACTIVES: [comma-separated list of active ingredients with concentrations if known, e.g. "Niacinamide 10%, Zinc PCA 1%"]
DETECTED_MAIN_INGREDIENTS: [3-6 key supporting ingredients beyond actives — humectants, emollients, soothers — comma-separated, e.g. "Hyaluronic Acid, Ceramides, Glycerin, Squalane"]
DETECTED_TAGS: [4-7 short benefit-and-category tags lowercase-hyphenated. Use canonical short tags so the same actives across products produce the same tags. Examples: "brightening, vitamin-c, antioxidant, anti-aging, evens-tone, hydrating, niacinamide, retinoid, exfoliating, soothing, ceramides, peptides, sunscreen, mineral-spf"]
DETECTED_CONCERNS: [comma-separated concerns this product targets, ONLY from this list: hyperpigmentation, redness, enlarged-pores, dark-circles, wrinkles, sun-damage, dryness, dullness, oiliness, sensitivity, texture, blemishes, fine-lines]

CRITICAL OUTPUT RULES — read carefully and enforce strictly:
• Use "MECHANISM:" "EVIDENCE:" "ALTERNATIVES:" as line-start labels — exactly these three sections, nothing else.
• HARD WORD CAP: MECHANISM ≤ 30 words. EVIDENCE ≤ 30 words. Count your words. If you exceed, rewrite shorter — do not output more than 30 words per section under any circumstance. Brevity matters more than completeness; the user can ask for detail later.
• ONE SENTENCE MAX per section. No multi-paragraph essays. No bullet points inside MECHANISM or EVIDENCE.
• Do NOT mention alternatives, cheaper options, or other product names in MECHANISM or EVIDENCE — those two sections are about THIS product only.
• Do NOT use markdown bold (**text**), italics, or section sub-headers. Plain prose only inside each section.
• Do not add headings, dashes, or extra commentary outside the format.

Format response EXACTLY as:

MECHANISM: [ONE sentence, max 30 words. Pathway-level: what the actives DO biochemically (e.g. "tyrosinase inhibition", "MMP suppression"). Cite evidence quality in plain language ("well-studied for…", "mechanism-based, limited clinical…"). Reject any output longer than 30 words.]

EVIDENCE: [ONE sentence, max 30 words. Best clinical trial for this active at this %: design + effect size. Honest if evidence is thin or in-vitro only. Reject any output longer than 30 words.]

ALTERNATIVES:
1. CHEAPER | [Brand + product name] | ~$[USD] | [matching active(s)] | [≤12 words why it's a defensible swap]
2. SIMILAR-OR-HIGHER | [Brand + product name] | ~$[USD] | [matching active(s)] | [≤12 words why it's a defensible swap]`;
          const result = await callClaude(prompt, '', form.photo);
          const nameMatch = result.match(/DETECTED_NAME:\s*(.+)/);
          const brandMatch = result.match(/DETECTED_BRAND:\s*(.+)/);
          const categoryMatch = result.match(/DETECTED_CATEGORY:\s*(.+)/);
          const activesMatch = result.match(/DETECTED_ACTIVES:\s*(.+)/);
          const mainIngMatch = result.match(/DETECTED_MAIN_INGREDIENTS:\s*(.+)/);
          const tagsMatch = result.match(/DETECTED_TAGS:\s*(.+)/);
          const concernsMatch = result.match(/DETECTED_CONCERNS:\s*(.+)/);
          const validCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
          const detectedName = (nameMatch && (!form.name || form.photo)) ? nameMatch[1].trim() : (form.name || 'Unknown Product');
          const detectedBrand = (brandMatch && (!form.brand || form.photo)) ? brandMatch[1].trim() : form.brand;
          const catRaw = (categoryMatch ? categoryMatch[1].trim().toLowerCase() : '');
          // Only override the form category if it's still the default 'serum' AND AI suggested something valid
          const detectedCategory = (validCats.includes(catRaw) && (form.category === 'serum' || !form.category)) ? catRaw : (form.category || 'serum');
          const detectedActives = (activesMatch && !form.activeIngredients) ? activesMatch[1].trim() : form.activeIngredients;
          const detectedMain = mainIngMatch ? mainIngMatch[1].trim() : (form.mainIngredients || '');
          const detectedTags = tagsMatch ? tagsMatch[1].trim().split(',').map(x => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean).slice(0, 8) : (form.tags || []);
          const VALID_CONCERNS = ['oil-control','pores','redness','uneven-tone','dullness','texture','hyperpigmentation','sensitivity','barrier','acne','dryness','dark-circles','wrinkles','fine-lines','sun-damage'];
          // Canonical map for legacy AI outputs that still use old tag names
          // (oiliness, enlarged-pores, blemishes). Map them to the new
          // spec set so existing products + AI responses stay compatible.
          const canonicalConcern = (raw) => {
            const c = raw.toLowerCase().replace(/\s+/g, '-');
            const map = { 'oiliness':'oil-control', 'enlarged-pores':'pores', 'blemishes':'acne', 'dark-spots':'hyperpigmentation' };
            return map[c] || c;
          };
          const detectedConcerns = concernsMatch
            ? concernsMatch[1].trim().split(',').map(x => canonicalConcern(x.trim())).filter(c => VALID_CONCERNS.includes(c)).slice(0, 8)
            : (form.concerns || []);
          const aiAnalysis = result
            .replace(/DETECTED_NAME:.*\n/, '')
            .replace(/DETECTED_BRAND:.*\n/, '')
            .replace(/DETECTED_CATEGORY:.*\n/, '')
            .replace(/DETECTED_ACTIVES:.*\n/, '')
            .replace(/DETECTED_MAIN_INGREDIENTS:.*\n/, '')
            .replace(/DETECTED_TAGS:.*\n/, '')
            .replace(/DETECTED_CONCERNS:.*\n/, '')
            .trim();
          // No conflicts toast anymore — the new structured format doesn't
          // emit a CONFLICTS section, conflicts surface inline in the
          // overall routine "OVERUSE / FLAGS" card instead.
          setProducts(prev => {
            const next = prev.map(p => p.id === id ? { ...p, name: detectedName, brand: detectedBrand, category: detectedCategory, activeIngredients: detectedActives, mainIngredients: detectedMain, tags: detectedTags, concerns: detectedConcerns, aiAnalysis, analyzing: false } : p);
            saveData('products', next);
            return next;
          });
          toast(`${detectedName} analyzed ✨`);
        } catch (e) {
          setProducts(prev => {
            const next = prev.map(p => p.id === id ? { ...p, name: form.name || 'Unknown Product', analyzing: false } : p);
            saveData('products', next);
            return next;
          });
        }
      })();
    }
  };
  // Visual state — fields that came from the AI (so we can highlight them as autofilled)
  const presetCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
  const isCustomCat = form.category && !presetCats.includes(form.category);
  const aiBusy = deepFilling || readingLabel || urlFetching;

  // Tight input — smaller py + text-xs
  const tightInput = "w-full px-2 py-1.5 text-xs border-0 border-b focus:outline-none focus:border-[var(--ink)] transition bg-transparent";
  // `elevated` mode: opened from inside the Edit Regimen sheet. Renders the
  // Modal at z-1015 so it sits above the editor (z-50) and shelf overlay
  // (z-1005), and our onClose only clears its own state — the editor stays
  // mounted underneath so closing this returns the user to mid-edit.
  const inRegimenAddContext = !!productModalRegimenContext && !isEditing;
  // Also elevate when onboarding is open — otherwise the modal renders
  // beneath the onboarding overlay (z-[100]) and the click silently fails.
  const onboardingActive = onboardingState && onboardingState.stage !== 'done';
  return (
    <Modal compact elevated={inRegimenAddContext || onboardingActive} onClose={() => {
      setShowProductModal(false);
      setEditingProductId(null);
      // Clear regimen-add context (if set) — does NOT close the editor.
      setProductModalRegimenContext(null);
      // Clear any pending dedupe warning so it doesn't haunt the next open.
      setProductDupeWarning(null);
      bypassDupeCheckRef.current = false;
      // Reset hoisted scan state so the next open starts fresh
      setProductEntryMode('choose');
      setProductBrandSelected(null);
      setProductBrandSearch('');
      setProductBrandCatFilter('all');
      setProductScanPhoto(null);
      setProductScanning(false);
      setProductScanError('');
      setProductDetected([]);
      setProductScanBatch([]);
      setProductScanBatchProgress(null);
      // Reset hoisted form state — fresh form on next open
      setProductForm(null);
      setProductSearchInput('');
      setProductNameSuggestions([]);
      setProductNameSearching(false);
      setProductUrlFetching(false);
      setProductUrlFetchError('');
      setProductSearchError('');
      setProductHasSearched(false);
      setProductDeepFilling(false);
      setProductReadingLabel(false);
      setProductNeedsLabelHelp(false);
      modalScrollMemo.current.product = 0;
    }} title={
      isEditing ? "Edit product"
        : entryMode === 'scan' ? "Scan products"
        : entryMode === 'brand' ? (productBrandSelected ? productBrandSelected : "Search by brand")
        : entryMode === 'manual' ? "Search product"
        // === CONTEXTUAL TITLE (May 2026, date-aware per Jenni) ===
        // When the modal is opened from inside Today's Regimen
        // (productModalRegimenContext is set with a slot), reframe
        // the title to match the user's mental model — they're
        // adding to a specific day's log, not "to a shelf." On
        // today the copy reads "today's regimen"; on past days
        // it names the day so the user can't be confused about
        // which log they're touching.
        : inRegimenAddContext ? (() => {
            const ctxDate = productModalRegimenContext?.date || localDateISO();
            if (ctxDate === localDateISO()) return "Add a product to today's regimen";
            const dLabel = new Date(ctxDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `Add a product to your ${dLabel} regimen`;
          })()
        : "Add a product to your shelf"
    }>
      <span ref={scrollSentinelRef} aria-hidden="true" style={{display:'none'}} />
      {/* === BACK TO ADD MENU LINK (June 2026 per Jenni) ===
          Shows only when the user opened ProductModal from the
          "Used something else?" sheet. Tap returns them to the root
          add menu (instead of just one screen back). Universal pattern —
          appears wherever they entered the add flow from. */}
      {addMenuReturnContext && typeof onReturnToAddMenu === 'function' && (
        <button
          type="button"
          onClick={onReturnToAddMenu}
          className="mb-3 inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.18em] uppercase transition hover:opacity-70"
          style={{color:'var(--ink-soft)', fontWeight:600, background:'transparent', border:'none', padding:0, cursor:'pointer'}}
        >
          <Icon name="ArrowLeft" size={11} />
          <span>Back to add menu</span>
        </button>
      )}
      {/* === DEDUPE WARNING BANNER ===
          Surfaces when the user tries to save a product whose name+brand
          already matches something on the shelf. Three actions: open the
          existing one (closes this modal and scrolls the shelf), save anyway
          (sets the bypass ref and re-fires handleSubmit), or cancel. */}
      {productDupeWarning && (() => {
        const existing = productDupeWarning.existing;
        const reason = productDupeWarning.reason || 'same-name';
        // Differentiated copy:
        //   same-name              = literally the same product (name/brand match)
        //   same-active-strength   = same active + same pct + same category
        //                            (different brand/name but doing the same job)
        const eyebrowText = reason === 'same-active-strength'
          ? 'Same active, same strength'
          : 'Already on your shelf';
        const bodyText = reason === 'same-active-strength'
          ? "You already have a product at this active + percentage in the same category. Different strengths (e.g. 5% vs 10% niacinamide) are clinically different products — but at the same strength, this is likely a duplicate. Replace, or save if it's a different formulation."
          : "A similar product is already saved. View the existing entry, or save this as a separate item if it's actually different.";
        return (
          <div
            className="rounded-[14px] px-4 py-3 mb-4"
            style={{background:'color-mix(in srgb, var(--accent) 8%, transparent)', border:'1px solid var(--accent)'}}
          >
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream)', color:'var(--accent)', border:'1px solid var(--accent)'}}>
                <Icon name="AlertCircle" size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-[0.22em] uppercase mb-1" style={{color:'var(--accent)', fontWeight:600}}>{eyebrowText}</div>
                <div className="font-sans text-[14px] leading-tight" style={{color:'var(--ink)'}}>
                  {existing.brand ? `${existing.brand} · ` : ''}{existing.name}
                </div>
                <p className="text-[11px] mt-1 leading-snug" style={{color:'var(--ink-soft)'}}>
                  {bodyText}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setProductDupeWarning(null);
                      setShowProductModal(false);
                      setEditingProductId(null);
                      resetHoistedProductState();
                      setActiveTab('regimen');
                      setRegimenView('shelf');
                      setExpandedShelfProductId(existing.id);
                      toast(`Opened ${existing.name}`, 'info');
                    }}
                    className="text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full transition hover:opacity-90"
                    style={{background:'var(--accent)', color:'var(--cream)', cursor:'pointer'}}
                  >
                    View existing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      bypassDupeCheckRef.current = true;
                      setProductDupeWarning(null);
                      handleSubmit();
                    }}
                    className="text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full transition hover:opacity-70"
                    style={{background:'transparent', color:'var(--ink)', border: '1px solid var(--line)', cursor:'pointer'}}
                  >
                    Save anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductDupeWarning(null)}
                    className="text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 transition hover:opacity-70"
                    style={{color:'var(--ink-soft)', cursor:'pointer'}}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* === STAGE 0: Find a Product (3 options) ===
           Three editorial cards: Scan, Search, Browse by Brand. Mirrors the
           Apple-simplicity / Aesop-warmth spec — no product photos, just
           line icons + names. */}
      {entryMode === 'choose' && !isEditing && (
        <div className="space-y-2.5">
          {/* T3 (May 31 2026): Just-added chip strip.
              Surfaces after a successful single-add so the user sees the
              brand/name of what they just saved and can jump straight back
              into edit. Powder-blue surface-info chip matches the rest of
              the system's "you did a thing" affordance. */}
          {lastAddedProduct && (
            <div className="flex justify-center">
              <div className="rounded-full bg-[var(--surface-info)] px-3 py-1.5 text-[11px] inline-flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                <Icon name="Check" size={11} style={{ color: 'var(--ink-soft)' }} />
                <span>
                  Just added: <span style={{ fontWeight: 600 }}>{lastAddedProduct.brand ? `${lastAddedProduct.brand} · ${lastAddedProduct.name}` : lastAddedProduct.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const saved = lastAddedProduct;
                    setLastAddedProduct(null);
                    if (saved?.id) {
                      setEditingProductId(saved.id);
                      setProductForm(null);
                    }
                  }}
                  className="text-[10px] tracking-[0.15em] uppercase transition hover:opacity-80"
                  style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', borderBottom: '1px dotted var(--accent)' }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}
          {inRegimenAddContext && (
            <p className="text-[10.5px] tracking-[0.05em] text-center -mt-1" style={{color:'var(--ink-soft)'}}>
              Also added to your shelf.
            </p>
          )}
          <p className="text-[11px] font-light leading-snug text-center" style={{color:'var(--ink-soft)'}}>
            Search by barcode, brand, or name.
          </p>
          <button onClick={() => { setEntryMode('scan'); }} className="w-full p-3.5 rounded-[14px] border transition flex items-center gap-3 hover:bg-[var(--cream-deep)] cursor-pointer" style={{borderColor: 'var(--line)', background:'var(--cream)', cursor:'pointer'}}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream-deep)', color:'var(--ink)'}}>
              <Icon name="ScanLine" size={16} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-sans text-[15px] leading-tight" style={{color:'var(--ink)'}}>Scan product</div>
              <div className="text-[10px] tracking-[0.05em] mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>Position the bottle within the frame</div>
            </div>
            <Icon name="ChevronRight" size={14} style={{color:'var(--ink-soft)'}} />
          </button>
          <button onClick={() => setEntryMode('manual')} className="w-full p-3.5 rounded-[14px] border transition flex items-center gap-3 hover:bg-[var(--cream-deep)] cursor-pointer" style={{borderColor: 'var(--line)', background:'var(--cream)', cursor:'pointer'}}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--cream-deep)', color:'var(--ink)'}}>
              <Icon name="Search" size={16} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-sans text-[15px] leading-tight" style={{color:'var(--ink)'}}>Search product</div>
              <div className="text-[10px] tracking-[0.05em] mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>By name or paste a link</div>
            </div>
            <Icon name="ChevronRight" size={14} style={{color:'var(--ink-soft)'}} />
          </button>
          <button onClick={() => { setProductBrandSelected(null); setProductBrandSearch(''); setProductBrandCatFilter('all'); setEntryMode('brand'); }} className="w-full p-3.5 rounded-[14px] border transition flex items-center gap-3 hover:bg-[var(--cream-deep)] cursor-pointer" style={{borderColor: 'var(--line)', background:'var(--cream)', cursor:'pointer'}}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'var(--accent)', color:'var(--cream)'}}>
              <Icon name="Tag" size={16} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-sans text-[15px] leading-tight" style={{color:'var(--ink)'}}>Search by brand</div>
              <div className="text-[10px] tracking-[0.05em] mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>Browse and discover by brand</div>
            </div>
            <Icon name="ChevronRight" size={14} style={{color:'var(--accent)'}} />
          </button>
        </div>
      )}

      {/* === STAGE: Brand list / Brand products ===
           Compact text-first list, no product photos. Top of screen has a
           back arrow + search input. Selecting a brand drills into its
           products with category filter chips. Selecting a product autofills
           the form and jumps to manual stage so the user can review + save. */}
      {entryMode === 'brand' && !isEditing && (() => {
        // Pick a category-line-icon by category — Apple-simple set.
        const catIcon = (cat) => {
          const c = (cat || '').toLowerCase();
          if (c.includes('cleanser')) return 'Droplets';
          if (c.includes('toner') || c.includes('essence')) return 'Droplet';
          if (c.includes('serum') || c.includes('treatment') || c.includes('ampoule')) return 'Pipette';
          if (c.includes('moistur') || c.includes('cream') || c.includes('lotion')) return 'Circle';
          if (c.includes('sunscreen') || c.includes('spf')) return 'Sun';
          if (c.includes('exfol') || c.includes('peel')) return 'Layers';
          if (c.includes('mask')) return 'Square';
          if (c.includes('oil') || c.includes('balm')) return 'Droplet';
          return 'Package';
        };
        // Heuristic AM/PM suggestion from category + actives.
        const suggestUse = (p) => {
          const c = (p.category || '').toLowerCase();
          const a = (p.actives || '').toLowerCase();
          if (c.includes('sunscreen') || c.includes('spf')) return 'AM';
          if (a.includes('retinol') || a.includes('tretinoin') || a.includes('retinoid') || a.includes('retinaldehyde') || c.includes('exfol')) return 'PM';
          if (a.includes('vitamin c') || a.includes('ascorb')) return 'AM';
          if (c.includes('mask')) return 'PM';
          return 'AM/PM';
        };

        if (!productBrandSelected) {
          // === Brand list screen ===
          // Counts/list computed once. Filtering + ranking happens INSIDE
          // BrandPicker via sortBrandsForPicker (Phase 2, May 2026), so
          // the input order is just a deterministic baseline. Sorting
          // alphabetically gives a stable tiebreaker when two brands
          // tie on priority/popularity score (e.g., two priority-1
          // midrange brands with no further distinction).
          //
          // Was: `.sort((a, b) => counts[b] - counts[a])` — pure
          // count-desc. The user explicitly asked us to stop ranking
          // by count alone; count reflects catalog curation effort,
          // not "what would I recommend to a friend." Count is still
          // a SECONDARY signal in the score (small +10/+20 bonus for
          // 2+/5+ products), but it no longer dominates.
          const counts = {};
          (POPULAR_PRODUCTS || []).forEach(p => { if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1; });
          const brands = Object.keys(counts).sort((a, b) => a.localeCompare(b));
          return (
            <BrandPicker
              brands={brands}
              counts={counts}
              products={products}
              onPick={(b) => { setProductBrandSelected(b); setProductBrandCatFilter('all'); }}
              onBack={() => setEntryMode('choose')}
            />
          );
        }

        // === Brand-products screen ===
        // Filter to the brand, then HERO-FIRST sort (May 2026): products
        // flagged `hero: true` (Jenni's curated top-5 per brand) float to
        // the top so users see the signature SKUs first. Within hero and
        // non-hero groups, original catalog order is preserved.
        const brandProductsRaw = (POPULAR_PRODUCTS || []).filter(p => p.brand === productBrandSelected);
        const brandProducts = [
          ...brandProductsRaw.filter(p => p.hero === true),
          ...brandProductsRaw.filter(p => p.hero !== true),
        ];
        const cats = Array.from(new Set(brandProducts.map(p => p.category).filter(Boolean)));
        const filteredByCat = productBrandCatFilter === 'all'
          ? brandProducts
          : brandProducts.filter(p => p.category === productBrandCatFilter);
        const initials = productBrandSelected.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
        // On select: prefill productForm and jump to manual stage.
        // useTimes intentionally LEFT EMPTY — user must explicitly tap
        // Morning or Evening in the form rather than the brand picker
        // auto-guessing for them.
        const pickProduct = (p) => {
          setProductForm({
            name: p.name || '',
            brand: p.brand || '',
            category: p.category || 'serum',
            startDate: '',
            endDate: '',
            activeIngredients: p.actives || '',
            mainIngredients: p.main || '',
            tags: p.tags || [],
            concerns: p.concerns || [],
            useDays: [0,1,2,3,4,5,6],
            useTimes: [],
            frequency: 'daily',
            notes: '',
            photo: null,
            photoPath: null,
            status: 'active'});
          // Drop straight into manual stage so user can review + save.
          setEntryMode('manual');
          toast(`${p.name} pre-filled — review and save`, 'info');
        };
        // === MULTI-SELECT HANDLERS ===
        // Key by `${brand}|${name}` so checking persists across category
        // filter changes (which would mess up index-based keys).
        const keyFor = (p) => `${(p.brand || '').toLowerCase()}|${(p.name || '').toLowerCase()}`;
        const isChecked = (p) => brandSelectedKeys.has(keyFor(p));
        const toggleCheck = (p) => {
          const k = keyFor(p);
          setBrandSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k); else next.add(k);
            return next;
          });
        };
        // Bulk add — turns every checked POPULAR_PRODUCTS entry into a
        // real shelf product. Skips manual review since the user has
        // already chosen them deliberately. Toast confirms count.
        const bulkAddSelected = () => {
          const toAdd = brandProducts.filter(p => brandSelectedKeys.has(keyFor(p)));
          if (toAdd.length === 0) return;
          const baseTs = Date.now();
          // Sanitize each new product so useTimes is normalized + cadence.days
          // is set. Without this, the May 2026 Today filter would skip them.
          const newProducts = toAdd.map((p, i) => sanitizeProductForSave({
            id: baseTs + i,
            name: p.name || '',
            brand: p.brand || '',
            category: p.category || 'serum',
            startDate: '',
            endDate: '',
            activeIngredients: p.actives || '',
            mainIngredients: p.main || '',
            tags: p.tags || [],
            concerns: p.concerns || [],
            useDays: [0,1,2,3,4,5,6],
            useTimes: [],
            frequency: 'daily',
            notes: '',
            photo: null,
            photoPath: null,
            status: 'active',
            aiAnalysis: null}));
          const updated = [...newProducts, ...products];
          setProducts(updated);
          saveData('products', updated);
          const n = toAdd.length;
          const newIds = newProducts.map(p => p.id);
          // === REGIMEN-ADD CONTEXT (May 2026 per Jenni) ===
          // When the brand-search modal was opened from the Home cover via
          // "Used something else? → Started a new product → Search by brand,"
          // productModalRegimenContext is set. Previously this branch only
          // wrote to the shelf, so the user's "I added this to today"
          // intent silently dropped the regimenLog write and the promote
          // banner never fired. Now we honor the context the same way the
          // single-product save does:
          //   - Write each new product into regimenLogs[date].amProducts or
          //     .pmProducts for the slot
          //   - Fire the promote-to-routine banner for today-only saves so
          //     the user can promote them to the standing routine in one tap
          if (productModalRegimenContext) {
            const ctxSlot = productModalRegimenContext.slot || 'am';
            const ctxDate = productModalRegimenContext.date || localDateISO();
            const slotKey = ctxSlot === 'am' ? 'amProducts' : 'pmProducts';
            if (typeof setRegimenLogs === 'function') {
              const existingLog = (regimenLogs || []).find(r => r.date === ctxDate);
              let nextLogs;
              if (existingLog) {
                nextLogs = regimenLogs.map(r => {
                  if (r.date !== ctxDate) return r;
                  const currentSlot = r[slotKey] || [];
                  const additions = newIds.filter(id => !currentSlot.includes(id));
                  return { ...r, [slotKey]: [...currentSlot, ...additions] };
                });
              } else {
                nextLogs = [
                  {
                    id: Date.now() + n + 1,
                    date: ctxDate,
                    amProducts: ctxSlot === 'am' ? [...newIds] : [],
                    pmProducts: ctxSlot === 'pm' ? [...newIds] : [],
                    amDone: [],
                    pmDone: [],
                    amExtras: [],
                    pmExtras: [],
                    notes: '',
                    submitted: false},
                  ...(regimenLogs || []),
                ];
              }
              setRegimenLogs(nextLogs);
              saveData('regimenLogs', nextLogs).catch(e => console.error('[brand bulk-add → regimen]', e));
            }
            const todayKey = localDateISO();
            if (ctxDate === todayKey) {
              toast(`Added ${n} to today's ${ctxSlot.toUpperCase()} ✨`, 'success');
              // Fire the promote-to-routine banner. Shape extended to
              // accept productIds (array) so multi-add can promote all
              // at once if the user taps Add to routine.
              if (typeof setPromoteToRoutinePrompt === 'function') {
                setPromoteToRoutinePrompt({
                  productIds: newIds,
                  productNames: newProducts.map(p => p.name),
                  slot: ctxSlot});
              }
            } else {
              const dLabel = new Date(ctxDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              toast(`Added ${n} to ${ctxSlot.toUpperCase()} for ${dLabel} ✨`, 'success');
            }
            if (typeof setCoverRoutineRebuildToken === 'function') {
              setCoverRoutineRebuildToken(t => t + 1);
            }
            if (typeof setProductModalRegimenContext === 'function') {
              setProductModalRegimenContext(null);
            }
          } else {
            // Shelf-only path (no regimen context) — keep original behavior.
            toast(`Added ${n} product${n === 1 ? '' : 's'} to shelf`, 'info');
          }
          setBrandSelectedKeys(new Set());
          setShowProductModal(false);
          setEditingProductId(null);
          setProductBrandSelected(null);
        };
        const selectedCount = brandSelectedKeys.size;
        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setProductBrandSelected(null)}
                className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-90 border cursor-pointer"
                style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream-deep)', cursor:'pointer'}}
              >
                <Icon name="ArrowLeft" size={11} /> Brands
              </button>
              <span className="text-[9px] tracking-[0.2em] uppercase" style={{color:'var(--ink-soft)'}}>{brandProducts.length} products</span>
            </div>
            {/* Brand header — initials + name + count */}
            <div className="flex items-center gap-3 pb-2 border-b" style={{borderColor: 'var(--line)'}}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-sans text-[11px]" style={{background:'var(--cream-deep)', color:'var(--ink-soft)', border: '1px solid var(--line)'}}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-sans text-[15px] leading-tight" style={{color:'var(--ink)'}}>{productBrandSelected}</div>
              </div>
            </div>
            {/* Category filter chips */}
            {cats.length > 1 && (
              <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
                <div className="flex gap-1.5 pb-1">
                  {['all', ...cats].map(c => {
                    const active = productBrandCatFilter === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setProductBrandCatFilter(c)}
                        className="flex-shrink-0 text-[9.5px] tracking-[0.05em] px-2.5 py-1 border rounded-full transition cursor-pointer"
                        style={{
                          background: active ? 'var(--ink)' : 'transparent',
                          color: active ? 'var(--cream)' : 'var(--ink-soft)',
                          borderColor: active ? 'var(--ink)' : 'var(--line)',
                          cursor: 'pointer'}}
                      >{c === 'all' ? 'All' : c.replace(/-/g, ' ')}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Product list — text-first, dense, no photos.
                May 2026: rows are multi-select. Tap anywhere on the row to
                toggle the checkbox; the product name link is a separate
                "Details" button for single-add flow. A sticky footer
                surfaces the bulk-save CTA when items are checked. */}
            <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
              {filteredByCat.map((p, i) => {
                const useTag = suggestUse(p);
                const benefits = (p.tags || []).slice(0, 2).join(' · ');
                const checked = isChecked(p);
                return (
                  <button
                    key={i}
                    onClick={() => toggleCheck(p)}
                    className="w-full flex items-start gap-2.5 py-2.5 px-1 border-b transition hover:bg-[var(--cream-deep)] cursor-pointer text-left"
                    style={{borderColor: 'var(--line)', cursor:'pointer', background: checked ? 'var(--cream)' : 'transparent'}}
                    aria-pressed={checked}
                  >
                    {/* Checkbox circle — fills on select */}
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1 transition"
                      style={{
                        background: checked ? 'var(--accent)' : 'transparent',
                        border: '1.5px solid ' + (checked ? 'var(--accent)' : 'var(--line)')}}
                    >
                      {checked && <Icon name="Check" size={11} style={{color:'var(--cream)'}} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-[13px] leading-tight" style={{color:'var(--ink)'}}>{p.brand || p.name}</div>
                      {p.brand && p.name && p.brand !== p.name && (
                        <div className="text-[10.5px] mt-0.5 truncate" style={{color:'var(--ink-soft)'}}>{p.name}</div>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[9px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>{p.category}</span>
                        {benefits && <span className="text-[9.5px]" style={{color:'var(--ink-soft)'}}>· {benefits}</span>}
                      </div>
                      {p.actives && <div className="text-[10px] mt-0.5 truncate" style={{color:'var(--ink)'}}>{p.actives}</div>}
                    </div>
                    <span className="flex-shrink-0 text-[8.5px] tracking-[0.18em] uppercase rounded-full px-2 py-0.5 mt-0.5" style={{background: useTag === 'AM' ? 'var(--accent-soft)' : 'var(--cream-deep)', color: useTag === 'AM' ? 'var(--accent)' : 'var(--ink-soft)', border: '1px solid var(--line)'}}>{useTag}</span>
                  </button>
                );
              })}
              {filteredByCat.length === 0 && (
                <p className="text-[11px] py-3 text-center" style={{color:'var(--ink-soft)'}}>No {productBrandCatFilter} products in this brand.</p>
              )}
            </div>

            {/* Sticky bulk-save footer — only when items are checked */}
            {selectedCount > 0 && (
              <div
                className="rounded-[14px] p-3 flex items-center gap-3 mt-2"
                style={{background:'var(--cream-deep)', border:'1px solid var(--accent)'}}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px]" style={{color:'var(--ink)', fontWeight:600}}>
                    {selectedCount} selected
                  </div>
                  <div className="text-[10px] tracking-[0.04em]" style={{color:'var(--ink-soft)'}}>
                    Tap to deselect · or save them all
                  </div>
                </div>
                <button
                  onClick={() => setBrandSelectedKeys(new Set())}
                  className="text-[10px] tracking-[0.18em] uppercase"
                  style={{color:'var(--ink-soft)', fontWeight:600, cursor:'pointer'}}
                  type="button"
                >Clear</button>
                <button
                  onClick={bulkAddSelected}
                  className="pill-btn primary"
                  type="button"
                >
                  <Icon name="Check" size={12} style={{marginRight:6}} />
                  Save {selectedCount}
                </button>
              </div>
            )}
            {selectedCount === 0 && (
              <p className="text-[10.5px] text-center mt-2" style={{color:'var(--ink-soft)'}}>
                Tap any product to select. Pick as many as you want.
              </p>
            )}
          </div>
        );
      })()}

      {/* === STAGE: Scan === */}
      {entryMode === 'scan' && !isEditing && (
        <div className="space-y-3">
          {/* Back link */}
          <button
            type="button"
            onClick={() => { setEntryMode('choose'); setScanPhoto(null); setDetectedProducts([]); setScanError(''); setProductScanBatch([]); setProductScanBatchProgress(null); }}
            className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-90 border cursor-pointer"
            style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream-deep)', cursor:'pointer'}}
          >
            <Icon name="ArrowLeft" size={11} /> Back
          </button>

          {/* Photo slot — empty state. Once user has photos in the batch,
              this hides and the batch thumbnail strip takes over. */}
          {(productScanBatch || []).length === 0 && (
            <div className="border-2 border-dashed rounded-md p-6 text-center" style={{borderColor: 'var(--line)', background:'var(--cream)'}}>
              <Icon name="Camera" size={28} className="mx-auto mb-2" style={{color:'var(--ink-soft)'}} />
              {/* Copy aligned with actual behavior (May 2026): the
                  capture is sequential — tap Take photo, snap a product,
                  the photo lands in the batch strip below, tap again
                  for the next. Library lets you grab several at once.
                  Previous copy said "one photo, many products" which
                  suggested a single layout shot — misled users into
                  laying products out instead of using the more reliable
                  one-product-per-photo flow. */}
              <p className="text-xs mb-3" style={{color:'var(--ink-soft)'}}>Take one photo per product. We'll read the labels together. <br/><span style={{color:'var(--accent)'}}>Library lets you pick multiple at once.</span></p>
              <div className="flex gap-2 justify-center">
                {/* Product scan uses native capture on phones and the in-app
                    camera on desktop. Library remains the explicit file path. */}
                <button
                  type="button"
                  onClick={openProductScanCamera}
                  className="px-4 py-2 rounded-full tracking-[0.15em] text-[10px] uppercase transition flex items-center gap-1.5 cursor-pointer"
                  style={{background:'var(--accent)', color:'var(--cream)', cursor:'pointer'}}
                >
                  <Icon name="Camera" size={11} /> Take photo
                </button>
                <button
                  type="button"
                  onClick={() => scanGalleryRef.current?.click()}
                  className="px-4 py-2 rounded-full tracking-[0.15em] text-[10px] uppercase border transition flex items-center gap-1.5 cursor-pointer"
                  style={{borderColor: 'var(--line)', color:'var(--ink)', cursor:'pointer'}}
                >
                  <Icon name="Image" size={11} /> Library
                </button>
              </div>
              <input ref={scanFileRef} type="file" accept="image/*" capture="environment" onChange={handleScanPhoto} className="hidden" />
              <input ref={scanGalleryRef} type="file" accept="image/*" multiple onChange={handleScanPhoto} className="hidden" />
              {scanShowCamera && (
                <CameraCaptureModal
                  mode="product"
                  multi={false}
                  onClose={() => setScanShowCamera(false)}
                  onCapture={async (dataUrl, shots) => {
                    await processScanCameraResult(dataUrl, shots);
                    setScanShowCamera(false);
                  }}
                />
              )}
            </div>
          )}

          {/* === BATCH THUMBNAIL STRIP ===
              Horizontal scroll of captured photos. Each has an X to remove
              that individual photo. Only renders when at least one photo
              has been captured AND we haven't moved on to detected results. */}
          {(productScanBatch || []).length > 0 && detectedProducts.length === 0 && (
            <div>
              <div className="mb-2">
                <div className="text-[9.5px] tracking-[0.22em] uppercase flex items-center justify-between" style={{color:'var(--ink-soft)'}}>
                  <span>{(productScanBatch || []).length} photo{(productScanBatch || []).length === 1 ? '' : 's'} ready</span>
                  {!scanning && (productScanBatch || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setProductScanBatch([]); setScanPhoto(null); setScanError(''); }}
                      className="text-[9px] normal-case tracking-normal underline cursor-pointer"
                      style={{color:'var(--ink-soft)', cursor:'pointer'}}
                    >Clear all</button>
                  )}
                </div>
                {!scanning && (
                  <p className="text-[10.5px] mt-1" style={{color:'var(--ink-soft)'}}>Add more, or analyze when you're done.</p>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {(productScanBatch || []).map((photo, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <img src={photo} alt={`Photo ${i + 1}`} className="w-20 h-24 object-cover rounded-md" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}} />
                    {!scanning && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductScanBatch(prev => prev.filter((_, j) => j !== i));
                          // If we just removed the most recent photo (which scanPhoto mirrors),
                          // point scanPhoto at the new last photo or null.
                          setScanPhoto(prev => {
                            const remaining = (productScanBatch || []).filter((_, j) => j !== i);
                            return remaining[remaining.length - 1] || null;
                          });
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition hover:opacity-90 cursor-pointer"
                        style={{background:'var(--cream)', border: '1px solid var(--line)', color:'var(--ink-soft)', boxShadow:'0 1px 3px rgba(28,25,23,0.10)', cursor:'pointer'}}
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        <Icon name="X" size={9} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {scanning ? (
                <div className="mt-2 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] tracking-[0.2em] uppercase pulse-soft" style={{background:'var(--cream-deep)', color:'var(--ink)'}}>
                  <Icon name="Loader2" size={13} className="spin" />
                  Reading {productScanBatchProgress ? `${productScanBatchProgress.current} of ${productScanBatchProgress.total}` : 'labels'}…
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={openProductScanCamera}
                    className="flex-shrink-0 px-3 py-2 rounded-full text-[10px] tracking-[0.15em] uppercase border transition hover:bg-[var(--cream-deep)] cursor-pointer flex items-center gap-1.5"
                    style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream)', cursor:'pointer'}}
                  >
                    <Icon name="Plus" size={11} /> Take another
                  </button>
                  <button
                    type="button"
                    onClick={() => scanGalleryRef.current?.click()}
                    className="flex-shrink-0 px-3 py-2 rounded-full text-[10px] tracking-[0.15em] uppercase border transition hover:bg-[var(--cream-deep)] cursor-pointer flex items-center gap-1.5"
                    style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream)', cursor:'pointer'}}
                  >
                    <Icon name="Image" size={11} /> From library
                  </button>
                  <button
                    type="button"
                    onClick={analyzeAllScanPhotos}
                    className="flex-1 px-4 py-2 rounded-full text-[10px] tracking-[0.15em] uppercase transition hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                    style={{background:'var(--accent)', color:'var(--cream)', cursor:'pointer'}}
                  >
                    <Icon name="Sparkles" size={11} /> Analyze & review {productScanBatch.length}
                  </button>
                </div>
              )}
              {/* Same hidden inputs reused — handleScanPhoto appends to the batch. */}
              <input ref={scanFileRef} type="file" accept="image/*" capture="environment" onChange={handleScanPhoto} className="hidden" />
              <input ref={scanGalleryRef} type="file" accept="image/*" multiple onChange={handleScanPhoto} className="hidden" />
              {scanShowCamera && (
                <CameraCaptureModal
                  mode="product"
                  multi={false}
                  onClose={() => setScanShowCamera(false)}
                  onCapture={async (dataUrl, shots) => {
                    await processScanCameraResult(dataUrl, shots);
                    setScanShowCamera(false);
                  }}
                />
              )}
            </div>
          )}

          {scanError && scanError !== 'NO_RESULTS' && (
            <div className="text-[11px] flex items-start gap-2 p-2 rounded-sm" style={{background:'#fef0ef', color:'#a04555'}}>
              <Icon name="AlertCircle" size={11} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div>{scanError}</div>
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => { if (scanPhoto) detectProductsFromPhoto(scanPhoto); }} className="text-[10px] tracking-[0.15em] uppercase underline" style={{color:'#a04555'}}>Try again</button>
                  <button type="button" onClick={() => setEntryMode('manual')} className="text-[10px] tracking-[0.15em] uppercase underline" style={{color:'#a04555'}}>Enter manually</button>
                </div>
              </div>
            </div>
          )}

          {/* === NO_RESULTS ERROR (May 2026 v2) ===
              Fires when Gemini AND Claude (if available) failed for
              every photo in the batch. Most often image-quality —
              blur, glare, or distance from the label. Blue tone
              (setup-gap UX, not a hard error). Inline routes to the
              two manual entry paths so the user has a clear exit. */}
          {scanError === 'NO_RESULTS' && (
            <div className="text-[12px] flex items-start gap-2 p-3 rounded-md" style={{background:'rgba(199, 231, 245, 0.42)', border:'1px solid rgba(134, 202, 231, 0.46)', color:'var(--ink)'}}>
              <Icon name="Info" size={13} className="flex-shrink-0 mt-0.5" style={{color:'var(--accent-blue)'}} />
              <div className="flex-1">
                <div style={{fontWeight:600, marginBottom:2}}>Couldn’t read any labels.</div>
                <div className="leading-snug" style={{color:'var(--ink-soft)', fontSize:11}}>
                  Try better light or tighter shots — or add by name/brand below.
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setScanError(''); setProductScanBatch([]); }}
                    className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full transition cursor-pointer"
                    style={{background:'var(--accent)', color:'var(--cream)', cursor:'pointer'}}
                  >Retake photos</button>
                  <button
                    type="button"
                    onClick={() => { setScanError(''); setEntryMode('manual'); }}
                    className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full transition cursor-pointer border"
                    style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream)', cursor:'pointer'}}
                  >Search by name</button>
                  <button
                    type="button"
                    onClick={() => { setScanError(''); setEntryMode('brand'); }}
                    className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full transition cursor-pointer border"
                    style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream)', cursor:'pointer'}}
                  >Search by brand</button>
                </div>
              </div>
            </div>
          )}

          {/* === Detected products — review before saving ===
              Photos are analyzed into editable pending products. Nothing is
              saved until the user confirms rows and taps Save selected. */}
          {detectedProducts.length > 0 && (
            <div>
              <div className="mb-3">
                <div className="text-[9px] tracking-[0.25em] uppercase mb-1 flex items-center gap-1.5" style={{color:'var(--accent)'}}>
                  <Icon name="Sparkles" size={10} /> Review detected products
                </div>
                <p className="text-[10.5px] leading-snug" style={{color:'var(--ink-soft)'}}>Confirm what we found before saving to your shelf.</p>
              </div>

              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
                  <Icon name="Check" size={10} style={{color:'var(--accent)'}} />
                  <span className="text-[10px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>
                    {detectedProducts.filter(p => p.checked).length} selected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={saveScannedProducts}
                  disabled={detectedProducts.filter(p => p.checked && p.name).length === 0}
                  className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  style={{background:'var(--accent)', color:'var(--cream)', cursor:'pointer'}}
                >
                  Save selected <Icon name="ArrowRight" size={11} />
                </button>
              </div>

              <div className="text-[9px] tracking-[0.25em] uppercase mb-1.5 flex items-center justify-between" style={{color:'var(--ink-soft)'}}>
                <span>Found {detectedProducts.length} {detectedProducts.length === 1 ? 'product' : 'products'}</span>
                <button
                  type="button"
                  onClick={() => {
                    const allChecked = detectedProducts.every(p => p.checked);
                    setDetectedProducts(prev => prev.map(x => ({ ...x, checked: !allChecked })));
                  }}
                  className="text-[9px] normal-case tracking-normal underline cursor-pointer"
                  style={{color:'var(--ink-soft)', cursor:'pointer'}}
                >
                  {detectedProducts.every(p => p.checked) ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              <div className="space-y-2">
                {detectedProducts.map((p, i) => {
                  const validCats = ['cleanser','toner','serum','moisturizer','sunscreen','treatment','exfoliant','mask','oil','other'];
                  const updateDetected = (patch) => setDetectedProducts(prev => prev.map((x, j) => j === i ? { ...x, ...patch } : x));
                  return (
                    <div
                      key={i}
                      className="rounded-[14px] p-2.5 border"
                      style={{borderColor: p.checked ? 'var(--accent)' : 'var(--line)', background: p.checked ? 'rgba(126, 24, 62, 0.035)' : 'var(--cream)'}}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => updateDetected({ checked: !p.checked })}
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition cursor-pointer"
                          style={{background: p.checked ? 'var(--accent)' : 'transparent', border:'1px solid ' + (p.checked ? 'var(--accent)' : 'var(--line)'), color: p.checked ? 'var(--cream)' : 'var(--ink-soft)', cursor:'pointer'}}
                          aria-label={p.checked ? 'Exclude product' : 'Include product'}
                        >
                          {p.checked ? <Icon name="Check" size={12} /> : <Icon name="Plus" size={12} />}
                        </button>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <StableInput
                            resetKey={`scan-name-${i}-${p.name || ''}`}
                            value={p.name || ''}
                            onChange={(v) => updateDetected({ name: v })}
                            placeholder="Product name"
                            className="w-full font-sans text-[13px] leading-tight bg-transparent border-0 border-b focus:outline-none px-0 py-0.5"
                            style={{color:'var(--ink)', borderColor: 'var(--line)', fontWeight:600}}
                          />
                          <StableInput
                            resetKey={`scan-brand-${i}-${p.brand || ''}`}
                            value={p.brand || ''}
                            onChange={(v) => updateDetected({ brand: v })}
                            placeholder="Brand"
                            className="w-full text-[10.5px] tracking-[0.05em] bg-transparent border-0 border-b focus:outline-none px-0 py-0.5"
                            style={{color:'var(--ink-soft)', borderColor: 'var(--line)'}}
                          />

                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              value={validCats.includes(p.category) ? p.category : 'other'}
                              onChange={(e) => updateDetected({ category: e.target.value })}
                              className="w-full px-2 py-1.5 text-[10.5px] rounded-md border bg-transparent focus:outline-none"
                              style={{borderColor: 'var(--line)', color:'var(--ink)'}}
                            >
                              {validCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>

                            <div className="flex items-center justify-end gap-1.5">
                              {['am','pm'].map(slot => {
                                const active = slot === 'am' ? !!p.amSel : !!p.pmSel;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => updateDetected(slot === 'am' ? { amSel: !p.amSel } : { pmSel: !p.pmSel })}
                                    className="text-[9px] tracking-[0.15em] uppercase px-2 py-1 rounded-full border transition cursor-pointer"
                                    style={{background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--cream)' : 'var(--ink-soft)', borderColor: active ? 'var(--accent)' : 'var(--line)', cursor:'pointer'}}
                                  >{slot}</button>
                                );
                              })}
                            </div>
                          </div>

                          {(p.actives || p.confidence) && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.actives && <span className="text-[9px] truncate max-w-full" style={{color:'var(--ink-soft)'}}>{p.actives}</span>}
                              {p.confidence && <span className="text-[8.5px] tracking-[0.12em] uppercase px-1.5 py-0.5 rounded-full" style={{border: '1px solid var(--line)', color:p.confidence === 'low' ? 'var(--rose)' : 'var(--ink-soft)'}}>{p.confidence}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] mt-2 leading-snug text-center" style={{color:'var(--ink-soft)'}}>
                AM / PM is optional. Leave both off to save to shelf only.
              </p>
            </div>
          )}

          {/* Retake link — secondary action, sits below the list */}
          {scanPhoto && !scanning && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => { setScanPhoto(null); setDetectedProducts([]); setScanError(''); setProductScanBatch([]); setProductScanBatchProgress(null); }}
                className="text-[10px] tracking-[0.18em] uppercase flex items-center gap-1 transition hover:opacity-70 cursor-pointer"
                style={{color:'var(--ink-soft)', cursor:'pointer'}}
              >
                <Icon name="Camera" size={10} /> Retake photo
              </button>
            </div>
          )}
        </div>
      )}

      {/* === STAGE: Manual (existing flow) === */}
      {(entryMode === 'manual' || isEditing) && (
      <div className="space-y-2">
        {!isEditing && (
          // Strong negative top margin pulls the Back pill all the way up
          // flush with the modal header — was rendering ~24px below the
          // title divider with awkward whitespace.
          <button
            onClick={() => { setEntryMode('choose'); }}
            className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase flex items-center gap-1.5 transition hover:opacity-90 border cursor-pointer"
            style={{borderColor: 'var(--line)', color:'var(--ink)', background:'var(--cream-deep)', cursor:'pointer', marginTop: '-12px', marginBottom: '4px'}}
          >
            <Icon name="ArrowLeft" size={11} /> Back
          </button>
        )}
        {/* === AI AUTOFILL REASSURANCE — persistent, every manual add === */}
        {!isEditing && (
          <div className="flex items-start gap-1.5 text-[10px] leading-snug" style={{color:'var(--accent)'}}>
            <Icon name="Sparkles" size={10} className="flex-shrink-0 mt-0.5" />
            <span>Type the name or paste a link — AI fills brand, ingredients, actives, and targeted concerns.</span>
          </div>
        )}
        {/* === SEARCH ROW — hidden in edit mode ===
            The search input sits in a `relative` wrapper so the suggestions
            dropdown can float as an absolute overlay BELOW it, instead of
            pushing the rest of the form down each time results change. This
            keeps the Name/Brand/Actives row from jumping while typing. */}
        {!isEditing && (
        <div className="relative">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              {/* === DEBOUNCED-COMMIT SEARCH INPUT ===
                  Typing was laggy because every keystroke fired
                  setProductSearchInput → App re-renders → ProductModal
                  recreates. Debouncing the upstream commit by 140ms means
                  the App tree only re-renders AFTER the user stops typing
                  for ~140ms, so individual keystrokes feel instant. The
                  typeahead effect still runs ~200ms after the upstream
                  state lands, so suggestions stay live but aren't tied
                  to every single keystroke. */}
              <LocalSearchInput
                initial={searchInput}
                resetKey={searchInputResetKey}
                placeholder="Type a brand, product, or paste a link…"
                className={'w-full px-4 py-2 rounded-full border text-[12px] font-light focus:outline-none transition' + (nameSearching ? ' pr-8' : '')}
                style={{borderColor:'var(--line)', background:'var(--cream-deep)', color:'var(--ink)'}}
                debounceMs={140}
                onCommit={(v) => { setSearchInput(v); setUrlFetchError(''); setSearchError(''); }}
                onSubmit={(v, reset) => { setSearchInput(v); setTimeout(() => runNameSearch(), 0); }}
              />
              {/* Inline searching indicator — sits in the input, doesn't reflow layout. */}
              {nameSearching && (
                <Icon name="Loader2" size={11} className="spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--accent)'}} />
              )}
            </div>
            <button
              type="button"
              onClick={runNameSearch}
              disabled={!searchInput.trim() || nameSearching || urlFetching}
              className="px-3.5 py-2 rounded-full tracking-[0.18em] text-[9px] uppercase whitespace-nowrap transition flex items-center gap-1 disabled:opacity-40"
              style={{background:'var(--accent)', color:'var(--cream)', fontWeight:700}}
            >
              {urlFetching ? <><Icon name="Loader2" size={10} className="spin" /></> : <><Icon name="Sparkles" size={10} /> Search</>}
            </button>
          </div>
          {(urlFetchError || searchError) && (
            <div className="text-[10px] mt-1" style={{color:'var(--rose)'}}>{urlFetchError || searchError}</div>
          )}
          {/* === FLOATING SUGGESTIONS DROPDOWN ===
              Absolute-positioned so it overlays the form below rather than
              pushing it down. z-20 to clear photo thumbnails / icons. */}
          {hasSearched && !isUrl(searchInput) && nameSuggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 border max-h-44 overflow-y-auto shadow-lg z-20"
              style={{background:'var(--cream)', borderColor: 'var(--line)', boxShadow:'0 8px 24px rgba(58,51,40,0.12)'}}
            >
              {(() => {
                // === SIMPLE LIST ===
                // Single click target per row that fills the form. The brand
                // drilldown chip was removed because it confused the click
                // target and broke the apply flow. To see more SKUs from a
                // brand the user just types the brand name and the local DB
                // returns up to 8 matching entries.
                const byBrand = new Map();
                nameSuggestions.forEach(s => {
                  const k = (s.brand || '').toLowerCase();
                  if (!byBrand.has(k)) byBrand.set(k, []);
                  byBrand.get(k).push(s);
                });
                const groups = Array.from(byBrand.entries());
                const dominantBrand = groups.find(([, items]) => items.length >= 3);
                const headerText = dominantBrand
                  ? `From ${dominantBrand[1][0].brand}`
                  : 'Pick one — AI fills the rest';
                return (
                  <>
                    <div className="text-[8px] tracking-[0.25em] uppercase px-2 pt-1.5 pb-1 flex justify-between items-center sticky top-0" style={{color:'var(--ink-soft)', background:'var(--cream)', borderBottom:'1px solid var(--line)'}}>
                      <span>{headerText}</span>
                      <button type="button" onClick={() => { setNameSuggestions([]); setHasSearched(false); }} className="px-1" aria-label="Clear">
                        <Icon name="X" size={9} />
                      </button>
                    </div>
                    {nameSuggestions.map((s, i) => (
                      <button
                        key={`${s.brand}-${s.name}-${i}`}
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="w-full text-left px-2 py-1.5 transition hover:bg-[var(--cream-deep)] block"
                        style={{borderTop: i === 0 ? 'none' : '1px solid var(--line)'}}
                      >
                        <div className="text-[9px] tracking-[0.18em] uppercase" style={{color:'var(--ink-soft)'}}>{s.brand} · {s.category}</div>
                        <div className="font-sans text-sm leading-tight mt-0.5 truncate" style={{color:'var(--ink)'}}>{s.name}</div>
                        {s.actives && <div className="text-[10px] mt-0.5 leading-snug truncate" style={{color:'var(--ink)'}}>{s.actives}</div>}
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          )}
          {deepFilling && (
            <div className="text-[10px] flex items-center gap-1 pulse-soft mt-1" style={{color:'var(--accent)'}}>
              <Icon name="Sparkles" size={10} /> Filling actives, ingredients, concerns…
            </div>
          )}
        </div>
        )}

        {/* === EDITABLE HEADER CARD ===
            New products: hidden — the search input above does the same
            job (and the AI suggestion dropdown auto-fills name/brand on
            pick). Edit mode: shown — this is the canonical "what
            product is this" header for an existing item. (May 31 2026
            per Jenni — remove the redundant ghost preview on the
            Search Product modal.) */}
        {isEditing && (
        <div className="rounded-[12px] px-2.5 py-2 flex items-center gap-2" style={{background:'var(--cream-deep)', border: '1px solid var(--line)'}}>
          <div className="flex-shrink-0 w-7 h-9 flex items-end justify-center" style={{color:'var(--ink-soft)'}}>
            <DashedBottleOutline />
          </div>
          <div className="flex-1 min-w-0">
            <StableInput
              resetKey={editingProductId || 'new'}
              value={form.name}
              onChange={(v) => setForm({...form, name: v})}
              placeholder="Product name"
              className="w-full font-sans text-[14px] leading-tight bg-transparent border-0 focus:outline-none px-0 py-0"
              style={{color:'var(--ink)', fontWeight:600}}
            />
            <StableInput
              resetKey={editingProductId || 'new'}
              value={form.brand}
              onChange={(v) => setForm({...form, brand: v})}
              placeholder="Brand"
              className="w-full text-[10.5px] tracking-[0.05em] bg-transparent border-0 focus:outline-none px-0 py-0"
              style={{color:'var(--ink-soft)'}}
            />
          </div>
          {form.category && (
            <span className="flex-shrink-0 text-[8.5px] tracking-[0.08em] uppercase px-2 py-0.5 rounded-full" style={{border: '1px solid var(--line)', color:'var(--ink-soft)', background:'var(--cream)'}}>
              {form.category}
            </span>
          )}
        </div>
        )}

        {/* === TIME OF DAY ===
            Compact AM/PM pill toggle. Same data flow as before — writes
            to form.useTimes array. Replaces the redundant big Morning/
            Evening section that lived below. */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-[0.22em]" style={{color:'var(--ink-soft)'}}>Time of day</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { key: 'am', label: 'AM', icon: 'Sun' },
              { key: 'pm', label: 'PM', icon: 'Moon' },
            ].map(slot => {
              const active = (form.useTimes || []).includes(slot.key);
              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => setForm(prev => {
                    const s = new Set(prev.useTimes || []);
                    if (s.has(slot.key)) s.delete(slot.key); else s.add(slot.key);
                    return { ...prev, useTimes: Array.from(s) };
                  })}
                  className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase flex items-center justify-center gap-1.5 transition border cursor-pointer"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--line)',
                    background: active ? 'var(--accent)' : 'var(--cream)',
                    color: active ? 'var(--cream)' : 'var(--ink-soft)',
                    cursor: 'pointer'}}
                >
                  <Icon name={slot.icon} size={10} /> {slot.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* === Type + Frequency === */}
        <div className="grid grid-cols-2 gap-1.5">
          {isCustomCat ? (
            <StableInput resetKey={editingProductId || 'new'} value={form.category} onChange={(v) => setForm({...form, category: v})} placeholder="Type" className={inputCls + ' !py-1.5 !text-[11px]'} />
          ) : (
            <select value={form.category} onChange={e => {
              if (e.target.value === '__custom__') setForm({...form, category: ''});
              else setForm({...form, category: e.target.value});
            }} className={inputCls + ' !py-1.5 !text-[11px]'}>
              <option value="cleanser">Cleanser</option><option value="toner">Toner</option><option value="serum">Serum</option>
              <option value="moisturizer">Moisturizer</option><option value="sunscreen">Sunscreen</option><option value="treatment">Treatment</option>
              <option value="exfoliant">Exfoliant</option><option value="mask">Mask</option><option value="oil">Oil</option><option value="other">Other</option>
              <option value="__custom__">Custom…</option>
            </select>
          )}
          <select value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} className={inputCls + ' !py-1.5 !text-[11px]'}>
            <option value="daily">Daily</option>
            <option value="twice-daily">Twice daily</option>
            <option value="every-other-day">Every other day</option>
            <option value="2-3x-week">2–3× / week</option>
            <option value="weekly">Weekly</option>
            <option value="as-needed">As needed</option>
          </select>
        </div>

        {/* === Actives + Main ingredients on ONE compact row ===
             Two text fields side-by-side. Actives still gets its own kicker label
             since it's the AI's main contribution; Main is borderless / placeholder-driven. */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] mb-0.5 flex items-center gap-1" style={{color:'var(--accent)'}}>
              Actives
              {form.activeIngredients && !aiBusy && <Icon name="Sparkles" size={8} />}
            </div>
            <StableInput
              resetKey={editingProductId || 'new'}
              value={form.activeIngredients}
              onChange={(v) => setForm({...form, activeIngredients: v})}
              placeholder={aiBusy ? '…' : 'Niacinamide 10%'}
              className={inputCls + ' !py-1.5 !text-[11px]'}
              style={form.activeIngredients ? {borderColor: 'var(--line)'} : {}}
            />
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] mb-0.5" style={{color:'var(--ink-soft)'}}>Main</div>
            <StableInput
              resetKey={editingProductId || 'new'}
              value={form.mainIngredients}
              onChange={(v) => setForm({...form, mainIngredients: v})}
              placeholder={aiBusy ? '…' : 'Humectants, soothers'}
              className={inputCls + ' !py-1.5 !text-[11px]'}
            />
          </div>
        </div>

        {/* === Targeted concerns — single-row horizontal scroll rail ===
            Renamed concern set per spec. Old tags from existing products
            still match via the canonicalConcern map (oiliness → oil-control,
            enlarged-pores → pores, blemishes → acne). Rail uses
            overflow-x-auto + flex-nowrap so chips never wrap to a second
            row. .no-scrollbar hides the visible track. Subtle right-edge
            fade hints "swipe for more" without a chrome arrow. */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-[0.22em]" style={{color:'var(--ink-soft)'}}>Concerns addressed</div>
          <div className="relative">
            <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
              <div className="flex gap-1.5 flex-nowrap pb-0.5">
                {[
                  'oil-control','pores','redness','uneven-tone','dullness','texture',
                  'hyperpigmentation','sensitivity','barrier','acne'
                ].map(c => {
                  const active = (form.concerns || []).includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        concerns: active ? (prev.concerns || []).filter(x => x !== c) : [...(prev.concerns || []), c]
                      }))}
                      className="flex-shrink-0 text-[10px] tracking-[0.05em] px-2.5 py-1 border rounded-full transition cursor-pointer whitespace-nowrap"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--line)',
                        background: active ? 'var(--accent)' : 'var(--cream)',
                        color: active ? 'var(--cream)' : 'var(--ink-soft)',
                        cursor: 'pointer'}}
                    >
                      {c.replace(/-/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Right-edge fade — fades the last chip into the cream so
                there's a subtle "scroll for more" affordance. */}
            <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-8" style={{background: 'linear-gradient(to left, var(--cream), transparent)'}} />
          </div>
        </div>

        {/* === SCHEDULE (June 2026 per Jenni — three-chip redesign) ===
            THREE chips, mutually exclusive intent:
              Today only — useDays=[] useTimes=[]. Product saves to shelf
                           but doesn't enter the weekly routine. Skips the
                           promoteToRoutinePrompt banner after save.
              Suggested ✦ — heuristic pattern based on category + actives.
                            For masks this is 1-2×/week, not daily.
              Pick days — user manually toggles weekday pills below.
            Day-picker row shows only for Suggested + Pick days. Hidden
            for Today only since there's nothing to pick. */}
        <div className="space-y-1.5">
          <div className="text-[9px] uppercase tracking-[0.22em]" style={{color:'var(--ink-soft)'}}>Save to</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const sugActive = cadenceMatchesSuggested(form.useDays, form.useTimes, form.category, form.activeIngredients);
              const todayOnlyActive = (form.useDays || []).length === 0 && (form.useTimes || []).length === 0;
              const allDaysSelected = ((form.useDays || []).length === 7) && (form.useTimes || []).length === 2;
              const customActive = !sugActive && !todayOnlyActive && !allDaysSelected;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, useDays: [], useTimes: [] }))}
                    className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full transition cursor-pointer border"
                    style={{
                      borderColor: todayOnlyActive ? 'var(--accent)' : 'var(--line)',
                      background: todayOnlyActive ? 'var(--accent)' : 'var(--cream)',
                      color: todayOnlyActive ? 'var(--cream)' : 'var(--ink-soft)',
                      cursor: 'pointer'}}
                    title="Save to shelf but don't add to weekly routine"
                  >Today only</button>
                  <button
                    type="button"
                    onClick={() => {
                      const sug = suggestedCadence(form.category, form.activeIngredients);
                      setForm(prev => ({ ...prev, useDays: sug.days, useTimes: sug.times }));
                    }}
                    className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full transition flex items-center gap-1 cursor-pointer border"
                    style={{
                      borderColor: sugActive ? 'var(--accent)' : 'var(--line)',
                      background: sugActive ? 'var(--accent)' : 'var(--cream)',
                      color: sugActive ? 'var(--cream)' : 'var(--ink-soft)',
                      cursor: 'pointer'}}
                    title="Apply Frida's suggested pattern based on this product's category + actives"
                  >
                    Suggested <Icon name="Sparkles" size={9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Default Pick-days to current weekday + AM if nothing set,
                      // so the picker has a starting state to nudge.
                      if ((form.useDays || []).length === 0) {
                        const today = new Date().getDay();
                        setForm(prev => ({ ...prev, useDays: [today], useTimes: ['am'] }));
                      } else if (!customActive) {
                        // Switching from Daily/Suggested → leave the days, let user adjust.
                      }
                    }}
                    className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full transition cursor-pointer border"
                    style={{
                      borderColor: customActive ? 'var(--accent)' : 'var(--line)',
                      background: customActive ? 'var(--accent)' : 'var(--cream)',
                      color: customActive ? 'var(--cream)' : 'var(--ink-soft)',
                      cursor: 'pointer'}}
                    title="Choose specific days yourself"
                  >Pick days</button>
                </>
              );
            })()}
          </div>
          {/* Day-of-week pills — hidden when Today only is selected. */}
          {((form.useDays || []).length > 0 || (form.useTimes || []).length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {['S','M','T','W','T','F','S'].map((label, idx) => {
                const active = (form.useDays || []).includes(idx);
                return (
                  <button key={idx} type="button" onClick={() => setForm(prev => {
                    const d = new Set(prev.useDays || []);
                    if (d.has(idx)) d.delete(idx); else d.add(idx);
                    return { ...prev, useDays: Array.from(d).sort() };
                  })} className="w-8 h-8 text-[11px] font-medium rounded-full transition flex items-center justify-center cursor-pointer" style={{
                    borderWidth: '1px', borderStyle: 'solid',
                    borderColor: active ? 'var(--accent)' : 'var(--line)',
                    background: active ? 'var(--accent)' : 'var(--cream)',
                    color: active ? 'var(--cream)' : 'var(--ink-soft)',
                    cursor: 'pointer'}} title={['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][idx]}>{label}</button>
                );
              })}
            </div>
          )}
          {/* Today-only hint copy — replaces day picker so user knows what'll happen on save. */}
          {(form.useDays || []).length === 0 && (form.useTimes || []).length === 0 && (
            <p className="text-[10px] pt-1" style={{color:'var(--ink-soft)'}}>
              Saves to your shelf. Won't auto-schedule. You can refine your routine after.
            </p>
          )}
        </div>
        {/* Hidden file input — kept so the "AI label scan" path elsewhere
            still works. The visible Take Photo button + photo thumbnail
            were removed in favor of the bottle-outline header card. */}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        {needsLabelHelp && !form.photo && (
          <div className="text-[10px] flex items-center gap-1.5 px-2 py-1 rounded-sm" style={{background:'var(--accent-soft)', color:'var(--ink)'}}>
            <Icon name="AlertCircle" size={10} style={{color:'var(--accent)'}} />
            <span>Can't pull ingredients — <button onClick={() => fileRef.current?.click()} className="underline font-medium" style={{color:'var(--accent)'}}>upload bottle photo</button>.</span>
          </div>
        )}
        {/* (Big Morning/Evening section removed — TIME OF DAY pills near
            the header card now handle the same useTimes data.) */}

        {/* === STARTED / STOPPED (one-line layout — May 31 2026 per Jenni) ===
         * Default: no startDate (we assume the user has been using this for a while).
         * Single inline row: label + Today pill + date input + optional Clear.
         * Hint demoted to placeholder rather than its own paragraph. */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[9px] uppercase tracking-[0.22em] flex-shrink-0" style={{color:'var(--ink-soft)'}}>Started</div>
            <button
              type="button"
              onClick={() => setForm({ ...form, startDate: localDateISO() })}
              className="px-3 py-1.5 rounded-full tracking-[0.18em] text-[10px] uppercase border transition flex-shrink-0"
              style={{
                borderColor: form.startDate === localDateISO() ? 'var(--accent)' : 'var(--line)',
                background: form.startDate === localDateISO() ? 'var(--accent)' : 'transparent',
                color: form.startDate === localDateISO() ? 'var(--cream)' : 'var(--accent)'}}
            >Today</button>
            <input
              type="date"
              value={form.startDate || ''}
              max={localDateISO()}
              onChange={e => setForm({...form, startDate: e.target.value || null})}
              className={inputCls + ' !text-xs flex-1 min-w-[112px] !py-1.5'}
            />
            {form.startDate && (
              <button
                type="button"
                onClick={() => setForm({ ...form, startDate: null })}
                className="text-[9px] tracking-[0.18em] uppercase flex-shrink-0"
                style={{color:'var(--ink-soft)'}}
                title="Clear — assume always used"
              >Clear</button>
            )}
          </div>
          {!form.startDate && (
            <p className="text-[10px] font-light" style={{color:'var(--ink-soft)'}}>Blank = assumed long-time use</p>
          )}
          {isEditing && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <div className="text-[9px] uppercase tracking-[0.22em] flex-shrink-0" style={{color:'var(--ink-soft)'}}>Stopped</div>
              <input type="date" value={form.endDate || ''} onChange={e => setForm({...form, endDate: e.target.value})} className={inputCls + ' !text-xs flex-1 min-w-[112px] !py-1.5'} />
            </div>
          )}
        </div>
        {isEditing && (
          <StableInput
            resetKey={editingProductId || 'new'}
            value={form.notes}
            onChange={(v) => setForm({...form, notes: v})}
            placeholder="Notes (optional)"
            className={inputCls + ' text-xs'}
          />
        )}

        {/* Conditional CTA — when AM or PM is picked, the product joins
            today's routine; when neither is picked, it just lands on the
            shelf inventory. The label tells the user exactly what's about
            to happen so the action never feels ambiguous.
            Save-flash (May 2026): on a successful create-mode add the modal
            stays open and this pill morphs to a powder-blue "Saved ✓" for ~1.4s
            before resetting. Confirms the scan/search-by-name/search-by-brand
            path actually committed the product without forcing the user to
            read a toast. */}
        <button
          onClick={handleSubmit}
          disabled={(!form.name && !form.photo) || productSaveFlash}
          className="w-full py-3 rounded-full tracking-[0.2em] text-[10.5px] uppercase transition mt-1 cursor-pointer flex items-center justify-center gap-1.5"
          style={{
            background: productSaveFlash ? 'var(--accent-blue)' : 'var(--accent)',
            color: productSaveFlash ? 'var(--ink)' : 'var(--cream)',
            opacity: (!form.name && !form.photo) ? 0.5 : 1,
            cursor: productSaveFlash ? 'default' : 'pointer'}}
        >
          {productSaveFlash ? (
            <><Icon name="Check" size={12} /> Saved</>
          ) : isEditing
            ? 'Save changes'
            : ((form.useTimes || []).length > 0 ? 'Add to routine' : 'Save to shelf')}
        </button>
      </div>
      )}
    </Modal>
  );
};
