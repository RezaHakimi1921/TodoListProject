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
    <div className="rounded-2xl border border-[#262f44] bg-[#141824]/90 p-4 shadow-xl backdrop-blur-sm transition-all focus-within:border-amber-500/50">
      <div className="flex flex-col gap-3">
        {/* Main Input Row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="الان چه کاری باید انجام بشه؟ (عنوان کار را بنویسید و اینتر بزنید...)"
              className="w-full rounded-xl bg-[#0e111a] border border-[#2b354d] px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-amber-500 focus:bg-[#121622] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-mono">
              <CornerDownLeft className="w-3 h-3" /> Enter
            </span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 text-sm font-bold text-slate-950 transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن کار</span>
          </button>
        </div>

        {/* Options Row: Energy Type & Tags */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          {/* Energy Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e111a] border border-[#2b354d]">
            <button
              type="button"
              onClick={() => setEnergyType('Deep')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                energyType === 'Deep'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>تمرکز عمیق (Deep)</span>
            </button>
            <button
              type="button"
              onClick={() => setEnergyType('Light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                energyType === 'Light'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Feather className="w-3.5 h-3.5" />
              <span>کار سبک و سریع (Light)</span>
            </button>
          </div>

          {/* Quick Tag Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 text-[11px] ml-1 flex items-center gap-1">
              <Tag className="w-3 h-3" /> برچسب:
            </span>
            {PRESET_TAGS.map((tag) => {
              const selected = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                    selected
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                      : 'bg-[#181d2a] border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'
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
                  placeholder="برچسب جدید..."
                  className="w-24 rounded-lg bg-[#0e111a] border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] hover:bg-slate-700"
                >
                  ثبت
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTagInput(true)}
                className="text-[11px] text-slate-500 hover:text-amber-400 p-1"
              >
                + برچسب دلخواه
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
