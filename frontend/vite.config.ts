import { readFileSync } from 'node:fs'
import os from 'node:os'
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

function lanUrls(port: number) {
  const urls: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) {
        urls.push(`http://${item.address}:${port}`)
      }
    }
  }
  return urls
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'taskos-lan',
      configureServer(server) {
        server.middlewares.use('/__lan', (_req, res) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ urls: lanUrls(server.config.server.port ?? 5173) }))
        })
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/push': {
        target: 'http://127.0.0.1:5108',
        changeOrigin: true,
      },
      '/api/problems': {
        target: 'http://127.0.0.1:5098',
        changeOrigin: true,
      },
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
