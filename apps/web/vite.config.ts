import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前端通过同源 BFF 代理访问 OpenSandbox，避免浏览器直连的 CORS 与 API key 泄露。
// dev 期 vite 把 /api 与 /stream 转发到本地 BFF（默认 8787）。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: process.env.BFF_URL || 'http://localhost:8787',
        changeOrigin: true,
      },
      '/stream': {
        target: process.env.BFF_URL || 'http://localhost:8787',
        changeOrigin: true,
        // SSE 长连接：关闭缓冲，避免事件被代理攒批
        ws: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no'
          })
        },
      },
    },
  },
})
