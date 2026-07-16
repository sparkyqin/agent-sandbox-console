// Fork 血缘存储：记录「新实例 ← 由哪个 snapshot 恢复」的逆向关系 + 每 sandbox 的 fork 计数。
//
// 为什么需要：OpenSandbox 的 SnapshotInfo 带 sandboxId（快照来自哪个源实例），
// 但 Sandbox.create({snapshotId}) 恢复新实例时，OSB 不反向记录「新实例来自哪个 snapshot」。
// Fork 血缘树需要这个逆向关系，故 BFF 在创建恢复实例时落库。
//
// 阶段4：内存 Map。阶段5 换 SQLite（与成本/配额同库）。

const restoreMap = new Map<string, Set<string>>()       // snapshotId → 派生出的 sandboxId 集合
const snapshotSource = new Map<string, string>()        // snapshotId → 源 sandboxId（创建快照时记录）
const forkCount = new Map<string, number>()             // 源 sandboxId → 派生实例总数

/** 创建快照时调用：记录 snapshot → 源 sandbox 的映射。 */
export function recordSnapshotSource(snapshotId: string, sourceSandboxId: string): void {
  snapshotSource.set(snapshotId, sourceSandboxId)
}

export function recordRestore(snapshotId: string, newSandboxId: string): void {
  let set = restoreMap.get(snapshotId)
  if (!set) { set = new Set(); restoreMap.set(snapshotId, set) }
  if (!set.has(newSandboxId)) {
    set.add(newSandboxId)
    // 累加源 sandbox 的 fork 计数
    const source = snapshotSource.get(snapshotId)
    if (source) forkCount.set(source, (forkCount.get(source) ?? 0) + 1)
  }
}

/** 查询某快照恢复出了哪些实例。 */
export function getRestoredBy(snapshotId: string): string[] {
  return Array.from(restoreMap.get(snapshotId) ?? [])
}

/** 某 sandbox 的 fork 数（派生实例总数），供列表角标用。 */
export function getForkCount(sandboxId: string): number {
  return forkCount.get(sandboxId) ?? 0
}

export interface ForkEdge {
  snapshotId: string
  sandboxId: string
}

export function getForksOf(sandboxId: string, snapshotIdsOf: (sandboxId: string) => string[]): ForkEdge[] {
  const snaps = snapshotIdsOf(sandboxId)
  const edges: ForkEdge[] = []
  for (const snapId of snaps) {
    for (const restored of getRestoredBy(snapId)) {
      edges.push({ snapshotId: snapId, sandboxId: restored })
    }
  }
  return edges
}

/** sandbox 被销毁时清理相关记录。 */
export function forgetLineage(sandboxId: string): void {
  for (const [, set] of restoreMap) set.delete(sandboxId)
  forkCount.delete(sandboxId)
}

export function forgetSnapshot(snapshotId: string): void {
  restoreMap.delete(snapshotId)
  snapshotSource.delete(snapshotId)
}
