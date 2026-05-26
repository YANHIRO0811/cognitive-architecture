// ============================================================
// 配置加载器
// ============================================================

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  llm: {
    apiKey: process.env.LLM_API_KEY || "",
    baseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
    model: process.env.LLM_MODEL || "deepseek-chat",
  },

  db: {
    sqlitePath: process.env.SQLITE_PATH || "./data/cognitive.db",
    chromaPath: process.env.CHROMA_PATH || "./data/chroma",
  },

  amygdala: {
    fastEnabled: process.env.AMYGDALA_FAST_ENABLED !== "false",
    slowEnabled: process.env.AMYGDALA_SLOW_ENABLED !== "false",
    defaultOnTimeout: (process.env.AMYGDALA_DEFAULT_ON_TIMEOUT || "WARNING") as "PASS" | "WARNING" | "BLOCK",
    blockResponse: process.env.AMYGDALA_BLOCK_RESPONSE || "抱歉，你的请求包含不安全内容，已被安全策略拦截。",
  },

  hippocampus: {
    stmMaxTokens: parseInt(process.env.HIPPOCAMPUS_STM_MAX_TOKENS || "25000"),
    summaryCompression: parseInt(process.env.HIPPOCAMPUS_SUMMARY_COMPRESSION || "10"),
  },

  salience: {
    tickIntervalMs: parseInt(process.env.SALIENCE_TICK_INTERVAL_MS || "1000"),
    processingTimeoutMs: parseInt(process.env.SALIENCE_PROCESSING_TIMEOUT_MS || "30000"),
    perRegionTimeout: {
      parietal: 5000,
      temporal: 12000,
      frontal_phase1: 8000,
      frontal_phase2: 20000,
      hippocampus: 3000,
      hermes: 5000,
    },
  },

  parallelism: {
    maxConcurrentRegions: parseInt(process.env.MAX_CONCURRENT_REGIONS || "3"),
    enableAsyncMemory: true,
  },

  fastPath: {
    enabled: true,
    maxInputChars: 50,
  },
};
