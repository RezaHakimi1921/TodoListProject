import { api } from './client'

export type UserRole = 'Admin' | 'User'

export interface AppUser {
  id: number
  username: string
  firstName: string
  lastName: string
  email?: string | null
  ntfyTopic?: string | null
  role: UserRole
  createdAt: string
  hasGoogle?: boolean
}

export interface CreateUserInput {
  firstName: string
  lastName: string
  username: string
  password: string
  email?: string
  ntfyTopic?: string
  role?: UserRole
}

export interface UpdateUserInput {
  firstName?: string
  lastName?: string
  username?: string
  email?: string
  ntfyTopic?: string
  password?: string
  role?: UserRole
}

function asRole(value: unknown): UserRole {
  return String(value ?? '').toLowerCase() === 'admin' ? 'Admin' : 'User'
}

function camelUser(row: Record<string, unknown>): AppUser {
  return {
    id: Number(row.id ?? row.Id ?? 0),
    username: String(row.username ?? row.Username ?? ''),
    firstName: String(row.firstName ?? row.FirstName ?? ''),
    lastName: String(row.lastName ?? row.LastName ?? ''),
    email: (row.email as string | null | undefined) ?? (row.Email as string | null | undefined) ?? null,
    ntfyTopic: (row.ntfyTopic as string | null | undefined) ?? (row.NtfyTopic as string | null | undefined) ?? null,
    role: asRole(row.role ?? row.Role),
    createdAt: String(row.createdAt ?? row.CreatedAt ?? ''),
    hasGoogle: Boolean(row.hasGoogle ?? row.HasGoogle),
  }
}

export function listUsers() {
  return api.get<Record<string, unknown>[]>('/api/users').then((rows) => rows.map(camelUser))
}

export function createUser(input: CreateUserInput) {
  return api.post<Record<string, unknown>>('/api/users', input).then(camelUser)
}

export function updateUser(id: number, input: UpdateUserInput) {
  return api.put<Record<string, unknown>>(`/api/users/${id}`, input).then(camelUser)
}

export function deleteUser(id: number) {
  return api.delete(`/api/users/${id}`)
}
