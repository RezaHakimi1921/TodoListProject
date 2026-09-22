import { api } from './client'

export interface AuthMe {
  authenticated: boolean
  username?: string | null
  displayName?: string | null
  email?: string | null
  role?: string | null
  isAdmin?: boolean
  mustChangePassword?: boolean
  ntfyTopic?: string | null
}

export interface AuthProviders {
  google: boolean
  passwordReset: boolean
}

export interface AuthSystemConfig {
  mailHost: string
  mailPort: number
  mailUseSsl: boolean
  mailUsername: string
  mailFrom: string
  mailFromName: string
  mailConfigured: boolean
  hasMailPassword: boolean
  googleClientId: string
  googleConfigured: boolean
  hasGoogleClientSecret: boolean
}

export interface UpdateAuthSystemConfigInput {
  mailHost?: string
  mailPort?: number
  mailUseSsl?: boolean
  mailUsername?: string
  mailPassword?: string
  mailFrom?: string
  mailFromName?: string
  googleClientId?: string
  googleClientSecret?: string
}

function camelMe(row: AuthMe): AuthMe {
  return {
    authenticated: Boolean(row.authenticated),
    username: row.username ?? null,
    displayName: row.displayName ?? null,
    email: row.email ?? null,
    role: row.role ?? 'User',
    isAdmin: Boolean(row.isAdmin),
    mustChangePassword: Boolean(row.mustChangePassword),
    ntfyTopic: row.ntfyTopic ?? null,
  }
}

export function getAuthMe() {
  return api.get<AuthMe>('/api/auth/me').then(camelMe)
}

export function getAuthProviders() {
  return api.get<AuthProviders>('/api/auth/providers').then((row) => ({
    google: Boolean(row.google),
    passwordReset: Boolean(row.passwordReset),
  }))
}

export function getAuthSystemConfig() {
  return api.get<Record<string, unknown>>('/api/auth/system-config').then((row) => ({
    mailHost: String(row.mailHost ?? ''),
    mailPort: Number(row.mailPort ?? 587),
    mailUseSsl: row.mailUseSsl !== false,
    mailUsername: String(row.mailUsername ?? ''),
    mailFrom: String(row.mailFrom ?? ''),
    mailFromName: String(row.mailFromName ?? 'TaskOS'),
    mailConfigured: Boolean(row.mailConfigured),
    hasMailPassword: Boolean(row.hasMailPassword),
    googleClientId: String(row.googleClientId ?? ''),
    googleConfigured: Boolean(row.googleConfigured),
    hasGoogleClientSecret: Boolean(row.hasGoogleClientSecret),
  }))
}

export function updateAuthSystemConfig(input: UpdateAuthSystemConfigInput) {
  return api.put<Record<string, unknown>>('/api/auth/system-config', input).then((row) => ({
    mailHost: String(row.mailHost ?? ''),
    mailPort: Number(row.mailPort ?? 587),
    mailUseSsl: row.mailUseSsl !== false,
    mailUsername: String(row.mailUsername ?? ''),
    mailFrom: String(row.mailFrom ?? ''),
    mailFromName: String(row.mailFromName ?? 'TaskOS'),
    mailConfigured: Boolean(row.mailConfigured),
    hasMailPassword: Boolean(row.hasMailPassword),
    googleClientId: String(row.googleClientId ?? ''),
    googleConfigured: Boolean(row.googleConfigured),
    hasGoogleClientSecret: Boolean(row.hasGoogleClientSecret),
  }))
}

export function login(username: string, password: string) {
  return api.post<AuthMe>('/api/auth/login', { username, password }).then(camelMe)
}

export function forgotPassword(email: string) {
  return api.post<{ ok: boolean; message?: string }>('/api/auth/forgot-password', { email })
}

export function resetPasswordWithTemp(input: {
  email: string
  tempPassword: string
  newPassword: string
}) {
  return api.post<{ ok: boolean; message?: string }>('/api/auth/reset-password-with-temp', input)
}

export function changePassword(newPassword: string, currentPassword?: string) {
  return api
    .post<AuthMe>('/api/auth/change-password', {
      newPassword,
      currentPassword: currentPassword || undefined,
    })
    .then(camelMe)
}

export function updateMyNtfyTopic(ntfyTopic?: string | null) {
  return api.put<{ ntfyTopic: string; ntfyUrl: string }>('/api/auth/me/ntfy-topic', {
    ntfyTopic: ntfyTopic ?? '',
  })
}

export function logout() {
  return api.post<{ ok: boolean }>('/api/auth/logout', {})
}
