import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Feather,
  Pause,
  Play,
  Square,
  Tag,
  Trash2,
  Zap,
  AlertTriangle,
  MessageCircle,
  PanelLeftClose,
  X,
  FileText,
} from 'lucide-react'
import {
  deleteTask,
  getTask,
  setTaskPinned,
  updateTask,
  updateTaskStatus,
} from '../api/tasks'
import { finishFocus, getFocus } from '../api/focus'
import { listEntityWorkLogs } from '../api/workLogs'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { EntityWorkLogs } from '../components/EntityWorkLogs'
import { TaskChecklist } from '../components/TaskChecklist'
import { TaskCommentThread } from '../components/TaskCommentThread'
import { TagChipsEditor } from '../components/TagChips'
import { TaskOwnershipToggle } from '../components/TaskOwnershipToggle'
import { TaskProblemLinks } from '../components/TaskProblemLinks'
import { MarkdownBody } from '../components/MarkdownBody'
import { acknowledgeTaskReminders } from '../api/reminders'
import { onFocusedTaskDone } from '../lib/resumePreviousFocus'
import { requestTaskFocus } from '../lib/focusSwitch'
import { getJiraIssueStatus, getJiraIssueThread, isJiraCancelledStatus, isJiraClosedStatus } from '../api/jira'
import { formatElapsedClock, formatMinutesLabel, formatPersianDateTime, todayIso } from '../lib/dates'
import { taskJiraKey, taskJiraUrl } from '../lib/jira'
import {
  STUCK_REASONS,
  statusLabel,
  type EnergyType,
  type TaskItem,
  type TaskOwnership,
  type TaskStatus,
} from '../types'

function elapsedSeconds(startedAt?: string | null) {
  if (!startedAt) return 0
  const started = Date.parse(startedAt)
  if (!Number.isFinite(started)) return 0
  return Math.max(0, Math.floor((Date.now() - started) / 1000))
}

export function TaskDetailPage() {
  const { id } = useParams()
  const taskId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [nowTick, setNowTick] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [descOpen, setDescOpen] = useState(true)

  useEffect(() => {
    const fromReminder = Boolean((location.state as { fromReminder?: boolean } | null)?.fromReminder)
    if (!fromReminder || !Number.isFinite(taskId)) return
    void acknowledgeTaskReminders(taskId)
      .then(() => {
        queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: unknown) => {
          if (!Array.isArray(old)) return old
          return old.map((task: { id: number }) =>
            task.id === taskId
              ? { ...task, reminderCount: 0, unreadReminderCount: 0, nextReminderAt: null }
              : task,
          )
        })
        void queryClient.invalidateQueries({ queryKey: ['reminders'] })
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      })
      .catch(() => undefined)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate, queryClient, taskId])

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>('Open')
  const [energyType, setEnergyType] = useState<EnergyType>('Light')
  const [ownership, setOwnership] = useState<TaskOwnership>('Mine')
  const [tags, setTags] = useState('')
  const [stuckReason, setStuckReason] = useState('')
  const [saved, setSaved] = useState(false)

  const taskQuery = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId),
    enabled: Number.isFinite(taskId),
  })

  const focusQuery = useQuery({
    queryKey: ['focus'],
    queryFn: getFocus,
    // Clock ticks via nowTick; avoid 1s API spam on this page
    staleTime: 5_000,
    refetchInterval: (q) => {
      const d = q.state.data
      return d?.active && d.taskId === taskId && !d.isResting ? 15_000 : false
    },
  })

  const logsQuery = useQuery({
    queryKey: ['worklogs', 'task', taskId],
    queryFn: () => listEntityWorkLogs('task', taskId),
    enabled: Number.isFinite(taskId),
  })

  const liveJiraKey = taskJiraKey(taskQuery.data ?? { title: '', jiraKey: null })
  const jiraThreadQuery = useQuery({
    queryKey: ['jira-thread', liveJiraKey],
    queryFn: () => getJiraIssueThread(liveJiraKey!),
    enabled: Boolean(liveJiraKey),
    staleTime: 60_000,
  })
  const jiraStatusQuery = useQuery({
    queryKey: ['jira-status', liveJiraKey],
    queryFn: () => getJiraIssueStatus(liveJiraKey!),
    enabled: Boolean(liveJiraKey),
    staleTime: 60_000,
  })

  useEffect(() => {
    const task = taskQuery.data
    if (!task) return
    setTitle(task.title)
    setStatus(task.status)
    setEnergyType(task.energyType)
    setOwnership(task.ownership === 'Other' ? 'Other' : 'Mine')
    setTags(task.tags.join(', '))
    setStuckReason(task.stuckReason || '')
  }, [taskQuery.data])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((v) => v + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (status === 'Stuck') {
        await updateTaskStatus(taskId, { status: 'Stuck', stuckReason: stuckReason || 'سخته' })
        const focus = await getFocus().catch(() => null)
        if (focus?.taskId === taskId) {
          await finishFocus({ markTaskDone: false }).catch(() => undefined)
        }
      }
      const updated = await updateTask(taskId, {
        title: title.trim(),
        status,
        energyType,
        tags: tags
          .split(/[,،]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .join(','),
        ownership,
      })
      if (status === 'Done') {
        const cached = queryClient.getQueryData<TaskItem[]>(['tasks'])
        await onFocusedTaskDone(taskId, cached)
      }
      return updated
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const ownershipMutation = useMutation({
    mutationFn: async (next: TaskOwnership) => {
      const updated = await updateTask(taskId, {
        title: title.trim() || taskQuery.data?.title || '',
        status,
        energyType,
        tags: tags
          .split(/[,،]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .join(','),
        ownership: next,
      })
      if (next === 'Other') {
        await setTaskPinned(taskId, false).catch(() => undefined)
        const focus = await getFocus().catch(() => null)
        if (focus?.taskId === taskId) {
          await finishFocus({ markTaskDone: false }).catch(() => undefined)
        }
      }
      return updated
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
    },
  })

  const focusMutation = useMutation({
    mutationFn: async () => {
      const task = taskQuery.data
      if (!task) return
      // Reopen Done/Open/Stuck so focus sticks on this task for review.
      if (task.status !== 'Doing') {
        await updateTaskStatus(taskId, { status: 'Doing' })
      }
      await requestTaskFocus(task)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    },
  })

  const pauseMutation = useMutation({
    mutationFn: () => finishFocus({ markTaskDone: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    },
  })

  const finishMutation = useMutation({
    mutationFn: async () => {
      const focus = await getFocus().catch(() => null)
      if (focus?.taskId === taskId && focus.active) {
        await finishFocus({ markTaskDone: true })
      } else {
        await updateTaskStatus(taskId, { status: 'Done' })
      }
      const cached = queryClient.getQueryData<TaskItem[]>(['tasks'])
      await onFocusedTaskDone(taskId, cached)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      navigate('/')
    },
  })

  const handleDelete = async () => {
    const ok = await askTrash(title || 'این کار')
    if (ok) deleteMutation.mutate()
  }

  const focus = focusQuery.data
  const focusedHere = Boolean(focus?.active && focus.taskId === taskId && !focus.isResting)
  void nowTick
  const clock = focusedHere ? formatElapsedClock(elapsedSeconds(focus?.startedAt)) : null

  const timeSummary = useMemo(() => {
    const data = logsQuery.data
    const entries = Array.isArray(data) ? data : (data?.entries ?? [])
    const today = todayIso()
    let todayMin = 0
    for (const row of entries) {
      const day = (row.createdAt || '').slice(0, 10)
      if (day === today) todayMin += row.durationMinutes || 0
    }
    const total =
      !Array.isArray(data) && data && typeof data.totalMinutes === 'number'
        ? data.totalMinutes
        : entries.reduce((sum, row) => sum + (row.durationMinutes || 0), 0)
    return { todayMin, total, sessions: entries.length }
  }, [logsQuery.data])

  if (taskQuery.isLoading) {
    return <div className="py-20 text-center text-slate-500 text-xs">در حال بارگذاری کار...</div>
  }

  if (!taskQuery.data) {
    return <div className="py-20 text-center text-rose-400 text-xs">کار یافت نشد.</div>
  }

  const task = taskQuery.data
  const jiraKey = taskJiraKey(task)
  const jiraUrl = taskJiraUrl(task)
  const assignee = (task.assigneeDisplay || task.assigneeName || '').trim()
  const creator = (task.creatorDisplay || task.creatorName || '').trim()

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>بازگشت</span>
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف
        </button>
      </div>

      {/* Task full-width; chat is a left slide-over so compact task does not leave a hollow column */}
      <div className="relative">
        <main className={`min-w-0 max-w-4xl space-y-2.5 transition-[margin] duration-300 ease-out ${chatOpen ? 'lg:ml-[min(26rem,40vw)]' : ''}`}>
          {/* Compact header */}
          <section className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    isJiraCancelledStatus((jiraStatusQuery.data || jiraThreadQuery.data?.status || '').trim())
                      ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                      : status === 'Done'
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                  }`}>
                    {isJiraCancelledStatus((jiraStatusQuery.data || jiraThreadQuery.data?.status || '').trim()) ? (
                      <XCircle className="h-3 w-3" />
                    ) : status === 'Done' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    )}
                    {((jiraStatusQuery.data || jiraThreadQuery.data?.status || '').trim()) || statusLabel({ status, stuckReason })}
                  </span>
                  {clock ? (
                    <span className="font-mono text-sm font-bold tabular-nums text-amber-300">{clock}</span>
                  ) : null}
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => {
                    if (title.trim() && title.trim() !== task.title) saveMutation.mutate()
                  }}
                  className="w-full bg-transparent text-base sm:text-lg font-bold text-white leading-snug focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                  {jiraUrl ? (
                    <a
                      href={jiraUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-sky-300 hover:text-white"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {jiraKey}
                    </a>
                  ) : null}
                  {assignee ? (
                    <span>
                      · مسئول: <span className="text-slate-200">{assignee}</span>
                    </span>
                  ) : creator ? (
                    <span>
                      · سازنده: <span className="text-slate-200">{creator}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {focusedHere ? (
                  <button
                    type="button"
                    disabled={pauseMutation.isPending}
                    onClick={() => pauseMutation.mutate()}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-black/20 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 hover:bg-black/40"
                  >
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    توقف
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={focusMutation.isPending}
                    onClick={() => focusMutation.mutate()}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    شروع
                  </button>
                )}
                <button
                  type="button"
                  disabled={finishMutation.isPending || status === 'Done'}
                  onClick={() => finishMutation.mutate()}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"
                >
                  <Square className="h-3 w-3" />
                  پایان کار
                </button>
              </div>
            </div>
          </section>


          {(() => {
            const jiraName = (
              (jiraStatusQuery.data || '') ||
              (jiraThreadQuery.data?.status || '')
            ).trim()
            const cancelled = Boolean(jiraName && isJiraCancelledStatus(jiraName))
            const jiraClosed = Boolean(jiraName && isJiraClosedStatus(jiraName))
            if (status === 'Done' || jiraClosed) {
              return (
                <section className={`rounded-xl px-3 py-3 border ${
                  cancelled
                    ? 'border-rose-400/35 bg-rose-500/10'
                    : 'border-emerald-400/35 bg-emerald-500/10'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      cancelled ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {cancelled ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className={`text-sm font-bold ${
                        cancelled ? 'text-rose-200' : 'text-emerald-200'
                      }`}>
                        {cancelled ? 'این کار کنسل / بسته شده' : 'این کار تموم شده'}
                      </p>
                      <p className={`text-[11px] ${
                        cancelled ? 'text-rose-100/70' : 'text-emerald-100/70'
                      }`}>
                        {jiraName
                          ? `وضعیت Jira: ${jiraName}`
                          : 'وضعیت TaskOS روی «تکمیل شده» است — تسک دان خورده.'}
                      </p>
                    </div>
                  </div>
                </section>
              )
            }
            return null
          })()}
          {/* Compact details card */}
          <section className="rounded-xl border border-[#212738] bg-[#141824] px-3 py-2.5">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="mb-2 flex w-full items-center justify-between text-[11px] font-semibold text-slate-400"
            >
              <span>جزئیات</span>
              <span className="text-slate-500">{detailsOpen ? 'بستن' : 'باز کردن'}</span>
            </button>
            {detailsOpen ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-[10px] text-slate-500">وضعیت</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="w-full rounded-lg border border-[#2b354d] bg-[#0b0e16] px-2 py-1.5 text-[11px] text-slate-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="Open">باز برای اقدام</option>
                      <option value="Doing">در حال انجام</option>
                      <option value="Stuck">متوقف / گیر کرده</option>
                      <option value="Done">تکمیل شده</option>
                    </select>
                  </label>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500">نوع تمرکز</span>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#2b354d] bg-[#0b0e16] p-0.5">
                      <button
                        type="button"
                        onClick={() => setEnergyType('Deep')}
                        className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-bold ${
                          energyType === 'Deep' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                        }`}
                      >
                        <Zap className="h-3 w-3" />
                        عمیق
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnergyType('Light')}
                        className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-bold ${
                          energyType === 'Light' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                        }`}
                      >
                        <Feather className="h-3 w-3" />
                        سبک
                      </button>
                    </div>
                  </div>
                </div>

                <TaskOwnershipToggle
                  value={ownership}
                  otherLabel={assignee || undefined}
                  disabled={ownershipMutation.isPending}
                  onChange={(next) => {
                    setOwnership(next)
                    ownershipMutation.mutate(next)
                  }}
                />

                {status === 'Stuck' ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2">
                    <label className="mb-1 flex items-center gap-1 text-[11px] font-bold text-rose-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      علت توقف
                    </label>
                    <select
                      value={stuckReason}
                      onChange={(e) => setStuckReason(e.target.value)}
                      className="w-full rounded-lg border border-rose-500/40 bg-[#0b0e16] px-2 py-1.5 text-[11px] text-rose-200 focus:outline-none"
                    >
                      <option value="">انتخاب...</option>
                      {STUCK_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                    <Tag className="h-3 w-3 text-amber-400" />
                    برچسب‌ها
                  </label>
                  <TagChipsEditor value={tags} onChange={setTags} placeholder="سعید، محمد، جیرا" />
                </div>

                <TaskProblemLinks task={task} />

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                      saved
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {saved ? 'ذخیره شد' : 'ثبت'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>
                  وضعیت: <span className="text-slate-200">{((jiraStatusQuery.data || jiraThreadQuery.data?.status || '').trim()) || statusLabel({ status, stuckReason })}</span>
                </span>
                <span>
                  تمرکز: <span className="text-slate-200">{energyType === 'Deep' ? 'عمیق' : 'سبک'}</span>
                </span>
                {jiraKey ? <span className="font-mono text-sky-300">{jiraKey}</span> : null}
              </div>
            )}
          </section>

                    {(() => {
            const desc = (jiraThreadQuery.data?.description || '').trim()
            if (!desc) return null
            const who =
              (jiraThreadQuery.data?.creator?.displayName ||
                jiraThreadQuery.data?.creator?.name ||
                jiraThreadQuery.data?.reporter?.displayName ||
                jiraThreadQuery.data?.reporter?.name ||
                creator ||
                '').trim()
            return (
              <section className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setDescOpen((v) => !v)}
                  className="mb-1.5 flex w-full items-center justify-between gap-2 text-start"
                >
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-200">
                    <FileText className="h-3.5 w-3.5" />
                    شرح تیکت
                    {who ? <span className="font-normal text-slate-400">· {who}</span> : null}
                  </span>
                  <span className="text-[10px] text-slate-500">{descOpen ? 'بستن' : 'باز کردن'}</span>
                </button>
                {jiraThreadQuery.data?.created ? (
                  <p className="mb-1.5 text-[10px] text-slate-500">{formatPersianDateTime(jiraThreadQuery.data.created)}</p>
                ) : null}
                {descOpen ? (
                  <MarkdownBody text={desc} />
                ) : (
                  <p className="line-clamp-2 text-[11px] text-slate-400">{desc.replace(/\s+/g, ' ').slice(0, 160)}</p>
                )}
              </section>
            )
          })()}
<TaskChecklist taskId={taskId} compact />

          <section className="rounded-xl border border-[#212738] bg-[#141824] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-bold text-slate-300">زمان کار</h3>
              <button
                type="button"
                onClick={() => setTimeOpen((v) => !v)}
                className="text-[10px] text-sky-300 hover:text-sky-200"
              >
                {timeOpen ? 'بستن جزئیات' : 'جزئیات بیشتر'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-black/25 px-2 py-1.5">
                <p className="text-[10px] text-slate-500">امروز</p>
                <p className="text-xs font-bold text-amber-200">{formatMinutesLabel(timeSummary.todayMin)}</p>
              </div>
              <div className="rounded-lg bg-black/25 px-2 py-1.5">
                <p className="text-[10px] text-slate-500">جلسه‌ها</p>
                <p className="text-xs font-bold text-slate-200">{timeSummary.sessions}</p>
              </div>
              <div className="rounded-lg bg-black/25 px-2 py-1.5">
                <p className="text-[10px] text-slate-500">کل زمان</p>
                <p className="text-xs font-bold text-amber-300">{formatMinutesLabel(timeSummary.total)}</p>
              </div>
            </div>
            {timeOpen ? (
              <div className="mt-2 border-t border-white/[0.06] pt-2">
                <EntityWorkLogs kind="task" id={taskId} />
              </div>
            ) : null}
          </section>
        </main>

        {/* Chat docks on the left and shifts task right on desktop (no black void) */}
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className={`fixed z-40 top-[42%] flex flex-col items-center gap-1 rounded-r-xl border border-l-0 border-sky-400/30 bg-[#141824]/95 px-1.5 py-3 text-[10px] font-bold text-sky-200 shadow-xl backdrop-blur transition-all duration-300 ease-out hover:bg-sky-500/20 hover:text-white ${
            chatOpen
              ? 'left-[min(26rem,40vw)]'
              : 'left-0'
          }`}
          aria-expanded={chatOpen}
          aria-controls="task-chat-drawer"
          title={chatOpen ? 'بستن گفتگو' : 'باز کردن گفتگو'}
        >
          {chatOpen ? <PanelLeftClose className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
          <span className="[writing-mode:vertical-rl] rotate-180 tracking-wider">گفتگو</span>
        </button>

        <div
          className={`fixed inset-0 z-30 bg-black/55 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${
            chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setChatOpen(false)}
          aria-hidden={!chatOpen}
        />

        <aside
          id="task-chat-drawer"
          className={`fixed z-40 top-0 bottom-0 left-0 flex w-[min(100vw-2.5rem,26rem)] flex-col border-r border-sky-400/20 bg-[#0b0e16] p-2 shadow-2xl transition-transform duration-300 ease-out lg:top-14 ${
            chatOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
        >
          <div className="mb-1 flex shrink-0 items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-bold text-slate-300">گفتگو تیم</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
              aria-label="بستن"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <TaskCommentThread
              taskId={taskId}
              jiraKey={jiraKey || task.jiraKey}
              layout="panel"
            />
          </div>
        </aside>      </div>
    </div>
  )
}
