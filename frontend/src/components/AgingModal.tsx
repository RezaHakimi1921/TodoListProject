import { Clock, HelpCircle, X } from 'lucide-react'
import { STUCK_REASON_LABEL, STUCK_REASONS, type StuckReason, type TaskItem } from '../types'

interface Props {
  task: TaskItem | null
  onClose: () => void
  onChoose: (reason: StuckReason) => void
}

export function AgingModal({ task, onClose, onChoose }: Props) {
  if (!task) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#2b3348] bg-[#141824] p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                بررسی توقف کار
              </span>
              <h2 className="mt-1 text-lg font-bold text-slate-100">
                این کار {task.agingDays} روز باز مانده؛ دلیل توقف چیست؟
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-slate-300 font-medium">
          {task.title}
        </div>

        <div className="mt-5 space-y-2.5">
          <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            یک گزینه را انتخاب کنید تا وضعیت بروزرسانی شود:
          </p>
          {STUCK_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => onChoose(reason)}
              className="w-full text-right p-3.5 rounded-xl border border-[#262f44] bg-[#181d2c] hover:bg-[#1e2538] hover:border-amber-500/50 transition-all text-sm text-slate-200 font-medium flex items-center justify-between group"
            >
              <span>{STUCK_REASON_LABEL[reason]}</span>
              {reason === 'مهم نیست دیگه' ? (
                <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  بستن و تکمیل
                </span>
              ) : (
                <span className="text-xs text-slate-500 group-hover:text-amber-400 transition-colors">
                  ثبت دلیل ←
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            بعداً بررسی می‌کنم
          </button>
        </div>
      </div>
    </div>
  )
}
