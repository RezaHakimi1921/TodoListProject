import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Compass, HelpCircle, Link2, Plus, Trash2 } from 'lucide-react'
import { createProblem, deleteProblem, listProblems } from '../api/problems'
import { requestProblemFocus } from '../lib/focusSwitch'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { PROBLEM_STATUS_LABEL, type Problem, type ProblemStatus } from '../types'
import { formatPersianDateTime } from '../lib/dates'

const FILTERS: Array<{ key: 'all' | ProblemStatus; label: string }> = [
  { key: 'all', label: 'همه' },
  { key: 'Open', label: 'در حال بررسی' },
  { key: 'Monitoring', label: 'مراقب تکرار' },
  { key: 'Resolved', label: 'بسته' },
]

export function ProblemsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [newTitle, setNewTitle] = useState('')
  const [filter, setFilter] = useState<'all' | ProblemStatus>('all')

  const problemsQuery = useQuery({
    queryKey: ['problems'],
    queryFn: () => listProblems(),
  })

  const createMutation = useMutation({
    mutationFn: (title: string) => createProblem(title),
    onSuccess: async (created) => {
      setNewTitle('')
      await requestProblemFocus(created).catch(() => undefined)
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      navigate(`/problems/${created.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProblem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const problems = (problemsQuery.data ?? []).filter((row) => filter === 'all' || row.status === filter)

  const handleDelete = async (item: Problem) => {
    if (await askTrash(item.title)) deleteMutation.mutate(item.id)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-amber-400">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white sm:text-2xl">تحقیق مسئله</h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              ریشه، دامنه اثر، Recovery و Prevention — نه فقط بستن تیکت.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Plus className="h-4 w-4 text-amber-400" />
          مسئله جدید
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="دقیقاً چه مشکلی رخ داده؟ بدون راه‌حل بنویس..."
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && newTitle.trim()) createMutation.mutate(newTitle.trim())
            }}
            className="flex-1 rounded-xl border border-[#2b354d] bg-[#0e111a] px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={!newTitle.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate(newTitle.trim())}
            className="shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-40"
          >
            شروع تحقیق
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              filter === item.key
                ? 'border-white/20 bg-white/15 text-white'
                : 'border-transparent text-slate-400 hover:bg-white/[0.04]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {problems.length === 0 ? (
          <div className="col-span-2 rounded-3xl border border-dashed border-[#242c3f] p-12 text-center text-xs text-slate-500">
            <Compass className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-semibold text-slate-300">مسئله‌ای در این فیلتر نیست.</p>
          </div>
        ) : (
          problems.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 ${
                item.status === 'Resolved'
                  ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                  : item.status === 'Monitoring'
                    ? 'border-sky-500/25 bg-sky-500/[0.04]'
                    : 'border-[#262f44] bg-[#141824]'
              }`}
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
                    {PROBLEM_STATUS_LABEL[item.status]}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{formatPersianDateTime(item.createdAt)}</span>
                </div>
                <h3 className="text-sm font-bold leading-relaxed text-slate-100">{item.title}</h3>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Link2 className="h-3.5 w-3.5" />
                  {item.taskCount ?? 0} تسک وصل‌شده
                </p>
                {item.rootCause ? (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.rootCause}</p>
                ) : null}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3">
                <button type="button" onClick={() => void handleDelete(item)} className="p-1.5 text-slate-500 hover:text-rose-400">
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  to={`/problems/${item.id}`}
                  className="rounded-xl bg-[#1b2234] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-amber-500 hover:text-slate-950"
                >
                  باز کردن تحقیق
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
