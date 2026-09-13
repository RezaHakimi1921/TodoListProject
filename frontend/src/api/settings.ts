import { api } from './client'

export interface AppSettings {
  pingMinutes: number
  paused: boolean
  lastPingAt: string | null
}

export const DEFAULT_PING_MINUTES = 10

function normalize(row: Partial<AppSettings> & { pingMinutes?: number; paused?: unknown }): AppSettings {
  const rawPaused = row.paused
  const paused =
    rawPaused === true
    || rawPaused === 1
    || rawPaused === '1'
    || rawPaused === 'true'
  return {
    pingMinutes: Number(row.pingMinutes ?? DEFAULT_PING_MINUTES) || DEFAULT_PING_MINUTES,
    paused,
    lastPingAt: row.lastPingAt ?? null,
  }
}

export function getSettings() {
  return api.get<AppSettings>('/api/settings').then(normalize)
}

export function saveSettings(input: { pingMinutes: number; paused?: boolean }) {
  return api.put<AppSettings>('/api/settings', input).then(normalize)
}

export function ackPing() {
  return api.post<AppSettings>('/api/settings/ack-ping', {}).then(normalize)
}

export function testToast() {
  return api
    .post<{ ok?: boolean; sent?: number }>('/api/push/test', {
      title: 'یادآوری تمرکز',
      body: 'الان روی چه کاری وقت گذاشتی؟',
    })
    .catch(() => undefined)
    .then(() => api.post<AppSettings>('/api/settings/test-toast', {}).catch(() => getSettings()))
    .then((row) => (row && 'pingMinutes' in row ? normalize(row) : getSettings()))
}
