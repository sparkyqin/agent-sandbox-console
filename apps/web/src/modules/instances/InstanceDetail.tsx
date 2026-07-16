import React, { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  GitBranch,
  Globe,
  Info,
  Loader2,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  Plus,
  Power,
  RotateCw,
  Save,
  Server,
  Sparkles,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { Card, Label, ProgressBar, SectionTitle, StatusBadge } from '../../components/ui'
import { SESSIONS } from '../../lib/mock'
import { STATUS_META } from '../../lib/stateMap'
import { osbToInstance } from '../../lib/osbToInstance'
import type { Instance } from '../../lib/types'
import { killSandbox, pauseSandbox, resumeSandbox, runCommand, useSandbox } from '../../api/sandboxes'
import { createSnapshot, deleteSnapshot, forkFromSnapshot, useLineage, useSnapshots } from '../../api/snapshots'
import { useEvents } from '../../api/control'
import { useSSE } from '../../hooks/useEventSource'

const KV = ({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className="text-sm text-gray-500">{k}</span>
    <span className={`text-sm text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
  </div>
)

/* 会话状态横幅：VM 状态 vs 会话进度并排呈现，核心信息"VM 休眠 ≠ 任务丢失"。
   此层系统独管，只读——无任何操作按钮，运维只能看。 */
const SessionBanner = ({ instance }: { instance: Instance }) => {
  const s = SESSIONS[instance.id]
  if (!s) return null
  const vmAlive = ['running', 'paused', 'hibernating', 'creating'].includes(instance.status)
  const sessionAlive = instance.status !== 'terminated'
  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* 会话进度 */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">会话进度（系统托管 · 只读）</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${sessionAlive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              {sessionAlive ? '进度已持久化' : '已归档'}
            </span>
          </div>
          <div className="font-medium text-gray-800 text-sm">{s.task}</div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>步骤 {s.step} / {s.total}</span>
              <span>最近活动 {s.lastActive}</span>
            </div>
            <ProgressBar value={Math.round((s.step / s.total) * 100)} />
          </div>
        </div>
        {/* VM 状态对照 */}
        <div className="md:border-l md:pl-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">VM 运行态</div>
          <div className="text-sm text-gray-700 font-medium">{s.vmNote}</div>
          <div className={`text-xs mt-1.5 flex items-start gap-1 ${vmAlive ? 'text-gray-500' : sessionAlive ? 'text-amber-600' : 'text-gray-400'}`}>
            <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{s.resume}</span>
          </div>
          {!vmAlive && sessionAlive && (
            <div className="mt-2 text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
              ⚠ VM 已停 · 任务进度未丢，可换 pod 续跑
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

const DetailOverview = ({ instance }: { instance: Instance }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <Card className="p-5 lg:col-span-2 space-y-5">
      <div>
        <SectionTitle icon={<Activity className="w-5 h-5 text-blue-500" />} title="资源占用（实时）" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-600">CPU</span><span className="font-medium">{instance.cpu}% <span className="text-gray-400 text-xs">/ {instance.cpuReq} 核</span></span></div>
            <ProgressBar value={instance.cpu} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-600">内存</span><span className="font-medium">{instance.mem}% <span className="text-gray-400 text-xs">/ {instance.memReq} MiB</span></span></div>
            <ProgressBar value={instance.mem} color={instance.mem > 80 ? 'red' : 'emerald'} />
          </div>
        </div>
      </div>
      <div className="border-t pt-4">
        <SectionTitle icon={<Server className="w-5 h-5 text-blue-500" />} title="镜像分层结构" />
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm bg-purple-50 border border-purple-100 px-3 py-2 rounded-lg">
            <Server className="w-4 h-4 text-purple-600" /><span className="font-medium text-purple-700">叠加: {instance.image}</span>
          </div>
          <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-2 rounded-lg">
            <Server className="w-4 h-4 text-gray-500" /><span className="text-gray-600">底座: {instance.base}</span>
          </div>
        </div>
      </div>
      <div className="border-t pt-4">
        <SectionTitle icon={<Network className="w-5 h-5 text-blue-500" />} title="网络与端口" />
        {instance.ports.length > 0 ? (
          <div className="space-y-2">
            {instance.ports.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg">
                <Globe className="w-4 h-4 text-blue-500" />
                <span className="font-mono font-bold text-blue-700">{p.port}</span><span className="text-blue-400">·</span>
                <span className="text-blue-600 text-xs">{p.proto}</span><span className="text-blue-400">→</span>
                <span className="text-blue-600 font-mono text-xs">/sandbox/{p.route}</span>
                {instance.url && <a className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1"><Globe className="w-3 h-3" />打开预览</a>}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">无外部端口映射</p>}
      </div>
    </Card>

    <Card className="p-5 space-y-1">
      <SectionTitle icon={<Info className="w-5 h-5 text-blue-500" />} title="实例信息" />
      <KV k="实例 ID" v={instance.id} mono />
      <KV k="状态" v={STATUS_META[instance.status]?.label} />
      <KV k="所属项目" v={instance.project} />
      <KV k="Owner" v={instance.owner} />
      <KV k="区域 / 节点" v={instance.region} mono />
      <KV k="GPU" v={instance.gpu} />
      <KV k="运行时长" v={instance.uptime} />
      <KV k="重启次数" v={instance.restarts} />
      <KV k="累计花费" v={instance.cost} />
      <div className="border-t pt-2 mt-2">
        <Label>标签</Label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {instance.tags.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">#{t}</span>)}
        </div>
      </div>
      <div className="border-t pt-2 mt-2">
        <Label>探针状态</Label>
        <div className="mt-2 space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">Liveness</span><span className="text-emerald-600">✓ 通过</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Readiness</span><span className="text-emerald-600">✓ 通过</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Startup</span><span className="text-gray-400">— 已跳过</span></div>
        </div>
      </div>
    </Card>
  </div>
)

const DetailLogs = ({ instance }: { instance: Instance }) => {
  const [lines, setLines] = useState<{ t: string; lvl: string; msg: string }[]>([])
  const [level, setLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL')
  const [keyword, setKeyword] = useState('')
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const { connected } = useSSE(`/stream/logs/${instance.id}`, ['log'], (_ev, data) => {
    try {
      const line = JSON.parse(data) as { t: string; lvl: string; msg: string }
      setLines((prev) => [...prev.slice(-499), line])
    } catch { /* ignore */ }
  })

  // 自动滚到底
  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const filtered = lines.filter((l) =>
    (level === 'ALL' || l.lvl === level) &&
    (!keyword || l.msg.toLowerCase().includes(keyword.toLowerCase())),
  )
  const lvlColor: Record<string, string> = { INFO: 'text-gray-500', WARN: 'text-amber-600', ERROR: 'text-red-600', DEBUG: 'text-gray-600' }
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            {connected ? '实时流' : '连接中…'}
          </div>
          <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            <option value="ALL">全部级别</option><option>INFO</option><option>WARN</option><option>ERROR</option>
          </select>
          <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" className="rounded" /> 仅前次容器</label>
        </div>
        <div className="flex items-center gap-2">
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="过滤关键字…" className="text-xs border border-gray-200 rounded px-2 py-1 w-40" />
          <button className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 flex items-center gap-1"><Download className="w-3 h-3" />导出</button>
        </div>
      </div>
      <div className="bg-gray-900 text-gray-100 font-mono text-xs p-4 h-96 overflow-auto leading-relaxed">
        {filtered.length === 0 && <div className="text-gray-500">等待日志…</div>}
        {filtered.map((l, i) => (
          <div key={i} className="flex gap-3 hover:bg-gray-800/50 px-1">
            <span className="text-gray-500">{l.t}</span>
            <span className={`font-bold w-12 ${lvlColor[l.lvl] || 'text-gray-500'}`}>{l.lvl}</span>
            <span className="text-gray-200">{l.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} className="flex gap-3 px-1 mt-1"><span className="text-gray-500">_</span><span className="text-emerald-400 animate-pulse">▋</span></div>
      </div>
    </Card>
  )
}

const DetailTerminal = ({ instance }: { instance: Instance }) => {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<{ cmd: string; stdout: string; stderr: string; exitCode: number | null | undefined }[]>([])
  const [busy, setBusy] = useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history, busy])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd || busy) return
    setInput('')
    setBusy(true)
    try {
      const res = await runCommand(instance.id, cmd)
      setHistory((h) => [...h, { cmd, stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode }])
    } catch (err) {
      setHistory((h) => [...h, { cmd, stdout: '', stderr: `执行失败：${err instanceof Error ? err.message : String(err)}`, exitCode: -1 }])
    } finally {
      setBusy(false)
    }
  }

  const prompt = `agent@${instance.id}:~/workspace$`
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 border-b flex items-center gap-3 bg-gray-50 text-xs text-gray-600">
        <Terminal className="w-4 h-4" />
        <span>单命令执行（execd）</span>
        <span className="ml-auto text-gray-400">完整交互式终端（xterm）为后续阶段</span>
      </div>
      <div className="bg-gray-900 text-gray-100 font-mono text-sm p-4 h-96 overflow-auto leading-relaxed">
        <div className="text-gray-500 text-xs mb-2">在沙箱 {instance.id} 内执行命令。试试：ls, pwd, whoami, echo hi</div>
        {history.map((h, i) => (
          <div key={i} className="mb-2">
            <div className="text-emerald-400">{prompt} <span className="text-gray-200">{h.cmd}</span></div>
            {h.stdout && <pre className="text-gray-300 text-xs whitespace-pre-wrap">{h.stdout}</pre>}
            {h.stderr && <pre className="text-red-400 text-xs whitespace-pre-wrap">{h.stderr}</pre>}
          </div>
        ))}
        {busy && <div className="text-emerald-400">{prompt} <Loader2 className="w-3 h-3 inline animate-spin text-blue-400" /></div>}
        <form onSubmit={submit} className="flex items-center gap-2">
          <span className="text-emerald-400 shrink-0">{prompt}</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            spellCheck={false}
            className="flex-1 bg-transparent text-gray-200 outline-none caret-emerald-400"
            placeholder={busy ? '执行中…' : '输入命令，回车执行'}
            disabled={busy}
          />
        </form>
        <div ref={bottomRef} />
      </div>
  </Card>
  )
}

interface MetricsSample {
  cpu_used_pct: number
  mem_used_mib: number
  mem_total_mib: number
  cpu_count: number
  timestamp: number
}

// 把数值序列转成 SVG polyline points（viewBox 0..W, 0..H，y 反转）
function toPoints(vals: number[], w: number, h: number, max = 100): string {
  if (vals.length === 0) return ''
  const step = w / Math.max(1, vals.length - 1)
  return vals.map((v, i) => `${(i * step).toFixed(1)},${(h - (Math.min(max, v) / max) * h).toFixed(1)}`).join(' ')
}

const DetailMetrics = ({ instance }: { instance: Instance }) => {
  const [samples, setSamples] = useState<MetricsSample[]>([])
  const { connected } = useSSE(`/stream/metrics/${instance.id}`, ['metrics'], (_ev, data) => {
    try {
      const s = JSON.parse(data) as MetricsSample
      setSamples((prev) => [...prev.slice(-59), s])
    } catch { /* ignore malformed */ }
  })

  const latest = samples[samples.length - 1]
  const cpuPct = latest?.cpu_used_pct ?? 0
  const memPct = latest && latest.mem_total_mib ? (latest.mem_used_mib / latest.mem_total_mib) * 100 : 0
  const cpuVals = samples.map((s) => s.cpu_used_pct)
  const memVals = samples.map((s) => (s.mem_total_mib ? (s.mem_used_mib / s.mem_total_mib) * 100 : 0))

  const mkSpark = (label: string, val: string, color: string, vals: number[]) => (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div><div className="text-xs text-gray-500">{label}</div><div className="text-2xl font-bold text-gray-800 mt-1">{val}</div></div>
      </div>
      <svg viewBox="0 0 200 50" className="w-full h-12">
        {vals.length > 1 && <polyline fill="none" stroke={color} strokeWidth="2" points={toPoints(vals, 200, 50)} />}
        {vals.length > 1 && <polyline fill={color} fillOpacity="0.1" strokeWidth="0" points={`${toPoints(vals, 200, 50)} 200,50 0,50`} />}
      </svg>
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
        {connected ? '实时流 · 已连接' : '连接中…'}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mkSpark('CPU 使用率', `${cpuPct.toFixed(1)}%`, '#3b82f6', cpuVals)}
        {mkSpark('内存使用率', `${memPct.toFixed(1)}%`, '#10b981', memVals)}
        {mkSpark('内存占用', `${latest?.mem_used_mib ?? 0}/${latest?.mem_total_mib ?? 0} MiB`, '#8b5cf6', memVals)}
        {mkSpark('CPU 核数', `${latest?.cpu_count ?? 0}`, '#f59e0b', cpuVals)}
      </div>
      <Card className="p-5">
        <SectionTitle icon={<Activity className="w-5 h-5 text-blue-500" />} title="CPU 使用率（实时）" desc={`虚线为资源限额（${instance.cpuReq || '—'} 核），超过将被 throttling。样本数 ${samples.length}/60。`} />
        <svg viewBox="0 0 600 160" className="w-full h-40">
          <line x1="0" y1="40" x2="600" y2="40" stroke="#e5e7eb" strokeDasharray="4 4" />
          <text x="4" y="36" className="text-[10px] fill-gray-400">limit {instance.cpuReq || '—'} 核</text>
          {cpuVals.length > 1 && <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={toPoints(cpuVals, 600, 160)} />}
          {cpuVals.length > 1 && <polyline fill="#3b82f6" fillOpacity="0.08" strokeWidth="0" points={`${toPoints(cpuVals, 600, 160)} 600,160 0,160`} />}
        </svg>
      </Card>
    </div>
  )
}

const DetailEvents = ({ instance }: { instance: Instance }) => {
  const { data, isLoading } = useEvents(instance.id)
  const events = data?.items ?? []
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead><tr className="bg-gray-50 border-b text-gray-500 text-xs">
          <th className="px-4 py-3 font-medium">时间</th><th className="px-4 py-3 font-medium">类型</th>
          <th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">原因</th><th className="px-4 py-3 font-medium">消息</th>
        </tr></thead>
        <tbody>
          {isLoading && events.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> 加载事件…</td></tr>
          ) : events.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-10 text-gray-400">暂无事件记录</td></tr>
          ) : events.map((e, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.t}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${e.type === 'Warning' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{e.type || 'Normal'}</span></td>
              <td className="px-4 py-3 text-gray-700 font-mono text-xs">{e.state}</td>
              <td className="px-4 py-3 font-medium text-gray-700">{e.reason || '—'}</td>
              <td className="px-4 py-3 text-gray-500">{e.message || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

const DetailSnapshot = ({ instance }: { instance: Instance }) => {
  const { data: snapData, isLoading } = useSnapshots(instance.id)
  const { data: lineage } = useLineage(instance.id)
  const [busy, setBusy] = useState<string | null>(null)
  const snaps = snapData?.items ?? []
  const forks = lineage?.forks ?? []

  const handleCreate = async () => {
    setBusy('create')
    try { await createSnapshot(instance.id, `manual-${Date.now().toString().slice(-5)}`) } catch { } finally { setBusy(null) }
  }
  const handleFork = async (snapshotId: string) => {
    setBusy(`fork-${snapshotId}`)
    try {
      // Fork = 从快照恢复新实例。resourceLimits 用源实例的（若无则默认 medium）
      const limits = instance.cpuReq ? { cpu: `${instance.cpuReq * 1000}m`, memory: `${Math.max(1, Math.round(instance.memReq / 1024))}Gi` } : { cpu: '2000m', memory: '4Gi' }
      await forkFromSnapshot(snapshotId, limits, `fork-of-${instance.id}`)
    } catch { } finally { setBusy(null) }
  }
  const handleDelete = async (snapshotId: string) => {
    setBusy(`del-${snapshotId}`)
    try { await deleteSnapshot(snapshotId, instance.id) } catch { } finally { setBusy(null) }
  }

  const snapStateLabel: Record<string, string> = { Creating: '创建中', Ready: '可用', Failed: '失败', Deleting: '删除中' }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-5 lg:col-span-2">
        <SectionTitle icon={<Save className="w-5 h-5 text-blue-500" />} title="快照"
          desc="OpenSandbox 统一快照模型：打点后可从此恢复运行态，或 Fork 出新实例做分支化试错。是否保内存取决于运行时是否支持检查点。"
          right={
            <button onClick={handleCreate} disabled={busy === 'create' || instance.status !== 'running'}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 打快照
            </button>
          } />
        {instance.status !== 'running' && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>仅 Running 实例可打快照。当前状态：{instance.status}</span>
          </div>
        )}
        {isLoading ? (
          <div className="py-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> 加载快照…</div>
        ) : snaps.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">暂无快照。点「打快照」创建一个。</div>
        ) : (
          <div className="space-y-3">
            {snaps.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:border-blue-300">
                <div className={`p-2 rounded-lg ${s.status.state === 'Ready' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'}`}><Zap className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm truncate">{s.name || s.id}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">{s.id} · {snapStateLabel[s.status.state] || s.status.state} · {typeof s.createdAt === 'string' ? s.createdAt.slice(0, 19).replace('T', ' ') : ''}</div>
                </div>
                <button onClick={() => handleFork(s.id)} disabled={s.status.state !== 'Ready' || busy === `fork-${s.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-40 flex items-center gap-1">
                  {busy === `fork-${s.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}Fork
                </button>
                <button onClick={() => handleDelete(s.id)} disabled={busy === `del-${s.id}`}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 disabled:opacity-40">
                  {busy === `del-${s.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
        {forks.length > 0 && (
          <div className="mt-5 border-t pt-4">
            <SectionTitle icon={<GitBranch className="w-5 h-5 text-blue-500" />} title="Fork 血缘树" desc="从本实例的快照派生出的分支实例。" />
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />
              {forks.map((f) => (
                <div key={`${f.snapshotId}-${f.sandboxId}`} className="relative py-2 flex items-center gap-3">
                  <div className="absolute -left-4 w-3 h-3 rounded-full border-2 border-white bg-purple-400" />
                  <span className="font-medium text-sm text-gray-700 font-mono">{f.sandboxId}</span>
                  <span className="text-xs text-gray-400">← snapshot {f.snapshotId}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      <Card className="p-5">
        <SectionTitle icon={<Info className="w-5 h-5 text-blue-500" />} title="快照说明" />
        <div className="text-sm text-gray-600 leading-relaxed space-y-2">
          <p>• <strong>打快照</strong>：捕获当前实例状态，可作为恢复点或 Fork 来源。</p>
          <p>• <strong>Fork</strong>：从快照恢复出一个新实例（1-to-many），用于并行探索多个方案，失败丢弃、成功保留。</p>
          <p>• <strong>恢复 vs Fork</strong>：本阶段统一为 Fork（创建新实例）。原地恢复（覆盖当前实例运行态）需运行时支持检查点。</p>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded p-2">⚠ OpenSandbox 为统一快照模型。是否保内存（warm 语义）取决于底层运行时是否支持检查点（K8s provider 可能支持，Docker 不支持）。</p>
        </div>
      </Card>
    </div>
  )
}

/* 会话子页：完整的会话/任务进度视图。系统独管层，全部只读，无操作按钮。 */
const DetailSession = ({ instance }: { instance: Instance }) => {
  const s = SESSIONS[instance.id]
  if (!s) return <Card className="p-8 text-center text-gray-400">该实例无会话记录</Card>
  const steps = [
    { n: 1, label: '解析任务', done: true },
    { n: 2, label: '加载环境', done: true },
    { n: 3, label: '克隆仓库', done: true },
    { n: 4, label: '分析代码', done: s.step >= 4 },
    { n: 5, label: '生成方案', done: s.step >= 5 },
    { n: 6, label: '执行修改', done: s.step >= 6 },
    { n: 7, label: '运行测试', done: s.step >= 7 },
    { n: 8, label: '提交变更', done: s.step >= 8 },
  ]
  const timeline = [
    { t: '09:21:18', e: '会话创建 · 任务接入', k: 'sys' },
    { t: '09:22:05', e: '环境就绪 · 开始执行', k: 'sys' },
    { t: '09:23:41', e: '构建失败 · 自动重试（第 1 次）', k: 'warn' },
    { t: '09:25:33', e: '构建成功 · 进入步骤 4', k: 'sys' },
    { t: '09:31:02', e: 'VM 消息间挂起 · 会话进度已持久化', k: 'hibernate' },
    { t: '09:31:48', e: '下条消息到达 · VM 自动恢复', k: 'resume' },
  ]
  const tColor: Record<string, string> = { sys: 'text-gray-500', warn: 'text-amber-600', hibernate: 'text-sky-600', resume: 'text-emerald-600' }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle icon={<Clock className="w-5 h-5 text-blue-500" />} title="任务执行进度" desc="会话状态由系统托管（外置于工作流引擎），VM 生命周期变化不影响任务进度。" />
          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-2">
            {steps.map((st, i) => (
              <React.Fragment key={st.n}>
                <div className={`flex flex-col items-center gap-1 shrink-0 w-20 ${st.done ? '' : 'opacity-40'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${st.done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {st.done ? <CheckCircle className="w-4 h-4" /> : st.n}
                  </div>
                  <span className="text-[10px] text-gray-500 text-center">{st.label}</span>
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 w-6 ${st.done && steps[i + 1].done ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>
          <div className="border-t mt-3 pt-3">
            <div className="text-xs text-gray-500 mb-2">会话事件流（系统记录）</div>
            <div className="space-y-1.5 text-xs">
              {timeline.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-gray-400 font-mono">{l.t}</span>
                  <span className={tColor[l.k]}>{l.e}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="p-5 space-y-1">
          <SectionTitle icon={<Info className="w-5 h-5 text-blue-500" />} title="会话信息" />
          <KV k="任务" v={s.task} />
          <KV k="进度" v={`${s.step} / ${s.total} 步`} />
          <KV k="最近活动" v={s.lastActive} />
          <KV k="VM 状态" v={s.vmNote} />
          <KV k="恢复策略" v={s.resume} />
          <div className="border-t pt-2 mt-2">
            <div className="text-xs text-gray-500 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <span>会话进度外置于工作流引擎，独立于 VM 存活。VM 休眠、换 pod、甚至销毁，任务进度都不丢——这是长跑 agent（跨小时/跨天）能稳定续跑的前提。</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export const InstanceDetail = ({
  id,
  onBack,
}: {
  id: string
  onBack: () => void
}) => {
  const [sub, setSub] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { data, error, isLoading } = useSandbox(id)

  const subTabs = [
    { key: 'overview', label: '概览', icon: Info },
    { key: 'session', label: '会话', icon: Clock },
    { key: 'logs', label: '日志', icon: FileText },
    { key: 'terminal', label: '终端', icon: Terminal },
    { key: 'metrics', label: '监控', icon: Activity },
    { key: 'events', label: '事件', icon: Clock },
    { key: 'snapshot', label: '快照', icon: Save },
  ]

  const instance = data ? osbToInstance(data) : undefined

  const run = async (fn: (id: string) => Promise<unknown>) => {
    setMenuOpen(false)
    setBusy(true)
    try { await fn(id) } catch { /* 错误靠后续补，SWR 保留旧数据 */ } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* 面包屑 + 标题 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={onBack} className="hover:text-blue-600 flex items-center gap-1"><ChevronRight className="w-4 h-4 rotate-180" /> 实例列表</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-700 font-medium">{instance?.name ?? id}</span>
      </div>

      {isLoading ? (
        <Card className="p-16 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> 加载实例…</Card>
      ) : error ? (
        <Card className="p-16 flex flex-col items-center justify-center text-red-500 gap-2">
          <XCircle className="w-6 h-6" />
          <div className="text-sm">加载失败：{(error as Error).message}</div>
        </Card>
      ) : !instance ? (
        <Card className="p-16 text-center text-gray-400">实例不存在</Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50"><Server className="w-7 h-7 text-blue-600" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">{instance.name}</h2>
                    <StatusBadge status={instance.status} />
                    {busy && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{instance.id} · {instance.region} · 创建于 {instance.created}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {instance.hint && (
                  <span className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border ${instance.hintKind === 'alert' ? 'bg-red-50 text-red-700 border-red-200' : instance.hintKind === 'budget' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {instance.hintKind === 'auto' && <Sparkles className="w-3 h-3" />}
                    {instance.hintKind === 'alert' && <AlertTriangle className="w-3 h-3" />}
                    {instance.hint}
                  </span>
                )}
                <button disabled className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-purple-50 text-purple-700 border border-purple-200 opacity-50 cursor-not-allowed" title="阶段4 接通"><GitBranch className="w-4 h-4" />Fork</button>
                <button disabled className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-50 text-gray-700 border border-gray-200 opacity-50 cursor-not-allowed" title="阶段3 接通"><Terminal className="w-4 h-4" />终端</button>
                <div className="relative">
                  <button onClick={() => setMenuOpen(!menuOpen)} disabled={busy}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50">
                    <MoreHorizontal className="w-4 h-4" /> 手动覆盖
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm z-20">
                        <button disabled={busy || instance.status === 'running'} onClick={() => run(resumeSandbox)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 disabled:opacity-40"><Play className="w-3.5 h-3.5 text-emerald-600" />启动</button>
                        <button disabled={busy || instance.status !== 'running'} onClick={() => run(pauseSandbox)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2 disabled:opacity-40"><Pause className="w-3.5 h-3.5 text-amber-600" />暂停</button>
                        <button disabled className="w-full text-left px-3 py-1.5 text-gray-700 flex items-center gap-2 opacity-40 cursor-not-allowed"><Power className="w-3.5 h-3.5 text-sky-600" />休眠</button>
                        <button disabled className="w-full text-left px-3 py-1.5 text-gray-700 flex items-center gap-2 opacity-40 cursor-not-allowed"><RotateCw className="w-3.5 h-3.5 text-gray-600" />重启</button>
                        <div className="border-t my-1" />
                        <button disabled={busy} onClick={() => run(killSandbox)} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" />强制销毁</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* 会话状态横幅 —— 独立于 VM 生命周期，让"VM 休眠 ≠ 任务丢失"显式可见 */}
          <SessionBanner instance={instance} />

          {/* 子 Tab */}
          <div className="flex items-center gap-1 border-b border-gray-200">
            {subTabs.map((t) => {
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setSub(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${sub === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  <Icon className="w-4 h-4" />{t.label}
                </button>
              )
            })}
          </div>

          {/* 子内容 */}
          {sub === 'overview' && <DetailOverview instance={instance} />}
          {sub === 'session' && <DetailSession instance={instance} />}
          {sub === 'logs' && <DetailLogs instance={instance} />}
          {sub === 'terminal' && <DetailTerminal instance={instance} />}
          {sub === 'metrics' && <DetailMetrics instance={instance} />}
          {sub === 'events' && <DetailEvents instance={instance} />}
          {sub === 'snapshot' && <DetailSnapshot instance={instance} />}
        </>
      )}
    </div>
  )
}
