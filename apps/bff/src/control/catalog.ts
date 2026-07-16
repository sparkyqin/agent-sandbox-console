// 镜像/工具/模板目录路由。这些是控制面资产（OSB 不直接管），由 BFF SQLite 存储。
// 镜像在创建沙箱时自动入库（image uri）；工具为预置默认集；模板支持 CRUD + 一键创建。
import type { Hono } from 'hono'
import type { Context } from 'hono'
import { getDb } from '../db.js'
import { checkQuota, recordEvent } from './control.js'
import { getBackend } from '../proxy/lifecycle.js'
import { startCostTracking } from './costStore.js'

export function registerCatalogRoutes(app: Hono): void {
  // ---- 镜像 ----
  app.get('/api/catalog/images', (c) => {
    const rows = getDb().prepare('SELECT uri, name, source, size, scan, refs, system, created FROM images ORDER BY system DESC, created DESC')
      .all() as ImageRow[]
    return c.json({ items: rows })
  })

  // ---- 工具 ----
  app.get('/api/catalog/tools', (c) => {
    const rows = getDb().prepare('SELECT id, name, desc, category, version, install, enabled FROM tools ORDER BY enabled DESC, name')
      .all() as ToolRow[]
    return c.json({ items: rows })
  })
  app.patch('/api/catalog/tools/:id', async (c) => {
    const { enabled } = await c.req.json<{ enabled?: boolean }>()
    getDb().prepare('UPDATE tools SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, c.req.param('id'))
    return c.json({ ok: true })
  })

  // ---- 模板 ----
  app.get('/api/catalog/templates', (c) => {
    const rows = getDb().prepare('SELECT id, name, image_uri, size, cpu, mem, tools, tags, desc, updated FROM templates ORDER BY updated DESC')
      .all() as TemplateRow[]
    return c.json({ items: rows.map(templateFromRow) })
  })
  app.post('/api/catalog/templates', async (c) => {
    const body = await c.req.json<NewTemplate>()
    const id = `tpl-${Date.now().toString(36)}`
    getDb().prepare(
      'INSERT INTO templates(id, name, image_uri, size, cpu, mem, tools, tags, desc, updated) VALUES(?,?,?,?,?,?,?,?,?,?)',
    ).run(id, body.name, body.imageUri, body.size ?? 'medium', body.cpu ?? 2, body.mem ?? 4096, (body.tools ?? []).join(','), (body.tags ?? []).join(','), body.desc ?? '', Date.now())
    return c.json({ id }, 201)
  })
  app.delete('/api/catalog/templates/:id', (c) => {
    getDb().prepare('DELETE FROM templates WHERE id = ?').run(c.req.param('id'))
    return c.json({ ok: true })
  })

  // 从模板一键创建沙箱
  app.post('/api/catalog/templates/:id/create', async (c) => {
    const row = getDb().prepare('SELECT * FROM templates WHERE id = ?').get(c.req.param('id')) as TemplateRow | undefined
    if (!row) return c.json({ code: 'NOT_FOUND', message: 'template not found' }, 404)
    const limits: Record<string, string> = { cpu: `${(row.cpu ?? 2) * 1000}m`, memory: `${Math.max(1, Math.round((row.mem ?? 4096) / 1024))}Gi` }
    try {
      checkQuota(limits)
    } catch (e) {
      return c.json({ code: 'QUOTA_EXCEEDED', message: (e as Error).message }, 409)
    }
    const res = await getBackend().create({
      image: { uri: row.image_uri },
      entrypoint: ['tail', '-f', '/dev/null'],
      resourceLimits: limits,
      metadata: { name: `from-${row.id}`, project: 'default', tags: row.tags ?? '' },
    })
    recordEvent(res.id, 'Creating', 'template_create', `Created from template ${row.name}`, 'Normal')
    startCostTracking(res.id, 'default', row.cpu ?? 2)
    return c.json(res, 201)
  })
}

// 创建沙箱时调用：image uri 自动入库
export function recordImageIfNew(uri: string): void {
  if (!uri) return
  const existing = getDb().prepare('SELECT uri FROM images WHERE uri = ?').get(uri)
  if (!existing) {
    getDb().prepare('INSERT INTO images(uri, name, source, size, scan, refs, system, created) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uri, uri, 'pull', '', 'pass', 0, 0, Date.now())
  }
  getDb().prepare('UPDATE images SET refs = refs + 1 WHERE uri = ?').run(uri)
}

interface ImageRow { uri: string; name: string; source: string; size: string; scan: string; refs: number; system: number; created: number }
interface ToolRow { id: string; name: string; desc: string; category: string; version: string; install: string; enabled: number }
interface TemplateRow { id: string; name: string; image_uri: string; size: string; cpu: number; mem: number; tools: string; tags: string; desc: string; updated: number }
interface NewTemplate { name: string; imageUri: string; size?: string; cpu?: number; mem?: number; tools?: string[]; tags?: string[]; desc?: string }

function templateFromRow(r: TemplateRow) {
  return {
    id: r.id, name: r.name, imageUri: r.image_uri, size: r.size, cpu: r.cpu, mem: r.mem,
    tools: r.tools ? r.tools.split(',') : [], tags: r.tags ? r.tags.split(',') : [],
    desc: r.desc, updated: new Date(r.updated).toISOString().slice(0, 10),
  }
}
