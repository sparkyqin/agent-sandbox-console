// BFF 主入口：Hono 应用，挂载 lifecycle 透传路由 + 健康检查 + 控制面自有路由（后续阶段）。
// 优先加载 .env（Node 20.6+ 内置 process.loadEnvFile，无需 dotenv 依赖）。文件不存在时静默跳过。
import process from 'node:process'
// .env 在 monorepo 根目录（agentsandbox/.env），BFF 源码在 apps/bff/src/，需上三级。
try { process.loadEnvFile(new URL('../../../.env', import.meta.url)) } catch { /* .env 可选 */ }

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { loadConfig } from './config.js'
import { probeLifecycle, registerLifecycleRoutes } from './proxy/lifecycle.js'
import { registerExecdRoutes } from './proxy/execd.js'
import { registerControlRoutes, registerSettingsRoutes } from './control/control.js'
import { registerCatalogRoutes } from './control/catalog.js'
import { startIdleWatcher } from './control/idleWatcher.js'
import { getDb } from './db.js'

const app = new Hono()

// 开发期允许 vite (5173) 跨域访问 BFF (8787)。生产同源可收紧。
app.use('*', cors({ origin: (origin) => origin ?? '*', credentials: true }))

// 健康检查：BFF 自身存活
app.get('/health', (c) => c.json({ ok: true, service: 'agentsandbox-bff' }))

// BFF→OpenSandbox 链路探测（前端「系统设置」页可用此验证连接配置）
app.get('/health/osb', async (c) => c.json(await probeLifecycle()))

// Lifecycle 透传
registerLifecycleRoutes(app)

// Execd 桥接（metrics/logs SSE + 命令执行）
registerExecdRoutes(app)

// 控制面自有路由（成本/配额/事件，OpenSandbox 不提供）
// 提前初始化 DB，确保表存在且默认配置就绪
getDb()
registerControlRoutes(app)

// Idle 治理 watcher（auto-stop：基于资源活动的两窗口判定，OpenSandbox 不提供）
startIdleWatcher()

// 目录路由（镜像/工具/模板，控制面资产）
registerCatalogRoutes(app)

// 系统设置路由（默认值读写）
registerSettingsRoutes(app)

// 控制面自有路由（阶段 5 实现：成本/配额/事件/idle），先占位
// app.route('/api/control', controlApp)

const config = loadConfig()
serve({ fetch: app.fetch, port: config.bffPort }, (info) => {
  console.log(`[BFF] listening on http://localhost:${info.port}`)
  if (config.mock) {
    console.log(`[BFF] MOCK 模式（内存假数据，无真实 OpenSandbox）`)
  } else {
    console.log(`[BFF] OpenSandbox → ${config.osbProtocol}://${config.osbDomain}`)
  }
  console.log(`[BFF] DB → ${config.dbPath}`)
})
