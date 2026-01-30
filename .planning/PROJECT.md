# GSD Subagent Enforcement Hook

## What This Is

A Claude Code hook system that detects when GSD orchestrator commands skip their required subagent calls and enforces proper agent delegation. Ensures `/gsd:plan-phase` actually spawns `gsd-planner`, `/gsd:quick` uses `gsd-executor`, and parallel tasks truly execute in parallel.

## Core Value

GSD commands must delegate to specialized subagents as designed — the hook prevents silent bypass that degrades work quality and breaks architectural guarantees.

## Current State (v1 Shipped)

**Version:** v1 (shipped 2026-01-30)
**LOC:** 2699 lines JavaScript
**Tech Stack:** Node.js, Claude Code hooks API

### What's Working

- Hook installation/uninstallation via `~/.claude/settings.json`
- GSD command detection (`/gsd:*` patterns)
- Turn state persistence across hook events
- Subagent delegation enforcement (required vs actual)
- Fake parallel detection (claimed N, actual 1)
- External command mapping configuration
- Fail-loud error handling

## Requirements

### Validated

- ✓ Hook can detect when a GSD command is invoked — v1
- ✓ Hook knows which subagents each GSD command should call — v1
- ✓ Hook detects when expected subagent calls are missing — v1
- ✓ Hook blocks the turn with clear remediation guidance — v1
- ✓ Hook handles "fake parallel" (claims parallel but only one Task) — v1
- ✓ Hook is installed globally for all GSD projects — v1

### Active

(None — v1 complete)

### Out of Scope

- Auto-fixing (re-injecting the correct Task call) — complex and risky
- Non-GSD commands — focus on GSD orchestrator pattern specifically
- Performance monitoring — only subagent call correctness

## Context

GSD (Get Shit Done) uses an orchestrator + subagent architecture:
- Orchestrator prompts define when to spawn which subagent
- Examples: `/gsd:plan-phase` → `gsd-planner`, `/gsd:quick` → `gsd-executor`
- Problem: Main agent often skips subagent and does work directly

Known failure modes (now enforced):
1. `/gsd:plan-phase` writes PLAN.md directly instead of spawning `gsd-planner` → **BLOCKED**
2. `/gsd:quick` modifies code directly instead of using `gsd-executor` → **BLOCKED**
3. Claims "spawning 4 researchers in parallel" but only sends one Task → **BLOCKED**

## Constraints

- **Hook Type**: Must use Claude Code's native hook system ✓
- **Install Location**: Global (`~/.claude/settings.json`) for all GSD projects ✓
- **Configuration**: Mapping of GSD command → expected subagents needs to be maintainable ✓
- **Latency**: Hook execution must be fast (adds minimal overhead) ✓

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Global installation | GSD commands work the same everywhere | ✓ Good |
| End-of-turn check (Stop) + real-time tracking (PreToolUse) | Both needed for complete enforcement | ✓ Good |
| External config file with defaults | Maintainable + backward compatible | ✓ Good |
| Fail-loud on internal errors | Prevent silent bypass | ✓ Good |
| Tolerant parallel validation | Block complete deception, allow partial | ✓ Good |

---
*Last updated: 2026-01-30 after v1 milestone*
