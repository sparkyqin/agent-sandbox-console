import { CheckCircle, Globe, Lock, Network, Plus, X } from 'lucide-react'
import { Card, SectionTitle } from '../../components/ui'
import { INGRESS_ROUTES } from '../../lib/mock'

export const NetworkManager = () => (
  <div className="space-y-4">
    <Card className="p-5">
      <SectionTitle icon={<Network className="w-5 h-5 text-blue-500" />} title="Ingress 路由总览"
        desc="所有沙箱对外暴露的路由集中视图，含 TLS、协议与冲突检测。" />
      <table className="w-full text-left text-sm">
        <thead><tr className="bg-gray-50 border-b text-gray-500 text-xs">
          <th className="px-4 py-3 font-medium">沙箱</th><th className="px-4 py-3 font-medium">域名</th>
          <th className="px-4 py-3 font-medium">端口</th><th className="px-4 py-3 font-medium">路径前缀</th>
          <th className="px-4 py-3 font-medium">协议</th><th className="px-4 py-3 font-medium">TLS</th>
          <th className="px-4 py-3 font-medium">状态</th>
        </tr></thead>
        <tbody>
          {INGRESS_ROUTES.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-700">{r.sandbox}</td>
              <td className="px-4 py-3 text-gray-600 font-mono text-xs">{r.host}</td>
              <td className="px-4 py-3 text-gray-700 font-mono">{r.port}</td>
              <td className="px-4 py-3 text-blue-600 font-mono text-xs">{r.prefix}</td>
              <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{r.proto}</span></td>
              <td className="px-4 py-3">{r.tls ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-gray-300" />}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${r.conflict ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{r.conflict ? '冲突' : '正常'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5">
        <SectionTitle icon={<Lock className="w-5 h-5 text-blue-500" />} title="出口策略模板（Egress NetworkPolicy）"
          desc="预定义可复用的出口白名单，新建沙箱时引用。" />
        <div className="space-y-2">
          {[
            { name: 'agent-codegen', allow: ['api.openai.com', 'github.com', 'pypi.org'], desc: '代码生成 Agent' },
            { name: 'agent-research', allow: ['api.openai.com', '*.wikipedia.org', 'scholar.google.com'], desc: '研究 Agent' },
            { name: 'sandbox-strict', allow: ['（无）'], desc: '完全离线，最严格' },
          ].map((p) => (
            <div key={p.name} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center"><span className="font-medium text-sm text-gray-800">{p.name}</span><span className="text-xs text-gray-400">{p.desc}</span></div>
              <div className="flex flex-wrap gap-1 mt-2">
                {p.allow.map((a) => <span key={a} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{a}</span>)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={<Globe className="w-5 h-5 text-blue-500" />} title="域名与 TLS 证书" />
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div><div className="font-medium text-sm text-gray-800">*.sandbox.dev</div><div className="text-xs text-gray-400">泛域名 · Let's Encrypt 自动续期</div></div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">有效 · 58 天</span>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div><div className="font-medium text-sm text-gray-800">preview.agent.acme.com</div><div className="text-xs text-gray-400">自定义域名 · 需 CNAME</div></div>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600">即将过期 · 6 天</span>
          </div>
          <button className="w-full mt-2 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center gap-1"><Plus className="w-4 h-4" />绑定自定义域名</button>
        </div>
      </Card>
    </div>
  </div>
)
