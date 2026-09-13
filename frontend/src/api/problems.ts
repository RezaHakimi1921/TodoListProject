import { api, ApiError } from './client'
import type { Problem, ProblemActionItem, ProblemLink, ProblemStatus, ProblemTaskLink } from '../types'

function parseSavedAt(value: unknown): Record<string, string> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>
  }
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function asStatus(value: unknown): ProblemStatus {
  if (value === 'Monitoring' || value === 'Chosen') return 'Monitoring'
  if (value === 'Resolved' || value === 'Validated') return 'Resolved'
  return 'Open'
}

function camelAction(row: Record<string, unknown>): ProblemActionItem {
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    owner: (row.owner as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? null,
    status: row.status === 'Done' ? 'Done' : 'Open',
  }
}

function camelTask(row: Record<string, unknown>): ProblemTaskLink {
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    status: String(row.status ?? ''),
    jiraKey: (row.jiraKey as string | null) ?? null,
    jiraUrl: (row.jiraUrl as string | null) ?? null,
  }
}

function camelLink(row: Record<string, unknown>): ProblemLink {
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    status: asStatus(row.status),
  }
}

export function camelProblem(row: Record<string, unknown>): Problem {
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    status: asStatus(row.status),
    expectedBehavior: (row.expectedBehavior as string | null) ?? null,
    actualBehavior: (row.actualBehavior as string | null) ?? null,
    rootCause: (row.rootCause as string | null) ?? null,
    detectionGap: (row.detectionGap as string | null) ?? null,
    affectedPopulation: (row.affectedPopulation as string | null) ?? null,
    resolution: (row.resolution as string | null) ?? null,
    recovery: (row.recovery as string | null) ?? null,
    validationNote: (row.validationNote as string | null) ?? null,
    prevention: (row.prevention as string | null) ?? null,
    impactBranches: (row.impactBranches as string | null) ?? null,
    impactCustomers: (row.impactCustomers as string | null) ?? null,
    impactRecords: (row.impactRecords as string | null) ?? null,
    impactServices: (row.impactServices as string | null) ?? null,
    impactSupport: (row.impactSupport as string | null) ?? null,
    impactBusiness: (row.impactBusiness as string | null) ?? null,
    startedAt: (row.startedAt as string | null) ?? null,
    firstAffectedAt: (row.firstAffectedAt as string | null) ?? null,
    detectedAt: (row.detectedAt as string | null) ?? null,
    rootCauseFoundAt: (row.rootCauseFoundAt as string | null) ?? null,
    fixedAt: (row.fixedAt as string | null) ?? null,
    recoveryCompletedAt: (row.recoveryCompletedAt as string | null) ?? null,
    costTechnical: (row.costTechnical as string | null) ?? null,
    costOperational: (row.costOperational as string | null) ?? null,
    costBusiness: (row.costBusiness as string | null) ?? null,
    costOpportunity: (row.costOpportunity as string | null) ?? null,
    sectionSavedAt: parseSavedAt(row.sectionSavedAt),
    taskCount: Number(row.taskCount ?? 0),
    tasks: Array.isArray(row.tasks) ? (row.tasks as Record<string, unknown>[]).map(camelTask) : [],
    actions: Array.isArray(row.actions) ? (row.actions as Record<string, unknown>[]).map(camelAction) : [],
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  }
}

export type ProblemDraft = {
  title: string
  status?: ProblemStatus
  expectedBehavior?: string
  actualBehavior?: string
  rootCause?: string
  detectionGap?: string
  affectedPopulation?: string
  resolution?: string
  recovery?: string
  validationNote?: string
  prevention?: string
  impactBranches?: string
  impactCustomers?: string
  impactRecords?: string
  impactServices?: string
  impactSupport?: string
  impactBusiness?: string
  startedAt?: string
  firstAffectedAt?: string
  detectedAt?: string
  rootCauseFoundAt?: string
  fixedAt?: string
  recoveryCompletedAt?: string
  costTechnical?: string
  costOperational?: string
  costBusiness?: string
  costOpportunity?: string
  sectionSavedAt?: Record<string, string>
  attachTaskIds?: number[]
}

export function listProblems() {
  return api.get<Record<string, unknown>[]>('/api/problems').then((rows) => rows.map(camelProblem))
}

export function getProblem(id: number) {
  return api.get<Record<string, unknown>>(`/api/problems/${id}`).then(camelProblem)
}

export function createProblem(title: string, taskId?: number) {
  return api.post<Record<string, unknown>>('/api/problems', { title, taskId }).then(camelProblem)
}

export function updateProblem(id: number, input: ProblemDraft) {
  return api
    .put<Record<string, unknown>>(`/api/problems/${id}`, {
      ...input,
      sectionSavedAt: input.sectionSavedAt ? JSON.stringify(input.sectionSavedAt) : undefined,
    })
    .then(camelProblem)
}

export function deleteProblem(id: number) {
  return api.delete(`/api/problems/${id}`)
}

export function addProblemAction(
  id: number,
  input: { title: string; owner?: string; deadline?: string; status?: 'Open' | 'Done' },
) {
  return api.post<Record<string, unknown>>(`/api/problems/${id}/actions`, input).then(camelProblem)
}

export function updateProblemAction(
  id: number,
  actionId: number,
  input: { title: string; owner?: string; deadline?: string; status?: 'Open' | 'Done' },
) {
  return api.put<Record<string, unknown>>(`/api/problems/${id}/actions/${actionId}`, input).then(camelProblem)
}

export function deleteProblemAction(id: number, actionId: number) {
  return api.delete(`/api/problems/${id}/actions/${actionId}`).then(() => getProblem(id))
}

export function attachProblemTask(id: number, taskId: number) {
  return attachProblemTasks(id, [taskId])
}

export async function attachProblemTasks(id: number, taskIds: number[]) {
  const current = await getProblem(id)
  try {
    return await api
      .put<Record<string, unknown>>(`/api/problems/${id}`, {
        title: current.title,
        status: current.status,
        expectedBehavior: current.expectedBehavior,
        actualBehavior: current.actualBehavior,
        rootCause: current.rootCause,
        attachTaskIds: taskIds,
      })
      .then(camelProblem)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error
    return api
      .post<Record<string, unknown>>(`/api/problems/${id}/tasks`, { taskIds, taskId: taskIds[0] })
      .then(camelProblem)
  }
}

export function detachProblemTask(id: number, taskId: number) {
  return api.delete(`/api/problems/${id}/tasks/${taskId}`).then(() => getProblem(id))
}

export function listProblemsForTask(taskId: number) {
  return api.get<Record<string, unknown>[]>(`/api/tasks/${taskId}/problems`).then((rows) => rows.map(camelLink))
}

export function camelProblemLink(row: Record<string, unknown>): ProblemLink {
  return camelLink(row)
}
