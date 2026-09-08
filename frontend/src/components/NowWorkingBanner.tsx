import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Play } from 'lucide-react'
import { getFocus } from '../api/focus'
import { getTask } from '../api/tasks'
import { taskJiraKey, taskJiraUrl } from '../lib/jira'

export function NowWorkingBanner() {
  const focusQuery = useQuery({ queryKey: ['focus'], queryFn: getFocus, refetchInterval: 15_000 })
  const focus = focusQuery.data
  const taskQuery = useQuery({
    queryKey: ['task', focus?.taskId],
    queryFn: () => getTask(Number(focus?.taskId)),
    enabled: Number.isFinite(focus?.taskId),
  })
  const active = Boolean(focus?.active && focus.description)
  const task = taskQuery.data
  const jiraUrl = task ? taskJiraUrl(task) : null
  const jiraKey = task ? taskJiraKey(task) : null
  if (!active) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#10131b] px-4 py-3.5">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 mb-1">الان روی این کار هستی</p>
        <p className="text-sm text-slate-400">هنوز تمرکزی شروع نشده.</p>
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
    </section>
  )
}
