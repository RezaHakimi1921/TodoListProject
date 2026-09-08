import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowRight, 
  Trash2, 
  CheckCircle2, 
  Zap, 
  Feather, 
  Tag, 
  AlertTriangle 
} from 'lucide-react'
import { 
  deleteTask, 
  getTask, 
  updateTask,
  updateTaskStatus
} from '../api/tasks'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { EntityWorkLogs } from '../components/EntityWorkLogs'
import { TaskChecklist } from '../components/TaskChecklist'
import { TaskCommentThread } from '../components/TaskCommentThread'
import { TagChipsEditor } from '../components/TagChips'
import { TaskOwnershipToggle } from '../components/TaskOwnershipToggle'
import { STUCK_REASONS, type EnergyType, type TaskOwnership, type TaskStatus } from '../types'

export function TaskDetailPage() {
  const { id } = useParams()
  const taskId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>('Open')
  const [energyType, setEnergyType] = useState<EnergyType>('Light')
  const [ownership, setOwnership] = useState<TaskOwnership>('Mine')
  const [tags, setTags] = useState('')
  const [stuckReason, setStuckReason] = useState('')
  const [saved, setSaved] = useState(false)

  const taskQuery = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId),
    enabled: Number.isFinite(taskId),
  })

  useEffect(() => {
    const task = taskQuery.data
    if (!task) return
    setTitle(task.title)
    setStatus(task.status)
    setEnergyType(task.energyType)
    setOwnership(task.ownership === 'Other' ? 'Other' : 'Mine')
    setTags(task.tags.join(', '))
    setStuckReason(task.stuckReason || '')
  }, [taskQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (status === 'Stuck') {
        await updateTaskStatus(taskId, { status: 'Stuck', stuckReason: stuckReason || 'سخته' })
      }
      return updateTask(taskId, {
        title: title.trim(),
        status,
        energyType,
        tags: tags.split(/[,،]+/).map((item) => item.trim()).filter(Boolean).join(','),
        ownership,
      })
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const ownershipMutation = useMutation({
    mutationFn: (next: TaskOwnership) =>
      updateTask(taskId, {
        title: title.trim() || taskQuery.data?.title || '',
        status,
        energyType,
        tags: tags.split(/[,،]+/).map((item) => item.trim()).filter(Boolean).join(','),
        ownership: next,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      navigate('/')
    },
  })

  const handleDelete = async () => {
    const ok = await askTrash(title || 'این کار')
    if (ok) {
      deleteMutation.mutate()
    }
  }

  if (taskQuery.isLoading) {
    return <div className="py-20 text-center text-slate-500 text-xs">در حال بارگذاری کار...</div>
  }

  if (!taskQuery.data) {
    return <div className="py-20 text-center text-rose-400 text-xs">کار یافت نشد.</div>
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به کارهای امروز</span>
        </Link>

        <button
          type="button"
          onClick={handleDelete}
          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors text-xs flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" />
          <span>حذف این کار</span>
        </button>
      </div>

      {/* Main Task Editor Card */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">عنوان کار</label>
          <textarea
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl bg-[#0b0e16] border border-[#2b354d] p-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500 leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">وضعیت</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="Open">باز برای اقدام</option>
              <option value="Doing">در حال انجام</option>
              <option value="Stuck">متوقف / گیر کرده</option>
              <option value="Done">تکمیل شده</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">نوع تمرکز</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0b0e16] border border-[#2b354d]">
              <button
                type="button"
                onClick={() => setEnergyType('Deep')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  energyType === 'Deep'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>تمرکز عمیق</span>
              </button>
              <button
                type="button"
                onClick={() => setEnergyType('Light')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  energyType === 'Light'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Feather className="w-3.5 h-3.5" />
                <span>کار سبک</span>
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

        {status === 'Stuck' && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <label className="block text-xs font-bold text-rose-300 mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              علت توقف کار:
            </label>
            <select
              value={stuckReason}
              onChange={(e) => setStuckReason(e.target.value)}
              className="w-full rounded-xl bg-[#0b0e16] border border-rose-500/40 p-2 text-xs text-rose-200 focus:outline-none"
            >
              <option value="">انتخاب دلیل توقف...</option>
              {STUCK_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            برچسب‌ها (با کاما جدا کنید)
          </label>
          <TagChipsEditor value={tags} onChange={setTags} placeholder="سعید، محمد، جیرا" />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
              saved ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saved ? 'ذخیره شد' : 'ذخیره تغییرات'}</span>
          </button>
        </div>
      </div>

      <TaskChecklist taskId={taskId} />

      {/* Entity Work Logs */}
      <EntityWorkLogs kind="task" id={taskId} />

      <TaskCommentThread taskId={taskId} jiraKey={taskQuery.data.jiraKey} />
    </div>
  )
}
