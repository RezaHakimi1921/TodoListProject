import { api } from './client'

export type BoardActivityKind = 'rest' | 'meeting'

export interface BoardActivity {
  id: string
  title: string
  jiraKey: string
  jiraUrl?: string | null
  kind: BoardActivityKind
  needsNote: boolean
  sortOrder: number
  enabled: boolean
}

function camel(row: Record<string, unknown>): BoardActivity {
  const kind = String(row.kind ?? 'rest').toLowerCase() === 'meeting' ? 'meeting' : 'rest'
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? '').trim(),
    jiraKey: String(row.jiraKey ?? '').trim().toUpperCase(),
    jiraUrl: (row.jiraUrl as string | null) ?? null,
    kind,
    needsNote: Boolean(row.needsNote),
    sortOrder: Number(row.sortOrder ?? 0),
    enabled: row.enabled !== false,
  }
}

export function listBoardActivities() {
  return api.get<{ items?: Record<string, unknown>[] }>('/api/settings/board-activities').then((row) =>
    (Array.isArray(row.items) ? row.items : []).map(camel),
  )
}

export function saveBoardActivities(items: BoardActivity[]) {
  return api
    .put<{ items?: Record<string, unknown>[] }>('/api/settings/board-activities', { items })
    .then((row) => (Array.isArray(row.items) ? row.items : []).map(camel))
}

export function parseJiraKeyFromInput(raw: string): string {
  const text = raw.trim()
  const fromUrl = text.match(/\b([A-Za-z][A-Za-z0-9]+-\d+)\b/)
  return (fromUrl?.[1] || text).toUpperCase()
}
