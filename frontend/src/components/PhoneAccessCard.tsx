import { useEffect, useState } from 'react'
import { Bell, Bookmark, Copy, ExternalLink, Smartphone } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getAuthMe, updateMyNtfyTopic } from '../api/auth'
import { sendTestPhonePush } from '../lib/phonePush'

type PhoneNotify = { ntfyTopic?: string; ntfyUrl?: string; phoneBaseUrl?: string }
type LanInfo = { urls?: string[]; stable?: string; host?: string }

const FALLBACK_STABLE = 'http://reza.local:5173'

export function PhoneAccessCard() {
  const queryClient = useQueryClient()
  const [urls, setUrls] = useState<string[]>([])
  const [stable, setStable] = useState(FALLBACK_STABLE)
  const [copied, setCopied] = useState('')
  const [topic, setTopic] = useState('')
  const [ntfyUrl, setNtfyUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: getAuthMe })

  useEffect(() => {
    void fetch('/__lan')
      .then((res) => (res.ok ? res.json() : { urls: [] }))
      .then((data: LanInfo) => {
        const stableUrl = data.stable || FALLBACK_STABLE
        setStable(stableUrl)
        const list = rankLanUrls(Array.isArray(data.urls) ? data.urls : []).filter((url) => !url.includes('.local'))
        const here = window.location.origin
        if (
          here &&
          !here.includes('127.0.0.1') &&
          !here.includes('localhost') &&
          !here.includes('.local') &&
          !list.includes(here)
        ) {
          list.unshift(here)
        }
        setUrls(list)
      })
      .catch(() => {
        const here = window.location.origin
        setStable(FALLBACK_STABLE)
        setUrls(here.includes('127.0.0.1') || here.includes('localhost') ? [] : [here])
      })
  }, [])

  useEffect(() => {
    const mine = meQuery.data?.ntfyTopic?.trim()
    if (mine) {
      setTopic(mine)
      setNtfyUrl(`https://ntfy.sh/${mine}`)
      return
    }
    // Ensure this user gets a private topic (not the shared global one).
    void updateMyNtfyTopic('')
      .then((row) => {
        setTopic(row.ntfyTopic ?? '')
        setNtfyUrl(row.ntfyUrl ?? '')
        void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      })
      .catch(() => undefined)
  }, [meQuery.data?.ntfyTopic, queryClient])

  useEffect(() => {
    const base = urls[0]
    if (!base) return
    void api
      .put<PhoneNotify>('/api/push/phone', { phoneBaseUrl: base })
      .catch(() => undefined)
  }, [urls])

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value).catch(() => undefined)
    setCopied(value)
    window.setTimeout(() => setCopied(''), 1500)
  }

  const test = async () => {
    setBusy(true)
    setMessage('')
    try {
      if (!topic) {
        const row = await updateMyNtfyTopic('')
        setTopic(row.ntfyTopic)
        setNtfyUrl(row.ntfyUrl)
      }
      const result = await sendTestPhonePush()
      setMessage(
        (result?.sent ?? 0) > 0
          ? 'تست رفت. همه گوشی‌هایی که همین موضوع را Subscribe کرده‌اند باید نوتیف بگیرند.'
          : 'اگر چیزی ندیدی، در اپ ntfy دقیقاً همین موضوع را Subscribe کن.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تست ارسال نشد.')
    } finally {
      setBusy(false)
    }
  }

  const primaryIp = urls[0]

  return (
    <div id="phone" className="p-3.5 rounded-2xl bg-[#0f121a] border border-slate-800 space-y-2">
      <span className="font-bold text-slate-100 flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
        آیفون و ntfy اختصاصی تو
      </span>
      <p className="text-slate-400 text-[11px] leading-relaxed">
        هر کاربر موضوع ntfy خودش را دارد. سه گوشی تو باید همه روی همین موضوع Subscribe شوند تا رمز موقت فقط به تو برسد، نه کاربر دیگر.
      </p>

      <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-2.5 space-y-1.5">
        <p className="text-[11px] font-bold text-amber-100 inline-flex items-center gap-1.5">
          <Bookmark className="h-3.5 w-3.5" />
          آدرس ثابت (بوکمارک همین)
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-2 py-1 font-mono text-[11px] text-amber-100">{stable}</code>
          <button type="button" onClick={() => void copy(stable)} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/[0.04]">
            {copied === stable ? 'کپی شد' : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {primaryIp ? (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-slate-500">IP فعلی (پشتیبان)</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-2 py-1 font-mono text-[11px] text-sky-200">{primaryIp}</code>
            <button type="button" onClick={() => void copy(primaryIp)} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/[0.04]">
              {copied === primaryIp ? 'کپی شد' : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-2.5 space-y-1.5">
        <p className="text-[11px] font-bold text-violet-100">موضوع ntfy فقط برای حساب تو</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          در اپ ntfy روی هر سه گوشی، همین موضوع را Subscribe کن. بازیابی رمز فقط به این موضوع می‌رود.
        </p>
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
            <a href={ntfyUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-1 text-slate-300 hover:text-white">
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
          ارسال تست به گوشی‌های من
        </button>
      </div>
      {message ? <p className="text-[11px] text-amber-100">{message}</p> : null}
    </div>
  )
}

function rankLanUrls(urls: string[]) {
  const score = (url: string) => {
    if (url.includes('reza.local') || url.includes('taskos.local')) return -1
    if (url.includes('192.168.140.') || url.includes('192.168.40.')) return 0
    if (url.includes('192.168.1.') || url.includes('192.168.0.')) return 1
    if (url.includes('192.168.56.') || url.includes('192.168.239.') || url.includes('192.168.85.') || url.includes('169.254.')) return 8
    return 4
  }
  return [...urls].sort((a, b) => score(a) - score(b))
}
