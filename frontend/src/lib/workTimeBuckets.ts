import type { WorkLogEntry } from '../types'

export type TimeBucket = 'work' | 'meeting' | 'rest'

export interface TimeBuckets {
  work: number
  meeting: number
  rest: number
  total: number
}

const MEETING_KEYS = new Set(['SIP-2288', 'SIP-2289'])
const REST_KEYS = new Set(['SIP-2287', 'SIP-2290'])
const MEETING_TITLES = new Set(['جلسه', 'دیلی'])
const REST_TITLES = new Set(['نهار', 'استراحت'])

function firstTitle(log: WorkLogEntry) {
  return (log.taskTitle || log.description || '').trim()
}

export function classifyWorkLog(log: WorkLogEntry): TimeBucket {
  const key = (log.jiraKey || '').trim().toUpperCase()
  if (MEETING_KEYS.has(key)) return 'meeting'
  if (REST_KEYS.has(key)) return 'rest'

  const title = firstTitle(log)
  if (MEETING_TITLES.has(title)) return 'meeting'
  if (REST_TITLES.has(title)) return 'rest'

  if (log.source === 'Break') return 'rest'
  return 'work'
}

export function sumTimeBuckets(logs: WorkLogEntry[]): TimeBuckets {
  const buckets: TimeBuckets = { work: 0, meeting: 0, rest: 0, total: 0 }
  for (const log of logs) {
    const minutes = Math.max(0, Number(log.durationMinutes) || 0)
    buckets[classifyWorkLog(log)] += minutes
    buckets.total += minutes
  }
  return buckets
}
