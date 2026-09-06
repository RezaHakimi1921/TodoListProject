import { loadStore, saveStore } from './mockData'
import type { TaskItem, Problem, WorkLogEntry, DailyLog } from '../types'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

let backendAvailable: boolean | null = null

async function checkBackend(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 600)
    const res = await fetch('/api/settings', { signal: controller.signal })
    clearTimeout(timeout)
    backendAvailable = res.ok || res.status === 200
    return backendAvailable
  } catch {
    backendAvailable = false
    return false
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isAvailable = await checkBackend()
  if (isAvailable) {
    try {
      const response = await fetch(path, {
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
        ...init,
      })
      if (response.status === 204) {
        return undefined as T
      }
      const text = await response.text()
      const data = text ? JSON.parse(text) : null
      if (!response.ok) {
        throw new ApiError(data?.error ?? `Request failed (${response.status})`, response.status)
      }
      return data as T
    } catch (err) {
      if (err instanceof ApiError) throw err
      // Fallback to local store if network fails
    }
  }

  // Local storage mock fallback
  return handleLocalMock<T>(path, init)
}

function handleLocalMock<T>(path: string, init?: RequestInit): T {
  const store = loadStore()
  const method = init?.method?.toUpperCase() ?? 'GET'
  const body = init?.body ? JSON.parse(init.body as string) : null
  const url = new URL(path, 'http://localhost')
  const pathname = url.pathname

  // Tasks API
  if (pathname === '/api/tasks' && method === 'GET') {
    let result = [...store.tasks]
    const status = url.searchParams.get('status')
    const energyType = url.searchParams.get('energyType')
    const tag = url.searchParams.get('tag')
    if (status) result = result.filter((t) => t.status === status)
    if (energyType) result = result.filter((t) => t.energyType === energyType)
    if (tag) result = result.filter((t) => t.tags.includes(tag))
    return result as unknown as T
  }

  if (pathname === '/api/tasks' && method === 'POST') {
    const nextId = store.tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1
    const rawTags = body.tags || ''
    const tags = Array.isArray(rawTags)
      ? rawTags
      : typeof rawTags === 'string'
      ? rawTags.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []
    const newTask = {
      id: nextId,
      title: body.title,
      status: 'Open' as const,
      energyType: body.energyType || 'Light',
      tags,
      stuckReason: null,
      isAging: false,
      agingDays: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      doneAt: null,
    }
    store.tasks.unshift(newTask)
    saveStore(store)
    return newTask as unknown as T
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/(\d+)$/)
  if (taskMatch) {
    const id = Number(taskMatch[1])
    if (method === 'GET') {
      const found = store.tasks.find((t) => t.id === id)
      if (!found) throw new ApiError('کار یافت نشد', 404)
      return found as unknown as T
    }
    if (method === 'PUT') {
      const idx = store.tasks.findIndex((t) => t.id === id)
      if (idx === -1) throw new ApiError('کار یافت نشد', 404)
      const rawTags = body.tags ?? store.tasks[idx].tags
      const tags = Array.isArray(rawTags)
        ? rawTags
        : typeof rawTags === 'string'
        ? rawTags.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
      store.tasks[idx] = {
        ...store.tasks[idx],
        title: body.title ?? store.tasks[idx].title,
        status: body.status ?? store.tasks[idx].status,
        energyType: body.energyType ?? store.tasks[idx].energyType,
        tags,
        updatedAt: new Date().toISOString(),
      }
      saveStore(store)
      return store.tasks[idx] as unknown as T
    }
    if (method === 'DELETE') {
      const idx = store.tasks.findIndex((t) => t.id === id)
      if (idx !== -1) {
        const [deleted] = store.tasks.splice(idx, 1)
        store.trash.unshift({
          kind: 'task',
          id: deleted.id,
          title: deleted.title,
          deletedAt: new Date().toISOString(),
          data: deleted,
        })
        saveStore(store)
      }
      return undefined as T
    }
  }

  const statusMatch = pathname.match(/^\/api\/tasks\/(\d+)\/status$/)
  if (statusMatch && method === 'PUT') {
    const id = Number(statusMatch[1])
    const idx = store.tasks.findIndex((t) => t.id === id)
    if (idx !== -1) {
      const prev = store.tasks[idx]
      store.tasks[idx] = {
        ...prev,
        status: body.status,
        stuckReason: body.stuckReason ?? (body.status === 'Stuck' ? prev.stuckReason : null),
        doneAt: body.status === 'Done' ? new Date().toISOString() : null,
        isAging: body.status === 'Done' ? false : prev.isAging,
        updatedAt: new Date().toISOString(),
      }
      saveStore(store)
      return store.tasks[idx] as unknown as T
    }
  }

  const timelineListMatch = pathname.match(/^\/api\/tasks\/(\d+)\/timeline$/)
  if (timelineListMatch) {
    const taskId = Number(timelineListMatch[1])
    if (method === 'GET') {
      return store.timeline.filter((t) => t.taskId === taskId) as unknown as T
    }
    if (method === 'POST') {
      const nextId = store.timeline.reduce((m, t) => Math.max(m, t.id), 0) + 1
      const entry = {
        id: nextId,
        taskId,
        note: body.note,
        createdAt: new Date().toISOString(),
      }
      store.timeline.push(entry)
      saveStore(store)
      return entry as unknown as T
    }
  }

  const timelineDeleteMatch = pathname.match(/^\/api\/tasks\/(\d+)\/timeline\/(\d+)$/)
  if (timelineDeleteMatch && method === 'DELETE') {
    const entryId = Number(timelineDeleteMatch[2])
    store.timeline = store.timeline.filter((t) => t.id !== entryId)
    saveStore(store)
    return undefined as T
  }

  // WorkLogs API
  if (pathname === '/api/worklogs' && method === 'GET') {
    const date = url.searchParams.get('date')
    let logs = [...store.workLogs]
    if (date) {
      logs = logs.filter((l) => l.createdAt.startsWith(date))
    }
    return logs as unknown as T
  }

  if (pathname === '/api/worklogs' && method === 'POST') {
    const nextId = store.workLogs.reduce((m, l) => Math.max(m, l.id), 0) + 1
    const newLog = {
      id: nextId,
      description: body.description,
      durationMinutes: body.durationMinutes ?? 15,
      source: body.source ?? 'Manual',
      taskId: body.taskId ?? null,
      problemId: body.problemId ?? null,
      createdAt: new Date().toISOString(),
    }
    store.workLogs.unshift(newLog)
    saveStore(store)
    return newLog as unknown as T
  }

  if (pathname === '/api/worklogs/summary' && method === 'GET') {
    const date = url.searchParams.get('date') ?? ''
    const logs = store.workLogs.filter((l) => l.createdAt.startsWith(date))
    const totalMinutes = logs.reduce((sum, l) => sum + l.durationMinutes, 0)
    const grouped: Record<string, typeof logs> = {}
    for (const log of logs) {
      const title = log.taskId
        ? store.tasks.find((t) => t.id === log.taskId)?.title ?? 'کار ناشناس'
        : log.problemId
        ? store.problems.find((p) => p.id === log.problemId)?.title ?? 'مسئله'
        : 'سایر فعالیت‌ها'
      if (!grouped[title]) grouped[title] = []
      grouped[title].push(log)
    }
    const groups = Object.entries(grouped).map(([title, entries]) => ({
      title,
      totalMinutes: entries.reduce((s, e) => s + e.durationMinutes, 0),
      entries,
    }))
    const copyLines = groups.map((g) => `• ${g.title}: ${g.totalMinutes}m`).join('\n')
    return {
      date,
      totalMinutes,
      groups,
      copyText: `گزارش کار روزانه (${date})\nمجموع زمان: ${totalMinutes} دقیقه\n${copyLines}`,
    } as unknown as T
  }

  const entityWorkLogsMatch = pathname.match(/^\/api\/worklogs\/by-(task|problem)\/(\d+)$/)
  if (entityWorkLogsMatch && method === 'GET') {
    const kind = entityWorkLogsMatch[1]
    const id = Number(entityWorkLogsMatch[2])
    const entries = store.workLogs.filter((l) => (kind === 'task' ? l.taskId === id : l.problemId === id))
    return {
      totalMinutes: entries.reduce((s, l) => s + l.durationMinutes, 0),
      entries,
    } as unknown as T
  }

  const workLogDeleteMatch = pathname.match(/^\/api\/worklogs\/(\d+)$/)
  if (workLogDeleteMatch && method === 'DELETE') {
    const id = Number(workLogDeleteMatch[1])
    const idx = store.workLogs.findIndex((l) => l.id === id)
    if (idx !== -1) {
      const [deleted] = store.workLogs.splice(idx, 1)
      store.trash.unshift({
        kind: 'worklog',
        id: deleted.id,
        title: deleted.description,
        deletedAt: new Date().toISOString(),
        data: deleted,
      })
      saveStore(store)
    }
    return undefined as T
  }

  // Problems API
  if (pathname === '/api/problems' && method === 'GET') {
    return store.problems as unknown as T
  }

  if (pathname === '/api/problems' && method === 'POST') {
    const nextId = store.problems.reduce((m, p) => Math.max(m, p.id), 0) + 1
    const newProb = {
      id: nextId,
      title: body.title,
      status: 'Exploring' as const,
      noTimeNote: null,
      infiniteTimeNote: null,
      chosenOptionId: null,
      premortemSign: null,
      options: [],
      canChoose: false,
      blocker: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.problems.unshift(newProb)
    saveStore(store)
    return newProb as unknown as T
  }

  const problemMatch = pathname.match(/^\/api\/problems\/(\d+)$/)
  if (problemMatch) {
    const id = Number(problemMatch[1])
    if (method === 'GET') {
      const found = store.problems.find((p) => p.id === id)
      if (!found) throw new ApiError('مسئله یافت نشد', 404)
      return found as unknown as T
    }
    if (method === 'PUT') {
      const idx = store.problems.findIndex((p) => p.id === id)
      if (idx !== -1) {
        store.problems[idx] = {
          ...store.problems[idx],
          title: body.title ?? store.problems[idx].title,
          noTimeNote: body.noTimeNote ?? store.problems[idx].noTimeNote,
          infiniteTimeNote: body.infiniteTimeNote ?? store.problems[idx].infiniteTimeNote,
          updatedAt: new Date().toISOString(),
        }
        saveStore(store)
        return store.problems[idx] as unknown as T
      }
    }
    if (method === 'DELETE') {
      const idx = store.problems.findIndex((p) => p.id === id)
      if (idx !== -1) {
        const [deleted] = store.problems.splice(idx, 1)
        store.trash.unshift({
          kind: 'problem',
          id: deleted.id,
          title: deleted.title,
          deletedAt: new Date().toISOString(),
          data: deleted,
        })
        saveStore(store)
      }
      return undefined as T
    }
  }

  const problemOptionAddMatch = pathname.match(/^\/api\/problems\/(\d+)\/options$/)
  if (problemOptionAddMatch && method === 'POST') {
    const pId = Number(problemOptionAddMatch[1])
    const p = store.problems.find((item) => item.id === pId)
    if (p) {
      const optId = (p.options.reduce((m, o) => Math.max(m, o.id), 0) || 0) + 1
      p.options.push({
        id: optId,
        title: body.title,
        juniorExplain: body.juniorExplain ?? null,
        sortOrder: p.options.length + 1,
        isChosen: false,
      })
      p.canChoose = p.options.length >= 2
      saveStore(store)
      return p as unknown as T
    }
  }

  const problemOptionEditMatch = pathname.match(/^\/api\/problems\/(\d+)\/options\/(\d+)$/)
  if (problemOptionEditMatch) {
    const pId = Number(problemOptionEditMatch[1])
    const optId = Number(problemOptionEditMatch[2])
    const p = store.problems.find((item) => item.id === pId)
    if (p) {
      if (method === 'PUT') {
        const opt = p.options.find((o) => o.id === optId)
        if (opt) {
          opt.title = body.title ?? opt.title
          opt.juniorExplain = body.juniorExplain ?? opt.juniorExplain
          saveStore(store)
        }
        return p as unknown as T
      }
      if (method === 'DELETE') {
        p.options = p.options.filter((o) => o.id !== optId)
        p.canChoose = p.options.length >= 2
        saveStore(store)
        return undefined as T
      }
    }
  }

  const problemChooseMatch = pathname.match(/^\/api\/problems\/(\d+)\/choose$/)
  if (problemChooseMatch && method === 'POST') {
    const pId = Number(problemChooseMatch[1])
    const p = store.problems.find((item) => item.id === pId)
    if (p) {
      p.chosenOptionId = body.optionId
      p.premortemSign = body.premortemSign
      p.status = 'Chosen'
      p.options.forEach((o) => {
        o.isChosen = o.id === body.optionId
      })
      saveStore(store)
      return p as unknown as T
    }
  }

  const problemValidateMatch = pathname.match(/^\/api\/problems\/(\d+)\/validate$/)
  if (problemValidateMatch && method === 'POST') {
    const pId = Number(problemValidateMatch[1])
    const p = store.problems.find((item) => item.id === pId)
    if (p) {
      p.status = 'Validated'
      saveStore(store)
      return p as unknown as T
    }
  }

  // DailyLogs API
  if (pathname === '/api/dailylogs' && method === 'GET') {
    const date = url.searchParams.get('date')
    if (date) {
      return (store.dailyLogs.find((d) => d.logDate === date) ?? null) as unknown as T
    }
    return store.dailyLogs as unknown as T
  }

  if (pathname === '/api/dailylogs' && method === 'POST') {
    const found = store.dailyLogs.find((d) => d.logDate === body.logDate)
    if (found) {
      found.note = body.note
      saveStore(store)
      return found as unknown as T
    }
    const nextId = store.dailyLogs.reduce((m, d) => Math.max(m, d.id), 0) + 1
    const newLog = {
      id: nextId,
      logDate: body.logDate,
      note: body.note,
      createdAt: new Date().toISOString(),
    }
    store.dailyLogs.unshift(newLog)
    saveStore(store)
    return newLog as unknown as T
  }

  const dailyLogDeleteMatch = pathname.match(/^\/api\/dailylogs\/(\d+)$/)
  if (dailyLogDeleteMatch && method === 'DELETE') {
    const id = Number(dailyLogDeleteMatch[1])
    const idx = store.dailyLogs.findIndex((d) => d.id === id)
    if (idx !== -1) {
      const [deleted] = store.dailyLogs.splice(idx, 1)
      store.trash.unshift({
        kind: 'dailylog',
        id: deleted.id,
        title: `یادداشت روزانه ${deleted.logDate}`,
        deletedAt: new Date().toISOString(),
        data: deleted,
      })
      saveStore(store)
    }
    return undefined as T
  }

  const relatedTasksMatch = pathname.match(/^\/api\/dailylogs\/([^/]+)\/related-tasks$/)
  if (relatedTasksMatch && method === 'GET') {
    return store.tasks.slice(0, 4) as unknown as T
  }

  // Trash API
  if (pathname === '/api/trash' && method === 'GET') {
    return store.trash as unknown as T
  }

  if (pathname === '/api/trash/restore' && method === 'POST') {
    const idx = store.trash.findIndex((t) => t.kind === body.kind && t.id === body.id)
    if (idx !== -1) {
      const [restored] = store.trash.splice(idx, 1)
      if (restored.kind === 'task') store.tasks.unshift(restored.data as TaskItem)
      if (restored.kind === 'problem') store.problems.unshift(restored.data as Problem)
      if (restored.kind === 'worklog') store.workLogs.unshift(restored.data as WorkLogEntry)
      if (restored.kind === 'dailylog') store.dailyLogs.unshift(restored.data as DailyLog)
      saveStore(store)
    }
    return undefined as T
  }

  if (pathname === '/api/trash' && method === 'DELETE') {
    const kind = url.searchParams.get('kind')
    const id = url.searchParams.get('id')
    if (kind && id) {
      store.trash = store.trash.filter((t) => !(t.kind === kind && t.id === Number(id)))
    } else {
      store.trash = []
    }
    saveStore(store)
    return undefined as T
  }

  // Settings API
  if (pathname === '/api/settings' && method === 'GET') {
    return store.settings as unknown as T
  }

  if (pathname === '/api/settings' && method === 'PUT') {
    store.settings = {
      ...store.settings,
      pingMinutes: body.pingMinutes ?? store.settings.pingMinutes,
      paused: body.paused ?? store.settings.paused,
    }
    saveStore(store)
    return store.settings as unknown as T
  }

  if (pathname === '/api/settings/ack-ping' && method === 'POST') {
    store.settings.lastPingAt = new Date().toISOString()
    saveStore(store)
    return store.settings as unknown as T
  }

  if (pathname === '/api/settings/test-toast' && method === 'POST') {
    return store.settings as unknown as T
  }

  // Focus API
  if (pathname === '/api/focus' && method === 'GET') {
    return store.focus as unknown as T
  }

  if (pathname === '/api/focus' && method === 'PUT') {
    store.focus = {
      active: true,
      description: body.description,
      taskId: body.taskId ?? null,
      problemId: body.problemId ?? null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveStore(store)
    return store.focus as unknown as T
  }

  if (pathname === '/api/focus/finish' && method === 'POST') {
    store.focus = {
      active: false,
      description: '',
      taskId: null,
      problemId: null,
      startedAt: null,
      updatedAt: null,
    }
    saveStore(store)
    return store.focus as unknown as T
  }

  if (pathname === '/api/focus' && method === 'DELETE') {
    store.focus = {
      active: false,
      description: '',
      taskId: null,
      problemId: null,
      startedAt: null,
      updatedAt: null,
    }
    saveStore(store)
    return store.focus as unknown as T
  }

  return {} as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}
