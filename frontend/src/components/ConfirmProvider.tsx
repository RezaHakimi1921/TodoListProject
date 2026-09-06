import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

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
      title: 'انتقال به سطل زباله',
      body: `آیا از انتقال «${label}» به سطل زباله اطمینان دارید؟ هر زمان بخواهید می‌توانید از بخش سطل آن را بازیابی کنید.`,
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
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#2b3348] bg-[#141824] p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${options.danger ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  {options.danger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <h3 className="text-lg font-bold text-slate-100">{options.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => close(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              {options.body}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-sm font-medium text-slate-300 transition-colors"
              >
                {options.cancelLabel ?? 'انصراف'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm ${
                  options.danger
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
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
