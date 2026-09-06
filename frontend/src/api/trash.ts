import { api } from './client'

export type TrashKind = 'task' | 'timeline' | 'dailylog' | 'worklog' | 'problem' | 'option'

export interface TrashItem {
  kind: TrashKind
  id: number
  title: string
  deletedAt: string | null
}

export const TRASH_KIND_LABEL: Record<TrashKind, string> = {
  task: 'کار',
  timeline: 'یادداشت تایم‌لاین',
  dailylog: 'یادداشت روزانه',
  worklog: 'لاگ کار و زمان',
  problem: 'مسئله و چالش',
  option: 'گزینه مسئله',
}

function camel(row: Record<string, unknown>): TrashItem {
  return {
    kind: String(row.kind) as TrashKind,
    id: Number(row.id),
    title: String(row.title ?? ''),
    deletedAt: (row.deletedAt as string | null) ?? null,
  }
}

export function listTrash() {
  return api.get<Record<string, unknown>[]>('/api/trash').then((rows) => rows.map(camel))
}

export function restoreTrash(kind: TrashKind, id: number) {
  return api.post<void>('/api/trash/restore', { kind, id })
}

export function purgeTrash(kind: TrashKind, id: number) {
  return api.delete(`/api/trash?kind=${encodeURIComponent(kind)}&id=${id}`)
}

export function emptyTrash() {
  return api.delete('/api/trash')
}
