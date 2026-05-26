// ============================================================
// 数据库初始化
// 使用 sql.js（纯 JS）作为 SQLite 引擎，无需原生编译
// ============================================================

import path from "path";
import fs from "fs";

let Database: any = null;
let db: any = null;

async function loadSqlJs(): Promise<any> {
  if (Database) return Database;
  try {
    const initSqlJs = (await import("sql.js")).default;
    Database = await initSqlJs();
    return Database;
  } catch (e) {
    // 尝试 better-sqlite3 作为备选
    try {
      const bsql = await import("better-sqlite3");
      Database = bsql.default;
      return Database;
    } catch {
      throw new Error("无法加载 SQLite 引擎（sql.js 和 better-sqlite3 都不可用）");
    }
  }
}

export async function getDb(): Promise<any> {
  if (!db) {
    const SQL = await loadSqlJs();
    const dbPath = path.resolve("./data/cognitive.db");
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 尝试从文件加载已有数据库
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  try {
    const database = await getDb();
    const schemaPath = path.resolve(__dirname, "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      database.run(schema);
    }
    console.log("[DB] 数据库初始化完成");
  } catch (e: any) {
    console.warn(`[DB] 数据库初始化跳过: ${e.message}`);
  }
}

export function closeDb(): void {
  if (db) {
    // sql.js: 导出数据写回文件
    const dbPath = path.resolve("./data/cognitive.db");
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    db.close();
    db = null;
    console.log("[DB] 数据库已保存并关闭");
  }
}

