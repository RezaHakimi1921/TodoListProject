import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, MessageCircle, TicketPlus, X } from 'lucide-react'
import {
  listNotifications,
  markNotificationRead,
  TASK_NOTIFICATIONS_READ,
  type CommentNotification,
} from '../api/notifications'
import { isKhadangAgent } from '../api/jira'

function isFreshNotification(item: CommentNotification) {
  const at = Date.parse(item.createdAt)
  if (!Number.isFinite(at)) return false
  return Date.now() - at < 5 * 60 * 1000
}

export function NotificationToasts() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const knownIds = useRef<Set<number> | null>(null)
  const [toasts, setToasts] = useState<CommentNotification[]>([])

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-toast'],
    queryFn: () => listNotifications(true),
    refetchInterval: 20_000,
    staleTime: 8_000,
  })

  useEffect(() => {
    const items = unreadQuery.data?.items ?? []
    if (!unreadQuery.data) return
    const unreadIds = new Set(items.map((item) => item.id))
    if (knownIds.current === null) {
      knownIds.current = unreadIds
      const recent = items.filter(isFreshNotification)
      if (recent.length > 0) {
        setToasts(recent.slice(0, 4))
      }
      return
    }
    const fresh = items.filter((item) => !knownIds.current!.has(item.id))
    for (const item of fresh) knownIds.current.add(item.id)
    setToasts((prev) => {
      const kept = prev.filter((row) => unreadIds.has(row.id))
      if (fresh.length === 0) return kept
      return [...fresh, ...kept].slice(0, 4)
    })
  }, [unreadQuery.data])

  useEffect(() => {
    const match = location.pathname.match(/^\/tasks\/(\d+)/)
    if (!match) return
    const taskId = Number(match[1])
    if (!Number.isFinite(taskId)) return
    setToasts((prev) => prev.filter((row) => row.taskId !== taskId))
  }, [location.pathname])

  useEffect(() => {
    const onRead = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: number }>).detail?.taskId
      if (!Number.isFinite(taskId)) return
      setToasts((prev) => prev.filter((row) => row.taskId !== taskId))
    }
    window.addEventListener(TASK_NOTIFICATIONS_READ, onRead)
    return () => window.removeEventListener(TASK_NOTIFICATIONS_READ, onRead)
  }, [])

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((row) => row.id !== id))
  }

  const openToast = (item: CommentNotification) => {
    dismissToast(item.id)
    void markNotificationRead(item.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => undefined)
    if (item.taskId) navigate(`/tasks/${item.taskId}`)
  }

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((item) => {
        const isJiraTask = item.kind === 'new-task'
        const isReminder = item.kind === 'reminder'
        const isKhadang = !isJiraTask && !isReminder && isKhadangAgent(item.authorName)
        return (
          <div
            key={item.id}
            className={`pointer-events-auto overflow-hidden rounded-2xl border shadow-xl ${
              isJiraTask
                ? 'border-amber-200 bg-amber-400 text-slate-950'
                : isReminder
                  ? 'border-violet-200 bg-violet-700 text-white'
                  : isKhadang
                    ? 'border-teal-100 bg-teal-700 text-white'
                    : 'border-sky-200 bg-sky-500 text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => openToast(item)}
              className="w-full text-right px-3.5 py-3"
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 rounded-lg p-1 ${isJiraTask ? 'bg-black/10' : 'bg-white/15'}`}>
                  {isJiraTask ? <TicketPlus className="w-4 h-4" /> : isReminder ? <Bell className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold">
                    {isJiraTask ? 'تسک جدید جیرا' : isReminder ? 'یادآوری' : isKhadang ? 'کامنت خدنگ' : 'کامنت جدید'} · {item.jiraKey}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold leading-snug line-clamp-2">
                    {item.taskTitle || item.jiraKey}
                  </p>
                  {!isJiraTask && item.body ? (
                    <p className="mt-1 text-[11px] leading-relaxed line-clamp-2 opacity-90">
                      {item.authorName}: {item.body}
                    </p>
                  ) : null}
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    dismissToast(item.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      dismissToast(item.id)
                    }
                  }}
                  className={`rounded-lg p-1 ${isJiraTask ? 'hover:bg-black/10' : 'hover:bg-white/15'}`}
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
