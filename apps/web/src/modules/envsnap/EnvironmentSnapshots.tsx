import { useState } from 'react'
import { AlertTriangle, HardDrive, Info, Loader2, Play, Trash2 } from 'lucide-react'
import { Card, SectionTitle } from '../../components/ui'
import type { NavKey } from '../../components/TopNav'
import { deleteSnapshot, forkFromSnapshot, useAllSnapshots } from '../../api/snapshots'

// OSB snapshot state → UI 徽标
const SNAP_META: Record<string, { label: string; cls: string }> = {
  Creating: { label: '创建中', cls: 'bg-blue-50 text-blue-700' },
  Ready: { label: '可用', cls: 'bg-emerald-50 text-emerald-700' },
  Failed: { label: '失败', cls: 'bg-red-50 text-red-700' },
  Deleting: { label: '删除中', cls: 'bg-gray-100 text-gray-400' },
}

/* 环境快照库：跨实例的快照总览，语义是「作为新实例的环境来源」。
   OpenSandbox 为统一快照模型（不区分 warm/cold）；本页展示全部快照，
   「从此环境创建」= 从快照恢复出新实例。 */
export const EnvironmentSnapshots = ({ setActiveTab }: { setActiveTab?: (k: NavKey) => void }) => {
  const { data, isLoading } = useAllSnapshots()
  const [busy, setBusy] = useState<string | null>(null)
  const snaps = data?.items ?? []

  const handleCreate = async (snapshotId: string) => {
    setBusy(`create-${snapshotId}`)
    try {
      // 从快照恢复新实例；resourceLimits 用默认 medium 档（环境快照不绑定具体规格）
      await forkFromSnapshot(snapshotId, { cpu: '2000m', memory: '4Gi' }, `from-${snapshotId}`)
      setActiveTab?.('instances')
    } catch { } finally { setBusy(null) }
  }
  const handleDelete = async (snapshotId: string) => {
    setBusy(`del-${snapshotId}`)
    try { await deleteSnapshot(snapshotId) } catch { } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle icon={<HardDrive className="w-5 h-5 text-sky-500" />} title="环境快照库"
          desc="把「装好依赖的开发环境」存为可复用快照，新 agent 可直接从快照起跑，省去重装依赖。OpenSandbox 统一快照模型；是否保内存取决于运行时。" />
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> 加载快照…</div>
        ) : snaps.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">暂无快照。到实例详情页的「快照」tab 为 Running 实例打快照。</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {snaps.map((s) => {
              const m = SNAP_META[s.status.state] || { label: s.status.state, cls: 'bg-gray-100 text-gray-400' }
              const ready = s.status.state === 'Ready'
              return (
                <div key={s.id} className={`p-4 rounded-xl border transition-all ${ready ? 'border-gray-200 hover:border-sky-300 hover:shadow-sm' : 'border-gray-200 opacity-70'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2"><HardDrive className="w-5 h-5 text-sky-500" /><span className="font-semibold text-gray-800 text-sm truncate">{s.name || s.id}</span></div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${m.cls}`}>{m.label}</span>
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-2">{s.id}</div>
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between"><span className="text-gray-400">来源实例</span><span className="font-mono">{s.sandboxId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">创建时间</span><span>{typeof s.createdAt === 'string' ? s.createdAt.slice(0, 16).replace('T', ' ') : ''}</span></div>
                  </div>
                  {s.status.state === 'Failed' && (
                    <div className="mt-2 text-[11px] px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />快照创建失败：{s.status.message || '未知原因'}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => handleCreate(s.id)} disabled={!ready || busy === `create-${s.id}`}
                      className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 ${!ready ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>
                      {busy === `create-${s.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}从此环境创建
                    </button>
                    <button onClick={() => handleDelete(s.id)} disabled={busy === `del-${s.id}` || s.status.state === 'Creating'}
                      className="text-xs px-2 py-1.5 rounded border border-gray-200 text-gray-400 hover:text-red-500 disabled:opacity-40">
                      {busy === `del-${s.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      <Card className="p-5">
        <SectionTitle icon={<Info className="w-5 h-5 text-blue-500" />} title="关于环境快照"
          desc="OpenSandbox 统一快照模型下的环境复用语义。" />
        <div className="text-sm text-gray-600 leading-relaxed space-y-2">
          <p>• <strong>作为环境来源</strong>：把「装好依赖的环境」存为快照，新实例从快照起跑，省去重装依赖。</p>
          <p>• <strong>跨实例复用</strong>：快照不绑定具体实例的运行态，可被任意新实例引用。</p>
          <p>• <strong>统一模型</strong>：OpenSandbox 不区分 warm/cold 快照。是否保内存（运行态恢复）取决于底层运行时是否支持检查点。</p>
          <p>• <strong>对标</strong>：Cursor 的 <code className="text-xs bg-gray-100 px-1 rounded">.cursor/environment.json</code> 里 <code className="text-xs bg-gray-100 px-1 rounded">"snapshot"</code> 字段引用的正是这类环境快照。</p>
        </div>
      </Card>
    </div>
  )
}
