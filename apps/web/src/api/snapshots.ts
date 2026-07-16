// 快照 + Fork 血缘 API 层。
// OSB 的 SnapshotInfo 带 sandboxId（快照来自哪个源实例），但「某 snapshot 恢复出了哪些实例」
// 由 BFF lineageStore 维护，经 /api/lifecycle/lineage/:id 暴露。
import useSWR, { mutate } from 'swr'
import { api } from './client'
import { listKey } from './sandboxes'

export interface OsbSnapshot {
  id: string
  sandboxId: string
  name?: string
  status: { state: 'Creating' | 'Deleting' | 'Ready' | 'Failed' | string; reason?: string; message?: string; lastTransitionAt?: string }
  createdAt: string
}

export interface ForkEdge {
  snapshotId: string
  sandboxId: string // 派生实例 id
}

export interface Lineage {
  snapshots: OsbSnapshot[]
  forks: ForkEdge[]
}

const KEYS = {
  snapshots: (sandboxId: string) => `/api/lifecycle/snapshots?sandboxId=${encodeURIComponent(sandboxId)}`,
  allSnapshots: (page?: number) => `/api/lifecycle/snapshots${page ? `?page=${page}` : ''}`,
  lineage: (sandboxId: string) => `/api/lifecycle/lineage/${sandboxId}`,
}

/** 某实例的快照列表（用于详情页快照 tab）。 */
export function useSnapshots(sandboxId: string | null) {
  return useSWR<{ items: OsbSnapshot[] }>(sandboxId ? KEYS.snapshots(sandboxId) : null, api.get, {
    refreshInterval: 3000, // Creating→Ready 异步转换，轮询
  })
}

/** 全量快照列表（用于环境快照页）。 */
export function useAllSnapshots() {
  return useSWR<{ items: OsbSnapshot[] }>(KEYS.allSnapshots(), api.get, { refreshInterval: 5000 })
}

/** 某实例的 Fork 血缘（snapshots + 派生实例）。 */
export function useLineage(sandboxId: string | null) {
  return useSWR<Lineage>(sandboxId ? KEYS.lineage(sandboxId) : null, api.get, {
    refreshInterval: 5000,
  })
}

export async function createSnapshot(sandboxId: string, name?: string) {
  const r = await api.post<OsbSnapshot>(`/api/lifecycle/sandboxes/${sandboxId}/snapshots`, name ? { name } : {})
  await mutate(KEYS.snapshots(sandboxId))
  await mutate(KEYS.lineage(sandboxId))
  return r
}

export async function deleteSnapshot(snapshotId: string, sandboxId?: string) {
  const r = await api.delete<{ ok: boolean }>(`/api/lifecycle/snapshots/${snapshotId}`)
  if (sandboxId) {
    await mutate(KEYS.snapshots(sandboxId))
    await mutate(KEYS.lineage(sandboxId))
  }
  return r
}

/** Fork：从快照恢复一个新实例。成功后刷新实例列表。 */
export async function forkFromSnapshot(snapshotId: string, resourceLimits: Record<string, string>, name?: string) {
  const r = await api.post<{ id: string }>('/api/lifecycle/sandboxes', {
    snapshotId,
    resourceLimits,
    metadata: name ? { name } : undefined,
    entrypoint: ['tail', '-f', '/dev/null'],
  })
  await mutate(listKey())
  return r
}
