import type { TaskItem } from '../types'

const KEY = /[A-Z][A-Z0-9]+-\d+/i

export function taskJiraKey(task: Pick<TaskItem, 'title' | 'jiraKey'>): string | null {
  if (task.jiraKey) return task.jiraKey
  const match = task.title.match(KEY)
  return match ? match[0].toUpperCase() : null
}

export function taskJiraUrl(task: Pick<TaskItem, 'title' | 'jiraKey' | 'jiraUrl'>): string | null {
  if (task.jiraUrl) return task.jiraUrl
  const key = taskJiraKey(task)
  return key ? `https://jira.smartx.ir/browse/${key}` : null
}
