-- ============================================================
-- 认知引擎 数据库 Schema
-- SQLite: regions + mode_weights + memory_index
-- ============================================================

-- 脑区注册表
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    default_weight REAL DEFAULT 0.5,
    max_concurrent INTEGER DEFAULT 1,
    cooldown_ms INTEGER DEFAULT 30000,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 模式权重矩阵（5模式 × 14脑区）
CREATE TABLE IF NOT EXISTS mode_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('CEN','DMN','EMERGENCY','CREATIVE','TEACHING')),
    weight REAL NOT NULL DEFAULT 0.0,
    active INTEGER DEFAULT 1,
    UNIQUE(region_id, mode),
    FOREIGN KEY (region_id) REFERENCES regions(id)
);

-- 脑区性能追踪
CREATE TABLE IF NOT EXISTS region_performance (
    region_id TEXT PRIMARY KEY,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_latency_ms REAL DEFAULT 0,
    avg_quality REAL DEFAULT 0.5,
    coefficient REAL DEFAULT 1.0,
    last_evaluated INTEGER DEFAULT 0,
    cooldown_until INTEGER DEFAULT 0,
    FOREIGN KEY (region_id) REFERENCES regions(id)
);

-- 记忆索引（轻量，用于 ChromaDB 元数据映射）
CREATE TABLE IF NOT EXISTS memory_index (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    chroma_id TEXT NOT NULL,
    summary TEXT,
    keywords TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_accessed TEXT DEFAULT (datetime('now')),
    access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_memory_collection ON memory_index(collection);
CREATE INDEX IF NOT EXISTS idx_memory_keywords ON memory_index(keywords);

-- 默认数据：注册 14 脑区
INSERT OR IGNORE INTO regions (id, name, display_name, description, default_weight) VALUES
    ('amygdala',    '杏仁核',   '危机预警',    '双通路安全拦截：快速正则 + NeMo-Guardrails', 0.5),
    ('thalamus',    '丘脑',     '感官路由',    '选择性激活下游脑区，分配认知预算', 0.5),
    ('parietal',    '顶叶',     '注意力分配',  '信息筛选、显著性检测、意图分层', 0.6),
    ('temporal',    '颞叶',     '语义识别',    '语义分解、领域分类、实体关系图', 0.7),
    ('hippocampus', '海马体',   '三层记忆',    'STM/LTM/语义记忆检索与巩固', 0.8),
    ('frontal',     '额叶',     '策略引擎',    '双阶段预判+策略生成+多维度评分', 0.9),
    ('acc',         '扣带回',   '冲突监控',    '多脑区输出矛盾检测与标注', 0.4),
    ('salience',    '突显网络', '调度中枢',    'FSM 状态机 + 5模式动态切换', 0.5),
    ('hermes',      'Hermes',   '收束融合',   '多源信号合成、冲突处理、不确定性暴露', 0.8),
    ('motor',       '运动皮层', '执行产出',    '工具调用 + MCP 协议执行', 0.5),
    ('bg',          '基底节',   '强化学习',    'Q-Learning 习惯形成与策略优化', 0.3),
    ('cerebellum',  '小脑',     '技能优化',    'DSPy Prompt 自动调优', 0.3),
    ('dmn',         'DMN',      '自我模型',    '身份连续性维护、自我认知', 0.3),
    ('salience2',   '突显网络-仲裁', '模式确认', '二次冲突检测后的模式最终确认', 0.4);

-- 默认模式权重（每个脑区在 5 种模式下的权重）
INSERT OR IGNORE INTO mode_weights (region_id, mode, weight) VALUES
    -- CEN 任务执行模式
    ('frontal',     'CEN', 1.0),
    ('parietal',    'CEN', 0.5),
    ('temporal',    'CEN', 0.7),
    ('hippocampus', 'CEN', 0.8),
    ('cerebellum',  'CEN', 0.5),
    ('bg',          'CEN', 0.6),
    ('dmn',         'CEN', 0.1),
    -- DMN 内省模式
    ('frontal',     'DMN', 0.2),
    ('dmn',         'DMN', 1.0),
    ('hippocampus', 'DMN', 0.9),
    ('amygdala',    'DMN', 0.3),
    ('cerebellum',  'DMN', 0.4),
    -- EMERGENCY 紧急模式
    ('amygdala',    'EMERGENCY', 1.0),
    ('frontal',     'EMERGENCY', 0.8),
    ('hippocampus', 'EMERGENCY', 0.7),
    ('temporal',    'EMERGENCY', 0.6),
    ('dmn',         'EMERGENCY', 0.0),
    ('cerebellum',  'EMERGENCY', 0.0),
    ('bg',          'EMERGENCY', 0.0),
    -- CREATIVE 创意模式
    ('frontal',     'CREATIVE', 0.4),
    ('dmn',         'CREATIVE', 0.9),
    ('temporal',    'CREATIVE', 0.8),
    ('hippocampus', 'CREATIVE', 0.7),
    ('parietal',    'CREATIVE', 0.6),
    -- TEACHING 教学模式
    ('frontal',     'TEACHING', 0.9),
    ('temporal',    'TEACHING', 0.8),
    ('hippocampus', 'TEACHING', 0.8),
    ('cerebellum',  'TEACHING', 0.5),
    ('dmn',         'TEACHING', 0.4);
