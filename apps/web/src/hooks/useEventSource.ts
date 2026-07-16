// SSE hook：连接 BFF /stream/* 端点，按 event 类型分发消息。
// 自动重连由浏览器 EventSource 内置（断线重试）。卸载时关闭。
import { useEffect, useRef, useState } from 'react'

export interface SSEMessage {
  event: string
  data: string
}

/**
 * 订阅 SSE 流，返回最近一条消息（按 event 类型）。
 * @param url 完整的 /stream/* 路径；传 null 不订阅
 * @param events 关心的事件名列表
 */
export function useSSE<T = SSEMessage>(
  url: string | null,
  events: string[],
  onMessage?: (event: string, data: string) => void,
): { lastMessage: SSEMessage | null; connected: boolean } {
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null)
  const [connected, setConnected] = useState(false)
  const cbRef = useRef(onMessage)
  cbRef.current = onMessage

  useEffect(() => {
    if (!url) return
    const es = new EventSource(url)
    const onOpen = () => setConnected(true)
    const onError = () => setConnected(false)
    es.addEventListener('open', onOpen)
    es.addEventListener('error', onError)
    for (const ev of events) {
      const handler = (e: MessageEvent) => {
        const msg = { event: ev, data: e.data as string }
        setLastMessage(msg)
        cbRef.current?.(ev, e.data as string)
      }
      es.addEventListener(ev, handler)
    }
    return () => { es.close(); setConnected(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, events.join(',')])

  return { lastMessage, connected }
}
