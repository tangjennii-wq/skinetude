// Mark hero (top-5) products per brand so search/recommender sort them first.
// Source: Jenni's curated lists from May 2026 audit conversation — the first
// 5 entries per brand were her must-show-first picks. For brands without an
// explicit curated list (Drunk Elephant, Paula's Choice, Maelove, etc.),
// pick the most-recognized SKUs as hero.
//
// Adds `hero: true` to each matching product entry. Idempotent — re-running
// is a no-op for entries already flagged.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'products.js');

// (brand | name) → true means hero. Names use the exact `name:` field text
// from products.js. Order within a brand follows Jenni's curated list.
const HEROES = [
  // Sunday Riley
  ['Sunday Riley', 'Good Genes All-In-One Lactic Acid Treatment'],
  ['Sunday Riley', 'Luna Sleeping Night Oil'],
  ['Sunday Riley', 'C.E.O. 15% Vitamin C Brightening Serum'],
  ['Sunday Riley', 'Auto Correct Brightening and Depuffing Eye Cream'],
  ['Sunday Riley', 'Ceramic Slip Cleanser'],
  // COSRX
  ['COSRX', 'Advanced Snail 96 Mucin Power Essence'],
  ['COSRX', 'Low pH Good Morning Gel Cleanser'],
  ['COSRX', 'Acne Pimple Master Patch'],
  ['COSRX', 'Advanced Snail 92 All In One Cream'],
  ['COSRX', 'BHA Blackhead Power Liquid'],
  // Paula's Choice (I curate top 5 since list was extended)
  ["Paula's Choice", 'Skin Perfecting 2% BHA Liquid Exfoliant'],
  ["Paula's Choice", '10% Niacinamide Booster'],
  ["Paula's Choice", 'C15 Super Booster'],
  ["Paula's Choice", 'Clinical 1% Retinol Treatment'],
  ["Paula's Choice", 'Pro-Collagen Multi-Peptide Booster'],
  // Beauty of Joseon
  ['Beauty of Joseon', 'Relief Sun: Rice + Probiotics SPF 50+ PA++++'],
  ['Beauty of Joseon', 'Glow Serum: Propolis + Niacinamide'],
  ['Beauty of Joseon', 'Revive Eye Serum: Ginseng + Retinal'],
  ['Beauty of Joseon', 'Dynasty Cream'],
  ['Beauty of Joseon', 'Glow Deep Serum: Rice + Alpha-Arbutin'],
  // Glow Recipe
  ['Glow Recipe', 'Watermelon Glow Niacinamide Dew Drops'],
  ['Glow Recipe', 'Watermelon Glow PHA + BHA Pore-Tight Toner'],
  ['Glow Recipe', 'Watermelon Glow Sleeping Mask'],
  ['Glow Recipe', 'Avocado Ceramide Recovery Serum'],
  ['Glow Recipe', 'Plum Plump Hyaluronic Cream'],
  // Tatcha
  ['Tatcha', 'The Dewy Skin Cream'],
  ['Tatcha', 'The Water Cream'],
  ['Tatcha', 'The Rice Wash'],
  ['Tatcha', 'The Essence'],
  ['Tatcha', 'The Dewy Serum'],
  // Anua
  ['Anua', 'Heartleaf 77% Soothing Toner'],
  ['Anua', 'Heartleaf Pore Control Cleansing Oil'],
  ['Anua', 'Niacinamide 10% + TXA 4% Serum'],
  ['Anua', 'Heartleaf Quercetinol Pore Deep Cleansing Foam'],
  ['Anua', 'Peach 70% Niacinamide Serum'],
  // Skin1004
  ['Skin1004', 'Madagascar Centella Ampoule'],
  ['Skin1004', 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum SPF 50+ PA++++'],
  ['Skin1004', 'Madagascar Centella Light Cleansing Oil'],
  ['Skin1004', 'Madagascar Centella Soothing Cream'],
  ['Skin1004', 'Madagascar Centella Asiatica 100 Toning Toner'],
  // Round Lab
  ['Round Lab', '1025 Dokdo Toner'],
  ['Round Lab', '1025 Dokdo Cleanser'],
  ['Round Lab', 'Birch Juice Moisturizing Sunscreen SPF 50+ PA++++'],
  ['Round Lab', 'Birch Juice Moisturizing Cream'],
  ['Round Lab', 'Birch Juice Moisturizing Toner'],
  // Laneige
  ['Laneige', 'Lip Sleeping Mask'],
  ['Laneige', 'Water Sleeping Mask'],
  ['Laneige', 'Cream Skin Toner & Moisturizer'],
  ['Laneige', 'Water Bank Blue Hyaluronic Cream Moisturizer'],
  ['Laneige', 'Glowy Makeup Serum'],
  // AESTURA
  ['AESTURA', 'Atobarrier 365 Cream'],
  ['AESTURA', 'Atobarrier 365 Lotion'],
  ['AESTURA', 'Atobarrier 365 Hydro Essence'],
  ['AESTURA', 'Atobarrier 365 Bubble Cleanser'],
  ['AESTURA', 'Atobarrier 365 Ceramide Cream Mist'],
  // Innisfree
  ['Innisfree', 'Green Tea Seed Hyaluronic Serum'],
  ['Innisfree', 'Volcanic Pore Clay Mask'],
  ['Innisfree', 'Daily UV Defense Sunscreen Serum SPF 36 PA++++'],
  ['Innisfree', 'Cherry Blossom Glow Jelly Cream'],
  ['Innisfree', 'Retinol Cica Repair Ampoule'],
  // TIRTIR
  ['TIRTIR', 'Milk Skin Toner'],
  ['TIRTIR', 'Mask Fit Red Cushion Foundation'],
  ['TIRTIR', 'Ceramic Milk Ampoule'],
  ['TIRTIR', 'SOS Serum'],
  ['TIRTIR', 'Collagen Lifting Eye Cream'],
  // Medicube
  ['Medicube', 'Zero Pore Pad 2.0'],
  ['Medicube', 'Collagen Niacinamide Overnight Wrapping Mask'],
  ['Medicube', 'AGE-R Booster Pro Device'],
  ['Medicube', 'Deep Vita C Capsule Cream'],
  ['Medicube', 'PDRN Pink One Day Exosome Shot'],
  // Sulwhasoo
  ['Sulwhasoo', 'First Care Activating Serum'],
  ['Sulwhasoo', 'Concentrated Ginseng Renewing Cream'],
  ['Sulwhasoo', 'Essential Comfort Balancing Water EX'],
  ['Sulwhasoo', 'Essential Comfort Balancing Emulsion'],
  ['Sulwhasoo', 'Gentle Cleansing Oil'],
  // Hada Labo
  ['Hada Labo', 'Gokujyun Premium Hyaluronic Acid Lotion'],
  ['Hada Labo', 'Gokujyun Foaming Cleanser'],
  ['Hada Labo', 'Gokujyun Premium Milk'],
  ['Hada Labo', 'Shirojyun Premium Whitening Lotion'],
  ['Hada Labo', 'Gokujyun Perfect Gel'],
  // Shiseido
  ['Shiseido', 'Ultimune Power Infusing Concentrate'],
  ['Shiseido', 'Benefiance Wrinkle Smoothing Cream'],
  ['Shiseido', 'Essential Energy Hydrating Cream'],
  ['Shiseido', 'Clarifying Cleansing Foam'],
  ['Shiseido', 'Vital Perfection Uplifting and Firming Cream'],
  // Torriden
  ['Torriden', 'Dive-In Low Molecule Hyaluronic Acid Serum'],
  ['Torriden', 'Dive-In Soothing Cream'],
  ['Torriden', 'Dive-In Cleansing Foam'],
  ['Torriden', 'Dive-In Sun Cream SPF 50+'],
  ['Torriden', 'Dive-In Toner'],
  // Abib
  ['Abib', 'Heartleaf Spot Pad'],
  ['Abib', 'Heartleaf Essence Calming Pump'],
  ['Abib', 'Jericho Rose Creme Nutrition Tube'],
  ['Abib', 'Sedum Hyaluron Sunscreen Protection Tube SPF 50+ PA++++'],
  ['Abib', 'Rice Probiotics Overnight Mask Barrier Jelly'],
  // Dr. Althea
  ['Dr. Althea', '345 Relief Cream'],
  ['Dr. Althea', '147 HA Boosting Serum'],
  ['Dr. Althea', 'Vita C 19 Spot Eraser Serum'],
  ['Dr. Althea', 'Lipidure Concentrate Booster'],
  ['Dr. Althea', '35.5 Mineral Sun Stick SPF 50+ PA++++'],
  // La Roche-Posay
  ['La Roche-Posay', 'Cicaplast Baume B5+'],
  ['La Roche-Posay', 'Toleriane Double Repair Face Moisturizer SPF 30'],
  ['La Roche-Posay', 'Anthelios Melt-In Milk Sunscreen SPF 60'],
  ['La Roche-Posay', 'Effaclar Duo'],
  ['La Roche-Posay', 'Lipikar Balm AP+M'],
  // SkinCeuticals
  ['SkinCeuticals', 'C E Ferulic'],
  ['SkinCeuticals', 'Triple Lipid Restore 2:4:2'],
  ['SkinCeuticals', 'Phloretin CF'],
  ['SkinCeuticals', 'Blemish + Age Defense'],
  ['SkinCeuticals', 'Discoloration Defense'],
  // Dieux
  ['Dieux', 'Instant Angel Lipid-Rich Barrier Cream'],
  ['Dieux', 'Deliverance Antioxidant & Niacinamide Serum'],
  ['Dieux', 'Air Angel Gel Cream'],
  ['Dieux', 'Auracle Eye Gel'],
  ['Dieux', 'Forever Eye Mask'],
  // Skinbetter Science
  ['Skinbetter Science', 'Alpha Ret Overnight Cream'],
  ['Skinbetter Science', 'Alto Advanced Defense and Repair Serum'],
  ['Skinbetter Science', 'Even Tone Correcting Serum'],
  ['Skinbetter Science', 'Mystro Active Balance Serum'],
  ['Skinbetter Science', 'Trio Luxe Moisture Treatment'],
  // Aesop
  ['Aesop', 'Aesop Parsley Seed Anti-Oxidant Serum'],
  ['Aesop', 'Aesop Camellia Nut Facial Hydrating Cream'],
  ['Aesop', 'B Triple C Facial Balancing Gel'],
  ['Aesop', 'Aesop Lucent Facial Concentrate'],
  ['Aesop', 'Amazing Face Cleanser'],
  // Rhode
  ['Rhode', 'Peptide Glazing Fluid'],
  ['Rhode', 'Barrier Restore Cream'],
  ['Rhode', 'Peptide Lip Treatment'],
  ['Rhode', 'Pineapple Refresh Cleanser'],
  ['Rhode', 'Glazing Milk'],
  // Topicals
  ['Topicals', 'Faded Brightening & Clearing Serum'],
  ['Topicals', 'Like Butter Moisturizer'],
  ['Topicals', 'Slick Salve Lip Balm'],
  ['Topicals', 'Sealed Active Scar Filling Primer'],
  ['Topicals', 'Slather Exfoliating Body Serum'],
  // Naturium
  ['Naturium', 'Niacinamide Serum 12% Plus Zinc 2%'],
  ['Naturium', 'Azelaic Topical Acid 10%'],
  ['Naturium', 'Vitamin C Complex Serum'],
  ['Naturium', 'Multi-Peptide Moisturizer'],
  ['Naturium', 'Retinaldehyde Cream Serum'],
  // Bioderma
  ['Bioderma', 'Sensibio H2O Micellar Water'],
  ['Bioderma', 'Atoderm Shower Oil'],
  ['Bioderma', 'Sensibio Defensive Serum'],
  ['Bioderma', 'Atoderm Intensive Baume'],
  ['Bioderma', 'Sebium Foaming Gel'],
  // Farmacy
  ['Farmacy', 'Green Clean Makeup Removing Cleansing Balm'],
  ['Farmacy', 'Honey Halo Ultra-Hydrating Ceramide Moisturizer'],
  ['Farmacy', 'Honey Potion Plus Ceramide Hydration Mask'],
  ['Farmacy', 'Deep Sweep 2% BHA Pore Cleaning Toner'],
  ['Farmacy', 'Brighten Up 3% TXA Toner'],
  // Summer Fridays
  ['Summer Fridays', 'Jet Lag Mask'],
  ['Summer Fridays', 'Lip Butter Balm'],
  ['Summer Fridays', 'Cloud Dew Oil-Free Gel Cream'],
  ['Summer Fridays', 'CC Me Vitamin C Serum'],
  ['Summer Fridays', 'Super Amino Gel Cleanser'],
  // Youth To The People
  ['Youth To The People', 'Superfood Cleanser'],
  ['Youth To The People', 'Adaptogen Deep Moisture Cream'],
  ['Youth To The People', '15% Vitamin C + Clean Caffeine Energy Serum'],
  ['Youth To The People', 'Retinal + Niacinamide Youth Serum'],
  ['Youth To The People', 'Superberry Hydrate + Glow Dream Mask'],
  // Byoma
  ['Byoma', 'Moisturizing Rich Cream'],
  ['Byoma', 'Hydrating Serum'],
  ['Byoma', 'Creamy Jelly Cleanser'],
  ['Byoma', 'Balancing Face Mist'],
  ['Byoma', 'Brightening Serum'],
  // SK-II
  ['SK-II', 'Facial Treatment Essence (Pitera)'],
  ['SK-II', 'Skinpower Advanced Cream'],
  ['SK-II', 'Facial Treatment Clear Lotion'],
  ['SK-II', 'GenOptics Ultraura Essence Serum'],
  ['SK-II', 'Skinpower Eye Cream'],
  // Caudalie
  ['Caudalie', 'Vinoperfect Radiance Serum'],
  ['Caudalie', 'Beauty Elixir'],
  ['Caudalie', 'Premier Cru The Cream'],
  ['Caudalie', 'Vinosource-Hydra SOS Intense Moisturizing Cream'],
  ['Caudalie', 'Instant Detox Mask'],
  // Avène
  ['Avène', 'Cicalfate+ Restorative Protective Cream'],
  ['Avène', 'Eau Thermale Spring Water Spray'],
  ['Avène', 'Tolerance Control Soothing Skin Recovery Cream'],
  ['Avène', 'Cleanance Cleansing Gel'],
  ['Avène', 'Hydrance Aqua-Gel'],
  // CeraVe
  ['CeraVe', 'Moisturizing Cream'],
  ['CeraVe', 'Hydrating Cleanser'],
  ['CeraVe', 'PM Facial Moisturizing Lotion'],
  ['CeraVe', 'SA Smoothing Cleanser'],
  ['CeraVe', 'SA Cream'],
  // Dr. Jart+
  ['Dr. Jart+', 'Cicapair Tiger Grass Color Correcting Treatment SPF 30'],
  ['Dr. Jart+', 'Ceramidin Cream'],
  ['Dr. Jart+', 'Cryo Rubber Face Mask'],
  ['Dr. Jart+', 'Cicapair Serum'],
  ['Dr. Jart+', 'Ceramidin Liquid'],
  // Prequel
  ['Prequel', 'Gleanser Non-Drying Glycerin Cleanser'],
  ['Prequel', 'Barrier Therapy Cream'],
  ['Prequel', 'Lucent-C Brightening Vitamin C Serum'],
  ['Prequel', 'Redness Reform Soothing Serum'],
  ['Prequel', 'Universal Skin Solution Spray'],
  // Obagi
  ['Obagi', 'Professional-C Serum 20%'],
  ['Obagi', 'Nu-Derm Gentle Cleanser'],
  ['Obagi', 'Daily Hydro-Drops'],
  ['Obagi', 'Retinol 1.0'],
  ['Obagi', 'Hydrate Luxe Moisture-Rich Cream'],
  // iS Clinical
  ['iS Clinical', 'Active Serum'],
  ['iS Clinical', 'Cleansing Complex'],
  ['iS Clinical', 'Pro-Heal Serum Advance+'],
  ['iS Clinical', 'Youth Intensive Creme'],
  ['iS Clinical', 'Eclipse SPF 50+'],
  // Alastin
  ['Alastin', 'Restorative Skin Complex'],
  ['Alastin', 'Regenerating Skin Nectar'],
  ['Alastin', 'HydraTint Pro Mineral Broad Spectrum Sunscreen SPF 36'],
  ['Alastin', 'Ultra Nourishing Moisturizer'],
  ['Alastin', 'A-Luminate Brightening Serum'],
  // EltaMD
  ['EltaMD', 'UV Clear Broad-Spectrum SPF 46'],
  ['EltaMD', 'UV Daily SPF 40'],
  ['EltaMD', 'UV Sport SPF 50'],
  ['EltaMD', 'Skin Recovery Serum'],
  ['EltaMD', 'Barrier Renewal Complex'],
  // Augustinus Bader
  ['Augustinus Bader', 'The Rich Cream'],
  ['Augustinus Bader', 'The Cream'],
  ['Augustinus Bader', 'The Serum'],
  ['Augustinus Bader', 'The Eye Cream'],
  ['Augustinus Bader', 'The Face Oil'],
  // Tata Harper
  ['Tata Harper', 'Resurfacing Mask'],
  ['Tata Harper', 'Regenerating Cleanser'],
  ['Tata Harper', 'Water-Lock Moisturizer'],
  ['Tata Harper', 'Clarifying Cleanser'],
  ['Tata Harper', 'Crème Riche'],
  // e.l.f. SKIN
  ['e.l.f. SKIN', 'Holy Hydration! Face Cream'],
  ['e.l.f. SKIN', 'Holy Hydration! Cleansing Balm'],
  ['e.l.f. SKIN', 'Pure Skin Cleanser'],
  ['e.l.f. SKIN', 'Holy Hydration! Eye Cream'],
  ['e.l.f. SKIN', 'Blemish Breakthrough Acne Calming Water Cream'],
  // Bubble
  ['Bubble', 'Slam Dunk Hydrating Moisturizer'],
  ['Bubble', 'Fresh Start Gel Cleanser'],
  ['Bubble', 'Cloud Surf Water Cream Moisturizer'],
  ['Bubble', 'Level Up Balancing Moisturizer'],
  ['Bubble', 'Day Dream Vitamin C + Niacinamide Serum'],
  // The Inkey List
  ['The Inkey List', 'Oat Cleansing Balm'],
  ['The Inkey List', 'Hyaluronic Acid Serum'],
  ['The Inkey List', 'Omega Water Cream'],
  ['The Inkey List', 'Retinol Serum'],
  ['The Inkey List', 'Niacinamide Serum'],
  // Versed
  ['Versed', 'Dew Point Moisturizing Gel-Cream'],
  ['Versed', 'Stroke of Brilliance Brightening Serum'],
  ['Versed', 'Weekend Glow Daily Brightening Solution'],
  ['Versed', 'Press Restart Gentle Retinol Serum'],
  ['Versed', 'Wash It Out Gel Cleanser'],
  // Neutrogena
  ['Neutrogena', 'Hydro Boost Water Gel'],
  ['Neutrogena', 'Ultra Sheer Dry-Touch Sunscreen SPF 55'],
  ['Neutrogena', 'Hydro Boost Hyaluronic Acid Serum'],
  ['Neutrogena', 'Oil-Free Acne Wash'],
  ['Neutrogena', 'Rapid Wrinkle Repair Retinol Cream'],
  // Cetaphil
  ['Cetaphil', 'Gentle Skin Cleanser'],
  ['Cetaphil', 'Moisturizing Cream'],
  ['Cetaphil', 'Daily Facial Cleanser'],
  ['Cetaphil', 'Rich Hydrating Cream'],
  ['Cetaphil', 'Daily Oil-Free Hydrating Lotion'],
  // Vanicream
  ['Vanicream', 'Vanicream Moisturizing Cream'],
  ['Vanicream', 'Gentle Facial Cleanser'],
  ['Vanicream', 'Daily Facial Moisturizer'],
  ['Vanicream', 'Vanicream Moisturizing Lotion'],
  ['Vanicream', 'Vanicream Vitamin C Serum'],
  // Differin
  ['Differin', 'Differin Gel Adapalene 0.1%'],
  ['Differin', 'Daily Deep Cleanser'],
  ['Differin', 'Resurfacing Scar Gel'],
  ['Differin', 'Oil Absorbing Moisturizer SPF 30'],
  ['Differin', 'Differin Gentle Cleanser'],
  // Eucerin
  ['Eucerin', 'Advanced Repair Cream'],
  ['Eucerin', 'Original Healing Cream'],
  ['Eucerin', 'Sun Age Defense SPF 50'],
  ['Eucerin', 'Q10 Anti-Wrinkle Face Cream'],
  ['Eucerin', 'Eucerin Hydrating Cleansing Gel'],
  // Fresh
  ['Fresh', 'Soy Face Cleanser'],
  ['Fresh', 'Rose Deep Hydration Face Cream'],
  ['Fresh', 'Kombucha Facial Treatment Essence'],
  ['Fresh', 'Sugar Lip Treatment'],
  ['Fresh', 'Black Tea Advanced Age Renewal Cream'],
  // Murad
  ['Murad', 'Rapid Dark Spot Correcting Serum'],
  ['Murad', 'Essential-C Cleanser'],
  ['Murad', 'Retinal ReSculpt Overnight Treatment'],
  ['Murad', 'Clarifying Cleanser'],
  ['Murad', 'Nutrient-Charged Water Gel'],
  // Biossance
  ['Biossance', 'Squalane + Omega Repair Cream'],
  ['Biossance', 'Squalane + Vitamin C Rose Oil'],
  ['Biossance', 'Squalane + Copper Peptide Rapid Plumping Serum'],
  ['Biossance', 'Squalane + Amino Aloe Gentle Cleanser'],
  ['Biossance', 'Squalane + Marine Algae Eye Cream'],
  // Olehenriksen
  ['Olehenriksen', 'Banana Bright Vitamin C Serum'],
  ['Olehenriksen', 'Truth Serum'],
  ['Olehenriksen', 'Strength Trainer Peptide Boost Moisturizer'],
  ['Olehenriksen', 'Banana Bright Eye Crème'],
  ['Olehenriksen', 'Pout Preserve Peptide Lip Treatment'],
  // Peace Out
  ['Peace Out', 'Acne Healing Dots'],
  ['Peace Out', 'Retinol Eye Stick'],
  ['Peace Out', 'Pore Perfecting Strips'],
  ['Peace Out', 'Dark Spots Brightening Dots'],
  ['Peace Out', 'Acne Serum'],
  // Kiehl's
  ["Kiehl's", 'Ultra Facial Cream'],
  ["Kiehl's", 'Creamy Eye Treatment with Avocado'],
  ["Kiehl's", 'Calendula Herbal Extract Toner'],
  ["Kiehl's", 'Midnight Recovery Concentrate'],
  ["Kiehl's", 'Ultra Facial Cleanser'],
  // First Aid Beauty
  ['First Aid Beauty', 'Ultra Repair Cream'],
  ['First Aid Beauty', 'KP Bump Eraser Body Scrub'],
  ['First Aid Beauty', 'Pure Skin Face Cleanser'],
  ['First Aid Beauty', 'Facial Radiance Pads'],
  ['First Aid Beauty', 'Ultra Repair Hydrating Serum'],
  // Belif
  ['Belif', 'The True Cream Aqua Bomb'],
  ['Belif', 'The True Cream Moisturizing Bomb'],
  ['Belif', 'Aqua Bomb Hydrating Toner'],
  ['Belif', 'Creamy Cleansing Foam Moist'],
  ['Belif', 'Hungarian Water Essence'],
  // Peach & Lily
  ['Peach & Lily', 'Glass Skin Refining Serum'],
  ['Peach & Lily', 'Matcha Pudding Antioxidant Cream'],
  ['Peach & Lily', 'Power Calm Hydrating Gel Cleanser'],
  ['Peach & Lily', 'Copper Peptide Pro Firming Serum'],
  ['Peach & Lily', 'Super Reboot Resurfacing Mask'],
  // Drunk Elephant — curated by recognition
  ['Drunk Elephant', 'Protini Polypeptide Cream'],
  ['Drunk Elephant', 'C-Firma Fresh Day Serum'],
  ['Drunk Elephant', 'T.L.C. Sukari Babyfacial'],
  ['Drunk Elephant', 'B-Hydra Intensive Hydration Serum'],
  ['Drunk Elephant', 'Lala Retro Whipped Cream'],
  // Maelove
  ['Maelove', 'The Glow Maker Vitamin C Serum'],
  ['Maelove', 'NIA 10 Soothing Niacinamide Serum'],
  ['Maelove', 'Moonlight Retinal Serum'],
  ['Maelove', 'Sun Sirenade Mineral Sunscreen SPF 35'],
  ['Maelove', 'The Real Deal Hydrating Moisturizer'],
  // Skinfix
  ['Skinfix', 'Barrier+ Triple Lipid-Peptide Cream'],
  ['Skinfix', 'Barrier+ Triple Lipid-Peptide Serum Concentrate'],
  ['Skinfix', 'Eczema+ Foaming Oil Body Wash'],
  ['Skinfix', 'Resurface+ Glycolic Lactic Toner'],
  ['Skinfix', 'Foaming Clay Cleanser'],
  // Lyma
  ['Lyma', 'The Lyma Cream'],
  ['Lyma', 'The Lyma Serum'],
  ['Lyma', 'Lyma Laser PRO'],
  // Dr. Idriss
  ['Dr. Idriss', 'Major Fade Hyper Serum'],
  ['Dr. Idriss', 'Major Fade Active Pads'],
  ['Dr. Idriss', 'Major Fade Sunscreen SPF 50'],
  ['Dr. Idriss', 'Mighty Mush Smoothie'],
  ['Dr. Idriss', 'Tickled Pink Eye Serum'],
  // Aquaphor
  ['Aquaphor', 'Aquaphor Healing Ointment'],
  ['Aquaphor', 'Aquaphor Lip Repair Stick'],
  ['Aquaphor', 'Aquaphor Lip Repair Ointment'],
  ['Aquaphor', 'Aquaphor Baby Healing Ointment'],
  // Experiment Beauty
  ['Experiment Beauty', 'Molecular Mesh Recovery Mask'],
  ['Experiment Beauty', 'Hi-Float Hydrating Glaze'],
  ['Experiment Beauty', 'Visible Glass Polypeptide Serum'],
  ['Experiment Beauty', 'Visible Glass Bouncy Cream'],
  // Shani Darden
  ['Shani Darden', 'Retinol Reform Treatment Serum'],
  ['Shani Darden', 'Texture Reform Gentle Resurfacing Serum'],
  ['Shani Darden', 'Triple Acid Signature Peel'],
  ['Shani Darden', 'Daily Defense Mineral Sunscreen SPF 30'],
  ['Shani Darden', 'Cleansing Serum'],
  // Clarins
  ['Clarins', 'Double Serum'],
  ['Clarins', 'Beauty Flash Balm'],
  ['Clarins', 'Hydra-Essentiel Cream'],
  ['Clarins', 'Total Eye Lift'],
  ['Clarins', 'Bright Plus Brightening Cream'],
  // Embryolisse
  ['Embryolisse', 'Lait-Crème Concentré'],
  ['Embryolisse', 'Hydra-Cica'],
  ['Embryolisse', 'Filaderme Emulsion'],
  ['Embryolisse', 'Embryolisse Cleansing Milk'],
  ['Embryolisse', 'Sensitive Cream'],
  // Vaseline
  ['Vaseline', 'Original Petroleum Jelly'],
  ['Vaseline', 'Intensive Care Advanced Repair Lotion'],
  ['Vaseline', 'Cocoa Radiant Body Lotion'],
  ['Vaseline', 'Lip Therapy Original Tin'],
  ['Vaseline', 'Lip Therapy Rosy Lips'],
  // Nivea
  ['Nivea', 'Nivea Creme'],
  ['Nivea', 'Soft Moisturizing Cream'],
  ['Nivea', 'Q10 Anti-Wrinkle Face Cream'],
  ['Nivea', 'Sensitive Soothing Cream'],
  ['Nivea', 'Lip Care Essential'],
  // Garnier
  ['Garnier', 'SkinActive Micellar Water Pink'],
  ['Garnier', 'SkinActive Micellar Water Blue Oil-Infused'],
  ['Garnier', 'SkinActive Micellar Water Green'],
  ['Garnier', 'Vitamin C Brightening Serum'],
  ['Garnier', 'Hyaluronic Acid Aloe Soothing Serum'],
  // Olay
  ['Olay', 'Regenerist Micro-Sculpting Cream'],
  ['Olay', 'Regenerist Retinol 24 Night Cream'],
  ['Olay', 'Regenerist Vitamin C + Peptide 24'],
  ['Olay', 'Total Effects 7-in-1 Anti-Aging Moisturizer'],
  ['Olay', 'Niacinamide + Hyaluronic Acid Cream'],
  // Vichy
  ['Vichy', 'Mineral 89 Hyaluronic Acid Serum'],
  ['Vichy', 'Mineral 89 Probiotic Fractions Repair Concentrate'],
  ['Vichy', 'LiftActiv Supreme Wrinkle Cream'],
  ['Vichy', 'LiftActiv Vitamin C Brightening Skin Corrector'],
  ['Vichy', 'Capital Soleil UV Age Daily SPF 60'],
  // VT Cosmetics
  ['VT Cosmetics', 'Reedle Shot 100'],
  ['VT Cosmetics', 'Reedle Shot 300'],
  ['VT Cosmetics', 'Reedle Shot 700'],
  ['VT Cosmetics', 'VT Cica Sleeping Mask'],
  ['VT Cosmetics', 'Cica Daily Soothing Mask'],
  // d'Alba
  ["d'Alba", 'White Truffle First Spray Serum'],
  ["d'Alba", 'White Truffle Eye Cream'],
  ["d'Alba", 'White Truffle Anti-Aging Cream'],
  ["d'Alba", 'White Truffle Pure Mist Serum'],
  ["d'Alba", 'White Truffle Cleansing Foam'],
  // Allies of Skin
  ['Allies of Skin', 'Peptides & Antioxidants Firming Daily Treatment'],
  ['Allies of Skin', '1A Retinal + Peptides Overnight Treatment'],
  ['Allies of Skin', 'Promise Keeper Acne Nighttime Pimple Patches'],
  ['Allies of Skin', 'Molecular Saviour Probiotics Toner'],
  ['Allies of Skin', 'Bright Future Glycolic Renewal Serum'],
  // Illiyoon
  ['Illiyoon', 'Ceramide Ato Concentrate Cream'],
  ['Illiyoon', 'Ceramide Ato Lotion'],
  ['Illiyoon', 'Hyaluronic Moisture Toner'],
  ['Illiyoon', 'Hyaluronic Moisture Lotion'],
  ['Illiyoon', 'Total Sunblock SPF 50'],
  // Biologique Recherche
  ['Biologique Recherche', 'Lotion P50 1970'],
  ['Biologique Recherche', 'Crème Masque Vernix'],
  ['Biologique Recherche', 'Sérum Reconstructeur'],
  ['Biologique Recherche', 'Crème Bio-Souyenance'],
  ['Biologique Recherche', 'Le Grand Sérum'],
  // Pond's
  ["Pond's", 'Cold Cream Cleanser'],
  ["Pond's", 'Dry Skin Cream'],
  ["Pond's", 'Rejuveness Anti-Wrinkle Cream'],
  ["Pond's", "Pond's Towelettes Original"],
  ["Pond's", 'Hydra Light Moisturizer'],
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let src = fs.readFileSync(FILE, 'utf8');
let applied = 0;
let skipped = 0;
let notFound = 0;

for (const [brand, name] of HEROES) {
  const namePart = escapeRegex(name);
  const brandPart = escapeRegex(brand).replace(/'/g, "\\\\?'");
  // Insert `hero: true, ` after `displayName: '...',` for the matching entry.
  // If displayName isn't there (older entry), insert after `name: '...',`.
  const withDisplayName = new RegExp(
    `(\\{\\s*name:\\s*'${namePart}',\\s*displayName:\\s*'[^']*',\\s*)(?!hero:)(brand:\\s*'${brandPart}')`
  );
  const withoutDisplayName = new RegExp(
    `(\\{\\s*name:\\s*'${namePart}',\\s*)(?!displayName:|hero:)(brand:\\s*'${brandPart}')`
  );
  const before = src;
  src = src.replace(withDisplayName, `$1hero: true, $2`);
  if (src === before) {
    src = src.replace(withoutDisplayName, `$1hero: true, $2`);
  }
  if (src !== before) {
    applied++;
  } else {
    // Check if already flagged
    const probe = new RegExp(`name:\\s*'${namePart}'[^}]*hero:\\s*true[^}]*brand:\\s*'${brandPart}'`);
    if (probe.test(src)) { skipped++; }
    else { notFound++; console.warn('Not found:', brand, '|', name); }
  }
}

fs.writeFileSync(FILE, src);
console.log(`Hero applied: ${applied} · Already hero: ${skipped} · Not found: ${notFound}`);
