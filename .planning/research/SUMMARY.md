# Project Research Summary

**Project:** GSD Subagent Enforcement Hook
**Domain:** Claude Code Hook System
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

This is a Claude Code hook system that enforces architectural invariants for the GSD orchestrator pattern. The system must detect when GSD commands skip their required subagent calls and block the turn with clear remediation guidance. Experts build this using Claude Code's native hook system (PreToolUse, SubagentStop, UserPromptSubmit events) with stateful tracking via file-based state stores and JSON-based configuration.

The recommended approach uses a three-hook pattern: UserPromptSubmit to detect GSD command invocation, PreToolUse with Task matcher to track subagent spawns, and SubagentStop to validate expected vs actual subagent calls. State is persisted in `~/.claude/hooks/gsd-state.json` for cross-event correlation, and expectations are declared in `command-map.json` for maintainability. The hook reads the orchestrator-written `agent-history.json` to validate actual behavior.

Key risks include hook state corruption in long sessions (after ~2.5 hours), silent failures where hooks crash without blocking operations, and performance overhead from synchronous execution on every user message. Mitigation strategies: design hooks as stateless where possible, implement fail-loud error handling that blocks on critical violations, use async execution for non-critical paths, and implement health checks before hook execution.

## Key Findings

### Recommended Stack

Claude Code's native hook system provides the complete foundation for GSD subagent enforcement. The system uses stdin/stdout JSON communication with hooks registered in `settings.json`. Node.js is the implementation language (matching existing GSD hooks like `gsd-statusline.js` and `gsd-check-update.js`). State persistence uses JSON files, and configuration uses declarative mappings.

**Core technologies:**
- **Claude Code Hooks (Native)**: Event-driven automation system — Built-in mechanism for extending Claude Code behavior with shell commands; ensures deterministic execution unlike LLM prompting
- **Node.js**: Hook implementation language — Matches existing GSD patterns, provides robust JSON handling and file I/O
- **settings.json**: Hook configuration — Standard configuration location; supports per-project and global scoping
- **JSON state files**: State persistence — Simple, reliable cross-event correlation without external dependencies

### Expected Features

GSD subagent enforcement requires a specific subset of hook capabilities. The table stakes are critical for any functional enforcement system, while differentiators provide enhanced user experience and flexibility.

**Must have (table stakes):**
- **Event triggering**: Hooks must fire at specific lifecycle points (UserPromptSubmit, PreToolUse, SubagentStop) — users expect this from any hook system
- **Tool interception**: Must intercept Task tool calls to track subagent spawns — core requirement for enforcement
- **Blocking ability**: Exit code 2 or JSON decision must prevent turn completion — security checks must be able to block
- **Context access**: Hooks need access to session_id, prompt, tool_input — essential for validation logic
- **Matcher support**: Must match specific tools (Task) for targeted interception — prevents false positives

**Should have (competitive):**
- **Subagent awareness**: SubagentStart/SubagentStop events provide direct subagent tracking — eliminates need to infer from Task tool
- **Stateful tracking**: Cross-event correlation enables complex validation scenarios — critical for detecting missing subagents
- **Declarative mapping**: command-map.json separates configuration from logic — maintainable as GSD evolves
- **JSON output control**: Fine-grained decision control (allow/deny/ask) — better user experience than simple exit codes

**Defer (v2+):**
- **Prompt-based hooks**: LLM-driven intelligent decisions — high cost, high latency, not needed for deterministic validation
- **Input modification**: updatedInput functionality to modify tool parameters — complex and risky for enforcement use case
- **Component-scoped hooks**: Skills/Subagents with local hooks — GSD uses global enforcement pattern

### Architecture Approach

The recommended architecture uses an event-driven enforcement pattern with stateful tracking. The system consists of three main components: Hook Runtime (executes hooks at lifecycle points), Agent Tracking (records spawned subagent IDs in `agent-history.json`), and Enforcement Hook (validates expected vs actual subagent calls). State is persisted in `~/.claude/hooks/gsd-state.json` for cross-event correlation, and expectations are declared in `command-map.json` for maintainability.

**Major components:**
1. **Hook Runtime** — Executes hooks at lifecycle points, provides JSON input/output via stdin/stdout — Native Claude Code infrastructure
2. **Agent Tracking** — Records spawned subagent IDs, types, timestamps for validation — Orchestrator writes to `.planning/agent-history.json`
3. **Enforcement Hook** — Validates expected vs actual subagent calls, blocks when mismatch detected — `hooks/gsd-enforce.js` registered to SubagentStop event
4. **State Store** — Per-session tracking file for hook state — `~/.claude/hooks/gsd-state.json` for correlation across events

### Critical Pitfalls

Based on GitHub issues and community reports, these are the most critical pitfalls to avoid:

1. **Hook state corruption in long sessions** — After ~2.5 hours, hooks randomly fail with "No such file or directory" despite files existing. Design hooks as stateless where possible, minimize execution time, implement health checks, and use process pooling rather than spawning new processes.

2. **Silent hook failures** — Hook crashes are non-fatal; Claude Code continues but skips failed hooks. Implement fail-loud design with explicit error handling, return clear error codes and messages, and use Stop hook to report critical violations to user.

3. **Multi-hook conflicts** — Multiple hook types (PreToolUse, PostToolUse, Stop) can conflict during command cancellation scenarios. Apply single responsibility principle, use idempotent design, implement coordination via shared state files, and explicitly define hook priority and execution order.

4. **Performance overhead** — UserPromptSubmit runs on every message, adding latency that accumulates over long sessions. Use async execution for non-critical hooks, conditional execution (only when GSD command detected), cache results, set performance budgets (50ms limit), and monitor execution time.

5. **Configuration conflicts** — Global and project-level hooks may not load correctly in some versions. Define clear configuration hierarchy, implement validation at startup, hardcode critical config in hook code, add diagnostic commands, and document known limitations.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Detection & Validation
**Rationale:** This establishes the foundation for enforcement by detecting GSD commands and validating subagent calls. The three-hook pattern (UserPromptSubmit → PreToolUse → SubagentStop) covers the complete delegation lifecycle and addresses the core requirement from PROJECT.md.
**Delivers:** Basic command detection, subagent tracking, and validation blocking
**Addresses:** Event triggering, tool interception, blocking ability, context access (FEATURES.md table stakes)
**Avoids:** Hook state corruption, silent failures, performance overhead (PITFALLS.md #1, #2, #4)

### Phase 2: Stateful Correlation & Configuration
**Rationale:** Once basic validation works, add state management for cross-event correlation and declarative configuration for maintainability. This builds on Phase 1's validation logic and enables complex scenarios like parallel execution detection.
**Delivers:** State persistence, cross-event tracking, declarative command mappings
**Uses:** JSON state files, command-map.json (STACK.md)
**Implements:** Agent Tracking, State Store components (ARCHITECTURE.md)
**Avoids:** Multi-hook conflicts, configuration conflicts (PITFALLS.md #3, #5)

### Phase 3: Enhanced UX & Error Handling
**Rationale:** With core enforcement working, improve user experience through helpful error messages, diagnostic capabilities, and refined detection logic to reduce false positives.
**Delivers:** Detailed error guidance, diagnostic commands, precise detection rules
**Implements:** JSON output control, reporter utilities (FEATURES.md should-have)
**Avoids:** False positives blocking legitimate operations (PITFALLS.md #6)

### Phase Ordering Rationale

- **Phase 1 first**: Establishes the minimal enforcement capability; without it, no other features are useful. The three-hook pattern (UserPromptSubmit, PreToolUse, SubagentStop) is the smallest working system that validates the core concept.
- **Phase 2 second**: Builds on Phase 1's validation logic to add statefulness. Cannot be done in Phase 1 because state management adds complexity that could mask fundamental issues with the detection logic.
- **Phase 3 last**: UX improvements depend on having a working enforcement system to improve. Cannot be done earlier because error messages and diagnostics need real violation scenarios to be meaningful.
- **Grouping by architecture**: Phase 1 (Hook Runtime + Enforcement Hook), Phase 2 (Agent Tracking + State Store), Phase 3 (Reporter + Diagnostics) follows the natural component boundaries defined in ARCHITECTURE.md.
- **Pitfall avoidance**: Phase 1 addresses the most critical pitfalls (state corruption, silent failures, performance) before they can impact later phases. Phase 2 addresses multi-hook conflicts and configuration issues once multiple components exist.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2**: Complex state management across events — needs `/gsd:research-phase` for state persistence patterns and edge cases (concurrent sessions, stale state cleanup)
- **Phase 3**: Detection logic refinement — needs `/gsd:research-phase` for false positive reduction strategies in complex workflows (nested delegations, optional subagents)

Phases with standard patterns (skip research-phase):
- **Phase 1**: Well-documented hook events and JSON I/O patterns — official docs provide complete examples
- **Phase 2**: Standard file-based state persistence — established pattern in existing GSD hooks

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Claude Code documentation provides complete reference; existing GSD hooks demonstrate proven patterns |
| Features | HIGH | Official hooks docs enumerate all capabilities; community examples validate feature expectations |
| Architecture | HIGH | Official docs and existing GSD hooks provide clear patterns; three-hook pattern is well-established |
| Pitfalls | HIGH | GitHub issues (HIGH confidence sources) document real failures; community reports validate patterns |

**Overall confidence:** HIGH

All research areas are supported by official documentation and real-world failure reports. The three-hook pattern (UserPromptSubmit → PreToolUse → SubagentStop) is directly documented in STACK.md and validated against GSD's existing implementation patterns. Critical pitfalls are documented in GitHub issues with concrete reproduction steps and workarounds.

### Gaps to Address

Minor areas where research was inconclusive:

- **Long-session stability**: Research documents hook failures after ~2.5 hours but doesn't provide proven mitigation strategies. Handle during Phase 1 implementation by testing with simulated long sessions and implementing restart mechanisms if needed.
- **Parallel execution detection**: Research identifies the need to detect "fake parallel" (claims parallel but only one Task) but doesn't specify exact detection logic. Handle during Phase 2 by analyzing agent-history.json entry patterns and timestamps.
- **Configuration loading bugs**: Research notes project-level hooks may not load in some versions. Handle during Phase 2 by implementing startup validation and diagnostic commands to verify hook registration.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) — Official hook documentation with examples
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — Complete hook event reference and JSON schemas
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices) — Official Anthropic best practices
- GSD existing hooks: `hooks/gsd-statusline.js`, `hooks/gsd-check-update.js` — Proven implementation patterns
- GSD installer: `bin/install.js` — Hook registration pattern
- GSD orchestrator: `workflows/execute-plan.md` — agent-history.json writes

### Secondary (MEDIUM confidence)
- [GitHub Issue #16047](https://github.com/anthropics/claude-code/issues/16047) — Hooks stop executing after ~2.5 hours (Jan 2, 2026)
- [GitHub Issue #13193](https://github.com/anthropics/claude-code/issues/13193) — PreToolUse/PostToolUse hooks fail mid-session (Dec 6, 2025)
- [GitHub Issue #10808](https://github.com/anthropics/claude-code/issues/10808) — Hook failures produce no autonomous message (Nov 1, 2025)
- [GitHub Issue #4113](https://github.com/anthropics/claude-code/issues/4113) — Hook execution failure with multiple hook types (Jul 22, 2025)
- [Claude Code Hooks: A Practical Guide (DataCamp)](https://www.datacamp.com/tutorial/claude-code-hooks) — Recent tutorial with workflow examples (Jan 19, 2026)

### Tertiary (LOW confidence)
- [Claude Code Hooks from beginner to practice (Chinese, zhihu.com)](https://zhuanlan.zhihu.com/p/1969164730326324920) — Community examples, needs validation against official docs
- [Hooks Reference (claude-cn.org Chinese translation)](https://www.claude-cn.org/claude-code-docs-zh/reference/hooks) — Comprehensive reference, translation accuracy needs verification

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*