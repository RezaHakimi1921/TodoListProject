import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { listTaskDays } from '../api/tasks'
import { getRelativeDayLabel, todayIso } from '../lib/dates'

function monthLabel(yearMonth: string) {
  const date = new Date(`${yearMonth}-01T12:00:00`)
  return new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(date)
}

export function PastDaysMenu() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; right: number } | null>(null)
  const today = todayIso()
  const selected = params.get('date') || today

  useEffect(() => {
    if (!open) return
    const updateBox = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      setBox({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) })
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
  })

  const groups = useMemo(() => {
    const rows = (daysQuery.data ?? []).filter((row) => row.date && row.date !== today)
    const months = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = row.date.slice(0, 7)
      const list = months.get(key) ?? []
      list.push(row)
      months.set(key, list)
    }
    return [...months.entries()]
  }, [daysQuery.data, today])

  const go = (search: string) => {
    setOpen(false)
    navigate({ pathname: '/', search })
  }

  const panel = open && box && (
    <div
      id="past-days-menu-panel"
      className="z-[80] w-80 max-h-[28rem] overflow-y-auto rounded-xl border border-amber-400/25 bg-[#12151e] p-2 shadow-2xl"
      style={{ position: 'fixed', top: box.top, right: box.right }}
    >
      {daysQuery.isPending && <p className="px-3 py-4 text-xs text-slate-500">در حال خواندن روزها...</p>}
      {daysQuery.isError && (
        <p className="px-3 py-4 text-xs text-rose-300">لیست روزها لود نشد. صفحه را رفرش کن.</p>
      )}
      <button
        type="button"
        onClick={() => go('?date=all')}
        className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-xs bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
      >
        <span>همه روزها</span>
      </button>
      {groups.length === 0 && !daysQuery.isError && !daysQuery.isPending && (
        <p className="px-3 py-4 text-xs text-slate-500">هنوز روز گذشته‌ای ثبت نشده.</p>
      )}
      {groups.map(([month, rows]) => (
        <section key={month} className="mb-2">
          <p className="px-2 py-1 text-[10px] tracking-wide text-amber-300/80">{monthLabel(month)}</p>
          <div className="space-y-1">
            {rows.map((row) => (
              <button
                key={row.date}
                type="button"
                onClick={() => go(`?date=${row.date}`)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-xs ${
                  selected === row.date ? 'bg-amber-400/20 text-amber-100' : 'bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'
                }`}
              >
                <span>{getRelativeDayLabel(row.date)}</span>
                <span className="text-[10px] text-slate-400">
                  {row.done}/{row.total} انجام
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
          selected !== today
            ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.1] shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
        }`}
      >
        <CalendarDays className="w-3.5 h-3.5 shrink-0 opacity-80" />
        <span>روزهای گذشته</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
