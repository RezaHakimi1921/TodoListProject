import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addTimeline,
  deleteTask,
  deleteTimeline,
  getTask,
  listTimeline,
  updateTask,
  updateTaskStatus,
} from '../api/tasks'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { EntityWorkLogs } from '../components/EntityWorkLogs'
import { STATUS_LABEL, STUCK_REASONS, type EnergyType, type TaskStatus } from '../types'

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

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
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

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
    setTags(task.tags.join(','))
  }, [taskQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => updateTask(taskId, { title: title.trim(), status, energyType, tags }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setError('')
    },
    onError: (err: Error) => setError(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: (input: { status: TaskStatus; stuckReason?: string }) => updateTaskStatus(taskId, input),
    onSuccess: (updated) => {
      setStatus(updated.status)
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const timelineMutation = useMutation({
    mutationFn: () => addTimeline(taskId, note.trim()),
    onSuccess: () => {
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['timeline', taskId] })
    },
    onError: (err: Error) => setError(err.message),
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

  if (taskQuery.isLoading) return <p className="text-paper/50">در حال بارگذاری...</p>
  if (taskQuery.isError || !taskQuery.data) {
    return (
      <p>
        تسک باز نشد. <Link to="/" className="underline">برگشت به لیست</Link>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
          <Link to="/" className="text-sm text-paper/45 hover:text-paper">
            → برگشت به لیست
          </Link>
          <div className="mt-4 space-y-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-ink-950 px-4 py-3 text-2xl outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setStatus(value)
                    if (value !== 'Stuck') statusMutation.mutate({ status: value })
                  }}
                  className={`rounded-full px-3 py-1 text-sm ${
                    status === value ? 'bg-paper text-ink-950' : 'bg-ink-800 text-paper/60'
                  }`}
                >
                  {STATUS_LABEL[value]}
                </button>
              ))}
            </div>
            {status === 'Stuck' && (
              <div className="flex flex-wrap gap-2">
                {STUCK_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() =>
                      statusMutation.mutate({
                        status: reason === 'مهم نیست دیگه' ? 'Done' : 'Stuck',
                        stuckReason: reason,
                      })
                    }
                    className={`rounded-full px-3 py-1 text-sm ${
                      taskQuery.data.stuckReason === reason ? 'bg-ember text-ink-950' : 'bg-ink-800'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
            <select
              value={energyType}
              onChange={(event) => setEnergyType(event.target.value as EnergyType)}
              className="w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            >
              <option value="Deep">تمرکز عمیق</option>
              <option value="Light">کار سبک</option>
            </select>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                className="rounded-2xl bg-paper px-4 py-2 text-sm font-semibold text-ink-950"
              >
                ذخیره
              </button>
              <button
                type="button"
                onClick={() => {
                  void askTrash('این کار').then((ok) => {
                    if (ok) deleteMutation.mutate()
                  })
                }}
                className="rounded-2xl px-4 py-2 text-sm text-rose-200"
              >
                حذف
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <div className="mt-4 space-y-3">
            {(timelineQuery.data ?? []).map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-ink-800/80 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-paper/35">{formatWhen(entry.createdAt)}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void askTrash('این خط Timeline').then((ok) => {
                        if (ok) deleteLineMutation.mutate(entry.id)
                      })
                    }}
                    className="text-xs text-rose-200"
                  >
                    حذف
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{entry.note}</p>
              </div>
            ))}
          </div>
          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (note.trim()) timelineMutation.mutate()
            }}
          >
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-ink-950 px-4 py-3 outline-none"
            />
            <button type="submit" className="mt-2 rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950">
              اضافه کردن خط
            </button>
          </form>
        </section>
      </div>

      <EntityWorkLogs title={taskQuery.data.title} taskId={taskId} />
    </div>
  )
}
