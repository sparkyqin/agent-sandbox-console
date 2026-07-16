// 成本计算与记录。
// 模型：创建时按规格单价记录计费起点（内存 activeCost）；kill 时按 时长×单价 结算写入 SQLite。
// 运行中实例的「累计花费」= 已结算部分 + 从上次结算到现在的增量。
//
// 单价表（¥/小时）—— 与前端 RESOURCE_SIZES 一致，可后续移到 budget_config 可配。
import { getDb, getConfig } from '../db.js'

interface ActiveCost {
  sandboxId: string
  project: string
  pricePerHour: number
  startedAt: number
  lastSettledAt: number
  settledAmount: number
}

const active = new Map<string, ActiveCost>()

// 规格 → 单价（¥/小时）。cpu 数 → 单价，简化映射。
export const PRICE_TABLE = [
  { size: 'Small', cpu: 1, price: 0.12 },
  { size: 'Medium', cpu: 2, price: 0.31 },
  { size: 'Large', cpu: 4, price: 0.78 },
  { size: 'XLarge', cpu: 8, price: 3.20 },
]

export function priceForCpu(cpu: number): number {
  // 找最接近的规格档（按 cpu 数），找不到用线性插值
  const exact = PRICE_TABLE.find((p) => p.cpu === cpu)
  if (exact) return exact.price
  if (cpu <= 1) return PRICE_TABLE[0].price
  if (cpu >= 8) return PRICE_TABLE[3].price
  // 线性插值
  const lower = [...PRICE_TABLE].reverse().find((p) => p.cpu <= cpu) ?? PRICE_TABLE[0]
  const upper = PRICE_TABLE.find((p) => p.cpu >= cpu) ?? PRICE_TABLE[3]
  const ratio = (cpu - lower.cpu) / (upper.cpu - lower.cpu)
  return lower.price + ratio * (upper.price - lower.price)
}

export function startCostTracking(sandboxId: string, project: string, cpuCores: number): void {
  const now = Date.now()
  active.set(sandboxId, {
    sandboxId,
    project: project || 'default',
    pricePerHour: priceForCpu(cpuCores),
    startedAt: now,
    lastSettledAt: now,
    settledAmount: 0,
  })
}

/** 结算并落库（kill 时调用）。 */
export function settleCost(sandboxId: string): void {
  const a = active.get(sandboxId)
  if (!a) return
  const now = Date.now()
  const inc = ((now - a.lastSettledAt) / 3600_000) * a.pricePerHour
  const total = a.settledAmount + inc
  if (total > 0) {
    getDb().prepare('INSERT INTO cost_events(sandbox_id, project, amount, ts) VALUES(?, ?, ?, ?)')
      .run(sandboxId, a.project, Math.round(total * 100) / 100, now)
  }
  active.delete(sandboxId)
}

/** 查运行中实例的累计花费（未结算增量 + 已结算）。 */
export function activeCost(sandboxId: string): number | null {
  const a = active.get(sandboxId)
  if (!a) return null
  const now = Date.now()
  const inc = ((now - a.lastSettledAt) / 3600_000) * a.pricePerHour
  return Math.round((a.settledAmount + inc) * 100) / 100
}

export interface CostSummary {
  spentMonth: number
  budgetMonthly: number
  byProject: { project: string; amount: number }[]
  priceTiers: { size: string; cpu: string; price: string }[]
}

export function getCostSummary(): CostSummary {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const rows = getDb().prepare(
    'SELECT project, SUM(amount) as total FROM cost_events WHERE ts >= ? GROUP BY project ORDER BY total DESC',
  ).all(monthStart) as { project: string; total: number }[]
  const spentMonth = rows.reduce((s, r) => s + (r.total ?? 0), 0)
  // 加上运行中实例的未结算增量
  const activeNow = Date.now()
  let activeInc = 0
  for (const a of active.values()) {
    activeInc += ((activeNow - a.lastSettledAt) / 3600_000) * a.pricePerHour
  }
  return {
    spentMonth: Math.round((spentMonth + activeInc) * 100) / 100,
    budgetMonthly: parseInt(getConfig('budget_monthly') || '2000', 10),
    byProject: rows.map((r) => ({ project: r.project, amount: Math.round((r.total ?? 0) * 100) / 100 })),
    priceTiers: PRICE_TABLE.map((p) => ({ size: p.size, cpu: `${p.cpu}核`, price: `¥${p.price}/时` })),
  }
}
