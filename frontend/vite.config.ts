import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = dirname(fileURLToPath(import.meta.url))

function jiraAuthHeader() {
  try {
    const raw = readFileSync(resolve(root, '../backend/TaskOS.Api/appsettings.Local.json'), 'utf8')
    const token = JSON.parse(raw)?.Jira?.PersonalAccessToken
    return typeof token === 'string' && token.trim() ? `Bearer ${token.trim()}` : ''
  } catch {
    return ''
  }
}

function jiraProxyHeaders() {
  const auth = jiraAuthHeader()
  return {
    ...(auth ? { Authorization: auth } : {}),
    'X-Atlassian-Token': 'no-check',
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5088',
        changeOrigin: true,
      },
      '/jira-rest': {
        target: 'https://jira.smartx.ir',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jira-rest/, ''),
        headers: jiraProxyHeaders(),
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq) => {
            const auth = jiraAuthHeader()
            if (auth) proxyReq.setHeader('Authorization', auth)
            proxyReq.setHeader('X-Atlassian-Token', 'no-check')
            proxyReq.removeHeader('cookie')
            proxyReq.removeHeader('Cookie')
          })
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['set-cookie']
          })
        },
      },
    },
  },
})
