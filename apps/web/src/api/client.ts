// BFF 调用封装：前端所有后端调用经此。同源 /api/*，无需处理 CORS 或 API key。
// 阶段 0：仅提供 fetch 封装与错误归一化，供阶段 1 的 SWR hooks 使用。

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let code: string | undefined
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      code = body.code
      message = body.message ?? message
    } catch {
      // 非 JSON 错误体
    }
    throw new ApiError(message, res.status, code)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
