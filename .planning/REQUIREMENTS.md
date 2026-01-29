# Requirements: GSD Subagent Enforcement Hook

**Defined:** 2026-01-29
**Core Value:** GSD commands must delegate to specialized subagents as designed

## v1 Requirements

### Hook Infrastructure

- [ ] **HOOK-01**: Hook can be installed globally via `~/.claude/settings.json`
- [ ] **HOOK-02**: Hook can be uninstalled cleanly without leaving artifacts
- [ ] **HOOK-03**: Hook detects when GSD commands are invoked (UserPromptSubmit)
- [ ] **HOOK-04**: Hook tracks Task tool calls to detect subagent spawns (PreToolUse)
- [ ] **HOOK-05**: Hook validates subagent completion (SubagentStop)

### Enforcement

- [ ] **ENF-01**: Hook blocks turn when expected subagent is not called
- [ ] **ENF-02**: Hook provides clear error message indicating what was expected
- [ ] **ENF-03**: Hook handles `/gsd:plan-phase` → must spawn `gsd-planner`
- [ ] **ENF-04**: Hook handles `/gsd:quick` → must use `gsd-executor`
- [ ] **ENF-05**: Hook detects "fake parallel" (claims parallel but only one Task)

### Command Mapping

- [ ] **MAP-01**: Mapping of GSD command → expected subagents is maintainable
- [ ] **MAP-02**: Command mapping includes subagent type (e.g., gsd-planner, gsd-executor)
- [ ] **MAP-03**: Command mapping supports "at least N" parallel calls detection

### Error Handling

- [ ] **ERR-01**: Hook fails loudly on internal errors (not silently)
- [ ] **ERR-02**: Hook provides actionable remediation guidance when blocking
- [ ] **ERR-03**: Hook does not block legitimate non-GSD operations

## v2 Requirements

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
| HOOK-01 | Phase 1 | Pending |
| HOOK-02 | Phase 1 | Pending |
| HOOK-03 | Phase 1 | Pending |
| HOOK-04 | Phase 1 | Pending |
| HOOK-05 | Phase 1 | Pending |
| ENF-01 | Phase 1 | Pending |
| ENF-02 | Phase 1 | Pending |
| ENF-03 | Phase 1 | Pending |
| ENF-04 | Phase 1 | Pending |
| ENF-05 | Phase 2 | Pending |
| MAP-01 | Phase 2 | Pending |
| MAP-02 | Phase 2 | Pending |
| MAP-03 | Phase 2 | Pending |
| ERR-01 | Phase 1 | Pending |
| ERR-02 | Phase 1 | Pending |
| ERR-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to Phase 1: 12
- Mapped to Phase 2: 3
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after initial definition*
