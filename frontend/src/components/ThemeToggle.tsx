import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getTheme, subscribeTheme, toggleTheme } from '../lib/theme'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light' as const)
  const light = theme === 'light'

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      title={light ? 'حالت تیره' : 'حالت روشن'}
      className={
        light
          ? 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-zinc-800 shadow-sm hover:border-amber-500 hover:text-amber-800'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-slate-300 hover:border-amber-400/30 hover:text-amber-100'
      }
    >
      {light ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      {compact ? null : <span className="hidden sm:inline font-medium">{light ? 'تیره' : 'روشن'}</span>}
    </button>
  )
}
