# Settings & AI Settings Usability Improvement Plan

## Objective
Make both **General Settings** and **AI Settings** easier to understand, faster to configure, and safer to use without needing technical knowledge.

## Problems To Solve

### 1) Overly technical labels and dense form layout
- Current labels such as “API Endpoint”, “Authorization Header”, and “Base URL” are not self-explanatory for most users.
- Too many fields appear at once, which increases cognitive load.

### 2) Weak setup guidance for AI
- Users must know provider/model conventions up front.
- No clear guided setup sequence (provider → key → model → test).
- Success/failure states are not persistent or highly visible.

### 3) Poor discoverability and confidence
- Users may not know which settings are required versus optional.
- Advanced options are mixed with essentials.
- There is not enough contextual help or inline examples.

## UX Principles
1. **Progressive disclosure**: show essentials first, advanced controls on demand.
2. **Plain language first**: rename technical wording into user-intent phrasing.
3. **Guided setup**: convert AI configuration into step-by-step setup flows.
4. **Visible validation**: immediate field-level checks and clear completion status.
5. **Safe defaults**: pre-filled recommended values for common providers.

## Proposed IA (Information Architecture)

### Top-level settings groups
1. **Writing Experience** (font, editor behavior)
2. **AI Assistant** (primary AI setup)
3. **Advanced AI** (local/self-hosted/custom endpoints)
4. **Sync & Backup**
5. **Privacy & Data**
6. **Updates**

### Section model
- Every section should include:
  - short “What this controls” helper sentence
  - required fields at top
  - advanced fields behind “Show advanced options”
  - status chip: Not set up / Needs attention / Ready

## AI Settings Redesign

### A) Add “Quick setup” wizard
Steps:
1. Choose provider (OpenAI, Groq, OpenRouter, Mistral, DeepSeek, Together, Custom)
2. Enter API key
3. Confirm recommended model (editable)
4. Run connection test
5. Save and mark AI as ready

### B) Separate “Quick setup” and “Advanced setup”
- **Quick setup**: minimal required fields only.
- **Advanced setup**: endpoint override, custom headers, retry/timeouts, temperature, token limits.

### C) Clear human-readable copy
Examples:
- “API Endpoint” → “Service URL (usually leave default)”
- “Session Token” / “API Key” → “Secret key from your provider account”
- “Model” → “AI model (recommended preselected)”

### D) Add recovery patterns
- “Having trouble connecting?” expandable diagnostics with common fixes.
- Distinguish auth errors vs network errors vs model-not-found errors.
- Keep last successful test timestamp.

### E) Local AI setup improvements
- Presets for Ollama/vLLM/llama.cpp with one-click defaults.
- “Detect local models” button with loading state and empty-state guidance.
- Example command snippets for first-time local setup.

## General Settings Improvements

### A) Improve labels and help text
- Replace implementation-focused names with user outcomes.
- Add concise helper text beneath each control.

### B) Reorder by frequency
- High-frequency controls first (theme, font size, autosave).
- Rare/dangerous actions (reset data) in a dedicated “Danger zone”.

### C) Better control types
- Replace raw numeric fields where possible with sliders/presets:
  - Autosave interval presets: 5s / 10s / 30s / 60s
  - Font presets: Small / Medium / Large

### D) Save feedback and reset affordances
- Inline “Saved” confirmation at section level.
- “Restore defaults” button per section.

## Accessibility & Content Requirements
- Ensure all labels are screen-reader descriptive.
- Add keyboard focus order matching visual flow.
- Color contrast for validation/success states.
- Avoid jargon in labels and helper text (aim ~8th-grade reading level).

## Analytics & Success Metrics
Track improvements with:
1. Time-to-complete AI setup (target: -40%)
2. AI setup abandonment rate (target: -30%)
3. AI connection test success on first attempt (target: +25%)
4. Settings-related support reports (target: -25%)

## Implementation Roadmap

### Phase 1 — Content and IA cleanup (small, low risk)
- Rename labels and section titles.
- Add helper text and required/optional badges.
- Introduce section status chips.

### Phase 2 — AI quick setup wizard (medium)
- Build guided flow component.
- Keep backward compatibility with existing config schema.
- Add structured connection diagnostics.

### Phase 3 — Advanced controls and polish (medium)
- Collapse advanced fields by default.
- Add per-section reset/defaults.
- Improve keyboard and screen-reader behavior.

### Phase 4 — Measurement and iteration (ongoing)
- Instrument setup funnel analytics.
- Run usability tests (5–8 users).
- Iterate based on drop-off and error hotspots.

## Engineering Notes
- Preserve existing storage keys and migration behavior.
- Introduce a UI mapping layer so copy/labels can evolve without data-model churn.
- Prefer incremental PRs by phase to reduce regression risk.

## Deliverables
1. Updated settings taxonomy and copy deck
2. AI quick-setup wizard UX and implementation
3. Advanced AI panel with progressive disclosure
4. Validation/error state overhaul
5. Telemetry dashboard for setup funnel metrics
