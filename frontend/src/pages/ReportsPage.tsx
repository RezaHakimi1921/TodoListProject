import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { listTaskDays } from '../api/tasks'
import { DayWorkSummary } from '../components/DayWorkSummary'
import { JalaliMonthCalendar } from '../components/JalaliMonthCalendar'
import { TaskScatterCard } from '../components/TaskScatterCard'
import { TodayWorkHoursCard } from '../components/TodayWorkHoursCard'
import { formatPersianDate, todayIso } from '../lib/dates'

export function ReportsPage() {
  const today = todayIso()
  const [selectedDate, setSelectedDate] = useState(today)
  const daysQuery = useQuery({
    queryKey: ['task-days'],
    queryFn: listTaskDays,
  })

  const marked = useMemo(
    () => new Set((daysQuery.data ?? []).map((row) => row.date).filter(Boolean)),
    [daysQuery.data],
  )

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.08] bg-[#10131b] p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-300" />
              <h1 className="text-base font-bold text-white">گزارش</h1>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              جمع کار، جلسه و نهار/استراحت همان روزی که از تقویم می‌گیری.
            </p>
          </div>
          <p className="text-[11px] font-medium text-slate-300">{formatPersianDate(selectedDate)}</p>
        </div>
        <div className="max-w-[15.5rem]">
          <JalaliMonthCalendar
            compact
            value={selectedDate}
            max={today}
            marked={marked}
            onChange={setSelectedDate}
          />
        </div>
      </section>

      <DayWorkSummary date={selectedDate} />
      <TodayWorkHoursCard />
      <TaskScatterCard />
    </div>
  )
}
