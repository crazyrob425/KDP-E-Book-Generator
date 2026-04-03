# KDP E-Book Generator — Implementation Plan

## 1) Confirmed Scope and Target Outcome

- **Scope type:** Architecture hardening and operational alignment across core product workflows.
- **Coverage:** AI content generation, market-research ingestion/simulation, persistence lifecycle, EPUB/export path, and KDP automation.
- **Target platforms:** Web mode + Electron desktop as first-class modes; standalone backend automation as optional mode.

## 2) Baseline Architecture Mapping

- **Frontend shell:** Step-driven React + TypeScript workflow in `App.tsx`.
- **Domain contracts:** Shared interfaces and enums in `types.ts`.
- **AI layer:** `services/geminiService.ts` + token/caching helpers in `services/tokenOptimizer.ts`.
- **Persistence:** IndexedDB wrapper in `services/storageService.ts` and periodic autosave behavior in `hooks/useAutoSave.ts`.
- **Desktop integration:** Electron bridge via `electron/preload.ts` and `electron/main.ts`.
- **Automation backend:** Optional WebSocket service via `server/server.ts`; worker logic in `server/automation-worker.ts`.
- **Current bot transport reality:** Frontend bot component is currently IPC-driven (`components/KdpAutomationBot.tsx`).

## 3) Dependency and Runtime Alignment Decisions

### Canonical runtime modes
1. **Web authoring mode** for primary content workflows.
2. **Electron desktop mode** for IPC-backed local integrations and automation.
3. **Standalone backend mode (optional)** for remote automation service.

### Environment variable policy
- **Canonical frontend key:** `VITE_GOOGLE_API_KEY`.
- **Automation credentials:** `KDP_EMAIL`, `KDP_PASSWORD`.
- `API_KEY` fallback remains tolerated for compatibility but is not the recommended setup path.

### Documentation alignment requirements
- Ensure root and server READMEs use current script names and startup commands.
- Remove outdated assumptions (for example hardcoded WebSocket-only guidance when IPC is active in desktop mode).

## 4) Subsystem Implementation Requirements

### A. Market Research Pipeline
- Introduce explicit mode selection for:
  - AI-simulated market report path.
  - Real ingestion path (Google Trends + Amazon data via Electron IPC).
- Standardize partial-failure fallback policy:
  - Missing trends/scrape data should degrade gracefully, not terminate the full report flow.
- Normalize UI messaging for unavailable sources and retries.

### B. Book Generation Pipeline
- Formalize contracts for:
  - Outline generation.
  - Chapter generation.
  - Rewrite/regeneration with guidance.
- Add guardrails:
  - Token budget boundaries for long chapters.
  - Prompt-size controls and truncation.
  - Cache-key and TTL policy consistency by operation class.

### C. Persistence and Project Lifecycle
- Define explicit persisted state schema versioning and migration path.
- Align autosave/export/import payloads to a stable versioned shape.
- Add corruption recovery path with safe defaults and user-facing guidance.
- Clarify behavior for reset, start-new-project, and backward compatibility.

### D. Automation Bot Pipeline
- Declare transport ownership:
  - IPC as desktop source of truth.
  - WebSocket backend as optional deployment path.
- Enforce lifecycle constraints:
  - One active automation run per client/session.
  - Deterministic stop/cancel semantics.
  - CAPTCHA pause/resume handoff guarantees.
  - Disconnect cleanup guarantees.

## 5) Security and Robustness Requirements

- **Sensitive boundaries**
  - Credential usage in automation workers.
  - IPC handlers and message payloads.
  - Local file read/write dialog flows.
  - External browser automation steps.
  - AI prompt construction from user-controlled text.

- **Hardening requirements**
  - Validate payload shape at all IPC/message entry points.
  - Add bounded error handling around async generator transitions.
  - Ensure desktop production defaults disable non-essential debug behavior.
  - Keep external-link handling explicit and allowlisted where possible.

## 6) UX and Observability Requirements

- Create consistent status enums and transitions for long-running actions:
  - Generating content
  - Rendering assets
  - Uploading/submitting automation tasks
- Define structured logging levels:
  - user-visible event logs
  - diagnostic logs
  - error logs with actionable context
- Track telemetry points:
  - token usage trend
  - cache hit/miss behavior
  - automation milestones and failure stage
- Ensure every recoverable failure presents clear next-step actions.

## 7) Delivery Sequence (Phased)

### Phase 1 — Contract & Runtime Alignment
- Finalize runtime mode ownership and environment-variable contract.
- Align docs and in-code constants/interfaces with those decisions.

### Phase 2 — Reliability Hardening
- Add defensive validation and fallback behavior.
- Standardize cancellation and retry semantics across long-running flows.

### Phase 3 — Data Lifecycle Hardening
- Implement persisted schema versioning and migration behavior.
- Stabilize import/export/reset behavior.

### Phase 4 — Security & Production Hardening
- Lock down payload validation and credential handling boundaries.
- Ensure release-safe desktop defaults and automation safeguards.

### Phase 5 — Operational Readiness
- Finalize docs/runbooks.
- Capture troubleshooting matrix and known limitations.

## 8) Validation Plan (No New Tooling)

### Automated/project commands
- Root build:
  - `npm run build`
- Server typecheck:
  - `npx tsc -p server/tsconfig.json --noEmit`
- Server runtime smoke:
  - `npx tsx server/server.ts`

### Manual validation matrix
1. **Single-book E2E flow**
   - Research → outline → content → illustration → review.
2. **Real market-research fallback**
   - Simulate unavailable trends/scrape source and confirm graceful degradation.
3. **Automation lifecycle**
   - Start → CAPTCHA pause/resume → stop → restart.
4. **Persistence lifecycle**
   - Save/reload/reset/import with valid and malformed payloads.
5. **API key/credential paths**
   - Missing and invalid key behavior must be actionable and non-destructive.

## 9) Documentation Work Completed in This Plan Execution

- Root README updated with:
  - current setup commands
  - canonical env vars
  - supported runtime modes
  - troubleshooting guidance
- Server README updated with:
  - optional-mode positioning
  - accurate launch/typecheck commands
  - transport clarification (IPC vs WebSocket mode)

## 10) Definition of Done

- Scope/platform decisions documented and accepted.
- Runtime mode ownership and env policy documented.
- High-risk boundaries identified with explicit hardening requirements.
- Validation matrix defined and usable by contributors.
- Work decomposed into issue-sized tasks with sequencing.

## Issue-Sized Backlog (Recommended Order)

1. **DOC-01:** Runtime mode + env-var contract cleanup (README/root + server complete)
2. **ARCH-01:** Define shared automation transport contract (IPC primary, WS optional adapter)
3. **MR-01:** Market-research fallback normalization and user messaging
4. **GEN-01:** Generation contract tightening and prompt-size guardrails
5. **PERSIST-01:** Versioned state schema + migration strategy
6. **BOT-01:** Automation single-run lock + deterministic cancellation handling
7. **SEC-01:** IPC/message payload validation layer
8. **UX-01:** Unified status model + recoverable error UX
9. **OBS-01:** Logging/telemetry normalization for token/cache/automation events
10. **OPS-01:** Final operational runbook and release checklist
