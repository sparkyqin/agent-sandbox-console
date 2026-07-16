// Execd 桥接抽象：把沙箱内 execd 的 metrics / 命令执行暴露给前端。
// 浏览器不能直连 execd（在沙箱内 + CORS + token），由 BFF 持有连接并转发。
import { loadConfig } from '../config.js'
import { realExecdBackend } from './execdBackendReal.js'
import { mockExecdBackend } from './mockExecdBackend.js'

export interface MetricsSample {
  cpu_used_pct: number
  mem_used_mib: number
  mem_total_mib: number
  cpu_count: number
  timestamp: number
}

export interface ExecRunResult {
  exitCode: number | null
  stdout: string
  stderr: string
  error?: string
}

export interface ExecdBackend {
  /** 订阅 metrics 流。onSample 每次被调；返回 stop 函数。 */
  subscribeMetrics(id: string, onSample: (s: MetricsSample) => void): Promise<() => void>
  /** 执行单条命令，返回完整输出。 */
  runCommand(id: string, command: string): Promise<ExecRunResult>
}

export function getExecdBackend(): ExecdBackend {
  return loadConfig().mock ? mockExecdBackend : realExecdBackend
}
