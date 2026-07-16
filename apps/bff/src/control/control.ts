// 控制面自有路由：成本/预算、配额、事件。OpenSandbox 不提供这些，纯 BFF 自有。
import type { Hono } from 'hono'
import type { Context } from 'hono'
import { getCostSummary } from './costStore.js'
import { getConfig, setConfig, getDb } from '../db.js'
import { forEachResource } from '../proxy/resourceStore.js'

export function registerControlRoutes(app: Hono): void {
  // ---- 成本 ----
  app.get('/api/control/cost', (c) => {
    try {
      return c.json(getCostSummary())
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  app.patch('/api/control/budget', async (c) => {
    try {
      const { budgetMonthly } = await c.req.json<{ budgetMonthly: number }>()
      if (typeof budgetMonthly !== 'number' || budgetMonthly < 0) {
        return c.json({ code: 'INVALID_REQUEST', message: 'budgetMonthly must be >= 0' }, 400)
      }
      setConfig('budget_monthly', String(budgetMonthly))
      return c.json({ ok: true })
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  // ---- 配额 ----
  app.get('/api/control/quota', (c) => {
    try {
      return c.json(getQuotaUsage())
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  app.patch('/api/control/quota', async (c) => {
    try {
      const body = await c.req.json<Record<string, number>>()
      for (const [k, v] of Object.entries(body)) {
        if (k.startsWith('quota_') && typeof v === 'number') setConfig(k, String(v))
      }
      return c.json({ ok: true })
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  // ---- 事件 ----
  app.get('/api/control/events/:id', (c) => {
    try {
      const rows = getDb().prepare(
        'SELECT state, reason, message, type, ts FROM lifecycle_events WHERE sandbox_id = ? ORDER BY ts DESC LIMIT 200',
      ).all(c.req.param('id')) as { state: string; reason: string | null; message: string | null; type: string | null; ts: number }[]
      return c.json({ items: rows.map((r) => ({ ...r, t: new Date(r.ts).toISOString().slice(11, 19) })) })
    } catch (e) {
      return errorResponse(c, e)
    }
  })
}

/** 当前配额用量：遍历 resourceStore 算实际占用 vs 配置上限。 */
export function getQuotaUsage() {
  const usage = aggregateUsage()
  return {
    limit: {
      instances: parseInt(getConfig('quota_instances') || '20', 10),
      cpu: parseInt(getConfig('quota_cpu') || '64', 10),
      memory: parseInt(getConfig('quota_memory_mib') || '131072', 10),
      gpu: parseInt(getConfig('quota_gpu') || '4', 10),
      storage: parseInt(getConfig('quota_storage_gb') || '500', 10),
    },
    used: { ...usage, storage: 0 },
  }
}

/** 配额校验：创建时调用，超限抛 409。 */
export function checkQuota(newLimits: Record<string, string>): void {
  const limit = {
    instances: parseInt(getConfig('quota_instances') || '20', 10),
    cpu: parseInt(getConfig('quota_cpu') || '64', 10),
    memory: parseInt(getConfig('quota_memory_mib') || '131072', 10),
    gpu: parseInt(getConfig('quota_gpu') || '4', 10),
  }
  const usage = aggregateUsage() // 遍历当前所有实例
  const addCpu = newLimits.cpu ? (newLimits.cpu.endsWith('m') ? parseInt(newLimits.cpu, 10) / 1000 : parseInt(newLimits.cpu, 10)) : 0
  const addMem = parseMem(newLimits.memory)
  const addGpu = newLimits.gpu && newLimits.gpu !== '0' ? parseInt(newLimits.gpu, 10) : 0

  if (usage.instances + 1 > limit.instances) throw quotaError('instances', usage.instances + 1, limit.instances)
  if (usage.cpu + addCpu > limit.cpu) throw quotaError('cpu', usage.cpu + addCpu, limit.cpu)
  if (usage.memory + addMem > limit.memory) throw quotaError('memory', usage.memory + addMem, limit.memory)
  if (usage.gpu + addGpu > limit.gpu) throw quotaError('gpu', usage.gpu + addGpu, limit.gpu)
}

// 遍历 resourceStore 算当前占用。
function aggregateUsage() {
  const u = { instances: 0, cpu: 0, memory: 0, gpu: 0 }
  forEachResource((id, rec) => {
    u.instances += 1
    u.cpu += rec.resourceLimits.cpu ? (rec.resourceLimits.cpu.endsWith('m') ? parseInt(rec.resourceLimits.cpu, 10) / 1000 : parseInt(rec.resourceLimits.cpu, 10)) : 0
    u.memory += parseMem(rec.resourceLimits.memory)
    u.gpu += rec.resourceLimits.gpu && rec.resourceLimits.gpu !== '0' ? parseInt(rec.resourceLimits.gpu, 10) : 0
  })
  return u
}

function parseMem(raw?: string): number {
  if (!raw) return 0
  const m = raw.match(/^([\d.]+)(Ki|Mi|Gi|Ti)?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = m[2] ?? 'Mi'
  const toMi = { Ki: 1 / 1024, Mi: 1, Gi: 1024, Ti: 1024 * 1024 }[unit] ?? 1
  return Math.round(n * toMi)
}

function quotaError(dim: string, used: number, limit: number): Error {
  return Object.assign(new Error(`quota exceeded: ${dim} ${used} > ${limit}`), { status: 409, code: 'QUOTA_EXCEEDED' })
}

/** 记录生命周期事件（供状态变化时调用，DetailEvents 展示）。 */
export function recordEvent(sandboxId: string, state: string, reason: string, message: string, type: 'Normal' | 'Warning'): void {
  try {
    getDb().prepare(
      'INSERT INTO lifecycle_events(sandbox_id, state, reason, message, type, ts) VALUES(?, ?, ?, ?, ?, ?)',
    ).run(sandboxId, state, reason, message, type, Date.now())
  } catch { /* db 不可用时静默，不阻塞主流程 */ }
}

/** 系统设置：默认值读写（生命周期/安全/快照默认）。 */
export function registerSettingsRoutes(app: Hono): void {
  app.get('/api/control/settings', (c) => {
    return c.json({
      def_idle_timeout: parseInt(getConfig('def_idle_timeout') || '300', 10),
      def_max_lifetime: parseInt(getConfig('def_max_lifetime') || '24', 10),
      def_egress: getConfig('def_egress') || 'allowlist',
      def_docker_cli: getConfig('def_docker_cli') === '1',
      def_snap_ttl: parseInt(getConfig('def_snap_ttl') || '14', 10),
      def_snap_fallback: getConfig('def_snap_fallback') !== '0', // 默认 true
      def_hibernate: getConfig('def_hibernate') !== '0',          // 默认 true
      def_prewarm: getConfig('def_prewarm') !== '0',               // 默认 true
    })
  })
  app.patch('/api/control/settings', async (c) => {
    try {
      const body = await c.req.json<Record<string, string | number | boolean>>()
      const map: Record<string, string> = {
        def_idle_timeout: String(body.def_idle_timeout ?? ''),
        def_max_lifetime: String(body.def_max_lifetime ?? ''),
        def_egress: String(body.def_egress ?? ''),
        def_docker_cli: body.def_docker_cli ? '1' : '0',
        def_snap_ttl: String(body.def_snap_ttl ?? ''),
        def_snap_fallback: body.def_snap_fallback === false ? '0' : '1',
        def_hibernate: body.def_hibernate === false ? '0' : '1',
        def_prewarm: body.def_prewarm === false ? '0' : '1',
      }
      for (const [k, v] of Object.entries(map)) {
        if (v !== '' && v !== undefined) setConfig(k, v)
      }
      return c.json({ ok: true })
    } catch (e) {
      return errorResponse(c, e)
    }
  })
}

function errorResponse(c: Context, e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  const status = ((e as { status?: number })?.status ?? 502) as 400 | 404 | 409 | 502
  return c.json({ code: (e as { code?: string })?.code ?? 'BFF_CONTROL_ERROR', message }, status)
}
