import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle } from 'lucide-react'
import { listNotifications, markNotificationRead, type CommentNotification } from '../api/notifications'
import { formatPersianDateTime } from '../lib/dates'
import { STATUS_LABEL, type TaskStatus } from '../types'

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'unread' | 'all'>('unread')

  const listQuery = useQuery({
    queryKey: ['notifications', tab],
    queryFn: () => listNotifications(tab === 'unread'),
    refetchInterval: 15_000,
  })

  const readMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const items = listQuery.data?.items ?? []
  const unreadCount = listQuery.data?.unreadCount ?? 0

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
              کامنت‌های جدید جیرا روی تسک‌هایی که هنوز بازشان نکرده‌ای
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-1 p-0.5 rounded-xl bg-black/30 border border-white/[0.06] w-fit">
          <button
            type="button"
            onClick={() => setTab('unread')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'unread'
                ? 'bg-white/[0.08] text-white border border-white/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            خوانده نشده
            {unreadCount > 0 ? (
              <span className="ms-1.5 font-mono text-[10px] text-sky-300">{unreadCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'all'
                ? 'bg-white/[0.08] text-white border border-white/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            همه
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-4 sm:p-6 shadow-xl">
        {items.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-300 text-sm">
              {tab === 'unread' ? 'خوانده‌نشده‌ای نیست' : 'هنوز نوتیفیکیشنی نیست'}
            </p>
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
                <p className="text-xs text-slate-300 leading-relaxed">
                  <span className="text-sky-300 font-medium">{item.authorName}</span>
                  <span className="text-slate-500">: </span>
                  {item.body}
                </p>
                <span className="text-[11px] text-slate-500 font-mono">{formatPersianDateTime(item.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
