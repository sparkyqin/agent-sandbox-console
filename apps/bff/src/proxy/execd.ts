// Execd 路由：metrics/logs 走 SSE（前端 EventSource 消费），命令执行走 POST。
// SSE 连接由 BFF 持有到 execd 的订阅，逐帧转发给浏览器。
import { streamSSE } from 'hono/streaming'
import type { Hono } from 'hono'
import type { Context } from 'hono'
import { getExecdBackend, type MetricsSample } from './execdBackend.js'

export function registerExecdRoutes(app: Hono): void {
  // 监控：SSE 流，每秒一帧 metrics
  app.get('/stream/metrics/:id', (c) =>
    streamSSE(c, async (stream) => {
      const id = c.req.param('id')
      let aborted = false
      const stop = await getExecdBackend().subscribeMetrics(id, async (sample: MetricsSample) => {
        if (aborted) return
        try {
          await stream.writeSSE({ event: 'metrics', data: JSON.stringify(sample) })
        } catch { aborted = true }
      })
      // 客户端断开时清理
      stream.onAbort(() => { aborted = true; stop() })
      // 保持连接直到客户端断开
      while (!aborted) {
        await new Promise((r) => setTimeout(r, 1000))
      }
      stop()
    }),
  )

  // 日志：SSE 流。mock 模式自造日志行；real 模式跑 `tail -f` 类命令转发其 SSE 输出。
  // 阶段3 MVP：mock 自造固定样本日志流；real 的真实日志源（应用日志文件）阶段后续细化。
  app.get('/stream/logs/:id', (c) =>
    streamSSE(c, async (stream) => {
      const id = c.req.param('id')
      let aborted = false
      stream.onAbort(() => { aborted = true })

      // 一组循环播放的样本日志（mock），模拟 agent 运行日志
      const lines = [
        { t: ts(), lvl: 'INFO', msg: `agent runtime heartbeat (sandbox ${id})` },
        { t: ts(), lvl: 'INFO', msg: 'tool call: git status' },
        { t: ts(), lvl: 'DEBUG', msg: 'workspace files: 42' },
        { t: ts(), lvl: 'WARN', msg: 'egress allowlist active' },
        { t: ts(), lvl: 'INFO', msg: 'processing next message…' },
      ]
      let i = 0
      while (!aborted) {
        const line = lines[i % lines.length]
        i++
        try {
          await stream.writeSSE({ event: 'log', data: JSON.stringify({ ...line, t: ts() }) })
        } catch { aborted = true }
        await new Promise((r) => setTimeout(r, 2500))
      }
    }),
  )

  // 终端：执行单条命令，返回完整输出（MVP 非交互式）
  app.post('/api/exec/:id/run', async (c) => {
    try {
      const id = c.req.param('id')
      const { command } = await c.req.json<{ command: string }>()
      if (!command) return c.json({ code: 'INVALID_REQUEST', message: 'command required' }, 400)
      const res = await getExecdBackend().runCommand(id, command)
      return c.json(res)
    } catch (e) {
      return errorResponse(c, e)
    }
  })
}

function ts(): string {
  return new Date().toISOString().slice(11, 19)
}

function errorResponse(c: Context, e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  return c.json({ code: 'BFF_EXECD_ERROR', message }, 502)
}
