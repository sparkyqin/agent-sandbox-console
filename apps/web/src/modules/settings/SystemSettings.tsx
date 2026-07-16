import { useState, type ReactNode } from 'react'
import { Clock, HardDrive, Info, Loader2, ShieldAlert } from 'lucide-react'
import { Card, SectionTitle } from '../../components/ui'
import { patchSettings, useSettings } from '../../api/catalog'

export const SystemSettings = () => {
  const { data, isLoading, mutate } = useSettings()
  const [saving, setSaving] = useState(false)

  if (isLoading && !data) {
    return <div className="py-16 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> 加载设置…</div>
  }
  if (!data) return <div className="py-16 text-center text-gray-400">无法加载设置</div>

  // 本地草稿，保存时一次性 PATCH
  const draft = { ...data }
  const update = (patch: Partial<typeof draft>) => { Object.assign(draft, patch) }
  const save = async () => {
    setSaving(true)
    try { await patchSettings(draft); await mutate(draft) } catch { } finally { setSaving(false) }
  }

  const Toggle = ({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string }): ReactNode => (
    <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer">
      <div>
        <div className="text-sm text-gray-800">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
      </div>
      <button type="button" onClick={() => onChange(!on)} className={`relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5 ${on ? 'bg-blue-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  )

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle icon={<Clock className="w-5 h-5 text-blue-500" />} title="生命周期默认策略"
          desc="新实例未显式配置时继承这些默认值。创建页初始值取自此处。" />
        <div className="divide-y divide-gray-100">
          <Toggle on={draft.def_hibernate} onChange={(v) => update({ def_hibernate: v })} label="消息间自动挂起（默认开）"
            desc="每轮工具执行后、等待下条消息时挂起 VM（保内存），消息到达即恢复。" />
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认 Idle 下沉超时</div><div className="text-xs text-gray-400 mt-0.5">无真实资源活动多久后 auto-pause</div></div>
            <div className="flex items-center gap-2">
              <input type="number" defaultValue={draft.def_idle_timeout} onChange={(e) => update({ def_idle_timeout: +e.target.value })} className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-400">秒</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认最大存活时长</div><div className="text-xs text-gray-400 mt-0.5">强制销毁的硬上限</div></div>
            <div className="flex items-center gap-2">
              <input type="number" defaultValue={draft.def_max_lifetime} onChange={(e) => update({ def_max_lifetime: +e.target.value })} className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-400">小时</span>
            </div>
          </div>
          <Toggle on={draft.def_prewarm} onChange={(v) => update({ def_prewarm: v })} label="预热池（默认开）"
            desc="常驻若干已就绪实例，新 agent 命中即用、跳过冷启动。" />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={<HardDrive className="w-5 h-5 text-sky-500" />} title="环境快照默认策略"
          desc="环境快照的全局默认：多久过期、失效时如何处理。" />
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认快照 TTL</div><div className="text-xs text-gray-400 mt-0.5">环境快照创建后保留多久</div></div>
            <div className="flex items-center gap-2">
              <input type="number" defaultValue={draft.def_snap_ttl} onChange={(e) => update({ def_snap_ttl: +e.target.value })} className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-400">天</span>
            </div>
          </div>
          <Toggle on={draft.def_snap_fallback} onChange={(v) => update({ def_snap_fallback: v })} label="失效自动降级（默认开）"
            desc="快照失效时不阻塞 agent 启动，自动降级为默认 base image。" />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={<ShieldAlert className="w-5 h-5 text-amber-500" />} title="安全默认策略"
          desc="新实例的安全默认值。agent 执行不可信代码、自主发网络请求，出口与高权限工具默认从严。" />
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认出口（Egress）策略</div><div className="text-xs text-gray-400 mt-0.5">防 agent 数据外泄的关键项</div></div>
            <select defaultValue={draft.def_egress} onChange={(e) => update({ def_egress: e.target.value })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-blue-500">
              <option value="allowlist">域名白名单（推荐）</option>
              <option value="deny">完全禁止</option>
              <option value="open">完全开放（不安全）</option>
            </select>
          </div>
          <Toggle on={draft.def_docker_cli} onChange={(v) => update({ def_docker_cli: v })} label="docker-cli 高权限工具（默认禁用）"
            desc="DooD（挂载宿主 Docker）属高权限工具，默认禁用。" />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} 保存设置
        </button>
        <span className="text-xs text-gray-400">改动需保存后生效</span>
      </div>

      <Card className="p-5 bg-blue-50/40 border-blue-100">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-gray-700 mb-1">策略三层归口</p>
            <p className="text-xs leading-relaxed">单实例策略在 <strong>创建页</strong> 设（覆盖此处默认）；花钱策略在 <strong>成本配额页</strong> 设；全局默认值在此页设，新实例未显式配置时继承。</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
