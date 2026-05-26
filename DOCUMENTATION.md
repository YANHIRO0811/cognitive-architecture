# Cognitive Engine — 脑启发 AI 认知引擎 说明文档

> 14 脑区并行认知架构 | v0.1.0 | TypeScript | MIT

---

## 目录

1. [项目概述](#1-项目概述)
2. [架构总览](#2-架构总览)
3. [脑区模块详解](#3-脑区模块详解)
   - [Z=0 杏仁核 — 安全护栏](#30-杏仁核-amygdala--安全护栏)
   - [Z=0 丘脑 — 智能路由](#31-丘脑-thalamus--智能路由与动态竞标)
   - [Z=1 顶叶 — 注意力分配](#32-顶叶-parietal--注意力分配)
   - [Z=1 海马体 — 三层记忆](#33-海马体-hippocampus--三层记忆)
   - [Z=2 颞叶 — 语义分析](#34-颞叶-temporal--语义分析)
   - [Z=2 额叶 — 策略引擎](#35-额叶-frontal--双阶段策略引擎)
   - [Z=2 扣带回 — 冲突检测](#36-扣带回-acc--冲突检测)
   - [Z=3 Hermes — 收束融合](#37-hermes--收束融合与5种行动决策)
   - [Z=4 运动皮层 — 动作执行](#38-运动皮层-motor--动作执行)
   - [后台 基底节 — 强化学习](#39-基底节-bg--q-learning)
   - [后台 小脑 — 三向优化](#310-小脑-cerebellum--三向优化)
   - [后台 DMN — 自我模型](#311-dmn--自我模型)
   - [突显网络 — 事件调度](#312-突显网络-salience--事件调度)
4. [数据流与认知链路](#4-数据流与认知链路)
5. [动态调度机制](#5-动态调度机制)
6. [配置与运行](#6-配置与运行)
7. [API 参考](#7-api-参考)
8. [开发指南](#8-开发指南)
9. [架构决策记录](#9-架构决策记录)
10. [测试覆盖](#10-测试覆盖)

---

## 1. 项目概述

**Cognitive Engine** 是一个仿人脑三维结构的 AI 认知处理引擎，由 **13 个脑区 + 1 个调度网络** 组成并行认知管线。当用户发送一条消息时，引擎经过 **入口安全→路由分配→三角并行感知→语义+策略→冲突检测→多源收束→动作执行** 七个环节，最终产出带有置信度、不确定性标注和元认知信息的回复。

### 核心指标

| 指标 | 值 |
|------|:--:|
| 脑区数量 | 14（13 功能模块 + 突显网络） |
| LLM 调用脑区 | 7（杏仁核慢通、顶叶、颞叶、额叶Phase1、额叶Phase2、Hermes、DMN） |
| 纯本地脑区 | 7（丘脑、海马体、扣带回、运动皮层、基底节、小脑、突显网络） |
| 认知模式 | 5（CEN/DMN/EMERGENCY/CREATIVE/TEACHING） |
| 行动决策类型 | 5（ANSWER/ASK_CLARIFICATION/SEARCH_FIRST/DECLINE/DEFER） |
| 语言栈 | TypeScript (ES2022) |
| LLM | DeepSeek-v4-pro（OpenAI兼容接口） |
| 测试用例 | 77（全部通过） |

---

## 2. 架构总览

### 三维空间模型（Z轴分层）

```
┌──────────┐
│  Z=0 ────┼── 杏仁核（安全） → 丘脑（路由）
│  Z=1 ────┼── 顶叶（注意力） ∥ 海马体（记忆）     ← 并行
│  Z=2 ────┼── 颞叶（语义） ∥ 额叶（策略） ∥ 扣带回 ← 并行
│  Z=3 ────┼── Hermes（收束融合）
│  Z=4 ────┼── 运动皮层（执行输出）
│  后台 ───┼── 基底节（RL） + 小脑（优化） + DMN（反思）
└──────────┘
```

### 完整处理管线（单次请求 ~35秒）

```
用户输入
  │
  ├── Z=0 杏仁核 ── 快速通路（正则，<10ms）→ 慢速通路（LLM，50-200ms）
  │     ├── BLOCK → 立即拦截，返回安全提示
  │     ├── FLAG  → 标记威胁，继续处理
  │     └── PASS  → 放行
  │
  ├── Z=0 丘脑 ── 输入分类 → 模式选择 → 动态竞标 → 资源分配
  │     └── 产出：ThalamusDecision（模式 + 激活列表 + 预算）
  │
  ├── Z=1-2 三角并行管线
  │     ├── 第1拍：顶叶（注意力，5s） ∥ 海马体（记忆检索，3s）
  │     ├── 第2拍：颞叶（语义分析，12s） ∥ 额叶Phase1（预判，8s）
  │     └── 第3拍：额叶Phase2（完整策略，20s）
  │
  ├── Z=2 扣带回 ── 置信度差异检测 → 策略冲突透传 → 共识度计算
  │
  ├── Z=3 Hermes ── 信号汇总 → MHC约束融合 → 冲突调制 → 情绪适配 → 行动决策
  │
  ├── Z=4 运动皮层 ── 动作规划 → 执行产出
  │
  └── 后台学习
        ├── 海马体记忆巩固
        ├── 基底节 Q学习更新
        ├── 小脑三向优化（调权+调人+调时）
        └── DMN 自我反思（每10次交互）
```

---

## 3. 脑区模块详解

### 3.0 杏仁核 (Amygdala) — 安全护栏

**输入**: 用户原始文本 `string`  
**输出**: `AmygdalaSignal`

#### 双通路架构

| 通路 | 实现 | 延迟 | 说明 |
|------|------|:----:|------|
| **快速通路** | 15条 BLOCK 正则 + 6条 WARNING 正则 | <10ms | 白名单豁免判断在前 |
| **慢速通路** | LLM 安全评估（temperature=0.1） | 50-200ms | 仅快速通路无匹配时触发 |

#### BLOCK 拦截规则（15条）
`forget previous`, `ignore above`, `prompt injection`, `system tag`, `do anything now`, `bypass safeguards`, `developer mode`, `god mode`, `jailbreak`, 违法内容等

#### WARNING 标记规则（7条）
自伤内容、角色扮演越狱、强制指令等

#### 白名单豁免（8个上下文）
安全审计、渗透测试、CTF、白帽黑客、OPSEC、爬虫框架、XSS研究、漏洞赏金——这些上下文下的请求不会误判为安全威胁

#### 输出信号

```typescript
interface AmygdalaSignal {
  level:        "SAFE" | "WARNING" | "CRITICAL";
  threat_type:  string | null;           // injection | jailbreak | harmful_content | self_harm
  confidence:   number;                  // 0-1
  action:       "PASS" | "FLAG" | "BLOCK";
  pathway:      "fast" | "slow" | "none"; // 判定来源
  note:         string;                   // 人类可读理由
  blocked_reason?: string;                // BLOCK时的拦截原因
}
```

#### 超时降级
慢速通路超时 → 默认 WARNING（保守标记，不阻塞）

---

### 3.1 丘脑 (Thalamus) — 智能路由与动态竞标

**输入**: 用户原始文本 + 杏仁核信号  
**输出**: `ThalamusDecision`

#### 路由决策流程

1. **输入分类** → 判断查询类型
2. **模式选择** → 匹配 5 种认知模式之一
3. **动态竞标** → 静态底价 × 能力匹配度 × 健康系数
4. **资源分配** → 根据确认激活的脑区分配认知预算

#### 动态竞标公式

```
final_bid = base_weight × capability_match × health_factor
```

- `base_weight`: 来自模式/权重矩阵的静态底价
- `capability_match`: 所需能力是否符合脑区契约 `can/prefers/cannot/blacklist`
- `health_factor`: 脑区近期健康指标（成功率、超时率）

#### 能力校验（黑名单拦截）

如果当前需要的能力在某个脑区的 `cannot` 或 `blacklist` 中 → **直接跳过，不参与竞标**

#### 输出结构

```typescript
interface ThalamusDecision {
  mode:             CognitiveMode;           // CEN | DMN | EMERGENCY | CREATIVE | TEACHING
  activatedRegions: RegionActivation[];      // 激活列表
  totalBudget:      number;
  priority:         "speed" | "quality" | "balanced";
}
```

---

### 3.2 顶叶 (Parietal) — 注意力分配

**输入**: `ParietalInput`（文本 + 杏仁核信号 + 上下文）  
**输出**: `ParietalOutput`

#### 核心能力

| 能力 | 说明 |
|------|------|
| `intent_extraction` | 提取显性/隐性意图层（surface/operational/strategic/emotional） |
| `attention_allocation` | 预算分配：主焦点60% / 次要上下文25% / 噪音15% |
| `entity_recognition` | 实体识别 + 权重标注 |
| `structural_analysis` | 判断是否含指令/问题/数据/情绪 |
| `tone_detection` | 输入语气检测 |

#### 激活等级
`URGENT` → `FOCUS` → `MONITOR` → `IGNORE`（四级升降机制）

#### 契约约束
- **cannot**: 策略生成、行动决策
- **时延**: 典型 5s，上限 5s
- **并行**: 与海马体并行

---

### 3.3 海马体 (Hippocampus) — 三层记忆

**输入**: `HippocampusInput`  
**输出**: `HippocampusOutput`

#### 三层架构

```
┌─────────────┐
│  STM 工作记忆   │ 内存数组，~25K tokens，自动裁剪
├─────────────┤
│  LTM 长期记忆   │ 6 collection 关键词匹配（模拟 ChromaDB）
│  conversations │ facts | preferences | knowledge
│  patterns      │ errors
├─────────────┤
│ 语义图谱        │ 实体节点 + 关系边 + 1跳遍历
└─────────────┘
```

#### 检索策略（不调 LLM）
- **STM**: 读内存数组，返回最近 N 轮对话
- **LTM**: 关键词匹配 6 个 collection，计算相似度分数
- **语义图谱**: 本地实体/关系查询，1 跳邻接遍历

#### 链接类型推断
`similarity ≥ 0.95 → "identical"` | `≥ 0.7 → "similar"` | `≥ 0.3 → "related"` | `< 0.3 → "novel"`

#### 巩固阶段（可调 LLM）
```typescript
hippocampus.consolidate(userMessage, systemResponse, useLlm?=false)
// useLlm=true 时调用 LLM（temperature=0.1, max_tokens=1024）
// 提取新事实、偏好、模式、错误教训
```

#### 5 种操作
```typescript
action: "query" | "store" | "consolidate" | "learn_preference" | "record_error"
```

---

### 3.4 颞叶 (Temporal) — 语义分析

**输入**: `TemporalInput`（文本 + 顶叶指引 + 记忆上下文）  
**输出**: `TemporalOutput`

#### 核心能力

| 步骤 | 产出 |
|------|------|
| 语义分解 | 语义单元列表（DECLARATIVE/PROCEDURAL/INTERROGATIVE/EMOTIONAL/META） |
| 领域分类 | 5维：domain + complexity + novelty + modality + language |
| 实体关系图 | 节点列表 + 边列表（关系+置信度） |
| 记忆链接 | 标记 identical/similar/related/novel/contradict |
| 不确定性 | 置信度 + 替代解释 |

#### 契约约束
- **cannot**: 策略生成、内容过滤
- **must_wait_for**: 海马体（记忆检索先于语义分析）
- **时延**: 典型 12s，上限 12s

---

### 3.5 额叶 (Frontal) — 双阶段策略引擎

**输入**: `FrontalInput`  
**输出**: `FrontalOutput`

#### 双阶段设计

```
Phase 1 (不等颞叶)          Phase 2 (等颞叶完成)
  ┌──────────────┐           ┌──────────────────┐
  │ 顶叶意图 + 注意力  │  ──→  │ 完整语义 + 实体图   │
  │ 快速预判方向      │      │ 4维评分策略        │
  │ 风险初评         │      │ 执行步骤分解       │
  └──────────────┘           └──────────────────┘
```

#### 4维策略评分
`feasibility(可行性) × fit(匹配度) × risk(风险) × efficiency(效率)` → `weighted_total`

#### 产出要素
- **strategies**: 多策略并行生成（每策略含完整执行步骤 + 资源需求 + 成败条件）
- **pre_judgments**: Phase1 快速预判（不等颞叶结果）
- **recommendation**: 首选策略 + 备选策略 + 是否需要追问
- **conflicts**: 策略间矛盾（透传给扣带回）

#### 契约约束
- **cannot**: 内容过滤
- **must_wait_for**: 颞叶（Phase2 强依赖颞叶语义结果）
- **时延**: Phase1 8s / Phase2 20s

---

### 3.6 扣带回 (ACC) — 冲突检测

**输入**: 各脑区输出 + 额叶策略冲突表  
**输出**: `ConflictReport`

#### 规则引擎（不调 NLI）

| 检测类型 | 实现 |
|----------|------|
| **置信度差异** | 任意两脑区 |置信度差| > 0.5 → 标记冲突 |
| **策略冲突** | 透传额叶自身的策略冲突列表 |
| **共识度** | 平均置信度 - 冲突数 × 0.1 |

#### 输出结构
```typescript
interface ConflictReport {
  conflicts: Array<{
    region_a: string;
    region_b: string;
    conflict_type: "semantic" | "strategic" | "factual" | "safety" | "value";
    description: string;
    severity: "minor" | "moderate" | "critical";
    can_resolve: boolean;
    resolution?: string;
  }>;
  consensus_level: number;  // 0-1
}
```

---

### 3.7 Hermes — 收束融合与5种行动决策

**输入**: `HermesInput`（6 个脑区输出 + 冲突报告 + 会话上下文）  
**输出**: `HermesOutput`

#### 5步融合流程

```
Step 1: 信号汇总 ──→ 汇总 amygdala + parietal + temporal + frontal + hippocampus + acc
Step 2: MHC 约束  ──→ 双随机约束矩阵（见下文 MHC 详解）
Step 3: 冲突处理  ──→ ACC 调制：冲突强度等比例衰减各脑区权重
Step 4: 情绪适配  ──→ 选择回复语气（neutral/warm/concise/detailed/cautious/enthusiastic）
Step 5: 行动决策  ──→ 5种决策之一 + 元认知输出
```

#### MHC 融合矩阵（本地计算，不调 LLM）

```
融合维度：correctness / completeness / safety / efficiency / user_adaptation

         parietal  temporal  frontal  hippocampus
correct    w11      w12       w13      w14        → 每行和 = 1
complete   w21      w22       w23      w24
safe       w31      w32       w33      w34
efficient  w41      w42       w43      w44
adapt      w51      w52       w53      w54

↓ 每列和 ≤ 1 (双随机约束)
```

**被约束衰减的权重** → 暴露为 `uncertainty_markers`（不隐藏分歧）

**关键例外**：
- 杏仁核不参与 MHC 矩阵（只有安全否决权）
- 扣带回不在矩阵中（只作为调制器，见 ACCModulator）

#### ACCModulator 调制表

| 冲突程度 | 最高冲突严重度 | 调制系数 |
|----------|:---:|:----:|
| 无冲突 | — | 1.0 |
| 有 minor | minor | 0.85 |
| 有 moderate | moderate | 0.70 |
| 有 critical | critical | 0.55 |

#### 5种行动决策

| 决策 | 含义 | 触发条件 |
|------|------|----------|
| `ANSWER` | 直接回答 | 信心充足，信息完整 |
| `ASK_CLARIFICATION` | 追问澄清 | 输入歧义，需要更多信息 |
| `SEARCH_FIRST` | 先搜再答 | 需要实时信息或外部知识 |
| `DECLINE` | 拒绝 | 超出能力范围或安全风险 |
| `DEFER` | 转交 | 复杂任务建议转交（需要搜索/处理） |

#### 输出要素

```typescript
interface HermesOutput {
  action_decision:     "ANSWER" | "ASK_CLARIFICATION" | "SEARCH_FIRST" | "DECLINE" | "DEFER";
  action_confidence:   number;

  final_response:      string;
  response_tone:       { primary, reason };

  synthesis: {          // 融合摘要
    core_answer:         string;
    key_supporting_points: string[];
    referenced_memories: string[];
    strategy_adopted:    string;
  };

  uncertainty_markers: Array<{  // 不确定性标注
    type:           "confidence_gap" | "strategy_conflict" | "missing_info" | "ambiguous_input";
    description:    string;
    severity:       "minor" | "moderate" | "critical";
    how_resolved:   "exposed_to_user" | "asked_clarification" | "chose_majority" | "deferred";
  }>;

  clarification_questions?: string[];
  metacognition: {       // 元认知
    overall_confidence:   number;
    risk_assessment:      string;
    alternative_viewpoints?: string[];
    decision_rationale:   string;
  };
}
```

#### 核心原则
> **冲突不放水** — 暴露分歧，不做表面统一。输出当前最优判断 + 标注不确定什么。

---

### 3.8 运动皮层 (Motor) — 动作执行

**输入**: `HermesOutput`  
**输出**: `{ content, metadata }`

#### 5种动作分发

```typescript
planActions(hermesOutput) → MotorAction[]
  ├── ANSWER            → { type: "reply",    content: final_response }
  ├── ASK_CLARIFICATION → { type: "ask_user", content: 追问 }
  ├── SEARCH_FIRST      → { type: "search",   content: 搜索查询 }
  ├── DECLINE           → { type: "decline",  content: 拒绝原因 }
  └── DEFER             → { type: "defer",    content: 转发建议 }
```

---

### 3.9 基底节 (BG) — Q-Learning

**输入**: 交互结果信号  
**输出**: Q值更新

#### 算法
- **Q-Learning**（标准 DP）
- **ε-greedy 探索策略**（ε = 0.1）
- **学习率 α = 0.1**，折扣因子 **γ = 0.9**
- 状态编码：`模式_脑区_技能ID`
- Q表内存存储，按访问次数统计

#### 契约约束
- **cannot**: 策略生成、响应生成、内容过滤
- **input 来源**: 可选从 Hermes 获取结果

---

### 3.10 小脑 (Cerebellum) — 三向优化

**特性**: 纯本地规则引擎（不调 LLM / DSPy）

#### 三向优化器

| 优化器 | 功能 | 防护 |
|--------|------|------|
| **调权** (WeightOptimizer) | 成功率高 → 自动升底价 | 冷却期（防连涨）+ 回归弹簧（防垄断）+ 上下限锁（0.05~0.95） |
| **调人** (CooldownManager) | 频繁超时 → 冷落 30-300s | 最大冷却 300s |
| **调时** (TimeoutOptimizer) | P95 贴近超时 → 放宽；P50 远低于超时 → 收紧 | — |

#### 技能追踪
7 类技能健康追踪：reasoning / coding / writing / teaching / analysis / creative / conversation

#### 事后调用接口
```typescript
cerebellum.postInteraction(regionResults, userInput, response)
// 在每次交互完成后触发三向优化
```

---

### 3.11 DMN — 自我模型

**输入**: 交互上下文（可选）  
**输出**: `SelfModel`

#### 自我模型结构
```typescript
interface SelfModel {
  identity:             string;    // "认知引擎 Cognitive Engine v0.1.0"
  capabilities:         string[];
  limitations:          string[];
  values:               string[];
  knowledge_boundaries: string[];
  last_updated:         string;
}
```

#### 反思节奏
- 每 **10 次** 交互触发一次自我反思
- 反思调用 LLM（temperature=0.3），评估能力边界、成功模式、改进方向
- 反思结果自动更新 SelfModel（追加新能力/新限制）

---

### 3.12 突显网络 (Salience) — 事件调度

**FSM 7状态 + 事件队列**

#### 状态转换图

```
IDLE ──[NEW_INPUT]──→ ALERTING ──[AMYGDALA_DONE]──→ ROUTING
                         │ [BLOCKED]
                         ↓
                       IDLE

ROUTING ──[ROUTING_DONE]──→ PROCESSING ──[ALL_REGIONS_DONE]──→ RESOLVING
                                             / [TIMEOUT]
RESOLVING ──[HERMES_DONE]──→ EXECUTING ──[EXECUTION_DONE]──→ IDLE
IDLE ──[LEARNING_TICK]──→ LEARNING ──[LEARNING_TICK]──→ IDLE
```

#### 调度指标
- 总 tick 计数 + 平均时长
- 各脑区超时次数
- 降级事件计数
- 健康检查：超时率 > 10% → WARNING

---

## 4. 数据流与认知链路

### 完整数据流图

```
                                   ┌──────────┐
         ┌─────────────────────────│ 杏仁核     │
         │ Z=0   安全决定          │ Amygdala  │
         ▼                         └─────┬─────┘
    ┌─────────┐                          │ PASS/FLAG/BLOCK
    │ 用户输入  │──→ 原始文本 ────────────────┤
    └─────────┘                          ▼
                                   ┌──────────┐
              ┌────────────────────│ 丘脑       │
              │ Z=0   路由决定     │ Thalamus  │
              ▼                    └─────┬─────┘
         ╔═══════════════════════╗      │ 模式 + 激活列表
         ║ Z=1    第1拍并行       ║      │
         ║ 顶叶 ∥ 海马体          ║◄─────┘
         ╚═══════╤══╤═══════════╝
                 │  │
         ╔═══════╧══╧═══════════╗
         ║ Z=2    第2拍并行       ║
         ║ 颞叶 ∥ 额叶Phase1      ║
         ╚═══════╤══╤═══════════╝
                 │  │
         ╔═══════╧══╧═══════════╗
         ║ Z=2    第3拍          ║
         ║ 额叶Phase2             ║←── 等颞叶完成后
         ╚═══════╤══╤═══════════╝
                 │  │
              ┌──┘  └──┐
         ┌────┴────┐    │
         │ 扣带回    │    │
         │ ACC      │    │
         └────┬────┘    │
              │ 冲突报告 │
              └────┬────┘
                   ▼
              ┌─────────┐
              │ Hermes  │  ← MHC融合矩阵 + ACCModulator
              │ 收束融合 │
              └────┬────┘
                   │ 行动决策 + 回复 + 元认知
                   ▼
              ┌─────────┐
              │ 运动皮层  │  ← 5种动作分发
              │ Motor   │
              └────┬────┘
                   │
                   ▼
              ┌─────────┐
              │ 用户输出  │
              └─────────┘

              后台持续运行：
              ┌──────────────────────┐
              │ 海马体 consolidate    │
              │ 小脑 postInteraction  │
              │ 基底节 Q更新         │
              │ DMN 反思（每10次）   │
              └──────────────────────┘
```

### 降级保护

每个 LLC 调用的脑区都有超时降级路径：
- **超时 → 返回合理的结构默认值**
- 杏仁核慢通超时 → WARNING（不阻塞）
- Hermes 超时 → DECLINE + 低置信度降级回复
- 顶叶/颞叶/额叶超时 → 标准降级结构体

---

## 5. 动态调度机制

### 5.1 能力契约 (CapabilityContract)

每个脑区在 `src/config/contracts.ts` 注册契约：

```typescript
interface CapabilityContract {
  region:             string;          // 脑区名称
  can:                Skill[];         // 具备的能力
  cannot:             Skill[];         // 明确不具备的能力
  prefers:            Skill[];         // 偏好任务
  blacklist:          string[];        // 黑名单（被分配此任务时直接拒绝）
  typical_latency_ms: number;          // 典型时延
  max_latency_ms:     number;          // 最大时延
  requires_llm:       boolean;         // 是否需要LLM
  concurrent_capable: boolean;         // 是否可以并行
  must_wait_for:      string[];        // 必须等待的脑区
  optional_input_from: string[];       // 可选输入来源
  health: {                            // 健康指标（运行时更新）
    recent_success_rate: number;
    avg_latency_ms: number;
    timeout_ratio: number;
    last_healthy_check: string;
  };
}
```

### 5.2 丘脑动态竞标

```
竞标流程：
1. 查询模式权重矩阵 → 获取各脑区静态底价 (base_weight)
2. 能力匹配度校验：
   - 所需能力 ∈ blacklist → 直接跳过
   - 所需能力 ∈ cannot → 直接跳过
   - 所需能力 ∈ can → capability_match = 1.0
   - 部分匹配 → capability_match 按比例衰减
3. 健康系数计算：
   - health_factor = recent_success_rate × (1 - clamp(timeout_ratio, 0, 0.8))
4. 最终竞标值 = base_weight × capability_match × health_factor
5. 排序取 top-N 激活
```

### 5.3 小脑三向优化（防护机制）

```
调权优化器 ── WeightOptimizer
  ├── 动作：成功率 > 0.8 → 底价 +0.05（max 0.95）
  ├── 冷却期：同一方向调整间隔 ≥ 60s
  ├── 回归弹簧：底价向静态值回归，每1分钟 ±0.01
  └── 上下限锁：0.05 ~ 0.95

调人优化器 ── CooldownManager
  ├── 动作：超时率 > 30% → 冷却 30s（累计翻倍，max 300s）
  └── 冷却期间：竞标值 × 0.1

调时优化器 ── TimeoutOptimizer
  ├── P95 贴近 max_latency（>90%）→ 放宽 20%
  ├── P50 远低于 max_latency（<30%）→ 收紧 20%
  └── 在 0.5× ~ 2.0× 范围之间摆动
```

---

## 6. 配置与运行

### 环境变量 (.env)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_API_KEY` | (空) | **必填** |
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI 兼容接口 |
| `LLM_MODEL` | `deepseek-v4-pro` | 统一模型 |
| `SQLITE_PATH` | `./data/cognitive.db` | SQLite 路径 |
| `CHROMA_PATH` | `./data/chroma` | （暂未使用） |
| `AMYGDALA_FAST_ENABLED` | `true` | 快速通路开关 |
| `AMYGDALA_SLOW_ENABLED` | `true` | 慢速通路开关 |
| `AMYGDALA_DEFAULT_ON_TIMEOUT` | `WARNING` | 慢速超时默认动作 |
| `AMYGDALA_BLOCK_RESPONSE` | (中文安全提示) | 拦截回复文案 |
| `HIPPOCAMPUS_STM_MAX_TOKENS` | `25000` | STM 最大 tokens |
| `HIPPOCAMPUS_SUMMARY_COMPRESSION` | `10` | 压缩比 |
| `SALIENCE_TICK_INTERVAL_MS` | `1000` | FSM 时钟间隔 |
| `SALIENCE_PROCESSING_TIMEOUT_MS` | `30000` | 处理总超时 |
| `MAX_CONCURRENT_REGIONS` | `3` | 最大并行脑区数 |

### 脑区超时配置（硬编码）

| 脑区 | 超时 | 说明 |
|------|:---:|------|
| `parietal` | 5s | 注意力分配 |
| `temporal` | 12s | 语义分析 |
| `frontal_phase1` | 8s | 额叶预判 |
| `frontal_phase2` | 20s | 额叶完整策略 |
| `hippocampus` | 3s | 记忆检索 |
| `hermes` | 5s | 收束融合 |

### 5模式×14脑区权重矩阵

| 脑区 | CEN | DMN | EMERGENCY | CREATIVE | TEACHING |
|------|:---:|:---:|:---------:|:--------:|:--------:|
| frontal | 1.0 | 0.2 | 0.8 | 0.4 | 0.9 |
| parietal | 0.5 | — | — | 0.6 | — |
| temporal | 0.7 | — | 0.6 | 0.8 | 0.8 |
| hippocampus | 0.8 | 0.9 | 0.7 | 0.7 | 0.8 |
| amygdala | — | 0.3 | 1.0 | — | — |
| dmn | 0.1 | 1.0 | — | 0.9 | 0.4 |
| cerebellum | 0.5 | 0.4 | — | — | 0.5 |
| bg | 0.6 | — | — | — | — |

### 运行方式

```bash
# 单次查询
npm start "帮我写一个快速排序函数"

# 交互 REPL
npm start -- --repl

# 演示模式（3条内置查询）
npm start

# 开发热重载
npm run dev -- --repl

# 运行测试
npm test
```

### REPL 特殊命令

| 命令 | 作用 |
|------|------|
| `/report` | 查看系统运行报告（FSM、指标、技能、Q表） |
| `/fsm` | 查看 FSM 状态转移日志 |
| `exit` / `quit` | 退出 |

---

## 7. API 参考

### CognitiveEngine 主类

```typescript
import { CognitiveEngine } from "./loop";

const engine = new CognitiveEngine();

// 处理用户输入
const result = await engine.handleUserInput("你好");
// → { response: string, metadata: {...} }

// 获取运行报告
const report = engine.getReport();
// → { fsmState, fsmLog, metrics, health, selfModel, skillHealth, qTable }

// 访问脑区
engine.amygdala   // 杏仁核
engine.thalamus   // 丘脑
engine.hippocampus // 海马体
engine.bg          // 基底节
engine.cerebellum  // 小脑
engine.dmn         // DMN
```

### 各脑区模块导出

每个脑区导出以下接口：

| 脑区 | 导出 |
|------|------|
| amygdala | `amygdalaCheck(text, deps) : Promise<AmygdalaSignal>` |
| thalamus | `thalamusRoute(text, signal, auction) : ThalamusDecision` |
| hippocampus | `class Hippocampus` (init, query, consolidate, fullQuery, learnPreference...) |
| parietal | `parietalProcess(input) : Promise<ParietalOutput>` |
| temporal | `temporalProcess(input) : Promise<TemporalOutput>` |
| frontal | `frontalPhase1(input)` / `frontalProcess(input)` |
| acc | `detectConflicts(regionOutputs, frontalConflicts) : ConflictReport` |
| hermes | `hermesConverge(input) : Promise<HermesOutput>` |
| motor | `planActions(output) : Action[]` / `executeReply(action)` |
| bg | `class BasalGanglia` (update, getBestAction, getStats) |
| cerebellum | `class Cerebellum` (postInteraction, getSkillHealth) |
| dmn | `class DefaultModeNetwork` (getSelfModel, selfReflect) |
| salience | `class SalienceFSM` + `class SalienceMetrics` |

---

## 8. 开发指南

### 项目结构

```
cognitive-engine/
├── src/
│   ├── index.ts              # 入口（CLI / REPL / Demo）
│   ├── loop.ts               # ⭐ Agent Loop 主控（14脑区编排）
│   ├── types/index.ts        # 全部类型定义 + Schema
│   ├── config/
│   │   ├── index.ts          # 环境变量 + 全局配置
│   │   ├── llm.ts            # LLM 统一调用接口
│   │   ├── mode-weights.ts   # 5模式×14脑区权重矩阵
│   │   └── contracts.ts      # 14脑区能力契约注册表
│   ├── db/
│   │   ├── schema.sql        # SQLite Schema
│   │   └── init.ts           # 数据库初始化
│   ├── amygdala/index.ts     # 杏仁核
│   ├── thalamus/index.ts     # 丘脑（动态竞标）
│   ├── salience/fsm.ts        # 突显网络
│   ├── parietal/index.ts     # 顶叶
│   ├── temporal/index.ts     # 颞叶
│   ├── hippocampus/index.ts  # 海马体（三层记忆）
│   ├── frontal/index.ts      # 额叶（双阶段）
│   ├── acc/index.ts           # 扣带回
│   ├── hermes/index.ts       # Hermes（MHC+ACC融合）
│   ├── motor/index.ts        # 运动皮层
│   ├── bg/index.ts           # 基底节（Q-Learning）
│   ├── cerebellum/index.ts   # 小脑（三向优化）
│   └── dmn/index.ts          # DMN（自我模型）
├── tests/
│   └── all-changes.test.ts   # 77个测试用例
├── package.json
├── tsconfig.json
├── .env
├── README.md
├── DOCUMENTATION.md          # 本文档
├── ARCH-DECISIONS.md         # 架构决策记录
└── TEST-PLAN.md              # 测试计划
```

### LLM 调用约定

```typescript
import { llmCall, parseLlmJson } from "./config/llm";

// 所有脑区共用的 LLM 接口
const result = await llmCall({
  model: config.llm.model,      // deepseek-v4-pro
  systemPrompt: "...",
  userPrompt: "...",
  temperature: 0.1,
  maxTokens: 1024,
});

// JSON 响应解析（自动处理 markdown 代码块包裹）
const parsed = parseLlmJson(result);
```

### 新增脑区步骤

1. 在 `src/types/index.ts` 定义输入/输出接口
2. 创建 `src/<region>/` 目录 + `index.ts`
3. 实现处理函数，导出标准接口 + `contract`
4. 在 `src/config/contracts.ts` 注册能力契约
5. 在 `src/config/mode-weights.ts` 配置 5 模式权重
6. 在 `src/loop.ts` 中集成到管线
7. 编写测试用例

### 脚本速查

```bash
npm run build       # TypeScript 编译
npm run dev         # tsx watch 热重载
npm test            # vitest 测试
npm run db:init     # 初始化/重置数据库
```

---

## 9. 架构决策记录

完整记录见 [ARCH-DECISIONS.md](./ARCH-DECISIONS.md)，关键决策摘要：

| ADR | 主题 | 决策 | 原因 |
|-----|------|------|------|
| ADR-01 | 额叶 | 左右合并为双阶段 | 降低 API 调用复杂度，保留预判-修正循环 |
| ADR-02 | 海马体 | 内存模拟替代 ChromaDB+Neo4j | 零外部依赖启动，接口兼容可升级 |
| ADR-03 | 杏仁核 | 自定义正则替代 NeMo-Guardrails | 语言栈不兼容，规则可维护 |
| ADR-04 | 突显网络 | 简化FSM替代完整Router | 同进程内不需要分布式路由复杂度 |
| ADR-05 | 小脑 | 规则优化替代 DSPy | TypeScript 项目，需数据积累 |
| ADR-06 | 语言 | TypeScript 替代 Python | Hermes Agent 原生，类型系统优势 |
| ADR-07 | DMN | 内存 SelfModel 替代 Honcho | 减少独立服务依赖 |
| ADR-08 | 运动皮层 | 未集成 MCP 协议 | MVP 阶段无工具集 |
| ADR-09 | 扣带回 | 规则引擎替代 NLI 模型 | 置信度差异已是强信号 |
| ADR-10 | LLM | 统一 deepseek-v4-pro | 简化配置，Prompt 差异化 |

---

## 10. 测试覆盖

### 测试概览

**77 个测试用例，全部通过**（1 个测试文件）

| 模块 | 用例数 | 覆盖内容 |
|------|:-----:|----------|
| 杏仁核 | 25 | 15条BLOCK + 7条WARNING + 3个白名单 + 空输入 + 大小写 + 慢速降级 |
| 海马体 | 13 | STM + LTM 6collection + 语义图谱 + fullQuery + consolidate + inferLinkType |
| MHC/ACC | 8 | 双随机矩阵约束 + 零行 + ACCModulator 4级调制 |
| 丘脑 | 8 | 竞标公式 + budget分配 + validateActivation 4级 + 向后兼容 |
| 小脑 | 8 | init + postInteraction + cooldown + weights + timeouts |
| 契约 | 5 | 14脑区完整性 + 字段合法性验证 |
| 集成 | 6 | 全链路处理 + 降级路径 |
| Motor | 5 | ANSWER/ASK_CLARIFICATION/SEARCH_FIRST/DECLINE/DEFER |

### 运行测试

```bash
cd cognitive-engine
npm test
# vitest run --reporter=verbose
```

---

## 附录：设计文档索引

原始设计规格位于 `c:\Users\YANHI\Desktop\brain-arch\`：

| 文件 | 内容 |
|------|------|
| `ARCHITECTURE.md` | 总体架构规格 |
| `01-parietal-lobe-prompt.md` | 顶叶注意力分配 |
| `02-temporal-lobe-prompt.md` | 颞叶语义分析 |
| `03-frontal-lobe-prompt.md` | 额叶策略引擎 |
| `04-salience-network-fsm.md` | 突显网络调度 |
| `05-hippocampus-prompt.md` | 海马体三层记忆 |
| `06-hermes-convergence-prompt.md` | Hermes收束融合 |
| `07-amygdala-rules.md` | 杏仁核安全规则 |
| `08-dynamic-orchestration.md` | 动态调度增强 |
