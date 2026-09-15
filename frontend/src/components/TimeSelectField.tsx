import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Clock } from 'lucide-react'
import { toFaDigits } from '../lib/jalali'

interface Props {
  hour: string
  minute: string
  onHourChange: (value: string) => void
  onMinuteChange: (value: string) => void
  /** Portal stacking — raise above modals (default 80) */
  zIndex?: number
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

type OpenKind = 'hour' | 'minute' | null

export function TimeSelectField({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  zIndex = 80,
}: Props) {
  const [open, setOpen] = useState<OpenKind>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 160 })
  const root = useRef<HTMLDivElement>(null)
  const hourBtn = useRef<HTMLButtonElement>(null)
  const minuteBtn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const place = () => {
      const el = open === 'hour' ? hourBtn.current : minuteBtn.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const width = Math.max(rect.width, 148)
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8,
      )
      const panelH = 220
      const below = rect.bottom + 8
      const above = rect.top - panelH - 8
      const top = below + panelH > window.innerHeight && above > 8 ? above : below
      setCoords({ top, left, width })
    }

    place()

    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (root.current?.contains(target) || panel.current?.contains(target)) return
      setOpen(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }

    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !panel.current) return
    const selected = panel.current.querySelector<HTMLElement>('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'center' })
  }, [open, hour, minute])

  const options = open === 'hour' ? HOURS : MINUTES
  const selected = open === 'hour' ? hour : minute

  const trigger = (
    kind: 'hour' | 'minute',
    label: string,
    value: string,
    btnRef: RefObject<HTMLButtonElement | null>,
  ) => (
    <div className="min-w-0 flex-1">
      <label className="mb-1 block text-[11px] text-slate-400">{label}</label>
      <button
        ref={btnRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => (current === kind ? null : kind))
        }}
        className={`flex min-h-[2.5rem] w-full items-center justify-between gap-2 rounded-xl border bg-black/30 px-3 py-2 text-sm transition-colors ${
          open === kind
            ? 'border-violet-400/50 text-violet-100'
            : 'border-white/10 text-slate-100 hover:border-violet-400/30'
        }`}
      >
        <span className="font-semibold tabular-nums">{toFaDigits(value)}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${
            open === kind ? 'rotate-180 text-violet-300' : ''
          }`}
        />
      </button>
    </div>
  )

  return (
    <div ref={root} className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <Clock className="h-3.5 w-3.5 text-violet-300" />
        <span>ساعت یادآوری</span>
        <span className="ms-auto font-semibold tabular-nums text-violet-200">
          {toFaDigits(`${hour}:${minute}`)}
        </span>
      </div>
      <div className="flex gap-2">
        {trigger('hour', 'ساعت', hour, hourBtn)}
        {trigger('minute', 'دقیقه', minute, minuteBtn)}
      </div>

      {open
        ? createPortal(
            <div
              ref={panel}
              className="fixed overflow-hidden rounded-xl border border-violet-500/25 bg-[#10131b] shadow-2xl shadow-black/50"
              style={{ top: coords.top, left: coords.left, width: coords.width, zIndex }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/5 px-3 py-2 text-[11px] font-medium text-slate-400">
                {open === 'hour' ? 'انتخاب ساعت' : 'انتخاب دقیقه'}
              </div>
              <div className="max-h-[13.5rem] overflow-y-auto p-1.5">
                <div className="grid grid-cols-4 gap-1">
                  {options.map((option) => {
                    const active = option === selected
                    return (
                      <button
                        key={option}
                        type="button"
                        data-selected={active ? 'true' : 'false'}
                        onClick={() => {
                          if (open === 'hour') onHourChange(option)
                          else onMinuteChange(option)
                          setOpen(null)
                        }}
                        className={`rounded-lg px-1 py-2 text-center text-sm tabular-nums transition-colors ${
                          active
                            ? 'bg-violet-500 text-white shadow-sm shadow-violet-900/40'
                            : 'text-slate-200 hover:bg-violet-500/15 hover:text-violet-100'
                        }`}
                      >
                        {toFaDigits(option)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
