import { api } from '../api/client'

function toBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
}

export function canUsePhonePush() {
  return (
    typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && (window.isSecureContext || location.hostname === 'localhost')
  )
}

export async function registerPhonePushWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function enablePhonePush() {
  if (!canUsePhonePush()) {
    throw new Error('پوش گوشی فقط روی آدرس HTTPS یا بعد از نصب روی صفحهٔ اصلی کار می‌کند.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('اجازهٔ نوتیفیکیشن داده نشد.')
  }
  const registration = (await navigator.serviceWorker.ready) || (await registerPhonePushWorker())
  if (!registration) throw new Error('Service Worker ثبت نشد.')
  const { publicKey } = await api.get<{ publicKey: string }>('/api/push/vapid')
  if (!publicKey) throw new Error('کلید پوش از API نیامد. سرویس پوش را روشن کن.')
  const existing = await registration.pushManager.getSubscription()
  let subscription = existing
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(publicKey),
    })
  }
  const json = subscription.toJSON()
  await api.post('/api/push/subscribe', {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    keys: json.keys,
  })
  return subscription.endpoint
}

export async function sendTestPhonePush() {
  return api.post<{ ok?: boolean; sent?: number }>('/api/push/test', {
    title: 'TaskOS',
    body: 'اگر این را روی آیفون در ntfy دیدی، اعلان گوشی روشن است.',
  })
}

export async function restorePhonePushIfAllowed() {
  if (!canUsePhonePush()) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  await enablePhonePush()
}
