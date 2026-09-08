const PALETTE = [
  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'bg-lime-500/15 text-lime-300 border-lime-500/30',
  'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'bg-teal-500/15 text-teal-300 border-teal-500/30',
]

export function splitTags(raw: string | string[] | null | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join('،') : String(raw ?? '')
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of text.split(/[,،]+/)) {
    const tag = part.trim()
    if (!tag || tag === 'focus-paused' || seen.has(tag)) continue
    seen.add(tag)
    result.push(tag)
  }
  return result
}

export function joinTags(tags: string[]) {
  return splitTags(tags).join('، ')
}

export function tagColorClass(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function isJunkWorkTitle(title: string) {
  const value = title.trim()
  if (value.length < 4) return true
  return /^(service management|task|bug|story|epic|sub-task|subtask|incident|change|problem|support request|it help desk|jira)$/i.test(
    value,
  )
}
