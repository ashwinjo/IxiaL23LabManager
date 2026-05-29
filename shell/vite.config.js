import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const shellPort = Number(process.env.IXIA_SHELL_PORT || 9000)

export default defineConfig({
  plugins: [react()],
  server: {
    port: shellPort,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
  preview: {
    port: shellPort,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
})
