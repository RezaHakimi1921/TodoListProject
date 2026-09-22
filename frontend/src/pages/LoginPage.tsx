import { FormEvent, useState, useSyncExternalStore } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAuthMe, login } from '../api/auth'
import { getTheme, subscribeTheme } from '../lib/theme'

const lightRaised =
  'shadow-[6px_6px_14px_#bec3cf,-6px_-6px_14px_#ffffff] hover:shadow-[4px_4px_10px_#bec3cf,-4px_-4px_10px_#ffffff] active:shadow-[inset_4px_4px_10px_#bec3cf,inset_-4px_-4px_10px_#ffffff]'
const lightInset =
  'shadow-[inset_5px_5px_12px_#bec3cf,inset_-5px_-5px_12px_#ffffff] focus-within:shadow-[inset_6px_6px_14px_#b0b6c4,inset_-6px_-6px_14px_#ffffff]'
const darkRaised =
  'shadow-[6px_6px_14px_#07080c,-6px_-6px_14px_#1a1f2e] hover:shadow-[4px_4px_10px_#07080c,-4px_-4px_10px_#1a1f2e] active:shadow-[inset_4px_4px_10px_#07080c,inset_-4px_-4px_10px_#1a1f2e]'
const darkInset =
  'shadow-[inset_5px_5px_12px_#07080c,inset_-5px_-5px_12px_#1a1f2e] focus-within:shadow-[inset_6px_6px_14px_#05060a,inset_-6px_-6px_14px_#22283a]'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
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
  const [username, setUsername] = useState('reza')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState(() => searchParams.get('error') || '')
  const [info] = useState(() => (location.state as { info?: string } | null)?.info || '')

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthMe,
    retry: false,
    staleTime: 30_000,
  })

  const loginMutation = useMutation({
    mutationFn: () => login(username.trim(), password),
    onSuccess: async (me) => {
      if (remember) {
        try {
          localStorage.setItem('taskos_login_user', username.trim())
        } catch {
          /* ignore */
        }
      }
      queryClient.clear()
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      if (me.mustChangePassword) {
        navigate('/set-password', { replace: true })
        return
      }
      const from = (location.state as { from?: string } | null)?.from || '/'
      navigate(from === '/set-password' ? '/' : from, { replace: true })
    },
    onError: (err: Error) => setError(err.message || 'ورود ناموفق بود'),
  })

  if (meQuery.data?.authenticated) {
    if (meQuery.data.mustChangePassword) {
      return <Navigate to="/set-password" replace />
    }
    return <Navigate to="/" replace />
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('نام کاربری و رمز را وارد کن')
      return
    }
    loginMutation.mutate()
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${surface}`} dir="rtl">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-80 blur-2xl ${dark ? 'bg-[#1a2030]' : 'bg-[#eef2f9]'}`} />
        <div className={`absolute -bottom-20 -right-16 h-80 w-80 rounded-full opacity-60 blur-2xl ${dark ? 'bg-[#0a0c12]' : 'bg-[#d8dee8]'}`} />
      </div>

      <form onSubmit={onSubmit} className={`relative w-full max-w-[360px] rounded-[24px] ${cardBg} px-7 py-8 ${neuRaised}`}>
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${cardBg} ${neuRaised}`}>
            <Lock className="h-6 w-6 text-amber-500" strokeWidth={2.2} />
          </div>
          <h1 className={`text-xl font-bold tracking-tight ${dark ? 'text-slate-100' : 'text-slate-700'}`}>خوش آمدید</h1>
          <p className={`mt-1 text-sm ${muted}`}>برای ادامه کار در TaskOS وارد شو</p>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className={`text-xs font-semibold ${label}`}>نام کاربری</span>
            <div className={`rounded-xl ${cardBg} px-3.5 py-2.5 ${neuInset}`}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className={`w-full bg-transparent text-sm focus:outline-none ${inputText}`}
                placeholder="نام کاربری"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className={`text-xs font-semibold ${label}`}>رمز عبور</span>
            <div className={`flex items-center gap-2 rounded-xl ${cardBg} px-3.5 py-2.5 ${neuInset}`}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={`min-w-0 flex-1 bg-transparent text-sm focus:outline-none ${inputText}`}
                placeholder="رمز عبور"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`shrink-0 rounded-lg p-1 ${dark ? 'text-amber-300/80 hover:text-amber-200' : 'text-amber-700/80 hover:text-amber-800'}`}
                aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className={`flex items-center justify-between text-xs ${muted}`}>
            <Link
              to="/forgot-password"
              className={dark ? 'text-amber-300/90 hover:text-amber-200' : 'text-sky-600 hover:text-sky-700'}
            >
              رمز را فراموش کردم
            </Link>
            <label className="flex cursor-pointer items-center gap-2">
              <span className={`inline-flex h-4 w-4 items-center justify-center rounded-md ${cardBg} ${neuInset}`}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3 w-3 accent-amber-500"
                />
              </span>
              مرا به خاطر بسپار
            </label>
          </div>

          {error ? <p className="text-center text-xs text-rose-500">{error}</p> : null}
          {info ? <p className="text-center text-xs text-emerald-500">{info}</p> : null}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className={`w-full rounded-xl ${cardBg} py-3 text-sm font-bold tracking-wide transition disabled:opacity-60 ${dark ? 'text-amber-300' : 'text-sky-600'} ${neuRaised}`}
          >
            {loginMutation.isPending ? 'در حال ورود…' : 'ورود'}
          </button>
        </div>

        <p className={`mt-5 text-center text-[11px] ${muted}`}>TaskOS · ورود اختصاصی کاربر</p>
      </form>
    </div>
  )
}
