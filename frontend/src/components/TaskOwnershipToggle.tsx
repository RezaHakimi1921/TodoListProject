import { User, Users } from 'lucide-react'
import type { TaskOwnership } from '../types'

interface Props {
  value: TaskOwnership
  onChange: (next: TaskOwnership) => void
  disabled?: boolean
}

export function TaskOwnershipToggle({ value, onChange, disabled }: Props) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5">این کار برای کیست؟</label>
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0b0e16] border border-[#2b354d]">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('Mine')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === 'Mine'
              ? 'bg-sky-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3 h-3" />
          <span>من</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('Other')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === 'Other'
              ? 'bg-violet-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>دیگری</span>
        </button>
      </div>
    </div>
  )
}
