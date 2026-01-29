# Phase 1: Core Enforcement Hook - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a Claude Code hook system that detects when any `/gsd:*` orchestrator command is invoked and enforces required subagent delegation.

Enforcement means:
- If the command's expected subagent is not spawned (or expected artifacts are not produced), the hook blocks the turn.
- The hook fails loudly on internal errors (blocks the turn).

</domain>

<decisions>
## Implementation Decisions

### Interception timing
- Fail fast: the **first violation** within a turn must be blocked.
- A violation includes:
  - Any non-Task tool use occurs before spawning the expected subagent.
  - The assistant ends the turn without spawning the expected subagent.

### Success criteria (per command)
- Success requires **both**:
  - Spawn the expected subagent.
  - Produce the expected artifacts.
- Artifact checks are **same-turn**: artifacts must be created within the same turn as the command invocation.

### Coverage scope
- Coverage is **all** `/gsd:*` commands.
- The hook uses an explicit mapping for each `/gsd:*` command.
  - Commands that do not require subagents must be explicitly mapped with `required_subagent = none` (no enforcement).
  - Any unmapped `/gsd:*` command is **blocked by default** (fail-closed).

### Blocking message UX
- Message density: **standard**.
- The blocking message must instruct the main assistant to use the `Task` tool (no need to include a full copy-paste Task call snippet).

### Fail-loud policy
- Any internal hook error (state corruption, parse failure, IO issues) must block the turn.

### Command artifacts (by mapping)
- Artifact validation is defined per-command in the mapping.
- Commands may define `expected_artifacts = none`.

### Claude's Discretion
- Exact wording of the standard block message, as long as it clearly instructs using `Task`.
- Exact artifact glob patterns per command (as long as they are explicit and deterministic).

</decisions>

<specifics>
## Specific Ideas

- Fail-closed for unmapped `/gsd:*` ensures new orchestrators cannot silently bypass delegation.
- Violation definition focuses on preventing the main assistant from doing any other work before delegation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-core-enforcement-hook*
*Context gathered: 2026-01-29*
