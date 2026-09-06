import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTrash } from '../api/trash'
import { WorkLogPrompt } from './WorkLogPrompt'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm transition ${
    isActive ? 'bg-paper text-ink-950' : 'text-paper/70 hover:bg-ink-700 hover:text-paper'
  }`

export function Layout({ children }: { children: ReactNode }) {
  const trashQuery = useQuery({ queryKey: ['trash'], queryFn: listTrash })
  const trashCount = trashQuery.data?.length ?? 0

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold tracking-tight">TaskOS</span>
            <span className="hidden text-xs text-paper/45 sm:inline">میز کار شخصی</span>
          </div>
          <nav className="flex flex-wrap gap-2">
            <NavLink to="/" className={linkClass} end>
              کارها
            </NavLink>
            <NavLink to="/work" className={linkClass}>
              Work Log
            </NavLink>
            <NavLink to="/problems" className={linkClass}>
              مسئله‌ها
            </NavLink>
            <NavLink to="/log" className={linkClass}>
              یادگرفته‌ها
            </NavLink>
            <NavLink to="/trash" className={linkClass}>
              سطل{trashCount > 0 ? ` (${trashCount})` : ''}
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              تنظیمات
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-24">{children}</main>
      <WorkLogPrompt />
    </div>
  )
}
