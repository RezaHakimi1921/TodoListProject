import { GraduationCap } from 'lucide-react'
import type { ProblemActionItem, ProblemStatus } from '../types'
import type { ProblemDraft } from '../api/problems'
import type { ProblemSection } from '../lib/problemSections'

interface Props {
  draft: ProblemDraft & { title: string; status: ProblemStatus }
  actions: ProblemActionItem[]
}

type Tip = { ok: boolean; title: string; doNext: string }

function filled(value?: string | null) {
  return Boolean(value?.trim())
}

function looksLikeFix(value?: string | null) {
  const text = (value ?? '').trim()
  return /برطرف|اصلاح شد|فیکس|درست شد|تموم شد|تمام شد/.test(text)
}

function looksLikeUnknown(value?: string | null) {
  return /نمیدونم|نمی‌دانم|نمی ?دونم/.test(value ?? '')
}

export function SectionGuide({ section, draft }: { section: ProblemSection; draft: ProblemDraft }) {
  const warn = section.warn?.(draft)
  return (
    <div className="sm:col-span-2 space-y-1.5 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-semibold text-sky-300">در این بخش چه انتظاری می‌رود</p>
      <p className="text-[11px] leading-relaxed text-slate-300">{section.expect}</p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-400">مثال: </span>
        {section.example}
      </p>
      {warn ? <p className="text-[11px] leading-relaxed text-amber-200">{warn}</p> : null}
    </div>
  )
}

export function reviewInvestigation(
  draft: ProblemDraft & { title: string; status: ProblemStatus },
  actions: ProblemActionItem[],
): Tip[] {
  return [
    {
      ok: filled(draft.reality) && !looksLikeFix(draft.reality),
      title: '۱. واقعیت',
      doNext: 'اول صحنهٔ خراب را بنویس: کجا دیدی و چه چیزی غلط بود.',
    },
    {
      ok: filled(draft.expectedBehavior) && !looksLikeFix(draft.expectedBehavior),
      title: '۲. رفتار مورد انتظار',
      doNext: 'بنویس سیستم برای کاربر باید چه نشان می‌داد؛ آرزوی فرآیند بعدی مال Prevention است.',
    },
    {
      ok: filled(draft.actualBehavior) && !looksLikeFix(draft.actualBehavior),
      title: '۳. رفتار واقعی',
      doNext: 'فقط واقعیت: چه دیده شد، کجا، روی کدام شعبه/رکورد. «برطرف شد» را ببر بخش ۹.',
    },
    {
      ok:
        filled(draft.impactCustomers) &&
        filled(draft.impactRecords) &&
        filled(draft.impactBusiness) &&
        !looksLikeUnknown(draft.impactBusiness),
      title: '۴. اثر',
      doNext: 'اثر کسب‌وکار را با یک جملهٔ ملموس بگو: نارضایتی، تأخیر، یا کار اضافهٔ پشتیبانی.',
    },
    {
      ok: Boolean(draft.startedAt && draft.detectedAt && draft.startedAt !== draft.detectedAt),
      title: '۵. Timeline',
      doNext: 'تاریخ شروع را از تاریخ کشف جدا کن. اگر یکی باشند، هنوز شروع واقعی را پیدا نکرده‌ای.',
    },
    {
      ok: filled(draft.rootCause) && !/کانورتور خراب|باگ بود/.test(draft.rootCause ?? ''),
      title: '۶. علت اصلی',
      doNext: 'پنج بار بپرس چرا. «کانورتور خراب بود» علت نیست؛ چرا کانورتور ناقص ماند و چرا کسی ندید؟',
    },
    {
      ok: filled(draft.detectionGap) && !/نداشتیم/.test(draft.detectionGap ?? ''),
      title: '۷. Detection',
      doNext: 'بگو کدام سیگنال غایب بود: لاگ، وضعیت کار، هشدار، یا دیده شدن نتیجه توسط سپیدز.',
    },
    {
      ok: filled(draft.affectedPopulation) && (draft.affectedPopulation ?? '').length > 20,
      title: '۸. جمعیت درگیر',
      doNext: 'لیست قابل‌بررسی بنویس: شعبه، رکورد، بازهٔ تاریخ. «مشتری و پشتیبانی» برای Recovery کافی نیست.',
    },
    {
      ok: filled(draft.resolution),
      title: '۹. Resolution',
      doNext: 'چه تغییری روی ریشه رفت؟ وصله، فرآیند، یا هر دو؟',
    },
    {
      ok: filled(draft.recovery),
      title: '۱۰. Recovery',
      doNext: 'ریشه درست شدن ≠ دادهٔ قبلی درست شدن. نید و نول لانژ الان درست‌اند؟ بقیهٔ کانورت‌های همان بازه چطور؟',
    },
    {
      ok: filled(draft.validationNote),
      title: '۱۱. Validation',
      doNext: 'یک نشانهٔ قابل‌تست بنویس: صفحهٔ فلان شعبه، رکورد فلان، تاریخ چک.',
    },
    {
      ok: filled(draft.prevention) && /لینک|هشدار|وضعیت|آلارم|چک/.test(draft.prevention ?? ''),
      title: '۱۳. Prevention',
      doNext: 'دفعه بعد چه چیزی قبل از مشتری به تو می‌گوید؟ صاحب، ابزار، و زمان چک را مشخص کن.',
    },
    {
      ok: actions.some((item) => item.status === 'Open') && !actions.every((item) => /تموم شد|تمام شد/.test(item.title)),
      title: '۱۴. Action',
      doNext: 'اقدام یعنی کار باقی‌مانده. کار تمام‌شده را Done کن؛ کار بعدی را جدا بنویس.',
    },
    {
      ok: draft.status !== 'Resolved' || (filled(draft.validationNote) && filled(draft.recovery)),
      title: '۱۵. وضعیت',
      doNext:
        draft.status === 'Open' && filled(draft.resolution)
          ? 'اگر ریشه درست شده، وضعیت را Monitoring بگذار تا Validation تمام شود.'
          : 'Resolved فقط وقتی که Recovery و Validation پر باشد.',
    },
  ]
}

export function ProblemCoachCard({ draft, actions }: Props) {
  const tips = reviewInvestigation(draft, actions)
  const done = tips.filter((item) => item.ok).length
  const next = tips.find((item) => !item.ok)

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sky-200">
          <GraduationCap className="h-4 w-4" />
          <h2 className="text-xs font-bold">مربی تحقیق</h2>
        </div>
        <p className="font-mono text-[11px] text-sky-100/80">
          {done} از {tips.length}
        </p>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-300">
        ترتیب را از واقعیت به علت برو، نه از راه‌حل به عقب. اول بگو چه باید می‌شد و چه شد؛ بعد چرا؛ بعد چطور مطمئن شوی
        تمام موارد قبلی هم درست شده‌اند.
      </p>
      {next ? (
        <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2">
          <p className="text-[10px] font-semibold text-amber-200">قدم بعدی</p>
          <p className="mt-0.5 text-xs font-bold text-white">{next.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-50/90">{next.doNext}</p>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-emerald-200">فرم از نظر مربی کامل است. وضعیت را با Validation یکی کن.</p>
      )}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {tips.map((item) => (
          <li
            key={item.title}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
              item.ok ? 'bg-emerald-500/10 text-emerald-100' : 'bg-black/25 text-slate-400'
            }`}
          >
            <span className="font-semibold">{item.ok ? 'درست' : 'ناقص'}</span>
            <span className="mx-1 text-slate-600">·</span>
            {item.title}
          </li>
        ))}
      </ul>
    </section>
  )
}
