import { getFocus, setFocus } from '../api/focus'
import type { TaskItem } from '../types'
import { isJunkWorkTitle } from './tags'

export const FOCUS_SWITCH_MS = 30_000

let pending: { id: number; since: number } | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function subscribeFocusSwitch(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function peekFocusSwitch() {
  return pending
}

export function remainingFocusSwitchMs(taskId: number) {
  if (!pending || pending.id !== taskId) return 0
  return Math.max(0, FOCUS_SWITCH_MS - (Date.now() - pending.since))
}

function focusTitle(task: TaskItem) {
  return isJunkWorkTitle(task.title) ? `کار #${task.id}` : task.title
}

export async function requestTaskFocus(task: TaskItem) {
  const current = await getFocus()
  const sameTask = current.active && current.taskId === task.id
  const idle = !current.active || current.taskId == null
  if (sameTask || idle) {
    pending = null
    notify()
    return setFocus({
      description: focusTitle(task),
      taskId: task.id,
      durationMinutes: 0,
      log: false,
    })
  }

  const now = Date.now()
  if (pending?.id === task.id && now - pending.since >= FOCUS_SWITCH_MS) {
    pending = null
    notify()
    return setFocus({
      description: focusTitle(task),
      taskId: task.id,
      durationMinutes: 0,
      log: false,
    })
  }

  if (!pending || pending.id !== task.id) {
    pending = { id: task.id, since: now }
  }
  notify()
  return current
}
