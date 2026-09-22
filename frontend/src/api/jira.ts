import { api } from './client'

export interface JiraProject {
  key: string
  name: string
}

export interface JiraNamedOption {
  id: string
  name: string
}

export interface JiraUserOption {
  name: string
  displayName: string
}

export interface JiraCreateMeta {
  projectKey: string
  issueTypes: JiraNamedOption[]
  components: JiraNamedOption[]
  assignees: JiraUserOption[]
}

export interface JiraCreatedTask {
  created: { key: string; browseUrl: string; summary: string }
  registered: { jiraKey?: string; matchedTask?: { id: number; title: string } }
}

export function listJiraProjects() {
  return api.get<JiraProject[]>('/api/jira/projects')
}

export function getJiraCreateMeta(projectKey: string) {
  return api.get<JiraCreateMeta>(`/api/jira/create-meta?projectKey=${encodeURIComponent(projectKey)}`)
}

export function registerJiraIssue(input: { jiraKey: string; title?: string; jiraUrl?: string }) {
  return api
    .post<{
      jiraKey?: string
      title?: string
      matchedTask?: { id: number; title: string; status?: string }
      registered?: { matchedTask?: { id: number; title: string; status?: string } }
    }>('/api/jira/register', input)
    .catch(() =>
      api.post<{
        registered?: { matchedTask?: { id: number; title: string; status?: string } }
        matchedTask?: { id: number; title: string; status?: string }
      }>('/api/jira/import', input),
    )
    .then((row) => ({
      jiraKey: row.jiraKey,
      title: row.title,
      matchedTask: row.matchedTask ?? row.registered?.matchedTask,
    }))
}

export function fetchJiraIssueSummary(jiraKey: string) {
  return fetch(`/jira-rest/rest/api/2/issue/${encodeURIComponent(jiraKey)}?fields=summary,status`).then(async (response) => {
    if (!response.ok) return null
    const data = await response.json()
    return {
      key: String(data?.key ?? jiraKey),
      title: String(data?.fields?.summary ?? jiraKey),
      status: String(data?.fields?.status?.name ?? ''),
    }
  })
}

export function createJiraTask(input: {
  title: string
  projectKey: string
  energyType?: string
  ownership?: string
  description?: string
  issueTypeId?: string
  issueTypeName?: string
  componentId?: string
  assigneeName?: string
}) {
  return api.post<JiraCreatedTask>('/api/jira/create', input)
}

export interface JiraIssueWorklog {
  id: string
  created: string
  updated: string
  timeSpentSeconds: number
}

export function isJiraWorklogEdited(log: Pick<JiraIssueWorklog, 'created' | 'updated'>) {
  const created = Date.parse(log.created)
  const updated = Date.parse(log.updated)
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 2000
}

export function jiraWorklogMinutes(log: Pick<JiraIssueWorklog, 'timeSpentSeconds'>) {
  return Math.max(0, Math.round(Number(log.timeSpentSeconds || 0) / 60))
}

export function isJiraNewStatus(name: string) {
  const value = name.trim().toLowerCase()
  if (!value || isJiraClosedStatus(value)) return false
  if (
    value === 'در حال بررسی محصول' ||
    value.includes('in progress') ||
    value === 'doing' ||
    value === 'در حال انجام'
  ) {
    return false
  }
  return (
    value === 'waiting for review' ||
    value === 'waiting for support' ||
    value === 'waiting for customer' ||
    value === 'pending' ||
    value === 'to do' ||
    value === 'todo' ||
    value === 'open' ||
    value === 'new' ||
    value === 'backlog' ||
    value === 'reopened' ||
    value === 'assigned' ||
    value.includes('waiting') ||
    value.includes('pending') ||
    value.includes('در انتظار') ||
    value.includes('منتظر بررسی')
  )
}

export function isJiraClosedStatus(name: string) {
  const value = name.trim().toLowerCase()
  return [
    'done',
    'not solvable',
    'canceled',
    'cancelled',
    'request completed',
    'request cancelled',
    'request canceled',
    'انجام شده',
    'لغو شده',
  ].includes(value)
}

export function isJiraCancelledStatus(name: string) {
  const value = name.trim().toLowerCase()
  return (
    value === 'canceled' ||
    value === 'cancelled' ||
    value === 'request cancelled' ||
    value === 'request canceled' ||
    value === 'not solvable' ||
    value === 'لغو شده' ||
    value.includes('cancel') ||
    value.includes('لغو')
  )
}

export interface JiraCommentAuthor {
  name?: string
  displayName?: string
}

export interface JiraIssueComment {
  id: string
  body: string
  created: string
  author?: JiraCommentAuthor
  /** Jira Service Desk internal (team-only) vs shared with customer */
  internal?: boolean
}

export interface JiraIssueThread {
  status?: string
  reporter: JiraCommentAuthor | null
  assignee: JiraCommentAuthor | null
  creator: JiraCommentAuthor | null
  description: string
  created: string
  comments: JiraIssueComment[]
}

function asJiraPerson(value: unknown): JiraCommentAuthor | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { name?: string; key?: string; displayName?: string }
  const name = row.name || row.key
  if (!name && !row.displayName) return null
  return { name, displayName: row.displayName }
}

function commentIsInternal(row: {
  properties?: Array<{ key?: string; value?: { internal?: boolean; allow?: boolean } }>
}): boolean | undefined {
  const props = Array.isArray(row.properties) ? row.properties : []
  const publicFlag = props.find((p) => p?.key === 'sd.public.comment')
  if (publicFlag && typeof publicFlag.value?.internal === 'boolean') {
    return publicFlag.value.internal
  }
  // Portal / customer-visible comments often only carry sd.allow.public.comment
  if (props.some((p) => p?.key === 'sd.allow.public.comment' && p?.value?.allow === true)) {
    return false
  }
  return undefined
}

export function getJiraIssueThread(jiraKey: string) {
  return api.get<Record<string, unknown>>(`/api/jira/issues/${encodeURIComponent(jiraKey)}/thread`).then((data) => {
    const comments = Array.isArray(data?.comments) ? data.comments : []
    return {
      reporter: asJiraPerson(data?.reporter as JiraCommentAuthor | null),
      assignee: asJiraPerson(data?.assignee as JiraCommentAuthor | null),
      creator: asJiraPerson(data?.creator as JiraCommentAuthor | null),
      description: String(data?.description ?? ''),
      created: String(data?.created ?? ''),
      status: String(data?.status ?? ''),
      comments: comments.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        body: String(row.body ?? ''),
        created: String(row.created ?? ''),
        author: {
          name: String((row as { authorKey?: string }).authorKey ?? row.authorName ?? ''),
          displayName: String(row.authorName ?? ''),
        },
        internal: Boolean(row.internal),
      })),
    } as JiraIssueThread
  })
}

export function addJiraIssueComment(jiraKey: string, body: string, options?: { internal?: boolean }) {
  return api.post<{ ok: boolean }>(`/api/jira/issues/${encodeURIComponent(jiraKey)}/comments`, {
    body,
    internal: Boolean(options?.internal),
  })
}

export function isKhadangAgent(
  person?: { name?: string | null; displayName?: string | null } | string | null,
) {
  const raw =
    typeof person === 'string'
      ? person
      : `${person?.name ?? ''} ${person?.displayName ?? ''}`
  const value = raw.trim().toLowerCase()
  return (
    value.includes('khadang')
    || value.includes('خدنگ')
  )
}

export function isJiraMe(person?: JiraCommentAuthor | null) {
  const name = String(person?.name || '').trim().toLowerCase()
  const display = String(person?.displayName || '').trim().toLowerCase()
  return name === 'reza' || display.includes('reza hakimi') || display.includes('رضا حکیمی')
}

export function getJiraIssueStatus(jiraKey: string) {
  const key = String(jiraKey || '').trim()
  if (!key) return Promise.resolve('')
  return searchJiraIssueStatuses([key]).then((rows) => {
    const hit = rows.find((r) => r.key.toUpperCase() === key.toUpperCase())
    if (hit?.status) return hit.status
    return getJiraIssueThread(key).then((t) => String(t.status || '')).catch(() => '')
  }).catch(() =>
    getJiraIssueThread(key).then((t) => String(t.status || '')).catch(() => ''),
  )
}

export function listJiraIssueWorklogs(jiraKey: string) {
  return fetch(`/jira-rest/rest/api/2/issue/${encodeURIComponent(jiraKey)}/worklog`).then(async (response) => {
    if (!response.ok) throw new Error('jira worklogs failed')
    const data = await response.json()
    return (Array.isArray(data?.worklogs) ? data.worklogs : []) as JiraIssueWorklog[]
  })
}

export interface JiraIssueState {
  key: string
  status: string
  assignee?: JiraCommentAuthor | null
}

export function searchJiraIssueStatuses(keys: string[]) {
  const unique = [...new Set(keys.filter(Boolean).map((k) => k.trim()).filter(Boolean))]
  if (unique.length === 0) return Promise.resolve([] as JiraIssueState[])
  const batches: string[][] = []
  for (let i = 0; i < unique.length; i += 40) batches.push(unique.slice(i, i + 40))
  return Promise.all(
    batches.map((batch) =>
      api.get<Array<{ key?: string; status?: string; assignee?: JiraCommentAuthor | null }>>(
        `/api/jira/issue-states?keys=${encodeURIComponent(batch.join(','))}`,
      ).then((rows) =>
        (Array.isArray(rows) ? rows : []).map((row) => ({
          key: String(row.key ?? ''),
          status: String(row.status ?? ''),
          assignee: asJiraPerson(row.assignee),
        })) as JiraIssueState[],
      ),
    ),
  ).then((rows) => rows.flat())
}

export function searchJiraUsers(projectKey: string, q = '') {
  const params = new URLSearchParams()
  if (projectKey) params.set('projectKey', projectKey)
  if (q.trim()) params.set('q', q.trim())
  return api.get<JiraUserOption[]>(`/api/jira/users?${params.toString()}`)
}

export function jiraProjectKeyFromIssue(jiraKey?: string | null) {
  const key = String(jiraKey || '').trim().toUpperCase()
  const idx = key.indexOf('-')
  return idx > 0 ? key.slice(0, idx) : 'PS'
}
