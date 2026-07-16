import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  DollarSign,
  FileText,
  Gauge,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Power,
  RotateCw,
  Save,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Card, ProgressBar, StatusBadge } from '../../components/ui'
import { STATUS_META } from '../../lib/stateMap'
import { osbToInstance } from '../../lib/osbToInstance'
import { QUOTA } from '../../lib/mock'
import type { InstanceStatus } from '../../lib/types'
import type { NavKey } from '../../components/TopNav'
import { killSandbox, pauseSandbox, resumeSandbox, useSandboxes } from '../../api/sandboxes'

export const InstanceList = ({
  setActiveTab,
  setSelectedInstance,
}: {
  setActiveTab: (k: NavKey) => void
  setSelectedInstance: (id: string) => void
}) => {
  const [filter, setFilter] = useState<InstanceStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState<string | null>(null) // 展开「手动覆盖」菜单的实例 id
  const [busy, setBusy] = useState<string | null>(null) // 正在执行操作的实例 id

  // API 的 state 过滤用 OSB 枚举；这里把原型 status 映射回 OSB state 传给后端。
  // 'all' 不过滤；其余按对应 OSB state 请求。注意 hibernating/stopped 都映射到 Paused。
  const states = filter === 'all' ? undefined : protoStatusToOsbStates(filter)
  const { data, error, isLoading } = useSandboxes({ states, pageSize: 100 })

  const instances = (data?.items ?? []).map(osbToInstance)
  // 客户端二次过滤：hibernating/stopped 在 OSB 都是 Paused，需按 metadata/hint 在前端区分。
  // search 同时匹配 name 与 id。
  const filtered = instances.filter((i) => {
    const statusOk = filter === 'all' || i.status === filter
    const searchOk = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.id.includes(search)
    return statusOk && searchOk
  })

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allChecked = filtered.length > 0 && filtered.every((i) => selected.includes(i.id))

  const run = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setMenuOpen(null)
    setBusy(id)
    try { await fn(id) } catch { /* SWR 会保留旧数据，错误靠 toast/后续补 */ } finally { setBusy(null) }
  }

  const HINT_STYLE: Record<string, string> = {
    auto: 'text-gray-400',
    budget: 'text-amber-600',
    alert: 'text-red-600',
  }

  const rowActions = (i: (typeof instances)[number]) => {
    const base = 'p-1.5 rounded hover:bg-gray-100 transition-colors'
    const isBusy = busy === i.id
    return (
      <div className="flex items-center justify-end gap-0.5 relative">
        {isBusy && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin mr-1" />}
        <button title="终端" onClick={() => setSelectedInstance(i.id)} className={`${base} text-gray-500 hover:text-gray-800`}><Terminal className="w-4 h-4" /></button>
        <button title="日志" onClick={() => setSelectedInstance(i.id)} className={`${base} text-gray-500 hover:text-gray-800`}><FileText className="w-4 h-4" /></button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button title="手动覆盖（异常用）" onClick={() => setMenuOpen(menuOpen === i.id ? null : i.id)}
          className={`${base} text-gray-500 hover:text-gray-800 flex items-center gap-1`}>
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen === i.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
            <div className="absolute right-0 top-8 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-400">手动覆盖 · 异常用</div>
              <button disabled={isBusy || i.status === 'running'} onClick={() => run(i.id, resumeSandbox)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 disabled:opacity-40"><Play className="w-3.5 h-3.5 text-emerald-600" />启动</button>
              <button disabled={isBusy || i.status !== 'running'} onClick={() => run(i.id, pauseSandbox)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 disabled:opacity-40"><Pause className="w-3.5 h-3.5 text-amber-600" />暂停</button>
              <button disabled={isBusy} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 opacity-40 cursor-not-allowed"><Power className="w-3.5 h-3.5 text-sky-600" />休眠</button>
              <button disabled={isBusy} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 opacity-40 cursor-not-allowed"><RotateCw className="w-3.5 h-3.5 text-gray-600" />重启</button>
              <div className="border-t my-1" />
              <button disabled={isBusy} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 opacity-40 cursor-not-allowed"><GitBranch className="w-3.5 h-3.5 text-purple-600" />Fork 试错</button>
              <button disabled={isBusy} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 opacity-40 cursor-not-allowed"><Save className="w-3.5 h-3.5 text-blue-600" />打快照</button>
              <div className="border-t my-1" />
              <button disabled={isBusy} onClick={() => run(i.id, killSandbox)} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" />强制销毁</button>
            </div>
          </>
        )}
      </div>
    )
  }

  const stats = [
    { label: '运行中实例', value: instances.filter((i) => i.status === 'running').length, icon: Activity, color: 'text-emerald-600 bg-emerald-50' },
    { label: '异常实例', value: instances.filter((i) => i.status === 'error').length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: '实例总数', value: instances.length, icon: Gauge, color: 'text-blue-600 bg-blue-50' },
    { label: '配额使用', value: `${instances.length}/${QUOTA.limit.instances}`, icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
  ]

  return (
    <div className="space-y-4">
      {/* 顶部统计条 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <Card key={i} className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${s.color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card>
        {/* 工具栏 */}
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索名称或 ID…"
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-56" />
            </div>
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
              {(['all', 'running', 'paused', 'hibernating', 'stopped', 'error', 'terminated'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {f === 'all' ? '全部' : STATUS_META[f]?.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <div className="flex items-center gap-1 mr-2">
                <span className="text-xs text-gray-500">已选 {selected.length} 项</span>
                <button className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Play className="w-3 h-3" />批量启动</button>
                <button className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Power className="w-3 h-3" />批量休眠</button>
                <button className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" />批量销毁</button>
              </div>
            )}
            <button onClick={() => setActiveTab('create')} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" /> 新建实例
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> 加载实例…</div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center text-red-500 gap-2">
              <XCircle className="w-6 h-6" />
              <div className="text-sm">加载失败：{(error as Error).message}</div>
              <div className="text-xs text-gray-400">确认 BFF 已启动且 OpenSandbox 连接配置正确（或开启 BFF_MOCK=1）</div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? [] : filtered.map((i) => i.id))}
                      className="rounded border-gray-300" />
                  </th>
                  <th className="px-4 py-3 font-medium">名称 / ID</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">镜像</th>
                  <th className="px-4 py-3 font-medium">CPU</th>
                  <th className="px-4 py-3 font-medium">内存</th>
                  <th className="px-4 py-3 font-medium">就绪/重启</th>
                  <th className="px-4 py-3 font-medium">区域</th>
                  <th className="px-4 py-3 font-medium">运行时长</th>
                  <th className="px-4 py-3 font-medium">花费</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} className="rounded border-gray-300" /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedInstance(i.id)} className="font-medium text-gray-800 hover:text-blue-600 hover:underline flex items-center gap-1">
                        {i.name} <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </button>
                      <div className="text-xs text-gray-400 font-mono">{i.id}</div>
                      <div className="flex gap-1 mt-1 flex-wrap items-center">
                        {i.tags.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t}</span>)}
                        {i.forks && i.forks.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 flex items-center gap-0.5" title={`派生 ${i.forks.length} 个分支：${i.forks.map((f) => f.name).join(', ')}${i.forks.some((f) => f.adopted) ? '（已采纳分支）' : ''}`}>
                            <GitBranch className="w-2.5 h-2.5" />{i.forks.length} Fork{i.forks.some((f) => f.adopted) && <span className="text-emerald-600">·采纳</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.status} />
                      {i.hint && <div className={`text-[11px] mt-1 flex items-center gap-1 ${HINT_STYLE[i.hintKind] || 'text-gray-400'}`}>
                        {i.hintKind === 'auto' && <Sparkles className="w-3 h-3" />}
                        {i.hintKind === 'alert' && <AlertTriangle className="w-3 h-3" />}
                        {i.hint}
                      </div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{i.image}</div>
                      <div className="text-xs text-gray-400">{i.gpu !== 'none' ? `GPU: ${i.gpu}` : '无 GPU'}</div>
                    </td>
                    <td className="px-4 py-3 w-24">
                      <div className="text-xs text-gray-600 mb-1">{i.cpu}%</div>
                      <ProgressBar value={i.cpu} />
                    </td>
                    <td className="px-4 py-3 w-24">
                      <div className="text-xs text-gray-600 mb-1">{i.mem}%</div>
                      <ProgressBar value={i.mem} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${i.ready === '1/1' ? 'text-emerald-600' : 'text-gray-400'}`}>{i.ready}</span>
                      {i.restarts > 0 && <span className="text-xs text-amber-600 ml-1">↻{i.restarts}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{i.region}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{i.uptime}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-medium">{i.cost}</td>
                    <td className="px-4 py-3 text-right">{rowActions(i)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-12 text-gray-400">没有匹配的实例</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {!isLoading && !error && (
          <div className="px-5 py-3 border-t flex items-center justify-between text-xs text-gray-500">
            <span>共 {filtered.length} 个实例</span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">上一页</button>
              <button className="px-2 py-1 rounded bg-blue-600 text-white">1</button>
              <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">下一页</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// 原型 status → OSB state 查询参数（list API 的 state 过滤用 OSB 枚举）。
// hibernating/stopped 在 OSB 都是 Paused，后端无法区分，前端拿回后再按 hint 二次过滤。
function protoStatusToOsbStates(s: InstanceStatus): string[] {
  switch (s) {
    case 'running': return ['Running']
    case 'paused': return ['Paused']
    case 'hibernating': return ['Paused']
    case 'stopped': return ['Paused']
    case 'error': return ['Error']
    case 'terminated': return ['Deleting', 'Deleted']
    case 'creating': return ['Creating', 'Resuming']
    default: return []
  }
}
