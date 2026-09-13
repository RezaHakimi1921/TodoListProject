import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { listTasks } from '../api/tasks'
import { listWorkLogs } from '../api/workLogs'
import { formatMinutesLabel, todayIso } from '../lib/dates'

export function TodayWorkHoursCard() {
  const today = todayIso()
  const logsQuery = useQuery({
    queryKey: ['worklogs', today],
    queryFn: () => listWorkLogs(today),
    refetchInterval: 30_000,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })

  const rows = useMemo(() => {
    const logs = (logsQuery.data ?? []).filter((row) => row.source !== 'Break')
    const tasks = new Map((tasksQuery.data ?? []).map((task) => [task.id, task]))
    const grouped = new Map<string, { title: string; jiraKey: string | null; minutes: number }>()
    for (const log of logs) {
      const task = log.taskId ? tasks.get(log.taskId) : undefined
      const key = log.taskId ? `task-${log.taskId}` : `text-${log.description}`
      const title =
        log.taskTitle
        || task?.title
        || log.problemTitle
        || (log.description && log.description !== 'کار' ? log.description : 'بدون عنوان')
      const current = grouped.get(key) ?? {
        title,
        jiraKey: log.jiraKey ?? task?.jiraKey ?? null,
        minutes: 0,
      }
      current.minutes += Number(log.durationMinutes || 0)
      grouped.set(key, current)
    }
    return [...grouped.values()].sort((a, b) => b.minutes - a.minutes)
  }, [logsQuery.data, tasksQuery.data])

  const total = rows.reduce((sum, row) => sum + row.minutes, 0)

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#10131b] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-amber-300" />
        <h2 className="text-sm font-bold text-white">کار امروز روی تسک‌ها</h2>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        تسک‌هایی که امروز رویشان ورک‌لاگ خورده، با زمان تجمیعی.
      </p>
      <p className="text-lg font-black text-white mb-4">
        جمع امروز: {formatMinutesLabel(total)}
        <span className="ms-2 text-xs font-medium text-slate-400">{total} دقیقه</span>
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">هنوز امروز روی تسکی زمان ثبت نشده.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-white/10">
                <th className="pb-2 font-medium">تسک</th>
                <th className="pb-2 font-medium">تیکت</th>
                <th className="pb-2 font-medium">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((row) => (
                <tr key={`${row.title}-${row.jiraKey ?? ''}`}>
                  <td className="py-2 text-slate-100">{row.title}</td>
                  <td className="py-2 text-[11px] text-sky-300 font-mono">{row.jiraKey || '—'}</td>
                  <td className="py-2 text-amber-100 font-semibold whitespace-nowrap">{formatMinutesLabel(row.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
