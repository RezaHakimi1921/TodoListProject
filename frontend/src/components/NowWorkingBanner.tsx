import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coffee, ExternalLink, Play, Utensils } from 'lucide-react'
import { endRest, getFocus, startRest } from '../api/focus'
import { getTask } from '../api/tasks'
import { taskJiraKey, taskJiraUrl } from '../lib/jira'

const REST_KINDS = [
  { title: 'استراحت', icon: Coffee },
  { title: 'چای / قهوه', icon: Coffee },
  { title: 'ناهار / غذا', icon: Utensils },
] as const

export function NowWorkingBanner() {
  const queryClient = useQueryClient()
  const focusQuery = useQuery({ queryKey: ['focus'], queryFn: getFocus, refetchInterval: 15_000 })
  const focus = focusQuery.data
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
