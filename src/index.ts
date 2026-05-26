// ============================================================
// 认知引擎 — 入口
// ============================================================

import { CognitiveEngine } from "./loop";
import { initDatabase } from "./db/init";

async function main(): Promise<void> {
  console.log("========================================");
  console.log("  认知引擎 Cognitive Engine v0.1.0");
  console.log("  14 脑区并行认知架构");
  console.log("========================================");

  // 初始化数据库（如果 sql.js 可用）
  await initDatabase();

  // 创建引擎实例
  const engine = new CognitiveEngine();

  console.log(`[Engine] 初始化完成`);
  console.log(`[Engine] 当前状态: ${engine.fsm.state}`);
  console.log(`[Engine] 自我模型: ${engine.dmn.getSelfModel().identity}`);

  // 交互式 REPL（CLI 模式）
  if (process.argv.includes("--repl")) {
    await runRepl(engine);
    return;
  }

  // 单次查询模式
  const query = process.argv.slice(2).join(" ").trim();
  if (query) {
    console.log(`\n[User] ${query}\n`);
    const result = await engine.handleUserInput(query);
    console.log(`\n[Hermes] ${result.response}`);
    console.log(`\n[Metadata]`, JSON.stringify(result.metadata, null, 2));
    return;
  }

  // 演示模式
  console.log("\n[Demo] 运行演示查询...\n");

  const demoQueries = [
    "你好，请介绍一下自己",
    "帮我写一个 Python 快速排序函数",
    "最近有什么 AI 领域的重大新闻？",
  ];

  for (const q of demoQueries) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[User] ${q}`);
    console.log(`${"=".repeat(60)}`);

    try {
      const start = Date.now();
      const result = await engine.handleUserInput(q);
      const elapsed = Date.now() - start;

      console.log(`\n[Hermes · ${elapsed}ms] ${result.response}`);
    } catch (e) {
      console.error(`[Error]`, e);
    }

    // 请求间等待
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 输出报告
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("系统运行报告");
  console.log(`${"=".repeat(60)}`);
  console.log(JSON.stringify(engine.getReport(), null, 2));
}

// ---- CLI REPL ----

async function runRepl(engine: CognitiveEngine): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n🧠 > ",
  });

  console.log("\n进入交互模式（输入 exit 退出）");
  rl.prompt();

  rl.on("line", async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log("再见！");
      rl.close();
      return;
    }

    if (input === "/report") {
      console.log(JSON.stringify(engine.getReport(), null, 2));
      rl.prompt();
      return;
    }

    if (input === "/fsm") {
      console.log(`当前 FSM 状态: ${engine.fsm.state}`);
      console.log(`最近转换:\n${engine.fsm.getLog().join("\n")}`);
      rl.prompt();
      return;
    }

    try {
      const start = Date.now();
      const result = await engine.handleUserInput(input);
      const elapsed = Date.now() - start;

      console.log(`\n[${elapsed}ms] ${result.response}`);
    } catch (e) {
      console.error(`[Error]`, e);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

// 启动
main().catch(console.error);
