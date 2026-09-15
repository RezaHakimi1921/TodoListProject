import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Clock, Pencil, Trash2, X } from 'lucide-react'
import {
  createTaskReminder,
  deleteTaskReminder,
  listTaskReminders,
  updateTaskReminder,
  type TaskReminder,
} from '../api/reminders'
import { markReminderNotificationsRead } from '../api/notifications'
import { formatPersianDateTime, todayIso } from '../lib/dates'
import type { TaskItem } from '../types'
import { JalaliDateField } from './JalaliDateField'
import { TimeSelectField } from './TimeSelectField'

interface Props {
  task: TaskItem | null
  /** When set, open directly in edit mode for this reminder id */
  editReminderId?: number | null
  onClose: () => void
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function splitLocal(date: Date) {
  return {
    dateIso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hour: pad(date.getHours()),
    minute: pad(Math.floor(date.getMinutes() / 5) * 5),
  }
}

function defaultParts() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  d.setSeconds(0, 0)
  return splitLocal(d)
}

function fromReminder(row: TaskReminder) {
  const d = new Date(row.remindAt)
  if (!Number.isFinite(d.getTime())) return defaultParts()
  return splitLocal(d)
}

function toIso(dateIso: string, hour: string, minute: string) {
  const local = new Date(`${dateIso}T${hour}:${minute}:00`)
  if (!Number.isFinite(local.getTime())) throw new Error('زمان معتبر نیست')
  return local.toISOString()
}

const PORTAL_Z = 120

export function TaskReminderModal({ task, editReminderId = null, onClose }: Props) {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLDivElement>(null)
  const initial = defaultParts()
  const [dateIso, setDateIso] = useState(initial.dateIso)
  const [hour, setHour] = useState(initial.hour)
  const [minute, setMinute] = useState(initial.minute)
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const listQuery = useQuery({
    queryKey: ['reminders', task?.id],
    queryFn: () => listTaskReminders(task!.id),
    enabled: Boolean(task?.id),
  })

  useEffect(() => {
    if (!task) return
    if (editReminderId == null) {
      const parts = defaultParts()
      setDateIso(parts.dateIso)
      setHour(parts.hour)
      setMinute(parts.minute)
      setNote('')
      setEditingId(null)
    }
    setError('')
  }, [task?.id, editReminderId])

  useEffect(() => {
    if (!task || editReminderId == null) return
    const rows = listQuery.data ?? []
    const row = rows.find((item) => item.id === editReminderId)
    if (!row) return
    const parts = fromReminder(row)
    setDateIso(parts.dateIso)
    setHour(parts.hour)
    setMinute(parts.minute)
    setNote(row.note ?? '')
    setEditingId(row.id)
    setError('')
  }, [task?.id, editReminderId, listQuery.data])

  useEffect(() => {
    if (!task?.id) return
    void markReminderNotificationsRead(task.id)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
        void queryClient.invalidateQueries({ queryKey: ['task', task.id] })
      })
      .catch(() => undefined)
  }, [queryClient, task?.id])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!task) return
      const remindAt = toIso(dateIso, hour, minute)
      const payload = { remindAt, note: note.trim() || undefined }
      if (editingId != null) {
        await updateTaskReminder(editingId, payload)
        return
      }
      await createTaskReminder(task.id, payload)
    },
    onSuccess: () => {
      setNote('')
      setError('')
      setEditingId(null)
      const parts = defaultParts()
      setDateIso(parts.dateIso)
      setHour(parts.hour)
      setMinute(parts.minute)
      void queryClient.invalidateQueries({ queryKey: ['reminders'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', task?.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaskReminder(id),
    onSuccess: (_data, id) => {
      if (editingId === id) {
        setEditingId(null)
        setNote('')
        const parts = defaultParts()
        setDateIso(parts.dateIso)
        setHour(parts.hour)
        setMinute(parts.minute)
      }
      void queryClient.invalidateQueries({ queryKey: ['reminders'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', task?.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const rows = listQuery.data ?? []
  const pending = useMemo(() => rows.filter((row) => !row.firedAt), [rows])
  const fired = useMemo(() => rows.filter((row) => row.firedAt), [rows])

  const startEdit = (row: TaskReminder) => {
    const parts = fromReminder(row)
    setDateIso(parts.dateIso)
    setHour(parts.hour)
    setMinute(parts.minute)
    setNote(row.note ?? '')
    setEditingId(row.id)
    setError('')
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setNote('')
    setError('')
    const parts = defaultParts()
    setDateIso(parts.dateIso)
    setHour(parts.hour)
    setMinute(parts.minute)
  }

  if (!task) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2b3348] bg-[#141824] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/25">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">یادآوری تسک</h2>
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{task.title}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={formRef}
          className={`mt-4 space-y-2.5 rounded-xl p-0.5 transition-colors ${
            editingId != null ? 'ring-1 ring-violet-400/40 bg-violet-500/[0.04]' : ''
          }`}
        >
          {editingId != null ? (
            <p className="px-1 text-[11px] font-medium text-violet-300">در حال ویرایش یادآوری</p>
          ) : null}

          <label className="block text-[11px] text-slate-400">تاریخ</label>
          <JalaliDateField
            value={dateIso}
            onChange={setDateIso}
            placeholder="انتخاب تاریخ یادآوری"
            min={todayIso()}
            zIndex={PORTAL_Z}
          />

          <TimeSelectField
            hour={hour}
            minute={minute}
            onHourChange={setHour}
            onMinuteChange={setMinute}
            zIndex={PORTAL_Z}
          />

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="یادداشت اختیاری برای یادآوری..."
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-400/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={saveMutation.isPending || !dateIso}
            onClick={() => saveMutation.mutate()}
            className="w-full rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-bold text-sm py-2.5"
          >
            {editingId != null ? 'ذخیره تغییرات' : 'ثبت یادآوری'}
          </button>
          {editingId != null ? (
            <button type="button" onClick={cancelEdit} className="w-full text-xs text-slate-400 hover:text-slate-200">
              انصراف از ویرایش
            </button>
          ) : null}
          {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-violet-300" />
            یادآوری‌های فعال ({pending.length})
          </p>
          {pending.length === 0 ? (
            <p className="text-xs text-slate-500">هنوز یادآوری فعالی نیست.</p>
          ) : (
            pending.map((row) => (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => startEdit(row)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    startEdit(row)
                  }
                }}
                className={`rounded-xl border px-3 py-2.5 flex items-start justify-between gap-2 cursor-pointer transition-colors ${
                  editingId === row.id
                    ? 'border-violet-400/50 bg-violet-500/15'
                    : 'border-violet-500/25 bg-violet-500/[0.08] hover:border-violet-400/40'
                }`}
              >
                <div className="min-w-0 text-right">
                  <p className="text-xs font-medium text-violet-100">{formatPersianDateTime(row.remindAt)}</p>
                  {row.note ? <p className="mt-1 text-[11px] text-slate-300">{row.note}</p> : null}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      startEdit(row)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-violet-200 hover:bg-violet-500/10"
                    title="ویرایش"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      deleteMutation.mutate(row.id)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                    title="حذف یادآوری"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          {fired.length > 0 ? (
            <>
              <p className="pt-2 text-[11px] font-semibold text-slate-500">انجام‌شده ({fired.length})</p>
              {fired.slice(0, 5).map((row) => (
                <div key={row.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-[11px] text-slate-500">
                  {formatPersianDateTime(row.remindAt)}
                  {row.note ? ` · ${row.note}` : ''}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
