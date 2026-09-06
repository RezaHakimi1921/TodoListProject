import { api } from './client'
import type { WorkLogSource } from '../types'

export interface WorkFocus {
  active: boolean
  description: string
  taskId: number | null
  problemId: number | null
  startedAt: string | null
  updatedAt: string | null
}

function camel(row: Record<string, unknown>): WorkFocus {
  return {
    active: Boolean(row.active),
    description: String(row.description ?? ''),
    taskId: row.taskId == null ? null : Number(row.taskId),
    problemId: row.problemId == null ? null : Number(row.problemId),
    startedAt: (row.startedAt as string | null) ?? null,
    updatedAt: (row.updatedAt as string | null) ?? null,
  }
}

export function getFocus() {
  return api.get<Record<string, unknown>>('/api/focus').then(camel)
}

export function setFocus(input: {
  description: string
  taskId?: number | null
  problemId?: number | null
  durationMinutes?: number
  source?: WorkLogSource
  log?: boolean
}) {
  return api.put<Record<string, unknown>>('/api/focus', input).then(camel)
}

export function tickFocus(input: { durationMinutes?: number; source?: WorkLogSource } = {}) {
  return api.post<Record<string, unknown>>('/api/focus/tick', input).then(camel)
}

export function finishFocus(input: {
  durationMinutes?: number
  source?: WorkLogSource
  markTaskDone?: boolean
  taskId?: number | null
} = {}) {
  return api.post<Record<string, unknown>>('/api/focus/finish', input).then(camel)
}

export function clearFocus() {
  return api.delete('/api/focus').then(() => getFocus())
}
