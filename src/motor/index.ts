// ============================================================
// 运动皮层 — 执行产出
// 对应文档: ARCHITECTURE.md Section 3 #11
// 支持新旧 HermesOutput Schema
// ============================================================

import { HermesOutput } from "../types";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.motor;

export interface MotorAction {
  type: "reply" | "tool_call" | "ask_user" | "decline" | "search" | "defer";
  payload: any;
}

/**
 * 将 Hermes 收束结果转换为可执行动作
 * 兼容新旧 Schema
 */
export function planActions(output: HermesOutput): MotorAction[] {
  const actions: MotorAction[] = [];

  // 兼容新旧 action 字段
  const actionDecision = output.action_decision || output.actionDecision || "ANSWER";
  const finalResponse = output.final_response || output.finalResponse || "";
  const responseTone = output.response_tone?.primary || output.tone || "neutral";
  const confidence = output.action_confidence ?? output.confidence ?? 0.5;
  const uncertaintyMarkers = output.uncertainty_markers || output.uncertaintyMarkers || [];
  const citations = output.citations || [];

  switch (actionDecision) {
    case "ANSWER":
      actions.push({
        type: "reply",
        payload: {
          content: finalResponse,
          tone: responseTone,
          confidence,
          uncertaintyMarkers,
          citations,
        },
      });
      break;

    case "SEARCH_FIRST":
      actions.push({
        type: "search",
        payload: { query: finalResponse },
      });
      break;

    case "ASK_CLARIFICATION":
      actions.push({
        type: "ask_user",
        payload: {
          message: finalResponse,
          questions: output.clarification_questions,
          uncertaintyMarkers,
        },
      });
      break;

    case "DECLINE":
      actions.push({
        type: "decline",
        payload: {
          message: finalResponse,
          reason: uncertaintyMarkers,
        },
      });
      break;

    case "DEFER":
      actions.push({
        type: "defer",
        payload: {
          message: finalResponse || "此任务已标记为需要转交处理",
          note: uncertaintyMarkers,
        },
      });
      break;

    case "ACKNOWLEDGE_UNCERTAINTY" as any:
      // 旧 action，向后兼容
      actions.push({
        type: "reply",
        payload: {
          content: finalResponse,
          tone: responseTone,
          confidence,
          uncertaintyMarkers,
          citations,
        },
      });
      break;

    default:
      actions.push({
        type: "reply",
        payload: { content: finalResponse },
      });
  }

  return actions;
}

/**
 * 执行动作（返回给用户的消息）
 */
export function executeReply(action: MotorAction): {
  content: string;
  metadata: Record<string, any>;
} {
  if (action.type === "reply") {
    const meta: Record<string, any> = {
      confidence: action.payload.confidence,
      tone: action.payload.tone,
    };

    if (action.payload.uncertaintyMarkers?.length > 0) {
      meta.uncertainties = action.payload.uncertaintyMarkers;
    }

    return { content: action.payload.content, metadata: meta };
  }

  if (action.type === "ask_user") {
    return {
      content: action.payload.message,
      metadata: { type: "clarification", questions: action.payload.questions },
    };
  }

  if (action.type === "decline") {
    return {
      content: action.payload.message,
      metadata: { type: "decline", reason: action.payload.reason },
    };
  }

  if (action.type === "defer") {
    return {
      content: action.payload.message,
      metadata: { type: "defer", note: action.payload.note },
    };
  }

  if (action.type === "search") {
    return {
      content: `正在进行搜索: ${action.payload.query}`,
      metadata: { type: "search", query: action.payload.query },
    };
  }

  return { content: "无法处理此请求", metadata: {} };
}
