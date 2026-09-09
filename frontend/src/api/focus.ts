import { api } from './client'
import type { WorkLogSource } from '../types'

export const JIRA_DWELL_MS = 30_000

export interface JiraSwitchPending {
  jiraKey: string
  title: string
  remainingSeconds: number
  sinceUnixMs: number
  taskId: number | null
}

export interface WorkFocus {
  active: boolean
  description: string
  taskId: number | null
  problemId: number | null
  startedAt: string | null
  updatedAt: string | null
  isResting: boolean
  pendingSwitch: JiraSwitchPending | null
}

function pending(row: Record<string, unknown> | null | undefined): JiraSwitchPending | null {
  if (!row || typeof row !== 'object') return null
  const key = String(row.jiraKey ?? '').trim()
  if (!key) return null
  const remaining = Number(row.remainingSeconds)
  const sinceUnixMs = Number(row.sinceUnixMs)
  if (Number.isFinite(sinceUnixMs) && sinceUnixMs > 0) {
    return {
      jiraKey: key,
      title: String(row.title ?? key),
      remainingSeconds: Math.max(0, Math.ceil((JIRA_DWELL_MS - (Date.now() - sinceUnixMs)) / 1000)),
      sinceUnixMs,
      taskId: row.taskId == null ? null : Number(row.taskId),
    }
  }
  if (!Number.isFinite(remaining) || remaining <= 0) return null
  return {
    jiraKey: key,
    title: String(row.title ?? key),
    remainingSeconds: Math.max(0, Math.round(remaining)),
    sinceUnixMs: Date.now() - Math.max(0, 30 - remaining) * 1000,
    taskId: row.taskId == null ? null : Number(row.taskId),
  }
}

function camel(row: Record<string, unknown>): WorkFocus {
  return {
    active: Boolean(row.active),
    description: String(row.description ?? ''),
    taskId: row.taskId == null ? null : Number(row.taskId),
    problemId: row.problemId == null ? null : Number(row.problemId),
    startedAt: (row.startedAt as string | null) ?? null,
    updatedAt: (row.updatedAt as string | null) ?? null,
    isResting: Boolean(row.isResting),
    pendingSwitch: pending(row.pendingSwitch as Record<string, unknown> | null),
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

export function finishFocus(
  input: {
    durationMinutes?: number
    source?: WorkLogSource
    markTaskDone?: boolean
    taskId?: number | null
  } = {},
) {
  return api.post<Record<string, unknown>>('/api/focus/finish', input).then(camel)
}

export function clearFocus() {
  return api.delete('/api/focus').then(() => getFocus())
}

export function startRest(description?: string) {
  return api.post<Record<string, unknown>>('/api/focus/rest', { description }).then(camel)
}

export function endRest() {
  return api.post<Record<string, unknown>>('/api/focus/rest/end', {}).then(camel)
}
