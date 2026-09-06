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

export function formatPersianDate(dateString?: string | null): string {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d)
  } catch {
    return dateString
  }
}

export function formatPersianDateShort(dateString?: string | null): string {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return new Intl.DateTimeFormat('fa-IR', {
      day: 'numeric',
      month: 'short'
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
      minute: '2-digit'
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
