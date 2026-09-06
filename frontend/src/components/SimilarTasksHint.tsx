import { Link } from 'react-router-dom'
import type { SimilarTask } from '../types'

export function SimilarTasksHint({ matches }: { matches: SimilarTask[] }) {
  if (matches.length === 0) return null
  const top = matches[0]

  return (
    <div className="rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm">
      <p>
        این شبیه کاریه که قبلاً انجام دادی: <strong>{top.title}</strong>. می‌خوای Timeline‌ش رو ببینی؟
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {matches.map((match) => (
          <Link
            key={match.id}
            to={`/tasks/${match.id}`}
            className="rounded-full bg-ink-800 px-3 py-1 text-xs hover:bg-ink-700"
          >
            {match.title} · {Math.round(match.similarity * 100)}%
          </Link>
        ))}
      </div>
    </div>
  )
}
