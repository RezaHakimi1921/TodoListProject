import { Briefcase, Calendar, Coffee } from 'lucide-react'
import { formatMinutesLabel } from '../lib/dates'
import type { TimeBuckets } from '../lib/workTimeBuckets'

const CARDS = [
  {
    key: 'work' as const,
    label: 'کار',
    hint: 'روی تسک و مسئله',
    Icon: Briefcase,
    tone: 'text-emerald-200',
    bar: 'bg-emerald-400',
    chip: 'border-emerald-500/20 bg-emerald-500/10',
  },
  {
    key: 'meeting' as const,
    label: 'جلسه',
    hint: 'جلسه و دیلی',
    Icon: Calendar,
    tone: 'text-sky-200',
    bar: 'bg-sky-400',
    chip: 'border-sky-500/20 bg-sky-500/10',
  },
  {
    key: 'rest' as const,
    label: 'نهار و استراحت',
    hint: 'وقفه و ناهار',
    Icon: Coffee,
    tone: 'text-amber-200',
    bar: 'bg-amber-400',
    chip: 'border-amber-500/20 bg-amber-500/10',
  },
]

interface Props {
  buckets: TimeBuckets
  compact?: boolean
}

export function DayTimeTotals({ buckets, compact }: Props) {
  const max = Math.max(buckets.total, 1)

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {CARDS.map((card) => {
          const minutes = buckets[card.key]
          return (
            <div key={card.key} className={`rounded-xl border px-3 ${compact ? 'py-2' : 'py-2.5'} ${card.chip}`}>
              <p className={`flex items-center gap-1.5 text-[11px] font-semibold ${card.tone}`}>
                <card.Icon className="h-3.5 w-3.5" />
                {card.label}
              </p>
              <p className={`font-black text-white ${compact ? 'mt-0.5 text-sm' : 'mt-1 text-base'}`}>
                {formatMinutesLabel(minutes)}
              </p>
              {!compact ? <p className="mt-0.5 text-[10px] text-slate-500">{card.hint}</p> : null}
            </div>
          )
        })}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>سهم از کل روز</span>
          <span className="font-semibold text-slate-300">{formatMinutesLabel(buckets.total)}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
          {CARDS.map((card) => {
            const minutes = buckets[card.key]
            if (minutes <= 0) return null
            return (
              <span
                key={card.key}
                className={card.bar}
                style={{ width: `${(minutes / max) * 100}%` }}
                title={`${card.label}: ${formatMinutesLabel(minutes)}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
