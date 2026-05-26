# Cognitive Engine — 脑启发 AI 认知引擎

> 14 脑区并行认知架构 | v0.1.0 | MIT

模拟人脑三维结构：**杏仁核→丘脑→三角并行(顶叶∥颞叶∥额叶)→Hermes收束→运动皮层执行**，全部组件均有开源方案可复用。

---

## 目录

1. [架构概览](#架构概览)
2. [快速开始](#快速开始)
3. [运行模式](#运行模式)
4. [项目结构](#项目结构)
5. [依赖清单](#依赖清单)
6. [配置参考](#配置参考)
7. [关键特性](#关键特性)
8. [开发工作流](#开发工作流)
9. [参考设计](#参考设计)

---

## 架构概览

```
Z=0 入口层 ──── 杏仁核(安全) + 丘脑(路由)
Z=1 感知层 ──── 顶叶(注意力) ∥ 海马体(记忆)
Z=2 认知层 ──── 颞叶(语义) ∥ 额叶(策略) ∥ 扣带回(冲突)
Z=3 收束层 ──── Hermes(融合)
Z=4 执行层 ──── 运动皮层(输出)
后台持续 ──── 基底节(RL) + 小脑(DSPy) + DMN(自我)
```

**单次请求完整链路：**

```
用户输入
  → Z=0 杏仁核(5ms) → 丘脑(10ms)
  → Z=1-2 T1: 顶叶(5s) ∥ 海马体(3s)       ← 并行
  → Z=1-2 T2: 颞叶(12s) ∥ 额叶Phase1(8s)  ← 并行
  → Z=2   T3: 额叶Phase2(20s)             ← 等颞叶
  → Z=3   Hermes收束(5s)                   ← 冲突处理+融合
  → Z=4   运动皮层执行
  → 后台: 记忆巩固 + 小脑优化 + DMN反思
```

---

## 快速开始

### 前置条件

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **LLM API Key**（DeepSeek / OpenAI 兼容接口）

### 安装与配置

```bash
# 进入项目目录
cd cognitive-engine

# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env

# 编辑 .env，填入 LLM_API_KEY（必填）
# LLM_API_KEY=sk-your-key-here
# LLM_BASE_URL=https://api.deepseek.com/v1    # 默认 DeepSeek
# LLM_MODEL=deepseek-chat                     # 默认模型
```

### 首次运行

```bash
# 单次查询
npm start "帮我写一个快速排序函数"

# 交互模式（推荐探索用）
npm start -- --repl

# 演示模式（无参数运行，3 条内置查询）
npm start
```

---

## 运行模式

### 单次查询模式

```bash
npm start "你的问题"
```

执行一次完整的认知链路，输出最终回复和元数据。

### 交互式 REPL 模式

```bash
npm start -- --repl
```

进入交互对话，支持特殊命令：

| 命令 | 作用 |
|------|------|
| `/report` | 查看系统运行报告（FSM状态、指标、技能健康度、Q表） |
| `/fsm` | 查看 FSM 状态转移日志 |
| `exit` / `quit` | 退出 |

### 演示模式

```bash
npm start
```

无参数运行，自动执行 3 条演示查询并输出系统报告。

### 开发模式

```bash
npm run dev -- "查询内容"    # tsx watch 热重载
npm run dev -- --repl         # 热重载 + REPL
```

---

## 项目结构

```
cognitive-engine/
├── package.json              # 项目元信息 + 脚本
├── tsconfig.json             # TypeScript 编译配置
├── .env.example              # 环境变量模板
├── .env                      # 本地环境变量（不提交）
├── README.md                 # 本文档
├── ARCH-DECISIONS.md         # 架构决策记录
├── TEST-PLAN.md              # 测试计划
└── src/
    ├── index.ts              # 入口（CLI单次查询 / REPL交互 / 演示模式）
    ├── loop.ts               # ⭐ Agent Loop 主控（大脑管家，整合全部 14 脑区）
    ├── types/index.ts        # 14 脑区全部类型定义 + 枚举 + Schema
    ├── config/
    │   ├── index.ts          # 环境变量加载 + 全局配置对象
    │   ├── llm.ts            # LLM 统一调用接口（所有脑区共用）
    │   └── mode-weights.ts   # 5模式×14脑区权重矩阵 + 查询函数
    ├── db/
    │   ├── schema.sql        # SQLite 数据库 Schema（regions + mode_weights）
    │   └── init.ts           # 数据库初始化 + 种子数据插入
    ├── amygdala/             # 杏仁核：双通路安全护栏（正则快通 + LLM慢通）
    ├── thalamus/             # 丘脑：输入分类 → 模式选择 → 脑区激活 → 预算分配
    ├── salience/             # 突显网络：7状态FSM + 调度指标 + 健康自检
    ├── parietal/             # 顶叶：注意力分配（显性/隐性提取 + 激活标记）
    ├── temporal/             # 颞叶：语义分解 + 5维领域分类 + 实体关系图 + 不确定性标注
    ├── frontal/              # 额叶：双阶段策略引擎（Phase1预判 + Phase2完整策略 + 4维评分）
    ├── hippocampus/          # 海马体：三层记忆（STM工作记忆 + LTM向量存储 + 语义图谱）
    ├── acc/                  # 扣带回：多脑区置信度冲突检测 + 共识度计算
    ├── hermes/               # Hermes：多源信号合成收束 + 5种行动决策
    ├── motor/                # 运动皮层：动作规划 + 执行产出
    ├── bg/                   # 基底节：Q-Learning 强化学习（ε-greedy）
    ├── cerebellum/           # 小脑：7技能追踪 + 错误模式分析 + Prompt 优化
    └── dmn/                  # DMN：自我模型维护 + 定期反思（每 10 次交互）
```

---

## 依赖清单

### 运行时依赖 (dependencies)

| 包名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| `better-sqlite3` | ^11.0.0 | SQLite 数据库（脑区状态、权重矩阵持久化） | MIT |
| `chromadb` | ^1.10.0 | 向量数据库客户端（长期记忆 LTM） | Apache-2.0 |
| `dotenv` | ^16.4.0 | 环境变量加载 | BSD-2-Clause |
| `openai` | ^4.70.0 | LLM API 调用（DeepSeek / OpenAI 兼容） | Apache-2.0 |
| `zod` | ^3.23.0 | 运行时类型校验（脑区输出 Schema 验证） | MIT |

### 开发依赖 (devDependencies)

| 包名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| `@types/better-sqlite3` | ^7.6.0 | better-sqlite3 TypeScript 类型 | MIT |
| `@types/node` | ^22.0.0 | Node.js 类型定义 | MIT |
| `tsx` | ^4.16.0 | TypeScript 直接执行（无需编译） | MIT |
| `typescript` | ^5.5.0 | TypeScript 编译器 | Apache-2.0 |
| `vitest` | ^2.0.0 | 测试框架 | MIT |

### 外部服务依赖

| 服务 | 用途 | 必需性 |
|------|------|--------|
| LLM API (DeepSeek / OpenAI 兼容) | 所有脑区的 LLM 推理 | **必需** |
| ChromaDB（可选） | 长期记忆向量存储 | 可选（内存模拟模式可用） |

---

## 配置参考

所有配置通过 `.env` 文件管理。完整列表：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `LLM_API_KEY` | (空) | **必填**，LLM API 密钥 |
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | LLM API 地址（OpenAI 兼容格式） |
| `LLM_MODEL` | `deepseek-chat` | 使用的 LLM 模型名称 |
| `SQLITE_PATH` | `./data/cognitive.db` | SQLite 数据库文件路径 |
| `CHROMA_PATH` | `./data/chroma` | ChromaDB 持久化路径 |
| `AMYGDALA_FAST_ENABLED` | `true` | 杏仁核快速通路开关 |
| `AMYGDALA_SLOW_ENABLED` | `true` | 杏仁核慢速通路（LLM）开关 |
| `HIPPOCAMPUS_STM_MAX_TOKENS` | `25000` | 工作记忆最大 token 数 |
| `SALIENCE_TICK_INTERVAL_MS` | `1000` | FSM 时钟间隔（毫秒） |
| `SALIENCE_PROCESSING_TIMEOUT_MS` | `30000` | 脑区处理总超时（毫秒） |
| `MAX_CONCURRENT_REGIONS` | `3` | 同一拍最大并行脑区数 |

### 脑区超时配置（硬编码在 `src/config/index.ts`）

| 脑区 | 超时 (ms) | 说明 |
|------|-----------|------|
| `parietal` | 5,000 | 注意力分配，轻量 |
| `temporal` | 12,000 | 语义分析，较重量 |
| `frontal_phase1` | 8,000 | 额叶预判 |
| `frontal_phase2` | 20,000 | 额叶完整策略，最重 |
| `hippocampus` | 3,000 | 记忆检索，本地最快 |
| `hermes` | 5,000 | 收束融合 |

---

## 关键特性

- **并行非串行**: 顶叶∥颞叶∥额叶三角并行，不等串行流水线
- **冲突不放水**: 扣带回检测矛盾，Hermes 暴露而非强行统一
- **双阶段预判**: 额叶 Phase1 不等颞叶，先基于意图出预判草案
- **5 模式切换**: CEN/DMN/EMERGENCY/CREATIVE/TEACHING 由突显网络调度
- **降级兜底**: 每个脑区都有超时降级路径，保证系统韧性（返回合理默认值）
- **RL 持续学习**: 基底节 Q-Learning + 小脑 Prompt 优化 + DMN 自我反思
- **自我模型**: DMN 维护身份/能力/限制/价值观/知识边界，每 10 次交互触发反思

---

## 开发工作流

### 目录约定

- 每个脑区独立目录，含 `index.ts`（实现）和 `prompts.ts`（LLM Prompt 模板）
- 类型定义集中在 `src/types/index.ts`
- 配置文件集中在 `src/config/`
- 数据库相关在 `src/db/`

### 添加新脑区

1. 在 `src/types/index.ts` 定义输入/输出接口
2. 创建 `src/<region>/` 目录
3. 实现处理函数，导出标准接口
4. 在 `src/loop.ts` 中注册到 `CognitiveEngine`
5. 在 `mode-weights.ts` 中配置 5 模式权重

### 脚本速查

```bash
npm run build       # TypeScript 编译
npm run dev         # tsx watch 热重载
npm test            # 运行测试
npm run db:init     # 初始化/重置数据库
```

---

## 参考设计

- [ARCHITECTURE.md](../brain-arch/ARCHITECTURE.md) — 完整架构规格（14 脑区三维模型）
- [ARCH-DECISIONS.md](./ARCH-DECISIONS.md) — 架构决策记录（为什么这样实现）
- [TEST-PLAN.md](./TEST-PLAN.md) — 测试方案
- 基于 Hermes Agent | FreeLLMAPI Router | ECA CognitiveBrain | NeMo-Guardrails | LangGraph + AutoGen | Letta + ChromaDB + Neo4j | DSPy
