import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isJiraClosedStatus, searchJiraIssueStatuses } from '../api/jira'
import { listTasks, updateTaskStatus } from '../api/tasks'
import { taskJiraKey } from '../lib/jira'

export function useJiraClosedTasks() {
  const queryClient = useQueryClient()
  const tasksQuery = useQuery({
    queryKey: ['jira-sync-tasks'],
    queryFn: () => listTasks(),
    refetchInterval: 20_000,
  })
  const inFlight = useRef(false)

  useEffect(() => {
    const tasks = tasksQuery.data
    if (!tasks || inFlight.current) return
    const linked = tasks
      .map((task) => ({ task, key: taskJiraKey(task) }))
      .filter((row): row is { task: (typeof tasks)[number]; key: string } => Boolean(row.key))
    if (linked.length === 0) return
    const keys = [...new Set(linked.map((row) => row.key))]

    inFlight.current = true
    void (async () => {
      try {
        const rows = await searchJiraIssueStatuses(keys)
        const byKey = new Map(rows.map((row) => [row.key.toUpperCase(), row.status]))
        let changed = false
        for (const { task, key } of linked) {
          const jiraStatus = byKey.get(key.toUpperCase())
          if (!jiraStatus) continue
          const closed = isJiraClosedStatus(jiraStatus)
          if (closed && task.status !== 'Done') {
            await updateTaskStatus(task.id, { status: 'Done' })
            changed = true
          } else if (!closed && task.status === 'Done') {
            await updateTaskStatus(task.id, { status: 'Open' })
            changed = true
          }
        }
        if (changed) {
          await queryClient.invalidateQueries({ queryKey: ['tasks'] })
          await queryClient.invalidateQueries({ queryKey: ['jira-sync-tasks'] })
        }
      } catch {
        /* Jira proxy down */
      } finally {
        inFlight.current = false
      }
    })()
  }, [queryClient, tasksQuery.data])
}
