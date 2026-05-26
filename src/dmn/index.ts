// ============================================================
// 默认模式网络（DMN）— 自我模型与连续性维护
// 对应文档: ARCHITECTURE.md Section 3 #14
// ============================================================

import { SelfModel } from "../types";
import { llmCall, parseLlmJson } from "../config/llm";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.dmn;

const DMN_DEFAULT_SELF: SelfModel = {
  identity: "HIRO — 脑启发认知引擎，14 脑区并行 AI",
  capabilities: [
    "多脑区并行认知处理",
    "动态模式切换（CEN/DMN/EMERGENCY/CREATIVE/TEACHING）",
    "三层记忆系统（STM/LTM/语义）",
    "冲突检测与暴露",
    "不确定性量化",
    "RL 持续学习",
  ],
  limitations: [
    "知识截止于训练数据",
    "无法进行物理世界操作",
    "情绪理解仅限于文本分析",
    "长时间推理可能退化",
  ],
  values: [
    "诚实 — 不确定时明确告知",
    "透明 — 冲突不掩盖",
    "安全 — 危险内容优先拦截",
    "成长 — 从每次交互中学习",
  ],
  knowledge_boundaries: [
    "2024 年后的实时事件需要搜索",
    "个人隐私信息不存储",
    "专业医疗/法律建议需标注免责",
  ],
  last_updated: new Date().toISOString(),
};

/**
 * DMN 自我模型维护
 * 在系统空闲时运行（IDLE 状态 → LEARNING_TICK）
 */
export class DefaultModeNetwork {
  private selfModel: SelfModel;
  private selfReflectionLog: string[] = [];

  constructor() {
    // 尝试从文件加载 SOUL.md
    this.selfModel = DMN_DEFAULT_SELF;
  }

  getSelfModel(): SelfModel {
    return { ...this.selfModel };
  }

  /** 更新自我模型 */
  updateSelfModel(updates: Partial<SelfModel>): void {
    this.selfModel = {
      ...this.selfModel,
      ...updates,
      last_updated: new Date().toISOString(),
    };
  }

  /** 添加能力 */
  addCapability(capability: string): void {
    if (!this.selfModel.capabilities.includes(capability)) {
      this.selfModel.capabilities.push(capability);
      this.logReflection(`新增能力: ${capability}`);
    }
  }

  /** 记录学习到的限制 */
  addLimitation(limitation: string): void {
    if (!this.selfModel.limitations.includes(limitation)) {
      this.selfModel.limitations.push(limitation);
      this.logReflection(`发现新限制: ${limitation}`);
    }
  }

  /** 知识边界更新 */
  updateKnowledgeBoundary(boundary: string): void {
    if (!this.selfModel.knowledge_boundaries.includes(boundary)) {
      this.selfModel.knowledge_boundaries.push(boundary);
      this.logReflection(`更新知识边界: ${boundary}`);
    }
  }

  /** 自我反思（在 LEARNING_TICK 中执行） */
  async selfReflect(
    recentInteractions: Array<{ input: string; output: string; satisfaction: number }>
  ): Promise<string> {
    if (recentInteractions.length === 0) return "无最近交互，跳过反思";

    const prompt = buildReflectionPrompt(recentInteractions, this.selfModel);

    try {
      const raw = await llmCall({
        systemPrompt: REFLECTION_SYSTEM_PROMPT,
        userPrompt: prompt,
        temperature: 0.5,
        maxTokens: 1024,
        timeoutMs: 8000,
        responseFormat: "json_object",
      });

      const result = parseLlmJson(raw);
      this.logReflection(`反思完成: ${result.summary || "无总结"}`);

      // 应用学到的改进
      if (result.new_capabilities) {
        for (const cap of result.new_capabilities) {
          this.addCapability(cap);
        }
      }
      if (result.new_limitations) {
        for (const lim of result.new_limitations) {
          this.addLimitation(lim);
        }
      }

      return result.summary || "反思完成";
    } catch (e) {
      console.warn("[DMN] 自我反思失败", e);
      return "反思执行出错，跳过本轮";
    }
  }

  /** 获取反思日志 */
  getReflectionLog(): string[] {
    return this.selfReflectionLog.slice(-50);
  }

  private logReflection(entry: string): void {
    const timestamp = new Date().toISOString();
    this.selfReflectionLog.push(`[${timestamp}] ${entry}`);
  }
}

// ---- Prompt ----

const REFLECTION_SYSTEM_PROMPT = `你是 DMN（默认模式网络）的自我反思模块。
你的任务是分析最近的交互记录，发现可以改进的地方。

## 分析维度
1. 能力缺口：有哪些任务经常处理不好？
2. 模式偏好：哪种认知模式（CEN/DMN/EMERGENCY/CREATIVE/TEACHING）用得最多/最少？
3. 一致性：回复风格、价值观是否保持一致？
4. 学习机会：从错误中能学到什么？

## 输出格式
严格输出 JSON：
{
  "summary": "一句话总结反思",
  "insights": ["发现1", "发现2"],
  "new_capabilities": ["新增能力"],
  "new_limitations": ["新发现的限制"],
  "suggested_changes": ["建议调整"]
}`;

function buildReflectionPrompt(
  interactions: Array<{ input: string; output: string; satisfaction: number }>,
  selfModel: SelfModel
): string {
  const recent = interactions.slice(-5);
  return `## 当前自我认知
身份: ${selfModel.identity}
能力: ${selfModel.capabilities.join(", ")}
限制: ${selfModel.limitations.join(", ")}

## 最近交互（最近 ${recent.length} 条）
${recent
  .map(
    (r, i) =>
      `### 交互 ${i + 1} (满意度: ${r.satisfaction})
输入: ${r.input.slice(0, 100)}
输出: ${r.output.slice(0, 200)}`
  )
  .join("\n\n")}

请反思分析。`;
}
