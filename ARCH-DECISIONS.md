# 架构决策记录 (Architecture Decision Records)

> 记录认知引擎 v0.1.0 实现与原始 ARCHITECTURE.md 规格的关键偏离、简化与决策理由。
> 每个决策记录包含：**偏离了什么 → 为什么 → 对 MVP 的影响 → 何时需要升级**。

---

## ADR-01: 额叶左右合并为双阶段策略引擎

### 原始规格

ARCHITECTURE.md §3 定义了两个独立额叶模块：
- **额叶左**（LangGraph CoT）：逐步推理、约束求解、步骤分解
- **额叶右**（AutoGen ToT）：发散探索、类比生成、风险评估

两个模块在 Z=2 层并行运行，输出到 Hermes 收束器。

### 实际实现

合并为单一 `frontal/` 模块，采用**双阶段流水线**：
- **Phase 1**（不等颞叶）：基于顶叶的意图层 + 注意力分配，快速产出预判方向
- **Phase 2**（等颞叶完成后）：基于完整的语义单元 + 领域分类 + 实体图，产出完整策略

### 决策理由

1. **API 调用成本**：两个独立额叶模块各需一次 LLM 调用，合并后 Phase1+Phase2 仍为两次调用，但 Phase1 轻量（8000ms 超时），Phase2 充分利用颞叶结果（20000ms 超时），总成本一致但信息利用率更高
2. **实现复杂度**：LangGraph 图状态机 + AutoGen 多 Agent 辩论模式需要额外的基础设施（消息总线、辩论协议），对 MVP 过度工程化
3. **能力保留**：Phase1 的"不等颞叶先预判"捕捉了右脑 ToT 的直觉发散特质；Phase2 的"完整语义+策略评分"捕捉了左脑 CoT 的严谨推理特质

### MVP 影响评估

| 维度 | 评估 |
|------|------|
| 缺失能力 | 多路径辩论（AutoGen debate mode）、多策略并行产出 |
| 保留能力 | 双阶段推理、4维度策略评分、预判-修正循环 |
| 可升级性 | 接口设计为 `frontalPhase1()` + `frontalProcess()` 两个独立函数，后续可拆回两个独立模块 |

### 升级触发条件

当以下任一条件满足时，考虑拆回左右独立：
- 需要显式的"方案 A vs 方案 B"辩论输出
- 用户反馈单策略决策质量不足
- API 并发能力允许 4+ 脑区同时调用

---

## ADR-02: 海马体使用内存模拟替代 ChromaDB + Neo4j

### 原始规格

ARCHITECTURE.md §9 定义了三层记忆架构：
- **STM**：Letta 虚拟上下文管理（~25K token）
- **LTM**：ChromaDB 6 个 collection（conversations/facts/preferences/knowledge/patterns/errors）
- **语义层**：Neo4j 知识图谱（实体+关系+属性）

### 实际实现

- **STM**：内存数组 `ShortTermMemory`，token 估算裁剪，接口完整（add/getRecent/clear）
- **LTM**：内存 Map 模拟 ChromaDB 的 6 个 collection，基于关键词匹配模拟向量检索
- **语义层**：内存 `Map<string, string>` 键值对 + 三元组关系数组，替代 Neo4j 图查询

### 决策理由

1. **零外部依赖启动**：ChromaDB 需要独立进程（Python 或 Docker），Neo4j 需要 Java 运行时。内存模拟允许 `npm install && npm start` 一键运行
2. **接口兼容**：`Hippocampus.query()` / `.consolidate()` / `.learnPreference()` 接口签名与真实 ChromaDB 一致，替换实现时只需改 `LongTermMemory` 内部逻辑
3. **MVP 记忆需求低**：v0.1.0 的对话量级（单次 REPL 交互）不需要真正的向量检索

### MVP 影响评估

| 维度 | 评估 |
|------|------|
| 缺失能力 | 跨会话记忆持久化（进程重启丢失）、语义相似度检索（仅关键词匹配） |
| 保留能力 | 单次会话内 STM 裁剪、记忆巩固接口、三层架构骨架 |
| 可升级性 | `LongTermMemory` 类的 `store()`/`query()` 可直接替换为 ChromaDB client 调用；`SemanticMemory` 可替换为 Neo4j driver 调用 |

### 升级触发条件

当以下任一条件满足时，升级到真实 ChromaDB：
- 需要跨进程/跨会话持久化记忆
- 单次会话 LTM 条目超过 1000 条
- 需要基于语义相似度而非关键词匹配做记忆检索

---

## ADR-03: 杏仁核自实现替代 NeMo-Guardrails 集成

### 原始规格

ARCHITECTURE.md §8 定义：
- **快速通路**：NeMo-Guardrails 内置规则
- **慢速通路**：LLM-Guard 安全扫描

### 实际实现

- **快速通路**：自定义正则表达式数组（`BLOCK_PATTERNS` + `WARNING_PATTERNS`），< 10ms
- **慢速通路**：LLM 调用（temperature=0.1, maxTokens=512），50-200ms
- 两层均有开关（`AMYGDALA_FAST_ENABLED` / `AMYGDALA_SLOW_ENABLED`）

### 决策理由

1. **语言栈不兼容**：NeMo-Guardrails 是 Python 库，在 TypeScript 项目中需要子进程桥接，增加延迟和复杂度
2. **规则可维护性**：正则数组结构简单，后续可热加载规则文件（JSON/YAML）而不需要改代码
3. **接口一致**：输出 `AmygdalaSignal`（level/threatType/confidence/action/note）与规格完全一致

### MVP 影响评估

| 维度 | 评估 |
|------|------|
| 缺失能力 | NeMo-Guardrails 的对话流护栏（dialogue rails）、上下文安全校验 |
| 保留能力 | 双通路架构、分级响应（PASS/FLAG/BLOCK）、信号传递到下游脑区 |
| 可升级性 | `amygdalaCheck()` 是纯函数接口，可随时替换为 NeMo-Guardrails HTTP API 调用 |

### 升级触发条件

- 生产环境需要对话级安全护栏（不只是单条输入扫描）
- 安全规则超过 50 条正则，手动维护成本过高

---

## ADR-04: 突显网络简化为基础 FSM（未完整移植 FreeLLMAPI Router）

### 原始规格

ARCHITECTURE.md §6 要求将 FreeLLMAPI Router（~200行）完整改造为突显网络，包括：
- 性能系数追踪（滑动平均延迟、成功/失败计数）
- 动态权重衰减（向 1.0 回归，每 5 分钟 +0.05）
- 脑区冷却机制（低效后冷却 30s）
- 认知预算检查（类似 RPM/RPD/TPM/TPD）
- Round-robin 轮询
- Sticky session（同任务内不切换模式）

### 实际实现

- 7 状态 FSM + 事件队列（`SalienceFSM`）：核心转换表完整
- 基础调度指标（`SalienceMetrics`）：超时计数、降级事件、健康检查
- 权重矩阵（`mode-weights.ts`）：5 模式 × 14 脑区静态权重
- 丘脑路由（`thalamus/index.ts`）：输入分类 → 模式选择 → 权重查询 → 预算分配

### 决策理由

1. **FreeLLMAPI Router 面向的是分布式 API 网关场景**（多 provider、多 key、速率限制），其复杂度（cooldown、round-robin、sticky session）对同进程内调度是过度设计
2. **核心价值保留**：模式选择 → 权重查询 → 激活决策 → 预算分配的链路完整，这本身就是 FreeLLMAPI Router 的路由核心
3. **代码行数**：完整移植约需 +300 行，但实际带来的调度增益有限（同进程内没有网络故障/速率限制等分布式问题）

### MVP 影响评估

| 维度 | 评估 |
|------|------|
| 缺失能力 | 脑区性能系数动态调整、冷却机制、sticky session |
| 保留能力 | 7 状态 FSM、5 模式权重矩阵、事件驱动转换、超时监控 |
| 可升级性 | `SalienceFSM` 类方法独立，可逐步注入性能追踪逻辑而不改接口 |

### 升级触发条件

- 引入多 LLM provider 竞争（不同脑区用不同模型）
- 脑区频繁超时需要动态降权
- 需要基于历史性能数据做 A/B 路由

---

## ADR-05: 小脑使用规则优化替代 DSPy 自动化

### 原始规格

ARCHITECTURE.md §11.2 定义：
- DSPy 自动调优各脑区的 Prompt
- Langfuse 监控追踪
- 7 类技能分别追踪

### 实际实现

- 7 技能追踪器（reasoning/coding/writing/teaching/analysis/creative/conversation）
- 滑动平均延迟统计
- 错误模式收集
- **规则式 Prompt 优化**：检测错误关键词（parsing/timeout/irrelevant）→ 追加对应约束到 Prompt 末尾

### 决策理由

1. **DSPy 是 Python 库**，在 TypeScript 项目中需要子进程调用，且需要训练数据积累
2. **规则优化对 MVP 足够**：JSON 解析错误 → 加"必须合法 JSON"约束；超时 → 加"输出简洁"约束；跑题 → 加"相关性约束"
3. **接口设计兼容**：`optimizePrompt(skill, currentPrompt, errorPatterns)` 的签名可直接替换为 DSPy 调用

### MVP 影响评估

| 维度 | 评估 |
|------|------|
| 缺失能力 | 基于训练数据的自动 Prompt 优化、A/B 测试、优化效果量化 |
| 保留能力 | 7 技能健康追踪、错误模式收集、优化历史记录 |
| 可升级性 | `generateOptimization()` 方法可替换为 DSPy API 调用，接口不变 |

### 升级触发条件

- 错误模式超过 20 种，规则维护成本高
- 积累至少 100+ 次交互数据用于训练
- 需要 A/B 测试对比优化前后效果

---

## ADR-06: TypeScript 替代 Python

### 原始规格

ARCHITECTURE.md §12 代码基座选型中，突显网络的示例代码（§4-7）均为 Python（asyncio），海马体、额叶、Hermes 等模块的设计文档也以 Python 伪代码为主。

### 实际实现

全部 TypeScript（Node.js），原因：

1. **Hermes Agent 是 TypeScript 原生**：作为代码基座，选择同语言避免 FFI/子进程开销
2. **Promise.all 天然并行**：Node.js 异步模型对"三角并行（顶叶∥颞叶∥额叶）"是原生支持
3. **类型系统优势**：14 脑区 × 多种 Schema 的接口契约，TypeScript 编译时检查远优于 Python 运行时
4. **前端集成路径**：未来桌面壳（Tauri/Electron）与 Node.js 运行时共享类型定义

### 影响

| 维度 | 评估 |
|------|------|
| 开发效率 | TypeScript 类型系统在复杂接口场景下开发更快（IDE 自动补全 + 编译时错误） |
| 性能 | 并行 I/O 场景（LLM API 调用）Node.js 与 Python asyncio 相当 |
| 生态 | 部分 Python 专属库（NeMo-Guardrails、DSPy）无法直接使用 → 见 ADR-03、ADR-05 |

---

## ADR-07: DMN 自管理替代 SOUL.md + Honcho

### 原始规格

ARCHITECTURE.md §3 #14：
- SOUL.md 结构化自我描述文件
- Honcho 辩证用户建模

### 实际实现

- 内存 `SelfModel` 对象（identity/capabilities/limitations/values/knowledge_boundaries）
- 初始化默认值，运行时可 `addCapability()` / `addLimitation()` 动态更新
- 每 10 次交互触发 LLM 自我反思（`selfReflect()`）
- 反思结果自动写入 SelfModel 的新能力/新限制

### 决策理由

1. **Honcho 需要独立 Python 服务**：辩证建模对 MVP 过度工程化
2. **SOUL.md 是文件格式而非架构**：当前 `SelfModel` 对象就是 SOUL.md 的内存表示，后续导出为 YAML 即可
3. **自我反思闭环完整**：交互 → 反思 → 更新自我模型 → 影响下次响应

### MVP 影响评估

| 维度 | 评估 |
|------|------|
| 缺失能力 | 文件持久化（进程重启 SelfModel 重置）、辩证用户画像 |
| 保留能力 | 自我模型结构完整、定期反思、能力/限制动态更新 |
| 可升级性 | `getSelfModel()` / `updateSelfModel()` 接口不变 |

---

## ADR-08: 运动皮层未集成 MCP 协议

### 原始规格

ARCHITECTURE.md §3 #11：
- Hermes 70+ tools 集成
- MCP 协议（Model Context Protocol）

### 实际实现

- `planActions()` 将 Hermes 行动决策映射为 5 种内部动作类型（reply/tool_call/ask_user/decline/search）
- `executeReply()` 直接返回文本响应
- 无外部工具调用能力

### 决策理由

1. **工具调用需要工具生态**：MVP 阶段没有定义具体工具集（搜索、计算、文件操作等）
2. **MCP 是独立协议层**：需要在 Hermes 收束器与运动皮层之间插入 MCP Client，不改变现有架构
3. **dispatch 架构已就位**：`MotorAction.type` 的 5 种分发已经覆盖了主要响应模式

### 升级触发条件

- 定义第一批工具（搜索 API、代码执行沙箱、文件操作）
- 部署 MCP Server 并注册工具列表

---

## ADR-09: 扣带回使用规则引擎替代 NLI 模型

### 原始规格

ARCHITECTURE.md §3 #6：
- ECA ConflictMonitor
- HuggingFace NLI（自然语言推理）模型

### 实际实现

- **置信度差异检测**：任意两个脑区置信度差异 > 0.5 → 标记冲突
- **额叶内部冲突**：额叶自身产出的策略冲突列表（`frontal.conflicts`）透传
- **共识度计算**：平均置信度 - 冲突数 × 0.1

### 决策理由

1. **NLI 模型需要 ML 运行时**：部署成本高，且对 MVP 阶段的冲突检测提升有限
2. **规则已覆盖核心冲突类型**：semantic（置信度差异）、strategic（额叶内部矛盾）
3. **冲突检测的本质是信号对比**，不是语义理解——两个脑区置信度差 0.7 本身就是强信号

### MVP 影响评估

| 维度 | 评估 |
|------|------|
| 缺失能力 | factual conflict（事实矛盾检测）、value conflict（价值观冲突）、NLI 语义冲突 |
| 保留能力 | 置信度差异检测、策略冲突透传、共识度量化 |
| 可升级性 | `detectConflicts()` 是无状态函数，可随时增加 NLI 调用而不改接口 |

---

## ADR-10: 统一 LLM 模型（不区分脑区）

### 原始规格

ARCHITECTURE.md §6.5 / §13 Appendix A 未强制要求多模型，但暗示不同脑区可用不同模型。

### 实际实现

所有 7 个调 LLM 的脑区（杏仁核慢通、顶叶、颞叶、额叶 Phase1、额叶 Phase2、Hermes、DMN）共用一个模型 `deepseek-chat`。

### 决策理由

1. **配置简单**：一个 API Key 管理，成本统一核算
2. **差异化通过 Prompt**：不同脑区的系统提示词差异极大（安全评估 vs 语义分析 vs 策略评分），模型能力一致但行为分化
3. **架构文档推荐**：ARCHITECTURE.md §6.5 明确写 "default: deepseek-v4-pro，统一模型，所有脑区共享"

### 升级触发条件

- 特定脑区（如颞叶语义分析）需要更强的推理模型
- 成本优化：轻量脑区（杏仁核慢通）可换便宜的小模型

---

## 总结：偏离度矩阵

| 脑区/模块 | 偏离程度 | 核心原因 | 升级优先级 |
|-----------|:--------:|----------|:----------:|
| 额叶 | 中 | 左右合并双阶段，保留推理核心 | P1（辩论能力） |
| 海马体 | 高 | 内存模拟替代 ChromaDB+Neo4j | P1（持久化） |
| 杏仁核 | 中 | 自实现替代 NeMo-Guardrails | P2（对话护栏） |
| 突显网络 | 中 | 简化 FSM，未完整移植 Router | P2（性能追踪） |
| 小脑 | 高 | 规则替代 DSPy | P3（需数据积累） |
| 扣带回 | 中 | 规则替代 NLI 模型 | P2（语义冲突） |
| 运动皮层 | 中 | 未集成 MCP 工具 | P1（工具能力） |
| DMN | 低 | 内存替代 Honcho | P3（用户建模） |
| 语言栈 | 全局 | TypeScript 替代 Python | 不可逆 |

**总原则**：所有偏离都是**接口兼容的简化**——每个模块的入口/出口接口与设计文档一致，内部实现可从模拟逐步升级到真实基础设施，不需要改调用方。
