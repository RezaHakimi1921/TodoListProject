const API = 'http://127.0.0.1:5088'
const DEFAULT_PING = 10
const params = new URLSearchParams(location.search)
const source = params.get('source') === 'Timer' ? 'Timer' : 'Extension'
const startMode = params.get('mode')
const jiraKey = (params.get('jira') || '').toUpperCase()
const jiraUrl = params.get('url') || ''
const jiraTitle = params.get('title') || jiraKey
const jiraMode = params.get('mode')

const description = document.getElementById('description')
const minutes = document.getElementById('minutes')
const status = document.getElementById('status')
const pauseButton = document.getElementById('pause')
const choose = document.getElementById('choose')
const form = document.getElementById('form')
const jiraBox = document.getElementById('jiraBox')
const currentBox = document.getElementById('currentBox')
const formTitle = document.getElementById('formTitle')
const picks = document.getElementById('picks')

const STATUS_LABEL = { Open: 'باز', Doing: 'در حال انجام', Stuck: 'گیر کرده', Done: 'انجام شد' }
const PROBLEM_LABEL = { Exploring: 'در حال کشف', Chosen: 'انتخاب شده', Validated: 'تست شد' }

let taskItems = []
let problemItems = []

document.getElementById('sourceLabel').textContent = jiraKey ? `Jira ${jiraKey}` : source
if (jiraKey && jiraTitle && jiraTitle !== jiraKey) {
  description.value = jiraTitle
}

function clampPing(value) {
  const next = Number(value)
  if (!Number.isFinite(next)) return DEFAULT_PING
  return Math.min(180, Math.max(1, Math.round(next)))
}

async function loadPingMinutes() {
  try {
    const response = await fetch(`${API}/api/settings`)
    if (response.ok) {
      const data = await response.json()
      return clampPing(data.pingMinutes)
    }
  } catch {
    /* fall through */
  }
  const stored = await chrome.storage.local.get(['pingMinutes'])
  return clampPing(stored.pingMinutes ?? DEFAULT_PING)
}

function show(ok, text) {
  status.className = ok ? 'ok' : 'err'
  status.textContent = text
}

async function getFocus() {
  const response = await fetch(`${API}/api/focus`)
  if (!response.ok) throw new Error('API در دسترس نیست')
  return response.json()
}

async function loadPicks() {
  try {
    const [tasksRes, problemsRes] = await Promise.all([
      fetch(`${API}/api/tasks`),
      fetch(`${API}/api/problems`),
    ])
    taskItems = tasksRes.ok ? await tasksRes.json() : []
    problemItems = problemsRes.ok ? await problemsRes.json() : []
  } catch {
    taskItems = []
    problemItems = []
  }
  renderPicks()
}

function matches(title, query) {
  if (!query.trim()) return true
  return String(title || '').toLowerCase().includes(query.trim().toLowerCase())
}

function renderPicks() {
  const query = description.value || ''
  const tasks = taskItems.filter((task) => (query.trim() || task.status !== 'Done') && matches(task.title, query))
  const problems = problemItems.filter((problem) => matches(problem.title, query))
  const taskHtml = tasks
    .map(
      (task) =>
        `<button type="button" class="pick" data-kind="task" data-id="${task.id}" data-title="${escapeAttr(task.title)}">${escapeHtml(task.title)}<span>${STATUS_LABEL[task.status] || ''}</span></button>`,
    )
    .join('')
  const problemHtml = problems
    .map(
      (problem) =>
        `<button type="button" class="pick" data-kind="problem" data-id="${problem.id}" data-title="${escapeAttr(problem.title)}">${escapeHtml(problem.title)}<span>${PROBLEM_LABEL[problem.status] || ''}</span></button>`,
    )
    .join('')
  picks.innerHTML = `
    <div class="group">کارها</div>
    <div class="list">${taskHtml || '<p class="group">کار بازی پیدا نشد.</p>'}</div>
    <div class="group">مسئله‌ها</div>
    <div class="list">${problemHtml || '<p class="group">مسئله‌ای پیدا نشد.</p>'}</div>
  `
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

function showForm(title) {
  choose.hidden = true
  jiraBox.hidden = true
  form.hidden = false
  formTitle.textContent = title
  description.focus()
  void loadPicks()
}

async function startFocus(payload) {
  const ping = await loadPingMinutes()
  const response = await fetch(`${API}/api/focus`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      durationMinutes: Number(minutes.value) || ping,
      source,
      log: true,
      ...payload,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'ثبت نشد')
  show(true, 'ثبت شد')
  window.setTimeout(() => window.close(), 500)
}

async function startJira({ finishPrevious, markPreviousDone }) {
  const ping = await loadPingMinutes()
  const response = await fetch(`${API}/api/jira/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jiraKey,
      jiraUrl,
      title: jiraTitle,
      finishPrevious,
      markPreviousDone,
      durationMinutes: Number(minutes.value) || ping,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'ثبت نشد')
  show(true, `${jiraKey} شروع شد`)
  window.setTimeout(() => window.close(), 600)
}

async function showJiraPanel() {
  choose.hidden = true
  form.hidden = true
  jiraBox.hidden = false
  document.getElementById('jiraTicket').textContent = jiraTitle.includes(jiraKey)
    ? jiraTitle
    : `${jiraKey} — ${jiraTitle}`
  const startBtn = document.getElementById('jiraStart')
  const keepBtn = document.getElementById('jiraKeep')
  if (jiraMode === 'create') {
    startBtn.textContent = 'بساز و شروع کن'
  } else if (jiraMode === 'start') {
    startBtn.textContent = 'این را شروع کن'
  } else {
    startBtn.textContent = 'تمام شد، این را شروع کن'
  }
  try {
    const focus = await getFocus()
    const focusBox = document.getElementById('jiraFocus')
    if (focus.active && focus.description) {
      focusBox.hidden = false
      focusBox.textContent = `کار فعلی: ${focus.description}`
      keepBtn.hidden = false
    } else {
      focusBox.hidden = true
      keepBtn.hidden = true
    }
  } catch (error) {
    show(false, error.message)
  }
}

async function refresh() {
  const stored = await chrome.storage.local.get(['paused'])
  pauseButton.textContent = stored.paused ? 'Resume Focus' : 'Pause / Away'
  minutes.value = String(await loadPingMinutes())

  if (jiraKey) {
    await showJiraPanel()
    return
  }

  let focus
  try {
    focus = await getFocus()
  } catch (error) {
    show(false, error.message)
    showForm('چیکار می‌کنی؟')
    return
  }

  if (startMode === 'finish' && focus.active) {
    currentBox.textContent = focus.description
    choose.hidden = false
    form.hidden = true
    return
  }

  if (focus.active) {
    currentBox.textContent = focus.description
    choose.hidden = false
    form.hidden = true
    return
  }

  showForm('چیکار می‌کنی؟')
}

refresh()

description.addEventListener('input', renderPicks)

picks.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-kind]')
  if (!button) return
  try {
    const title = button.dataset.title
    const id = Number(button.dataset.id)
    if (button.dataset.kind === 'task') {
      await startFocus({ description: title, taskId: id })
      return
    }
    await startFocus({ description: title, problemId: id })
  } catch (error) {
    show(false, error.message)
  }
})

document.getElementById('continueBtn').addEventListener('click', async () => {
  try {
    const ping = await loadPingMinutes()
    const response = await fetch(`${API}/api/focus/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes: Number(minutes.value) || ping, source }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'ثبت نشد')
    show(true, 'همان کار ثبت شد')
    window.setTimeout(() => window.close(), 500)
  } catch (error) {
    show(false, error.message)
  }
})

document.getElementById('finishBtn').addEventListener('click', async () => {
  try {
    const ping = await loadPingMinutes()
    const response = await fetch(`${API}/api/focus/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes: Number(minutes.value) || ping, source }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'ثبت نشد')
    show(true, 'کار قبلی تمام شد')
    description.value = ''
    showForm('کار بعدی چیست؟')
  } catch (error) {
    show(false, error.message)
  }
})

document.getElementById('newBtn').addEventListener('click', () => {
  showForm('کار یا مسئله دیگر')
})

document.getElementById('save').addEventListener('click', async () => {
  try {
    await startFocus({ description: description.value.trim() })
  } catch (error) {
    show(false, error.message)
  }
})

async function createFromInput(kind) {
  const title = description.value.trim()
  if (!title) {
    show(false, kind === 'task' ? 'عنوان کار را بنویس' : 'عنوان مسئله را بنویس')
    return
  }
  const path = kind === 'task' ? '/api/tasks' : '/api/problems'
  const body = kind === 'task' ? { title, energyType: 'Light' } : { title }
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'ثبت نشد')
  if (kind === 'task') {
    await startFocus({ description: data.title, taskId: data.id })
    return
  }
  await startFocus({ description: data.title, problemId: data.id })
}

document.getElementById('addTask').addEventListener('click', async () => {
  try {
    await createFromInput('task')
  } catch (error) {
    show(false, error.message)
  }
})

document.getElementById('addProblem').addEventListener('click', async () => {
  try {
    await createFromInput('problem')
  } catch (error) {
    show(false, error.message)
  }
})

document.getElementById('away').addEventListener('click', () => window.close())

document.getElementById('jiraStart').addEventListener('click', async () => {
  try {
    await startJira({ finishPrevious: jiraMode !== 'start' && jiraMode !== 'create', markPreviousDone: false })
  } catch (error) {
    show(false, error.message)
  }
})

document.getElementById('jiraKeep').addEventListener('click', () => window.close())

document.getElementById('jiraLater').addEventListener('click', () => window.close())

pauseButton.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['paused'])
  await chrome.storage.local.set({ paused: !stored.paused })
  await refresh()
})

document.getElementById('test').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'test-ping' })
  show(true, 'نوتیف باید روی ویندوز آمده باشد')
})
