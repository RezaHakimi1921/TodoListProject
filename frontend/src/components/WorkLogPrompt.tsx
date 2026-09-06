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
        aria-label="نوار وضعیت تمرکز عمیق"
        className="sticky top-0 z-40 bg-gradient-to-r from-amber-500/20 via-[#181d2c] to-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 backdrop-blur-md shadow-lg"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs" dir="rtl">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-current" />
              در حال تمرکز عمیق:
            </span>
            <span className="font-medium text-slate-100 max-w-xs sm:max-w-md truncate">
              {focus.description || 'کار انتخابی'}
            </span>
            <span className="font-mono px-2.5 py-0.5 rounded-md bg-black/40 border border-amber-500/30 text-amber-300 font-bold text-sm">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={finishMutation.isPending}
              onClick={() => finishMutation.mutate(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-sm transition-all"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>پایان و تکمیل کار</span>
            </button>
            <button
              type="button"
              disabled={finishMutation.isPending}
              onClick={() => finishMutation.mutate(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm transition-all"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>ثبت لاگ و خروج</span>
            </button>
            <button
              type="button"
              onClick={() => clearMutation.mutate()}
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 text-[11px]"
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
        aria-label="یادآوری ثبت کار"
        className="sticky top-0 z-40 bg-gradient-to-r from-amber-600/25 via-[#1a1f30] to-amber-600/15 border-b border-amber-500/40 px-4 py-2 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs" dir="rtl">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold text-amber-200">
              زمان ثبت وضعیت فرا رسیده است! الان روی چه کاری مشغول هستی؟
            </span>
          </div>
          <button
            type="button"
            onClick={() => ackMutation.mutate()}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
          >
            دیدم، ثبت می‌کنم
          </button>
        </div>
      </aside>
    )
  }

  return null
}
