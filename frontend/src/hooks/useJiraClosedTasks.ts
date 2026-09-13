import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFocus } from '../api/focus'
import { isJiraClosedStatus, isJiraMe, searchJiraIssueStatuses, type JiraIssueState } from '../api/jira'
import { listTasks, updateTask, updateTaskStatus } from '../api/tasks'
import { taskJiraKey } from '../lib/jira'
import { onFocusedTaskDone } from '../lib/resumePreviousFocus'

export const JIRA_ISSUE_STATE_KEY = ['jira-issue-state'] as const

export function useJiraClosedTasks() {
  const queryClient = useQueryClient()
  const tasksQuery = useQuery({
    queryKey: ['jira-sync-tasks'],
    queryFn: () => listTasks(),
    refetchInterval: 5_000,
  })
  const inFlight = useRef(false)

  useEffect(() => {
    const tasks = tasksQuery.data
    if (!tasks || inFlight.current) return
    const linked = tasks
      .map((task) => ({ task, key: taskJiraKey(task) }))
      .filter((row): row is { task: (typeof tasks)[number]; key: string } => Boolean(row.key))
    if (linked.length === 0) {
      queryClient.setQueryData<JiraIssueState[]>(JIRA_ISSUE_STATE_KEY, [])
      return
    }
    const keys = [...new Set(linked.map((row) => row.key))]

    inFlight.current = true
    void (async () => {
      try {
        const rows = await searchJiraIssueStatuses(keys)
        queryClient.setQueryData<JiraIssueState[]>(JIRA_ISSUE_STATE_KEY, rows)
        const byKey = new Map(rows.map((row) => [row.key.toUpperCase(), row]))
        let changed = false
        let closedFocusId: number | null = null
        const focus = await getFocus().catch(() => null)
        for (const { task, key } of linked) {
          const jira = byKey.get(key.toUpperCase())
          if (!jira) continue

          let nextStatus = task.status
          if (jira.status && isJiraClosedStatus(jira.status) && task.status !== 'Done') {
            if (focus?.taskId === task.id) closedFocusId = task.id
            nextStatus = 'Done'
            await updateTaskStatus(task.id, { status: 'Done' })
            changed = true
          } else if (jira.status && !isJiraClosedStatus(jira.status) && task.status === 'Done') {
            nextStatus = 'Open'
            await updateTaskStatus(task.id, { status: 'Open' })
            changed = true
          }

          if (jira.assignee?.name || jira.assignee?.displayName) {
            const nextOwnership = isJiraMe(jira.assignee) ? 'Mine' : 'Other'
            if ((task.ownership ?? 'Mine') !== nextOwnership) {
              await updateTask(task.id, {
                title: task.title,
                status: nextStatus,
                energyType: task.energyType,
                tags: task.tags.join(','),
                ownership: nextOwnership,
              })
              changed = true
            }
          }
        }
        if (closedFocusId != null) {
          await onFocusedTaskDone(closedFocusId, tasks)
        }
        if (changed) {
          await queryClient.invalidateQueries({ queryKey: ['tasks'] })
          await queryClient.invalidateQueries({ queryKey: ['focus'] })
          await queryClient.invalidateQueries({ queryKey: ['jira-sync-tasks'] })
          await queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      } catch {
        /* Jira proxy down */
      } finally {
        inFlight.current = false
      }
    })()
  }, [queryClient, tasksQuery.data])
}
