import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { captureWorkLog, deleteWorkLog, listEntityWorkLogs } from '../api/workLogs'
import { setFocus } from '../api/focus'
import { DEFAULT_PING_MINUTES, getSettings } from '../api/settings'
import { useTrashConfirm } from './ConfirmProvider'

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} دقیقه`
  return rest === 0 ? `${hours} ساعت` : `${hours} ساعت و ${rest} دقیقه`
}

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

interface Props {
  title: string
  taskId?: number
  problemId?: number
}

export function EntityWorkLogs({ title, taskId, problemId }: Props) {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const pingMinutes = settingsQuery.data?.pingMinutes ?? DEFAULT_PING_MINUTES
  const [minutes, setMinutes] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const kind = taskId ? 'task' : 'problem'
  const id = taskId ?? problemId ?? 0
  const duration = minutes ?? pingMinutes

  useEffect(() => {
    if (minutes === null && settingsQuery.data) setMinutes(settingsQuery.data.pingMinutes)
  }, [minutes, settingsQuery.data])

  const query = useQuery({
    queryKey: ['entity-worklogs', kind, id],
    queryFn: () => listEntityWorkLogs(kind, id),
    enabled: id > 0,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['entity-worklogs', kind, id] })
    void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    void queryClient.invalidateQueries({ queryKey: ['worklog-summary'] })
    void queryClient.invalidateQueries({ queryKey: ['focus'] })
    void queryClient.invalidateQueries({ queryKey: ['trash'] })
  }

  const addMutation = useMutation({
    mutationFn: () =>
      captureWorkLog({
        description: note.trim() || title,
        durationMinutes: duration,
        source: 'Manual',
        taskId,
        problemId,
      }),
    onSuccess: () => {
      setNote('')
      setError('')
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const focusMutation = useMutation({
    mutationFn: () =>
      setFocus({
        description: title,
        taskId,
        problemId,
        durationMinutes: duration,
        source: 'Manual',
        log: true,
      }),
    onSuccess: refresh,
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (entryId: number) => deleteWorkLog(entryId),
    onSuccess: refresh,
  })

  const data = query.data

  return (
    <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-paper/35">Work Log</p>
          <h2 className="mt-1 text-lg font-semibold">زمان صرف‌شده روی این مورد</h2>
        </div>
        <p className="text-sm text-paper/50">{formatMinutes(data?.totalMinutes ?? 0)}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="چه کردی؟ خالی = عنوان همین مورد"
          className="flex-1 rounded-2xl border border-white/10 bg-ink-950 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          max={480}
          value={duration}
          onChange={(event) => setMinutes(Number(event.target.value) || pingMinutes)}
          className="w-24 rounded-2xl border border-white/10 bg-ink-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => addMutation.mutate()}
          className="rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950"
        >
          ثبت زمان
        </button>
      </div>
      <button
        type="button"
        onClick={() => focusMutation.mutate()}
        className="mt-2 text-sm text-ember"
      >
        این را کار فعلی کن — نوتیف بعدی روی همین می‌آید
      </button>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

      <div className="mt-4 space-y-2">
        {(data?.entries ?? []).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ink-800 px-3 py-2 text-sm">
            <div>
              <p>{entry.description}</p>
              <p className="text-xs text-paper/40">
                {formatWhen(entry.createdAt)} · {entry.durationMinutes} دقیقه
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void askTrash('این ثبت Work Log').then((ok) => {
                  if (ok) deleteMutation.mutate(entry.id)
                })
              }}
              className="shrink-0 text-xs text-rose-200"
            >
              حذف
            </button>
          </div>
        ))}
        {(data?.entries ?? []).length === 0 && (
          <p className="text-sm text-paper/35">هنوز زمانی روی این مورد ثبت نشده.</p>
        )}
      </div>
    </section>
  )
}
