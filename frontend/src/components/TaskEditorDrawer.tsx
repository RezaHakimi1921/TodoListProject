import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  X, 
  Trash2, 
  Tag, 
  Zap, 
  Feather, 
  ExternalLink,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { deleteTask, updateTask, updateTaskStatus } from '../api/tasks'
import { useTrashConfirm } from './ConfirmProvider'
import { EntityWorkLogs } from './EntityWorkLogs'
import { TaskChecklist } from './TaskChecklist'
import { TaskCommentThread } from './TaskCommentThread'
import { TaskOwnershipToggle } from './TaskOwnershipToggle'
import { STUCK_REASONS, type EnergyType, type TaskItem, type TaskOwnership, type TaskStatus } from '../types'

interface Props {
  task: TaskItem | null
  onClose: () => void
}

export function TaskEditorDrawer({ task, onClose }: Props) {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>('Open')
  const [energyType, setEnergyType] = useState<EnergyType>('Light')
  const [ownership, setOwnership] = useState<TaskOwnership>('Mine')
  const [tags, setTags] = useState('')
  const [stuckReason, setStuckReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setStatus(task.status)
    setEnergyType(task.energyType)
    setOwnership(task.ownership === 'Other' ? 'Other' : 'Mine')
    setTags(task.tags.join(', '))
    setStuckReason(task.stuckReason || '')
    setError('')
  }, [task])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTask(task!.id, {
        title: title.trim(),
        status,
        energyType,
        tags,
        ownership,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', task?.id] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: (next: TaskStatus) => 
      updateTaskStatus(task!.id, { 
        status: next, 
        stuckReason: next === 'Stuck' ? stuckReason : undefined 
      }),
    onSuccess: (updated) => {
      setStatus(updated.status)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const ownershipMutation = useMutation({
    mutationFn: (next: TaskOwnership) =>
      updateTask(task!.id, {
        title: title.trim() || task!.title,
        status,
        energyType,
        tags,
        ownership: next,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', task?.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      onClose()
    },
  })

  const handleDeleteTask = async () => {
    if (!task) return
    const ok = await askTrash(task.title)
    if (ok) {
      deleteMutation.mutate()
    }
  }

  if (!task) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-xl h-full bg-[#111520] border-r border-[#262f44] p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                کار #{task.id}
              </span>
              <Link
                to={`/tasks/${task.id}`}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                title="مشاهده صفحه اختصاصی"
              >
                <span>صفحه کامل</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="mt-5 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">عنوان کار</label>
              <textarea
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Status & Energy Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">وضعیت</label>
                <select
                  value={status}
                  onChange={(e) => {
                    const next = e.target.value as TaskStatus
                    setStatus(next)
                    statusMutation.mutate(next)
                  }}
                  className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="Open">باز برای اقدام</option>
                  <option value="Doing">در حال انجام</option>
                  <option value="Stuck">متوقف / گیر کرده</option>
                  <option value="Done">تکمیل شده</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">نوع تمرکز (انرژی)</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0b0e16] border border-[#2b354d]">
                  <button
                    type="button"
                    onClick={() => setEnergyType('Deep')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      energyType === 'Deep'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>عمیق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnergyType('Light')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      energyType === 'Light'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Feather className="w-3 h-3" />
                    <span>سبک</span>
                  </button>
                </div>
              </div>
            </div>

            <TaskOwnershipToggle
              value={ownership}
              disabled={ownershipMutation.isPending}
              onChange={(next) => {
                setOwnership(next)
                ownershipMutation.mutate(next)
              }}
            />

            {/* Stuck Reason if stuck */}
            {status === 'Stuck' && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <label className="block text-xs font-semibold text-rose-300 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  دلیل توقف کار:
                </label>
                <select
                  value={stuckReason}
                  onChange={(e) => {
                    setStuckReason(e.target.value)
                    updateTaskStatus(task.id, { status: 'Stuck', stuckReason: e.target.value })
                  }}
                  className="w-full rounded-lg bg-[#0b0e16] border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200 focus:outline-none"
                >
                  <option value="">انتخاب دلیل یا شرح توقف...</option>
                  {STUCK_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                برچسب‌ها (با کاما جدا کنید)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="کدنویسی, گزارش, جلسه..."
                className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <TaskChecklist taskId={task.id} />

            {/* Entity Work Logs */}
            <EntityWorkLogs kind="task" id={task.id} />

            <TaskCommentThread taskId={task.id} jiraKey={task.jiraKey} />
          </div>
        </div>

        {error && <p className="mt-4 text-xs text-rose-300">{error}</p>}

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDeleteTask}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف کار</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveMutation.isPending ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
