# Phase 2: Advanced Detection & Configuration - Research

**Researched:** 2026-01-30
**Domain:** Fake parallel detection + maintainable GSD command mapping configuration
**Confidence:** HIGH

## Summary

本阶段要实现两个核心能力：(1) 检测"假并行"欺骗模式——orchestrator 声称"并行启动 N 个 researcher"但实际只发送 1 个 Task 调用；(2) 将 Phase 1 硬编码的 `COMMAND_MAP` 外置到项目级 `.planning/config.json`，使命令→子代理映射可维护。

根据 CONTEXT.md 的决策，假并行检测采用"文本分析 + 计数结合"方式：先用正则检测文本中的并行声明关键词并提取期望数字，再在 Stop 时校验实际 Task 调用数。判定阈值为"完全欺骗"——声称 N 个但实际只有 1 次调用才拦截，容忍部分并行（实际 < N 但 > 1 不拦截）。

配置文件合并到 `.planning/config.json` 的 `command_mapping` 字段，支持 `required_subagent` 和 `expected_artifacts` 规则。未配置命令警告但不拦截，避免新命令被误伤。

**Primary recommendation:** 在现有 `gsd-enforce.js` 基础上扩展：(1) 在 `handleUserPromptSubmit` 中用正则提取并行声明并记录 `expected_parallel_count`；(2) 在 `handlePreToolUse` 中累加 `task_call_count`；(3) 在 `handleStop` 中校验 `task_call_count` vs `expected_parallel_count`；(4) 将 `COMMAND_MAP` 改为从 `.planning/config.json` 读取。

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Node.js RegExp | Native | 文本分析提取并行声明关键词和数字 | 无需外部依赖；JavaScript 原生正则足够处理简单模式匹配 |
| JSON | Native | 配置文件格式 | 项目已使用 `.planning/config.json`；无需引入 YAML/TOML |
| fs.readFileSync | Native | 同步读取配置文件 | Hook 执行需要同步；避免异步复杂性 |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|---|---|---|---|
| path.resolve | Native | 解析项目级配置路径 | 从 workspace.current_dir 定位 .planning/config.json |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| 简单正则 | NLP 库（如 compromise） | 过度工程；简单关键词匹配足够，不需要语义理解 |
| JSON 配置 | JSON Schema 校验 | 可选增强；Phase 2 先做基础校验，后续可加 schema |
| 同步读取 | 缓存 + 热重载 | CONTEXT.md 决策：无热重载，重启生效 |

## Architecture Patterns

### Recommended Project Structure

延续 Phase 1 架构，在 `gsd-enforce.js` 中扩展：

```
hooks/
├── gsd-enforce.js        # 主入口：扩展假并行检测 + 配置加载
│   ├── extractParallelClaim()    # 新增：从 prompt 提取并行声明
│   ├── loadCommandMapping()      # 新增：从 config.json 加载映射
│   └── validateParallelCalls()   # 新增：Stop 时校验并行调用数
└── dist/
    └── gsd-enforce.js
```

### Pattern 1: Parallel Claim Extraction (UserPromptSubmit)

**What:** 在 `handleUserPromptSubmit` 中用正则检测并行声明关键词，提取期望的并行数。

**When to use:** 每次 GSD 命令触发时，分析 prompt 文本。

**Example:**
```javascript
// Source: Phase 2 CONTEXT.md decisions
function extractParallelClaim(promptText) {
  if (!promptText) return null;
  
  // Pattern 1: "并行启动 N 个" / "同时启动 N 个"
  const zhPattern = /(?:并行|同时)(?:启动|spawn|创建)\s*(\d+)\s*个/i;
  
  // Pattern 2: "spawn N researchers in parallel" / "N parallel agents"
  const enPattern = /(?:spawn(?:ing)?|start(?:ing)?|launch(?:ing)?)\s+(\d+)\s+\w+\s+(?:in\s+)?parallel/i;
  const enPattern2 = /(\d+)\s+parallel\s+(?:agents?|researchers?|executors?|subagents?)/i;
  
  // Pattern 3: "in parallel" with preceding number
  const enPattern3 = /(\d+)\s+\w+\s+in\s+parallel/i;
  
  for (const pattern of [zhPattern, enPattern, enPattern2, enPattern3]) {
    const match = promptText.match(pattern);
    if (match && match[1]) {
      const count = parseInt(match[1], 10);
      if (count >= 2) return count;  // Only track if claiming 2+
    }
  }
  
  return null;
}
```

### Pattern 2: Task Call Counting (PreToolUse)

**What:** 在 `handlePreToolUse` 中累加 Task 调用计数。

**When to use:** 每次 Task 工具调用时。

**Example:**
```javascript
// Source: Phase 2 CONTEXT.md decisions
// In handlePreToolUse, after existing Task handling:
if (toolName === 'Task') {
  // Existing: record delegated_subagent
  // New: increment task call count
  state.task_call_count = (state.task_call_count || 0) + 1;
  writeTurnState(sessionId, state);
}
```

### Pattern 3: Parallel Validation (Stop)

**What:** 在 `handleStop` 中校验实际 Task 调用数是否符合声明。

**When to use:** 回合结束时，如果检测到并行声明。

**Example:**
```javascript
// Source: Phase 2 CONTEXT.md decisions
function validateParallelCalls(state) {
  const expected = state.expected_parallel_count;
  const actual = state.task_call_count || 0;
  
  if (!expected || expected < 2) return null;  // No parallel claim
  
  // Only block complete deception: claimed N but only 1 call
  if (actual === 1 && expected > 1) {
    return {
      error_code: 'USER_FAKE_PARALLEL',
      expected,
      actual,
      next_step: `下一步：声称并行启动 ${expected} 个子代理，但实际只调用了 ${actual} 次 Task。请真正并行调用 Task 或移除并行声明。`,
    };
  }
  
  return null;  // Tolerate partial parallel (actual > 1 but < expected)
}
```

### Pattern 4: External Configuration Loading

**What:** 从 `.planning/config.json` 加载命令映射，替代硬编码的 `COMMAND_MAP`。

**When to use:** Hook 启动时加载一次（无热重载）。

**Example:**
```javascript
// Source: Phase 2 CONTEXT.md decisions
function loadCommandMapping(workspaceDir) {
  const configPath = path.join(workspaceDir, '.planning', 'config.json');
  
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    
    if (!config.command_mapping || typeof config.command_mapping !== 'object') {
      return { mapping: null, error: null };  // No mapping defined
    }
    
    // Validate structure
    for (const [cmd, spec] of Object.entries(config.command_mapping)) {
      if (!cmd.startsWith('/gsd:')) {
        throw new Error(`Invalid command key: ${cmd} (must start with /gsd:)`);
      }
      if (spec.required_subagent && typeof spec.required_subagent !== 'string') {
        throw new Error(`Invalid required_subagent for ${cmd}`);
      }
    }
    
    return { mapping: config.command_mapping, error: null };
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { mapping: null, error: null };  // Config file doesn't exist
    }
    return { mapping: null, error: e.message };
  }
}
```

### Anti-Patterns to Avoid

- **在 PreToolUse 中做并行校验：** 无法知道"还会有多少 Task 调用"，必须在 Stop 时做最终判定。
- **用 NLP 做语义分析：** 过度工程；简单关键词正则足够覆盖常见声明模式。
- **热重载配置：** CONTEXT.md 决策明确"无热重载"，避免复杂性。
- **拦截未配置命令：** CONTEXT.md 决策"警告但不拦截"，避免新命令被误伤。


## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| 并行声明检测 | 复杂 NLP 语义分析 | 简单正则关键词匹配 | 声明模式有限且可枚举；正则足够覆盖 |
| 配置文件解析 | 自定义格式解析器 | JSON.parse | 项目已用 JSON；标准库足够 |
| 配置校验 | 运行时动态校验 | 启动时一次性校验 | CONTEXT.md 决策：启动时校验，无效则报错 |
| 数字提取 | 手写状态机 | 正则捕获组 | `(\d+)` 捕获组直接提取数字 |

**Key insight:** 假并行检测的核心是"计数对比"，不是"语义理解"。只要能从文本中提取"声称的数字"，再与实际 Task 调用数对比即可。

## Common Pitfalls

### Pitfall 1: 正则过于宽松导致误报

**What goes wrong:** 正则匹配到非并行声明的数字（如"Phase 4"中的 4）。

**Why it happens:** 没有足够的上下文约束。

**How to avoid:** 正则必须包含并行关键词（"并行"/"parallel"/"同时"）作为锚点，不能只匹配数字。

**Warning signs:** 非并行命令被误判为"假并行"。

### Pitfall 2: 配置加载时机错误

**What goes wrong:** 每次事件都重新读取配置文件，导致性能问题或不一致。

**Why it happens:** 没有缓存配置。

**How to avoid:** 在 hook 启动时加载一次配置，存入模块级变量。CONTEXT.md 决策明确"无热重载"。

**Warning signs:** 配置修改后立即生效（不应该）。

### Pitfall 3: 未处理配置文件不存在的情况

**What goes wrong:** 新项目没有 `.planning/config.json`，hook 报错。

**Why it happens:** 假设配置文件总是存在。

**How to avoid:** 配置文件不存在时回退到内置默认映射（Phase 1 的 `COMMAND_MAP`）。

**Warning signs:** 新项目无法使用 GSD 命令。

### Pitfall 4: 并行计数跨回合污染

**What goes wrong:** 上一回合的 `task_call_count` 影响当前回合。

**Why it happens:** 状态未正确清理。

**How to avoid:** 在 `handleUserPromptSubmit` 中重置 `task_call_count = 0` 和 `expected_parallel_count = null`。

**Warning signs:** 第二次运行命令时计数异常。

### Pitfall 5: 中英文混合正则遗漏

**What goes wrong:** 只匹配英文或只匹配中文，遗漏另一种语言的声明。

**Why it happens:** 正则模式不完整。

**How to avoid:** 同时提供中英文正则模式，按优先级依次匹配。

**Warning signs:** 中文声明"并行启动 4 个"未被检测。


## Code Examples

### Configuration File Structure (config.json)

```json
// Source: Phase 2 CONTEXT.md decisions
{
  "mode": "interactive",
  "depth": "standard",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  },
  "command_mapping": {
    "/gsd:plan-phase": {
      "required_subagent": "gsd-planner",
      "expected_artifacts": [
        {
          "base_dir": ".planning/phases",
          "required_any": ["**/*-PLAN.md"]
        }
      ],
      "allowed_pre_tools": ["Task"]
    },
    "/gsd:quick": {
      "required_subagent": "gsd-executor",
      "expected_artifacts": [
        {
          "base_dir": ".planning/quick",
          "required_all": ["**/*-PLAN.md", "**/*-SUMMARY.md"]
        }
      ],
      "allowed_pre_tools": ["AskUserQuestion", "Task"]
    },
    "/gsd:execute-phase": {
      "required_subagent": "other",
      "expected_artifacts": []
    },
    "/gsd:discuss-phase": {
      "required_subagent": "gsd-planner",
      "expected_artifacts": []
    },
    "/gsd:help": {
      "required_subagent": "none",
      "expected_artifacts": []
    }
  }
}
```

### Parallel Claim Detection Patterns

```javascript
// Source: Phase 2 implementation patterns
const PARALLEL_PATTERNS = [
  // Chinese patterns
  /(?:并行|同时)(?:启动|spawn|创建|运行)\s*(\d+)\s*个/i,
  /启动\s*(\d+)\s*个\s*(?:并行|同时)/i,
  
  // English patterns
  /spawn(?:ing)?\s+(\d+)\s+\w+\s+(?:in\s+)?parallel/i,
  /(\d+)\s+parallel\s+(?:agents?|researchers?|executors?|subagents?|tasks?)/i,
  /(?:run(?:ning)?|start(?:ing)?|launch(?:ing)?)\s+(\d+)\s+\w+\s+(?:in\s+)?parallel/i,
  /in\s+parallel[^.]*?(\d+)\s+(?:agents?|tasks?)/i,
];

function extractParallelCount(text) {
  if (!text) return null;
  
  for (const pattern of PARALLEL_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const count = parseInt(match[1], 10);
      if (count >= 2 && count <= 100) {  // Sanity bounds
        return count;
      }
    }
  }
  
  return null;
}
```

### Fake Parallel Block Message

```javascript
// Source: Phase 2 CONTEXT.md decisions
function formatFakeParallelBlock(state) {
  return formatBlockMessage({
    command: state.command,
    error_code: 'USER_FAKE_PARALLEL',
    expected_parallel: state.expected_parallel_count,
    actual_task_calls: state.task_call_count,
    next_step: `下一步：声称并行启动 ${state.expected_parallel_count} 个子代理，但实际只调用了 ${state.task_call_count} 次 Task。请真正并行调用 Task（在同一消息中发送多个 Task 调用），或移除并行声明。`,
  });
}
```

### Configuration Merge with Defaults

```javascript
// Source: Phase 2 implementation patterns
const DEFAULT_COMMAND_MAP = Object.freeze({
  '/gsd:plan-phase': { required_subagent: 'gsd-planner', expected_artifacts: [], allowed_pre_tools: ['Task'] },
  '/gsd:quick': { required_subagent: 'gsd-executor', expected_artifacts: [], allowed_pre_tools: ['AskUserQuestion', 'Task'] },
  '/gsd:help': { required_subagent: 'none', expected_artifacts: [] },
  // ... other defaults from Phase 1
});

function getEffectiveCommandMap(projectMapping) {
  if (!projectMapping) return DEFAULT_COMMAND_MAP;
  
  // Project config overrides defaults
  return { ...DEFAULT_COMMAND_MAP, ...projectMapping };
}
```


## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| 硬编码 COMMAND_MAP | 外置到 config.json | Phase 2 | 用户可自定义命令映射，无需改代码 |
| 无并行检测 | 文本分析 + 计数校验 | Phase 2 | 防止 orchestrator 声称并行但实际串行 |
| 全局配置 | 项目级配置 | Phase 2 | 不同项目可有不同映射规则 |

**Deprecated/outdated:**
- **Phase 1 的硬编码 `COMMAND_MAP`：** 仍作为默认值保留，但优先使用项目配置。

## Open Questions

1. **配置文件校验的严格程度**
   - What we know: CONTEXT.md 决策"启动时校验，无效则报错"
   - What's unclear: 校验失败时是完全阻止还是回退到默认？
   - Recommendation: 校验失败时报错并回退到默认映射，同时在 stderr 输出警告。

2. **并行声明的边界情况**
   - What we know: 只检测"完全欺骗"（声称 N 但只有 1）
   - What's unclear: 如果声称 4 个但实际 2 个，是否应该警告（不拦截）？
   - Recommendation: Phase 2 先不警告，只拦截完全欺骗；后续可加警告。

3. **配置文件路径的确定**
   - What we know: 使用 `workspace.current_dir` 或 `process.cwd()`
   - What's unclear: 如果 workspace 信息不可用怎么办？
   - Recommendation: 优先 `workspace.current_dir`，回退 `process.cwd()`，与 Phase 1 artifact 检查一致。

## Sources

### Primary (HIGH confidence)
- `/home/adam/projects/get-shit-done/.planning/phases/02-advanced-detection-configuration/02-CONTEXT.md` — Phase 2 锁定决策
- `/home/adam/projects/get-shit-done/hooks/gsd-enforce.js` — Phase 1 实现，扩展基础
- `/home/adam/projects/get-shit-done/.planning/config.json` — 现有配置文件结构
- `/home/adam/projects/get-shit-done/get-shit-done/templates/config.json` — 配置模板

### Project sources (HIGH confidence)
- `/home/adam/projects/get-shit-done/.planning/REQUIREMENTS.md` — ENF-05, MAP-01, MAP-02, MAP-03 需求
- `/home/adam/projects/get-shit-done/commands/gsd/execute-phase.md` — 并行执行示例（wave_execution 部分）
- `/home/adam/projects/get-shit-done/commands/gsd/plan-phase.md` — 命令映射示例

### Secondary (MEDIUM confidence)
- JavaScript RegExp 文档 — 正则表达式语法
- Node.js fs 模块文档 — 文件读取 API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 使用 Node.js 原生能力，无外部依赖
- Architecture: HIGH — 延续 Phase 1 架构，增量扩展
- Pitfalls: HIGH — 基于 Phase 1 经验和 CONTEXT.md 决策

**Research date:** 2026-01-30
**Valid until:** 2026-03-01

