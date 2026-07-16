// Mock 数据 — 阶段 0 拆分期保留原型原样，确保 UI 无回归。
// 阶段 1 起这些会被 OpenSandbox 真实 API（经 BFF）替换。
import type {
  CustomImage,
  EnvSnapshot,
  IngressRoute,
  Instance,
  Quota,
  Session,
  Template,
  Tool,
} from './types'

export const BASE_IMAGE = {
  id: 'agent-base',
  name: 'Standard Agent Base',
  desc: '内置核心 Agent 服务、守护进程及基础通信组件',
  size: '1.1 GB',
}

export const INITIAL_CUSTOM_IMAGES: CustomImage[] = [
  { id: 'scene-cpp', name: 'C++ 编译环境', author: '系统', version: 'v3', size: '1.6 GB', desc: '内置 GCC, CMake 及 Boost 库。', source: 'Dockerfile', scan: 'pass', icon: 'Code' },
  { id: 'scene-data', name: '数据分析环境', author: '用户自制', version: 'v7', size: '2.3 GB', desc: 'Python 3.10, Pandas, Jupyter。', source: 'Dockerfile', scan: 'warn', icon: 'Database' },
  { id: 'scene-node', name: 'Node 全栈环境', author: '系统', version: 'v5', size: '1.9 GB', desc: 'Node 20, pnpm, Vite, Next.js。', source: '镜像拉取', scan: 'pass', icon: 'Globe' },
]

export const INITIAL_TOOLS: Tool[] = [
  { id: 'git', name: 'Git', desc: '版本控制系统', category: 'DevOps', version: '2.43', install: 'apt', enabled: true },
  { id: 'curl', name: 'cURL', desc: '网络请求工具', category: 'Network', version: '8.4', install: 'apt', enabled: true },
  { id: 'jq', name: 'jq', desc: '轻量级 JSON 处理工具', category: 'Utility', version: '1.7', install: 'apt', enabled: true },
  { id: 'python-pip', name: 'Python pip', desc: 'Python 包管理器', category: 'DevOps', version: '23.3', install: 'apt', enabled: true },
  { id: 'docker-cli', name: 'Docker CLI', desc: 'DooD 交互客户端（高权限）', category: 'DevOps', version: '24.0', install: 'apt', enabled: false },
]

// 状态机：creating -> running -> (paused | hibernating | stopped) -> terminated | error
export const INSTANCES: Instance[] = [
  { id: 'sbx-001', name: 'agent-sandbox-001', status: 'running', image: 'C++ 编译环境', base: 'Standard Agent Base', cpu: 62, mem: 48, restarts: 0, ready: '1/1', uptime: '2h 14m', region: 'cn-east-1', owner: 'Admin', project: 'codegen', cost: '¥1.82', tags: ['prod', 'codegen'], created: '2026-07-15 09:21', cpuReq: 2, memReq: 4096, gpu: 'none', ports: [{ port: 8080, route: 'api', proto: 'HTTP' }], url: 'https://sbx-001-8080.sandbox.dev', hint: '任务进行中 · 消息间自动挂起已启用', hintKind: 'auto', forks: [{ name: 'explore-v2-a', ago: '2h 前', adopted: false }, { name: 'explore-v2-b', ago: '1h 前', adopted: true }] },
  { id: 'sbx-002', name: 'data-pipeline-runner', status: 'running', image: '数据分析环境', base: 'Standard Agent Base', cpu: 88, mem: 73, restarts: 1, ready: '1/1', uptime: '5h 02m', region: 'cn-east-1', owner: 'DataTeam', project: 'etl', cost: '¥6.40', tags: ['prod', 'etl'], created: '2026-07-15 06:33', cpuReq: 4, memReq: 8192, gpu: 'none', ports: [], url: '', hint: '高负载 · 预算 42% · 限流保护中', hintKind: 'budget' },
  { id: 'sbx-003', name: 'research-agent-dev', status: 'hibernating', image: 'Node 全栈环境', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 0, ready: '0/1', uptime: '—', region: 'cn-east-2', owner: 'Rex', project: 'research', cost: '¥0.31', tags: ['dev'], created: '2026-07-14 22:10', cpuReq: 2, memReq: 4096, gpu: 'none', ports: [{ port: 3000, route: 'web', proto: 'HTTP' }], url: 'https://sbx-003-3000.sandbox.dev', hint: 'idle 8m 下沉休眠 · 内存已落盘', hintKind: 'auto' },
  { id: 'sbx-004', name: 'gpu-inference-bench', status: 'error', image: 'C++ 编译环境', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 3, ready: '0/1', uptime: '—', region: 'cn-east-2', owner: 'MLLab', project: 'inference', cost: '¥12.05', tags: ['bench', 'gpu'], created: '2026-07-15 11:02', cpuReq: 8, memReq: 16384, gpu: 'A100', ports: [], url: '', hint: '探针失败 3 次 · 需人工介入', hintKind: 'alert' },
  { id: 'sbx-005', name: 'scratch-test-77', status: 'terminated', image: '无叠加', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 0, ready: '—', uptime: '—', region: 'cn-east-1', owner: 'Admin', project: 'scratch', cost: '¥0.04', tags: ['test'], created: '2026-07-13 18:44', cpuReq: 1, memReq: 2048, gpu: 'none', ports: [], url: '', hint: 'max_lifetime 到期 · 自动销毁', hintKind: 'auto' },
  { id: 'sbx-006', name: 'doc-translation', status: 'stopped', image: '数据分析环境', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 0, ready: '0/1', uptime: '—', region: 'cn-east-1', owner: 'Rex', project: 'docs', cost: '¥0.00', tags: ['dev', 'docs'], created: '2026-07-15 08:20', cpuReq: 2, memReq: 4096, gpu: 'none', ports: [], url: '', hint: 'idle 超时已停止 · 卷保留', hintKind: 'auto' },
]

// 会话状态（任务进度）——刻意独立于 VM 生命周期存储（对标 Cursor 把 agent loop 外置到 Temporal：
// VM 可休眠/换 pod/销毁，会话进度不丢）。此层由系统独管，控制台只读，运维不可操作。
export const SESSIONS: Record<string, Session> = {
  'sbx-001': { task: '重构 parser 模块', step: 12, total: 18, lastActive: '2m 前', vmNote: '运行中', resume: '消息间自动挂起/恢复' },
  'sbx-002': { task: '数据管道迁移至 v2', step: 5, total: 5, lastActive: '12s 前', vmNote: '运行中·验收阶段', resume: '消息间自动挂起/恢复' },
  'sbx-003': { task: '调研向量数据库选型', step: 3, total: 7, lastActive: '8m 前', vmNote: 'VM 已暂停', resume: '下条消息自动唤醒，或迁移至其他 pod 续跑' },
  'sbx-004': { task: 'GPU kernel 优化', step: 4, total: 10, lastActive: '14m 前', vmNote: '探针失败·VM 异常', resume: '会话进度已保存，人工介入后可恢复' },
  'sbx-005': { task: '临时测试脚本', step: 1, total: 1, lastActive: '—', vmNote: 'VM 已销毁', resume: 'max_lifetime 到期，会话已归档' },
  'sbx-006': { task: '文档批量翻译', step: 2, total: 6, lastActive: '3h 前', vmNote: 'VM 已停止·卷保留', resume: '冷启挂回持久卷续跑（~30s）' },
}

export const INITIAL_TEMPLATES: Template[] = [
  { id: 'tpl-cpp', name: 'C++ Agent 标准模板', image: 'C++ 编译环境', size: 'medium', cpu: 2, mem: 4096, tools: ['git', 'curl'], tags: ['prod'], desc: '面向 C++ 代码生成的标准配置。', updated: '2026-07-10' },
  { id: 'tpl-data', name: '数据流水线模板', image: '数据分析环境', size: 'large', cpu: 4, mem: 8192, tools: ['git', 'python-pip'], tags: ['etl'], desc: '高内存数据分析运行环境。', updated: '2026-07-08' },
]

/* 环境快照（Cold）——磁盘级可复用环境模板，开发者拥有，跨实例共享。
   刻意从「实例详情」抽出：它的语义不是「恢复这个实例」，而是「作为新实例的环境来源」
   （对标 Cursor .cursor/environment.json 的 "snapshot" 字段）。
   status: ready=可用 / degraded=快照失效已 fallback 到默认 base image（环境就绪·有警告）/ expired=过期不可用 */
export const ENV_SNAPSHOTS: EnvSnapshot[] = [
  { id: 'envsnap-cpp-0715', source: 'agent-sandbox-001', label: 'C++ 编译环境 · 含 clang-18/cmake', deps: 'clang-18, cmake, ninja, boost', size: '1.2 GB', created: '2026-07-15 09:00', ttl: '14 天', status: 'ready', refs: 3 },
  { id: 'envsnap-data-0714', source: 'data-pipeline-runner', label: '数据分析环境 · 含 pandas/spark', deps: 'python-3.12, pandas, pyspark, jupyter', size: '2.8 GB', created: '2026-07-14 06:30', ttl: '7 天', status: 'degraded', refs: 1 },
  { id: 'envsnap-node-0710', source: 'research-agent-dev', label: 'Node 全栈环境 · 含 pnpm/prisma', deps: 'node-20, pnpm, prisma, redis-cli', size: '980 MB', created: '2026-07-10 22:10', ttl: '已过期', status: 'expired', refs: 0 },
]

export const INGRESS_ROUTES: IngressRoute[] = [
  { sandbox: 'agent-sandbox-001', host: 'sandbox.dev', port: 8080, prefix: '/sandbox/api', proto: 'HTTP', tls: true, conflict: false },
  { sandbox: 'research-agent-dev', host: 'sandbox.dev', port: 3000, prefix: '/sandbox/web', proto: 'HTTP', tls: true, conflict: false },
  { sandbox: 'agent-sandbox-001', host: 'sandbox.dev', port: 9000, prefix: '/sandbox/ws', proto: 'WebSocket', tls: true, conflict: false },
]

// 配额（全局）
export const QUOTA: Quota = {
  used: { instances: 6, cpu: 19, mem: 40960, gpu: 1, storage: 68 },
  limit: { instances: 20, cpu: 64, mem: 131072, gpu: 4, storage: 500 },
  budgetMonthly: 2000,
  spentMonth: 412.6,
}
