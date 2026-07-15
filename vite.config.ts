import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 最小 Vite 配置：React + Tailwind(经 PostCSS)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
})
