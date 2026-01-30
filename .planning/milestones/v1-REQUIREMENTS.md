# Requirements Archive: v1 GSD Subagent Enforcement Hook

**Archived:** 2026-01-30
**Status:** ✅ SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: GSD Subagent Enforcement Hook

**Defined:** 2026-01-29
**Core Value:** GSD commands must delegate to specialized subagents as designed

## v1 Requirements

### Hook Infrastructure

- [x] **HOOK-01**: Hook can be installed globally via `~/.claude/settings.json` — v1
- [x] **HOOK-02**: Hook can be uninstalled cleanly without leaving artifacts — v1
- [x] **HOOK-03**: Hook detects when GSD commands are invoked (UserPromptSubmit) — v1
- [x] **HOOK-04**: Hook tracks Task tool calls to detect subagent spawns (PreToolUse) — v1
- [x] **HOOK-05**: Hook validates subagent completion (SubagentStop) — v1

### Enforcement

- [x] **ENF-01**: Hook blocks turn when expected subagent is not called — v1
- [x] **ENF-02**: Hook provides clear error message indicating what was expected — v1
- [x] **ENF-03**: Hook handles `/gsd:plan-phase` -> must spawn `gsd-planner` — v1
- [x] **ENF-04**: Hook handles `/gsd:quick` -> must use `gsd-executor` — v1
- [x] **ENF-05**: Hook detects "fake parallel" (claims parallel but only one Task) — v1

### Command Mapping

- [x] **MAP-01**: Mapping of GSD command -> expected subagents is maintainable — v1
- [x] **MAP-02**: Command mapping includes subagent type (e.g., gsd-planner, gsd-executor) — v1
- [x] **MAP-03**: Command mapping supports "at least N" parallel calls detection — v1

### Error Handling

- [x] **ERR-01**: Hook fails loudly on internal errors (not silently) — v1
- [x] **ERR-02**: Hook provides actionable remediation guidance when blocking — v1
- [x] **ERR-03**: Hook does not block legitimate non-GSD operations — v1

## v2 Requirements (Deferred)

### Stateful Correlation

- **ST-01**: Cross-event state persistence for complex validation
- **ST-02**: Session-based tracking file for hook state
- **ST-03**: Automatic cleanup of stale state files

### Configuration

- **CFG-01**: Declarative command-map.json for maintainability
- **CFG-02**: Per-project override of global configuration
- **CFG-03**: Hot-reload of configuration without restart

### Enhanced UX

- **UX-01**: Diagnostic command to verify hook status
- **UX-02**: Detailed logging for debugging enforcement decisions
- **UX-03**: Graceful degradation when hook encounters issues

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-fixing (re-injecting Task calls) | Complex and risky; prefer clear error message |
| Non-GSD command enforcement | Focus on GSD orchestrator pattern specifically |
| Performance monitoring | Only subagent call correctness, not general perf |
| LLM-driven intelligent decisions | High cost, high latency; use deterministic rules |
| Input modification | Complex and risky for enforcement use case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOOK-01 | Phase 1 | Complete |
| HOOK-02 | Phase 1 | Complete |
| HOOK-03 | Phase 1 | Complete |
| HOOK-04 | Phase 1 | Complete |
| HOOK-05 | Phase 1 | Complete |
| ENF-01 | Phase 1 | Complete |
| ENF-02 | Phase 1 | Complete |
| ENF-03 | Phase 1 | Complete |
| ENF-04 | Phase 1 | Complete |
| ENF-05 | Phase 2 | Complete |
| MAP-01 | Phase 2 | Complete |
| MAP-02 | Phase 2 | Complete |
| MAP-03 | Phase 2 | Complete |
| ERR-01 | Phase 1 | Complete |
| ERR-02 | Phase 1 | Complete |
| ERR-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 15 total
- Shipped: 15/15 (100%)
- Adjusted: 0
- Dropped: 0

---

## Milestone Summary

**Shipped:** 15 of 15 v1 requirements
**Adjusted:** None
**Dropped:** None

All v1 requirements were implemented as specified. No scope changes during milestone execution.

---
*Archived: 2026-01-30 as part of v1 milestone completion*
