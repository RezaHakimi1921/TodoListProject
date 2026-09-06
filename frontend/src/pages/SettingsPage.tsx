import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Settings, 
  Clock, 
  Bell, 
  PauseCircle, 
  PlayCircle, 
  Check, 
  Database, 
  Monitor,
  Sparkles
} from 'lucide-react'
import { getSettings, saveSettings, testToast } from '../api/settings'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [pingMinutes, setPingMinutes] = useState(15)
  const [paused, setPaused] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toastSent, setToastSent] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings(),
  })

  useEffect(() => {
    if (settingsQuery.data) {
      setPingMinutes(settingsQuery.data.pingMinutes)
      setPaused(settingsQuery.data.paused)
    }
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => saveSettings({ pingMinutes, paused }),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const toastMutation = useMutation({
    mutationFn: () => testToast(),
    onSuccess: () => {
      setToastSent(true)
      setTimeout(() => setToastSent(false), 2000)
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            تنظیمات سامانه و یادآوری‌ها (Settings)
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          شخصی‌سازی فواصل زمانی پاپ‌آپ تمرکز، وضعیت سیستم هشدار و اطلاعات پایگاه‌داده
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Ping Settings */}
        <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">تنظیمات پاپ‌آپ ویندوز (Work Ping)</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              فاصله بین هر یادآوری پاپ‌آپ تمرکز (دقیقه):
            </label>
            <div className="flex items-center gap-2">
              {[5, 10, 15, 20, 30, 45].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPingMinutes(val)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                    pingMinutes === val
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-[#0f121a] text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {val}m
                </button>
              ))}
              <div className="flex items-center gap-1 mr-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={pingMinutes}
                  onChange={(e) => setPingMinutes(Number(e.target.value))}
                  className="w-16 rounded-xl bg-[#0b0e16] border border-slate-700 px-2 py-2 text-xs text-white text-center font-mono focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400">دقیقه</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-2">وضعیت فعال بودن یادآوری‌ها:</label>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                paused
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {paused ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              <span>{paused ? 'یادآوری‌ها موقتاً متوقف هستند (Paused)' : 'یادآوری‌ها فعال هستند (Active)'}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => toastMutation.mutate()}
              className="px-4 py-2 rounded-xl bg-[#1a2030] hover:bg-[#232b40] text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
            >
              {toastMutation.isPending
                ? 'در حال باز شدن فرم...'
                : toastSent
                  ? 'ارسال شد!'
                  : 'تست اعلان Toast ویندوز'}
            </button>
            {toastMutation.isError && (
              <p className="text-[11px] text-rose-400">
                {toastMutation.error instanceof Error
                  ? toastMutation.error.message
                  : 'تست فرم ویندوز ناموفق بود.'}
              </p>
            )}

            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                saved ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
              <span>{saved ? 'ذخیره شد' : 'ذخیره تنظیمات'}</span>
            </button>
          </div>
        </div>

        {/* System Architecture & Info */}
        <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">معماری و یکپارچگی TaskOS</h2>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="p-3.5 rounded-2xl bg-[#0f121a] border border-slate-800 space-y-1">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                پایگاه داده محلی (SQLite)
              </span>
              <p className="text-slate-400 text-[11px]">
                اطلاعات تسک‌ها، لاگ‌ها و استودیو به شکل محلی در فایل دیتابیس SQLite ذخیره می‌شود و حریم خصوصی ۱۰۰٪ رعایت می‌گردد.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0f121a] border border-slate-800 space-y-1">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                فرم مستقل پاپ‌آپ (Windows Forms)
              </span>
              <p className="text-slate-400 text-[11px]">
                پنجره پاپ‌آپ تمرکز با C# و فناوری GDI+ بازطراحی شده است؛ از رزولوشن High-DPI، فونت شفاف وزیرمتن و رسم برداری مدرن پشتیبانی می‌کند.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
