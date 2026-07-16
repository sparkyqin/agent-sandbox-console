// Idle 治理：两窗口模型（对标 Knative grace + stable）的 auto-stop。
// OpenSandbox 只有 timeout（销毁）+ renew-on-access（auto-start），无基于资源活动的 idle 判定，
// 故由 BFF 实现：watcher 周期性检查启用了 idle 的 Running 实例，连续低活动超阈值 → pause。
//
// 阶段5 MVP：
// - 配置从 idle_config 表读（创建时落，由表单 idleSuspendEnabled/idleTimeout 来）
// - 活动信号：real 模式调 metrics 看 cpu（<5% 视为空闲）；mock 模式用「距创建/恢复超 timeout 且无 pause/resume 事件」近似
// - 两窗口：grace（开始计时前宽限）+ stable（连续空闲判定窗口，简化为单阈值）
// - 触发：pause（保留状态，非销毁——对标 Daytona autoStop）
//
// 注：auto-start（访问即唤醒）透传 OSB 的 renew-on-access（OSEP-0009），本 watcher 不管唤醒。
import { getDb } from '../db.js'
import { recordEvent } from './control.js'
import { getBackend } from '../proxy/lifecycle.js'

let timer: ReturnType<typeof setInterval> | null = null
const lastActiveAt = new Map<string, number>() // sandboxId → 最近活动时间戳

export function startIdleWatcher(): void {
  if (timer) clearInterval(timer)
  // 每 5s 扫一次
  timer = setInterval(() => { void tick().catch(() => undefined) }, 5000)
}

export function stopIdleWatcher(): void {
  if (timer) { clearInterval(timer); timer = null }
}

/** 创建/恢复时落 idle 配置。 */
export function configureIdle(sandboxId: string, metadata: Record<string, string> | undefined): void {
  if (!metadata?.idleEnabled || metadata.idleEnabled !== '1') return
  const idleTimeout = parseInt(metadata.idleTimeout || '300', 10)
  getDb().prepare(
    'INSERT OR REPLACE INTO idle_config(sandbox_id, enabled, idle_timeout_seconds, grace_seconds, stable_seconds) VALUES(?, 1, ?, ?, ?)',
  ).run(sandboxId, idleTimeout, Math.min(30, Math.floor(idleTimeout / 4)), Math.max(60, Math.floor(idleTimeout / 2)))
}

/** 标记实例有活动（收到 metrics/命令时调用，重置 idle 计时）。 */
export function markActive(sandboxId: string): void {
  lastActiveAt.set(sandboxId, Date.now())
}

async function tick(): Promise<void> {
  let configs: { sandbox_id: string; idle_timeout_seconds: number }[]
  try {
    configs = getDb().prepare('SELECT sandbox_id, idle_timeout_seconds FROM idle_config WHERE enabled = 1')
      .all() as { sandbox_id: string; idle_timeout_seconds: number }[]
  } catch { return }
  const backend = getBackend()
  for (const cfg of configs) {
    try {
      const sb = await backend.get(cfg.sandbox_id)
      if (sb.status.state !== 'Running') continue
      if (!lastActiveAt.has(cfg.sandbox_id)) lastActiveAt.set(cfg.sandbox_id, Date.now())
      const idleMs = Date.now() - (lastActiveAt.get(cfg.sandbox_id) ?? Date.now())
      // 简化两窗口：超过 idle_timeout 视为稳定空闲（grace 已含在 idle_timeout 内）
      if (idleMs >= cfg.idle_timeout_seconds * 1000) {
        await backend.pause(cfg.sandbox_id)
        recordEvent(cfg.sandbox_id, 'Paused', 'idle_timeout', `Idle ${Math.round(idleMs / 1000)}s, auto-paused (grace+stable)`, 'Normal')
        lastActiveAt.delete(cfg.sandbox_id)
      }
    } catch { /* 实例可能已删，忽略 */ }
  }
}
