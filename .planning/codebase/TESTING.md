# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Runner:**
- No automated test framework configured
- No test files found in codebase
- No test dependencies in `package.json`

**Assertion Library:**
- Not applicable (no tests)

**Run Commands:**
```bash
npm test              # Not configured - script not in package.json
```

## Test File Organization

**Location:**
- No test directory structure found
- No test files (`.test.js`, `.spec.js`, etc.) present

**Naming:**
- Not applicable (no tests)

**Structure:**
```
Not applicable - no test structure exists
```

## Test Structure

**Suite Organization:**
Not applicable - no test structure exists

**Patterns:**
Not applicable - no test patterns exist

## Mocking

**Framework:** None

**Patterns:**
Not applicable - no mocking patterns exist

**What to Mock:**
Not applicable

**What NOT to Mock:**
Not applicable

## Fixtures and Factories

**Test Data:**
Not applicable - no test fixtures exist

**Location:**
Not applicable

## Coverage

**Requirements:** None enforced

**View Coverage:**
Not applicable - no coverage tool configured

## Test Types

**Unit Tests:**
- Not implemented

**Integration Tests:**
- Not implemented

**E2E Tests:**
- Not implemented

## Manual Testing Approach

**Installation Testing:**
```bash
# Test local install via npm link
npm link
npx get-shit-done-cc

# Test global install
npm install -g .
get-shit-done-cc
```

**Hook Testing:**
- Hooks are tested by running Claude Code and observing behavior
- `hooks/gsd-statusline.js` - tested by checking statusline output
- `hooks/gsd-check-update.js` - tested by checking cache file generation

**Build Testing:**
```bash
# Test build script
npm run build:hooks
# Verifies hooks are copied to dist/
```

## Verification Patterns

**Manual Verification:**
- Installation creates expected files in target directory
- Hooks execute without errors
- Statusline displays correctly
- Update check writes cache file

**File Verification:**
```javascript
// Pattern from install.js
function verifyInstalled(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.error(`Failed to install ${description}: directory not created`);
    return false;
  }
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      console.error(`Failed to install ${description}: directory is empty`);
      return false;
    }
  } catch (e) {
    console.error(`Failed to install ${description}: ${e.message}`);
    return false;
  }
  return true;
}
```

## Common Patterns

**Async Testing:**
Not applicable - no async test patterns exist

**Error Testing:**
Not applicable - no error test patterns exist

## Testing Philosophy

**From GSD-STYLE.md:**
- This is a meta-prompting system for Claude Code
- Testing is done through manual verification of command execution
- No enterprise testing patterns (sprint ceremonies, etc.)
- Plans ARE prompts - executable, not documents to transform

**TDD Plans:**
When TDD is needed for user projects, GSD uses dedicated TDD plans:
- Plan type: `type: tdd`
- Cycle: RED (test) → GREEN (implement) → REFACTOR (clean up)
- Commit convention: `test({phase}-{plan})`, `feat({phase}-{plan})`, `refactor({phase}-{plan})`

---

*Testing analysis: 2026-01-29*