import { finishFocus, getFocus } from '../api/focus'
import { markTaskNotificationsRead } from '../api/notifications'
import type { TaskItem } from '../types'

/**
 * After a task is marked Done: clear its inbox toasts and stop focus if it was
 * on that task. Do NOT auto-jump to a previous task — the user may reopen the
 * Done item to review it, and the idle banner already asks them to pick next.
 */
export async function onFocusedTaskDone(doneTaskId: number, _tasks?: TaskItem[]) {
  await markTaskNotificationsRead(doneTaskId).catch(() => undefined)

  const focus = await getFocus().catch(() => null)
  if (focus?.isResting) return
  if (focus?.active && focus.taskId === doneTaskId) {
    await finishFocus({ markTaskDone: false }).catch(() => undefined)
  }
}
