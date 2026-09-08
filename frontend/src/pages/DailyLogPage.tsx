import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  BookOpen, 
  Calendar, 
  Save, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles,
  Trash2
} from 'lucide-react'
import { deleteDailyLog, getDailyLog, listDailyLogs, upsertDailyLog } from '../api/dailyLogs'
import { todayIso, formatPersianDate, formatPersianDateTime } from '../lib/dates'

export function DailyLogPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState<string>(todayIso())
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const logQuery = useQuery({
    queryKey: ['dailylog', date],
    queryFn: () => getDailyLog(date),
  })

  const historyQuery = useQuery({
    queryKey: ['dailylogs', 'list'],
    queryFn: () => listDailyLogs(),
  })

  useEffect(() => {
    setNote(logQuery.data?.note ?? '')
  }, [logQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => upsertDailyLog(date, note),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void queryClient.invalidateQueries({ queryKey: ['dailylog', date] })
      void queryClient.invalidateQueries({ queryKey: ['dailylogs', 'list'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDailyLog(id),
    onSuccess: () => {
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['dailylog', date] })
      void queryClient.invalidateQueries({ queryKey: ['dailylogs', 'list'] })
    },
  })

  const shiftDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              دفترچه یادگیری و ثبت روزانه (Daily Reflection)
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            فقط یادداشت‌هایی که می‌خواهی در ذهنت بماند یا یادآوری باشد. کارها و لاگ‌ها اینجا نمی‌آیند.
          </p>
        </div>

        {/* Date Selector */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Main Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  یادداشت و خودارزیابی تاریخ {formatPersianDate(date)}
                </h3>
              </div>
              {logQuery.data && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(logQuery.data!.id)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>حذف یادداشت</span>
                </button>
              )}
            </div>

            <textarea
              rows={9}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="امروز چه چیزهایی خوب پیش رفت؟ چه درسی آموختی؟ آیا مانعی وجود داشت که بتوانی فردا بهتر حلش کنی؟..."
              className="w-full rounded-2xl bg-[#0b0e16] border border-[#2b354d] p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                {logQuery.data?.createdAt ? `آخرین بروزرسانی: ${formatPersianDateTime(logQuery.data.createdAt)}` : 'پیش‌نویس جدید'}
              </span>

              <button
                type="button"
                disabled={saveMutation.isPending || !note.trim()}
                onClick={() => saveMutation.mutate()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                  saved
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saved ? 'ذخیره شد' : 'ذخیره یادداشت روزانه'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* History Sidebar */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#212738] bg-[#141824] p-5 shadow-xl">
            <h3 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              تاریخچه یادداشت‌های پیشین
            </h3>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {historyQuery.data?.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">یادداشتی در تاریخچه ثبت نشده است.</p>
              ) : (
                historyQuery.data?.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDate(item.logDate)}
                    className={`w-full text-right p-3 rounded-xl border text-xs transition-all ${
                      item.logDate === date
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-200 font-semibold'
                        : 'border-slate-800 bg-[#0f121a] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold">{formatPersianDate(item.logDate)}</div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">{item.note}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
