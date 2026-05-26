// ============================================================
// 颞叶（Temporal Lobe）— 语义识别实现
// ============================================================

import { TemporalInput, TemporalOutput } from "../types";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.temporal;
import { config } from "../config";
import { llmCall, parseLlmJson } from "../config/llm";
import { TEMPORAL_SYSTEM_PROMPT } from "./prompts";

function buildUserPrompt(input: TemporalInput): string {
  const guidance = input.parietal_guidance;
  const memory = input.hippocampus_results;

  return `## 用户输入
${input.raw_text}

## 顶叶注意力指引
主焦点段落: ${guidance.attention_allocation.primary_focus.segments.join(" | ")}
次要上下文: ${guidance.attention_allocation.secondary_context.segments.join(" | ")}
噪声区域: ${guidance.attention_allocation.noise.segments.join(" | ")}

意图层次:
${guidance.intent_layers.map((l) => `  - [${l.layer}] ${l.intent} (置信度: ${l.confidence})`).join("\n")}

## 海马体记忆检索结果
${
  memory.matched_memories.length > 0
    ? memory.matched_memories
        .map((m) => `  - [相似度: ${m.similarity.toFixed(2)}] ${m.content_summary}`)
        .join("\n")
    : "  未找到相关记忆"
}

请基于注意力指引深度分析主焦点区域，输出 JSON。`;
}

export async function temporalProcess(input: TemporalInput): Promise<TemporalOutput> {
  const raw = await llmCall({
    systemPrompt: TEMPORAL_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(input),
    temperature: 0.3,
    maxTokens: 2048,
    timeoutMs: config.salience.perRegionTimeout.temporal,
    responseFormat: "json_object",
  });

  try {
    return parseLlmJson(raw) as TemporalOutput;
  } catch (e) {
    console.warn("[Temporal] LLM 返回解析失败", e);
    return {
      semantic_units: [
        {
          unit_id: "fallback_1",
          text_segment: input.raw_text.slice(0, 100),
          type: "DECLARATIVE",
          confidence: 0.3,
        },
      ],
      domain_classification: {
        domain: { primary: "daily_life", confidence: 0.3, alternatives: [] },
        complexity: { level: "medium", reason: "降级处理" },
        novelty: { level: "novel", known_unknowns: ["解析失败"] },
        modality: "text_only",
        language: { primary: "zh" },
      },
      entity_graph: { nodes: [], edges: [] },
      memory_linkage: { linked_memories: [], additional_search_requests: [] },
      meta: {
        processing_time_ms: 0,
        primary_focus_processed: false,
        noise_skipped: false,
        confidence_overall: 0.1,
      },
    };
  }
}
