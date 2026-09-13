import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  isoToJalali,
  jalaliMonthLength,
  jalaliToIso,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  saturdayIndex,
  shiftJalaliMonth,
  toFaDigits,
} from '../lib/jalali'

interface Props {
  value: string
  max?: string
  marked?: Set<string>
  compact?: boolean
  onChange: (iso: string) => void
}

export function JalaliMonthCalendar({ value, max, marked, compact, onChange }: Props) {
  const selected = isoToJalali(value)
  const [view, setView] = useState(selected)

  useEffect(() => {
    setView(isoToJalali(value))
  }, [value])

  const cells = useMemo(() => {
    const length = jalaliMonthLength(view.jy, view.jm)
    const firstIso = jalaliToIso(view.jy, view.jm, 1)
    const offset = saturdayIndex(firstIso)
    const rows: Array<{ iso: string; day: number } | null> = Array.from({ length: offset }, () => null)
    for (let day = 1; day <= length; day += 1) {
      rows.push({ iso: jalaliToIso(view.jy, view.jm, day), day })
    }
    return rows
  }, [view.jy, view.jm])

  return (
    <div className={compact ? '' : 'rounded-xl border border-white/10 bg-black/20 p-3'}>
      <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
        <button
          type="button"
          onClick={() =>
            setView((current) => {
              const next = shiftJalaliMonth(current.jy, current.jm, 1)
              return { ...next, jd: Math.min(current.jd, jalaliMonthLength(next.jy, next.jm)) }
            })
          }
          className="rounded-md p-0.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          title="ماه بعد"
        >
          <ChevronRight className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
        <p className={`font-semibold text-slate-100 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {JALALI_MONTHS[view.jm - 1]} {toFaDigits(view.jy)}
        </p>
        <button
          type="button"
          onClick={() =>
            setView((current) => {
              const next = shiftJalaliMonth(current.jy, current.jm, -1)
              return { ...next, jd: Math.min(current.jd, jalaliMonthLength(next.jy, next.jm)) }
            })
          }
          className="rounded-md p-0.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          title="ماه قبل"
        >
          <ChevronLeft className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </div>
      <div className={`grid grid-cols-7 text-center ${compact ? 'gap-px' : 'gap-1'}`}>
        {JALALI_WEEKDAYS.map((day) => (
          <span key={day} className={`text-slate-500 ${compact ? 'py-0.5 text-[9px]' : 'py-1 text-[10px]'}`}>
            {day}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <span key={`e-${index}`} />
          const disabled = Boolean(max && cell.iso > max)
          const isSelected = cell.iso === value
          const hasTasks = marked?.has(cell.iso)
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(cell.iso)}
              className={`relative font-medium transition-colors ${
                compact ? 'h-6 rounded-md text-[10px]' : 'h-8 rounded-lg text-[11px]'
              } ${
                isSelected
                  ? 'bg-amber-400 text-slate-950'
                  : disabled
                    ? 'text-slate-600'
                    : 'text-slate-200 hover:bg-white/[0.08]'
              }`}
            >
              {toFaDigits(cell.day)}
              {hasTasks ? (
                <span
                  className={`absolute left-1/2 -translate-x-1/2 rounded-full ${
                    compact ? 'bottom-0 h-0.5 w-0.5' : 'bottom-0.5 h-1 w-1'
                  } ${isSelected ? 'bg-slate-950' : 'bg-amber-400'}`}
                />
              ) : null}
            </button>
          )
        })}
      </div>
      {compact ? null : <p className="mt-2 text-[10px] text-slate-500">نقطهٔ زرد یعنی آن روز کار ثبت شده.</p>}
    </div>
  )
}
