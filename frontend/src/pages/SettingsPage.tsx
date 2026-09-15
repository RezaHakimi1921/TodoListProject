import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Settings,
  Bell,
  Database,
  Monitor,
  Sparkles,
} from 'lucide-react'
import { PhoneAccessCard } from '../components/PhoneAccessCard'
import { ThemeToggle } from '../components/ThemeToggle'
import { testToast } from '../api/settings'

export function SettingsPage() {
  const [toastSent, setToastSent] = useState(false)

  const toastMutation = useMutation({
    mutationFn: () => testToast(),
    onSuccess: () => {
      setToastSent(true)
      setTimeout(() => setToastSent(false), 2000)
    },
  })

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            تنظیمات سامانه
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          ظاهر برنامه، تست اعلان، و اطلاعات پایگاه‌داده. یادآور دوره‌ای دیگر فعال نیست.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">ظاهر برنامه</h2>
          </div>
          <p className="text-xs text-slate-400">حالت روشن برای روز و حالت تیره برای شب. انتخاب روی همین مرورگر می‌ماند.</p>
          <ThemeToggle />
        </div>

        <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">تست اعلان</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            یادآور خودکار هر چند دقیقه حذف شده. فقط برای اطمینان از مسیر اعلان، می‌توانی یک تست بفرستی.
          </p>
          <button
            type="button"
            onClick={() => toastMutation.mutate()}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 text-xs font-bold transition-colors"
          >
            {toastMutation.isPending
              ? 'در حال ارسال...'
              : toastSent
                ? 'ارسال شد!'
                : 'تست نوتیف'}
          </button>
          {toastMutation.isError && (
            <p className="text-[11px] text-rose-400">
              {toastMutation.error instanceof Error
                ? toastMutation.error.message
                : 'تست اعلان ناموفق بود.'}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">معماری و یکپارچگی TaskOS</h2>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <PhoneAccessCard />

            <div className="p-3.5 rounded-2xl bg-[#0f121a] border border-slate-800 space-y-1">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                پایگاه داده محلی (SQLite)
              </span>
              <p className="text-slate-400 text-[11px]">
                اطلاعات تسک‌ها، لاگ‌ها و استودیو به شکل محلی در فایل دیتابیس SQLite ذخیره می‌شود و حریم خصوصی ۱۰۰٪ رعایت می‌گردد.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
