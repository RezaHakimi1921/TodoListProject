import { api } from './client'

export interface AppSettings {
  pingMinutes: number
  paused: boolean
  lastPingAt: string | null
}

export const DEFAULT_PING_MINUTES = 10

function normalize(row: Partial<AppSettings> & { pingMinutes?: number }): AppSettings {
  return {
    pingMinutes: Number(row.pingMinutes ?? DEFAULT_PING_MINUTES) || DEFAULT_PING_MINUTES,
    paused: Boolean(row.paused),
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
  return api.post<AppSettings>('/api/settings/test-toast', {}).then(normalize)
}
