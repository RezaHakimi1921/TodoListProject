import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { listTaskDays } from '../api/tasks'
import { JalaliMonthCalendar } from './JalaliMonthCalendar'
import { addDaysIso, formatPersianDate, todayIso, yesterdayIso } from '../lib/dates'

export function PastDaysMenu() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; right: number; maxHeight: number } | null>(null)
  const today = todayIso()
  const yesterday = yesterdayIso()
  const selected = params.get('date') || today
  const viewing = selected === 'all' ? today : selected

  useEffect(() => {
    if (!open) return
    const updateBox = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const panelWidth = Math.min(352, window.innerWidth - 16)
      const right = Math.max(8, Math.min(window.innerWidth - rect.right, window.innerWidth - panelWidth - 8))
      const top = Math.min(rect.bottom + 8, window.innerHeight - 96)
      setBox({ top, right, maxHeight: Math.max(160, window.innerHeight - top - 8) })
    }
    updateBox()
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        const menu = document.getElementById('past-days-menu-panel')
        if (menu && menu.contains(event.target as Node)) return
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', updateBox)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', updateBox)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const daysQuery = useQuery({
    queryKey: ['task-days'],
    queryFn: listTaskDays,
    retry: 2,
    enabled: open,
  })

  const marked = useMemo(
    () => new Set((daysQuery.data ?? []).map((row) => row.date).filter(Boolean)),
    [daysQuery.data],
  )

  const go = (date: string) => {
    setOpen(false)
    if (date === today) navigate({ pathname: '/', search: '' })
    else if (date === 'all') navigate({ pathname: '/', search: '?date=all' })
    else navigate({ pathname: '/', search: `?date=${date}` })
  }

  const shift = (days: number) => {
    const next = addDaysIso(viewing, days)
    if (next > today) {
      go(today)
      return
    }
    go(next)
  }

  const chip = (active: boolean) =>
    `flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
      active
        ? 'border-amber-400/70 bg-amber-400 text-slate-950'
        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'
    }`

  const panel = open && box && (
    <div
      id="past-days-menu-panel"
      className="z-[80] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[#10131b] p-4 shadow-2xl"
      style={{ position: 'fixed', top: box.top, right: box.right, maxHeight: box.maxHeight }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <CalendarDays className="h-4 w-4 text-slate-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">مدیریت و ناوبری روزها</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">انتخاب روز با تقویم شمسی</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
          title="بستن"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mb-2 text-[11px] text-slate-500">جابجایی بین روزها</p>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={viewing >= today}
          className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-slate-300 hover:bg-white/[0.06] disabled:opacity-40"
        >
          <span className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            روز بعد
          </span>
        </button>
        <div className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-xs font-semibold text-slate-100">
          {formatPersianDate(viewing)}
        </div>
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-slate-300 hover:bg-white/[0.06]"
        >
          <span className="inline-flex items-center gap-1">
            روز قبل
            <ChevronLeft className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-[11px] text-slate-500">پرش مستقیم به تاریخ</p>
        <JalaliMonthCalendar value={viewing} max={today} marked={marked} onChange={go} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => go(today)} className={chip(selected === today)}>
          {selected === today ? <Check className="mb-0.5 inline h-3 w-3" /> : null} امروز
        </button>
        <button type="button" onClick={() => go(yesterday)} className={chip(selected === yesterday)}>
          دیروز
        </button>
        <button type="button" onClick={() => go('all')} className={chip(selected === 'all')}>
          همه روزها
        </button>
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-all ${
          open || selected !== today
            ? 'border-white/15 bg-white/[0.08] text-white shadow-sm'
            : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
        }`}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span>مدیریت روزها</span>
        <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
