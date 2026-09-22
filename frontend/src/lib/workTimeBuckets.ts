import type { WorkLogEntry } from '../types'
import type { BoardActivity } from '../api/boardActivities'

export type TimeBucket = 'work' | 'meeting' | 'rest'

export interface TimeBuckets {
  work: number
  meeting: number
  rest: number
  total: number
}

const LEGACY_MEETING_KEYS = new Set(['SIP-2288', 'SIP-2289', 'SIP-2356'])
const LEGACY_REST_KEYS = new Set(['SIP-2287', 'SIP-2290'])
const LEGACY_MEETING_TITLES = new Set(['جلسه', 'دیلی', 'صحبت تیم'])
const LEGACY_REST_TITLES = new Set(['نهار', 'استراحت'])

function firstTitle(log: WorkLogEntry) {
  return (log.taskTitle || log.description || '').trim()
}

export function classifyWorkLog(log: WorkLogEntry, activities: BoardActivity[] = []): TimeBucket {
  const key = (log.jiraKey || '').trim().toUpperCase()
  const configured = activities.find((row) => row.jiraKey.toUpperCase() === key)
  if (configured) return configured.kind === 'meeting' ? 'meeting' : 'rest'

  if (LEGACY_MEETING_KEYS.has(key)) return 'meeting'
  if (LEGACY_REST_KEYS.has(key)) return 'rest'

  const title = firstTitle(log)
  const byTitle = activities.find((row) => row.title.trim() === title)
  if (byTitle) return byTitle.kind === 'meeting' ? 'meeting' : 'rest'

  if (LEGACY_MEETING_TITLES.has(title)) return 'meeting'
  if (LEGACY_REST_TITLES.has(title)) return 'rest'

  if (log.source === 'Break') return 'rest'
  return 'work'
}

export function sumTimeBuckets(logs: WorkLogEntry[], activities: BoardActivity[] = []): TimeBuckets {
  const buckets: TimeBuckets = { work: 0, meeting: 0, rest: 0, total: 0 }
  for (const log of logs) {
    const minutes = Math.max(0, Number(log.durationMinutes) || 0)
    buckets[classifyWorkLog(log, activities)] += minutes
    buckets.total += minutes
  }
  return buckets
}
