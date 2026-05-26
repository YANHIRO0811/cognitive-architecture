# Cognitive Architecture — 脑启发的 AI 认知引擎

> 14 脑区并行认知架构 | v0.1.0 | MIT

模拟人脑三维结构：**杏仁核→丘脑→三角并行(顶叶∥颞叶∥额叶)→Hermes收束→运动皮层执行**。

## 仓库结构

```
cognitive-engine/              # ⭐ IDE 生成的 TypeScript 实现（14 脑区运行时可执行）
├── src/
│   ├── loop.ts               # Agent Loop 主控
│   ├── amygdala/             # 杏仁核：双通路安全护栏
│   ├── thalamus/             # 丘脑：动态竞标路由
│   ├── parietal/             # 顶叶：注意力分配
│   ├── temporal/             # 颞叶：语义分解
│   ├── frontal/              # 额叶：双阶段策略引擎
│   ├── hippocampus/          # 海马体：三层记忆
│   ├── acc/                  # 扣带回：冲突检测
│   ├── hermes/               # Hermes：MHC 约束融合收束
│   ├── motor/                # 运动皮层：执行产出
│   ├── bg/                   # 基底节：Q-Learning RL
│   ├── cerebellum/           # 小脑：三向优化
│   ├── dmn/                  # DMN：自我模型
│   ├── salience/             # 突显网络：7状态FSM
│   └── config/               # 配置 + LLM 调用 + 模式权重
├── tests/                    # 77 测试用例
├── ARCH-DECISIONS.md         # 架构决策记录
├── TEST-PLAN.md              # 测试方案
└── .env.example              # 环境变量模板

docs/                          # 脑区架构设计文档
├── ARCHITECTURE.md           # 完整架构规格
├── GitHub开源项目_脑区匹配.md
├── 人脑三维模型_技术替换.md
├── 脑区三维模型.html          # Three.js 3D 交互
└── 脑区技术映射_完整对照表.md

references/                    # 参考项目分析
├── ECA/                      # Emergent Cognitive Architecture
└── OpenClaw/                 # OpenClaw 生态
```

## 快速开始

```bash
cd cognitive-engine
npm install
cp .env.example .env
# 编辑 .env：填入 LLM_API_KEY
npm start -- --repl   # 交互模式
```

## 认知链路

```
用户输入
  → Z=0 杏仁核(安全过滤) → 丘脑(路由分拣)
  → Z=1 顶叶(注意力) ∥ 海马体(记忆)                ← 并行 T1
  → Z=2 颞叶(语义) ∥ 额叶Phase1(预判)              ← 并行 T2
  → Z=2 额叶Phase2(完整策略)                        ← 等颞叶 T3
  → Z=3 Hermes收束(MHC约束融合)                     ← 冲突处理
  → Z=4 运动皮层(执行产出)
```

## 设计原则

1. **并行非串行** — 脑区同时处理，不等流水线
2. **冲突不放水** — 扣带回检测矛盾，Hermes 暴露不强行统一
3. **MHC 约束融合** — 双随机约束矩阵（行和=1，列和≤1）保护可解释性
4. **双阶段预判** — 额叶 Phase1 不等颞叶先出草案
5. **小脑三向优化** — 调权/调人/调时 + 正反馈防护
6. **杏仁核第一关** — 不等语义分析就拦截危险

## License

MIT
