# Recommendations — Spec

Scaffolding for Étude's "smart" / recommendations system. Covers when to surface a rec, which surface it lands on, and — most importantly — the voice that keeps recs sounding like two obsessed friends, not a dermatologist visit.

Read this before building or prompting any rec feature. Reference it in prompts.

---

## 0. North star

Recommendations exist to **fill real gaps** in a user's routine and **respond to real signal** from their photo log + AI rating. Not to upsell. Not to add steps for the sake of steps. Silence is a valid output.

Test for every rec: would Tang or Gainey actually text this to a friend who asked? If no, don't show it.

---

## 1. Voice & framing guardrails

Tang (nephrologist) and Gainey (gastroenterologist) are doctors. **Not dermatologists.** Friends-who-are-obsessed, not authority figures. Every word of rec copy has to hold this line — it's the easiest place to slip into clinical voice.

### Avoid — medical-coded

- "Clinically proven," "clinically tested," "dermatologist-recommended"
- "Treatment," "treat" (as verb), "therapy," "indicated for"
- "Diagnosis," "condition," "symptom" — use "what you're seeing," "what's showing up"
- "Prescribe," "prescription-strength," "Rx alternative"
- "Active ingredient" — just say "actives" or name it
- "Treatment regimen" — "regimen" alone is fine, "treatment regimen" is not
- "Mechanism of action" in user-facing copy — mechanism talk lives inside the AI worker, not the UI
- Stars, scores, "9.4 efficacy rating" — WebMD energy
- White coats, lab beakers, microscopes, anything that signals clinic
- "Rhythm," "ritual" — retired brand words

### Use — obsessed-friend coded

- "We'd try…" / "We've been reaching for…" / "Worth a look"
- "Here's why we'd swap" / "The thing you're missing"
- "If your skin is doing X, this usually helps"
- Name the ingredient + what it does in one breath: "ceramides — basically barrier glue"
- Tasting-notes language: "slick," "tacky," "weightless," "the one that doesn't pill under SPF"
- A little dark when it lands: "your barrier is cooked," "this one's a workhorse, not a vibe"
- Direct, warm, dry, brief. Cut every word that doesn't earn its space.

### Persona tagging

Every rec gets a persona for tone consistency:

- **Jenni** — warmer, more sensory, concern-first
- **Gainey** — drier, more mechanism-curious, "here's why this works"
- **Blend** — consensus pick; both would reach for it

Default to Blend unless the rec is clearly skewed.

### Catch-all test

If a copy reviewer reads a rec and pictures a doctor's office instead of a friend's bathroom shelf, it's wrong. Rewrite.

---

## 2. Job taxonomy

Products are tagged by **job** (function), not category (form). One product can hold multiple jobs.

### Core jobs

| Job | What it does | Slot | Required? |
|---|---|---|---|
| cleanse | removes the day | both | yes |
| hydrate | adds water (humectant) | both | yes |
| moisturize-seal | locks water in (occlusive/emollient) | both | yes |
| sun-protect | UV defense | AM | yes |
| barrier-repair | rebuilds lipid matrix | both | conditional |
| soothe | calms reactivity | both | conditional |
| exfoliate-chem | chemical turnover | PM (usually) | optional |
| exfoliate-phys | physical turnover | rare | optional |
| treat-retinoid | retinoid family | PM | optional |
| treat-vitC | vitamin C family | AM (usually) | optional |
| treat-niacinamide | niacinamide | both | optional |
| treat-peptide | peptides | both | optional |
| eye | eye area | both | optional |
| lip | lip care | both | optional |

### Complement jobs (different job, related slot)

| Complement | Sits next to | Trigger |
|---|---|---|
| tone-evening (tinted SPF) | sun-protect | user has SPF, no tinted option |
| makeup-replacement | sun-protect / moisturize-seal | user wants base-makeup alternative |
| barrier-cream (rich occlusive) | moisturize-seal | has lotion, flagged for repair phase |
| overnight-mask | moisturize-seal | has PM moisturizer, skin needs more |

Complements are NEVER `MISSING` recs. They surface only as `COMPLEMENT` state.

### Mechanism tags (Layer 2 vocabulary)

Each product on shelf gets tagged with mechanism families it delivers:

humectant · occlusive · emollient · ceramide-restorative · anti-inflammatory · antioxidant · exfoliant-AHA · exfoliant-BHA · exfoliant-PHA · retinoid · peptide · vitamin-C · niacinamide

A product can carry many. CeraVe AM = humectant + emollient + ceramide-restorative + sun-protect.

---

## 3. Coverage logic

### Layer 1 — Structural

For each required job in the user's AM and PM slots:

- Is there ≥1 product in **active Regimen** that delivers this job?
- Yes → covered
- No → `MISSING`

Active Regimen, not full shelf. A product sitting unused on shelf does NOT suppress a rec.

### Layer 2 — Concern fit

Pull this week's flagged concerns from AI rating ("What your skin needs"). For each flag:

- Map flag → mechanism family:
  - Calm → anti-inflammatory
  - Hydrate → humectant
  - Repair → ceramide-restorative
- Does active routine contain a product with that mechanism tag?
- Yes → covered for this concern
- No → `CONCERN_GAP`

---

## 4. Recommendation states

Priority, highest to lowest. Only the highest-priority state for a given slot shows on a given surface.

1. **SWAP_SUGGESTED** — AI worker flags an owned product as likely cause of a current concern. Rare. High bar: ≥2 weeks signal + photo log evidence + clear mechanism. Journal only.
2. **MISSING** — Layer 1 fail on a required job.
3. **CONCERN_GAP** — Layer 2 fail. Owned products cover form but not concern this week.
4. **COMPLEMENT** — Both layers pass. Different-job product would extend routine. Lowest priority.
5. **COVERED** — No rec. Silence.

---

## 5. Surface routing

| Surface | Shows | Max cards | Notes |
|---|---|---|---|
| Home | MISSING only | 1 | Only if glaring gap (no SPF, no cleanser). Stay quiet. |
| Regimen (empty slot) | MISSING for that slot's job | 1 per empty slot | Filled slot = no new-find rec there. |
| Journal | SWAP_SUGGESTED + CONCERN_GAP | 1–3 | Tied to this week's data. |
| Insights | CONCERN_GAP + COMPLEMENT | 3–5 | 30-day window. The analytical surface. |

The existing "suggest picks from your shelf" button on Regimen filled slots is the OTHER suggestion surface and stays separate. New-finds and shelf-picks never mix on the same card.

---

## 6. Decisions log

Settled. Don't re-litigate without strong reason.

- **Frequency-based jobs covered if owned at all.** Exfoliant used 2x/week counts as covered. No second exfoliant rec.
- **Multi-function products count for all their jobs.** Moisturizer-with-SPF covers sun-protect AND moisturize-seal. CAN trigger `COMPLEMENT` for dedicated SPF, never `MISSING`.
- **AM/PM are independent.** SPF only needs AM coverage. Retinoid only needs PM. Don't cross-slot.
- **Minimalist suppression.** Onboarding captures routine-size preference (3 / 5 / maximal step). Minimalist users get `COMPLEMENT` fully suppressed.
- **Shelf ≠ active routine.** Coverage checks active Regimen. Unused shelf items don't suppress recs.
- **Tinted SPF is a complement, not a replacement.** Separate job family (tone-evening). Same logic for other makeup-adjacent products.
- **SWAP_SUGGESTED is the only state that says something negative about an owned product.** Bar is high. Always includes an explanation, never silent. Always Journal — never Home.
- **Silence is a feature.** COVERED shows nothing. No "you're all set!" copy, no badges, no green checkmarks. Just absence.

---

## 7. Open questions

For later, when building.

- **Catalog vs generative.** Is "what we'd try" pulled from a curated catalog of vetted products, or generated per-user by the AI worker? Lean curated — keeps voice + safety controllable. Decide before building empty-slot recs.
- **Affiliate / commerce posture.** If/when affiliate enters, does it bias the engine? Default: no. Ranked by fit, not margin. Disclose clearly.
- **Negative knowledge.** Can a user mark "tried this, hated it"? Probably yes. UX surface TBD.
- **Pregnancy / breastfeeding / sensitivity flags.** Health-adjacent. We are not a clinic. Either skip these filters entirely (and say so) or attach a clear non-medical disclaimer. Decide before launch.
- **Brand bias.** Catalog brand-agnostic, or favorite-brand weighting? Affects whether recs feel curated-by-friends or feed-like.

---

## 8. How to use this doc

When building any rec feature:

1. Identify which **state** you're surfacing (§4).
2. Confirm the **surface** is allowed to show that state (§5).
3. Run the copy past **§1** before shipping. If it sounds like a doctor's office, rewrite.
4. If a decision in §6 conflicts with what you're building, raise it before shipping — don't quietly override.
