#!/usr/bin/env node
// scripts/generate_products.js
//
// Asks Claude Opus to generate product entries for any brands you want added
// to the local POPULAR_PRODUCTS list inside index.jsx.source. Output is
// printed to stdout — paste it into the array.
//
// USAGE:
//   1. Set your Anthropic key:
//        export ANTHROPIC_API_KEY=sk-ant-...
//   2. List the brands you want to add (one per line in BRANDS below or pass as args):
//        node scripts/generate_products.js "Tower 28" "Versed" "Bubble"
//   3. Copy the printed entries and paste them into the POPULAR_PRODUCTS array
//      in index.jsx.source (anywhere is fine, the order doesn't matter for search).
//   4. Run the rebuild step (see SUPABASE_SETUP.md or your usual rebuild path).
//
// COST: ~5 cents per brand at Opus pricing (one ~600-token request per brand).
//
// Tip: if you want to refresh existing entries with newer formulations, just
// list the brand again — paste replaces.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error('Missing ANTHROPIC_API_KEY env var.');
  console.error('Run: export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

// Default list — overridden when you pass brand names as CLI args.
const DEFAULT_BRANDS = [
  // Add brands you want covered. Examples:
  // 'Tower 28', 'Versed', 'Bubble', 'TONYMOLY', 'Banila Co', 'Skinfood',
  // 'Sulwhasoo', 'Hera', 'Belif', 'Dr. Loretta', 'Pixi',
];

const BRANDS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_BRANDS;
if (BRANDS.length === 0) {
  console.error('No brands to generate. Either pass brands as args:');
  console.error('  node scripts/generate_products.js "Tower 28" "Versed"');
  console.error('Or edit DEFAULT_BRANDS in this script.');
  process.exit(1);
}

const PROMPT_TEMPLATE = (brand) => `List the 5-8 most popular / hero skincare products from the brand "${brand}" using your knowledge of real-world skincare products and current formulations.

Return ONLY a JSON array (no prose, no code fences). Each item must use these exact keys with real, specific data — never empty strings, never "unknown":

[
  {
    "name": "Product name only — NO brand in here",
    "brand": "${brand}",
    "category": "one of: cleanser | toner | serum | moisturizer | sunscreen | treatment | exfoliant | mask | oil | other",
    "actives": "active ingredients WITH PERCENTAGES, comma-separated. Always include % when published. e.g. 'Niacinamide 10%, Zinc PCA 1%'",
    "main": "3-5 supporting/structural ingredients beyond actives (humectants, emollients, soothers), comma-separated",
    "tags": ["4-6", "short", "lowercase-hyphenated", "benefit-tags"],
    "concerns": ["array", "from", "this", "list", "ONLY"]
  }
]

Concerns must come from this exact list — use multiple if relevant:
hyperpigmentation, redness, enlarged-pores, dark-circles, wrinkles, sun-damage, dryness, dullness, oiliness, sensitivity, texture, blemishes, fine-lines

If you don't know exact concentrations, give the published or commonly cited percentages. If a brand only has 3-4 hero products, return those. Return ONLY the JSON array.`;

const callOpus = async (prompt) => {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.content.map(i => i.type === 'text' ? i.text : '').join('').trim();
};

const parseProducts = (text) => {
  // Strip code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found');
  return JSON.parse(cleaned.slice(start, end + 1));
};

const formatEntry = (p) => {
  const tags = JSON.stringify(p.tags || []);
  const concerns = JSON.stringify(p.concerns || []);
  return `  { name: ${JSON.stringify(p.name)}, brand: ${JSON.stringify(p.brand)}, category: ${JSON.stringify(p.category)}, actives: ${JSON.stringify(p.actives)}, main: ${JSON.stringify(p.main)}, tags: ${tags}, concerns: ${concerns} },`;
};

(async () => {
  console.error(`Generating entries for ${BRANDS.length} brand(s)…\n`);
  const allEntries = [];
  for (const brand of BRANDS) {
    process.stderr.write(`  ${brand}… `);
    try {
      const raw = await callOpus(PROMPT_TEMPLATE(brand));
      const products = parseProducts(raw);
      console.error(`${products.length} products`);
      for (const p of products) allEntries.push(formatEntry(p));
    } catch (e) {
      console.error(`FAILED — ${e.message}`);
    }
  }
  console.error(`\n=== ${allEntries.length} entries to paste ===\n`);
  console.log(allEntries.join('\n'));
  console.error('\nPaste the lines above into the POPULAR_PRODUCTS array in index.jsx.source,');
  console.error('then rebuild and ship.');
})();
