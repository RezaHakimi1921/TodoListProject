import { api } from './client'

export interface ChecklistItem {
  id: number
  taskId: number
  title: string
  isDone: boolean
  sortOrder: number
  createdAt: string
  doneAt: string | null
}

export function listChecklist(taskId: number) {
  return api.get<ChecklistItem[]>(`/api/tasks/${taskId}/checklist`)
}

export function addChecklistItem(taskId: number, title: string) {
  return api.post<ChecklistItem>(`/api/tasks/${taskId}/checklist`, { title })
}

export function updateChecklistItem(
  taskId: number,
  itemId: number,
  input: { title?: string; isDone?: boolean; sortOrder?: number },
) {
  return api.put<ChecklistItem>(`/api/tasks/${taskId}/checklist/${itemId}`, input)
}

export function deleteChecklistItem(taskId: number, itemId: number) {
  return api.delete(`/api/tasks/${taskId}/checklist/${itemId}`)
}
