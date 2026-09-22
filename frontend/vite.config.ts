import { readFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Bonjour from 'bonjour-service'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const root = dirname(fileURLToPath(import.meta.url))
const STABLE_HOST = 'reza.local'

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
  const score = (url: string) => {
    if (url.includes('192.168.140.') || url.includes('192.168.40.')) return 0
    if (url.includes('192.168.1.') || url.includes('192.168.0.')) return 1
    if (
      url.includes('192.168.56.')
      || url.includes('192.168.239.')
      || url.includes('192.168.85.')
      || url.includes('169.254.')
    ) {
      return 8
    }
    return 4
  }
  return urls.sort((a, b) => score(a) - score(b))
}

function taskosLanPlugin(): Plugin {
  let bonjour: InstanceType<typeof Bonjour> | null = null
  let lastPrimary = ''
  let timer: ReturnType<typeof setInterval> | null = null

  async function syncPhoneBase(url: string) {
    try {
      await fetch('http://127.0.0.1:5108/api/push/phone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneBaseUrl: url }),
      })
    } catch {
      /* push sidecar optional */
    }
  }

  async function notifyPhone(url: string) {
    try {
      await fetch('http://127.0.0.1:5108/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'آدرس جدید TaskOS',
          body: `IP عوض شد. همین را باز کن: ${url}`,
          url,
        }),
      })
    } catch {
      /* optional */
    }
  }

  return {
    name: 'taskos-lan',
    configureServer(server) {
      const port = server.config.server.port ?? 5173
      const stable = `http://${STABLE_HOST}:${port}`

      try {
        bonjour = new Bonjour()
        bonjour.publish({
          name: 'TaskOS',
          type: 'http',
          port,
          host: STABLE_HOST.replace(/\.local$/i, ''),
          txt: { path: '/' },
        })
        server.config.logger.info(`[taskos] mDNS: ${stable}`)
      } catch (error) {
        server.config.logger.warn(`[taskos] mDNS publish failed: ${String(error)}`)
      }

      server.middlewares.use('/__lan', (_req, res) => {
        const ips = lanUrls(port)
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({
          stable,
          host: STABLE_HOST,
          urls: [stable, ...ips.filter((u) => u !== stable)],
        }))
      })

      const tick = () => {
        const primary = lanUrls(port)[0]
        if (!primary || primary === lastPrimary) return
        const first = !lastPrimary
        lastPrimary = primary
        void syncPhoneBase(primary)
        if (!first) void notifyPhone(primary)
      }
      tick()
      timer = setInterval(tick, 20_000)

      const stop = () => {
        if (timer) clearInterval(timer)
        timer = null
        try { bonjour?.unpublishAll() } catch { /* ignore */ }
        try { bonjour?.destroy() } catch { /* ignore */ }
        bonjour = null
      }
      server.httpServer?.once('close', stop)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    taskosLanPlugin(),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
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
