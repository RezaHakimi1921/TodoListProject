import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFocus } from '../api/focus'
import { listTasks, updateTaskStatus } from '../api/tasks'
import { FOCUS_PAUSED_REASON, isFocusPaused } from '../types'

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

    const currentId = focus.active && !focus.isResting ? focus.taskId : null
    const current = currentId ? tasks.find((task) => task.id === currentId) : undefined
    const extras = tasks.filter((task) => task.status === 'Doing' && task.id !== currentId)
    const currentNeedsDoing = Boolean(
      current && current.status !== 'Doing' && current.status !== 'Done',
    )
    if (!currentNeedsDoing && extras.length === 0) return

    inFlight.current = true
    void (async () => {
      try {
        if (current && currentNeedsDoing) {
          await updateTaskStatus(current.id, { status: 'Doing' })
        }
        for (const task of extras) {
          if (task.status === 'Done' || isFocusPaused(task)) continue
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
