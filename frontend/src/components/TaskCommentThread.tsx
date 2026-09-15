import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AtSign, Globe, Lock, MessageCircle, Trash2, UserRound, Users } from 'lucide-react'
import { addJiraIssueComment, getJiraIssueThread, isJiraMe, isKhadangAgent, jiraProjectKeyFromIssue, searchJiraUsers, type JiraCommentAuthor, type JiraUserOption } from '../api/jira'
import { addTimeline, deleteTimeline, listTimeline } from '../api/tasks'
import { formatPersianDateTime } from '../lib/dates'
import { jiraWikiToText } from '../lib/jira'

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
  khadang?: boolean
  localId?: number
  privateNote?: boolean
  /** Jira team-only (comment internally) */
  teamInternal?: boolean
}

function personName(person?: JiraCommentAuthor | null) {
  return person?.displayName?.trim() || person?.name?.trim() || 'کاربر جیرا'
}

function displayBody(body: string) {
  const images = body.match(/!([^!\n]+)!/g)?.length ?? 0
  const text = jiraWikiToText(body)
  if (text && !/^📎 تصویر(?:\s*📎 تصویر)*$/.test(text)) return text
  if (images > 1) return `📎 ${images} تصویر پیوست شده`
  if (images === 1) return '📎 یک تصویر پیوست شده'
  return text
}

function LinkedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return (
    <p className="whitespace-pre-wrap text-slate-200">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sky-300 underline decoration-sky-300/40"
          >
            {part}
          </a>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </p>
  )
}

export function TaskCommentThread({ taskId, jiraKey }: Props) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [users, setUsers] = useState<JiraUserOption[]>([])
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
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
        authorName: privateNote ? 'خصوصی' : 'من',
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
      khadang: isKhadangAgent(comment.author),
      teamInternal: comment.internal === true,
    }))
    return [...local, ...remote].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  }, [jiraQuery.data?.comments, timelineQuery.data])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [items.length])

  const sendMutation = useMutation({
    mutationFn: async (mode: 'private' | 'public' | 'team') => {
      const text = note.trim()
      if (!text) return
      if (mode === 'private') {
        await addTimeline(taskId, `${PRIVATE_PREFIX}${text}`)
        return
      }
      if (jiraKey) {
        await addJiraIssueComment(jiraKey, text, { internal: mode === 'team' })
        return
      }
      // Without Jira: public/team both store as local non-private notes
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


  useEffect(() => {
    if (!mentionOpen || !jiraKey) return
    const projectKey = jiraProjectKeyFromIssue(jiraKey)
    const handle = window.setTimeout(() => {
      void searchJiraUsers(projectKey, mentionQuery)
        .then((rows) => {
          setUsers(rows)
          setMentionIndex(0)
        })
        .catch(() => setUsers([]))
    }, 180)
    return () => window.clearTimeout(handle)
  }, [mentionOpen, mentionQuery, jiraKey])

  const applyMention = (user: JiraUserOption) => {
    const el = inputRef.current
    const value = note
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const after = value.slice(caret)
    const at = before.lastIndexOf('@')
    if (at < 0) return
    const inserted = `${before.slice(0, at)}[~${user.name}] `
    setNote(inserted + after)
    setMentionOpen(false)
    setMentionQuery('')
    requestAnimationFrame(() => {
      const node = inputRef.current
      if (!node) return
      const pos = inserted.length
      node.focus()
      node.setSelectionRange(pos, pos)
    })
  }

  const onNoteChange = (value: string, caret: number) => {
    setNote(value)
    if (!jiraKey) {
      setMentionOpen(false)
      return
    }
    const before = value.slice(0, caret)
    const match = before.match(/@([^\s@\[\]]*)$/)
    if (match) {
      setMentionOpen(true)
      setMentionQuery(match[1] ?? '')
    } else {
      setMentionOpen(false)
      setMentionQuery('')
    }
  }

  const reporter = jiraQuery.data?.reporter
  const assignee = jiraQuery.data?.assignee
  const creator = jiraQuery.data?.creator
  const description = jiraWikiToText(jiraQuery.data?.description)

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

      {description ? (
        <div className="mb-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.07] px-3 py-2.5">
          <p className="mb-1 text-[10px] font-semibold text-sky-300">
            شرح تیکت
            {jiraQuery.data?.created ? (
              <span className="ms-2 font-normal text-slate-500">{formatPersianDateTime(jiraQuery.data.created)}</span>
            ) : null}
          </p>
          <LinkedText text={description} />
        </div>
      ) : null}

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
                    : item.teamInternal
                      ? 'bg-violet-600/15 border border-violet-500/35 text-slate-100 rounded-br-md'
                      : item.mine
                        ? 'bg-amber-500/15 border border-amber-500/25 text-slate-100 rounded-br-md'
                        : item.khadang
                          ? 'bg-teal-600/15 border border-teal-500/40 text-slate-100 rounded-bl-md shadow-[0_0_0_1px_rgba(13,148,136,0.18)]'
                          : 'bg-[#1c2233] border border-white/10 text-slate-100 rounded-bl-md'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className={`text-[10px] font-semibold ${item.privateNote ? 'text-slate-300' : item.teamInternal ? 'text-violet-300' : item.mine ? 'text-amber-300' : item.khadang ? 'text-teal-300' : 'text-sky-300'}`}>
                    {item.privateNote
                      ? 'خصوصی'
                      : item.teamInternal
                        ? (item.mine ? 'تیم · من' : `تیم · ${item.authorName}`)
                        : item.mine
                          ? 'من'
                          : item.khadang
                            ? `خدنگ · ${item.authorName}`
                            : item.authorName}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatPersianDateTime(item.createdAt)}</span>
                </div>
                <LinkedText text={item.body} />
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
        <div className="relative">
          <textarea
            ref={inputRef}
            rows={3}
            value={note}
            onChange={(e) => onNoteChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={(e) => {
              if (mentionOpen && users.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setMentionIndex((i) => (i + 1) % users.length)
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setMentionIndex((i) => (i - 1 + users.length) % users.length)
                  return
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  applyMention(users[mentionIndex] ?? users[0])
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setMentionOpen(false)
                  return
                }
              }
              // Enter = new line; Ctrl/Cmd+Enter sends (public or private without Jira)
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && note.trim()) {
                e.preventDefault()
                sendMutation.mutate(jiraKey ? 'public' : 'private')
              }
            }}
            placeholder={jiraKey ? 'پیام را بنویسید... Enter خط بعد · Ctrl+Enter ارسال · با @ تگ کنید' : 'پیام را بنویسید... Enter خط بعد · Ctrl+Enter ارسال'}
            className="w-full min-h-[4.5rem] resize-y rounded-xl bg-[#0b0e16] border border-[#2b354d] px-3 py-2 text-xs leading-relaxed text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          {mentionOpen && jiraKey ? (
            <div className="absolute bottom-full mb-1 start-0 end-0 z-20 max-h-44 overflow-y-auto rounded-xl border border-[#2b354d] bg-[#121722] shadow-xl">
              {users.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <AtSign className="w-3 h-3" />
                  نتیجه‌ای نیست
                </p>
              ) : (
                users.map((user, index) => (
                  <button
                    key={user.name}
                    type="button"
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      applyMention(user)
                    }}
                    className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                      index === mentionIndex ? 'bg-amber-500/15 text-amber-100' : 'text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="font-medium">{user.displayName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">@{user.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!note.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate('public')}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1"
            title={jiraKey ? 'Share with customer — همه می‌بینند' : 'کامنت عمومی در برنامه'}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>عمومی</span>
          </button>
          <button
            type="button"
            disabled={!note.trim() || sendMutation.isPending || !jiraKey}
            onClick={() => sendMutation.mutate('team')}
            className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1"
            title="Comment internally — فقط تیم / دولوپرها در جیرا"
          >
            <Users className="w-3.5 h-3.5" />
            <span>تیم</span>
          </button>
          <button
            type="button"
            disabled={!note.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate('private')}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-100 font-bold text-xs flex items-center gap-1"
            title="فقط در برنامه شما — به جیرا نمی‌رود"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>خصوصی</span>
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </div>
  )
}
