import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toCommentMarkdown } from '../lib/jira'

interface Props {
  text: string
  className?: string
  /** Compact preview (notifications list) */
  compact?: boolean
}

function codeText(children: ReactNode) {
  return String(children ?? '').replace(/\n$/, '')
}

function looksLikeCodeLine(text: string) {
  const t = text.trim()
  if (t.length < 8) return false
  if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|FROM|WHERE|JOIN|CREATE|ALTER|EXEC|DECLARE)\b/i.test(t)) return true
  if (/[A-Za-z_]/.test(t) && /[=.\/<>:;{}()]/.test(t)) return true
  return false
}

function CodeBlock({ lang, text }: { lang?: string; text: string }) {
  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-amber-400/25 bg-[#080a10] text-start" dir="ltr">
      <div className="flex items-center justify-between gap-2 border-b border-amber-400/15 bg-amber-400/[0.07] px-2 py-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-200/90">{lang || 'code'}</span>
      </div>
      <pre className="m-0 overflow-x-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed text-amber-100 whitespace-pre">
        <code className="bg-transparent p-0 text-inherit">{text}</code>
      </pre>
    </div>
  )
}

export function MarkdownBody({ text, className = '', compact = false }: Props) {
  const md = toCommentMarkdown(text)
  if (!md) return null

  return (
    <div
      className={
        `markdown-body text-slate-200 break-words [&_p]:my-1 [&_p]:leading-relaxed ` +
        `[&_h1]:text-sm [&_h1]:font-bold [&_h1]:text-slate-100 [&_h1]:mt-2 [&_h1]:mb-1 ` +
        `[&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-slate-100 [&_h2]:mt-2 [&_h2]:mb-1 ` +
        `[&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-slate-100 [&_h3]:mt-1.5 [&_h3]:mb-1 ` +
        `[&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:ps-4 ` +
        `[&_li]:my-0.5 [&_blockquote]:border-s-2 [&_blockquote]:border-teal-500/40 [&_blockquote]:ps-2 [&_blockquote]:text-slate-400 ` +
        `[&_a]:break-all [&_a]:text-sky-300 [&_a]:underline [&_a]:decoration-sky-300/40 ` +
        `[&_strong]:font-bold [&_strong]:text-slate-100 [&_em]:italic ` +
        `[&_hr]:my-2 [&_hr]:border-white/10 [&_table]:my-2 [&_table]:w-full [&_th]:border [&_th]:border-white/10 [&_th]:px-1.5 [&_th]:py-1 [&_td]:border [&_td]:border-white/10 [&_td]:px-1.5 [&_td]:py-1 ` +
        (compact ? 'text-xs line-clamp-6 overflow-hidden ' : 'text-xs ') +
        className
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClass, children }) => {
            const text = codeText(children)
            const lang = /language-([\w-]+)/.exec(codeClass || '')?.[1]
            const multiline = text.includes('\n')
            const asBlock =
              Boolean(lang) ||
              multiline ||
              (!compact && text.length > 36 && looksLikeCodeLine(text))

            if (asBlock) return <CodeBlock lang={lang} text={text} />

            return (
              <code
                dir="ltr"
                className="mx-0.5 inline-block max-w-full rounded-md border border-amber-400/30 bg-black/55 px-1.5 py-0.5 align-baseline font-mono text-[11px] font-medium leading-snug text-amber-100"
              >
                {text}
              </code>
            )
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  )
}