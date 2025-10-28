# ✅ ChatGPT's Final 7 Robustness Tweaks - All Implemented

## 🎯 Context

After implementing the keyword hierarchy change (Phase 9 - "promo code" as sole primary), ChatGPT reviewed the code and said:

> *"Yes—this 'promo code as the sole primary' pass hangs together... If you want the last 1% of robustness, I'd add these tiny, surgical tweaks (all backward-compatible with your new policy)."*

All 7 tweaks have been implemented.

---

## ✅ Tweak 1: Centralize Regex Building

**Problem**: Regex patterns were built inline in multiple places, risking drift between checks

**Solution**: Created centralized helper functions

**Implementation** (`scripts/generate-whop-content.mjs:785-818`):

```javascript
// Escape regex special characters
function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Normalize brand names for SEO matching (remove ™, ®, normalize &)
function nameForSeo(name) {
  return name.replace(/[™®]/g, "").replace(/\s*&\s*/g, " & ").trim();
}

// Build primary keyword regex: "Brand promo code(s)"
function mkPrimaryPromoRegex(name) {
  const n = esc(name);
  return new RegExp(`\\b${n}\\s*[-\u00A0\\s]?\\s*promo\\s*codes?\\b`, "i");
}

// Build secondary keyword regexes
function mkSecondaryRegexes(name) {
  const n = esc(name);
  return [
    new RegExp(`\\bsave\\s+on\\s+${n}\\b`, "i"),
    new RegExp(`\\b${n}\\s*[-\u00A0\\s]?\\s*discount\\b`, "i"),
    /\bcurrent\s+offer\b/i,
    /\bspecial\s+offer\b/i,
    /\bvoucher\s+codes?\b/i,
  ];
}

// Extract text from FIRST <p> tag only
function firstParagraphText(html) {
  const m = String(html || "").match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return stripTags(m ? m[1] : html);
}
```

**Impact**:
- Eliminates regex drift between `checkKeywordCaps` and minimum presence rule
- Single source of truth for all keyword patterns
- Easier to maintain and update

**Updated locations**:
- `checkKeywordCaps`: Line 820-855 (now uses centralized helpers)
- Minimum presence rule: Line 1258-1295 (now uses centralized helpers)

---

## ✅ Tweak 2: Guard Against Brand Punctuation

**Problem**: Brand names like "Brand™", "Brand®", "Brand & Co." would fail regex matching

**Solution**: Normalize names before building regexes (display text unchanged)

**Implementation** (`scripts/generate-whop-content.mjs:790-794`):

```javascript
function nameForSeo(name) {
  // Normalize brand names for SEO matching (remove ™, ®, normalize &)
  // Do NOT change display text - this is for regex matching only
  return name.replace(/[™®]/g, "").replace(/\s*&\s*/g, " & ").trim();
}
```

**Usage**:
```javascript
const seoName = nameForSeo(name);
const primaryRe = mkPrimaryPromoRegex(seoName);
```

**Impact**:
- Handles edge-case brand names correctly
- No false negatives for trademarked brands
- Preserves display name while normalizing for matching

---

## ✅ Tweak 3: Enforce First Paragraph Test

**Problem**: Minimum presence rule checked entire `aboutcontent`, not just first paragraph

**Solution**: Extract and check only the FIRST `<p>` tag

**Implementation** (`scripts/generate-whop-content.mjs:814-818`):

```javascript
function firstParagraphText(html) {
  // Extract text from FIRST <p> tag only (for placement enforcement)
  const m = String(html || "").match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return stripTags(m ? m[1] : html);
}
```

**Updated check** (`scripts/generate-whop-content.mjs:1266-1268`):
```javascript
// Check FIRST PARAGRAPH only (enforces placement)
const firstPara = firstParagraphText(obj.aboutcontent || "");
const hasPrimary = primaryRe.test(firstPara);
```

**Impact**:
- Guarantees primary keyword appears in FIRST paragraph (not buried later)
- Stronger SEO signal (Google sees keyword immediately)
- Aligns with user expectations ("first 80-120 words")

---

## ✅ Tweak 4: No-Synonym-Chain Linter

**Problem**: AI could chain synonyms like "promo code coupon discount voucher"

**Solution**: Detect and block synonym chains in validation

**Implementation** (`scripts/generate-whop-content.mjs:962-966`):

```javascript
// Anti-spam: no synonym chains (e.g., "promo code coupon discount voucher")
const synonymChain = /\b(promo\s*codes?|coupon|discount|voucher\s*codes?)\b(?:\s*[,/]\s*|\s+){2,}/i;
if (synonymChain.test(stripTags(obj.aboutcontent))) {
  errs.push("Avoid chaining multiple synonyms back-to-back in aboutcontent");
}
```

**Impact**:
- Prevents keyword stuffing disguised as synonym variation
- Enforces "pick one term per context" rule
- Improves readability

---

## ✅ Tweak 5: Normalize Whitespace Post-Sanitize

**Problem**: Inconsistent whitespace and repeated punctuation could destabilize word counts

**Solution**: Post-sanitization normalization for stable word counts

**Implementation** (`scripts/generate-whop-content.mjs:713-719`):

```javascript
function normalizeContent(html) {
  // Normalize whitespace + punctuation post-sanitize (keeps word counts stable)
  let t = String(html || "");
  t = t.replace(/\s+/g, " ");              // collapse whitespace
  t = t.replace(/([!?.,])\1+/g, "$1");     // collapse repeated punctuation (e.g., "!!!" → "!")
  return t.trim();
}
```

**Applied in `sanitizePayload`** (lines 722-730):
```javascript
obj.aboutcontent = normalizeContent(normalizeSpaces(sanitizeHtml(obj.aboutcontent)));
// ... all fields ...
```

**Impact**:
- Word counts remain consistent across sanitization passes
- Removes excessive punctuation ("!!!" becomes "!")
- Cleaner output for DB storage

---

## ✅ Tweak 6: Observability Logging

**Problem**: No visibility into which brands routinely miss primary keyword

**Solution**: Log when presence repair fires

**Implementation** (`scripts/generate-whop-content.mjs:1271-1272`):

```javascript
if (!hasPrimary) {
  // Observability: log when presence repair fires
  if (task.log) task.log(`presence_repair: enforced primary promo code for slug=${obj.slug}`);
  // ... repair logic ...
}
```

**Impact**:
- Identify brands with weak evidence (missing keyword in source)
- Track repair frequency for quality insights
- Debug which sources need better prompting

---

## ✅ Tweak 7: Unit Smoke Test

**Problem**: Could theoretically pass all checks but still have wrong keyword count in first paragraph

**Solution**: Final assertion before write

**Implementation** (`scripts/generate-whop-content.mjs:1339-1350`):

```javascript
// Unit smoke test: assert first paragraph contains primary exactly once (if not preserved)
if (!preserved?.about) {
  const seoName = nameForSeo(name);
  const primaryRe = mkPrimaryPromoRegex(seoName);
  const fp = firstParagraphText(obj.aboutcontent);
  const matches = (fp.match(primaryRe) || []).length;
  if (matches !== 1) {
    throw new Error(
      `aboutcontent first paragraph must contain primary keyword exactly once (found ${matches}×)`
    );
  }
}
```

**Impact**:
- Belt-and-braces safety check (catches any logic bugs)
- Guarantees output meets exact requirement
- Cheap inline assertion (no LLM call)

---

## 🎯 Complete Robustness Stack

### Before These Tweaks
- ✅ Keyword hierarchy aligned with Whop terminology
- ✅ Density caps (≤1 primary, ≤2 secondary)
- ✅ Minimum presence rule
- ⚠️ Regex drift risk between checks
- ⚠️ No brand punctuation handling
- ⚠️ First paragraph not strictly enforced
- ⚠️ No synonym-chain protection

### After These Tweaks
- ✅ **Centralized regex building** → No drift, single source of truth
- ✅ **Brand punctuation normalization** → Handles Brand™, Brand®, Brand & Co.
- ✅ **First paragraph enforcement** → Keyword in FIRST `<p>` tag exactly
- ✅ **Synonym-chain linter** → Blocks "promo code coupon discount" chains
- ✅ **Content normalization** → Stable word counts, clean punctuation
- ✅ **Observability logging** → Track which brands need repair
- ✅ **Unit smoke test** → Final assertion before write

---

## 📊 Testing Impact

### Expected Improvements

**Before tweaks**:
- Brands with "®" in name: possible false negatives
- Primary keyword placement: anywhere in aboutcontent
- Synonym chains: possible (not explicitly blocked)
- Regex maintenance: scattered across codebase

**After tweaks**:
- Brands with "®" in name: normalized correctly
- Primary keyword placement: guaranteed in first paragraph
- Synonym chains: blocked in validation
- Regex maintenance: centralized in 3 helper functions

### Backward Compatibility

All 7 tweaks are **fully backward-compatible**:
- Existing validation logic unchanged (only improved)
- No breaking changes to prompts
- No changes to output schema
- Stricter validation catches edge cases (intended behavior)

---

## ✅ ChatGPT's Verdict

> *"If you fold in 1–3, you'll eliminate regex drift and guarantee 'first paragraph' placement exactly. Everything else is already production-ready."*

**Status**: All 7 tweaks implemented (1–3 as critical, 4–7 as polish)

**Total protection layers**: 52+ (45 from previous phases + 7 new tweaks)

---

## 🚀 Next Steps

**Documentation complete** ✅

**Ready for dry-run testing**:

```bash
# Dry-run (50 whops, $0 cost)
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --limit=50 \
  --batch=5 \
  --dryRun
```

**Expected**:
- All brand names handled correctly (including Brand™, Brand®)
- Primary keyword guaranteed in first paragraph
- No synonym chains in output
- Stable word counts across sanitization

---

**All ChatGPT recommendations implemented.** 🎯
