import { STATUS_LABEL, type TaskItem, type TaskStatus } from '../types'

const statusTone: Record<string, string> = {
  Open: 'bg-white/10 text-paper/80',
  Doing: 'bg-moss/25 text-emerald-100',
  Stuck: 'bg-rose-500/20 text-rose-100',
  Done: 'bg-white/5 text-paper/40',
}

interface Props {
  task: TaskItem
  onOpen: (task: TaskItem) => void
  onAgingClick: (task: TaskItem) => void
  onStatus: (task: TaskItem, status: TaskStatus) => void
  onDelete: (task: TaskItem) => void
}

export function TaskCard({ task, onOpen, onAgingClick, onStatus, onDelete }: Props) {
  return (
    <article className="rounded-3xl border border-white/10 bg-ink-800/80 p-4 transition hover:border-white/25">
      <button type="button" onClick={() => onOpen(task)} className="block w-full text-right">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-base font-medium ${task.status === 'Done' ? 'text-paper/45 line-through' : ''}`}>
            {task.title}
          </h3>
          {task.isAging && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onAgingClick(task)
              }}
              className="shrink-0 rounded-full bg-ember/20 px-2.5 py-1 text-xs text-amber-200 ring-1 ring-ember/40"
            >
              {task.agingDays} روزه
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-paper/40">برای ویرایش کلیک کن</p>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {(['Open', 'Doing', 'Done'] as TaskStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatus(task, status)}
            className={`rounded-full px-2 py-1 ${
              task.status === status ? statusTone[status] + ' ring-1 ring-white/30' : 'bg-white/5 text-paper/45'
            }`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
        {task.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-white/5 px-2 py-1 text-paper/55">
            #{tag}
          </span>
        ))}
        <button
          type="button"
          onClick={() => onDelete(task)}
          className="mr-auto rounded-full px-2 py-1 text-rose-200"
        >
          حذف
        </button>
      </div>
    </article>
  )
}
