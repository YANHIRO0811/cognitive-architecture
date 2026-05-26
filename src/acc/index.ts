// ============================================================
// 扣带回（ACC）— 冲突监控
// 对应文档: ARCHITECTURE.md Section 3 #6
// ============================================================

import { ConflictReport } from "../types";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.acc;

interface RegionOutput {
  regionId: string;
  content: any;
  confidence: number;
}

/**
 * 检测多脑区输出之间的冲突
 * 目前基于规则引擎，后续升级为 HuggingFace NLI
 */
export function detectConflicts(
  regionOutputs: Record<string, RegionOutput>,
  frontalConflicts?: any[]
): ConflictReport {
  const conflicts: ConflictReport["conflicts"] = [];
  const regions = Object.values(regionOutputs);

  // 1. 置信度对比冲突
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const diff = Math.abs(regions[i].confidence - regions[j].confidence);
      if (diff > 0.5) {
        conflicts.push({
          region_a: regions[i].regionId,
          region_b: regions[j].regionId,
          conflict_type: "semantic",
          description: `置信度差异过大 (${regions[i].confidence.toFixed(2)} vs ${regions[j].confidence.toFixed(2)})`,
          severity: diff > 0.7 ? "critical" : "moderate",
          can_resolve: true,
          resolution: "优先采用高置信度脑区的输出",
        });
      }
    }
  }

  // 2. 额叶内部策略冲突
  if (frontalConflicts && frontalConflicts.length > 0) {
    for (const fc of frontalConflicts) {
      conflicts.push({
        region_a: "frontal",
        region_b: "frontal",
        conflict_type: "strategic",
        description: fc.conflict_point,
        severity: fc.severity,
        can_resolve: fc.severity !== "critical",
      });
    }
  }

  // 3. 计算共识度
  const confidences = regions.map((r) => r.confidence);
  const avgConfidence =
    confidences.reduce((a, b) => a + b, 0) / Math.max(confidences.length, 1);
  const consensusLevel = conflicts.length === 0 ? avgConfidence : Math.max(0, avgConfidence - conflicts.length * 0.1);

  return {
    conflicts,
    consensus_level: Math.min(1, consensusLevel),
  };
}

/** 判断是否有高风险冲突需要 Hermes 立即处理 */
export function hasCriticalConflicts(report: ConflictReport): boolean {
  return report.conflicts.some((c) => c.severity === "critical");
}
