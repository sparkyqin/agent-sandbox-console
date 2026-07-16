import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Code,
  Cpu,
  Globe,
  Layers,
  Lock,
  Play,
  Plus,
  Power,
  Bookmark,
  Server,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react'
import { Card, Label, SectionTitle } from '../../components/ui'
import { BASE_IMAGE } from '../../lib/mock'
import { createSandbox, type CreateSandboxPayload } from '../../api/sandboxes'
import { useImages, useTools } from '../../api/catalog'

const RESOURCE_SIZES = [
  { id: 'small', label: 'Small', cpu: 1, mem: 2048, gpu: 'none', price: '¥0.12/时', desc: '轻量脚本/单进程' },
  { id: 'medium', label: 'Medium', cpu: 2, mem: 4096, gpu: 'none', price: '¥0.31/时', desc: '常规 Agent 任务' },
  { id: 'large', label: 'Large', cpu: 4, mem: 8192, gpu: 'none', price: '¥0.78/时', desc: '数据处理/构建' },
  { id: 'xlarge', label: 'XLarge', cpu: 8, mem: 16384, gpu: 'A100', price: '¥3.20/时', desc: '推理/重计算' },
]

interface EnvVar { key: string; value: string; secret: boolean }
interface PortMap { port: string; protocol: string; route: string }

export const CreateSandbox = ({ onCreated }: { onCreated?: (id: string) => void }) => {
  const [sandboxName, setSandboxName] = useState('agent-sandbox-001')
  const [selectedCustom, setSelectedCustom] = useState<{ uri: string; name: string } | null>(null)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const { data: imagesData } = useImages()
  const { data: toolsData } = useTools()
  const customImages = (imagesData?.items ?? []).filter((i) => !i.system)
  const tools = toolsData?.items ?? []
  const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: 'DEBUG_MODE', value: 'true', secret: false }])
  const [portMappings, setPortMappings] = useState<PortMap[]>([{ port: '8080', protocol: 'HTTP', route: 'api' }])
  const [size, setSize] = useState('medium')
  const [idleTimeout, setIdleTimeout] = useState(300)
  const [maxLifetime, setMaxLifetime] = useState(24)
  const [autoRestart, setAutoRestart] = useState(true)
  // 下沉触发分档：消息间挂起（低延迟，对标 Cursor hibernate between messages）+ idle 长时间下沉（省钱，对标 auto_stop）
  const [hibernateBetweenMsgs, setHibernateBetweenMsgs] = useState(true)
  const [idleSuspendEnabled, setIdleSuspendEnabled] = useState(true)
  const [prewarmEnabled, setPrewarmEnabled] = useState(true)
  const [prewarmMin, setPrewarmMin] = useState(1)
  const [egressMode, setEgressMode] = useState('allowlist')
  const [egressList, setEgressList] = useState('api.openai.com\ngithub.com\npypi.org')
  const [probeEnabled, setProbeEnabled] = useState(true)
  const [tags, setTags] = useState('prod, codegen')
  const [project, setProject] = useState('codegen')
  const [region, setRegion] = useState('cn-east-1')
  const [volumeSize, setVolumeSize] = useState(20)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  const selectedSize = RESOURCE_SIZES.find((s) => s.id === size)!
  const toggleTool = (id: string) => setSelectedTools((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  // 资源档位 → OSB resourceLimits（millicores / Ki→Gi / gpu 张数）
  const sizeToLimits = (s: typeof RESOURCE_SIZES[number]): Record<string, string> => {
    const limits: Record<string, string> = { cpu: `${s.cpu * 1000}m`, memory: `${Math.round(s.mem / 1024 * 10) / 10}Gi` }
    if (s.gpu !== 'none') limits.gpu = '1'
    return limits
  }

  // egress 三档 → OSB networkPolicy
  const buildNetworkPolicy = (): CreateSandboxPayload['networkPolicy'] => {
    if (egressMode === 'open') return undefined // 完全开放 = 不传或 defaultAction:allow
    if (egressMode === 'deny') return { defaultAction: 'deny', egress: [] }
    // allowlist：默认拒绝，白名单域名 allow
    const allow = egressList.split('\n').map((d) => d.trim()).filter(Boolean)
    return { defaultAction: 'deny', egress: allow.map((target) => ({ action: 'allow' as const, target })) }
  }

  const handleDeploy = async () => {
    setDeployError(null)
    setIsDeploying(true)
    try {
      // metadata：name/project/region/owner/tags + imageUri（详情页回显用）
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
      const metadata: Record<string, string> = {
        name: sandboxName || `sandbox-${Date.now()}`,
        project,
        region,
        owner: 'Admin',
        ...(tagList.length ? { tags: tagList.join(',') } : {}),
        // idle 治理配置（BFF idleWatcher 读取，auto-stop 用）
        ...(idleSuspendEnabled ? { idleEnabled: '1', idleTimeout: String(idleTimeout) } : {}),
      }
      // env：非 secret 的进 env；secret 阶段2 暂也进 env（credentialVault 阶段2 暂未接 BFF 端点）
      const env: Record<string, string> = {}
      for (const v of envVars) {
        if (v.key) env[v.key] = v.value
      }
      const payload: CreateSandboxPayload = {
        image: { uri: selectedCustom ? selectedCustom.uri : 'python:3.11' },
        entrypoint: ['tail', '-f', '/dev/null'],
        resourceLimits: sizeToLimits(selectedSize),
        env,
        metadata,
        networkPolicy: buildNetworkPolicy(),
        timeout: maxLifetime * 3600,
      }
      const { id } = await createSandbox(payload)
      setDeploySuccess(true)
      setTimeout(() => {
        setDeploySuccess(false)
        onCreated?.(id)
      }, 1200)
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsDeploying(false)
    }
  }

  const updatePort = (i: number, f: keyof PortMap, v: string) => { const n = [...portMappings]; n[i][f] = v; setPortMappings(n) }
  // 简单的端口冲突校验
  const ports = portMappings.map((m) => m.port).filter(Boolean)
  const portConflict = ports.length !== new Set(ports).size

  const summary = [
    { label: '实例名称', value: sandboxName || '未命名' },
    { label: '资源规格', value: `${selectedSize.label} · ${selectedSize.cpu}核/${selectedSize.mem}MiB${selectedSize.gpu !== 'none' ? ` · GPU ${selectedSize.gpu}` : ''}` },
    { label: '镜像结构', value: selectedCustom ? `底座 + ${selectedCustom.name}` : '仅底座' },
    { label: '挂载工具', value: selectedTools.length ? selectedTools.join(', ') : '无' },
    { label: '网络出口', value: egressMode === 'open' ? '完全开放' : egressMode === 'deny' ? '完全禁止' : '域名白名单' },
    { label: '消息间挂起', value: hibernateBetweenMsgs ? '开启（低延迟）' : '关闭' },
    { label: 'Idle 下沉', value: idleSuspendEnabled ? `${idleTimeout}s → 休眠` : '关闭' },
    { label: '预热池', value: prewarmEnabled ? `${prewarmMin} 台常驻` : '关闭' },
    { label: '最大存活', value: `${maxLifetime}h 强制销毁` },
    { label: '持久卷', value: `${volumeSize} GB` },
  ]

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      <div className="flex-1 space-y-5">

        {/* 基础信息 */}
        <Card className="p-6">
          <SectionTitle icon={<Settings className="w-5 h-5 text-blue-500" />} title="实例基础信息" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>沙箱名称</Label>
              <input value={sandboxName} onChange={(e) => setSandboxName(e.target.value)} placeholder="agent-sandbox-001"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <Label>所属项目</Label>
              <input value={project} onChange={(e) => setProject(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <Label>部署区域</Label>
              <select value={region} onChange={(e) => setRegion(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
                <option value="cn-east-1">华东 1 (cn-east-1)</option>
                <option value="cn-east-2">华东 2 (cn-east-2)</option>
                <option value="cn-north-1">华北 1 (cn-north-1)</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Label>标签 <span className="text-gray-400 font-normal">(逗号分隔，用于检索与批量操作)</span></Label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
        </Card>

        {/* 资源规格 */}
        <Card className="p-6">
          <SectionTitle icon={<Cpu className="w-5 h-5 text-blue-500" />} title="资源规格" desc="沙箱是资源型实例，必须显式限定 CPU/内存/GPU，防止单实例耗尽宿主机资源。" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {RESOURCE_SIZES.map((s) => (
              <button key={s.id} onClick={() => setSize(s.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${size === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800">{s.label}</span>
                  {size === s.id && <CheckCircle className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                  <div>{s.cpu} vCPU · {s.mem} MiB</div>
                  {s.gpu !== 'none' && <div className="text-purple-600">GPU: {s.gpu}</div>}
                  <div className="text-gray-400">{s.desc}</div>
                </div>
                <div className="text-xs font-medium text-blue-600 mt-2">{s.price}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* 镜像分层 */}
        <Card className="p-6">
          <SectionTitle icon={<Layers className="w-5 h-5 text-blue-500" />} title="运行环境镜像"
            desc="系统已内置标准 Agent 基础底座，可选择叠加特定场景镜像。" />
          <div className="space-y-5 pl-2 border-l-2 border-gray-100 ml-2">
            <div className="relative pt-2">
              <div className="absolute -left-[25px] top-4 w-4 h-4 rounded-full border-4 border-white bg-blue-500"></div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 ml-4">第 1 层：系统基础底座（自动挂载）</h3>
              <div className="ml-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 flex items-center justify-between opacity-80">
                <div className="flex items-center gap-3">
                  <Server className="w-6 h-6 text-blue-600" />
                  <div><div className="font-semibold text-blue-900">{BASE_IMAGE.name}</div><div className="text-xs text-blue-700 mt-1">{BASE_IMAGE.desc}</div></div>
                </div>
                <div className="text-xs font-mono text-blue-500 border border-blue-200 px-2 py-1 rounded bg-white">系统预置</div>
              </div>
            </div>
            <div className="relative pt-2">
              <div className="absolute -left-[25px] top-6 w-4 h-4 rounded-full border-4 border-white bg-purple-400"></div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 ml-4">第 2 层：场景/自制叠加镜像（可选）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                <button onClick={() => setSelectedCustom(null)}
                  className={`p-4 rounded-xl border-2 border-dashed ${!selectedCustom ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-300'}`}>
                  <span className={!selectedCustom ? 'text-purple-600 font-medium' : 'text-gray-500'}>无叠加（仅使用底座）</span>
                </button>
                {customImages.map((img) => {
                  return (
                    <button key={img.uri} onClick={() => setSelectedCustom({ uri: img.uri, name: img.name })}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${selectedCustom?.uri === img.uri ? 'border-purple-500 bg-purple-50/50' : 'border-gray-200 hover:border-purple-300'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm">{img.name}</span>
                        {selectedCustom?.uri === img.uri && <CheckCircle className="w-4 h-4 text-purple-500" />}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">{img.uri}</div>
                      <div className="text-[10px] text-gray-400 mt-1">{img.size || '—'} · {img.scan === 'pass' ? '✓ 已扫描' : '⚠ 待复核'}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* 工具挂载 */}
        <Card className="p-6">
          <SectionTitle icon={<Wrench className="w-5 h-5 text-blue-500" />} title="动态挂载辅助工具" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tools.map((tool) => {
              const sel = selectedTools.includes(tool.id)
              return (
                <button key={tool.id} onClick={() => toggleTool(tool.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{tool.name}</span>
                    {sel && <CheckCircle className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{tool.desc}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{tool.version} · {tool.install}</div>
                </button>
              )
            })}
          </div>
        </Card>

        {/* 环境变量 + 密钥 */}
        <Card className="p-6">
          <SectionTitle icon={<Lock className="w-5 h-5 text-blue-500" />} title="环境变量与密钥"
            desc="密钥类变量请勾选「Secret」，将加密存储并以文件/env 注入，不在日志中明文回显。" />
          <div className="space-y-2">
            <div className="flex gap-3 text-xs font-medium text-gray-500 px-1">
              <div className="flex-1">变量名</div><div className="flex-1">值</div>
              <div className="w-20">Secret</div><div className="w-8"></div>
            </div>
            {envVars.map((env, i) => (
              <div key={i} className="flex items-center gap-3">
                <input value={env.key} onChange={(e) => { const n = [...envVars]; n[i].key = e.target.value; setEnvVars(n) }} placeholder="变量名"
                  className="flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500" />
                <span className="text-gray-400">=</span>
                <input value={env.value} onChange={(e) => { const n = [...envVars]; n[i].value = e.target.value; setEnvVars(n) }} placeholder="变量值"
                  type={env.secret ? 'password' : 'text'}
                  className={`flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500 ${env.secret ? 'bg-amber-50 border-amber-200' : ''}`} />
                <label className="w-20 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={env.secret} onChange={(e) => { const n = [...envVars]; n[i].secret = e.target.checked; setEnvVars(n) }} className="rounded" />加密
                </label>
                <button onClick={() => { const n = [...envVars]; n.splice(i, 1); setEnvVars(n) }} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setEnvVars([...envVars, { key: '', value: '', secret: false }])} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 mt-2"><Plus className="w-4 h-4" /> 添加变量</button>
          </div>
        </Card>

        {/* 网络 + 端口 */}
        <Card className="p-6">
          <SectionTitle icon={<Globe className="w-5 h-5 text-blue-500" />} title="网络与服务路由"
            desc="配置沙箱内服务的外网访问，以及出口（egress）策略——AI agent 会执行不可信代码/发起网络请求，出口白名单是防数据外泄的关键。" />
          {/* 端口映射 */}
          <Label>端口映射（自动生成公开预览 URL）</Label>
          <div className="space-y-2 mt-2">
            {portMappings.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="number" value={m.port} onChange={(e) => updatePort(i, 'port', e.target.value)} placeholder="8080"
                  className={`flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500 ${portConflict && ports.indexOf(m.port) !== i ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                <select value={m.protocol} onChange={(e) => updatePort(i, 'protocol', e.target.value)} className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-blue-500">
                  <option>HTTP</option><option>WebSocket</option><option>TCP</option>
                </select>
                <div className="flex-1 flex items-center">
                  <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-md px-3 py-2 text-sm text-gray-500">/sandbox/</span>
                  <input value={m.route} onChange={(e) => updatePort(i, 'route', e.target.value)} placeholder="api"
                    className="w-full px-3 py-2 border border-gray-300 rounded-r-md text-sm outline-none focus:border-blue-500" />
                </div>
                <button onClick={() => setPortMappings(portMappings.filter((_, x) => x !== i))} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {portConflict && <div className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle className="w-3.5 h-3.5" />检测到端口冲突，请修改</div>}
            <button onClick={() => setPortMappings([...portMappings, { port: '', protocol: 'HTTP', route: '' }])} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> 增加端口映射</button>
          </div>
          {/* Egress 策略 */}
          <div className="mt-5 pt-4 border-t">
            <Label>网络出口（Egress）策略</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[{ k: 'deny', l: '完全禁止', d: '最安全' }, { k: 'allowlist', l: '域名白名单', d: '推荐' }, { k: 'open', l: '完全开放', d: '⚠ 不安全' }].map((o) => (
                <button key={o.k} onClick={() => setEgressMode(o.k)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${egressMode === o.k ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="text-sm font-medium text-gray-800">{o.l}</div><div className="text-xs text-gray-400">{o.d}</div>
                </button>
              ))}
            </div>
            {egressMode === 'allowlist' && (
              <textarea value={egressList} onChange={(e) => setEgressList(e.target.value)} rows={3}
                placeholder="每行一个域名"
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono outline-none focus:border-blue-500" />
            )}
          </div>
        </Card>

        {/* 生命周期 + 治理 */}
        <Card className="p-6">
          <SectionTitle icon={<Clock className="w-5 h-5 text-blue-500" />} title="生命周期与成本治理"
            desc="下沉触发分两档：消息间挂起（低延迟）与 idle 长时间下沉（省钱）。Idle 判定基于真实资源活动（CPU/网络/并发），避免误杀长跑 agent；两窗口对标 Knative（grace + stable）。" />

          {/* 下沉触发分档 */}
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border-2 transition-all ${hibernateBetweenMsgs ? 'border-sky-300 bg-sky-50/40' : 'border-gray-200'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-sky-500" />
                  <span className="text-sm font-medium text-gray-800">消息间自动挂起</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-600">L1 · 低延迟</span>
                </div>
                <input type="checkbox" checked={hibernateBetweenMsgs} onChange={(e) => setHibernateBetweenMsgs(e.target.checked)} className="rounded" />
              </label>
              <p className="text-xs text-gray-500 mt-1.5 ml-6">每轮工具执行结束、等待下条消息时挂起 VM（保内存），消息到达即恢复。对标 Cursor「hibernate and resume agent VMs between messages」——让来回切换近零延迟。</p>
            </div>

            <div className={`p-4 rounded-xl border-2 transition-all ${idleSuspendEnabled ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Power className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-gray-800">Idle 长时间下沉</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">L2 · 省钱</span>
                </div>
                <input type="checkbox" checked={idleSuspendEnabled} onChange={(e) => setIdleSuspendEnabled(e.target.checked)} className="rounded" />
              </label>
              <p className="text-xs text-gray-500 mt-1.5 ml-6">无真实资源活动（CPU/网络/并发）超阈值后，从挂起进一步下沉到休眠（内存落盘），省更多钱、恢复稍慢。对标 Daytona autoStop / Fly auto_stop。</p>
              {idleSuspendEnabled && (
                <div className="mt-3 ml-6 flex items-center gap-3">
                  <Label className="whitespace-nowrap mb-0">空闲超时（秒）</Label>
                  <input type="number" value={idleTimeout} onChange={(e) => setIdleTimeout(+e.target.value)}
                    className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                  <span className="text-xs text-gray-400">grace + stable 两窗口判定</span>
                </div>
              )}
            </div>
          </div>

          {/* 预热池 */}
          <div className={`mt-4 p-4 rounded-xl border-2 transition-all ${prewarmEnabled ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-800">预热池（min-instances）</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">缓解冷启动</span>
              </div>
              <input type="checkbox" checked={prewarmEnabled} onChange={(e) => setPrewarmEnabled(e.target.checked)} className="rounded" />
            </label>
            <p className="text-xs text-gray-500 mt-1.5 ml-6">常驻若干已就绪实例，新 agent 命中即用、跳过冷启动。对标 Cursor prewarmed VMs。代价：常驻实例持续计费，按预算权衡。</p>
            {prewarmEnabled && (
              <div className="mt-3 ml-6 flex items-center gap-3">
                <Label className="whitespace-nowrap mb-0">常驻数量</Label>
                <input type="number" min="0" value={prewarmMin} onChange={(e) => setPrewarmMin(+e.target.value)}
                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                <span className="text-xs text-gray-400">台</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            <div>
              <Label>最大存活时长（强制销毁 / 小时）</Label>
              <input type="number" value={maxLifetime} onChange={(e) => setMaxLifetime(+e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <p className="text-xs text-gray-400 mt-1">防失控成本与逃逸风险的硬性上限（休眠期间时钟继续走）</p>
            </div>
          </div>
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input type="checkbox" checked={autoRestart} onChange={(e) => setAutoRestart(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">异常崩溃自动重启（restart policy: Always，最多 3 次）</span>
          </label>
          <div className="mt-4 pt-4 border-t">
            <Label>持久卷挂载</Label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="0" max="100" value={volumeSize} onChange={(e) => setVolumeSize(+e.target.value)} className="flex-1 accent-blue-600" />
              <span className="text-sm font-medium text-gray-700 w-20 text-right">{volumeSize} GB</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">挂载到 /workspace，跨重启保留（0 = 临时存储）</p>
          </div>
        </Card>

        {/* 健康探针 */}
        <Card className="p-6">
          <SectionTitle icon={<Activity className="w-5 h-5 text-blue-500" />} title="健康探针"
            desc="Liveness 判断是否需重启，Readiness 判断是否就绪接流量，Startup 判断初始化完成。" />
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={probeEnabled} onChange={(e) => setProbeEnabled(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">启用探针</span>
          </label>
          {probeEnabled && (
            <div className="space-y-3">
              {['Liveness', 'Readiness', 'Startup'].map((p) => (
                <div key={p} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end p-3 bg-gray-50 rounded-lg">
                  <div><Label>探针</Label><div className="text-sm font-medium text-gray-700 mt-1">{p}</div></div>
                  <div><Label>方式</Label><select className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"><option>HTTP</option><option>TCP</option><option>Exec</option></select></div>
                  <div><Label>端口/路径</Label><input defaultValue="8080/healthz" className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
                  <div><Label>间隔(s)/超时(s)</Label><input defaultValue="10 / 3" className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
                  <div><Label>失败阈值</Label><input defaultValue="3" className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 右侧清单 */}
      <div className="w-full xl:w-80">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 sticky top-20">
          <h3 className="text-lg font-bold border-b pb-3 mb-3">沙箱配置清单</h3>
          <div className="space-y-2.5">
            {summary.map((s) => (
              <div key={s.label}>
                <Label>{s.label}</Label>
                <div className="text-sm font-medium text-gray-800 mt-0.5 break-words">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-gray-500">预估花费</span>
            <span className="text-lg font-bold text-blue-600">{selectedSize.price}</span>
          </div>
          <button onClick={handleDeploy} disabled={isDeploying || !sandboxName || portConflict}
            className={`mt-5 w-full py-3 px-4 rounded-lg flex justify-center items-center gap-2 text-white font-medium ${isDeploying || !sandboxName || portConflict ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}>
            {isDeploying ? '构建并启动中…' : deploySuccess ? '✓ 创建成功!' : <><Play className="w-5 h-5" /> 立即创建沙箱</>}
          </button>
          {deployError && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="break-all">{deployError}</div>
            </div>
          )}
          <button className="mt-2 w-full py-2 px-4 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-1"><Bookmark className="w-4 h-4" />另存为模板</button>
        </div>
      </div>
    </div>
  )
}
