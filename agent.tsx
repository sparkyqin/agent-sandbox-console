import React, { useState, useMemo } from 'react';
import {
  Box,
  Cpu,
  Wrench,
  Settings,
  Play,
  CheckCircle,
  Trash2,
  Plus,
  Terminal,
  Database,
  Code,
  Info,
  Layers,
  Server,
  X,
  Edit2,
  Globe,
  Activity,
  List,
  Gauge,
  ShieldAlert,
  Lock,
  Save,
  Copy,
  GitBranch,
  Pause,
  RotateCw,
  Power,
  HardDrive,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileText,
  Network,
  Users,
  Tag,
  DollarSign,
  Zap,
  Eye,
  Search,
  Filter,
  Bookmark,
  Download,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';

/* =========================================================================
 * Agent 沙箱控制台 — 完整原型 (P0 + P1)
 *
 * 设计依据：调研 E2B / Daytona / Modal / Runloop / CodeSandbox / Morph / Fly
 * 及 K8s 生命周期 / NetworkPolicy / RBAC / CSI 快照 / KEDA·Knative scale-to-zero。
 *
 * 模块清单：
 *   P0  实例列表 / 实例详情(概览·日志·终端·监控·事件·快照) / 创建页补全 / 成本配额
 *   P1  镜像库升级 / 工具箱升级 / 模板库 / 网络域名管理
 * ========================================================================= */

/* ----------------------------- Mock Data ------------------------------- */

const BASE_IMAGE = { id: 'agent-base', name: 'Standard Agent Base', desc: '内置核心 Agent 服务、守护进程及基础通信组件', size: '1.1 GB' };

const INITIAL_CUSTOM_IMAGES = [
  { id: 'scene-cpp', name: 'C++ 编译环境', author: '系统', version: 'v3', size: '1.6 GB', desc: '内置 GCC, CMake 及 Boost 库。', source: 'Dockerfile', scan: 'pass', icon: Code },
  { id: 'scene-data', name: '数据分析环境', author: '用户自制', version: 'v7', size: '2.3 GB', desc: 'Python 3.10, Pandas, Jupyter。', source: 'Dockerfile', scan: 'warn', icon: Database },
  { id: 'scene-node', name: 'Node 全栈环境', author: '系统', version: 'v5', size: '1.9 GB', desc: 'Node 20, pnpm, Vite, Next.js。', source: '镜像拉取', scan: 'pass', icon: Globe },
];

const INITIAL_TOOLS = [
  { id: 'git', name: 'Git', desc: '版本控制系统', category: 'DevOps', version: '2.43', install: 'apt', enabled: true },
  { id: 'curl', name: 'cURL', desc: '网络请求工具', category: 'Network', version: '8.4', install: 'apt', enabled: true },
  { id: 'jq', name: 'jq', desc: '轻量级 JSON 处理工具', category: 'Utility', version: '1.7', install: 'apt', enabled: true },
  { id: 'python-pip', name: 'Python pip', desc: 'Python 包管理器', category: 'DevOps', version: '23.3', install: 'apt', enabled: true },
  { id: 'docker-cli', name: 'Docker CLI', desc: 'DooD 交互客户端（高权限）', category: 'DevOps', version: '24.0', install: 'apt', enabled: false },
];

// 状态机：creating -> running -> (paused | hibernating | stopped) -> terminated | error
const INSTANCES = [
  { id: 'sbx-001', name: 'agent-sandbox-001', status: 'running', image: 'C++ 编译环境', base: 'Standard Agent Base', cpu: 62, mem: 48, restarts: 0, ready: '1/1', uptime: '2h 14m', region: 'cn-east-1', owner: 'Admin', project: 'codegen', cost: '¥1.82', tags: ['prod', 'codegen'], created: '2026-07-15 09:21', cpuReq: 2, memReq: 4096, gpu: 'none', ports: [{ port: 8080, route: 'api', proto: 'HTTP' }], url: 'https://sbx-001-8080.sandbox.dev', hint: '任务进行中 · 消息间自动挂起已启用', hintKind: 'auto', forks: [{ name: 'explore-v2-a', ago: '2h 前', adopted: false }, { name: 'explore-v2-b', ago: '1h 前', adopted: true }] },
  { id: 'sbx-002', name: 'data-pipeline-runner', status: 'running', image: '数据分析环境', base: 'Standard Agent Base', cpu: 88, mem: 73, restarts: 1, ready: '1/1', uptime: '5h 02m', region: 'cn-east-1', owner: 'DataTeam', project: 'etl', cost: '¥6.40', tags: ['prod', 'etl'], created: '2026-07-15 06:33', cpuReq: 4, memReq: 8192, gpu: 'none', ports: [], url: '', hint: '高负载 · 预算 42% · 限流保护中', hintKind: 'budget' },
  { id: 'sbx-003', name: 'research-agent-dev', status: 'hibernating', image: 'Node 全栈环境', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 0, ready: '0/1', uptime: '—', region: 'cn-east-2', owner: 'Rex', project: 'research', cost: '¥0.31', tags: ['dev'], created: '2026-07-14 22:10', cpuReq: 2, memReq: 4096, gpu: 'none', ports: [{ port: 3000, route: 'web', proto: 'HTTP' }], url: 'https://sbx-003-3000.sandbox.dev', hint: 'idle 8m 下沉休眠 · 内存已落盘', hintKind: 'auto' },
  { id: 'sbx-004', name: 'gpu-inference-bench', status: 'error', image: 'C++ 编译环境', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 3, ready: '0/1', uptime: '—', region: 'cn-east-2', owner: 'MLLab', project: 'inference', cost: '¥12.05', tags: ['bench', 'gpu'], created: '2026-07-15 11:02', cpuReq: 8, memReq: 16384, gpu: 'A100', ports: [], url: '', hint: '探针失败 3 次 · 需人工介入', hintKind: 'alert' },
  { id: 'sbx-005', name: 'scratch-test-77', status: 'terminated', image: '无叠加', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 0, ready: '—', uptime: '—', region: 'cn-east-1', owner: 'Admin', project: 'scratch', cost: '¥0.04', tags: ['test'], created: '2026-07-13 18:44', cpuReq: 1, memReq: 2048, gpu: 'none', ports: [], url: '', hint: 'max_lifetime 到期 · 自动销毁', hintKind: 'auto' },
  { id: 'sbx-006', name: 'doc-translation', status: 'stopped', image: '数据分析环境', base: 'Standard Agent Base', cpu: 0, mem: 0, restarts: 0, ready: '0/1', uptime: '—', region: 'cn-east-1', owner: 'Rex', project: 'docs', cost: '¥0.00', tags: ['dev', 'docs'], created: '2026-07-15 08:20', cpuReq: 2, memReq: 4096, gpu: 'none', ports: [], url: '', hint: 'idle 超时已停止 · 卷保留', hintKind: 'auto' },
];

// 会话状态（任务进度）——刻意独立于 VM 生命周期存储（对标 Cursor 把 agent loop 外置到 Temporal：
// VM 可休眠/换 pod/销毁，会话进度不丢）。此层由系统独管，控制台只读，运维不可操作。
const SESSIONS = {
  'sbx-001': { task: '重构 parser 模块',          step: 12, total: 18, lastActive: '2m 前',  vmNote: '运行中',          resume: '消息间自动挂起/恢复' },
  'sbx-002': { task: '数据管道迁移至 v2',          step: 5,  total: 5,  lastActive: '12s 前', vmNote: '运行中·验收阶段', resume: '消息间自动挂起/恢复' },
  'sbx-003': { task: '调研向量数据库选型',         step: 3,  total: 7,  lastActive: '8m 前',  vmNote: 'VM 已暂停',       resume: '下条消息自动唤醒，或迁移至其他 pod 续跑' },
  'sbx-004': { task: 'GPU kernel 优化',            step: 4,  total: 10, lastActive: '14m 前', vmNote: '探针失败·VM 异常', resume: '会话进度已保存，人工介入后可恢复' },
  'sbx-005': { task: '临时测试脚本',               step: 1,  total: 1,  lastActive: '—',      vmNote: 'VM 已销毁',       resume: 'max_lifetime 到期，会话已归档' },
  'sbx-006': { task: '文档批量翻译',               step: 2,  total: 6,  lastActive: '3h 前',  vmNote: 'VM 已停止·卷保留', resume: '冷启挂回持久卷续跑（~30s）' },
};

const INITIAL_TEMPLATES = [
  { id: 'tpl-cpp', name: 'C++ Agent 标准模板', image: 'C++ 编译环境', size: 'medium', cpu: 2, mem: 4096, tools: ['git', 'curl'], tags: ['prod'], desc: '面向 C++ 代码生成的标准配置。', updated: '2026-07-10' },
  { id: 'tpl-data', name: '数据流水线模板', image: '数据分析环境', size: 'large', cpu: 4, mem: 8192, tools: ['git', 'python-pip'], tags: ['etl'], desc: '高内存数据分析运行环境。', updated: '2026-07-08' },
];

/* 环境快照（Cold）——磁盘级可复用环境模板，开发者拥有，跨实例共享。
   刻意从「实例详情」抽出：它的语义不是「恢复这个实例」，而是「作为新实例的环境来源」
   （对标 Cursor .cursor/environment.json 的 "snapshot" 字段）。
   status: ready=可用 / degraded=快照失效已 fallback 到默认 base image（环境就绪·有警告）/ expired=过期不可用 */
const ENV_SNAPSHOTS = [
  { id: 'envsnap-cpp-0715', source: 'agent-sandbox-001', label: 'C++ 编译环境 · 含 clang-18/cmake', deps: 'clang-18, cmake, ninja, boost', size: '1.2 GB', created: '2026-07-15 09:00', ttl: '14 天', status: 'ready', refs: 3 },
  { id: 'envsnap-data-0714', source: 'data-pipeline-runner', label: '数据分析环境 · 含 pandas/spark', deps: 'python-3.12, pandas, pyspark, jupyter', size: '2.8 GB', created: '2026-07-14 06:30', ttl: '7 天', status: 'degraded', refs: 1 },
  { id: 'envsnap-node-0710', source: 'research-agent-dev', label: 'Node 全栈环境 · 含 pnpm/prisma', deps: 'node-20, pnpm, prisma, redis-cli', size: '980 MB', created: '2026-07-10 22:10', ttl: '已过期', status: 'expired', refs: 0 },
];

const INGRESS_ROUTES = [
  { sandbox: 'agent-sandbox-001', host: 'sandbox.dev', port: 8080, prefix: '/sandbox/api', proto: 'HTTP', tls: true, conflict: false },
  { sandbox: 'research-agent-dev', host: 'sandbox.dev', port: 3000, prefix: '/sandbox/web', proto: 'HTTP', tls: true, conflict: false },
  { sandbox: 'agent-sandbox-001', host: 'sandbox.dev', port: 9000, prefix: '/sandbox/ws', proto: 'WebSocket', tls: true, conflict: false },
];

// 配额（全局）
const QUOTA = {
  used: { instances: 6, cpu: 19, mem: 40960, gpu: 1, storage: 68 },
  limit: { instances: 20, cpu: 64, mem: 131072, gpu: 4, storage: 500 },
  budgetMonthly: 2000,
  spentMonth: 412.6,
};

/* ----------------------------- Shared UI ------------------------------- */

const STATUS_META = {
  running:    { label: '运行中',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200' },
  paused:     { label: '已暂停',   dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200' },
  hibernating:{ label: '休眠中',   dot: 'bg-sky-400',     text: 'text-sky-700',     bg: 'bg-sky-50',      ring: 'ring-sky-200' },
  stopped:    { label: '已停止',   dot: 'bg-gray-400',    text: 'text-gray-600',    bg: 'bg-gray-50',     ring: 'ring-gray-200' },
  error:      { label: '异常',     dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      ring: 'ring-red-200' },
  terminated: { label: '已销毁',   dot: 'bg-gray-300',    text: 'text-gray-400',    bg: 'bg-gray-50',     ring: 'ring-gray-200' },
  creating:   { label: '创建中',   dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',     ring: 'ring-blue-200' },
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.stopped;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${m.bg} ${m.text} ring-1 ${m.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>{children}</div>
);

const SectionTitle = ({ icon, title, desc, right }) => (
  <div className="mb-4 flex items-start justify-between">
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">{icon}{title}</h2>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
    {right}
  </div>
);

const Label = ({ children }) => <span className="text-xs text-gray-500 font-medium">{children}</span>;

const ProgressBar = ({ value, color = 'blue' }) => {
  const c = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[color];
  const v = Math.min(100, value);
  return <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${c} ${v > 85 ? 'bg-red-500' : ''}`} style={{ width: `${v}%` }} /></div>;
};

const QuotaBar = ({ used, limit, unit, label }) => {
  const pct = limit ? Math.round((used / limit) * 100) : 0;
  const color = pct > 90 ? 'red' : pct > 70 ? 'amber' : 'emerald';
  const c = { red: 'text-red-600', amber: 'text-amber-600', emerald: 'text-emerald-600' }[color];
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${c}`}>{used}{unit} / {limit}{unit} <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <ProgressBar value={pct} color={color === 'red' ? 'red' : color === 'amber' ? 'amber' : 'emerald'} />
    </div>
  );
};

/* ----------------------------- Top Nav --------------------------------- */

const NAV_ITEMS = [
  { key: 'instances', label: '实例列表', icon: List },
  { key: 'create',    label: '创建实例', icon: Plus },
  { key: 'cost',      label: '成本配额', icon: Gauge },
  { key: 'images',    label: '镜像库',   icon: Layers },
  { key: 'envsnap',   label: '环境快照', icon: HardDrive },
  { key: 'tools',     label: '工具箱',   icon: Wrench },
  { key: 'templates', label: '模板库',   icon: Bookmark },
  { key: 'network',   label: '网络域名', icon: Network },
  { key: 'settings',  label: '系统设置', icon: Settings },
];

const TopNav = ({ activeTab, setActiveTab }) => (
  <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2 mr-2">
        <div className="bg-blue-600 p-2 rounded-lg"><Terminal className="w-5 h-5 text-white" /></div>
        <h1 className="text-xl font-bold text-gray-800 hidden md:block">Agent 沙箱控制台</h1>
      </div>
      <nav className="flex space-x-1 border p-1 rounded-lg bg-gray-50">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => setActiveTab(item.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === item.key ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
              <Icon className="w-4 h-4" /> <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
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
);

/* ============================ 1. 实例列表 =============================== */

const InstanceList = ({ setActiveTab, setSelectedInstance }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null); // 展开「手动覆盖」菜单的实例 id

  const filtered = INSTANCES.filter(i =>
    (filter === 'all' || i.status === filter) &&
    (i.name.toLowerCase().includes(search.toLowerCase()) || i.id.includes(search))
  );

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const allChecked = filtered.length > 0 && filtered.every(i => selected.includes(i.id));

  // 生命周期由平台策略自动管理；终端/日志是高频「观测+干预」入口，常驻可见；
  // 启停/休眠/销毁/Fork/快照属「手动覆盖（异常用）」，收进溢出菜单。
  const HINT_STYLE = {
    auto:   'text-gray-400',
    budget: 'text-amber-600',
    alert:  'text-red-600',
  };

  const rowActions = (i) => {
    const base = 'p-1.5 rounded hover:bg-gray-100 transition-colors';
    return (
      <div className="flex items-center justify-end gap-0.5 relative">
        <button title="终端" onClick={() => setSelectedInstance(i.id)} className={`${base} text-gray-500 hover:text-gray-800`}><Terminal className="w-4 h-4" /></button>
        <button title="日志" onClick={() => setSelectedInstance(i.id)} className={`${base} text-gray-500 hover:text-gray-800`}><FileText className="w-4 h-4" /></button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button title="手动覆盖（异常用）" onClick={() => setMenuOpen(menuOpen === i.id ? null : i.id)}
          className={`${base} text-gray-500 hover:text-gray-800 flex items-center gap-1`}>
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen === i.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
            <div className="absolute right-0 top-8 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-400">手动覆盖 · 异常用</div>
              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Play className="w-3.5 h-3.5 text-emerald-600" />启动</button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Pause className="w-3.5 h-3.5 text-amber-600" />暂停</button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Power className="w-3.5 h-3.5 text-sky-600" />休眠</button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><RotateCw className="w-3.5 h-3.5 text-gray-600" />重启</button>
              <div className="border-t my-1" />
              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><GitBranch className="w-3.5 h-3.5 text-purple-600" />Fork 试错</button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Save className="w-3.5 h-3.5 text-blue-600" />打快照</button>
              <div className="border-t my-1" />
              <button className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />强制销毁</button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 顶部统计条 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '运行中实例', value: INSTANCES.filter(i => i.status === 'running').length, icon: Activity, color: 'text-emerald-600 bg-emerald-50' },
          { label: '异常实例', value: INSTANCES.filter(i => i.status === 'error').length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          { label: '今日花费', value: '¥' + INSTANCES.reduce((s, i) => s + parseFloat(i.cost.replace('¥', '')), 0).toFixed(2), icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
          { label: '配额使用', value: `${QUOTA.used.instances}/${QUOTA.limit.instances}`, icon: Gauge, color: 'text-purple-600 bg-purple-50' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${s.color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        {/* 工具栏 */}
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索名称或 ID…"
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-56" />
            </div>
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
              {['all', 'running', 'paused', 'hibernating', 'stopped', 'error', 'terminated'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {f === 'all' ? '全部' : STATUS_META[f]?.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <div className="flex items-center gap-1 mr-2">
                <span className="text-xs text-gray-500">已选 {selected.length} 项</span>
                <button className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Play className="w-3 h-3" />批量启动</button>
                <button className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"><Power className="w-3 h-3" />批量休眠</button>
                <button className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" />批量销毁</button>
              </div>
            )}
            <button onClick={() => setActiveTab('create')} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" /> 新建实例
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? [] : filtered.map(i => i.id))}
                    className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 font-medium">名称 / ID</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">镜像</th>
                <th className="px-4 py-3 font-medium">CPU</th>
                <th className="px-4 py-3 font-medium">内存</th>
                <th className="px-4 py-3 font-medium">就绪/重启</th>
                <th className="px-4 py-3 font-medium">区域</th>
                <th className="px-4 py-3 font-medium">运行时长</th>
                <th className="px-4 py-3 font-medium">花费</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.map(i => (
                <tr key={i.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} className="rounded border-gray-300" /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedInstance(i.id)} className="font-medium text-gray-800 hover:text-blue-600 hover:underline flex items-center gap-1">
                      {i.name} <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                    </button>
                    <div className="text-xs text-gray-400 font-mono">{i.id}</div>
                    <div className="flex gap-1 mt-1 flex-wrap items-center">
                      {i.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t}</span>)}
                      {i.forks && i.forks.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 flex items-center gap-0.5" title={`派生 ${i.forks.length} 个分支：${i.forks.map(f => f.name).join(', ')}${i.forks.some(f => f.adopted) ? '（已采纳分支）' : ''}`}>
                          <GitBranch className="w-2.5 h-2.5" />{i.forks.length} Fork{i.forks.some(f => f.adopted) && <span className="text-emerald-600">·采纳</span>}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.status} />
                    {i.hint && <div className={`text-[11px] mt-1 flex items-center gap-1 ${HINT_STYLE[i.hintKind] || 'text-gray-400'}`}>
                      {i.hintKind === 'auto' && <Sparkles className="w-3 h-3" />}
                      {i.hintKind === 'alert' && <AlertTriangle className="w-3 h-3" />}
                      {i.hint}
                    </div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{i.image}</div>
                    <div className="text-xs text-gray-400">{i.gpu !== 'none' ? `GPU: ${i.gpu}` : '无 GPU'}</div>
                  </td>
                  <td className="px-4 py-3 w-24">
                    <div className="text-xs text-gray-600 mb-1">{i.cpu}%</div>
                    <ProgressBar value={i.cpu} />
                  </td>
                  <td className="px-4 py-3 w-24">
                    <div className="text-xs text-gray-600 mb-1">{i.mem}%</div>
                    <ProgressBar value={i.mem} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono ${i.ready === '1/1' ? 'text-emerald-600' : 'text-gray-400'}`}>{i.ready}</span>
                    {i.restarts > 0 && <span className="text-xs text-amber-600 ml-1">↻{i.restarts}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{i.region}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{i.uptime}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-medium">{i.cost}</td>
                  <td className="px-4 py-3 text-right">{rowActions(i)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12 text-gray-400">没有匹配的实例</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t flex items-center justify-between text-xs text-gray-500">
          <span>共 {filtered.length} 个实例</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">上一页</button>
            <button className="px-2 py-1 rounded bg-blue-600 text-white">1</button>
            <button className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">下一页</button>
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ======================== 2. 实例详情页 ================================= */

const InstanceDetail = ({ instance, onBack }) => {
  const [sub, setSub] = useState('overview');
  if (!instance) return null;
  const subTabs = [
    { key: 'overview', label: '概览', icon: Info },
    { key: 'session',  label: '会话', icon: Clock },
    { key: 'logs',     label: '日志', icon: FileText },
    { key: 'terminal', label: '终端', icon: Terminal },
    { key: 'metrics',  label: '监控', icon: Activity },
    { key: 'events',   label: '事件', icon: Clock },
    { key: 'snapshot', label: '快照', icon: Save },
  ];

  return (
    <div className="space-y-4">
      {/* 面包屑 + 标题 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={onBack} className="hover:text-blue-600 flex items-center gap-1"><ChevronRight className="w-4 h-4 rotate-180" /> 实例列表</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-700 font-medium">{instance.name}</span>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50"><Server className="w-7 h-7 text-blue-600" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">{instance.name}</h2>
                <StatusBadge status={instance.status} />
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
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"><GitBranch className="w-4 h-4" />Fork</button>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"><Terminal className="w-4 h-4" />终端</button>
            <div className="relative group">
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100">
                <MoreHorizontal className="w-4 h-4" /> 手动覆盖
              </button>
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Play className="w-3.5 h-3.5 text-emerald-600" />启动</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Pause className="w-3.5 h-3.5 text-amber-600" />暂停</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Power className="w-3.5 h-3.5 text-sky-600" />休眠</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><RotateCw className="w-3.5 h-3.5 text-gray-600" />重启</button>
                <div className="border-t my-1" />
                <button className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />强制销毁</button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 会话状态横幅 —— 独立于 VM 生命周期，让"VM 休眠 ≠ 任务丢失"显式可见 */}
      <SessionBanner instance={instance} />

      {/* 子 Tab */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {subTabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setSub(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${sub === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* 子内容 */}
      {sub === 'overview' && <DetailOverview instance={instance} />}
      {sub === 'session' && <DetailSession instance={instance} />}
      {sub === 'logs' && <DetailLogs />}
      {sub === 'terminal' && <DetailTerminal />}
      {sub === 'metrics' && <DetailMetrics instance={instance} />}
      {sub === 'events' && <DetailEvents />}
      {sub === 'snapshot' && <DetailSnapshot instance={instance} />}
    </div>
  );
};

const KV = ({ k, v, mono }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className="text-sm text-gray-500">{k}</span>
    <span className={`text-sm text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
  </div>
);

/* 会话状态横幅：VM 状态 vs 会话进度并排呈现，核心信息"VM 休眠 ≠ 任务丢失"。
   此层系统独管，只读——无任何操作按钮，运维只能看。 */
const SessionBanner = ({ instance }) => {
  const s = SESSIONS[instance.id];
  if (!s) return null;
  const vmAlive = ['running', 'paused', 'hibernating', 'creating'].includes(instance.status);
  const sessionAlive = instance.status !== 'terminated';
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
  );
};

/* 会话子页：完整的会话/任务进度视图。系统独管层，全部只读，无操作按钮。 */
const DetailSession = ({ instance }) => {
  const s = SESSIONS[instance.id];
  if (!s) return <Card className="p-8 text-center text-gray-400">该实例无会话记录</Card>;
  const steps = [
    { n: 1, label: '解析任务', done: true },
    { n: 2, label: '加载环境', done: true },
    { n: 3, label: '克隆仓库', done: true },
    { n: 4, label: '分析代码', done: s.step >= 4 },
    { n: 5, label: '生成方案', done: s.step >= 5 },
    { n: 6, label: '执行修改', done: s.step >= 6 },
    { n: 7, label: '运行测试', done: s.step >= 7 },
    { n: 8, label: '提交变更', done: s.step >= 8 },
  ];
  const timeline = [
    { t: '09:21:18', e: '会话创建 · 任务接入', k: 'sys' },
    { t: '09:22:05', e: '环境就绪 · 开始执行', k: 'sys' },
    { t: '09:23:41', e: '构建失败 · 自动重试（第 1 次）', k: 'warn' },
    { t: '09:25:33', e: '构建成功 · 进入步骤 4', k: 'sys' },
    { t: '09:31:02', e: 'VM 消息间挂起 · 会话进度已持久化', k: 'hibernate' },
    { t: '09:31:48', e: '下条消息到达 · VM 自动恢复', k: 'resume' },
  ];
  const tColor = { sys: 'text-gray-500', warn: 'text-amber-600', hibernate: 'text-sky-600', resume: 'text-emerald-600' };
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
                {i < steps.length - 1 && <div className={`h-0.5 w-6 ${st.done && steps[i+1].done ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
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
  );
};

const DetailOverview = ({ instance }) => (
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
            <Layers className="w-4 h-4 text-purple-600" /><span className="font-medium text-purple-700">叠加: {instance.image}</span>
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
          {instance.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">#{t}</span>)}
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
);

const DetailLogs = () => {
  const sample = [
    { t: '09:21:14', lvl: 'INFO',  msg: 'Agent runtime started, pid=1' },
    { t: '09:21:15', lvl: 'INFO',  msg: 'Loaded tools: git, curl, jq, python-pip' },
    { t: '09:21:16', lvl: 'INFO',  msg: 'Mounting overlay: /workspace (rw)' },
    { t: '09:21:18', lvl: 'WARN',  msg: 'Egress allowlist active: api.openai.com, github.com' },
    { t: '09:22:02', lvl: 'INFO',  msg: 'Task #1 received: "refactor parser module"' },
    { t: '09:22:05', lvl: 'INFO',  msg: 'Executing: git clone https://github.com/acme/parser' },
    { t: '09:23:41', lvl: 'ERROR', msg: 'Build failed: undefined reference to `parse_token` at line 142' },
    { t: '09:24:00', lvl: 'INFO',  msg: 'Agent retrying with patched hypothesis…' },
    { t: '09:25:33', lvl: 'INFO',  msg: 'Build succeeded after 3 iterations' },
    { t: '09:25:34', lvl: 'INFO',  msg: 'HTTP server listening on :8080' },
  ];
  const lvlColor = { INFO: 'text-gray-500', WARN: 'text-amber-600', ERROR: 'text-red-600' };
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />实时流</div>
          <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"><option>全部级别</option><option>INFO</option><option>WARN</option><option>ERROR</option></select>
          <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" className="rounded" /> 仅前次容器</label>
        </div>
        <div className="flex items-center gap-2">
          <input placeholder="过滤关键字…" className="text-xs border border-gray-200 rounded px-2 py-1 w-40" />
          <button className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 flex items-center gap-1"><Download className="w-3 h-3" />导出</button>
        </div>
      </div>
      <div className="bg-gray-900 text-gray-100 font-mono text-xs p-4 h-96 overflow-auto leading-relaxed">
        {sample.map((l, i) => (
          <div key={i} className="flex gap-3 hover:bg-gray-800/50 px-1">
            <span className="text-gray-500">{l.t}</span>
            <span className={`font-bold w-12 ${lvlColor[l.lvl]}`}>{l.lvl}</span>
            <span className="text-gray-200">{l.msg}</span>
          </div>
        ))}
        <div className="flex gap-3 px-1 mt-1"><span className="text-gray-500">_</span><span className="text-emerald-400 animate-pulse">▋</span></div>
      </div>
    </Card>
  );
};

const DetailTerminal = () => (
  <Card className="overflow-hidden">
    <div className="px-4 py-2.5 border-b flex items-center gap-3 bg-gray-50 text-xs text-gray-600">
      <Terminal className="w-4 h-4" />
      <select className="border border-gray-200 rounded px-2 py-1 bg-white"><option>container: agent-runtime</option><option>container: sidecar-proxy</option></select>
      <select className="border border-gray-200 rounded px-2 py-1 bg-white"><option>user: root</option><option>user: agent</option></select>
      <select className="border border-gray-200 rounded px-2 py-1 bg-white"><option>shell: /bin/bash</option><option>shell: /bin/sh</option></select>
      <span className="ml-auto text-gray-400">xterm.js · WebSocket 已连接</span>
    </div>
    <div className="bg-gray-900 text-gray-100 font-mono text-sm p-4 h-96 overflow-auto">
      <div className="text-emerald-400">agent@sbx-001:~/workspace$</div>
      <div className="text-gray-300">ls -la</div>
      <div className="text-gray-400 text-xs leading-relaxed mt-1">
        total 24<br />
        drwxr-xr-x 3 agent agent 4096 Jul 15 09:21 .<br />
        drwxr-xr-x 1 root root 4096 Jul 15 09:21 ..<br />
        -rw-r--r-- 1 agent agent  412 Jul 15 09:21 main.cpp<br />
        drwxr-xr-x 3 agent agent 4096 Jul 15 09:22 build<br />
      </div>
      <div className="text-emerald-400 mt-2">agent@sbx-001:~/workspace$ <span className="text-gray-300 animate-pulse">▋</span></div>
    </div>
  </Card>
);

const DetailMetrics = ({ instance }) => {
  const mkSpark = (label, val, color) => (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div><div className="text-xs text-gray-500">{label}</div><div className="text-2xl font-bold text-gray-800 mt-1">{val}</div></div>
      </div>
      <svg viewBox="0 0 200 50" className="w-full h-12">
        <polyline fill="none" stroke={color} strokeWidth="2" points="0,40 20,30 40,35 60,20 80,25 100,15 120,28 140,18 160,22 180,10 200,16" />
        <polyline fill={color} fillOpacity="0.1" strokeWidth="0" points="0,40 20,30 40,35 60,20 80,25 100,15 120,28 140,18 160,22 180,10 200,16 200,50 0,50" />
      </svg>
    </Card>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mkSpark('CPU 使用率', `${instance.cpu}%`, '#3b82f6')}
        {mkSpark('内存使用率', `${instance.mem}%`, '#10b981')}
        {mkSpark('网络入站', '1.2 MB/s', '#8b5cf6')}
        {mkSpark('磁盘读写', '340 KB/s', '#f59e0b')}
      </div>
      <Card className="p-5">
        <SectionTitle icon={<Activity className="w-5 h-5 text-blue-500" />} title="CPU 使用率（过去 1 小时）" desc="虚线为资源限额，超过将被 throttling" />
        <svg viewBox="0 0 600 160" className="w-full h-40">
          <line x1="0" y1="40" x2="600" y2="40" stroke="#e5e7eb" strokeDasharray="4 4" />
          <text x="4" y="36" className="text-[10px] fill-gray-400">limit 2 核</text>
          <polyline fill="none" stroke="#3b82f6" strokeWidth="2"
            points="0,110 40,95 80,105 120,70 160,85 200,60 240,90 280,55 320,75 360,45 400,68 440,50 480,72 520,58 560,80 600,62" />
          <polyline fill="#3b82f6" fillOpacity="0.08" strokeWidth="0"
            points="0,110 40,95 80,105 120,70 160,85 200,60 240,90 280,55 320,75 360,45 400,68 440,50 480,72 520,58 560,80 600,62 600,160 0,160" />
        </svg>
      </Card>
    </div>
  );
};

const DetailEvents = () => {
  const events = [
    { t: '09:25:34', type: 'Normal',  reason: 'Started',     msg: 'Started container agent-runtime' },
    { t: '09:24:00', type: 'Normal',  reason: 'Pulled',      msg: 'Successfully pulled image scene-cpp:v3' },
    { t: '09:23:41', type: 'Warning', reason: 'BuildFailed', msg: 'Build iteration #3 failed, agent retrying' },
    { t: '09:22:05', type: 'Normal',  reason: 'Created',     msg: 'Created container agent-runtime' },
    { t: '09:21:18', type: 'Normal',  reason: 'Scheduled',   msg: 'Successfully assigned sbx-001 to node cn-east-1-pool-a' },
    { t: '09:21:14', type: 'Normal',  reason: 'Provisioned', msg: 'Sandbox provisioned, base + overlay mounted' },
  ];
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead><tr className="bg-gray-50 border-b text-gray-500 text-xs">
          <th className="px-4 py-3 font-medium">时间</th><th className="px-4 py-3 font-medium">类型</th>
          <th className="px-4 py-3 font-medium">原因</th><th className="px-4 py-3 font-medium">消息</th>
        </tr></thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.t}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${e.type === 'Warning' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{e.type}</span></td>
              <td className="px-4 py-3 font-medium text-gray-700">{e.reason}</td>
              <td className="px-4 py-3 text-gray-500">{e.msg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const DetailSnapshot = ({ instance }) => {
  // 实例详情只留 Warm（内存级）快照——恢复运行态 + Fork 试错，是合法的「单实例」操作。
  // Cold（磁盘级）快照已迁移到「环境快照」页：它的语义是「作为新实例的环境来源」而非「恢复本实例」。
  const snaps = [
    { id: 'snap-a1', label: '内存快照（含进程/内存）', time: '09:25:00', size: '812 MB', restore: '~1.5s' },
  ];
  // 环境降级态：对标 Cursor「快照失效 → fallback 默认 base image，标 Environment ready (with warnings)」
  const envDegraded = instance.id === 'sbx-002';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-5 lg:col-span-2">
        <SectionTitle icon={<Save className="w-5 h-5 text-blue-500" />} title="Warm 快照（内存级）"
          desc="含进程树+内存+FD+socket，秒级恢复并支持 1-to-many Fork。系统在消息间自动维护，此处可手动打点。Cold 磁盘快照已移至「环境快照」页。" />
        {envDegraded && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>环境快照已失效，已自动降级为默认 base image。<strong>Environment ready (with warnings)</strong> —— 新 agent 起来时依赖需重装，可能影响首条消息质量。</span>
          </div>
        )}
        <div className="space-y-3">
          {snaps.map(s => (
            <div key={s.id} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:border-blue-300">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600"><Zap className="w-5 h-5" /></div>
              <div className="flex-1">
                <div className="font-medium text-gray-800 text-sm">{s.label}</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">{s.id} · {s.time} · {s.size} · 恢复 {s.restore}</div>
              </div>
              <div className="flex items-center gap-1">
                <button className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"><RotateCw className="w-3 h-3" />恢复</button>
                <button className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center gap-1"><GitBranch className="w-3 h-3" />Fork</button>
                <button className="text-xs px-2 py-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="text-sm px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 flex items-center gap-1"><Zap className="w-4 h-4" />创建 Warm 快照</button>
          <button className="text-sm px-3 py-2 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 flex items-center gap-1"><HardDrive className="w-4 h-4" />另存为环境快照</button>
        </div>
      </Card>

      {/* Fork 血缘树 */}
      <Card className="p-5">
        <SectionTitle icon={<GitBranch className="w-5 h-5 text-purple-500" />} title="Fork 血缘" desc="从该实例派生的分支" />
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 p-2 rounded bg-blue-50 border border-blue-100">
            <Server className="w-4 h-4 text-blue-600" /><span className="font-medium text-blue-700">{instance.name}</span><span className="text-xs text-blue-400 ml-auto">当前</span>
          </div>
          <div className="ml-4 border-l-2 border-gray-200 pl-4 space-y-2">
            {(instance.forks || []).map(f => (
              <div key={f.name} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                <GitBranch className="w-4 h-4 text-purple-500" /><span className="text-gray-700">{f.name}</span><span className="text-xs text-gray-400 ml-auto">{f.ago}</span>
                {f.adopted && <span className="text-[10px] px-1 rounded bg-emerald-100 text-emerald-700">采纳</span>}
              </div>
            ))}
            {(!instance.forks || instance.forks.length === 0) && <div className="p-2 text-xs text-gray-400">暂无派生分支</div>}
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ========================= 3. 创建页（升级） =========================== */

const RESOURCE_SIZES = [
  { id: 'small',  label: 'Small',  cpu: 1, mem: 2048, gpu: 'none', price: '¥0.12/时', desc: '轻量脚本/单进程' },
  { id: 'medium', label: 'Medium', cpu: 2, mem: 4096, gpu: 'none', price: '¥0.31/时', desc: '常规 Agent 任务' },
  { id: 'large',  label: 'Large',  cpu: 4, mem: 8192, gpu: 'none', price: '¥0.78/时', desc: '数据处理/构建' },
  { id: 'xlarge', label: 'XLarge', cpu: 8, mem: 16384, gpu: 'A100', price: '¥3.20/时', desc: '推理/重计算' },
];

const CreateSandbox = () => {
  const [sandboxName, setSandboxName] = useState('agent-sandbox-001');
  const [selectedCustom, setSelectedCustom] = useState(null);
  const [selectedTools, setSelectedTools] = useState([]);
  const [envVars, setEnvVars] = useState([{ key: 'DEBUG_MODE', value: 'true', secret: false }]);
  const [portMappings, setPortMappings] = useState([{ port: '8080', protocol: 'HTTP', route: 'api' }]);
  const [size, setSize] = useState('medium');
  const [idleTimeout, setIdleTimeout] = useState(300);
  const [maxLifetime, setMaxLifetime] = useState(24);
  const [autoRestart, setAutoRestart] = useState(true);
  // 下沉触发分档：消息间挂起（低延迟，对标 Cursor hibernate between messages）+ idle 长时间下沉（省钱，对标 auto_stop）
  const [hibernateBetweenMsgs, setHibernateBetweenMsgs] = useState(true);
  const [idleSuspendEnabled, setIdleSuspendEnabled] = useState(true);
  const [prewarmEnabled, setPrewarmEnabled] = useState(true);
  const [prewarmMin, setPrewarmMin] = useState(1);
  const [egressMode, setEgressMode] = useState('allowlist');
  const [egressList, setEgressList] = useState('api.openai.com\ngithub.com\npypi.org');
  const [probeEnabled, setProbeEnabled] = useState(true);
  const [tags, setTags] = useState('prod, codegen');
  const [project, setProject] = useState('codegen');
  const [region, setRegion] = useState('cn-east-1');
  const [volumeSize, setVolumeSize] = useState(20);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  const selectedSize = RESOURCE_SIZES.find(s => s.id === size);
  const toggleTool = (t) => setSelectedTools(s => s.find(x => x.id === t.id) ? s.filter(x => x.id !== t.id) : [...s, t]);

  const handleDeploy = () => {
    setIsDeploying(true);
    setTimeout(() => { setIsDeploying(false); setDeploySuccess(true); setTimeout(() => setDeploySuccess(false), 3000); }, 2000);
  };

  const updatePort = (i, f, v) => { const n = [...portMappings]; n[i][f] = v; setPortMappings(n); };
  // 简单的端口冲突校验
  const ports = portMappings.map(m => m.port).filter(Boolean);
  const portConflict = ports.length !== new Set(ports).size;

  const summary = [
    { label: '实例名称', value: sandboxName || '未命名' },
    { label: '资源规格', value: `${selectedSize.label} · ${selectedSize.cpu}核/${selectedSize.mem}MiB${selectedSize.gpu !== 'none' ? ` · GPU ${selectedSize.gpu}` : ''}` },
    { label: '镜像结构', value: selectedCustom ? `底座 + ${selectedCustom.name}` : '仅底座' },
    { label: '挂载工具', value: selectedTools.length ? selectedTools.map(t => t.name).join(', ') : '无' },
    { label: '网络出口', value: egressMode === 'open' ? '完全开放' : egressMode === 'deny' ? '完全禁止' : '域名白名单' },
    { label: '消息间挂起', value: hibernateBetweenMsgs ? '开启（低延迟）' : '关闭' },
    { label: 'Idle 下沉', value: idleSuspendEnabled ? `${idleTimeout}s → 休眠` : '关闭' },
    { label: '预热池', value: prewarmEnabled ? `${prewarmMin} 台常驻` : '关闭' },
    { label: '最大存活', value: `${maxLifetime}h 强制销毁` },
    { label: '持久卷', value: `${volumeSize} GB` },
  ];

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      <div className="flex-1 space-y-5">

        {/* 基础信息 */}
        <Card className="p-6">
          <SectionTitle icon={<Settings className="w-5 h-5 text-blue-500" />} title="实例基础信息" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>沙箱名称</Label>
              <input value={sandboxName} onChange={e => setSandboxName(e.target.value)} placeholder="agent-sandbox-001"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <Label>所属项目</Label>
              <input value={project} onChange={e => setProject(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <Label>部署区域</Label>
              <select value={region} onChange={e => setRegion(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
                <option value="cn-east-1">华东 1 (cn-east-1)</option>
                <option value="cn-east-2">华东 2 (cn-east-2)</option>
                <option value="cn-north-1">华北 1 (cn-north-1)</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Label>标签 <span className="text-gray-400 font-normal">(逗号分隔，用于检索与批量操作)</span></Label>
            <input value={tags} onChange={e => setTags(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
        </Card>

        {/* 资源规格 */}
        <Card className="p-6">
          <SectionTitle icon={<Cpu className="w-5 h-5 text-blue-500" />} title="资源规格" desc="沙箱是资源型实例，必须显式限定 CPU/内存/GPU，防止单实例耗尽宿主机资源。" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {RESOURCE_SIZES.map(s => (
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
            <div className="relative">
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
                {INITIAL_CUSTOM_IMAGES.map(img => {
                  const Icon = img.icon;
                  return (
                    <button key={img.id} onClick={() => setSelectedCustom(img)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${selectedCustom?.id === img.id ? 'border-purple-500 bg-purple-50/50' : 'border-gray-200 hover:border-purple-300'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2"><Icon className="w-5 h-5" /><span className="font-semibold text-sm">{img.name}</span></div>
                        {selectedCustom?.id === img.id && <CheckCircle className="w-4 h-4 text-purple-500" />}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{img.desc}</div>
                      <div className="text-[10px] text-gray-400 mt-1">{img.version} · {img.size} · {img.scan === 'pass' ? '✓ 已扫描' : '⚠ 待复核'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* 工具挂载 */}
        <Card className="p-6">
          <SectionTitle icon={<Wrench className="w-5 h-5 text-blue-500" />} title="动态挂载辅助工具" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {INITIAL_TOOLS.map(tool => {
              const sel = selectedTools.find(t => t.id === tool.id);
              return (
                <button key={tool.id} onClick={() => toggleTool(tool)}
                  className={`text-left p-3 rounded-lg border transition-all ${sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{tool.name}</span>
                    {sel && <CheckCircle className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{tool.desc}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{tool.version} · {tool.install}</div>
                </button>
              );
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
                <input value={env.key} onChange={e => { const n = [...envVars]; n[i].key = e.target.value; setEnvVars(n); }} placeholder="变量名"
                  className="flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500" />
                <span className="text-gray-400">=</span>
                <input value={env.value} onChange={e => { const n = [...envVars]; n[i].value = e.target.value; setEnvVars(n); }} placeholder="变量值"
                  type={env.secret ? 'password' : 'text'}
                  className={`flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500 ${env.secret ? 'bg-amber-50 border-amber-200' : ''}`} />
                <label className="w-20 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={env.secret} onChange={e => { const n = [...envVars]; n[i].secret = e.target.checked; setEnvVars(n); }} className="rounded" />加密
                </label>
                <button onClick={() => { const n = [...envVars]; n.splice(i, 1); setEnvVars(n); }} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
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
                <input type="number" value={m.port} onChange={e => updatePort(i, 'port', e.target.value)} placeholder="8080"
                  className={`flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500 ${portConflict && ports.indexOf(m.port) !== i ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                <select value={m.protocol} onChange={e => updatePort(i, 'protocol', e.target.value)} className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-blue-500">
                  <option>HTTP</option><option>WebSocket</option><option>TCP</option>
                </select>
                <div className="flex-1 flex items-center">
                  <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-md px-3 py-2 text-sm text-gray-500">/sandbox/</span>
                  <input value={m.route} onChange={e => updatePort(i, 'route', e.target.value)} placeholder="api"
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
              {[{ k: 'deny', l: '完全禁止', d: '最安全' }, { k: 'allowlist', l: '域名白名单', d: '推荐' }, { k: 'open', l: '完全开放', d: '⚠ 不安全' }].map(o => (
                <button key={o.k} onClick={() => setEgressMode(o.k)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${egressMode === o.k ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="text-sm font-medium text-gray-800">{o.l}</div><div className="text-xs text-gray-400">{o.d}</div>
                </button>
              ))}
            </div>
            {egressMode === 'allowlist' && (
              <textarea value={egressList} onChange={e => setEgressList(e.target.value)} rows={3}
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
                <input type="checkbox" checked={hibernateBetweenMsgs} onChange={e => setHibernateBetweenMsgs(e.target.checked)} className="rounded" />
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
                <input type="checkbox" checked={idleSuspendEnabled} onChange={e => setIdleSuspendEnabled(e.target.checked)} className="rounded" />
              </label>
              <p className="text-xs text-gray-500 mt-1.5 ml-6">无真实资源活动（CPU/网络/并发）超阈值后，从挂起进一步下沉到休眠（内存落盘），省更多钱、恢复稍慢。对标 Daytona autoStop / Fly auto_stop。</p>
              {idleSuspendEnabled && (
                <div className="mt-3 ml-6 flex items-center gap-3">
                  <Label className="whitespace-nowrap mb-0">空闲超时（秒）</Label>
                  <input type="number" value={idleTimeout} onChange={e => setIdleTimeout(+e.target.value)}
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
              <input type="checkbox" checked={prewarmEnabled} onChange={e => setPrewarmEnabled(e.target.checked)} className="rounded" />
            </label>
            <p className="text-xs text-gray-500 mt-1.5 ml-6">常驻若干已就绪实例，新 agent 命中即用、跳过冷启动。对标 Cursor prewarmed VMs。代价：常驻实例持续计费，按预算权衡。</p>
            {prewarmEnabled && (
              <div className="mt-3 ml-6 flex items-center gap-3">
                <Label className="whitespace-nowrap mb-0">常驻数量</Label>
                <input type="number" min="0" value={prewarmMin} onChange={e => setPrewarmMin(+e.target.value)}
                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                <span className="text-xs text-gray-400">台</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            <div>
              <Label>最大存活时长（强制销毁 / 小时）</Label>
              <input type="number" value={maxLifetime} onChange={e => setMaxLifetime(+e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <p className="text-xs text-gray-400 mt-1">防失控成本与逃逸风险的硬性上限（休眠期间时钟继续走）</p>
            </div>
          </div>
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input type="checkbox" checked={autoRestart} onChange={e => setAutoRestart(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">异常崩溃自动重启（restart policy: Always，最多 3 次）</span>
          </label>
          <div className="mt-4 pt-4 border-t">
            <Label>持久卷挂载</Label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="0" max="100" value={volumeSize} onChange={e => setVolumeSize(+e.target.value)} className="flex-1 accent-blue-600" />
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
            <input type="checkbox" checked={probeEnabled} onChange={e => setProbeEnabled(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">启用探针</span>
          </label>
          {probeEnabled && (
            <div className="space-y-3">
              {['Liveness', 'Readiness', 'Startup'].map(p => (
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
            {summary.map(s => (
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
          <button className="mt-2 w-full py-2 px-4 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-1"><Bookmark className="w-4 h-4" />另存为模板</button>
        </div>
      </div>
    </div>
  );
};

/* ========================= 4. 成本配额仪表盘 =========================== */

const CostDashboard = () => {
  const q = QUOTA;
  const spentPct = Math.round((q.spentMonth / q.budgetMonthly) * 100);
  const priceTiers = [
    { size: 'Small', cpu: '1核/2G', price: '¥0.12/时' },
    { size: 'Medium', cpu: '2核/4G', price: '¥0.31/时' },
    { size: 'Large', cpu: '4核/8G', price: '¥0.78/时' },
    { size: 'XLarge', cpu: '8核/16G + A100', price: '¥3.20/时' },
  ];
  const projectSpend = [
    { project: 'codegen', cost: 182.4, pct: 44 },
    { project: 'etl',     cost: 142.1, pct: 34 },
    { project: 'inference', cost: 68.5, pct: 17 },
    { project: 'research',  cost: 19.6, pct: 5 },
  ];
  return (
    <div className="space-y-4">
      {/* 预算概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle icon={<DollarSign className="w-5 h-5 text-blue-500" />} title="本月预算" />
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-gray-800">¥{q.spentMonth}</span>
            <span className="text-sm text-gray-400 mb-1">/ ¥{q.budgetMonthly}</span>
            <span className={`text-sm font-medium mb-1 ${spentPct > 80 ? 'text-red-600' : 'text-emerald-600'}`}>{spentPct}%</span>
          </div>
          <div className="mt-3"><ProgressBar value={spentPct} color={spentPct > 80 ? 'red' : 'emerald'} /></div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />50% 预警</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />80% 预警</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />100% 超限动作: 暂停新建</span>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={<ShieldAlert className="w-5 h-5 text-amber-500" />} title="超限动作" />
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded" /><span className="text-gray-700">达 80% 邮件告警</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded" /><span className="text-gray-700">达 100% 暂停新建</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" /><span className="text-gray-700">达 120% 强制休眠非 prod</span></label>
          </div>
        </Card>
      </div>

      {/* 配额 */}
      <Card className="p-5">
        <SectionTitle icon={<Gauge className="w-5 h-5 text-blue-500" />} title="资源配额使用" desc="按组织/项目维度限制并发、CPU、内存、存储与 GPU。" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <QuotaBar label="实例数" used={q.used.instances} limit={q.limit.instances} unit="" />
          <QuotaBar label="CPU（核）" used={q.used.cpu} limit={q.limit.cpu} unit="" />
          <QuotaBar label="内存（MiB）" used={q.used.mem} limit={q.limit.mem} unit="" />
          <QuotaBar label="GPU（张）" used={q.used.gpu} limit={q.limit.gpu} unit="" />
          <QuotaBar label="存储（GB）" used={q.used.storage} limit={q.limit.storage} unit="" />
          <QuotaBar label="并发创建中" used={2} limit={5} unit="" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 项目花费分布 */}
        <Card className="p-5">
          <SectionTitle icon={<Activity className="w-5 h-5 text-blue-500" />} title="按项目花费分布（本月）" />
          <div className="space-y-3">
            {projectSpend.map(p => (
              <div key={p.project}>
                <div className="flex justify-between text-sm mb-1"><span className="text-gray-700">{p.project}</span><span className="font-medium text-gray-800">¥{p.cost}</span></div>
                <ProgressBar value={p.pct} />
              </div>
            ))}
          </div>
        </Card>
        {/* 单价表 */}
        <Card className="p-5">
          <SectionTitle icon={<Cpu className="w-5 h-5 text-blue-500" />} title="规格单价表" desc="按秒计费，不足 1 分钟按 1 分钟计。" />
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left py-2 font-medium">规格</th><th className="text-left font-medium">配置</th><th className="text-right font-medium">单价</th></tr></thead>
            <tbody>
              {priceTiers.map(t => (
                <tr key={t.size} className="border-b border-gray-100"><td className="py-2.5 font-medium text-gray-700">{t.size}</td><td className="text-gray-500">{t.cpu}</td><td className="text-right text-blue-600 font-medium">{t.price}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

/* ========================= 5. 镜像库（升级） =========================== */

const ImageLibrary = () => (
  <Card className="overflow-hidden">
    <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
      <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800"><Layers className="w-5 h-5 text-purple-500" />镜像库管理</h2>
      <button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> 新建镜像</button>
    </div>
    <table className="w-full text-left text-sm">
      <thead><tr className="bg-gray-50 border-b text-gray-500 text-xs">
        <th className="px-6 py-3 font-medium">镜像</th><th className="px-6 py-3 font-medium">版本</th>
        <th className="px-6 py-3 font-medium">来源</th><th className="px-6 py-3 font-medium">大小</th>
        <th className="px-6 py-3 font-medium">安全扫描</th><th className="px-6 py-3 font-medium">引用</th>
        <th className="px-6 py-3 font-medium text-right">操作</th>
      </tr></thead>
      <tbody>
        {[{ id: BASE_IMAGE.id, name: BASE_IMAGE.name, version: '系统', source: '系统预置', size: BASE_IMAGE.size, scan: 'pass', refs: 5, system: true },
          ...INITIAL_CUSTOM_IMAGES.map(i => ({ ...i, refs: i.id === 'scene-cpp' ? 2 : 1, system: false }))].map(row => {
          const Icon = row.icon || Server;
          return (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${row.id === 'agent-base' ? 'text-blue-600' : 'text-purple-500'}`} />
                  <div><div className="font-medium text-gray-800">{row.name}</div><div className="text-xs text-gray-400 font-mono">{row.id}</div></div>
                </div>
              </td>
              <td className="px-6 py-4 text-gray-600">{row.version}</td>
              <td className="px-6 py-4"><span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{row.source}</span></td>
              <td className="px-6 py-4 text-gray-600">{row.size}</td>
              <td className="px-6 py-4">
                {row.scan === 'pass'
                  ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">✓ 无漏洞</span>
                  : <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">⚠ {row.scan === 'warn' ? '2 中危' : '未扫描'}</span>}
              </td>
              <td className="px-6 py-4 text-gray-500">{row.refs} 实例</td>
              <td className="px-6 py-4 text-right">
                {!row.system && <>
                  <button className="text-gray-400 hover:text-blue-500 p-1 mx-0.5"><Eye className="w-4 h-4" /></button>
                  <button className="text-gray-400 hover:text-blue-500 p-1 mx-0.5"><Edit2 className="w-4 h-4" /></button>
                  <button className="text-gray-400 hover:text-red-500 p-1 mx-0.5"><Trash2 className="w-4 h-4" /></button>
                </>}
                {row.system && <span className="text-xs text-gray-400">系统镜像</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </Card>
);

/* ========================= 6. 工具箱（升级） =========================== */

const ToolLibrary = () => (
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
        {INITIAL_TOOLS.map(t => (
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
              <span className={`text-xs px-2 py-1 rounded-full ${t.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{t.enabled ? '默认启用' : '按需'}</span>
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
);

/* ========================= 7. 模板库 =================================== */

const TemplateLibrary = ({ setActiveTab }) => (
  <div className="space-y-4">
    <Card className="p-5">
      <SectionTitle icon={<Bookmark className="w-5 h-5 text-blue-500" />} title="模板库"
        desc="把常用配置（镜像+规格+工具+端口+探针+治理）封装成模板，一键创建。也可从现有实例另存为模板。"
        right={<button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> 新建模板</button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INITIAL_TEMPLATES.map(t => (
          <div key={t.id} className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2"><Bookmark className="w-5 h-5 text-blue-500" /><span className="font-semibold text-gray-800">{t.name}</span></div>
              <span className="text-xs text-gray-400">{t.updated}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t.desc}</p>
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <div className="flex justify-between"><span className="text-gray-400">镜像</span><span>{t.image}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">规格</span><span>{t.size} · {t.cpu}核/{t.mem}MiB</span></div>
              <div className="flex justify-between"><span className="text-gray-400">工具</span><span>{t.tools.join(', ')}</span></div>
            </div>
            <div className="flex gap-1.5 mt-1">{t.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">#{tag}</span>)}</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setActiveTab('create')} className="flex-1 text-xs py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1"><Play className="w-3 h-3" />从此创建</button>
              <button className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50"><Edit2 className="w-3 h-3" /></button>
              <button className="text-xs px-2 py-1.5 rounded border border-gray-200 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

/* ===================== 8. 环境快照（Cold，开发者拥有） ================== */
/* Cold 磁盘快照作为「可复用环境来源」独立成页——语义是「新实例从这份已装好依赖的环境起跑」，
   而非「恢复某个实例」。开发者拥有；运维治理 TTL/配额/失效降级。对标 Cursor
   .cursor/environment.json 的 "snapshot" 字段。 */
const EnvironmentSnapshots = ({ setActiveTab }) => {
  const ENV_META = {
    ready:     { label: '可用',   cls: 'bg-emerald-50 text-emerald-700' },
    degraded:  { label: '已降级', cls: 'bg-amber-50 text-amber-700' },
    expired:   { label: '已过期', cls: 'bg-gray-100 text-gray-400' },
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle icon={<HardDrive className="w-5 h-5 text-sky-500" />} title="环境快照库（Cold · 磁盘级）"
          desc="把「装好依赖的开发环境」存为可复用快照，新 agent 可直接从快照起跑，省去重装依赖。失效时系统自动降级为默认 base image（标「环境就绪·有警告」），不阻塞 agent 启动。"
          right={<button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> 新建环境快照</button>} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ENV_SNAPSHOTS.map(s => {
            const m = ENV_META[s.status];
            return (
              <div key={s.id} className={`p-4 rounded-xl border transition-all ${s.status === 'expired' ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-sky-300 hover:shadow-sm'}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2"><HardDrive className="w-5 h-5 text-sky-500" /><span className="font-semibold text-gray-800 text-sm">{s.label}</span></div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${m.cls}`}>{m.label}</span>
                </div>
                <div className="text-xs text-gray-400 font-mono mt-2">{s.id}</div>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between"><span className="text-gray-400">来源实例</span><span className="font-mono">{s.source}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">大小 / TTL</span><span>{s.size} · {s.ttl}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">引用</span><span>{s.refs} 实例</span></div>
                  <div className="pt-1"><span className="text-gray-400">已装依赖</span><div className="text-gray-500 font-mono mt-0.5 break-all">{s.deps}</div></div>
                </div>
                {s.status === 'degraded' && (
                  <div className="mt-2 text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />快照失效，新 agent 已降级用默认环境
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setActiveTab && setActiveTab('create')} disabled={s.status === 'expired'}
                    className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 ${s.status === 'expired' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>
                    <Play className="w-3 h-3" />从此环境创建
                  </button>
                  <button disabled={s.status === 'expired'} className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><Edit2 className="w-3 h-3" /></button>
                  <button className="text-xs px-2 py-1.5 rounded border border-gray-200 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle icon={<Info className="w-5 h-5 text-blue-500" />} title="为什么环境快照独立于此处？"
          desc="三层状态归口：会话状态系统独管 / VM 运行态系统跑运维可覆盖 / 环境快照开发者拥有。" />
        <div className="text-sm text-gray-600 leading-relaxed space-y-2">
          <p>• <strong>语义不同</strong>：实例详情的 Warm 快照是「冻住这个跑了一半的实例、稍后接着跑」（恢复运行态）；环境快照是「把这份装好依赖的环境存下来、开新实例时复用」（环境来源）。两者不是一回事。</p>
          <p>• <strong>归属不同</strong>：环境快照绑定你的代码库与依赖，是开发者资产，跨实例共享；Warm 快照绑定具体实例的运行态，用完即弃。</p>
          <p>• <strong>对标</strong>：Cursor 的 <code className="text-xs bg-gray-100 px-1 rounded">.cursor/environment.json</code> 里 <code className="text-xs bg-gray-100 px-1 rounded">"snapshot"</code> 字段引用的正是这类环境快照，作为新 agent 的环境来源。</p>
        </div>
      </Card>
    </div>
  );
};

/* ========================= 9. 网络/域名管理 ============================ */

const NetworkManager = () => (
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
          ].map(p => (
            <div key={p.name} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center"><span className="font-medium text-sm text-gray-800">{p.name}</span><span className="text-xs text-gray-400">{p.desc}</span></div>
              <div className="flex flex-wrap gap-1 mt-2">
                {p.allow.map(a => <span key={a} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{a}</span>)}
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
);

/* ========================= 10. 系统设置（全局策略默认） ================= */
/* 组织级默认值：新实例未显式配置时继承此处。三类策略分别归口：
   单实例→创建页 / 钱→成本配额页 / 全局默认→此页。对应 DESIGN.md P2 系统设置模块。 */
const SystemSettings = () => {
  // 生命周期默认
  const [defHibernateBetween, setDefHibernateBetween] = useState(true);
  const [defIdleTimeout, setDefIdleTimeout] = useState(300);
  const [defMaxLifetime, setDefMaxLifetime] = useState(24);
  const [defPrewarmEnabled, setDefPrewarmEnabled] = useState(true);
  const [defPrewarmMin, setDefPrewarmMin] = useState(1);
  // 环境快照默认
  const [defSnapTtl, setDefSnapTtl] = useState(14);
  const [defSnapFallback, setDefSnapFallback] = useState(true);
  // 安全默认
  const [defEgress, setDefEgress] = useState('allowlist');
  const [defDockerCli, setDefDockerCli] = useState(false);

  const Toggle = ({ on, setOn, label, desc }) => (
    <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer">
      <div>
        <div className="text-sm text-gray-800">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
      </div>
      <button onClick={() => setOn(!on)} className={`relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5 ${on ? 'bg-blue-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle icon={<Clock className="w-5 h-5 text-blue-500" />} title="生命周期默认策略"
          desc="新实例未显式配置时继承这些默认值。对应「系统怎么管生命周期」的全局规矩——创建页的初始值即取自此处。" />
        <div className="divide-y divide-gray-100">
          <Toggle on={defHibernateBetween} setOn={setDefHibernateBetween} label="消息间自动挂起（默认开）"
            desc="每轮工具执行后、等待下条消息时挂起 VM（保内存），消息到达即恢复。近零延迟来回切换。" />
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认 Idle 下沉超时</div><div className="text-xs text-gray-400 mt-0.5">无真实资源活动多久后，从挂起进一步下沉到休眠（落盘省钱）</div></div>
            <div className="flex items-center gap-2">
              <input type="number" value={defIdleTimeout} onChange={e => setDefIdleTimeout(+e.target.value)} className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-400">秒</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认最大存活时长</div><div className="text-xs text-gray-400 mt-0.5">强制销毁的硬上限，休眠期间时钟继续走</div></div>
            <div className="flex items-center gap-2">
              <input type="number" value={defMaxLifetime} onChange={e => setDefMaxLifetime(+e.target.value)} className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-400">小时</span>
            </div>
          </div>
          <Toggle on={defPrewarmEnabled} setOn={setDefPrewarmEnabled} label="预热池（默认开）"
            desc="常驻若干已就绪实例，新 agent 命中即用、跳过冷启动。代价：常驻实例持续计费。" />
          {defPrewarmEnabled && (
            <div className="flex items-center justify-between py-2.5 pl-4">
              <div className="text-sm text-gray-700">默认预热池大小</div>
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={defPrewarmMin} onChange={e => setDefPrewarmMin(+e.target.value)} className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                <span className="text-xs text-gray-400">台</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={<HardDrive className="w-5 h-5 text-sky-500" />} title="环境快照默认策略"
          desc="Cold 环境快照的全局默认：多久过期、失效时如何处理。" />
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认快照 TTL</div><div className="text-xs text-gray-400 mt-0.5">环境快照创建后保留多久，过期自动标记不可用</div></div>
            <div className="flex items-center gap-2">
              <input type="number" value={defSnapTtl} onChange={e => setDefSnapTtl(+e.target.value)} className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-400">天</span>
            </div>
          </div>
          <Toggle on={defSnapFallback} setOn={setDefSnapFallback} label="失效自动降级（默认开）"
            desc="快照过期/失效时，不阻塞 agent 启动，自动降级为默认 base image 并标「环境就绪·有警告」。" />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={<ShieldAlert className="w-5 h-5 text-amber-500" />} title="安全默认策略"
          desc="新实例的安全默认值。agent 执行不可信代码、自主发网络请求，出口与高权限工具默认从严。" />
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between py-2.5">
            <div><div className="text-sm text-gray-800">默认出口（Egress）策略</div><div className="text-xs text-gray-400 mt-0.5">防 agent 数据外泄的关键项。白名单=仅允许指定域名出站</div></div>
            <select value={defEgress} onChange={e => setDefEgress(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-blue-500">
              <option value="allowlist">域名白名单（推荐）</option>
              <option value="deny">完全禁止</option>
              <option value="open">完全开放（不安全）</option>
            </select>
          </div>
          <Toggle on={defDockerCli} setOn={setDefDockerCli} label="docker-cli 高权限工具（默认禁用）"
            desc="DooD（挂载宿主 Docker）属高权限工具，默认禁用，仅在受信场景手动开启。" />
        </div>
      </Card>

      <Card className="p-5 bg-blue-50/40 border-blue-100">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-gray-700 mb-1">策略三层归口</p>
            <p className="text-xs leading-relaxed">单实例策略在 <strong>创建页</strong> 设（覆盖此处默认）；花钱策略在 <strong>成本配额页</strong> 设（预算/配额/超限动作）；全局默认值在此页设，新实例未显式配置时继承。三者结合，就是「系统按规矩自动管」的全部规矩来源。</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ============================ App Root ================================== */

export default function SandboxManager() {
  const [activeTab, setActiveTab] = useState('instances');
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const selectedInstance = INSTANCES.find(i => i.id === selectedInstanceId);

  const handleSelectInstance = (id) => { setSelectedInstanceId(id); setActiveTab('instances'); };

  let content;
  if (activeTab === 'instances') {
    content = selectedInstance
      ? <InstanceDetail instance={selectedInstance} onBack={() => setSelectedInstanceId(null)} />
      : <InstanceList setActiveTab={setActiveTab} setSelectedInstance={handleSelectInstance} />;
  } else if (activeTab === 'create')    content = <CreateSandbox />;
  else if (activeTab === 'cost')        content = <CostDashboard />;
  else if (activeTab === 'images')      content = <ImageLibrary />;
  else if (activeTab === 'envsnap')     content = <EnvironmentSnapshots setActiveTab={setActiveTab} />;
  else if (activeTab === 'tools')       content = <ToolLibrary />;
  else if (activeTab === 'templates')   content = <TemplateLibrary setActiveTab={setActiveTab} />;
  else if (activeTab === 'network')     content = <NetworkManager />;
  else if (activeTab === 'settings')    content = <SystemSettings />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {content}
      </main>
    </div>
  );
}
