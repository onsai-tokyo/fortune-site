import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import os from 'os'
import path from 'path'

const certDir = `${os.homedir()}/.vite-plugin-mkcert`
const certExists = fs.existsSync(`${certDir}/dev.pem`)

export default defineConfig(({ mode }) => {
 const env = loadEnv(mode, process.cwd(), 'VITE_')
 const remote = Boolean((process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL) && (process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY))
 return {
  plugins: [react(), { name: 'exclude-personal-demo-content', enforce: 'pre', resolveId(source) { if (remote && (source.endsWith('/demoData') || source.endsWith('/demoData.ts'))) return path.resolve('src/web/data/emptyDemoData.ts') } }],
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
 }})
