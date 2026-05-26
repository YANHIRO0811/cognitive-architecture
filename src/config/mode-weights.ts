// ============================================================
// 5 模式 × 14 脑区权重矩阵
// 突显网络依据此矩阵动态分配认知资源
// ============================================================

import { CognitiveMode, RegionId } from "../types";

type ModeWeights = Record<CognitiveMode, Partial<Record<RegionId, number>>>;

export const MODE_WEIGHTS: ModeWeights = {
  CEN: {
    frontal: 1.0,
    parietal: 0.5,
    temporal: 0.7,
    hippocampus: 0.8,
    cerebellum: 0.5,
    bg: 0.6,
    dmn: 0.1,
  },

  DMN: {
    frontal: 0.2,
    dmn: 1.0,
    hippocampus: 0.9,
    amygdala: 0.3,
    cerebellum: 0.4,
  },

  EMERGENCY: {
    amygdala: 1.0,
    frontal: 0.8,
    hippocampus: 0.7,
    temporal: 0.6,
    dmn: 0.0,
    cerebellum: 0.0,
    bg: 0.0,
  },

  CREATIVE: {
    frontal: 0.4,
    dmn: 0.9,
    temporal: 0.8,
    hippocampus: 0.7,
    parietal: 0.6,
  },

  TEACHING: {
    frontal: 0.9,
    temporal: 0.8,
    hippocampus: 0.8,
    cerebellum: 0.5,
    dmn: 0.4,
  },
};

/** 获取指定模式下某脑区的权重 */
export function getRegionWeight(mode: CognitiveMode, regionId: RegionId): number {
  return MODE_WEIGHTS[mode]?.[regionId] ?? 0;
}

/** 获取指定模式下所有权重大于阈值的脑区列表 */
export function getActiveRegions(mode: CognitiveMode, threshold = 0.1): RegionId[] {
  const weights = MODE_WEIGHTS[mode];
  if (!weights) return [];
  return (Object.entries(weights) as [RegionId, number][])
    .filter(([_, w]) => w >= threshold)
    .map(([r]) => r);
}
