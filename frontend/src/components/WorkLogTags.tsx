import { isAutomaticWorkLog } from '../types'

interface Props {
  source: string
  jiraEdited?: boolean
}

export function WorkLogTags({ source, jiraEdited }: Props) {
  return (
    <span className="inline-flex items-center gap-1">
      {isAutomaticWorkLog(source) && (
        <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-mono">
          auto
        </span>
      )}
      {jiraEdited && (
        <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 text-[10px] font-mono">
          edit
        </span>
      )}
    </span>
  )
}
