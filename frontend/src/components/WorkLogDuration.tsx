interface Props {
  localMinutes: number
  jiraMinutes?: number | null
  edited?: boolean
}

export function WorkLogDuration({ localMinutes, jiraMinutes, edited }: Props) {
  const current = edited && jiraMinutes != null ? jiraMinutes : localMinutes
  if (edited && jiraMinutes != null) {
    return (
      <span
        className="font-mono font-semibold inline-flex items-center gap-1"
        title={`اول ${localMinutes} دقیقه، بعد ${jiraMinutes} دقیقه، الان ${current} دقیقه`}
      >
        <span className="text-slate-500">{localMinutes}m</span>
        <span className="text-slate-600">→</span>
        <span className="text-amber-300">{jiraMinutes}m</span>
        <span className="text-[10px] text-slate-500 font-sans">الان {current}m</span>
      </span>
    )
  }
  return <span className="font-mono text-amber-300 font-semibold">{localMinutes}m</span>
}
