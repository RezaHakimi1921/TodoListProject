import { useEffect, useState } from 'react'
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
  RotateCcw,
  ExternalLink
} from 'lucide-react'
import { deleteTask, updateTask, updateTaskStatus } from '../api/tasks'
import { requestTaskFocus } from '../lib/focusSwitch'
import { TagChipList } from './TagChips'
import { useTrashConfirm } from './ConfirmProvider'
import type { TaskItem, TaskStatus } from '../types'
import { FOCUS_PAUSED_REASON, isFocusPaused, statusLabel } from '../types'
import { taskJiraKey, taskJiraUrl } from '../lib/jira'

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
  const [statusError, setStatusError] = useState('')

  useEffect(() => {
    if (!showStatusMenu) return
    const close = () => setShowStatusMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showStatusMenu])

  const isDone = task.status === 'Done'
  const isPaused = isFocusPaused(task)
  const isDoing = task.status === 'Doing'
  const isStuck = task.status === 'Stuck' && !isPaused

  const applyStatus = (next: TaskStatus, stuckReason?: string) => {
    setStatusError('')
    const input =
      next === 'Stuck'
        ? { status: next, stuckReason: stuckReason || 'سخته' }
        : { status: next }
    void updateTaskStatus(task.id, input)
      .then(async (updated) => {
        if (updated.title !== task.title) {
          await updateTask(task.id, {
            title: task.title,
            status: updated.status,
            energyType: updated.energyType,
            tags: updated.tags.join(','),
            ownership: updated.ownership,
          })
        }
        setShowStatusMenu(false)
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
        void queryClient.invalidateQueries({ queryKey: ['task', task.id] })
      })
      .catch((err: Error) => setStatusError(err.message))
  }

  const focusMutation = useMutation({
    mutationFn: () => requestTaskFocus(task),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
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
    applyStatus(isDone ? 'Open' : 'Done')
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

            <span
              className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                task.ownership === 'Other'
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                  : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
              }`}
            >
              {task.ownership === 'Other' ? 'دیگری' : 'من'}
            </span>

            {/* Status Dropdown */}
            <div className="relative">
              <button
                id={`btn-status-dropdown-${task.id}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setShowStatusMenu((v) => !v)
                }}
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${
                  isDoing
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : isPaused
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : isStuck
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : isDone
                    ? 'bg-white/[0.04] text-slate-500 border-white/[0.06]'
                    : 'bg-white/[0.03] text-slate-300 border-white/[0.08] hover:border-white/20'
                }`}
              >
                <span>{statusLabel(task)}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </button>

              {showStatusMenu && (
                <div 
                  className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-white/10 bg-[#141722] p-1 shadow-2xl backdrop-blur-md"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => applyStatus('Open')}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.06] transition-colors"
                  >
                    باز برای اقدام
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatus('Doing')}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium"
                  >
                    در حال انجام
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatus('Stuck', FOCUS_PAUSED_REASON)}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-amber-300 hover:bg-amber-500/10 transition-colors font-medium"
                  >
                    در حال انجام متوقف شده
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatus('Stuck', 'سخته')}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
                  >
                    متوقف / گیر کرده
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatus('Done')}
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

          {taskJiraUrl(task) && (
            <a
              href={taskJiraUrl(task)!}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-100"
            >
              <ExternalLink className="w-3 h-3" />
              {taskJiraKey(task)}
            </a>
          )}

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

          {statusError && <p className="mt-2 text-[11px] text-rose-300">{statusError}</p>}
          <TagChipList tags={task.tags} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
          {!isDone && !isDoing && (
            <button
              id={`btn-start-focus-${task.id}`}
              type="button"
              onClick={() => focusMutation.mutate()}
              disabled={focusMutation.isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/[0.06] transition-all min-w-8"
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
