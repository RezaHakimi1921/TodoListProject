import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, X } from 'lucide-react'
import { formatPersianDate } from '../lib/dates'
import { JalaliMonthCalendar } from './JalaliMonthCalendar'

interface Props {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
}

const PANEL_WIDTH = 248
const PANEL_HEIGHT = 230

export function JalaliDateField({ value, onChange, placeholder = 'انتخاب تاریخ' }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const place = () => {
      const el = button.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const left = Math.min(
        Math.max(8, rect.right - PANEL_WIDTH),
        window.innerWidth - PANEL_WIDTH - 8,
      )
      const below = rect.bottom + 8
      const above = rect.top - PANEL_HEIGHT - 8
      const top = below + PANEL_HEIGHT > window.innerHeight && above > 8 ? above : below
      setCoords({ top, left })
    }

    place()
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (box.current?.contains(target) || panel.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', onDoc)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <div className="flex items-center gap-1">
        <button
          ref={button}
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-[2.25rem] w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-right text-xs text-slate-100 hover:border-amber-400/30"
        >
          <span className={value ? 'text-slate-100' : 'text-slate-500'}>
            {value ? formatPersianDate(value) : placeholder}
          </span>
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-amber-300" />
        </button>
        {value ? (
          <button
            type="button"
            title="پاک کردن تاریخ"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {open
        ? createPortal(
            <div
              ref={panel}
              className="fixed z-[80] w-[15.5rem] rounded-xl border border-white/10 bg-[#10131b] p-2 shadow-2xl"
              style={{ top: coords.top, left: coords.left }}
            >
              <JalaliMonthCalendar
                compact
                value={value}
                onChange={(iso) => {
                  onChange(iso)
                  setOpen(false)
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
