// ============================================================
// LLM 客户端 — 统一模型调用接口
// 所有脑区共用 DeepSeek-V4-Pro API
// ============================================================

import OpenAI from "openai";
import { config } from "./index";

const client = new OpenAI({
  apiKey: config.llm.apiKey,
  baseURL: config.llm.baseUrl,
});

export interface LlmCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: "json_object" | "text";
}

export async function llmCall(options: LlmCallOptions): Promise<string> {
  // 不自行设置超时——超时由调度层 runWithTimeout 统一管理，避免双重竞态
  const response = await client.chat.completions.create({
    model: config.llm.model,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2048,
    response_format:
      options.responseFormat === "json_object"
        ? { type: "json_object" }
        : undefined,
  });

  return response.choices[0]?.message?.content || "";
}

/** 解析 LLM 返回的 JSON，自动清洗 markdown 包裹 */
export function parseLlmJson(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}
