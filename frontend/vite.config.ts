import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import os from 'os'

const certDir = `${os.homedir()}/.vite-plugin-mkcert`

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync(`${certDir}/dev.pem`),
      cert: fs.readFileSync(`${certDir}/cert.pem`),
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/payment': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
