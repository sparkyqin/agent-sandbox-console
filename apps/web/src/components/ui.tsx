import type { ReactNode } from 'react'
import { STATUS_META } from '../lib/stateMap'
import type { InstanceStatus } from '../lib/types'

export const StatusBadge = ({ status }: { status: InstanceStatus }) => {
  const m = STATUS_META[status] || STATUS_META.stopped
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${m.bg} ${m.text} ring-1 ${m.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  )
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>{children}</div>
)

export const SectionTitle = ({
  icon,
  title,
  desc,
  right,
}: {
  icon?: ReactNode
  title: string
  desc?: string
  right?: ReactNode
}) => (
  <div className="mb-4 flex items-start justify-between">
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">{icon}{title}</h2>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
    {right}
  </div>
)

export const Label = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span className={`text-xs text-gray-500 font-medium ${className}`}>{children}</span>
)

export const ProgressBar = ({ value, color = 'blue' }: { value: number; color?: 'blue' | 'emerald' | 'amber' | 'red' }) => {
  const c = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[color]
  const v = Math.min(100, value)
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${c} ${v > 85 ? 'bg-red-500' : ''}`} style={{ width: `${v}%` }} />
    </div>
  )
}

export const QuotaBar = ({
  used,
  limit,
  unit,
  label,
}: {
  used: number
  limit: number
  unit: string
  label: string
}) => {
  const pct = limit ? Math.round((used / limit) * 100) : 0
  const color = pct > 90 ? 'red' : pct > 70 ? 'amber' : 'emerald'
  const c = { red: 'text-red-600', amber: 'text-amber-600', emerald: 'text-emerald-600' }[color]
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${c}`}>{used}{unit} / {limit}{unit} <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <ProgressBar value={pct} color={color === 'red' ? 'red' : color === 'amber' ? 'amber' : 'emerald'} />
    </div>
  )
}
