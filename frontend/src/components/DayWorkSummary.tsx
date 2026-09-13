import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, Coffee, HelpCircle, Moon, Sun, Sunset } from 'lucide-react'
import { listTasks } from '../api/tasks'
import { listWorkLogs } from '../api/workLogs'
import {
  formatClock,
  formatMinutesLabel,
  formatPersianDate,
  workLogStartedAt,
} from '../lib/dates'
import { sumTimeBuckets } from '../lib/workTimeBuckets'
import { STATUS_LABEL, type TaskItem, type WorkLogEntry } from '../types'
import { DayTimeTotals } from './DayTimeTotals'

interface Props {
  date: string
  compact?: boolean
}

type Period = 'صبح' | 'ظهر' | 'عصر' | 'شب'

interface TimelineItem {
  id: number
  start: string
  end: string
  minutes: number
  title: string
  detail?: string
  href?: string
  kind: 'task' | 'problem' | 'break' | 'other'
  jiraKey?: string | null
  period: Period
}

function hourOf(iso: string) {
  const value = Date.parse(iso)
  if (!Number.isFinite(value)) return 12
  return new Date(value).getHours()
}

function periodOf(iso: string): Period {
  const hour = hourOf(iso)
  if (hour < 12) return 'صبح'
  if (hour < 16) return 'ظهر'
  if (hour < 20) return 'عصر'
  return 'شب'
}

function toItem(log: WorkLogEntry): TimelineItem {
  const end = log.createdAt
  const start = workLogStartedAt(end, log.durationMinutes)
  const isBreak = log.source === 'Break'
  const title = isBreak
    ? log.description || 'استراحت'
    : log.taskTitle || log.problemTitle || log.description || 'بدون عنوان'
  const detail = !isBreak && log.description && log.description !== title ? log.description : undefined
  return {
    id: log.id,
    start,
    end,
    minutes: Number(log.durationMinutes || 0),
    title,
    detail,
    href: log.taskId ? `/tasks/${log.taskId}` : log.problemId ? `/problems/${log.problemId}` : undefined,
    kind: isBreak ? 'break' : log.taskId ? 'task' : log.problemId ? 'problem' : 'other',
    jiraKey: log.jiraKey,
    period: periodOf(start || end),
  }
}

const PERIOD_META: Record<Period, { Icon: typeof Sun; tone: string }> = {
  صبح: { Icon: Sun, tone: 'text-amber-200' },
  ظهر: { Icon: Sunset, tone: 'text-orange-200' },
  عصر: { Icon: Sunset, tone: 'text-sky-200' },
  شب: { Icon: Moon, tone: 'text-indigo-200' },
}

export function DayWorkSummary({ date, compact }: Props) {
  const logsQuery = useQuery({
    queryKey: ['worklogs', date],
    queryFn: () => listWorkLogs(date),
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks', date],
    queryFn: () => listTasks({ date }),
  })

  const timeline = useMemo(
    () =>
      (logsQuery.data ?? [])
        .map(toItem)
        .sort((a, b) => Date.parse(a.start || a.end) - Date.parse(b.start || b.end)),
    [logsQuery.data],
  )
  const tasks = tasksQuery.data ?? []
  const doneTasks = tasks.filter((task) => task.status === 'Done')
  const buckets = useMemo(() => sumTimeBuckets(logsQuery.data ?? []), [logsQuery.data])
  const first = timeline[0]
  const last = timeline[timeline.length - 1]

  if (logsQuery.isLoading || tasksQuery.isLoading) {
    return <p className="text-xs text-slate-500">در حال بارگذاری گزارش روز...</p>
  }

  if (timeline.length === 0 && tasks.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border border-dashed border-white/[0.08] bg-[#10131b]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-[11px] font-semibold tracking-wide text-amber-200/80">گزارش روز</p>
          <h2 className="mt-0.5 text-base font-bold text-white">{formatPersianDate(date)}</h2>
        </div>
        <div className="border-b border-white/[0.06] px-5 py-4">
          <DayTimeTotals buckets={buckets} compact={compact} />
        </div>
        <div className="px-5 py-8 text-center">
          <Clock className="mx-auto mb-2 h-6 w-6 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">این روز خالی است</p>
        </div>
      </section>
    )
  }

  let lastPeriod: Period | null = null

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10131b]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-amber-200/80">گزارش روز</p>
          <h2 className="mt-0.5 text-base font-bold text-white">{formatPersianDate(date)}</h2>
          {first && last ? (
            <p className="mt-1 text-[11px] text-slate-500">
              از {formatClock(first.start)} تا {formatClock(last.end)}
            </p>
          ) : null}
        </div>
        <p className="text-[11px] text-slate-500">{timeline.length} ثبت در طول روز</p>
      </div>
      <div className="border-b border-white/[0.06] px-5 py-4">
        <DayTimeTotals buckets={buckets} compact={compact} />
      </div>

      <ol className="relative space-y-0 px-5 py-5">
        <span className="pointer-events-none absolute top-5 bottom-5 right-[2.15rem] w-px bg-white/[0.08]" />
        {timeline.map((item) => {
          const showPeriod = item.period !== lastPeriod
          lastPeriod = item.period
          const meta = PERIOD_META[item.period]
          return (
            <li key={item.id}>
              {showPeriod ? (
                <div className={`relative z-10 mb-2 mt-3 flex items-center gap-2 text-[11px] font-bold ${meta.tone}`}>
                  <meta.Icon className="h-3.5 w-3.5" />
                  {item.period}
                </div>
              ) : null}
              <div
                className={`relative mb-2 rounded-2xl border pr-8 ${
                  item.kind === 'break'
                    ? 'border-sky-500/15 bg-sky-500/[0.06]'
                    : 'border-white/[0.06] bg-black/25'
                } px-3 py-2.5`}
              >
                <span
                  className={`absolute right-2.5 top-3.5 h-2.5 w-2.5 rounded-full border-2 ${
                    item.kind === 'break'
                      ? 'border-sky-300 bg-sky-500'
                      : item.kind === 'problem'
                        ? 'border-amber-200 bg-amber-400'
                        : 'border-white/40 bg-white'
                  }`}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-slate-400">
                      {formatClock(item.start)}
                      <span className="mx-1 text-slate-600">→</span>
                      {formatClock(item.end)}
                    </p>
                    {item.href ? (
                      <Link to={item.href} className="mt-0.5 block truncate text-sm font-semibold text-slate-100 hover:text-amber-100">
                        {item.kind === 'problem' ? <HelpCircle className="me-1 inline h-3.5 w-3.5 text-amber-300" /> : null}
                        {item.title}
                      </Link>
                    ) : (
                      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-100">
                        {item.kind === 'break' ? <Coffee className="h-3.5 w-3.5 text-sky-300" /> : null}
                        {item.title}
                      </p>
                    )}
                    {item.detail && !compact ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.detail}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs font-bold text-amber-100">{formatMinutesLabel(item.minutes)}</p>
                    {item.jiraKey ? <p className="font-mono text-[10px] text-sky-300">{item.jiraKey}</p> : null}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {!compact && doneTasks.length > 0 ? <DoneStrip tasks={doneTasks} /> : null}
    </section>
  )
}

function DoneStrip({ tasks }: { tasks: TaskItem[] }) {
  return (
    <div className="border-t border-white/[0.06] px-5 py-4">
      <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        تکمیل‌شده در این روز
        <span className="font-mono text-emerald-300/70">({tasks.length})</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((task) => (
          <Link
            key={task.id}
            to={`/tasks/${task.id}`}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100"
          >
            {task.title}
            <span className="ms-1 text-emerald-200/60">{task.jiraKey || STATUS_LABEL[task.status]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
