import {
  List,
  Plus,
  Gauge,
  Layers,
  HardDrive,
  Wrench,
  Bookmark,
  Network,
  Settings,
  Terminal,
} from 'lucide-react'

export type NavKey =
  | 'instances'
  | 'create'
  | 'cost'
  | 'images'
  | 'envsnap'
  | 'tools'
  | 'templates'
  | 'network'
  | 'settings'

export const NAV_ITEMS: { key: NavKey; label: string; icon: typeof List }[] = [
  { key: 'instances', label: '实例列表', icon: List },
  { key: 'create', label: '创建实例', icon: Plus },
  { key: 'cost', label: '成本配额', icon: Gauge },
  { key: 'images', label: '镜像库', icon: Layers },
  { key: 'envsnap', label: '环境快照', icon: HardDrive },
  { key: 'tools', label: '工具箱', icon: Wrench },
  { key: 'templates', label: '模板库', icon: Bookmark },
  { key: 'network', label: '网络域名', icon: Network },
  { key: 'settings', label: '系统设置', icon: Settings },
]

export const TopNav = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: NavKey
  setActiveTab: (k: NavKey) => void
}) => (
  <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2 mr-2">
        <div className="bg-blue-600 p-2 rounded-lg"><Terminal className="w-5 h-5 text-white" /></div>
        <h1 className="text-xl font-bold text-gray-800 hidden md:block">Agent 沙箱控制台</h1>
      </div>
      <nav className="flex space-x-1 border p-1 rounded-lg bg-gray-50">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === item.key ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Icon className="w-4 h-4" /> <span className="hidden lg:inline">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden md:inline text-gray-400">组织: Acme</span>
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">A</div>
        <span className="text-gray-700">Admin</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Owner</span>
      </div>
    </div>
  </header>
)
