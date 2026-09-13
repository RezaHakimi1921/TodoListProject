import { api, ApiError } from './client'
import type { Problem, ProblemActionItem, ProblemLink, ProblemStatus, ProblemTaskLink } from '../types'

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}

function pickText(row: Record<string, unknown>, ...keys: string[]) {
  const value = pick(row, ...keys)
  return typeof value === 'string' ? value : value == null ? null : String(value)
}

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
    id: Number(pick(row, 'id', 'Id') ?? 0),
    title: String(pick(row, 'title', 'Title') ?? ''),
    status: asStatus(pick(row, 'status', 'Status')),
    reality: pickText(row, 'reality', 'Reality', 'noTimeNote', 'NoTimeNote'),
    expectedBehavior: pickText(row, 'expectedBehavior', 'ExpectedBehavior'),
    actualBehavior: pickText(row, 'actualBehavior', 'ActualBehavior'),
    rootCause: pickText(row, 'rootCause', 'RootCause'),
    detectionGap: pickText(row, 'detectionGap', 'DetectionGap'),
    affectedPopulation: pickText(row, 'affectedPopulation', 'AffectedPopulation'),
    resolution: pickText(row, 'resolution', 'Resolution'),
    recovery: pickText(row, 'recovery', 'Recovery'),
    validationNote: pickText(row, 'validationNote', 'ValidationNote'),
    prevention: pickText(row, 'prevention', 'Prevention'),
    impactBranches: pickText(row, 'impactBranches', 'ImpactBranches'),
    impactCustomers: pickText(row, 'impactCustomers', 'ImpactCustomers'),
    impactRecords: pickText(row, 'impactRecords', 'ImpactRecords'),
    impactServices: pickText(row, 'impactServices', 'ImpactServices'),
    impactSupport: pickText(row, 'impactSupport', 'ImpactSupport'),
    impactBusiness: pickText(row, 'impactBusiness', 'ImpactBusiness'),
    startedAt: pickText(row, 'startedAt', 'StartedAt'),
    firstAffectedAt: pickText(row, 'firstAffectedAt', 'FirstAffectedAt'),
    detectedAt: pickText(row, 'detectedAt', 'DetectedAt'),
    rootCauseFoundAt: pickText(row, 'rootCauseFoundAt', 'RootCauseFoundAt'),
    fixedAt: pickText(row, 'fixedAt', 'FixedAt'),
    recoveryCompletedAt: pickText(row, 'recoveryCompletedAt', 'RecoveryCompletedAt'),
    costTechnical: pickText(row, 'costTechnical', 'CostTechnical'),
    costOperational: pickText(row, 'costOperational', 'CostOperational'),
    costBusiness: pickText(row, 'costBusiness', 'CostBusiness'),
    costOpportunity: pickText(row, 'costOpportunity', 'CostOpportunity'),
    sectionSavedAt: parseSavedAt(pick(row, 'sectionSavedAt', 'SectionSavedAt')),
    taskCount: Number(pick(row, 'taskCount', 'TaskCount') ?? 0),
    tasks: Array.isArray(pick(row, 'tasks', 'Tasks'))
      ? (pick(row, 'tasks', 'Tasks') as Record<string, unknown>[]).map(camelTask)
      : [],
    actions: Array.isArray(pick(row, 'actions', 'Actions'))
      ? (pick(row, 'actions', 'Actions') as Record<string, unknown>[]).map(camelAction)
      : [],
    createdAt: String(pick(row, 'createdAt', 'CreatedAt') ?? ''),
    updatedAt: String(pick(row, 'updatedAt', 'UpdatedAt') ?? ''),
  }
}

export type ProblemDraft = {
  title: string
  status?: ProblemStatus
  reality?: string
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
      noTimeNote: input.reality,
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
  return api.get<Record<string, unknown>[]>(`/api/problems/by-task/${taskId}`).then((rows) => rows.map(camelLink))
}

export function camelProblemLink(row: Record<string, unknown>): ProblemLink {
  return camelLink(row)
}
