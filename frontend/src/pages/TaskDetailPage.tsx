import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowRight, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Feather, 
  Tag, 
  Send, 
  AlertTriangle 
} from 'lucide-react'
import { 
  addTimeline, 
  deleteTask, 
  deleteTimeline, 
  getTask, 
  listTimeline, 
  updateTask, 
  updateTaskStatus 
} from '../api/tasks'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { EntityWorkLogs } from '../components/EntityWorkLogs'
import { STATUS_LABEL, STUCK_REASONS, type EnergyType, type TaskStatus } from '../types'
import { formatPersianDateTime } from '../lib/dates'

export function TaskDetailPage() {
  const { id } = useParams()
  const taskId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>('Open')
  const [energyType, setEnergyType] = useState<EnergyType>('Light')
  const [tags, setTags] = useState('')
  const [stuckReason, setStuckReason] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const taskQuery = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId),
    enabled: Number.isFinite(taskId),
  })

  const timelineQuery = useQuery({
    queryKey: ['timeline', taskId],
    queryFn: () => listTimeline(taskId),
    enabled: Number.isFinite(taskId),
  })

  useEffect(() => {
    const task = taskQuery.data
    if (!task) return
    setTitle(task.title)
    setStatus(task.status)
    setEnergyType(task.energyType)
    setTags(task.tags.join(', '))
    setStuckReason(task.stuckReason || '')
  }, [taskQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTask(taskId, {
        title: title.trim(),
        status,
        energyType,
        tags,
      }),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const timelineMutation = useMutation({
    mutationFn: () => addTimeline(taskId, note.trim()),
    onSuccess: () => {
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['timeline', taskId] })
    },
  })

  const deleteLineMutation = useMutation({
    mutationFn: (entryId: number) => deleteTimeline(taskId, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timeline', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
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
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
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

      {/* Entity Work Logs */}
      <EntityWorkLogs kind="task" id={taskId} />

      {/* Timeline Section */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">تایم‌لاین و سیر پیشرفت کار</h3>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="یادداشت پیشرفت یا مانع جدید..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && note.trim()) {
                e.preventDefault()
                timelineMutation.mutate()
              }
            }}
            className="flex-1 rounded-xl bg-[#0b0e16] border border-[#2b354d] px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            disabled={!note.trim() || timelineMutation.isPending}
            onClick={() => timelineMutation.mutate()}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span>ثبت</span>
          </button>
        </div>

        <div className="divide-y divide-slate-800/80 pt-2">
          {timelineQuery.data?.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">یادداشتی ثبت نشده است.</p>
          ) : (
            timelineQuery.data?.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="text-slate-200 font-medium leading-relaxed">{item.note}</p>
                  <span className="text-[11px] text-slate-500">{formatPersianDateTime(item.createdAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteLineMutation.mutate(item.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
