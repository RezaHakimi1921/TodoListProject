import { api } from './client'

export interface CommentNotification {
  id: number
  taskId: number
  taskTitle: string
  taskStatus: string
  jiraKey: string
  jiraUrl?: string | null
  commentId: string
  authorName: string
  body: string
  createdAt: string
  read: boolean
}

export interface NotificationSummary {
  unreadCount: number
  items: CommentNotification[]
}

function camel(row: Record<string, unknown>): CommentNotification {
  return {
    id: Number(row.id),
    taskId: Number(row.taskId),
    taskTitle: String(row.taskTitle ?? ''),
    taskStatus: String(row.taskStatus ?? ''),
    jiraKey: String(row.jiraKey ?? ''),
    jiraUrl: (row.jiraUrl as string | null) ?? null,
    commentId: String(row.commentId ?? ''),
    authorName: String(row.authorName ?? ''),
    body: String(row.body ?? ''),
    createdAt: String(row.createdAt ?? ''),
    read: Boolean(row.read),
  }
}

export function listNotifications(unread = false) {
  const query = unread ? '?unread=true' : ''
  return api.get<Record<string, unknown>>(`/api/notifications${query}`).then((row) => ({
    unreadCount: Number(row.unreadCount ?? 0),
    items: Array.isArray(row.items) ? (row.items as Record<string, unknown>[]).map(camel) : [],
  }))
}

export function getUnreadNotificationCount() {
  return api.get<{ count: number }>('/api/notifications/unread-count').then((row) => Number(row.count ?? 0))
}

export function markNotificationRead(id: number) {
  return api.post<{ ok: boolean }>(`/api/notifications/${id}/read`, {})
}

export function markTaskNotificationsRead(taskId: number) {
  return api.post<{ ok: boolean }>(`/api/notifications/read-task/${taskId}`, {})
}
