// BFF 配置：从环境变量读取 OpenSandbox 连接信息与 BFF 自身设置。
// API key 只在 BFF 侧持有，绝不下发给浏览器。

export interface AppConfig {
  osbDomain: string
  osbProtocol: 'http' | 'https'
  osbApiKey: string
  bffPort: number
  dbPath: string
  /** 开启时 lifecycle 路由返回内存假数据，无需真实 OpenSandbox 即可验证前端链路。 */
  mock: boolean
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) {
    throw new Error(`Missing required env ${name}. Copy .env.example to .env and fill it in.`)
  }
  return v
}

let cached: AppConfig | null = null

export function loadConfig(): AppConfig {
  if (cached) return cached
  cached = {
    osbDomain: required('OSB_DOMAIN', 'localhost:8080'),
    osbProtocol: (process.env.OSB_PROTOCOL as 'http' | 'https') || 'http',
    osbApiKey: required('OSB_API_KEY', 'changeme'),
    bffPort: parseInt(process.env.BFF_PORT || '8787', 10),
    dbPath: process.env.BFF_DB_PATH || './apps/bff/data/control.sqlite',
    mock: process.env.BFF_MOCK === '1',
  }
  return cached
}
