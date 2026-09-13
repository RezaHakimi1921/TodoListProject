import { finishFocus, getFocus } from '../api/focus'
import { markTaskNotificationsRead } from '../api/notifications'
import { listTasks } from '../api/tasks'
import { isFocusPaused, type TaskItem } from '../types'
import { requestTaskFocus } from './focusSwitch'
import { taskJiraKey } from './jira'

const ACTIVITY_KEYS = new Set([
  'SIP-2286',
  'SIP-2287',
  'SIP-2288',
  'SIP-2289',
  'SIP-2290',
])

function isActivityTask(task: TaskItem) {
  const key = taskJiraKey(task)
  return Boolean(key && ACTIVITY_KEYS.has(key.toUpperCase()))
}

function newestFirst(left: TaskItem, right: TaskItem) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
}

export function pickPreviousFocusTask(tasks: TaskItem[], doneTaskId: number): TaskItem | null {
  const candidates = tasks.filter((task) => {
    if (task.id === doneTaskId) return false
    if (task.status === 'Done') return false
    if (task.ownership === 'Other') return false
    if (isActivityTask(task)) return false
    return true
  })
  const paused = candidates.filter(isFocusPaused).sort(newestFirst)
  if (paused[0]) return paused[0]
  const doing = candidates.filter((task) => task.status === 'Doing').sort(newestFirst)
  return doing[0] ?? null
}

/**
 * After a task is Done: drop its inbox toast, and if focus was on it (or just
 * cleared because it is Done), immediately continue the previous paused task
 * so the timer does not sit idle.
 */
export async function onFocusedTaskDone(doneTaskId: number, tasks?: TaskItem[]) {
  await markTaskNotificationsRead(doneTaskId).catch(() => undefined)

  const list = tasks && tasks.length > 0 ? tasks : await listTasks().catch(() => [])
  const focus = await getFocus().catch(() => null)
  if (focus?.isResting) return
  if (focus?.active && focus.taskId != null && focus.taskId !== doneTaskId) return

  const previous = pickPreviousFocusTask(list, doneTaskId)
  if (previous) {
    await requestTaskFocus(previous)
    return
  }

  if (focus?.active && focus.taskId === doneTaskId) {
    await finishFocus({ markTaskDone: false }).catch(() => undefined)
  }
}
