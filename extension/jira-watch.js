const KEY_IN_URL = /[A-Z][A-Z0-9]+-\d+/gi
let lastSent = ''

function extractKey(url) {
  const matches = String(url).match(KEY_IN_URL)
  return matches?.length ? matches[matches.length - 1].toUpperCase() : null
}

function isProductSupport(key) {
  return /^PS-\d+$/i.test(String(key || ''))
}

function cleanTitle(text, key) {
  let value = String(text || '').replace(/\s+/g, ' ').trim()
  value = value.replace(/\s*[-|]\s*Jira.*$/i, '')
  value = value.replace(/\s*[-|]\s*پرتال.*$/i, '')
  value = value.replace(new RegExp('^' + key + '\\s*[-–:]?\\s*', 'i'), '')
  value = value.replace(new RegExp('\\s*[-–:]\\s*' + key + '$', 'i'), '')
  value = value.trim()
  if (/jira\.smartx\.ir/i.test(value) || /^https?:/i.test(value) || value.includes('://')) return ''
  return value
}

function readPageTitle(key) {
  const selectors = [
    '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
    '[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
    '[data-testid="request-title"]',
    '[data-test-id="request-title"]',
    '#summary-val',
    '.issue-header-content h1',
    'h1',
  ]
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector)
    for (const node of nodes) {
      const text = cleanTitle(node.textContent, key)
      if (text.length >= 8 && text.toUpperCase() !== key) return text
    }
  }
  return cleanTitle(document.title, key) || key
}

function report(force) {
  const url = location.href
  const key = extractKey(url)
  if (!key || !isProductSupport(key)) {
    lastSent = url
    return
  }
  const title = readPageTitle(key)
  const stamp = `${key}|${url}|${title}`
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

new MutationObserver(() => report(false)).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
})
