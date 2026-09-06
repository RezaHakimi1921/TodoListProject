import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addTimeline, deleteTask, deleteTimeline, listTimeline, updateTask, updateTaskStatus } from '../api/tasks'
import { useTrashConfirm } from './ConfirmProvider'
import { EntityWorkLogs } from './EntityWorkLogs'
import { STATUS_LABEL, STUCK_REASONS, type EnergyType, type TaskItem, type TaskStatus } from '../types'

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
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setStatus(task.status)
    setEnergyType(task.energyType)
    setTags(task.tags.join(','))
    setNote('')
    setError('')
  }, [task])

  const timelineQuery = useQuery({
    queryKey: ['timeline', task?.id],
    queryFn: () => listTimeline(task!.id),
    enabled: Boolean(task),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTask(task!.id, {
        title: title.trim(),
        status,
        energyType,
        tags,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', task?.id] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: (next: TaskStatus) => updateTaskStatus(task!.id, { status: next }),
    onSuccess: (updated) => {
      setStatus(updated.status)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const timelineMutation = useMutation({
    mutationFn: () => addTimeline(task!.id, note.trim()),
    onSuccess: () => {
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['timeline', task?.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteLineMutation = useMutation({
    mutationFn: (entryId: number) => deleteTimeline(task!.id, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timeline', task?.id] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      onClose()
    },
  })

  if (!task) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-black/50" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-ink-900 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">ویرایش تسک</h2>
          <button type="button" onClick={onClose} className="text-sm text-paper/50">
            بستن
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-ink-950 px-4 py-3 text-lg outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatus(value)
                  if (value !== 'Stuck') statusMutation.mutate(value)
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
                    updateTaskStatus(task.id, {
                      status: reason === 'مهم نیست دیگه' ? 'Done' : 'Stuck',
                      stuckReason: reason,
                    }).then(() => {
                      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
                      onClose()
                    })
                  }
                  className="rounded-full bg-ink-800 px-3 py-1 text-sm"
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
            placeholder="تگ‌ها با ویرگول"
            className="w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              className="rounded-2xl bg-paper px-4 py-2 text-sm font-semibold text-ink-950"
            >
              ذخیره تغییرات
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
          <Link to={`/tasks/${task.id}`} className="block text-sm text-ember" onClick={onClose}>
            صفحه کامل Timeline
          </Link>
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <div className="mt-2 space-y-2">
            {(timelineQuery.data ?? []).map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl bg-ink-800 px-3 py-2">
                <p className="text-sm">{entry.note}</p>
                <button
                  type="button"
                  onClick={() => {
                    void askTrash('این خط Timeline').then((ok) => {
                      if (ok) deleteLineMutation.mutate(entry.id)
                    })
                  }}
                  className="shrink-0 text-xs text-rose-200"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (note.trim()) timelineMutation.mutate()
            }}
          >
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="یک خط به Timeline"
              className="w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
          </form>
        </div>
        <div className="mt-6">
          <EntityWorkLogs title={title || task.title} taskId={task.id} />
        </div>
      </aside>
    </div>
  )
}
