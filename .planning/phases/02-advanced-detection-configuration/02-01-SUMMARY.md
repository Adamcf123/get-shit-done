---
phase: 02-advanced-detection-configuration
plan: 01
subsystem: hook-configuration
tags: [config, command-mapping, json]
dependency-graph:
  requires: [01-core-enforcement-hook]
  provides: [external-command-mapping, config-loading]
  affects: [02-02]
tech-stack:
  added: []
  patterns: [config-merge-override, validation-with-fallback]
key-files:
  created: []
  modified:
    - hooks/gsd-enforce.js
    - get-shit-done/templates/config.json
decisions:
  - id: CONFIG-01
    choice: "Load config in each handler (UserPromptSubmit/Stop/PreToolUse)"
    reason: "Each hook invocation is a separate process; module-level cache only works within same process"
  - id: CONFIG-02
    choice: "Silent fallback when config.json missing or no command_mapping field"
    reason: "Backward compatibility - existing projects without config should work with defaults"
  - id: CONFIG-03
    choice: "Debug warning + fallback when config format invalid"
    reason: "Fail-loud for debugging but graceful degradation for production"
metrics:
  duration: 4 min
  completed: 2026-01-30
---

# Phase 02 Plan 01: External Command Mapping Configuration Summary

**One-liner:** Hook 从 .planning/config.json 读取 command_mapping，项目配置覆盖内置默认映射，格式错误时 debug 警告并回退默认。

## What Was Built

### 1. 配置加载函数 (`hooks/gsd-enforce.js`)

**loadCommandMapping(workspaceDir):**
- 从 `{workspaceDir}/.planning/config.json` 读取配置
- 解析 JSON 并提取 `command_mapping` 字段
- 校验结构：每个 key 必须以 `/gsd:` 开头
- 校验 `required_subagent` 必须是 string
- 返回 `{ mapping, error }` 结构
- 文件不存在时返回 `{ mapping: null, error: null }`（静默回退）
- 解析/校验失败时返回 `{ mapping: null, error: errorMessage }`

**getEffectiveCommandMap(projectMapping):**
- 如果 `projectMapping` 为 null，返回 `DEFAULT_COMMAND_MAP`
- 否则返回 `{ ...DEFAULT_COMMAND_MAP, ...projectMapping }`（项目配置覆盖默认）

### 2. 配置模板更新 (`get-shit-done/templates/config.json`)

添加 `command_mapping` 字段，包含 3 个示例命令：
- `/gsd:plan-phase`: requires gsd-planner, expects *-PLAN.md
- `/gsd:quick`: requires gsd-executor, expects *-PLAN.md and *-SUMMARY.md
- `/gsd:discuss-phase`: requires gsd-planner, no artifacts

## Key Implementation Details

### 配置加载时机

每个 handler（`handleUserPromptSubmit`、`handleStop`、`handlePreToolUse`）在开始时检查并加载配置：

```javascript
if (!configLoadAttempted) {
  configLoadAttempted = true;
  const workspaceDir = getWorkspaceDir(data) || process.cwd();
  const result = loadCommandMapping(workspaceDir);
  projectCommandMapping = result.mapping;
  configLoadError = result.error;
  if (configLoadError) {
    debugLog(`config load error: ${configLoadError}`);
  }
}
```

**设计决策：** 每个 hook 调用是独立进程，模块级缓存只在同一进程内有效。因此每个 handler 都需要独立加载配置。

### 配置合并语义

项目配置覆盖默认映射（shallow merge）：

```javascript
function getEffectiveCommandMap(projectMapping) {
  if (!projectMapping) {
    return DEFAULT_COMMAND_MAP;
  }
  return { ...DEFAULT_COMMAND_MAP, ...projectMapping };
}
```

### 错误处理策略

| 场景 | 行为 |
|------|------|
| config.json 不存在 | 静默使用默认映射 |
| config.json 无 command_mapping 字段 | 静默使用默认映射 |
| JSON 解析失败 | debug 警告 + 回退默认 |
| 校验失败（key 格式/类型错误） | debug 警告 + 回退默认 |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| f6a78fe | feat | implement config loading for command mapping |
| 141b950 | feat | add command_mapping to config template |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All tests passed:
1. No .planning/config.json - uses defaults
2. config.json exists but no command_mapping - uses defaults
3. config.json with valid command_mapping - merges over defaults
4. Invalid JSON - warns and fallback
5. Invalid key format - warns and fallback
6. Invalid required_subagent type - warns and fallback
7. Stop correctly uses effective map from project config

## Next Phase Readiness

**Ready for 02-02:** 配置加载基础设施已就绪，可以扩展支持更多配置字段（如 artifact 规则、工具白名单等）。
