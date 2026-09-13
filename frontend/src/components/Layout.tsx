import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  CheckSquare, 
  HelpCircle, 
  BookOpen, 
  Trash2, 
  Settings, 
  Zap, 
  BarChart3,
  Bell,
  Menu,
  X
} from 'lucide-react'
import { listTrash } from '../api/trash'
import { listTasks } from '../api/tasks'
import { getUnreadNotificationCount } from '../api/notifications'
import { WorkLogPrompt } from './WorkLogPrompt'
import { PastDaysMenu } from './PastDaysMenu'
import { formatPersianDate } from '../lib/dates'
import { useFocusTaskStatus } from '../hooks/useFocusTaskStatus'
import { useJiraClosedTasks } from '../hooks/useJiraClosedTasks'
import { NotificationToasts } from './NotificationToasts'
import { NowWorkingBanner } from './NowWorkingBanner'

export function Layout() {
  useFocusTaskStatus()
  useJiraClosedTasks()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])
  const trashQuery = useQuery({
    queryKey: ['trash'],
    queryFn: () => listTrash(),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnreadNotificationCount(),
    refetchInterval: 15_000,
  })
  const unread = unreadQuery.data ?? { count: 0, newTasks: 0, comments: 0 }
  const trashCount = trashQuery.data?.length ?? 0
  const mineOpen = (tasksQuery.data ?? []).filter((t) => t.status !== 'Done' && t.ownership !== 'Other')
  const activeTasksCount = mineOpen.length
  const deepCount = mineOpen.filter((t) => t.energyType === 'Deep').length

  const todayStr = formatPersianDate(new Date().toISOString())

  const navItems = [
    { to: '/', label: 'کارهای امروز', icon: CheckSquare, end: true },
    {
      to: '/notifications',
      label: 'نوتیفیکیشن',
      icon: Bell,
      badges: { newTasks: unread.newTasks, comments: unread.comments },
    },
    { to: '/reports', label: 'گزارش', icon: BarChart3 },
    { to: '/problems', label: 'تحقیق مسئله', icon: HelpCircle },
    { to: '/dailylogs', label: 'دفترچه یادگیری', icon: BookOpen },
    { 
      to: '/trash', 
      label: 'سطل زباله', 
      icon: Trash2, 
      badge: trashCount > 0 ? trashCount : null 
    },
    { to: '/settings', label: 'تنظیمات', icon: Settings },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10] text-slate-100 selection:bg-white/15 selection:text-white" dir="rtl">
      <WorkLogPrompt />
      <NotificationToasts />

      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0d0f17]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/" id="brand-logo-link" className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-[#151924] border border-white/[0.1] group-hover:border-amber-400/40 transition-all flex items-center justify-center shadow-sm">
                  <Zap className="w-4 h-4 text-amber-400 group-hover:scale-105 transition-transform" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base tracking-tight text-white group-hover:text-amber-200 transition-colors">
                      TaskOS
                    </span>
                    <span className="hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.08]">
                      میز کار فارسی
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 hidden sm:block">
                    سیستم مدیریت تمرکز عمیق و روز کاری
                  </p>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-slate-400">
                <span className="text-slate-300 font-medium">{todayStr}</span>
              </div>

              {activeTasksCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span className="font-semibold text-slate-200">{activeTasksCount}</span>
                  <span className="hidden sm:inline text-slate-400">کار در صف</span>
                  {deepCount > 0 && (
                    <span className="hidden sm:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 mr-0.5">
                      {deepCount} عمیق
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-white/[0.06]"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {menuOpen ? (
            <nav className="md:hidden border-t border-white/[0.05] py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const split = 'badges' in item ? item.badges : null
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg ${
                        isActive
                          ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                          : 'text-slate-300 hover:bg-white/[0.04]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0 opacity-80" />
                    <span>{item.label}</span>
                    {split && (split.newTasks > 0 || split.comments > 0) ? (
                      <span className="flex items-center gap-1 ms-auto">
                        {split.newTasks > 0 ? (
                          <span className="min-w-4 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono font-bold">
                            {split.newTasks}
                          </span>
                        ) : null}
                        {split.comments > 0 ? (
                          <span className="min-w-4 px-1.5 rounded-full bg-sky-500 text-white text-[10px] font-mono font-bold">
                            {split.comments}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {'badge' in item && item.badge ? (
                      <span className="ms-auto px-1.5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-mono">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                )
              })}
              <div className="px-2 pt-1">
                <PastDaysMenu />
              </div>
            </nav>
          ) : null}

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto overflow-y-visible py-1.5 -mb-px border-t border-white/[0.05] no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon
              const split = 'badges' in item ? item.badges : null
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.1] shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span>{item.label}</span>
                  {split && (split.newTasks > 0 || split.comments > 0) ? (
                    <span className="flex items-center gap-1">
                      {split.newTasks > 0 ? (
                        <span
                          title="تسک جدید"
                          className="min-w-4 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 border border-amber-300 text-[10px] font-mono font-bold"
                        >
                          {split.newTasks}
                        </span>
                      ) : null}
                      {split.comments > 0 ? (
                        <span
                          title="نوتیف"
                          className="min-w-4 px-1.5 py-0.2 rounded-full bg-sky-500 text-white border border-sky-300 text-[10px] font-mono font-bold"
                        >
                          {split.comments}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {'badge' in item && item.badge !== null && item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-medium">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
            <PastDaysMenu />
          </nav>
          <div className="pb-3">
            <NowWorkingBanner />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 pb-36 sm:px-6 sm:py-8 sm:pb-8 lg:px-8">
        <Outlet />
      </main>

      <footer className="hidden sm:block border-t border-white/[0.06] bg-[#0a0c12] py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80"></span>
            <span className="text-slate-400">TaskOS • میز کار مینیمال برای کارهای عمیق، حل مسئله و ثبت خودکار زمان</span>
          </div>
          <p className="text-[11px] text-slate-500">سادگی، وضوح و تمرکز پایدار در جریان روز کاری</p>
        </div>
      </footer>
    </div>
  )
}
