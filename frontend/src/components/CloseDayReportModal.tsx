import { CheckCircle2, Clock, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMinutesLabel, formatPersianDate } from '../lib/dates'
import type { CloseWorkdayResult } from '../api/tasks'

interface Props {
  result: CloseWorkdayResult | null
  onClose: () => void
}

export function CloseDayReportModal({ result, onClose }: Props) {
  if (!result) return null

  const groups = result.workSummary?.groups ?? []
  const completed = result.completedTasks ?? []
  const totalMinutes = result.workSummary?.totalMinutes ?? 0
  const date = result.date || result.workSummary?.date || ''

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#141824] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-amber-200/80">گزارش پایان روز</p>
              <h2 className="text-base font-bold text-white">
                {date ? formatPersianDate(date) : 'جمع‌بندی امروز'}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">{result.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">زمان کار</p>
              <p className="mt-0.5 text-sm font-bold text-amber-100">{formatMinutesLabel(totalMinutes)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">آیتم‌های زمانی</p>
              <p className="mt-0.5 text-sm font-bold text-slate-100">{groups.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2.5 col-span-2 sm:col-span-1">
              <p className="text-[10px] text-emerald-300/80">تکمیل‌شده</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-100">{completed.length}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold text-slate-300">خلاصه کار روی تسک‌ها</h3>
            {groups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-xs text-slate-500">
                امروز ثبت زمانی برای تسک‌ها نبود.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-black/40 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">کار / موضوع</th>
                      <th className="px-3 py-2 font-semibold w-24">مدت</th>
                      <th className="px-3 py-2 font-semibold w-16">ثبت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {groups.map((group, index) => (
                      <tr key={`${group.title}-${index}`} className="bg-[#10131b]/hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-slate-100 font-medium">{group.title}</td>
                        <td className="px-3 py-2.5 font-mono text-amber-100">{formatMinutesLabel(group.totalMinutes)}</td>
                        <td className="px-3 py-2.5 text-slate-500">{group.entries?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-white/[0.08] bg-black/30">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-200">جمع</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-amber-200">{formatMinutesLabel(totalMinutes)}</td>
                      <td className="px-3 py-2.5 text-slate-500">{groups.reduce((n, g) => n + (g.entries?.length ?? 0), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {completed.length > 0 ? (
            <div>
              <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                این کارها را امروز انجام دادی
              </h3>
              <ul className="space-y-1.5">
                {completed.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50 hover:bg-emerald-500/15"
                      onClick={onClose}
                    >
                      <span className="truncate font-medium">{task.title}</span>
                      {task.jiraKey ? (
                        <span className="shrink-0 font-mono text-[10px] text-sky-300">{task.jiraKey}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/[0.08] px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-950 hover:bg-slate-200"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  )
}