import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HelpCircle, Plus } from 'lucide-react'
import { attachProblemTask, createProblem, listProblems } from '../api/problems'
import { requestProblemFocus } from '../lib/focusSwitch'
import { PROBLEM_STATUS_LABEL, type TaskItem } from '../types'

interface Props {
  task: TaskItem
  compact?: boolean
}

export function TaskProblemLinks({ task, compact }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [attachError, setAttachError] = useState('')
  const problems = task.problems ?? []

  const listQuery = useQuery({
    queryKey: ['problems'],
    queryFn: () => listProblems(),
    enabled: open,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['task', task.id] })
    void queryClient.invalidateQueries({ queryKey: ['problems'] })
  }

  const startMutation = useMutation({
    mutationFn: () => createProblem(task.title, task.id),
    onSuccess: async (created) => {
      await requestProblemFocus(created).catch(() => undefined)
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      navigate(`/problems/${created.id}`)
    },
  })

  const linkedIds = new Set(problems.map((item) => item.id))
  const candidates = (listQuery.data ?? []).filter((item) => item.status !== 'Resolved' && !linkedIds.has(item.id))

  return (
    <div className={compact ? 'mt-2 space-y-1.5' : 'mt-3 space-y-2'}>
      {problems.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {problems.map((item) => (
            <Link
              key={item.id}
              to={`/problems/${item.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100"
            >
              <HelpCircle className="h-3 w-3" />
              {item.title}
              <span className="text-amber-200/70">{PROBLEM_STATUS_LABEL[item.status]}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={startMutation.isPending}
          onClick={() => startMutation.mutate()}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:border-amber-400/40 hover:text-amber-100"
        >
          <Plus className="h-3 w-3" />
          {task.status === 'Stuck' && task.stuckReason === 'سخته' ? 'شروع تحقیق مسئله' : 'مسئله جدید از این تسک'}
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
        >
          وصل به مسئله موجود
        </button>
      </div>

      {open ? (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-1">
          {candidates.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-slate-500">مسئله بازی برای وصل نیست.</p>
          ) : (
            candidates.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAttachError('')
                  void attachProblemTask(item.id, task.id)
                    .then(() => {
                      setOpen(false)
                      refresh()
                    })
                    .catch((error: unknown) => {
                      setAttachError(error instanceof Error ? error.message : 'وصل به مسئله انجام نشد.')
                    })
                }}
                className="block w-full rounded-lg px-2 py-1.5 text-right text-[11px] text-slate-200 hover:bg-white/[0.06]"
              >
                {item.title}
              </button>
            ))
          )}
          {attachError ? <p className="px-2 py-1 text-[11px] text-rose-300">{attachError}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
