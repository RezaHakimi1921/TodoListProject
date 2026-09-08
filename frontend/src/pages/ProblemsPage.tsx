import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  HelpCircle, 
  Plus, 
  ArrowLeft, 
  Trash2, 
  CheckCircle2, 
  Compass, 
  Award,
  Sparkles
} from 'lucide-react'
import { createProblem, deleteProblem, listProblems } from '../api/problems'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { PROBLEM_STATUS_LABEL, type Problem } from '../types'
import { formatPersianDateTime } from '../lib/dates'

export function ProblemsPage() {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [newTitle, setNewTitle] = useState('')

  const problemsQuery = useQuery({
    queryKey: ['problems'],
    queryFn: () => listProblems(),
  })

  const createMutation = useMutation({
    mutationFn: (title: string) => createProblem(title),
    onSuccess: () => {
      setNewTitle('')
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProblem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const problems = problemsQuery.data ?? []

  const handleDelete = async (p: Problem) => {
    const ok = await askTrash(p.title)
    if (ok) {
      deleteMutation.mutate(p.id)
    }
  }

  const handleCreate = () => {
    if (!newTitle.trim()) return
    createMutation.mutate(newTitle.trim())
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              استودیوی حل مسئله و چالش‌ها (Problem Studio)
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            برای فرار از قفل ذهنی؛ مسائل پیچیده را مکتوب کنید، گزینه‌ها را بسنجید و بهترین راهکار را آزمایش فرمایید.
          </p>
        </div>
      </div>

      {/* New Problem Input Card */}
      <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-4">
        <h3 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-amber-400" />
          ثبت مسئله یا تصمیم جدید
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="چه مسئله، چالش یا دوراهی تصمیم‌گیری در پیش داری؟..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreate()
              }
            }}
            className="flex-1 rounded-xl bg-[#0e111a] border border-[#2b354d] px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            disabled={!newTitle.trim() || createMutation.isPending}
            onClick={handleCreate}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 shrink-0"
          >
            ایجاد مسئله
          </button>
        </div>
        {createMutation.isError && (
          <p className="mt-2 text-xs text-rose-400 font-medium">{(createMutation.error as Error).message}</p>
        )}
      </div>

      {/* Problems List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {problems.length === 0 ? (
          <div className="col-span-2 rounded-3xl border border-dashed border-[#242c3f] bg-[#11141e]/50 p-12 text-center text-slate-500 text-xs">
            <Compass className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-slate-300">هیچ مسئله‌ای ثبت نشده است.</p>
            <p className="mt-1 text-slate-500">
              مسئله‌ای که ذهن شما را مشغول کرده اضافه کنید تا در استودیو به بررسی سناریوها بپردازید.
            </p>
          </div>
        ) : (
          problems.map((problem) => {
            const isChosen = problem.status === 'Chosen'
            const isValidated = problem.status === 'Validated'
            const isResolved = problem.status === 'Resolved'
            const chosenOption = problem.options.find((o) => o.id === problem.chosenOptionId)

            return (
              <div
                key={problem.id}
                className={`rounded-2xl border p-5 transition-all shadow-lg flex flex-col justify-between ${
                  isResolved
                    ? 'border-sky-500/30 bg-sky-500/[0.04]'
                    : isValidated
                    ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                    : isChosen
                    ? 'border-amber-500/30 bg-amber-500/[0.03]'
                    : 'border-[#262f44] bg-[#141824] hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isResolved
                          ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                          : isValidated
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isChosen
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isResolved ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isValidated ? (
                        <Award className="w-3 h-3" />
                      ) : isChosen ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Compass className="w-3 h-3" />
                      )}
                      <span>{PROBLEM_STATUS_LABEL[problem.status]}</span>
                    </span>

                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatPersianDateTime(problem.createdAt)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 leading-relaxed">
                    {problem.title}
                  </h3>

                  {chosenOption && (
                    <div className="mt-3 p-2.5 rounded-xl bg-[#101420] border border-amber-500/20 text-xs text-slate-300">
                      <span className="text-[11px] text-amber-400 font-bold block mb-1">
                        راهکار منتخب:
                      </span>
                      <span>{chosenOption.title}</span>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{problem.options.length} گزینه مورد بررسی قرار گرفته است</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleDelete(problem)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors text-xs"
                    title="حذف مسئله"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    to={`/problems/${problem.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1b2234] hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-semibold transition-all border border-slate-700/60 shadow-sm"
                  >
                    <span>ورود به استودیوی تحلیل</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
