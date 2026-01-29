# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
get-shit-done/
├── agents/                    # Specialized subagent definitions
├── bin/                       # Entry point installer script
├── commands/                  # Slash command definitions for Claude/OpenCode
├── get-shit-done/             # Core runtime files
│   ├── references/           # Cross-cutting guidance and patterns
│   ├── templates/            # Standardized output format templates
│   └── workflows/            # Orchestrator workflow definitions
├── hooks/                    # Runtime hooks (statusline, update checker)
│   └── dist/                 # Built hook files
├── scripts/                  # Build and utility scripts
├── .planning/                # Project state (created per user project)
└── package.json              # NPM package manifest
```

## Directory Purposes

**agents/:**
- Purpose: Subagent role definitions with focused responsibilities
- Contains: Agent specifications (planner, executor, verifier, researcher, debugger, mapper, etc.)
- Key files: `agents/gsd-planner.md`, `agents/gsd-executor.md`, `agents/gsd-verifier.md`, `agents/gsd-codebase-mapper.md`

**bin/:**
- Purpose: Installation entry point for NPM distribution
- Contains: `install.js` - interactive installer script
- Key files: `bin/install.js`

**commands/:**
- Purpose: User-facing slash commands for Claude Code/OpenCode interface
- Contains: Command definitions that reference workflow orchestrators
- Key files: `commands/gsd/new-project.md`, `commands/gsd/plan-phase.md`, `commands/gsd/execute-phase.md`, `commands/gsd/verify-work.md`

**get-shit-done/references/:**
- Purpose: Cross-cutting guidance, configuration patterns, verification standards
- Contains: Model profiles, planning config, checkpoints, TDD patterns, verification patterns, git integration
- Key files: `get-shit-done/references/model-profiles.md`, `get-shit-done/references/checkpoints.md`, `get-shit-done/references/verification-patterns.md`

**get-shit-done/templates/:**
- Purpose: Standardized output formats that serve as executable prompts
- Contains: Project templates, phase templates, research templates, verification templates
- Key files: `get-shit-done/templates/project.md`, `get-shit-done/templates/requirements.md`, `get-shit-done/templates/phase-prompt.md`, `get-shit-done/templates/summary.md`

**get-shit-done/workflows/:**
- Purpose: Orchestrator workflow definitions (process instructions for commands)
- Contains: Detailed step-by-step workflows for each command
- Key files: `get-shit-done/workflows/execute-phase.md`, `get-shit-done/workflows/map-codebase.md`, `get-shit-done/workflows/verify-work.md`

**hooks/:**
- Purpose: Runtime hooks for Claude Code/OpenCode environment
- Contains: Source hook files
- Key files: `hooks/gsd-statusline.js`, `hooks/gsd-check-update.js`

**hooks/dist/:**
- Purpose: Built hook files (copied from source by `npm run build:hooks`)
- Contains: Production hook files
- Generated: Yes (from hooks/ source)

**scripts/:**
- Purpose: Build and utility scripts
- Contains: `build-hooks.js` - copies hooks to dist directory
- Key files: `scripts/build-hooks.js`

**.planning/:**
- Purpose: Project state directory (created in user's project, not in GSD repo)
- Contains: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json, phases/, research/, codebase/, quick/
- Generated: Yes (per user project)

## Key File Locations

**Entry Points:**
- `bin/install.js`: NPM installer entry point
- `commands/gsd/new-project.md`: Project initialization command
- `commands/gsd/quick.md`: Quick mode for ad-hoc tasks
- `hooks/dist/gsd-statusline.js`: Runtime statusline hook

**Configuration:**
- `get-shit-done/templates/config.json`: Default project configuration template
- `.claude/settings.json`: Claude Code settings (installed per project)
- `.planning/config.json`: Per-project workflow configuration (user project)

**Core Logic:**
- `agents/gsd-planner.md`: Planning agent (creates atomic task plans)
- `agents/gsd-executor.md`: Execution agent (implements plans with fresh context)
- `agents/gsd-verifier.md`: Verification agent (checks codebase against goals)
- `agents/gsd-codebase-mapper.md`: Codebase analysis agent (4 focus areas)

**Testing:**
- `get-shit-done/references/tdd.md`: Test-driven development patterns
- `get-shit-done/references/verification-patterns.md`: Verification standards

**Documentation:**
- `README.md`: User-facing documentation
- `AGENTS.md`: Agent catalog
- `CHANGELOG.md`: Version history

## Naming Conventions

**Files:**
- Commands: `gsd-{verb}-{noun}.md` (e.g., `new-project.md`, `plan-phase.md`, `execute-phase.md`)
- Agents: `gsd-{role}.md` (e.g., `gsd-planner.md`, `gsd-executor.md`, `gsd-verifier.md`)
- Workflows: `{action}-{entity}.md` (e.g., `execute-phase.md`, `map-codebase.md`, `verify-work.md`)
- Templates: `{entity}.md` (e.g., `project.md`, `requirements.md`, `summary.md`)
- Hooks: `gsd-{function}.js` (e.g., `gsd-statusline.js`, `gsd-check-update.js`)

**Directories:**
- Agent directory: `agents/` (flat, no subdirectories)
- Command directory: `commands/gsd/` (grouped by `gsd` prefix)
- Template directory: `get-shit-done/templates/` and `get-shit-done/templates/research-project/`
- Reference directory: `get-shit-done/references/`

**Phase Directories:**
- Format: `{NN}-{slug}/` where NN is zero-padded phase number
- Examples: `01-authentication/`, `05-user-profile/`, `12-admin-dashboard/`

**Plan Files:**
- Format: `{NN}-{slug}-PLAN.md` where NN is plan number within phase
- Examples: `01-PLAN.md`, `02-PLAN.md`, `03-PLAN.md`

**Summary Files:**
- Format: `{NN}-{slug}-SUMMARY.md` matches corresponding PLAN.md
- Examples: `01-SUMMARY.md`, `02-SUMMARY.md`

## Where to Add New Code

**New Slash Command:**
- Primary code: `commands/gsd/{command-name}.md`
- Workflow: `get-shit-done/workflows/{command-name}.md` (if complex orchestration needed)

**New Agent Type:**
- Definition: `agents/gsd-{agent-name}.md`
- Model profile: Add row to `get-shit-done/references/model-profiles.md`

**New Template:**
- Project template: `get-shit-done/templates/{name}.md`
- Research template: `get-shit-done/templates/research-project/{name}.md`

**New Workflow:**
- Implementation: `get-shit-done/workflows/{workflow-name}.md`

**New Hook:**
- Source: `hooks/gsd-{hook-name}.js`
- Add to build: `scripts/build-hooks.js` (add to HOOKS_TO_COPY array)

**Utilities:**
- Build scripts: `scripts/{script-name}.js`
- Install helpers: `bin/install.js` (add new functions)

## Special Directories

**agents/:**
- Purpose: Subagent definitions loaded by Claude/OpenCode runtime
- Generated: No (human-authored)
- Committed: Yes (tracked in git)

**hooks/dist/:**
- Purpose: Built hook files for distribution
- Generated: Yes (from hooks/ source files)
- Committed: Yes (included in NPM package via files array)

**.planning/:**
- Purpose: User project state (not in GSD repo)
- Generated: Yes (created per user project)
- Committed: No (lives in user's project, optionally committed based on config)

**get-shit-done/:**
- Purpose: Core runtime files for distribution
- Generated: No (human-authored templates and references)
- Committed: Yes (tracked in git)

**node_modules/:**
- Purpose: NPM dependencies (esbuild for building hooks)
- Generated: Yes (from npm install)
- Committed: No (gitignored)

---

*Structure analysis: 2026-01-29*
