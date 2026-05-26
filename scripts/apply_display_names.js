// Bulk-applies displayName to existing products by exact (brand, name) match.
// Pattern: inserts `displayName: 'X', ` right after the name field. Idempotent —
// skips entries that already have displayName.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'products.js');

// (brand, name) → displayName. Add new mappings here.
const MAP = {
  // Drunk Elephant
  ['Drunk Elephant|Protini Polypeptide Cream']: 'Protini',
  ['Drunk Elephant|C-Firma Fresh Day Serum']: 'C-Firma',
  ['Drunk Elephant|T.L.C. Sukari Babyfacial']: 'T.L.C. Sukari',
  ['Drunk Elephant|Beste No. 9 Jelly Cleanser']: 'Beste No. 9',
  ['Drunk Elephant|B-Hydra Intensive Hydration Serum']: 'B-Hydra',
  ['Drunk Elephant|Lala Retro Whipped Cream']: 'Lala Retro',
  ['Drunk Elephant|Marula Luxury Facial Oil']: 'Marula Oil',
  ['Drunk Elephant|A-Passioni Retinol Cream']: 'A-Passioni',
  ['Drunk Elephant|Umbra Tinte SPF 30']: 'Umbra Tinte',
  ['Drunk Elephant|F-Balm Electrolyte Waterfacial Mask']: 'F-Balm',
  // Sunday Riley
  ['Sunday Riley|Good Genes All-In-One Lactic Acid Treatment']: 'Good Genes',
  ['Sunday Riley|Luna Sleeping Night Oil']: 'Luna',
  ['Sunday Riley|A+ High-Dose Retinoid Serum']: 'A+',
  ['Sunday Riley|U.F.O. Ultra-Clarifying Face Oil']: 'U.F.O.',
  ['Sunday Riley|C.E.O. 15% Vitamin C Brightening Serum']: 'C.E.O.',
  ['Sunday Riley|Ice Ceramide Moisturizing Cream']: 'Ice',
  ['Sunday Riley|Pink Drink Firming Resurfacing Essence']: 'Pink Drink',
  ['Sunday Riley|Saturn Sulfur Spot Treatment Mask']: 'Saturn',
  ['Sunday Riley|Auto Correct Brightening and Depuffing Eye Cream']: 'Auto Correct',
  ['Sunday Riley|Ceramic Slip Cleanser']: 'Ceramic Slip',
  ['Sunday Riley|Juno Antioxidant + Superfood Face Oil']: 'Juno',
  ['Sunday Riley|Light Hearted Broad Spectrum SPF 30']: 'Light Hearted',
  // COSRX
  ['COSRX|Advanced Snail 96 Mucin Power Essence']: 'Snail 96 Essence',
  ['COSRX|Hydrium Centella Aqua Soothing Ampoule']: 'Hydrium Centella',
  ['COSRX|BHA Blackhead Power Liquid']: 'BHA Power Liquid',
  ['COSRX|Salicylic Acid Daily Gentle Cleanser']: 'Salicylic Cleanser',
  ['COSRX|Acne Pimple Master Patch']: 'Pimple Patch',
  ['COSRX|Low pH Good Morning Gel Cleanser']: 'Low pH Cleanser',
  ['COSRX|Propolis Synergy Toner']: 'Propolis Synergy',
  ['COSRX|AHA/BHA Clarifying Treatment Toner']: 'AHA/BHA Toner',
  ['COSRX|Vitamin C 23 Serum']: 'Vitamin C 23',
  ['COSRX|Master Patch Intensive 0.6']: 'Master Patch 0.6',
  ['COSRX|Advanced Snail 96 Mucin Power Sheet Mask']: 'Snail 96 Mask',
  ['COSRX|Advanced Snail 92 All In One Cream']: 'Snail 92 Cream',
  ['COSRX|AHA 7 Whitehead Power Liquid']: 'AHA Power Liquid',
  ['COSRX|Full Fit Propolis Light Ampoule']: 'Propolis Ampoule',
  ['COSRX|Hydrium Triple Hyaluronic Moisture Ampoule']: 'Triple HA Ampoule',
  ['COSRX|Balancium Comfort Ceramide Cream']: 'Balancium Cream',
  // Paula's Choice
  ["Paula's Choice|Skin Perfecting 2% BHA Liquid Exfoliant"]: 'Skin Perfecting 2% BHA',
  ["Paula's Choice|10% Niacinamide Booster"]: '10% Niacinamide Booster',
  ["Paula's Choice|C15 Super Booster"]: 'C15 Super Booster',
  ["Paula's Choice|Skin Perfecting 8% AHA Gel Exfoliant"]: 'Skin Perfecting 8% AHA',
  ["Paula's Choice|Resist Anti-Aging 2% BHA Gel"]: 'Resist 2% BHA Gel',
  ["Paula's Choice|Clinical 1% Retinol Treatment"]: 'Clinical 1% Retinol',
  ["Paula's Choice|Resist Hyaluronic Acid Booster"]: 'Resist HA Booster',
  ["Paula's Choice|Defense Antioxidant Pore Purifier"]: 'Defense Pore Purifier',
  ["Paula's Choice|Calm Redness Relief Repairing Serum"]: 'Calm Redness Serum',
  ["Paula's Choice|Resist Pure Radiance Skin Brightening Treatment"]: 'Resist Pure Radiance',
  ["Paula's Choice|Pro-Collagen Multi-Peptide Booster"]: 'Pro-Collagen Peptides',
  ["Paula's Choice|Skin Perfecting 2% BHA Lotion Exfoliant"]: 'Skin Perfecting 2% BHA Lotion',
  ["Paula's Choice|Clinical Discoloration Repair Serum"]: 'Clinical Discoloration',
  ["Paula's Choice|Clinical Niacinamide 20% Treatment"]: 'Clinical Niacinamide 20%',
  ["Paula's Choice|C5 Super Boost Eye Cream"]: 'C5 Eye Cream',
  ["Paula's Choice|Resist Triple Algae Pore Minimizer"]: 'Triple Algae',
  ["Paula's Choice|Earth Sourced Power Berry Antioxidant Concentrate"]: 'Earth Sourced Berry',
  // Glow Recipe — existing entries
  ['Glow Recipe|Watermelon Glow Niacinamide Dew Drops']: 'Watermelon Glow Dew Drops',
  ['Glow Recipe|Plum Plump Hyaluronic Serum']: 'Plum Plump Serum',
  ['Glow Recipe|Glow Recipe Strawberry BHA Pore-Smooth Blur Drops']: 'Strawberry Blur Drops',
  ['Glow Recipe|Avocado Melt Retinol Eye Sleeping Mask']: 'Avocado Melt Eye Mask',
  ['Glow Recipe|Banana Soufflé Moisture Cream']: 'Banana Soufflé',
  ['Glow Recipe|Watermelon Glow Sleeping Mask']: 'Watermelon Sleeping Mask',
  // Tatcha — existing entries
  ['Tatcha|The Dewy Skin Cream']: 'Dewy Skin Cream',
  ['Tatcha|The Water Cream']: 'Water Cream',
  ['Tatcha|The Rice Wash']: 'Rice Wash',
  ['Tatcha|The Deep Cleanse']: 'Deep Cleanse',
  ['Tatcha|Violet-C Brightening Serum 20% Vitamin C + 10% AHA']: 'Violet-C',
  ['Tatcha|The Silk Cream']: 'Silk Cream',
  ['Tatcha|The Renewal Oil']: 'Renewal Oil',
  ['Tatcha|The Pearl Tinted Eye Illuminating Treatment']: 'The Pearl',
  ['Tatcha|The Liquid Silk Canvas']: 'Liquid Silk Canvas',
  ['Tatcha|The Indigo Cream']: 'Indigo Cream',
  ['Tatcha|Luminous Dewy Skin Mist']: 'Dewy Skin Mist',
  ['Tatcha|The Essence']: 'The Essence',
  ['Tatcha|Camellia Beauty Oil']: 'Camellia Oil',
  ['Tatcha|The Kissu Lip Mask']: 'Kissu Lip Mask',
  ['Tatcha|The Texture Tonic']: 'Texture Tonic',
  // Anua — existing entries
  ['Anua|Heartleaf 77% Soothing Toner']: 'Heartleaf 77 Toner',
  ['Anua|Heartleaf Pore Control Cleansing Oil']: 'Heartleaf Cleansing Oil',
  ['Anua|Niacinamide 10% + TXA 4% Serum']: 'Niacinamide 10 + TXA',
  ['Anua|Birch 70 Moisture Vegan Cream']: 'Birch 70 Cream',
  ['Anua|Heartleaf Quercetinol Pore Deep Cleansing Foam']: 'Heartleaf Cleansing Foam',
  ['Anua|Heartleaf Soothing Toner Pads']: 'Heartleaf Toner Pads',
  ['Anua|Heartleaf 80 Soothing Ampoule']: 'Heartleaf 80 Ampoule',
  ['Anua|Peach 70% Niacinamide Serum']: 'Peach 70 Serum',
  // Skin1004 — existing entries
  ['Skin1004|Madagascar Centella Asiatica 100 Toning Toner']: 'Centella Toning Toner',
  ['Skin1004|Madagascar Centella Hyalu-Cica Water-Fit Sun Serum SPF 50+ PA++++']: 'Hyalu-Cica Sun Serum',
  // Round Lab — existing entries
  ['Round Lab|1025 Dokdo Toner']: '1025 Dokdo Toner',
  ['Round Lab|Birch Juice Moisturizing Sunscreen SPF 50+ PA++++']: 'Birch Juice Sunscreen',
  ['Round Lab|Mugwort Calming Magic Stick']: 'Mugwort Magic Stick',
  ['Round Lab|Mugwort Calming Cream']: 'Mugwort Cream',
  ['Round Lab|Soybean Nourishing Cleanser']: 'Soybean Cleanser',
  ['Round Lab|1025 Dokdo Cream']: '1025 Dokdo Cream',
  ['Round Lab|Birch Juice Moisturizing Cream']: 'Birch Juice Cream',
  ['Round Lab|365 Derma Relief Cream']: 'Derma Relief Cream',
  // Laneige — existing entries
  ['Laneige|Lip Sleeping Mask']: 'Lip Sleeping Mask',
  ['Laneige|Water Bank Hyaluronic Cream']: 'Water Bank Cream',
  ['Laneige|Cream Skin Refiner']: 'Cream Skin Refiner',
  ['Laneige|Cream Skin Toner & Moisturizer']: 'Cream Skin',
  ['Laneige|Bouncy & Firm Sleeping Mask']: 'Bouncy & Firm',
  ['Laneige|Radian-C Cream']: 'Radian-C Cream',
  ['Laneige|Cica Sleeping Mask']: 'Cica Sleeping Mask',
  ['Laneige|Water Sleeping Mask']: 'Water Sleeping Mask',
  // AESTURA — existing entries
  ['AESTURA|Atobarrier 365 Cream']: 'Atobarrier 365 Cream',
  ['AESTURA|A-Cica 365 Calming Cream']: 'A-Cica 365 Cream',
  ['AESTURA|Atobarrier 365 Hydro Essence']: 'Atobarrier 365 Essence',
  ['AESTURA|Atobarrier 365 Cream Mist']: 'Atobarrier 365 Mist',
  ['AESTURA|A-Cica Intensive Spot Calming Pad']: 'A-Cica Spot Pad',
  ['AESTURA|A-Cica 365 Calming Toner']: 'A-Cica 365 Toner',
  // Innisfree — existing entries
  ['Innisfree|Green Tea Seed Hyaluronic Serum']: 'Green Tea Seed Serum',
  ['Innisfree|Daily UV Defense Sunscreen Serum SPF 36 PA++++']: 'Daily UV Defense',
  ['Innisfree|Bija Trouble Skin Toner']: 'Bija Trouble Toner',
  ['Innisfree|Retinol Cica Repair Ampoule']: 'Retinol Cica Ampoule',
  ['Innisfree|My Real Squeeze Mask (Green Tea)']: 'Green Tea Mask',
  ['Innisfree|My Real Squeeze Mask (Bija)']: 'Bija Sheet Mask',
  // TIRTIR — existing entries
  ['TIRTIR|Mask Fit All Cover Cushion']: 'Mask Fit Cushion',
  ['TIRTIR|Mask Fit Red Cushion']: 'Mask Fit Red',
  ['TIRTIR|Ceramide Levels Up Cream']: 'Ceramide Cream',
  ['TIRTIR|Mad Mask']: 'Mad Mask',
  // Medicube — existing entries
  ['Medicube|Zero Pore Pad 2.0']: 'Zero Pore Pad',
  ['Medicube|Red Recovery Cream']: 'Red Recovery',
  ['Medicube|Collagen Niacinamide Overnight Wrapping Mask']: 'Collagen Wrapping Mask',
  ['Medicube|PDRN Pink One Day Exosome Shot']: 'PDRN Pink',
  ['Medicube|Madecassoside Pink Calming Mask']: 'Madecassoside Mask',
  ['Medicube|AGE-R Booster Pro Device']: 'AGE-R Booster',
  // Sulwhasoo — existing entries
  ['Sulwhasoo|First Care Activating Serum']: 'First Care',
  ['Sulwhasoo|First Care Activating Mask']: 'First Care Mask',
  ['Sulwhasoo|Concentrated Ginseng Renewing Cream']: 'Ginseng Cream',
  ['Sulwhasoo|Bibo Mask']: 'Bibo Mask',
  ['Sulwhasoo|Concentrated Ginseng Renewing Serum']: 'Ginseng Serum',
  ['Sulwhasoo|Snowise Brightening Serum']: 'Snowise',
  ['Sulwhasoo|Essential Comfort Balancing Water EX']: 'Essential Comfort Water',
  ['Sulwhasoo|Capsulized Ginseng Fortifying Serum']: 'Capsulized Ginseng',
  ['Sulwhasoo|Concentrated Ginseng Renewing Eye Cream EX']: 'Ginseng Eye',
  ['Sulwhasoo|Bichup Self-Generating Skin Essence']: 'Bichup Essence',
  ['Sulwhasoo|Timetreasure Invigorating Cream']: 'Timetreasure',
  ['Sulwhasoo|Timetreasure Invigorating Eye Cream']: 'Timetreasure Eye',
  ['Sulwhasoo|Hwahyun Cream']: 'Hwahyun',
  ['Sulwhasoo|Gentle Cleansing Foam EX']: 'Gentle Cleansing Foam',
  ['Sulwhasoo|UV Daily Fluid SPF 50+']: 'UV Daily Fluid',
  // Hada Labo — existing entries
  ['Hada Labo|Gokujyun Premium Hyaluronic Acid Lotion']: 'Gokujyun Premium',
  ['Hada Labo|Gokujyun Hyaluronic Acid Cream']: 'Gokujyun Cream',
  ['Hada Labo|Shirojyun Premium Whitening Lotion']: 'Shirojyun Premium',
  ['Hada Labo|Hada Labo Premium Hyaluronic Acid Lotion']: 'Premium Lotion',
  ['Hada Labo|Tamagohada Cleansing Oil']: 'Tamagohada Cleansing',
  // Shiseido — existing entries
  ['Shiseido|Ultimune Power Infusing Concentrate']: 'Ultimune',
  ['Shiseido|Essential Energy Hydrating Cream']: 'Essential Energy',
  ['Shiseido|Vital Perfection Uplifting and Firming Cream']: 'Vital Perfection',
  ['Shiseido|Benefiance Wrinkle Smoothing Cream']: 'Benefiance Cream',
  ['Shiseido|Future Solution LX Cleansing Foam']: 'Future Solution LX Foam',
  ['Shiseido|Future Solution LX Total Regenerating Cream']: 'Future Solution LX',
  ['Shiseido|White Lucent Brightening Day Emulsion SPF 50+']: 'White Lucent Day',
  // Torriden — existing entries
  ['Torriden|Dive-In Low Molecule Hyaluronic Acid Serum']: 'Dive-In Serum',
  ['Torriden|Balanceful Cica Serum']: 'Balanceful Cica',
  ['Torriden|Dive-In Low Molecule Hyaluronic Acid Cream']: 'Dive-In Cream',
  ['Torriden|Dive-In Sun Cream SPF 50+']: 'Dive-In Sun Cream',
  ['Torriden|Dive-In Sun Stick SPF 50+']: 'Dive-In Sun Stick',
  // Abib — existing entries
  ['Abib|Cicaluronic Toner Pad']: 'Cicaluronic Pad',
  ['Abib|Heartleaf Spot Pad']: 'Heartleaf Spot Pad',
  ['Abib|Mild Acidic pH Sheet Mask: Heartleaf Fit']: 'Heartleaf Mask',
  // La Roche-Posay — existing entries
  ['La Roche-Posay|Toleriane Double Repair Face Moisturizer SPF 30']: 'Toleriane Double Repair',
  ['La Roche-Posay|Anthelios Melt-In Milk Sunscreen SPF 60']: 'Anthelios Melt-In',
  ['La Roche-Posay|Effaclar Duo']: 'Effaclar Duo',
  ['La Roche-Posay|Effaclar Adapalene Gel 0.1%']: 'Effaclar Adapalene',
  ['La Roche-Posay|Effaclar Medicated Gel Cleanser']: 'Effaclar Cleanser',
  ['La Roche-Posay|Toleriane Hydrating Gentle Cleanser']: 'Toleriane Cleanser',
  ['La Roche-Posay|Lipikar Balm AP+M']: 'Lipikar AP+M',
  ['La Roche-Posay|Anthelios UVMune 400 Invisible Fluid SPF 50+']: 'Anthelios UVMune 400',
  ['La Roche-Posay|Mela B3 Serum']: 'Mela B3',
  ['La Roche-Posay|Cicaplast Baume B5+']: 'Cicaplast B5',
  ['La Roche-Posay|Pure Niacinamide 10 Serum']: 'Pure Niacinamide 10',
  // SkinCeuticals — existing entries
  ['SkinCeuticals|C E Ferulic']: 'C E Ferulic',
  ['SkinCeuticals|Phloretin CF']: 'Phloretin CF',
  ['SkinCeuticals|Triple Lipid Restore 2:4:2']: 'Triple Lipid Restore',
  ['SkinCeuticals|Hydrating B5 Gel']: 'Hydrating B5',
  ['SkinCeuticals|Resveratrol B E']: 'Resveratrol B E',
  ['SkinCeuticals|Discoloration Defense']: 'Discoloration Defense',
  ['SkinCeuticals|Silymarin CF']: 'Silymarin CF',
  ['SkinCeuticals|A.G.E. Interrupter']: 'A.G.E. Interrupter',
  ['SkinCeuticals|Physical Fusion UV Defense SPF 50']: 'Physical Fusion',
  ['SkinCeuticals|Retinol 0.3']: 'Retinol 0.3',
  // Dieux — existing entries
  ['Dieux|Instant Angel Hydrating Cleanser']: 'Instant Angel Cleanser',
  ['Dieux|Auracle Eye Gel']: 'Auracle',
  // Skinbetter Science — existing entries
  ['Skinbetter Science|Alpha Ret Overnight Cream']: 'AlphaRet',
  ['Skinbetter Science|Even Tone Correcting Serum']: 'Even Tone',
  ['Skinbetter Science|SunBetter Tone Smart SPF 75']: 'Sunbetter Tone Smart',
  // Aesop — existing entries (strips redundant "Aesop" prefix)
  ['Aesop|Aesop Parsley Seed Anti-Oxidant Eye Cream']: 'Parsley Seed Eye',
  ['Aesop|Aesop Parsley Seed Anti-Oxidant Serum']: 'Parsley Seed Serum',
  ['Aesop|Aesop Mandarin Facial Hydrating Cream']: 'Mandarin Hydrating',
  ['Aesop|Aesop Damascan Rose Facial Treatment']: 'Damascan Rose',
  ['Aesop|Aesop Fabulous Face Oil']: 'Fabulous Face Oil',
  ['Aesop|Aesop In Two Minds Facial Cleanser']: 'In Two Minds Cleanser',
  ['Aesop|Aesop Fabulous Face Cleanser']: 'Fabulous Cleanser',
  ['Aesop|Aesop Camellia Nut Facial Hydrating Cream']: 'Camellia Nut',
  ['Aesop|Aesop Lucent Facial Concentrate']: 'Lucent Concentrate',
  ['Aesop|Aesop Primrose Facial Cleansing Masque']: 'Primrose Masque',
  ['Aesop|Aesop B & Tea Balancing Toner']: 'B & Tea Toner',
  ['Aesop|Aesop Resurrection Aromatique Hand Balm']: 'Resurrection Balm',
  ['Aesop|Aesop Geranium Leaf Body Balm']: 'Geranium Balm',
  ['Aesop|Aesop Rind Concentrate Body Balm']: 'Rind Concentrate',
  // Rhode — existing
  ['Rhode|Peptide Glazing Fluid']: 'Peptide Glazing',
  ['Rhode|Pineapple Refresh']: 'Pineapple Refresh',
  ['Rhode|Barrier Restore Cream']: 'Barrier Restore',
  ['Rhode|Glazing Milk']: 'Glazing Milk',
  ['Rhode|Peptide Lip Treatment']: 'Peptide Lip',
  // Topicals — existing
  ['Topicals|Faded Brightening & Clearing Serum']: 'Faded',
  ['Topicals|Slick Salve Glossy Lip Balm']: 'Slick Salve',
  ['Topicals|Like Butter Hydrating Mask']: 'Like Butter Mask',
  ['Topicals|Faded Brightening Body Serum']: 'Faded Body',
  ['Topicals|High Roller Ingrown Hair Tonic']: 'High Roller',
  // Naturium — existing
  ['Naturium|Niacinamide Serum 12% Plus Zinc 2%']: 'Niacinamide 12 + Zinc',
  // Bioderma — existing
  ['Bioderma|Sensibio H2O Micellar Water']: 'Sensibio H2O',
  ['Bioderma|Hydrabio H2O Micellar Water']: 'Hydrabio H2O',
  ['Bioderma|Sebium Pore Refiner']: 'Sebium Pore',
  ['Bioderma|Photoderm Mineral SPF 50+']: 'Photoderm Mineral',
  ['Bioderma|Sensibio AR Anti-Redness Cream']: 'Sensibio AR',
  ['Bioderma|Atoderm Intensive Baume']: 'Atoderm Baume',
  ['Bioderma|Pigmentbio C-Concentrate Serum']: 'Pigmentbio C',
  ['Bioderma|Hydrabio Serum']: 'Hydrabio Serum',
  // Farmacy — existing
  ['Farmacy|Honey Halo Ultra-Hydrating Ceramide Moisturizer']: 'Honey Halo',
  ['Farmacy|Green Clean Makeup Removing Cleansing Balm']: 'Green Clean',
  ['Farmacy|Honeymoon Glow AHA Resurfacing Night Serum']: 'Honeymoon Glow',
  ['Farmacy|Daily Greens Oil-Free Gel Moisturizer']: 'Daily Greens',
  ['Farmacy|Filling Good Hyaluronic Acid + Peptide Serum']: 'Filling Good',
  // Summer Fridays — existing
  ['Summer Fridays|Jet Lag Mask']: 'Jet Lag',
  ['Summer Fridays|Cloud Dew Oil-Free Gel Cream']: 'Cloud Dew',
  ['Summer Fridays|Lip Butter Balm']: 'Lip Butter Balm',
  // Youth To The People — existing
  ['Youth To The People|Superfood Cleanser']: 'Superfood Cleanser',
  ['Youth To The People|Adaptogen Deep Moisture Cream']: 'Adaptogen Cream',
  ['Youth To The People|Triple Peptide + Cactus Oasis Serum']: 'Triple Peptide',
  ['Youth To The People|15% Vitamin C + Clean Caffeine Energy Serum']: '15% Vitamin C',
  ['Youth To The People|Mandelic Acid + Superfood Unity Exfoliant']: 'Mandelic Unity',
  // Byoma — existing
  ['Byoma|Moisturizing Gel Cream']: 'Moisturizing Gel',
  ['Byoma|Hydrating Serum']: 'Hydrating Serum',
  ['Byoma|Brightening Serum']: 'Brightening Serum',
  ['Byoma|Milky Oil Cleanser']: 'Milky Oil',
  // Dr. Jart+ — existing
  ['Dr. Jart+|Cicapair Tiger Grass Color Correcting Treatment SPF 30']: 'Cicapair Tiger Grass',
  ['Dr. Jart+|Ceramidin Cream']: 'Ceramidin',
  ['Dr. Jart+|Cicapair Re-cover SPF 35']: 'Cicapair Re-cover',
  ['Dr. Jart+|Dermask Water Jet Soothing Hydra Solution']: 'Dermask Water Jet',
  ['Dr. Jart+|V7 Toning Light Sun']: 'V7 Toning Light',
  // SK-II — existing
  ['SK-II|Facial Treatment Essence (Pitera)']: 'Pitera Essence',
  ['SK-II|GenOptics Aura Essence']: 'GenOptics Aura',
  ['SK-II|LXP Ultimate Revitalizing Cream']: 'LXP Revitalizing',
  ['SK-II|R.N.A. Power Radical New Age Cream']: 'R.N.A. Power',
  ['SK-II|Facial Treatment Mask']: 'Treatment Mask',
  // Caudalie — existing
  ['Caudalie|Beauty Elixir']: 'Beauty Elixir',
  ['Caudalie|Vinoperfect Brightening Glycolic Essence']: 'Vinoperfect Essence',
  ['Caudalie|Resveratrol-Lift Firming Cashmere Cream']: 'Resveratrol Cream',
  ['Caudalie|Vinosource-Hydra Moisturizing Sorbet']: 'Vinosource Sorbet',
  ['Caudalie|Premier Cru The Eye Cream']: 'Premier Cru Eye',
  ['Caudalie|Vinopure Salicylic Pore Minimizing Toner']: 'Vinopure Toner',
  // Avène — existing
  ['Avène|Tolerance Control Soothing Skin Recovery Cream']: 'Tolerance Control',
  ['Avène|Cicalfate+ Restorative Protective Cream']: 'Cicalfate+',
  ['Avène|Hydrance Aqua-Gel']: 'Hydrance Aqua',
  ['Avène|Solaire UV Mineral Multi-Defense Sunscreen Fluid SPF 50+']: 'Solaire UV Mineral',
  ['Avène|Cleanance Comedomed Anti-Blemish Concentrate']: 'Cleanance Comedomed',
  ['Avène|A-Oxitive Antioxidant Defense Serum']: 'A-Oxitive',
  // CeraVe — existing
  ['CeraVe|Hydrating Cleanser']: 'Hydrating Cleanser',
  ['CeraVe|Foaming Facial Cleanser']: 'Foaming Cleanser',
  ['CeraVe|Moisturizing Cream']: 'Moisturizing Cream',
  ['CeraVe|AM Facial Moisturizing Lotion SPF 30']: 'AM Lotion SPF 30',
  ['CeraVe|Resurfacing Retinol Serum']: 'Resurfacing Retinol',
  ['CeraVe|PM Facial Moisturizing Lotion']: 'PM Lotion',
  ['CeraVe|SA Smoothing Cleanser']: 'SA Cleanser',
  ['CeraVe|SA Cream']: 'SA Cream',
  ['CeraVe|Skin Renewing Vitamin C Serum']: 'Vit C Serum',
  ['CeraVe|Eye Repair Cream']: 'Eye Repair',
  ['CeraVe|Hyaluronic Acid Serum']: 'HA Serum',
  ['CeraVe|Renewing SA Cleanser']: 'Renewing SA Cleanser',
};

// Escape regex special chars in a string for use inside a RegExp.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let src = fs.readFileSync(FILE, 'utf8');
let applied = 0;
let skipped = 0;
let notFound = 0;

for (const key of Object.keys(MAP)) {
  const [brand, name] = key.split('|');
  const display = MAP[key];
  // Match: { name: 'X', brand: 'Y'
  // Insert displayName immediately after the name field.
  // Brand may use a backslash-escaped apostrophe (Paula\'s Choice) — be permissive.
  const namePart = escapeRegex(name);
  // Brand may appear with backslash-escaped apostrophe in source
  // (Paula\'s Choice). Build a regex that accepts either form.
  const brandPart = escapeRegex(brand).replace(/'/g, "\\\\?'");
  const pattern = new RegExp(
    `(\\{\\s*name:\\s*'${namePart}',\\s*)(?!displayName:)(brand:\\s*'${brandPart}')`,
    'g'
  );
  const before = src;
  src = src.replace(pattern, `$1displayName: '${display}', $2`);
  if (src !== before) {
    applied++;
  } else {
    // Check if it already had a displayName (idempotent skip)
    const probe = new RegExp(`name:\\s*'${namePart}',\\s*displayName:`);
    if (probe.test(src)) { skipped++; }
    else { notFound++; console.warn('Not found:', brand, '|', name); }
  }
}

fs.writeFileSync(FILE, src);
console.log(`Applied: ${applied} · Already had displayName: ${skipped} · Not found: ${notFound}`);
