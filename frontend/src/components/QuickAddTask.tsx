import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTask, getSimilarTasks } from '../api/tasks'
import type { EnergyType } from '../types'
import { SimilarTasksHint } from './SimilarTasksHint'

export function QuickAddTask() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [energyType, setEnergyType] = useState<EnergyType>('Light')
  const [tags, setTags] = useState('')
  const [debouncedTitle, setDebouncedTitle] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTitle(title.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [title])

  const similarQuery = useQuery({
    queryKey: ['similar', debouncedTitle],
    queryFn: () => getSimilarTasks(debouncedTitle),
    enabled: debouncedTitle.length >= 3,
  })

  const createMutation = useMutation({
    mutationFn: () => createTask({ title: title.trim(), energyType, tags: tags.trim() || undefined }),
    onSuccess: () => {
      setTitle('')
      setTags('')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  return (
    <form
      className="rounded-3xl border border-white/10 bg-ink-800/70 p-4 shadow-xl shadow-black/20"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) createMutation.mutate()
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="+ تسک جدید — فقط یک خط"
          className="flex-1 rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 outline-none ring-ember/40 placeholder:text-paper/30 focus:ring-2"
        />
        <div className="flex rounded-2xl bg-ink-950/70 p-1">
          {(['Light', 'Deep'] as EnergyType[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setEnergyType(value)}
              className={`rounded-xl px-3 py-2 text-sm ${
                energyType === value ? 'bg-paper text-ink-950' : 'text-paper/60'
              }`}
            >
              {value === 'Deep' ? 'تمرکز عمیق' : 'کار سبک'}
            </button>
          ))}
        </div>
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="تگ‌ها، با ویرگول"
          className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-3 py-3 text-sm outline-none md:w-48"
        />
        <button
          type="submit"
          disabled={!title.trim() || createMutation.isPending}
          className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-ink-950 disabled:opacity-40"
        >
          افزودن
        </button>
      </div>
      {similarQuery.data && <div className="mt-3"><SimilarTasksHint matches={similarQuery.data} /></div>}
    </form>
  )
}
