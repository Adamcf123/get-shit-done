# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**Version Checking:**
- npm registry - Check for GSD updates
  - Command: `npm view get-shit-done-cc version` (via `execSync` in `hooks/gsd-check-update.js:45`)
  - Purpose: Background update checking on session start
  - Timeout: 10 seconds
  - No auth required (public registry)
  - Cache file: `~/.claude/cache/gsd-update-check.json`

**Community:**
- Discord server - Community support
  - URL: https://discord.gg/5JJgD5svVS
  - Purpose: Community support and discussions
  - No API integration - informational only

## Data Storage

**Databases:**
- None (no database usage)

**File Storage:**
- Local filesystem only
- GSD state files:
  - `~/.claude/todos/` - Todo tracking (JSON files)
  - `~/.claude/cache/` - Cache files (update checks, etc.)
  - `~/.claude/projects/` - Project-specific data
- For OpenCode:
  - `~/.config/opencode/` - OpenCode config directory
  - `~/.config/opencode/opencode.json` - OpenCode permissions config

**Caching:**
- Local JSON files for update check caching
- Location: `~/.claude/cache/gsd-update-check.json`

## Authentication & Identity

**Auth Provider:**
- None (no authentication system)
- GSD is installed locally and runs within the user's Claude Code/OpenCode environment

**Platform-Specific Config:**
- Claude Code: `settings.json` (hooks, statusline configuration)
- OpenCode: `opencode.json` (permissions configuration)
  - Read permissions for GSD docs: `~/.config/opencode/get-shit-done/*`
  - External directory permissions for path safety

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)

**Logs:**
- Console output for hooks
- Silent failure pattern in statusline hook (errors don't break terminal)
- File-based state tracking via JSON

**Telemetry:**
- None (no usage analytics or telemetry)

## CI/CD & Deployment

**Hosting:**
- npm registry (https://www.npmjs.com/package/get-shit-done-cc)
- Installation method: `npx get-shit-done-cc`
- GitHub repository: https://github.com/glittercowboy/get-shit-done

**CI Pipeline:**
- No CI/CD pipeline detected
- Manual publishing to npm (npm publish)
- GitHub Actions workflow removed (see commit 339e911 "chore: remove GitHub Actions release workflow")

**Release Automation:**
- MAINTAINERS.md mentions npm automation
- Uses `NPM_TOKEN` for publishing
- Version management via `package.json`

## Environment Configuration

**Required env vars:**
None for runtime

**Optional env vars:**
- `CLAUDE_CONFIG_DIR` - Custom Claude Code config directory
- `OPENCODE_CONFIG_DIR` - Custom OpenCode config directory
- `OPENCODE_CONFIG` - OpenCode config file path
- `XDG_CONFIG_HOME` - XDG Base Directory spec for config

**Secrets location:**
- No secrets used by GSD itself
- User's API keys stored in their project's environment (not managed by GSD)

## Webhooks & Callbacks

**Incoming:**
- None (no webhook endpoints)

**Outgoing:**
- None (no outgoing webhook calls)

**Hooks (Platform-specific):**
- Claude Code hooks:
  - `SessionStart` - Runs `gsd-check-update.js` on session start
  - `statusLine` - Runs `gsd-statusline.js` for terminal status display
- OpenCode: Different hook system (not configured by GSD)

## Target Platforms

**Claude Code:**
- Installation target (primary)
- Command namespace: `/gsd:*`
- Config location: `~/.claude/` or project-local `./.claude/`

**OpenCode:**
- Installation target (secondary)
- Command namespace: `/gsd-*` (flat structure)
- Config location: `~/.config/opencode/` or project-local `./.opencode/`

## Installation & Distribution

**npm Package:**
- Package name: `get-shit-done-cc`
- Entry point: `bin/install.js`
- Distribution: npm public registry
- Zero runtime dependencies

**Installation Paths:**
- Global Claude Code: `~/.claude/commands/gsd/`, `~/.claude/agents/`, `~/.claude/get-shit-done/`, `~/.claude/hooks/`
- Local Claude Code: `./.claude/` (same structure)
- Global OpenCode: `~/.config/opencode/command/gsd-*`, `~/.config/opencode/agents/gsd-*.md`, `~/.config/opencode/get-shit-done/`
- Local OpenCode: `./.opencode/` (same structure)

---

*Integration audit: 2026-01-29*