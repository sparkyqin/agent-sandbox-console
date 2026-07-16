// 控制面侧的 resourceLimits 存储。
// 为什么需要：OpenSandbox 的 getSandboxInfo 不回传 resourceLimits（见 specs Sandbox schema），
// 但控制台详情页要展示「CPU 核 / 内存 MiB / GPU」限额。所以 BFF 在创建时把 resourceLimits
// 落库，get/list 时关联回返回数据。
//
// 阶段2：内存 Map（进程重启丢失）。阶段5 换 SQLite（与成本/配额同库）。
// resourceLimits 形如 { cpu: "2000m", memory: "4Gi", gpu: "1" }（见 SDK ResourceLimits）。

export type ResourceLimits = Record<string, string>

export interface ResourceRecord {
  resourceLimits: ResourceLimits
  createdAt: Date
}

const store = new Map<string, ResourceRecord>()

export function recordResources(id: string, limits: ResourceLimits): void {
  store.set(id, { resourceLimits: limits, createdAt: new Date() })
}

export function getResources(id: string): ResourceRecord | undefined {
  return store.get(id)
}

/** 删除时清理（避免内存泄漏；阶段5 换 DB 后由 DB 管）。 */
export function forgetResources(id: string): void {
  store.delete(id)
}

/** 遍历所有记录（配额占用统计用）。 */
export function forEachResource(fn: (id: string, rec: ResourceRecord) => void): void {
  for (const [id, rec] of store) fn(id, rec)
}
