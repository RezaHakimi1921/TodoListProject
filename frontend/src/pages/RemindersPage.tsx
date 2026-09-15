import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, Clock, Layers, Pencil, Trash2 } from 'lucide-react'
import { deleteTaskReminder, listFiredReminders, listPendingReminders } from '../api/reminders'
import { markAllReminderNotificationsRead } from '../api/notifications'
import { formatPersianDateTime } from '../lib/dates'
import { TaskReminderModal } from '../components/TaskReminderModal'
import { listTasks } from '../api/tasks'
import type { TaskItem } from '../types'

const PAGE_SIZE = 15

type FilterTab = 'active' | 'fired' | 'all'

export function RemindersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<FilterTab>('active')
  const [page, setPage] = useState(0)
  const [modalTask, setModalTask] = useState<TaskItem | null>(null)
  const [editReminderId, setEditReminderId] = useState<number | null>(null)

  const pendingQuery = useQuery({
    queryKey: ['reminders', 'pending'],
    queryFn: listPendingReminders,
    refetchInterval: 30_000,
  })

  const firedQuery = useQuery({
    queryKey: ['reminders', 'fired'],
    queryFn: () => listFiredReminders(80),
    refetchInterval: 60_000,
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks({ includeDone: true }),
    staleTime: 15_000,
  })

  useEffect(() => {
    void markAllReminderNotificationsRead()
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      })
      .catch(() => undefined)
  }, [queryClient])

  useEffect(() => {
    setPage(0)
  }, [tab])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaskReminder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const pending = pendingQuery.data ?? []
  const fired = firedQuery.data ?? []

  const allRows = useMemo(() => {
    const active = pending.map((row) => ({ ...row, _fired: false as const }))
    const done = fired.map((row) => ({ ...row, _fired: true as const }))
    return [...active, ...done]
  }, [pending, fired])

  const filtered = useMemo(() => {
    if (tab === 'active') return pending.map((row) => ({ ...row, _fired: false as const }))
    if (tab === 'fired') return fired.map((row) => ({ ...row, _fired: true as const }))
    return allRows
  }, [tab, pending, fired, allRows])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  )

  const openTaskPage = (taskId: number) => {
    navigate(`/tasks/${taskId}`)
  }

  const openEdit = (taskId: number, reminderId: number) => {
    const task = (tasksQuery.data ?? []).find((row) => row.id === taskId) ?? null
    if (!task) {
      navigate(`/tasks/${taskId}`)
      return
    }
    setEditReminderId(reminderId)
    setModalTask(task)
  }

  const closeModal = () => {
    setModalTask(null)
    setEditReminderId(null)
  }

  const emptyText =
    tab === 'active'
      ? 'هنوز یادآور فعالی تنظیم نشده'
      : tab === 'fired'
        ? 'هنوز یادآوری شلیک‌شده‌ای نیست'
        : 'هنوز یادآوری ثبت نشده'

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/20">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">یادآوری‌ها</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              یادآورهای فعال و کارهایی که قبلاً یادآوری شده‌اند
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <FilterButton
            active={tab === 'active'}
            count={pending.length}
            tone="violet"
            icon={<Clock className="w-3.5 h-3.5" />}
            onClick={() => setTab('active')}
          >
            یادآورهای فعال
          </FilterButton>
          <FilterButton
            active={tab === 'fired'}
            count={fired.length}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => setTab('fired')}
          >
            یادآوری‌شده
          </FilterButton>
          <FilterButton
            active={tab === 'all'}
            count={pending.length + fired.length}
            icon={<Layers className="w-3.5 h-3.5" />}
            onClick={() => setTab('all')}
          >
            همه
          </FilterButton>
        </div>
      </div>

      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-4 sm:p-6 shadow-xl">
        {pageRows.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-300 text-sm">{emptyText}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {pageRows.map((row) => {
              const isFired = Boolean(row._fired || row.firedAt)
              const faded = tab === 'all' && isFired
              return (
                <div
                  key={`${isFired ? 'f' : 'a'}-${row.id}`}
                  className={`py-3.5 flex items-start justify-between gap-3 transition-opacity ${
                    faded ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openTaskPage(row.taskId)}
                    className="min-w-0 text-right flex-1 hover:opacity-90"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-semibold ${isFired ? 'text-slate-300' : 'text-slate-100'}`}>
                        {row.taskTitle || `تسک ${row.taskId}`}
                      </p>
                      {isFired ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500 border border-white/10">
                          یادآوری‌شده
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-200 border border-violet-500/30">
                          فعال
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-xs ${isFired ? 'text-slate-500' : 'text-violet-200'}`}>
                      {formatPersianDateTime(row.remindAt)}
                      {row.firedAt ? ` · شلیک: ${formatPersianDateTime(row.firedAt)}` : ''}
                    </p>
                    {row.note ? <p className="mt-1 text-[11px] text-slate-400">{row.note}</p> : null}
                    {row.jiraKey ? (
                      <span className="mt-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/10">
                        {row.jiraKey}
                      </span>
                    ) : null}
                  </button>
                  {!isFired ? (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(row.taskId, row.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-violet-200 hover:bg-violet-500/10"
                        title="ویرایش یادآوری"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(row.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {filtered.length > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 disabled:opacity-40 hover:bg-white/[0.04]"
            >
              قبلی
            </button>
            <span className="text-[11px] text-slate-500 font-mono">
              {page + 1} / {totalPages} · {filtered.length} مورد
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 disabled:opacity-40 hover:bg-white/[0.04]"
            >
              بعدی
            </button>
          </div>
        ) : null}
      </div>

      <TaskReminderModal
        task={modalTask}
        editReminderId={editReminderId}
        onClose={closeModal}
      />
    </div>
  )
}

function FilterButton({
  active,
  count,
  tone,
  icon,
  onClick,
  children,
}: {
  active: boolean
  count: number
  tone?: 'violet'
  icon: ReactNode
  onClick: () => void
  children: string
}) {
  const countClass = tone === 'violet' ? 'text-violet-300' : 'text-slate-400'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
        active
          ? 'bg-white/[0.08] text-white border-white/15'
          : 'text-slate-400 hover:text-slate-200 border-white/[0.06] bg-black/20'
      }`}
    >
      {icon}
      {children}
      {count > 0 ? <span className={`ms-0.5 font-mono text-[10px] ${countClass}`}>{count}</span> : null}
    </button>
  )
}
