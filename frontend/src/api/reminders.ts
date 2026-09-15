import { api } from './client'

export interface TaskReminder {
  id: number
  taskId: number
  remindAt: string
  note?: string | null
  createdAt: string
  firedAt?: string | null
  fired?: boolean
  taskTitle?: string | null
  jiraKey?: string | null
}

function camel(row: Record<string, unknown>): TaskReminder {
  return {
    id: Number(row.id),
    taskId: Number(row.taskId),
    remindAt: String(row.remindAt ?? ''),
    note: (row.note as string | null) ?? null,
    createdAt: String(row.createdAt ?? ''),
    firedAt: (row.firedAt as string | null) ?? null,
    fired: Boolean(row.fired),
    taskTitle: (row.taskTitle as string | null) ?? null,
    jiraKey: (row.jiraKey as string | null) ?? null,
  }
}

export function listTaskReminders(taskId: number) {
  return api.get<Record<string, unknown>[]>(`/api/tasks/${taskId}/reminders`).then((rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => camel(row as Record<string, unknown>)),
  )
}

export function createTaskReminder(taskId: number, input: { remindAt: string; note?: string }) {
  return api.post<Record<string, unknown>>(`/api/tasks/${taskId}/reminders`, input).then(camel)
}

export function deleteTaskReminder(id: number) {
  return api.delete(`/api/reminders/${id}`)
}
export function listPendingReminders() {
  return api.get<Record<string, unknown>[]>('/api/reminders').then((rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => camel(row as Record<string, unknown>)),
  )
}

export function listFiredReminders(limit = 50) {
  return api.get<Record<string, unknown>[]>(`/api/reminders/fired?limit=${limit}`).then((rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => camel(row as Record<string, unknown>)),
  )
}

export function updateTaskReminder(id: number, input: { remindAt: string; note?: string }) {
  return api.put<Record<string, unknown>>(`/api/reminders/${id}`, input).then(camel)
}
