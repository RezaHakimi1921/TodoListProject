import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm() {
  const value = useContext(ConfirmContext)
  if (!value) throw new Error('useConfirm must be used inside ConfirmProvider')
  return value
}

export function useTrashConfirm() {
  const confirm = useConfirm()
  return (label: string) =>
    confirm({
      title: 'برود به سطل؟',
      body: `${label} به سطل می‌رود. بعداً از صفحه سطل می‌توانی برش گردانی.`,
      confirmLabel: 'بله، حذف کن',
      cancelLabel: 'انصراف',
      danger: true,
    })
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const resolveRef = useRef<((value: boolean) => void) | null>(null)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)

  const close = (value: boolean) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setOptions(null)
    resolve?.(value)
  }

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setOptions(next)
    })
  }, [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-5 shadow-2xl">
            <h2 className="text-xl font-semibold">{options.title}</h2>
            <p className="mt-2 text-sm text-paper/60">{options.body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-2xl bg-ink-800 px-4 py-2 text-sm"
              >
                {options.cancelLabel ?? 'انصراف'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                  options.danger ? 'bg-rose-700 text-white' : 'bg-ember text-ink-950'
                }`}
              >
                {options.confirmLabel ?? 'تأیید'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
