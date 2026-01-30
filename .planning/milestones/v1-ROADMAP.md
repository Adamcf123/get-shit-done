# Milestone v1: GSD Subagent Enforcement Hook

**Status:** ✅ SHIPPED 2026-01-30
**Phases:** 1-2
**Total Plans:** 7

## Overview

This milestone delivers a Claude Code hook system that enforces GSD orchestrator commands to delegate to their required subagents. The system detects when commands like `/gsd:plan-phase` skip spawning `gsd-planner` and blocks the turn with clear remediation guidance. The journey begins with core detection and blocking capabilities using Claude Code's native hook system (UserPromptSubmit, PreToolUse, SubagentStop, Stop), then adds sophisticated detection for complex patterns like "fake parallel" execution and maintainable configuration for evolving GSD commands.

## Phases

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
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Hook 安装/卸载注册基础设施（scripts/build-hooks + install.js）
- [x] 01-02-PLAN.md — GSD 命令检测与 turn 状态机（UserPromptSubmit + Stop fail-closed）
- [x] 01-03-PLAN.md — PreToolUse fail-fast + Task spawn 记录（委托前 deny 非允许工具）
- [x] 01-04-PLAN.md — Stop 端到端强制执行（required_subagent + artifacts + SubagentStop 信号）
- [x] 01-05-PLAN.md — fail-loud 与阻止消息 UX + 真实环境人工验收

**Completed:** 2026-01-30

### Phase 2: Advanced Detection & Configuration

**Goal**: Hook can detect complex deception patterns like "fake parallel" claims and provide maintainable configuration for evolving GSD commands
**Depends on**: Phase 1 (requires working detection and blocking infrastructure)
**Requirements**: ENF-05, MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Hook detects when orchestrator claims "spawning 4 researchers in parallel" but only calls Task once (fake parallel detection)
  2. GSD command -> subagent mapping is declared in maintainable configuration file (not hardcoded)
  3. Configuration supports "at least N" parallel call validation for commands requiring multiple subagents
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — 外置命令映射配置（loadCommandMapping + config.json 模板）
- [x] 02-02-PLAN.md — 假并行检测（extractParallelClaim + validateParallelCalls）

**Completed:** 2026-01-30

---

## Milestone Summary

**Key Decisions:**

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hook skeleton fails loudly by blocking/denying (exit 0 + JSON) on supported events | Prevent silent bypass | ✓ Good |
| Turn state persists in os.tmpdir()/gsd-enforce keyed by session_id | Cross-event correlation | ✓ Good |
| PreToolUse denies any non-allowed tool before delegation | Fail-fast enforcement | ✓ Good |
| Config loaded in each handler (separate processes) | Process isolation | ✓ Good |
| Only block complete deception (claimed N, actual 1); tolerate partial parallel | Avoid over-enforcement | ✓ Good |

**Issues Resolved:**

- Hook installation/uninstallation with idempotent de-duplication
- Turn state persistence across hook events
- Fail-loud error handling with structured error codes
- External command mapping configuration with merge-override semantics
- Fake parallel detection with tolerant validation

**Issues Deferred:**

None.

**Technical Debt Incurred:**

None.

---

_For current project status, see .planning/ROADMAP.md_
_Archived: 2026-01-30 as part of v1 milestone completion_
