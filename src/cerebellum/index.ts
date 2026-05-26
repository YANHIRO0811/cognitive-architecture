// ============================================================
// 小脑（Cerebellum）— 三向优化器 + 技能追踪
// 对应文档: 08-dynamic-orchestration.md Section 三
// ============================================================

import { CapabilityContract } from "../types";
import { MODE_WEIGHTS } from "../config/mode-weights";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.cerebellum;

// ---- 技能追踪器 ----

interface SkillTracker {
  name: string;
  successCount: number;
  failureCount: number;
  avgLatency: number;
  errorPatterns: string[];
  lastOptimized: number;
}

// ---- 观测记录 ----

interface RegionObservation {
  region: string;
  skill: string;
  success: boolean;
  latencyMs: number;
  timestamp: number;
}

// ---- 三向优化：调权 ----

class WeightOptimizer {
  private observationWindow: Map<string, RegionObservation[]> = new Map();
  private initialWeights: Record<string, Record<string, number>>;

  constructor(initialWeights: Record<string, Record<string, number>>) {
    this.initialWeights = JSON.parse(JSON.stringify(initialWeights));
  }

  observe(region: string, skill: string, success: boolean, latencyMs: number) {
    const window = this.observationWindow.get(region) || [];
    window.push({ region, skill, success, latencyMs, timestamp: Date.now() });
    if (window.length > 100) window.shift();
    this.observationWindow.set(region, window);
  }

  adjustModeWeights(
    currentWeights: Record<string, Record<string, number>>
  ): Record<string, Record<string, number>> {
    const newWeights = JSON.parse(JSON.stringify(currentWeights));

    for (const [region, observations] of this.observationWindow.entries()) {
      const recent = observations.slice(-50).filter((o) => o.skill !== undefined);
      if (recent.length < 10) continue;

      const successRate = recent.filter((o) => o.success).length / recent.length;

      for (const [mode, regionWeights] of Object.entries(newWeights) as [string, Record<string, number>][]) {
        if (!(region in regionWeights)) continue;

        const currentWeight = regionWeights[region];
        const adjustment = this.computeAdjustment(currentWeight, successRate);
        regionWeights[region] = clamp(currentWeight + adjustment, 0, 1);
      }
    }

    return newWeights;
  }

  private computeAdjustment(currentWeight: number, successRate: number): number {
    if (successRate > 0.8) return 0.03 * (1 - currentWeight);
    if (successRate < 0.4) return -0.03 * currentWeight;
    return 0;
  }
}

// ---- 三向优化：正反馈防护 ----

class AntiFeedbackLoop {
  private cooldownTimers: Map<string, number> = new Map();

  canAdjust(region: string, interactionCount: number): boolean {
    const lastAdjustment = this.cooldownTimers.get(region) ?? -Infinity;
    return (interactionCount - lastAdjustment) >= 20;
  }

  markAdjusted(region: string, interactionCount: number) {
    this.cooldownTimers.set(region, interactionCount);
  }

  applyRegressionSpring(
    currentWeights: Record<string, Record<string, number>>,
    initialWeights: Record<string, Record<string, number>>,
    interactionCount: number
  ): Record<string, Record<string, number>> {
    if (interactionCount % 50 !== 0) return currentWeights;

    const regressed = JSON.parse(JSON.stringify(currentWeights));
    for (const [mode, regionWeights] of Object.entries(regressed) as [string, Record<string, number>][]) {
      for (const region of Object.keys(regionWeights)) {
        const current = regionWeights[region];
        const initial = initialWeights[mode]?.[region] ?? 0;
        if (current === undefined || initial === undefined) continue;
        regressed[mode][region] = current + (initial - current) * 0.1;
      }
    }
    return regressed;
  }

  clampWeights(weights: Record<string, number>): Record<string, number> {
    const clamped: Record<string, number> = {};
    for (const [region, w] of Object.entries(weights)) {
      clamped[region] = clamp(w, 0.05, 0.95);
    }
    return clamped;
  }
}

// ---- 三向优化：调人（冷却管理）----

class CooldownManager {
  private cooldowns: Map<string, number> = new Map();
  private attempts: Map<string, number> = new Map();

  recordAttempt(region: string) {
    this.attempts.set(region, (this.attempts.get(region) || 0) + 1);
  }

  shouldCoolDown(contract: CapabilityContract): boolean {
    return (
      contract.health.timeout_ratio > 0.3 ||
      (contract.health.recent_success_rate < 0.2 && (this.attempts.get(contract.region) || 0) >= 10)
    );
  }

  applyCooldown(region: string, timeoutRatio: number) {
    const durationMs = Math.min(timeoutRatio * 300 * 1000, 300000); // max 300s
    this.cooldowns.set(region, Date.now() + durationMs);
  }

  isCoolingDown(region: string): boolean {
    return (this.cooldowns.get(region) ?? 0) > Date.now();
  }
}

// ---- 三向优化：调时----

class TimeoutOptimizer {
  private latencies: Map<string, number[]> = new Map();

  record(region: string, actualLatencyMs: number) {
    const history = this.latencies.get(region) || [];
    history.push(actualLatencyMs);
    if (history.length > 100) history.shift();
    this.latencies.set(region, history);
  }

  adjustTimeouts(
    currentTimeouts: Record<string, number>,
    baselineTimeouts: Record<string, number>,
    regions: string[]
  ): Record<string, number> {
    const newTimeouts = { ...currentTimeouts };

    for (const region of regions) {
      const history = this.latencies.get(region);
      if (!history || history.length < 20) continue;

      const sorted = [...history].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const baseline = baselineTimeouts[region];
      const current = currentTimeouts[region];

      if (!baseline || !current) continue;

      if (p95 > current * 0.8) {
        newTimeouts[region] = Math.min(current * 1.15, baseline * 1.5);
      } else if (p50 < current * 0.3) {
        newTimeouts[region] = Math.max(current * 0.9, baseline * 0.5);
      }
    }

    return newTimeouts;
  }
}

// ============================================================
// 小脑主类
// ============================================================

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export class Cerebellum {
  // 技能追踪
  private skills: Map<string, SkillTracker> = new Map();
  private optimizationHistory: Array<{
    skill: string;
    originalPrompt: string;
    optimizedPrompt: string;
    reason: string;
    timestamp: number;
  }> = [];

  // 三向优化器
  private weightOptimizer: WeightOptimizer;
  private antiLoop: AntiFeedbackLoop;
  private cooldownManager: CooldownManager;
  private timeoutOptimizer: TimeoutOptimizer;

  // 权重状态
  private currentWeights: Record<string, Record<string, number>>;
  private baselineTimeouts: Record<string, number>;
  private currentTimeouts: Record<string, number>;
  private interactionCount = 0;

  constructor(
    initialWeights?: Record<string, Record<string, number>>,
    baselineTimeouts?: Record<string, number>
  ) {
    const skillNames = [
      "reasoning", "coding", "writing", "teaching", "analysis", "creative", "conversation",
    ];
    for (const name of skillNames) {
      this.skills.set(name, {
        name,
        successCount: 0,
        failureCount: 0,
        avgLatency: 0,
        errorPatterns: [],
        lastOptimized: 0,
      });
    }

    this.currentWeights = initialWeights || MODE_WEIGHTS as any;
    this.weightOptimizer = new WeightOptimizer(this.currentWeights);
    this.antiLoop = new AntiFeedbackLoop();
    this.cooldownManager = new CooldownManager();
    this.timeoutOptimizer = new TimeoutOptimizer();

    this.baselineTimeouts = baselineTimeouts || {};
    this.currentTimeouts = { ...this.baselineTimeouts };
  }

  /** 每轮交互后调用：记录执行结果 + 触发定期优化 */
  postInteraction(
    regions: Array<{
      name: string;
      skill: string;
      success: boolean;
      latencyMs: number;
      error?: string;
    }>,
    userInput: string,
    response: string
  ): void {
    this.interactionCount++;

    for (const r of regions) {
      // 观测
      this.weightOptimizer.observe(r.name, r.skill, r.success, r.latencyMs);
      this.timeoutOptimizer.record(r.name, r.latencyMs);
      this.cooldownManager.recordAttempt(r.name);

      // 更新契约健康
      const contract = REGION_CONTRACTS[r.name];
      if (contract) {
        const prevRate = contract.health.recent_success_rate;
        const n = Math.min(this.interactionCount, 50);
        contract.health.recent_success_rate = (prevRate * (n - 1) + (r.success ? 1 : 0)) / n;
        contract.health.avg_latency_ms = contract.health.avg_latency_ms * 0.9 + r.latencyMs * 0.1;
        contract.health.timeout_ratio = 1 - contract.health.recent_success_rate;
        contract.health.last_healthy_check = new Date().toISOString();

        // 冷却管理
        if (this.cooldownManager.shouldCoolDown(contract)) {
          this.cooldownManager.applyCooldown(r.name, contract.health.timeout_ratio);
        }
      }

      // 技能记录
      this.recordExecution(r.skill, r.success, r.latencyMs, r.error);
    }

    // 每 10 次交互：调权
    if (this.interactionCount % 10 === 0) {
      this.adjustWeights();
    }

    // 每 20 次交互：调时
    if (this.interactionCount % 20 === 0) {
      this.adjustTimeouts();
    }

    // 每 50 次交互：回归弹簧
    if (this.interactionCount % 50 === 0) {
      this.applyRegressionSpring();
    }
  }

  private adjustWeights(): void {
    // 只对可调整的脑区调权
    const adjustableRegions = Object.keys(REGION_CONTRACTS).filter((r) =>
      this.antiLoop.canAdjust(r, this.interactionCount)
    );

    for (const region of adjustableRegions) {
      this.antiLoop.markAdjusted(region, this.interactionCount);
    }

    const newWeights = this.weightOptimizer.adjustModeWeights(this.currentWeights);

    // 应用上限锁
    for (const [mode, regionWeights] of Object.entries(newWeights)) {
      newWeights[mode] = this.antiLoop.clampWeights(regionWeights);
    }

    this.currentWeights = newWeights;
  }

  private adjustTimeouts(): void {
    const regions = Object.keys(this.currentTimeouts);
    this.currentTimeouts = this.timeoutOptimizer.adjustTimeouts(
      this.currentTimeouts,
      this.baselineTimeouts,
      regions
    );
  }

  private applyRegressionSpring(): void {
    this.currentWeights = this.antiLoop.applyRegressionSpring(
      this.currentWeights,
      this.weightOptimizer["initialWeights"],
      this.interactionCount
    );
  }

  /** 获取当前权重（供丘脑使用） */
  getCurrentWeights(): Record<string, Record<string, number>> {
    return JSON.parse(JSON.stringify(this.currentWeights));
  }

  /** 获取当前超时配置 */
  getCurrentTimeouts(): Record<string, number> {
    return { ...this.currentTimeouts };
  }

  /** 检查脑区是否在冷却中 */
  isCoolingDown(region: string): boolean {
    return this.cooldownManager.isCoolingDown(region);
  }

  /** 记录技能执行结果 */
  recordExecution(skill: string, success: boolean, latencyMs: number, error?: string): void {
    const tracker = this.skills.get(skill);
    if (!tracker) return;

    if (success) {
      tracker.successCount++;
    } else {
      tracker.failureCount++;
      if (error && !tracker.errorPatterns.includes(error)) {
        tracker.errorPatterns.push(error);
      }
    }

    tracker.avgLatency = tracker.avgLatency * 0.9 + latencyMs * 0.1;
  }

  /** 分析错误模式 */
  analyzeErrors(skill: string): string[] {
    const tracker = this.skills.get(skill);
    return tracker?.errorPatterns || [];
  }

  /** 优化 Prompt */
  optimizePrompt(skill: string, currentPrompt: string, errorPatterns: string[]): string {
    if (errorPatterns.length === 0) return currentPrompt;

    let optimized = currentPrompt;
    const errorText = errorPatterns.join(" ").toLowerCase();

    if (errorText.includes("parsing") || errorText.includes("json")) {
      optimized += "\n\n## 额外约束\n- 必须确保输出是合法 JSON 格式\n- 所有字符串值必须使用双引号";
    }
    if (errorText.includes("timeout") || errorText.includes("slow")) {
      optimized += "\n\n## 性能约束\n- 输出应简洁，控制在合理长度内\n- 优先输出核心结论，细节放在次要位置";
    }
    if (errorText.includes("irrelevant") || errorText.includes("off-topic")) {
      optimized += "\n\n## 相关性约束\n- 所有输出必须与用户问题直接相关\n- 避免发散到无关话题";
    }

    this.optimizationHistory.push({
      skill,
      originalPrompt: currentPrompt,
      optimizedPrompt: optimized,
      reason: errorPatterns.join("; "),
      timestamp: Date.now(),
    });

    const tracker = this.skills.get(skill);
    if (tracker) {
      tracker.errorPatterns = [];
      tracker.lastOptimized = Date.now();
    }

    return optimized;
  }

  /** 获取所有技能的健康状态 */
  getSkillHealth(): Record<string, { successRate: number; needsOptimization: boolean }> {
    const result: Record<string, any> = {};
    for (const [name, tracker] of this.skills) {
      const total = tracker.successCount + tracker.failureCount;
      const successRate = total > 0 ? tracker.successCount / total : 1;
      result[name] = {
        successRate: Math.round(successRate * 100) / 100,
        needsOptimization:
          tracker.errorPatterns.length > 3 &&
          Date.now() - tracker.lastOptimized > 3600000,
      };
    }
    return result;
  }

  /** 获取权重优化状态报告 */
  getOptimizerReport(): Record<string, any> {
    return {
      interactionCount: this.interactionCount,
      weights: this.currentWeights,
      timeouts: this.currentTimeouts,
      skillHealth: this.getSkillHealth(),
    };
  }
}
