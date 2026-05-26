// ============================================================
// 突显网络 — FSM + Event Loop 调度中枢
// 对应文档: 04-salience-network-fsm.md
// ============================================================

import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.salience;

import { FsmEvent, FsmState, FsmEventPayload } from "../types";
import { config } from "../config";

// ---- 状态转换表 ----

const STATE_TRANSITIONS: Record<FsmState, Partial<Record<FsmEvent, FsmState>>> = {
  IDLE: {
    [FsmEvent.NEW_INPUT]: FsmState.ALERTING,
    [FsmEvent.LEARNING_TICK]: FsmState.LEARNING,
  },
  ALERTING: {
    [FsmEvent.AMYGDALA_DONE]: FsmState.ROUTING,
    [FsmEvent.AMYGDALA_BLOCKED]: FsmState.IDLE,
  },
  ROUTING: {
    [FsmEvent.ROUTING_DONE]: FsmState.PROCESSING,
  },
  PROCESSING: {
    [FsmEvent.ALL_REGIONS_DONE]: FsmState.RESOLVING,
    [FsmEvent.PROCESSING_TIMEOUT]: FsmState.RESOLVING,
  },
  RESOLVING: {
    [FsmEvent.HERMES_DONE]: FsmState.EXECUTING,
  },
  EXECUTING: {
    [FsmEvent.EXECUTION_DONE]: FsmState.IDLE,
  },
  LEARNING: {
    [FsmEvent.LEARNING_TICK]: FsmState.IDLE,
  },
};

// ---- 状态机 ----

export class SalienceFSM {
  state: FsmState = FsmState.IDLE;
  private eventQueue: FsmEventPayload[] = [];
  private processingStartTime = 0;
  private transitionLog: string[] = [];

  /** 推送事件到队列 */
  pushEvent(event: FsmEventPayload): void {
    this.eventQueue.push(event);
  }

  /** 消耗当前所有事件，执行状态转换 */
  tick(): FsmState {
    const events = this.eventQueue.splice(0);
    for (const event of events) {
      const transitions = STATE_TRANSITIONS[this.state];
      const newState = transitions?.[event.type];
      if (newState && newState !== this.state) {
        this.transitionLog.push(
          `[Salience] ${this.state} --${event.type}--> ${newState}`
        );
        this.state = newState;

        if (this.state === FsmState.PROCESSING) {
          this.processingStartTime = Date.now();
        }
      }
    }

    // 超时检查
    if (this.state === FsmState.PROCESSING) {
      const elapsed = Date.now() - this.processingStartTime;
      if (elapsed > config.salience.processingTimeoutMs) {
        this.state = FsmState.RESOLVING;
        this.transitionLog.push(
          `[Salience] PROCESSING --timeout(${elapsed}ms)--> RESOLVING`
        );
      }
    }

    return this.state;
  }

  /** 获取转换日志（最近 50 条） */
  getLog(): string[] {
    return this.transitionLog.slice(-50);
  }

  /** 重置 */
  reset(): void {
    this.state = FsmState.IDLE;
    this.eventQueue = [];
    this.processingStartTime = 0;
    this.transitionLog = [];
  }
}

// ---- 调度指标 ----

export class SalienceMetrics {
  totalTicks = 0;
  avgTickDurationMs = 0;
  stateDistribution: Record<string, number> = {};
  regionTimeouts: Record<string, number> = {};
  fastPathHits = 0;
  degradationEvents = 0;

  recordTick(durationMs: number, state: FsmState): void {
    this.totalTicks++;
    this.avgTickDurationMs =
      (this.avgTickDurationMs * (this.totalTicks - 1) + durationMs) /
      this.totalTicks;
    this.stateDistribution[state] =
      (this.stateDistribution[state] || 0) + 1;
  }

  healthCheck(): string {
    const timeoutCount = Object.values(this.regionTimeouts).reduce(
      (a, b) => a + b,
      0
    );
    const timeoutRate = timeoutCount / Math.max(this.totalTicks, 1);
    if (timeoutRate > 0.1) return "WARNING: 脑区超时率 > 10%";
    if (this.degradationEvents > 5) return "WARNING: 降级事件过多";
    return "HEALTHY";
  }
}
