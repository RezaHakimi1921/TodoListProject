const KEY_IN_URL = /[A-Z][A-Z0-9]+-\d+/gi
let lastSent = ''

function extractKey(url) {
  try {
    const parsed = new URL(url || location.href)
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''))
    const selected = parsed.searchParams.get('selectedIssue')
      || hashParams.get('selectedIssue')
      || parsed.searchParams.get('issueKey')
      || parsed.searchParams.get('createdIssueKey')
      || hashParams.get('issueKey')
    if (selected && /^[A-Z][A-Z0-9]+-\d+$/i.test(selected)) return selected.toUpperCase()
    const path = parsed.pathname.match(/\/(?:browse|issues)\/([A-Z][A-Z0-9]+-\d+)/i)
    if (path) return path[1].toUpperCase()
    const desk = parsed.pathname.match(/\/servicedesk\/customer\/portal\/\d+\/([A-Z][A-Z0-9]+-\d+)/i)
    if (desk) return desk[1].toUpperCase()
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="ajs-issue-key"]')?.getAttribute('content')
  if (meta && /^[A-Z][A-Z0-9]+-\d+$/i.test(meta)) return meta.toUpperCase()
  const marked = document.querySelector('[data-issue-key], #key-val')
  const markedKey = marked?.getAttribute('data-issue-key') || marked?.textContent
  if (markedKey && /^[A-Z][A-Z0-9]+-\d+$/i.test(markedKey.trim())) return markedKey.trim().toUpperCase()
  const matches = String(url || location.href).match(KEY_IN_URL)
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
setInterval(() => report(false), 2000)

new MutationObserver(() => report(false)).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
})
