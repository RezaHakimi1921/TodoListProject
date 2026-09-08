import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, Lock, MessageCircle, Trash2, UserRound } from 'lucide-react'
import { addJiraIssueComment, getJiraIssueThread, isJiraMe, type JiraCommentAuthor } from '../api/jira'
import { addTimeline, deleteTimeline, listTimeline } from '../api/tasks'
import { formatPersianDateTime } from '../lib/dates'

interface Props {
  taskId: number
  jiraKey?: string | null
}

const PRIVATE_PREFIX = '🔒 '

interface ChatItem {
  id: string
  body: string
  createdAt: string
  authorName: string
  mine: boolean
  localId?: number
  privateNote?: boolean
}

function personName(person?: JiraCommentAuthor | null) {
  return person?.displayName?.trim() || person?.name?.trim() || 'کاربر جیرا'
}

function displayBody(body: string) {
  const text = body.replace(/!([^!]+)!/g, '📎 تصویر').replace(/\s+/g, ' ').trim()
  return text || '📎 تصویر'
}

export function TaskCommentThread({ taskId, jiraKey }: Props) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  const timelineQuery = useQuery({
    queryKey: ['timeline', taskId],
    queryFn: () => listTimeline(taskId),
    enabled: Number.isFinite(taskId),
  })

  const jiraQuery = useQuery({
    queryKey: ['jira-thread', jiraKey],
    queryFn: () => getJiraIssueThread(jiraKey!),
    enabled: Boolean(jiraKey),
  })

  const items = useMemo<ChatItem[]>(() => {
    const local = (timelineQuery.data ?? []).map((entry) => {
      const privateNote = entry.note.startsWith(PRIVATE_PREFIX)
      return {
        id: `local-${entry.id}`,
        body: privateNote ? entry.note.slice(PRIVATE_PREFIX.length) : entry.note,
        createdAt: entry.createdAt,
        authorName: privateNote ? 'یادداشت خصوصی' : 'من',
        mine: true,
        localId: entry.id,
        privateNote,
      }
    })
    const remote = (jiraQuery.data?.comments ?? []).map((comment) => ({
      id: `jira-${comment.id}`,
      body: displayBody(comment.body),
      createdAt: comment.created,
      authorName: personName(comment.author),
      mine: isJiraMe(comment.author),
    }))
    return [...local, ...remote].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  }, [jiraQuery.data?.comments, timelineQuery.data])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [items.length])

  const sendMutation = useMutation({
    mutationFn: async (mode: 'private' | 'jira') => {
      const text = note.trim()
      if (!text) return
      if (mode === 'private') {
        await addTimeline(taskId, `${PRIVATE_PREFIX}${text}`)
        return
      }
      if (jiraKey) {
        await addJiraIssueComment(jiraKey, text)
        return
      }
      await addTimeline(taskId, text)
    },
    onSuccess: () => {
      setNote('')
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['timeline', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['jira-thread', jiraKey] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (entryId: number) => deleteTimeline(taskId, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timeline', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const reporter = jiraQuery.data?.reporter
  const assignee = jiraQuery.data?.assignee
  const creator = jiraQuery.data?.creator

  return (
    <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4 text-amber-400" />
        <h4 className="text-sm font-bold text-slate-200">گفتگو و کامنت‌ها</h4>
      </div>

      {(reporter || creator || assignee) && (
        <div className="mb-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[11px] text-slate-300 space-y-1">
          {(creator || reporter) && (
            <p className="flex items-center gap-1.5">
              <UserRound className="w-3 h-3 text-sky-300" />
              <span className="text-slate-500">ثبت‌کننده تیکت:</span>
              <span className="font-medium text-slate-100">{personName(creator || reporter)}</span>
            </p>
          )}
          {assignee && (
            <p className="flex items-center gap-1.5">
              <UserRound className="w-3 h-3 text-emerald-300" />
              <span className="text-slate-500">واگذارشده به:</span>
              <span className="font-medium text-slate-100">{personName(assignee)}</span>
            </p>
          )}
        </div>
      )}

      <div dir="ltr" className="max-h-72 overflow-y-auto space-y-2.5 px-0.5">
        {items.length === 0 ? (
          <p dir="rtl" className="py-6 text-center text-xs text-slate-500">
            هنوز کامنت یا یادداشتی ثبت نشده است.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`flex ${item.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                dir="rtl"
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  item.privateNote
                    ? 'bg-slate-700/40 border border-slate-500/30 text-slate-100 rounded-br-md'
                    : item.mine
                      ? 'bg-amber-500/15 border border-amber-500/25 text-slate-100 rounded-br-md'
                      : 'bg-[#1c2233] border border-white/10 text-slate-100 rounded-bl-md'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className={`text-[10px] font-semibold ${item.privateNote ? 'text-slate-300' : item.mine ? 'text-amber-300' : 'text-sky-300'}`}>
                    {item.mine ? (item.privateNote ? 'یادداشت خصوصی' : 'من') : item.authorName}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatPersianDateTime(item.createdAt)}</span>
                </div>
                <p className="text-slate-200 whitespace-pre-wrap">{item.body}</p>
                {item.localId != null && (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(item.localId!)}
                    className="mt-1 text-slate-500 hover:text-rose-400"
                    title="حذف یادداشت"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 space-y-2" dir="rtl">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && note.trim()) {
              e.preventDefault()
              sendMutation.mutate('private')
            }
          }}
          placeholder="یادداشت خصوصی یا کامنت عمومی بنویسید..."
          className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!note.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate('private')}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-100 font-bold text-xs flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>یادداشت برای خودم</span>
          </button>
          <button
            type="button"
            disabled={!note.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate('jira')}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{jiraKey ? 'کامنت Jira' : 'کامنت General'}</span>
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </div>
  )
}
