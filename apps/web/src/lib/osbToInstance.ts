// OSB SandboxInfo → 原型 Instance 形状的映射。
// 原型 Instance 有很多字段（实时 cpu/mem、cost、forks、restarts…）在阶段1 拿不到，
// 这些降级为占位值，由后续阶段（3=metrics、4=forks、5=cost）逐步填充真实来源。
import { mapOsbState } from './stateMap'
import type { Instance, InstanceStatus } from './types'
import type { OsbSandbox } from '../api/sandboxes'

// metadata 里约定 key（BFF 创建时落库，前端读取）
const META_NAME = 'name'
const META_PROJECT = 'project'
const META_OWNER = 'owner'
const META_REGION = 'region'

function uptimeFromCreated(createdAt: string | Date | undefined): string {
  if (!createdAt) return '—'
  const t = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime()
  if (Number.isNaN(t)) return '—'
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMin = mins % 60
  if (hrs < 24) return `${hrs}h ${remMin}m`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h`
}

// 解析 OSB resourceLimits（cpu "2000m" → 2 核，memory "4Gi" → 4096 MiB，gpu "1" → 标志）。
// BFF 从 resourceStore 注入；mock 初始数据无 resourceLimits 时降级。
function parseLimits(limits?: Record<string, string>): { cpuReq: number; memReq: number; gpu: string } {
  if (!limits) return { cpuReq: 0, memReq: 0, gpu: 'none' }
  const cpuRaw = limits.cpu ?? '0'
  const cpuReq = cpuRaw.endsWith('m') ? parseInt(cpuRaw, 10) / 1000 : parseInt(cpuRaw, 10) || 0

  const memRaw = limits.memory ?? '0'
  let memReq = 0
  const m = memRaw.match(/^([\d.]+)(Ki|Mi|Gi|Ti)?$/)
  if (m) {
    const n = parseFloat(m[1])
    const unit = m[2] ?? 'Mi'
    const toMi = { Ki: 1 / 1024, Mi: 1, Gi: 1024, Ti: 1024 * 1024 }[unit] ?? 1
    memReq = Math.round(n * toMi)
  }

  const gpu = limits.gpu && limits.gpu !== '0' ? 'A100' : 'none'
  return { cpuReq, memReq, gpu }
}

function statusHint(status: InstanceStatus): { hint: string; hintKind: Instance['hintKind'] } {
  switch (status) {
    case 'running': return { hint: '运行中', hintKind: 'auto' }
    case 'creating': return { hint: '创建/恢复中…', hintKind: 'auto' }
    case 'paused': return { hint: '已暂停 · 状态保留', hintKind: 'auto' }
    case 'hibernating': return { hint: 'idle 下沉休眠 · 内存已落盘', hintKind: 'auto' }
    case 'error': return { hint: '运行异常 · 需人工介入', hintKind: 'alert' }
    case 'terminated': return { hint: '已销毁', hintKind: 'auto' }
    default: return { hint: '', hintKind: 'auto' }
  }
}

export function osbToInstance(sb: OsbSandbox): Instance {
  const meta = sb.metadata ?? {}
  const tags = meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  const status = mapOsbState(sb.status.state)
  const { hint, hintKind } = statusHint(status)

  return {
    id: sb.id,
    name: meta.name ?? sb.id,
    status,
    image: sb.image?.uri ?? (sb.snapshotId ? `snapshot:${sb.snapshotId}` : '—'),
    base: 'OpenSandbox',
    // 实时 cpu/mem 来自 execd metrics（阶段3）；阶段1 暂无，降级为 0
    cpu: 0,
    mem: 0,
    // OpenSandbox 不回传 restarts（阶段5 BFF 事件聚合补）
    restarts: 0,
    ready: status === 'running' ? '1/1' : '0/1',
    uptime: status === 'terminated' ? '—' : uptimeFromCreated(sb.createdAt),
    region: meta.region ?? '—',
    owner: meta.owner ?? '—',
    project: meta.project ?? '—',
    // 累计花费由 BFF costStore 计算（运行中实例实时累加，已结束实例从 SQLite 结算）
    cost: sb.cost != null ? `¥${sb.cost.toFixed(2)}` : '—',
    tags,
    created: typeof sb.createdAt === 'string' ? sb.createdAt.slice(0, 16).replace('T', ' ') : '—',
    // resourceLimits 由 BFF 从 resourceStore 注入（OSB getSandboxInfo 不回传）
    ...parseLimits(sb.resourceLimits),
    ports: [],
    url: '',
    hint,
    hintKind,
    // forks 数量来自 BFF lineageStore（forkCount）；具体分支名在详情页血缘树展示
    forks: sb.forkCount ? Array.from({ length: sb.forkCount }, (_, i) => ({ name: `fork-${i + 1}`, ago: '', adopted: false })) : undefined,
  }
}
