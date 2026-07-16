import { Edit2, Eye, Layers, Loader2, Plus, Server, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui'
import { useImages } from '../../api/catalog'

export const ImageLibrary = () => {
  const { data, isLoading } = useImages()
  const images = data?.items ?? []
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800"><Layers className="w-5 h-5 text-purple-500" />镜像库管理</h2>
        <button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> 新建镜像</button>
      </div>
      <table className="w-full text-left text-sm">
        <thead><tr className="bg-gray-50 border-b text-gray-500 text-xs">
          <th className="px-6 py-3 font-medium">镜像</th><th className="px-6 py-3 font-medium">来源</th>
          <th className="px-6 py-3 font-medium">大小</th>
          <th className="px-6 py-3 font-medium">安全扫描</th><th className="px-6 py-3 font-medium">引用</th>
          <th className="px-6 py-3 font-medium text-right">操作</th>
        </tr></thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> 加载…</td></tr>
          ) : images.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-12 text-gray-400">暂无镜像</td></tr>
          ) : images.map((row) => (
            <tr key={row.uri} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Server className={`w-5 h-5 ${row.system ? 'text-blue-600' : 'text-purple-500'}`} />
                  <div><div className="font-medium text-gray-800">{row.name}</div><div className="text-xs text-gray-400 font-mono">{row.uri}</div></div>
                </div>
              </td>
              <td className="px-6 py-4"><span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{row.source}</span></td>
              <td className="px-6 py-4 text-gray-600">{row.size || '—'}</td>
              <td className="px-6 py-4">
                {row.scan === 'pass'
                  ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">✓ 无漏洞</span>
                  : <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">⚠ 待复核</span>}
              </td>
              <td className="px-6 py-4 text-gray-500">{row.refs} 实例</td>
              <td className="px-6 py-4 text-right">
                {!row.system ? (
                  <>
                    <button className="text-gray-400 hover:text-blue-500 p-1 mx-0.5"><Eye className="w-4 h-4" /></button>
                    <button className="text-gray-400 hover:text-blue-500 p-1 mx-0.5"><Edit2 className="w-4 h-4" /></button>
                    <button className="text-gray-400 hover:text-red-500 p-1 mx-0.5"><Trash2 className="w-4 h-4" /></button>
                  </>
                ) : <span className="text-xs text-gray-400">系统镜像</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
