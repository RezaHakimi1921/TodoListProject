import { api, ApiError } from './client'
import { todayIso } from '../lib/dates'
import type { EnergyType, SimilarTask, TaskItem, TaskOwnership, TaskStatus, TimelineEntry } from '../types'
import { upsertDailyLog } from './dailyLogs'
import { clearFocus } from './focus'

function asOwnership(value: unknown): TaskOwnership {
  return value === 'Other' ? 'Other' : 'Mine'
}

const camel = (row: Record<string, unknown>): TaskItem => ({
  id: Number(row.id),
  title: String(row.title),
  status: row.status as TaskStatus,
  energyType: row.energyType as EnergyType,
  tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  stuckReason: (row.stuckReason as string | null) ?? null,
  isAging: Boolean(row.isAging),
  agingDays: Number(row.agingDays ?? 0),
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
  doneAt: (row.doneAt as string | null) ?? null,
  targetDate: (row.targetDate as string | null) ?? null,
  rolledOver: Boolean(row.rolledOver),
  rolledOverFrom: (row.rolledOverFrom as string | null) ?? null,
  checklistTotal: Number(row.checklistTotal ?? 0),
  checklistDone: Number(row.checklistDone ?? 0),
  jiraKey: (row.jiraKey as string | null) ?? null,
  jiraUrl: (row.jiraUrl as string | null) ?? null,
  ownership: asOwnership(row.ownership),
})

export interface TaskFilters {
  status?: string
  energyType?: string
  tag?: string
  date?: string
  q?: string
}

export interface TaskDay {
  date: string
  total: number
  done: number
}

export function listTaskDays() {
  return api.get<TaskDay[]>('/api/tasks/days')
}

export function listTasks(filters: TaskFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.energyType) params.set('energyType', filters.energyType)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.date) params.set('date', filters.date)
  if (filters.q) params.set('q', filters.q)
  const query = params.toString()
  return api.get<Record<string, unknown>[]>(`/api/tasks${query ? `?${query}` : ''}`).then((rows) =>
    rows.map(camel),
  )
}

export function rolloverDay(note?: string) {
  return api.post<{ rolledOverCount: number; message: string }>('/api/tasks/rollover', { note })
}

export async function closeWorkday(note?: string) {
  try {
    return await rolloverDay(note)
  } catch (err) {
    if (!(err instanceof ApiError) && !(err instanceof Error)) throw err
    const text = note?.trim() || 'پایان روز کاری'
    await upsertDailyLog(todayIso(), text)
    try {
      await clearFocus()
    } catch {
      /* focus may already be empty */
    }
    return {
      rolledOverCount: 0,
      message: 'گزارش روز ثبت شد.',
    }
  }
}

export function getTask(id: number) {
  return api.get<Record<string, unknown>>(`/api/tasks/${id}`).then(camel)
}

export function createTask(input: { title: string; energyType: EnergyType; tags?: string }) {
  return api.post<Record<string, unknown>>('/api/tasks', input).then(camel)
}

export function updateTask(
  id: number,
  input: {
    title: string
    status: TaskStatus
    energyType: EnergyType
    tags?: string
    ownership?: TaskOwnership
  },
) {
  return api.put<Record<string, unknown>>(`/api/tasks/${id}`, input).then(camel)
}

export function updateTaskStatus(id: number, input: { status: TaskStatus; stuckReason?: string }) {
  return api.put<Record<string, unknown>>(`/api/tasks/${id}/status`, input).then(camel)
}

export function deleteTask(id: number) {
  return api.delete(`/api/tasks/${id}`)
}

export function getSimilarTasks(title: string) {
  return api.get<SimilarTask[]>(`/api/tasks/similar?title=${encodeURIComponent(title)}`).catch(() => [])
}

export function listTimeline(id: number) {
  return api.get<TimelineEntry[]>(`/api/tasks/${id}/timeline`)
}

export function addTimeline(id: number, note: string) {
  return api.post<TimelineEntry>(`/api/tasks/${id}/timeline`, { note })
}

export function deleteTimeline(id: number, entryId: number) {
  return api.delete(`/api/tasks/${id}/timeline/${entryId}`)
}
