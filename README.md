# Cognitive Architecture — 脑启发的 AI 助手架构

> 模拟人脑运作方式：多脑区并行处理同一个输入，各产出不同角度思考，Hermes（前额叶）做总调度收束。

## 核心思路

不是另一个 AI 助手框架，而是**用人脑架构重新设计 AI 认知引擎**。

```
用户输入
    │
    ├─ 杏仁核（危机预警）    → NeMo-Guardrails + LLM-Guard
    ├─ 丘脑（路由分拣）      → Hermes Gateway + LangGraph
    ├─ 颞叶（WHAT识别）      → LlamaIndex + Neo4j + HF
    ├─ 顶叶（WHERE注意）     → Letta(MemGPT) + Mem0
    ├─ 海马体（记忆检索）     → Letta + ChromaDB + Neo4j
    ├─ 扣带回（冲突监控）     → ECA ConflictMonitor + HF NLI
    ├─ 额叶左（分析策略）     → LangGraph + AutoGen
    ├─ 额叶右（创意发散）     → AutoGen 辩论模式
    └─ 突显网络（状态切换）   → 🔧 自研 FSM
            │
            ▼
        Hermes 收束器
        （冲突处理 + 主方向选择 + 修正注入 + 不确定性暴露）
            │
            ▼
        运动皮层（执行产出）
        → Hermes 70+ tools + MCP 协议
```

## 设计原则

1. **并行不是串行** — 所有脑区同时接到输入，独立产出
2. **冲突不放水** — 冲突是最有价值的信息
3. **每个脑区有自己的记忆痕迹**
4. **杏仁核在第一关** — 不等分析就拦截危险
5. **每一条前馈都有反馈** — 双向修正，不单向传递
6. **网络动态切换** — DMN↔CEN 由突显网络调度

## 13 脑区 ↔ 开源技术匹配

| 脑区 | 最佳匹配 | Stars |
|------|---------|:-----:|
| 丘脑(路由) | hermes-agent gateway | 167k |
| 顶叶(注意力) | letta-ai/letta (MemGPT) | 14k |
| 颞叶(识别) | run-llama/llama_index | 38k |
| 额叶(计划) | langchain-ai/langgraph | 12k |
| 杏仁核(预警) | NVIDIA/NeMo-Guardrails | 4.5k |
| 海马体(记忆) | letta-ai/letta + chroma-core/chroma | 14k+18k |
| 扣带回(冲突) | ECA ConflictMonitor + HF NLI | 9 |
| Hermes(收束) | ECA CognitiveBrain + microsoft/autogen | 9+40k |
| 运动皮层(执行) | hermes-agent tools + MCP | 167k+30k |
| 基底节(RL) | ECA RL Service | 9 |
| 小脑(优化) | stanfordnlp/dspy | 20k |
| DMN(自我) | plastic-labs/honcho + SOUL.md | 3.3k |
| 突显网络(切换) | 🔧 自研 FSM | — |

## 目录

```
docs/
├── 脑区三维模型.html           # Three.js 3D 交互模型
├── 人脑三维模型_技术替换.md      # XYZ三轴 + 五层Z轴对照
├── GitHub开源项目_脑区匹配.md    # 完整匹配分析
└── 脑区技术映射_完整对照表.md    # 13脑区技术实现方案

references/
├── ECA/                        # Emergent Cognitive Architecture 分析
│   ├── ECA_architecture.md
│   ├── ECA_completebrainplan.md
│   └── ...
└── OpenClaw/                   # OpenClaw 生态分析
    ├── GH_openclaw_openclaw_README.md
    └── ...
```

## 状态

🚧 架构设计阶段 — 技术选型完成，原型开发中

## License

MIT
