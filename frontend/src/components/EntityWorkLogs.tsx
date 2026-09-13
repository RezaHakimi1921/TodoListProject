import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { getJiraIssueStatus, isJiraWorklogEdited, jiraWorklogMinutes, listJiraIssueWorklogs } from '../api/jira'
import { getTask } from '../api/tasks'
import { captureWorkLog, deleteWorkLog, listEntityWorkLogs, updateWorkLog } from '../api/workLogs'
import { formatWorkLogSpan, todayIso, workLogStartedAt } from '../lib/dates'
import { isAutomaticWorkLog, type WorkLogEntry } from '../types'
import { WorkLogDuration } from './WorkLogDuration'
import { WorkLogTags } from './WorkLogTags'

function shouldShowDescription(description: string, taskTitle?: string) {
  const text = description.trim()
  if (!text || text === 'کار') return false
  if (taskTitle && text === taskTitle.trim()) return false
  return true
}

function localDayKey(value?: string | null) {
  if (!value) return ''
  const local = new Date(value)
  if (Number.isNaN(local.getTime())) return ''
  return new Date(local.getTime() - local.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function earlierIso(left: string, right: string) {
  return Date.parse(left) <= Date.parse(right) ? left : right
}

function laterIso(left: string, right: string) {
  return Date.parse(left) >= Date.parse(right) ? left : right
}

type DisplayRow =
  | { kind: 'entry'; entry: WorkLogEntry }
  | {
      kind: 'auto-day'
      day: string
      ids: number[]
      minutes: number
      jiraMinutes: number
      hasJira: boolean
      edited: boolean
      startedAt: string
      endedAt: string
      note: string
    }

function buildDisplayRows(
  entries: WorkLogEntry[],
  jiraById: Map<string, { timeSpentSeconds: number }>,
  editedIds: Set<string>,
  taskTitle?: string,
): DisplayRow[] {
  const rows: DisplayRow[] = []
  let bucket: Extract<DisplayRow, { kind: 'auto-day' }> | null = null

  const flush = () => {
    if (bucket) rows.push(bucket)
    bucket = null
  }

  for (const entry of entries) {
    if (!isAutomaticWorkLog(entry.source)) {
      flush()
      rows.push({ kind: 'entry', entry })
      continue
    }

    const day = localDayKey(entry.createdAt)
    const jiraLog = entry.jiraWorklogId ? jiraById.get(String(entry.jiraWorklogId)) : undefined
    const jiraMin = jiraLog ? jiraWorklogMinutes(jiraLog) : 0
    const started = workLogStartedAt(entry.createdAt, jiraLog ? jiraMin : entry.durationMinutes)
    const edited = Boolean(entry.jiraWorklogId && editedIds.has(String(entry.jiraWorklogId)))
    const note = shouldShowDescription(entry.description, taskTitle) ? entry.description.trim() : ''

    if (bucket && bucket.day === day) {
      bucket.ids.push(entry.id)
      bucket.minutes += entry.durationMinutes
      bucket.jiraMinutes += jiraMin
      bucket.hasJira = bucket.hasJira || Boolean(jiraLog)
      bucket.edited = bucket.edited || edited
      bucket.startedAt = earlierIso(bucket.startedAt, started)
      bucket.endedAt = laterIso(bucket.endedAt, entry.createdAt)
      if (!bucket.note && note) bucket.note = note
      continue
    }

    flush()
    bucket = {
      kind: 'auto-day',
      day,
      ids: [entry.id],
      minutes: entry.durationMinutes,
      jiraMinutes: jiraMin,
      hasJira: Boolean(jiraLog),
      edited,
      startedAt: started,
      endedAt: entry.createdAt,
      note,
    }
  }

  flush()
  return rows
}

interface Props {
  kind: 'task' | 'problem'
  id: number
}

export function EntityWorkLogs({ kind, id }: Props) {
  const queryClient = useQueryClient()
  const [minutes, setMinutes] = useState('15')
  const [desc, setDesc] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [commentFor, setCommentFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')

  const logsQuery = useQuery({
    queryKey: ['worklogs', kind, id],
    queryFn: () => listEntityWorkLogs(kind, id),
    enabled: Number.isFinite(id),
  })

  const taskQuery = useQuery({
    queryKey: ['task', id],
    queryFn: () => getTask(id),
    enabled: kind === 'task' && Number.isFinite(id),
  })

  const jiraKey = kind === 'task' ? taskQuery.data?.jiraKey : null

  const jiraStatusQuery = useQuery({
    queryKey: ['jira-status', jiraKey],
    queryFn: () => getJiraIssueStatus(jiraKey!),
    enabled: Boolean(jiraKey),
  })

  const jiraLogsQuery = useQuery({
    queryKey: ['jira-worklogs', jiraKey],
    queryFn: () => listJiraIssueWorklogs(jiraKey!),
    enabled: Boolean(jiraKey),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      captureWorkLog({
        description: desc.trim() || (kind === 'task' ? 'تمرکز روی کار' : 'بررسی مسئله'),
        durationMinutes: Math.max(1, Number(minutes) || 15),
        source: 'Manual',
        taskId: kind === 'task' ? id : undefined,
        problemId: kind === 'problem' ? id : undefined,
      }),
    onSuccess: () => {
      setDesc('')
      setShowAdd(false)
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs', kind, id] })
      void queryClient.invalidateQueries({ queryKey: ['jira-worklogs'] })
    },
  })

  const commentMutation = useMutation({
    mutationFn: async ({ ids, text }: { ids: number[]; text: string }) => {
      for (const logId of ids) {
        await updateWorkLog(logId, text)
      }
    },
    onSuccess: () => {
      setCommentFor(null)
      setCommentText('')
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs', kind, id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (logIds: number[]) => {
      for (const logId of logIds) {
        await deleteWorkLog(logId)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs', kind, id] })
      void queryClient.invalidateQueries({ queryKey: ['jira-worklogs'] })
    },
  })

  const entries = logsQuery.data?.entries ?? []
  const today = todayIso()
  const jiraById = new Map((jiraLogsQuery.data ?? []).map((log) => [String(log.id), log]))
  const effectiveMinutes = (entry: WorkLogEntry) => {
    const jira = entry.jiraWorklogId ? jiraById.get(String(entry.jiraWorklogId)) : undefined
    return jira ? jiraWorklogMinutes(jira) : entry.durationMinutes
  }
  const totalMinutes = entries.reduce((sum, entry) => sum + effectiveMinutes(entry), 0)
  const todayMinutes = entries
    .filter((entry) => localDayKey(entry.createdAt) === today)
    .reduce((sum, entry) => sum + effectiveMinutes(entry), 0)
  const editedIds = new Set(
    (jiraLogsQuery.data ?? [])
      .filter((log) => isJiraWorklogEdited(log))
      .map((log) => String(log.id)),
  )
  const jiraTotalMinutes = (jiraLogsQuery.data ?? []).reduce((sum, log) => sum + jiraWorklogMinutes(log), 0)
  const jiraTodayMinutes = (jiraLogsQuery.data ?? [])
    .filter((log) => localDayKey(log.created) === today)
    .reduce((sum, log) => sum + jiraWorklogMinutes(log), 0)
  const rows = useMemo(
    () => buildDisplayRows(entries, jiraById, editedIds, taskQuery.data?.title),
    [entries, jiraLogsQuery.data, taskQuery.data?.title],
  )

  const openComment = (key: string, current: string) => {
    setCommentFor(key)
    setCommentText(current)
  }

  return (
    <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-slate-200">زمان‌های ثبت‌شده</h4>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            {todayMinutes === totalMinutes ? `${totalMinutes} دقیقه` : `${todayMinutes} امروز / ${totalMinutes} کل`}
          </span>
          {jiraKey && (jiraLogsQuery.data || jiraStatusQuery.data) ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-300 border border-white/10">
              {jiraLogsQuery.data
                ? jiraTodayMinutes === jiraTotalMinutes
                  ? `جیرا: ${jiraTotalMinutes} دقیقه`
                  : `جیرا: ${jiraTodayMinutes} امروز / ${jiraTotalMinutes} کل`
                : null}
              {jiraStatusQuery.data ? (
                <span className={jiraLogsQuery.data ? 'ms-1 text-slate-500' : ''}>
                  {jiraLogsQuery.data ? `· ${jiraStatusQuery.data}` : `جیرا: ${jiraStatusQuery.data}`}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs flex items-center gap-1 text-slate-400 hover:text-amber-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {showAdd ? 'بستن فرم' : 'ثبت دستی زمان'}
        </button>
      </div>

      {showAdd && (
        <div className="mt-3 p-3 rounded-xl bg-[#1a2030] border border-slate-700/60 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="توضیح کوتاه فعالیت (اختیاری)..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="flex-1 rounded-lg bg-[#10131d] border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="480"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-16 rounded-lg bg-[#10131d] border border-slate-700 px-2 py-1.5 text-xs text-slate-200 text-center focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs text-slate-400">دقیقه</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              {addMutation.isPending ? 'در حال ثبت...' : 'افزودن'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 divide-y divide-slate-800/60">
        {entries.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">هنوز زمانی برای این مورد ثبت نشده است.</p>
        ) : (
          rows.map((row) => {
            const key = row.kind === 'auto-day' ? `auto-${row.day}-${row.ids[0]}` : `entry-${row.entry.id}`
            const ids = row.kind === 'auto-day' ? row.ids : [row.entry.id]
            const note =
              row.kind === 'auto-day'
                ? row.note
                : shouldShowDescription(row.entry.description, taskQuery.data?.title)
                  ? row.entry.description
                  : ''
            const span =
              row.kind === 'auto-day'
                ? formatWorkLogSpan(row.startedAt, row.endedAt)
                : formatWorkLogSpan(
                    workLogStartedAt(row.entry.createdAt, row.entry.durationMinutes),
                    row.entry.createdAt,
                  )
            return (
              <div key={key} className="py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.kind === 'auto-day' ? (
                        <span className="text-slate-200 font-medium">زمان خودکار</span>
                      ) : note ? (
                        <span className="text-slate-200 font-medium">{note}</span>
                      ) : (
                        <span className="text-slate-200 font-medium">لاگ‌ورک</span>
                      )}
                      <WorkLogTags
                        source={row.kind === 'auto-day' ? 'Timer' : row.entry.source}
                        jiraEdited={
                          row.kind === 'auto-day'
                            ? row.edited
                            : Boolean(row.entry.jiraWorklogId && editedIds.has(String(row.entry.jiraWorklogId)))
                        }
                      />
                      {row.kind === 'auto-day' && row.ids.length > 1 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/10">
                          {row.ids.length} قطعه
                        </span>
                      ) : null}
                    </div>
                    {span ? <p className="text-slate-400 text-[11px]">{span}</p> : null}
                    {row.kind === 'auto-day' && note ? (
                      <p className="text-slate-300 text-[11px] leading-relaxed">{note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <WorkLogDuration
                      localMinutes={row.kind === 'auto-day' ? row.minutes : row.entry.durationMinutes}
                      jiraMinutes={
                        row.kind === 'auto-day'
                          ? row.hasJira
                            ? row.jiraMinutes
                            : null
                          : row.entry.jiraWorklogId
                            ? jiraById.has(String(row.entry.jiraWorklogId))
                              ? jiraWorklogMinutes(jiraById.get(String(row.entry.jiraWorklogId))!)
                              : null
                            : null
                      }
                      edited={
                        row.kind === 'auto-day'
                          ? row.edited
                          : Boolean(row.entry.jiraWorklogId && editedIds.has(String(row.entry.jiraWorklogId)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => openComment(key, note)}
                      className="text-slate-500 hover:text-sky-300 p-1 transition-colors"
                      title="کامنت لاگ‌ورک"
                      aria-label="کامنت لاگ‌ورک"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(ids)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="حذف لاگ"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {commentFor === key ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      rows={2}
                      autoFocus
                      placeholder="چه کاری بوده؟"
                      className="w-full rounded-lg bg-[#10131d] border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCommentFor(null)}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        disabled={commentMutation.isPending}
                        onClick={() => commentMutation.mutate({ ids, text: commentText })}
                        className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px]"
                      >
                        {commentMutation.isPending ? 'در حال ثبت...' : 'ثبت کامنت'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
