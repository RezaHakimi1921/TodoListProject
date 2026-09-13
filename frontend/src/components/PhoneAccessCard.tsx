import { useEffect, useState } from 'react'
import { Bell, Copy, ExternalLink, Smartphone } from 'lucide-react'
import { api } from '../api/client'
import { sendTestPhonePush } from '../lib/phonePush'

type PhoneNotify = { ntfyTopic?: string; ntfyUrl?: string; phoneBaseUrl?: string }

export function PhoneAccessCard() {
  const [urls, setUrls] = useState<string[]>([])
  const [copied, setCopied] = useState('')
  const [topic, setTopic] = useState('')
  const [ntfyUrl, setNtfyUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void fetch('/__lan')
      .then((res) => (res.ok ? res.json() : { urls: [] }))
      .then((data: { urls?: string[] }) => {
        const list = rankLanUrls(Array.isArray(data.urls) ? data.urls : [])
        const here = window.location.origin
        if (here && !here.includes('127.0.0.1') && !here.includes('localhost') && !list.includes(here)) {
          list.unshift(here)
        }
        setUrls(list)
      })
      .catch(() => {
        const here = window.location.origin
        setUrls(here.includes('127.0.0.1') || here.includes('localhost') ? [] : [here])
      })
  }, [])

  useEffect(() => {
    void api.get<PhoneNotify>('/api/push/phone')
      .then((row) => {
        setTopic(row.ntfyTopic ?? '')
        setNtfyUrl(row.ntfyUrl ?? '')
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const here = window.location.origin
    const base =
      here && !here.includes('127.0.0.1') && !here.includes('localhost')
        ? here
        : urls[0]
    if (!base) return
    void api
      .put<PhoneNotify>('/api/push/phone', { phoneBaseUrl: base, ntfyTopic: topic || undefined })
      .then((row) => {
        if (row.ntfyTopic) setTopic(row.ntfyTopic)
      })
      .catch(() => undefined)
  }, [urls, topic])

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value).catch(() => undefined)
    setCopied(value)
    window.setTimeout(() => setCopied(''), 1500)
  }

  const test = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await sendTestPhonePush()
      setMessage(
        (result?.sent ?? 0) > 0
          ? 'تست رفت. روی نوتیف آیفون بزن؛ باید TaskOS در سافاری باز شود.'
          : 'ویندوز ارسال شد. اگر آیفون چیزی ندید، اول اپ ntfy را روی همین موضوع Subscribe کن.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تست ارسال نشد.')
    } finally {
      setBusy(false)
    }
  }

  const primary = urls[0]

  return (
    <div id="phone" className="p-3.5 rounded-2xl bg-[#0f121a] border border-slate-800 space-y-2">
      <span className="font-bold text-slate-100 flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
        آیفون و شبکه محلی
      </span>
      <p className="text-slate-400 text-[11px] leading-relaxed">
        Safari روی آیفون گواهی HTTPS محلی را باز نمی‌کند و Web Push هم دامنهٔ عمومی می‌خواهد.
        برنامه را با HTTP همین یک پورت باز کن؛ نوتیف قفل‌صفحه از ntfy می‌آید. ضربه روی نوتیف Safari را روی همان تسک TaskOS باز می‌کند.
      </p>
      {primary ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-2 py-1 font-mono text-[11px] text-sky-200">
            {primary}
          </code>
          <button
            type="button"
            onClick={() => void copy(primary)}
            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/[0.04]"
          >
            {copied === primary ? 'کپی شد' : <Copy className="h-3 w-3" />}
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-amber-200">آدرس شبکه هنوز آماده نیست. TaskOS UI را دوباره اجرا کن.</p>
      )}
      {urls.length > 1 ? (
        <p className="text-[10px] text-slate-500">
          اگر این IP باز نشد، بقیه کارت‌های شبکه:{' '}
          {urls.slice(1).join(' · ')}
        </p>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-1.5">
        <p className="text-[11px] font-bold text-slate-200">نوتیف آیفون با ntfy</p>
        <ol className="text-[11px] text-slate-400 leading-relaxed list-decimal pr-4 space-y-1">
          <li>
            از اپ‌استور{' '}
            <a
              href="https://apps.apple.com/app/ntfy/id1625396347"
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline"
            >
              ntfy
            </a>{' '}
            را نصب کن.
          </li>
          <li>داخل اپ، Subscribe را بزن و دقیقاً همین موضوع را وارد کن:</li>
        </ol>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-2 py-1 font-mono text-[11px] text-amber-200">
            {topic || 'در حال ساخت موضوع…'}
          </code>
          <button
            type="button"
            disabled={!topic}
            onClick={() => void copy(topic)}
            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/[0.04] disabled:opacity-40"
          >
            {copied === topic ? 'کپی شد' : <Copy className="h-3 w-3" />}
          </button>
          {ntfyUrl ? (
            <a
              href={ntfyUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 p-1 text-slate-300 hover:text-white"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy || !topic}
          onClick={() => void test()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 disabled:opacity-40"
        >
          <Bell className="h-3.5 w-3.5" />
          ارسال تست به آیفون
        </button>
      </div>
      {message ? <p className="text-[11px] text-amber-100">{message}</p> : null}
    </div>
  )
}

function rankLanUrls(urls: string[]) {
  const score = (url: string) => {
    if (url.includes('192.168.40.')) return 0
    if (url.includes('192.168.1.') || url.includes('192.168.0.')) return 1
    if (url.includes('192.168.56.') || url.includes('192.168.239.') || url.includes('192.168.85.')) return 8
    return 4
  }
  return [...urls].sort((a, b) => score(a) - score(b))
}
