import { useState, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Zap, Feather, Tag, CornerDownLeft } from 'lucide-react'
import { createTask, getSimilarTasks } from '../api/tasks'
import { SimilarTasksHint } from './SimilarTasksHint'
import type { EnergyType } from '../types'

const PRESET_TAGS = ['کدنویسی', 'جلسه', 'باگ', 'بازبینی', 'مستندات', 'فوری']

export function QuickAddTask() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [energyType, setEnergyType] = useState<EnergyType>('Deep')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [error, setError] = useState('')

  const similarQuery = useQuery({
    queryKey: ['similarTasks', title],
    queryFn: () => getSimilarTasks(title),
    enabled: title.trim().length >= 4,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({
        title: title.trim(),
        energyType,
        tags: tags.join(','),
      }),
    onSuccess: () => {
      setTitle('')
      setTags([])
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = () => {
    if (!title.trim()) return
    createMutation.mutate()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleAddCustomTag = () => {
    const val = customTag.trim()
    if (val && !tags.includes(val)) {
      setTags((prev) => [...prev, val])
      setCustomTag('')
    }
  }

  return (
    <div id="quick-add-task-container" className="rounded-2xl border border-white/[0.08] bg-[#10131b] p-4 sm:p-5 shadow-lg shadow-black/20 transition-all duration-200 focus-within:border-white/20 focus-within:bg-[#12151e]">
      <div className="flex flex-col gap-3.5">
        {/* Main Input Row */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <input
              id="quick-add-task-input"
              type="text"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اکنون چه کاری باید به سرانجام برسد؟ (عنوان کار را بنویسید و Enter بزنید...)"
              className="w-full rounded-xl bg-black/25 border border-white/[0.06] px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-white/25 focus:bg-black/40 focus:outline-none"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-mono">
              <CornerDownLeft className="w-3 h-3 opacity-60" /> Enter
            </span>
          </div>

          <button
            id="quick-add-task-submit-btn"
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن</span>
          </button>
        </div>

        {/* Options Row: Energy Type & Tags */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5 text-xs">
          {/* Energy Switcher */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/30 border border-white/[0.06]">
            <button
              id="btn-energy-deep"
              type="button"
              onClick={() => setEnergyType('Deep')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                energyType === 'Deep'
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>تمرکز عمیق</span>
            </button>
            <button
              id="btn-energy-light"
              type="button"
              onClick={() => setEnergyType('Light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                energyType === 'Light'
                  ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Feather className="w-3.5 h-3.5 text-emerald-400" />
              <span>کار سبک و سریع</span>
            </button>
          </div>

          {/* Quick Tag Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 text-[11px] ml-1 flex items-center gap-1">
              <Tag className="w-3 h-3 opacity-60" /> برچسب:
            </span>
            {PRESET_TAGS.map((tag) => {
              const selected = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all ${
                    selected
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/10'
                  }`}
                >
                  {tag}
                </button>
              )
            })}

            {showTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCustomTag()
                    }
                  }}
                  placeholder="برچسب..."
                  className="w-20 rounded-md bg-black/40 border border-white/10 px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 text-[11px] hover:bg-white/20"
                >
                  ثبت
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTagInput(true)}
                className="text-[11px] text-slate-500 hover:text-slate-300 px-1 py-0.5"
              >
                + برچسب
              </button>
            )}
          </div>
        </div>

        {/* Similar Tasks Hint */}
        {similarQuery.data && similarQuery.data.length > 0 && (
          <div className="mt-1">
            <SimilarTasksHint matches={similarQuery.data} />
          </div>
        )}

        {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    </div>
  )
}
