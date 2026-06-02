// === BUILD + SMOKE-TEST CHECK ===
// Single guardrail script wired to `npm run check`. Runs four invariants
// against the working tree. Exits non-zero on any failure so this can gate
// CI / pre-commit later.
//
//   1. SOURCES EXIST — every data/* and src/* file build_current.js
//      concatenates must be present on disk. A typo or rename caught here
//      beats a runtime "X is not defined" error.
//
//   2. BUILD IS IDEMPOTENT — running the build twice in a row must produce
//      a byte-identical index.html. If it doesn't, the build is leaking
//      non-determinism (timestamps, random ids, dict ordering) and we
//      can't trust "no diff means no drift" as a source-of-truth signal.
//
//   3. NO APP REACT OUTSIDE RUNTIME — the HTML shell (everything in
//      index.html outside the <!--RUNTIME-START-->...<!--RUNTIME-END-->
//      block) must not contain app-level React. Inlined React /
//      ReactDOM / Supabase library bundles are allowed; hand-edited
//      component code is not.
//
//   4. APP BOOTS IN JSDOM — load the real index.html in jsdom with
//      polyfills injected via `beforeParse` so the inlined Supabase /
//      Lucide UMD bootstrap can complete without crashing on missing
//      browser globals. The flag window.__SMOKE_TEST__ is set so app
//      code can skip product-art / Gemini auto-generation during the
//      check.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = __dirname;
const HTML = path.join(ROOT, 'index.html');
const START = '<!--RUNTIME-START-->';
const END = '<!--RUNTIME-END-->';

const failures = [];
const passes = [];
const warnings = [];
const ok = (msg) => passes.push(msg);
const fail = (msg) => failures.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------------------
// CHECK 1 — referenced sources exist
// ---------------------------------------------------------------------------
const REQUIRED_FILES = [
  'index.jsx.source',
  'index.html',
  'build_current.js',
  'data/brands.js',
  'data/products.js',
  'data/lessons.js',
  'src/constants/observationChips.js',
  'src/resolvers/parseSkinMetrics.js',
  'src/resolvers/normalizeRatingTo5.js',
  'src/resolvers/resolveContextSummary.js',
  'src/resolvers/sampleRoutines.js',
  'src/resolvers/routineResolvers.js',
  'src/resolvers/brandRanking.js',
  'src/resolvers/extractPhotoDate.js',
  'src/components/CheckInDetailsModal.jsx',
  'src/components/checkin/CheckInPhotoStrip.jsx',
  'src/components/checkin/CheckInObservationChips.jsx',
  'src/components/routine/RoutineProductRow.jsx',
  'src/components/routine/EmptyRoutineState.jsx',
  'src/components/routine/RoutineSlotList.jsx',
  // Phase 4 (May 2026) — ProfileModal extracted from inline App definition.
  // If this file is missing the modal won't render. Regression guard below
  // also ensures it stays referenced in build_current.js.
  'src/components/ProfileModal.jsx',
  // Wave 4 (May 2026) — contained modals extracted.
  'src/components/ColorModal.jsx',
  'src/components/ApiKeyModal.jsx',
  'src/components/SupabaseModal.jsx',
  'src/components/EventModal.jsx',
  'src/components/ProcedureModal.jsx',
  // Wave 1.1 (May 2026) — CameraCaptureModal extracted from sidecar.
  'src/components/CameraCaptureModal.jsx',
  // Wave 1.2 (May 2026) — BulkPhotoUploadModal extracted.
  'src/components/BulkPhotoUploadModal.jsx',
  // May 2026 — Guided 5-step face capture (shared across onboarding,
  // check-in, Home). See GuidedPhotoCaptureModal.jsx for full notes.
  'src/components/GuidedPhotoCaptureModal.jsx',
  // May 2026 — PhotoImportQueue: 3-step bulk import (Select/Label/Save)
  'src/components/PhotoImportQueue.jsx',
  // Wave 5.3 (May 2026) — TodayRitualModal extracted.
  'src/components/TodayRitualModal.jsx',
  // Wave 5.2 (May 2026) — SkinLogModal extracted.
  'src/components/SkinLogModal.jsx',
  // Wave 5.1 (May 2026) — ProductModal extracted.
  'src/components/ProductModal.jsx',
  // Wave 6.1 (May 2026) — OnboardingOverlay extracted.
  'src/components/OnboardingOverlay.jsx',
  // Wave 6.2 (May 2026) — HomeDashboard extracted.
  'src/components/HomeDashboard.jsx',
  // Wave 7.4 (May 2026) — InsightsView extracted.
  'src/components/InsightsView.jsx',
  // Wave 7.3 (May 2026) — CompareView extracted.
  'src/components/CompareView.jsx',
  // Wave 7.2 (May 2026) — JournalView extracted.
  'src/components/JournalView.jsx',
  // Wave 8.2 (May 2026) — JournalView sub-panels.
  'src/components/journal/JournalTodayPanel.jsx',
  'src/components/journal/JournalCompactPanel.jsx',
  // Wave 7.1 (May 2026) — RegimenView extracted.
  'src/components/RegimenView.jsx',
  // Wave 8.1 (May 2026) — RegimenView sub-extracted.
  'src/components/regimen/RegimenBuildView.jsx',
  'src/components/regimen/RegimenTodayView.jsx',
  'src/components/regimen/RegimenShelfView.jsx',
  'src/components/regimen/RegimenOccasionsView.jsx',
  // Wave 1.3 (May 2026) — shared UI primitives.
  // Fix 2: designTokens + StableInput hoisted out of BrandPicker.
  'src/components/ui/designTokens.js',
  'src/components/ui/StableInput.jsx',
  'src/components/ui/Chip.jsx',
  'src/components/ui/Button.jsx',
  'src/components/ui/RatingPills.jsx',
  'src/components/ui/ModalHeader.jsx',
  'src/components/ui/StickyModalFooter.jsx',
  'src/components/ui/Modal.jsx',
  // Wave 2 (May 2026) — already-separate child components.
  'src/components/content/PearlTrigger.jsx',
  'src/components/content/EvidenceDot.jsx',
  'src/components/product/DashedBottleOutline.jsx',
  'src/components/product/StarterProductPreview.jsx',
  'src/components/product/BrandPicker.jsx',
  'src/components/product/ProposeSlotCard.jsx',
  'src/components/onboarding/OnboardingBuildingPhases.jsx',
];

let missing = 0;
for (const rel of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    fail(`MISSING: ${rel}`);
    missing++;
  }
}
if (missing === 0) ok(`Sources exist (${REQUIRED_FILES.length} files)`);

// ---------------------------------------------------------------------------
// CHECK 2 — build is idempotent
// ---------------------------------------------------------------------------
// Build once to bring index.html into sync with whatever's in source RIGHT
// NOW, hash it, then build a SECOND time and compare. The before/after
// hashes pivot off the same source state — so a hash mismatch is true
// build non-determinism, not stale-on-disk drift. (Earlier version
// hashed before the first build, which conflated "I edited source" with
// "the build is non-deterministic.")
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
let buildOk = true;
try {
  execSync('node build_current.js', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  fail(`Build failed (pass 1): ${e.message.split('\n')[0]}`);
  buildOk = false;
}
const firstHash = buildOk && fs.existsSync(HTML) ? sha256(HTML) : null;
if (buildOk) {
  try {
    execSync('node build_current.js', { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    fail(`Build failed (pass 2): ${e.message.split('\n')[0]}`);
    buildOk = false;
  }
}
const secondHash = buildOk && fs.existsSync(HTML) ? sha256(HTML) : null;
if (firstHash && secondHash && firstHash !== secondHash) {
  fail(`Build NOT idempotent: two consecutive rebuilds produced different index.html (1st=${firstHash.slice(0,8)}, 2nd=${secondHash.slice(0,8)})`);
} else if (firstHash && secondHash) {
  ok(`Build idempotent (sha=${secondHash.slice(0,8)})`);
}

// ---------------------------------------------------------------------------
// CHECK 3 — no app React outside RUNTIME block
// ---------------------------------------------------------------------------
const html = fs.readFileSync(HTML, 'utf8');
const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END);
if (startIdx === -1 || endIdx === -1) {
  fail('RUNTIME markers missing from index.html');
} else {
  const shell = html.slice(0, startIdx) + html.slice(endIdx + END.length);
  const APP_TOKENS = [
    'function App(',
    'const App =',
    'CheckInDetailsModal',
    'OnboardingBuildingPhases',
    'resolveTodayRitual',
    'BRAND_RECOMMENDATION_INFO',
    'POPULAR_PRODUCTS',
    'OBSERVATION_CHIPS_BASE',
  ];
  const leaks = APP_TOKENS.filter(tok => shell.includes(tok));
  if (leaks.length > 0) {
    fail(`App React leaked into HTML shell (outside RUNTIME): ${leaks.join(', ')}`);
  } else {
    ok('No app React outside RUNTIME block (shell is library-only)');
  }
}

// ---------------------------------------------------------------------------
// CHECK 5 — regression guards (Phase 3D)
// ---------------------------------------------------------------------------
// Each guard scans source files (not the compiled bundle) for patterns
// that have caused real bugs in this codebase. If they reappear, fail
// the check loudly — better here than at runtime in front of the user.
//
// Add a new guard by appending to GUARDS below. Each guard returns:
//   { pass: true | false, msg, severity?: 'fail' | 'warn' }
// `fail` severity blocks the check exit code; `warn` prints but doesn't
// block (use sparingly — warnings get ignored over time).
function collectSourceFiles() {
  // Source = everything the build concatenates plus index.jsx.source itself.
  // Skip data/ (data dictionaries, no code logic to regress) and
  // node_modules / _baseline_v* / .fuse_hidden* / index.html (compiled output).
  const out = [];
  const walk = (rel) => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(abs)) {
        if (name.startsWith('.') || name === 'node_modules' || name === '_baseline_v1' || name === '_baseline_v2') continue;
        walk(path.join(rel, name));
      }
    } else if (/\.(js|jsx)$/.test(rel) && !rel.startsWith('node_modules')) {
      out.push({ rel, abs, text: fs.readFileSync(abs, 'utf8') });
    }
  };
  walk('src');
  // index.jsx.source is the giant sidecar — scanned even though its
  // extension is .source (Babel treats it as JSX via the build's filename
  // override). Treat it like a JSX file for guard purposes.
  const sidecar = path.join(ROOT, 'index.jsx.source');
  if (fs.existsSync(sidecar)) {
    out.push({ rel: 'index.jsx.source', abs: sidecar, text: fs.readFileSync(sidecar, 'utf8') });
  }
  return out;
}

const SOURCE_FILES = collectSourceFiles();

// Guard 1 — useTimes uppercase comparison bug
// In the canonical schema, product.useTimes contains lowercase strings
// ('am' / 'pm'). The pattern `useTimes.includes(slot.toUpperCase())`
// silently never matches and drops products from the rendered slot.
// Sites that need uppercase explicitly map first
// (`.map(s => String(s).toUpperCase())` then `.includes('AM')`), which
// is fine. We're only catching the inline mismatch.
{
  let hits = [];
  for (const f of SOURCE_FILES) {
    const re = /useTimes\.includes\(\s*slot\.toUpperCase\(\)\s*\)/g;
    let m;
    while ((m = re.exec(f.text)) !== null) {
      const line = f.text.slice(0, m.index).split('\n').length;
      hits.push(`${f.rel}:${line}`);
    }
  }
  if (hits.length > 0) fail(`useTimes/slot uppercase mismatch — fixed in Phase 2; reintroduced at: ${hits.join(', ')}`);
  else ok('No useTimes.includes(slot.toUpperCase()) bug pattern');
}

// Guard 2 — RegimenCheckInModal reintroduction
// Removed in Phase 2 cleanup (was 400 lines of dead code that pretended
// to be a legitimate flow). The only allowed mentions are inside
// tombstone / manifest comments. A new `const RegimenCheckInModal =`
// would resurrect the duplicate and would almost certainly happen by
// someone copy-pasting from git history.
{
  let hits = [];
  for (const f of SOURCE_FILES) {
    const re = /\bconst\s+RegimenCheckInModal\s*=/g;
    let m;
    while ((m = re.exec(f.text)) !== null) {
      const line = f.text.slice(0, m.index).split('\n').length;
      hits.push(`${f.rel}:${line}`);
    }
  }
  if (hits.length > 0) fail(`RegimenCheckInModal reintroduced (removed in Phase 2): ${hits.join(', ')}`);
  else ok('RegimenCheckInModal not reintroduced');
}

// Guard 3 — SMOKE_TEST gate on product-art generator
// `generateProductArtForAll` must early-return when window.__SMOKE_TEST__
// is true; otherwise `npm run check` burns Gemini quota and spams logs.
// We check the structural pattern (the gate appears INSIDE the function
// body, before the main work). A pure-comment mention wouldn't satisfy
// the guard because it would have no real effect at runtime.
{
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (!sidecar) {
    fail('Guard 3: index.jsx.source not found');
  } else {
    // Match: `const generateProductArtForAll = ...` then within the
    // next ~600 chars there should be a `window.__SMOKE_TEST__` reference
    // followed by a `return`.
    const fnIdx = sidecar.text.indexOf('const generateProductArtForAll');
    if (fnIdx === -1) {
      // Function may have been renamed — leave as a warn rather than
      // a fail, since the guard's whole purpose presumes the function
      // exists.
      warn('Guard 3: generateProductArtForAll not found — guard skipped (rename?)');
    } else {
      const slice = sidecar.text.slice(fnIdx, fnIdx + 600);
      const hasGate = /window\.__SMOKE_TEST__[\s\S]{0,60}return/.test(slice);
      if (!hasGate) fail('Product-art generator missing SMOKE_TEST early-return — npm run check would hit Gemini');
      else ok('Product-art generator has SMOKE_TEST early-return');
    }
  }
}

// Guard 3.05 — Extracted modal render sites MUST pass props.
// Wave 4 extraction (May 2026) caught a silent failure where my Edit
// calls collided with concurrent sed deletions and didn't apply — the
// render sites stayed as `<XxxModal />` with no props. JSX doesn't crash
// on missing props; the modals only blow up when a handler is invoked
// against `undefined`. Smoke check passed because it never opens modals.
// This guard fails if any extracted modal is rendered propless.
{
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (sidecar) {
    const EXTRACTED_MODALS = [
      'ProfileModal', 'ColorModal', 'ApiKeyModal', 'SupabaseModal',
      'EventModal', 'ProcedureModal',
      // Codex audit (May 2026): these were silently propless too.
      'BulkPhotoUploadModal',
      // Wave 5.3 (May 2026) — TodayRitualModal extracted.
      'TodayRitualModal',
      // Wave 5.2 (May 2026) — SkinLogModal extracted.
      'SkinLogModal',
      // Wave 5.1 (May 2026) — ProductModal extracted.
      'ProductModal',
    ];
    const hits = [];
    const sidecarLines = sidecar.text.split('\n');
    for (const name of EXTRACTED_MODALS) {
      // Propless render: <Name /> with no attributes between tag and self-close.
      // Skip lines that are comments — those are tombstone references that
      // describe the past, not actual JSX render sites.
      const re = new RegExp(`<${name}\\s*/>`, 'g');
      let m;
      while ((m = re.exec(sidecar.text)) !== null) {
        const lineNo = sidecar.text.slice(0, m.index).split('\n').length;
        const lineText = (sidecarLines[lineNo - 1] || '').trimStart();
        if (lineText.startsWith('//') || lineText.startsWith('*')) continue;
        hits.push(`${name}@index.jsx.source:${lineNo}`);
      }
    }
    if (hits.length > 0) fail(`Extracted modal rendered propless (silent failure mode — user-visible bug only when modal opens): ${hits.join(', ')}`);
    else ok('All extracted modal render sites pass props');
  }
}

// Guard 3.06 — GuidedPhotoCaptureModal capture count must be local and stable.
// Regression caught on mobile Safari: opening the guided camera crashed
// with "Can't find variable: capturedCount" because the header/Done button
// referenced capturedCount after a refactor changed the local count names.
{
  const guided = SOURCE_FILES.find(f => f.rel === 'src/components/GuidedPhotoCaptureModal.jsx');
  if (!guided) {
    fail('Guard 3.06: GuidedPhotoCaptureModal.jsx not found');
  } else {
    if (/\bcapturedCount\b/.test(guided.text)) {
      fail('GuidedPhotoCaptureModal must not use the stale capturedCount alias — use totalCapturedCount/guidedCapturedCount instead');
    } else {
      ok('GuidedPhotoCaptureModal avoids stale capturedCount alias');
    }
    const partialDailyAllowed =
      guided.text.includes('requireFullGuidedSet = false') &&
      guided.text.includes('requireFullGuidedSet') &&
      guided.text.includes('guidedCapturedCount > 0') &&
      guided.text.includes('if (!canFinish) return;');
    if (!partialDailyAllowed) fail('Guided daily check-in must be able to finish after one captured photo');
    else ok('Guided daily check-in can finish after one photo');
  }
}

// Guard 3.065 — Rotation actives must be classified by ingredient family.
// Regression caught in Regimen → Rotation: a product with daily cadence
// but a strong active family (retinoid/BHA/etc.) was counted as a "basic"
// because the UI split active/support rows using `days.length === 7`.
// Daily actives are still actives. This guard keeps the split wired to
// `isActiveEntry`, which checks the detected ingredient family.
{
  const rotation = SOURCE_FILES.find(f => f.rel === 'src/components/regimen/RegimenOccasionsView.jsx');
  if (!rotation) {
    fail('Guard 3.065: RegimenOccasionsView.jsx not found');
  } else {
    const hasFamilyClassifier =
      rotation.text.includes('const isActiveEntry = (entry) => entry?.family') &&
      rotation.text.includes('am.filter(isActiveEntry)') &&
      rotation.text.includes('pm.filter(isActiveEntry)');
    const cadenceSplitReturned =
      /const\s+isDaily\s*=\s*\([^)]*\)\s*=>[\s\S]{0,500}\.filter\(e\s*=>\s*!\s*isDaily\(e\.product\)\)/.test(rotation.text) ||
      /\.filter\(e\s*=>\s*!\s*isDaily\(e\.product\)\)/.test(rotation.text);
    if (!hasFamilyClassifier) fail('Rotation day panel must classify active/support rows with isActiveEntry, not cadence');
    else ok('Rotation day panel classifies scheduled actives by ingredient family');
    if (cadenceSplitReturned) fail('Rotation day panel reintroduced cadence-based active split — daily retinoids would read as basics');
    else ok('Rotation day panel does not treat daily cadence as basic');
  }
}

// Guard 3.066 — Today's ritual log must be canonical.
// Regression caught from Home → Regimen: "Used something else? → From shelf"
// saved the product id into the day's regimenLog, but resolveTodayRitual
// narrowed oversized slots back to built-routine products / plan fallback,
// hiding the user's one-off add. Logs are user truth; overflow may hide
// items behind +N, but resolver must not discard them.
{
  const resolver = SOURCE_FILES.find(f => f.rel === 'src/resolvers/routineResolvers.js');
  if (!resolver) {
    fail('Guard 3.066: routineResolvers.js not found');
  } else {
    if (resolver.text.includes('planFallback') || resolver.text.includes('narrowOversized')) {
      fail('resolveTodayRitual must not use planFallback/narrowOversized for regimenLogs; day-specific adds disappear');
    } else {
      ok('resolveTodayRitual keeps regimenLog products canonical, with overflow only');
    }
  }
}

// Guard 3.07 — recommendation drawer must stay explainable + correctly routed.
// Regressions caught in product review:
//   - Exfoliate tile accidentally opened the Brighten filter.
//   - Cards scored like a black box, with no visible "why this" line.
//   - Brand-priority rules from brandRanking.js were bypassed in the drawer.
{
  const shelf = SOURCE_FILES.find(f => f.rel === 'src/components/regimen/RegimenShelfView.jsx');
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (shelf && /catId === 'exfoliate'\s*\?\s*['"]brighten['"]/.test(shelf.text)) {
    fail('What-we’d-try Exfoliate tile routes to Brighten instead of Exfoliate');
  } else {
    ok('What-we’d-try Exfoliate tile keeps its own filter');
  }
  if (sidecar) {
    const hasBrandPriority = sidecar.text.includes('getBrandPriority(p.brand)') && sidecar.text.includes('top-tier brand');
    const hasWhyLine = sidecar.text.includes('const whyThisPick') && sidecar.text.includes('Why: {whyThisPick(p)}');
    const hasVisibleRules = sidecar.text.includes('Rules: max 2 per brand') && sidecar.text.includes('top-tier boost') && sidecar.text.includes('ingredient fit');
    const hasBrandCap = sidecar.text.includes('brandCounts[brandKey] >= 2');
    const hasTopTierGuarantee = sidecar.text.includes('const hasTopTier') && sidecar.text.includes('topTierCandidate');
    if (!hasBrandPriority) fail('Suggested matches drawer must score with getBrandPriority so top-tier brands surface');
    else ok('Suggested matches drawer uses shared brand priority');
    if (!hasWhyLine) fail('Suggested matches cards must render a visible Why line for trust');
    else ok('Suggested matches cards explain why each product appears');
    if (!hasVisibleRules) fail('Suggested matches drawer must show visible variety rules');
    else ok('Suggested matches drawer shows variety rules');
    if (!hasBrandCap) fail('Suggested matches drawer must cap repeated brands at 2');
    else ok('Suggested matches drawer caps repeated brands');
    if (!hasTopTierGuarantee) fail('Suggested matches drawer must guarantee a top-tier pick when one matches');
    else ok('Suggested matches drawer guarantees top-tier presence when possible');
  }
}

// Guard 3.09 — daily photo captures must funnel through check-in details.
// Mental model: every daily capture/upload/detail shot goes to
// checkInDetailsQueue, where the user confirms region + rating + context.
// Daily check-in defaults to a one-photo minimum. Full-set capture is an
// explicit caller opt-in via requireFullGuidedSet, so onboarding/new-user
// flows can stay lightweight unless they deliberately request the full set.
{
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (sidecar) {
    const guidedBranch = /guidedCaptureCtx\?\.intent !== 'onboarding_baseline'[\s\S]{0,700}setCheckInDetailsQueue\(queue\)/.test(sidecar.text);
    const fullSetIsExplicitOptIn =
      sidecar.text.includes('requireFullGuidedSet={guidedCaptureCtx?.requireFullGuidedSet === true}');
    const preservesMetadata =
      sidecar.text.includes('noticed: Array.isArray(form.noticed)') &&
      sidecar.text.includes('contextFactors: Array.isArray(form.contextFactors)') &&
      sidecar.text.includes('angle: shot.angle') &&
      sidecar.text.includes("eye_area: 'eye-area'");
    if (!guidedBranch) fail('Guided daily captures must route to CheckInDetailsModal before save');
    else ok('Guided daily captures route through CheckInDetailsModal');
    if (!fullSetIsExplicitOptIn) fail('Full guided capture must be explicit opt-in; daily/new-user check-in should allow one photo');
    else ok('Guided capture defaults to one-photo completion unless explicitly full-set');
    if (!preservesMetadata) fail('Saved check-in logs must preserve noticed/context/angle and eye-area metadata');
    else ok('Saved check-in logs preserve context and per-photo metadata');
  }
}

// Guard 3.10 — Home daily-photo CTAs must launch guided capture.
// Any visible daily photo entry point should share the guided 5-photo
// model, not the legacy single-shot camera, except for the helper's
// explicit fallback when guided props are absent.
{
  const home = SOURCE_FILES.find(f => f.rel === 'src/components/HomeDashboard.jsx');
  if (home) {
    const directLegacyLaunches = (home.text.match(/setShowCheckInCamera\(true\)/g) || []).length;
    const hasGuidedHelper = home.text.includes('const startGuidedCheckIn') && home.text.includes("setGuidedCaptureCtx({ intent: 'check_in' })");
    if (!hasGuidedHelper) fail('HomeDashboard must expose startGuidedCheckIn for daily photo CTAs');
    else ok('HomeDashboard daily photo CTAs have a guided-capture helper');
    if (directLegacyLaunches > 1) fail('HomeDashboard has daily photo CTAs bypassing guided capture');
    else ok('HomeDashboard daily photo CTAs route through guided capture');
  }
}

// Guard 3.1 — ProfileModal must not be re-inlined inside index.jsx.source
// Phase 4 (May 2026) extracted the wizard into src/components/ProfileModal.jsx
// because the inline-inside-App definition caused remount-on-render which
// made wizard clicks feel dead. If a future edit puts the definition back
// inside the sidecar, the bug returns. Comment-only mentions (tombstones,
// pointers to the new file) are fine — the regex below only catches an
// actual `const ProfileModal = (` definition.
{
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (sidecar) {
    const re = /\bconst\s+ProfileModal\s*=\s*\(/g;
    const hits = [];
    let m;
    while ((m = re.exec(sidecar.text)) !== null) {
      const line = sidecar.text.slice(0, m.index).split('\n').length;
      hits.push(`index.jsx.source:${line}`);
    }
    if (hits.length > 0) fail(`ProfileModal re-inlined inside index.jsx.source (Phase 4 extracted to src/components/ProfileModal.jsx): ${hits.join(', ')}`);
    else ok('ProfileModal not re-inlined inside index.jsx.source');
  }
}

// Guard 3.08 — onboarding completion must round-trip through all auth paths.
// Returning users were seeing onboarding again because saveData persisted
// `onboardingState:${userKey}` / `userProfile:${userKey}`, but local sign-in
// did not load those keys back. Also, "Explore first" used to only update
// React state, so cloud-backed users could be re-prompted on the next device.
{
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  const overlay = SOURCE_FILES.find(f => f.rel === 'src/components/OnboardingOverlay.jsx');
  if (sidecar) {
    const hasLocalLoadKeys =
      sidecar.text.includes('storage.get(`userProfile:${userKey}`)') &&
      sidecar.text.includes('storage.get(`onboardingState:${userKey}`)') &&
      sidecar.text.includes("safeJSON(up?.value, null, 'userProfile')") &&
      sidecar.text.includes("safeJSON(os?.value, null, 'onboardingState')");
    if (!hasLocalLoadKeys) fail('loadAllData must load userProfile/onboardingState per-user keys or returning local users re-enter onboarding');
    else ok('Local login loads per-user onboarding/profile keys');

    const hasCloudWelcomeHeal =
      sidecar.text.includes("cloudStage === 'welcome'") &&
      sidecar.text.includes('hasProfileContentForGate || hasUsageContentForGate') &&
      sidecar.text.includes("saveData('onboardingState', healed)");
    if (!hasCloudWelcomeHeal) fail('loadFromSupabase must heal stale cloud stage=welcome when profile/usage data exists');
    else ok('Cloud login heals stale onboarding welcome state');
  }
  if (overlay) {
    const hasExplorePersistence =
      overlay.text.includes("saveData('onboardingState', skippedState)") &&
      overlay.text.includes("stage: 'done'") &&
      overlay.text.includes('skipped: true');
    if (!hasExplorePersistence) fail('Explore/skip onboarding must persist onboardingState via saveData');
    else ok('Explore/skip onboarding persists completion');
  }
}

// Guard 3.2 — ProfileModal.jsx exists AND is referenced from build_current.js
// The extracted file is useless if the build doesn't concatenate it.
{
  const exists = fs.existsSync(path.join(ROOT, 'src/components/ProfileModal.jsx'));
  if (!exists) {
    fail('src/components/ProfileModal.jsx missing');
  } else {
    const buildJs = fs.readFileSync(path.join(ROOT, 'build_current.js'), 'utf8');
    if (!buildJs.includes("'src/components/ProfileModal.jsx'") && !buildJs.includes('"src/components/ProfileModal.jsx"')) {
      fail("ProfileModal.jsx exists but build_current.js doesn't reference it — it won't be concatenated into the bundle");
    } else {
      ok('ProfileModal.jsx exists and is wired into build_current.js');
    }
  }
}

// Guard 3.4 — Wave 1 + Wave 2 extracts must not get re-inlined inside
// the sidecar. Each name here was lifted to its own file in src/components/
// so the sidecar stays small and future edits are localized. If someone
// (human or agent) pastes the definition back into index.jsx.source, the
// build would have two competing definitions and the later one wins —
// almost certainly silently breaking something. Comment-only mentions
// (tombstones, pointers) are fine; this guard only catches actual
// `const Name = (` definitions.
{
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (sidecar) {
    const EXTRACTED_NAMES = [
      // Wave 1.1
      'CameraCaptureModal',
      // Wave 4 (May 2026) — contained modals extracted from App.
      'ColorModal', 'ApiKeyModal', 'SupabaseModal', 'EventModal', 'ProcedureModal',
      // Wave 1.2
      'BulkPhotoUploadModal',
      'extractPhotoDate',
      // Wave 1.3 — UI primitives
      'Chip', 'Button', 'RatingPills', 'ModalHeader', 'StickyModalFooter', 'Modal',
      // Wave 2 — already-separate child components
      'BrandPicker', 'ProposeSlotCard', 'DashedBottleOutline', 'StarterProductPreview',
      'PearlTrigger', 'EvidenceDot', 'OnboardingBuildingPhases',
      // Wave 5.3 (May 2026) — TodayRitualModal.
      'TodayRitualModal',
      // Wave 5.2 (May 2026) — SkinLogModal.
      'SkinLogModal',
      // Wave 5.1 (May 2026) — ProductModal.
      'ProductModal',
      // Wave 6.1 (May 2026) — OnboardingOverlay.
      'OnboardingOverlay',
      // Wave 6.2 (May 2026) — HomeDashboard.
      'HomeDashboard',
      // Wave 7.4 (May 2026) — InsightsView.
      'InsightsView',
      // Wave 7.3 (May 2026) — CompareView.
      'CompareView',
      // Wave 7.2 (May 2026) — JournalView.
      'JournalView',
      // Wave 7.1 (May 2026) — RegimenView.
      'RegimenView',
    ];
    const hits = [];
    for (const name of EXTRACTED_NAMES) {
      // Match `const Name = (` or `const Name = React.memo(` — defining
      // forms. Inside-App definitions start with 2 leading spaces; module-
      // scope start at column 0. Cover both.
      const re = new RegExp(`(^|\\n) {0,4}const\\s+${name}\\s*=\\s*(\\(|React\\.memo)`, 'g');
      let m;
      while ((m = re.exec(sidecar.text)) !== null) {
        const line = sidecar.text.slice(0, m.index).split('\n').length + (m[1] === '\n' ? 1 : 0);
        hits.push(`${name}@index.jsx.source:${line}`);
      }
    }
    if (hits.length > 0) fail(`Extracted component re-inlined inside index.jsx.source: ${hits.join(', ')}`);
    else ok('No Wave 1/2 extracts re-inlined inside index.jsx.source');
  }
}

// Guard 3.3 — `monkTone` is the stale field name; the schema uses
// `monkSkinTone`. Pre-Phase-4 the inline wizard had a typo at one site
// (`f.monkTone || f.undertone`) that silently never triggered. Catch any
// reintroduction across all source files.
{
  let hits = [];
  for (const f of SOURCE_FILES) {
    // Match `.monkTone` but NOT `.monkSkinTone`. Using a negative lookahead.
    const re = /\.monkTone(?!Skin)\b/g;
    let m;
    while ((m = re.exec(f.text)) !== null) {
      const line = f.text.slice(0, m.index).split('\n').length;
      hits.push(`${f.rel}:${line}`);
    }
  }
  if (hits.length > 0) fail(`Stale field name 'monkTone' (real field is 'monkSkinTone'): ${hits.join(', ')}`);
  else ok("No stale 'monkTone' references (canonical is monkSkinTone)");
}

// Guard 3.5 — saveData(key, updaterFunction) usage anywhere
// Catches the corruption pattern Codex flagged: `saveData('logs', prev => prev)`
// — the function gets JSON.stringify'd → undefined → localStorage write
// stores literally `undefined`, and on next reload everything blanks. The
// correct shape is `saveData(key, concreteArrayOrObject)`. setX with a
// functional updater is fine; saveData with one is the bug.
{
  const hits = [];
  for (const f of SOURCE_FILES) {
    // Match `saveData('<key>', ` immediately followed by either an arrow
    // function or `function`. Includes literal-string and template-string
    // first arg.
    const re = /\bsaveData\(\s*(['"`][^'"`]+['"`])\s*,\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\w+\s*=>|function\b)/g;
    let m;
    while ((m = re.exec(f.text)) !== null) {
      const before = f.text.slice(Math.max(0, m.index - 200), m.index);
      // Allow tombstone / doc references inside comments.
      const lastLineStart = before.lastIndexOf('\n') + 1;
      const trimmedLine = before.slice(lastLineStart).trimStart();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) continue;
      const line = f.text.slice(0, m.index).split('\n').length;
      hits.push(`${f.rel}:${line} (${m[1]})`);
    }
  }
  if (hits.length > 0) fail(`saveData called with a function as second arg — JSON.stringify(fn) === undefined, will wipe the key on reload. Use a concrete value: ${hits.join(', ')}`);
  else ok('No saveData(key, fn) usages (functional-updater corruption pattern)');
}

// Guard 3.6 — Extracted components must not reference undeclared App-scope
// variables. Each extracted modal/component receives App state/setters as
// props. If the file body references a name that isn't (a) destructured
// from props, (b) declared in module scope, (c) a global/built-in, then
// it's a silent prop-bridge gap that only shows up at runtime.
//
// Implementation note: a full lexical scope analyzer is overkill — instead
// we whitelist the high-risk names that have been props-bridge bugs in
// this codebase and scan each extracted-component file for orphan refs.
// Fewer false positives, catches the actual class of regression.
{
  const EXTRACTED_COMPONENT_FILES = [
    'src/components/ColorModal.jsx',
    'src/components/ApiKeyModal.jsx',
    'src/components/SupabaseModal.jsx',
    'src/components/EventModal.jsx',
    'src/components/ProcedureModal.jsx',
    'src/components/ProfileModal.jsx',
    'src/components/CameraCaptureModal.jsx',
    'src/components/BulkPhotoUploadModal.jsx',
    'src/components/TodayRitualModal.jsx',
    'src/components/SkinLogModal.jsx',
    'src/components/ProductModal.jsx',
    'src/components/OnboardingOverlay.jsx',
    'src/components/HomeDashboard.jsx',
    'src/components/JournalView.jsx',
    'src/components/CompareView.jsx',
    'src/components/RegimenView.jsx',
    'src/components/InsightsView.jsx',
  ];
  // IMPORTANT — module-scope helpers (defined at column 0 in
  // index.jsx.source) are concatenated into the bundle as globals and
  // do NOT need prop bridging. Only names declared *inside* App() need
  // to flow through props. Module-scope names confirmed via grep:
  //   getApiKey, setApiKey, uploadPhotoToStorage, fetchPhotoAsBase64,
  //   getActualUsage, formatUsageForPrompt, withPearls, withTimeout,
  //   fileToBase64
  // App-scope names confirmed:
  //   callClaude, toast, saveData, modalScrollMemo, useModalScrollPreserve,
  //   openChat, plus all state values + setters.
  const APP_SCOPE_NAMES = [
    // App state these modals routinely touch
    'logs', 'setLogs', 'products', 'setProducts', 'procedures', 'setProcedures',
    'events', 'setEvents', 'regimenLogs', 'setRegimenLogs', 'userProfile',
    'setUserProfile', 'colorProfile', 'setColorProfile', 'patternInsight',
    'setPatternInsight', 'cycleData', 'setCycleData', 'hormonalContext',
    'setHormonalContext', 'sensitivities', 'setSensitivities',
    'userConcerns', 'setUserConcerns', 'coverRoutine', 'setCoverRoutine',
    'counselInsights', 'setCounselInsights', 'weeklyInsights',
    'setWeeklyInsights', 'homeDevices', 'setHomeDevices', 'buildAnswers',
    'setBuildAnswers', 'user', 'setUser', 'supaEnabled', 'todayStr',
    'ritualSlot',
    'buildCoverRoutineRef', 'noteCardExpanded', 'setNoteCardExpanded',
    'setRemoveScopePrompt', 'setUsedSomethingElseSheet',
    'setShowHomeUploadPicker', 'setShowCheckInChooser',
    // App-scope helpers (defined inside App())
    'callClaude', 'saveData', 'toast', 'modalScrollMemo',
    'useModalScrollPreserve', 'openChat', 'setShowApiKeyModal',
    'editingProcedureId', 'setEditingProcedureId',
    // Wave 7 extracted page-view bridges
    'journalViewOverride', 'setJournalViewOverride', 'selectMode',
    'setSelectMode', 'selectedIds', 'setSelectedIds', 'toggleSelectId',
    'setRegimenView',
    'skinReadDrawerLogId', 'setSkinReadDrawerLogId', 'openLesson',
    'setOpenLesson', 'deleteLog', 'enterCompare', 'handleAddPriorPhoto',
    'setProductCompareId', 'compareTimeBeforeId', 'setCompareTimeBeforeId',
    'compareTimeAfterId', 'setCompareTimeAfterId', 'compareTimeAnalyzing',
    'setCompareTimeAnalyzing', 'compareTimePickerFor',
    'setCompareTimePickerFor', 'counselSubTab', 'setCounselSubTab',
    'counselGenerating', 'setCounselGenerating', 'counselExpanded',
    'setCounselExpanded', 'handleGenerateCounselInsight',
    'discussInsightInAsk', 'insightMessages', 'insightQuery',
    'setInsightQuery', 'insightLoading', 'handleInsight',
    'clearInsightChat',
  ];
  const hits = [];
  for (const rel of EXTRACTED_COMPONENT_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    // Find the component's prop destructure block — `({ a, b, c })`
    // after the leading `const Name = (` arrow header. Greedy match
    // until first closing brace at top level of the param list.
    const headerMatch = /const\s+\w+\s*=\s*\(\s*\{([\s\S]*?)\}\s*\)\s*=>/.exec(text);
    // Strip JS comments (// to EOL, /* ... */) before splitting on commas —
    // otherwise comment text contributes phantom "names" and we also miss
    // real names because comments break the token regex.
    const stripComments = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    const destructured = headerMatch
      ? new Set(
          stripComments(headerMatch[1])
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            // Each entry can be: `name`, `name: alias`, `name = default`,
            // `...rest`. Take the identifier we'd bind to in this scope.
            .map(s => {
              if (s.startsWith('...')) return s.slice(3).trim();
              // For `name: alias`, the binding is `alias`. For
              // `name = default`, the binding is `name`. Both cases:
              // identifier we want is what comes immediately before `=`
              // or after `:`.
              const colon = s.indexOf(':');
              if (colon !== -1) {
                const right = s.slice(colon + 1).trim();
                return right.split(/[=\s]/)[0];
              }
              return s.split(/[=\s]/)[0];
            })
            .filter(Boolean)
        )
      : new Set();
    // Strip strings + comments + JSX text content from the full text
    // before scanning. We replace string bodies with `""` so commas /
    // structure survive but identifiers inside disappear. Trade-off: we
    // also strip backtick template literals whole (interpolations and
    // all) — refs inside `${...}` would be missed, but in practice those
    // are local form refs not App-scope props, so the false-negative is
    // worth the false-positive reduction. JSX text content (between `>`
    // and `<`) is also blanked because words like "products" appearing
    // in copy were tripping the guard.
    const scrub = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      // Template strings — whole-token blank including interpolations.
      .replace(/`[\s\S]*?`/g, '""')
      // Single/double-quoted strings (line-bounded).
      .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
      .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
      // JSX text content: `>text<` → `> <`. Allow multi-line bodies so
      // copy that wraps onto its own line gets blanked too. Skip
      // operators like `> 0 <` by requiring at least one whitespace char
      // in the body (real copy always has spaces; operators don't).
      .replace(/>([^<>{}]+)</g, (full, body) => /\s\S+\s/.test(body) ? '> <' : full);
    const scrubbed = scrub(text);
    for (const name of APP_SCOPE_NAMES) {
      if (destructured.has(name)) continue;
      // Word boundary, not preceded by `.` (property access).
      const re = new RegExp(`(?<![\\w.])${name}\\b`, 'g');
      if (re.test(scrubbed)) {
        hits.push(`${rel} references "${name}" but it's not in props`);
      }
    }
  }
  if (hits.length > 0) fail(`Extracted component references undeclared App-scope name (missing prop bridge): ${hits.slice(0, 5).join(' | ')}${hits.length > 5 ? ` (+${hits.length - 5} more)` : ''}`);
  else ok('Extracted components have all needed App-scope names bridged via props');
}

// Guard 3.7 — Raw FileReader bypass for photo storage paths
// Photo uploads MUST go through the shared compression helper before
// being saved. Storing the raw FileReader result (full iPhone resolution
// base64) blows past localStorage quota and is the root cause of the
// "shelf goes empty after photo upload" reports.
//
// Pattern: `reader.readAsDataURL(file)` followed (within ~600 chars) by
// any of `setLogs`, `setProducts`, `setProcedures`, or `saveData('logs'`
// — without an intervening compress/resize call. False-positive rate is
// low because the compression helper is named obviously (resizeImage /
// compressImage / fileToCompressedBase64 / uploadPhotoToStorage).
{
  const COMPRESS_HINTS = /resizeImage|compressImage|fileToCompressedBase64|uploadPhotoToStorage|MAX_PHOTO_DIM|canvas\.toDataURL\([^)]*0\.[0-9]/;
  const PERSIST_HINTS = /\b(setLogs|setProducts|setProcedures|saveData\(\s*['"`](?:logs|products|procedures))\b/;
  const hits = [];
  for (const f of SOURCE_FILES) {
    let m;
    const re = /reader\.readAsDataURL\s*\(/g;
    while ((m = re.exec(f.text)) !== null) {
      const window = f.text.slice(m.index, m.index + 900);
      if (PERSIST_HINTS.test(window) && !COMPRESS_HINTS.test(window)) {
        const line = f.text.slice(0, m.index).split('\n').length;
        hits.push(`${f.rel}:${line}`);
      }
    }
  }
  if (hits.length > 0) warn(`Possible raw-FileReader → persist path (no compression hint in 900-char window — verify): ${hits.slice(0, 5).join(', ')}${hits.length > 5 ? ` (+${hits.length - 5} more)` : ''}`);
  else ok('No raw FileReader → persist paths (photo writes route through compression helper)');
}

// Guard 3.98 — extracted components MUST NOT fetch api.anthropic.com
// directly. May 2026 v2 — Codex flagged Compare's direct browser
// fetches. Centralized via callClaude (single source of truth for
// headers, timeout, and future backend-proxy migration). Allows
// comments mentioning the URL (audit notes) but blocks actual fetch
// calls. App-scope callClaude in index.jsx.source is the one allowed
// caller — that file is excluded.
{
  const FETCH_PATTERN = /fetch\s*\(\s*["'`]https?:\/\/api\.anthropic\.com/g;
  const hits = [];
  for (const f of SOURCE_FILES) {
    if (f.rel === 'index.jsx.source') continue;
    let m;
    while ((m = FETCH_PATTERN.exec(f.text)) !== null) {
      const line = f.text.slice(0, m.index).split('\n').length;
      hits.push(`${f.rel}:${line}`);
    }
  }
  if (hits.length > 0) fail(`Direct api.anthropic.com fetch outside callClaude — route through the App's callClaude prop instead. Sites: ${hits.join(', ')}`);
  else ok('Anthropic calls go through callClaude (no direct browser fetches in extracted components)');
}

// Guard 3.99 — uploadPhotoToStorage callers MUST destructure { path }.
// The helper returns { path, error }. If a caller writes
// `const path = await uploadPhotoToStorage(...)` and then sets
// `photoPath: path` on a log, the whole { path, error } OBJECT lands
// in photoPath. hasPhoto stays truthy but the Photo renderer can't
// resolve an object as a URL — images silently fail to load in
// Journal/Compare/Timeline. This guard catches the wrong shape so
// the bug never ships again. Whitelist: comments that explicitly
// document the bug are allowed (they're not call sites).
{
  const BAD_PATTERN = /const\s+path\s*=\s*await\s+uploadPhotoToStorage\s*\(/g;
  const hits = [];
  for (const f of SOURCE_FILES) {
    let m;
    while ((m = BAD_PATTERN.exec(f.text)) !== null) {
      const line = f.text.slice(0, m.index).split('\n').length;
      hits.push(`${f.rel}:${line}`);
    }
  }
  if (hits.length > 0) fail(`uploadPhotoToStorage returns { path, error } — must destructure. Wrong shape at: ${hits.join(', ')}. Use \`const { path } = await uploadPhotoToStorage(...)\` instead.`);
  else ok('uploadPhotoToStorage callers destructure return correctly');
}

// Guard — date-aware sheet handlers must not hardcode today's date
// May 2026 bug fix per Jenni: the "Used something else?" sheet on the
// home cover supports past-day adds via the viewDate arrow. Catch any
// regression where a NEW handler hardcodes `localDateISO()` instead of
// reading the sheet's date context. We grep specifically inside the
// `usedSomethingElseSheet`, `shelfQuickAddState`, and `productModalRegimenContext`
// scopes so unrelated callers (which legitimately need today) don't flag.
{
  const sourceFile = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (sourceFile) {
    // Pull the rough body of each date-aware handler by header comment.
    const slices = [
      { name: 'usedSomethingElseSheet handler', start: /usedSomethingElseSheet && usedSomethingElseSheet\.open && \(\(\) => \{/, end: /\}\)\(\)\}/ },
      { name: 'shelfQuickAddState handler',     start: /shelfQuickAddState && \(\(\) => \{/,                                  end: /\}\)\(\)\}/ },
    ];
    let hits = [];
    for (const s of slices) {
      const sm = s.start.exec(sourceFile.text);
      if (!sm) continue;
      const body = sourceFile.text.slice(sm.index, sm.index + 12000); // bounded scan
      // Heuristic: a fresh localDateISO() call *inside* one of these handlers
      // is suspect. The legit usage is `=== localDateISO()` for the isToday
      // check, so we whitelist that pattern.
      const calls = [...body.matchAll(/localDateISO\(\)/g)];
      for (const c of calls) {
        const ctx = body.slice(Math.max(0, c.index - 20), c.index + 20);
        if (/=== localDateISO\(\)/.test(ctx)) continue; // whitelisted: isToday compare
        if (/\.date \|\| localDateISO\(\)/.test(ctx)) continue; // whitelisted: fallback default
        hits.push(`${s.name}: …${ctx.replace(/\n/g, ' ')}…`);
      }
    }
    if (hits.length > 0) {
      fail(`Date-aware handlers must read sheet.date, not hardcode today. Suspicious: ${hits.join(' | ')}`);
    } else {
      ok('Date-aware sheet handlers read sheet.date, not hardcoded today');
    }
  }
}

// Guard 4 — new check-in UI copy outside check-in components (warn only)
// The phrases below define the canonical check-in voice. If any of them
// shows up outside CheckInDetailsModal or src/components/checkin/, it's
// either (a) someone built a parallel check-in flow elsewhere, or (b)
// the copy got duplicated into another surface where it shouldn't be.
// Warn rather than fail because (a) the false-positive rate is real
// (auto-memory docs, tombstone comments) and (b) the user explicitly
// asked for "warn" not "fail" here.
{
  const CHECKIN_COPY_PATTERNS = [
    /How does your skin feel today\?/i,
    /Save skin check-in/i,
    /Anything different today\?/i,
    /Add to check-in/i,
  ];
  const ALLOWED_PREFIXES = [
    'src/components/CheckInDetailsModal.jsx',
    'src/components/checkin/',
  ];
  let hits = [];
  for (const f of SOURCE_FILES) {
    if (ALLOWED_PREFIXES.some(p => f.rel.startsWith(p))) continue;
    for (const pat of CHECKIN_COPY_PATTERNS) {
      const m = pat.exec(f.text);
      if (m) {
        const line = f.text.slice(0, m.index).split('\n').length;
        hits.push(`${f.rel}:${line} (${m[0].slice(0, 40)})`);
      }
    }
  }
  if (hits.length > 0) warn(`Check-in copy outside CheckInDetailsModal/checkin: ${hits.slice(0, 3).join(' | ')}${hits.length > 3 ? ` (+${hits.length - 3} more)` : ''}`);
  else ok('Check-in voice copy contained to CheckInDetailsModal + src/components/checkin/');
}

// ---------------------------------------------------------------------------
// CHECK 6 — brand/product ranking regressions (Phase 5)
// ---------------------------------------------------------------------------
// Three signals:
//   1. STATIC — fail if BrandPicker reintroduces the `counts[b] - counts[a]`
//      sort without sortBrandsForPicker. This was the Phase 2 fix and the
//      single most likely regression vector ("just sort by count, easier").
//   2. STATIC — fail if searchLocalProducts stops referencing the shared
//      ranking helpers (scoreProductForSearch / sortProductsForSearch).
//      If someone reinvents inline scoring here, brand search and product
//      search drift apart again.
//   3. FUNCTIONAL — require brandRanking.js and assert a few priority-
//      based outcomes. NOT full list order (brittle), just three sanity
//      checks: Rhode > Rare Beauty for "rh", Dr. Jart+ ranks above
//      lower-priority Dr* brands for "dr", Hero Cosmetics is not
//      priority 1. These three catch the entire class of "someone moved
//      a brand to the wrong override bucket."
{
  // --- Guard 6a: counts-sort regression on the BrandPicker call site ---
  const sidecar = SOURCE_FILES.find(f => f.rel === 'index.jsx.source');
  if (!sidecar) {
    fail('Guard 6a: index.jsx.source not found');
  } else {
    // Find the count-sort pattern in EXECUTABLE code only — skip lines
    // that are comments. Otherwise our own warning comments documenting
    // the deprecated pattern (e.g. "Was: counts[b] - counts[a]") would
    // trip the guard. Comment detection is intentionally simple: a line
    // is treated as comment if its trimmed start is `//` or `*` (block
    // comment continuation). Inline `code /* comment */ code` is rare
    // here and not worth a parser.
    const countSortRe = /counts\[b\]\s*-\s*counts\[a\]/g;
    const lines = sidecar.text.split('\n');
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      if (countSortRe.test(lines[i])) hits.push(`index.jsx.source:${i + 1}`);
      countSortRe.lastIndex = 0; // reset since we used .test in a loop
    }
    if (hits.length > 0) fail(`BrandPicker count-sort regression — replaced by sortBrandsForPicker in Phase 2: ${hits.join(', ')}`);
    else ok('No counts[b]-counts[a] regression in BrandPicker call site');
  }
}

{
  // --- Guard 6b: searchLocalProducts must reference shared helpers ---
  // Wave 5.1 (May 2026): function moved out of index.jsx.source into
  // src/components/ProductModal.jsx when that modal was extracted. Look
  // in either location — fail only if the function is found AND it
  // doesn't reference the shared ranking helpers.
  const candidates = ['index.jsx.source', 'src/components/ProductModal.jsx'];
  let fnSlice = null;
  let foundIn = null;
  for (const rel of candidates) {
    const f = SOURCE_FILES.find(x => x.rel === rel);
    if (!f) continue;
    const fnIdx = f.text.indexOf('const searchLocalProducts =');
    if (fnIdx !== -1) {
      fnSlice = f.text.slice(fnIdx, fnIdx + 1500);
      foundIn = rel;
      break;
    }
  }
  if (!fnSlice) {
    warn('Guard 6b: searchLocalProducts not found in index.jsx.source or ProductModal.jsx (rename?)');
  } else {
    const usesHelper = /scoreProductForSearch|sortProductsForSearch/.test(fnSlice);
    if (!usesHelper) fail(`searchLocalProducts (${foundIn}) no longer calls scoreProductForSearch/sortProductsForSearch — ranking has drifted from the shared layer`);
    else ok(`searchLocalProducts wired through shared ranking helpers (${foundIn})`);
  }
}

{
  // --- Guard 6c: functional asserts via require(brandRanking.js) ---
  // The helpers are pure (no DOM, no React) and have a dual-mode export
  // stanza that emits module.exports when required from Node. Asserts
  // are deliberately narrow — three priority cases that catch the
  // override-bucket-wrong-by-one-line class of bug.
  let ranking;
  try {
    // Bust require cache so re-runs in the same Node session pick up
    // edits to brandRanking.js without restarting the check.
    delete require.cache[require.resolve('./src/resolvers/brandRanking.js')];
    ranking = require('./src/resolvers/brandRanking.js');
  } catch (e) {
    fail(`Guard 6c: could not require brandRanking.js — ${e.message.split('\n')[0]}`);
    ranking = null;
  }
  if (ranking) {
    const { scoreBrandForPicker, getBrandPriority } = ranking;
    const failures6c = [];
    // Assert 1: Rhode outranks Rare Beauty for "rh"
    {
      const rhode = scoreBrandForPicker('Rhode', 'rh');
      const rare = scoreBrandForPicker('Rare Beauty', 'rh');
      if (!(rhode > rare)) failures6c.push(`Rhode (${rhode}) should outrank Rare Beauty (${rare}) for "rh"`);
    }
    // Assert 2: Dr. Jart+ outranks lower-priority Dr* brands for "dr".
    // Tests against Drunk Elephant (priority 2 in our overrides).
    {
      const drJart = scoreBrandForPicker('Dr. Jart+', 'dr');
      const drunk = scoreBrandForPicker('Drunk Elephant', 'dr');
      if (!(drJart > drunk)) failures6c.push(`Dr. Jart+ (${drJart}) should outrank Drunk Elephant (${drunk}) for "dr"`);
    }
    // Assert 3: Hero Cosmetics is NOT priority 1. Hero Cosmetics is in
    // the priority4 override bucket; if anyone moves it back into
    // priority1, this assertion catches it before the regression ships.
    {
      const p = getBrandPriority('Hero Cosmetics');
      if (p === 1) failures6c.push(`Hero Cosmetics should not be priority 1 (got ${p})`);
    }
    if (failures6c.length > 0) fail(`Ranking asserts (${failures6c.length}): ` + failures6c.join(' | '));
    else ok('Ranking priority asserts (Rhode > Rare Beauty, Dr. Jart+ > Drunk Elephant, Hero ≠ p1)');
  }
}

// ---------------------------------------------------------------------------
// CHECK 4 — app boots in jsdom
// ---------------------------------------------------------------------------
async function smokeCheck() {
  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); }
  catch (e) { fail(`jsdom not installed: ${e.message.split('\n')[0]}`); return; }

  const htmlNow = fs.readFileSync(HTML, 'utf8');

  // === beforeParse POLYFILLS ===
  // Injected on the freshly-constructed jsdom window BEFORE any <script>
  // tag runs. This is the only hook that catches the inline Supabase /
  // Lucide UMD bootstrap, which uses `globalThis.crypto.subtle.something
  // .bind(...)` and friends — without these polyfills the bootstrap
  // crashes with "Cannot read properties of undefined (reading 'bind')"
  // and React never mounts.
  function applyPolyfills(window) {
    // Visual / layout APIs the app calls on mount.
    window.matchMedia = window.matchMedia || ((q) => ({
      matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    window.ResizeObserver = window.ResizeObserver || class { observe(){} unobserve(){} disconnect(){} };
    window.IntersectionObserver = window.IntersectionObserver || class { observe(){} unobserve(){} disconnect(){} takeRecords(){return [];} };
    window.scrollTo = window.scrollTo || (() => {});
    window.scroll = window.scroll || (() => {});

    // SMOKE-TEST FLAG — app code reads this to skip side-effect-heavy
    // bootstraps (product art generation, Gemini calls, periodic timers).
    window.__SMOKE_TEST__ = true;

    // fetch — stubbed so calls to Gemini / Supabase / Anthropic don't
    // depend on network. Returns a benign 503 that the app's existing
    // try/catch handlers swallow.
    window.fetch = async () => ({
      ok: false, status: 503, statusText: 'smoke-test stub',
      headers: { get: () => null, has: () => false },
      text: async () => '', json: async () => ({}),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => ({ size: 0, type: '' }),
      clone() { return this; },
    });

    // crypto.subtle — Supabase's auth helper imports a JWT module that
    // does `crypto.subtle.importKey(...).then(...).bind(...)`. jsdom
    // provides crypto.getRandomValues but not subtle. Reach for Node's
    // web crypto if available, otherwise install a deliberate stub.
    if (!window.crypto) window.crypto = {};
    if (!window.crypto.getRandomValues) {
      window.crypto.getRandomValues = (buf) => {
        for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
        return buf;
      };
    }
    if (!window.crypto.subtle) {
      try { window.crypto.subtle = require('crypto').webcrypto.subtle; }
      catch { window.crypto.subtle = {
        digest: async () => new ArrayBuffer(32),
        importKey: async () => ({}),
        sign: async () => new ArrayBuffer(0),
        verify: async () => true,
        generateKey: async () => ({}),
        encrypt: async () => new ArrayBuffer(0),
        decrypt: async () => new ArrayBuffer(0),
      }; }
    }
    if (!window.crypto.randomUUID) {
      window.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
      });
    }

    // Node-process surface that some isomorphic libraries (Supabase,
    // postgrest-js) probe. Empty env, no-op nextTick is sufficient.
    if (!window.process) {
      window.process = {
        env: {},
        nextTick: (cb) => Promise.resolve().then(cb),
        version: 'v18.0.0',
        platform: 'browser',
      };
    }

    // WebSocket — Supabase realtime probes window.WebSocket on construct.
    // The smoke test doesn't need realtime, just a class shape.
    if (!window.WebSocket) {
      window.WebSocket = class {
        constructor() { this.readyState = 3; setTimeout(() => this.onclose && this.onclose({}), 0); }
        send() {} close() {} addEventListener() {} removeEventListener() {}
      };
      window.WebSocket.CONNECTING = 0; window.WebSocket.OPEN = 1;
      window.WebSocket.CLOSING = 2; window.WebSocket.CLOSED = 3;
    }

    // Canvas — Gemini art pipeline + html2canvas both probe getContext.
    const ctxStub = {
      fillRect: () => {}, clearRect: () => {}, drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {}, save: () => {}, restore: () => {},
      translate: () => {}, scale: () => {}, rotate: () => {},
      beginPath: () => {}, closePath: () => {}, moveTo: () => {}, lineTo: () => {},
      fill: () => {}, stroke: () => {}, arc: () => {}, rect: () => {},
      measureText: () => ({ width: 0 }), fillText: () => {}, strokeText: () => {},
      setTransform: () => {}, resetTransform: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    };
    if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype) {
      window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
      window.HTMLCanvasElement.prototype.toBlob = (cb) => cb && cb(null);
      window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    }
  }

  // Construct jsdom — `resources: undefined` so external <script src>
  // tags (Tailwind CDN, html2canvas CDN) don't fire network requests.
  // beforeParse runs after the window is created but before any inline
  // script executes — the right hook for the polyfill injection.
  const dom = new JSDOM(htmlNow, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/',
    beforeParse: applyPolyfills,
  });
  const { window } = dom;

  // Collect any errors that escape during boot.
  const bootErrors = [];
  window.addEventListener('error', (e) => {
    const msg = (e.error && e.error.message) || e.message || 'unknown';
    const stack = (e.error && e.error.stack) || '';
    bootErrors.push({ msg, stack: stack.slice(0, 400) });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason && (e.reason.message || e.reason.toString && e.reason.toString());
    if (reason && /smoke-test stub|503/i.test(String(reason))) return;
    bootErrors.push({ msg: 'unhandledrejection: ' + (reason || 'unknown'), stack: '' });
  });

  // Tap console.error — React 18 routes mount failures through console
  // before window.error. Filter the high-volume Gemini / Supabase noise
  // so the signal is clear.
  const NOISE_RE = /\[gemini-art\]|\[product-art\]|AuthRetryableFetchError|Could not parse CSS|Not implemented: HTMLCanvas|503|smoke-test stub|navigator\.serviceWorker|matchMedia/i;
  window.console.error = (...args) => {
    const joined = args.map(a => {
      if (a && a.message) return a.message;
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
      return String(a);
    }).join(' ').slice(0, 400);
    if (!NOISE_RE.test(joined)) bootErrors.push({ msg: 'console.error: ' + joined, stack: '' });
  };
  window.console.log = () => {};
  window.console.warn = () => {};

  // Poll for React mount up to TIMEOUT_MS. The bundle is ~2MB inlined
  // and jsdom has no JIT warmup, so it's measurably slower than a real
  // browser — 5s is a comfortable upper bound.
  const TIMEOUT_MS = 8000;
  const POLL_MS = 100;
  const t0 = Date.now();
  while (Date.now() - t0 < TIMEOUT_MS) {
    const r = window.document.getElementById('root');
    if (r && r.innerHTML && r.innerHTML.trim().length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  const root = window.document.getElementById('root');
  const rendered = root && root.innerHTML && root.innerHTML.trim().length > 0;

  // Boot errors we explicitly tolerate (third-party warnings, jsdom
  // limitations that don't affect mount). Keep this list short — the
  // goal is to surface real refactor breakage.
  const realErrors = bootErrors.filter(e =>
    !/AuthRetryableFetchError|Could not parse CSS stylesheet|Not implemented: HTMLCanvas|window\.scrollTo|matchMedia/.test(e.msg + ' ' + e.stack)
  );

  if (realErrors.length > 0) {
    fail(`App boot errors (${realErrors.length}): ` + realErrors.slice(0, 3).map(e => e.msg.slice(0, 250)).join(' | '));
  } else if (!rendered) {
    fail(`App boot rendered empty #root after ${TIMEOUT_MS}ms (React likely failed to mount)`);
  } else {
    ok(`App boots in jsdom (#root rendered ${root.innerHTML.length} chars)`);
  }

  window.close();
}

// ---------------------------------------------------------------------------
// CHECK 5 — returning-user with hung Supabase auth (May 2026 v2)
// ---------------------------------------------------------------------------
// Caught after a real-world blank-page incident: a user opens the app from
// file:// with a stale Supabase auth session in localStorage. Supabase's
// auth client tries to refresh the token via fetch. The fetch is blocked
// by CORS (file:// origin is 'null'). Supabase retries internally and
// the await on getSession() never resolves. App's `loading` state stays
// true, and since `if (loading) return null;` the page goes blank.
//
// This smoke pre-populates localStorage with a returning-user session AND
// installs a fetch stub that rejects any Supabase auth URL with a TypeError
// shaped like the real CORS failure. Verifies the app still mounts.
async function smokeCheckHungAuth() {
  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); }
  catch (e) { return; /* already failed in main smokeCheck */ }
  const htmlNow = fs.readFileSync(HTML, 'utf8');

  function applyPolyfills(window) {
    // Same polyfills as the main smoke check.
    window.matchMedia = window.matchMedia || ((q) => ({
      matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    window.ResizeObserver = window.ResizeObserver || class { observe(){} unobserve(){} disconnect(){} };
    window.IntersectionObserver = window.IntersectionObserver || class { observe(){} unobserve(){} disconnect(){} takeRecords(){return [];} };
    window.scrollTo = window.scrollTo || (() => {});
    window.__SMOKE_TEST__ = true;
    // fetch stub — REJECT Supabase auth URLs with a TypeError that
    // mimics a CORS-blocked fetch from file://. All other fetches still
    // return the benign 503 stub.
    window.fetch = async (url) => {
      const u = String(url || '');
      if (/supabase\.co\/auth\/v1\/token/.test(u)) {
        // Simulate CORS-blocked fetch: TypeError, no response.
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: false, status: 503, statusText: 'smoke-test stub',
        headers: { get: () => null, has: () => false },
        text: async () => '', json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => ({ size: 0, type: '' }),
        clone() { return this; },
      };
    };
    if (!window.crypto) window.crypto = {};
    if (!window.crypto.getRandomValues) {
      window.crypto.getRandomValues = (buf) => { for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256); return buf; };
    }
    if (!window.crypto.subtle) {
      try { window.crypto.subtle = require('crypto').webcrypto.subtle; }
      catch { window.crypto.subtle = { digest: async () => new ArrayBuffer(32) }; }
    }
    if (!window.WebSocket) {
      window.WebSocket = class { constructor(){ this.readyState = 3; setTimeout(() => this.onclose && this.onclose({}), 0); } send(){} close(){} addEventListener(){} removeEventListener(){} };
    }
    const ctxStub = { fillRect:()=>{}, clearRect:()=>{}, drawImage:()=>{}, getImageData:()=>({data:new Uint8ClampedArray(4)}), putImageData:()=>{}, save:()=>{}, restore:()=>{}, translate:()=>{}, scale:()=>{}, rotate:()=>{}, beginPath:()=>{}, closePath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, fill:()=>{}, stroke:()=>{}, arc:()=>{}, rect:()=>{}, measureText:()=>({width:0}), fillText:()=>{}, strokeText:()=>{}, setTransform:()=>{}, resetTransform:()=>{}, createLinearGradient:()=>({addColorStop:()=>{}}), createRadialGradient:()=>({addColorStop:()=>{}}) };
    if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype) {
      window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
      window.HTMLCanvasElement.prototype.toBlob = (cb) => cb && cb(null);
      window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    }
    // Pre-populate localStorage as if the user previously signed in to
    // Supabase. The auth-helpers SDK will read this key on init and
    // try to refresh — which our fetch stub will reject.
    try {
      const fakeSession = {
        currentSession: {
          access_token: 'expired.access.token',
          refresh_token: 'expired.refresh.token',
          expires_at: Math.floor(Date.now() / 1000) - 3600,
          expires_in: -3600,
          token_type: 'bearer',
          user: { id: 'fake-user-id', email: 'returning@example.test' },
        },
        expiresAt: Math.floor(Date.now() / 1000) - 3600,
      };
      window.localStorage.setItem('sb-vdtmflgetzilcgtcsogt-auth-token', JSON.stringify(fakeSession));
      window.localStorage.setItem('lumiere:onboardingState', JSON.stringify({ stage: 'done', skipped: false }));
    } catch (_) {}
  }

  const dom = new JSDOM(htmlNow, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/', // jsdom can't actually use file:// — fetch stub does the work
    beforeParse: applyPolyfills,
  });
  const { window } = dom;
  window.console.error = () => {};
  window.console.warn = () => {};
  window.console.log = () => {};

  // 6s budget — the auth getSession timeout race we added is 3s; render
  // should follow within ~1s after. 6s is comfortable headroom.
  const TIMEOUT_MS = 6000;
  const POLL_MS = 100;
  const t0 = Date.now();
  while (Date.now() - t0 < TIMEOUT_MS) {
    const r = window.document.getElementById('root');
    if (r && r.innerHTML && r.innerHTML.trim().length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  const root = window.document.getElementById('root');
  const rendered = root && root.innerHTML && root.innerHTML.trim().length > 0;
  if (!rendered) {
    fail(`App boot HUNG when Supabase auth fetch fails (returning-user scenario). #root empty after ${TIMEOUT_MS}ms. Likely a missing timeout race around supabaseClient.auth.getSession().`);
  } else {
    ok(`App boots even with hung Supabase auth (#root rendered ${root.innerHTML.length} chars)`);
  }
  window.close();
}

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------
(async () => {
  try { await smokeCheck(); }
  catch (e) { fail('smoke check threw: ' + (e.message || String(e)).slice(0, 200)); }

  try { await smokeCheckHungAuth(); }
  catch (e) { fail('hung-auth smoke threw: ' + (e.message || String(e)).slice(0, 200)); }

  console.log('\n=== source-of-truth + smoke check ===\n');
  for (const p of passes) console.log(`  ok    ${p}`);
  for (const w of warnings) console.log(`  warn  ${w}`);
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ${passes.length} ok, ${warnings.length} warn, ${failures.length} failed\n`);
  process.exit(failures.length === 0 ? 0 : 1);
})();
