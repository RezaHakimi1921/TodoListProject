import { useQuery } from '@tanstack/react-query'
import { GitBranch } from 'lucide-react'
import { listWorkLogs } from '../api/workLogs'
import { todayIso } from '../lib/dates'

export function TaskScatterCard() {
  const today = todayIso()
  const logsQuery = useQuery({
    queryKey: ['worklogs', today],
    queryFn: () => listWorkLogs(today),
    refetchInterval: 30_000,
  })
  const logs = (logsQuery.data ?? []).filter((row) => row.source !== 'Break').slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const taskIds = [...new Set(logs.map((row) => row.taskId).filter((id): id is number => Number.isFinite(id)))]
  let switches = 0
  for (let i = 1; i < logs.length; i++) {
    if ((logs[i].taskId ?? logs[i].description) !== (logs[i - 1].taskId ?? logs[i - 1].description)) switches += 1
  }
  const minutes = logs.reduce((sum, row) => sum + row.durationMinutes, 0)
  const note = `امروز روی ${taskIds.length || logs.length} کار جداگانه زمان ثبت شد و ${switches} بار بین کارها جابه‌جا شدم. مجموع زمان ثبت‌شده ${minutes} دقیقه است.`
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3">
      <div className="flex items-center gap-2 text-xs mb-2">
        <GitBranch className="w-3.5 h-3.5 text-amber-300" />
        <span className="text-slate-300 font-semibold">پراکندگی کار امروز</span>
      </div>
      <p className="text-sm text-white font-bold">{taskIds.length || logs.length} کار · {switches} پرش</p>
      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{note}</p>
    </div>
  )
}
