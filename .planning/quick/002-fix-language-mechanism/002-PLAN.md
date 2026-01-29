# Quick Task 002: Fix Language Mechanism

## Goal
Fix the language configuration mechanism. Instead of dynamic loading during execution, language directives should be statically embedded into agent prompts during installation.

## Problem
Current mechanism has agents dynamically reading config.json at runtime using bash. This is unreliable because:
1. Subagents may not execute the bash command correctly
2. Language directive should be part of the prompt itself, not dynamically prepended
3. Install-time configuration is more reliable than runtime configuration

## Solution
1. Add placeholder `{{LANGUAGE_DIRECTIVE}}` to agent definition files
2. Modify install.js to read output_language from template config
3. During installation, replace placeholder with actual language directive
4. Remove dynamic loading logic from agent files

## Tasks

### Task 1: Add placeholder to agent files
**Files:** `agents/gsd-planner.md`, `agents/gsd-executor.md`, `agents/gsd-phase-researcher.md`, etc.
**Action:**
- At the top of each agent file (after frontmatter), add placeholder: `{{LANGUAGE_DIRECTIVE}}`
- Remove the dynamic bash-based language loading logic

### Task 2: Modify install.js for static replacement
**Files:** `bin/install.js`
**Action:**
- Read output_language from `get-shit-done/templates/config.json` during installation
- Create language directive mapping:
  - english: "" (empty)
  - chinese: "使用中文进行所有输出。\n\n"
  - spanish: "Use Spanish for all outputs.\n\n"
  - japanese: "日本語で出力してください。\n\n"
  - custom: "Use ${language} for all outputs.\n\n"
- When copying agent files, replace `{{LANGUAGE_DIRECTIVE}}` with actual directive

### Task 3: Update agent files - remove dynamic logic
**Files:** All agent files that have language loading code
**Action:**
- Remove the bash-based OUTPUT_LANGUAGE loading
- Remove the "Apply language directive" sections
- Keep only the static placeholder

## Verification
- [ ] Agent files contain `{{LANGUAGE_DIRECTIVE}}` placeholder
- [ ] install.js replaces placeholder during installation
- [ ] No dynamic language loading remains in agent files
- [ ] Reinstall produces correct language directives in ~/.claude/agents/
