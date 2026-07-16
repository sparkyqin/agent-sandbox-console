// 原型阶段的数据类型。后续接 OpenSandbox 真实 API 时，这些类型会被
// lib/stateMap.ts 映射到 SDK 返回的 SandboxInfo 上，过渡期保留 mock 形状。

export type InstanceStatus =
  | 'running'
  | 'paused'
  | 'hibernating'
  | 'stopped'
  | 'error'
  | 'terminated'
  | 'creating'

export interface PortMapping {
  port: number
  route: string
  proto: string
}

export interface Fork {
  name: string
  ago: string
  adopted: boolean
}

export interface Instance {
  id: string
  name: string
  status: InstanceStatus
  image: string
  base: string
  cpu: number
  mem: number
  restarts: number
  ready: string
  uptime: string
  region: string
  owner: string
  project: string
  cost: string
  tags: string[]
  created: string
  cpuReq: number
  memReq: number
  gpu: string
  ports: PortMapping[]
  url: string
  hint: string
  hintKind: 'auto' | 'budget' | 'alert'
  forks?: Fork[]
}

export interface Session {
  task: string
  step: number
  total: number
  lastActive: string
  vmNote: string
  resume: string
}

export interface CustomImage {
  id: string
  name: string
  author: string
  version: string
  size: string
  desc: string
  source: string
  scan: 'pass' | 'warn' | 'fail'
  icon: string // lucide icon name key，组件层映射
}

export interface Tool {
  id: string
  name: string
  desc: string
  category: string
  version: string
  install: string
  enabled: boolean
}

export interface Template {
  id: string
  name: string
  image: string
  size: string
  cpu: number
  mem: number
  tools: string[]
  tags: string[]
  desc: string
  updated: string
}

export interface EnvSnapshot {
  id: string
  source: string
  label: string
  deps: string
  size: string
  created: string
  ttl: string
  status: 'ready' | 'degraded' | 'expired'
  refs: number
}

export interface IngressRoute {
  sandbox: string
  host: string
  port: number
  prefix: string
  proto: string
  tls: boolean
  conflict: boolean
}

export interface Quota {
  used: { instances: number; cpu: number; mem: number; gpu: number; storage: number }
  limit: { instances: number; cpu: number; mem: number; gpu: number; storage: number }
  budgetMonthly: number
  spentMonth: number
}
