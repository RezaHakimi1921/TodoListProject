import type { TaskItem } from '../types'

const KEY = /[A-Z][A-Z0-9]+-\d+/i

export function taskJiraKey(task: Pick<TaskItem, 'title' | 'jiraKey'>): string | null {
  if (task.jiraKey) return task.jiraKey
  const match = task.title.match(KEY)
  return match ? match[0].toUpperCase() : null
}

export function taskJiraUrl(task: Pick<TaskItem, 'title' | 'jiraKey' | 'jiraUrl'>): string | null {
  if (task.jiraUrl) return task.jiraUrl
  const key = taskJiraKey(task)
  return key ? `https://jira.smartx.ir/browse/${key}` : null
}

/** Plain-text fallback (legacy callers). */
export function jiraWikiToText(raw?: string | null) {
  if (!raw) return ''
  return toCommentMarkdown(raw)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fenceBareSql(chunk: string) {
  const fence = String.fromCharCode(96, 96, 96)
  return chunk.replace(
    /(^|\n)((?:[ \t]*(?:SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|EXEC|DECLARE|FROM|WHERE|JOIN)\b[^\n]*\n?){2,})/gi,
    (_m, lead: string, block: string) => {
      const body = block.replace(/^\n+|\n+$/g, '')
      if (body.includes(fence)) return lead + block
      return lead + fence + 'sql\n' + body + '\n' + fence + '\n'
    },
  )
}
/**
 * Normalize Jira wiki / Markdown comment bodies so react-markdown can render them.
 * Khadang and others often post real Markdown; Jira comments may still use wiki markup.
 */
export function toCommentMarkdown(raw?: string | null) {
  if (!raw) return ''
  let s = String(raw).replace(/\r\n/g, '\n')

  // Jira image / attachment markers
  s = s.replace(/!([^!\n]+)!/g, '*📎 تصویر*')

  // Jira links: [label|url] → [label](url)
  s = s.replace(/\[([^\]|\n]+)\|([^\]\n]+)\]/g, '[$1]($2)')

  // Bare [url] that is already a URL
  s = s.replace(/\[(https?:\/\/[^\]\n]+)\]/g, '[$1]($1)')

  // Jira headings: h1. Title → # Title
  s = s.replace(/^[hH]([1-6])\.\s+/gm, (_, n: string) => `${'#'.repeat(Number(n))} `)

  // Jira color tags
  s = s.replace(/\{color:[^}]*\}/gi, '').replace(/\{color\}/gi, '')

  // Jira code blocks
  s = s.replace(/\{code(?::([^}]*))?\}([\s\S]*?)\{code\}/gi, (_m, lang: string | undefined, body: string) => {
    const language = (lang ?? '').trim()
    return `\`\`\`${language}\n${body.replace(/^\n+|\n+$/g, '')}\n\`\`\``
  })

  // Jira noformat → fenced code
  s = s.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_m, body: string) => {
    return `\`\`\`\n${body.replace(/^\n+|\n+$/g, '')}\n\`\`\``
  })

  // Jira monospace {{code}}
  s = s.replace(/\{\{([^{}\n]+)\}\}/g, '`$1`')

  // Fence bare SQL dumps only outside existing ``` blocks
  {
    const parts: string[] = []
    const re = /```[\s\S]*?```/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      parts.push(fenceBareSql(s.slice(last, m.index)))
      parts.push(m[0])
      last = m.index + m[0].length
    }
    parts.push(fenceBareSql(s.slice(last)))
    s = parts.join('')
  }

  const looksMarkdown =
    /(^#{1,6}\s)|(```)|(^\s*[-*]\s+\S)|(^\s*\d+\.\s+\S)|(\*\*[^*]+\*\*)|(\[.+\]\(.+\))/m.test(s)

  if (!looksMarkdown) {
    // Jira *bold* / _italic_ (avoid double-wrapping existing MD)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?![*])/g, '$1**$2**')
    s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1*$2*')
  }

  return s.replace(/\n{3,}/g, '\n\n').trim()
}
