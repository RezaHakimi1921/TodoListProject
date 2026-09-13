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

export function jiraWikiToText(raw?: string | null) {
  if (!raw) return ''
  return String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/!([^!\n]+)!/g, '📎 تصویر')
    .replace(/\[([^\]|\n]+)\|([^\]\n]+)\]/g, '$2')
    .replace(/\[([^\]\n]+)\]/g, '$1')
    .replace(/^[hH][1-6]\.\s*/gm, '')
    .replace(/\{color:[^}]*\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
