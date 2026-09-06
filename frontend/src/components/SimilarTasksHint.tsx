import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import type { SimilarTask } from '../types'

export function SimilarTasksHint({ matches }: { matches: SimilarTask[] }) {
  if (!matches || matches.length === 0) return null
  const top = matches[0]

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-200">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <p>
          این مورد شبیه به کاری است که قبلاً انجام دادی: <strong className="text-white font-semibold">{top.title}</strong>. می‌خواهی سابقه و راه‌حل آن را ببینی؟
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {matches.map((match) => (
          <Link
            key={match.id}
            to={`/tasks/${match.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a2030] hover:bg-[#232b40] border border-slate-700/60 px-3 py-1 text-xs text-slate-200 transition-colors"
          >
            <span>{match.title}</span>
            <span className="text-[10px] text-amber-400 font-mono">
              {Math.round(match.similarity * 100)}% شباهت
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
