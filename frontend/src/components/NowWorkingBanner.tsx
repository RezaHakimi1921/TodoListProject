import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Coffee, ExternalLink, MessageCircle, Pause, Play, Utensils, X } from 'lucide-react'
import {
  endRest,
  getFocus,
  holdPendingFocus,
  JIRA_DWELL_MS,
  saveRestNote,
  startRest,
  transferPendingFocus,
  type JiraSwitchPending,
} from '../api/focus'
import { getProblem } from '../api/problems'
import { getTask } from '../api/tasks'
import { formatElapsedClock } from '../lib/dates'
import { taskJiraKey, taskJiraUrl } from '../lib/jira'

const REST_KINDS = [
  { title: 'نهار', icon: Utensils, jiraKey: 'SIP-2290' },
  { title: 'استراحت', icon: Coffee, jiraKey: 'SIP-2287' },
  { title: 'دیلی', icon: MessageCircle, jiraKey: 'SIP-2288' },
  { title: 'جلسه', icon: Calendar, jiraKey: 'SIP-2289' },
] as const

const NOTE_TITLES = new Set<string>(['جلسه', 'دیلی'])

type PendingView =
  | { kind: 'switch'; title: string; remainingSeconds: number; jiraKey: string }
  | { kind: 'closed'; jiraKey: string }

type NoteModal = { mode: 'start' | 'save' | 'end'; title: string; note: string }

function needsNote(title?: string | null) {
  return NOTE_TITLES.has((title ?? '').trim())
}

function elapsedSeconds(startedAt?: string | null) {
  if (!startedAt) return 0
  const started = Date.parse(startedAt)
  if (!Number.isFinite(started)) return 0
  return Math.max(0, Math.floor((Date.now() - started) / 1000))
}

function useStickyPending(
  incoming: JiraSwitchPending | null,
  currentTaskId: number | null,
  heldBack: boolean,
): PendingView | null {
  const held = useRef<JiraSwitchPending | null>(null)
  const [closed, setClosed] = useState<string | null>(null)
  const [, tick] = useState(0)
  const incomingKey = incoming?.jiraKey ?? null

  if (incoming) {
    const prev = held.current
    if (!prev || prev.jiraKey !== incoming.jiraKey) {
      held.current = incoming
    } else {
      const since = Math.min(prev.sinceUnixMs || Infinity, incoming.sinceUnixMs || Infinity)
      held.current = {
        ...incoming,
        sinceUnixMs: Number.isFinite(since) ? since : incoming.sinceUnixMs,
        title: incoming.title || prev.title,
      }
    }
  }

  useEffect(() => {
    if (incomingKey) {
      setClosed(null)
      return
    }
    const prev = held.current
    if (!prev) return
    held.current = null
    if (heldBack) return
    if (prev.taskId && prev.taskId === currentTaskId) return
    setClosed(prev.jiraKey)
    const id = window.setTimeout(() => setClosed(null), 2800)
    return () => window.clearTimeout(id)
  }, [incomingKey, currentTaskId, heldBack])

  useEffect(() => {
    const id = window.setInterval(() => tick((value) => value + 1), 250)
    return () => window.clearInterval(id)
  }, [])

  if (heldBack) return null
  if (closed) return { kind: 'closed', jiraKey: closed }
  const current = held.current
  if (!current || !incomingKey) return null
  const remaining = Math.max(0, Math.ceil((JIRA_DWELL_MS - (Date.now() - current.sinceUnixMs)) / 1000))
  return { kind: 'switch', title: current.title, remainingSeconds: remaining, jiraKey: current.jiraKey }
}

export function NowWorkingBanner() {
  const queryClient = useQueryClient()
  const [nowTick, setNowTick] = useState(0)
  const [heldBack, setHeldBack] = useState(false)
  const [noteModal, setNoteModal] = useState<NoteModal | null>(null)
  const focusQuery = useQuery({
    queryKey: ['focus'],
    queryFn: getFocus,
    refetchInterval: 1000,
  })
  const focus = focusQuery.data
  const incomingKey = focus?.pendingSwitch?.jiraKey ?? null
  useEffect(() => {
    if (incomingKey) setHeldBack(false)
  }, [incomingKey])
  useEffect(() => {
    if (focus?.isResting && focus.taskId) {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  }, [focus?.isResting, focus?.taskId, queryClient])
  const pending = useStickyPending(focus?.pendingSwitch ?? null, focus?.taskId ?? null, heldBack)
  const taskQuery = useQuery({
    queryKey: ['task', focus?.taskId],
    queryFn: () => getTask(Number(focus?.taskId)),
    enabled: Number.isFinite(focus?.taskId) && !focus?.isResting,
  })
  const problemQuery = useQuery({
    queryKey: ['problem', focus?.problemId],
    queryFn: () => getProblem(Number(focus?.problemId)),
    enabled: Number.isFinite(focus?.problemId) && !focus?.isResting,
  })

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['focus'] })
    void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    void queryClient.invalidateQueries({ queryKey: ['settings'] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const restMutation = useMutation({
    mutationFn: ({ title, note }: { title: string; note?: string }) => startRest(title, note),
    onSuccess: () => {
      setNoteModal(null)
      refresh()
    },
  })
  const saveNoteMutation = useMutation({
    mutationFn: (note: string) => saveRestNote(note),
    onSuccess: () => {
      setNoteModal(null)
      refresh()
    },
  })
  const endRestMutation = useMutation({
    mutationFn: (note?: string) => endRest(note),
    onSuccess: () => {
      setNoteModal(null)
      refresh()
    },
  })
  const transferMutation = useMutation({
    mutationFn: () => transferPendingFocus(),
    onMutate: () => setHeldBack(true),
    onSuccess: refresh,
  })
  const holdMutation = useMutation({
    mutationFn: () => holdPendingFocus(),
    onMutate: () => setHeldBack(true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
    },
    onError: () => setHeldBack(false),
  })

  const askRest = (title: string) => {
    if (needsNote(title)) {
      setNoteModal({ mode: 'start', title, note: '' })
      return
    }
    restMutation.mutate({ title })
  }

  const askEndRest = () => {
    const title = focus?.description || 'استراحت'
    if (needsNote(title)) {
      setNoteModal({ mode: 'end', title, note: focus?.note || '' })
      return
    }
    endRestMutation.mutate(undefined)
  }

  const confirmNote = () => {
    if (!noteModal) return
    const note = noteModal.note.trim()
    if (noteModal.mode === 'start') {
      restMutation.mutate({ title: noteModal.title, note })
      return
    }
    if (noteModal.mode === 'save') {
      saveNoteMutation.mutate(note)
      return
    }
    endRestMutation.mutate(note)
  }

  const active = Boolean(focus?.active && focus.description)
  const resting = Boolean(focus?.isResting)
  const task = taskQuery.data
  const problem = problemQuery.data
  const jiraUrl = task ? taskJiraUrl(task) : null
  const jiraKey = task ? taskJiraKey(task) : null
  void nowTick
  const clock = formatElapsedClock(elapsedSeconds(focus?.startedAt))
  const pendingLine = pending ? (
    <PendingSwitchLine
      pending={pending}
      transferring={transferMutation.isPending}
      holding={holdMutation.isPending}
      onTransfer={() => transferMutation.mutate()}
      onHold={() => holdMutation.mutate()}
    />
  ) : null
  const noteBusy = restMutation.isPending || saveNoteMutation.isPending || endRestMutation.isPending
  const restNoteTitle = focus?.description || ''

  return (
    <>
      {resting ? (
        <section className="rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wide text-sky-300/90 mb-1">داری استراحت می‌کنی</p>
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-sky-300 shrink-0" />
                <p className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                  {focus?.description || 'استراحت'}
                </p>
              </div>
              {focus?.note ? (
                <p className="mt-2 text-[12px] leading-relaxed text-sky-100/80">{focus.note}</p>
              ) : null}
              {pendingLine}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {needsNote(restNoteTitle) ? (
                  <button
                    type="button"
                    onClick={() => setNoteModal({ mode: 'save', title: restNoteTitle, note: focus?.note || '' })}
                    className="rounded-xl border border-sky-300/30 bg-black/20 px-3 py-1.5 text-xs font-bold text-sky-50 hover:bg-black/40"
                  >
                    {focus?.note ? 'ویرایش خلاصه' : 'خلاصه'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={endRestMutation.isPending}
                  onClick={askEndRest}
                  className="rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold px-3 py-1.5"
                >
                  برگشتم به کار
                </button>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-sky-200">{clock}</span>
            </div>
          </div>
        </section>
      ) : !active ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#10131b] px-4 py-3.5">
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 mb-1">الان روی این کار هستی</p>
          <p className="text-sm text-slate-400">هنوز تمرکزی شروع نشده.</p>
          {pendingLine}
          <div className="mt-3 flex flex-wrap gap-2">
            {REST_KINDS.map((item) => (
              <button
                key={item.title}
                type="button"
                disabled={restMutation.isPending}
                onClick={() => askRest(item.title)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-sky-400/40 hover:text-white"
              >
                {item.title}
                <span className="ms-1 text-[10px] text-slate-500">{item.jiraKey}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3.5 shadow-lg shadow-amber-900/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wide text-amber-300/90 mb-1">
                {focus?.problemId && !focus?.taskId ? 'الان روی این مسئله هستی' : 'الان روی این کار هستی'}
              </p>
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-300 shrink-0 fill-amber-300" />
                <p className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                  {task?.title || problem?.title || focus!.description}
                </p>
              </div>
              {pendingLine}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {focus?.taskId ? (
                  <Link to={`/tasks/${focus.taskId}`} className="text-[11px] text-amber-200/80 hover:text-amber-100">باز کردن همین کار</Link>
                ) : null}
                {focus?.problemId ? (
                  <Link to={`/problems/${focus.problemId}`} className="text-[11px] text-amber-200/80 hover:text-amber-100">باز کردن تحقیق</Link>
                ) : null}
                {jiraUrl ? (
                  <a href={jiraUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-200 hover:text-white">
                    <ExternalLink className="w-3 h-3" />
                    {jiraKey}
                  </a>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-amber-300">{clock}</span>
              <button
                type="button"
                disabled={restMutation.isPending}
                onClick={() => askRest('استراحت')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/30 bg-black/20 text-amber-100 hover:bg-black/40 disabled:opacity-50"
                title="توقف موقت"
                aria-label="توقف موقت"
              >
                <Pause className="h-4 w-4 fill-current" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {REST_KINDS.map((item) => (
              <button
                key={item.title}
                type="button"
                disabled={restMutation.isPending}
                onClick={() => askRest(item.title)}
                className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-sky-400/40 hover:text-white"
              >
                {item.title}
                <span className="ms-1 text-[10px] text-slate-500">{item.jiraKey}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {noteModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121520] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-white">
                {noteModal.title === 'دیلی' ? 'خلاصه دیلی' : 'خلاصه جلسه'}
              </h3>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[11px] font-medium text-slate-400">
              {noteModal.title === 'دیلی' ? 'دیلی درباره چه بود؟' : 'جلسه درباره چه بود؟'}
            </label>
            <textarea
              value={noteModal.note}
              onChange={(event) => setNoteModal({ ...noteModal, note: event.target.value })}
              rows={4}
              autoFocus
              placeholder="فقط یک خلاصه کوتاه"
              className="w-full rounded-xl bg-black/30 border border-white/[0.08] p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400/40"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={noteBusy}
                onClick={confirmNote}
                className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400 disabled:opacity-60"
              >
                {noteBusy ? 'در حال ثبت...' : 'ثبت'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function PendingSwitchLine({
  pending,
  transferring,
  holding,
  onTransfer,
  onHold,
}: {
  pending: PendingView
  transferring: boolean
  holding: boolean
  onTransfer: () => void
  onHold: () => void
}) {
  if (pending.kind === 'closed') {
    return (
      <p className="mt-2 text-[12px] leading-relaxed text-slate-400 transition-opacity duration-700">
        تسک جیرا بسته شد
        <span className="ms-1 text-[10px] text-slate-500">{pending.jiraKey}</span>
      </p>
    )
  }

  const seconds = pending.remainingSeconds
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="pending-switch-msg text-[12px] leading-relaxed">
        {seconds > 0 ? `${seconds} ثانیه دیگه به «${pending.title}» منتقل می‌شی` : `الان به «${pending.title}» منتقل می‌شی`}
        <span className="pending-switch-key ms-1 text-[10px]">{pending.jiraKey}</span>
      </p>
      <button
        type="button"
        disabled={transferring || holding}
        onClick={onTransfer}
        className="rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-[11px] font-bold px-2.5 py-1"
      >
        منتقل بکن
      </button>
      <button
        type="button"
        disabled={transferring || holding}
        onClick={onHold}
        className="pending-switch-hold rounded-lg border border-white/20 bg-black/30 hover:bg-black/50 disabled:opacity-60 text-white text-[11px] font-bold px-2.5 py-1"
      >
        عدم انتقال
      </button>
    </div>
  )
}
