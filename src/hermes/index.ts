// ============================================================
// Hermes 收束器 — 多源融合与最终决策（MHC 约束版）
// 对应文档: 06-hermes-convergence-prompt.md
// ============================================================

import {
  HermesInput,
  HermesOutput,
  FusionDimension,
  ParietalOutput,
  TemporalOutput,
  FrontalOutput,
} from "../types";
import { config } from "../config";
import { llmCall, parseLlmJson } from "../config/llm";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.hermes;

// ============================================================
// MHC 基础权重矩阵
// ============================================================

const BASE_WEIGHTS: Record<string, Record<FusionDimension, number>> = {
  parietal:    { correctness: 0.25, completeness: 0.25, safety: 0.15, efficiency: 0.20, user_adaptation: 0.15 },
  temporal:    { correctness: 0.40, completeness: 0.25, safety: 0.10, efficiency: 0.10, user_adaptation: 0.15 },
  frontal:     { correctness: 0.20, completeness: 0.15, safety: 0.15, efficiency: 0.40, user_adaptation: 0.10 },
  hippocampus: { correctness: 0.15, completeness: 0.30, safety: 0.05, efficiency: 0.10, user_adaptation: 0.40 },
  // 杏仁核不参与融合矩阵（只有安全否决权）
  // 扣带回不参与融合矩阵（只调制其他脑区权重）
};

const DIMENSIONS: FusionDimension[] = ["correctness", "completeness", "safety", "efficiency", "user_adaptation"];

// ============================================================
// MHCFusionMatrix — 双随机约束融合矩阵
// ============================================================

export class MHCFusionMatrix {
  /**
   * 构建约束融合矩阵
   *
   * 双随机约束：
   * 1. 每行和 = 1（每个脑区的影响力定死在 100%）
   * 2. 每列和 ≤ 1（每个维度收到的总信号 ≤ 1）
   */
  build(
    brainOutputs: Array<{
      id: string;
      confidence: number;
      baseWeights: Record<FusionDimension, number>;
    }>,
    accModulation: number
  ): {
    matrix: number[][];
    rowSums: number[];
    colSums: number[];
    suppressedWeight: number;
    isConstrained: boolean;
  } {
    const nRegions = brainOutputs.length;
    const nDims = DIMENSIONS.length;

    // Step 1: 原始加权
    const raw: number[][] = brainOutputs.map((region) =>
      DIMENSIONS.map((dim) =>
        (region.baseWeights[dim] || 0) * region.confidence * accModulation
      )
    );

    // Step 2: 行归一化（每个脑区总影响力 = 1）
    const rowNormalized = raw.map((row) => {
      const rowSum = row.reduce((a, b) => a + b, 0);
      if (rowSum === 0) return row.map(() => 1 / nDims);
      return row.map((v) => v / rowSum);
    });

    // Step 3: 列约束（每列和 ≤ 1）
    const colSums = Array(nDims).fill(0);
    for (let j = 0; j < nDims; j++) {
      for (let i = 0; i < nRegions; i++) {
        colSums[j] += rowNormalized[i][j];
      }
    }

    let totalSuppressed = 0;
    const final = rowNormalized.map((row) => {
      return row.map((v, j) => {
        if (colSums[j] > 1) {
          const suppressed = v * (1 - 1 / colSums[j]);
          totalSuppressed += suppressed;
          return v / colSums[j];
        }
        return v;
      });
    });

    const finalRowSums = final.map((row) => row.reduce((a, b) => a + b, 0));
    const finalColSums = Array(nDims).fill(0);
    for (let j = 0; j < nDims; j++) {
      for (let i = 0; i < nRegions; i++) {
        finalColSums[j] += final[i][j];
      }
    }

    return {
      matrix: final,
      rowSums: finalRowSums,
      colSums: finalColSums,
      suppressedWeight: totalSuppressed,
      isConstrained: finalColSums.every((s) => s <= 1.001),
    };
  }
}

// ============================================================
// ACCModulator — 扣带回调制器
// ============================================================

export class ACCModulator {
  computeAccModulation(
    consensusLevel: number,
    conflicts: Array<{ severity: string }>,
    hasCritical: boolean
  ): { modulation: number; suppressedToUncertainty: number } {
    if (hasCritical) return { modulation: 0.55, suppressedToUncertainty: 0.45 };
    if (consensusLevel < 0.5) return { modulation: 0.7, suppressedToUncertainty: 0.3 };
    if (consensusLevel < 0.7) return { modulation: 0.85, suppressedToUncertainty: 0.15 };
    return { modulation: 1.0, suppressedToUncertainty: 0 };
  }
}

// ============================================================
// Hermes System Prompt
// ============================================================

const HERMES_SYSTEM_PROMPT = `你是"Hermes 收束器"，模拟人脑前额叶的元认知和多源信息整合功能。

## 核心职责
你的唯一任务是将多个脑区的并行输出融合为一个最终决策：
- 理解用户情绪和语气
- 综合顶叶（注意力重点）、颞叶（语义理解）、额叶（策略方案）、海马体（记忆关联）
- 检测并处理脑区间冲突
- 决定最终行动：ANSWER / ASK_CLARIFICATION / SEARCH_FIRST / DECLINE / DEFER
- 生成最终回复

## 5种行动决策
- ANSWER：信息充足，直接回答
- ASK_CLARIFICATION：关键信息缺失或冲突无法解决
- SEARCH_FIRST：需要外部信息（触发工具调用）
- DECLINE：超出能力范围或不安全
- DEFER：复杂任务，建议转交

## 核心原则
- 冲突不放水：不同脑区的分歧是有价值信号，不做表面统一
- 输出当前最优判断 + 标注不确定什么
- 被约束衰减的权重 → 转为 uncertaintyMarkers 暴露
- suppressedWeight > 0.3 → 必须标注不确定性
- 某个维度 colSum < 0.5 → 该维度信息不足，应追问
- 杏仁核 WARNING 时语气自动转为谨慎
- 杏仁核 CRITICAL 时不生成回复，直接 DECLINE

## 输出格式
严格输出 JSON，不要任何解释文字。`;

// ============================================================
// 主融合函数
// ============================================================

export async function hermesConverge(input: HermesInput): Promise<HermesOutput> {
  // === Step 0: 杏仁核安全否决 ===
  const amygdalaLevel = input.amygdala?.level || input.amygdalaSignal?.level || "SAFE";

  if (amygdalaLevel === "CRITICAL") {
    return {
      action_decision: "DECLINE",
      action_confidence: 1.0,
      final_response: "抱歉，你的请求包含不安全内容，已被安全策略拦截。",
      response_tone: { primary: "cautious", reason: "安全拦截" },
      synthesis: { core_answer: "已拦截", key_supporting_points: [], referenced_memories: [], strategy_adopted: "none" },
      uncertainty_markers: [{ type: "ambiguous_input", description: "输入被安全策略拦截", severity: "critical", how_resolved: "deferred" }],
      metacognition: { overall_confidence: 0, risk_assessment: "CRITICAL 安全威胁", decision_rationale: "杏仁核 CRITICAL，直接拒绝" },
    };
  }

  // === Step 1: MHC 约束融合（本地计算，不调 LLM） ===

  // 构建脑区置信度
  const parietalConf = getAvgConfidence(input.parietal);
  const temporalConf = getAvgConfidence(input.temporal);
  const frontalConf = getAvgConfidence(input.frontal);
  const hippocampusConf = 0.8;

  // 扣带回调制
  const accInput = input.acc || {
    conflicts: input.conflictReport?.conflicts || [],
    consensus_level: input.conflictReport?.consensus_level || 0.7,
    has_critical: input.conflictReport?.conflicts?.some((c: any) => c.severity === "critical") || false,
  };

  const modulator = new ACCModulator();
  const accResult = modulator.computeAccModulation(
    accInput.consensus_level,
    accInput.conflicts,
    accInput.has_critical
  );

  // MHC 融合矩阵
  const mhc = new MHCFusionMatrix();
  const fusionResult = mhc.build(
    [
      { id: "parietal", confidence: parietalConf, baseWeights: BASE_WEIGHTS["parietal"] },
      { id: "temporal", confidence: temporalConf, baseWeights: BASE_WEIGHTS["temporal"] },
      { id: "frontal", confidence: frontalConf, baseWeights: BASE_WEIGHTS["frontal"] },
      { id: "hippocampus", confidence: hippocampusConf, baseWeights: BASE_WEIGHTS["hippocampus"] },
    ],
    accResult.modulation
  );

  // === Step 2: 冲突处理 ===
  const uncertaintyMarkers: HermesOutput["uncertainty_markers"] = [];

  // 扣带回冲突 → 暴露
  for (const c of accInput.conflicts) {
    uncertaintyMarkers.push({
      type: "strategy_conflict",
      description: c.description,
      severity: c.severity as "minor" | "moderate" | "critical",
      how_resolved: "exposed_to_user",
    });
  }

  // MHC 约束衰减 → 标记不确定性
  if (fusionResult.suppressedWeight > 0.15) {
    uncertaintyMarkers.push({
      type: "confidence_gap",
      description: `MHC 约束矩阵衰减权重 ${(fusionResult.suppressedWeight * 100).toFixed(0)}%，系统存在分歧`,
      severity: fusionResult.suppressedWeight > 0.3 ? "critical" : "moderate",
      how_resolved: "exposed_to_user",
    });
  }

  // 维度不足 → 标记
  for (let j = 0; j < fusionResult.colSums.length; j++) {
    if (fusionResult.colSums[j] < 0.5) {
      uncertaintyMarkers.push({
        type: "missing_info",
        description: `${DIMENSIONS[j]} 维度信息不足 (列和: ${fusionResult.colSums[j].toFixed(2)})`,
        severity: "moderate",
        how_resolved: "asked_clarification",
      });
    }
  }

  // === Step 3-5: LLM 语义融合（温度 0.3，保留语气灵活性） ===

  const userPrompt = buildHermesUserPrompt(input, fusionResult, accResult);

  try {
    const raw = await llmCall({
      systemPrompt: HERMES_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: config.salience.perRegionTimeout.hermes,
      responseFormat: "json_object",
    });

    const parsed = parseLlmJson(raw);

    // 合并 MHC 计算的不确定性 + LLM 识别的不确定性
    const llmUncertainty = parsed.uncertainty_markers || [];
    const allUncertainty = [...uncertaintyMarkers, ...llmUncertainty];

    // 情感适配
    const tone = amygdalaLevel === "WARNING"
      ? { primary: "cautious" as const, reason: "杏仁核 WARNING 标记" }
      : (parsed.response_tone || { primary: "neutral" as const, reason: "默认语气" });

    return {
      action_decision: parsed.action_decision || inferAction(accInput, uncertaintyMarkers),
      action_confidence: parsed.action_confidence || 0.7,
      final_response: parsed.final_response || "我理解了您的问题，让我为您提供帮助。",
      response_tone: tone,
      synthesis: parsed.synthesis || {
        core_answer: parsed.final_response || "",
        key_supporting_points: [],
        referenced_memories: [],
        strategy_adopted: "default",
      },
      uncertainty_markers: allUncertainty,
      clarification_questions: parsed.clarification_questions,
      metacognition: {
        overall_confidence: parsed.metacognition?.overall_confidence || 0.7,
        risk_assessment: amygdalaLevel === "WARNING"
          ? "存在风险标记，回复需谨慎"
          : (parsed.metacognition?.risk_assessment || "正常"),
        alternative_viewpoints: parsed.metacognition?.alternative_viewpoints,
        decision_rationale: parsed.metacognition?.decision_rationale || "多脑区融合决策",
      },
    };
  } catch (e) {
    console.warn("[Hermes] LLM 融合失败，使用降级", e);
    return fallbackOutput(input, uncertaintyMarkers);
  }
}

// ============================================================
// 辅助函数
// ============================================================

function getAvgConfidence(output: any): number {
  if (!output) return 0.5;
  if (typeof output === "object" && output.meta?.confidence_overall) return output.meta.confidence_overall;
  if (output.recommendation?.confidence) return output.recommendation.confidence;
  if (output.activation?.level === "URGENT") return 0.9;
  return 0.7;
}

function inferAction(
  acc: { has_critical: boolean; conflicts: any[] },
  uncertaintyMarkers: any[]
): "ANSWER" | "ASK_CLARIFICATION" | "SEARCH_FIRST" | "DECLINE" | "DEFER" {
  if (acc.has_critical) return "ASK_CLARIFICATION";
  if (uncertaintyMarkers.some((m) => m.severity === "critical")) return "ASK_CLARIFICATION";
  if (uncertaintyMarkers.some((m) => m.type === "missing_info")) return "SEARCH_FIRST";
  return "ANSWER";
}

function buildHermesUserPrompt(
  input: HermesInput,
  fusion: ReturnType<MHCFusionMatrix["build"]>,
  accMod: { modulation: number; suppressedToUncertainty: number }
): string {
  const parts: string[] = [];

  // 杏仁核
  parts.push(`## 杏仁核安全信号
级别: ${input.amygdala?.level || "SAFE"}
操作: ${input.amygdala?.action || "PASS"}
备注: ${input.amygdala?.note || "无"}`);

  // MHC 融合矩阵
  parts.push(`## MHC 约束融合矩阵
扣带回调制系数: ${accMod.modulation.toFixed(2)}
不确定度预算: ${accMod.suppressedToUncertainty.toFixed(2)}
约束成功: ${fusion.isConstrained}
矩阵维度列和: [${fusion.colSums.map(s => s.toFixed(2)).join(", ")}]
被衰减的权重: ${fusion.suppressedWeight.toFixed(2)}`);

  if (fusion.suppressedWeight > 0.3) {
    parts.push("⚠️ 衰减权重 > 0.3，必须在回复中标注不确定性！");
  }

  for (let j = 0; j < fusion.colSums.length; j++) {
    if (fusion.colSums[j] < 0.5) {
      parts.push(`⚠️ ${DIMENSIONS[j]} 维度信号不足，应考虑追问！`);
    }
  }

  // 脑区输出
  parts.push("## 脑区输出");
  parts.push(formatRegionOutput("parietal", input.parietal));
  parts.push(formatRegionOutput("temporal", input.temporal));
  parts.push(formatRegionOutput("frontal", input.frontal));

  // 海马体
  const hippo = input.hippocampus;
  if (hippo) {
    const summary = typeof hippo.retrieved?.merged_summary === "string"
      ? hippo.retrieved.merged_summary
      : hippo.matched_memories
        ? `匹配 ${hippo.matched_memories?.length || 0} 条记忆`
        : "无记忆数据";
    parts.push(`## 海马体记忆\n${summary}`);
  }

  // 扣带回冲突
  const acc = input.acc;
  parts.push(`## 扣带回冲突报告
共识度: ${acc?.consensus_level?.toFixed(2) || "N/A"}
冲突数: ${acc?.conflicts?.length || 0}
${acc?.conflicts?.length
  ? acc.conflicts.map((c: any) => `  - [${c.severity}] ${c.description}`).join("\n")
  : "  无冲突"}`);

  if (fusion.suppressedWeight > 0.15) {
    parts.push("\n## 重要指示\n由于 MHC 约束矩阵检测到显著分歧，你的回复必须：\n1. 明确标注不确定性\n2. 呈现不同脑区的不同看法\n3. 不做表面统一");
  }

  return parts.join("\n\n");
}

function formatRegionOutput(regionId: string, output: any): string {
  if (!output) return `### ${regionId}\n(无输出)`;

  try {
    switch (regionId) {
      case "parietal": {
        const p = output as ParietalOutput;
        if (!p.implicit_info) return `### ${regionId}\n${JSON.stringify(output).slice(0, 200)}`;
        return `### ${regionId}
激活级别: ${p.activation?.level || "N/A"}
意图层: ${p.implicit_info.intent_layers?.map((l: any) => l.intent).join(" | ") || "无"}
实体: ${p.explicit_info?.entities?.map((e: any) => e.name).join(", ") || "无"}`;
      }
      case "temporal": {
        const t = output as TemporalOutput;
        if (!t.domain_classification) return `### ${regionId}\n${JSON.stringify(output).slice(0, 200)}`;
        return `### ${regionId}
领域: ${t.domain_classification.domain?.primary || "N/A"} (${t.domain_classification.complexity?.level || "N/A"})
语义单元: ${t.semantic_units?.length || 0}
置信度: ${t.meta?.confidence_overall || "N/A"}`;
      }
      case "frontal": {
        const f = output as FrontalOutput;
        if (!f.recommendation) return `### ${regionId}\n${JSON.stringify(output).slice(0, 200)}`;
        return `### ${regionId}
推荐策略: ${f.recommendation.primary_strategy_id || "N/A"} (置信度: ${f.recommendation.confidence || "N/A"})
${f.strategies?.map((s: any) => `  [${s.strategy_id}] ${s.tagline} 总分:${s.scores?.weighted_total?.toFixed(1) || "N/A"}`).join("\n") || ""}`;
      }
      default:
        return `### ${regionId}\n${JSON.stringify(output).slice(0, 300)}`;
    }
  } catch {
    return `### ${regionId}\n(摘要失败)`;
  }
}

function fallbackOutput(
  input: HermesInput,
  uncertaintyMarkers: HermesOutput["uncertainty_markers"]
): HermesOutput {
  // 杏仁核 CRITICAL → 直接拒绝
  if (input.amygdala?.level === "CRITICAL") {
    return {
      action_decision: "DECLINE",
      action_confidence: 1.0,
      final_response: "安全策略不允许处理此请求",
      response_tone: { primary: "cautious", reason: "安全拦截" },
      synthesis: { core_answer: "已拦截", key_supporting_points: [], referenced_memories: [], strategy_adopted: "none" },
      uncertainty_markers: uncertaintyMarkers,
      metacognition: { overall_confidence: 0, risk_assessment: "安全威胁", decision_rationale: "降级模式" },
    };
  }

  // 扣带回 critical → 追问
  if (input.acc?.has_critical) {
    const questions = input.acc.conflicts.map((c: any) => `关于「${c.description}」，你能否提供更多信息？`);
    return {
      action_decision: "ASK_CLARIFICATION",
      action_confidence: 0.3,
      final_response: "我注意到系统中存在一些分歧，需要你帮忙澄清。",
      response_tone: { primary: "detailed", reason: "需要用户澄清" },
      synthesis: { core_answer: "需要澄清", key_supporting_points: [], referenced_memories: [], strategy_adopted: "clarify" },
      uncertainty_markers: uncertaintyMarkers,
      clarification_questions: questions,
      metacognition: { overall_confidence: 0.2, risk_assessment: "冲突无法自动解决", decision_rationale: "降级模式-追问" },
    };
  }

  // 额叶策略存在 → 简单回复
  const frontal = input.frontal as FrontalOutput | any;
  const strategyTagline = frontal?.strategies?.find((s: any) =>
    s.strategy_id === frontal?.recommendation?.primary_strategy_id
  )?.tagline;

  return {
    action_decision: "ANSWER",
    action_confidence: 0.3,
    final_response: strategyTagline || "我理解了你的问题，但当前无法给出完整回答。请稍后再试。",
    response_tone: { primary: "concise", reason: "降级模式" },
    synthesis: { core_answer: strategyTagline || "降级回复", key_supporting_points: [], referenced_memories: [], strategy_adopted: "fallback" },
    uncertainty_markers: [
      ...uncertaintyMarkers,
      { type: "confidence_gap", description: "收束器降级处理，结果可能不完整", severity: "moderate", how_resolved: "exposed_to_user" },
    ],
    metacognition: { overall_confidence: 0.1, risk_assessment: "降级模式", decision_rationale: "LLM 调用失败，降级回应" },
  };
}
