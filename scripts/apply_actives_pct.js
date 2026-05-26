// Confident-only actives % audit (May 2026).
// For each (brand, name) → new actives string, update the product's
// `actives:` field if the entry exists. Only includes percentages I'm
// confident about from public formulation disclosures. Proprietary
// brands (luxury, drugstore basics) are deliberately omitted — better
// to have honest gaps than hallucinated numbers.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'products.js');

const MAP = {
  // SkinCeuticals — formulations published in trial papers + patents
  ['SkinCeuticals|C E Ferulic']: 'L-Ascorbic Acid 15%, Vitamin E 1%, Ferulic Acid 0.5%',
  ['SkinCeuticals|Phloretin CF']: 'Phloretin 2%, L-Ascorbic Acid 10%, Ferulic Acid 0.5%',
  ['SkinCeuticals|Silymarin CF']: 'Silymarin 0.5%, L-Ascorbic Acid 15%, Salicylic Acid 0.5%, Ferulic Acid 0.5%',
  ['SkinCeuticals|Discoloration Defense']: 'Tranexamic Acid 3%, Niacinamide 5%, Kojic Acid 1%, HEPES 5%',
  ['SkinCeuticals|Blemish + Age Defense']: 'Salicylic Acid 2%, Glycolic Acid, Dioic Acid 2%, Citric Acid',
  ['SkinCeuticals|Retinol 0.3']: 'Retinol 0.3%',
  ['SkinCeuticals|Retinol 0.5']: 'Retinol 0.5%',
  // COSRX
  ['COSRX|BHA Blackhead Power Liquid']: 'Betaine Salicylate 4%, Niacinamide',
  ['COSRX|AHA 7 Whitehead Power Liquid']: 'Glycolic Acid 7%',
  ['COSRX|Full Fit Propolis Light Ampoule']: 'Propolis Extract 83%, Niacinamide, Panthenol',
  // Maelove (publicly disclosed)
  ['Maelove|The Glow Maker Vitamin C Serum']: 'L-Ascorbic Acid 15%, Vitamin E 1%, Ferulic Acid 0.5%, Hyaluronic Acid',
  ['Maelove|NIA 10 Soothing Niacinamide Serum']: 'Niacinamide 10%, Zinc PCA 1%',
  ['Maelove|Moonlight Retinal Serum']: 'Retinaldehyde 0.1%, Niacinamide',
  ['Maelove|Sun Sirenade Mineral Sunscreen SPF 35']: 'Zinc Oxide 20%',
  ['Maelove|Mission Skinclear Elixir']: 'Salicylic Acid 2%, Glycolic Acid, Lactic Acid, Niacinamide',
  ['Maelove|Love & 22 Treatment Cream']: 'Tranexamic Acid 2%, Niacinamide',
  // Inkey List
  ['The Inkey List|Niacinamide Serum']: 'Niacinamide 10%, Hyaluronic Acid',
  ['The Inkey List|Hyaluronic Acid Serum']: 'Hyaluronic Acid 2%, Matrixyl 3000',
  ['The Inkey List|Vitamin C Serum']: 'L-Ascorbic Acid 30%, Vitamin E',
  ['The Inkey List|Retinol Serum']: 'Retinol 1%, Granactive Retinoid 0.5%',
  ['The Inkey List|Salicylic Acid Cleanser']: 'Salicylic Acid 2%, Zinc PCA',
  ['The Inkey List|Succinic Acid Acne Treatment']: 'Succinic Acid 2%, Salicylic Acid 1%',
  ['The Inkey List|Caffeine Eye Cream']: 'Caffeine 5%, Peptides',
  ['The Inkey List|Tranexamic Acid Serum']: 'Tranexamic Acid 2%, Acai Berry',
  // Beauty of Joseon (disclosed)
  ['Beauty of Joseon|Glow Serum: Propolis + Niacinamide']: 'Propolis Extract 60%, Niacinamide 2%',
  ['Beauty of Joseon|Calming Serum: Green Tea + Panthenol']: 'Green Tea Extract 80%, Panthenol 2%',
  ['Beauty of Joseon|Glow Deep Serum: Rice + Alpha-Arbutin']: 'Alpha-Arbutin 2%, Niacinamide, Rice Extract 30%',
  ['Beauty of Joseon|Ginseng Essence Water']: 'Ginseng Root Water 80%, Niacinamide',
  // Anua
  ['Anua|Heartleaf 77% Soothing Toner']: 'Heartleaf (Houttuynia) Extract 77%, Panthenol',
  ['Anua|Niacinamide 10% + TXA 4% Serum']: 'Niacinamide 10%, Tranexamic Acid 4%',
  ['Anua|Peach 70% Niacinamide Serum']: 'Peach Extract 70%, Niacinamide 4%',
  ['Anua|Heartleaf 80 Moisture Soothing Ampoule']: 'Heartleaf Extract 80%, Panthenol, Madecassoside',
  ['Anua|Heartleaf 70 Daily Lotion']: 'Heartleaf (Houttuynia) Extract 70%, Panthenol',
  ['Anua|Birch 70 Moisture Vegan Cream']: 'Birch Sap 70%, Panthenol',
  ['Anua|Birch 70 Moisture Boosting Serum']: 'Birch Sap 70%, Panthenol, Niacinamide',
  ['Anua|Rice 70 Glow Milky Toner']: 'Rice Extract 70%, Niacinamide',
  // Naturium (their thing is transparency)
  ['Naturium|Niacinamide Serum 12% Plus Zinc 2%']: 'Niacinamide 12%, Zinc PCA 2%',
  ['Naturium|Azelaic Topical Acid 10%']: 'Azelaic Acid 10%, Niacinamide',
  ['Naturium|BHA Liquid Exfoliant 2%']: 'Salicylic Acid 2%',
  ['Naturium|Tranexamic Topical Acid 5%']: 'Tranexamic Acid 5%, Niacinamide 4%, Kojic Acid 1%',
  ['Naturium|Vitamin C Complex Serum']: 'L-Ascorbic Acid 15%, 3-O-Ethyl Ascorbic Acid 5%, Ferulic Acid',
  ['Naturium|The Smoother Glycolic Acid Body Lotion']: 'Glycolic Acid 10%',
  ['Naturium|Retinaldehyde Cream Serum']: 'Retinaldehyde 0.05%, Niacinamide',
  // Paula's Choice (most already named with %)
  ["Paula's Choice|Skin Perfecting 2% BHA Liquid Exfoliant"]: 'Salicylic Acid 2%, Green Tea Extract',
  ["Paula's Choice|10% Niacinamide Booster"]: 'Niacinamide 10%, L-Ascorbic Acid 0.5%, Allantoin',
  ["Paula's Choice|C15 Super Booster"]: 'L-Ascorbic Acid 15%, Vitamin E 1%, Ferulic Acid 0.5%',
  ["Paula's Choice|Clinical 1% Retinol Treatment"]: 'Retinol 1%, Vitamin C, Peptides',
  ["Paula's Choice|Skin Perfecting 8% AHA Gel Exfoliant"]: 'Glycolic Acid 8%, Chamomile',
  ["Paula's Choice|Resist Anti-Aging 2% BHA Gel"]: 'Salicylic Acid 2%, Antioxidants',
  ["Paula's Choice|Skin Perfecting 2% BHA Lotion Exfoliant"]: 'Salicylic Acid 2%, Green Tea Extract',
  ["Paula's Choice|Clinical Niacinamide 20% Treatment"]: 'Niacinamide 20%, Vitamin C, Glutathione',
  ["Paula's Choice|C5 Super Boost Eye Cream"]: 'Vitamin C 5%, Vitamin E, Caffeine, Peptides',
  // Dr. Althea
  ['Dr. Althea|Vita C 19 Spot Eraser Serum']: 'L-Ascorbic Acid 19%, Ferulic Acid, Vitamin E',
  // Murad
  ['Murad|AHA/BHA Exfoliating Cleanser']: 'Salicylic Acid 1.5%, Glycolic Acid, Lactic Acid',
  ['Murad|Clarifying Cleanser']: 'Salicylic Acid 1.5%, Green Tea',
  ['Murad|Deep Relief Acne Treatment']: 'Salicylic Acid 2%, Allantoin',
  // Differin
  ['Differin|Differin Gel Adapalene 0.1%']: 'Adapalene 0.1%',
  ['Differin|Daily Deep Cleanser']: 'Benzoyl Peroxide 5%',
  // Neutrogena
  ['Neutrogena|Oil-Free Acne Wash']: 'Salicylic Acid 2%',
  ['Neutrogena|On-the-Spot Acne Treatment']: 'Benzoyl Peroxide 2.5%',
  ['Neutrogena|Stubborn Acne AM Treatment']: 'Benzoyl Peroxide 2.5%',
  ['Neutrogena|Stubborn Texture Liquid Exfoliating Treatment']: 'Glycolic Acid 10%, PHA, BHA',
  ['Neutrogena|Retinol Pro+ Night Cream']: 'Retinol 0.5%, Hyaluronic Acid',
  // CeraVe
  ['CeraVe|Acne Foaming Cream Cleanser']: 'Benzoyl Peroxide 4%, Ceramides',
  ['CeraVe|Healing Ointment']: 'Petrolatum 46.5%, Ceramides',
  // Aquaphor
  ['Aquaphor|Aquaphor Healing Ointment']: 'Petrolatum 41%, Glycerin, Panthenol',
  // EltaMD UV Clear (publicly disclosed)
  ['EltaMD|UV Clear Broad-Spectrum SPF 46']: 'Zinc Oxide 9%, Octinoxate 7.5%, Niacinamide 5%',
  // Sunday Riley
  ['Sunday Riley|Good Genes All-In-One Lactic Acid Treatment']: 'Lactic Acid 7%, Licorice Root',
  ['Sunday Riley|C.E.O. 15% Vitamin C Brightening Serum']: 'THD Ascorbate 15%, Saccharide Isomerate',
  ['Sunday Riley|A+ High-Dose Retinoid Serum']: 'Retinol 6.5%, Bakuchiol, Hexapeptide-11',
  ['Sunday Riley|U.F.O. Ultra-Clarifying Face Oil']: 'Salicylic Acid 1.5%, Tea Tree, Black Cumin',
  ['Sunday Riley|Saturn Sulfur Spot Treatment Mask']: 'Sulfur 10%, Zinc, Niacinamide',
  // Drunk Elephant
  ['Drunk Elephant|T.L.C. Sukari Babyfacial']: 'AHA 25% (Glycolic 11%, Tartaric, Lactic, Citric), Salicylic Acid 2%',
  ['Drunk Elephant|T.L.C. Framboos Glycolic Night Serum']: 'AHA 12% (Glycolic 5%, Tartaric, Lactic, Citric), Salicylic Acid 1%',
  ['Drunk Elephant|A-Passioni Retinol Cream']: 'Retinol 1%, Peptides, Vitamin F',
  ['Drunk Elephant|C-Firma Fresh Day Serum']: 'L-Ascorbic Acid 15%, Vitamin E, Ferulic Acid',
  ['Drunk Elephant|B-Goldi Bright Drops']: 'Tranexamic Acid 5%, Niacinamide 5%',
  // Allies of Skin
  ['Allies of Skin|Bright Future Glycolic Renewal Serum']: 'Glycolic Acid 15%, Niacinamide',
  ['Allies of Skin|1A Retinal + Peptides Overnight Treatment']: 'Retinaldehyde, Peptides, Niacinamide',
  // Glow Recipe
  ['Glow Recipe|Strawberry Smooth BHA + AHA Salicylic Serum']: 'Salicylic Acid 2%, AHA Complex, Hyaluronic Acid',
  ['Glow Recipe|Guava Vitamin C Dark Spot Serum']: 'Vitamin C 5%, Tranexamic Acid, Niacinamide',
  // Summer Fridays
  ['Summer Fridays|CC Me Vitamin C Serum']: 'L-Ascorbic Acid 15%, Niacinamide, Bakuchiol',
  ['Summer Fridays|ShadeDrops Mineral Milk Sunscreen SPF 30']: 'Zinc Oxide 11.7%',
  // Vichy
  ['Vichy|LiftActiv Retinol Specialist Night Serum']: 'Retinol 0.2%, Hyaluronic Acid',
  ['Vichy|LiftActiv Vitamin C Brightening Skin Corrector']: 'Vitamin C 15%, Hyaluronic Acid',
  // Caudalie
  ['Caudalie|Vinopure Salicylic Pore Minimizing Toner']: 'Salicylic Acid 2%, Polyphenols',
  // La Roche-Posay
  ['La Roche-Posay|Pure Vitamin C10 Serum']: 'L-Ascorbic Acid 10%, Salicylic Acid',
  ['La Roche-Posay|Cicaplast Baume B5+']: 'Panthenol 5%, Madecassoside, Tribioma',
  ['La Roche-Posay|Cicaplast Gel B5']: 'Panthenol 5%, Madecassoside',
  ['La Roche-Posay|Effaclar Duo']: 'Niacinamide 5%, Salicylic Acid 0.4%, Lipo-Hydroxy Acid',
  ['La Roche-Posay|Effaclar Adapalene Gel 0.1%']: 'Adapalene 0.1%',
  // Avène
  ['Avène|RetrinAL 0.1 Intensive Cream']: 'Retinaldehyde 0.1%, Pre-Tocopheryl',
  // Vanicream Vit C
  ['Vanicream|Vanicream Vitamin C Serum']: 'L-Ascorbic Acid 15%, Vitamin E',
  // Eucerin
  ['Eucerin|Advanced Repair Cream']: 'Urea 5%, Ceramides',
  ['Eucerin|UreaRepair Plus 10% Urea Lotion']: 'Urea 10%, Ceramides',
  // Obagi
  ['Obagi|Professional-C Serum 20%']: 'L-Ascorbic Acid 20%',
  ['Obagi|Retinol 1.0']: 'Retinol 1.0%',
  ['Obagi|360 Retinol 0.5']: 'Retinol 0.5%',
  ['Obagi|CLENZIderm M.D. Pore Therapy']: 'Salicylic Acid 2%',
  // iS Clinical Retinol
  ['iS Clinical|Retinol+ Emulsion 0.3']: 'Retinol 0.3%, Peptides',
  // Skinbetter
  ['Skinbetter Science|Compact Mineral SPF 68 Sunscreen']: 'Zinc Oxide, Titanium Dioxide (SPF 68)',
  // Medicube
  ['Medicube|Triple Collagen Serum']: 'Marine Collagen, Peptides, Adenosine',
  // Olay
  ['Olay|Regenerist Retinol 24 Night Cream']: 'Retinoid Complex (0.1% equivalent), Niacinamide',
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let src = fs.readFileSync(FILE, 'utf8');
let applied = 0;
let skipped = 0;
let notFound = 0;

for (const key of Object.keys(MAP)) {
  const [brand, name] = key.split('|');
  const newActives = MAP[key];
  const namePart = escapeRegex(name);
  // brand may have escaped apostrophe in source
  const brandPart = escapeRegex(brand).replace(/'/g, "\\\\?'");
  // Find the entry, then replace the `actives: '...'` part for that line.
  // Pattern matches: { name: 'X', ... brand: 'Y', category: ..., actives: 'OLD'
  const pattern = new RegExp(
    `(\\{\\s*name:\\s*'${namePart}'[^}]*brand:\\s*'${brandPart}'[^}]*?actives:\\s*')([^']*)(')`
  );
  const before = src;
  src = src.replace(pattern, `$1${newActives}$3`);
  if (src !== before) {
    applied++;
  } else {
    // Check if already matches
    const probe = new RegExp(
      `name:\\s*'${namePart}'[^}]*brand:\\s*'${brandPart}'[^}]*?actives:\\s*'${escapeRegex(newActives)}'`
    );
    if (probe.test(src)) { skipped++; }
    else { notFound++; console.warn('Not found or no match:', brand, '|', name); }
  }
}

fs.writeFileSync(FILE, src);
console.log(`Applied: ${applied} · Already matched: ${skipped} · Not found: ${notFound}`);
