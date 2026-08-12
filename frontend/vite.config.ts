import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import os from 'os'

const certDir = `${os.homedir()}/.vite-plugin-mkcert`
const certExists = fs.existsSync(`${certDir}/dev.pem`)

export default defineConfig({
  plugins: [react()],
  server: {
    ...(certExists ? {
      https: {
        key: fs.readFileSync(`${certDir}/dev.pem`),
        cert: fs.readFileSync(`${certDir}/cert.pem`),
      },
    } : {}),
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'https://fortune-site-iuzo.onrender.com',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'https://fortune-site-iuzo.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
