import { setFocus } from '../api/focus'
import type { TaskItem } from '../types'
import { isJunkWorkTitle } from './tags'

function focusTitle(task: TaskItem) {
  return isJunkWorkTitle(task.title) ? `کار #${task.id}` : task.title
}

export async function requestTaskFocus(task: TaskItem) {
  return setFocus({
    description: focusTitle(task),
    taskId: task.id,
    durationMinutes: 0,
    log: false,
  })
}

export async function requestProblemFocus(problem: { id: number; title: string }) {
  return setFocus({
    description: problem.title.trim() || `مسئله #${problem.id}`,
    problemId: problem.id,
    durationMinutes: 0,
    log: false,
  })
}
