import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAuthMe } from '../api/auth'

export function RequireAuth() {
  const location = useLocation()
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthMe,
    retry: false,
    staleTime: 15_000,
  })

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f14] text-slate-400 flex items-center justify-center text-sm" dir="rtl">
        در حال بررسی ورود…
      </div>
    )
  }

  if (!meQuery.data?.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  const onSetPassword = location.pathname === '/set-password'
  if (meQuery.data.mustChangePassword && !onSetPassword) {
    return <Navigate to="/set-password" replace />
  }
  if (!meQuery.data.mustChangePassword && onSetPassword) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
