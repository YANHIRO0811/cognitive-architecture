// ============================================================
// 认知引擎 — Agent Loop 主控
// 按突显网络 FSM 状态编排全部 14 脑区
// ============================================================

import {
  FsmEvent,
  FsmEventPayload,
  FsmState,
  CognitiveMode,
  ActivationLevel,
  AmygdalaSignal,
  ThalamusDecision,
  ParietalInput,
  ParietalOutput,
  TemporalInput,
  TemporalOutput,
  FrontalInput,
  FrontalOutput,
  HermesInput,
  HermesOutput,
  ConflictReport,
  MemoryQuery,
  MemoryResult,
} from "./types";
import { config } from "./config";
import { SalienceFSM, SalienceMetrics } from "./salience/fsm";
import { amygdalaCheck } from "./amygdala";
import { thalamusRoute } from "./thalamus";
import { parietalProcess } from "./parietal";
import { temporalProcess } from "./temporal";
import { frontalProcess, frontalPhase1 } from "./frontal";
import { Hippocampus } from "./hippocampus";
import { detectConflicts } from "./acc";
import { hermesConverge } from "./hermes";
import { planActions, executeReply } from "./motor";
import { BasalGanglia, RLReward } from "./bg";
import { Cerebellum } from "./cerebellum";
import { DefaultModeNetwork } from "./dmn";
import { llmCall } from "./config/llm";
import { ThalamusAuction } from "./thalamus";

// ---- 会话上下文 ----

interface SessionContext {
  sessionId: string;
  recentTopics: string[];
  userProfileSummary: string;
  interactionCount: number;
}

// ---- 认知引擎主类 ----

export class CognitiveEngine {
  // 调度
  fsm: SalienceFSM;
  metrics: SalienceMetrics;

  // 脑区
  amygdala = amygdalaCheck;
  thalamus = thalamusRoute;
  hippocampus: Hippocampus;

  // 后台学习
  bg: BasalGanglia;
  cerebellum: Cerebellum;
  dmn: DefaultModeNetwork;

  // 会话
  private session: SessionContext;
  private llmCallDeps: any;

  // 待发送给用户的消息队列
  pendingMessages: Array<{ content: string; metadata: Record<string, any> }> = [];

  constructor() {
    this.fsm = new SalienceFSM();
    this.metrics = new SalienceMetrics();
    this.hippocampus = new Hippocampus();
    this.bg = new BasalGanglia();
    this.cerebellum = new Cerebellum(undefined, {
      parietal: config.salience.perRegionTimeout.parietal,
      temporal: config.salience.perRegionTimeout.temporal,
      hippocampus: config.salience.perRegionTimeout.hippocampus,
      hermes: config.salience.perRegionTimeout.hermes,
    });
    this.dmn = new DefaultModeNetwork();
    this.llmCallDeps = { llmCall };

    this.session = {
      sessionId: `session_${Date.now()}`,
      recentTopics: [],
      userProfileSummary: "",
      interactionCount: 0,
    };

    this.hippocampus.init();
  }

  /** 用户输入入口 */
  async handleUserInput(rawText: string): Promise<{
    response: string;
    metadata: Record<string, any>;
  }> {
    const startTime = Date.now();
    this.session.interactionCount++;

    // 推入新输入事件
    this.fsm.pushEvent({
      type: FsmEvent.NEW_INPUT,
      timestamp: Date.now(),
      data: { rawText },
    });

    // ---- Z=0: 杏仁核安全检查 ----
    this.fsm.tick(); // IDLE → ALERTING
    const amygdalaResult = await this.amygdala(rawText, this.llmCallDeps);

    if (amygdalaResult.action === "BLOCK") {
      this.fsm.pushEvent({ type: FsmEvent.AMYGDALA_BLOCKED, timestamp: Date.now() });
      this.fsm.tick(); // → IDLE
      return {
        response: "抱歉，您的请求因安全原因被拦截。",
        metadata: { blocked: true, reason: amygdalaResult.note },
      };
    }

    this.fsm.pushEvent({
      type: FsmEvent.AMYGDALA_DONE,
      timestamp: Date.now(),
      data: amygdalaResult,
    });
    this.fsm.tick(); // ALERTING → ROUTING

    // ---- Z=0: 丘脑路由（动态竞标）----
    const thalamusResult = this.thalamus(rawText, amygdalaResult, new ThalamusAuction());
    this.fsm.pushEvent({
      type: FsmEvent.ROUTING_DONE,
      timestamp: Date.now(),
      data: thalamusResult,
    });
    this.fsm.tick(); // ROUTING → PROCESSING

    // ---- Z=1-2: 三角并行处理 ----
    const processingResult = await this.runProcessingPipeline(
      rawText,
      amygdalaResult,
      thalamusResult
    );

    // ---- Z=3: Hermes 收束 ----
    this.fsm.tick(); // PROCESSING → RESOLVING
    const hermesResult = await this.runHermes(
      rawText,
      amygdalaResult,
      thalamusResult,
      processingResult
    );

    this.fsm.pushEvent({ type: FsmEvent.HERMES_DONE, timestamp: Date.now() });
    this.fsm.tick(); // RESOLVING → EXECUTING

    // ---- Z=4: 运动皮层执行 ----
    const actions = planActions(hermesResult);
    const reply = executeReply(actions[0]);

    this.fsm.pushEvent({ type: FsmEvent.EXECUTION_DONE, timestamp: Date.now() });
    this.fsm.tick(); // EXECUTING → IDLE

    // ---- 后台学习 ----
    await this.runBackgroundLearning(
      rawText,
      reply.content,
      hermesResult,
      thalamusResult,
      Date.now() - startTime
    );

    // 记录指标
    this.metrics.recordTick(Date.now() - startTime, FsmState.IDLE);

    return { response: reply.content, metadata: reply.metadata };
  }

  // ---- 三角并行管线 ----

  private async runProcessingPipeline(
    rawText: string,
    amygdalaResult: AmygdalaSignal,
    thalamusResult: ThalamusDecision
  ): Promise<{
    parietal: ParietalOutput;
    temporal: TemporalOutput;
    frontal: FrontalOutput;
    hippocampus: MemoryResult;
    conflictReport: ConflictReport;
  }> {
    // === 第 1 拍：顶叶 ∥ 海马体 ===
    const [parietalResult, memoryResult] = await Promise.all([
      this.runWithTimeout(
        "parietal",
        config.salience.perRegionTimeout.parietal,
        () =>
          parietalProcess({
            raw_text: rawText,
            amygdala_result: amygdalaResult,
            context: {
              recent_topics: this.session.recentTopics,
              active_session_id: this.session.sessionId,
              user_profile_summary: this.session.userProfileSummary,
            },
          })
      ),
      this.runWithTimeout(
        "hippocampus",
        config.salience.perRegionTimeout.hippocampus,
        () => {
          // 先用空关键词检索，后续用顶叶结果更新
          const query: MemoryQuery = {
            keywords: rawText.split(/\s+/).slice(0, 5),
            top_k: 5,
          };
          return this.hippocampus.query(query);
        }
      ),
    ]);

    // 如果顶叶产出记忆检索词，补充检索
    if (parietalResult && parietalResult?.memory_query) {
      const supplementalQuery: MemoryQuery = {
        keywords: (parietalResult as ParietalOutput).memory_query.keywords,
        top_k: 5,
      };
      const supplemental = await this.hippocampus.query(supplementalQuery);
      // 合并记忆结果
      if (memoryResult && supplemental.matched_memories.length > 0) {
        (memoryResult as MemoryResult).matched_memories = [
          ...(memoryResult as MemoryResult).matched_memories,
          ...supplemental.matched_memories,
        ].slice(0, 10);
      }
    }

    const safeParietal = this.ensureParietalDefault(parietalResult);
    const safeMemory = memoryResult as MemoryResult;

    // === 第 2 拍：颞叶 ∥ 额叶 Phase1 ===
    const [temporalResult, frontalPhase1Pre] = await Promise.all([
      this.runWithTimeout(
        "temporal",
        config.salience.perRegionTimeout.temporal,
        () =>
          temporalProcess({
            raw_text: rawText,
            parietal_guidance: {
              attention_allocation: safeParietal.attention_allocation,
              intent_layers: safeParietal.implicit_info.intent_layers,
            },
            hippocampus_results: safeMemory,
          })
      ),
      this.runWithTimeout(
        "frontal_phase1",
        config.salience.perRegionTimeout.frontal_phase1,
        () =>
          frontalPhase1({
            raw_text: rawText,
            parietal_output: {
              intent_layers: safeParietal.implicit_info.intent_layers,
              attention_allocation: safeParietal.attention_allocation,
              activation: safeParietal.activation,
            },
            temporal_output: undefined,
            hippocampus_results: safeMemory,
            system_state: {
              available_tools: [],
              user_permissions: [],
              session_context: this.session.sessionId,
            },
          })
      ),
    ]);

    const safeTemporal = this.ensureTemporalDefault(temporalResult);

    // === 第 3 拍：额叶 Phase2（需要颞叶结果） ===
    const frontalResult = await this.runWithTimeout(
      "frontal_phase2",
      config.salience.perRegionTimeout.frontal_phase2,
      () =>
        frontalProcess({
          raw_text: rawText,
          parietal_output: {
            intent_layers: safeParietal.implicit_info.intent_layers,
            attention_allocation: safeParietal.attention_allocation,
            activation: safeParietal.activation,
          },
          temporal_output: {
            semantic_units: safeTemporal.semantic_units,
            domain_classification: safeTemporal.domain_classification,
            entity_graph: safeTemporal.entity_graph,
            memory_linkage: safeTemporal.memory_linkage,
          },
          hippocampus_results: safeMemory,
          system_state: {
            available_tools: [],
            user_permissions: [],
            session_context: this.session.sessionId,
          },
        })
    );

    const safeFrontal = this.ensureFrontalDefault(frontalResult);

    // === 冲突检测 ===
    const regionOutputs = {
      parietal: {
        regionId: "parietal",
        content: safeParietal,
        confidence: 0.8,
      },
      temporal: {
        regionId: "temporal",
        content: safeTemporal,
        confidence: safeTemporal.meta?.confidence_overall ?? 0.5,
      },
      frontal: {
        regionId: "frontal",
        content: safeFrontal,
        confidence: safeFrontal.recommendation?.confidence ?? 0.5,
      },
    };

    const conflictReport = detectConflicts(
      regionOutputs,
      (safeFrontal as FrontalOutput).conflicts
    );

    this.fsm.pushEvent({
      type: FsmEvent.ALL_REGIONS_DONE,
      timestamp: Date.now(),
    });

    return {
      parietal: safeParietal,
      temporal: safeTemporal,
      frontal: safeFrontal,
      hippocampus: safeMemory,
      conflictReport,
    };
  }

  // ---- Hermes 收束 ----

  private async runHermes(
    rawText: string,
    amygdalaResult: AmygdalaSignal,
    thalamusResult: ThalamusDecision,
    processing: {
      parietal: ParietalOutput;
      temporal: TemporalOutput;
      frontal: FrontalOutput;
      hippocampus: MemoryResult;
      conflictReport: ConflictReport;
    }
  ): Promise<HermesOutput> {
    const regionOutputs = new Map<string, any>();
    regionOutputs.set("parietal", processing.parietal);
    regionOutputs.set("temporal", processing.temporal);
    regionOutputs.set("frontal", processing.frontal);
    regionOutputs.set("hippocampus", processing.hippocampus);

    const hermesInput: HermesInput = {
      raw_text: rawText,
      amygdala: {
        level: amygdalaResult.level,
        threat_type: amygdalaResult.threat_type,
        action: amygdalaResult.action,
        note: amygdalaResult.note,
      },
      parietal: processing.parietal,
      temporal: processing.temporal,
      frontal: processing.frontal,
      hippocampus: processing.hippocampus,
      acc: {
        conflicts: processing.conflictReport.conflicts.map(c => ({
          type: c.conflict_type,
          severity: c.severity,
          description: c.description,
        })),
        consensus_level: processing.conflictReport.consensus_level,
        has_critical: processing.conflictReport.conflicts.some(c => c.severity === "critical"),
      },
      session: {
        interaction_count: this.session.interactionCount,
        dmn_self_model: this.dmn.getSelfModel(),
        user_profile: null,
      },
      // 向后兼容
      amygdalaSignal: amygdalaResult,
      thalamusDecision: thalamusResult,
      regionOutputs,
      conflictReport: processing.conflictReport,
      memoryContext: processing.hippocampus,
      selfModel: this.dmn.getSelfModel(),
    };

    const result = await this.runWithTimeout(
      "hermes",
      config.salience.perRegionTimeout.hermes,
      () => hermesConverge(hermesInput),
      () => ({
        action_decision: "DECLINE" as const,
        action_confidence: 0.1,
        final_response: "抱歉，处理您的请求时遇到了一些困难。请稍后再试。",
        response_tone: { primary: "cautious" as const, reason: "收束超时" },
        synthesis: { core_answer: "降级响应", key_supporting_points: [], referenced_memories: [], strategy_adopted: "none" },
        uncertainty_markers: [{
          type: "confidence_gap" as const,
          description: "收束超时，返回降级响应",
          severity: "critical" as const,
          how_resolved: "exposed_to_user" as const,
        }],
        metacognition: { overall_confidence: 0.1, risk_assessment: "超时", decision_rationale: "降级" },
      } as HermesOutput)
    );

    return result!;
  }

  // ---- 后台学习 ----

  private async runBackgroundLearning(
    userInput: string,
    response: string,
    hermesResult: HermesOutput,
    thalamusResult: ThalamusDecision,
    totalLatencyMs: number
  ): Promise<void> {
    try {
      // 1. 记忆巩固
      await this.hippocampus.consolidate(userInput, response);

      // 2. 更新话题
      this.session.recentTopics.push(userInput.slice(0, 30));
      if (this.session.recentTopics.length > 10) {
        this.session.recentTopics.shift();
      }

      // 3. 小脑三向优化 + 技能追踪
      const regionResults = thalamusResult.activatedRegions.map((r) => ({
        name: r.regionId,
        skill: "conversation",
        success: hermesResult.action_confidence > 0.5 || (hermesResult as any).confidence > 0.5,
        latencyMs: totalLatencyMs,
        error: (hermesResult.uncertainty_markers || (hermesResult as any).uncertaintyMarkers || [])
          .map((m: any) => m.description || m.message).join("; ") || undefined,
      }));
      this.cerebellum.postInteraction(regionResults, userInput, response);

      // 4. 定期 DMN 反思（每 10 次交互）
      if (this.session.interactionCount % 10 === 0) {
        this.fsm.pushEvent({
          type: FsmEvent.LEARNING_TICK,
          timestamp: Date.now(),
        });
        this.fsm.tick(); // IDLE → LEARNING

        await this.dmn.selfReflect([]);

        this.fsm.pushEvent({
          type: FsmEvent.LEARNING_TICK,
          timestamp: Date.now(),
        });
        this.fsm.tick(); // LEARNING → IDLE
      }
    } catch (e) {
      console.warn("[BackgroundLearning] 后台学习出错", e);
    }
  }

  // ---- 工具方法 ----

  /** 带超时的脑区调用 */
  private async runWithTimeout<T>(
    regionName: string,
    timeoutMs: number,
    fn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T | null> {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout: ${regionName}`)),
            timeoutMs
          )
        ),
      ]);
      return result;
    } catch (e: any) {
      console.warn(`[${regionName}] 超时或异常:`, e.message);
      this.metrics.regionTimeouts[regionName] =
        (this.metrics.regionTimeouts[regionName] || 0) + 1;
      this.metrics.degradationEvents++;

      if (fallback) return fallback();
      return null;
    }
  }

  private ensureParietalDefault(result: any): ParietalOutput {
    const r = result || {};
    // 如果有 attention_allocation 且结构完整，直接使用
    if (r.attention_allocation && r.implicit_info) return r as ParietalOutput;
    // 否则从部分结果构建完整结构
    return {
      explicit_info: {
        entities: r.explicit_info?.entities || [],
        structural_features: {
          has_instruction: r.explicit_info?.structural_features?.has_instruction ?? false,
          has_question: r.explicit_info?.structural_features?.has_question ?? false,
          has_data: r.explicit_info?.structural_features?.has_data ?? false,
          has_emotion: r.explicit_info?.structural_features?.has_emotion ?? false,
          input_length: r.explicit_info?.structural_features?.input_length || "short",
        },
      },
      implicit_info: {
        missing_context: r.implicit_info?.missing_context || [],
        hidden_assumptions: r.implicit_info?.hidden_assumptions || [],
        ambiguity_points: r.implicit_info?.ambiguity_points || [],
        intent_layers: r.implicit_info?.intent_layers?.length
          ? r.implicit_info.intent_layers
          : [{ layer: "surface", intent: "未知意图", confidence: 0.3 }],
      },
      attention_allocation: r.attention_allocation || {
        total_budget: 100,
        primary_focus: { segments: [], budget: 60 },
        secondary_context: { segments: [], budget: 25 },
        noise: { segments: [], budget: 15 },
      },
      activation: {
        level: (r.activation?.level || "MONITOR") as ActivationLevel,
        reason: r.activation?.reason || "降级默认",
        escalation: r.activation?.escalation ?? false,
      },
      memory_query: r.memory_query || { keywords: [], estimated_relevance: "low", query_time_window: "all_time" },
    };
  }

  private ensureTemporalDefault(result: any): TemporalOutput {
    // LLM 可能返回不完整结构，先补全再校验
    const r = result || {};
    return {
      semantic_units: r.semantic_units?.length
        ? r.semantic_units
        : [{ unit_id: "default_1", text_segment: "", type: "DECLARATIVE", confidence: 0.1 }],
      domain_classification: {
        domain: { primary: r.domain_classification?.domain?.primary || "daily_life", confidence: r.domain_classification?.domain?.confidence || 0.3, alternatives: r.domain_classification?.domain?.alternatives || [] },
        complexity: { level: r.domain_classification?.complexity?.level || "medium", reason: r.domain_classification?.complexity?.reason || "降级" },
        novelty: { level: r.domain_classification?.novelty?.level || "novel", known_unknowns: r.domain_classification?.novelty?.known_unknowns || ["降级"] },
        modality: r.domain_classification?.modality || "text_only",
        language: { primary: r.domain_classification?.language?.primary || "zh" },
      },
      entity_graph: r.entity_graph || { nodes: [], edges: [] },
      memory_linkage: r.memory_linkage || { linked_memories: [], additional_search_requests: [] },
      meta: {
        processing_time_ms: r.meta?.processing_time_ms ?? 0,
        primary_focus_processed: r.meta?.primary_focus_processed ?? false,
        noise_skipped: r.meta?.noise_skipped ?? true,
        confidence_overall: r.meta?.confidence_overall ?? 0.5,
      },
    };
  }

  private ensureFrontalDefault(result: any): FrontalOutput {
    const r = result || {};
    // LLM 可能返回不完整结构，先补全再使用
    return {
      pre_judgments: r.pre_judgments || [],
      strategies: r.strategies?.length ? r.strategies : [{
        strategy_id: "default_1",
        tagline: "标准回复",
        target_intent_layer: "surface",
        execution_steps: [{ step: 1, action: "基于已知信息回复", tool_needed: null, expected_output: "回复消息", fallback_if_failed: "请用户澄清" }],
        resources: { tools: [], knowledge_domains: [], estimated_time: "立即", external_dependencies: [] },
        success_criteria: ["用户收到回复"],
        fail_conditions: [],
        verified_assumptions: [],
        unverified_assumptions: ["降级"],
        scores: { feasibility: 5, fit: 4, risk: 6, efficiency: 5, weighted_total: 4.95 },
      }],
      recommendation: {
        primary_strategy_id: r.recommendation?.primary_strategy_id || "default_1",
        secondary_strategy_id: r.recommendation?.secondary_strategy_id || "default_1",
        need_clarification: r.recommendation?.need_clarification ?? false,
        confidence: r.recommendation?.confidence ?? 0.3,
      },
    };
  }

  /** 获取运行报告 */
  getReport(): {
    fsmState: FsmState;
    fsmLog: string[];
    metrics: Record<string, any>;
    health: string;
    selfModel: any;
    skillHealth: Record<string, any>;
    qTable: any;
  } {
    return {
      fsmState: this.fsm.state,
      fsmLog: this.fsm.getLog(),
      metrics: {
        totalTicks: this.metrics.totalTicks,
        avgTickDurationMs: Math.round(this.metrics.avgTickDurationMs),
        degradationEvents: this.metrics.degradationEvents,
        stateDistribution: this.metrics.stateDistribution,
      },
      health: this.metrics.healthCheck(),
      selfModel: this.dmn.getSelfModel(),
      skillHealth: this.cerebellum.getSkillHealth(),
      qTable: this.bg.getStats(),
    };
  }
}
