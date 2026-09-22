import { FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, UserPlus, Users, X } from 'lucide-react'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type AppUser,
  type UserRole,
} from '../api/users'
import { getAuthMe } from '../api/auth'
import { formatPersianDateTime } from '../lib/dates'

const emptyForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  ntfyTopic: '',
  password: '',
  role: 'User' as UserRole,
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: getAuthMe })
  const isAdmin = Boolean(meQuery.data?.isAdmin)
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
    enabled: isAdmin,
  })

  useEffect(() => {
    if (!editing) return
    setEditForm({
      firstName: editing.firstName,
      lastName: editing.lastName,
      username: editing.username,
      email: editing.email || '',
      ntfyTopic: editing.ntfyTopic || '',
      password: '',
      role: editing.role,
    })
  }, [editing])

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
        ntfyTopic: form.ntfyTopic.trim() || undefined,
        role: form.role,
      }),
    onSuccess: async () => {
      setForm(emptyForm)
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: Error) => setError(err.message || 'ثبت کاربر ناموفق بود'),
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('کاربری انتخاب نشده')
      return updateUser(editing.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        ntfyTopic: editForm.ntfyTopic.trim(),
        role: editForm.role,
        password: editForm.password.trim() || undefined,
      })
    },
    onSuccess: async () => {
      setEditing(null)
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
    onError: (err: Error) => setError(err.message || 'ویرایش ناموفق بود'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err: Error) => setError(err.message || 'حذف ناموفق بود'),
  })

  if (meQuery.isLoading) {
    return <p className="text-xs text-slate-400">در حال بارگذاری…</p>
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.password) {
      setError('نام، نام‌خانوادگی، نام کاربری و رمز را پر کن')
      return
    }
    createMutation.mutate()
  }

  const users = usersQuery.data ?? []
  const me = meQuery.data?.username?.toLowerCase()

  const fieldClass =
    'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400/40'

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-2 text-sky-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white sm:text-2xl">مدیریت کاربران</h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              فقط ادمین می‌تواند کاربران را بسازد، ویرایش و حذف کند. کاربران ساده فقط داده‌های خودشان را می‌بینند.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">کاربر جدید</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[11px] text-slate-400">نام</span>
            <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] text-slate-400">نام خانوادگی</span>
            <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] text-slate-400">نام کاربری</span>
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} autoComplete="off" className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] text-slate-400">ایمیل</span>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={fieldClass} placeholder="برای بازیابی رمز" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[11px] text-slate-400">موضوع ntfy اختصاصی (خالی = خودکار)</span>
            <input value={form.ntfyTopic} onChange={(e) => setForm((f) => ({ ...f, ntfyTopic: e.target.value }))} className={fieldClass} placeholder="taskos-username-xxxx" />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] text-slate-400">رمز عبور</span>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] text-slate-400">نقش</span>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))} className={fieldClass}>
              <option value="User">کاربر ساده</option>
              <option value="Admin">ادمین</option>
            </select>
          </label>
        </div>
        {error && !editing ? <p className="text-xs text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {createMutation.isPending ? 'در حال ثبت…' : 'افزودن کاربر'}
        </button>
      </form>

      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-3">
        <h2 className="text-base font-bold text-white">کاربران ({users.length})</h2>
        {usersQuery.isLoading ? (
          <p className="text-xs text-slate-400">در حال بارگذاری…</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-slate-400">هنوز کاربری نیست.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {users.map((user) => {
              const isMe = me === user.username.toLowerCase()
              return (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {user.firstName} {user.lastName}
                      {isMe ? <span className="ms-2 text-[10px] font-medium text-amber-300">(تو)</span> : null}
                      <span
                        className={`ms-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          user.role === 'Admin'
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        {user.role === 'Admin' ? 'ادمین' : 'کاربر ساده'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">@{user.username}</p>
                    {user.email ? <p className="text-[11px] text-sky-300/80">{user.email}</p> : (
                      <p className="text-[11px] text-slate-600">بدون ایمیل</p>
                    )}
                    {user.ntfyTopic ? <p className="text-[10px] font-mono text-violet-300/80">ntfy: {user.ntfyTopic}</p> : (
                      <p className="text-[10px] text-rose-300/70">بدون موضوع ntfy</p>
                    )}
                    {user.createdAt ? (
                      <p className="mt-0.5 text-[10px] text-slate-500">{formatPersianDateTime(user.createdAt)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError('')
                        setEditing(user)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/20"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      disabled={isMe || deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`حذف کاربر «${user.username}»؟`)) deleteMutation.mutate(user.id)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" dir="rtl">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141824] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-white">ویرایش کاربر</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.06]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400">نام</span>
                <input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400">نام خانوادگی</span>
                <input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400">نام کاربری</span>
                <input value={editForm.username} onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400">ایمیل</span>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400">رمز جدید (اختیاری)</span>
                <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} className={fieldClass} placeholder="خالی = بدون تغییر" />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] text-slate-400">نقش</span>
                <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))} className={fieldClass}>
                  <option value="User">کاربر ساده</option>
                  <option value="Admin">ادمین</option>
                </select>
              </label>
            </div>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06]">
                انصراف
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
                className="rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-300 disabled:opacity-60"
              >
                {updateMutation.isPending ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
