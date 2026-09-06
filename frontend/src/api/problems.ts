import { api } from './client'
import type { Problem } from '../types'

export function listProblems() {
  return api.get<Problem[]>('/api/problems')
}

export function getProblem(id: number) {
  return api.get<Problem>(`/api/problems/${id}`)
}

export function createProblem(title: string) {
  return api.post<Problem>('/api/problems', { title })
}

export function updateProblem(
  id: number,
  input: { title: string; noTimeNote?: string; infiniteTimeNote?: string },
) {
  return api.put<Problem>(`/api/problems/${id}`, input)
}

export function deleteProblem(id: number) {
  return api.delete(`/api/problems/${id}`)
}

export function addOption(id: number, input: { title: string; juniorExplain?: string }) {
  return api.post<Problem>(`/api/problems/${id}/options`, input)
}

export function updateOption(
  id: number,
  optionId: number,
  input: { title: string; juniorExplain?: string },
) {
  return api.put<Problem>(`/api/problems/${id}/options/${optionId}`, input)
}

export function deleteOption(id: number, optionId: number) {
  return api.delete(`/api/problems/${id}/options/${optionId}`).then(() => getProblem(id))
}

export function chooseOption(id: number, optionId: number, premortemSign: string) {
  return api.post<Problem>(`/api/problems/${id}/choose`, { optionId, premortemSign })
}

export function validateProblem(id: number, note?: string) {
  return api.post<Problem>(`/api/problems/${id}/validate`, { note })
}
