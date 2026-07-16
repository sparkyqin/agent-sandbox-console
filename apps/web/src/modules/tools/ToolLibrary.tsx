import { Edit2, Loader2, Plus, Trash2, Wrench } from 'lucide-react'
import { Card } from '../../components/ui'
import { toggleTool, useTools } from '../../api/catalog'

export const ToolLibrary = () => {
  const { data, isLoading } = useTools()
  const tools = data?.items ?? []
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800"><Wrench className="w-5 h-5 text-blue-500" />工具箱管理</h2>
        <button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> 注册工具</button>
      </div>
      <table className="w-full text-left text-sm">
        <thead><tr className="bg-gray-50 border-b text-gray-500 text-xs">
          <th className="px-6 py-3 font-medium">工具</th><th className="px-6 py-3 font-medium">分类</th>
          <th className="px-6 py-3 font-medium">版本</th><th className="px-6 py-3 font-medium">安装方式</th>
          <th className="px-6 py-3 font-medium">默认启用</th><th className="px-6 py-3 font-medium text-right">操作</th>
        </tr></thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> 加载…</td></tr>
          ) : tools.map((t) => (
            <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-800">{t.name}</div>
                <div className="text-xs text-gray-400 font-mono">{t.id}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
              </td>
              <td className="px-6 py-4"><span className="text-xs text-gray-500 border px-2 py-1 rounded">{t.category}</span></td>
              <td className="px-6 py-4 text-gray-600 font-mono text-xs">{t.version}</td>
              <td className="px-6 py-4 text-gray-600 text-xs">{t.install}</td>
              <td className="px-6 py-4">
                <button
                  onClick={() => toggleTool(t.id, !t.enabled)}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${t.enabled ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {t.enabled ? '默认启用' : '按需'}
                </button>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-gray-400 hover:text-blue-500 p-1 mx-0.5"><Edit2 className="w-4 h-4" /></button>
                <button className="text-gray-400 hover:text-red-500 p-1 mx-0.5"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
