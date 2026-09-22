import { FormEvent, useState, useSyncExternalStore } from 'react'
import { KeyRound } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changePassword, getAuthMe, logout } from '../api/auth'
import { getTheme, subscribeTheme } from '../lib/theme'

const darkRaised =
  'shadow-[6px_6px_14px_#07080c,-6px_-6px_14px_#1a1f2e] hover:shadow-[4px_4px_10px_#07080c,-4px_-4px_10px_#1a1f2e]'
const darkInset = 'shadow-[inset_5px_5px_12px_#07080c,inset_-5px_-5px_12px_#1a1f2e]'
const lightRaised =
  'shadow-[6px_6px_14px_#bec3cf,-6px_-6px_14px_#ffffff] hover:shadow-[4px_4px_10px_#bec3cf,-4px_-4px_10px_#ffffff]'
const lightInset = 'shadow-[inset_5px_5px_12px_#bec3cf,inset_-5px_-5px_12px_#ffffff]'

export function SetPasswordPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light' as const)
  const dark = theme === 'dark'
  const neuRaised = dark ? darkRaised : lightRaised
  const neuInset = dark ? darkInset : lightInset
  const surface = dark ? 'bg-[#121722] text-slate-200' : 'bg-[#e4ebf5] text-slate-700'
  const cardBg = dark ? 'bg-[#121722]' : 'bg-[#e4ebf5]'
  const label = dark ? 'text-amber-300/90' : 'text-sky-600'
  const muted = dark ? 'text-slate-400' : 'text-slate-500'
  const inputText = dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthMe,
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: () => changePassword(password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      navigate('/', { replace: true })
    },
    onError: (err: Error) => setError(err.message || 'ثبت رمز ناموفق بود'),
  })

  if (meQuery.isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${surface}`} dir="rtl">
        در حال بررسی…
      </div>
    )
  }

  if (!meQuery.data?.authenticated) {
    return <Navigate to="/login" replace />
  }

  if (!meQuery.data.mustChangePassword) {
    return <Navigate to="/" replace />
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 4) {
      setError('رمز جدید حداقل ۴ کاراکتر باشد')
      return
    }
    if (password !== confirm) {
      setError('تکرار رمز با رمز جدید یکی نیست')
      return
    }
    mutation.mutate()
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${surface}`} dir="rtl">
      <form onSubmit={onSubmit} className={`relative w-full max-w-[360px] rounded-[24px] ${cardBg} px-7 py-8 ${neuRaised}`}>
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${cardBg} ${neuRaised}`}>
            <KeyRound className="h-6 w-6 text-amber-500" strokeWidth={2.2} />
          </div>
          <h1 className={`text-xl font-bold ${dark ? 'text-slate-100' : 'text-slate-700'}`}>رمز جدید</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            با رمز موقت وارد شدی. قبل از ورود به برنامه باید رمز دائمی بگذاری.
          </p>
          {meQuery.data.username ? (
            <p className={`mt-2 text-xs ${label}`}>کاربر: {meQuery.data.username}</p>
          ) : null}
        </div>

        <div className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className={`text-xs font-semibold ${label}`}>رمز جدید</span>
            <div className={`rounded-xl ${cardBg} px-3.5 py-2.5 ${neuInset}`}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={`w-full bg-transparent text-sm focus:outline-none ${inputText}`}
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className={`text-xs font-semibold ${label}`}>تکرار رمز جدید</span>
            <div className={`rounded-xl ${cardBg} px-3.5 py-2.5 ${neuInset}`}>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={`w-full bg-transparent text-sm focus:outline-none ${inputText}`}
              />
            </div>
          </label>

          {error ? <p className="text-center text-xs text-rose-500">{error}</p> : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className={`w-full rounded-xl ${cardBg} py-3 text-sm font-bold ${dark ? 'text-amber-300' : 'text-sky-600'} ${neuRaised} disabled:opacity-60`}
          >
            {mutation.isPending ? 'در حال ذخیره…' : 'ثبت رمز و ورود'}
          </button>

          <button
            type="button"
            className={`block w-full text-center text-xs ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500'}`}
            onClick={() => {
              void logout()
                .catch(() => undefined)
                .finally(() => {
                  void queryClient.clear()
                  navigate('/login', { replace: true })
                })
            }}
          >
            انصراف و خروج
          </button>
        </div>
      </form>
    </div>
  )
}
