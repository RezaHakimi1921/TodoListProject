import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Clock, 
  Copy, 
  Check, 
  Calendar, 
  Plus, 
  Trash2, 
  Coffee, 
  Zap, 
  Briefcase,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { captureWorkLog, deleteWorkLog, getWorkLogSummary, listWorkLogs } from '../api/workLogs'
import { listTasks } from '../api/tasks'
import { todayIso, formatPersianDate, formatPersianDateTime } from '../lib/dates'
import type { WorkLogSource } from '../types'

export function WorkLogPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState<string>(todayIso())
  const [copied, setCopied] = useState(false)

  // Manual log form
  const [desc, setDesc] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [selectedTask, setSelectedTask] = useState<string>('')
  const [source, setSource] = useState<WorkLogSource>('Manual')

  const summaryQuery = useQuery({
    queryKey: ['worklogs', 'summary', date],
    queryFn: () => getWorkLogSummary(date),
  })

  const logsQuery = useQuery({
    queryKey: ['worklogs', 'list', date],
    queryFn: () => listWorkLogs(date),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      captureWorkLog({
        description: desc.trim() || 'فعالیت کاری',
        durationMinutes: Math.max(1, Number(minutes) || 15),
        source,
        taskId: selectedTask ? Number(selectedTask) : undefined,
      }),
    onSuccess: () => {
      setDesc('')
      setSelectedTask('')
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWorkLog(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const summary = summaryQuery.data
  const logs = logsQuery.data ?? []
  const tasks = tasksQuery.data ?? []

  const totalMinutes = summary?.totalMinutes ?? logs.reduce((s, l) => s + l.durationMinutes, 0)
  const totalHours = (totalMinutes / 60).toFixed(1)

  const handleCopyJira = async () => {
    const text = summary?.copyText || logs.map((l) => `• ${l.description} (${l.durationMinutes}m)`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback
    }
  }

  const shiftDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              ثبت کار و زمان روزانه (Work Log)
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            گزارش دقیق ساعات صرف‌شده، تفکیک به تفکیک تسک‌ها و دریافت خروجی استاندارد برای جیرا
          </p>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2 bg-[#0e111a] border border-[#262f44] p-1.5 rounded-2xl text-xs">
          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            title="روز بعد"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 font-semibold text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>{formatPersianDate(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-transparent w-4 cursor-pointer focus:outline-none"
              title="انتخاب تاریخ"
            />
          </div>
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            title="روز قبل"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">مجموع زمان کار امروز</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{totalMinutes}</span>
            <span className="text-xs text-slate-400">دقیقه ({totalHours} ساعت)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">تعداد بازه‌های ثبت‌شده</span>
            <Briefcase className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{logs.length}</span>
            <span className="text-xs text-slate-400">بازه تمرکز و فعالیت</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">خروجی جیرا / گزارش</span>
            <Copy className="w-4 h-4 text-amber-400" />
          </div>
          <button
            type="button"
            onClick={handleCopyJira}
            className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 ${
              copied
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'کپی شد!' : 'کپی خلاصه برای Jira'}</span>
          </button>
        </div>
      </div>

      {/* Manual Quick Log Entry */}
      <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-4">
        <h3 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-amber-400" />
          ثبت دستی زمان کار
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <input
              type="text"
              placeholder="توضیح کار انجام‌شده..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full rounded-xl bg-[#0e111a] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="w-full rounded-xl bg-[#0e111a] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">اتصال به کار (اختیاری)...</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="480"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full rounded-xl bg-[#0e111a] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 text-center font-mono focus:outline-none focus:border-amber-500"
            />
            <span className="text-xs text-slate-400 whitespace-nowrap">دقیقه</span>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              disabled={addMutation.isPending || !minutes}
              onClick={() => addMutation.mutate()}
              className="w-full h-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs py-2 transition-all shadow-md"
            >
              ثبت زمان
            </button>
          </div>
        </div>
      </div>

      {/* Grouped Logs / Timeline */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <h2 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-amber-400" />
          <span>لیست بازه‌های زمانی امروز</span>
        </h2>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-40" />
            <p>در تاریخ {formatPersianDate(date)} هیچ گزارشی ثبت نشده است.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {logs.map((log) => {
              const matchedTask = log.taskId ? tasks.find((t) => t.id === log.taskId) : null
              return (
                <div key={log.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-300 font-mono font-bold border border-amber-500/20 text-xs">
                      {log.durationMinutes}m
                    </span>
                    <div>
                      <p className="text-slate-100 font-semibold">{log.description}</p>
                      {matchedTask && (
                        <p className="text-[11px] text-amber-400/90 mt-0.5">
                          پروژه: {matchedTask.title}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono text-[11px]">
                      {formatPersianDateTime(log.createdAt)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-slate-400 text-[10px]">
                      {log.source === 'Timer' ? 'تایمر پاپ‌آپ' : 'ثبت دستی'}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(log.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="حذف لاگ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
