import { api } from './client'

export type NotificationKind = 'comment' | 'new-task' | 'reminder'

export interface CommentNotification {
  id: number
  kind: NotificationKind
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

export interface UnreadNotificationCount {
  count: number
  newTasks: number
  comments: number
  khadang: number
  reminders: number
}

function asKind(value: unknown, commentId: string): NotificationKind {
  if (value === 'new-task' || String(commentId).startsWith('new-task:')) return 'new-task'
  if (value === 'reminder' || String(commentId).startsWith('reminder:')) return 'reminder'
  return 'comment'
}

function camel(row: Record<string, unknown>): CommentNotification {
  const commentId = String(row.commentId ?? '')
  return {
    id: Number(row.id),
    kind: asKind(row.kind, commentId),
    taskId: Number(row.taskId),
    taskTitle: String(row.taskTitle ?? ''),
    taskStatus: String(row.taskStatus ?? ''),
    jiraKey: String(row.jiraKey ?? ''),
    jiraUrl: (row.jiraUrl as string | null) ?? null,
    commentId,
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

export function getUnreadNotificationCount(): Promise<UnreadNotificationCount> {
  return api.get<UnreadNotificationCount>('/api/notifications/unread-count').then((row) => ({
    count: Number(row.count ?? 0),
    newTasks: Number(row.newTasks ?? 0),
    comments: Number(row.comments ?? 0),
    khadang: Number(row.khadang ?? 0),
    reminders: Number(row.reminders ?? 0),
  }))
}

export const TASK_NOTIFICATIONS_READ = 'taskos:task-notifications-read'

export function emitTaskNotificationsRead(taskId: number) {
  if (!Number.isFinite(taskId)) return
  window.dispatchEvent(new CustomEvent(TASK_NOTIFICATIONS_READ, { detail: { taskId } }))
}

export function markNotificationRead(id: number) {
  return api.post<{ ok: boolean }>(`/api/notifications/${id}/read`, {})
}

export function markTaskNotificationsRead(taskId: number) {
  emitTaskNotificationsRead(taskId)
  return api.post<{ ok: boolean }>(`/api/notifications/read-task/${taskId}`, {})
}

export function markReminderNotificationsRead(taskId: number) {
  return api.post<{ ok: boolean }>(`/api/notifications/read-reminders/${taskId}`, {})
}

export function markAllReminderNotificationsRead() {
  return api.post<{ ok: boolean }>('/api/notifications/read-reminders', {})
}

export function markNotificationsReadByKey(jiraKey: string) {
  return api.post<{ ok: boolean }>(`/api/notifications/read-key/${encodeURIComponent(jiraKey)}`, {})
}
