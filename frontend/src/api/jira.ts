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

export interface JiraCommentAuthor {
  name?: string
  displayName?: string
}

export interface JiraIssueComment {
  id: string
  body: string
  created: string
  author?: JiraCommentAuthor
}

export interface JiraIssueThread {
  reporter: JiraCommentAuthor | null
  assignee: JiraCommentAuthor | null
  creator: JiraCommentAuthor | null
  comments: JiraIssueComment[]
}

function asJiraPerson(value: unknown): JiraCommentAuthor | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { name?: string; displayName?: string }
  if (!row.name && !row.displayName) return null
  return { name: row.name, displayName: row.displayName }
}

export function getJiraIssueThread(jiraKey: string) {
  return fetch(
    `/jira-rest/rest/api/2/issue/${encodeURIComponent(jiraKey)}?fields=comment,reporter,assignee,creator`,
  ).then(async (response) => {
    if (!response.ok) throw new Error('jira comments failed')
    const data = await response.json()
    const comments = Array.isArray(data?.fields?.comment?.comments) ? data.fields.comment.comments : []
    return {
      reporter: asJiraPerson(data?.fields?.reporter),
      assignee: asJiraPerson(data?.fields?.assignee),
      creator: asJiraPerson(data?.fields?.creator),
      comments: comments.map((row: { id?: string; body?: string; created?: string; author?: JiraCommentAuthor }) => ({
        id: String(row.id ?? ''),
        body: String(row.body ?? ''),
        created: String(row.created ?? ''),
        author: asJiraPerson(row.author) ?? undefined,
      })),
    } as JiraIssueThread
  })
}

export function addJiraIssueComment(jiraKey: string, body: string) {
  return fetch(`/jira-rest/rest/api/2/issue/${encodeURIComponent(jiraKey)}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  }).then(async (response) => {
    if (!response.ok) throw new Error('ثبت کامنت در جیرا انجام نشد')
    return response.json()
  })
}

export function isJiraMe(person?: JiraCommentAuthor | null) {
  const name = String(person?.name || '').trim().toLowerCase()
  const display = String(person?.displayName || '').trim().toLowerCase()
  return name === 'reza' || display.includes('reza hakimi') || display.includes('رضا حکیمی')
}

export function getJiraIssueStatus(jiraKey: string) {
  return fetch(`/jira-rest/rest/api/2/issue/${encodeURIComponent(jiraKey)}?fields=status`).then(async (response) => {
    if (!response.ok) throw new Error('jira status failed')
    const data = await response.json()
    return String(data?.fields?.status?.name ?? '')
  })
}

export function listJiraIssueWorklogs(jiraKey: string) {
  return fetch(`/jira-rest/rest/api/2/issue/${encodeURIComponent(jiraKey)}/worklog`).then(async (response) => {
    if (!response.ok) throw new Error('jira worklogs failed')
    const data = await response.json()
    return (Array.isArray(data?.worklogs) ? data.worklogs : []) as JiraIssueWorklog[]
  })
}

export function searchJiraIssueStatuses(keys: string[]) {
  const unique = [...new Set(keys.filter(Boolean))]
  if (unique.length === 0) return Promise.resolve([] as { key: string; status: string }[])
  const jql = `key in (${unique.join(',')})`
  return fetch(
    `/jira-rest/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=status&maxResults=100`,
  ).then(async (response) => {
    if (!response.ok) throw new Error('jira search failed')
    const data = await response.json()
    return (Array.isArray(data?.issues) ? data.issues : []).map((issue: { key?: string; fields?: { status?: { name?: string } } }) => ({
      key: String(issue.key ?? ''),
      status: String(issue.fields?.status?.name ?? ''),
    }))
  })
}
