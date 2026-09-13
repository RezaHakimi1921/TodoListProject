import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, TicketPlus } from 'lucide-react'
import { listNotifications, markNotificationRead, type CommentNotification } from '../api/notifications'
import { formatPersianDateTime } from '../lib/dates'
import { STATUS_LABEL, type TaskStatus } from '../types'

type InboxTab = 'new-tasks' | 'new-comments' | 'all-tasks' | 'all-comments'

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<InboxTab>('new-tasks')

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
    () => allItems.filter((item) => item.kind === 'comment' && !item.read),
    [allItems],
  )
  const allTasks = useMemo(
    () => allItems.filter((item) => item.kind === 'new-task'),
    [allItems],
  )
  const allComments = useMemo(
    () => allItems.filter((item) => item.kind === 'comment'),
    [allItems],
  )

  const items =
    tab === 'new-tasks' ? newTasks
    : tab === 'new-comments' ? newComments
    : tab === 'all-tasks' ? allTasks
    : allComments

  const emptyText =
    tab === 'new-tasks' ? 'تسک جدیدی نیست'
    : tab === 'new-comments' ? 'کامنت جدیدی نیست'
    : tab === 'all-tasks' ? 'هنوز تسک جدیدی ثبت نشده'
    : 'هنوز کامنتی نیست'

  const openItem = (item: CommentNotification) => {
    if (!item.read) {
      readMutation.mutate(item.id)
    }
    if (item.taskId) {
      navigate(`/tasks/${item.taskId}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">نوتیفیکیشن</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              تسک‌های جدید و کامنت‌های جیرا را جدا ببین
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabButton active={tab === 'new-tasks'} count={newTasks.length} tone="amber" onClick={() => setTab('new-tasks')}>
            تسک جدید
          </TabButton>
          <TabButton active={tab === 'new-comments'} count={newComments.length} tone="sky" onClick={() => setTab('new-comments')}>
            کامنت جدید
          </TabButton>
          <TabButton active={tab === 'all-tasks'} count={allTasks.length} onClick={() => setTab('all-tasks')}>
            همه تسک‌ها
          </TabButton>
          <TabButton active={tab === 'all-comments'} count={allComments.length} onClick={() => setTab('all-comments')}>
            همه کامنت‌ها
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
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openItem(item)}
                className="w-full text-right py-3.5 flex flex-col gap-1.5 hover:bg-white/[0.02] px-1 rounded-xl transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {!item.read ? <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> : null}
                  {item.kind === 'new-task' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-200 border border-amber-400/20">
                      <TicketPlus className="w-3 h-3" />
                      تسک جدید
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-400/10 text-sky-200 border border-sky-400/20">
                      <MessageCircle className="w-3 h-3" />
                      کامنت
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-100">{item.taskTitle || item.jiraKey}</span>
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
                ) : (
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <span className="text-sky-300 font-medium">{item.authorName}</span>
                    <span className="text-slate-500">: </span>
                    {item.body}
                  </p>
                )}
                <span className="text-[11px] text-slate-500 font-mono">{formatPersianDateTime(item.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
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
  tone?: 'amber' | 'sky'
  onClick: () => void
  children: string
}) {
  const countClass =
    tone === 'amber' ? 'text-amber-300'
    : tone === 'sky' ? 'text-sky-300'
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
