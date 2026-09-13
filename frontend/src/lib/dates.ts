function parseDateInput(dateString: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(`${dateString}T12:00:00`)
  return new Date(dateString)
}

export function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function yesterdayIso() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export function daysAgoIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export function addDaysIso(dateIso: string, days: number) {
  const d = parseDateInput(dateIso)
  d.setDate(d.getDate() + days)
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export function formatMinutesLabel(total: number) {
  const safe = Math.max(0, Math.round(Number(total) || 0))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours <= 0) return `${minutes} دقیقه`
  if (minutes <= 0) return `${hours} ساعت`
  return `${hours} ساعت و ${minutes} دقیقه`
}

export function formatElapsedClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

export function formatPersianDate(dateString?: string | null): string {
  if (!dateString) return ''
  try {
    const d = parseDateInput(dateString)
    if (isNaN(d.getTime())) return dateString
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return dateString
  }
}

export function formatPersianDateShort(dateString?: string | null): string {
  if (!dateString) return ''
  try {
    const d = parseDateInput(dateString)
    if (isNaN(d.getTime())) return dateString
    return new Intl.DateTimeFormat('fa-IR', {
      day: 'numeric',
      month: 'short',
    }).format(d)
  } catch {
    return dateString
  }
}

export function formatPersianDateTime(dateString?: string | null): string {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return new Intl.DateTimeFormat('fa-IR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateString
  }
}

export function isSameDay(d1: string | Date, d2: string | Date): boolean {
  const s1 = typeof d1 === 'string' ? d1.slice(0, 10) : d1.toISOString().slice(0, 10)
  const s2 = typeof d2 === 'string' ? d2.slice(0, 10) : d2.toISOString().slice(0, 10)
  return s1 === s2
}

export function getRelativeDayLabel(dateIso: string): string {
  const today = todayIso()
  const yest = yesterdayIso()
  if (dateIso === today) return 'امروز'
  if (dateIso === yest) return 'دیروز'
  return formatPersianDate(dateIso)
}

export function formatClock(dateString?: string | null): string {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

export function workLogStartedAt(endedAt?: string | null, minutes?: number) {
  const end = endedAt ? Date.parse(endedAt) : NaN
  if (!Number.isFinite(end)) return endedAt ?? ''
  const span = Math.max(0, Number(minutes) || 0) * 60_000
  return new Date(end - span).toISOString()
}

export function formatWorkLogSpan(startedAt?: string | null, endedAt?: string | null): string {
  const date = formatPersianDateShort(endedAt || startedAt)
  const from = formatClock(startedAt)
  const to = formatClock(endedAt)
  if (date && from && to) return date + ' · ' + from + ' تا ' + to
  if (date && to) return date + ' · ' + to
  return date || to || from
}
