// 控制面 API：成本/配额/事件（BFF 自有，OpenSandbox 不提供）。
import useSWR from 'swr'
import { api } from './client'

export interface CostSummary {
  spentMonth: number
  budgetMonthly: number
  byProject: { project: string; amount: number }[]
  priceTiers: { size: string; cpu: string; price: string }[]
}

export interface QuotaUsage {
  limit: { instances: number; cpu: number; memory: number; gpu: number; storage: number }
  used: { instances: number; cpu: number; memory: number; gpu: number; storage: number }
}

export interface LifecycleEvent {
  state: string
  reason: string | null
  message: string | null
  type: string | null
  ts: number
  t: string
}

export function useCost() {
  return useSWR<CostSummary>('/api/control/cost', api.get, { refreshInterval: 10000 })
}
export function useQuota() {
  return useSWR<QuotaUsage>('/api/control/quota', api.get, { refreshInterval: 10000 })
}
export function useEvents(sandboxId: string | null) {
  return useSWR<{ items: LifecycleEvent[] }>(sandboxId ? `/api/control/events/${sandboxId}` : null, api.get, {
    refreshInterval: 5000,
  })
}

export async function setBudget(budgetMonthly: number) {
  return api.patch('/api/control/budget', { budgetMonthly })
}
