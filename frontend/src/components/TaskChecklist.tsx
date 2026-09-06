import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import {
  addChecklistItem,
  deleteChecklistItem,
  listChecklist,
  updateChecklistItem,
} from '../api/checklist'
import { useTrashConfirm } from './ConfirmProvider'

interface Props {
  taskId: number
}

export function TaskChecklist({ taskId }: Props) {
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  const query = useQuery({
    queryKey: ['checklist', taskId],
    queryFn: () => listChecklist(taskId),
    enabled: Number.isFinite(taskId),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['checklist', taskId] })
    void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const addMutation = useMutation({
    mutationFn: (title: string) => addChecklistItem(taskId, title),
    onSuccess: () => {
      setDraft('')
      setAdding(false)
      refresh()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: { itemId: number; title?: string; isDone?: boolean; sortOrder?: number }) =>
      updateChecklistItem(taskId, input.itemId, input),
    onSuccess: refresh,
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => deleteChecklistItem(taskId, itemId),
    onSuccess: refresh,
  })

  const items = query.data ?? []
  const done = items.filter((item) => item.isDone).length

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const current = items[index]
    const other = items[target]
    void updateMutation.mutateAsync({
      itemId: current.id,
      sortOrder: other.sortOrder,
    }).then(() =>
      updateMutation.mutateAsync({
        itemId: other.id,
        sortOrder: current.sortOrder,
      }),
    )
  }

  const submitDraft = () => {
    const title = draft.trim()
    if (!title) return
    addMutation.mutate(title)
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="rounded-3xl border border-[#212738] bg-[#141824] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">چک‌لیست مراحل</h3>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {done} از {items.length} انجام شد
            </span>
          </div>
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0b0e16] px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  checked={item.isDone}
                  onChange={() =>
                    updateMutation.mutate({ itemId: item.id, isDone: !item.isDone })
                  }
                  className="accent-amber-500 w-3.5 h-3.5 shrink-0"
                />
                <input
                  value={item.title}
                  onChange={(e) => {
                    const title = e.target.value
                    queryClient.setQueryData(['checklist', taskId], (prev) => {
                      const rows = Array.isArray(prev) ? prev : []
                      return rows.map((row) => (row.id === item.id ? { ...row, title } : row))
                    })
                  }}
                  onBlur={(e) => {
                    const title = e.target.value.trim()
                    if (title) updateMutation.mutate({ itemId: item.id, title })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  className={`flex-1 min-w-0 bg-transparent text-xs focus:outline-none ${
                    item.isDone ? 'text-slate-500 line-through' : 'text-slate-200'
                  }`}
                />
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30"
                  title="بالا"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30"
                  title="پایین"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await askTrash(item.title)) deleteMutation.mutate(item.id)
                  }}
                  className="p-1 text-slate-500 hover:text-rose-400"
                  title="حذف مرحله"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {adding ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitDraft()
              }
              if (e.key === 'Escape') {
                setAdding(false)
                setDraft('')
              }
            }}
            placeholder="عنوان مرحله..."
            className="flex-1 rounded-xl bg-[#0b0e16] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            disabled={!draft.trim() || addMutation.isPending}
            onClick={submitDraft}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
          >
            افزودن
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200"
        >
          <Plus className="w-3.5 h-3.5" />
          افزودن Step
        </button>
      )}
    </div>
  )
}
