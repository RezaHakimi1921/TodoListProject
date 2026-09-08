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
