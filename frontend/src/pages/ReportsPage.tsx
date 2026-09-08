import { BarChart3 } from 'lucide-react'
import { TaskScatterCard } from '../components/TaskScatterCard'

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.08] bg-[#10131b] p-5">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-amber-300" />
          <h1 className="text-lg font-bold text-white">گزارش</h1>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          پراکندگی و پرش بین کارها اینجاست تا برای مدیر کپی شود.
        </p>
      </section>
      <TaskScatterCard />
    </div>
  )
}
