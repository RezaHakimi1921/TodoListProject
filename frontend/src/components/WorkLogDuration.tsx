interface Props {
  localMinutes: number
  jiraMinutes?: number | null
  edited?: boolean
}

export function WorkLogDuration({ localMinutes, jiraMinutes }: Props) {
  const differs = jiraMinutes != null && jiraMinutes !== localMinutes
  const current = differs ? jiraMinutes : localMinutes
  if (differs) {
    return (
      <span
        className="font-mono font-semibold inline-flex items-center gap-1"
        title={`اول ${localMinutes} دقیقه، بعد ${jiraMinutes} دقیقه، الان ${current} دقیقه`}
      >
        <span className="text-slate-500">{localMinutes}m</span>
        <span className="text-slate-600">→</span>
        <span className="text-amber-300">{jiraMinutes}m</span>
      </span>
    )
  }
  return <span className="font-mono text-amber-300 font-semibold">{current}m</span>
}
