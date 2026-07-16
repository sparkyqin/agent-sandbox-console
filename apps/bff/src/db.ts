// 控制面 SQLite 存储：成本记录、配额/预算配置、生命周期事件。
// OpenSandbox 不提供这些（运行时平台），由 BFF 自有。
//
// 阶段5 引入持久化。resourceStore/lineageStore 暂保持内存（工作正常，迁移收益小）。
import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'

let db: DB | null = null

export function getDb(): DB {
  if (db) return db
  const cfg = loadConfig()
  // 相对路径基于 cwd（dev 时为 apps/bff）；确保目录存在
  const dbPath = resolveDbPath(cfg.dbPath)
  mkdirSync(dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

function resolveDbPath(configured: string): string {
  if (configured.startsWith('/')) return configured
  // file:// URL 解析（loadEnvFile 场景）或相对路径，都解析到绝对
  try {
    if (configured.startsWith('file:')) return fileURLToPath(configured)
  } catch { /* fallthrough */ }
  return resolve(process.cwd(), configured)
}

function migrate(d: DB): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS cost_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sandbox_id TEXT NOT NULL,
      project TEXT NOT NULL,
      amount REAL NOT NULL,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cost_ts ON cost_events(ts);
    CREATE INDEX IF NOT EXISTS idx_cost_project ON cost_events(project);

    CREATE TABLE IF NOT EXISTS lifecycle_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sandbox_id TEXT NOT NULL,
      state TEXT NOT NULL,
      reason TEXT,
      message TEXT,
      type TEXT,           -- Normal / Warning
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_sandbox ON lifecycle_events(sandbox_id, ts);

    CREATE TABLE IF NOT EXISTS budget_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idle_config (
      sandbox_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      idle_timeout_seconds INTEGER NOT NULL,
      grace_seconds INTEGER NOT NULL,
      stable_seconds INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      uri TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,        -- system / dockerfile / pull
      size TEXT,
      scan TEXT DEFAULT 'pass',    -- pass / warn / fail
      refs INTEGER DEFAULT 0,
      system INTEGER DEFAULT 0,
      created INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      desc TEXT,
      category TEXT,
      version TEXT,
      install TEXT,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_uri TEXT NOT NULL,
      size TEXT,                    -- small/medium/large/xlarge
      cpu INTEGER,
      mem INTEGER,
      tools TEXT,                   -- 逗号分隔
      tags TEXT,                    -- 逗号分隔
      desc TEXT,
      updated INTEGER NOT NULL
    );
  `)
  // 默认预算/配额（首次启动）
  const ensure = d.prepare('INSERT OR IGNORE INTO budget_config(key, value) VALUES(?, ?)')
  ensure.run('budget_monthly', '2000')
  ensure.run('quota_instances', '20')
  ensure.run('quota_cpu', '64')
  ensure.run('quota_memory_mib', '131072')
  ensure.run('quota_gpu', '4')
  ensure.run('quota_storage_gb', '500')
  // 系统设置默认值
  ensure.run('def_idle_timeout', '300')
  ensure.run('def_max_lifetime', '24')
  ensure.run('def_egress', 'allowlist')
  ensure.run('def_docker_cli', '0')
  ensure.run('def_snap_ttl', '14')
  // 默认系统底座镜像
  const ensureImg = d.prepare('INSERT OR IGNORE INTO images(uri, name, source, size, scan, refs, system, created) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
  ensureImg.run('agent-base', 'Standard Agent Base', 'system', '1.1 GB', 'pass', 0, 1, Date.now())
  // 默认工具集
  const ensureTool = d.prepare('INSERT OR IGNORE INTO tools(id, name, desc, category, version, install, enabled) VALUES(?, ?, ?, ?, ?, ?, ?)')
  ensureTool.run('git', 'Git', '版本控制系统', 'DevOps', '2.43', 'apt', 1)
  ensureTool.run('curl', 'cURL', '网络请求工具', 'Network', '8.4', 'apt', 1)
  ensureTool.run('jq', 'jq', '轻量级 JSON 处理工具', 'Utility', '1.7', 'apt', 1)
  ensureTool.run('python-pip', 'Python pip', 'Python 包管理器', 'DevOps', '23.3', 'apt', 1)
  ensureTool.run('docker-cli', 'Docker CLI', 'DooD 交互客户端（高权限）', 'DevOps', '24.0', 'apt', 0)
}

// ---- 配置读写 ----
export function getConfig(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM budget_config WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}
export function setConfig(key: string, value: string): void {
  getDb().prepare('INSERT INTO budget_config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value)
}
