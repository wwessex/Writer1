# Test Coverage Analysis for DraftHarbour Studio

## Executive Summary

DraftHarbour Studio currently has **zero automated tests**. The CLAUDE.md explicitly states: "This project has no test framework. Test manually in browser." This analysis identifies critical areas where tests would provide the highest value and proposes a testing strategy.

---

## Current State

| Metric | Value |
|--------|-------|
| Test files | 0 |
| Test frameworks | None |
| Code coverage | 0% |
| Total JS lines | ~2,800 |

---

## Recommended Testing Strategy

### Phase 1: Quick Wins (Pure Functions)

These functions have no DOM dependencies and can be tested immediately with any framework:

#### 1. Text Analysis (`app.js`)
**Priority: HIGH** - These calculations directly impact user-facing metrics.

```javascript
// Functions to test:
countSyllables(word)      // Lines 396-403
splitSentences(text)      // Lines 405-407
analyzeText(text)         // Lines 409-455
readabilityLabel(score)   // Lines 457-465
countWordsInString(s)     // Lines 111-115
tokenizeWords(text)       // Line 124-126
```

**Test cases needed:**
- `countSyllables`: Single syllable words, multi-syllable, silent-e words, edge cases (empty, numbers)
- `splitSentences`: Multiple sentences, sentences with abbreviations (Mr., Dr.), ellipses, edge cases
- `analyzeText`: Empty text, single word, full paragraphs, verify Flesch-Kincaid formula correctness
- `readabilityLabel`: Boundary conditions (90, 80, 70, 60, 50, 30, 29)

**Example bugs this could catch:**
- Syllable counting for words like "queue" (1 syllable) vs "area" (3 syllables)
- Sentence splitting failing on "Dr. Smith went home."
- Off-by-one errors in readability thresholds

---

#### 2. Utility Functions (`app.js`, `export.js`)
**Priority: MEDIUM** - Small but widely used.

```javascript
// Functions to test:
clamp(value, min, max)    // Line 95-97 in app.js
debounce(fn, ms)          // Lines 65-71 in app.js
safeFilename(name)        // Lines 14-20 in export.js
escapeHtml(s)             // Lines 21-28 in export.js
```

**Test cases needed:**
- `clamp`: Value below min, above max, within range, edge cases (equal bounds)
- `safeFilename`: Special characters, very long names, empty strings, unicode
- `escapeHtml`: All HTML entities (&, <, >, ", '), nested entities, null/undefined

---

### Phase 2: Import/Export Logic (Medium Complexity)

#### 3. Chapter Detection (`importer.js`)
**Priority: CRITICAL** - This is where bugs are most likely to frustrate users.

```javascript
// Functions to test:
isHeadingLike(text, style)           // Lines 22-29
isAllCapsShort(s)                    // Lines 14-21
filenameToTitle(name)                // Lines 31-34
splitFromParagraphs(paragraphs, fallbackTitle)  // Lines 54-123
rtfToText(rtf)                       // Lines 125-161
textToDoc(text)                      // Lines 47-52
paragraphToTiptap(par)               // Lines 36-45
```

**Test cases needed:**

**`isHeadingLike`:**
- "Chapter 1" → true
- "CHAPTER ONE" → true
- "Part III" → true
- "Prologue" → true
- "The Beginning" → false (unless styled as heading)
- "Chapter 1: The Journey Begins" → true
- Edge: very long text, numbers only

**`splitFromParagraphs`:**
- Document with clear "Chapter X" markers
- Document with "PART ONE" style markers
- Document with no chapter markers (should return single chapter)
- Title detection from first paragraph
- Subtitle merging ("Chapter 1" followed by "The Dark Beginning")
- Mixed styles (some chapters have subtitles, some don't)

**`rtfToText`:**
- Basic RTF with `\par` markers
- Hex-encoded characters (`\'e9` → é)
- Nested groups `{\*\...}`
- Control words like `\b`, `\i`, `\fs24`
- Real-world RTF from Microsoft Word

**Why this matters:** Users importing manuscripts will be frustrated if chapter detection misidentifies headings or loses content.

---

#### 4. HTML/JSON Conversion (`export.js`)
**Priority: MEDIUM-HIGH** - Affects export quality.

```javascript
// Functions to test:
tiptapJsonToHtml(doc)     // Lines 31-71
```

**Test cases needed:**
- Empty document
- Paragraphs with text
- Headings (level 1 and 2)
- Lists (ordered and unordered)
- Text with marks (bold, italic, underline, strike, code)
- Links with special characters in href
- Nested structures (list inside blockquote)
- Hard breaks

---

### Phase 3: Data Persistence (Requires Mocking)

#### 5. Storage Operations (`storage.js`)
**Priority: HIGH** - Data integrity is critical.

```javascript
// Functions to test:
createChapter(novelId, title)
updateChapterMeta(id, patch)
deleteChapter(id)
reorderChapters(novelId, orderedIds)
importBackup(payload)
exportBackup(novelId, options)
replaceFromImport(novelId, novelTitle, chapters)
```

**Test cases needed:**
- `createChapter`: Order calculation (max order + 1)
- `deleteChapter`: Cascade deletion of snapshots
- `reorderChapters`: Multiple chapters, gaps in ordering, invalid IDs
- `importBackup`: Valid backup, invalid schema version, missing fields
- `replaceFromImport`: Existing chapters deleted, new chapters created with correct order

**Mocking requirements:**
- Dexie/IndexedDB (use `fake-indexeddb` or Dexie's in-memory adapter)
- `crypto.randomUUID()` for deterministic testing

---

### Phase 4: Integration Tests (Browser Environment)

#### 6. Window Management (`app.js`)
**Priority: LOW-MEDIUM** - Visual bugs, less critical.

```javascript
// Functions to test:
constrainWindowState(state)
isWindowStateOutOfBounds(state)
getDefaultWindowState(windowId, appFrame)
```

**Test cases needed:**
- Window fully visible
- Window partially off-screen (right, bottom, left, top)
- Very small viewport
- Multiple windows with z-index stacking

**Requirements:** jsdom or Playwright for DOM simulation.

---

## Recommended Test Framework Setup

### Option 1: Vitest (Recommended)
Fast, modern, works well with ES modules and CDN imports.

```json
// package.json (new file)
{
  "type": "module",
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "happy-dom": "^15.0.0",
    "fake-indexeddb": "^6.0.0"
  }
}
```

### Option 2: Node.js Test Runner (No Dependencies)
Built into Node.js 20+, zero setup.

```bash
node --test tests/*.test.js
```

---

## Suggested Test File Structure

```
DraftHarbourStudio/
├── tests/
│   ├── unit/
│   │   ├── text-analysis.test.js    # analyzeText, countSyllables, etc.
│   │   ├── utilities.test.js        # clamp, debounce, escapeHtml
│   │   ├── importer.test.js         # Chapter detection, RTF parsing
│   │   └── export.test.js           # tiptapJsonToHtml
│   ├── integration/
│   │   ├── storage.test.js          # Database operations
│   │   └── import-export.test.js    # Full import/export cycle
│   └── fixtures/
│       ├── sample.rtf               # Real RTF for testing
│       ├── sample.docx              # Real DOCX for testing
│       └── tiptap-docs.json         # Sample Tiptap documents
├── vitest.config.js
└── package.json
```

---

## Priority Matrix

| Area | Bug Risk | User Impact | Test Effort | Priority |
|------|----------|-------------|-------------|----------|
| Chapter detection (importer) | High | Critical | Medium | **1** |
| Text analysis (Flesch-Kincaid) | Medium | High | Low | **2** |
| RTF parsing | High | Medium | Medium | **3** |
| Storage operations | Medium | Critical | High | **4** |
| HTML/JSON conversion | Medium | Medium | Low | **5** |
| Utility functions | Low | Low | Very Low | **6** |
| Window management | Low | Low | High | **7** |

---

## Quick Start: First 5 Tests to Write

1. **`countSyllables("beautiful")` → 3** - Validates syllable algorithm
2. **`splitSentences("Dr. Smith left. He was tired.")` → 2 sentences** - Common edge case
3. **`isHeadingLike("Chapter 1", "")` → true** - Core import logic
4. **`safeFilename("My Novel: Part 1!")` → "My_Novel_Part_1"** - Export safety
5. **`readabilityLabel(65)` → "Standard"** - Boundary condition

---

## Estimated ROI

Adding even basic unit tests for the importer and text analysis would likely:
- Catch 70%+ of regressions from future changes
- Reduce manual testing time by 50%
- Provide documentation of expected behavior
- Enable confident refactoring of the 2,000+ line `app.js`

---

## Next Steps

1. Create `package.json` with Vitest
2. Extract pure functions into a separate `utils.js` for easier testing
3. Write unit tests for `importer.js` functions (highest ROI)
4. Add test fixtures with real DOCX/RTF samples
5. Set up CI to run tests on commits

---

*Generated by test coverage analysis - February 2026*
