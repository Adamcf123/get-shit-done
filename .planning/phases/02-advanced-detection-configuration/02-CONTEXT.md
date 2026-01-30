# Phase 2: Advanced Detection & Configuration - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

检测复杂欺骗模式（如"假并行"声明）并提供可维护的 GSD 命令→子代理映射配置。用户可以在项目级配置中声明命令映射，hook 在回合结束时校验实际调用是否符合预期。

</domain>

<decisions>
## Implementation Decisions

### 假并行检测逻辑
- 检测方式：文本分析 + 计数结合 — 先用关键词正则检测文本中的"并行"声明，再校验实际 Task 调用数
- 关键词正则：匹配"并行"/"parallel"/"同时启动 N 个"等关键词
- 期望并行数：从文本中提取数字（如"启动 4 个"→ expected=4）
- 计数方式：总数计数，不区分 subagent 类型
- 判定阈值：仅检测完全欺骗 — 声称 N 个但实际只有 1 次调用才拦截
- 处理策略：容忍部分并行 — 声称 N 个但实际 < N 不拦截（只要 > 1）
- 检查时机：PreToolUse 跟踪 Task 调用，Stop 最终判定

### 配置文件格式
- 存放位置：合并到项目级 .planning/config.json
- 作用域：项目级（每个项目可不同）
- 命令名匹配：精确匹配（完整命令名如 gsd:plan-phase）

### 校验规则设计
- 规则类型：同时支持 required_subagent 和 expected_artifacts
- 组合逻辑：required_all — 所有规则都必须通过
- 错误消息：结构化详细消息 — 包含命令名、期望的 subagent、实际调用、修复建议
- 并行数来源：从文本提取（不在配置中声明 min_parallel）

### 热重载与演进
- 生效方式：无热重载 — 需要重启 Claude Code 才生效
- 配置校验：启动时校验 — hook 启动时校验配置格式，无效则报错
- 新命令添加：手动添加到配置
- 未配置命令：警告但不拦截

### Claude's Discretion
- 配置中命令映射的具体数据结构（命令名为 key 或数组形式）
- 关键词正则的具体模式
- 错误消息的具体格式和措辞

</decisions>

<specifics>
## Specific Ideas

- 假并行检测的核心场景：orchestrator 声称"并行启动 4 个 researcher"但实际只发送 1 个 Task 调用
- 配置应该简洁，不需要为每个命令声明 min_parallel — 从文本动态提取更灵活
- 警告未配置命令而非拦截，避免新命令被误伤

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-advanced-detection-configuration*
*Context gathered: 2026-01-30*
