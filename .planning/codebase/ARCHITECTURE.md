# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Multi-Agent Orchestrator System with Template-Based Prompt Engineering

**Key Characteristics:**
- Orchestrator agents coordinate specialized subagents for each workflow stage
- Subagents operate in fresh context windows to prevent quality degradation
- Documents are prompts, not documentation - XML-structured plans directly execute
- Context engineering through standardized file types and templates
- State management via `.planning/` directory with git integration

## Layers

**Orchestration Layer:**
- Purpose: Thin coordinators that spawn specialized agents, collect results, route to next step
- Location: `commands/gsd/*.md`, `get-shit-done/workflows/*.md`
- Contains: Workflow definitions, agent spawning logic, result collection
- Depends on: Agent definitions, templates, reference documents
- Used by: Claude Code/OpenCode runtime via slash commands

**Agent Layer:**
- Purpose: Specialized subagents with focused responsibilities (planner, executor, verifier, researcher, etc.)
- Location: `agents/*.md`
- Contains: Agent role definitions, capabilities, process instructions
- Depends on: Orchestrator to spawn them, templates for output format
- Used by: Orchestrators via Task tool with `subagent_type`

**Template Layer:**
- Purpose: Standardized output formats that serve as executable prompts
- Location: `get-shit-done/templates/`
- Contains: Project.md, requirements.md, phase-prompt.md, research templates, verification templates
- Depends on: Reference documents for best practices
- Used by: Agents for structuring output

**Reference Layer:**
- Purpose: Cross-cutting guidance, configuration patterns, verification standards
- Location: `get-shit-done/references/`
- Contains: Model profiles, planning config, checkpoints, TDD patterns, verification patterns
- Depends on: None (foundational knowledge)
- Used by: All agents and orchestrators

**Infrastructure Layer:**
- Purpose: Installation, hooks, build tooling
- Location: `bin/install.js`, `hooks/*.js`, `scripts/*.js`
- Contains: Installer script, statusline hooks, update checker, build scripts
- Depends on: Node.js runtime
- Used by: Installation process and runtime hooks

## Data Flow

**New Project Flow:**

1. User invokes `/gsd:new-project` → Orchestrator checks for existing code, offers codebase mapping
2. Deep questioning phase → Orchestrator asks questions until project vision is clear
3. (Optional) Parallel research → Orchestrator spawns 4 gsd-project-researcher agents in parallel
4. Requirements extraction → Orchestrator derives v1/v2/out-of-scope from research and questioning
5. Roadmap creation → Orchestrator creates phases mapped to requirements
6. Git initialization → Local git repo created for project tracking

**Phase Execution Flow:**

1. `/gsd:discuss-phase` → Orchestrator identifies gray areas, captures user decisions to CONTEXT.md
2. `/gsd:plan-phase` → Orchestrator spawns gsd-phase-researcher (optional), then gsd-planner
3. Planner creates atomic plans → XML-structured PLAN.md files with 2-3 tasks each
4. Plan checker verification → gsd-plan-checker validates plans against goals, loops until pass
5. `/gsd:execute-phase` → Orchestrator groups plans into dependency waves, spawns gsd-executor agents
6. Executors implement → Each executor loads full context, implements tasks, commits per task
7. `/gsd:verify-work` → gsd-verifier checks codebase against goals, generates UAT checklist
8. User acceptance → Manual testing with automated issue diagnosis if failures found

**Codebase Mapping Flow:**

1. `/gsd:map-codebase` → Orchestrator spawns 4 parallel gsd-codebase-mapper agents
2. Each mapper explores focus area (tech/arch/quality/concerns) and writes documents directly
3. Orchestrator collects confirmations (file paths + line counts, not contents)
4. Documents committed to git for use by future planning/execution

**State Management:**

- `.planning/STATE.md` - Project memory: current position, accumulated decisions, blockers
- `.planning/config.json` - Workflow preferences: mode (yolo/interactive), depth, model profile, gates
- `.planning/PROJECT.md` - Living project context: vision, requirements, constraints, decisions
- `.planning/ROADMAP.md` - Phase structure with completion tracking
- `.planning/phases/{NN}-{name}/` - Per-phase artifacts: CONTEXT.md, RESEARCH.md, *-PLAN.md, *-SUMMARY.md

## Key Abstractions

**Plans as Prompts:**
- Purpose: PLAN.md files ARE prompts, not documents that become prompts
- Examples: `.planning/phases/*/PLAN.md`
- Pattern: XML-structured with `<task>`, `<objective>`, `<context>`, `<verify>`, `<done>` tags

**Model Profiles:**
- Purpose: Balance quality vs token cost by selecting appropriate Claude model per agent type
- Examples: `get-shit-done/references/model-profiles.md`
- Pattern: Profile table (quality/balanced/budget) × Agent type → Model choice (opus/sonnet/haiku)

**Checkpoints:**
- Purpose: Formalize human verification points in autonomous execution flows
- Examples: `get-shit-done/references/checkpoints.md`
- Pattern: `<task type="checkpoint:human-verify">` with what-built, how-to-verify, resume-signal

**Context Engineering:**
- Purpose: Prevent quality degradation from context window pressure
- Examples: All template files with size limits and structured sections
- Pattern: Each document serves specific purpose, loaded by relevant agents only

**Atomic Commits:**
- Purpose: Every task gets its own traceable commit for bisectability and history
- Examples: `.planning/phases/*/*-SUMMARY.md` documents what was committed
- Pattern: Conventional commit format with date and plan reference

## Entry Points

**Installer Entry Point:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc` or `node bin/install.js`
- Responsibilities: Runtime selection (Claude/OpenCode/both), location selection (global/local), file copying to `.claude/` or `.opencode/`, hook installation

**Slash Commands:**
- Location: `commands/gsd/*.md`
- Triggers: User types `/gsd:*` in Claude Code/OpenCode interface
- Responsibilities: Command-specific workflows that reference orchestrator patterns

**Workflow Orchestrators:**
- Location: `get-shit-done/workflows/*.md`
- Triggers: Slash commands load and execute workflow definitions
- Responsibilities: Agent spawning, result collection, routing to next step

**Subagent Entry Points:**
- Location: `agents/*.md`
- Triggers: Orchestrator calls Task tool with `subagent_type`
- Responsibilities: Specialized work with fresh context, write output directly

**Hooks:**
- Location: `hooks/dist/gsd-statusline.js`, `hooks/dist/gsd-check-update.js`
- Triggers: Runtime environment loads hooks on startup
- Responsibilities: Statusline display (model | task | directory | tokens%), update checking

## Error Handling

**Strategy:** Fail-loud with clear error messages and recovery paths

**Patterns:**
- Pre-flight checks: Abort early if project already initialized, if phase doesn't exist, if git repo missing
- Error classification: SystemFault vs UserFault (from FALLBACK_POLICY reference)
- Graceful degradation: If optional agent fails (e.g., researcher), continue with available information
- Checkpoint recovery: `continue-here.md` templates document state for handoff/resume

**Validation Gates:**
- Plan checker validates plans achieve phase goals before execution
- Verifier confirms codebase delivers promised functionality after execution
- Integration checker validates external service connections
- User acceptance testing (UAT) as final verification gate

## Cross-Cutting Concerns

**Logging:** Minimal - agents write structured output to files, not console logs
**Validation:** Multi-layer - plan validation, goal verification, integration checks, UAT
**Authentication:** Not applicable (local development tool)
**State Persistence:** File-based in `.planning/` directory with git integration
**Configuration:** `.planning/config.json` per-project, model profiles, workflow agent toggles
**Modularity:** Commands, agents, workflows, templates, references all separable and replaceable

---

*Architecture analysis: 2026-01-29*
