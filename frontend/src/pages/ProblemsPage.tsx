import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProblem, deleteProblem, listProblems } from '../api/problems'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { PROBLEM_STATUS_LABEL, type ProblemStatus } from '../types'

const tone: Record<ProblemStatus, string> = {
  Exploring: 'bg-ember/20 text-amber-100',
  Chosen: 'bg-white/10 text-paper/70',
  Validated: 'bg-moss/30 text-emerald-100',
}

export function ProblemsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [title, setTitle] = useState('')
  const listQuery = useQuery({ queryKey: ['problems'], queryFn: listProblems })

  const createMutation = useMutation({
    mutationFn: () => createProblem(title.trim()),
    onSuccess: (problem) => {
      setTitle('')
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      navigate(`/problems/${problem.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProblem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const onCreate = (event: FormEvent) => {
    event.preventDefault()
    if (title.trim()) createMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">استودیوی مسئله</h1>
        <p className="mt-2 text-sm text-paper/50">
          کشف از تعهد جداست. تا گزینه سوم و توضیح جونیور نباشد، انتخاب قفل است.
        </p>
      </div>

      <form onSubmit={onCreate} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-ink-800/70 p-4 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="مسئله در یک خط"
          className="flex-1 rounded-2xl border border-white/10 bg-ink-950 px-4 py-3 outline-none"
        />
        <button type="submit" className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-ink-950">
          باز کردن مسئله
        </button>
      </form>

      <div className="space-y-3">
        {(listQuery.data ?? []).map((problem) => (
          <div
            key={problem.id}
            className="flex items-start justify-between gap-3 rounded-3xl border border-white/10 bg-ink-900/60 p-4"
          >
            <Link to={`/problems/${problem.id}`} className="min-w-0 flex-1 hover:opacity-90">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-medium">{problem.title}</h2>
                <span className={`rounded-full px-3 py-1 text-xs ${tone[problem.status]}`}>
                  {PROBLEM_STATUS_LABEL[problem.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-paper/45">{problem.options.length} گزینه</p>
            </Link>
            <button
              type="button"
              onClick={() => {
                void askTrash('این مسئله').then((ok) => {
                  if (ok) deleteMutation.mutate(problem.id)
                })
              }}
              className="shrink-0 text-sm text-rose-200"
            >
              حذف
            </button>
          </div>
        ))}
        {(listQuery.data ?? []).length === 0 && (
          <p className="text-sm text-paper/35">هنوز مسئله‌ای باز نشده.</p>
        )}
      </div>
    </div>
  )
}
