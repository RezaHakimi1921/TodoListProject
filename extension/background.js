const ALARM = 'taskos-worklog'
const SYNC = 'taskos-settings-sync'
const NOTE_ID = 'taskos-ping'
const JIRA_NOTE = 'taskos-jira'
const API = 'http://127.0.0.1:5088'
const DEFAULT_PING = 10
const JIRA_HOST = 'jira.smartx.ir'
const DWELL_MS = 400
const DEBOUNCE_MS = 20 * 1000
const KEY_IN_URL = /[A-Z][A-Z0-9]+-\d+/gi

const pending = new Map()

function iconUrl() {
  return chrome.runtime.getURL('icon.png')
}

function clampPing(value) {
  const minutes = Number(value)
  if (!Number.isFinite(minutes)) return DEFAULT_PING
  return Math.min(180, Math.max(1, Math.round(minutes)))
}

async function getPingMinutes() {
  try {
    const response = await fetch(`${API}/api/settings`)
    if (!response.ok) return DEFAULT_PING
    const data = await response.json()
    const minutes = clampPing(data.pingMinutes)
    await chrome.storage.local.set({ pingMinutes: minutes })
    return minutes
  } catch {
    const stored = await chrome.storage.local.get(['pingMinutes'])
    return clampPing(stored.pingMinutes ?? DEFAULT_PING)
  }
}

async function ensureAlarm() {
  const minutes = await getPingMinutes()
  const existing = await chrome.alarms.get(ALARM)
  if (existing && existing.periodInMinutes === minutes) return
  await chrome.alarms.clear(ALARM)
  await chrome.alarms.create(ALARM, { delayInMinutes: minutes, periodInMinutes: minutes })
}

async function ensureSyncAlarm() {
  const existing = await chrome.alarms.get(SYNC)
  if (!existing) {
    await chrome.alarms.create(SYNC, { periodInMinutes: 1 })
  }
}

async function getFocus() {
  try {
    const response = await fetch(`${API}/api/focus`)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function openPopup(query = '') {
  return chrome.windows.create({
    url: chrome.runtime.getURL(`popup.html${query}`),
    type: 'popup',
    width: 440,
    height: 680,
    focused: true,
  })
}

async function notify(id, options) {
  try {
    await chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: iconUrl(),
      requireInteraction: true,
      priority: 2,
      silent: false,
      ...options,
    })
  } catch (error) {
    console.error('TaskOS notification failed', error)
    try {
      await chrome.notifications.create(id, {
        type: 'basic',
        iconUrl: iconUrl(),
        title: options.title || 'TaskOS',
        message: options.message || '',
      })
    } catch (fallbackError) {
      console.error('TaskOS notification fallback failed', fallbackError)
    }
  }
}

async function showPing() {
  const stored = await chrome.storage.local.get(['paused'])
  if (stored.paused) return

  try {
    const live = await fetch(`${API}/api/health`)
    if (live.ok) return
  } catch {
    /* API down — Chrome notification is the fallback */
  }

  const minutes = await getPingMinutes()
  const focus = await getFocus()
  const active = Boolean(focus?.active && focus.description)
  const message = active ? `هنوز «${focus.description}»؟` : `${minutes} دقیقه گذشت. چیکار کردی؟`
  const buttons = active
    ? [{ title: 'همان کار قبلی' }, { title: 'تمام شد / عوض شد' }]
    : [{ title: 'ثبت کار' }, { title: 'استراحت بود' }]

  await notify(NOTE_ID, {
    title: 'TaskOS',
    message,
    contextMessage: 'Work Log',
    buttons,
  })
}

function extractJiraKey(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== JIRA_HOST) return null
    const path = parsed.pathname.match(/\/(?:browse|issues)\/([A-Z][A-Z0-9]+-\d+)/i)
    if (path) return path[1].toUpperCase()
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''))
    const selected = parsed.searchParams.get('selectedIssue')
      || hashParams.get('selectedIssue')
      || parsed.searchParams.get('issueKey')
      || parsed.searchParams.get('createdIssueKey')
      || hashParams.get('issueKey')
    if (selected && /^[A-Z][A-Z0-9]+-\d+$/i.test(selected)) return selected.toUpperCase()
    const desk = parsed.pathname.match(/\/servicedesk\/customer\/portal\/\d+\/([A-Z][A-Z0-9]+-\d+)/i)
    if (desk) return desk[1].toUpperCase()
    const parts = parsed.pathname.split('/')
    for (const part of parts) {
      if (/^[A-Z][A-Z0-9]+-\d+$/i.test(part)) return part.toUpperCase()
    }
    const anywhere = String(url).match(KEY_IN_URL)
    if (anywhere?.length) return anywhere[anywhere.length - 1].toUpperCase()
    return null
  } catch {
    return null
  }
}

function cleanJiraTitle(title, key) {
  let text = String(title || '')
  text = text.replace(/\s*[-|]\s*Jira.*$/i, '')
  text = text.replace(new RegExp(`^${key}\\s*[-:]?\\s*`, 'i'), '')
  return text.trim() || key
}

function isJiraHost(url) {
  try {
    return new URL(url).hostname === JIRA_HOST
  } catch {
    return false
  }
}

function clearPending(tabId) {
  const existing = pending.get(tabId)
  if (existing?.timer) clearTimeout(existing.timer)
  pending.delete(tabId)
}

async function handleJiraHome() {
  const stored = await chrome.storage.local.get(['jiraDebounce', 'paused'])
  if (stored.paused) return
  const debounce = stored.jiraDebounce || {}
  if (debounce.__home__ && Date.now() - debounce.__home__ < DEBOUNCE_MS) return
  const focus = await getFocus()
  if (!focus?.active || !focus.description) return
  debounce.__home__ = Date.now()
  await chrome.storage.local.set({ jiraDebounce: debounce })
  await notify(NOTE_ID, {
    title: 'TaskOS',
    message: `رفتی Jira. هنوز «${focus.description}»؟`,
    contextMessage: 'Work Log',
    buttons: [{ title: 'همان کار قبلی' }, { title: 'تمام شد / عوض شد' }],
  })
}

function scheduleJiraCheck(tab) {
  if (!tab?.id || !tab.url) return
  const key = extractJiraKey(tab.url)
  if (!key) {
    if (isJiraHost(tab.url)) {
      const existing = pending.get(tab.id)
      if (existing && existing.key === '__home__') return
      clearPending(tab.id)
      const timer = setTimeout(() => {
        pending.delete(tab.id)
        void handleJiraHome()
      }, DWELL_MS)
      pending.set(tab.id, { key: '__home__', timer })
      return
    }
    clearPending(tab.id)
    return
  }
  const existing = pending.get(tab.id)
  if (existing && existing.key === key && existing.url === tab.url) return
  clearPending(tab.id)
  const payload = {
    key,
    url: tab.url,
    title: cleanJiraTitle(tab.title, key),
  }
  const timer = setTimeout(() => {
    pending.delete(tab.id)
    void handleJiraSeen(payload)
  }, DWELL_MS)
  pending.set(tab.id, { ...payload, timer })
}

async function handleJiraSeen(payload) {
  const stored = await chrome.storage.local.get(['jiraDebounce'])
  const debounce = stored.jiraDebounce || {}
  const stampId = payload.url || payload.key
  if (debounce[stampId] && Date.now() - debounce[stampId] < DEBOUNCE_MS) return

  let seen
  try {
    const response = await fetch(`${API}/api/jira/seen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jiraKey: payload.key,
        jiraUrl: payload.url,
        title: payload.title,
      }),
    })
    if (!response.ok) {
      await openPopup(jiraQuery({
        jiraKey: payload.key,
        jiraUrl: payload.url,
        title: payload.title,
        decision: 'ask-create',
      }))
      return
    }
    seen = await response.json()
  } catch {
    await openPopup(jiraQuery({
      jiraKey: payload.key,
      jiraUrl: payload.url,
      title: payload.title,
      decision: 'ask-create',
    }))
    return
  }

  debounce[stampId] = Date.now()
  await chrome.storage.local.set({ jiraDebounce: debounce, lastJira: seen })
}

function jiraQuery(seen) {
  const params = new URLSearchParams({
    jira: seen.jiraKey,
    url: seen.jiraUrl || '',
    title: seen.title || seen.jiraKey,
    mode: seen.decision === 'ask-create' ? 'create' : seen.decision === 'ask-start' ? 'start' : 'switch',
  })
  return `?${params.toString()}`
}

async function showJiraAsk(seen) {
  const focus = seen.currentFocus?.active ? seen.currentFocus.description : ''
  let message
  let buttons
  if (seen.decision === 'ask-create') {
    message = `«${seen.jiraKey}» در کارها نیست. بسازم و شروع کنم؟`
    buttons = [{ title: 'بساز و شروع کن' }, { title: 'بعداً' }]
  } else if (seen.decision === 'ask-start') {
    message = `«${seen.jiraKey}» قبلاً ثبت شده. شروع کنم؟`
    buttons = [{ title: 'این را شروع کن' }, { title: 'بعداً' }]
  } else {
    message = focus
      ? `کار قبلی «${focus}» تمام شد؟ «${seen.jiraKey}» را شروع کنم؟`
      : `«${seen.jiraKey}» را شروع کنم؟`
    buttons = [{ title: 'تمام شد، این را شروع کن' }, { title: 'هنوز قبلی' }]
  }

  await notify(JIRA_NOTE, {
    title: `TaskOS · ${seen.jiraKey}`,
    message,
    contextMessage: seen.title || seen.jiraKey,
    buttons,
  })
}

async function startJira(seen, { finishPrevious, markPreviousDone }) {
  const minutes = await getPingMinutes()
  try {
    const response = await fetch(`${API}/api/jira/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jiraKey: seen.jiraKey,
        jiraUrl: seen.jiraUrl,
        title: seen.title,
        finishPrevious,
        markPreviousDone,
        durationMinutes: minutes,
      }),
    })
    if (!response.ok) {
      await openPopup(jiraQuery(seen))
      return
    }
    await chrome.notifications.clear(JIRA_NOTE)
  } catch {
    await openPopup(jiraQuery(seen))
  }
}

function watchTab(tabId, changeInfo, tab) {
  const target = tab || changeInfo
  if (changeInfo?.url || changeInfo?.status === 'complete' || target?.url) {
    void chrome.tabs.get(tabId).then(scheduleJiraCheck).catch(() => {})
  }
}

function boot() {
  void ensureAlarm()
  void ensureSyncAlarm()
}

chrome.runtime.onInstalled.addListener(() => {
  boot()
  void showPing()
})

chrome.runtime.onStartup.addListener(() => {
  boot()
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === 'jira-url') {
    scheduleJiraCheck({
      id: sender.tab?.id ?? 0,
      url: message.url,
      title: message.title,
    })
  }
  if (message && message.type === 'test-ping') {
    void showPing()
  }
  if (message && message.type === 'reload-settings') {
    void ensureAlarm()
  }
})

boot()

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC) {
    await ensureAlarm()
    return
  }
  if (alarm.name !== ALARM) return
  await showPing()
  await ensureAlarm()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  watchTab(tabId, changeInfo, tab)
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    scheduleJiraCheck(await chrome.tabs.get(tabId))
  } catch {
    /* tab gone */
  }
})

function watchNavigation(details) {
  if (details.frameId !== 0) return
  chrome.tabs.get(details.tabId).then(scheduleJiraCheck).catch(() => {})
}

chrome.webNavigation.onHistoryStateUpdated.addListener(watchNavigation, { url: [{ hostEquals: JIRA_HOST }] })
chrome.webNavigation.onCommitted.addListener(watchNavigation, { url: [{ hostEquals: JIRA_HOST }] })
chrome.webNavigation.onCompleted.addListener(watchNavigation, { url: [{ hostEquals: JIRA_HOST }] })

chrome.notifications.onClicked.addListener(async (id) => {
  if (id === JIRA_NOTE) {
    const stored = await chrome.storage.local.get(['lastJira'])
    if (stored.lastJira) {
      await openPopup(jiraQuery(stored.lastJira))
      return
    }
  }
  if (id !== NOTE_ID) return
  void openPopup('?source=Timer')
})

chrome.notifications.onButtonClicked.addListener(async (id, index) => {
  if (id === JIRA_NOTE) {
    const stored = await chrome.storage.local.get(['lastJira'])
    const seen = stored.lastJira
    if (!seen) return
    if (index === 1) {
      await chrome.notifications.clear(JIRA_NOTE)
      return
    }
    const finishPrevious = seen.decision === 'ask-switch'
    await startJira(seen, { finishPrevious, markPreviousDone: false })
    return
  }

  if (id !== NOTE_ID) return
  const minutes = await getPingMinutes()
  const focus = await getFocus()
  const active = Boolean(focus?.active && focus.description)

  if (index === 0) {
    if (active) {
      try {
        await fetch(`${API}/api/focus/tick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationMinutes: minutes, source: 'Timer' }),
        })
      } catch {
        await openPopup('?source=Timer')
        return
      }
      await chrome.notifications.clear(NOTE_ID)
      return
    }
    await openPopup('?source=Timer')
    return
  }

  if (active) {
    await openPopup('?source=Timer&mode=finish')
    return
  }
  await chrome.notifications.clear(NOTE_ID)
})
