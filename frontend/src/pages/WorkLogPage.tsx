import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteWorkLog, getWorkLogSummary, listWorkLogs } from '../api/workLogs'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { todayIso } from '../lib/dates'

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function WorkLogPage() {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [date, setDate] = useState(todayIso)
  const [copied, setCopied] = useState(false)

  const listQuery = useQuery({
    queryKey: ['worklogs', date],
    queryFn: () => listWorkLogs(date),
  })

  const summaryQuery = useQuery({
    queryKey: ['worklog-summary', date],
    queryFn: () => getWorkLogSummary(date),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWorkLog(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['worklogs', date] })
      void queryClient.invalidateQueries({ queryKey: ['worklog-summary', date] })
      void queryClient.invalidateQueries({ queryKey: ['entity-worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const remove = (id: number) => {
    void askTrash('این ثبت Work Log').then((ok) => {
      if (ok) deleteMutation.mutate(id)
    })
  }

  const summary = summaryQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Work Log</h1>
          <p className="mt-2 text-sm text-paper/50">پراکنده ثبت کن، فشرده برای Jira ببر.</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-2xl border border-white/10 bg-ink-800 px-3 py-2"
        />
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">خلاصه قابل کپی</h2>
          {summary && (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(summary.copyText)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
              className="rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950"
            >
              {copied ? 'کپی شد' : 'کپی برای Jira'}
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-paper/45">
          مجموع روز: {formatMinutes(summary?.totalMinutes ?? 0)}
        </p>
        <div className="mt-4 space-y-4">
          {(summary?.groups ?? []).map((group) => (
            <div key={group.title} className="rounded-3xl bg-ink-800/80 p-4">
              <p className="font-medium">
                {group.title} — {formatMinutes(group.totalMinutes)}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-paper/70">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3">
                    <span>
                      {new Date(entry.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}{' '}
                      {entry.description}
                    </span>
                    <button type="button" onClick={() => remove(entry.id)} className="shrink-0 text-xs text-rose-200">
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {(summary?.groups ?? []).length === 0 && (
            <p className="text-sm text-paper/35">هنوز لاگی برای این روز نیست.</p>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-6">
        <h2 className="text-lg font-semibold">ثبت‌های خام</h2>
        <div className="mt-3 space-y-2">
          {(listQuery.data ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ink-800 px-4 py-3 text-sm">
              <span>{entry.description}</span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-paper/40">
                  {entry.durationMinutes}m · {entry.source}
                </span>
                <button type="button" onClick={() => remove(entry.id)} className="text-xs text-rose-200">
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
