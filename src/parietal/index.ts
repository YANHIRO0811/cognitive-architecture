// ============================================================
// 顶叶（Parietal Lobe）— 注意力分配实现
// ============================================================

import { ParietalInput, ParietalOutput, ActivationLevel } from "../types";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.parietal;
import { config } from "../config";
import { llmCall, parseLlmJson } from "../config/llm";
import { PARIETAL_SYSTEM_PROMPT, PARIETAL_FAST_PATH_THRESHOLD } from "./prompts";

// ---- 规则引擎快速通道 ----

function fastPath(input: ParietalInput): ParietalOutput {
  const text = input.raw_text;
  const words = text.split(/\s+/);

  // 简单 NER（关键词匹配）
  const entities: ParietalOutput["explicit_info"]["entities"] = [];

  // 检测 URL
  const urlRegex = /https?:\/\/\S+/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    entities.push({ name: match[0], type: "url", weight: 1.0 });
  }

  // 检测日期
  const dateRegex = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/g;
  while ((match = dateRegex.exec(text)) !== null) {
    entities.push({ name: match[0], type: "date", weight: 0.6 });
  }

  // 检测数字
  const numRegex = /\d+\.?\d*/g;
  const nums = text.match(numRegex);
  if (nums && nums.length <= 5) {
    for (const n of nums) {
      if (/^\d{4,}$/.test(n) || /^\d+\.\d+$/.test(n)) {
        entities.push({ name: n, type: "number", weight: 0.6 });
      }
    }
  }

  const hasQuestion = text.includes("?") || text.includes("？");
  const hasInstruction = /^[你请帮麻烦]/.test(text) || words.length < 10;

  return {
    explicit_info: {
      entities,
      structural_features: {
        has_instruction: hasInstruction,
        has_question: hasQuestion,
        has_data: nums !== null,
        has_emotion: /[!！]{2,}|急|气|开心|难过/.test(text),
        input_length: text.length < 30 ? "short" : text.length < 100 ? "medium" : "long",
      },
    },
    implicit_info: {
      missing_context: [],
      hidden_assumptions: [],
      ambiguity_points: [],
      intent_layers: [
        {
          layer: "surface",
          intent: hasQuestion ? "用户提问" : "用户指令",
          confidence: 0.8,
        },
      ],
    },
    attention_allocation: {
      total_budget: 100,
      primary_focus: { segments: [text], budget: 60 },
      secondary_context: { segments: [], budget: 25 },
      noise: { segments: [], budget: 15 },
    },
    activation: {
      level: "FOCUS" as ActivationLevel,
      reason: "短输入，规则引擎处理",
      escalation: false,
    },
    memory_query: {
      keywords: words.slice(0, 5),
      estimated_relevance: "low",
      query_time_window: "last_7_days",
    },
  };
}

// ---- LLM 完整通路 ----

function buildUserPrompt(input: ParietalInput): string {
  const amygdala = input.amygdala_result;
  return `## 用户输入
${input.raw_text}

## 杏仁核安全评估
威胁等级: ${amygdala.level}
威胁类型: ${amygdala.threat_type || "无"}
操作指令: ${amygdala.action}

## 上下文
最近话题: ${input.context.recent_topics.join(" / ") || "无"}
用户摘要: ${input.context.user_profile_summary || "未知"}

请分析并输出 JSON。`;
}

export async function parietalProcess(input: ParietalInput): Promise<ParietalOutput> {
  // 快速通道
  if (
    config.fastPath.enabled &&
    input.raw_text.length <= PARIETAL_FAST_PATH_THRESHOLD
  ) {
    return fastPath(input);
  }

  const raw = await llmCall({
    systemPrompt: PARIETAL_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(input),
    temperature: 0.1,
    maxTokens: 1024,
    timeoutMs: config.salience.perRegionTimeout.parietal,
    responseFormat: "json_object",
  });

  try {
    return parseLlmJson(raw) as ParietalOutput;
  } catch (e) {
    console.warn("[Parietal] LLM 返回解析失败，降级到快速通道", e);
    return fastPath(input);
  }
}
