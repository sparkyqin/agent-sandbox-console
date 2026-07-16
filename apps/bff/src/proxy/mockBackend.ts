// Mock lifecycle backend：无真实 OpenSandbox 时返回符合 SDK SandboxInfo 形状的内存假数据。
// pause/resume/kill 真实修改内存状态并模拟 OSB 的异步转换（Pausing→Paused 等），
// 让前端的状态机、轮询、操作反馈都能被验证。前端代码与真实模式零差异。
import type {
  CreateSandboxRequest,
  ListSandboxesResponse,
  SandboxId,
  SandboxInfo,
  SandboxMetadataPatch,
  SnapshotInfo,
} from '@alibaba-group/opensandbox'
import type { LifecycleBackend, ListParams, CreateResult } from './backend.js'
import { recordResources, forgetResources } from './resourceStore.js'
import { recordRestore, recordSnapshotSource, forgetLineage, forgetSnapshot } from './lineageStore.js'
import { startCostTracking, settleCost } from '../control/costStore.js'

// resourceLimits cpu "2000m" → 2 核（与 backend.ts 同）
function cpuCoresFromLimits(limits?: Record<string, string>): number {
  const raw = limits?.cpu
  if (!raw) return 2
  return raw.endsWith('m') ? parseInt(raw, 10) / 1000 : parseInt(raw, 10) || 2
}

// 用 SDK 的状态枚举（见 models/sandboxes.ts SandboxState）：
// Creating / Running / Pausing / Paused / Resuming / Deleting / Deleted / Error
interface MockSandbox extends SandboxInfo {}

const now = () => new Date()
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

let seq = 6
function mk(
  id: string,
  name: string,
  state: SandboxInfo['status']['state'],
  meta: Record<string, string>,
  createdAt: Date,
  opts: Partial<MockSandbox> = {},
): MockSandbox {
  return {
    id,
    image: { uri: meta.imageUri || 'python:3.11' },
    entrypoint: ['python', '/app/main.py'],
    metadata: { name, ...meta },
    status: { state, reason: reasonFor(state), message: msgFor(state) },
    createdAt,
    expiresAt: new Date(Date.now() + 3600_000),
    ...opts,
  }
}

function reasonFor(state: string): string {
  return {
    Creating: 'provisioning',
    Running: 'running',
    Pausing: 'user_pause',
    Paused: 'paused',
    Resuming: 'user_resume',
    Deleting: 'user_delete',
    Deleted: 'terminated',
    Error: 'runtime_error',
  }[state] || state.toLowerCase()
}

function msgFor(state: string): string {
  return {
    Creating: 'Sandbox is being provisioned',
    Running: 'Sandbox is running and ready',
    Pausing: 'Pause requested, transitioning',
    Paused: 'Paused while retaining state',
    Resuming: 'Resume requested, transitioning',
    Deleting: 'Termination requested',
    Deleted: 'Sandbox has been terminated',
    Error: 'Sandbox encountered a critical error',
  }[state] || state
}

// 初始数据刻意覆盖原型里的多种状态，便于验证前端状态映射与过滤。
const store: MockSandbox[] = [
  mk('sbx-001', 'agent-sandbox-001', 'Running', { project: 'codegen', owner: 'Admin', region: 'cn-east-1', imageUri: 'cpp-build:v3', tags: 'prod,codegen' }, minutesAgo(134)),
  mk('sbx-002', 'data-pipeline-runner', 'Running', { project: 'etl', owner: 'DataTeam', region: 'cn-east-1', imageUri: 'data:v7', tags: 'prod,etl' }, minutesAgo(302)),
  mk('sbx-003', 'research-agent-dev', 'Paused', { project: 'research', owner: 'Rex', region: 'cn-east-2', imageUri: 'node-full:v5', tags: 'dev' }, minutesAgo(1430)),
  mk('sbx-004', 'gpu-inference-bench', 'Error', { project: 'inference', owner: 'MLLab', region: 'cn-east-2', imageUri: 'cpp-build:v3', tags: 'bench,gpu' }, minutesAgo(40)),
  mk('sbx-005', 'scratch-test-77', 'Deleted', { project: 'scratch', owner: 'Admin', region: 'cn-east-1', imageUri: 'python:3.11', tags: 'test' }, minutesAgo(2880)),
  mk('sbx-006', 'doc-translation', 'Paused', { project: 'docs', owner: 'Rex', region: 'cn-east-1', imageUri: 'data:v7', tags: 'dev,docs' }, minutesAgo(235)),
]

// 初始数据落 resourceLimits，让详情页能回填 CPU/内存/GPU 限额（验证 resourceStore 注入）。
// sbx-004 带 GPU，对应原型 XLarge 档。
const initialLimits: Record<string, Record<string, string>> = {
  'sbx-001': { cpu: '2000m', memory: '4Gi' },
  'sbx-002': { cpu: '4000m', memory: '8Gi' },
  'sbx-003': { cpu: '2000m', memory: '4Gi' },
  'sbx-004': { cpu: '8000m', memory: '16Gi', gpu: '1' },
  'sbx-005': { cpu: '1000m', memory: '2Gi' },
  'sbx-006': { cpu: '2000m', memory: '4Gi' },
}
for (const [id, limits] of Object.entries(initialLimits)) {
  recordResources(id, limits)
  // 起算成本：按初始数据各自的 project + 已运行时长（让花费有合理初值）
  const sb = store.find((s) => s.id === id)
  if (sb) startCostTracking(id, sb.metadata?.project ?? 'default', cpuCoresFromLimits(limits))
}

const snapshots: SnapshotInfo[] = []

function paginate<T>(items: T[], page = 1, pageSize = 20) {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const p = Math.min(Math.max(1, page), totalPages)
  const start = (p - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: { page: p, pageSize, totalItems, totalPages, hasNextPage: p < totalPages },
  }
}

// 模拟 OSB 异步状态转换：操作后先进入中间态，短延迟后落到终态。
// 前端轮询（refreshInterval）会观察到这个转换，验证状态机渲染。
function scheduleTransition(id: string, intermediate: SandboxInfo['status']['state'], final: SandboxInfo['status']['state'], delayMs: number) {
  setTimeout(() => {
    const sb = store.find((s) => s.id === id)
    if (!sb || sb.status.state === 'Deleted') return
    // 若期间状态又被别的操作改了（如先 pause 再 kill），不覆盖 Deleting/Deleted
    if (sb.status.state === intermediate || (intermediate === 'Pausing' && sb.status.state === 'Running') || (intermediate === 'Resuming' && sb.status.state === 'Paused')) {
      sb.status = { state: final, reason: reasonFor(final), message: msgFor(final) }
    }
  }, delayMs)
}

export const mockBackend: LifecycleBackend = {
  async list(params: ListParams): Promise<ListSandboxesResponse> {
    let items = store.slice()
    if (params.states?.length) items = items.filter((s) => params.states!.includes(s.status.state))
    if (params.metadata) {
      for (const [k, v] of Object.entries(params.metadata)) {
        items = items.filter((s) => s.metadata?.[k] === v)
      }
    }
    // 已 Deleted 的默认也列出（前端可过滤），与 OSB 行为一致：list 返回所有未彻底回收的
    return paginate(items, params.page, params.pageSize)
  },

  async get(id: SandboxId): Promise<SandboxInfo> {
    const sb = store.find((s) => s.id === id)
    if (!sb) throw notFound(id)
    return sb
  },

  async create(req: CreateSandboxRequest): Promise<CreateResult> {
    // 校验：image 与 snapshotId 二选一（与 OSB 一致）。
    if ((req.image == null) === (req.snapshotId == null)) {
      throw conflict('request', 'exactly one of image or snapshotId must be provided')
    }
    const id = `sbx-${String(++seq).padStart(3, '0')}`
    const meta = { ...(req.metadata ?? {}) }
    const name = meta.name || `sandbox-${id}`
    const limits = req.resourceLimits ?? {}
    // 落库 resourceLimits（详情页回填 cpuReq/memReq/gpu）
    recordResources(id, limits)
    // 起算成本
    startCostTracking(id, meta.project, cpuCoresFromLimits(limits))

    const sb = mk(
      id,
      name,
      'Creating',
      meta,
      new Date(),
      {
        image: req.image ? { uri: req.image.uri } : undefined,
        snapshotId: req.snapshotId,
        entrypoint: req.entrypoint ?? ['tail', '-f', '/dev/null'],
        // OSB 创建返回 expiresAt（timeout 控制）；mock 也给一个
        expiresAt: req.timeout ? new Date(Date.now() + req.timeout * 1000) : null,
      },
    )
    // snapshotId 恢复的实例没有 image 字段
    if (req.snapshotId) {
      sb.image = undefined
      sb.snapshotId = req.snapshotId
      // 落 lineage（Fork 血缘树需要逆向关系）
      recordRestore(req.snapshotId, id)
    }
    store.unshift(sb)
    // 模拟 OSB 创建后异步进入 Running（前端轮询会观察到 Creating→Running）
    scheduleTransition(id, 'Creating', 'Running', 1500)
    return { id }
  },

  async pause(id: SandboxId): Promise<void> {
    const sb = store.find((s) => s.id === id)
    if (!sb) throw notFound(id)
    if (sb.status.state !== 'Running') throw conflict(id, `cannot pause from ${sb.status.state}`)
    sb.status = { state: 'Pausing', reason: 'user_pause', message: 'Pause requested, transitioning' }
    scheduleTransition(id, 'Pausing', 'Paused', 1200)
  },

  async resume(id: SandboxId): Promise<void> {
    const sb = store.find((s) => s.id === id)
    if (!sb) throw notFound(id)
    if (sb.status.state !== 'Paused') throw conflict(id, `cannot resume from ${sb.status.state}`)
    sb.status = { state: 'Resuming', reason: 'user_resume', message: 'Resume requested, transitioning' }
    scheduleTransition(id, 'Resuming', 'Running', 1200)
  },

  async kill(id: SandboxId): Promise<void> {
    const sb = store.find((s) => s.id === id)
    if (!sb) throw notFound(id)
    if (sb.status.state === 'Deleted') return
    sb.status = { state: 'Deleting', reason: 'user_delete', message: 'Termination requested' }
    scheduleTransition(id, 'Deleting', 'Deleted', 1200)
    // 状态落 Deleted 后清理 resource / lineage / 成本记录（延迟与状态转换一致）
    setTimeout(() => { forgetResources(id); forgetLineage(id); settleCost(id) }, 1300)
  },

  async patchMetadata(id: SandboxId, patch: SandboxMetadataPatch): Promise<SandboxInfo> {
    const sb = store.find((s) => s.id === id)
    if (!sb) throw notFound(id)
    sb.metadata = { ...(sb.metadata ?? {}) }
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete sb.metadata[k]
      else sb.metadata[k] = v
    }
    return sb
  },

  async listSnapshots(sandboxId): Promise<{ items: SnapshotInfo[] }> {
    const items = sandboxId ? snapshots.filter((s) => s.sandboxId === sandboxId) : snapshots.slice()
    return { items }
  },

  async createSnapshot(id: SandboxId, name?: string): Promise<SnapshotInfo> {
    const sb = store.find((s) => s.id === id)
    if (!sb) throw notFound(id)
    if (sb.status.state !== 'Running') throw conflict(id, 'snapshot requires Running state')
    const snap: SnapshotInfo = {
      id: `snap-${++seq}`,
      sandboxId: id,
      name,
      status: { state: 'Creating', reason: 'snapshot_accepted', message: 'Capture in progress' },
      createdAt: now(),
    }
    snapshots.push(snap)
    recordSnapshotSource(snap.id, id)
    setTimeout(() => {
      snap.status = { state: 'Ready', reason: 'snapshot_ready', message: 'Snapshot available', lastTransitionAt: now() }
    }, 1500)
    return snap
  },

  async deleteSnapshot(id: string): Promise<void> {
    const idx = snapshots.findIndex((s) => s.id === id)
    if (idx === -1) throw notFound(id)
    if (snapshots[idx].status.state === 'Creating') throw conflict(id, 'snapshot still creating')
    snapshots.splice(idx, 1)
    forgetSnapshot(id)
  },
}

function notFound(id: string): Error {
  return Object.assign(new Error(`sandbox ${id} not found`), { status: 404 })
}
function conflict(id: string, msg: string): Error {
  return Object.assign(new Error(`${id}: ${msg}`), { status: 409 })
}

/** 同步读取（供 mockExecdBackend 判断实例存活；不在 LifecycleBackend 接口内）。 */
export function getMockSandboxSync(id: string): MockSandbox | undefined {
  return store.find((s) => s.id === id)
}
