// ============================================================
// 认知引擎 — 全局类型定义
// 所有脑区的输入输出 Schema 统一管理
// ============================================================

// ---- 枚举 ----

export enum FsmState {
  IDLE = "IDLE",
  ALERTING = "ALERTING",
  ROUTING = "ROUTING",
  PROCESSING = "PROCESSING",
  RESOLVING = "RESOLVING",
  EXECUTING = "EXECUTING",
  LEARNING = "LEARNING",
}

export enum FsmEvent {
  NEW_INPUT = "new_input",
  AMYGDALA_DONE = "amygdala_done",
  AMYGDALA_BLOCKED = "amygdala_blocked",
  ROUTING_DONE = "routing_done",
  ALL_REGIONS_DONE = "all_regions_done",
  PROCESSING_TIMEOUT = "processing_timeout",
  HERMES_DONE = "hermes_done",
  EXECUTION_DONE = "execution_done",
  LEARNING_TICK = "learning_tick",
  SYSTEM_SHUTDOWN = "system_shutdown",
}

export enum CognitiveMode {
  CEN = "CEN",           // 任务执行模式
  DMN = "DMN",           // 内省/反思模式
  EMERGENCY = "EMERGENCY", // 紧急模式
  CREATIVE = "CREATIVE",   // 创意模式
  TEACHING = "TEACHING",   // 教学模式
}

export enum ActivationLevel {
  URGENT = "URGENT",
  FOCUS = "FOCUS",
  MONITOR = "MONITOR",
  IGNORE = "IGNORE",
}

// ---- 杏仁核 ----

export interface AmygdalaSignal {
  level: "SAFE" | "WARNING" | "CRITICAL";
  threat_type: string | null;    // "injection" | "jailbreak" | "harmful_content" | "self_harm" | null
  confidence: number;            // 0-1
  action: "PASS" | "FLAG" | "BLOCK";
  pathway: "fast" | "slow" | "none";  // 哪个通路产生的判断
  note: string;                  // 人类可读的判断理由
  blocked_reason?: string;       // action=BLOCK 时的拦截原因
}

// ---- 丘脑路由 ----

export interface ThalamusDecision {
  mode: CognitiveMode;
  activatedRegions: RegionActivation[];
  totalBudget: number;
  priority: "speed" | "quality" | "balanced";
}

export interface RegionActivation {
  regionId: RegionId;
  weight: number;
  budget: number;
}

export type RegionId =
  | "amygdala"
  | "thalamus"
  | "parietal"
  | "temporal"
  | "hippocampus"
  | "frontal"
  | "acc"
  | "salience"
  | "hermes"
  | "motor"
  | "bg"
  | "cerebellum"
  | "dmn";

// ---- 顶叶 ----

export interface ParietalInput {
  raw_text: string;
  amygdala_result: AmygdalaSignal;
  context: {
    recent_topics: string[];
    active_session_id: string;
    user_profile_summary: string;
  };
}

export interface ParietalOutput {
  explicit_info: {
    entities: Array<{
      name: string;
      type: "person" | "product" | "number" | "date" | "url" | "other";
      weight: 1.0 | 0.6 | 0.3;
    }>;
    structural_features: {
      has_instruction: boolean;
      has_question: boolean;
      has_data: boolean;
      has_emotion: boolean;
      input_length: "short" | "medium" | "long";
    };
  };
  implicit_info: {
    missing_context: string[];
    hidden_assumptions: string[];
    ambiguity_points: string[];
    intent_layers: Array<{
      layer: "surface" | "operational" | "strategic" | "emotional";
      intent: string;
      confidence: number;
    }>;
  };
  attention_allocation: {
    total_budget: number;
    primary_focus: { segments: string[]; budget: number };
    secondary_context: { segments: string[]; budget: number };
    noise: { segments: string[]; budget: number };
  };
  activation: {
    level: ActivationLevel;
    reason: string;
    escalation: boolean;
  };
  memory_query: {
    keywords: string[];
    estimated_relevance: "high" | "medium" | "low";
    query_time_window: string;
  };
}

// ---- 颞叶 ----

export interface TemporalInput {
  raw_text: string;
  parietal_guidance: {
    attention_allocation: ParietalOutput["attention_allocation"];
    intent_layers: ParietalOutput["implicit_info"]["intent_layers"];
  };
  hippocampus_results: {
    matched_memories: Array<{
      id: string;
      content_summary: string;
      similarity: number;
      timestamp: string;
    }>;
    query_complete: boolean;
  };
}

export interface TemporalOutput {
  semantic_units: Array<{
    unit_id: string;
    text_segment: string;
    type: "DECLARATIVE" | "PROCEDURAL" | "INTERROGATIVE" | "EMOTIONAL" | "META";
    confidence: number;
    alternative_interpretations?: string[];
  }>;
  domain_classification: {
    domain: { primary: string; confidence: number; alternatives: string[] };
    complexity: { level: "simple" | "medium" | "complex" | "expert"; reason: string };
    novelty: {
      level: "routine" | "similar" | "novel" | "unprecedented";
      similar_patterns?: string[];
      known_unknowns: string[];
    };
    modality: "text_only" | "text_with_code" | "mixed_media";
    language: { primary: string; mixed_with?: string[] };
  };
  entity_graph: {
    nodes: Array<{ id: string; label: string; type: string; mentioned_in: string[] }>;
    edges: Array<{ source: string; target: string; relation: string; confidence: number }>;
  };
  memory_linkage: {
    linked_memories: Array<{
      memory_id: string;
      link_type: "identical" | "similar" | "related" | "novel" | "contradict";
      relevance_score: number;
      key_difference?: string;
    }>;
    additional_search_requests: string[];
  };
  meta: {
    processing_time_ms: number;
    primary_focus_processed: boolean;
    noise_skipped: boolean;
    confidence_overall: number;
  };
}

// ---- 额叶 ----

export interface FrontalInput {
  raw_text: string;
  parietal_output: {
    intent_layers: ParietalOutput["implicit_info"]["intent_layers"];
    attention_allocation: ParietalOutput["attention_allocation"];
    activation: ParietalOutput["activation"];
  };
  temporal_output?: {
    semantic_units: TemporalOutput["semantic_units"];
    domain_classification: TemporalOutput["domain_classification"];
    entity_graph: TemporalOutput["entity_graph"];
    memory_linkage: TemporalOutput["memory_linkage"];
  };
  hippocampus_results: { matched_memories: any[] };
  system_state: {
    available_tools: string[];
    user_permissions: string[];
    session_context: string;
  };
}

export interface FrontalOutput {
  pre_judgments: Array<{
    direction: string;
    confidence: number;
    assumptions_to_verify: string[];
    generated_at: "pre_temporal";
  }>;
  strategies: Array<{
    strategy_id: string;
    tagline: string;
    target_intent_layer: "surface" | "operational" | "strategic" | "emotional";
    execution_steps: Array<{
      step: number;
      action: string;
      tool_needed: string | null;
      expected_output: string;
      fallback_if_failed: string;
    }>;
    resources: {
      tools: string[];
      knowledge_domains: string[];
      estimated_time: string;
      external_dependencies: string[];
    };
    success_criteria: string[];
    fail_conditions: string[];
    verified_assumptions: string[];
    unverified_assumptions: string[];
    scores: {
      feasibility: number;
      fit: number;
      risk: number;
      efficiency: number;
      weighted_total: number;
    };
  }>;
  recommendation: {
    primary_strategy_id: string;
    secondary_strategy_id: string;
    need_clarification: boolean;
    clarification_questions?: string[];
    confidence: number;
  };
  conflicts?: Array<{
    strategy_a: string;
    strategy_b: string;
    conflict_point: string;
    severity: "minor" | "moderate" | "critical";
  }>;
}

// ---- 海马体 ----

export interface MemoryRecord {
  id: string;
  collection: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MemoryQuery {
  keywords: string[];
  collections?: string[];
  top_k?: number;
  time_window?: string;
  min_similarity?: number;
}

export interface MemoryResult {
  matched_memories: Array<{
    id: string;
    content_summary: string;
    similarity: number;
    timestamp: string;
    metadata: Record<string, any>;
  }>;
  query_complete: boolean;
}

/** 海马体完整输入 Schema（对齐 05-hippocampus-prompt.md） */
export interface HippocampusInput {
  query?: {
    keywords: string[];
    top_k: number;
    collections: string[];
    min_similarity: number;
    time_window?: string;
  };
  store?: {
    user_message: string;
    system_response: string;
    metadata: {
      session_id: string;
      interaction_count: number;
      brain_outputs_summary: Record<string, any>;
    };
  };
  action: "query" | "store" | "consolidate" | "learn_preference" | "record_error";
  learnPreference?: { key: string; value: string; confidence: number };
  recordError?: { skill: string; error_type: string; description: string; severity: "minor" | "moderate" | "critical" };
}

/** 海马体完整输出 Schema（对齐 05-hippocampus-prompt.md） */
export interface HippocampusOutput {
  retrieved?: {
    stm: {
      recent_turns: Array<{
        role: "user" | "assistant";
        content: string;
        timestamp: string;
        estimated_tokens: number;
      }>;
      stm_usage_percent: number;
    };
    ltm: Array<{
      memory_id: string;
      collection: "conversations" | "facts" | "preferences" | "knowledge" | "patterns" | "errors";
      content_summary: string;
      full_content?: string;
      similarity: number;
      timestamp: string;
      link_type: "identical" | "similar" | "related" | "novel" | "contradict";
    }>;
    semantic: {
      entities: Array<{
        id: string;
        label: string;
        type: string;
        properties: Record<string, string>;
      }>;
      relations: Array<{
        source: string;
        target: string;
        relation: string;
        hop_distance: number;
      }>;
    };
    merged_summary: string;
  };
  stored?: {
    stm_turns_added: number;
    ltm_entries_added: number;
    semantic_updates: number;
    stm_after_trim: number;
  };
  consolidated?: {
    new_facts: string[];
    new_preferences: string[];
    new_patterns: string[];
    updated_entities: string[];
    errors_recorded: string[];
  };
}

// ---- Hermes 收束器 ----

export interface HermesInput {
  raw_text: string;
  amygdala: {
    level: "SAFE" | "WARNING" | "CRITICAL";
    threat_type: string | null;
    action: "PASS" | "FLAG" | "BLOCK";
    note: string;
  };
  parietal: any;
  temporal: any;
  frontal: any;
  hippocampus: any;
  acc: {
    conflicts: Array<{
      type: string;
      severity: "minor" | "moderate" | "critical";
      description: string;
    }>;
    consensus_level: number;
    has_critical: boolean;
  };
  session: {
    interaction_count: number;
    dmn_self_model: any;
    user_profile: any;
  };
  // 向后兼容旧接口
  amygdalaSignal?: AmygdalaSignal;
  thalamusDecision?: ThalamusDecision;
  regionOutputs?: Map<string, any>;
  conflictReport?: ConflictReport;
  memoryContext?: MemoryResult;
  selfModel?: any;
}

/** MHC 融合维度 */
export type FusionDimension = "correctness" | "completeness" | "safety" | "efficiency" | "user_adaptation";

export interface HermesOutput {
  // 行动决策
  action_decision: "ANSWER" | "ASK_CLARIFICATION" | "SEARCH_FIRST" | "DECLINE" | "DEFER";
  action_confidence: number;

  // 最终回复
  final_response: string;
  response_tone: {
    primary: "neutral" | "warm" | "concise" | "detailed" | "cautious" | "enthusiastic";
    reason: string;
  };

  // 融合摘要
  synthesis: {
    core_answer: string;
    key_supporting_points: string[];
    referenced_memories: string[];
    strategy_adopted: string;
  };

  // 不确定性标注
  uncertainty_markers: Array<{
    type: "confidence_gap" | "strategy_conflict" | "missing_info" | "ambiguous_input";
    description: string;
    severity: "minor" | "moderate" | "critical";
    how_resolved: "exposed_to_user" | "asked_clarification" | "chose_majority" | "deferred";
  }>;

  // 追问
  clarification_questions?: string[];

  // 元认知
  metacognition: {
    overall_confidence: number;
    risk_assessment: string;
    alternative_viewpoints?: string[];
    decision_rationale: string;
  };

  // 向后兼容
  finalResponse?: string;
  confidence?: number;
  uncertaintyMarkers?: any[];
  actionDecision?: string;
  tone?: string;
  citations?: Array<{ source: string; content: string }>;
}

// ---- 扣带回冲突 ----

export interface ConflictReport {
  conflicts: Array<{
    region_a: string;
    region_b: string;
    conflict_type: "semantic" | "strategic" | "factual" | "safety" | "value";
    description: string;
    severity: "minor" | "moderate" | "critical";
    can_resolve: boolean;
    resolution?: string;
  }>;
  consensus_level: number; // 0-1
}

// ---- DMN 自我模型 ----

export interface SelfModel {
  identity: string;
  capabilities: string[];
  limitations: string[];
  values: string[];
  knowledge_boundaries: string[];
  last_updated: string;
}

// ---- 系统状态 ----

export interface SystemState {
  available_tools: string[];
  user_permissions: string[];
  session_context: string;
  cognitive_budget_remaining: number;
}

// ---- 事件 ----

export interface FsmEventPayload {
  type: FsmEvent;
  timestamp: number;
  data?: any;
}

// ============================================================
// 动态调度增强 — 能力契约
// ============================================================

export type Skill =
  | "input_scanning" | "threat_detection" | "content_filtering"
  | "intent_extraction" | "attention_allocation" | "entity_recognition"
  | "structural_analysis" | "tone_detection"
  | "semantic_decomposition" | "domain_classification"
  | "novelty_assessment" | "complexity_estimation"
  | "entity_relation_mapping"
  | "strategy_generation" | "pre_judgment" | "risk_assessment"
  | "step_decomposition" | "multi_perspective_scoring"
  | "memory_retrieval" | "memory_consolidation" | "preference_learning"
  | "semantic_graph_query" | "pattern_recognition"
  | "signal_fusion" | "conflict_resolution" | "action_decision"
  | "response_generation" | "tone_adaptation"
  | "action_planning" | "tool_dispatch" | "reply_execution"
  | "skill_tracking" | "error_analysis" | "prompt_optimization"
  | "self_reflection" | "q_learning" | "reward_computation"
  | "routing" | "dynamic_bidding" | "cooldown_management"
  | "timeout_optimization" | "weight_optimization";

export interface CapabilityContract {
  region: string;
  can: Skill[];
  cannot: Skill[];
  prefers: Skill[];
  blacklist: string[];
  typical_latency_ms: number;
  max_latency_ms: number;
  requires_llm: boolean;
  concurrent_capable: boolean;
  must_wait_for: string[];
  optional_input_from: string[];
  health: {
    recent_success_rate: number;
    avg_latency_ms: number;
    timeout_ratio: number;
    last_healthy_check: string;
  };
}

export interface BidResult {
  region: string;
  base_weight: number;
  capability_match: number;
  health_factor: number;
  final_bid: number;
  activation: boolean;
  budget: number;
}
