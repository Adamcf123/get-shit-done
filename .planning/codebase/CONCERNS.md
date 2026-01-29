# Codebase Concerns

**Analysis Date:** 2025-01-29

## Tech Debt

**Silent error handling:**
- Issue: Multiple catch blocks with empty error handling (`catch (e) {}`) suppress errors without logging
- Files: `hooks/gsd-statusline.js:52,158,171`, `hooks/gsd-check-update.js:41,46`, `bin/install.js:718`
- Impact: Errors are silently swallowed, making debugging extremely difficult when things fail
- Fix approach: Add minimal logging to all catch blocks: `catch (e) { console.error('[context]', e.message); }`

**No exit code validation:**
- Issue: `bin/install.js:718` has catch block that ignores JSON parse errors in `opencode.json`
- Files: `bin/install.js:718`
- Impact: Corrupted config files cause silent failures instead of visible errors
- Fix approach: Add error logging, consider failing fast on invalid config

**Large monolithic files:**
- Issue: Several files exceed 1000 lines (`bin/install.js` - 1292 lines, `agents/gsd-planner.md` - 1386 lines)
- Files: `bin/install.js`, `agents/gsd-planner.md`, `agents/gsd-debugger.md` (1203 lines)
- Impact: Difficult to navigate, maintain, and test; increases cognitive load
- Fix approach: Consider modularizing install.js into separate modules (install logic, uninstall, OpenCode integration)

**Incomplete empty return pattern:**
- Issue: Code uses `return null` and empty returns in error cases (`hooks/gsd-statusline.js:34,36,54,56`)
- Files: `hooks/gsd-statusline.js`, `bin/install.js:126,210,213`
- Impact: Callers get null/empty values with no indication of failure, leading to silent failures downstream
- Fix approach: Either throw errors for genuine failures or use Result type pattern (Ok/Error)

## Known Bugs

**Statusline crashes transcript parsing:**
- Symptoms: Statusline shows `?` token usage or fails to render when transcript JSONL is malformed
- Files: `hooks/gsd-statusline.js:33-58`
- Trigger: Non-JSON lines in transcript file, unexpected JSON structure
- Workaround: None - statusline silently fails with null returns
- Root cause: Multiple try-catch blocks returning null on any parse error without logging

**Background update check may fail silently:**
- Symptoms: Update check fails but user never knows; no retry mechanism
- Files: `hooks/gsd-check-update.js:41-46`
- Trigger: Network timeout, npm registry down, invalid response
- Workaround: Run `npm view get-shit-done-cc version` manually
- Root cause: All errors caught and ignored with empty catch blocks

**Hook command path handling inconsistent across platforms:**
- Symptoms: Hook paths may break on Windows if path contains spaces or special characters
- Files: `bin/install.js:196-200`
- Trigger: Installation on Windows with paths containing spaces
- Workaround: Avoid spaces in installation paths
- Root cause: `buildHookCommand` uses forward slashes but doesn't quote paths properly for all shells

## Security Considerations

**No secrets validation:**
- Risk: API keys and secrets could be committed to repo if user adds them incorrectly
- Files: `bin/install.js` (no secrets checking)
- Current mitigation: None documented
- Recommendations:
  - Add pre-commit hook to scan for common secret patterns
  - Document secrets management in onboarding
  - Add `.env.example` template

**Permissions auto-configured without explicit consent:**
- Risk: `configureOpencodePermissions` automatically modifies `~/.config/opencode/opencode.json`
- Files: `bin/install.js:737-795`
- Current mitigation: Only runs during install, user triggered
- Recommendations:
  - Show what permissions will be added before applying
  - Add opt-out flag for auto-configuration

**Child process execution without timeout:**
- Risk: Background update check spawns child process with 10s timeout, but main install.js has no timeout
- Files: `hooks/gsd-check-update.js:25-61`, `bin/install.js:1260`
- Current mitigation: 10s timeout on update check only
- Recommendations: Add timeouts to all child_process.spawn calls

**No input sanitization on user-provided paths:**
- Risk: Path traversal vulnerabilities if user provides malicious paths
- Files: `bin/install.js:104-127` (config-dir parsing)
- Current mitigation: Node.js fs APIs handle some cases, but not all
- Recommendations: Validate and sanitize all user-provided file paths

## Performance Bottlenecks

**Synchronous file operations in install script:**
- Problem: `fs.readFileSync`, `fs.mkdirSync`, `fs.copyFileSync` block event loop
- Files: `bin/install.js` (throughout)
- Cause: Using sync APIs for simpler code flow
- Improvement path: Convert to async/await with promises for better concurrent operations

**Sequential operations that could be parallel:**
- Problem: Multiple file copy operations run sequentially
- Files: `bin/install.js:969-982` (hook copying loop)
- Cause: Simple for loop without Promise.all
- Improvement path: Use `Promise.all()` for parallel file operations

**Hook polling runs on every session start:**
- Problem: `gsd-check-update.js` spawns background process every session start
- Files: `hooks/gsd-check-update.js`
- Cause: SessionStart hook triggers unconditionally
- Improvement path: Add timestamp check - only update check once per day/week

**No caching for update checks:**
- Problem: Update check hits npm registry every session start
- Files: `hooks/gsd-check-update.js:45`
- Cause: No cache validation (writes cache but doesn't respect cache age)
- Improvement path: Respect cache timestamp, only check if cache is older than 24 hours

## Fragile Areas

**Install script has complex branching logic:**
- Files: `bin/install.js:1253-1292`
- Why fragile: Multiple conditional branches (hasGlobal, hasLocal, hasUninstall, selectedRuntimes), easy to miss edge cases
- Safe modification: Add tests for each install/uninstall path before changing
- Test coverage: No automated tests documented for installer

**Runtime detection logic scattered:**
- Files: `bin/install.js:28-35, 72-89, 476-534, 834-856`
- Why fragile: OpenCode vs Claude Code logic duplicated across functions, easy to get out of sync
- Safe modification: Create a single RuntimeConfig class to encapsulate differences
- Test coverage: No tests for runtime-specific paths

**Frontmatter conversion:**
- Files: `bin/install.js:274-371` (`convertClaudeToOpencodeFrontmatter`)
- Why fragile: Fragile regex-based YAML parsing, breaks on edge cases (multiline strings, comments, anchors)
- Safe modification: Use proper YAML parser library (js-yaml) instead of regex
- Test coverage: No unit tests for frontmatter conversion

**Settings.json manipulation:**
- Files: `bin/install.js:494-534` (`cleanupOrphanedHooks`)
- Why fragile: Deeply nested object access without type checking, assumes specific structure
- Safe modification: Add runtime validation before accessing nested properties
- Test coverage: No tests for settings manipulation

**Hook lifecycle management:**
- Files: `bin/install.js:616-679` (uninstall), `992-1029` (install)
- Why fragile: Manual array manipulation, string matching for hook detection
- Safe modification: Extract hook management into dedicated module with tests
- Test coverage: No tests for hook registration/unregistration

## Scaling Limits

**Installation size:**
- Current capacity: Single npm package, ~50KB after install
- Limit: No hard limit, but each agent/template adds to context window usage
- Scaling path: Consider lazy-loading agents by command, not all at once

**Agent context loading:**
- Current capacity: 10+ agents loaded simultaneously in Claude Code
- Limit: Context window (~200k tokens) - each agent is 500-1400 lines
- Scaling path: Agent file size is already growing concern (planner at 1386 lines)

**Concurrent session support:**
- Current capacity: Single session per project
- Limit: No locking mechanism for concurrent writes to `.planning/` files
- Scaling path: Add file locking or use database for multi-user scenarios

## Dependencies at Risk

**esbuild:**
- Risk: Only dev dependency, but required for build step
- Impact: If esbuild breaking change occurs, hook build fails
- Migration plan: Pin to specific version, watch for breaking changes

**No external dependencies:**
- Risk: Good - zero production dependencies reduces attack surface
- Impact: None - purely Node.js standard library
- Migration plan: N/A - this is a strength

**npm for updates:**
- Risk: Update check depends on npm registry availability
- Impact: Users can't check for updates if npm is down
- Migration plan: Could add GitHub API fallback for version checks

## Missing Critical Features

**No test suite:**
- Problem: Zero automated tests for critical install/uninstall logic
- Files: No test files found
- Blocks: Confidence in refactoring, regression detection
- Priority: High

**No health check command:**
- Problem: No way to verify GSD installation integrity
- Files: No `gsd:health` or similar command
- Blocks: Troubleshooting broken installations
- Priority: Medium

**No migration system:**
- Problem: Schema changes (ROADMAP.md format, PLAN.md structure) require manual migration
- Files: No migration scripts
- Blocks: Breaking changes become very risky
- Priority: Medium

**No rollback mechanism:**
- Problem: Can't undo `gsd:update` if new version has bugs
- Files: `bin/install.js` (no rollback logic)
- Blocks: Safe upgrades
- Priority: Low

**No telemetry/usage data:**
- Problem: No visibility into which features are used, common errors
- Files: No telemetry anywhere
- Blocks: Data-driven prioritization
- Priority: Low (privacy feature, not a bug)

## Test Coverage Gaps

**Installer/uninstaller:**
- What's not tested: Entire install/uninstall flow, all runtime combinations, all flag combinations
- Files: `bin/install.js` (1292 lines, zero tests)
- Risk: Breaking changes silently corrupt user installations
- Priority: High

**Hook scripts:**
- What's not tested: Statusline parsing, update check error handling, background process lifecycle
- Files: `hooks/gsd-statusline.js`, `hooks/gsd-check-update.js`
- Risk: Hooks fail silently, statusline shows wrong data
- Priority: Medium

**Frontmatter conversion:**
- What's not tested: YAML parsing edge cases, tool name mapping, color name conversion
- Files: `bin/install.js:274-371`
- Risk: OpenCode installations get malformed frontmatter
- Priority: Medium

**Agent template syntax:**
- What's not tested: XML frontmatter parsing, template variable expansion
- Files: All `agents/*.md` files
- Risk: Agents spawn with wrong context/tools
- Priority: Low (manual testing catches most issues)

**Integration tests:**
- What's not tested: Full workflow (new-project → plan → execute → verify)
- Files: No integration test suite
- Risk: Breaking workflow changes go undetected
- Priority: High

---

*Concerns audit: 2025-01-29*
