import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  Play, 
  Edit3, 
  Trash2, 
  Zap, 
  Feather,
  ChevronDown
} from 'lucide-react'
import { updateTaskStatus, deleteTask } from '../api/tasks'
import { setFocus } from '../api/focus'
import { useTrashConfirm } from './ConfirmProvider'
import type { TaskItem, TaskStatus } from '../types'

interface Props {
  key?: string | number
  task: TaskItem
  onOpenDrawer: (task: TaskItem) => void
  onOpenAging: (task: TaskItem) => void
}

export function TaskCard({ task, onOpenDrawer, onOpenAging }: Props) {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const isDone = task.status === 'Done'
  const isDoing = task.status === 'Doing'
  const isStuck = task.status === 'Stuck'

  const statusMutation = useMutation({
    mutationFn: (newStatus: TaskStatus) => updateTaskStatus(task.id, { status: newStatus }),
    onSuccess: () => {
      setShowStatusMenu(false)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const focusMutation = useMutation({
    mutationFn: () =>
      setFocus({
        description: task.title,
        taskId: task.id,
        durationMinutes: 15,
        log: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const handleDelete = async () => {
    const ok = await askTrash(task.title)
    if (ok) {
      deleteMutation.mutate()
    }
  }

  const toggleDone = () => {
    statusMutation.mutate(isDone ? 'Open' : 'Done')
  }

  return (
    <div
      className={`group relative rounded-2xl border p-4 transition-all duration-200 ${
        isDone
          ? 'border-slate-800/60 bg-[#10131d]/60 opacity-65'
          : isDoing
          ? 'border-emerald-500/30 bg-emerald-500/[0.03] shadow-md shadow-emerald-500/5 hover:border-emerald-500/60'
          : isStuck
          ? 'border-rose-500/30 bg-rose-500/[0.03] hover:border-rose-500/60'
          : 'border-[#242c3f] bg-[#141824] hover:border-amber-500/40 hover:bg-[#161b29] shadow-lg shadow-black/20'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox / Done toggle */}
        <button
          type="button"
          onClick={toggleDone}
          className={`mt-0.5 p-1 rounded-lg transition-colors shrink-0 ${
            isDone
              ? 'text-emerald-400 hover:text-slate-400'
              : 'text-slate-500 hover:text-emerald-400'
          }`}
          title={isDone ? 'علامت به عنوان انجام نشده' : 'علامت به عنوان انجام شد'}
        >
          {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Energy Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                task.energyType === 'Deep'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {task.energyType === 'Deep' ? <Zap className="w-3 h-3" /> : <Feather className="w-3 h-3" />}
              {task.energyType === 'Deep' ? 'عمیق' : 'سبک'}
            </span>

            {/* Status Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatusMenu((v) => !v)}
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                  isDoing
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isStuck
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : isDone
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                <span>
                  {task.status === 'Open'
                    ? 'باز'
                    : task.status === 'Doing'
                    ? 'در حال انجام'
                    : task.status === 'Stuck'
                    ? 'متوقف / گیر'
                    : 'انجام شد'}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showStatusMenu && (
                <div 
                  className="absolute right-0 top-full mt-1.5 z-20 w-36 rounded-xl border border-slate-700 bg-[#161a27] p-1 shadow-2xl animate-in fade-in"
                  onMouseLeave={() => setShowStatusMenu(false)}
                >
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Open')}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    باز برای اقدام
                  </button>
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Doing')}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium"
                  >
                    در حال انجام
                  </button>
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Stuck')}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
                  >
                    متوقف / گیر کرده
                  </button>
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Done')}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    انجام شد
                  </button>
                </div>
              )}
            </div>

            {/* Aging Indicator */}
            {task.isAging && !isDone && (
              <button
                type="button"
                onClick={() => onOpenAging(task)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
                title="برای مشخص کردن علت توقف کلیک کنید"
              >
                <Clock className="w-3 h-3" />
                <span>{task.agingDays} روز باز</span>
              </button>
            )}
          </div>

          {/* Title */}
          <h3
            onClick={() => onOpenDrawer(task)}
            className={`text-sm font-semibold cursor-pointer transition-colors leading-relaxed ${
              isDone
                ? 'line-through text-slate-400'
                : 'text-slate-100 hover:text-amber-300'
            }`}
          >
            {task.title}
          </h3>

          {/* Stuck Reason callout if stuck */}
          {isStuck && task.stuckReason && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-xs text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>علت توقف: {task.stuckReason}</span>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400 font-mono"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hover Action Buttons */}
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
          {!isDone && (
            <button
              type="button"
              onClick={() => focusMutation.mutate()}
              disabled={focusMutation.isPending}
              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/30 transition-all"
              title="شروع تمرکز روی این کار"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenDrawer(task)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="ویرایش و تایم‌لاین"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="انتقال به سطل زباله"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
