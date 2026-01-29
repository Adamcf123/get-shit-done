# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- kebab-case for all markdown files: `execute-phase.md`, `gsd-planner.md`, `checkpoints.md`
- Commands: `gsd:kebab-case` format: `gsd:plan-phase`, `gsd:execute-phase`, `gsd:quick`
- JavaScript files: kebab-case: `gsd-statusline.js`, `gsd-check-update.js`, `build-hooks.js`, `install.js`

**Functions:**
- camelCase: `getModelContextSize()`, `getContextFromTranscript()`, `expandTilde()`, `readSettings()`
- Helper functions use descriptive names: `buildHookCommand()`, `verifyInstalled()`, `cleanupOrphanedFiles()`

**Variables:**
- camelCase: `cacheDir`, `installed`, `latest`, `modelId`, `isClaude`
- Constants: UPPER_SNAKE_CASE: `MODEL_CONTEXT_WINDOWS`, `cyan`, `green`, `yellow`, `dim`, `reset`
- Bash/script variables: CAPS_UNDERSCORES: `PHASE_ARG`, `PLAN_START_TIME`

**Types:**
- No TypeScript used (plain JavaScript)
- Type annotations in JSDoc comments: `@param {string} runtime`, `@returns {object}`

## Code Style

**Formatting:**
- No automated formatting configured (no .prettierrc, biome.json)
- 2-space indentation for JavaScript
- 4-space indentation for YAML frontmatter
- Consistent spacing around operators

**Linting:**
- No linting configured (no .eslintrc, eslint.config.*)
- Manual code review process via PRs

**Shebang:**
- All executable Node.js scripts use `#!/usr/bin/env node`

## Import Organization

**Node.js CommonJS:**
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
```

**Order:**
1. Node.js built-in modules
2. Third-party modules (if any)
3. Local modules (if any)

**Path Aliases:**
- None used (no TypeScript path aliases configured)

## Error Handling

**Patterns:**
- Try-catch for file operations with silent failures in non-critical paths
- `process.exit(1)` for fatal errors (invalid arguments, missing dependencies)
- Return empty objects/defaults for non-critical failures

**Examples:**
```javascript
// Silent fail for non-critical operations
try {
  latest = execSync('npm view get-shit-done-cc version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
} catch (e) {}

// Explicit error for user-facing issues
if (!nextArg || nextArg.startsWith('-')) {
  console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
  process.exit(1);
}

// Return defaults for missing config
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}
```

## Logging

**Framework:** `console.log`/`console.error` with ANSI color codes

**Patterns:**
- Success messages: `${green}✓${reset}` prefix
- Warnings: `${yellow}⚠${reset}` or `${yellow}✗${reset}` prefix
- Errors: `console.error()` with color codes
- Silent failures: empty catch blocks for non-critical operations

**Color constants:**
```javascript
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';
```

## Comments

**When to Comment:**
- File headers with purpose and invocation context
- Section separators (e.g., `// Colors`, `// Get version from package.json`)
- Explanations for platform-specific behavior (e.g., Windows path handling)
- Backward compatibility markers

**JSDoc:**
```javascript
/**
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude' or 'opencode'
 * @param {string|null} explicitDir - Explicit directory from --config-dir flag
 */
function getGlobalDir(runtime, explicitDir = null) {
  // ...
}
```

**File headers:**
```javascript
#!/usr/bin/env node
// Check for GSD updates in background, write result to cache
// Called by SessionStart hook - runs once per session
```

## Function Design

**Size:** No strict size limit, but functions are generally focused (10-50 lines)

**Parameters:**
- Required parameters first, optional parameters with defaults last
- Destructuring used for object parameters: `const { type, command } = entry.hooks[0];`

**Return Values:**
- Explicit return statements
- Return objects for complex data: `{ totalTokens, pct, display }`
- Return primitive values for simple operations

## Module Design

**Exports:**
- No ES6 modules used (CommonJS `require`/`module.exports`)
- Install script is the main entry point

**Barrel Files:** Not used

## XML Tag Conventions (Markdown Files)

**Semantic Containers Only:**
- Tags serve semantic purposes, not structural
- Use Markdown headers for hierarchy within tags

**Tag naming:** kebab-case: `<objective>`, `<execution_context>`, `<philosophy>`, `<process>`, `<step>`

**Common patterns:**
```xml
<role>You are a GSD planner...</role>
<objective>Create executable phase plans...</objective>
<philosophy>Core principles...</philosophy>
<process>
  <step name="load_project_state">...</step>
  <step name="decompose_phase">...</step>
</process>
```

**Checkpoint structure:**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Description</what-built>
  <how-to-verify>Numbered steps</how-to-verify>
  <resume-signal>Continue instruction</resume-signal>
</task>
```

## Language & Tone

**Imperative Voice:**
- "Execute tasks", "Create file", "Read STATE.md"
- Avoid: "Execution is performed", "The file should be created"

**No Filler:**
- Avoid: "Let me", "Just", "Simply", "Basically"
- Use: Direct instructions, technical precision

**No Sycophancy:**
- Avoid: "Great!", "Awesome!", "Excellent!"
- Use: Factual statements, verification results

## Anti-Patterns

**Banned:**
- Temporal language in implementation docs: "We changed X", "Previously", "No longer"
- Generic XML tags: `<section>`, `<item>`, `<content>`
- Enterprise patterns: Story points, sprint ceremonies, RACI matrices
- Vague tasks: "Add authentication" (must be specific with verification)

**Allowed only in:**
- CHANGELOG.md
- MIGRATION.md
- Git commit messages

---

*Convention analysis: 2026-01-29*