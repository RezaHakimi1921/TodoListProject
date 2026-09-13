import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Link2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import {
  addProblemAction,
  attachProblemTasks,
  deleteProblem,
  deleteProblemAction,
  detachProblemTask,
  getProblem,
  updateProblem,
  updateProblemAction,
  type ProblemDraft,
} from '../api/problems'
import { fetchJiraIssueSummary, registerJiraIssue } from '../api/jira'
import { getTask, listTasks } from '../api/tasks'
import { EntityWorkLogs } from '../components/EntityWorkLogs'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { GOLD_QUESTIONS, PROBLEM_STATUS_LABEL, STATUS_LABEL, type ProblemStatus, type TaskItem } from '../types'
import { requestProblemFocus } from '../lib/focusSwitch'
import { formatPersianDateTime } from '../lib/dates'

const STATUSES: ProblemStatus[] = ['Open', 'Monitoring', 'Resolved']

type FieldKey = Exclude<keyof ProblemDraft, 'title' | 'status'>

const SECTIONS: Array<{
  id: string
  title: string
  hint: string
  fields: Array<{ key: FieldKey; label: string; rows?: number; date?: boolean }>
}> = [
  {
    id: 'expected',
    title: '۲. رفتار مورد انتظار',
    hint: 'چه چیزی باید اتفاق می‌افتاد؟',
    fields: [{ key: 'expectedBehavior', label: 'حالت درست فرآیند', rows: 3 }],
  },
  {
    id: 'actual',
    title: '۳. رفتار واقعی',
    hint: 'بدون حدس و راه‌حل بنویس دقیقاً چه رخ داده.',
    fields: [{ key: 'actualBehavior', label: 'چه اتفاقی افتاد؟ کجا دیده شد؟', rows: 4 }],
  },
  {
    id: 'impact',
    title: '۴. اثر و Side Effect',
    hint: 'فقط همین مورد بوده یا هر چیزی زیر همین شرایط ممکن است خراب باشد؟',
    fields: [
      { key: 'impactBranches', label: 'مجموعه‌ها / Branches' },
      { key: 'impactCustomers', label: 'مشتری‌ها' },
      { key: 'impactRecords', label: 'رکوردها' },
      { key: 'impactServices', label: 'سرویس‌ها' },
      { key: 'impactSupport', label: 'زمان پشتیبانی' },
      { key: 'impactBusiness', label: 'اثر کسب‌وکار' },
    ],
  },
  {
    id: 'timeline',
    title: '۵. Timeline',
    hint: 'دنبال شروع مشکل باش، نه فقط زمان کشف.',
    fields: [
      { key: 'startedAt', label: 'شروع مشکل', date: true },
      { key: 'firstAffectedAt', label: 'اولین مورد درگیر', date: true },
      { key: 'detectedAt', label: 'کشف شد', date: true },
      { key: 'rootCauseFoundAt', label: 'علت پیدا شد', date: true },
      { key: 'fixedAt', label: 'اصلاح شد', date: true },
      { key: 'recoveryCompletedAt', label: 'Recovery تمام شد', date: true },
    ],
  },
  {
    id: 'root',
    title: '۶. علت اصلی',
    hint: 'چرا؟ را چند بار بپرس. «کانورتور خراب بود» هنوز علت اصلی نیست.',
    fields: [{ key: 'rootCause', label: 'Root Cause', rows: 4 }],
  },
  {
    id: 'detect',
    title: '۷. چرا زودتر نفهمیدیم؟',
    hint: 'چرا سیستم به ما نگفت و انسان مجبور شد متوجه شود؟',
    fields: [{ key: 'detectionGap', label: 'شکاف Detection', rows: 3 }],
  },
  {
    id: 'affected',
    title: '۸. جمعیت درگیر',
    hint: 'از StartDate تا FixDate چه مواردی تحت تأثیر بودند؟',
    fields: [{ key: 'affectedPopulation', label: 'فهرست موارد / لاگ برای بقیه', rows: 4 }],
  },
  {
    id: 'resolution',
    title: '۹. Resolution',
    hint: 'چه کاری برای رفع ریشه انجام شد؟ با Recovery یکی نیست.',
    fields: [{ key: 'resolution', label: 'چه کردیم', rows: 3 }],
  },
  {
    id: 'recovery',
    title: '۱۰. Recovery گذشته',
    hint: 'Problem Fixed ≠ Historical Data Fixed',
    fields: [{ key: 'recovery', label: 'موارد قبلی چگونه اصلاح شدند؟', rows: 3 }],
  },
  {
    id: 'validation',
    title: '۱۱. Validation',
    hint: 'از کجا مطمئن شدیم مشکل کاملاً حل شده؟',
    fields: [{ key: 'validationNote', label: 'نشانه صحت', rows: 3 }],
  },
  {
    id: 'cost',
    title: '۱۲. هزینه',
    hint: 'فنی / عملیاتی / کسب‌وکار / فرصت ازدست‌رفته',
    fields: [
      { key: 'costTechnical', label: 'Technical' },
      { key: 'costOperational', label: 'Operational' },
      { key: 'costBusiness', label: 'Business' },
      { key: 'costOpportunity', label: 'Opportunity' },
    ],
  },
  {
    id: 'prevention',
    title: '۱۳. Prevention',
    hint: 'دفعه بعد چه چیزی باید قبل از مشتری یا پشتیبانی به ما بگوید؟',
    fields: [{ key: 'prevention', label: 'چه باید تغییر کند', rows: 3 }],
  },
]

function emptyDraft(): ProblemDraft & { title: string; status: ProblemStatus } {
  return {
    title: '',
    status: 'Open',
    expectedBehavior: '',
    actualBehavior: '',
    rootCause: '',
    detectionGap: '',
    affectedPopulation: '',
    resolution: '',
    recovery: '',
    validationNote: '',
    prevention: '',
    impactBranches: '',
    impactCustomers: '',
    impactRecords: '',
    impactServices: '',
    impactSupport: '',
    impactBusiness: '',
    startedAt: '',
    firstAffectedAt: '',
    detectedAt: '',
    rootCauseFoundAt: '',
    fixedAt: '',
    recoveryCompletedAt: '',
    costTechnical: '',
    costOperational: '',
    costBusiness: '',
    costOpportunity: '',
  }
}

export function ProblemStudioPage() {
  const { id } = useParams()
  const problemId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [draft, setDraft] = useState(emptyDraft)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [actionTitle, setActionTitle] = useState('')
  const [actionOwner, setActionOwner] = useState('')
  const [actionDeadline, setActionDeadline] = useState('')
  const [taskQuery, setTaskQuery] = useState('')
  const [pickedTaskIds, setPickedTaskIds] = useState<Set<number>>(new Set())
  const [attachError, setAttachError] = useState('')
  const [sectionSavedAt, setSectionSavedAt] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const skipHydrate = useRef(false)

  const problemQuery = useQuery({
    queryKey: ['problem', problemId],
    queryFn: () => getProblem(problemId),
    enabled: Number.isFinite(problemId),
  })
  const problem = problemQuery.data

  const searchQuery = useQuery({
    queryKey: ['task-search', 'attach', taskQuery],
    queryFn: () => findAttachableTasks(taskQuery),
  })

  useEffect(() => {
    if (!problem) return
    if (skipHydrate.current) {
      skipHydrate.current = false
      return
    }
    const next = {
      ...emptyDraft(),
      title: problem.title,
      status: problem.status,
      expectedBehavior: problem.expectedBehavior ?? '',
      actualBehavior: problem.actualBehavior ?? '',
      rootCause: problem.rootCause ?? '',
      detectionGap: problem.detectionGap ?? '',
      affectedPopulation: problem.affectedPopulation ?? '',
      resolution: problem.resolution ?? '',
      recovery: problem.recovery ?? '',
      validationNote: problem.validationNote ?? '',
      prevention: problem.prevention ?? '',
      impactBranches: problem.impactBranches ?? '',
      impactCustomers: problem.impactCustomers ?? '',
      impactRecords: problem.impactRecords ?? '',
      impactServices: problem.impactServices ?? '',
      impactSupport: problem.impactSupport ?? '',
      impactBusiness: problem.impactBusiness ?? '',
      startedAt: (problem.startedAt ?? '').slice(0, 10),
      firstAffectedAt: (problem.firstAffectedAt ?? '').slice(0, 10),
      detectedAt: (problem.detectedAt ?? '').slice(0, 10),
      rootCauseFoundAt: (problem.rootCauseFoundAt ?? '').slice(0, 10),
      fixedAt: (problem.fixedAt ?? '').slice(0, 10),
      recoveryCompletedAt: (problem.recoveryCompletedAt ?? '').slice(0, 10),
      costTechnical: problem.costTechnical ?? '',
      costOperational: problem.costOperational ?? '',
      costBusiness: problem.costBusiness ?? '',
      costOpportunity: problem.costOpportunity ?? '',
    }
    setDraft(next)
    setSectionSavedAt(problem.sectionSavedAt ?? {})
    setLastSavedAt(problem.updatedAt)
    setOpenSections(
      new Set(
        SECTIONS.filter((section) =>
          section.fields.some((field) => Boolean((next[field.key] ?? '').toString().trim())),
        ).map((section) => section.id),
      ),
    )
  }, [problem])

  const saveMutation = useMutation({
    mutationFn: async (sectionId?: string) => {
      setSaveError('')
      const stamps = { ...sectionSavedAt }
      if (sectionId) stamps[sectionId] = new Date().toISOString()
      const saved = await updateProblem(problemId, { ...draft, sectionSavedAt: stamps })
      const wrote =
        Boolean(saved.expectedBehavior || saved.actualBehavior || saved.rootCause || saved.title === draft.title)
      if (draft.expectedBehavior.trim() && saved.expectedBehavior !== draft.expectedBehavior) {
        throw new Error('یادداشت ذخیره نشد. چند ثانیه بعد دوباره ثبت را بزن.')
      }
      skipHydrate.current = true
      queryClient.setQueryData(['problem', problemId], saved)
      setSectionSavedAt(saved.sectionSavedAt ?? stamps)
      setLastSavedAt(saved.updatedAt)
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      return wrote ? saved : saved
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'ثبت انجام نشد.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProblem(problemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      navigate('/problems')
    },
  })

  const refreshProblem = () => {
    void queryClient.invalidateQueries({ queryKey: ['problem', problemId] })
    void queryClient.invalidateQueries({ queryKey: ['problems'] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const linkedIds = useMemo(() => new Set((problem?.tasks ?? []).map((row) => row.id)), [problem?.tasks])
  const searchHits = useMemo(() => {
    const raw = taskQuery.trim().toLowerCase()
    const keyMatch = raw.match(/[a-z][a-z0-9]+-\d+/i)
    const query = keyMatch?.[0] || raw
    return (searchQuery.data ?? [])
      .filter((task) => !linkedIds.has(task.id))
      .filter((task) => {
        if (!query) return true
        const hay = `${task.title} ${task.jiraKey ?? ''} ${task.jiraUrl ?? ''} ${task.id}`.toLowerCase()
        return hay.includes(query)
      })
      .sort((a, b) => Number(b.status === 'Done') - Number(a.status === 'Done') || b.id - a.id)
  }, [linkedIds, searchQuery.data, taskQuery])
  const openHits = searchHits.filter((task) => task.status !== 'Done')
  const doneHits = searchHits.filter((task) => task.status === 'Done')
  const togglePicked = (taskId: number) => {
    setPickedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const toggle = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const setField = (key: keyof typeof draft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  if (problemQuery.isLoading) {
    return <div className="py-20 text-center text-slate-500 text-xs">در حال بارگذاری تحقیق...</div>
  }
  if (!problem) {
    return <div className="py-20 text-center text-rose-400 text-xs">مسئله یافت نشد.</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/problems" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300">
          <ArrowRight className="w-4 h-4" />
          لیست مسائل
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void requestProblemFocus({ id: problemId, title: draft.title || problem.title }).then(() =>
                queryClient.invalidateQueries({ queryKey: ['focus'] }),
              )
            }
            className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.06]"
          >
            شروع تمرکز روی مسئله
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await askTrash(problem.title)) deleteMutation.mutate()
            }}
            className="p-1.5 text-slate-500 hover:text-rose-400"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
        <div className="mb-2 flex items-center gap-2 text-amber-200">
          <HelpCircle className="h-4 w-4" />
          <h2 className="text-xs font-bold">پنج سؤال طلایی</h2>
        </div>
        <ol className="grid gap-1.5 text-[12px] leading-relaxed text-amber-50/90 sm:grid-cols-2">
          {GOLD_QUESTIONS.map((item, index) => (
            <li key={item} className="rounded-lg bg-black/20 px-2.5 py-1.5">
              <span className="ms-1 font-mono text-[10px] text-amber-300">{index + 1}.</span> {item}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#141824] p-5">
        <p className="text-[11px] font-semibold text-slate-400">۱۵. وضعیت نهایی</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setDraft((prev) => ({ ...prev, status }))
                void updateProblem(problemId, { ...draft, status }).then(refreshProblem)
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                draft.status === status
                  ? 'border-amber-400/50 bg-amber-400 text-slate-950'
                  : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {PROBLEM_STATUS_LABEL[status]}
            </button>
          ))}
        </div>
        <label className="block text-[11px] font-semibold text-slate-400">۱. مسئله — دقیقاً چه مشکلی رخ داده؟</label>
        <input
          value={draft.title}
          onChange={(event) => setField('title', event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-base font-bold text-white focus:border-amber-400/50 focus:outline-none"
        />
        <SaveBar
          pending={saveMutation.isPending}
          error={saveError}
          savedAt={lastSavedAt}
          onSave={() => saveMutation.mutate(undefined)}
        />
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#141824] p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-white">
            <Link2 className="h-4 w-4 text-sky-300" />
            تسک‌های وصل‌شده
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-200">
              {problem.taskCount ?? problem.tasks?.length ?? 0}
            </span>
          </h2>
        </div>
        <div className="space-y-2">
          {(problem.tasks ?? []).length === 0 ? (
            <p className="text-[12px] text-slate-500">هنوز تسکی وصل نیست. تسک باز یا Done را از پایین انتخاب کن.</p>
          ) : (
            (problem.tasks ?? []).map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                <Link to={`/tasks/${task.id}`} className="min-w-0 text-right">
                  <p className="truncate text-xs font-semibold text-slate-100">{task.title}</p>
                  <p className="text-[10px] text-slate-500">{task.jiraKey || `کار #${task.id}`}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => void detachProblemTask(problemId, task.id).then(refreshProblem)}
                  className="text-[11px] text-slate-500 hover:text-rose-300"
                >
                  جدا کن
                </button>
              </div>
            ))
          )}
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
            placeholder="شماره یا کلید جیرا: 2795 یا PS-2795"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pe-3 ps-9 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400/40 focus:outline-none"
          />
          <div className="mt-1 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#10131b] p-1">
            {searchQuery.isFetching ? (
              <p className="px-2 py-2 text-[11px] text-slate-500">در حال جستجو در تسک‌ها و جیرا...</p>
            ) : searchQuery.isError ? (
              <p className="px-2 py-2 text-[11px] text-rose-300">جستجو خطا داد. دوباره امتحان کن.</p>
            ) : searchHits.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-slate-500">
                تسکی پیدا نشد. شماره را مثل 2795 یا PS-2795 بنویس تا از جیرا هم بیاید.
              </p>
            ) : (
              <>
                {doneHits.length > 0 ? (
                  <div>
                    <p className="px-2 py-1 text-[10px] font-semibold text-emerald-300/80">تکمیل‌شده</p>
                    {(taskQuery.trim() ? doneHits : doneHits.slice(0, 40)).map((task) => (
                      <AttachTaskRow
                        key={task.id}
                        task={task}
                        checked={pickedTaskIds.has(task.id)}
                        onToggle={() => togglePicked(task.id)}
                      />
                    ))}
                  </div>
                ) : null}
                {openHits.length > 0 ? (
                  <div>
                    <p className="px-2 py-1 text-[10px] font-semibold text-slate-500">باز / در جریان</p>
                    {(taskQuery.trim() ? openHits : openHits.slice(0, 12)).map((task) => (
                      <AttachTaskRow
                        key={task.id}
                        task={task}
                        checked={pickedTaskIds.has(task.id)}
                        onToggle={() => togglePicked(task.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">{pickedTaskIds.size} تسک انتخاب شده</p>
            <button
              type="button"
              disabled={pickedTaskIds.size === 0}
              onClick={() => {
                setAttachError('')
                void attachProblemTasks(problemId, [...pickedTaskIds])
                  .then(() => {
                    setPickedTaskIds(new Set())
                    setTaskQuery('')
                    refreshProblem()
                  })
                  .catch((error: unknown) => {
                    setAttachError(error instanceof Error ? error.message : 'وصل تسک انجام نشد.')
                  })
              }}
              className="rounded-xl bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 disabled:opacity-40"
            >
              وصل کردن انتخاب‌ها
            </button>
          </div>
          {attachError ? <p className="mt-1 text-[11px] text-rose-300">{attachError}</p> : null}
        </div>
      </section>

      {SECTIONS.map((section) => {
        const open = openSections.has(section.id)
        const filled = section.fields.some((field) => Boolean((draft[field.key] ?? '').toString().trim()))
        return (
          <section key={section.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141824]">
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="flex w-full items-center justify-between px-5 py-3 text-right"
            >
              <span>
                <span className="text-sm font-bold text-white">{section.title}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{section.hint}</span>
              </span>
              <span className="flex items-center gap-2">
                {sectionSavedAt[section.id] ? (
                  <span className="text-[10px] text-emerald-300">{formatPersianDateTime(sectionSavedAt[section.id])}</span>
                ) : null}
                {filled ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : null}
                <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {open ? (
              <div className="grid gap-3 border-t border-white/[0.05] px-5 py-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <label key={field.key} className={field.rows || section.fields.length === 1 ? 'sm:col-span-2' : ''}>
                    <span className="mb-1 block text-[11px] font-medium text-slate-400">{field.label}</span>
                    {field.date ? (
                      <input
                        type="date"
                        value={draft[field.key] ?? ''}
                        onChange={(event) => setField(field.key, event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-100 focus:border-amber-400/40 focus:outline-none"
                      />
                    ) : (
                      <textarea
                        rows={field.rows ?? 2}
                        value={draft[field.key] ?? ''}
                        onChange={(event) => setField(field.key, event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 p-2.5 text-xs leading-relaxed text-slate-100 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none"
                      />
                    )}
                  </label>
                ))}
                <div className="sm:col-span-2">
                  <SaveBar
                    pending={saveMutation.isPending}
                    error={saveError}
                    savedAt={sectionSavedAt[section.id] || lastSavedAt}
                    label="ثبت این بخش"
                    onSave={() => saveMutation.mutate(section.id)}
                  />
                </div>
              </div>
            ) : null}
          </section>
        )
      })}

      <section className="rounded-2xl border border-white/[0.08] bg-[#141824] p-5">
        <h2 className="mb-3 text-sm font-bold text-white">۱۴. Action Items</h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]">
          <input
            value={actionTitle}
            onChange={(event) => setActionTitle(event.target.value)}
            placeholder="اقدام"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-100"
          />
          <input
            value={actionOwner}
            onChange={(event) => setActionOwner(event.target.value)}
            placeholder="مسئول"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-100"
          />
          <input
            type="date"
            value={actionDeadline}
            onChange={(event) => setActionDeadline(event.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-100"
          />
          <button
            type="button"
            disabled={!actionTitle.trim()}
            onClick={() => {
              void addProblemAction(problemId, {
                title: actionTitle.trim(),
                owner: actionOwner.trim() || undefined,
                deadline: actionDeadline || undefined,
              }).then(() => {
                setActionTitle('')
                setActionOwner('')
                setActionDeadline('')
                refreshProblem()
              })
            }}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن
          </button>
        </div>
        <div className="space-y-2">
          {(problem.actions ?? []).map((action) => (
            <div key={action.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  void updateProblemAction(problemId, action.id, {
                    title: action.title,
                    owner: action.owner ?? undefined,
                    deadline: action.deadline ?? undefined,
                    status: action.status === 'Done' ? 'Open' : 'Done',
                  }).then(refreshProblem)
                }
                className={`h-4 w-4 shrink-0 rounded border ${
                  action.status === 'Done' ? 'border-emerald-400 bg-emerald-400' : 'border-slate-500'
                }`}
                aria-label="وضعیت اقدام"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-xs ${action.status === 'Done' ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                  {action.title}
                </p>
                {action.owner || action.deadline ? (
                  <p className="text-[10px] text-slate-500">
                    {[action.owner, action.deadline?.slice(0, 10)].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void deleteProblemAction(problemId, action.id).then(refreshProblem)}
                className="text-slate-500 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <EntityWorkLogs kind="problem" id={problem.id} />
    </div>
  )
}

function guessJiraKeys(raw: string) {
  const text = raw.trim()
  if (!text) return []
  const fromUrl = text.match(/[A-Z][A-Z0-9]+-\d+/i)
  if (fromUrl) return [fromUrl[0].toUpperCase()]
  if (/^\d{3,}$/.test(text)) return [`PS-${text}`]
  return []
}

async function findAttachableTasks(raw: string): Promise<TaskItem[]> {
  const query = raw.trim()
  const keys = guessJiraKeys(query)
  const searches = [
    listTasks({ q: query || undefined, includeDone: true }),
    listTasks({ status: 'Done', q: query || undefined }),
    ...keys.map((key) => listTasks({ q: key, includeDone: true })),
  ]
  const batches = await Promise.all(searches.map((item) => item.catch(() => [] as TaskItem[])))
  const map = new Map<number, TaskItem>()
  for (const task of batches.flat()) map.set(task.id, task)
  if (map.size === 0 && keys.length > 0) {
    for (const key of keys) {
      const issue = await fetchJiraIssueSummary(key).catch(() => null)
      if (!issue) continue
      const registered = await registerJiraIssue({
        jiraKey: issue.key,
        title: issue.title,
        jiraUrl: `https://jira.smartx.ir/browse/${issue.key}`,
      })
      const taskId = registered.matchedTask?.id
      if (!taskId) continue
      const task = await getTask(taskId)
      map.set(task.id, task)
    }
  }
  return [...map.values()]
}

function SaveBar({
  pending,
  error,
  savedAt,
  onSave,
  label = 'ثبت',
}: {
  pending: boolean
  error?: string
  savedAt?: string
  onSave: () => void
  label?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <p className="text-[11px] text-slate-500">
        {savedAt ? `ثبت شد: ${formatPersianDateTime(savedAt)}` : 'هنوز ثبت نشده'}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="rounded-xl bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 disabled:opacity-40"
      >
        {pending ? 'در حال ثبت...' : label}
      </button>
      {error ? <p className="w-full text-[11px] text-rose-300">{error}</p> : null}
    </div>
  )
}

function AttachTaskRow({
  task,
  checked,
  onToggle,
}: {
  task: TaskItem
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]">
      <input type="checkbox" checked={checked} onChange={onToggle} className="accent-amber-400" />
      <span className={`min-w-0 flex-1 truncate ${task.status === 'Done' ? 'text-slate-300' : ''}`}>{task.title}</span>
      <span className="shrink-0 text-[10px] text-slate-500">
        {task.jiraKey ? `${task.jiraKey} · ` : ''}
        {STATUS_LABEL[task.status]}
      </span>
    </label>
  )
}
