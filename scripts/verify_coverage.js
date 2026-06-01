// === COVERAGE ENGINE VERIFICATION — May 2026 ===
// Standalone Node script. Sanity-checks derivation + coverage resolution
// against fixture routines. NOT a test suite — a developer affordance
// for inspecting engine output before wiring it into the UI.
//
// Run: node scripts/verify_coverage.js
//
// Fixtures are synthetic products that mirror the real products.js
// shape. Synthetic > real to keep the test reproducible and validate
// the engine logic, not the data quality.

const { deriveProductJobs } = require('../src/resolvers/deriveProductJobs.js');
const { resolveCoverageStates } = require('../src/resolvers/coverageEngine.js');
const { buildRecCards } = require('../src/resolvers/recCopy.js');

// === FIXTURES ===
const P = {
  gentleCleanser:       { name: 'Gentle Cleanser',       category: 'cleanser',    actives: 'Amino Acids, Glycerin',                       main: 'Aloe',         tags: ['gentle-cleanser','daily'] },
  hydratingToner:       { name: 'Hydrating Toner',       category: 'toner',       actives: 'Hyaluronic Acid, Panthenol',                  main: 'Glycerin',     tags: ['hydrating-toner'] },
  ceramideMoisturizer:  { name: 'Ceramide Cream',        category: 'moisturizer', actives: 'Ceramides, Cholesterol, Hyaluronic Acid',     main: 'Squalane',     tags: ['barrier','rich-cream'] },
  basicMoisturizer:     { name: 'Basic Lotion',          category: 'moisturizer', actives: 'Glycerin',                                    main: 'Glycerin',     tags: ['daily'] },
  mineralSpf:           { name: 'Mineral SPF',           category: 'sunscreen',   actives: 'Zinc Oxide 20%',                              main: 'Squalane',     tags: ['mineral-spf','daily-spf'] },
  moisturizerSpf:       { name: 'Moisturizer + SPF',     category: 'sunscreen',   actives: 'Zinc Oxide 12%, Hyaluronic Acid',             main: 'Glycerin',     tags: ['moisturizer-spf','daily-spf'] },
  tintedSpf:            { name: 'Tinted SPF',            category: 'sunscreen',   actives: 'Zinc Oxide 18%, Iron Oxides',                 main: 'Squalane',     tags: ['tinted-spf','mineral-spf'] },
  vitCSerum:            { name: 'Vit C Serum',           category: 'serum',       actives: 'L-Ascorbic Acid 15%, Ferulic Acid',           main: 'Glycerin',     tags: ['vitamin-c','antioxidant'] },
  retinol:              { name: 'Retinol 0.5%',          category: 'treatment',   actives: 'Retinol 0.5%, Squalane',                      main: 'Squalane',     tags: ['retinol','overnight'] },
  centellaSoother:      { name: 'Centella Serum',        category: 'serum',       actives: 'Centella, Madecassoside, Panthenol',          main: 'Glycerin',     tags: ['soothing','barrier'] },
  ahaBha:               { name: 'AHA/BHA Exfoliant',     category: 'exfoliant',   actives: 'Glycolic Acid 10%, Salicylic Acid 2%',        main: 'Niacinamide',  tags: ['aha','bha'] },
  niacinamideSerum:     { name: 'Niacinamide 10%',       category: 'serum',       actives: 'Niacinamide 10%',                             main: 'Glycerin',     tags: ['brightening'] },
  cleansingOil:         { name: 'Squalane Cleansing Oil', category: 'cleanser',   actives: 'Squalane, Vitamin E',                          main: 'Marula',      tags: ['cleansing-oil','double-cleanse'] },
  physicalScrub:        { name: 'Micro-Polish Scrub',     category: 'exfoliant',  actives: 'Jojoba Beads, Glycolic Acid',                  main: 'Glycerin',    tags: ['physical-exfoliant'] },
};

// === DERIVATION INSPECTION ===
console.log('=== Derivation per product ===');
const padEnd = (s, n) => (s + ' '.repeat(n)).slice(0, n);
Object.entries(P).forEach(([key, p]) => {
  const d = deriveProductJobs(p);
  console.log(`  ${padEnd(key, 22)} jobs=[${padEnd(d.jobs.join(', '), 60)}]  mechs=[${d.mechanismTags.join(', ')}]`);
});

// === COVERAGE SCENARIOS ===
const scenarios = [
  {
    name: 'Minimal — covered, no concerns',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: [],
    preferences: { routineSize: 'minimal' },
  },
  {
    name: 'Minimal — Calm flagged, no soother',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: ['calm'],
    preferences: { routineSize: 'minimal' },
  },
  {
    name: 'Minimal — Calm flagged, centella in routine',
    routine: { am: [P.gentleCleanser, P.centellaSoother, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.centellaSoother, P.basicMoisturizer] },
    concerns: ['calm'],
    preferences: { routineSize: 'minimal' },
  },
  {
    name: 'Missing SPF',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: [],
    preferences: {},
  },
  {
    name: 'Moisturizer+SPF only — should cover BOTH moisturize-seal AND sun-protect',
    routine: { am: [P.gentleCleanser, P.moisturizerSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: [],
    preferences: {},
  },
  {
    name: 'Has SPF but no tinted — standard user (complement: tinted)',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: [],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'Has SPF but no tinted — minimalist (complement suppressed)',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: [],
    preferences: { routineSize: 'minimal' },
  },
  {
    name: 'Has tinted SPF — no tinted complement',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.tintedSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: [],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'Repair flagged, no ceramides anywhere',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: ['repair'],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'Repair flagged, ceramide cream present',
    routine: { am: [P.gentleCleanser, P.ceramideMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.ceramideMoisturizer] },
    concerns: ['repair'],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'Brightening — Calm + Repair + Brighten flagged, full coverage',
    routine: { am: [P.gentleCleanser, P.vitCSerum, P.ceramideMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.centellaSoother, P.retinol, P.ceramideMoisturizer] },
    concerns: ['repair', 'calm', 'brighten'],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'Brighten flagged, only niacinamide (no vit-C)',
    routine: { am: [P.gentleCleanser, P.niacinamideSerum, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: ['brighten'],
    preferences: { routineSize: 'standard' },
  },
  // === SWAP scenarios ===
  {
    name: 'SWAP — AM cleansing oil + Calm flag',
    routine: { am: [P.cleansingOil, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: ['calm'],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'SWAP — Retinoid PM + Repair flag',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.retinol, P.basicMoisturizer] },
    concerns: ['repair'],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'SWAP — Physical scrub + Calm flag',
    routine: { am: [P.gentleCleanser, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.physicalScrub, P.basicMoisturizer] },
    concerns: ['calm'],
    preferences: { routineSize: 'standard' },
  },
  {
    name: 'SWAP — None when no concern flagged (cleansing oil OK with no calm)',
    routine: { am: [P.cleansingOil, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
    concerns: [],
    preferences: { routineSize: 'standard' },
  },
];

console.log('\n=== Coverage scenarios ===\n');
scenarios.forEach(s => {
  // In Node, deriveProductJobs isn't in coverageEngine's scope — pass explicitly.
  // (Sidecar concat in the browser build has both at module scope so the
  // engine's default lookup works there.)
  const result = resolveCoverageStates({ routine: s.routine, concerns: s.concerns, preferences: s.preferences }, deriveProductJobs);
  console.log(`-- ${s.name}`);
  console.log(`   concerns:    [${s.concerns.join(', ')}]   routineSize: ${s.preferences.routineSize || '-'}`);
  console.log(`   AM jobs:     ${result.coverage.am.jobs.join(', ') || '(none)'}`);
  console.log(`   PM jobs:     ${result.coverage.pm.jobs.join(', ') || '(none)'}`);
  console.log(`   MISSING:     ${result.missing.length ? result.missing.map(m => m.slot + '/' + m.job).join(', ') : '(none)'}`);
  console.log(`   CONCERN_GAP: ${result.concernGap.length ? result.concernGap.map(c => c.concern + ' → ' + c.mechanism).join(', ') : '(none)'}`);
  console.log(`   COMPLEMENT:  ${result.complement.length ? result.complement.map(c => c.job + ' (' + c.reason + ')').join(', ') : '(none)'}`);
  if (result.swap.length) {
    result.swap.forEach(s => {
      console.log(`   SWAP:        [${s.ruleId}] ${s.product.brand || ''} ${s.product.name} — ${s.suggestion}`);
    });
  } else {
    console.log(`   SWAP:        (none)`);
  }
  console.log(`   allCovered:  ${result.allCovered}`);
  console.log('');
});

// === REC CARDS PER SURFACE — voice + routing check ===
console.log('\n=== Rec cards by surface (sample scenario: Repair flagged, no ceramides + cleansing oil) ===\n');
const sampleCoverage = resolveCoverageStates({
  routine: { am: [P.cleansingOil, P.basicMoisturizer, P.mineralSpf], pm: [P.gentleCleanser, P.basicMoisturizer] },
  concerns: ['repair', 'calm'],
  preferences: { routineSize: 'standard' },
}, deriveProductJobs);

['home', 'regimen', 'journal', 'insights'].forEach(surface => {
  const cards = buildRecCards(sampleCoverage, { surface });
  console.log(`-- ${surface.toUpperCase()} (${cards.length} cards)`);
  cards.forEach((c, i) => {
    console.log(`   [${i+1}] ${c.state}`);
    console.log(`       eyebrow: ${c.eyebrow}`);
    console.log(`       title:   ${c.title}`);
    console.log(`       body:    ${c.body.replace(/\n/g, ' / ')}`);
    if (c.picks.length) {
      console.log(`       picks:   ${c.picks.map(p => p.brand + ' ' + p.name).join('; ')}`);
    }
  });
  console.log('');
});
