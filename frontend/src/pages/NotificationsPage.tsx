import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, Bot, CheckCircle2, Eye, MessageCircle, TicketPlus } from 'lucide-react'
import { listNotifications, markNotificationRead, type CommentNotification } from '../api/notifications'
import { formatPersianDateTime } from '../lib/dates'
import { isKhadangAgent } from '../api/jira'
import { MarkdownBody } from '../components/MarkdownBody'
import { STATUS_LABEL, type TaskStatus } from '../types'

type InboxTab = 'new-tasks' | 'new-comments' | 'new-khadang' | 'all-tasks' | 'all-comments' | 'all-khadang'

const PAGE_SIZE = 20

function isKhadangItem(item: CommentNotification) {
  return item.kind === 'comment' && isKhadangAgent(item.authorName)
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<InboxTab>('new-tasks')
  const [page, setPage] = useState(0)
  const [tabTouched, setTabTouched] = useState(false)

  const listQuery = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => listNotifications(false),
    refetchInterval: 15_000,
  })

  const readMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const allItems = listQuery.data?.items ?? []
  const newTasks = useMemo(
    () => allItems.filter((item) => item.kind === 'new-task' && !item.read),
    [allItems],
  )
  const newComments = useMemo(
    () => allItems.filter((item) => item.kind === 'comment' && !item.read && !isKhadangItem(item)),
    [allItems],
  )
  const newKhadang = useMemo(
    () => allItems.filter((item) => isKhadangItem(item) && !item.read),
    [allItems],
  )
  const allTasks = useMemo(
    () => allItems.filter((item) => item.kind === 'new-task'),
    [allItems],
  )
  const allComments = useMemo(
    () => allItems.filter((item) => item.kind === 'comment' && !isKhadangItem(item)),
    [allItems],
  )
  const allKhadang = useMemo(
    () => allItems.filter((item) => isKhadangItem(item)),
    [allItems],
  )

  useEffect(() => {
    if (tabTouched || listQuery.isLoading) return
    if (newKhadang.length > 0) { setTab('new-khadang'); return }
    if (newComments.length > 0) { setTab('new-comments'); return }
    if (newTasks.length > 0) { setTab('new-tasks'); return }
  }, [tabTouched, listQuery.isLoading, newKhadang.length, newComments.length, newTasks.length])

  const allForTab =
    tab === 'new-tasks' ? newTasks
    : tab === 'new-comments' ? newComments
    : tab === 'new-khadang' ? newKhadang
    : tab === 'all-tasks' ? allTasks
    : tab === 'all-comments' ? allComments
    : allKhadang

  useEffect(() => {
    setPage(0)
  }, [tab])

  const totalPages = Math.max(1, Math.ceil(allForTab.length / PAGE_SIZE))
  const items = useMemo(
    () => allForTab.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [allForTab, page],
  )

  const unreadOnPage = useMemo(() => items.filter((item) => !item.read), [items])

  const emptyText =
    tab === 'new-tasks' ? 'تسک جدیدی نیست'
    : tab === 'new-comments' ? 'کامنت جدیدی نیست'
    : tab === 'new-khadang' ? 'نوتیف خدنگ جدیدی نیست'
    : tab === 'all-tasks' ? 'هنوز تسک جدیدی ثبت نشده'
    : tab === 'all-comments' ? 'هنوز کامنتی نیست'
    : 'هنوز نوتیف خدنگی نیست'

  const openItem = (item: CommentNotification) => {
    // Opening from inbox means the user saw it — mark read before navigate.
    if (!item.read) readMutation.mutate(item.id)
    const taskId = Number(item.taskId)
    if (Number.isFinite(taskId) && taskId > 0) {
      navigate(`/tasks/${taskId}`, { state: { fromNotification: true, jiraKey: item.jiraKey } })
      return
    }
    if (item.jiraUrl) {
      window.open(item.jiraUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const markSeen = (item: CommentNotification) => {
    if (item.read || readMutation.isPending) return
    readMutation.mutate(item.id)
  }

  const markAllSeenOnTab = () => {
    const unread = allForTab.filter((item) => !item.read)
    for (const item of unread) {
      readMutation.mutate(item.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">نوتیفیکیشن</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                تسک جدید، کامنت جیرا و خدنگ را جدا ببین — بدون ورود به تسک هم می‌توانی دیده‌شده کنی
              </p>
            </div>
          </div>
          {allForTab.some((item) => !item.read) ? (
            <button
              type="button"
              disabled={readMutation.isPending}
              onClick={markAllSeenOnTab}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-[11px] font-bold text-sky-100 hover:bg-sky-500/25 disabled:opacity-50"
              title="همه موارد این تب را دیده‌شده کن"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              همه این تب دیده‌شد
            </button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabButton active={tab === 'new-tasks'} count={newTasks.length} tone="amber" onClick={() => { setTabTouched(true); setTab('new-tasks') }}>
            تسک جدید
          </TabButton>
          <TabButton active={tab === 'new-comments'} count={newComments.length} tone="sky" onClick={() => { setTabTouched(true); setTab('new-comments') }}>
            کامنت جدید
          </TabButton>
          <TabButton active={tab === 'new-khadang'} count={newKhadang.length} tone="teal" onClick={() => { setTabTouched(true); setTab('new-khadang') }}>
            خدنگ
          </TabButton>
          <TabButton active={tab === 'all-tasks'} count={allTasks.length} onClick={() => { setTabTouched(true); setTab('all-tasks') }}>
            همه تسک‌ها
          </TabButton>
          <TabButton active={tab === 'all-comments'} count={allComments.length} onClick={() => { setTabTouched(true); setTab('all-comments') }}>
            همه کامنت‌ها
          </TabButton>
          <TabButton active={tab === 'all-khadang'} count={allKhadang.length} onClick={() => { setTabTouched(true); setTab('all-khadang') }}>
            همه خدنگ
          </TabButton>
        </div>
      </div>

      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-4 sm:p-6 shadow-xl">
        {items.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-300 text-sm">{emptyText}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {items.map((item) => {
              const isKhadang = isKhadangItem(item)
              const faded = item.read && (tab === 'all-tasks' || tab === 'all-comments' || tab === 'all-khadang')
              return (
                <div
                  key={item.id}
                  className={`py-3.5 flex items-start justify-between gap-3 px-1 rounded-xl transition-opacity ${
                    faded ? 'opacity-45' : 'opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="min-w-0 flex-1 text-right flex flex-col gap-1.5 hover:opacity-90"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {!item.read ? (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isKhadang ? 'bg-teal-400' : item.kind === 'new-task' ? 'bg-amber-400' : 'bg-sky-400'
                          }`}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500 border border-white/10">
                          دیده‌شده
                        </span>
                      )}
                      {item.kind === 'reminder' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-100 border border-violet-500/30">
                          <Bell className="w-3 h-3" />
                          یادآوری
                        </span>
                      ) : item.kind === 'new-task' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-200 border border-amber-400/20">
                          <TicketPlus className="w-3 h-3" />
                          تسک جدید
                        </span>
                      ) : isKhadang ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-teal-600/15 text-teal-100 border border-teal-500/35">
                          <Bot className="w-3 h-3" />
                          خدنگ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-400/10 text-sky-200 border border-sky-400/20">
                          <MessageCircle className="w-3 h-3" />
                          کامنت
                        </span>
                      )}
                      <span className={`text-sm font-semibold ${item.read ? 'text-slate-300' : 'text-slate-100'}`}>
                        {item.taskTitle || item.jiraKey}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/10">
                        {item.jiraKey}
                      </span>
                      {item.taskStatus ? (
                        <span className="text-[10px] text-slate-500">
                          {STATUS_LABEL[item.taskStatus as TaskStatus] ?? item.taskStatus}
                        </span>
                      ) : null}
                    </div>
                    {item.kind === 'new-task' ? (
                      <p className="text-xs text-amber-100/80 leading-relaxed">تسک جدید ثبت شد</p>
                    ) : item.kind === 'reminder' ? (
                      <p className="text-xs text-violet-100/90 leading-relaxed">{item.body}</p>
                    ) : (
                      <div className="text-xs text-slate-300 leading-relaxed space-y-1">
                        <p>
                          <span className={`font-medium ${isKhadang ? 'text-teal-300' : 'text-sky-300'}`}>
                            {isKhadang ? `خدنگ · ${item.authorName}` : item.authorName}
                          </span>
                          <span className="text-slate-500">:</span>
                        </p>
                        <MarkdownBody text={item.body} compact />
                      </div>
                    )}
                    <span className="text-[11px] text-slate-500 font-mono">{formatPersianDateTime(item.createdAt)}</span>
                  </button>
                  {!item.read ? (
                    <button
                      type="button"
                      disabled={readMutation.isPending}
                      onClick={(event) => {
                        event.stopPropagation()
                        markSeen(item)
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-bold text-sky-100 hover:bg-sky-500/25 disabled:opacity-50"
                      title="علامت به‌عنوان دیده‌شده"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      دیده شد
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        {allForTab.length > PAGE_SIZE ? (
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
              {page + 1} / {totalPages} · {allForTab.length} مورد
              {unreadOnPage.length > 0 ? ` · ${unreadOnPage.length} خوانده‌نشده در این صفحه` : ''}
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
    </div>
  )
}

function TabButton({
  active,
  count,
  tone,
  onClick,
  children,
}: {
  active: boolean
  count: number
  tone?: 'amber' | 'sky' | 'teal'
  onClick: () => void
  children: string
}) {
  const countClass =
    tone === 'amber' ? 'text-amber-300'
    : tone === 'sky' ? 'text-sky-300'
    : tone === 'teal' ? 'text-teal-300'
    : 'text-slate-400'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
        active
          ? 'bg-white/[0.08] text-white border-white/15'
          : 'text-slate-400 hover:text-slate-200 border-white/[0.06] bg-black/20'
      }`}
    >
      {children}
      {count > 0 ? <span className={`ms-1.5 font-mono text-[10px] ${countClass}`}>{count}</span> : null}
    </button>
  )
}
