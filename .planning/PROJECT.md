# GSD Subagent Enforcement Hook

## What This Is

A Claude Code hook system that detects when GSD orchestrator commands skip their required subagent calls and enforces proper agent delegation. Ensures `/gsd:plan-phase` actually spawns `gsd-planner`, `/gsd:quick` uses `gsd-executor`, and parallel tasks truly execute in parallel.

## Core Value

GSD commands must delegate to specialized subagents as designed — the hook prevents silent bypass that degrades work quality and breaks architectural guarantees.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Hook can detect when a GSD command is invoked
- [ ] Hook knows which subagents each GSD command should call
- [ ] Hook detects when expected subagent calls are missing
- [ ] Hook blocks the turn with clear remediation guidance
- [ ] Hook handles "fake parallel" (claims parallel but only one Task)
- [ ] Hook is installed globally for all GSD projects

### Out of Scope

- Auto-fixing (re-injecting the correct Task call) — complex and risky
- Non-GSD commands — focus on GSD orchestrator pattern specifically
- Performance monitoring — only subagent call correctness

## Context

GSD (Get Shit Done) uses an orchestrator + subagent architecture:
- Orchestrator prompts define when to spawn which subagent
- Examples: `/gsd:plan-phase` → `gsd-planner`, `/gsd:quick` → `gsd-executor`
- Problem: Main agent often skips subagent and does work directly

Known failure modes:
1. `/gsd:plan-phase` writes PLAN.md directly instead of spawning `gsd-planner`
2. `/gsd:quick` modifies code directly instead of using `gsd-executor`
3. Claims "spawning 4 researchers in parallel" but only sends one Task

Hook mechanism options to research:
- `Stop` hook: Detects when turn ends without expected subagent calls
- `PreToolUse`/`PostToolUse`: Track Task calls
- `UserPromptSubmit`: Inject context at command start

## Constraints

- **Hook Type**: Must use Claude Code's native hook system
- **Install Location**: Global (`~/.claude/settings.json`) for all GSD projects
- **Configuration**: Mapping of GSD command → expected subagents needs to be maintainable
- **Latency**: Hook execution must be fast (adds minimal overhead)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Global vs project-level | GSD commands work the same everywhere | — Pending |
| Detection timing | End-of-turn check vs real-time tracking | — Pending |
| Configuration source | Hardcoded mapping vs dynamic extraction vs config file | — Pending |

---
*Last updated: 2026-01-29 after initialization*
