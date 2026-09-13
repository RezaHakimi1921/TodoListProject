import { useEffect, useState, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Zap, Feather, Tag, CornerDownLeft, Play, ExternalLink, Ticket } from 'lucide-react'
import { createTask, getSimilarTasks, listTasks } from '../api/tasks'
import { createJiraTask, getJiraCreateMeta, isJiraMe } from '../api/jira'
import { requestTaskFocus } from '../lib/focusSwitch'
import { SimilarTasksHint } from './SimilarTasksHint'
import type { EnergyType } from '../types'
import { taskJiraKey, taskJiraUrl } from '../lib/jira'

const PRESET_TAGS = ['کدنویسی', 'جلسه', 'باگ', 'بازبینی', 'مستندات', 'فوری']

export function QuickAddTask() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [energyType, setEnergyType] = useState<EnergyType>('Deep')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [createInJira, setCreateInJira] = useState(false)
  const [issueTypeId, setIssueTypeId] = useState('')
  const [componentId, setComponentId] = useState('')
  const [assigneeName, setAssigneeName] = useState('reza')
  const [error, setError] = useState('')

  const metaQuery = useQuery({
    queryKey: ['jira-create-meta', 'SIP'],
    queryFn: () => getJiraCreateMeta('SIP'),
    enabled: createInJira,
  })

  const meta = metaQuery.data
  const issueTypes = meta?.issueTypes ?? []
  const components = meta?.components ?? []
  const assignees = meta?.assignees ?? []

  useEffect(() => {
    if (!meta) return
    if (!issueTypeId && meta.issueTypes.length > 0) {
      const preferred =
        meta.issueTypes.find((row) => row.name.toLowerCase() === 'task') ?? meta.issueTypes[0]
      setIssueTypeId(preferred.id)
    }
    if (!componentId && meta.components.length === 1) {
      setComponentId(meta.components[0].id)
    }
    if (meta.assignees.length > 0 && !meta.assignees.some((row) => row.name === assigneeName)) {
      const me = meta.assignees.find((row) => isJiraMe(row))
      setAssigneeName(me?.name ?? meta.assignees[0].name)
    }
  }, [meta, issueTypeId, componentId, assigneeName])

  const similarQuery = useQuery({
    queryKey: ['similarTasks', title],
    queryFn: () => getSimilarTasks(title),
    enabled: title.trim().length >= 4,
  })

  const existingQuery = useQuery({
    queryKey: ['tasks', 'quick-add', title],
    queryFn: () => listTasks({ q: title.trim() }),
    enabled: title.trim().length >= 2 && !createInJira,
  })

  const existing = (existingQuery.data ?? [])
    .filter((task) => task.status !== 'Done')
    .slice(0, 6)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setTags([])
    setError('')
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['task-days'] })
  }

  const selectedAssignee = assignees.find((row) => row.name === assigneeName)
  const ownership = isJiraMe(selectedAssignee ?? { name: assigneeName }) ? 'Mine' : 'Other'

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({
        title: title.trim(),
        energyType,
        tags: tags.join(','),
      }),
    onSuccess: resetForm,
    onError: (err: Error) => setError(err.message),
  })

  const jiraMutation = useMutation({
    mutationFn: () =>
      createJiraTask({
        title: title.trim(),
        projectKey: 'SIP',
        energyType,
        ownership,
        description: description.trim() || undefined,
        issueTypeId: issueTypeId || undefined,
        componentId: componentId || undefined,
        assigneeName,
      }),
    onSuccess: resetForm,
    onError: (err: Error) => setError(err.message),
  })

  const startMutation = useMutation({
    mutationFn: (task: (typeof existing)[number]) => requestTaskFocus(task),
    onSuccess: () => {
      setTitle('')
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['focus'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const busy = createMutation.isPending || jiraMutation.isPending
  const canSubmitJira = Boolean(title.trim() && (components.length === 0 || componentId))

  const handleSubmit = () => {
    if (!title.trim()) return
    if (createInJira) {
      if (!canSubmitJira) {
        setError('کامپوننت را انتخاب کن')
        return
      }
      jiraMutation.mutate()
      return
    }
    createMutation.mutate()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!createInJira) handleSubmit()
    }
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleAddCustomTag = () => {
    const val = customTag.trim()
    if (val && !tags.includes(val)) {
      setTags((prev) => [...prev, val])
      setCustomTag('')
    }
  }

  const fieldClass =
    'w-full rounded-xl bg-black/25 border border-white/[0.06] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-white/25 focus:bg-black/40 focus:outline-none'

  return (
    <div id="quick-add-task-container" className="rounded-2xl border border-white/[0.08] bg-[#10131b] p-4 sm:p-5 shadow-lg shadow-black/20 transition-all duration-200 focus-within:border-white/20 focus-within:bg-[#12151e]">
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative flex-1">
            <input
              id="quick-add-task-input"
              type="text"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={createInJira ? 'عنوان تیکت SIP' : 'اکنون چه کاری باید به سرانجام برسد؟ عنوان یا کلید جیرا مثل PS-2856'}
              className="w-full rounded-xl bg-black/25 border border-white/[0.06] px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-white/25 focus:bg-black/40 focus:outline-none"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-mono">
              <CornerDownLeft className="w-3 h-3 opacity-60" /> Enter
            </span>
          </div>

          <button
            id="quick-add-task-submit-btn"
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || busy || (createInJira && !canSubmitJira)}
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{createInJira ? 'افزودن در جیرا' : 'افزودن'}</span>
          </button>
        </div>

        {createInJira ? (
          <div className="grid gap-2.5 rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-3">
            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">توضیح</span>
              <textarea
                id="quick-add-jira-description"
                dir="rtl"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیح تیکت در جیرا"
                className={`${fieldClass} resize-y min-h-[72px]`}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className="block space-y-1">
                <span className="text-[11px] text-slate-400">نوع</span>
                <select
                  id="quick-add-jira-type"
                  dir="rtl"
                  value={issueTypeId}
                  onChange={(e) => setIssueTypeId(e.target.value)}
                  className={fieldClass}
                >
                  {issueTypes.length === 0 ? <option value="">در حال خواندن...</option> : null}
                  {issueTypes.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] text-slate-400">کامپوننت</span>
                <select
                  id="quick-add-jira-component"
                  dir="rtl"
                  value={componentId}
                  onChange={(e) => setComponentId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">{components.length === 0 ? 'بدون کامپوننت' : 'انتخاب کامپوننت'}</option>
                  {components.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] text-slate-400">مسئول</span>
                <select
                  id="quick-add-jira-assignee"
                  dir="rtl"
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className={fieldClass}
                >
                  {assignees.length === 0 ? <option value="reza">Reza Hakimi</option> : null}
                  {assignees.map((row) => (
                    <option key={row.name} value={row.name}>
                      {row.displayName || row.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-[11px] text-slate-500">
              اگر مسئول خودت باشی در TaskOS «من» می‌شود؛ اگر به کس دیگری وصل کنی «دیگری».
            </p>
          </div>
        ) : null}

        {existing.length > 0 && !createInJira ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2 space-y-1">
            <p className="px-1 text-[10px] text-slate-500">تسک‌های موجود — از جمله تیکت جیرا. بزن تا کار فعلی شود.</p>
            {existing.map((task) => {
              const jiraUrl = taskJiraUrl(task)
              const jiraKey = taskJiraKey(task)
              return (
                <div key={task.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => startMutation.mutate(task)}
                    disabled={startMutation.isPending}
                    className="flex-1 text-right text-xs text-slate-200 hover:text-white"
                  >
                    {task.title}
                    {jiraKey ? <span className="ms-2 text-[10px] text-sky-300 font-mono">{jiraKey}</span> : null}
                  </button>
                  {jiraUrl ? (
                    <a href={jiraUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-white" title="باز کردن در جیرا">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startMutation.mutate(task)}
                    disabled={startMutation.isPending}
                    className="rounded-lg p-1 text-amber-300 hover:bg-amber-400/10"
                    title="شروع این کار"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/30 border border-white/[0.06]">
              <button
                id="btn-energy-deep"
                type="button"
                onClick={() => setEnergyType('Deep')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  energyType === 'Deep'
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>تمرکز عمیق</span>
              </button>
              <button
                id="btn-energy-light"
                type="button"
                onClick={() => setEnergyType('Light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  energyType === 'Light'
                    ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Feather className="w-3.5 h-3.5 text-emerald-400" />
                <span>کار سبک و سریع</span>
              </button>
            </div>

            <button
              id="btn-create-in-jira"
              type="button"
              onClick={() => setCreateInJira((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                createInJira
                  ? 'bg-sky-400/15 text-sky-300 border border-sky-400/30'
                  : 'bg-black/30 border border-white/[0.06] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>ثبت در جیرا</span>
              <span className="font-mono text-[10px] opacity-80">SIP</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 text-[11px] ml-1 flex items-center gap-1">
              <Tag className="w-3 h-3 opacity-60" /> برچسب:
            </span>
            {PRESET_TAGS.map((tag) => {
              const selected = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all ${
                    selected
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/10'
                  }`}
                >
                  {tag}
                </button>
              )
            })}

            {showTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCustomTag()
                    }
                  }}
                  placeholder="برچسب..."
                  className="w-20 rounded-md bg-black/40 border border-white/10 px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-white/30"
                />
                <button type="button" onClick={handleAddCustomTag} className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 text-[11px] hover:bg-white/20">
                  ثبت
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowTagInput(true)} className="text-[11px] text-slate-500 hover:text-slate-300 px-1 py-0.5">
                + برچسب
              </button>
            )}
          </div>
        </div>

        {similarQuery.data && similarQuery.data.length > 0 && (
          <div className="mt-1">
            <SimilarTasksHint matches={similarQuery.data} />
          </div>
        )}

        {metaQuery.isError ? <p className="text-xs text-rose-400 font-medium">فیلدهای جیرا خوانده نشد</p> : null}
        {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    </div>
  )
}
