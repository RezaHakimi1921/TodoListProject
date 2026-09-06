import { api } from './client'
import type { WorkLogEntry, WorkLogSource, WorkLogSummary } from '../types'

export interface EntityWorkLogList {
  totalMinutes: number
  entries: WorkLogEntry[]
}

export function captureWorkLog(input: {
  description: string
  durationMinutes?: number
  source: WorkLogSource
  taskId?: number
  problemId?: number
}) {
  return api.post<WorkLogEntry>('/api/worklogs', input)
}

export function listWorkLogs(date: string) {
  return api.get<WorkLogEntry[]>(`/api/worklogs?date=${encodeURIComponent(date)}`)
}

export function getWorkLogSummary(date: string) {
  return api.get<WorkLogSummary>(`/api/worklogs/summary?date=${encodeURIComponent(date)}`)
}

export function listEntityWorkLogs(kind: 'task' | 'problem', id: number) {
  return api.get<EntityWorkLogList>(`/api/worklogs/by-${kind}/${id}`)
}

export function deleteWorkLog(id: number) {
  return api.delete(`/api/worklogs/${id}`)
}
