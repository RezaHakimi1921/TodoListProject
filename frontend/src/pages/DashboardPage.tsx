import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteTask, listTasks, updateTaskStatus } from '../api/tasks'
import { AgingModal } from '../components/AgingModal'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { QuickAddTask } from '../components/QuickAddTask'
import { TaskCard } from '../components/TaskCard'
import { TaskEditorDrawer } from '../components/TaskEditorDrawer'
import type { StuckReason, TaskItem, TaskStatus } from '../types'

const STATUSES: Array<{ value: '' | TaskStatus; label: string }> = [
  { value: '', label: 'همه' },
  { value: 'Open', label: 'باز' },
  { value: 'Doing', label: 'در حال انجام' },
  { value: 'Stuck', label: 'گیر کرده' },
  { value: 'Done', label: 'انجام شد' },
]

export function DashboardPage() {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [status, setStatus] = useState<'' | TaskStatus>('')
  const [tag, setTag] = useState('')
  const [agingTask, setAgingTask] = useState<TaskItem | null>(null)
  const [editing, setEditing] = useState<TaskItem | null>(null)

  const tasksQuery = useQuery({
    queryKey: ['tasks', status, tag],
    queryFn: () => listTasks({ status: status || undefined, tag: tag.trim() || undefined }),
  })

  const agingMutation = useMutation({
    mutationFn: ({ task, reason }: { task: TaskItem; reason: StuckReason }) =>
      updateTaskStatus(task.id, {
        status: reason === 'مهم نیست دیگه' ? 'Done' : 'Stuck',
        stuckReason: reason,
      }),
    onSuccess: () => {
      setAgingTask(null)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ task, next }: { task: TaskItem; next: TaskStatus }) => updateTaskStatus(task.id, { status: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      setEditing(null)
    },
  })

  const groups = useMemo(() => {
    const tasks = tasksQuery.data ?? []
    return {
      Deep: tasks.filter((task) => task.energyType === 'Deep'),
      Light: tasks.filter((task) => task.energyType === 'Light'),
    }
  }, [tasksQuery.data])

  const remove = (task: TaskItem) => {
    void askTrash('این کار').then((ok) => {
      if (ok) deleteMutation.mutate(task.id)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">امروز چی باید جلو بره؟</h1>
        <p className="mt-2 text-sm text-paper/50">روی کارت کلیک کن تا باز و ویرایش شود.</p>
      </div>

      <QuickAddTask />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((item) => (
            <button
              key={item.value || 'all'}
              type="button"
              onClick={() => setStatus(item.value)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                status === item.value ? 'bg-paper text-ink-950' : 'bg-ink-800 text-paper/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder="فیلتر تگ"
          className="rounded-full border border-white/10 bg-ink-800 px-4 py-2 text-sm outline-none sm:mr-auto"
        />
      </div>

      {tasksQuery.isLoading && <p className="text-paper/50">در حال بارگذاری...</p>}
      {tasksQuery.isError && <p className="text-rose-300">اتصال به API برقرار نشد.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Column
          title="تمرکز عمیق"
          hint="Deep Focus"
          tasks={groups.Deep}
          onOpen={setEditing}
          onAging={setAgingTask}
          onStatus={(task, next) => statusMutation.mutate({ task, next })}
          onDelete={remove}
        />
        <Column
          title="کارهای سبک"
          hint="Light / Quick"
          tasks={groups.Light}
          onOpen={setEditing}
          onAging={setAgingTask}
          onStatus={(task, next) => statusMutation.mutate({ task, next })}
          onDelete={remove}
        />
      </div>

      <AgingModal
        task={agingTask}
        onClose={() => setAgingTask(null)}
        onChoose={(reason) => agingTask && agingMutation.mutate({ task: agingTask, reason })}
      />
      <TaskEditorDrawer task={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Column({
  title,
  hint,
  tasks,
  onOpen,
  onAging,
  onStatus,
  onDelete,
}: {
  title: string
  hint: string
  tasks: TaskItem[]
  onOpen: (task: TaskItem) => void
  onAging: (task: TaskItem) => void
  onStatus: (task: TaskItem, status: TaskStatus) => void
  onDelete: (task: TaskItem) => void
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-ink-900/50 p-4">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-paper/35">{hint}</p>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <span className="text-sm text-paper/40">{tasks.length}</span>
      </div>
      <div className="space-y-3">
        {tasks.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-paper/35">خالی است.</p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            onAgingClick={onAging}
            onStatus={onStatus}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  )
}
