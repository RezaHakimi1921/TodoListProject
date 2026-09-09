const ALARM = 'taskos-worklog'
const SYNC = 'taskos-settings-sync'
const DWELL_ALARM = 'taskos-jira-dwell'
const BEAT_ALARM = 'taskos-jira-beat'
const SCAN_ALARM = 'taskos-jira-scan'
const NOTE_ID = 'taskos-ping'
const JIRA_NOTE = 'taskos-jira'
const API = 'http://127.0.0.1:5088'
const DEFAULT_PING = 10
const JIRA_HOST = 'jira.smartx.ir'
const DWELL_MS = 30 * 1000
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

function isProductSupport(key) {
  return /^PS-\d+$/i.test(String(key || ''))
}

function isTaskOsUrl(url) {
  try {
    const parsed = new URL(url)
    return (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
      && (parsed.port === '5173' || parsed.port === '5088' || parsed.port === '')
  } catch {
    return false
  }
}

async function assignPsToMe(key) {
  if (!isProductSupport(key)) return
  try {
    await fetch(`https://${JIRA_HOST}/rest/api/2/issue/${encodeURIComponent(key)}/assignee`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'reza' }),
    })
  } catch {
    /* Jira session missing or no permission */
  }
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

function isJunkJiraTitle(text, key) {
  const value = String(text || '').trim()
  if (!value || value.toUpperCase() === key) return true
  if (/jira\.smartx\.ir/i.test(value) || /^https?:/i.test(value) || value.includes('://')) return true
  return /^(service management|product support|task|bug|story|epic|sub-task|subtask|incident|change|problem|support request)$/i.test(value)
}

function cleanJiraTitle(title, key) {
  let text = String(title || '')
  text = text.replace(/\s*[-|]\s*Jira.*$/i, '')
  text = text.replace(/\s*[-|]\s*Service project.*$/i, '')
  text = text.replace(/\s*[-|]\s*پرتال.*$/i, '')
  text = text.replace(new RegExp(`^${key}\\s*[-:]?\\s*`, 'i'), '')
  text = text.replace(new RegExp(`\\s*[-–:]\\s*${key}$`, 'i'), '')
  text = text.trim()
  if (isJunkJiraTitle(text, key)) return key
  return text
}

async function fetchJiraSummary(key) {
  try {
    const response = await fetch(`https://${JIRA_HOST}/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary`, {
      credentials: 'include',
    })
    if (!response.ok) return null
    const data = await response.json()
    const summary = cleanJiraTitle(data?.fields?.summary, key)
    return isJunkJiraTitle(summary, key) ? null : summary
  } catch {
    return null
  }
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

async function readWatch() {
  const stored = await chrome.storage.local.get(['jiraWatch'])
  return stored.jiraWatch || null
}

async function writeWatch(watch) {
  if (!watch) {
    await chrome.storage.local.remove('jiraWatch')
    return
  }
  await chrome.storage.local.set({ jiraWatch: watch })
}

async function heartbeatWatch(watch) {
  if (!watch?.key || !isProductSupport(watch.key)) return
  try {
    await fetch(`${API}/api/jira/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jiraKey: watch.key,
        jiraUrl: watch.url,
        title: watch.title,
        sinceUnixMs: Number(watch.since) || Date.now(),
      }),
    })
  } catch {
    /* API down */
  }
}

async function clearWatchAndApi(key) {
  await writeWatch(null)
  await chrome.alarms.clear(DWELL_ALARM)
  await chrome.alarms.clear(BEAT_ALARM)
  try {
    const query = key ? `?key=${encodeURIComponent(key)}` : ''
    await fetch(`${API}/api/jira/watch${query}`, { method: 'DELETE' })
  } catch {
    /* API down */
  }
}

async function armWatchAlarms(watch) {
  const since = Number(watch.since) || Date.now()
  const remaining = Math.max(500, DWELL_MS - (Date.now() - since))
  await chrome.alarms.create(DWELL_ALARM, { when: Date.now() + remaining })
  await chrome.alarms.create(BEAT_ALARM, { when: Date.now() + 2000 })
}

async function getActiveTab() {
  const focused = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (focused[0]) return focused[0]
  const current = await chrome.tabs.query({ active: true, currentWindow: true })
  return current[0] || null
}

function tabKey(tab) {
  return tab?.url ? extractJiraKey(tab.url) : null
}

async function jiraTabHasKey(key) {
  const tabs = await chrome.tabs.query({ url: `https://${JIRA_HOST}/*` })
  return tabs.some((tab) => extractJiraKey(tab.url) === key)
}

async function stillOnKey(key) {
  const tab = await getActiveTab()
  return Boolean(tab && tabKey(tab) === key)
}

async function stillWatching(key) {
  if (await stillOnKey(key)) return true
  if (await jiraTabHasKey(key)) return true
  const tab = await getActiveTab()
  const watch = await readWatch()
  if (tab?.url && isJiraHost(tab.url) && !extractJiraKey(tab.url) && watch && Number(watch.tabId) === tab.id) {
    return true
  }
  return false
}

async function findTaskByJiraKey(key) {
  try {
    const response = await fetch(`${API}/api/tasks?q=${encodeURIComponent(key)}`)
    if (!response.ok) return null
    const rows = await response.json()
    const upper = String(key).toUpperCase()
    return (Array.isArray(rows) ? rows : []).find((row) => {
      const rowKey = String(row.jiraKey || '').toUpperCase()
      const title = String(row.title || '').toUpperCase()
      return rowKey === upper || title.includes(upper)
    }) || null
  } catch {
    return null
  }
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
  void scheduleJiraCheckAsync(tab)
}

async function scheduleJiraCheckAsync(tab) {
  if (!tab?.id || !tab.url) return
  if (isTaskOsUrl(tab.url)) {
    const watch = await readWatch()
    if (watch?.key && await jiraTabHasKey(watch.key)) {
      await heartbeatWatch(watch)
      await armWatchAlarms(watch)
    }
    return
  }

  const key = extractJiraKey(tab.url)
  if (!key) {
    if (isJiraHost(tab.url) || isTaskOsUrl(tab.url)) {
      const keep = await readWatch()
      if (keep?.key) {
        await heartbeatWatch(keep)
        await armWatchAlarms(keep)
      }
      return
    }
    const watch = await readWatch()
    if (watch) await clearWatchAndApi(watch.key)
    clearPending(tab.id)
    return
  }

  if (!isProductSupport(key)) {
    const watch = await readWatch()
    if (watch) await clearWatchAndApi(watch.key)
    clearPending(tab.id)
    return
  }

  const title = cleanJiraTitle(tab.title, key)
  const now = Date.now()
  const watch = await readWatch()
  const since = watch && watch.key === key && Number(watch.since) > 0 ? Number(watch.since) : now
  const next = { key, since, url: tab.url, title, tabId: tab.id }
  if (!watch || watch.key !== key || watch.url !== tab.url || watch.title !== title || watch.tabId !== tab.id) {
    await writeWatch(next)
  }
  await heartbeatWatch(next)
  await armWatchAlarms(next)

  const remaining = Math.max(0, DWELL_MS - (now - since))
  const existing = pending.get(tab.id)
  if (existing && existing.key === key) {
    existing.url = tab.url
    existing.title = title
    return
  }
  clearPending(tab.id)
  const payload = { key, url: tab.url, title }
  const timer = setTimeout(() => {
    pending.delete(tab.id)
    void handleJiraDwell(payload)
  }, remaining)
  pending.set(tab.id, { ...payload, timer })
}

async function handleJiraDwell(payload) {
  if (!isProductSupport(payload.key)) return
  if (!(await stillWatching(payload.key))) {
    return
  }

  const watch = await readWatch()
  if (!watch || watch.key !== payload.key) return
  const elapsed = Date.now() - Number(watch.since || 0)
  if (elapsed < DWELL_MS) {
    await armWatchAlarms(watch)
    return
  }

  void assignPsToMe(payload.key)
  let title = cleanJiraTitle(payload.title, payload.key)
  if (isJunkJiraTitle(title, payload.key)) {
    title = (await fetchJiraSummary(payload.key)) || title
  }
  await writeWatch({ ...watch, title })
  await heartbeatWatch({ ...watch, title })
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

async function scanOpenPsTickets() {
  const watch = await readWatch()
  const tabs = await chrome.tabs.query({ url: `https://${JIRA_HOST}/*` })
  if (watch?.key) {
    if (tabs.some((tab) => extractJiraKey(tab.url) === watch.key) || await stillOnKey(watch.key)) {
      await heartbeatWatch(watch)
      await armWatchAlarms(watch)
    }
    return
  }
  const focused = await getActiveTab()
  if (focused && isProductSupport(tabKey(focused))) scheduleJiraCheck(focused)
}

function boot() {
  void ensureAlarm()
  void ensureSyncAlarm()
  void chrome.alarms.create(SCAN_ALARM, { periodInMinutes: 1 })
  void scanOpenPsTickets()
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
  if (alarm.name === SCAN_ALARM) {
    await scanOpenPsTickets()
    return
  }
  if (alarm.name === BEAT_ALARM) {
    const watch = await readWatch()
    if (!watch?.key) return
    if (!(await stillWatching(watch.key))) {
      await clearWatchAndApi(watch.key)
      return
    }
    await heartbeatWatch(watch)
    await chrome.alarms.create(BEAT_ALARM, { when: Date.now() + 2000 })
    return
  }
  if (alarm.name === DWELL_ALARM) {
    const watch = await readWatch()
    if (!watch?.key) return
    await handleJiraDwell({
      key: watch.key,
      url: watch.url,
      title: watch.title,
    })
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
    const tab = await chrome.tabs.get(tabId)
    const key = tabKey(tab)
    const watch = await readWatch()
    if (isTaskOsUrl(tab.url || '')) {
      scheduleJiraCheck(tab)
      return
    }
    if (watch && key && watch.key !== key) {
      scheduleJiraCheck(tab)
      return
    }
    if (watch && !key && !isJiraHost(tab.url || '') && !isTaskOsUrl(tab.url || '')) {
      await clearWatchAndApi(watch.key)
      return
    }
    scheduleJiraCheck(tab)
  } catch {
    /* tab gone */
  }
})

chrome.tabs.onRemoved.addListener(async () => {
  const watch = await readWatch()
  if (!watch?.key) return
  if (await jiraTabHasKey(watch.key)) return
  await clearWatchAndApi(watch.key)
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
