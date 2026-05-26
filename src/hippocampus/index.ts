// ============================================================
// 海马体 — 三层记忆系统（STM / LTM / 语义图谱）
// 对应文档: 05-hippocampus-prompt.md
// ============================================================

import {
  MemoryQuery,
  MemoryResult,
  HippocampusInput,
  HippocampusOutput,
} from "../types";
import { config } from "../config";
import { llmCall, parseLlmJson } from "../config/llm";
import { REGION_CONTRACTS } from "../config/contracts";
export const contract = REGION_CONTRACTS.hippocampus;

// ---- L1: STM 工作记忆（会话内上下文窗口）----

interface StmEntry {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

class ShortTermMemory {
  private buffer: StmEntry[] = [];
  private maxTokens: number;

  constructor(maxTokens = 25000) {
    this.maxTokens = maxTokens;
  }

  add(entry: StmEntry): void {
    this.buffer.push(entry);
    this.trim();
  }

  getAll(): StmEntry[] {
    return [...this.buffer];
  }

  getRecent(n: number): StmEntry[] {
    return this.buffer.slice(-n);
  }

  getUsagePercent(): number {
    const est = this.estimateTokens();
    return Math.min(1, est / this.maxTokens);
  }

  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }

  /** 估算 token 数（中文：~1.5 字符/token，英文：~4 字符/token） */
  private estimateTokens(): number {
    let total = 0;
    for (const e of this.buffer) {
      const chars = e.content.length;
      const isChinese = /[\u4e00-\u9fff]/.test(e.content);
      total += isChinese ? chars / 1.5 : chars / 4;
    }
    return Math.ceil(total);
  }

  /** 超过 maxTokens 时裁剪旧条目 */
  private trim(): void {
    while (this.estimateTokens() > this.maxTokens && this.buffer.length > 2) {
      this.buffer.splice(1, 1);
    }
  }
}

// ---- L2: LTM 长期记忆（6 个 collection，内存模拟）----

type LtmCollection = "conversations" | "facts" | "preferences" | "knowledge" | "patterns" | "errors";

interface LtmEntry {
  id: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
  embedding?: number[];
}

class LongTermMemory {
  private collections: Map<LtmCollection, LtmEntry[]> = new Map();
  private initialized = false;

  constructor() {
    const names: LtmCollection[] = [
      "conversations", "facts", "preferences",
      "knowledge", "patterns", "errors",
    ];
    for (const name of names) {
      this.collections.set(name, []);
    }
  }

  init(): void {
    this.initialized = true;
    console.log("[Hippocampus] LTM 初始化完成（内存模拟模式）");
  }

  async store(collection: LtmCollection, content: string, metadata: Record<string, any> = {}): Promise<void> {
    const coll = this.collections.get(collection);
    if (!coll) throw new Error(`Unknown collection: ${collection}`);
    coll.push({
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      metadata,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * 关键词匹配检索（不调 LLM）
   * 模拟向量检索：基于关键词做简单匹配
   */
  query(
    collections: LtmCollection[],
    keywords: string[],
    topK: number = 5,
    minSimilarity: number = 0.3
  ): Array<LtmEntry & { similarity: number }> {
    const allResults: Array<LtmEntry & { similarity: number }> = [];

    for (const collName of collections) {
      const coll = this.collections.get(collName);
      if (!coll || coll.length === 0) continue;

      const scored = coll.map((item) => {
        let score = 0;
        const lowerContent = item.content.toLowerCase();
        for (const kw of keywords) {
          if (kw && lowerContent.includes(kw.toLowerCase())) {
            score += 1;
          }
        }
        const similarity = keywords.length > 0 ? score / keywords.length : 0;
        return { ...item, similarity };
      });

      allResults.push(...scored);
    }

    // 过滤 + 排序 + 截取
    return allResults
      .filter((item) => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  getAll(collections?: LtmCollection[]): Map<LtmCollection, LtmEntry[]> {
    if (!collections) return this.collections;
    const result = new Map<LtmCollection, LtmEntry[]>();
    for (const name of collections) {
      result.set(name, this.collections.get(name) || []);
    }
    return result;
  }
}

// ---- L3: 语义图谱（本地图数据结构，不调 LLM）----

interface SemanticEntity {
  id: string;
  label: string;
  type: string;
  properties: Record<string, string>;
}

interface SemanticRelation {
  source: string;
  target: string;
  relation: string;
}

class SemanticMemory {
  private entities: Map<string, SemanticEntity> = new Map();
  private relations: SemanticRelation[] = [];
  private entityRelations: Map<string, SemanticRelation[]> = new Map(); // 实体→关联关系

  addEntity(id: string, label: string, type: string, properties: Record<string, string> = {}): void {
    this.entities.set(id, { id, label, type, properties });
  }

  getEntity(id: string): SemanticEntity | undefined {
    return this.entities.get(id);
  }

  addRelation(source: string, target: string, relation: string): void {
    const rel: SemanticRelation = { source, target, relation };
    this.relations.push(rel);

    // 索引
    for (const node of [source, target]) {
      if (!this.entityRelations.has(node)) {
        this.entityRelations.set(node, []);
      }
      this.entityRelations.get(node)!.push(rel);
    }
  }

  /**
   * 实体查找 + 1 跳关系遍历（不调 LLM）
   */
  queryEntities(keywords: string[], hops: number = 1): {
    entities: SemanticEntity[];
    relations: Array<SemanticRelation & { hop_distance: number }>;
  } {
    const matchedEntities: SemanticEntity[] = [];
    const matchedRelations: Array<SemanticRelation & { hop_distance: number }> = [];
    const seenEntityIds = new Set<string>();
    const seenRelKeys = new Set<string>();

    // 实体查找：按关键词匹配
    for (const [id, entity] of this.entities) {
      for (const kw of keywords) {
        if (entity.label.includes(kw) || id.includes(kw)) {
          if (!seenEntityIds.has(id)) {
            matchedEntities.push(entity);
            seenEntityIds.add(id);
          }
          break;
        }
      }
    }

    // 1 跳关系遍历
    for (const entityId of seenEntityIds) {
      const rels = this.entityRelations.get(entityId) || [];
      for (const rel of rels) {
        const relKey = `${rel.source}:${rel.target}:${rel.relation}`;
        if (!seenRelKeys.has(relKey)) {
          matchedRelations.push({ ...rel, hop_distance: 1 });
          seenRelKeys.add(relKey);

          // 把关系的另一端也加入实体
          const otherEnd = rel.source === entityId ? rel.target : rel.source;
          if (!seenEntityIds.has(otherEnd) && this.entities.has(otherEnd)) {
            const otherEntity = this.entities.get(otherEnd)!;
            matchedEntities.push(otherEntity);
            seenEntityIds.add(otherEnd);
          }
        }
      }
    }

    return { entities: matchedEntities, relations: matchedRelations };
  }

  /** 推断链接类型 */
  static inferLinkType(similarity: number): "identical" | "similar" | "related" | "novel" | "contradict" {
    if (similarity >= 0.95) return "identical";
    if (similarity >= 0.7) return "similar";
    if (similarity >= 0.3) return "related";
    return "novel";
  }
}

export { SemanticMemory };

// ---- LLM 记忆巩固 Prompt ----

const CONSOLIDATION_SYSTEM_PROMPT = `你是海马体记忆巩固模块。分析交互记录，提取可存储的记忆要素。

## 你的任务
1. 从对话中提取新事实
2. 检测用户偏好信号
3. 识别交互模式
4. 发现需要更新的实体关系
5. 记录错误教训

## 输出格式
严格输出 JSON：
{
  "facts": ["事实1", "事实2"],
  "preferences": ["偏好1: 值"],
  "patterns": ["模式1"],
  "entities": ["实体更新"],
  "errors": ["教训"]
}

注意：只输出 JSON，不要解释文字。`;

// ---- 海马体主类 ----

export class Hippocampus {
  stm: ShortTermMemory;
  ltm: LongTermMemory;
  semantic: SemanticMemory;

  constructor() {
    this.stm = new ShortTermMemory(config.hippocampus.stmMaxTokens);
    this.ltm = new LongTermMemory();
    this.semantic = new SemanticMemory();
  }

  init(): void {
    this.ltm.init();
    console.log("[Hippocampus] 三层记忆系统就绪 (STM + LTM×6 + 语义图谱)");
  }

  /** 核心检索接口——检索阶段不调 LLM */
  async query(params: MemoryQuery): Promise<MemoryResult> {
    const collections = params.collections as LtmCollection[] | undefined;
    const allCollections: LtmCollection[] = collections?.length
      ? collections as LtmCollection[]
      : ["conversations", "facts", "preferences", "knowledge", "patterns", "errors"];
    const topK = params.top_k || 5;
    const minSimilarity = params.min_similarity || 0.3;

    // LTM 关键词匹配检索（不调 LLM）
    const ltmResults = this.ltm.query(allCollections, params.keywords, topK, minSimilarity);

    // 语义图谱查询（不调 LLM）
    const semanticResults = this.semantic.queryEntities(params.keywords);

    // STM 直接读数组（不调 LLM）
    const stmTurns = this.stm.getRecent(10);

    // 合并去重
    const seen = new Set<string>();
    const unique = ltmResults
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return {
      matched_memories: unique.map((r) => ({
        id: r.id,
        content_summary:
          typeof r.content === "string" ? r.content.slice(0, 200) : "",
        similarity: r.similarity || 0,
        timestamp: r.created_at || new Date().toISOString(),
        metadata: r.metadata || {},
      })),
      query_complete: true,
    };
  }

  /** 完整查询接口（对齐 HippocampusInput/HippocampusOutput Schema） */
  async fullQuery(params: HippocampusInput): Promise<HippocampusOutput> {
    if (params.action === "query" && params.query) {
      const { keywords, top_k, collections, min_similarity } = params.query;
      const allCollections = (collections?.length ? collections : [
        "conversations", "facts", "preferences", "knowledge", "patterns", "errors",
      ]) as LtmCollection[];

      // 并行查询三层（都不调 LLM）
      const stmTurns = this.stm.getRecent(10);
      const ltmResults = this.ltm.query(allCollections, keywords, top_k, min_similarity);
      const semanticResults = this.semantic.queryEntities(keywords);

      // STM 格式化
      const recentTurns = stmTurns.map((t) => ({
        role: t.role as "user" | "assistant",
        content: t.content,
        timestamp: t.timestamp,
        estimated_tokens: Math.ceil(t.content.length / 2),
      }));

      // LTM 格式化
      const ltmFormatted = ltmResults.map((r) => ({
        memory_id: r.id,
        collection: (r.metadata?.collection || "knowledge") as LtmCollection,
        content_summary: typeof r.content === "string" ? r.content.slice(0, 200) : "",
        similarity: r.similarity,
        timestamp: r.created_at,
        link_type: SemanticMemory.inferLinkType(r.similarity),
      }));

      return {
        retrieved: {
          stm: {
            recent_turns: recentTurns,
            stm_usage_percent: this.stm.getUsagePercent(),
          },
          ltm: ltmFormatted,
          semantic: semanticResults,
          merged_summary: `检索完成：STM ${recentTurns.length} 条，LTM ${ltmFormatted.length} 条，语义实体 ${semanticResults.entities.length} 个`,
        },
      };
    }

    if (params.action === "store" && params.store) {
      // 存储到 conversations
      await this.ltm.store("conversations", JSON.stringify({
        user: params.store.user_message,
        response: params.store.system_response,
      }), { collection: "conversations" });

      // 更新 STM
      this.stm.add({ role: "user", content: params.store.user_message, timestamp: new Date().toISOString() });
      this.stm.add({ role: "assistant", content: params.store.system_response, timestamp: new Date().toISOString() });

      return {
        stored: {
          stm_turns_added: 2,
          ltm_entries_added: 1,
          semantic_updates: 0,
          stm_after_trim: this.stm.size,
        },
      };
    }

    if (params.action === "learn_preference" && params.learnPreference) {
      await this.ltm.store("preferences",
        `${params.learnPreference.key}: ${params.learnPreference.value}`,
        { key: params.learnPreference.key, confidence: params.learnPreference.confidence }
      );
      return {
        stored: { stm_turns_added: 0, ltm_entries_added: 1, semantic_updates: 0, stm_after_trim: this.stm.size },
      };
    }

    if (params.action === "record_error" && params.recordError) {
      await this.ltm.store("errors", JSON.stringify(params.recordError), {
        skill: params.recordError.skill,
        severity: params.recordError.severity,
      });
      return {
        stored: { stm_turns_added: 0, ltm_entries_added: 1, semantic_updates: 0, stm_after_trim: this.stm.size },
      };
    }

    // 默认返回
    return { retrieved: { stm: { recent_turns: [], stm_usage_percent: 0 }, ltm: [], semantic: { entities: [], relations: [] }, merged_summary: "无操作" } };
  }

  /** 对话结束后巩固记忆（可调 LLM 做摘要提取） */
  async consolidate(
    userInput: string,
    response: string,
    useLlm: boolean = false
  ): Promise<HippocampusOutput["consolidated"]> {
    // 基础存储
    await this.ltm.store("conversations", JSON.stringify({ userInput, response }), {
      timestamp: new Date().toISOString(),
      collection: "conversations",
    });

    const defaultResult = {
      new_facts: [] as string[],
      new_preferences: [] as string[],
      new_patterns: [] as string[],
      updated_entities: [] as string[],
      errors_recorded: [] as string[],
    };

    if (!useLlm) return defaultResult;

    // LLM 摘要提取（巩固阶段，temperature=0.1, max_tokens=1024）
    try {
      const prompt = `## 本轮交互
用户: ${userInput.slice(0, 500)}
助手: ${response.slice(0, 500)}

请分析并提取记忆要素。`;

      const raw = await llmCall({
        systemPrompt: CONSOLIDATION_SYSTEM_PROMPT,
        userPrompt: prompt,
        temperature: 0.1,
        maxTokens: 1024,
        timeoutMs: 10000,
        responseFormat: "json_object",
      });

      const parsed = parseLlmJson(raw);

      // 存储提取的内容
      if (parsed.facts?.length) {
        for (const fact of parsed.facts) {
          await this.ltm.store("facts", fact, { collection: "facts" });
          defaultResult.new_facts.push(fact);
        }
      }
      if (parsed.preferences?.length) {
        for (const pref of parsed.preferences) {
          await this.ltm.store("preferences", pref, { collection: "preferences" });
          defaultResult.new_preferences.push(pref);
        }
      }
      if (parsed.patterns?.length) {
        for (const pat of parsed.patterns) {
          await this.ltm.store("patterns", pat, { collection: "patterns" });
          defaultResult.new_patterns.push(pat);
        }
      }
      if (parsed.entities?.length) {
        defaultResult.updated_entities = parsed.entities;
      }
      if (parsed.errors?.length) {
        for (const err of parsed.errors) {
          await this.ltm.store("errors", err, { collection: "errors" });
          defaultResult.errors_recorded.push(err);
        }
      }

      return defaultResult;
    } catch {
      console.warn("[Hippocampus] LLM 巩固失败，仅做基础存储");
      return defaultResult;
    }
  }

  /** 学习用户偏好 */
  async learnPreference(key: string, value: string): Promise<void> {
    await this.ltm.store("preferences", `${key}: ${value}`, {
      key,
      value,
      timestamp: new Date().toISOString(),
      collection: "preferences",
    });
  }

  /** 记录错误教训 */
  async recordError(context: string, error: string): Promise<void> {
    await this.ltm.store("errors", JSON.stringify({ context, error }), {
      timestamp: new Date().toISOString(),
      collection: "errors",
    });
  }
}
