export type Theme = 'dark' | 'light'

const KEY = 'taskos-theme'
const listeners = new Set<() => void>()

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return window.localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#efe8d8' : '#0d0f14')
}

export function setTheme(theme: Theme) {
  window.localStorage.setItem(KEY, theme)
  applyTheme(theme)
  listeners.forEach((listener) => listener())
}

export function toggleTheme() {
  setTheme(getTheme() === 'light' ? 'dark' : 'light')
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  applyTheme(getTheme())
}
