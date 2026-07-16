// 实例数据层：经 BFF 调 OpenSandbox Lifecycle API。
// 阶段 0 已建好结构与 SWR key 约定；阶段 1 让 InstanceList/InstanceDetail 切换到这些 hook。
//
// 类型尽量贴近 SDK 的 SandboxInfo 形状（specs/sandbox-lifecycle.yml），但前端消费时
// 会经 lib/stateMap.ts 映射成原型 Instance 形态，故此处保留宽松类型。
import useSWR, { mutate } from 'swr'
import { api } from './client'

export interface OsbSandbox {
  id: string
  status: { state: string; reason?: string; message?: string; lastTransitionAt?: string }
  image?: { uri: string }
  snapshotId?: string
  metadata?: Record<string, string>
  entrypoint?: string[]
  expiresAt?: string | null
  createdAt: string
  /** BFF 从 resourceStore 注入（OSB getSandboxInfo 不回传 limits）。 */
  resourceLimits?: Record<string, string>
  /** BFF 从 lineageStore 注入（派生实例数，列表 Fork 角标用）。 */
  forkCount?: number
  /** BFF 控制面计算的累计花费（¥）。 */
  cost?: number
}

/** 创建沙箱请求体，对齐 SDK CreateSandboxRequest（BFF 透传给 Sandbox.create）。 */
export interface CreateSandboxPayload {
  image?: { uri: string }
  snapshotId?: string
  entrypoint?: string[]
  resourceLimits: Record<string, string>
  resourceRequests?: Record<string, string>
  env?: Record<string, string>
  metadata?: Record<string, string>
  networkPolicy?: { defaultAction?: 'allow' | 'deny'; egress?: { action: 'allow' | 'deny'; target: string }[] }
  timeout?: number | null
  volumes?: unknown[]
  secureAccess?: boolean
}

export interface ListSandboxesResponse {
  items: OsbSandbox[]
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number; hasNextPage: boolean }
}

const KEYS = {
  list: (params?: { states?: string[]; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams()
    if (params?.states?.length) q.set('state', params.states.join(','))
    if (params?.page) q.set('page', String(params.page))
    if (params?.pageSize) q.set('pageSize', String(params.pageSize))
    const qs = q.toString()
    return `/api/lifecycle/sandboxes${qs ? `?${qs}` : ''}`
  },
  detail: (id: string) => `/api/lifecycle/sandboxes/${id}`,
}

/** 列表 SWR key（用于操作后 mutate 重新拉取）。 */
export const listKey = KEYS.list

export function useSandboxes(params?: { states?: string[]; page?: number; pageSize?: number }) {
  return useSWR<ListSandboxesResponse>(KEYS.list(params), api.get, {
    refreshInterval: 5000, // running 态轮询
  })
}

export function useSandbox(id: string | null) {
  return useSWR<OsbSandbox>(id ? KEYS.detail(id) : null, api.get, {
    refreshInterval: 3000,
  })
}

export async function pauseSandbox(id: string) {
  const r = await api.post<{ ok: boolean }>(`/api/lifecycle/sandboxes/${id}/pause`)
  // 操作后立即触发列表与详情刷新（OSB 是异步状态转换，轮询会逐步反映中间态→终态）
  await mutate(listKey())
  await mutate(KEYS.detail(id))
  return r
}
export async function resumeSandbox(id: string) {
  const r = await api.post<{ ok: boolean }>(`/api/lifecycle/sandboxes/${id}/resume`)
  await mutate(listKey())
  await mutate(KEYS.detail(id))
  return r
}
export async function killSandbox(id: string) {
  const r = await api.delete<{ ok: boolean }>(`/api/lifecycle/sandboxes/${id}`)
  await mutate(listKey())
  await mutate(KEYS.detail(id))
  return r
}

/** 创建沙箱。成功后刷新列表（新实例先 Creating，轮询会逐步反映到 Running）。 */
export async function createSandbox(payload: CreateSandboxPayload): Promise<{ id: string }> {
  const r = await api.post<{ id: string }>('/api/lifecycle/sandboxes', payload)
  await mutate(listKey())
  return r
}

/** 在沙箱内执行单条命令，返回完整输出（经 BFF 桥接 execd）。 */
export async function runCommand(id: string, command: string): Promise<{ exitCode: number | null; stdout: string; stderr: string; error?: string }> {
  return api.post(`/api/exec/${id}/run`, { command })
}

