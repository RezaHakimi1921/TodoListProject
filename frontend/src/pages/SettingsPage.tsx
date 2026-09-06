import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_PING_MINUTES, getSettings, saveSettings, testToast } from '../api/settings'

const EXTENSION_PATH = 'E:\\TodoListProject\\extension'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [minutes, setMinutes] = useState(DEFAULT_PING_MINUTES)
  const [copied, setCopied] = useState(false)
  const query = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const paused = query.data?.paused ?? false

  useEffect(() => {
    if (query.data) setMinutes(query.data.pingMinutes)
  }, [query.data])

  const saveMutation = useMutation({
    mutationFn: (input: { pingMinutes: number; paused: boolean }) => saveSettings(input),
    onSuccess: (saved) => {
      setMinutes(saved.pingMinutes)
      void queryClient.setQueryData(['settings'], saved)
    },
  })

  const toastMutation = useMutation({
    mutationFn: testToast,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  const setSystemOn = (on: boolean) => {
    saveMutation.mutate({ pingMinutes: minutes, paused: !on })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">تنظیمات</h1>
        <p className="mt-2 text-sm text-paper/50">روشن/خاموش سیستم، فاصله نوتیف و محل اکستنشن.</p>
      </div>

      <section className={`rounded-[2rem] border p-6 ${paused ? 'border-rose-400/40 bg-rose-950/20' : 'border-emerald-400/30 bg-ink-900/60'}`}>
        <p className="text-xs tracking-[0.2em] text-paper/40">وضعیت سیستم</p>
        <h2 className="mt-2 text-2xl font-semibold">{paused ? 'سیستم خاموش است' : 'سیستم روشن است'}</h2>
        <p className="mt-2 text-sm text-paper/55">
          برای ناهار یا رفتن از پشت کامپیوتر، برنامه را نبند. همین‌جا سیستم را خاموش کن تا پنجره وسط صفحه نیاید.
          وقتی برگشتی، روشنش کن.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSystemOn(true)}
            disabled={saveMutation.isPending}
            className={`rounded-3xl px-4 py-4 text-lg font-semibold ${
              !paused ? 'bg-moss text-white' : 'bg-ink-800 text-paper/60'
            }`}
          >
            روشن
          </button>
          <button
            type="button"
            onClick={() => setSystemOn(false)}
            disabled={saveMutation.isPending}
            className={`rounded-3xl px-4 py-4 text-lg font-semibold ${
              paused ? 'bg-rose-500 text-white' : 'bg-ink-800 text-paper/60'
            }`}
          >
            خاموش
          </button>
        </div>
        {saveMutation.isSuccess && <p className="mt-3 text-sm text-emerald-200">ذخیره شد.</p>}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
        <label className="block text-sm text-paper/60">
          هر چند دقیقه یک‌بار بپرسد کار را ثبت کردی؟
          <input
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value) || DEFAULT_PING_MINUTES)}
            onBlur={() => saveMutation.mutate({ pingMinutes: minutes, paused })}
            className="mt-2 w-32 rounded-2xl border border-white/10 bg-ink-950 px-3 py-2 text-lg"
          />
        </label>
        <p className="mt-3 text-sm text-paper/40">
          پیش‌فرض ۱۰ دقیقه. یک پنجره وسط صفحه می‌آید — حتی اگر تب بسته باشد. با روشن شدن ویندوز، TaskOS خودش بالا می‌آید.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => saveMutation.mutate({ pingMinutes: minutes, paused })}
            className="rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950"
          >
            ذخیره فاصله پالس
          </button>
          <button
            type="button"
            onClick={() => toastMutation.mutate()}
            className="rounded-2xl bg-ink-800 px-4 py-2 text-sm"
          >
            تست نوتیف ویندوز
          </button>
        </div>
        {toastMutation.isSuccess && <p className="mt-2 text-sm text-emerald-200">نوتیف باید گوشه ویندوز آمده باشد.</p>}
        {toastMutation.isError && <p className="mt-2 text-sm text-rose-300">نوتیف ویندوز ارسال نشد.</p>}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
        <h2 className="text-lg font-semibold">اکستنشن کروم</h2>
        <p className="mt-2 text-sm text-paper/50">
          مسیر درست <span className="text-paper">extension</span> است، نه extesino. پوشه همین‌جاست:
        </p>
        <p className="mt-3 rounded-2xl bg-ink-950 px-4 py-3 font-mono text-sm dir-ltr text-left">{EXTENSION_PATH}</p>
        <ol className="mt-4 list-decimal space-y-2 pr-5 text-sm text-paper/70">
          <li>Chrome را باز کن و برو به chrome://extensions</li>
          <li>Developer mode را روشن کن</li>
          <li>Load unpacked را بزن و پوشه بالا را انتخاب کن</li>
          <li>یا فایل install.bat داخل همان پوشه را اجرا کن</li>
        </ol>
        <p className="mt-3 text-sm text-paper/40">
          اکستنشن برای ثبت سریع از آیکون کروم است. زمان‌بندی نوتیف را API انجام می‌دهد؛ لازم نیست تب TaskOS باز بماند.
        </p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(EXTENSION_PATH).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }}
          className="mt-4 rounded-2xl bg-paper px-4 py-2 text-sm font-semibold text-ink-950"
        >
          {copied ? 'کپی شد' : 'کپی مسیر پوشه'}
        </button>
      </section>
    </div>
  )
}
