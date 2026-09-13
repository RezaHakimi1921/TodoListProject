import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFocus } from '../api/focus'
import { listTasks, updateTaskStatus } from '../api/tasks'
import { taskJiraKey } from '../lib/jira'
import { onFocusedTaskDone } from '../lib/resumePreviousFocus'
import { FOCUS_PAUSED_REASON, isFocusPaused } from '../types'

const ACTIVITY_KEYS = new Set([
  'SIP-2286',
  'SIP-2287',
  'SIP-2288',
  'SIP-2289',
  'SIP-2290',
])

function isActivityTask(task: { title: string; jiraKey?: string | null }) {
  const key = taskJiraKey(task)
  return Boolean(key && ACTIVITY_KEYS.has(key.toUpperCase()))
}

export function useFocusTaskStatus() {
  const queryClient = useQueryClient()
  const focusQuery = useQuery({
    queryKey: ['focus'],
    queryFn: getFocus,
    refetchInterval: 4000,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })
  const inFlight = useRef(false)

  useEffect(() => {
    const focus = focusQuery.data
    const tasks = tasksQuery.data
    if (!focus || !tasks || inFlight.current) return

    const currentId = focus.active ? focus.taskId : null
    const current = currentId ? tasks.find((task) => task.id === currentId) : undefined
    if (current?.status === 'Done' && !focus.isResting) {
      inFlight.current = true
      void onFocusedTaskDone(current.id, tasks)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ['focus'] })
          void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        })
        .finally(() => {
          inFlight.current = false
        })
      return
    }

    // Without an active focus, do not rewrite Doing/Stuck — that fights Play and the status menu.
    if (!currentId) return

    const extras = tasks.filter((task) => task.status === 'Doing' && task.id !== currentId)
    const currentNeedsDoing = Boolean(
      current && current.status === 'Open',
    )
    if (!currentNeedsDoing && extras.length === 0) return

    inFlight.current = true
    void (async () => {
      try {
        if (current && currentNeedsDoing) {
          await updateTaskStatus(current.id, { status: 'Doing' })
        }
        for (const task of extras) {
          if (task.status === 'Done' || task.status === 'Stuck' || isFocusPaused(task)) continue
          if (isActivityTask(task)) {
            await updateTaskStatus(task.id, { status: 'Open' })
            continue
          }
          await updateTaskStatus(task.id, {
            status: 'Stuck',
            stuckReason: FOCUS_PAUSED_REASON,
          })
        }
        await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      } finally {
        inFlight.current = false
      }
    })()
  }, [focusQuery.data, queryClient, tasksQuery.data])
}
