import { useState } from 'react'
import { TopNav, type NavKey } from './components/TopNav'
import { InstanceList } from './modules/instances/InstanceList'
import { InstanceDetail } from './modules/instances/InstanceDetail'
import { CreateSandbox } from './modules/create/CreateSandbox'
import { CostDashboard } from './modules/cost/CostDashboard'
import { ImageLibrary } from './modules/images/ImageLibrary'
import { ToolLibrary } from './modules/tools/ToolLibrary'
import { TemplateLibrary } from './modules/templates/TemplateLibrary'
import { EnvironmentSnapshots } from './modules/envsnap/EnvironmentSnapshots'
import { NetworkManager } from './modules/network/NetworkManager'
import { SystemSettings } from './modules/settings/SystemSettings'

export default function SandboxManager() {
  const [activeTab, setActiveTab] = useState<NavKey>('instances')
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)

  const handleSelectInstance = (id: string) => { setSelectedInstanceId(id); setActiveTab('instances') }

  let content: React.ReactNode
  if (activeTab === 'instances') {
    content = selectedInstanceId
      ? <InstanceDetail id={selectedInstanceId} onBack={() => setSelectedInstanceId(null)} />
      : <InstanceList setActiveTab={setActiveTab} setSelectedInstance={handleSelectInstance} />
  } else if (activeTab === 'create') content = <CreateSandbox onCreated={handleSelectInstance} />
  else if (activeTab === 'cost') content = <CostDashboard />
  else if (activeTab === 'images') content = <ImageLibrary />
  else if (activeTab === 'envsnap') content = <EnvironmentSnapshots setActiveTab={setActiveTab} />
  else if (activeTab === 'tools') content = <ToolLibrary />
  else if (activeTab === 'templates') content = <TemplateLibrary setActiveTab={setActiveTab} />
  else if (activeTab === 'network') content = <NetworkManager />
  else if (activeTab === 'settings') content = <SystemSettings />

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {content}
      </main>
    </div>
  )
}
