import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Clock, Layers3 } from 'lucide-react'
import { listTasks } from '../api/tasks'
import { listWorkLogs } from '../api/workLogs'
import { addDaysIso, formatMinutesLabel, formatPersianDateShort } from '../lib/dates'
import type { WorkLogEntry } from '../types'

type RangeMode = 'day' | 'month'

interface Props {
  date: string
}

interface TaskTotalRow {
  key: string
  taskId: number | null
  title: string
  jiraKey: string | null
  minutes: number
  sessions: number
}

function datesInclusiveBack(endIso: string, days: number) {
  const out: string[] = []
  for (let i = 0; i < days; i += 1) {
    out.push(addDaysIso(endIso, -i))
  }
  return out
}

function buildRows(logs: WorkLogEntry[], taskTitleById: Map<number, string>): TaskTotalRow[] {
  const grouped = new Map<string, TaskTotalRow>()
  for (const log of logs) {
    if (log.source === 'Break') continue
    const minutes = Number(log.durationMinutes || 0)
    if (minutes <= 0) continue
    const key = log.taskId ? `task-${log.taskId}` : `text-${(log.description || '').trim() || 'none'}`
    const title =
      log.taskTitle
      || (log.taskId ? taskTitleById.get(log.taskId) : undefined)
      || log.problemTitle
      || (log.description && log.description !== 'کار' ? log.description : 'بدون عنوان')
    const current = grouped.get(key) ?? {
      key,
      taskId: log.taskId ?? null,
      title,
      jiraKey: log.jiraKey ?? null,
      minutes: 0,
      sessions: 0,
    }
    current.minutes += minutes
    current.sessions += 1
    if (!current.jiraKey && log.jiraKey) current.jiraKey = log.jiraKey
    if (log.taskTitle) current.title = log.taskTitle
    grouped.set(key, current)
  }
  return [...grouped.values()].sort((a, b) => b.minutes - a.minutes)
}

export function TodayWorkHoursCard({ date }: Props) {
  const [mode, setMode] = useState<RangeMode>('day')
  const rangeDates = useMemo(
    () => (mode === 'day' ? [date] : datesInclusiveBack(date, 30)),
    [date, mode],
  )

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })

  const logQueries = useQueries({
    queries: rangeDates.map((day) => ({
      queryKey: ['worklogs', day],
      queryFn: () => listWorkLogs(day),
    })),
  })

  const loading = logQueries.some((query) => query.isLoading) || tasksQuery.isLoading
  const logs = logQueries.flatMap((query) => query.data ?? [])
  const taskTitleById = useMemo(
    () => new Map((tasksQuery.data ?? []).map((task) => [task.id, task.title])),
    [tasksQuery.data],
  )
  const rows = useMemo(() => buildRows(logs, taskTitleById), [logs, taskTitleById])
  const total = rows.reduce((sum, row) => sum + row.minutes, 0)
  const maxMinutes = rows[0]?.minutes ?? 0
  const rangeLabel =
    mode === 'day'
      ? formatPersianDateShort(date)
      : `${formatPersianDateShort(rangeDates[rangeDates.length - 1])} تا ${formatPersianDateShort(rangeDates[0])}`

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#10131b] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2">
            <Layers3 className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-bold text-white">خلاصه زمان روی تسک‌ها</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            جمع ورک‌لاگ هر تسک — جدا از داستان تایم‌لاین روز.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('day')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              mode === 'day' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            همین روز
          </button>
          <button
            type="button"
            onClick={() => setMode('month')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              mode === 'month' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ۳۰ روز اخیر
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 mb-3">{rangeLabel}</p>

      <p className="text-lg font-black text-white mb-4">
        جمع: {formatMinutesLabel(total)}
        <span className="ms-2 text-xs font-medium text-slate-400">{total} دقیقه · {rows.length} تسک</span>
      </p>

      {loading ? (
        <p className="text-xs text-slate-500">در حال جمع‌زدن زمان تسک‌ها...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-center">
          <Clock className="mx-auto mb-2 h-5 w-5 text-slate-600" />
          <p className="text-xs text-slate-500">در این بازه روی تسکی زمان ثبت نشده.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const width = maxMinutes > 0 ? Math.max(6, Math.round((row.minutes / maxMinutes) * 100)) : 0
            const body = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{row.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {row.jiraKey ? (
                        <span className="font-mono text-sky-300">{row.jiraKey}</span>
                      ) : (
                        'بدون تیکت'
                      )}
                      <span className="mx-1.5 text-slate-600">·</span>
                      {row.sessions} ثبت
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-amber-100 whitespace-nowrap">
                    {formatMinutesLabel(row.minutes)}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${width}%` }} />
                </div>
              </>
            )
            return row.taskId ? (
              <Link
                key={row.key}
                to={`/tasks/${row.taskId}`}
                className="block rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5 hover:border-amber-400/30 hover:bg-black/40 transition-colors"
              >
                {body}
              </Link>
            ) : (
              <div
                key={row.key}
                className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5"
              >
                {body}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
