const KEY_IN_URL = /[A-Z][A-Z0-9]+-\d+/gi
let lastSent = ''

function extractKey(url) {
  const matches = String(url).match(KEY_IN_URL)
  return matches?.length ? matches[matches.length - 1].toUpperCase() : null
}

function report(force) {
  const url = location.href
  const title = document.title || ''
  const key = extractKey(url)
  if (!key) {
    lastSent = url
    return
  }
  const stamp = `${key}|${url}`
  if (!force && stamp === lastSent) return
  lastSent = stamp
  try {
    chrome.runtime.sendMessage({ type: 'jira-url', url, title, key })
  } catch {
    /* extension reloading */
  }
}

function wrapHistory(method) {
  const original = history[method]
  history[method] = function wrapped() {
    const result = original.apply(this, arguments)
    queueMicrotask(() => report(true))
    return result
  }
}

report(true)
wrapHistory('pushState')
wrapHistory('replaceState')
window.addEventListener('popstate', () => report(true))
window.addEventListener('hashchange', () => report(true))
window.addEventListener('pageshow', () => report(true))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') report(true)
})

const titleEl = document.querySelector('title')
if (titleEl) {
  new MutationObserver(() => report(false)).observe(titleEl, { childList: true, characterData: true, subtree: true })
}
