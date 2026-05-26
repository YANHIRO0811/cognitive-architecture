// ============================================================
// 丘脑 — 路由分拣器 + 动态竞标
// 对应文档: 08-dynamic-orchestration.md Section 二
// ============================================================

import {
  AmygdalaSignal,
  BidResult,
  CapabilityContract,
  CognitiveMode,
  RegionActivation,
  RegionId,
  Skill,
  ThalamusDecision,
} from "../types";
import { getRegionWeight } from "../config/mode-weights";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.thalamus;

// ---- 动态竞标类 ----

/**
 * 推断任务所需技能
 * 基于分类结果映射
 */
function inferRequiredSkills(domain: string, complexity: string): Skill[] {
  const skillMap: Record<string, Skill[]> = {
    code: ["strategy_generation", "semantic_decomposition", "domain_classification"],
    academic: ["semantic_decomposition", "domain_classification", "novelty_assessment", "strategy_generation"],
    creative: ["strategy_generation", "novelty_assessment", "semantic_decomposition"],
    daily: ["intent_extraction", "semantic_decomposition"],
    emergency: ["threat_detection", "intent_extraction", "attention_allocation"],
  };
  return skillMap[domain] || ["intent_extraction", "semantic_decomposition"];
}

export function validateActivation(
  region: CapabilityContract,
  neededSkills: Skill[]
): { pass: boolean; reason?: string } {
  // 1. 禁区检查
  for (const skill of neededSkills) {
    if (region.blacklist.includes(skill)) {
      return { pass: false, reason: `技能 ${skill} 在 ${region.region} 的禁区列表` };
    }
    if (region.cannot.includes(skill)) {
      return { pass: false, reason: `${region.region} 不能执行 ${skill}` };
    }
  }

  // 2. 健康检查
  if (region.health.recent_success_rate < 0.5) {
    return { pass: false, reason: `${region.region} 近期成功率 ${region.health.recent_success_rate} < 0.5` };
  }

  // 3. 超时检查
  if (region.health.timeout_ratio > 0.3) {
    return { pass: false, reason: `${region.region} 超时率 ${region.health.timeout_ratio} > 0.3，进入冷却` };
  }

  return { pass: true };
}

export class ThalamusAuction {
  private contracts: Record<string, CapabilityContract>;

  constructor(contracts?: Record<string, CapabilityContract>) {
    this.contracts = contracts || REGION_CONTRACTS;
  }

  auction(
    mode: CognitiveMode,
    domain: string,
    complexity: string,
    totalBudget: number,
    activationThreshold: number = 0.15
  ): BidResult[] {
    const neededSkills = inferRequiredSkills(domain, complexity);
    const bids: BidResult[] = [];
    const modeStr = mode as string;

    for (const [regionName, contract] of Object.entries(this.contracts)) {
      // 跳过不能竞标的脑区
      if (["hermes", "amygdala", "motor", "salience", "thalamus", "bg", "dmn"].includes(regionName)) {
        // 这些脑区有特殊调度逻辑，不参与竞标
        continue;
      }

      // 能力校验
      const validation = validateActivation(contract, neededSkills);
      if (!validation.pass) {
        bids.push({
          region: regionName,
          base_weight: 0,
          capability_match: 0,
          health_factor: 0,
          final_bid: 0,
          activation: false,
          budget: 0,
        });
        continue;
      }

      // 三轮系数
      const base = getRegionWeight(mode, regionName as RegionId) || 0;
      const cap = this.computeCapabilityMatch(contract, neededSkills);
      const health = contract.health.recent_success_rate * (1 - contract.health.timeout_ratio);
      const finalBid = base * cap * Math.max(health, 0.1);

      bids.push({
        region: regionName,
        base_weight: base,
        capability_match: cap,
        health_factor: health,
        final_bid: finalBid,
        activation: finalBid >= activationThreshold,
        budget: 0,
      });
    }

    // 按最终出价分配预算
    const activeBids = bids.filter((b) => b.activation);
    const totalBid = activeBids.reduce((sum, b) => sum + b.final_bid, 0);
    for (const bid of activeBids) {
      bid.budget = totalBid > 0 ? Math.round((bid.final_bid / totalBid) * totalBudget) : 0;
    }

    return bids;
  }

  private computeCapabilityMatch(contract: CapabilityContract, neededSkills: Skill[]): number {
    if (neededSkills.length === 0) return 0.5;

    let score = 0;
    for (const skill of neededSkills) {
      if (contract.prefers.includes(skill)) score += 1.0;
      else if (contract.can.includes(skill)) score += 0.7;
      else if (contract.cannot.includes(skill)) score -= 1.0;
    }
    return Math.max(0, score / neededSkills.length);
  }
}

// ---- 输入分类 ----

interface InputClassification {
  complexity: "low" | "medium" | "high";
  domain: "code" | "academic" | "creative" | "daily" | "emergency";
  urgency: "low" | "normal" | "high";
  modality: "text" | "image" | "mixed";
}

function classifyInput(input: string, amygdala: AmygdalaSignal): InputClassification {
  const len = input.length;

  let complexity: InputClassification["complexity"] = "medium";
  if (len < 50) complexity = "low";
  else if (len > 500) complexity = "high";

  let domain: InputClassification["domain"] = "daily";
  const codeKeywords = /代码|编程|函数|bug|API|接口|算法|python|typescript|react|数据库/i;
  const academicKeywords = /论文|研究|理论|分析|数据|统计|实验|学术/i;
  const creativeKeywords = /创意|设计|故事|诗歌|音乐|艺术|生成|灵感/i;
  const emergencyKeywords = /紧急|立刻|马上|救命|危险|报警|事故/i;

  if (emergencyKeywords.test(input)) domain = "emergency";
  else if (codeKeywords.test(input)) domain = "code";
  else if (academicKeywords.test(input)) domain = "academic";
  else if (creativeKeywords.test(input)) domain = "creative";

  let urgency: InputClassification["urgency"] = "normal";
  if (amygdala.level === "CRITICAL" || domain === "emergency") urgency = "high";
  else if (amygdala.level === "WARNING") urgency = "high";

  return { complexity, domain, urgency, modality: "text" };
}

// ---- 模式选择 ----

function selectMode(classification: InputClassification, amygdala: AmygdalaSignal): CognitiveMode {
  if (amygdala.level === "CRITICAL") return CognitiveMode.EMERGENCY;
  if (amygdala.level === "WARNING") return CognitiveMode.EMERGENCY;
  if (classification.domain === "creative") return CognitiveMode.CREATIVE;
  if (classification.complexity === "high" && classification.domain === "academic") return CognitiveMode.TEACHING;
  if (classification.complexity === "low") return CognitiveMode.CEN;
  return CognitiveMode.CEN;
}

// ---- 主入口 ----

export function thalamusRoute(
  input: string,
  amygdalaSignal: AmygdalaSignal,
  auction?: ThalamusAuction
): ThalamusDecision {
  const classification = classifyInput(input, amygdalaSignal);
  const mode = selectMode(classification, amygdalaSignal);

  const budgetMap: Record<string, number> = {
    low: 3000,
    medium: 8000,
    high: 15000,
  };
  const totalBudget = budgetMap[classification.complexity] || 8000;

  // 动态竞标
  const auctioneer = auction || new ThalamusAuction();
  const bidResults = auctioneer.auction(mode, classification.domain, classification.complexity, totalBudget);

  // 转换为 RegionActivation
  const activations: RegionActivation[] = bidResults
    .filter((b) => b.activation)
    .map((b) => ({
      regionId: b.region as RegionId,
      weight: b.final_bid,
      budget: b.budget,
    }));

  return {
    mode,
    activatedRegions: activations.sort((a, b) => b.weight - a.weight),
    totalBudget,
    priority: classification.urgency === "high" ? "speed" : "balanced",
  };
}
