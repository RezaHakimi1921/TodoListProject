import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Zap, 
  Feather, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ListTodo,
  TrendingUp
} from 'lucide-react'
import { listTasks, updateTaskStatus } from '../api/tasks'
import { QuickAddTask } from '../components/QuickAddTask'
import { TaskCard } from '../components/TaskCard'
import { TaskEditorDrawer } from '../components/TaskEditorDrawer'
import { AgingModal } from '../components/AgingModal'
import type { TaskItem, TaskStatus, StuckReason } from '../types'

export function DashboardPage() {
  const queryClient = useQueryClient()
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedEnergy, setSelectedEnergy] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [agingTask, setAgingTask] = useState<TaskItem | null>(null)

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })

  const agingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: StuckReason }) => {
      const isDoneReason = reason === 'دیگر اولویت ندارد یا منتفی شد (اتمام و بستن)'
      return updateTaskStatus(id, {
        status: isDoneReason ? 'Done' : 'Stuck',
        stuckReason: isDoneReason ? undefined : reason,
      })
    },
    onSuccess: () => {
      setAgingTask(null)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const tasks = tasksQuery.data ?? []

  // Stats calculation
  const totalCount = tasks.length
  const doneCount = tasks.filter((t) => t.status === 'Done').length
  const doingCount = tasks.filter((t) => t.status === 'Doing').length
  const stuckCount = tasks.filter((t) => t.status === 'Stuck').length
  const deepCount = tasks.filter((t) => t.status !== 'Done' && t.energyType === 'Deep').length
  const completionPercentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedStatus !== 'all' && task.status !== selectedStatus) return false
      if (selectedEnergy !== 'all' && task.energyType !== selectedEnergy) return false
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const matchTitle = task.title.toLowerCase().includes(query)
        const matchTag = task.tags.some((t) => t.toLowerCase().includes(query))
        if (!matchTitle && !matchTag) return false
      }
      return true
    })
  }, [tasks, selectedStatus, selectedEnergy, searchQuery])

  const deepTasks = filteredTasks.filter((t) => t.energyType === 'Deep')
  const lightTasks = filteredTasks.filter((t) => t.energyType === 'Light')

  return (
    <div className="space-y-6">
      {/* Welcome & Motivation Header */}
      <div className="rounded-3xl border border-[#212738] bg-gradient-to-br from-[#151926] via-[#121520] to-[#0f121a] p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              امروز چه کاری باید به سرانجام برسد؟
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              کارهای خود را به تفکیک «تمرکز عمیق» و «کارهای سریع» مدیریت کنید و زمان را هوشمندانه ثبت فرمایید.
            </p>
          </div>

          {/* Progress Bar & Quick Stats */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-700/60 bg-[#161a28] px-4 py-3 min-w-[170px]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400 font-medium">پیشرفت کلی امروز</span>
                <span className="font-mono font-bold text-amber-300">{completionPercentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-500 text-left font-mono">
                {doneCount} از {totalCount} کار تکمیل شده
              </div>
            </div>

            {stuckCount > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <div className="font-bold text-rose-300">{stuckCount} کار گیر کرده</div>
                  <div className="text-[11px] text-rose-400/80">نیاز به بازنگری یا حذف</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Add Task Input */}
      <QuickAddTask />

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-[#212738] bg-[#141824] p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 text-[11px] ml-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> وضعیت:
          </span>
          {[
            { key: 'all', label: 'همه کارها', count: totalCount },
            { key: 'Open', label: 'باز', count: tasks.filter((t) => t.status === 'Open').length },
            { key: 'Doing', label: 'در حال انجام', count: doingCount },
            { key: 'Stuck', label: 'گیر کرده', count: stuckCount },
            { key: 'Done', label: 'انجام شده', count: doneCount },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedStatus(item.key)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                selectedStatus === item.key
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-[#181d2c] text-slate-400 hover:text-slate-200 hover:bg-[#1f2538]'
              }`}
            >
              <span>{item.label}</span>
              <span className="mr-1 text-[10px] font-mono opacity-80">({item.count})</span>
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجو در عنوان یا برچسب‌ها..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-[#0e111a] border border-[#262f44] pr-9 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Two Column Layout: Deep Focus vs Light Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Deep Focus */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-100">
                تمرکز عمیق (Deep Focus)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                {deepTasks.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">کارهای مهم که نیازمند غرقگی هستند</span>
          </div>

          <div className="space-y-3">
            {deepTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#242c3f] bg-[#11141e]/50 p-8 text-center">
                <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-400 font-medium">هیچ کاری در بخش تمرکز عمیق موجود نیست.</p>
                <p className="text-[11px] text-slate-600 mt-1">کار جدیدی با برچسب عمیق اضافه کنید تا اینجا قرار گیرد.</p>
              </div>
            ) : (
              deepTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpenDrawer={setEditingTask}
                  onOpenAging={setAgingTask}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: Light / Quick Tasks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Feather className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-100">
                کارهای سبک و سریع (Light Tasks)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold">
                {lightTasks.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">پیام‌ها، جلسات و کارهای کمتر از ۱۵ دقیقه</span>
          </div>

          <div className="space-y-3">
            {lightTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#242c3f] bg-[#11141e]/50 p-8 text-center">
                <Feather className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-400 font-medium">هیچ کار سبکی در صف نیست.</p>
                <p className="text-[11px] text-slate-600 mt-1">کارهای روتین را اضافه کنید تا فراموش نشوند.</p>
              </div>
            ) : (
              lightTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpenDrawer={setEditingTask}
                  onOpenAging={setAgingTask}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Task Editor Drawer */}
      <TaskEditorDrawer
        task={editingTask}
        onClose={() => setEditingTask(null)}
      />

      {/* Aging Modal */}
      <AgingModal
        task={agingTask}
        onClose={() => setAgingTask(null)}
        onChoose={(reason) => {
          if (agingTask) {
            agingMutation.mutate({ id: agingTask.id, reason })
          }
        }}
      />
    </div>
  )
}
