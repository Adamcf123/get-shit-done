# Roadmap: GSD Subagent Enforcement Hook

## Overview

This roadmap delivers a Claude Code hook system that enforces GSD orchestrator commands to delegate to their required subagents. The system detects when commands like `/gsd:plan-phase` skip spawning `gsd-planner` and blocks the turn with clear remediation guidance. The journey begins with core detection and blocking capabilities using Claude Code's native hook system (UserPromptSubmit, PreToolUse, SubagentStop), then adds sophisticated detection for complex patterns like "fake parallel" execution and maintainable configuration for evolving GSD commands.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Enforcement Hook** - Detect GSD commands and block when expected subagents are not called
- [ ] **Phase 2: Advanced Detection & Configuration** - Detect complex patterns and maintainable command mappings

## Phase Details

### Phase 1: Core Enforcement Hook
**Goal**: Hook can detect GSD commands and block when expected subagents are not called, preventing silent bypass of architectural guarantees
**Depends on**: Nothing (first phase)
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, ENF-01, ENF-02, ENF-03, ENF-04, ERR-01, ERR-02, ERR-03
**Success Criteria** (what must be TRUE):
  1. User can install hook globally via `~/.claude/settings.json` and it persists across Claude Code restarts
  2. Hook detects when user invokes `/gsd:plan-phase` or `/gsd:quick` commands
  3. Hook tracks Task tool calls and validates expected subagent types (gsd-planner, gsd-executor)
  4. When `/gsd:plan-phase` skips spawning `gsd-planner`, hook blocks the turn with error message explaining what was expected
  5. Hook fails loudly on internal errors (crash produces blocking error, not silent failure)
**Plans**: TBD

Plans:
- [ ] 01-01: Hook installation and registration infrastructure
- [ ] 01-02: GSD command detection (UserPromptSubmit event handling)
- [ ] 01-03: Subagent spawn tracking (PreToolUse Task interception)
- [ ] 01-04: Validation and blocking logic (SubagentStop enforcement)
- [ ] 01-05: Error handling and remediation messaging

### Phase 2: Advanced Detection & Configuration
**Goal**: Hook can detect complex deception patterns like "fake parallel" claims and provide maintainable configuration for evolving GSD commands
**Depends on**: Phase 1 (requires working detection and blocking infrastructure)
**Requirements**: ENF-05, MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Hook detects when orchestrator claims "spawning 4 researchers in parallel" but only calls Task once (fake parallel detection)
  2. GSD command -> subagent mapping is declared in maintainable configuration file (not hardcoded)
  3. Configuration supports "at least N" parallel call validation for commands requiring multiple subagents
**Plans**: TBD

Plans:
- [ ] 02-01: Command mapping configuration (command-map.json structure)
- [ ] 02-02: Parallel execution detection logic (analyzing Task call patterns)
- [ ] 02-03: Configuration validation and hot-reload support

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Enforcement Hook | 0/5 | Not started | - |
| 2. Advanced Detection & Configuration | 0/3 | Not started | - |
