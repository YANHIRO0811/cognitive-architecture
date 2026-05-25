# 脑启发的 AI 认知引擎 — 完整架构文档

> 版本 v1.0 | 2026-05-26 | MIT
>
> 模拟人脑三维结构：14 脑区并行处理，Hermes 前额叶收束，全部组件均有现成开源方案可复用。

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [三维架构模型](#2-三维架构模型)
3. [14 脑区完整对照](#3-14-脑区完整对照)
4. [信息流与认知周期](#4-信息流与认知周期)
5. [改造方案总览](#5-改造方案总览)
6. [突显网络改造方案（FreeLLMAPI Router 复用）](#6-突显网络改造方案)
7. [丘脑路由改造方案（FreeLLMAPI Router + Hermes Gateway）](#7-丘脑路由改造方案)
8. [杏仁核改造方案（NeMo-Guardrails 集成）](#8-杏仁核改造方案)
9. [海马体改造方案（Letta + ChromaDB + Neo4j）](#9-海马体改造方案)
10. [Hermes 收束器改造方案（ECA CognitiveBrain 改造）](#10-hermes-收束器改造方案)
11. [基底节 + 小脑后台学习方案](#11-基底节--小脑后台学习方案)
12. [代码基座选型](#12-代码基座选型)
13. [实现路线图](#13-实现路线图)

---

## 1. 设计哲学

### 为什么模拟人脑

```
当前 AI 助手架构的问题：
  ┌─────────┐
  │ 单模型   │ → 一个大脑做所有事 → 强但不全面
  │ 串行思考  │ → 一步一步来 → 慢且容易陷入局部最优
  │ 无冲突   │ → 只有一种声音 → 偏见无法暴露
  │ 无自我   │ → 每次对话从零开始 → 没有成长
  └─────────┘

我们要的架构：
  ┌──────────────────────────────────────────┐
  │ 14 个脑区并行 → 多种角度同时产出           │
  │ 冲突是最有价值的信息 → 暴露而不是掩盖       │
  │ 每一条前馈都有反馈 → 双向修正              │
  │ DMN ↔ CEN 动态切换 → 该专注时专注，该发散时发散 │
  │ 基底节 RL 学习 → 越用越聪明                 │
  │ SOUL.md 自我模型 → 知道自己是谁             │
  └──────────────────────────────────────────┘
```

### 核心原则

| # | 原则 | 含义 |
|---|------|------|
| 1 | **并行非串行** | 所有脑区同时接到输入，独立产出，不做流水线 |
| 2 | **冲突不放水** | 两个脑区产出矛盾 → 标注暴露，不强行统一 |
| 3 | **独立记忆** | 每个脑区维护自己的记忆痕迹，不共享一个 Memory |
| 4 | **杏仁核最前** | 危机预警在第一关，不等任何分析就拦截 |
| 5 | **双向反馈** | 每一条前馈都有对应的反馈回路，信息不是单向流动 |
| 6 | **动态切换** | DMN/CEN/紧急/创意/教学 五模式，由突显网络统一调度 |

---

## 2. 三维架构模型

```
坐标系映射：
  X 轴（左-右）→ 分析侧 / 创意侧
  Y 轴（前-后）→ 入口 → 感知 → 认知 → 收束 → 执行
  Z 轴（表-深）→ 用户可见 / 认知处理 / 学习记忆
```

### Z 轴分层架构

```
Z=0 入口层 ──── 杏仁核 + 丘脑
     "危险吗？该激活谁？"

Z=1 感知层 ──── 颞叶WHAT ∥ 顶叶WHERE ∥ 海马体
     "是什么？看哪里？记得什么？"

Z=2 认知层 ──── 扣带回ACC → 额叶左CoT ∥ 额叶右ToT ∥ 突显网络FSM
     "有矛盾吗？怎么办？换思路？切模式？"

Z=3 收束层 ──── Hermes CognitiveBrain + MetaCognitive
     "综合所有信息 → 最终决策 + 不确定性暴露"

Z=4 执行层 ──── 运动皮层 tools + MCP
     "执行产出 → 反馈 → 重试/确认"

后台持续 ──── 基底节RL + 小脑DSPy + DMN自我维护
     "学习、优化、自我更新"
```

### X 轴双路并行

```
左脑（分析）                    右脑（创意）
─────────────────              ─────────────────
LangGraph CoT 逐步推理          AutoGen ToT 发散探索
约束求解                        类比生成
步骤分解                        风险评估
可行性评分                       新颖性打分
```

---

## 3. 14 脑区完整对照

| # | 脑区 | 大脑职责 | 技术实现 | 开源来源 | ★ |
|---|------|---------|---------|---------|:--:|
| 1 | **杏仁核** | 危机预警——双通路快速拦截 | NeMo-Guardrails + LLM-Guard | NVIDIA / laiyer-ai | 4.5k |
| 2 | **丘脑** | 感官路由——选择性激活下游模块 | Hermes Gateway + LangGraph 条件路由 | NousResearch / LangChain | 167k+12k |
| 3 | **颞叶** | WHAT 通路——语义识别 | LlamaIndex RAG + Neo4j KG + HF 零样本分类 | run-llama / neo4j / HF | 38k+14k+140k |
| 4 | **顶叶** | WHERE 通路——注意力分配 | Letta(MemGPT)虚拟上下文 + Mem0记忆门控 | letta-ai / mem0ai | 14k+24k |
| 5 | **海马体** | 三层记忆——STM/LTM/语义 | Letta + ChromaDB + Neo4j + Honcho | letta-ai / chroma-core / neo4j | 14k+18k+14k |
| 6 | **扣带回** | 冲突监控——5种冲突检测 | ECA ConflictMonitor + HF NLI | EdJb1971 / HF | 9 |
| 7 | **额叶左** | 分析策略——CoT逐步推理 | LangGraph 图状态机 + AutoGen | langchain-ai / microsoft | 12k+40k |
| 8 | **额叶右** | 创意发散——ToT多路径探索 | AutoGen 辩论模式 | microsoft | 40k |
| 9 | **突显网络** | 状态切换——DMN↔CEN调度 | **FreeLLMAPI Router 改造成脑区权重调度器** | tashfeenahmed / freellmapi | 5.2k |
| 10 | **Hermes** | 收束融合——多源信号合成 | ECA CognitiveBrain + MetaCognitive | EdJb1971 | 9 |
| 11 | **运动皮层** | 执行产出——工具调用 | Hermes 70+tools + MCP协议 | NousResearch / MCP | 167k+30k |
| 12 | **基底节** | 强化学习——Q-Learning习惯形成 | ECA RL Service | EdJb1971 | 9 |
| 13 | **小脑** | 技能优化——Prompt自动调优 | DSPy + Langfuse + ECA Procedural | stanfordnlp / langfuse | 20k+8k |
| 14 | **DMN** | 自我模型——身份连续性 | SOUL.md + Honcho + ECA SelfModel | plastic-labs / EdJb1971 | 3.3k |

---

## 4. 信息流与认知周期

### 单次请求完整链路

```
用户输入
    │
    ▼
┌─────────────┐
│  杏仁核       │  Z=0  第一关
│  危机预警     │  "有危险吗？"
│  NeMo-Guard  │  安全 → 放行
│  + LLM-Guard │  危险 → 拦截/标记
└──────┬──────┘
       │ safe / ⚠warning
       ▼
┌─────────────┐
│  丘脑         │  Z=0
│  路由分拣     │  "该激活哪些脑区？"
│  Hermes GW   │  复杂度/领域/紧急度 →
│  + LangGraph │  决定激活范围+预算
└──────┬──────┘
       │
       ├──────────────────────────────────────────┐
       ▼              ▼              ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ 颞叶WHAT  │  │ 顶叶WHERE │  │ 海马体     │  │ 额叶预判   │
│ LlamaIdx  │  │ Letta    │  │ Letta+   │  │ LangGraph │  Z=1
│ +Neo4j   │  │ +Mem0    │  │ ChromaDB │  │ 不等识别完  │
│ +HF       │  │          │  │ +Neo4j   │  │ 就开始     │
└────┬─────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘
     │              │            │              │
     └──────────────┼────────────┼──────────────┘
                    │            │
                    ▼            ▼
              ┌──────────┐  ┌──────────┐
              │ 扣带回ACC  │  │ 突显网络   │  Z=2
              │ 冲突检测   │  │ 模式切换   │
              │ ECA+NLI  │  │ FREELLM   │
              └─────┬────┘  │ ROUTER    │
                    │       └─────┬────┘
                    │             │
         ┌──────────┼─────────────┼──────────┐
         ▼          ▼             ▼          ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │额叶左CoT │ │额叶右ToT │ │策略C    │ │策略D    │  Z=2
   │逻辑推理  │ │创意发散  │ │方案3    │ │方案4    │
   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
        │           │           │           │
        └───────────┼───────────┼───────────┘
                    │           │
                    ▼           ▼
              ┌──────────┐  ┌──────────┐
              │ 扣带回2.5 │  │ 突显仲裁   │
              │ 二次冲突   │  │ 模式确认   │
              └─────┬────┘  └─────┬────┘
                    │             │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  HERMES     │  Z=3
                    │  收束器      │
                    │             │
                    │ 1.冲突处理   │
                    │ 2.主方向选择  │
                    │ 3.修正注入   │
                    │ 4.不确定性暴露│
                    │ 5.知识边界门  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  运动皮层     │  Z=4
                    │  tools + MCP │
                    │  流式输出     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  用户看到     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  反馈回路     │  后台
                    │  → RL学习    │
                    │  → Prompt优化│
                    │  → 记忆巩固   │
                    └─────────────┘
```

### 关键路径时间预算

```
路径                   耗时         并行？
──────────────────────────────────────────
杏仁核 安全检查         5-50ms       必须最先
丘脑 路由决策           10-100ms     等杏仁核放行后
颞叶+顶叶+海马体 感知   200-2000ms   三者并行 ███
额叶左+右 策略          500-5000ms   双路并行 ███
扣带回 冲突检测          50-200ms     等策略完成后
Hermes 收束             200-1000ms   等所有产出
运动皮层 执行           50-500ms     收束后执行
──────────────────────────────────────────
总计（理想并行）         ~2-5秒
```

---

## 5. 改造方案总览

```
改造类型分布：

  直接拿来用（2个）：  Hermes Gateway、NeoMo-Guardrails
  需配置适配（3个）：  Letta、ChromaDB、Neo4j
  需改造复用（5个）：  FreeLLMAPI Router ×2（丘脑+突显）
                      LlamaIndex RAG、LangGraph、DSPy
  需设计重组（4个）：  ECA CognitiveBrain、ECA RL、ECA Conflict、
                      SOUL.md + Honcho
```

### 改造难度矩阵

| 脑区 | 改造量 | 难度 | 说明 |
|------|:------:|:----:|------|
| 杏仁核 | 低 | ★ | NeMo-Guardrails 几乎原样集成 |
| 丘脑 | 中 | ★★ | Hermes Gateway + LangGraph 条件路由组合 |
| 颞叶 | 低 | ★ | LlamaIndex + Neo4j 标准集成 |
| 顶叶 | 中 | ★★ | Letta 上下文管理需适配多脑区并行场景 |
| 海马体 | 中 | ★★ | Letta + ChromaDB + Neo4j 三层架构需联调 |
| 扣带回 | 低 | ★ | ECA ConflictMonitor + HF NLI 直接可用 |
| 额叶左 | 低 | ★ | LangGraph + AutoGen 标准用法 |
| 额叶右 | 低 | ★ | AutoGen 辩论模式标准用法 |
| **突显网络** | **中** | **★★** | **FreeLLMAPI Router 核心改造** |
| Hermes | 高 | ★★★ | ECA CognitiveBrain 需大量改造适配6脑区输入 |
| 运动皮层 | 低 | ★ | Hermes tools + MCP 原样集成 |
| 基底节 | 中 | ★★ | ECA RL 需集成到 agent loop |
| 小脑 | 中 | ★★ | DSPy 需包装为持续监控服务 |
| DMN | 低 | ★ | SOUL.md + Honcho 文件驱动即可 |

---

## 6. 突显网络改造方案

### 6.1 改造源：FreeLLMAPI Router

**来源**：`github.com/tashfeenahmed/freellmapi` — `server/src/services/router.ts`

**为什么选它**：
- 核心路由逻辑仅 ~200 行，极其精简
- Fallback Chain = 权重优先级，天然对应脑区权重矩阵
- 动态惩罚 + 衰减 = 脑区性能追踪
- 速率限制 = 认知资源预算
- Cooldown = 过度激活抑制
- Round-robin 多 Key = 同功能多脑区负载均衡
- MIT 协议，无许可证风险

### 6.2 改造对照表

```
FreeLLMAPI Router                突显网络 FSM
─────────────────────────────────────────────────────
models 表                         regions 表
  model_id, platform              region_id, mode
  priority                        weight (per mode)
  enabled                         active
  
fallback_chain 表                 mode_weights 表
  model_db_id, priority           region_id, mode_id, weight
  enabled                          active, cooldown_until
  
canMakeRequest(key)              canActivateRegion(region_id, mode)
  检查 RPM/RPD/TPM/TPD            检查认知预算/冷却状态/健康状态

recordRateLimitHit(model)        recordLowPerformance(region)
  penalty += 3 (max 10)            weight -= 0.1 (min 0.1)
  
recordSuccess(model)             recordHighPerformance(region)
  penalty -= 1                      weight += 0.05 (max 1.0)
  
时间衰减(每2分钟 -1)             时间衰减(每5分钟 +0.05 回归基准)

isOnCooldown(key)                isOnCooldown(region)
  429 后冷却 60s                   低效后冷却 30s

roundRobinIndex                  regionRoundRobin
  同平台多 Key 轮询                同功能多脑区轮询（如多个分析脑区）

stickySession (proxy.ts)        modeStickiness
  30min 同模型                    同任务内不切换模式
```

### 6.3 改造后的数据结构

```typescript
// 原 FreeLLMAPI: models 表
interface ModelRow {
  id: number;
  platform: string;        // 'google' | 'groq' | ...
  model_id: string;        // 'gemini-2.5-flash'
  display_name: string;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  tpd_limit: number | null;
}

// 改造后: regions 表
interface RegionRow {
  id: number;
  name: string;            // 'frontal_left' | 'temporal' | 'parietal' | ...
  display_name: string;    // '额叶左（分析策略）'
  description: string;     // 'CoT逐步推理 + 约束求解'
  default_weight: number;  // 默认权重 0.0-1.0
  max_concurrent: number;  // 最大并发激活数
  cooldown_ms: number;     // 低效冷却时间
}

// 原 FreeLLMAPI: fallback_chain 表
interface FallbackRow {
  model_db_id: number;
  priority: number;
  enabled: number;
}

// 改造后: mode_weights 表（5模式 × 14脑区的权重矩阵）
interface ModeWeightRow {
  region_id: number;
  mode: 'CEN' | 'DMN' | 'EMERGENCY' | 'CREATIVE' | 'TEACHING';
  weight: number;          // 该模式下该脑区的权重 0.0-1.0
  active: boolean;         // 是否激活
}

// 5 种模式的权重矩阵示例
const MODE_WEIGHTS = {
  CEN: {  // 任务执行模式 — 专注、高效
    frontal_left:  1.0,   // 额叶左 全开
    temporal:       0.7,   // 颞叶   高
    hippocampus:    0.8,   // 海马体  高
    frontal_right:  0.3,   // 额叶右 低（不要发散）
    parietal:       0.5,   // 顶叶   中
    dmn:            0.1,   // DMN    关闭
    cerebellum:     0.5,
    basal_ganglia:  0.6,
  },
  DMN: {  // 内省/反思模式 — 自由联想
    frontal_right:  1.0,   // 额叶右 全开（发散）
    dmn:            1.0,   // DMN    全开（自我）
    hippocampus:    0.9,   // 海马体  高（回溯）
    frontal_left:   0.2,   // 额叶左 低
    amygdala:       0.3,   // 杏仁核  低
    cerebellum:     0.4,
  },
  EMERGENCY: {  // 紧急模式 — 杏仁核主导
    amygdala:       1.0,   // 杏仁核  全开
    frontal_left:   0.8,   // 额叶左  高（快速分析）
    hippocampus:    0.7,   // 海马体  高（匹配已知威胁）
    temporal:       0.6,
    frontal_right:  0.1,   // 额叶右 关（不要发散浪费时间）
    dmn:            0.0,   // DMN    关（不要自我反思）
    cerebellum:     0.0,
    basal_ganglia:  0.0,
  },
  CREATIVE: {  // 创意模式
    frontal_right:  1.0,
    dmn:            0.9,
    temporal:       0.8,
    hippocampus:    0.7,
    frontal_left:   0.4,
    parietal:       0.6,
  },
  TEACHING: {  // 教学模式
    frontal_left:   0.9,   // 逻辑步骤
    temporal:       0.8,   // 知识检索
    hippocampus:    0.8,   // 经验回顾
    frontal_right:  0.6,   // 类比举例
    dmn:            0.4,
    cerebellum:     0.5,   // 教学技能优化
  },
};
```

### 6.4 改造后的核心算法

```typescript
// ============ 核心：选择当前模式 ============
function selectMode(input: UserInput, amygdalaSignal: AmygdalaSignal): Mode {
  // 1. 杏仁核最高优先级 — 任何告警切紧急
  if (amygdalaSignal.level === 'CRITICAL') return 'EMERGENCY';
  if (amygdalaSignal.level === 'WARNING') {
    // 警告级别：权重倾斜但不完全切换
    biasMode('EMERGENCY', 0.5);
  }

  // 2. 明确目标 → CEN
  if (input.hasClearGoal || input.type === 'command') return 'CEN';

  // 3. 开放问题/探讨 → DMN
  if (input.type === 'open_question' || input.tone === 'reflective') return 'DMN';

  // 4. 创意/头脑风暴 → CREATIVE
  if (input.type === 'brainstorm' || input.intent === 'generate_ideas') return 'CREATIVE';

  // 5. 教学/解释 → TEACHING
  if (input.intent === 'learn' || input.complexity === 'high') return 'TEACHING';

  // 6. 默认 CEN
  return 'CEN';
}

// ============ 核心：激活脑区 + 分配权重 ============
interface RegionActivation {
  regionId: number;
  weight: number;      // 动态权重（基准 × 性能系数 × 惩罚系数）
  budget: number;      // 分配的认知资源（token预算/计算时间）
}

function activateRegions(mode: Mode, context: Context): RegionActivation[] {
  const weights = getModeWeights(mode);  // 从 mode_weights 表读取
  const activations: RegionActivation[] = [];

  for (const [regionId, baseWeight] of Object.entries(weights)) {
    // 1. 检查脑区是否健康（对应 Key 健康检查）
    if (!isRegionHealthy(regionId)) continue;

    // 2. 检查是否在冷却中（对应 Cooldown）
    if (isOnCooldown(regionId)) continue;

    // 3. 检查认知预算是否充足（对应 RPM/RPD/TPM/TPD）
    if (!hasBudget(regionId, context.estimatedTokens)) continue;

    // 4. 获取性能系数（对应动态 penalty）
    const perfCoeff = getPerformanceCoefficient(regionId);

    // 5. 计算最终权重
    const finalWeight = baseWeight * perfCoeff;

    // 6. 低于阈值不激活
    if (finalWeight < 0.1) continue;

    // 7. 分配预算
    const budget = allocateBudget(regionId, finalWeight, context.totalBudget);

    activations.push({ regionId, weight: finalWeight, budget });
  }

  // 8. 按权重排序返回
  return activations.sort((a, b) => b.weight - a.weight);
}

// ============ 性能追踪（原 penalty 机制改造） ============
const regionPerformance = new Map<number, {
  successCount: number;
  failureCount: number;
  avgLatency: number;
  avgQuality: number;     // Hermes 收束后评估的质量分
  lastEvaluated: number;
  coefficient: number;    // 1.0 = 基准, <1.0 = 降权, >1.0 = 升权
}>();

function recordRegionResult(regionId: number, result: RegionResult) {
  const perf = getOrCreatePerf(regionId);

  if (result.success) {
    perf.successCount++;
    // 高质量产出 → 提升系数
    if (result.quality > 0.8) {
      perf.coefficient = Math.min(1.2, perf.coefficient + 0.02);
    }
  } else {
    perf.failureCount++;
    // 低质量/超时/错误 → 降低系数
    perf.coefficient = Math.max(0.1, perf.coefficient - 0.05);
  }

  // 滑动平均延迟
  perf.avgLatency = perf.avgLatency * 0.9 + result.latency * 0.1;
  perf.lastEvaluated = Date.now();
}

// 时间衰减回归基准（对应 penalty 衰减）
function decayPerformanceCoefficients() {
  const now = Date.now();
  for (const [id, perf] of regionPerformance) {
    const elapsed = now - perf.lastEvaluated;
    if (elapsed > 5 * 60 * 1000) { // 5 分钟
      // 向 1.0 回归
      perf.coefficient = perf.coefficient + (1.0 - perf.coefficient) * 0.1;
    }
  }
}
```

### 6.5 改造步骤

```
Step 1: Clone FreeLLMAPI 的 router.ts（~200行）
Step 2: 替换数据模型
        models 表 → regions 表
        fallback_chain 表 → mode_weights 表（增加 mode 维度）
Step 3: 替换判断条件
        canMakeRequest → canActivateRegion
        rateLimit checks → budget checks
Step 4: 增加 mode 维度
        5 种模式的权重矩阵 + selectMode() 函数
Step 5: 改造 penalty → performance_coefficient
        增加 quality 维度（由 Hermes 收束后回传）
Step 6: 集成到 Agent Loop
        每次用户输入 → selectMode → activateRegions → 并行执行
```

---

## 7. 丘脑路由改造方案

### 7.1 改造源：Hermes Gateway + LangGraph + FreeLLMAPI Router

**丘脑 = 复制 FreeLLMAPI Router 的路由逻辑，但目标是脑区而非模型。**

```
FreeLLMAPI 的请求链路：
  用户请求 → Auth → Sticky → Router 选模型 → Provider → 返回

丘脑的请求链路：
  用户输入 → 杏仁核放行 → 丘脑选脑区 → 并行激活 → Hermes 收束
                              ↑
                    这里是改造重点
```

### 7.2 丘脑路由决策流程

```typescript
interface ThalamusDecision {
  mode: Mode;                        // 选哪种认知模式
  activatedRegions: RegionActivation[]; // 激活哪些脑区
  totalBudget: number;               // 总认知资源预算
  priority: 'speed' | 'quality' | 'balanced'; // 速度/质量/平衡
}

function thalamusRoute(input: UserInput, amygdalaSignal: AmygdalaSignal): ThalamusDecision {
  // 1. 输入分类
  const classification = classifyInput(input);
  // → complexity: low | medium | high
  // → domain: code | academic | creative | daily | emergency
  // → urgency: low | normal | high
  // → modality: text | image | mixed

  // 2. 决定激活范围
  let regionsToActivate: string[];
  if (classification.complexity === 'low') {
    // 简单输入 → 最少脑区，快速响应
    regionsToActivate = ['temporal', 'hippocampus', 'frontal_left'];
  } else if (classification.complexity === 'high') {
    // 复杂输入 → 全激活
    regionsToActivate = ['all'];
  } else {
    // 中等 → 基于领域选择
    regionsToActivate = selectByDomain(classification.domain);
  }

  // 3. 分配认知预算
  const totalBudget = calculateBudget(classification);
  // 简单问题：少 token，快速模式
  // 复杂问题：多 token，深度模式

  // 4. 交给突显网络精调权重
  const mode = selectMode(input, amygdalaSignal);
  const activated = activateRegions(mode, { totalBudget });

  return { mode, activatedRegions: activated, totalBudget, priority: 'balanced' };
}
```

---

## 8. 杏仁核改造方案

### 8.1 改造源：NeMo-Guardrails + LLM-Guard

**直接集成，几乎不需要改造。**

```
用户输入
    │
    ▼
┌──────────────────────┐
│ 快速通路（<10ms）      │
│ ├─ 正则匹配黑名单       │ → 命中 → 直接拦截
│ ├─ 敏感词库            │
│ └─ prompt injection    │
│    特征检测            │
└──────┬───────────────┘
       │ 通过
       ▼
┌──────────────────────┐
│ 慢速通路（50-200ms）   │
│ ├─ NeMo-Guardrails    │ → 对话安全评估
│ ├─ LLM-Guard          │ → LLM 安全扫描
│ └─ 自定义规则          │ → 业务安全规则
└──────┬───────────────┘
       │
   ┌───┴───┐
   │ safe   │ ⚠warning（标记往下传，不拦截）
   │ 放行    │
   └───┬───┘
       │
       ▼
     丘脑
```

### 8.2 杏仁核信号传递

```typescript
interface AmygdalaSignal {
  level: 'SAFE' | 'WARNING' | 'CRITICAL';
  threatType?: 'injection' | 'jailbreak' | 'harmful' | 'self_harm' | 'illegal';
  confidence: number;  // 0.0-1.0
  action: 'PASS' | 'FLAG' | 'BLOCK';
  note?: string;  // 传递给下游的说明
}
```

---

## 9. 海马体改造方案

### 9.1 三层记忆架构

```
Layer 1: STM (工作记忆)
  Letta 虚拟上下文管理
  ~25,000 token 窗口
  当前对话的全部内容

Layer 2: Summary Memory
  当 STM 超限时触发
  LLM 摘要 + ChromaDB 存储
  压缩率 ~10:1

Layer 3: LTM (长期记忆)
  ChromaDB 6 个 collection：
    conversations/   对话摘要
    facts/           用户事实
    preferences/     偏好
    knowledge/       知识片段
    patterns/        行为模式
    errors/          错误教训

语义记忆层:
  Neo4j 知识图谱
  实体 + 关系 + 属性
  "浩浩是大学教师"
  "浩浩教钢琴和即兴伴奏"
  "HIRO 是浩浩的硅基分身"

用户模型层:
  Honcho 辩证建模
  SOUL.md 结构化自我描述
```

### 9.2 记忆检索流程

```
颞叶发出检索请求
    │
    ├─ 向量检索 (ChromaDB)     ← 语义相似 → "类似的事"
    ├─ 全文检索 (FTS5)         ← 关键词 → "提到过什么"
    ├─ 知识图谱 (Neo4j)        ← 关系查询 → "谁是谁"
    └─ 用户模型 (Honcho)       ← 画像 → "用户是怎样的人"
            │
            ▼
    融合排序 → 注入到各脑区的上下文
```

---

## 10. Hermes 收束器改造方案

### 10.1 改造源：ECA CognitiveBrain + MetaCognitiveMonitor

**这是改造量最大的模块。** ECA 的 CognitiveBrain 设计完整但代码不完整，需要从设计文档出发重新实现。

### 10.2 收束流程

```typescript
interface HermesInput {
  amygdalaSignal: AmygdalaSignal;        // 杏仁核信号
  thalamusDecision: ThalamusDecision;    // 丘脑路由决策
  regionOutputs: Map<string, RegionOutput>; // 各脑区产出
  conflictReport: ConflictReport;        // 扣带回冲突报告
  memoryContext: MemoryContext;           // 海马体记忆上下文
  selfModel: SelfModel;                  // DMN 自我模型
}

interface HermesOutput {
  finalResponse: string;                 // 最终回复
  confidence: number;                    // 置信度
  uncertaintyMarkers: UncertaintyMarker[]; // 不确定标注
  actionDecision: 'ANSWER' | 'SEARCH_FIRST' | 'ASK_CLARIFICATION' | 'DECLINE' | 'ACKNOWLEDGE_UNCERTAINTY';
  tone: 'formal' | 'casual' | 'empathetic' | 'urgent' | 'teaching';
  citations: Citation[];                 // 引用来源
}

function hermesConverge(input: HermesInput): HermesOutput {
  // Step 1: 冲突处理
  const resolvedConflicts = resolveConflicts(input.conflictReport, input.regionOutputs);
  // → 可抹掉的矛盾 → 选取更高权重方
  // → 不可抹掉的矛盾 → 标注暴露给用户
  // → 安全冲突 → 安全优先

  // Step 2: 主方向选择
  const mainDirection = selectMainDirection(
    input.regionOutputs,
    input.thalamusDecision.mode,
    resolvedConflicts
  );
  // → 加权投票（权重来自突显网络）
  // → 平局时由模式决定偏好（CEN偏逻辑，DMN偏创意）

  // Step 3: 修正注入
  const amended = applyAmendments(mainDirection, {
    amygdalaSignal: input.amygdalaSignal,  // 警告 → 语气谨慎
    memoryContext: input.memoryContext,    // 记忆 → 引用历史
    selfModel: input.selfModel,           // 自我 → 一致性检查
    tone: input.thalamusDecision.mode === 'TEACHING' ? 'teaching' : 'casual',
  });

  // Step 4: 不确定性暴露
  const uncertainty = assessUncertainty(amended, input.regionOutputs);
  // → 各脑区意见分歧大 → 高不确定性
  // → 记忆中没有相关经验 → 高不确定性
  // → 明确标注"待确认"/"据我所知"/"建议核实"

  // Step 5: 知识边界门（MetaCognitive）
  const actionDecision = decideAction(uncertainty, input.selfModel);
  // → ANSWER        — 确定，直接答
  // → SEARCH_FIRST  — 不确定，先查
  // → ASK_CLARIFY   — 不理解，反问
  // → DECLINE       — 超出边界，拒绝
  // → ACKNOWLEDGE   — 不确定但可以给参考

  return {
    finalResponse: composeResponse(amended, uncertainty),
    confidence: uncertainty.confidence,
    uncertaintyMarkers: uncertainty.markers,
    actionDecision,
    tone: amended.tone,
    citations: collectCitations(input.regionOutputs),
  };
}
```

---

## 11. 基底节 + 小脑后台学习方案

### 11.1 基底节 RL（每轮结束触发）

```typescript
// ECA RL Service 改造
interface RLLearner {
  // Q-Learning：状态=用户输入特征，动作=选择的脑区激活方案
  qTable: Map<string, Map<string, number>>; // ChromaDB 持久化
  
  learn(state: StateVector, action: ActionVector, reward: number): void;
  selectAction(state: StateVector, epsilon: number): ActionVector;
  formHabit(statePattern: string, action: string, threshold: number): void;
}

// 奖励信号来源：
// - 用户反馈（点赞/点踩/追问次数/采纳率）
// - Hermes 置信度
// - 响应延迟
// - 冲突频率（低冲突=好）
```

### 11.2 小脑技能优化（每天/周分析）

```typescript
// DSPy + ECA Procedural Learning 改造
interface SkillOptimizer {
  // 7 类技能分别追踪
  skills: {
    reasoning: SkillTracker;      // 推理
    coding: SkillTracker;         // 编程
    writing: SkillTracker;        // 写作
    teaching: SkillTracker;       // 教学
    analysis: SkillTracker;       // 分析
    creative: SkillTracker;       // 创意
    conversation: SkillTracker;   // 对话
  };

  analyzeErrors(skill: string, timeRange: TimeRange): ErrorPattern[];
  optimizePrompt(skill: string, errorPatterns: ErrorPattern[]): string;
  // ↑ 调用 DSPy 自动调优对应脑区的 Prompt
}
```

---

## 12. 代码基座选型

### 主基座：Hermes Agent

| 维度 | 选择 | 理由 |
|------|------|------|
| **核心框架** | Hermes Agent | MIT + 167k★ + 完整 gateway/tools/skills/memory |
| **并行调度** | LangGraph + AutoGen | 图状态机 + 多Agent辩论 |
| **记忆系统** | Letta + ChromaDB + Neo4j | 三层记忆 + 向量 + 图 |
| **路由引擎** | FreeLLMAPI Router ×2 | 丘脑路由 + 突显网络 |
| **安全护栏** | NeMo-Guardrails + LLM-Guard | 双通路杏仁核 |
| **学习优化** | DSPy + Langfuse | Prompt 调优 + 监控 |
| **桌面壳** | cc-switch | Tauri + 多Agent管理 |

### 为什么不用 ECA 作为基座

- AGPL-3.0 传染性许可证 → 整个项目必须 AGPL
- 2 commits / 1 人 / 0 release → 代码是空壳
- **参考其设计，用 Hermes Agent 承载实现**

---

## 13. 实现路线图

```
Phase 1: 基础骨架（2 周）
├── Hermes Agent 部署 + 自定义 Agent Loop
├── 数据库搭建：SQLite(regions/mode_weights) + ChromaDB + Neo4j
├── 杏仁核集成：NeMo-Guardrails 快速通路
└── 丘脑路由：FreeLLMAPI Router 第一版改造

Phase 2: 并行认知（3 周）
├── 颞叶：LlamaIndex + Neo4j 语义检索
├── 顶叶：Letta + Mem0 注意力分配
├── 海马体：三层记忆架构
├── 额叶左：LangGraph CoT
├── 额叶右：AutoGen ToT
└── 扣带回：ECA ConflictMonitor + HF NLI

Phase 3: 调度与收束（2 周）
├── 突显网络：FreeLLMAPI Router 5模式改造
├── Hermes 收束器：ECA CognitiveBrain 改造实现
└── 知识边界门：MetaCognitive Monitor

Phase 4: 学习与优化（2 周）
├── 基底节 RL：Q-Learning 集成
├── 小脑：DSPy + Langfuse
├── DMN：SOUL.md + Honcho 完整集成
└── 反馈回路：全流程闭环

Phase 5: 壳与发布（1 周）
├── cc-switch 桌面壳集成
├── 管理面板（FreeLLMAPI Dashboard 改造）
├── 文档完善
└── 公开 Release
```

### 里程碑

| 里程碑 | 产出 | 预计 |
|--------|------|:----:|
| M1 | 单用户输入 → 杏仁核 + 丘脑 → 单脑区回复 | 2 周 |
| M2 | 3 脑区并行（颞叶+顶叶+海马体）→ 收束 | 4 周 |
| M3 | 6 脑区全并行 + 冲突检测 + 5 模式切换 | 7 周 |
| M4 | RL 学习 + Prompt 优化 + 记忆巩固 | 9 周 |
| M5 | 桌面壳 + 管理面板 + 文档 | 10 周 |

---

## 附录 A：核心代码文件预估

```
cognitive-engine/
├── src/
│   ├── amygdala/           # 杏仁核 ~50 行（集成 NeMo）
│   ├── thalamus/           # 丘脑 ~300 行（FreeLLMAPI Router 改造）
│   ├── temporal/           # 颞叶 ~200 行
│   ├── parietal/           # 顶叶 ~200 行
│   ├── hippocampus/        # 海马体 ~400 行
│   ├── acc/                # 扣带回 ~150 行
│   ├── frontal_left/       # 额叶左 ~200 行
│   ├── frontal_right/      # 额叶右 ~200 行
│   ├── salience/           # 突显网络 ~300 行（FreeLLMAPI Router 改造）
│   ├── hermes/             # Hermes 收束器 ~500 行
│   ├── motor/              # 运动皮层 ~100 行（集成 Hermes tools）
│   ├── bg/                 # 基底节 ~200 行
│   ├── cerebellum/         # 小脑 ~200 行
│   ├── dmn/                # DMN ~100 行
│   └── loop.ts             # Agent Loop 主控 ~300 行
├── db/
│   ├── schema.sql           # regions + mode_weights + memories
│   └── migrations/
├── config/
│   └── mode-weights.json    # 5模式 × 14脑区权重矩阵
└── tests/
```

**预估总代码量**：~3,500 行核心业务逻辑

---

## 附录 B：关键技术依赖

```
运行时依赖：
  hermes-agent (MIT)       — 基座
  langgraph (MIT)          — 图状态机
  autogen (CC-BY-4.0)      — 多Agent
  letta (Apache-2.0)       — 虚拟上下文
  chromadb (Apache-2.0)    — 向量存储
  neo4j (GPLv3)            — 知识图谱（注意 GPL，可替换为 SurrealDB）
  llama-index (MIT)        — RAG
  nemoguardrails (Apache)  — 安全护栏
  dspy (MIT)               — Prompt 优化

开发工具：
  freellmapi (MIT)         — 路由引擎参考
  ECA (AGPL)               — 设计参考（不引入代码）
  cc-switch (MIT)          — 桌面壳
```

---

> 从碳基大脑到硅基架构。14 个脑区，14 个开源方案，0 个自研空白。
>
> — HIRO × 浩浩 · 2026-05-26
