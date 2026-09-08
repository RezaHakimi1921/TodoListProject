import { X } from 'lucide-react'
import { joinTags, splitTags, tagColorClass } from '../lib/tags'

interface EditorProps {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}

export function TagChipsEditor({ value, onChange, placeholder }: EditorProps) {
  const chips = splitTags(value)

  return (
    <div className="space-y-2">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium ${tagColorClass(tag)}`}
            >
              #{tag}
              <button
                type="button"
                onClick={() => onChange(joinTags(chips.filter((item) => item !== tag)))}
                className="opacity-70 hover:opacity-100"
                title="حذف برچسب"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'سعید، محمد، جیرا'}
        className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
      />
    </div>
  )
}

export function TagChipList({ tags }: { tags: string[] }) {
  const chips = splitTags(tags)
  if (chips.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {chips.map((tag) => (
        <span
          key={tag}
          className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-medium ${tagColorClass(tag)}`}
        >
          #{tag}
        </span>
      ))}
    </div>
  )
}
