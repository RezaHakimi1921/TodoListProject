self.addEventListener('push', (event) => {
  let payload = { title: 'TaskOS', body: '', url: '/notifications' }
  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) }
  } catch {
    payload.body = event.data ? event.data.text() : ''
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'TaskOS', {
      body: payload.body || 'یک اعلان جدید',
      data: { url: payload.url || '/notifications' },
      badge: '/favicon.svg',
      icon: '/favicon.svg',
      lang: 'fa',
      dir: 'rtl',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.url || '/notifications'
  const target = path.startsWith('http') ? path : self.location.origin + path
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
