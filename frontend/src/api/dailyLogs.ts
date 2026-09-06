import { api } from './client'
import type { DailyLog, EnergyType, TaskItem, TaskStatus } from '../types'

export function getDailyLog(date: string) {
  return api.get<DailyLog | null>(`/api/dailylogs?date=${encodeURIComponent(date)}`)
}

export function listDailyLogs() {
  return api.get<DailyLog[]>('/api/dailylogs')
}

export function upsertDailyLog(logDate: string, note: string) {
  return api.post<DailyLog>('/api/dailylogs', { logDate, note })
}

export function deleteDailyLog(id: number) {
  return api.delete(`/api/dailylogs/${id}`)
}

export function getRelatedTasks(date: string) {
  return api.get<Record<string, unknown>[]>(`/api/dailylogs/${date}/related-tasks`).then((rows) =>
    rows.map(
      (row): TaskItem => ({
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
      }),
    ),
  )
}
