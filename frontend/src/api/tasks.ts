import { api } from './client'
import type { EnergyType, SimilarTask, TaskItem, TaskStatus, TimelineEntry } from '../types'

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
})

export interface TaskFilters {
  status?: string
  energyType?: string
  tag?: string
}

export function listTasks(filters: TaskFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.energyType) params.set('energyType', filters.energyType)
  if (filters.tag) params.set('tag', filters.tag)
  const query = params.toString()
  return api.get<Record<string, unknown>[]>(`/api/tasks${query ? `?${query}` : ''}`).then((rows) =>
    rows.map(camel),
  )
}

export function getTask(id: number) {
  return api.get<Record<string, unknown>>(`/api/tasks/${id}`).then(camel)
}

export function createTask(input: { title: string; energyType: EnergyType; tags?: string }) {
  return api.post<Record<string, unknown>>('/api/tasks', input).then(camel)
}

export function updateTask(
  id: number,
  input: { title: string; status: TaskStatus; energyType: EnergyType; tags?: string },
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
