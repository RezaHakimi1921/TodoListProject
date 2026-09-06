import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteDailyLog, getDailyLog, getRelatedTasks, listDailyLogs, upsertDailyLog } from '../api/dailyLogs'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { STATUS_LABEL } from '../types'

function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function DailyLogPage() {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [date, setDate] = useState(todayIso)
  const [note, setNote] = useState('')

  const logQuery = useQuery({
    queryKey: ['dailylog', date],
    queryFn: () => getDailyLog(date),
  })

  const relatedQuery = useQuery({
    queryKey: ['related', date],
    queryFn: () => getRelatedTasks(date),
  })

  const historyQuery = useQuery({
    queryKey: ['dailylogs'],
    queryFn: listDailyLogs,
  })

  const currentNote = useMemo(() => {
    if (logQuery.data?.note) return logQuery.data.note
    return note
  }, [logQuery.data, note])

  const refreshLogs = () => {
    void queryClient.invalidateQueries({ queryKey: ['dailylog'] })
    void queryClient.invalidateQueries({ queryKey: ['dailylogs'] })
    void queryClient.invalidateQueries({ queryKey: ['trash'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => upsertDailyLog(date, (note || logQuery.data?.note || '').trim()),
    onSuccess: refreshLogs,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDailyLog(id),
    onSuccess: () => {
      setNote('')
      refreshLogs()
    },
  })

  const remove = (id: number) => {
    void askTrash('این یادگرفته').then((ok) => {
      if (ok) deleteMutation.mutate(id)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setDate((value) => shiftDate(value, -1))} className="text-sm text-paper/50">
            روز قبل
          </button>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setNote('')
            }}
            className="rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
          />
          <button type="button" onClick={() => setDate((value) => shiftDate(value, 1))} className="text-sm text-paper/50">
            روز بعد
          </button>
        </div>
        <h1 className="mt-6 text-2xl font-semibold">امروز چی یاد گرفتی؟</h1>
        <textarea
          key={date + (logQuery.data?.id ?? 'new')}
          defaultValue={logQuery.data?.note ?? ''}
          onChange={(event) => setNote(event.target.value)}
          rows={6}
          placeholder="یک خط کافیه. بعد از یک ماه می‌شود دانش‌پایه."
          className="mt-4 w-full rounded-3xl border border-white/10 bg-ink-950 px-4 py-3 outline-none"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            className="rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950"
          >
            ذخیره گزارش روز
          </button>
          {logQuery.data && (
            <button type="button" onClick={() => remove(logQuery.data!.id)} className="rounded-2xl px-4 py-2 text-sm text-rose-200">
              حذف
            </button>
          )}
        </div>
        {currentNote && logQuery.data && (
          <p className="mt-3 text-xs text-paper/35">آخرین ذخیره: {logQuery.data.logDate}</p>
        )}
      </section>

      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
          <h2 className="text-lg font-semibold">کارهای همین روز</h2>
          <p className="mt-1 text-sm text-paper/45">خودکار، از روی Timeline یا تغییر وضعیت.</p>
          <div className="mt-4 space-y-2">
            {(relatedQuery.data ?? []).map((task) => (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="block rounded-2xl bg-ink-800 px-4 py-3 hover:bg-ink-700"
              >
                <p>{task.title}</p>
                <p className="text-xs text-paper/40">{STATUS_LABEL[task.status]}</p>
              </Link>
            ))}
            {(relatedQuery.data ?? []).length === 0 && (
              <p className="text-sm text-paper/35">امروز هنوز تسکی لمس نخورده.</p>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
          <h2 className="text-lg font-semibold">روزهای قبل</h2>
          <div className="mt-3 space-y-2">
            {(historyQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${
                  item.logDate === date ? 'bg-paper text-ink-950' : 'bg-ink-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDate(item.logDate)
                    setNote('')
                  }}
                  className="min-w-0 flex-1 text-right"
                >
                  <p className="text-sm font-medium">{item.logDate}</p>
                  <p className="truncate text-xs opacity-70">{item.note}</p>
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className={`shrink-0 text-xs ${
                    item.logDate === date ? 'text-rose-700' : 'text-rose-200'
                  }`}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
