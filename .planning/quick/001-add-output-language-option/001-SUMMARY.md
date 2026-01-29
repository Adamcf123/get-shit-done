# Quick Task 001: Add Output Language Option - Summary

## Overview
Added output language configuration option to GSD system. Users can now configure the language for generated prompts, and the system will include explicit language directives like "使用中文" in agent instructions.

## Changes Made

### 1. Configuration Template (`get-shit-done/templates/config.json`)
- Added `output_language` field with default value "english"
- Supports: english, chinese, spanish, japanese, custom

### 2. Settings Command (`commands/gsd/settings.md`)
- Added language selection to interactive settings
- Updated config update logic to include `output_language`
- Added language setting description in confirmation output
- Updated success criteria (5 settings instead of 4)

### 3. Agent Definitions
Updated the following agent files to read and apply language configuration:

- `agents/gsd-planner.md`: Added language directive injection for generated plans
- `agents/gsd-executor.md`: Added language awareness for outputs
- `agents/gsd-research-synthesizer.md`: Added language config loading
- `agents/gsd-debugger.md`: Added language config loading
- `agents/gsd-phase-researcher.md`: Added language config loading

Each agent now:
1. Loads `OUTPUT_LANGUAGE` from config.json
2. Applies appropriate language directive when not set to "english"

## Language Directives
When output_language is not "english", agents will prepend:
- Chinese: "使用中文进行所有输出。\n\n"
- Spanish: "Use Spanish for all outputs.\n\n"
- Japanese: "日本語で出力してください。\n\n"
- Custom: "Use ${language} for all outputs.\n\n"

## Verification
- [x] Config template includes output_language field
- [x] Settings command allows language selection
- [x] All major agents load language configuration
- [x] Language directive logic documented in agent files

## Files Modified
1. `get-shit-done/templates/config.json`
2. `commands/gsd/settings.md`
3. `agents/gsd-planner.md`
4. `agents/gsd-executor.md`
5. `agents/gsd-research-synthesizer.md`
6. `agents/gsd-debugger.md`
7. `agents/gsd-phase-researcher.md`

## Usage
Users can configure language via:
```bash
/gsd:settings
```

Or manually edit `.planning/config.json`:
```json
{
  "output_language": "chinese"
}
```
