// ============================================================
// 基底节（Basal Ganglia）— Q-Learning 强化学习
// 对应文档: ARCHITECTURE.md Section 11.1
// ============================================================

import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.bg;

interface QEntry {
  state: string;
  action: string;
  qValue: number;
  visitCount: number;
  lastUpdated: number;
}

export interface RLReward {
  userSatisfaction: number;   // -1 to 1 (点赞=1, 无反馈=0, 点踩=-1)
  responseLatency: number;    // 响应延迟（ms）
  confidence: number;         // Hermes 置信度 0-1
  conflictCount: number;      // 冲突数量（越少越好）
}

export class BasalGanglia {
  private qTable: Map<string, QEntry> = new Map();
  private learningRate = 0.1;
  private discountFactor = 0.9;
  private epsilon = 0.1; // 探索率

  /** 将状态编码为字符串 key */
  private encodeState(state: Record<string, any>): string {
    return JSON.stringify(state);
  }

  /** 选择动作（epsilon-greedy） */
  selectAction(state: Record<string, any>, actions: string[]): string {
    const stateKey = this.encodeState(state);

    if (Math.random() < this.epsilon) {
      // 探索：随机选择
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // 利用：选 Q 值最高的
    let bestAction = actions[0];
    let bestQ = -Infinity;

    for (const action of actions) {
      const key = `${stateKey}:${action}`;
      const entry = this.qTable.get(key);
      const qValue = entry?.qValue ?? 0;
      if (qValue > bestQ) {
        bestQ = qValue;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /** Q-Learning 更新 */
  learn(
    state: Record<string, any>,
    action: string,
    reward: number,
    nextState: Record<string, any>,
    nextActions: string[]
  ): void {
    const stateKey = this.encodeState(state);
    const key = `${stateKey}:${action}`;
    const entry = this.qTable.get(key) || {
      state: stateKey,
      action,
      qValue: 0,
      visitCount: 0,
      lastUpdated: Date.now(),
    };

    // 计算下一个状态的最大 Q 值
    let maxNextQ = 0;
    for (const na of nextActions) {
      const nextKey = `${this.encodeState(nextState)}:${na}`;
      const nextEntry = this.qTable.get(nextKey);
      if (nextEntry && nextEntry.qValue > maxNextQ) {
        maxNextQ = nextEntry.qValue;
      }
    }

    // Q-Learning 更新公式
    entry.qValue =
      entry.qValue +
      this.learningRate * (reward + this.discountFactor * maxNextQ - entry.qValue);
    entry.visitCount++;
    entry.lastUpdated = Date.now();

    this.qTable.set(key, entry);
  }

  /** 综合奖励信号计算 */
  computeReward(rl: RLReward): number {
    let reward = 0;

    // 用户满意度（权重最高）
    reward += rl.userSatisfaction * 0.4;

    // 响应速度（越慢扣分越多）
    const latencyScore = Math.max(0, 1 - rl.responseLatency / 10000);
    reward += latencyScore * 0.2;

    // 置信度
    reward += rl.confidence * 0.25;

    // 冲突数量（少冲突 = 高奖励）
    const conflictScore = Math.max(0, 1 - rl.conflictCount * 0.2);
    reward += conflictScore * 0.15;

    return reward;
  }

  /** 获取统计信息 */
  getStats(): { totalEntries: number; averageQ: number } {
    let totalQ = 0;
    for (const entry of this.qTable.values()) {
      totalQ += entry.qValue;
    }
    return {
      totalEntries: this.qTable.size,
      averageQ: this.qTable.size > 0 ? totalQ / this.qTable.size : 0,
    };
  }
}
