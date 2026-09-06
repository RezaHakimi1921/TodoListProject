export const DEFAULT_PING_MINUTES = 10

export function clampPingMinutes(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_PING_MINUTES
  return Math.min(180, Math.max(1, Math.round(value)))
}

export function intervalMs(minutes: number) {
  return clampPingMinutes(minutes) * 60 * 1000
}

export function parseLastPing(value: string | null | undefined) {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

export function isPingDue(minutes = DEFAULT_PING_MINUTES, lastPingAt?: string | null) {
  const last = parseLastPing(lastPingAt)
  if (last === 0) return false
  return Date.now() - last >= intervalMs(minutes)
}

export function minutesUntilPing(minutes = DEFAULT_PING_MINUTES, lastPingAt?: string | null) {
  const last = parseLastPing(lastPingAt)
  if (last === 0) return minutes
  return Math.max(0, Math.ceil((intervalMs(minutes) - (Date.now() - last)) / 60_000))
}
