const ALARM = 'taskos-worklog'
const SYNC = 'taskos-settings-sync'
const NOTE_ID = 'taskos-ping'
const API = 'http://127.0.0.1:5088'
const DEFAULT_PING = 10

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
    height: 640,
    focused: true,
  })
}

async function showPing() {
  const stored = await chrome.storage.local.get(['paused'])
  if (stored.paused) return

  const minutes = await getPingMinutes()
  const focus = await getFocus()
  const active = Boolean(focus?.active && focus.description)
  const message = active ? `هنوز «${focus.description}»؟` : `${minutes} دقیقه گذشت. چیکار کردی؟`
  const buttons = active
    ? [{ title: 'همان کار قبلی' }, { title: 'تمام شد / عوض شد' }]
    : [{ title: 'ثبت کار' }, { title: 'استراحت بود' }]

  await chrome.notifications.create(NOTE_ID, {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'TaskOS',
    message,
    contextMessage: 'Work Log',
    buttons,
    requireInteraction: true,
    priority: 2,
    silent: false,
  })
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

chrome.runtime.onMessage.addListener((message) => {
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

chrome.notifications.onClicked.addListener((id) => {
  if (id !== NOTE_ID) return
  void openPopup('?source=Timer')
})

chrome.notifications.onButtonClicked.addListener(async (id, index) => {
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
