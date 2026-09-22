import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFocus } from '../api/focus'
import { listBoardActivities } from '../api/boardActivities'
import { listTasks, updateTaskStatus } from '../api/tasks'
import { taskJiraKey } from '../lib/jira'
import { FOCUS_PAUSED_REASON, isFocusPaused } from '../types'

const LEGACY_ACTIVITY_KEYS = new Set([
  'SIP-2286',
  'SIP-2287',
  'SIP-2288',
  'SIP-2289',
  'SIP-2290',
  'SIP-2356',
])

function isActivityTask(
  task: { title: string; jiraKey?: string | null },
  configuredKeys: Set<string>,
) {
  const key = taskJiraKey(task)?.toUpperCase()
  if (!key) return false
  return configuredKeys.has(key) || LEGACY_ACTIVITY_KEYS.has(key)
}

export function useFocusTaskStatus() {
  const queryClient = useQueryClient()
  const focusQuery = useQuery({
    queryKey: ['focus'],
    queryFn: getFocus,
    refetchInterval: 12_000,
    staleTime: 4_000,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })
  const boardQuery = useQuery({
    queryKey: ['board-activities'],
    queryFn: listBoardActivities,
    staleTime: 60_000,
  })
  const activityKeys = new Set(
    (boardQuery.data ?? []).map((row) => row.jiraKey.toUpperCase()).filter(Boolean),
  )
  const inFlight = useRef(false)

  useEffect(() => {
    const focus = focusQuery.data
    const tasks = tasksQuery.data
    if (!focus || !tasks || inFlight.current) return

    const currentId = focus.active ? focus.taskId : null
    const current = currentId ? tasks.find((task) => task.id === currentId) : undefined

    // Without an active focus, do not rewrite Doing/Stuck — that fights Play and the status menu.
    if (!currentId) return

    const extras = tasks.filter((task) => task.status === 'Doing' && task.id !== currentId)
    const currentNeedsDoing = Boolean(
      current && (current.status === 'Open' || current.status === 'Done'),
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
          if (isActivityTask(task, activityKeys)) {
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
  }, [activityKeys, focusQuery.data, queryClient, tasksQuery.data])
}
