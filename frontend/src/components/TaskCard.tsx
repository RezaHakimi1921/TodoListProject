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
  ChevronDown,
  RotateCcw
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
      id={`task-item-${task.id}`}
      className={`group relative rounded-xl border p-3.5 sm:p-4 transition-all duration-200 ${
        isDone
          ? 'border-white/[0.04] bg-black/20 opacity-55 hover:opacity-80'
          : isDoing
          ? 'border-white/20 bg-[#121623] shadow-md shadow-black/30'
          : isStuck
          ? 'border-rose-500/20 bg-[#161216]/60'
          : 'border-white/[0.07] bg-[#10131b] hover:border-white/[0.14] hover:bg-[#131622] shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Done Checkbox */}
        <button
          id={`btn-toggle-done-${task.id}`}
          type="button"
          onClick={toggleDone}
          className={`mt-0.5 p-0.5 rounded transition-colors shrink-0 ${
            isDone
              ? 'text-emerald-400'
              : 'text-slate-600 hover:text-slate-300'
          }`}
          title={isDone ? 'علامت به عنوان انجام‌نشده' : 'علامت به عنوان انجام‌شده'}
        >
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
          ) : (
            <Circle className="w-4 h-4 stroke-[1.75]" />
          )}
        </button>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Energy Indicator */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                task.energyType === 'Deep'
                  ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
              }`}
            >
              {task.energyType === 'Deep' ? <Zap className="w-3 h-3 text-amber-400" /> : <Feather className="w-3 h-3 text-slate-400" />}
              {task.energyType === 'Deep' ? 'تمرکز عمیق' : 'کار سبک'}
            </span>

            {/* Status Dropdown */}
            <div className="relative">
              <button
                id={`btn-status-dropdown-${task.id}`}
                type="button"
                onClick={() => setShowStatusMenu((v) => !v)}
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${
                  isDoing
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : isStuck
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : isDone
                    ? 'bg-white/[0.04] text-slate-500 border-white/[0.06]'
                    : 'bg-white/[0.03] text-slate-300 border-white/[0.08] hover:border-white/20'
                }`}
              >
                <span>
                  {task.status === 'Open'
                    ? 'باز'
                    : task.status === 'Doing'
                    ? 'در حال انجام'
                    : task.status === 'Stuck'
                    ? 'متوقف شده'
                    : 'تکمیل شد'}
                </span>
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </button>

              {showStatusMenu && (
                <div 
                  className="absolute right-0 top-full mt-1.5 z-20 w-36 rounded-xl border border-white/10 bg-[#141722] p-1 shadow-2xl backdrop-blur-md"
                  onMouseLeave={() => setShowStatusMenu(false)}
                >
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Open')}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.06] transition-colors"
                  >
                    باز برای اقدام
                  </button>
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Doing')}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium"
                  >
                    در حال انجام
                  </button>
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Stuck')}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
                  >
                    متوقف / گیر کرده
                  </button>
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate('Done')}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-white/[0.06] transition-colors"
                  >
                    انجام شد
                  </button>
                </div>
              )}
            </div>

            {/* Rollover badge if carried over from a previous day */}
            {task.rolledOver && !isDone && (
              <span 
                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-400"
                title="این کار از روزهای قبل منتقل شده است"
              >
                <RotateCcw className="w-2.5 h-2.5 opacity-70" />
                <span>انتقال‌یافته از قبل</span>
              </span>
            )}

            {/* Aging Indicator */}
            {task.isAging && !isDone && (
              <button
                type="button"
                onClick={() => onOpenAging(task)}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/25 hover:bg-amber-400/20 transition-colors"
                title="برای مشخص کردن علت راکد ماندن کلیک کنید"
              >
                <Clock className="w-2.5 h-2.5" />
                <span>{task.agingDays} روز راکد</span>
              </button>
            )}
          </div>

          {/* Title */}
          <h3
            onClick={() => onOpenDrawer(task)}
            className={`text-[13.5px] font-medium cursor-pointer transition-colors leading-relaxed ${
              isDone
                ? 'line-through text-slate-500'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            {task.title}
          </h3>

          {(task.checklistTotal ?? 0) > 0 && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              {task.checklistDone ?? 0} از {task.checklistTotal} انجام شد
            </p>
          )}

          {/* Stuck Reason Callout */}
          {isStuck && task.stuckReason && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/[0.08] border border-rose-500/20 px-2.5 py-1 text-xs text-rose-300/90">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <span>علت توقف: {task.stuckReason}</span>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400 font-mono"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
          {!isDone && (
            <button
              id={`btn-start-focus-${task.id}`}
              type="button"
              onClick={() => focusMutation.mutate()}
              disabled={focusMutation.isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/[0.06] transition-all"
              title="شروع تمرکز عمیق روی این کار"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            id={`btn-edit-task-${task.id}`}
            type="button"
            onClick={() => onOpenDrawer(task)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            title="ویرایش جزئیات و یادداشت‌ها"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            id={`btn-delete-task-${task.id}`}
            type="button"
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="انتقال به سطل زباله"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
