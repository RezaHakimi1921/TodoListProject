import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coffee, ExternalLink, Play, Utensils } from 'lucide-react'
import { endRest, getFocus, JIRA_DWELL_MS, startRest, type JiraSwitchPending } from '../api/focus'
import { getTask } from '../api/tasks'
import { taskJiraKey, taskJiraUrl } from '../lib/jira'

const REST_KINDS = [
  { title: 'استراحت', icon: Coffee },
  { title: 'چای / قهوه', icon: Coffee },
  { title: 'ناهار / غذا', icon: Utensils },
] as const

type PendingView =
  | { kind: 'switch'; title: string; remainingSeconds: number; jiraKey: string }
  | { kind: 'closed'; jiraKey: string }

function useStickyPending(incoming: JiraSwitchPending | null, currentTaskId: number | null): PendingView | null {
  const held = useRef<JiraSwitchPending | null>(null)
  const [closed, setClosed] = useState<string | null>(null)
  const [, tick] = useState(0)
  const incomingKey = incoming?.jiraKey ?? null

  if (incoming) {
    const prev = held.current
    if (!prev || prev.jiraKey !== incoming.jiraKey) {
      held.current = incoming
    } else {
      const since = Math.min(prev.sinceUnixMs || Infinity, incoming.sinceUnixMs || Infinity)
      held.current = {
        ...incoming,
        sinceUnixMs: Number.isFinite(since) ? since : incoming.sinceUnixMs,
        title: incoming.title || prev.title,
      }
    }
  }

  useEffect(() => {
    if (incomingKey) {
      setClosed(null)
      return
    }
    const prev = held.current
    if (!prev) return
    held.current = null
    if (prev.taskId && prev.taskId === currentTaskId) return
    setClosed(prev.jiraKey)
    const id = window.setTimeout(() => setClosed(null), 2800)
    return () => window.clearTimeout(id)
  }, [incomingKey, currentTaskId])

  useEffect(() => {
    const id = window.setInterval(() => tick((value) => value + 1), 250)
    return () => window.clearInterval(id)
  }, [])

  if (closed) return { kind: 'closed', jiraKey: closed }
  const current = held.current
  if (!current || !incomingKey) return null
  const remaining = Math.max(0, Math.ceil((JIRA_DWELL_MS - (Date.now() - current.sinceUnixMs)) / 1000))
  return { kind: 'switch', title: current.title, remainingSeconds: remaining, jiraKey: current.jiraKey }
}

export function NowWorkingBanner() {
  const queryClient = useQueryClient()
  const focusQuery = useQuery({
    queryKey: ['focus'],
    queryFn: getFocus,
    refetchInterval: 1000,
  })
  const focus = focusQuery.data
  const pending = useStickyPending(focus?.pendingSwitch ?? null, focus?.taskId ?? null)
  const taskQuery = useQuery({
    queryKey: ['task', focus?.taskId],
    queryFn: () => getTask(Number(focus?.taskId)),
    enabled: Number.isFinite(focus?.taskId) && !focus?.isResting,
  })
  const restMutation = useMutation({
    mutationFn: (title: string) => startRest(title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
  const endRestMutation = useMutation({
    mutationFn: () => endRest(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
  const active = Boolean(focus?.active && focus.description)
  const resting = Boolean(focus?.isResting)
  const task = taskQuery.data
  const jiraUrl = task ? taskJiraUrl(task) : null
  const jiraKey = task ? taskJiraKey(task) : null

  if (resting) {
    return (
      <section className="rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3.5">
        <p className="text-[10px] font-semibold tracking-wide text-sky-300/90 mb-1">داری استراحت می‌کنی</p>
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-sky-300 shrink-0" />
          <p className="text-base sm:text-lg font-bold text-white leading-snug break-words">
            {focus?.description || 'استراحت'}
          </p>
        </div>
        {pending ? <PendingSwitchLine pending={pending} /> : null}
        <button
          type="button"
          disabled={endRestMutation.isPending}
          onClick={() => endRestMutation.mutate()}
          className="mt-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold px-3 py-1.5"
        >
          برگشتم به کار
        </button>
      </section>
    )
  }

  if (!active) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#10131b] px-4 py-3.5">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 mb-1">الان روی این کار هستی</p>
        <p className="text-sm text-slate-400">هنوز تمرکزی شروع نشده.</p>
        {pending ? <PendingSwitchLine pending={pending} /> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {REST_KINDS.map((item) => (
            <button
              key={item.title}
              type="button"
              disabled={restMutation.isPending}
              onClick={() => restMutation.mutate(item.title)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-sky-400/40 hover:text-white"
            >
              {item.title}
            </button>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3.5 shadow-lg shadow-amber-900/10">
      <p className="text-[10px] font-semibold tracking-wide text-amber-300/90 mb-1">الان روی این کار هستی</p>
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4 text-amber-300 shrink-0 fill-amber-300" />
        <p className="text-base sm:text-lg font-bold text-white leading-snug break-words">
          {task?.title || focus!.description}
        </p>
      </div>
      {pending ? <PendingSwitchLine pending={pending} /> : null}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {focus?.taskId ? (
          <Link to={`/tasks/${focus.taskId}`} className="text-[11px] text-amber-200/80 hover:text-amber-100">باز کردن همین کار</Link>
        ) : null}
        {jiraUrl ? (
          <a href={jiraUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-200 hover:text-white">
            <ExternalLink className="w-3 h-3" />
            {jiraKey}
          </a>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {REST_KINDS.map((item) => (
          <button
            key={item.title}
            type="button"
            disabled={restMutation.isPending}
            onClick={() => restMutation.mutate(item.title)}
            className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-sky-400/40 hover:text-white"
          >
            {item.title}
          </button>
        ))}
      </div>
    </section>
  )
}

function PendingSwitchLine({ pending }: { pending: PendingView }) {
  if (pending.kind === 'closed') {
    return (
      <p className="mt-2 text-[12px] leading-relaxed text-slate-400 transition-opacity duration-700">
        تسک جیرا بسته شد
        <span className="ms-1 text-[10px] text-slate-500">{pending.jiraKey}</span>
      </p>
    )
  }

  const seconds = pending.remainingSeconds
  return (
    <p className="mt-2 text-[12px] leading-relaxed text-amber-100/90">
      {seconds > 0 ? `${seconds} ثانیه دیگه به «${pending.title}» منتقل می‌شی` : `الان به «${pending.title}» منتقل می‌شی`}
      <span className="ms-1 text-[10px] text-amber-200/60">{pending.jiraKey}</span>
    </p>
  )
}
