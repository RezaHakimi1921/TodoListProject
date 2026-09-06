import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Zap, 
  Feather, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Calendar,
  RotateCcw,
  LayoutGrid,
  AlignJustify,
  Check,
  ArrowLeft,
  X,
  Sparkles
} from 'lucide-react'
import { listTasks, updateTaskStatus, rolloverDay } from '../api/tasks'
import { QuickAddTask } from '../components/QuickAddTask'
import { TaskCard } from '../components/TaskCard'
import { TaskEditorDrawer } from '../components/TaskEditorDrawer'
import { AgingModal } from '../components/AgingModal'
import { todayIso, yesterdayIso, formatPersianDate, formatPersianDateShort } from '../lib/dates'
import type { TaskItem, TaskStatus, StuckReason } from '../types'

export function DashboardPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const today = todayIso()
  const yesterday = yesterdayIso()
  const dateFromUrl = params.get('date')
  const selectedDate =
    dateFromUrl === 'all' || (dateFromUrl !== null && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl))
      ? dateFromUrl
      : today

  const setSelectedDate = (date: string) => {
    const next = new URLSearchParams(params)
    if (date === today) next.delete('date')
    else next.set('date', date)
    setParams(next, { replace: true })
  }

  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedEnergy, setSelectedEnergy] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'standard' | 'zen'>('standard')
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [agingTask, setAgingTask] = useState<TaskItem | null>(null)
  const [showRolloverModal, setShowRolloverModal] = useState(false)
  const [rolloverNote, setRolloverNote] = useState('')

  const isToday = selectedDate === today
  const isYesterday = selectedDate === yesterday

  const tasksQuery = useQuery({
    queryKey: ['tasks', selectedDate, searchQuery],
    queryFn: () =>
      listTasks({
        date: selectedDate === 'all' ? undefined : selectedDate,
        q: searchQuery.trim() || undefined,
      }),
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

  const rolloverMutation = useMutation({
    mutationFn: (note?: string) => rolloverDay(note),
    onSuccess: () => {
      setShowRolloverModal(false)
      setRolloverNote('')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['dailyLogs'] })
    },
  })

  const allTasks = tasksQuery.data ?? []

  // Rollover flag augmentation: If a task was created before today and is not done, treat as rolled over
  const tasks = useMemo(() => {
    return allTasks.map((t) => {
      const createdDate = t.createdAt.slice(0, 10)
      const shouldBeRolledOver = t.status !== 'Done' && createdDate < today
      return {
        ...t,
        rolledOver: t.rolledOver || shouldBeRolledOver,
      }
    })
  }, [allTasks, today])

  // Stats calculation
  const totalCount = tasks.length
  const doneCount = tasks.filter((t) => t.status === 'Done').length
  const doingCount = tasks.filter((t) => t.status === 'Doing').length
  const stuckCount = tasks.filter((t) => t.status === 'Stuck').length
  const openCount = tasks.filter((t) => t.status === 'Open').length
  const rolledOverCount = tasks.filter((t) => t.rolledOver && t.status !== 'Done').length
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
    <div className="space-y-7 max-w-6xl mx-auto">
      {/* 1. Day Partitioning & Motivation Header (Clean Linear Aesthetic) */}
      <section 
        id="dashboard-hero-section"
        aria-label="بخش وضعیت روز کاری"
        className="rounded-2xl border border-white/[0.08] bg-[#0e1118] p-6 sm:p-7 shadow-xl shadow-black/25"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            {/* Day Selector Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/30 border border-white/[0.06] w-fit">
              <button
                id="btn-day-today"
                type="button"
                onClick={() => setSelectedDate(today)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  isToday
                    ? 'bg-white/15 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                امروز
              </button>
              <button
                id="btn-day-yesterday"
                type="button"
                onClick={() => setSelectedDate(yesterday)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  isYesterday
                    ? 'bg-white/15 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                دیروز ({formatPersianDateShort(yesterday)})
              </button>
              <button
                id="btn-day-all"
                type="button"
                onClick={() => setSelectedDate('all')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedDate === 'all'
                    ? 'bg-white/15 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                همه روزها
              </button>
              {!isToday && !isYesterday && selectedDate !== 'all' && (
                <button
                  id="btn-day-selected"
                  type="button"
                  className="px-3 py-1 rounded-md text-xs font-medium bg-white/15 text-white font-semibold shadow-sm"
                >
                  {formatPersianDateShort(selectedDate)}
                </button>
              )}
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {isToday
                  ? 'امروز چه کاری باید به سرانجام برسد؟'
                  : isYesterday
                  ? 'مرور کارها و دستاوردهای دیروز'
                  : 'آرشیو کارهای ثبت‌شده'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                {isToday
                  ? 'کارهای روزانه را با تمرکز عمیق انجام دهید و در پایان روز کارهای مانده را به فردا بسپارید.'
                  : `در حال مشاهده وضعیت کارهای تاریخ ${formatPersianDate(selectedDate === 'all' ? undefined : selectedDate)} هستید.`}
              </p>
            </div>
          </div>

          {/* Progress & Day Closure Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Progress Container */}
            <div className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 min-w-[200px]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400 font-medium">پیشرفت روز</span>
                <span className="font-mono font-semibold text-slate-200">{completionPercentage}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{doneCount} از {totalCount} کار انجام شد</span>
                {rolledOverCount > 0 && isToday && (
                  <span className="text-amber-400/80 font-sans flex items-center gap-1">
                    <RotateCcw className="w-2.5 h-2.5" /> {rolledOverCount} منتقل از قبل
                  </span>
                )}
              </div>
            </div>

            {/* End of Day Button (Active on Today) */}
            {isToday && (
              <button
                id="btn-end-workday"
                type="button"
                onClick={() => setShowRolloverModal(true)}
                className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-4 py-3 text-xs font-medium text-slate-200 hover:text-white transition-all shadow-sm"
                title="پایان روز کاری و انتقال خودکار کارهای باقی‌مانده به روز جدید"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <div className="text-right">
                  <div className="font-semibold text-white">پایان روز کاری</div>
                  <div className="text-[10px] text-slate-400">انتقال مانده‌ها به فردا</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. Quick Add Task Input */}
      {isToday && <QuickAddTask />}

      {/* 3. Filter Bar & View Density Switcher */}
      <section 
        id="dashboard-filter-bar"
        aria-label="نوار فیلتر و جستجو"
        className="rounded-xl border border-white/[0.07] bg-[#0e1118] p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { key: 'all', label: 'همه', count: totalCount },
            { key: 'Open', label: 'باز', count: openCount },
            { key: 'Doing', label: 'در حال انجام', count: doingCount },
            { key: 'Stuck', label: 'گیر کرده', count: stuckCount },
            { key: 'Done', label: 'تکمیل شده', count: doneCount },
          ].map((item) => (
            <button
              key={item.key}
              id={`filter-status-${item.key}`}
              type="button"
              onClick={() => setSelectedStatus(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === item.key
                  ? 'bg-white/15 text-white font-semibold border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <span>{item.label}</span>
              <span className="mr-1 text-[10px] font-mono opacity-60">({item.count})</span>
            </button>
          ))}
        </div>

        {/* Right side: Search + View Density Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-tasks-input"
              type="text"
              placeholder="جستجو در عنوان یا برچسب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-black/30 border border-white/[0.06] pr-8 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-white/25"
            />
          </div>

          {/* View Mode Switcher (Standard 2-column vs Zen Minimal) */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-black/30 border border-white/[0.06]">
            <button
              id="btn-view-mode-standard"
              type="button"
              onClick={() => setViewMode('standard')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'standard' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="نمای استاندارد (دو ستونه)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-view-mode-zen"
              type="button"
              onClick={() => setViewMode('zen')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'zen' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="نمای زِن / فوق‌مینیمال (تک ستونه)"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Task Lists: Standard Two-Column Layout vs Zen Minimal Layout */}
      {viewMode === 'standard' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Deep Focus */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <h2 className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
                  تمرکز عمیق (Deep Focus)
                </h2>
                <span className="px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-300 font-mono text-[10px] font-semibold">
                  {deepTasks.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">کارهای اصلی نیازمند غرقگی</span>
            </div>

            <div className="space-y-2.5">
              {deepTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.06] bg-black/10 p-7 text-center">
                  <p className="text-xs text-slate-400 font-medium">هیچ کاری در بخش تمرکز عمیق نیست.</p>
                  <p className="text-[11px] text-slate-600 mt-1">کار مهم امروز را با برچسب عمیق ثبت فرمایید.</p>
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
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <h2 className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
                  کارهای سبک و سریع (Light Tasks)
                </h2>
                <span className="px-1.5 py-0.2 rounded bg-emerald-400/10 text-emerald-300 font-mono text-[10px] font-semibold">
                  {lightTasks.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">پیام‌ها، بازبینی و کارهای روتین</span>
            </div>

            <div className="space-y-2.5">
              {lightTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.06] bg-black/10 p-7 text-center">
                  <p className="text-xs text-slate-400 font-medium">هیچ کاری در صف کارهای سبک نیست.</p>
                  <p className="text-[11px] text-slate-600 mt-1">کارهای کوچک و کمتر از ۱۵ دقیقه را اینجا نگه دارید.</p>
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
      ) : (
        /* Zen / Minimal View (Single-column distraction-free list) */
        <div className="space-y-3 max-w-3xl mx-auto">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-slate-200">
                نمای زِن • متمرکز بر ترتیب اولویت
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              مجموع {filteredTasks.length} کار
            </span>
          </div>

          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.06] bg-black/10 p-10 text-center">
                <p className="text-xs text-slate-400">هیچ کاری یافت نشد.</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
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
      )}

      {/* Rollover Modal (End of Workday Confirmation) */}
      {showRolloverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121520] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">پایان روز کاری و انتقال کارهای مانده</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRolloverModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                با تایید این مرحله، روز کاری جاری بسته می‌شود:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pr-1">
                <li>کارهای تکمیل‌شده ({doneCount} کار) در لاگ روزانه ثبت و آرشیو می‌شوند.</li>
                <li>کارهای باقی‌مانده و باز ({openCount + doingCount + stuckCount} کار) به روز جدید منتقل خواهند شد.</li>
              </ul>
            </div>

            {/* Optional daily note */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                یادداشت کوتاه جمع‌بندی روز (اختیاری):
              </label>
              <textarea
                value={rolloverNote}
                onChange={(e) => setRolloverNote(e.target.value)}
                placeholder="امروز چه چیزی آموختید یا مانع اصلی چه بود؟"
                rows={3}
                className="w-full rounded-xl bg-black/30 border border-white/[0.08] p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-white/25"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRolloverModal(false)}
                className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
              >
                انصراف
              </button>
              <button
                id="btn-confirm-rollover"
                type="button"
                disabled={rolloverMutation.isPending}
                onClick={() => rolloverMutation.mutate(rolloverNote)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition-all shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تایید و انتقال به روز بعد</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
