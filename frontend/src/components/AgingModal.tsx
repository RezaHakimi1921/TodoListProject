import { STUCK_REASONS, type StuckReason, type TaskItem } from '../types'

interface Props {
  task: TaskItem | null
  onClose: () => void
  onChoose: (reason: StuckReason) => void
}

export function AgingModal({ task, onClose, onChoose }: Props) {
  if (!task) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-ember">Aging</p>
        <h2 className="mt-2 text-xl font-semibold">این {task.agingDays} روزه بازه. چرا؟</h2>
        <p className="mt-2 text-sm text-paper/60">{task.title}</p>
        <div className="mt-6 grid gap-2">
          {STUCK_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => onChoose(reason)}
              className="rounded-2xl border border-white/10 bg-ink-800 px-4 py-3 text-right transition hover:border-ember/50 hover:bg-ink-700"
            >
              {reason}
              {reason === 'مهم نیست دیگه' && (
                <span className="mr-2 text-xs text-paper/45">— بستن و Done</span>
              )}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-4 text-sm text-paper/45 hover:text-paper">
          بعداً
        </button>
      </div>
    </div>
  )
}
