import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Archive,
  Check
} from 'lucide-react'
import { emptyTrash, listTrash, purgeTrash, restoreTrash, TRASH_KIND_LABEL, type TrashItem, type TrashKind } from '../api/trash'
import { useConfirm } from '../components/ConfirmProvider'
import { formatPersianDateTime } from '../lib/dates'

export function TrashPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const trashQuery = useQuery({
    queryKey: ['trash'],
    queryFn: () => listTrash(),
  })

  const restoreMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: number }) => restoreTrash(kind, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
      void queryClient.invalidateQueries({ queryKey: ['dailylogs'] })
    },
  })

  const purgeMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: number }) => purgeTrash(kind, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const emptyMutation = useMutation({
    mutationFn: () => emptyTrash(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })

  const items = trashQuery.data ?? []

  const handleEmptyAll = async () => {
    const ok = await confirm({
      title: 'خالی کردن دائمی سطل زباله',
      body: 'آیا اطمینان دارید؟ تمام آیتم‌های موجود در سطل برای همیشه پاک خواهند شد و قابل بازگردانی نخواهند بود.',
      confirmLabel: 'بله، همه را پاک کن',
      danger: true,
    })
    if (ok) {
      emptyMutation.mutate()
    }
  }

  const handlePurgeSingle = async (item: TrashItem) => {
    const ok = await confirm({
      title: 'حذف دائمی آیتم',
      body: `آیا از حذف دائمی «${item.title || TRASH_KIND_LABEL[item.kind]}» اطمینان دارید؟`,
      confirmLabel: 'حذف همیشگی',
      danger: true,
    })
    if (ok) {
      purgeMutation.mutate({ kind: item.kind, id: item.id })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              سطل زباله و بازیابی (Trash)
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            تمام مواردی که حذف شده‌اند اینجا نگهداری می‌شوند تا هر زمان نیاز بود آنها را بازیابی کنید.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleEmptyAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/30"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>خالی کردن کامل سطل</span>
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        {items.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <Archive className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-300 text-sm">سطل زباله خالی است</p>
            <p className="mt-1 text-slate-500">هیچ کار، مسئله یا لاگی در سطل وجود ندارد.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {items.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium shrink-0">
                    {TRASH_KIND_LABEL[item.kind] ?? item.kind}
                  </span>
                  <div>
                    <h4 className="text-slate-100 font-semibold text-sm">{item.title || '(بدون عنوان)'}</h4>
                    {item.deletedAt && (
                      <span className="text-[11px] text-slate-500">
                        حذف در: {formatPersianDateTime(item.deletedAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => restoreMutation.mutate({ kind: item.kind, id: item.id })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-xs transition-all border border-emerald-500/30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>بازیابی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePurgeSingle(item)}
                    className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors"
                    title="حذف دائمی"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
