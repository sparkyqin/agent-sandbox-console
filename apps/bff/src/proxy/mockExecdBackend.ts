// Mock execd backend：无真实 execd 时自造 metrics 波动 + 命令回显。
// 让前端 SSE/命令执行链路在无 OSB 时可验证。real 模式见 execdBackendReal.ts。
import type { ExecdBackend, ExecRunResult, MetricsSample } from './execdBackend.js'
import { getMockSandboxSync } from './mockBackend.js'

// 每个 sandbox 一个伪随机基线，让不同实例的 metrics 有区分度。
function baselineFor(id: string): { cpu: number; mem: number; memTotal: number } {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const cpu = 15 + (h % 50) // 15-65%
  const mem = 20 + ((h >> 4) % 40) // 20-60%
  return { cpu, mem, memTotal: 4096 }
}

export const mockExecdBackend: ExecdBackend = {
  async subscribeMetrics(id, onSample) {
    // 终止/异常/创建中实例无 metrics（与真实 execd 不可达一致）
    const sb = getMockSandboxSync(id)
    const alive = sb && !['Deleted', 'Error', 'Creating'].includes(sb.status.state)
    if (!alive) {
      onSample({ cpu_used_pct: 0, mem_used_mib: 0, mem_total_mib: 0, cpu_count: 0, timestamp: Date.now() })
      return () => undefined
    }
    const base = baselineFor(id)
    let stopped = false
    const tick = () => {
      if (stopped) return
      // 围绕基线波动
      const wobble = Math.sin(Date.now() / 3000) * 8 + (Math.random() - 0.5) * 6
      const cpu = Math.max(0, Math.min(100, base.cpu + wobble))
      const mem = Math.max(0, Math.min(100, base.mem + wobble * 0.6))
      onSample({
        cpu_used_pct: Math.round(cpu * 10) / 10,
        mem_used_mib: Math.round((mem / 100) * base.memTotal),
        mem_total_mib: base.memTotal,
        cpu_count: 2,
        timestamp: Date.now(),
      })
    }
    tick()
    const handle = setInterval(tick, 1000)
    return () => { stopped = true; clearInterval(handle) }
  },

  async runCommand(id, command): Promise<ExecRunResult> {
    const sb = getMockSandboxSync(id)
    if (!sb) return { exitCode: 127, stdout: '', stderr: `sandbox ${id} not found` }
    if (['Deleted', 'Creating'].includes(sb.status.state)) {
      return { exitCode: 127, stdout: '', stderr: `sandbox ${id} is ${sb.status.state}, execd unavailable` }
    }
    const cmd = command.trim()
    if (/^ls\b/.test(cmd)) return { exitCode: 0, stdout: 'main.py\nrequirements.txt\nREADME.md\nsrc/\nbuild/\n', stderr: '' }
    if (cmd === 'pwd') return { exitCode: 0, stdout: '/workspace\n', stderr: '' }
    if (/^echo\b/.test(cmd)) return { exitCode: 0, stdout: cmd.slice(5).replace(/^["']|["']$/g, '') + '\n', stderr: '' }
    if (cmd === 'whoami') return { exitCode: 0, stdout: 'agent\n', stderr: '' }
    if (cmd === 'date') return { exitCode: 0, stdout: new Date().toString() + '\n', stderr: '' }
    if (/^cat\s+\/etc\/hostname/.test(cmd)) return { exitCode: 0, stdout: `${id}\n`, stderr: '' }
    if (cmd === 'uname -a') return { exitCode: 0, stdout: `Linux ${id} 6.6.0 #1 SMP x86_64 GNU/Linux\n`, stderr: '' }
    if (cmd.startsWith('python')) return { exitCode: 0, stdout: 'Python 3.11.14 (main)\n>>> \n', stderr: '' }
    if (cmd === '') return { exitCode: 0, stdout: '', stderr: '' }
    const bin = cmd.split(/\s+/)[0]
    return { exitCode: 127, stdout: '', stderr: `bash: ${bin}: command not found\n` }
  },
}
