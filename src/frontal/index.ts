// ============================================================
// 额叶（Frontal Lobe）— 计划与决策实现（双阶段）
// ============================================================

import { FrontalInput, FrontalOutput } from "../types";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.frontal;
import { config } from "../config";
import { llmCall, parseLlmJson } from "../config/llm";
import { FRONTAL_PHASE1_PROMPT, FRONTAL_PHASE2_PROMPT } from "./prompts";

/** Phase 1: 预判——基于顶叶，不等颞叶，立即执行 */
export async function frontalPhase1(
  input: FrontalInput
): Promise<FrontalOutput["pre_judgments"]> {
  const userPrompt = buildPhase1UserPrompt(input);
  const raw = await llmCall({
    systemPrompt: FRONTAL_PHASE1_PROMPT,
    userPrompt,
    temperature: 0.3,
    maxTokens: 2048,
    timeoutMs: config.salience.perRegionTimeout.frontal_phase1,
    responseFormat: "json_object",
  });

  try {
    const parsed = parseLlmJson(raw);
    return parsed.pre_judgments || [];
  } catch (e) {
    console.warn("[Frontal-Phase1] LLM 返回解析失败", e);
    return [
      {
        direction: "基于意图理解的标准响应",
        confidence: 0.3,
        assumptions_to_verify: ["语义分析失败，降级处理"],
        generated_at: "pre_temporal",
      },
    ];
  }
}

/** Phase 2: 完整策略生成——等颞叶完成后执行 */
export async function frontalPhase2(input: FrontalInput): Promise<FrontalOutput> {
  // Phase 1 结果（已在上一步拿到）
  const preJudgments = input.parietal_output.intent_layers?.length
    ? [{ direction: "从意图分层推导", confidence: 0.5, assumptions_to_verify: [], generated_at: "pre_temporal" as const }]
    : [];

  const userPrompt = buildPhase2UserPrompt(input);
  const raw = await llmCall({
    systemPrompt: FRONTAL_PHASE2_PROMPT,
    userPrompt,
    temperature: 0.5,
    maxTokens: 4096,
    timeoutMs: config.salience.perRegionTimeout.frontal_phase2,
    responseFormat: "json_object",
  });

  try {
    const parsed = parseLlmJson(raw) as FrontalOutput;
    return {
      ...parsed,
      pre_judgments: preJudgments,
    };
  } catch (e) {
    console.warn("[Frontal-Phase2] LLM 返回解析失败", e);
    return fallbackOutput(preJudgments);
  }
}

/** 完整双阶段调用（由突显网络调度） */
export async function frontalProcess(input: FrontalInput): Promise<FrontalOutput> {
  // Phase 1 不等颞叶
  const preJudgments = await frontalPhase1(input);

  // Phase 2 需要等颞叶（调用方已在上游处理）
  // 这里直接跑 Phase 2
  const output = await frontalPhase2(input);
  output.pre_judgments = preJudgments;
  return output;
}

// ---- 辅助函数 ----

function buildPhase1UserPrompt(input: FrontalInput): string {
  const parietal = input.parietal_output;
  return `## 用户输入
${input.raw_text}

## 顶叶意图分层
${parietal.intent_layers.map((l) => `  - [${l.layer}] ${l.intent} (置信度: ${l.confidence})`).join("\n")}

## 顶叶激活标记
级别: ${parietal.activation.level}
原因: ${parietal.activation.reason}

请快速生成 2-3 个预判方向。`;
}

function buildPhase2UserPrompt(input: FrontalInput): string {
  const temporal = input.temporal_output;
  const parietal = input.parietal_output;
  const hippocampus = input.hippocampus_results;

  return `## 用户输入
${input.raw_text}

## 颞叶语义分析
语义单元数: ${temporal?.semantic_units?.length || 0}
领域: ${temporal?.domain_classification?.domain?.primary || "未知"}
复杂度: ${temporal?.domain_classification?.complexity?.level || "未知"}
新颖度: ${temporal?.domain_classification?.novelty?.level || "未知"}

## 顶叶意图分层
${parietal.intent_layers.map((l) => `  - [${l.layer}] ${l.intent}`).join("\n")}

## 可用工具
${input.system_state.available_tools.join(", ") || "无特殊工具"}

## 相关记忆
${hippocampus.matched_memories?.slice(0, 3).map((m: any) => `  - ${m.content_summary}`).join("\n") || "无"}

请生成完整策略并评分。`;
}

function fallbackOutput(preJudgments: FrontalOutput["pre_judgments"]): FrontalOutput {
  return {
    pre_judgments: preJudgments,
    strategies: [
      {
        strategy_id: "fallback_default",
        tagline: "标准降级回复",
        target_intent_layer: "surface",
        execution_steps: [
          {
            step: 1,
            action: "基于已知信息给出通用回答",
            tool_needed: null,
            expected_output: "通用回答",
            fallback_if_failed: "请用户澄清",
          },
        ],
        resources: {
          tools: [],
          knowledge_domains: [],
          estimated_time: "立即",
          external_dependencies: [],
        },
        success_criteria: ["用户收到回复"],
        fail_conditions: ["用户不满意"],
        verified_assumptions: [],
        unverified_assumptions: ["语义分析失败"],
        scores: {
          feasibility: 5,
          fit: 4,
          risk: 8,
          efficiency: 6,
          weighted_total: 5.5,
        },
      },
    ],
    recommendation: {
      primary_strategy_id: "fallback_default",
      secondary_strategy_id: "fallback_default",
      need_clarification: true,
      clarification_questions: ["能否请您更详细地描述您的需求？"],
      confidence: 0.2,
    },
  };
}
