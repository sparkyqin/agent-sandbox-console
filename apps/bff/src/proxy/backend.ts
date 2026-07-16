// Lifecycle backend 抽象：real（SDK）与 mock 两个实现都满足此接口。
// 路由层按 config.mock 选择，前端无感知。
import { Sandbox, SandboxManager } from '@alibaba-group/opensandbox'
import type {
  CreateSandboxRequest,
  ListSandboxesResponse,
  SandboxId,
  SandboxInfo,
  SandboxMetadataPatch,
  SnapshotInfo,
} from '@alibaba-group/opensandbox'
import { loadConfig } from '../config.js'
import { forgetResources, recordResources } from './resourceStore.js'
import { forgetLineage, recordRestore, recordSnapshotSource } from './lineageStore.js'
import { startCostTracking, settleCost } from '../control/costStore.js'

// resourceLimits cpu "2000m" → 2 核
function cpuCoresFromLimits(limits?: Record<string, string>): number {
  const raw = limits?.cpu
  if (!raw) return 2
  return raw.endsWith('m') ? parseInt(raw, 10) / 1000 : parseInt(raw, 10) || 2
}

export interface ListParams {
  states?: string[]
  metadata?: Record<string, string>
  page?: number
  pageSize?: number
}

/** 创建结果：只需 id（状态由前端轮询 GET 获取，与 OSB 的 202 语义一致）。 */
export interface CreateResult {
  id: SandboxId
}

export interface LifecycleBackend {
  list(params: ListParams): Promise<ListSandboxesResponse>
  get(id: SandboxId): Promise<SandboxInfo>
  create(req: CreateSandboxRequest): Promise<CreateResult>
  pause(id: SandboxId): Promise<void>
  resume(id: SandboxId): Promise<void>
  kill(id: SandboxId): Promise<void>
  patchMetadata(id: SandboxId, patch: SandboxMetadataPatch): Promise<SandboxInfo>
  listSnapshots(sandboxId?: string, page?: number, pageSize?: number): Promise<{ items: SnapshotInfo[] }>
  createSnapshot(id: SandboxId, name?: string): Promise<SnapshotInfo>
  deleteSnapshot(id: string): Promise<void>
}

let manager: SandboxManager | null = null

function getManager(): SandboxManager {
  if (manager) return manager
  const cfg = loadConfig()
  manager = SandboxManager.create({
    connectionConfig: { domain: cfg.osbDomain, protocol: cfg.osbProtocol, apiKey: cfg.osbApiKey },
  })
  return manager
}

/** 健康探测：真实模式下尝试 listSandboxInfos 一页，验证链路可达。 */
export async function probeReal(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const res = await getManager().listSandboxInfos({ pageSize: 1 })
    return { ok: true, count: res.pagination?.totalItems }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export const realBackend: LifecycleBackend = {
  async list(params) {
    return getManager().listSandboxInfos({
      states: params.states,
      metadata: params.metadata,
      page: params.page,
      pageSize: params.pageSize,
    })
  },
  async get(id) { return getManager().getSandboxInfo(id) },
  async create(req) {
    // 用 SDK 的 Sandbox.create，skipHealthCheck 避免阻塞就绪（前端轮询 GET 跟踪状态）。
    // 创建失败时 SDK 会自动清理已分配的 sandbox（见 sandbox.ts catch 块）。
    const cfg = loadConfig()
    const sbx = await Sandbox.create({
      connectionConfig: { domain: cfg.osbDomain, protocol: cfg.osbProtocol, apiKey: cfg.osbApiKey },
      skipHealthCheck: true,
      image: req.image ? { uri: req.image.uri, auth: req.image.auth as { username: string; password: string } | undefined } : undefined,
      snapshotId: req.snapshotId,
      entrypoint: req.entrypoint,
      env: req.env,
      metadata: req.metadata,
      networkPolicy: req.networkPolicy,
      credentialProxy: req.credentialProxy,
      volumes: req.volumes,
      extensions: req.extensions as Record<string, string> | undefined,
      platform: req.platform,
      secureAccess: req.secureAccess,
      resource: req.resourceLimits,
      resourceRequests: req.resourceRequests,
      timeoutSeconds: req.timeout ?? undefined,
    })
    await sbx.close()
    // 落库 resourceLimits（详情页回填；OSB getSandboxInfo 不回传 limits）
    if (req.resourceLimits) recordResources(sbx.id, req.resourceLimits)
    // 若是 snapshot 恢复，落 lineage（Fork 血缘树需要逆向关系）
    if (req.snapshotId) recordRestore(req.snapshotId, sbx.id)
    // 起算成本（按规格单价×时长）
    startCostTracking(sbx.id, req.metadata?.project ?? 'default', cpuCoresFromLimits(req.resourceLimits))
    return { id: sbx.id }
  },
  async pause(id) { return getManager().pauseSandbox(id) },
  async resume(id) { return getManager().resumeSandbox(id) },
  async kill(id) {
    await getManager().killSandbox(id)
    forgetResources(id)
    forgetLineage(id)
    settleCost(id)
  },
  async patchMetadata(id, patch) { return getManager().patchSandboxMetadata(id, patch) },
  async listSnapshots(sandboxId, page, pageSize) {
    return getManager().listSnapshots({ sandboxId, page, pageSize })
  },
  async createSnapshot(id, name) {
    const snap = await getManager().createSnapshot(id, name ? { name } : {})
    recordSnapshotSource(snap.id, id)
    return snap
  },
  async deleteSnapshot(id) { return getManager().deleteSnapshot(id) },
}
