import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Clock, Pause, Play, Square, Zap } from 'lucide-react'
import { finishFocus, getFocus, clearFocus } from '../api/focus'
import { ackPing, getSettings } from '../api/settings'
import { isPingDue } from '../lib/notify'

export function WorkLogPrompt() {
  const queryClient = useQueryClient()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const focusQuery = useQuery({
    queryKey: ['focus'],
    queryFn: () => getFocus(),
    refetchInterval: 5000,
  })

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings(),
    refetchInterval: 15000,
  })

  const finishMutation = useMutation({
    mutationFn: (markTaskDone?: boolean) =>
      finishFocus({
        markTaskDone,
        source: 'Timer',
        durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      }),
    onSuccess: () => {
      setElapsedSeconds(0)
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => clearFocus(),
    onSuccess: () => {
      setElapsedSeconds(0)
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
    },
  })

  const ackMutation = useMutation({
    mutationFn: () => ackPing(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const focus = focusQuery.data
  const settings = settingsQuery.data

  useEffect(() => {
    if (!focus?.active || !focus.startedAt) {
      setElapsedSeconds(0)
      return
    }
    const started = new Date(focus.startedAt).getTime()
    const updateElapsed = () => {
      const now = Date.now()
      setElapsedSeconds(Math.max(0, Math.floor((now - started) / 1000)))
    }
    updateElapsed()
    const timer = setInterval(updateElapsed, 1000)
    return () => clearInterval(timer)
  }, [focus?.active, focus?.startedAt])

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Active Focus banner
  if (focus?.active) {
    return (
      <aside 
        id="active-focus-bar"
        aria-label="نوار وضعیت تمرکز عمیق"
        className="sticky top-0 z-40 bg-[#0c0e15]/95 border-b border-white/[0.08] px-4 py-2.5 backdrop-blur-xl shadow-xl shadow-black/40"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs" dir="rtl">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                تمرکز عمیق
              </span>
              <span className="text-slate-600 font-mono">/</span>
              <span className="font-semibold text-slate-100 max-w-xs sm:max-w-md md:max-w-lg truncate">
                {focus.description || 'کار انتخابی'}
              </span>
            </div>
            <span className="font-mono px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-amber-300 font-semibold text-xs tracking-wider">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-complete-focus"
              type="button"
              disabled={finishMutation.isPending}
              onClick={() => finishMutation.mutate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium transition-all hover:border-emerald-500/50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>تکمیل و ثبت</span>
            </button>
            <button
              id="btn-log-focus"
              type="button"
              disabled={finishMutation.isPending}
              onClick={() => finishMutation.mutate(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] font-medium transition-all"
            >
              <Square className="w-3 h-3 fill-current opacity-70" />
              <span>ثبت لاگ و خروج</span>
            </button>
            <button
              id="btn-cancel-focus"
              type="button"
              onClick={() => clearMutation.mutate()}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 text-[11px] transition-colors"
            >
              لغو
            </button>
          </div>
        </div>
      </aside>
    )
  }

  // Ping due reminder
  if (settings && !settings.paused && isPingDue(settings.pingMinutes, settings.lastPingAt)) {
    return (
      <aside 
        id="ping-reminder-bar"
        aria-label="یادآوری ثبت کار"
        className="sticky top-0 z-40 bg-[#0f121a]/95 border-b border-amber-500/20 px-4 py-2 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs" dir="rtl">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium text-slate-200">
              زمان ثبت وضعیت فرا رسیده است؛ اکنون روی چه کاری متمرکز هستید؟
            </span>
          </div>
          <button
            id="btn-ack-ping"
            type="button"
            onClick={() => ackMutation.mutate()}
            className="px-3 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-medium transition-colors"
          >
            دیدم، ثبت می‌کنم
          </button>
        </div>
      </aside>
    )
  }

  return null
}
