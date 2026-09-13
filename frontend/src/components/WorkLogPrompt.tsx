import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ClipboardList, HelpCircle, Power } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProblem, listProblems } from '../api/problems'
import { createTask, getTask, listTasks, updateTaskStatus } from '../api/tasks'
import { clearFocus, finishFocus, getFocus, setFocus, tickFocus } from '../api/focus'
import { captureWorkLog } from '../api/workLogs'
import { ackPing, DEFAULT_PING_MINUTES, getSettings, saveSettings, testToast } from '../api/settings'
import { PROBLEM_STATUS_LABEL, STATUS_LABEL, type Problem, type TaskItem, type WorkLogSource } from '../types'
import { minutesUntilPing } from '../lib/notify'

const CHECK_MS = 15_000
const MINUTE_CHIPS = [5, 10, 15, 20, 30, 45, 60]
const BREAK_TYPES = ['استراحت', 'چای / قهوه', 'ناهار / غذا', 'انتظار / وقفه']

type Mode = 'log' | 'finish' | 'problem'

type WorkPick =
  | { kind: 'current'; title: string }
  | { kind: 'task'; id: number; title: string }
  | { kind: 'problem'; id: number; title: string }
  | { kind: 'break'; title: string }

function matches(title: string, query: string) {
  if (!query.trim()) return true
  return title.toLowerCase().includes(query.trim().toLowerCase())
}

function matchesTask(task: TaskItem, query: string) {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  const key = (task.jiraKey ?? '').toLowerCase()
  return task.title.toLowerCase().includes(q)
    || key.includes(q)
    || String(task.id).includes(q)
    || (task.jiraUrl ?? '').toLowerCase().includes(q)
}
function samePick(a: WorkPick | null, b: WorkPick) {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'current' || a.kind === 'break') return a.title === b.title
  return a.id === (b as { id: number }).id
}

export function WorkLogPrompt() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings, refetchInterval: 15_000 })
  const pingMinutes = settingsQuery.data?.pingMinutes ?? DEFAULT_PING_MINUTES
  const lastPingAt = settingsQuery.data?.lastPingAt ?? null
  const [open, setOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [minutes, setMinutes] = useState<number | null>(null)
  const [picked, setPicked] = useState<WorkPick | null>(null)
  const [source, setSource] = useState<WorkLogSource>('Timer')
  const [problemTitle, setProblemTitle] = useState('')
  const [mode, setMode] = useState<Mode>('log')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [error, setError] = useState('')
  const [eta, setEta] = useState(() => minutesUntilPing(pingMinutes, lastPingAt))
  const dueNotifiedAt = useRef<string | null>(null)

  const focusQuery = useQuery({ queryKey: ['focus'], queryFn: getFocus, refetchInterval: 30_000 })
  const focusTaskQuery = useQuery({
    queryKey: ['task', focusQuery.data?.taskId],
    queryFn: () => getTask(Number(focusQuery.data?.taskId)),
    enabled: Number.isFinite(focusQuery.data?.taskId) && Boolean(focusQuery.data?.active) && !focusQuery.data?.isResting,
  })
  const doingQuery = useQuery({
    queryKey: ['tasks', 'Doing'],
    queryFn: () => listTasks({ status: 'Doing' }),
    enabled: open && mode === 'finish',
  })
  const pickTasksQuery = useQuery({
    queryKey: ['tasks', 'prompt', queryText],
    queryFn: () => listTasks({ q: queryText.trim() || undefined }),
    enabled: open && (mode === 'log' || mode === 'problem'),
  })
  const pickProblemsQuery = useQuery({
    queryKey: ['problems'],
    queryFn: listProblems,
    enabled: open && (mode === 'log' || mode === 'problem'),
  })

  const focus = focusQuery.data
  const current = focus?.active ? (focusTaskQuery.data?.title || focus.description) : ''

  const openTasks = useMemo(() => {
    const rank: Record<string, number> = { Doing: 0, Stuck: 1, Open: 2 }
    return (pickTasksQuery.data ?? [])
      .filter((task) => (queryText.trim() || task.status !== 'Done') && matchesTask(task, queryText))
      .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
  }, [pickTasksQuery.data, queryText])

  const openProblems = useMemo(
    () => (pickProblemsQuery.data ?? []).filter((problem) => matches(problem.title, queryText)),
    [pickProblemsQuery.data, queryText],
  )

  const canBreak = Boolean(picked?.kind === 'break' && minutes && minutes > 0)
  const canSubmit = Boolean(picked && picked.kind !== 'break' && minutes && minutes > 0)

  useEffect(() => {
    if (settingsQuery.data) setPaused(settingsQuery.data.paused)
  }, [settingsQuery.data])

  const bumpPing = () => {
    void ackPing().then(() => queryClient.invalidateQueries({ queryKey: ['settings'] }))
  }

  const setPausedAndSave = (next: boolean) => {
    setPaused(next)
    void saveSettings({ pingMinutes, paused: next }).then((saved) => {
      void queryClient.setQueryData(['settings'], saved)
    })
  }

  const resetPicks = () => {
    setMinutes(null)
    setQueryText('')
    setProblemTitle('')
    setNewTaskTitle('')
    setError('')
    setPicked(current ? { kind: 'current', title: current } : null)
  }

  const openPrompt = (nextSource: WorkLogSource, nextMode?: Mode) => {
    setSource(nextSource)
    resetPicks()
    setMode(nextMode ?? 'log')
    setOpen(true)
  }

  useEffect(() => {
    const tick = () => setEta(minutesUntilPing(pingMinutes, lastPingAt))
    tick()
    const timer = window.setInterval(tick, CHECK_MS)
    return () => window.clearInterval(timer)
  }, [pingMinutes, lastPingAt])

  useEffect(() => {
    if (paused || !lastPingAt || eta > 0) return
    if (dueNotifiedAt.current === lastPingAt) return
    dueNotifiedAt.current = lastPingAt
    openPrompt('Timer')
    void testToast().catch(() => undefined)
  }, [eta, paused, lastPingAt])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['focus'] })
    void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    void queryClient.invalidateQueries({ queryKey: ['worklog-summary'] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['problems'] })
    void queryClient.invalidateQueries({ queryKey: ['entity-worklogs'] })
    void queryClient.invalidateQueries({ queryKey: ['settings'] })
  }

  const continueMutation = useMutation({
    mutationFn: () => tickFocus({ durationMinutes: minutes ?? 0, source }),
    onSuccess: () => {
      bumpPing()
      setOpen(false)
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const startMutation = useMutation({
    mutationFn: (input: { description: string; taskId?: number; problemId?: number }) =>
      setFocus({
        description: input.description.trim(),
        taskId: input.taskId,
        problemId: input.problemId,
        durationMinutes: minutes ?? 0,
        source,
        log: true,
      }),
    onSuccess: () => {
      resetPicks()
      bumpPing()
      setOpen(false)
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const finishMutation = useMutation({
    mutationFn: (input: { markTaskDone?: boolean; taskId?: number }) =>
      finishFocus({ durationMinutes: minutes ?? 0, source, ...input }),
    onSuccess: () => {
      bumpPing()
      setMode('log')
      resetPicks()
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const skipMutation = useMutation({
    mutationFn: clearFocus,
    onSuccess: () => {
      bumpPing()
      setOpen(false)
      refresh()
    },
  })

  const taskCreateMutation = useMutation({
    mutationFn: (title?: string) =>
      createTask({ title: (title?.trim() || newTaskTitle.trim() || queryText.trim() || problemTitle.trim() || 'کار جدید'), energyType: 'Light' }),
    onSuccess: (task) => {
      setNewTaskTitle('')
      setQueryText('')
      setPicked({ kind: 'task', id: task.id, title: task.title })
      setMode('log')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task-days'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const problemMutation = useMutation({
    mutationFn: () => createProblem(problemTitle.trim() || queryText.trim() || 'مسئله جدید'),
    onSuccess: (problem) => {
      setProblemTitle('')
      setPicked({ kind: 'problem', id: problem.id, title: problem.title })
      setMode('log')
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const breakMutation = useMutation({
    mutationFn: () =>
      captureWorkLog({
        description: picked?.kind === 'break' ? picked.title : 'استراحت',
        durationMinutes: minutes ?? 0,
        source: 'Manual',
      }),
    onSuccess: () => {
      bumpPing()
      setOpen(false)
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const submitLog = () => {
    if (!picked || !minutes || minutes <= 0) {
      setError('هم نوع بازه و هم زمان را انتخاب کن.')
      return
    }
    if (picked.kind === 'break') {
      breakMutation.mutate()
      return
    }
    if (picked.kind === 'current') {
      continueMutation.mutate()
      return
    }
    if (picked.kind === 'task') {
      startMutation.mutate({ description: picked.title, taskId: picked.id })
      return
    }
    startMutation.mutate({ description: picked.title, problemId: picked.id })
  }

  const busy = startMutation.isPending || continueMutation.isPending || finishMutation.isPending || breakMutation.isPending

  return (
    <>
      <div className="work-dock fixed bottom-4 inset-x-4 z-30 flex max-w-[min(100%-2rem,52rem)] flex-wrap items-center justify-center gap-2 sm:inset-x-auto sm:left-4 sm:justify-start">
        {current && (
          <span className="work-dock-chip max-w-[min(70vw,18rem)] truncate rounded-full border px-3 py-2 text-xs font-medium">
            الان: {current}
          </span>
        )}
        <button
          type="button"
          onClick={() => openPrompt('Manual')}
          className="work-dock-log inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-lg"
        >
          <ClipboardList className="h-4 w-4" />
          ثبت کار
        </button>
        <button
          type="button"
          onClick={() => openPrompt('Manual', 'problem')}
          className="work-dock-problem inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
        >
          <HelpCircle className="h-4 w-4" />
          مسئله دارم
        </button>
        <button
          type="button"
          onClick={() => setPausedAndSave(!paused)}
          className={`work-dock-ping inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
            paused ? 'is-off' : 'is-on'
          }`}
        >
          <Power className="h-4 w-4" />
          {paused ? 'یادآوری خاموش' : 'یادآوری روشن'}
        </button>
        <button
          type="button"
          onClick={() => {
            void testToast().then(() => {
              void queryClient.invalidateQueries({ queryKey: ['settings'] })
            })
          }}
          className="work-dock-test inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
        >
          <Bell className="h-4 w-4" />
          تست نوتیف
        </button>
        <span className={`work-dock-eta self-center rounded-full px-3 py-1.5 text-xs font-medium ${paused ? 'is-off' : ''}`}>
          {paused ? 'یادآوری‌ها قطع است' : `هر ${pingMinutes} دقیقه · بعدی ${eta} دقیقه`}
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-5">
            <p className="text-xs tracking-[0.2em] text-ember">{source}</p>

            {mode === 'log' && (
              <>
                <h2 className="mt-2 text-xl font-semibold">چیکار می‌کنی؟</h2>
                <p className="mt-1 text-sm text-paper/50">
                  هم کار و هم زمان اجباری است. بدون هر دو ثبت فعال نمی‌شود.
                </p>
                {current && (
                  <p className="mt-3 rounded-2xl bg-ink-800 px-4 py-3 text-sm">الان: {current}</p>
                )}
                <p className="mt-4 text-sm font-semibold text-ember">۱) کار یا مسئله را انتخاب کن — اجباری</p>
                <input
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder="جستجو در لیست"
                  autoFocus
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-3"
                />
                {current && matches(current, queryText) && (
                  <button
                    type="button"
                    onClick={() => setPicked({ kind: 'current', title: current })}
                    className={`mt-3 block w-full rounded-2xl px-3 py-2 text-right text-sm ${
                      picked?.kind === 'current' ? 'bg-ember text-ink-950 font-semibold' : 'bg-ink-800'
                    }`}
                  >
                    {current} — کار فعلی
                  </button>
                )}
                <PickLists
                  tasks={openTasks}
                  problems={openProblems}
                  picked={picked}
                  busy={busy}
                  onPick={setPicked}
                />
                <section className="mt-4">
                  <p className="text-xs tracking-[0.2em] text-paper/35">استراحت و غیرکار</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BREAK_TYPES.filter((title) => matches(title, queryText)).map((title) => (
                      <button
                        key={title}
                        type="button"
                        disabled={busy}
                        onClick={() => setPicked({ kind: 'break', title })}
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          picked?.kind === 'break' && picked.title === title
                            ? 'bg-ember font-semibold text-ink-950'
                            : 'bg-ink-800'
                        }`}
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                </section>
                <MinuteChips value={minutes} onChange={setMinutes} />
                <p className={`mt-3 text-sm ${canSubmit ? 'text-emerald-200' : 'text-rose-200'}`}>
                  {canSubmit
                    ? `آماده ثبت: ${picked?.title} — ${minutes} دقیقه`
                    : 'تا کار و دقیقه را نزنی، ثبت فعال نمی‌شود.'}
                </p>
                <button
                  type="button"
                  disabled={!canSubmit || busy}
                  onClick={submitLog}
                  className="mt-4 w-full rounded-2xl bg-ember px-4 py-3 text-sm font-semibold text-ink-950 disabled:opacity-40"
                >
                  ثبت کار و زمان
                </button>
                {current && (
                  <button
                    type="button"
                    onClick={() => setMode('finish')}
                    className="mt-2 w-full rounded-2xl bg-ink-800 px-4 py-2 text-sm"
                  >
                    کار قبلی تمام شد
                  </button>
                )}
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="عنوان کار یا مسئله جدید"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') taskCreateMutation.mutate()
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={taskCreateMutation.isPending}
                    onClick={() => taskCreateMutation.mutate()}
                    className="rounded-2xl bg-ember px-3 py-2 text-sm font-semibold text-ink-950"
                  >
                    کار جدید
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProblemTitle(newTaskTitle)
                      setMode('problem')
                    }}
                    className="rounded-2xl bg-ink-800 px-3 py-2 text-sm"
                  >
                    مسئله جدید
                  </button>
                </div>
              </>
            )}

            {mode === 'finish' && (
              <>
                <h2 className="mt-2 text-xl font-semibold">«{current}» تمام شد</h2>
                <p className="mt-1 text-sm text-paper/50">اول بگو چند دقیقه صرف شد، بعد ثبت کن.</p>
                <MinuteChips value={minutes} onChange={setMinutes} />
                <button
                  type="button"
                  disabled={!minutes || minutes <= 0 || busy}
                  onClick={() => finishMutation.mutate({})}
                  className="mt-4 w-full rounded-2xl bg-ember px-4 py-3 text-sm font-semibold text-ink-950 disabled:opacity-40"
                >
                  ثبت کن و ببند
                </button>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-paper/40">اگر کار مرتبط روی بورد است، Done کن:</p>
                  {(doingQuery.data ?? []).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      disabled={!minutes || minutes <= 0 || busy}
                      onClick={() => {
                        void finishMutation.mutateAsync({}).then(() => updateTaskStatus(task.id, { status: 'Done' }).then(refresh))
                      }}
                      className="block w-full rounded-2xl bg-ink-800 px-4 py-2 text-right text-sm disabled:opacity-40"
                    >
                      {task.title} — انجام شد
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setMode('log')} className="mt-3 rounded-2xl px-4 py-2 text-sm text-paper/50">
                  برگشت
                </button>
              </>
            )}

            {mode === 'problem' && (
              <>
                <h2 className="mt-2 text-xl font-semibold">مسئله</h2>
                <p className="mt-1 text-sm text-paper/45">مسئله موجود را بردار یا یکی جدید باز کن.</p>
                <input
                  value={problemTitle}
                  onChange={(event) => setProblemTitle(event.target.value)}
                  placeholder="جستجو یا مسئله جدید"
                  autoFocus
                  onKeyDown={(event) => { if (event.key === 'Enter') problemMutation.mutate() }}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-3"
                />
                <PickLists
                  tasks={openTasks}
                  problems={openProblems}
                  picked={picked}
                  busy={busy}
                  onPick={(next) => {
                    setPicked(next)
                    setMode('log')
                  }}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => problemMutation.mutate()}
                    className="rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950"
                  >
                    مسئله جدید
                  </button>
                  <button
                    type="button"
                    disabled={taskCreateMutation.isPending}
                    onClick={() => taskCreateMutation.mutate(problemTitle)}
                    className="rounded-2xl bg-ink-800 px-4 py-2 text-sm"
                  >
                    کار جدید
                  </button>
                </div>
                <button type="button" onClick={() => setMode('log')} className="mt-2 rounded-2xl px-4 py-2 text-sm text-paper/50">
                  برگشت به ثبت کار
                </button>
              </>
            )}

            {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canBreak || busy}
                onClick={() => breakMutation.mutate()}
                className="rounded-2xl bg-ink-800 px-4 py-2 text-sm disabled:opacity-40"
              >
                استراحت بود
              </button>
              {current && (
                <button type="button" onClick={() => skipMutation.mutate()} className="rounded-2xl px-4 py-2 text-sm text-paper/50">
                  کار فعلی را ول کن
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  bumpPing()
                  setPausedAndSave(true)
                  setOpen(false)
                }}
                className="rounded-2xl px-4 py-2 text-sm text-paper/50"
              >
                سیستم را خاموش کن
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MinuteChips({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-ember">۲) چند دقیقه صرف شد؟ — اجباری</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MINUTE_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onChange(chip)}
            className={`rounded-2xl px-3 py-2 text-sm ${
              value === chip ? 'bg-ember font-semibold text-ink-950' : 'bg-ink-800'
            }`}
          >
            {chip}m
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={480}
          value={value ?? ''}
          placeholder="دقیقه"
          onChange={(event) => {
            const next = Number(event.target.value)
            onChange(Number.isFinite(next) && next > 0 ? next : 0)
          }}
          className="w-24 rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
        />
      </div>
    </div>
  )
}

function PickLists({
  tasks,
  problems,
  picked,
  busy,
  onPick,
}: {
  tasks: TaskItem[]
  problems: Problem[]
  picked: WorkPick | null
  busy: boolean
  onPick: (pick: WorkPick) => void
}) {
  return (
    <div className="mt-4 space-y-4">
      <section>
        <p className="text-xs tracking-[0.2em] text-paper/35">کارها</p>
        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
          {tasks.map((task) => {
            const item: WorkPick = { kind: 'task', id: task.id, title: task.title }
            const selected = samePick(picked, item)
            return (
              <button
                key={task.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(item)}
                className={`block w-full rounded-2xl px-3 py-2 text-right text-sm disabled:opacity-50 ${
                  selected ? 'bg-ember font-semibold text-ink-950' : 'bg-ink-800'
                }`}
              >
                <span>{task.title}</span>{task.jiraKey ? <span className="mr-2 text-[11px] opacity-70">{task.jiraKey}</span> : null}
                <span className="mr-2 text-xs opacity-60">{STATUS_LABEL[task.status]}</span>
              </button>
            )
          })}
          {tasks.length === 0 && <p className="text-xs text-paper/35">کار بازی پیدا نشد.</p>}
        </div>
      </section>
      <section>
        <p className="text-xs tracking-[0.2em] text-paper/35">مسئله‌ها</p>
        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
          {problems.map((problem) => {
            const item: WorkPick = { kind: 'problem', id: problem.id, title: problem.title }
            const selected = samePick(picked, item)
            return (
              <button
                key={problem.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(item)}
                className={`block w-full rounded-2xl px-3 py-2 text-right text-sm disabled:opacity-50 ${
                  selected ? 'bg-ember font-semibold text-ink-950' : 'bg-ink-800'
                }`}
              >
                <span>{problem.title}</span>
                <span className="mr-2 text-xs opacity-60">{PROBLEM_STATUS_LABEL[problem.status]}</span>
              </button>
            )
          })}
          {problems.length === 0 && <p className="text-xs text-paper/35">مسئله‌ای پیدا نشد.</p>}
        </div>
      </section>
    </div>
  )
}
