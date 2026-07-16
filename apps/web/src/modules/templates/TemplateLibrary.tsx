import { useState } from 'react'
import { Bookmark, Edit2, Loader2, Play, Plus, Trash2 } from 'lucide-react'
import { Card, SectionTitle } from '../../components/ui'
import type { NavKey } from '../../components/TopNav'
import { createFromTemplate, createTemplate, deleteTemplate, useTemplates } from '../../api/catalog'

export const TemplateLibrary = ({ setActiveTab }: { setActiveTab: (k: NavKey) => void }) => {
  const { data, isLoading } = useTemplates()
  const templates = data?.items ?? []
  const [busy, setBusy] = useState<string | null>(null)

  const handleCreate = async (id: string) => {
    setBusy(`create-${id}`)
    try {
      await createFromTemplate(id)
      setActiveTab('instances')
    } catch { } finally { setBusy(null) }
  }
  const handleDelete = async (id: string) => {
    setBusy(`del-${id}`)
    try { await deleteTemplate(id) } catch { } finally { setBusy(null) }
  }
  const handleNew = async () => {
    // MVP：新建一个默认模板（后续可弹表单）
    setBusy('new')
    try {
      await createTemplate({ name: `模板-${Date.now().toString().slice(-4)}`, imageUri: 'python:3.11', size: 'medium', cpu: 2, mem: 4096, tools: ['git'], tags: ['custom'], desc: '自定义模板' })
    } catch { } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle icon={<Bookmark className="w-5 h-5 text-blue-500" />} title="模板库"
          desc="把常用配置（镜像+规格+工具+治理）封装成模板，一键创建。"
          right={<button onClick={handleNew} disabled={busy === 'new'} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 新建模板</button>} />
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> 加载…</div>
        ) : templates.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">暂无模板</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2"><Bookmark className="w-5 h-5 text-blue-500" /><span className="font-semibold text-gray-800">{t.name}</span></div>
                  <span className="text-xs text-gray-400">{t.updated}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{t.desc}</p>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between"><span className="text-gray-400">镜像</span><span className="font-mono">{t.imageUri}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">规格</span><span>{t.size} · {t.cpu}核/{t.mem}MiB</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">工具</span><span>{t.tools.join(', ') || '无'}</span></div>
                </div>
                <div className="flex gap-1.5 mt-1">{t.tags.map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">#{tag}</span>)}</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleCreate(t.id)} disabled={busy === `create-${t.id}`}
                    className="flex-1 text-xs py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1 disabled:opacity-50">
                    {busy === `create-${t.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}从此创建
                  </button>
                  <button className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => handleDelete(t.id)} disabled={busy === `del-${t.id}`} className="text-xs px-2 py-1.5 rounded border border-gray-200 text-gray-400 hover:text-red-500 disabled:opacity-40">
                    {busy === `del-${t.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
