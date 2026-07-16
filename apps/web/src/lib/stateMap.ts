// 状态映射：OpenSandbox SandboxState → 原型 InstanceStatus
// 阶段 0 用 mock；阶段 1 起 getSandboxInfo 的 status.state 经此函数映射。
import type { InstanceStatus } from './types'

// OpenSandbox 生命周期状态（见 SDK models/sandboxes.ts SandboxState）。
// 注意：SDK 用 Creating/Error/Deleted 等命名，而非 OpenAPI yml 里的 Pending/Failed/Terminated。
export type OsbSandboxState =
  | 'Creating'
  | 'Running'
  | 'Pausing'
  | 'Paused'
  | 'Resuming'
  | 'Deleting'
  | 'Deleted'
  | 'Error'
  | string // SDK 声明可扩展未知值，需优雅降级

export const STATUS_META: Record<InstanceStatus, {
  label: string
  dot: string
  text: string
  bg: string
  ring: string
}> = {
  running: { label: '运行中', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  paused: { label: '已暂停', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  hibernating: { label: '休眠中', dot: 'bg-sky-400', text: 'text-sky-700', bg: 'bg-sky-50', ring: 'ring-sky-200' },
  stopped: { label: '已停止', dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50', ring: 'ring-gray-200' },
  error: { label: '异常', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200' },
  terminated: { label: '已销毁', dot: 'bg-gray-300', text: 'text-gray-400', bg: 'bg-gray-50', ring: 'ring-gray-200' },
  creating: { label: '创建中', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200' },
}

/**
 * OpenSandbox state → 原型 status。
 * - hibernating / stopped 在 OpenSandbox 里都落到 Paused；
 *   BFF 用 metadata 或本地状态区分「主动暂停」vs「idle 下沉」，映射时还原（isIdleSuspended）。
 * - 未知 state 降级为 stopped，避免渲染崩。
 */
export function mapOsbState(state: OsbSandboxState, isIdleSuspended = false): InstanceStatus {
  switch (state) {
    case 'Creating':
    case 'Resuming':
      return 'creating'
    case 'Running':
      return 'running'
    case 'Pausing':
      return 'paused'
    case 'Paused':
      return isIdleSuspended ? 'hibernating' : 'paused'
    case 'Deleting':
    case 'Deleted':
      return 'terminated'
    case 'Error':
      return 'error'
    default:
      return 'stopped'
  }
}
