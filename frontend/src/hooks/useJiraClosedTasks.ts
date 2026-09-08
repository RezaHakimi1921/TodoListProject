import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isJiraClosedStatus, searchJiraIssueStatuses } from '../api/jira'
import { listTasks, updateTaskStatus } from '../api/tasks'

export function useJiraClosedTasks() {
  const queryClient = useQueryClient()
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })
  const inFlight = useRef(false)

  useEffect(() => {
    const tasks = tasksQuery.data
    if (!tasks || inFlight.current) return
    const open = tasks.filter((task) => task.status !== 'Done' && task.jiraKey)
    if (open.length === 0) return
    const keys = [...new Set(open.map((task) => task.jiraKey!))]

    inFlight.current = true
    void (async () => {
      try {
        const rows = await searchJiraIssueStatuses(keys)
        const closed = new Set(
          rows.filter((row) => isJiraClosedStatus(row.status)).map((row) => row.key.toUpperCase()),
        )
        let changed = false
        for (const task of open) {
          if (task.jiraKey && closed.has(task.jiraKey.toUpperCase())) {
            await updateTaskStatus(task.id, { status: 'Done' })
            changed = true
          }
        }
        if (changed) await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      } catch {
        /* Jira proxy down */
      } finally {
        inFlight.current = false
      }
    })()
  }, [queryClient, tasksQuery.data])
}
