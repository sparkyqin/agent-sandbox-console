// Real execd backend：用 SDK Sandbox.connect 拿 commands/metrics。
// connect 较重，按 id 缓存 Sandbox 实例（TTL 5min）。
import { Sandbox } from '@alibaba-group/opensandbox'
import type { Sandbox as SandboxInstance } from '@alibaba-group/opensandbox'
import { loadConfig } from '../config.js'
import type { ExecdBackend, ExecRunResult, MetricsSample } from './execdBackend.js'

export interface _Shapes {
  MetricsSample: MetricsSample
  ExecRunResult: ExecRunResult
}

const sandboxCache = new Map<string, { sbx: SandboxInstance; lastUsed: number }>()
const CACHE_TTL_MS = 5 * 60_000

async function connectSandbox(id: string): Promise<SandboxInstance> {
  const cached = sandboxCache.get(id)
  if (cached) { cached.lastUsed = Date.now(); return cached.sbx }
  const cfg = loadConfig()
  const sbx = await Sandbox.connect({
    connectionConfig: { domain: cfg.osbDomain, protocol: cfg.osbProtocol, apiKey: cfg.osbApiKey },
    sandboxId: id,
    skipHealthCheck: true,
  })
  sandboxCache.set(id, { sbx, lastUsed: Date.now() })
  if (sandboxCache.size > 64) evictCache()
  return sbx
}

function evictCache() {
  const now = Date.now()
  for (const [id, entry] of sandboxCache) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      void entry.sbx.close().catch(() => undefined)
      sandboxCache.delete(id)
    }
  }
}

export const realExecdBackend: ExecdBackend = {
  async subscribeMetrics(id, onSample) {
    const sbx = await connectSandbox(id)
    let stopped = false
    // SDK 的 ExecdMetrics 只有 getMetrics（无 watch），用轮询转 SSE。
    const tick = async () => {
      if (stopped) return
      try {
        const m = await sbx.metrics.getMetrics()
        onSample({
          cpu_used_pct: m.cpuUsedPercentage,
          mem_used_mib: m.memoryUsedMiB,
          mem_total_mib: m.memoryTotalMiB,
          cpu_count: m.cpuCount,
          timestamp: Date.now(),
        })
      } catch { /* 单次取失败不中断流 */ }
    }
    await tick()
    const handle = setInterval(tick, 1000)
    return () => { stopped = true; clearInterval(handle) }
  },

  async runCommand(id, command) {
    const sbx = await connectSandbox(id)
    const exec = await sbx.commands.run(command, {})
    return {
      exitCode: exec.exitCode ?? null,
      stdout: exec.logs.stdout.map((l) => l.text).join(''),
      stderr: exec.logs.stderr.map((l) => l.text).join(''),
    }
  },
}
