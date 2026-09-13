export const API_HOME = 'http://127.0.0.1:5088'
export const PROBLEM_API_HOME = 'http://127.0.0.1:5098'

export function openSystemApi(url = API_HOME) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
