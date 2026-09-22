import { FormEvent, useState, useSyncExternalStore } from 'react'
import { KeyRound } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { forgotPassword, getAuthMe, resetPasswordWithTemp } from '../api/auth'
import { getTheme, subscribeTheme } from '../lib/theme'

const lightRaised =
  'shadow-[6px_6px_14px_#bec3cf,-6px_-6px_14px_#ffffff] hover:shadow-[4px_4px_10px_#bec3cf,-4px_-4px_10px_#ffffff] active:shadow-[inset_4px_4px_10px_#bec3cf,inset_-4px_-4px_10px_#ffffff]'
const lightInset =
  'shadow-[inset_5px_5px_12px_#bec3cf,inset_-5px_-5px_12px_#ffffff] focus-within:shadow-[inset_6px_6px_14px_#b0b6c4,inset_-6px_-6px_14px_#ffffff]'
const darkRaised =
  'shadow-[6px_6px_14px_#07080c,-6px_-6px_14px_#1a1f2e] hover:shadow-[4px_4px_10px_#07080c,-4px_-4px_10px_#1a1f2e] active:shadow-[inset_4px_4px_10px_#07080c,inset_-4px_-4px_10px_#1a1f2e]'
const darkInset =
  'shadow-[inset_5px_5px_12px_#07080c,inset_-5px_-5px_12px_#1a1f2e] focus-within:shadow-[inset_6px_6px_14px_#05060a,inset_-6px_-6px_14px_#22283a]'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light' as const)
  const dark = theme === 'dark'
  const neuRaised = dark ? darkRaised : lightRaised
  const neuInset = dark ? darkInset : lightInset
  const surface = dark ? 'bg-[#121722] text-slate-200' : 'bg-[#e4ebf5] text-slate-700'
  const cardBg = dark ? 'bg-[#121722]' : 'bg-[#e4ebf5]'
  const label = dark ? 'text-amber-300/90' : 'text-sky-600'
  const muted = dark ? 'text-slate-400' : 'text-slate-500'
  const inputText = dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'

  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [tempCode, setTempCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthMe,
    retry: false,
    staleTime: 30_000,
  })

  const sendMutation = useMutation({
    mutationFn: () => forgotPassword(email.trim()),
    onSuccess: (res) => {
      setError('')
      setInfo(res.message || 'کد موقت به ntfy گوشی‌ات ارسال شد. کد را از نوتیف بخوان و اینجا وارد کن.')
      setStep('reset')
      setTempCode('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err: Error) => {
      setInfo('')
      setError(err.message || 'ارسال ناموفق بود')
    },
  })

  const resetMutation = useMutation({
    mutationFn: () =>
      resetPasswordWithTemp({
        email: email.trim(),
        tempPassword: tempCode.trim(),
        newPassword,
      }),
    onSuccess: (res) => {
      navigate('/login', {
        replace: true,
        state: { info: res.message || 'رمز جدید ذخیره شد. با رمز جدید وارد شو.' },
      })
    },
    onError: (err: Error) => setError(err.message || 'ثبت رمز ناموفق بود'),
  })

  if (meQuery.data?.authenticated && !meQuery.data.mustChangePassword) {
    return <Navigate to="/" replace />
  }

  const onSend = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setInfo('')
    const value = email.trim()
    if (!value) {
      setError('ایمیل را وارد کن')
      return
    }
    if (!isValidEmail(value)) {
      setError('فقط یک ایمیل معتبر وارد کن')
      return
    }
    sendMutation.mutate()
  }

  const onReset = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!/^\d{4,8}$/.test(tempCode.trim())) {
      setError('کد موقت باید عدد باشد (از نوتیف)')
      return
    }
    if (newPassword.length < 4) {
      setError('رمز جدید حداقل ۴ کاراکتر باشد')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('تکرار رمز با رمز جدید یکی نیست')
      return
    }
    resetMutation.mutate()
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${surface}`} dir="rtl">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-80 blur-2xl ${dark ? 'bg-[#1a2030]' : 'bg-[#eef2f9]'}`} />
        <div className={`absolute -bottom-20 -right-16 h-80 w-80 rounded-full opacity-60 blur-2xl ${dark ? 'bg-[#0a0c12]' : 'bg-[#d8dee8]'}`} />
      </div>

      <form
        onSubmit={step === 'email' ? onSend : onReset}
        className={`relative w-full max-w-[360px] rounded-[24px] ${cardBg} px-7 py-8 ${neuRaised}`}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${cardBg} ${neuRaised}`}>
            <KeyRound className="h-6 w-6 text-amber-500" strokeWidth={2.2} />
          </div>
          <h1 className={`text-xl font-bold tracking-tight ${dark ? 'text-slate-100' : 'text-slate-700'}`}>
            {step === 'email' ? 'بازیابی رمز عبور' : 'کد موقت و رمز جدید'}
          </h1>
          <p className={`mt-1 text-sm ${muted}`}>
            {step === 'email'
              ? 'ایمیل پروفایل را وارد کن. کد موقت فقط به ntfy همان کاربر می‌رود.'
              : `کد را از نوتیف بخوان، اینجا وارد کن و رمز جدید بگذار (${email}).`}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {step === 'email' ? (
            <label className="block space-y-1.5">
              <span className={`text-xs font-semibold ${label}`}>ایمیل</span>
              <div className={`rounded-xl ${cardBg} px-3.5 py-2.5 ${neuInset}`}>
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={`w-full bg-transparent text-sm focus:outline-none ${inputText}`}
                  placeholder="you@gmail.com"
                />
              </div>
            </label>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className={`text-xs font-semibold ${label}`}>کد موقت (فقط عدد)</span>
                <div className={`rounded-xl ${cardBg} px-3.5 py-2.5 ${neuInset}`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={tempCode}
                    onChange={(e) => setTempCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className={`w-full bg-transparent text-sm tracking-[0.2em] focus:outline-none ${inputText}`}
                    placeholder="مثلاً 482901"
                  />
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className={`text-xs font-semibold ${label}`}>رمز جدید</span>
                <div className={`rounded-xl ${cardBg} px-3.5 py-2.5 ${neuInset}`}>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={`w-full bg-transparent text-sm focus:outline-none ${inputText}`}
                  />
                </div>
              </label>
            </>
          )}

          {error ? <p className="text-center text-xs text-rose-500">{error}</p> : null}
          {info ? <p className="text-center text-xs text-emerald-500">{info}</p> : null}

          <button
            type="submit"
            disabled={sendMutation.isPending || resetMutation.isPending}
            className={`w-full rounded-xl ${cardBg} py-3 text-sm font-bold tracking-wide transition disabled:opacity-60 ${dark ? 'text-amber-300' : 'text-sky-600'} ${neuRaised}`}
          >
            {step === 'email'
              ? sendMutation.isPending
                ? 'در حال ارسال…'
                : 'ارسال کد موقت'
              : resetMutation.isPending
                ? 'در حال ذخیره…'
                : 'ثبت رمز جدید'}
          </button>

          {step === 'reset' ? (
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setError('')
                setInfo('')
              }}
              className={`block w-full text-center text-xs ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500'}`}
            >
              ارسال دوباره کد / تغییر ایمیل
            </button>
          ) : null}

          <Link
            to="/login"
            className={`block text-center text-xs ${dark ? 'text-amber-300/90 hover:text-amber-200' : 'text-sky-600 hover:text-sky-700'}`}
          >
            بازگشت به ورود
          </Link>
        </div>
      </form>
    </div>
  )
}
