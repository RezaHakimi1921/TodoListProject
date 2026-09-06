import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addOption,
  chooseOption,
  deleteOption,
  deleteProblem,
  getProblem,
  updateOption,
  updateProblem,
  validateProblem,
} from '../api/problems'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { EntityWorkLogs } from '../components/EntityWorkLogs'
import { PROBLEM_STATUS_LABEL, type ProblemOption } from '../types'

export function ProblemStudioPage() {
  const { id } = useParams()
  const problemId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()
  const [title, setTitle] = useState('')
  const [noTime, setNoTime] = useState('')
  const [infinite, setInfinite] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftJunior, setDraftJunior] = useState('')
  const [chooseId, setChooseId] = useState<number | null>(null)
  const [premortem, setPremortem] = useState('')
  const [validateNote, setValidateNote] = useState('')
  const [error, setError] = useState('')

  const query = useQuery({
    queryKey: ['problem', problemId],
    queryFn: () => getProblem(problemId),
    enabled: Number.isFinite(problemId),
  })

  useEffect(() => {
    const problem = query.data
    if (!problem) return
    setTitle(problem.title)
    setNoTime(problem.noTimeNote ?? '')
    setInfinite(problem.infiniteTimeNote ?? '')
  }, [query.data])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['problem', problemId] })
    void queryClient.invalidateQueries({ queryKey: ['problems'] })
    void queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    void queryClient.invalidateQueries({ queryKey: ['trash'] })
  }

  const saveMeta = useMutation({
    mutationFn: () => updateProblem(problemId, { title, noTimeNote: noTime, infiniteTimeNote: infinite }),
    onSuccess: refresh,
    onError: (err: Error) => setError(err.message),
  })

  const addMutation = useMutation({
    mutationFn: () => addOption(problemId, { title: draftTitle.trim(), juniorExplain: draftJunior.trim() }),
    onSuccess: () => {
      setDraftTitle('')
      setDraftJunior('')
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const chooseMutation = useMutation({
    mutationFn: () => chooseOption(problemId, chooseId!, premortem.trim()),
    onSuccess: () => {
      setChooseId(null)
      setPremortem('')
      refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const validateMutation = useMutation({
    mutationFn: () => validateProblem(problemId, validateNote.trim() || undefined),
    onSuccess: refresh,
    onError: (err: Error) => setError(err.message),
  })

  const deleteProblemMutation = useMutation({
    mutationFn: () => deleteProblem(problemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      navigate('/problems')
    },
  })

  if (query.isLoading) return <p className="text-paper/50">در حال بارگذاری...</p>
  if (!query.data) return <p>مسئله پیدا نشد. <Link to="/problems">برگشت</Link></p>

  const problem = query.data
  const filled = problem.options.filter((item) => item.title.trim())
  const needThird = filled.length < 3

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/problems" className="text-sm text-paper/45">
          → همه مسئله‌ها
        </Link>
        <button
          type="button"
          onClick={() => {
            void askTrash('این مسئله').then((ok) => {
              if (ok) deleteProblemMutation.mutate()
            })
          }}
          className="text-sm text-rose-200"
        >
          حذف مسئله
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-ink-800 px-3 py-1 text-xs">{PROBLEM_STATUS_LABEL[problem.status]}</span>
        {problem.blocker && <span className="text-sm text-ember">{problem.blocker}</span>}
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-5">
        <p className="text-xs tracking-[0.2em] text-paper/35">۱ · مسئله</p>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => saveMeta.mutate()}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950 px-4 py-3 text-2xl outline-none"
        />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-5">
        <p className="text-xs tracking-[0.2em] text-paper/35">۲ · برعکس کردن قید</p>
        <p className="mt-1 text-sm text-paper/45">معمولاً یکی از دو گزینهٔ اول همین‌جا حذف می‌شود.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-paper/50">
            اگر فقط یک ساعت وقت داشتی؟
            <textarea
              value={noTime}
              onChange={(event) => setNoTime(event.target.value)}
              onBlur={() => saveMeta.mutate()}
              rows={3}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
          </label>
          <label className="text-sm text-paper/50">
            اگر زمان / دسترسی بی‌نهایت بود؟
            <textarea
              value={infinite}
              onChange={(event) => setInfinite(event.target.value)}
              onBlur={() => saveMeta.mutate()}
              rows={3}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-5">
        <p className="text-xs tracking-[0.2em] text-paper/35">۳ · قانون گزینهٔ سوم</p>
        <p className="mt-1 text-sm text-paper/45">
          سومی معمولاً ترکیب دو تای اول است، یا حذف یک قید. تا سه تا نشود انتخاب قفل است.
        </p>
        <div className="mt-4 space-y-3">
          {problem.options.map((option, index) => (
            <OptionCard
              key={option.id}
              option={option}
              index={index}
              locked={problem.status === 'Validated'}
              canChoose={problem.canChoose && problem.status === 'Exploring'}
              onSave={(next) =>
                updateOption(problemId, option.id, next).then(() => refresh()).catch((err: Error) => setError(err.message))
              }
              onChoose={() => {
                setChooseId(option.id)
                setError('')
              }}
              onDelete={() => {
                void askTrash('این گزینه').then((ok) => {
                  if (!ok) return
                  deleteOption(problemId, option.id).then(() => refresh()).catch((err: Error) => setError(err.message))
                })
              }}
            />
          ))}
        </div>
        {needThird && (
          <p className="mt-3 rounded-2xl bg-ember/10 px-3 py-2 text-sm text-amber-100">
            هنوز {3 - filled.length} گزینه کم است. سومی را بنویس: ترکیب، یا حذف محدودیت.
          </p>
        )}
        {problem.status === 'Exploring' && (
          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={`گزینه ${problem.options.length + 1}`}
              className="rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
            <input
              value={draftJunior}
              onChange={(event) => setDraftJunior(event.target.value)}
              placeholder="در یک جمله برای جونیور"
              className="rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
            <button
              type="button"
              onClick={() => draftTitle.trim() && addMutation.mutate()}
              className="rounded-2xl bg-paper px-4 py-2 text-sm font-semibold text-ink-950"
            >
              افزودن
            </button>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-ink-900/60 p-5">
        <p className="text-xs tracking-[0.2em] text-paper/35">۴ و ۵ · کشف جدا از تعهد</p>
        <p className="mt-1 text-sm text-paper/45">
          انتخاب یعنی فرض. تعهد فقط وقتی است که بنویسی تست کردم / جواب داد.
        </p>
        {problem.premortemSign && (
          <p className="mt-3 rounded-2xl bg-ink-800 px-3 py-2 text-sm">نشانهٔ شکست: {problem.premortemSign}</p>
        )}
        {problem.status === 'Chosen' && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={validateNote}
              onChange={(event) => setValidateNote(event.target.value)}
              placeholder="تست کردم، جواب داد"
              className="flex-1 rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
            <button
              type="button"
              onClick={() => validateMutation.mutate()}
              className="rounded-2xl bg-moss px-4 py-2 text-sm font-semibold text-white"
            >
              تعهد: تست شد
            </button>
          </div>
        )}
        {problem.status === 'Validated' && <p className="mt-3 text-sm text-emerald-200">این دیگر فرض نیست؛ تست شده.</p>}
      </section>

      <EntityWorkLogs title={problem.title} problemId={problem.id} />

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {chooseId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-5">
            <p className="text-xs tracking-[0.2em] text-ember">پیش‌مرگ ۱۰ دقیقه‌ای</p>
            <h2 className="mt-2 text-xl font-semibold">اگر هفته بعد این انتخاب ترکید، اولین نشانه چه بود؟</h2>
            <p className="mt-2 text-sm text-paper/50">اگر همان نشانه را همین حالا می‌بینی، این گزینه را انتخاب نکن.</p>
            <textarea
              value={premortem}
              onChange={(event) => setPremortem(event.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => premortem.trim() && chooseMutation.mutate()}
                className="rounded-2xl bg-ember px-4 py-2 text-sm font-semibold text-ink-950"
              >
                انتخاب به‌عنوان فرض
              </button>
              <button type="button" onClick={() => setChooseId(null)} className="rounded-2xl bg-ink-800 px-4 py-2 text-sm">
                پشیمان شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OptionCard({
  option,
  index,
  locked,
  canChoose,
  onSave,
  onChoose,
  onDelete,
}: {
  option: ProblemOption
  index: number
  locked: boolean
  canChoose: boolean
  onSave: (input: { title: string; juniorExplain?: string }) => void
  onChoose: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(option.title)
  const [junior, setJunior] = useState(option.juniorExplain ?? '')

  useEffect(() => {
    setTitle(option.title)
    setJunior(option.juniorExplain ?? '')
  }, [option.title, option.juniorExplain])

  return (
    <div className={`rounded-3xl bg-ink-800/80 p-4 ${option.isChosen ? 'ring-1 ring-ember/50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-paper/40">گزینه {index + 1}{index === 2 ? ' · سومی' : ''}</p>
        <div className="flex items-center gap-3">
          {option.isChosen && <span className="text-xs text-ember">فرض فعلی</span>}
          {!locked && (
            <button type="button" onClick={onDelete} className="text-xs text-rose-200">
              حذف
            </button>
          )}
        </div>
      </div>
      <input
        value={title}
        disabled={locked}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => onSave({ title, juniorExplain: junior })}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2 disabled:opacity-60"
      />
      <input
        value={junior}
        disabled={locked}
        onChange={(event) => setJunior(event.target.value)}
        onBlur={() => onSave({ title, juniorExplain: junior })}
        placeholder="برای جونیور: این کار یعنی ..."
        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950 px-3 py-2 text-sm disabled:opacity-60"
      />
      {canChoose && (
        <button type="button" onClick={onChoose} className="mt-3 text-sm text-ember">
          این را به‌عنوان فرض انتخاب کن
        </button>
      )}
    </div>
  )
}
