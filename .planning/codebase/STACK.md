# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- JavaScript (ES6+) - Used for all Node.js hooks and installation scripts

**Secondary:**
- Markdown - Used for commands, agents, templates, and documentation
- YAML - Used for frontmatter in command and agent files
- JSON - Used for configuration files (package.json, settings.json, opencode.json)

## Runtime

**Environment:**
- Node.js >= 16.7.0 (required by engines field in package.json)

**Package Manager:**
- npm (native Node.js package manager)
- Lockfile: package-lock.json (lockfileVersion: 3)

## Frameworks

**Core:**
- None (vanilla JavaScript)

**Target Platforms:**
- Claude Code - AI code editor by Anthropic
- OpenCode - Open-source alternative to Claude Code

**Build/Dev:**
- esbuild ^0.24.0 - JavaScript bundler (declared but not actively used - hooks are pure Node.js, just copied to dist/)

## Key Dependencies

**Critical:**
- None (zero runtime dependencies - pure Node.js)

**Development:**
- esbuild ^0.24.0 - JavaScript bundler for potential future bundling needs

## Configuration

**Environment:**
- Node.js environment variables for configuration paths:
  - `CLAUDE_CONFIG_DIR` - Custom Claude Code config directory
  - `OPENCODE_CONFIG_DIR` - Custom OpenCode config directory
  - `OPENCODE_CONFIG` - OpenCode config file path
  - `XDG_CONFIG_HOME` - XDG Base Directory specification for config

**Build:**
- `package.json` - npm package manifest
- `scripts/build-hooks.js` - Simple copy script (no bundling, just copies hooks to dist/)
- `scripts/build:hooks` - npm script to build hooks
- `scripts/prepublishOnly` - npm lifecycle hook to build before publishing

## Platform Requirements

**Development:**
- Node.js >= 16.7.0
- npm (comes with Node.js)
- Git (for version control, not required for runtime)
- Claude Code or OpenCode CLI (target platforms)

**Production:**
- npm registry (for distribution via `npx get-shit-done-cc`)
- Claude Code or OpenCode CLI (where GSD is installed and runs)

---

*Stack analysis: 2026-01-29*