import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProblem, listProblems } from '../api/problems'
import { createTask, listTasks, updateTaskStatus } from '../api/tasks'
import { clearFocus, finishFocus, getFocus, setFocus, tickFocus } from '../api/focus'
import { captureWorkLog } from '../api/workLogs'
import { ackPing, DEFAULT_PING_MINUTES, getSettings, saveSettings, testToast } from '../api/settings'
import { PROBLEM_STATUS_LABEL, STATUS_LABEL, type Problem, type TaskItem, type WorkLogSource } from '../types'
import { isPingDue, minutesUntilPing } from '../lib/notify'

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

function samePick(a: WorkPick | null, b: WorkPick) {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'current' || a.kind === 'break') return a.title === b.title
  return a.id === (b as { id: number }).id
}

export function WorkLogPrompt() {
  const navigate = useNavigate()
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
  const [error, setError] = useState('')
  const [eta, setEta] = useState(() => minutesUntilPing(pingMinutes, lastPingAt))

  const focusQuery = useQuery({ queryKey: ['focus'], queryFn: getFocus, refetchInterval: 30_000 })
  const doingQuery = useQuery({
    queryKey: ['tasks', 'Doing'],
    queryFn: () => listTasks({ status: 'Doing' }),
    enabled: open && mode === 'finish',
  })
  const pickTasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
    enabled: open && (mode === 'log' || mode === 'problem'),
  })
  const pickProblemsQuery = useQuery({
    queryKey: ['problems'],
    queryFn: listProblems,
    enabled: open && (mode === 'log' || mode === 'problem'),
  })

  const focus = focusQuery.data
  const current = focus?.active ? focus.description : ''

  const openTasks = useMemo(() => {
    const rank: Record<string, number> = { Doing: 0, Stuck: 1, Open: 2 }
    return (pickTasksQuery.data ?? [])
      .filter((task) => task.status !== 'Done' && matches(task.title, queryText))
      .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
  }, [pickTasksQuery.data, queryText])

  const openProblems = useMemo(
    () => (pickProblemsQuery.data ?? []).filter((problem) => matches(problem.title, queryText)),
    [pickProblemsQuery.data, queryText],
  )

  const canBreak = Boolean(minutes && minutes > 0)
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
    setError('')
    setPicked(current ? { kind: 'current', title: current } : null)
  }

  const openPrompt = (nextSource: WorkLogSource, nextMode?: Mode) => {
    setSource(nextSource)
    resetPicks()
    setMode(nextMode ?? 'log')
    setOpen(true)
  }

  const firePing = (fromTimer: boolean) => {
    if (paused) return
    if (fromTimer && document.hidden) return
    bumpPing()
    setEta(minutesUntilPing(pingMinutes, lastPingAt))
    openPrompt('Timer')
  }

  useEffect(() => {
    const tick = () => {
      setEta(minutesUntilPing(pingMinutes, lastPingAt))
      if (paused || document.hidden || !isPingDue(pingMinutes, lastPingAt)) return
      firePing(true)
    }
    tick()
    const timer = window.setInterval(tick, CHECK_MS)
    const onVisible = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [paused, current, pingMinutes, lastPingAt])

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

  const problemMutation = useMutation({
    mutationFn: (title?: string) => createProblem((title ?? problemTitle).trim() || 'مسئله جدید'),
    onSuccess: (problem) => {
      setProblemTitle('')
      setPicked({ kind: 'problem', id: problem.id, title: problem.title })
      setOpen(false)
      navigate(`/problems/${problem.id}`)
    },
    onError: (err: Error) => setError(err.message || 'مسئله ثبت نشد.'),
  })

  const createTaskMutation = useMutation({
    mutationFn: () => createTask({ title: queryText.trim() || 'کار جدید', energyType: 'Light' }),
    onSuccess: (task) => {
      setQueryText('')
      setPicked({ kind: 'task', id: task.id, title: task.title })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => setError(err.message || 'کار ثبت نشد.'),
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

  const busy = startMutation.isPending || continueMutation.isPending || finishMutation.isPending || breakMutation.isPending || createTaskMutation.isPending || problemMutation.isPending

  return (
    <>
      <div className="fixed bottom-4 left-4 z-30 flex max-w-[min(100%-2rem,42rem)] flex-wrap gap-2">
        {current && (
          <span className="rounded-full bg-ember/20 px-3 py-2 text-xs text-amber-100">
            الان: {current}
          </span>
        )}
        <button
          type="button"
          onClick={() => openPrompt('Manual')}
          className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-ink-950 shadow-lg"
        >
          ثبت کار
        </button>
        <button
          type="button"
          onClick={() => openPrompt('Manual', 'problem')}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm shadow-lg"
        >
          مسئله دارم
        </button>
        <button
          type="button"
          onClick={() => setPausedAndSave(!paused)}
          className={`rounded-full px-4 py-2 text-sm shadow-lg ${
            paused ? 'bg-rose-500 text-white' : 'bg-moss text-white'
          }`}
        >
          {paused ? 'سیستم خاموش' : 'سیستم روشن'}
        </button>
        <button
          type="button"
          onClick={() => {
            void testToast().then(() => {
              void queryClient.invalidateQueries({ queryKey: ['settings'] })
              openPrompt('Timer')
            })
          }}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm shadow-lg"
        >
          تست نوتیف
        </button>
        <span className="self-center text-xs text-paper/40">
          {paused ? 'سیستم خاموش است' : `هر ${pingMinutes} دقیقه · بعدی ${eta} دقیقه`}
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
                  placeholder="جستجو، یا عنوان کار/مسئله جدید"
                  autoFocus
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-3"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || createTaskMutation.isPending}
                    onClick={() => createTaskMutation.mutate()}
                    className="rounded-2xl bg-ember px-3 py-2 text-sm font-semibold text-ink-950 disabled:opacity-40"
                  >
                    کار جدید
                  </button>
                  <button
                    type="button"
                    disabled={busy || problemMutation.isPending}
                    onClick={() => problemMutation.mutate(queryText)}
                    className="rounded-2xl bg-ink-800 px-3 py-2 text-sm"
                  >
                    مسئله جدید
                  </button>
                </div>
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
                <button type="button" onClick={() => setMode('problem')} className="mt-2 w-full rounded-2xl px-4 py-2 text-sm text-paper/60">
                  مسئله جدید باز کن
                </button>
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
                <button
                  type="button"
                  onClick={() => problemMutation.mutate()}
                  className="mt-4 rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950"
                >
                  باز کردن مسئله جدید
                </button>
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
                <span>{task.title}</span>
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
