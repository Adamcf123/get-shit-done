# Quick Task 001: Add Output Language Option

## Goal
Add an output language configuration option to GSD. Currently all prompts are in English. Users should be able to configure a language so that prompts explicitly include "use XX language" directive.

## Context
GSD is a meta-prompting system for Claude Code. It generates prompts and plans for AI agents. The system uses:
- `.planning/config.json` for configuration
- Template files in `agents/` directory for prompt generation
- Commands in `commands/` directory

## Tasks

### Task 1: Add language config option
**Files:** `.planning/config.json`
**Action:**
- Add `output_language` field to config schema
- Default value: "english"
- Allow any language code/name

### Task 2: Update agent prompts with language directive
**Files:** `agents/*.md` (all agent prompt templates)
**Action:**
- Add language directive template to agent prompts
- Format: "Use {language} for all outputs" or "使用{language}"
- Apply to all agent templates that generate user-facing content

### Task 3: Update command handlers to pass language
**Files:** `commands/` directory
**Action:**
- Read language config in command handlers
- Pass language setting to agent prompts
- Ensure language directive is included in generated plans

## Verification
- [ ] Config accepts output_language option
- [ ] Agent prompts include language directive when non-English
- [ ] Generated plans respect the language setting
