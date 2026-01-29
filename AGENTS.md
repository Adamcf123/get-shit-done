<!-- claudemd:begin -->
<AGENTS>
  <LANGUAGE>
    默认中文沟通；代码标识符保留原文。
    向用户解释时，先用业务语言描述整体流程，再补充技术细节。
  </LANGUAGE>

  <BEFORE_WORK>
    <CHECKLIST>
      <ITEM>命令入口：优先查项目根目录的 `重要命令.txt`、`scripts/`、`docs/` 目录。</ITEM>
    </CHECKLIST>
  </BEFORE_WORK>

  <TESTING>
    <PYTEST>
      <RULE>禁止使用 -q/--quiet</RULE>
      <VENV>先进入虚拟环境（优先 .venv，其次 venv）</VENV>
      <RUN>source .venv/bin/activate 2>/dev/null || source venv/bin/activate 2>/dev/null && pytest -ra --tb=line</RUN>
    </PYTEST>
  </TESTING>

  <WORKFLOW>
    <BEFORE_WORK>
      <CHECKLIST>
        <ITEM>命令入口：优先查项目根目录的 `重要命令.txt`、`scripts/`、`docs/` 目录。</ITEM>
      </CHECKLIST>
    </BEFORE_WORK>

    <BEST_PRACTICE>
      <RULE>持续进行架构性改动和重构式开发，使用简洁、一劳永逸的方式编码，让系统不可能出错。</RULE>
      <BAD_EXAMPLE>
        以下是典型的非架构性改动，应避免使用：
        1. 增加检查/校验：到处加 if data is None 检查，而非用类型系统保证非空
        2. 增加重试/兜底：加 retry 3 次、返回默认值，而非解决不稳定的根因
        3. 增加日志/监控：加更多 logger.info 排查问题，而非让数据流天然可追溯
        4. 增加锁/同步：加 mutex/lock 防并发冲突，而非消除共享状态
        5. 增加文档/注释：写 WARNING 注释警告 API 误用，而非让 API 设计上不可能误用
        6. 增加异常捕获/吞错：try-except pass 吞掉异常继续跑，而非让错误不发生或立即暴露
      </BAD_EXAMPLE>
    </BEST_PRACTICE>

    <BUSINESS_LOGIC_PARAMETERIZATION>
      <DEFINITION>
        业务逻辑参数化：AI 通过增加参数/开关/配置项来表达业务逻辑的变化，而非直接修改代码。
        判断标准：参数是否影响业务结果（输出不同、行为不同）。影响业务结果 = 业务逻辑参数。
      </DEFINITION>

      <RULE>禁止用参数表达业务逻辑变化。当用户要求改变业务逻辑时，直接修改代码；当用户要求删除功能时，删除相关代码。</RULE>

      <PROHIBITED>
        以下类型的参数禁止引入：
        - 行为开关：--force, --legacy, --skip-check, --enable-feature-x
        - 模式切换：--v1-mode, --use-new-binding, --compatibility-mode
        - 功能开关：enable_feature_a=true, disable_validation=true
        - 任何用于绕过正常流程或兼容旧行为的参数
      </PROHIBITED>

      <ALLOWED>
        以下类型的参数允许存在：
        - 用户输入：--input-file, --output-dir（用户必须指定的输入）
        - 调试/日志：--verbose, --quiet（不影响业务结果）
        - 性能调优：--parallel=4, --batch-size=100
        - 输出格式：--format=json（当不影响下游业务结果时）
      </ALLOWED>

      <HANDLING>
        当 AI 倾向于增加业务逻辑参数时：
        1. 默认假设无兼容性约束，直接修改代码
        2. 默认假设有测试覆盖，改动后测试会暴露问题
        3. 仅当用户指令有歧义或涉及业务逻辑决策时，询问用户
        4. 当代码库存在多种不一致模式时，询问用户统一方向
        5. 破坏性改变应升级主版本号
      </HANDLING>

      <SCOPE>本规则适用于：CLI 命令行参数、函数/方法参数、配置文件选项、环境变量。</SCOPE>
    </BUSINESS_LOGIC_PARAMETERIZATION>

    <API_CLARITY>
      <RULE>避免“黑洞参数”：不要使用过于宽泛的 dict/context 作为接口输入；优先显式参数，或使用 TypedDict/dataclass 定义结构。</RULE>
      <RULE>只有为向后兼容或 API 演进不得不新增“可选参数”时才允许：该参数不得改变业务结果；要求清晰命名、类型标注齐全，并在入口做严格类型校验（fail-loud）。</RULE>
      <RULE>避免“面条式兼容”：兼容逻辑只允许出现在入口层，先做归一化/校验，再进入核心单一路径；禁止在核心逻辑中散落新旧分支判断。</RULE>
      <RULE>所有向后兼容代码必须使用注释显式标注“向后兼容”，并说明向后兼容的目的。</RULE>
      <RULE>对外可见的结构化类型必须导出，保证调用方可发现与复用。</RULE>
    </API_CLARITY>

    <FALLBACK_POLICY>
      <!-- 语义契约 -->
      <CONTRACT>
        <RULE>Every public API MUST declare its semantic contract in docs + tests.</RULE>
        <FIELDS>accuracy, freshness, latency_SLO, security_boundary, side_effects/idempotency</FIELDS>
        <RULE>Any contract change MUST update docs + tests.</RULE>
      </CONTRACT>

      <!-- Fallback 规则 -->
      <FALLBACK_RULES>
        <PROHIBITED>Return non-contract output while labeling it as contract output.</PROHIBITED>
        <PROHIBITED>Any fallback that weakens auth or tenant isolation (fail-closed).</PROHIBITED>
        <ALLOWED>Alternate path is allowed ONLY if all contract fields are preserved AND telemetry marks fallback_path_used=true.</ALLOWED>
        <PARTIAL>Partial results are FORBIDDEN unless contract explicitly supports partial=true and response sets partial=true.</PARTIAL>
      </FALLBACK_RULES>

      <!-- 重试策略 -->
      <RETRY>
        <RULE>Retry ONLY when dependency policy classifies the failure as transient.</RULE>
        <RULE>Retry ONLY if operation is idempotent or uses an idempotency key.</RULE>
        <RULE>Non-idempotent writes MUST NOT be retried.</RULE>
        <RULE>Use bounded exponential backoff.</RULE>
        <RULE>Project MUST maintain a dependency_policy defining transient vs non-transient errors per dependency.</RULE>
      </RETRY>

      <!-- 有状态操作 -->
      <STATEFUL>
        <RULE>Atomicity REQUIRED within declared transaction boundary.</RULE>
        <RULE>Cross-service state changes MUST use explicit compensation or be disallowed.</RULE>
        <RULE>Partial success MUST NOT be silently returned.</RULE>
      </STATEFUL>

      <!-- Fail-Loud 规范 -->
      <FAIL_LOUD>
        <RULE>Default is fail-loud in dev/test/prod.</RULE>
        <RULE>Errors MUST be classified as SystemFault or UserFault.</RULE>
        <RULE>Throw at tool layer; decide policy at entry layer.</RULE>
      </FAIL_LOUD>

      <!-- 可观测性 -->
      <OBSERVABILITY>
        <RULE>All successes and fallbacks MUST be traceable.</RULE>
        <FIELDS>fallback_path_used, dependency, attempt_count, failure_reason, idempotency_key_hash(if any)</FIELDS>
      </OBSERVABILITY>
    </FALLBACK_POLICY>
  </WORKFLOW>
  <EXPRESSION>
    **技术表达规范**：清晰的技术表达需同时包含业务含义和技术定位。

    **核心句式**
    ```
    [什么]（[在哪]）[做了什么] → [影响了什么]（[在哪]）
    ```

    - **什么** — 用业务语言描述对象的性质
    - **在哪** — 用括号标注文件、函数、变量、配置项等技术位置
    - **做了什么** — 动作：新增、修改、移除、派生、替代、调用...
    - **影响了什么** — 可选，说明下游影响或结果

    **示例**
    - 正确："配置定义（`taxonomy.py:SLUG_DEFINITIONS`）派生出标识符集合（`TECHNIQUE_SOURCE_SLUGS`）"
    - 错误："`SLUG_DEFINITIONS` 派生 `TECHNIQUE_SOURCE_SLUGS`"（缺业务含义）
    - 错误："改了认证逻辑"（缺技术定位）
  </EXPRESSION>
</AGENTS>
<!-- claudemd:end -->
