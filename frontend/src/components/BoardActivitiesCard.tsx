import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, Plus, Trash2 } from 'lucide-react'
import {
  listBoardActivities,
  parseJiraKeyFromInput,
  saveBoardActivities,
  type BoardActivity,
  type BoardActivityKind,
} from '../api/boardActivities'

function emptyDraft(): BoardActivity {
  return {
    id: `new-${Date.now().toString(36)}`,
    title: '',
    jiraKey: '',
    jiraUrl: '',
    kind: 'rest',
    needsNote: false,
    sortOrder: 0,
    enabled: true,
  }
}

export function BoardActivitiesCard() {
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['board-activities'],
    queryFn: listBoardActivities,
  })
  const [drafts, setDrafts] = useState<BoardActivity[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (listQuery.data) setDrafts(listQuery.data.map((row) => ({ ...row })))
  }, [listQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => saveBoardActivities(drafts),
    onSuccess: (rows) => {
      setDrafts(rows.map((row) => ({ ...row })))
      setError('')
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
      void queryClient.invalidateQueries({ queryKey: ['board-activities'] })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'ذخیره نشد')
    },
  })

  const updateRow = (id: string, patch: Partial<BoardActivity>) => {
    setDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addRow = () => setDrafts((prev) => [...prev, emptyDraft()])
  const removeRow = (id: string) => setDrafts((prev) => prev.filter((row) => row.id !== id))

  return (
    <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4 lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-sky-300" />
            <h2 className="text-base font-bold text-white">میانبرهای برد (نهار / استراحت / جلسه…)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            این دکمه‌ها فقط برای حساب خودت هستند. برای کاربر جدید خالی‌اند تا لینک جیرای اشتباه دیگران نمایش داده نشود.
            عنوان و کلید/لینک جیرا را بگذار تا روی برد بالا بیاید و به همان تسک وصل شود.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          افزودن
        </button>
      </div>

      {listQuery.isLoading ? (
        <p className="text-xs text-slate-500">در حال بارگذاری…</p>
      ) : drafts.length === 0 ? (
        <p className="text-xs text-slate-500 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center">
          هنوز میانبری نیست. «افزودن» را بزن و مثلاً نهار + SIP-xxxx را ثبت کن.
        </p>
      ) : (
        <div className="space-y-3">
          {drafts.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-2xl border border-white/[0.06] bg-black/20 p-3"
            >
              <label className="md:col-span-3 block text-[10px] text-slate-400">
                عنوان روی برد
                <input
                  value={row.title}
                  onChange={(e) => updateRow(row.id, { title: e.target.value })}
                  placeholder="نهار"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f121a] px-3 py-2 text-xs text-white"
                />
              </label>
              <label className="md:col-span-4 block text-[10px] text-slate-400">
                کلید یا لینک جیرا
                <input
                  value={row.jiraUrl || row.jiraKey}
                  onChange={(e) => {
                    const raw = e.target.value
                    const key = parseJiraKeyFromInput(raw)
                    updateRow(row.id, {
                      jiraKey: key,
                      jiraUrl: raw.includes('http') ? raw.trim() : undefined,
                    })
                  }}
                  placeholder="SIP-1234 یا https://jira.../browse/SIP-1234"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f121a] px-3 py-2 text-xs text-white font-mono"
                  dir="ltr"
                />
              </label>
              <label className="md:col-span-2 block text-[10px] text-slate-400">
                نوع
                <select
                  value={row.kind}
                  onChange={(e) => {
                    const kind = e.target.value as BoardActivityKind
                    updateRow(row.id, {
                      kind,
                      needsNote: kind === 'meeting' ? true : row.needsNote,
                    })
                  }}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f121a] px-3 py-2 text-xs text-white"
                >
                  <option value="rest">استراحت / نهار</option>
                  <option value="meeting">جلسه / دیلی</option>
                </select>
              </label>
              <div className="md:col-span-3 flex items-end gap-2">
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 mb-2">
                  <input
                    type="checkbox"
                    checked={row.needsNote}
                    onChange={(e) => updateRow(row.id, { needsNote: e.target.checked })}
                  />
                  خلاصه لازم است
                </label>
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 mb-2">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
                  />
                  فعال
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="ms-auto mb-1.5 rounded-lg border border-rose-500/30 p-2 text-rose-200 hover:bg-rose-500/10"
                  aria-label="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 px-4 py-2 text-xs font-bold disabled:opacity-60"
        >
          {saveMutation.isPending ? 'در حال ذخیره…' : saved ? 'ذخیره شد' : 'ذخیره میانبرها'}
        </button>
        {error ? <p className="text-[11px] text-rose-400">{error}</p> : null}
      </div>
    </div>
  )
}
