// === logHelpers.js (June 2026 — anti-regression refactor per Jenni) ===
//
// Single source of truth for the two highest-bug-rate operations in
// Frida: creating photo logs and adding products to the weekly routine.
// Before this file, both operations were hand-replicated across 4-5
// call sites each, and parallel-path divergence was the root cause of
// most regressions (bulk upload didn't analyze, check-in didn't
// analyze, picks quick-add over-scheduled retinoids, etc.).
//
// THE RULE: if you find yourself writing `setLogs([...newLog, ...logs])`
// or `cadence: { days: [...], frequency: N }` ANYWHERE in the codebase,
// use these helpers instead. If the helper doesn't cover your case,
// extend the helper — don't fork the logic.
//
// All helpers are pure (no React, no closures over App state). Callers
// pass in their state setters and deps. This keeps the helpers
// unit-testable and prevents the App-scope-coupling regression that
// killed earlier refactor attempts.

// =========================================================================
// 1. createPhotoLogs — single path for any "save photo as log" operation
// =========================================================================
//
// Replaces the hand-rolled `newLogs.map(...)` + `setLogs(updated)` +
// `retryLogAnalysis(...)` pattern repeated in:
//   - SkinLogModal (custom inline analysis)
//   - BulkPhotoUploadModal (worker pool we just added)
//   - Guided capture check_in path (worker pool we just added)
//   - Onboarding upload (sequential await)
//
// Usage:
//   const { newLogs, fireAnalysis } = createPhotoLogs({
//     shots,                  // [{ dataUrl, capturedAt, angle, area, source, ...}]
//     defaultDate: localDateISO(),
//     baseFields: { rating: null, concerns: [] },  // optional shared fields
//     apiKeyOn: !!getApiKey(),
//   });
//   setLogs(prev => [...newLogs, ...prev]);
//   if (apiKeyOn) fireAnalysis(retryLogAnalysis);
//
// The `fireAnalysis` returned function takes the retryLogAnalysis
// reference (App-scope) and runs the bounded worker pool internally.
// Caller never has to remember the concurrency limit or stale-closure
// pattern — it's all encapsulated.

const createPhotoLogs = ({
  shots,
  defaultDate,
  baseFields = {},
  apiKeyOn = false,
  source: defaultSource = 'capture',
  concurrency = 3,
  // June 2026 Phase 2: when true, every new photo log gets travel:true so
  // Journal/Compare can split home vs travel weeks. Callers pass
  // userProfile?.travel?.active. Defaults to false — backward compat with
  // existing call sites that don't pass it (correct behavior at home).
  travel = false,
}) => {
  if (!Array.isArray(shots) || shots.length === 0) {
    return { newLogs: [], fireAnalysis: () => {} };
  }
  const baseTime = Date.now();
  const fallbackDate = defaultDate || (() => {
    try { return new Date().toISOString().slice(0, 10); } catch { return ''; }
  })();
  const newLogs = shots.map((shot, i) => {
    const date = shot.date || (shot.capturedAt ? String(shot.capturedAt).slice(0, 10) : null) || fallbackDate;
    return {
      id: baseTime + i,
      date,
      // === ANALYSIS SHAPE ===
      // analyzing:true when API key is available so the cover shows
      // "Reading skin…" instead of an empty card. analyzingStartedAt
      // lets the watchdog clear the flag if analysis hangs >45s.
      analyzing: apiKeyOn,
      analyzingStartedAt: apiKeyOn ? Date.now() : undefined,
      aiAnalysis: null,
      // === STANDARD LOG FIELDS ===
      photo: shot.dataUrl || shot.photo || null,
      photoPath: shot.photoPath || null,
      area: shot.area || shot.angle || 'full-face',
      angle: shot.angle || null,
      capturedAt: shot.capturedAt || new Date().toISOString(),
      source: shot.source || defaultSource,
      rating: shot.rating !== undefined ? shot.rating : (baseFields.rating ?? null),
      ratingScale: shot.ratingScale !== undefined ? shot.ratingScale : baseFields.ratingScale,
      notes: shot.notes !== undefined ? shot.notes : (baseFields.notes ?? ''),
      concerns: Array.isArray(shot.concerns) ? shot.concerns : (baseFields.concerns ?? []),
      noticed: Array.isArray(shot.noticed) ? shot.noticed : (baseFields.noticed ?? []),
      contextFactors: Array.isArray(shot.contextFactors) ? shot.contextFactors : (baseFields.contextFactors ?? []),
      usedProducts: Array.isArray(shot.usedProducts) ? shot.usedProducts : [],
      usedTags: Array.isArray(shot.usedTags) ? shot.usedTags : [],
      ratingExplanation: shot.ratingExplanation ?? null,
      suggestedRating: shot.suggestedRating ?? null,
      ...(travel ? { travel: true } : {}),
    };
  });
  // === FIRE ANALYSIS HELPER ===
  // Returned as a closure so caller passes in their retryLogAnalysis
  // reference. Bounded worker pool — same pattern across every call
  // site (was 3 different implementations before). Pass each log as
  // the logHint argument to avoid the stale-closure bug where
  // retryLogAnalysis can't find the just-created log.
  const fireAnalysis = (retryLogAnalysis) => {
    if (typeof retryLogAnalysis !== 'function') return;
    const queue = [...newLogs];
    const runOne = async (log) => {
      try { await retryLogAnalysis(log.id, log); }
      catch (e) { console.warn('[createPhotoLogs] analysis failed for', log.id, e?.message); }
    };
    Array(Math.min(concurrency, queue.length)).fill(null).forEach(async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await runOne(next);
      }
    });
  };
  return { newLogs, fireAnalysis };
};

// =========================================================================
// 2. addProductToRoutine — single path for "promote product to weekly routine"
// =========================================================================
//
// Replaces the hardcoded `cadence: { days: [0,1,2,3,4,5,6], frequency: 7 }`
// pattern that was repeated across 4 sites and over-scheduled actives
// (Codex flagged this June 2026). The helper always defers to
// suggestedCadence when no explicit cadence is set, so retinoids land
// on MWF PM, masks on Sunday PM, vitamin C on daily AM, etc.
//
// Usage:
//   const updatedProduct = addProductToRoutine(product, slot);
//   setProducts(prev => prev.map(p => p.id === product.id ? updatedProduct : p));
//
// Returns a NEW product object (does not mutate). Caller is responsible
// for swapping it into the products array and persisting via saveData.
//
// Behavior:
//   - useTimes: includes `slot` (idempotent — won't duplicate)
//   - cadence: untouched if already set; otherwise uses suggestedCadence
//   - All other fields preserved as-is

const addProductToRoutine = (product, slot, options = {}) => {
  if (!product) return product;
  const { force = false } = options;
  const prevUseTimes = Array.isArray(product.useTimes) ? product.useTimes : [];
  const nextUseTimes = prevUseTimes.includes(slot) ? prevUseTimes : [...prevUseTimes, slot];
  const hasCadence = product.cadence
    && Array.isArray(product.cadence.days)
    && product.cadence.days.length > 0;
  let nextCadence = product.cadence;
  if (!hasCadence || force) {
    // Resolver call — `suggestedCadence` is module-scope global from
    // index.jsx.source via build_current.js concatenation. Safe to call.
    const sug = (typeof suggestedCadence === 'function')
      ? suggestedCadence(product.category, product.activeIngredients || product.actives)
      : { days: [0,1,2,3,4,5,6], times: ['am','pm'] };
    nextCadence = { days: sug.days, frequency: sug.days.length };
  }
  return { ...product, useTimes: nextUseTimes, cadence: nextCadence };
};

// =========================================================================
// 3. addManyToRoutine — batch version for promote-to-routine banner
// =========================================================================
//
// Used by the promoteToRoutinePrompt banner when multiple products
// get promoted at once (bulk brand-add flow). Saves the caller from
// writing the map() + addProductToRoutine() pattern.
//
// Usage:
//   const nextProducts = addManyToRoutine(productsList, productIds, slot);
//   setProducts(nextProducts);

const addManyToRoutine = (productsList, productIds, slot, options = {}) => {
  if (!Array.isArray(productsList)) return productsList;
  const idSet = new Set(Array.isArray(productIds) ? productIds : [productIds]);
  return productsList.map(p => {
    if (!idSet.has(p.id)) return p;
    return addProductToRoutine(p, slot, options);
  });
};

// =========================================================================
// PUBLIC EXPORTS (module-scope — global via build_current.js concat)
// =========================================================================
//
// Module-scope `const` declarations are global once concatenated into
// the bundle. No explicit export syntax needed. Documented here for
// future maintainers:
//
//   createPhotoLogs({ shots, defaultDate, baseFields, apiKeyOn, source, concurrency })
//     → { newLogs, fireAnalysis }
//
//   addProductToRoutine(product, slot, { force? })
//     → updatedProduct
//
//   addManyToRoutine(productsList, productIds, slot, { force? })
//     → updatedProductsList
