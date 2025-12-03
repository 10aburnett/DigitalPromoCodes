# MASTER DEDUP PLAN V3 - 8K Unique Whop Content System

## Why Previous Approach Failed

The phrase-only synonym replacement approach (reducing 94.3% → 71.2%) is **insufficient** because:

1. **Only attacks phrases, not structures** - Google detects identical blueprints (hook → features → community) across all pages
2. **Phrase-only substitution creates "Frankenstein" content** - Broken grammar, jarring tone shifts
3. **Ignores combinatorial fingerprints** - Even if each phrase <100x, the *combination* of patterns still repeats hundreds of times
4. **Can't handle semantic sameness** - Google uses embeddings. "Discord for traders with signals, enter code at checkout" in 70 phrasings is still detected
5. **Math doesn't work** - 4 synonyms for 7,629 occurrences = 1,907 per variant (still massive duplication)

---

## The Four-Layer System Required

### LAYER 1: Deep Analysis (Do This First)

**Segment by section type:**
- `aboutcontent` (HTML paragraphs)
- `howtoredeemcontent` (ordered list)
- `promodetailscontent` (unordered list)
- `termscontent` (unordered list)
- `faqcontent` (5-6 Q/As)

**For each section, analyze:**
- Top 100 repeated n-grams (2-7 words) with counts
- Most common sentence openers ("This platform...", "You can access...")
- Syntactic skeletons/clause patterns
- Average sentence count, word count
- Template blueprints (e.g., About = hook → feature → benefit → community)

**Output:** `analysis/dedup-report.json` with:
```json
{
  "aboutcontent": {
    "topPhrases": [...],
    "sentenceOpeners": [...],
    "templatePatterns": [...],
    "avgSentences": 3.2,
    "avgWords": 145
  },
  // ... other sections
}
```

---

### LAYER 2: Variation Asset Generation

Generate these assets BEFORE rewriting:

#### A. Structural Templates (8-12 per section)

**ABOUT templates:**
- Question-led: "Looking for a clearer way to access...?"
- Problem-solution: "Finding reliable communities can be difficult. This solves that by..."
- Benefit-led: "Built for flexibility, it helps users..."
- Story hook: "Many traders start overwhelmed. This community offers..."
- Transparency angle: "You know exactly what you're paying for with..."
- Outcome-driven: "The goal is simple: help members improve..."
- Feature-first: "With tools like X, Y, and Z, members can..."
- Social proof: "Trusted by thousands of users, this platform..."

**REDEEM templates (4-7 steps, different orderings):**
- Template A: 5 steps, action-verb led
- Template B: 4 steps, condensed
- Template C: 6 steps, detailed with tips
- Template D: 5 steps, benefit-highlighted
- etc.

**FAQ profiles (5 distinct sets):**
- Different question archetypes
- Different ordering
- Different tones

#### B. Style Profiles (10 distinct)

1. Neutral informational
2. Lightly conversational
3. Benefit-led
4. Risk-awareness focused
5. Transparency-first
6. Community-trust emphasized
7. Expert tone
8. Beginner-friendly tone
9. Short, concise tone
10. Rich, descriptive tone

Each defines: sentence length, connectors, verb tendencies, rhetorical devices

#### C. Semantic Angles (12 topical focuses)

1. Community support
2. Expert insight
3. Transparency
4. Affordability
5. Ease of onboarding
6. Flexibility of subscription
7. Educational resources
8. Performance features
9. Responsiveness/support
10. Member autonomy
11. Risk management
12. Actionable signals

#### D. Sentence Variation Packs

For each high-frequency sentence structure:
- Generate **20-50 variants** keeping meaning but changing:
  - Clause ordering
  - Opener patterns
  - Tone
  - Semantic angle

#### E. Phrase Variation Packs

- 4000+ occurrences → 60-80 variants
- 1000+ occurrences → 20-30 variants

Include: synonym variants, structural variants, short/long versions, tone-shifted versions

**Output:** `assets/variation-packs.json`

---

### LAYER 3: Deterministic Rewriting

#### Assign Unique Fingerprint Per Whop

```javascript
// Each whop gets a unique combination
fingerprint = {
  aboutTemplate: hash(slug) % 12,      // 0-11
  redeemTemplate: hash(slug + 'r') % 8, // 0-7
  promoTemplate: hash(slug + 'p') % 12, // 0-11
  termsTemplate: hash(slug + 't') % 10, // 0-9
  faqProfile: hash(slug + 'f') % 5,     // 0-4
  styleProfile: hash(slug + 's') % 10,  // 0-9
  semanticAngle: hash(slug + 'a') % 12, // 0-11
  sentencePack: hash(slug + 'sp') % N,
  phrasePack: hash(slug + 'pp') % M
}
```

**Millions of combinations** = mathematically impossible to repeat

#### Rewriting Process Per Section

1. Select structural template (from fingerprint)
2. Apply style profile (rhythm, length, tone, connectors)
3. Apply semantic angle (for About only)
4. Rewrite each sentence using sentence pack
5. Replace micro-phrases using phrase pack (grammar-preserving)
6. Ensure HTML structure stays intact

---

### LAYER 4: Verification & QC

#### 1. Phrase Repetition Check
- No phrase variant > 80 occurrences

#### 2. Sentence-Level Similarity
- Cosine similarity < 0.85
- ROUGE-L < 0.55

#### 3. Page-Level Embedding Check
- No two pages > 0.83 similarity
- No page too close to template prototype

#### 4. Fingerprint Uniqueness Check
- No two pages share exact same template combination
- Or extremely rare (<10 pages globally)

#### 5. HTML Validation
- No unclosed tags
- No broken lists
- Valid FAQ JSON structure

#### 6. Human Sampling
- Every 500 pages, sample 3 randomly
- Check: natural flow, coherent tone, no Frankenstein phrasing

---

## Implementation Steps

### Step 1: Run Deep Analysis
```bash
node scripts/deep-content-analysis.mjs data/content/master/successes.jsonl
# Output: analysis/dedup-report.json
```

### Step 2: Generate Variation Assets
```bash
# Use OpenAI to generate templates, style guides, sentence packs
node scripts/generate-variation-assets.mjs
# Output: assets/variation-packs.json
```

### Step 3: Rewrite All Content
```bash
# Deterministic rewrite with checkpointing
node scripts/rewrite-with-fingerprints.mjs data/content/master/successes.jsonl
# Output: successes.rewritten.jsonl
```

### Step 4: Run Verification Suite
```bash
node scripts/verify-uniqueness.mjs successes.rewritten.jsonl
# Output: verification-report.json with pass/fail metrics
```

### Step 5: Iterate if Needed
- If verification fails, adjust variation packs
- Re-run rewrite on failed entries only

---

## Files to Create

1. `scripts/deep-content-analysis.mjs` - Layer 1 analysis
2. `scripts/generate-variation-assets.mjs` - Layer 2 asset generation
3. `scripts/rewrite-with-fingerprints.mjs` - Layer 3 deterministic rewrite
4. `scripts/verify-uniqueness.mjs` - Layer 4 verification
5. `assets/structural-templates.json` - Template definitions
6. `assets/style-profiles.json` - Style guide definitions
7. `assets/semantic-angles.json` - Angle definitions
8. `assets/sentence-packs.json` - Sentence variations
9. `assets/phrase-packs.json` - Phrase variations

---

## Success Criteria

- [ ] No phrase appears > 80 times across all 8,000 pages
- [ ] No two pages share identical template fingerprint
- [ ] Page-level embedding similarity < 0.83 for any pair
- [ ] All HTML valid and well-formed
- [ ] Human review passes on random samples
- [ ] Content maintains accurate meaning throughout

---

## Important Notes

1. **This is NOT a quick fix** - Requires proper asset generation first
2. **OpenAI calls needed** - For generating variation packs (one-time cost)
3. **Checkpointing essential** - 8,000 entries = long runtime
4. **Safe incremental processing** - Write as we go, don't hold in memory
5. **Verification is mandatory** - Don't ship without passing all checks

---

## Current Status

- [x] Previous phrase-only dedup: 94.3% → 71.2% (insufficient)
- [ ] Layer 1: Deep analysis
- [ ] Layer 2: Variation asset generation
- [ ] Layer 3: Deterministic rewriting
- [ ] Layer 4: Verification

---

*Created: 2024-12-03*
*Based on: ChatGPT analysis of Claude's original approach*

---

# APPENDIX: FULL CLAUDE-READY TOOLKIT

Below is the complete operating system for the rewrite engine.

---

## MASTER SUPERVISOR PROMPT

**SYSTEM ROLE:**
You are the *Rewrite Orchestrator* for regenerating all 8,000 Whop content entries.
You will produce **unique, structurally-diverse, semantically-varied, style-varied, human-sounding, HTML-safe content** for each Whop.
The meaning MUST stay accurate to the original, but the **expression, framing, structure, semantics, and style MUST change**.

Your job consists of:
1. **Phase 1 — Dataset Analysis**
2. **Phase 2 — Asset Generation**
3. **Phase 3 — Per-Whop Rewrite with deterministic uniqueness**
4. **Phase 4 — Verification & Semantic Similarity Control**

All rewrites MUST follow the rules and assets below.

---

## PHASE 1 — DATASET ANALYSIS TOOLS

Claude must perform these analyses on the FULL master file before rewriting anything.

### Task A — Section Segmentation
Separate each Whop entry into:
- aboutContent
- howToRedeemContent
- promoDetailsContent
- termsContent
- faqContent (questions + answers separated)

### Task B — N-gram Frequency Extraction
For each section:
- Extract all 2–7 word n-grams
- Rank by frequency
- Flag all n-grams appearing **>300 times**
- Produce top 100 repeated phrase patterns

### Task C — Structural Pattern Detection
Identify:
- Most common sentence skeletons
- Most common intro formats
- Most common list formats
- FAQ question clusters
- Redeem step clusters

Output: list of **template blueprints** with recurrence counts.

### Task D — Page Fingerprint Extraction
For each Whop:
- Sentence count
- Word count
- Paragraph count
- Number of bullets
- FAQ question structure pattern
- Redeem step order

This reveals excessive uniformity.

---

## PHASE 2 — VARIATION ASSET GENERATION

Generate **all building blocks** for the rewrite engine. Create once, save, reference throughout Phase 3.

### A. STRUCTURAL TEMPLATES

#### ABOUT SECTION — 12 Templates
Each includes intro style, body structure, optional closing line.

1. **Question Hook** - "Looking for a clearer way to...?"
2. **Pain/Problem → Relief/Solution** - "Finding X can be difficult. This solves that by..."
3. **Story Lead-In** - "Many traders start overwhelmed. This community offers..."
4. **Outcome-Focused** - "The goal is simple: help members improve..."
5. **Feature Breakdown** - "With tools like X, Y, and Z, members can..."
6. **Community Angle** - "Join thousands of users who..."
7. **Transparency/Safety Focus** - "You know exactly what you're paying for with..."
8. **Empowerment Tone** - "Take control of your trading with..."
9. **Discovery-Based** - "Discover a platform that..."
10. **Skeptic-Turned-User** - "If you've been burned before, this is different..."
11. **Scenario-Based** - "Whether you're new or experienced..."
12. **Short + Punchy Format** - Brief, direct, action-oriented

#### REDEEM STEPS — 8 Templates
Vary: step count (4–7), order, verbs, specificity, tone

1. Quick Unlock (4 steps)
2. Full Walkthrough (7 steps)
3. Checkout-Focused (5 steps)
4. Account-Setup First (6 steps)
5. Mobile Journey Version (5 steps)
6. Code-First Approach (4 steps)
7. Verification-Heavy (6 steps)
8. Streamlined Process (4 steps)

#### PROMO DETAILS — 12 Templates
Feature-heavy, benefit-heavy, pricing-focused, access-focused, "Why users choose this deal", "Key membership perks", etc.

#### TERMS — 10 Templates
Platform rules emphasised, eligibility-focused, creator-specific policy, payment method restrictions, time-sensitive terms, etc.

#### FAQ TEMPLATES — 5 Profiles
Different question sets, answer structures, tone variants (concise, supportive, factual, transparent)

---

### B. STYLE PROFILES (10 total)

Each defines: sentence rhythm, word density, tone, connectors, opener patterns, questions vs statements, formality level.

1. **Neutral Informational** - Facts-first, balanced
2. **Light Conversational** - Friendly, approachable
3. **Value/Benefit-Led** - Emphasizes what user gains
4. **Risk/Transparency Focused** - Upfront about limitations
5. **Community Support Tone** - Emphasizes belonging
6. **Expert Guide Tone** - Authoritative, knowledgeable
7. **Beginner-Friendly** - Simple language, no jargon
8. **Promotional (light)** - Enthusiastic but not spammy
9. **Concise Minimalist** - Short sentences, direct
10. **Rich/Descriptive** - Detailed, thorough explanations

---

### C. SEMANTIC ANGLES (12 total)

Each About section picks ONE angle:

1. **Community Support** - Emphasize belonging, peer help
2. **Expert-Led Insight** - Creator credentials, expertise
3. **Onboarding Simplicity** - Easy to get started
4. **Transparency/Safety** - Clear terms, no surprises
5. **Affordability** - Value for money, savings
6. **Access/Flexibility** - Multiple plans, options
7. **Educational Focus** - Learning resources, growth
8. **Performance/Speed** - Quick results, efficiency
9. **Personalisation** - Tailored to your needs
10. **Risk Management** - Protect your investment
11. **Outcome/Results Based** - What you'll achieve
12. **Member Autonomy** - Control over your experience

---

### D. PHRASE VARIATION PACKS

For every repeated phrase (>300 occurrences):
- Generate 20–80 variations depending on frequency
- Maintain meaning, change structure AND diction

Example: "Apply the discount code at checkout" → 60 variants:
- "Enter your code when completing checkout."
- "Use the code during the payment step."
- "Add your promo code before confirming your order."
- etc.

---

### E. SENTENCE VARIATION PACKS

For every common sentence skeleton, generate **20–50 variations** that:
- Preserve meaning
- Transform structure
- Add/remove clauses
- Change ordering
- Alter rhetorical style

---

## PHASE 3 — DETERMINISTIC REWRITE ENGINE

### Variant Fingerprint Structure

Every Whop gets a unique fingerprint:
```
{
  aboutTemplate: 1-12,
  redeemTemplate: 1-8,
  promoTemplate: 1-12,
  termsTemplate: 1-10,
  faqProfile: 1-5,
  styleProfile: 1-10,
  semanticAngle: 1-12,
  sentencePackIndex: 1-N,
  phrasePackIndex: 1-M
}
```

**Millions of combinations** = collisions extremely rare.

### Deterministic Assignment Algorithm

```javascript
function assignFingerprint(slug) {
  const index = hash(slug);
  return {
    aboutTemplate:  index % 12,
    redeemTemplate: index % 8,
    promoTemplate:  index % 12,
    termsTemplate:  index % 10,
    faqProfile:     index % 5,
    styleProfile:   Math.floor(index / 7) % 10,
    semanticAngle:  Math.floor(index / 11) % 12,
    sentencePack:   Math.floor(index / 13) % N,
    phrasePack:     Math.floor(index / 17) % M
  };
}
```

Guarantees: even distribution, reproducibility, zero clustering.

### Rewrite Rules Per Whop

1. **Apply Structural Template** - Compose section using predefined template
2. **Apply Semantic Angle** - Adjust About section phrasing
3. **Apply Style Profile** - Transform rhythm, tone, connectors
4. **Rewrite Sentences** - Replace using chosen sentence variation pack
5. **Replace Micro-Phrases** - Use phrase variation packs
6. **Regenerate HTML Cleanly** - Ensure no broken markup

---

## PHASE 4 — VERIFICATION ENGINE

### 1. Phrase Frequency Check
No variation appears more than threshold (e.g., 80 globally).

### 2. Sentence Similarity Check
Reject rewrite if:
- Cosine similarity > 0.85
- ROUGE-L > 0.55

### 3. Page-Level Embedding Check
Reject if:
- Page similarity > 0.83 to any previous page
- Or > 0.80 to any original template prototype

### 4. Fingerprint Redundancy Check
Ensure no two Whops share exact same combination of all template/style/angle values.

### 5. HTML Validation
Ensure valid HTML, correct tags, well-formed lists.

### 6. Quality Spot Check
Sample every 300–500 entries and confirm:
- Natural tone
- No Frankenstein phrasing
- Unique structure
- Clean flow

---

## ASSETS TO GENERATE

When ready to proceed, generate these in order:

1. **The actual 12 About Templates** (full text skeletons)
2. **The actual 8 Redeem Templates** (step-by-step variants)
3. **The actual 12 Promo Templates** (list format variants)
4. **The actual 10 Terms Templates** (policy variants)
5. **The actual 5 FAQ Profiles** (question/answer sets)
6. **The actual 10 Style Profiles** (detailed specifications)
7. **The actual 12 Semantic Angles** (detailed application rules)
8. **The Phrase Packs** (based on Phase 1 analysis)
9. **The Sentence Packs** (based on Phase 1 analysis)
10. **The exact Claude prompt format for production execution**

---

## OUTCOME

Using this system:
- **No two Whops will look similar at any level**
- **Google will not detect programmatic duplication**
- **Meaning remains accurate**
- **HTML stays perfect**
- **Pages feel human-written, not AI-paraphrased**
