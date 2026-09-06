import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowRight, 
  HelpCircle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Lightbulb, 
  AlertTriangle, 
  Sparkles,
  ShieldCheck,
  Zap,
  Clock
} from 'lucide-react'
import { 
  getProblem, 
  addOption, 
  updateProblem, 
  chooseOption, 
  validateProblem, 
  deleteOption, 
  deleteProblem 
} from '../api/problems'
import { EntityWorkLogs } from '../components/EntityWorkLogs'
import { useTrashConfirm } from '../components/ConfirmProvider'
import { SPARK_QUESTIONS, PROBLEM_STATUS_LABEL } from '../types'

export function ProblemStudioPage() {
  const { id } = useParams()
  const problemId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const askTrash = useTrashConfirm()

  const [title, setTitle] = useState('')
  const [noTimeNote, setNoTimeNote] = useState('')
  const [infiniteTimeNote, setInfiniteTimeNote] = useState('')

  // Add option
  const [optTitle, setOptTitle] = useState('')
  const [optJunior, setOptJunior] = useState('')

  // Choosing option modal state
  const [choosingOptId, setChoosingOptId] = useState<number | null>(null)
  const [premortemSign, setPremortemSign] = useState('')

  const problemQuery = useQuery({
    queryKey: ['problem', problemId],
    queryFn: () => getProblem(problemId),
    enabled: Number.isFinite(problemId),
  })

  const problem = problemQuery.data

  useEffect(() => {
    if (!problem) return
    setTitle(problem.title)
    setNoTimeNote(problem.noTimeNote ?? '')
    setInfiniteTimeNote(problem.infiniteTimeNote ?? '')
  }, [problem])

  const updateMutation = useMutation({
    mutationFn: () =>
      updateProblem(problemId, {
        title: title.trim(),
        noTimeNote: noTimeNote.trim() || undefined,
        infiniteTimeNote: infiniteTimeNote.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problem', problemId] })
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
    },
  })

  const addOptMutation = useMutation({
    mutationFn: () =>
      addOption(problemId, {
        title: optTitle.trim(),
        juniorExplain: optJunior.trim() || undefined,
      }),
    onSuccess: () => {
      setOptTitle('')
      setOptJunior('')
      void queryClient.invalidateQueries({ queryKey: ['problem', problemId] })
    },
  })

  const deleteOptMutation = useMutation({
    mutationFn: (optId: number) => deleteOption(problemId, optId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problem', problemId] })
    },
  })

  const chooseMutation = useMutation({
    mutationFn: () => chooseOption(problemId, choosingOptId!, premortemSign.trim()),
    onSuccess: () => {
      setChoosingOptId(null)
      setPremortemSign('')
      void queryClient.invalidateQueries({ queryKey: ['problem', problemId] })
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
    },
  })

  const validateMutation = useMutation({
    mutationFn: () => validateProblem(problemId, 'تست با موفقیت انجام شد.'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problem', problemId] })
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
    },
  })

  const deleteProbMutation = useMutation({
    mutationFn: () => deleteProblem(problemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['problems'] })
      navigate('/problems')
    },
  })

  const handleDeleteProblem = async () => {
    if (!problem) return
    const ok = await askTrash(problem.title)
    if (ok) {
      deleteProbMutation.mutate()
    }
  }

  if (problemQuery.isLoading) {
    return <div className="py-20 text-center text-slate-500 text-xs">در حال بارگذاری استودیو...</div>
  }

  if (!problem) {
    return <div className="py-20 text-center text-rose-400 text-xs">مسئله یافت نشد.</div>
  }

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/problems"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به لیست مسائل</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
            {PROBLEM_STATUS_LABEL[problem.status]}
          </span>
          <button
            type="button"
            onClick={handleDeleteProblem}
            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
            title="حذف مسئله"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Problem Header */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">عنوان مسئله</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => updateMutation.mutate()}
            className="w-full rounded-xl bg-[#0b0e16] border border-[#2b354d] p-3 text-base font-bold text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Extremes: 0 Time vs Infinite Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-[#11141e] border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2">
              <Zap className="w-4 h-4" />
              <span>سناریوی بدون زمان (اگر فقط ۱ ساعت وقت داشتی)</span>
            </div>
            <textarea
              rows={2}
              value={noTimeNote}
              onChange={(e) => setNoTimeNote(e.target.value)}
              onBlur={() => updateMutation.mutate()}
              placeholder="ساده‌ترین، کثیف‌ترین و سریع‌ترین راهکاری که کار را راه می‌اندازد چیست؟..."
              className="w-full rounded-xl bg-[#0a0d14] border border-slate-700/60 p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="p-4 rounded-2xl bg-[#11141e] border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
              <Clock className="w-4 h-4" />
              <span>سناریوی زمان نامحدود (ایده‌آل‌ترین حالت)</span>
            </div>
            <textarea
              rows={2}
              value={infiniteTimeNote}
              onChange={(e) => setInfiniteTimeNote(e.target.value)}
              onBlur={() => updateMutation.mutate()}
              placeholder="اگر ۶ ماه زمان و بودجه نامحدود داشتی، چگونه این چالش را اصولی حل می‌کردی؟..."
              className="w-full rounded-xl bg-[#0a0d14] border border-slate-700/60 p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Spark Questions Panel */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-amber-300">پرسش‌های جرقه‌زن برای شکستن بن‌بست فکری:</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
          {SPARK_QUESTIONS.map((q, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-black/20 border border-amber-500/10 flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span className="leading-relaxed">{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Options Section */}
      <div className="rounded-3xl border border-[#212738] bg-[#141824] p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">گزینه‌ها و راهکارهای احتمالی</h2>
          </div>
          <span className="text-xs text-slate-400">
            برای انتخاب رسمی حداقل ۲ گزینه مختلف ثبت کنید
          </span>
        </div>

        {/* Add Option Form */}
        <div className="p-4 rounded-2xl bg-[#0f121b] border border-[#262f44] space-y-3">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-amber-400" />
            افزودن گزینه جدید
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="عنوان راهکار (مثلاً: استفاده از کش مموری)..."
              value={optTitle}
              onChange={(e) => setOptTitle(e.target.value)}
              className="rounded-xl bg-[#0a0c13] border border-[#2b354d] px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="توضیح به زبان خیلی ساده (Junior Explain)..."
              value={optJunior}
              onChange={(e) => setOptJunior(e.target.value)}
              className="rounded-xl bg-[#0a0c13] border border-[#2b354d] px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!optTitle.trim() || addOptMutation.isPending}
              onClick={() => addOptMutation.mutate()}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              افزودن این راهکار
            </button>
          </div>
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {problem.options.map((opt) => {
            const isThisChosen = opt.id === problem.chosenOptionId

            return (
              <div
                key={opt.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                  isThisChosen
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-lg'
                    : 'border-slate-800 bg-[#11141e]'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {isThisChosen && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                        راهکار منتخب
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-white">{opt.title}</h3>
                  </div>
                  {opt.juniorExplain && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      <strong className="text-amber-400/80 font-medium ml-1">توضیح ساده:</strong>
                      {opt.juniorExplain}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isThisChosen && (
                    <button
                      type="button"
                      onClick={() => setChoosingOptId(opt.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-semibold transition-all border border-slate-700"
                    >
                      انتخاب این راهکار
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteOptMutation.mutate(opt.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="حذف گزینه"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Validation Section if chosen */}
        {problem.status === 'Chosen' && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>راهکار انتخاب شده است. آیا پیاده‌سازی و ارزیابی شد؟</span>
              </div>
              {problem.premortemSign && (
                <p className="text-xs text-emerald-300/80 mt-1">
                  زنگ خطر شکست ثبت‌شده: {problem.premortemSign}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => validateMutation.mutate()}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 whitespace-nowrap"
            >
              تأیید و خاتمه مسئله (Validate)
            </button>
          </div>
        )}
      </div>

      {/* Entity Work Logs */}
      <EntityWorkLogs kind="problem" id={problem.id} />

      {/* Choosing Modal (Premortem prompt) */}
      {choosingOptId !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#141824] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>پیش‌مرگ (Premortem): زنگ خطر چیست؟</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              اگر این راهکار در آینده شکست بخورد، چه نشانه‌ای زودتر از همه شما را آگاه می‌کند؟
            </p>

            <textarea
              rows={3}
              value={premortemSign}
              onChange={(e) => setPremortemSign(e.target.value)}
              placeholder="مثلاً: اگر مصرف حافظه بعد از ۲ ساعت بالا برود..."
              className="w-full rounded-xl bg-[#0b0e16] border border-slate-700 p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChoosingOptId(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!premortemSign.trim() || chooseMutation.isPending}
                onClick={() => chooseMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all"
              >
                تأیید و انتخاب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
