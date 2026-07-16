// Lifecycle 路由：按 config.mock 在 real / mock backend 间切换，前端无感知。
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { SandboxInfo } from '@alibaba-group/opensandbox'
import { loadConfig } from '../config.js'
import { probeReal, realBackend, type LifecycleBackend } from './backend.js'
import { mockBackend } from './mockBackend.js'
import { getResources } from './resourceStore.js'
import { getRestoredBy, getForkCount } from './lineageStore.js'
import { activeCost } from '../control/costStore.js'
import { checkQuota, recordEvent } from '../control/control.js'
import { recordImageIfNew } from '../control/catalog.js'
import { configureIdle } from '../control/idleWatcher.js'

export function getBackend(): LifecycleBackend {
  return loadConfig().mock ? mockBackend : realBackend
}

// OSB getSandboxInfo 不回传 resourceLimits，BFF 从 resourceStore 关联回返回数据，
// 让前端详情页能展示 CPU/内存/GPU 限额。同时注入 forkCount + 累计花费（控制面自有）。
function withResources(sb: SandboxInfo): SandboxInfo & {
  resourceLimits?: Record<string, string>
  forkCount?: number
  cost?: number
} {
  const rec = getResources(sb.id)
  const fc = getForkCount(sb.id)
  const cost = activeCost(sb.id)
  return { ...sb, resourceLimits: rec?.resourceLimits, forkCount: fc || undefined, cost: cost ?? undefined }
}

/** 健康探测：mock 模式直接返回 ok；真实模式尝试 listSandboxInfos 一页。 */
export async function probeLifecycle(): Promise<{ ok: boolean; count?: number; error?: string; mock: boolean }> {
  if (loadConfig().mock) return { ok: true, count: mockCount(), mock: true }
  const r = await probeReal()
  return { ...r, mock: false }
}

// mock 模式下 /health/osb 不必真读 store，给个静态计数即可
function mockCount(): number {
  return 6
}

export function registerLifecycleRoutes(app: Hono): void {
  // 列出沙箱（透传 state/metadata 过滤与分页）
  app.get('/api/lifecycle/sandboxes', async (c) => {
    try {
      const q = c.req.query()
      const states = q.state ? q.state.split(',') : undefined
      const metadata = q.metadata ? parseMetadataFilter(q.metadata) : undefined
      const page = q.page ? parseInt(q.page, 10) : undefined
      const pageSize = q.pageSize ? parseInt(q.pageSize, 10) : undefined
      const res = await getBackend().list({ states, metadata, page, pageSize })
      return c.json({ ...res, items: res.items.map(withResources) })
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  // 创建沙箱
  app.post('/api/lifecycle/sandboxes', async (c) => {
    try {
      const body = await c.req.json()
      // 配额校验（控制面自有，超限 409）
      if (body.resourceLimits) checkQuota(body.resourceLimits)
      const res = await getBackend().create(body)
      // 记录创建事件
      recordEvent(res.id, 'Creating', 'user_create', 'Sandbox creation requested', 'Normal')
      // 镜像自动入库（控制面资产记录）
      if (body.image?.uri) recordImageIfNew(body.image.uri)
      // 若启用 idle 治理，落配置（BFF idleWatcher 据此 auto-pause）
      configureIdle(res.id, body.metadata)
      return c.json(res, 201)
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  // 获取单个沙箱详情
  app.get('/api/lifecycle/sandboxes/:id', async (c) => {
    try {
      const res = await getBackend().get(c.req.param('id'))
      return c.json(withResources(res))
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  // 生命周期操作
  app.post('/api/lifecycle/sandboxes/:id/pause', async (c) => {
    try { await getBackend().pause(c.req.param('id')); recordEvent(c.req.param('id'), 'Pausing', 'user_pause', 'Pause requested', 'Normal'); return c.json({ ok: true }) } catch (e) { return errorResponse(c, e) }
  })
  app.post('/api/lifecycle/sandboxes/:id/resume', async (c) => {
    try { await getBackend().resume(c.req.param('id')); recordEvent(c.req.param('id'), 'Resuming', 'user_resume', 'Resume requested', 'Normal'); return c.json({ ok: true }) } catch (e) { return errorResponse(c, e) }
  })
  app.delete('/api/lifecycle/sandboxes/:id', async (c) => {
    try { await getBackend().kill(c.req.param('id')); recordEvent(c.req.param('id'), 'Deleting', 'user_delete', 'Termination requested', 'Normal'); return c.json({ ok: true }) } catch (e) { return errorResponse(c, e) }
  })
  app.patch('/api/lifecycle/sandboxes/:id/metadata', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}))
      const res = await getBackend().patchMetadata(c.req.param('id'), body)
      return c.json(res)
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  // 快照
  app.get('/api/lifecycle/snapshots', async (c) => {
    try {
      const q = c.req.query()
      const res = await getBackend().listSnapshots(q.sandboxId, q.page ? parseInt(q.page, 10) : undefined, q.pageSize ? parseInt(q.pageSize, 10) : undefined)
      return c.json(res)
    } catch (e) {
      return errorResponse(c, e)
    }
  })
  app.post('/api/lifecycle/sandboxes/:id/snapshots', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}))
      const res = await getBackend().createSnapshot(c.req.param('id'), body.name)
      return c.json(res)
    } catch (e) {
      return errorResponse(c, e)
    }
  })
  app.delete('/api/lifecycle/snapshots/:id', async (c) => {
    try { await getBackend().deleteSnapshot(c.req.param('id')); return c.json({ ok: true }) } catch (e) { return errorResponse(c, e) }
  })

  // Fork 血缘：某 sandbox 的 snapshots + 每个 snapshot 恢复出的实例（派生分支）
  app.get('/api/lifecycle/lineage/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const { items } = await getBackend().listSnapshots(id)
      const forks = items.flatMap((snap) =>
        getRestoredBy(snap.id).map((sid) => ({ snapshotId: snap.id, sandboxId: sid })),
      )
      return c.json({ snapshots: items, forks })
    } catch (e) {
      return errorResponse(c, e)
    }
  })
}

// lifecycle API 的 metadata 过滤参数是 "k=v&k2=v2" 单串，反解为对象
function parseMetadataFilter(raw: string): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const part of raw.split('&')) {
    const [k, v] = part.split('=')
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
  }
  return Object.keys(out).length ? out : undefined
}

// mock backend 抛的 Error 带 status 字段（404/409），透传为对应 HTTP 码；其余 502。
function errorResponse(c: Context, e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  const status = (e as { status?: number })?.status
  if (status === 404) return c.json({ code: 'NOT_FOUND', message }, 404)
  if (status === 409) return c.json({ code: 'CONFLICT', message }, 409)
  return c.json({ code: 'BFF_LIFECYCLE_ERROR', message }, 502)
}
