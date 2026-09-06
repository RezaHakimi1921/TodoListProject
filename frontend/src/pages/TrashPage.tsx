import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  emptyTrash,
  listTrash,
  purgeTrash,
  restoreTrash,
  TRASH_KIND_LABEL,
  type TrashKind,
} from '../api/trash'
import { useConfirm } from '../components/ConfirmProvider'

function formatWhen(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['trash'] })
  void queryClient.invalidateQueries({ queryKey: ['tasks'] })
  void queryClient.invalidateQueries({ queryKey: ['task'] })
  void queryClient.invalidateQueries({ queryKey: ['timeline'] })
  void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
  void queryClient.invalidateQueries({ queryKey: ['worklog-summary'] })
  void queryClient.invalidateQueries({ queryKey: ['entity-worklogs'] })
  void queryClient.invalidateQueries({ queryKey: ['dailylog'] })
  void queryClient.invalidateQueries({ queryKey: ['dailylogs'] })
  void queryClient.invalidateQueries({ queryKey: ['related'] })
  void queryClient.invalidateQueries({ queryKey: ['problems'] })
  void queryClient.invalidateQueries({ queryKey: ['problem'] })
}

export function TrashPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const listQuery = useQuery({ queryKey: ['trash'], queryFn: listTrash })

  const restoreMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: number }) => restoreTrash(kind, id),
    onSuccess: () => invalidateAll(queryClient),
    onError: (err: Error) => {
      void confirm({ title: 'برنگشت', body: err.message, confirmLabel: 'باشه', cancelLabel: 'بستن' })
    },
  })

  const purgeMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: number }) => purgeTrash(kind, id),
    onSuccess: () => invalidateAll(queryClient),
  })

  const emptyMutation = useMutation({
    mutationFn: emptyTrash,
    onSuccess: () => invalidateAll(queryClient),
  })

  const items = listQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">سطل</h1>
          <p className="mt-2 text-sm text-paper/50">
            پاک‌شده‌ها اینجایند. برگردان یا برای همیشه حذف کن.
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              void confirm({
                title: 'سطل خالی شود؟',
                body: 'همه موارد برای همیشه پاک می‌شوند. برگشتن بعد از این ممکن نیست.',
                confirmLabel: 'خالی کن',
                cancelLabel: 'انصراف',
                danger: true,
              }).then((ok) => {
                if (ok) emptyMutation.mutate()
              })
            }}
            className="rounded-2xl bg-rose-900/60 px-4 py-2 text-sm text-rose-100"
          >
            خالی کردن سطل
          </button>
        )}
      </div>

      {listQuery.isLoading && <p className="text-paper/50">در حال بارگذاری...</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={`${item.kind}-${item.id}`}
            className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-ink-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs text-paper/40">{TRASH_KIND_LABEL[item.kind] ?? item.kind}</p>
              <p className="mt-1 font-medium">{item.title || 'بدون عنوان'}</p>
              <p className="mt-1 text-xs text-paper/35">{formatWhen(item.deletedAt)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => restoreMutation.mutate({ kind: item.kind, id: item.id })}
                className="rounded-2xl bg-paper px-4 py-2 text-sm font-semibold text-ink-950"
              >
                برگردان
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirm({
                    title: 'حذف نهایی؟',
                    body: 'برای همیشه پاک می‌شود. برگشتن بعد از این ممکن نیست.',
                    confirmLabel: 'حذف نهایی',
                    cancelLabel: 'انصراف',
                    danger: true,
                  }).then((ok) => {
                    if (ok) purgeMutation.mutate({ kind: item.kind, id: item.id })
                  })
                }}
                className="rounded-2xl px-4 py-2 text-sm text-rose-200"
              >
                حذف نهایی
              </button>
            </div>
          </article>
        ))}
        {!listQuery.isLoading && items.length === 0 && (
          <p className="rounded-3xl border border-dashed border-white/10 p-8 text-sm text-paper/35">
            سطل خالی است.
          </p>
        )}
      </div>
    </div>
  )
}
