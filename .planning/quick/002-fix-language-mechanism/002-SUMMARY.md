# Quick Task 002: Fix Language Mechanism - Summary

## Overview
Fixed the language configuration mechanism from dynamic runtime loading to static install-time replacement.

## Problem with Previous Approach
The previous implementation had agents dynamically reading `config.json` at runtime using bash commands. This was unreliable because:
1. Subagents may not correctly execute bash commands to read config
2. Language directive should be baked into the prompt, not dynamically prepended
3. Install-time configuration is more reliable and predictable

## Solution Implemented

### 1. Added Placeholder to Agent Files
Added `{{LANGUAGE_DIRECTIVE}}` placeholder at the top of each agent file (after frontmatter):
- `agents/gsd-planner.md`
- `agents/gsd-executor.md`
- `agents/gsd-research-synthesizer.md`
- `agents/gsd-debugger.md`
- `agents/gsd-phase-researcher.md`

### 2. Removed Dynamic Loading Logic
Removed bash-based `OUTPUT_LANGUAGE` loading from all agent files:
- Removed `cat .planning/config.json | grep output_language` commands
- Removed "Apply language directive" sections

### 3. Modified install.js for Static Replacement
Updated `bin/install.js` to:
- Read `output_language` from `get-shit-done/templates/config.json` during installation
- Map language codes to directives:
  - `english` → "" (empty)
  - `chinese` → "使用中文进行所有输出。\n\n"
  - `spanish` → "Use Spanish for all outputs.\n\n"
  - `japanese` → "日本語で出力してください。\n\n"
  - `custom` → "Use ${lang} for all outputs.\n\n"
- Replace `{{LANGUAGE_DIRECTIVE}}` placeholder with actual directive when copying agent files

## New Mechanism Flow

```
1. User edits get-shit-done/templates/config.json → sets output_language: "chinese"
2. Runs: node bin/install.js --claude --global
3. install.js reads template config → gets "chinese"
4. install.js looks up directive → "使用中文进行所有输出。\n\n"
5. install.js copies agents to ~/.claude/agents/
6. During copy: replaces {{LANGUAGE_DIRECTIVE}} with actual directive
7. Result: ~/.claude/agents/gsd-planner.md starts with "使用中文进行所有输出。\n\n"
8. When subagent is spawned, it receives the Chinese directive in its prompt
```

## Files Modified

### Agent Files (placeholder + removed dynamic logic)
1. `agents/gsd-planner.md`
2. `agents/gsd-executor.md`
3. `agents/gsd-research-synthesizer.md`
4. `agents/gsd-debugger.md`
5. `agents/gsd-phase-researcher.md`

### Installer
6. `bin/install.js` - Added language directive loading and placeholder replacement

## Verification Steps
1. Set `output_language` to "chinese" in `get-shit-done/templates/config.json`
2. Run `node bin/install.js --claude --global`
3. Check `~/.claude/agents/gsd-planner.md` - should start with Chinese directive
4. No `{{LANGUAGE_DIRECTIVE}}` placeholder should remain in installed files

## Usage
To change language:
1. Edit `get-shit-done/templates/config.json` → change `output_language`
2. Reinstall: `node bin/install.js --claude --global`
3. All agent prompts will now use the new language
