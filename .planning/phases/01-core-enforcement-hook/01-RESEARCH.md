# Phase 1: Core Enforcement Hook - Research

**Researched:** 2026-01-29
**Domain:** Claude Code hooks for deterministic enforcement of GSD subagent delegation
**Confidence:** HIGH

## Summary

本阶段要交付的是“强制执行钩子”：当用户触发任意 `/gsd:*` 命令时，Hook 必须在同一回合内确认「按映射要求生成了正确的子代理（subagent delegation）」并且「产生了该命令声明的期望产物」，否则阻止该回合结束，从而防止主助手在不委托子代理的情况下“静默绕过”GSD 的架构保证。

实现上不要发明新机制：直接使用 Claude Code 原生 hooks 事件流（`UserPromptSubmit` → `PreToolUse` → `Stop`，并辅以 `SubagentStop` 记录完成信号）。关键是把“每回合的强制执行状态机”做成可恢复、可审计、fail-loud：一旦 hook 内部出错同样要阻止（符合 ERR-01），并且错误消息要明确告诉主助手“应使用 Task 工具生成哪个 subagent + 需要产物是什么”。

**Primary recommendation:** 用“回合状态机 + 显式命令映射”的四钩组合实现：`UserPromptSubmit` 标记 GSD 命令与回合起点，`PreToolUse` fail-fast 阻止任何不允许的工具先于委托发生，`SubagentStop` 标记子代理完成，`Stop` 在回合结束时做最终断言（未委托/产物缺失即 block）。

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Claude Code Hooks | Native | 在生命周期事件点做确定性拦截与阻止 | 官方支持的扩展机制；可通过 exit code/JSON 决策实现阻止与反馈 |
| `~/.claude/settings.json` | N/A | 全局安装 hooks（HOOK-01） | 官方文档明确支持 user/project/local 三层配置 |
| Node.js | >=16.7.0 (project) | 编写 hooks 脚本（JSON 解析 + 文件 I/O） | 本 repo 已用 Node 实现 hooks 与 installer；避免 bash JSON 解析脆弱性 |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|---|---|---|---|
| `jq` | N/A | 在 bash hook 中提取 JSON 字段 | 仅当某些 hook 必须用 shell 一行实现时；否则优先 Node |
| `claude --debug` / `/hooks` | N/A | 验证 hooks 注册与触发 | 排查“hooks 未触发/子目录不触发/顺序异常”等问题 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Node hooks 脚本 | bash 一行脚本 | bash 更容易写出不安全/不可维护的 JSON 解析与 quoting bug；fail-loud 难做完善 |
| `Stop` 末端阻止 | 只用 `SubagentStop` | 只用 `SubagentStop` 无法覆盖“本回合完全没 spawn 子代理”的情况（因为没有子代理就没有 SubagentStop 事件） |
| Exit code 2 阻止 | stdout JSON `decision` 阻止 | Exit code 2 在多数事件里最简单可靠；但注意：exit code 2 时 stdout JSON **不会被处理**（见官方 hooks 参考） |

**Installation (conceptual):**
- 将新 hook 脚本放到 `hooks/` 并通过 `scripts/build-hooks.js` 复制到 `hooks/dist/`
- `bin/install.js` 在 `~/.claude/settings.json` 中注册新 hook 命令（HOOK-01/HOOK-02）

## Architecture Patterns

### Recommended Project Structure

（延续本 repo 现有 hooks 架构：`hooks/*.js` + `hooks/dist/*.js` + 安装器写入 settings.json）

```
hooks/
├── gsd-enforce.js        # 主入口：读取 stdin JSON，按 event 分派
├── lib/
│   ├── state-store.js    # turn/session 状态读写（文件锁/原子写）
│   ├── command-map.js    # Phase 1 可先 hardcode；Phase 2 再外置 JSON（MAP-*）
│   ├── artifact-check.js # 产物检查（mtime >= turn_start）
│   └── format-error.js   # 统一阻止消息（ERR-02）
└── dist/
    └── gsd-enforce.js
```

### Pattern 1: Turn-Scoped State Machine (UserPromptSubmit → PreToolUse → Stop)

**What:** 针对“一个用户输入回合”建立状态机，按 `session_id` 关联；在回合开始（UserPromptSubmit）写入 `turn_start_ms` 与 `command`, 在工具调用（PreToolUse）里做 fail-fast gate，在回合结束（Stop）做最终断言并清理状态。

**When to use:** 需要“同一回合内”保证某个行为发生（本项目：必须 spawn 期望 subagent + 必须产生期望产物）。

**Example (pseudo):**
```js
// Source: https://code.claude.com/docs/en/hooks (Hook Input/Output & events)
// UserPromptSubmit:
//  - if prompt contains /gsd:* => state.active = true; state.command = ...; state.turn_start_ms = Date.now()
// PreToolUse:
//  - if state.active && !state.delegated:
//      - if tool_name !== 'Task' => deny (fail-fast)
//      - else record delegated subagent (from tool_input)
// Stop:
//  - if state.active:
//      - if !delegated => block stop with remediation
//      - if artifacts missing => block stop with remediation
//      - else clear state
```

### Pattern 2: Fail-Fast Gate in PreToolUse

**What:** 一旦检测到 GSD 命令已激活且尚未委托期望子代理，则：
- 任何“非允许集合”的工具调用立刻被拒绝（对应“任何 non-Task tool use 在委托前发生即违规”的决策）。

**How:** 通过 `PreToolUse` 的 JSON 输出 `hookSpecificOutput.permissionDecision: "deny"`（或直接 exit code 2）阻止工具执行，并在 `permissionDecisionReason` 给出 remediation。

**Pitfall:** 只有 exit code 0 时才会解析 stdout JSON；exit code 2 会忽略 stdout JSON，仅使用 stderr 文本。

### Pattern 3: End-of-Turn Enforcement in Stop

**What:** 在 `Stop` hook 中做最终校验：
- 若本回合未 spawn 期望 subagent，或未产生映射声明的 expected artifacts，则阻止停止（block），迫使主助手继续并修正。

**Why:** 这覆盖了“整回合都没 spawn 子代理”的情况（否则不会触发 SubagentStop）。

### Anti-Patterns to Avoid
- **只在 SubagentStop 校验是否 spawn：** 没有 spawn 就不会触发 SubagentStop，必漏。
- **在 UserPromptSubmit 直接 block 代替 Stop：** exit code 2 的 UserPromptSubmit 会“擦除 prompt 且只对用户显示 stderr”，主助手拿不到完整修复指引；更适合在 Stop/PreToolUse 阶段 block。
- **把映射写成隐式/推断式（“大概像是 plan-phase”）：** 决策要求显式映射、未映射 fail-closed。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Hook 触发/阻止机制 | 自己实现“拦截器”或靠提示词约束 | Claude Code Hooks（UserPromptSubmit/PreToolUse/Stop/SubagentStop） | hooks 是确定性机制；提示词会被绕过（项目核心风险） |
| 工具权限拦截 | 在 PostToolUse 才回滚 | PreToolUse permissionDecision deny | PostToolUse 时工具已执行，无法 fail-fast |
| “回合结束”检测 | 解析 transcript 推断结束 | Stop hook | 官方提供专用事件点，复杂度更低 |

**Key insight:** 这类强制执行的正确性来自“事件点的不可绕过性 + fail-closed”，不是来自复杂逻辑。尽量让 hook 逻辑短、同步、确定。

## Common Pitfalls

### Pitfall 1: 仅靠 SubagentStop 无法覆盖“未 spawn”
**What goes wrong:** orchestrator 直接在主上下文做事、不 spawn 子代理时，SubagentStop 根本不触发，导致漏检。
**How to avoid:** 必须用 Stop 做回合末断言（缺委托即 block）。
**Warning signs:** 发现“未 spawn 子代理也没被拦截”。

### Pitfall 2: exit code 2 时 stdout JSON 不生效
**What goes wrong:** 开发者在 exit 2 时输出 JSON（希望 Claude Code 解析 decision/permissionDecision），但 Claude Code 会忽略 stdout JSON，只读 stderr。
**How to avoid:**
- 需要结构化决策时：exit code 0 + stdout JSON。
- 需要简单阻止时：exit code 2 + stderr 文本。
**Source:** hooks reference 明确说明“JSON output only processed when exit code 0”。

### Pitfall 3: /gsd:quick 的 AskUserQuestion 与“委托前禁止 non-Task tool”冲突（需要确认）
**What goes wrong:** 现有 `commands/gsd/quick.md` 在 spawn 子代理前会调用 AskUserQuestion 获取任务描述；若严格执行“委托前禁止任何非 Task 工具”，会把 /gsd:quick 误伤。
**How to avoid:** 需要在命令映射里声明“哪些工具在委托前允许”（否则 ERR-03 无法满足）。
**Warning signs:** /gsd:quick 一运行就被 hook 拦截，提示必须先 Task。

### Pitfall 4: `commands/gsd/plan-phase.md` 目前用 `subagent_type="general-purpose"`（与 ENF-03 预期不一致）
**What goes wrong:** ENF-03 要求“必须 spawn gsd-planner”，但当前 plan-phase 的示例 Task 调用看起来用的是 `general-purpose` 并通过 prompt 让它“读 gsd-planner.md”。如果 hook 只按 `tool_input.subagent_type == "gsd-planner"` 判断，会把合法流程误判。
**How to avoid:** 需要决定“以 Task 的 subagent_type 为准”还是“以 prompt/description 的约定为准”，并据此写映射与检测逻辑。

## Code Examples

### settings.json: 注册全局 hooks（示意）
```json
// Source: https://code.claude.com/docs/en/hooks#configuration
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/gsd-enforce.js\"",
            "timeout": 60
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/gsd-enforce.js\"",
            "timeout": 60
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/gsd-enforce.js\"",
            "timeout": 60
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/gsd-enforce.js\"",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### PreToolUse: deny 非允许工具（stdout JSON）
```json
// Source: https://code.claude.com/docs/en/hooks#pretooluse-decision-control
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "GSD enforcement: /gsd:plan-phase must delegate to Task(subagent=gsd-planner) before using other tools."
  }
}
```

### Stop: 阻止回合结束（stdout JSON）
```json
// Source: https://code.claude.com/docs/en/hooks#stopsubagentstop-decision-control
{
  "decision": "block",
  "reason": "GSD enforcement: expected subagent not spawned (use Task)."
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| 仅靠提示词要求“请用 Task” | 用 hooks 在事件点强制执行 | Claude Code hooks 体系成熟后 | 防止静默绕过，保证架构不变式 |
| 用 PostToolUse 事后纠正 | 用 PreToolUse 事前 deny（fail-fast） | 官方 hooks 提供 permissionDecision | 更接近“阻止破坏”而非“事后补救” |

**Deprecated/outdated:**
- **在 exit code 2 时输出 stdout JSON 期待被解析：** hooks 参考明确指出 exit 2 时 stdout JSON 不处理。

## Open Questions

1. **SubagentStop 是否能稳定得到“agent_type”用于精准校验？**
   - What we know: hooks reference 示例里 `SubagentStop` 输入包含 `agent_id` 与 `agent_transcript_path`，未明确包含 `agent_type`。
   - What's unclear: 是否能通过 matcher 过滤 agent type，或在某些版本里会附带 `agent_type`。
   - Recommendation: Phase 1 先把“spawn 校验”放在 PreToolUse(Task)；SubagentStop 仅用作“完成信号”与 fail-loud。必要时在实现阶段用 `claude --debug` 打印 stdin JSON 验证字段。

2. **Task 工具输入 JSON 的字段名（尤其 subagent type）在 Claude Code 里是否总是 `tool_input.subagent_type`？**
   - What we know: hooks reference 给了 Bash/Write/Edit/Read 的 schema，但未给 Task schema。
   - Recommendation: 实现阶段先把 PreToolUse(Task) 的 stdin JSON 结构化打印到临时日志（注意脱敏），确认字段名后再锁死解析逻辑。

3. **严格“委托前禁止 non-Task tool”如何与 /gsd:quick 的 AskUserQuestion 兼容？**
   - What we know: 当前 quick 流程需要先获取用户输入。
   - Recommendation: 需要产品决策：要么把 AskUserQuestion 明确纳入“委托前允许的工具集合”，要么调整 quick 工作流使其满足强约束。

4. **/gsd:plan-phase 当前用 general-purpose vs 预期 gsd-planner 的一致性策略**
   - What we know: `commands/gsd/plan-phase.md` 的示例 Task 调用使用 `subagent_type="general-purpose"`，但项目需求 ENF-03 要求“必须 spawn gsd-planner”。
   - Recommendation: 以“真正的 subagent（subagent_type=gsd-planner）”为标准，优先把 orchestrator 里的 Task 调用改成使用该 subagent；hook 规则也更简单、更确定。

## Sources

### Primary (HIGH confidence)
- https://code.claude.com/docs/en/hooks — Hook events, input schemas, exit code vs JSON behavior
- https://code.claude.com/docs/en/hooks-guide — settings.json 配置示例（matcher + hooks 数组）
- https://code.claude.com/docs/en/skills — Skill/command frontmatter（allowed-tools / agent / context: fork）
- https://code.claude.com/docs/en/sub-agents — Subagents 概念与字段（agent_id / agent_type 等）

### Project sources (HIGH confidence)
- /home/adam/projects/get-shit-done/.planning/phases/01-core-enforcement-hook/01-CONTEXT.md — Phase 1 锁定决策（fail-fast、fail-closed、同回合产物等）
- /home/adam/projects/get-shit-done/.planning/ROADMAP.md — Phase 1 目标与计划分解
- /home/adam/projects/get-shit-done/.planning/REQUIREMENTS.md — HOOK/ENF/ERR 需求条目
- /home/adam/projects/get-shit-done/bin/install.js — 全局安装/卸载写入 settings.json 的既有模式
- /home/adam/projects/get-shit-done/scripts/build-hooks.js — hooks/dist 构建模式（复制 hooks）
- /home/adam/projects/get-shit-done/commands/gsd/plan-phase.md — 现有 orchestrator 对 Task 的用法（需与 ENF-03 对齐）
- /home/adam/projects/get-shit-done/commands/gsd/quick.md — 现有 quick 流程（AskUserQuestion + Task）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 官方 hooks/skills/subagents 文档 + 本 repo 既有实现可直接复用
- Architecture: MEDIUM — 核心事件流与阻止机制明确；但 Task/SubagentStop 的字段细节存在不确定点（见 Open Questions）
- Pitfalls: HIGH — 官方“exit code 2 vs JSON”与本项目内 PITFALLS 研究一致，且已有复现实例路径

**Research date:** 2026-01-29
**Valid until:** 2026-02-28
