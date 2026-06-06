// One-shot rebuild: strips ALL existing compiled blocks (markered and bare),
// then injects a single fresh compiled block bracketed by RUNTIME markers.
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

// Portable: ROOT follows the location of this script. Lets the same
// build_current.js work whether the repo is cloned to a Mac dev path
// (/Users/.../TangSkin), a Linux box, CI, or the Cowork sandbox mount.
// Anyone editing this should NOT reintroduce a hard-coded absolute path —
// the smoke check (`npm run check`) shells out to `node build_current.js`
// with cwd=ROOT, so the script must self-locate to stay portable.
const ROOT = __dirname;
const HTML = path.join(ROOT, 'index.html');
const SIDECAR = path.join(ROOT, 'index.jsx.source');
const DATA_DIR = path.join(ROOT, 'data');
const START = '<!--RUNTIME-START-->';
const END = '<!--RUNTIME-END-->';

// === DATA EXTRACTION (May 2026 — Path A) ===
// Pure-data sections (POPULAR_PRODUCTS, LESSONS, BRAND_RECOMMENDATION_INFO)
// live in data/*.js as plain module-scope `const` declarations. Build
// concatenates them BEFORE the main sidecar so the data is available to
// the helpers + App component defined downstream. Order matters: brands
// → products → lessons → main source.
const DATA_FILES = [
  'brands.js',                 // BRAND_RECOMMENDATION_INFO (used by productTier helpers in main)
  'products.js',               // POPULAR_PRODUCTS (catalog used by ProductModal + recommender)
  'lessons.js',                // LESSONS (used by Pearls Q&A + journal-aware prompts)
  'recommendationCatalog.js',  // May 2026 — curated rec catalog: RECOMMENDATION_CATALOG, pickFromCatalog, JOB_LABELS, MECHANISM_LABELS
];

const dataParts = DATA_FILES.map(f => {
  const p = path.join(DATA_DIR, f);
  if (!fs.existsSync(p)) {
    console.error(`Missing data file: ${p}`);
    process.exit(1);
  }
  const content = fs.readFileSync(p, 'utf8');
  console.log(`Data: ${f} (${content.length.toLocaleString()} chars)`);
  return `// ===== data/${f} =====\n${content}\n`;
});

// === SRC EXTRACTION (May 2026 — PR 1 file split) ===
// Pure constants + resolvers extracted from index.jsx.source into
// src/constants/ and src/resolvers/ so future PRs can extract more
// pieces without churning the giant sidecar. Order matters:
//   1. constants (no deps)
//   2. resolvers (may use constants)
// These are concatenated AFTER data/* but BEFORE the main sidecar,
// so the sidecar's downstream code sees them at module scope —
// identical to before extraction.
const SRC_FILES = [
  'src/constants/observationChips.js',          // OBSERVATION_CHIPS_BASE, CONTEXT_FACTORS, RATING_5_WORDS
  'src/resolvers/parseSkinMetrics.js',          // SKIN_METRIC_KEYS, SKIN_REGION_VALUES, parseSkinMetrics, parseSkinRegion, stripAnalysisStructuredLines
  'src/resolvers/normalizeRatingTo5.js',
  'src/resolvers/compositeIndex.js',            // Frida Composite Index v1 (June 2026): computeDomainScore, computeCompositeScore, computeBaseline, computeBaselineDelta, pickMostBenignPattern
  'src/resolvers/logHelpers.js',                // Anti-regression refactor (June 2026): createPhotoLogs, addProductToRoutine, addManyToRoutine — single source of truth for log creation + product-to-routine promotion
  'src/resolvers/resolveContextSummary.js',     // PR 4: resolveContextSummary (uses CONTEXT_FACTORS above)
  'src/resolvers/sampleRoutines.js',            // PR 4: SAMPLE_ROUTINES + FOUNDATIONAL_SAMPLE_ROUTINE
  'src/resolvers/routineResolvers.js',          // PR 4b: MAX_FACE_ROUTINE_SLOT_PRODUCTS, isBodyProduct, resolveTodayRitual, getProductsForTodayFromPattern
  'src/resolvers/benchResolvers.js',            // Phase A Tier C (June 2026): benchProductFamily, benchOverlapLabel, benchOverlapFamilyForProduct, computeBench — used by Regimen/bench sub-tab
  'src/resolvers/budgetResolvers.js',           // Phase A.2 Tier C (June 2026): budgetTagsForProduct, budgetConcernHits, budgetScoreFor, budgetSeedHash, computeBudgetPicks, compactDermLabel — used by Regimen/bench Budget Picks section
  'src/resolvers/travelResolvers.js',           // Travel Phase 2.5 (June 2026): travelScore, suggestTravelRegimen — heuristic auto-build for travel packing list
  'src/resolvers/brandRanking.js',              // Phase 1 (May 2026): BRAND_PRIORITY_OVERRIDES + normalize/score/sort helpers for brand + product pickers
  'src/resolvers/extractPhotoDate.js',          // Wave 1.2 (May 2026): EXIF DateTimeOriginal extractor; consumed by BulkPhotoUploadModal
  // === Recommendation engine (May 2026) ===
  // Order: derive → coverage → copy. coverage references deriveProductJobs
  // at call time via the sidecar's module-scope lookup; recCopy references
  // JOB_LABELS / MECHANISM_LABELS / pickFromCatalog from data/recommendationCatalog.js.
  'src/resolvers/deriveProductJobs.js',         // deriveProductJobs(product) → { jobs, mechanismTags }
  'src/resolvers/coverageEngine.js',            // resolveCoverageStates, SWAP_RULES, evaluateSwapRules
  'src/resolvers/recCopy.js',                   // buildRecCards(coverage, { surface }) → card props
  // === Insights helpers (May 2026) ===
  // Pure stats helpers consumed by the new Insights sub-components
  // (MetricSparkline, MetricTrendsGrid, AdherencePanel, PatternsPanel).
  // Module-scope; no React, no App-state coupling.
  'src/insights/computeInsights.js',
  // signalGenerator — deeper Signal cards for the Insights page (May 2026).
  // Pure helper consumed by <SignalsPanel />; depends on no other src/
  // module (it has its own inlined score map + mechanism heuristics so
  // load order vs deriveProductJobs doesn't matter).
  'src/insights/signalGenerator.js',
  // === Sunday Digest (May 2026 — roadmap item 2) ===
  // Pure data layer + .ics builder for the weekly digest. Both are
  // module-scope `const` declarations so they become globals
  // available to <SundayDigestModal /> at runtime. Order:
  //   buildDigest    → assembles structured digest from app state
  //   buildDigestIcs → wraps the digest plaintext into an .ics
  // Neither depends on the other at module load.
  'src/digest/buildDigest.js',
  'src/digest/buildDigestIcs.js',
];

const srcParts = SRC_FILES.map(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) {
    console.error(`Missing src file: ${p}`);
    process.exit(1);
  }
  const content = fs.readFileSync(p, 'utf8');
  console.log(`Src: ${f} (${content.length.toLocaleString()} chars)`);
  return `// ===== ${f} =====\n${content}\n`;
});

// === COMPONENTS (PR 1b — May 2026 file split) ===
// Components extracted from index.jsx.source live here. Injected into
// the sidecar at the `// === COMPONENTS_INJECT ===` marker, so they're
// concatenated AFTER all module-scope primitives (Icon, T tokens,
// CardHeader, Chip, Button, RatingPills, ActionCard, ModalHeader,
// StickyModalFooter) that they depend on, but BEFORE App() which uses
// them. Identical to inline at runtime.
// Order matters: the four checkin/* pieces are referenced inside
// CheckInDetailsModal.jsx, so they must be concatenated BEFORE it.
// Each is independent of the others (no cross-references), so the
// order within checkin/ doesn't matter — but they all come before
// CheckInDetailsModal.
const COMPONENT_FILES = [
  // Wave 1.3 (May 2026) — shared UI primitives. MUST come first because
  // every downstream component / page uses Modal + ModalHeader + button
  // primitives. Order within ui/ doesn't strictly matter since they're
  // all leaves, but Modal is listed last so it's adjacent to its uses.
  // Fix 2 (May 2026): designTokens.js + StableInput.jsx hoisted out of
  // BrandPicker.jsx where they'd been wedged. Loaded FIRST so every
  // downstream UI primitive can reference T.* / <StableInput />.
  'src/components/ui/designTokens.js',
  'src/components/ui/StableInput.jsx',
  'src/components/ui/Chip.jsx',
  'src/components/ui/Button.jsx',
  'src/components/ui/RatingPills.jsx',
  'src/components/ui/ModalHeader.jsx',
  'src/components/ui/StickyModalFooter.jsx',
  'src/components/ui/Modal.jsx',
  // Wave 11 (May 2026) — PlanCommitStrip primitive: unified commit
  // grammar for AI plans (Build, Procedure, Event, SkinLog). Module-
  // scope; no App-state coupling. Listed after Modal so all consumers
  // can reference it. Build adopts it now; Procedure/Event/SkinLog are
  // follow-up adoptions.
  'src/components/ui/PlanCommitStrip.jsx',
  // Wave 1.1 (May 2026) — CameraCaptureModal extracted from sidecar.
  // Self-contained; no App-state coupling. Listed first so any downstream
  // component that opens the camera in the future can reference it.
  'src/components/CameraCaptureModal.jsx',
  // Wave 1.2 (May 2026) — BulkPhotoUploadModal extracted. App passes
  // logs/setLogs/saveData/toast/user/setShowBulkUploadModal as props.
  'src/components/BulkPhotoUploadModal.jsx',
  // May 2026 — GuidedPhotoCaptureModal: 5-step (front/left/right/T-zone/
  // chin) guided face capture flow used by onboarding, daily check-in,
  // and Home cover. Stores {angle, source:'guided_capture', capturedAt}
  // metadata per shot. SEPARATE from BulkPhotoUploadModal which handles
  // batch import of camera-roll history. Both must coexist — bulk import
  // is for many old photos, guided is for today's structured set.
  'src/components/GuidedPhotoCaptureModal.jsx',
  // May 2026 — PhotoImportQueue: mobile-first 3-step (Select/Label/Save)
  // bulk import flow with batch labels drawer. Used by Home picker
  // "Import photo history" and Journal "Import photos". Coexists with
  // GuidedPhotoCaptureModal — different intent (many old vs one fresh).
  'src/components/PhotoImportQueue.jsx',
  // Wave 5.3 (May 2026) — TodayRitualModal extracted from App.
  // The daily command center modal — AM/PM ritual editor with embedded
  // shelf-picker bottom sheet, repeat-yesterday, reorder mode, "used
  // something else" flow. ~720 lines lifted out so App's render is
  // shorter and the modal can be edited in isolation.
  'src/components/TodayRitualModal.jsx',
  // June 2026 — Score explainer drawer ("How your score works"). One source
  // of truth for the cover's composite-index explanation, surfaced from
  // cover delta line, cover kebab, ProfileModal, and first-time auto-show.
  // Lives at module scope alongside Modal so it can be rendered from App.
  'src/components/ScoreExplainerModal.jsx',
  // June 2026 — Travel mode setup modal. Opens from "Used something else?
  // → Going traveling" or from tapping the cover travel banner. Captures
  // dates, destination, time zone, climate, packed products, notes.
  // Writes userProfile.travel.
  'src/components/TravelSetupModal.jsx',
  // Wave 5.2 (May 2026) — SkinLogModal extracted (~1027 lines lifted).
  // Photo capture + AI rating + concerns + notes + "also today" inline
  // procedure/product start. Multi-photo session fan-out to N entries.
  'src/components/SkinLogModal.jsx',
  // Wave 5.1 (May 2026) — ProductModal extracted (~2300 lines lifted).
  // Previously a useMemo wrapper around productModalImplRef.current that
  // captured fresh closures each render (workaround for in-App identity
  // churn). At module scope the wrapper is unnecessary — plain props.
  'src/components/ProductModal.jsx',
  // === Rec card UI (May 2026) ===
  // RecCardSection is the shared visual model for engine-driven recs
  // across Home / Journal / Regimen / Insights. Must be listed BEFORE
  // any of those views since they reference it.
  'src/components/recommendations/RecCardSection.jsx',
  // Wave 6.1 (May 2026) — OnboardingOverlay extracted from App-render IIFE.
  // ~1217 lines lifted. Render-gated by onboardingState.stage !== 'done'.
  'src/components/OnboardingOverlay.jsx',
  // Wave 6.2 (May 2026) — HomeDashboard extracted.
  // Wave 6.2 (May 2026) — HomeDashboard extracted.
  // Wave 8.3 was reverted: the Home photo, ritual, and pearl panels are
  // intentionally inline again because they share too much dashboard state.
  'src/components/HomeDashboard.jsx',
  // === Insights sub-components (May 2026) ===
  // MUST come before InsightsView since InsightsView renders them.
  // MetricSparkline is a leaf used by MetricTrendsGrid + MetricTrendsList.
  'src/components/insights/MetricSparkline.jsx',
  'src/components/insights/MetricTrendsGrid.jsx', // deprecated June 2026, kept in bundle as dead code (reversible)
  'src/components/insights/MetricTrendsList.jsx', // June 2026 — canonical collapsible-row replacement
  'src/components/insights/AdherencePanel.jsx',   // deprecated June 2026, kept as dead code
  'src/components/insights/PatternsPanel.jsx',    // deprecated June 2026, kept as dead code
  // SignalsPanel — deeper "Étude is noticing" cards (May 2026). Depends
  // on computeSignals from src/insights/signalGenerator.js (above).
  'src/components/insights/SignalsPanel.jsx',
  // Wave 7.4 (May 2026) — InsightsView extracted (~249 lines lifted).
  'src/components/InsightsView.jsx',
  // June 2026 — generic tap-to-zoom modal (Compare pair / Journal single /
  // Read Analysis). Defined BEFORE CompareView so the pair view can use it.
  'src/components/PhotoLightbox.jsx',
  // Wave 7.3 (May 2026) — CompareView extracted (~1300 lines lifted).
  'src/components/CompareView.jsx',
  // Wave 7.2 (May 2026) — JournalView extracted.
  // Wave 8.2 (May 2026) — sub-extracted per-mode panels.
  'src/components/journal/JournalTodayPanel.jsx',
  // JournalCompactPanel deleted 2026-05-31 (dual-render bug; Today panel absorbs legacy 'compact' state)
  'src/components/JournalView.jsx',
  // Wave 7.1 (May 2026) — RegimenView extracted (~4720 lines lifted).
  // Wave 8.1 (May 2026) — RegimenView sub-extracted into per-subview files.
  // Listed BEFORE RegimenView since RegimenView renders them.
  'src/components/regimen/RegimenBuildView.jsx',
  'src/components/regimen/RegimenTodayView.jsx',
  'src/components/regimen/RegimenShelfView.jsx',
  'src/components/regimen/RegimenOccasionsView.jsx',
  'src/components/RegimenView.jsx',
  // Wave 2 (May 2026) — already-separate child components lifted out.
  // All take their inputs as props; no App-state coupling. Listed before
  // App so render sites can reference them as plain components.
  'src/components/content/PearlTrigger.jsx',
  'src/components/content/EvidenceDot.jsx',
  'src/components/product/DashedBottleOutline.jsx',
  'src/components/product/StarterProductPreview.jsx',
  'src/components/product/BrandPicker.jsx',
  'src/components/product/ProposeSlotCard.jsx',
  'src/components/onboarding/OnboardingBuildingPhases.jsx',
  // Wave 3.1 (May 2026) — Home command-center cards.
  'src/components/home/TodayReminder.jsx',
  // StatCard, RecurringConcerns, CycleAwareCard deleted 2026-05-31 (dead — zero refs)
  // Wave 3.2 (May 2026) — Regimen child components.
  'src/components/regimen/RegimenTechnique.jsx',
  'src/components/regimen/RoutineBuilder.jsx',
  'src/components/regimen/CycleTracker.jsx',
  // Wave 3.3 (May 2026) — Journal PhotoTimeline (1194 lines).
  'src/components/journal/PhotoTimeline.jsx',
  // Wave 3.4 (May 2026) — Compare child components.
  'src/components/compare/SplitHalfCompare.jsx',
  'src/components/compare/CompareMetricInfographic.jsx',
  'src/components/compare/ProcedureCompareSlot.jsx',
  'src/components/compare/MiniMonthCalendar.jsx',
  'src/components/compare/CompareAnalysis.jsx',
  'src/components/compare/ComparePresets.jsx',
  // Phase 3A — check-in pieces (consumed by CheckInDetailsModal)
  'src/components/checkin/CheckInPhotoStrip.jsx',
  'src/components/checkin/CheckInObservationChips.jsx',
  // Phase 3C — routine display pieces. Order matters within routine/:
  //   RoutineProductRow + EmptyRoutineState are leaf components,
  //   RoutineSlotList composes both. Listing leaves first.
  'src/components/routine/RoutineProductRow.jsx',
  'src/components/routine/EmptyRoutineState.jsx',
  'src/components/routine/RoutineSlotList.jsx',
  // Modals last — they reference the pieces above.
  'src/components/CheckInDetailsModal.jsx',
  // Phase 4 (May 2026) — ProfileModal extracted out of App to stop the
  // remount cascade that made clicks feel dead. Self-contained: receives
  // all wizard state, setters, and helpers as props from App.
  'src/components/ProfileModal.jsx',
  // Wave 4 (May 2026) — contained modals extracted from App.
  'src/components/ColorModal.jsx',
  'src/components/ApiKeyModal.jsx',
  'src/components/SupabaseModal.jsx',
  'src/components/EventModal.jsx',
  'src/components/ProcedureModal.jsx',
  // Sunday Digest modal (May 2026 — roadmap item 2). Standalone
  // preview surface opened from the hamburger menu. Renders the
  // structured object from buildDigest() and triggers the .ics
  // download from buildDigestIcs.js. Self-contained; receives
  // {open, onClose, logs, regimenLogs, products, toast} from App.
  'src/components/digest/SundayDigestModal.jsx',
];

const componentParts = COMPONENT_FILES.map(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) {
    console.error(`Missing component file: ${p}`);
    process.exit(1);
  }
  const content = fs.readFileSync(p, 'utf8');
  console.log(`Component: ${f} (${content.length.toLocaleString()} chars)`);
  return `// ===== ${f} =====\n${content}\n`;
});

let sidecarSource = fs.readFileSync(SIDECAR, 'utf8');
console.log(`Sidecar: ${sidecarSource.length.toLocaleString()} chars`);

// Splice components into the sidecar at the COMPONENTS_INJECT marker.
// If the marker is missing (shouldn't happen post-PR-1b), append components
// at the end of the sidecar so the build still works.
const INJECT_MARKER = '// === COMPONENTS_INJECT ===';
if (sidecarSource.includes(INJECT_MARKER)) {
  sidecarSource = sidecarSource.replace(
    INJECT_MARKER,
    INJECT_MARKER + '\n' + componentParts.join('\n')
  );
  console.log(`Components injected at marker (${componentParts.length} files)`);
} else {
  console.warn('COMPONENTS_INJECT marker not found — appending components at sidecar end');
  sidecarSource = sidecarSource + '\n' + componentParts.join('\n');
}

// Concatenate: data files first, then src/ extracted pieces, then sidecar (with components injected).
const jsxSource =
  dataParts.join('\n') +
  '\n' + srcParts.join('\n') +
  '\n// ===== index.jsx.source =====\n' + sidecarSource;
console.log(`Combined: ${jsxSource.length.toLocaleString()} chars`);

const compiled = babel.transformSync(jsxSource, {
  presets: [['@babel/preset-react']],
  filename: 'index.jsx',
  compact: true,
  comments: false,
});
console.log(`Compiled: ${compiled.code.length.toLocaleString()} chars`);

let html = fs.readFileSync(HTML, 'utf8');

// 1) Strip all RUNTIME-marker blocks.
//    Also consume the single trailing newline that step 4 emits after END,
//    otherwise each rebuild leaves an extra blank line behind and the
//    output is not byte-stable. The check script verifies idempotency by
//    rebuilding twice and comparing hashes — without this consume, that
//    invariant fails immediately.
while (html.includes(START) && html.includes(END)) {
  const s = html.indexOf(START);
  let e = html.indexOf(END, s) + END.length;
  if (html[e] === '\n') e += 1;
  html = html.slice(0, s) + html.slice(e);
  console.log('Removed an existing RUNTIME block.');
}

// 2) Strip all bare <script data-compiled="jsx"> ... </script> blocks.
function stripCompiledBlocks(src) {
  let out = src;
  while (true) {
    const idx = out.indexOf('<script data-compiled="jsx">');
    if (idx === -1) break;
    const close = out.indexOf('</script>', idx);
    if (close === -1) {
      console.warn('Found <script data-compiled> with no closing </script> — leaving alone.');
      break;
    }
    out = out.slice(0, idx) + out.slice(close + '</script>'.length);
    console.log('Removed a bare compiled block.');
  }
  return out;
}
html = stripCompiledBlocks(html);

// 3) Strip Babel CDN if still present.
html = html.replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\s*\n?/g, '');

// 4) Inject fresh block right before </body>.
const block = `${START}\n<script data-compiled="jsx">\n${compiled.code}\n</script>\n${END}`;
const bodyClose = html.lastIndexOf('</body>');
if (bodyClose === -1) { console.error('No </body> found'); process.exit(1); }
html = html.slice(0, bodyClose) + block + '\n' + html.slice(bodyClose);

fs.writeFileSync(HTML, html);
console.log(`Wrote ${HTML} (${fs.statSync(HTML).size.toLocaleString()} bytes)`);
