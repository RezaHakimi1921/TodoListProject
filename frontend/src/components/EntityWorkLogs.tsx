import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Trash2 } from 'lucide-react'
import { captureWorkLog, deleteWorkLog, listEntityWorkLogs } from '../api/workLogs'
import { formatPersianDateTime, todayIso } from '../lib/dates'

interface Props {
  kind: 'task' | 'problem'
  id: number
}

export function EntityWorkLogs({ kind, id }: Props) {
  const queryClient = useQueryClient()
  const [minutes, setMinutes] = useState('15')
  const [desc, setDesc] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const logsQuery = useQuery({
    queryKey: ['worklogs', kind, id],
    queryFn: () => listEntityWorkLogs(kind, id),
    enabled: Number.isFinite(id),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      captureWorkLog({
        description: desc.trim() || (kind === 'task' ? 'تمرکز روی کار' : 'بررسی مسئله'),
        durationMinutes: Math.max(1, Number(minutes) || 15),
        source: 'Manual',
        taskId: kind === 'task' ? id : undefined,
        problemId: kind === 'problem' ? id : undefined,
      }),
    onSuccess: () => {
      setDesc('')
      setShowAdd(false)
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs', kind, id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (logId: number) => deleteWorkLog(logId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs', kind, id] })
    },
  })

  const data = logsQuery.data
  const totalMinutes = data?.totalMinutes ?? 0
  const entries = data?.entries ?? []
  const today = todayIso()
  const todayMinutes = entries
    .filter((entry) => {
      const local = new Date(entry.createdAt)
      const day = new Date(local.getTime() - local.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
      return day === today
    })
    .reduce((sum, entry) => sum + entry.durationMinutes, 0)

  return (
    <div className="rounded-2xl border border-[#262f44] bg-[#141824] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-slate-200">زمان‌های ثبت‌شده</h4>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            {todayMinutes === totalMinutes ? `${totalMinutes} دقیقه` : `${todayMinutes} امروز / ${totalMinutes} کل`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs flex items-center gap-1 text-slate-400 hover:text-amber-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {showAdd ? 'بستن فرم' : 'ثبت دستی زمان'}
        </button>
      </div>

      {showAdd && (
        <div className="mt-3 p-3 rounded-xl bg-[#1a2030] border border-slate-700/60 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="توضیح کوتاه فعالیت (اختیاری)..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="flex-1 rounded-lg bg-[#10131d] border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="480"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-16 rounded-lg bg-[#10131d] border border-slate-700 px-2 py-1.5 text-xs text-slate-200 text-center focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs text-slate-400">دقیقه</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              {addMutation.isPending ? 'در حال ثبت...' : 'افزودن'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 divide-y divide-slate-800/60">
        {entries.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">هنوز زمانی برای این مورد ثبت نشده است.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="py-2 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-200 font-medium">{entry.description}</span>
                <span className="text-slate-500 text-[11px] mr-2">({formatPersianDateTime(entry.createdAt)})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-300 font-semibold">{entry.durationMinutes}m</span>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(entry.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                  title="حذف لاگ"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
