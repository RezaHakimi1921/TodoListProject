import { Link, NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  CheckSquare, 
  Clock, 
  HelpCircle, 
  BookOpen, 
  Trash2, 
  Settings, 
  Zap, 
  Sparkles
} from 'lucide-react'
import { listTrash } from '../api/trash'
import { listTasks } from '../api/tasks'
import { WorkLogPrompt } from './WorkLogPrompt'
import { formatPersianDate } from '../lib/dates'

export function Layout() {
  const trashQuery = useQuery({
    queryKey: ['trash'],
    queryFn: () => listTrash(),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  })

  const trashCount = trashQuery.data?.length ?? 0
  const activeTasksCount = tasksQuery.data?.filter((t) => t.status !== 'Done').length ?? 0
  const deepCount = tasksQuery.data?.filter((t) => t.status !== 'Done' && t.energyType === 'Deep').length ?? 0

  const todayStr = formatPersianDate(new Date().toISOString())

  const navItems = [
    { to: '/', label: 'کارهای امروز', icon: CheckSquare, end: true },
    { to: '/worklogs', label: 'ثبت کار و زمان', icon: Clock },
    { to: '/problems', label: 'استودیوی مسئله', icon: HelpCircle },
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
    <div className="min-h-screen flex flex-col bg-[#0d0f14] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200" dir="rtl">
      {/* Top Banner & Active Focus Status */}
      <WorkLogPrompt />

      {/* Main App Bar Header */}
      <header className="border-b border-[#212738] bg-[#121520]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all flex items-center justify-center">
                  <div className="w-full h-full bg-[#11141e] rounded-[10px] flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-amber-300 transition-colors">
                      TaskOS
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      فارسی
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    مدیریت هوشمند کارهای روزانه و تمرکز عمیق
                  </p>
                </div>
              </Link>
            </div>

            {/* Quick Stats & Date Display */}
            <div className="flex items-center gap-3 text-xs">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#171b28] border border-[#262e42] text-slate-300">
                <span>{todayStr}</span>
              </div>

              {activeTasksCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="font-bold">{activeTasksCount}</span>
                  <span className="text-[11px] text-amber-400/80">کار در صف</span>
                  {deepCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 mr-1">
                      {deepCount} عمیق
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 -mb-px border-t border-slate-800/60 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#1d2232] bg-[#0e111a] py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>TaskOS • سیستم متمرکز مدیریت کارهای عمیق، حل مسئله و ثبت خودکار زمان</span>
          </div>
          <p className="text-[11px] text-slate-400">طراحی شده برای بهره‌وری بالا و تمرکز بدون حواس‌پرتی</p>
        </div>
      </footer>
    </div>
  )
}
