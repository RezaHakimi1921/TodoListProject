import type { ProblemDraft } from '../api/problems'

export type FieldKey = Exclude<keyof ProblemDraft, 'title' | 'status' | 'attachTaskIds' | 'sectionSavedAt'>

export interface ProblemSection {
  id: string
  title: string
  hint: string
  expect: string
  example: string
  fields: Array<{ key: FieldKey; label: string; rows?: number; date?: boolean; expect?: string }>
  warn?: (draft: ProblemDraft) => string | null
}

function looksLikeFix(value?: string | null) {
  return /برطرف|اصلاح شد|فیکس|درست شد|تموم شد|تمام شد/.test(value ?? '')
}

function looksLikeUnknown(value?: string | null) {
  return /نمیدونم|نمی‌دانم|نمی ?دونم/.test(value ?? '')
}

export const PROBLEM_SECTIONS: ProblemSection[] = [
  {
    id: 'reality',
    title: '۱. واقعیت مسئله',
    hint: 'اول فقط بگو چه چیزی خراب است؛ راه‌حل و علت ننویس.',
    expect:
      'یک صحنهٔ قابل مشاهده: کجا دیدی، روی کدام مشتری/شعبه، چه چیزی غلط بود. بدون «باید درستش کنیم» و بدون حدس علت.',
    example:
      'در باشگاه مشتریان، گروه شعبهٔ رستوران سوجان هنوز «کته‌کبابی حسن شیرازی» را نشان می‌دهد. لینک: club.smartx.ir/…',
    fields: [{ key: 'reality', label: 'چه چیزی را با چشم دیدی؟', rows: 4 }],
    warn: (draft) =>
      looksLikeFix(draft.reality) ? 'اینجا راه‌حل ننویس. فقط همان چیزی که خراب دیده شد.' : null,
  },
  {
    id: 'expected',
    title: '۲. رفتار مورد انتظار',
    hint: 'سیستم برای کاربر باید چه نشان می‌داد؟',
    expect:
      'رفتار درستِ محصول از دید کاربر. آرزوی فرآیند بعدی (لینک، دسترسی سپیدز، بچ تسک) مال Prevention است نه اینجا.',
    example: 'بعد از دلفی‌به‌وب، نام و گروه شعبه باید همان رستوران جدید باشد، نه برند قبلی.',
    fields: [{ key: 'expectedBehavior', label: 'حالت درست از دید کاربر', rows: 3 }],
    warn: (draft) =>
      /بچ|دسترسی|لینک|سپیدز به نظرم/.test(draft.expectedBehavior ?? '')
        ? 'این بیشتر فرآیند بعدی است. اینجا بنویس کاربر باید چه چیزی را روی صفحه ببیند.'
        : null,
  },
  {
    id: 'actual',
    title: '۳. رفتار واقعی',
    hint: 'بدون حدس و راه‌حل، دقیقاً چه رخ داد.',
    expect: 'همان باگ/اختلاف را با محل دیده‌شدن بنویس. جملهٔ «برطرف شد» مال بخش ۹ است.',
    example: 'روی شعبهٔ سوجان، گروه «کته‌کبابی حسن» مانده. پشتیبانی از باشگاه این را دیده.',
    fields: [{ key: 'actualBehavior', label: 'چه اتفاقی افتاد؟ کجا دیده شد؟', rows: 4 }],
    warn: (draft) =>
      looksLikeFix(draft.actualBehavior) ? '«برطرف شد» را پاک کن و همان صحنهٔ خراب را بنویس.' : null,
  },
  {
    id: 'impact',
    title: '۴. اثر و Side Effect',
    hint: 'فقط همین مورد بوده یا هر چیزی زیر همین شرایط ممکن است خراب باشد؟',
    expect: 'نام بده، نه برچسب کلی. شعبه، مشتری، رکورد، سرویس، ساعت پشتیبانی، اثر پول/اعتماد.',
    example: 'نید و نول لانژ؛ رکورد 9168351؛ باشگاه؛ حدود ۱۰ روز پیگیری و ۲–۳ ساعت کار مفید.',
    fields: [
      { key: 'impactBranches', label: 'مجموعه‌ها / Branches', expect: 'نام شعبه یا برند، نه «نارضایتی».' },
      { key: 'impactCustomers', label: 'مشتری‌ها', expect: 'اسم مشتری‌هایی که درگیر شدند.' },
      { key: 'impactRecords', label: 'رکوردها', expect: 'شناسه یا شمارهٔ قابل جستجو.' },
      { key: 'impactServices', label: 'سرویس‌ها', expect: 'کدام محصول/صفحه خراب بوده.' },
      { key: 'impactSupport', label: 'زمان پشتیبانی', expect: 'تقریبی هم کافی است؛ روز و ساعت مفید.' },
      { key: 'impactBusiness', label: 'اثر کسب‌وکار', expect: 'نارضایتی، تأخیر، یا کار اضافه. «نمی‌دانم» ننویس.' },
    ],
    warn: (draft) =>
      looksLikeUnknown(draft.impactBusiness) ? 'اثر کسب‌وکار را با یک جملهٔ ملموس عوض کن.' : null,
  },
  {
    id: 'timeline',
    title: '۵. Timeline',
    hint: 'دنبال شروع مشکل باش، نه فقط زمان کشف.',
    expect: 'شروع ≠ کشف. اگر هر دو یک روز باشند، هنوز اولین وقوع را پیدا نکرده‌ای.',
    example: 'شروع ۳۱ مرداد؛ کشف و اصلاح ۱۰ شهریور.',
    fields: [
      { key: 'startedAt', label: 'شروع مشکل', date: true },
      { key: 'firstAffectedAt', label: 'اولین مورد درگیر', date: true },
      { key: 'detectedAt', label: 'کشف شد', date: true },
      { key: 'rootCauseFoundAt', label: 'علت پیدا شد', date: true },
      { key: 'fixedAt', label: 'اصلاح شد', date: true },
      { key: 'recoveryCompletedAt', label: 'Recovery تمام شد', date: true },
    ],
    warn: (draft) =>
      draft.startedAt && draft.detectedAt && draft.startedAt === draft.detectedAt
        ? 'شروع و کشف یکی است. برو عقب‌تر: اولین مشتری کی درگیر شد؟'
        : null,
  },
  {
    id: 'root',
    title: '۶. علت اصلی',
    hint: 'چرا؟ را چند بار بپرس.',
    expect:
      'علت اصلی چیزی است که اگر نبود، این کلاس مشکل تکرار نمی‌شد. «کانورتور خراب بود» هنوز یک لایه بالاتر است.',
    example: 'کانورتور برند قبلی را نگه می‌داشت و هیچ وضعیتی به سپیدز نشان نمی‌داد که کار ناقص مانده.',
    fields: [{ key: 'rootCause', label: 'Root Cause', rows: 4 }],
    warn: (draft) =>
      !draft.rootCause?.trim()
        ? 'این بخش خالی است. پنج بار بپرس چرا تا به نبودِ سیگنال یا فرآیند برسی.'
        : null,
  },
  {
    id: 'detect',
    title: '۷. چرا زودتر نفهمیدیم؟',
    hint: 'چرا سیستم به ما نگفت؟',
    expect: 'کدام هشدار/وضعیت/لاگ غایب بود که انسان مجبور شد از مشتری بفهمد.',
    example: 'سپیدز نتیجهٔ کانورت را نمی‌دید؛ آلارمی برای برندِ ناهماهنگ نبود.',
    fields: [{ key: 'detectionGap', label: 'شکاف Detection', rows: 3 }],
  },
  {
    id: 'affected',
    title: '۸. جمعیت درگیر',
    hint: 'از شروع تا اصلاح، چه مواردی تحت تأثیر بودند؟',
    expect: 'لیست قابل چک: شعبه، رکورد، بازه. «مشتری و پشتیبانی» برای Recovery کافی نیست.',
    example: 'همهٔ دلفی‌به‌وب از ۳۱ مرداد تا ۱۰ شهریور؛ حداقل نید و نول لانژ.',
    fields: [{ key: 'affectedPopulation', label: 'فهرست موارد / لاگ برای بقیه', rows: 4 }],
  },
  {
    id: 'resolution',
    title: '۹. Resolution',
    hint: 'چه کاری برای رفع ریشه انجام شد؟',
    expect: 'تغییر روی علت؛ جدا از درست‌کردن دادهٔ قدیمی.',
    example: 'کانورتور اصلاح شد و فرآیند «هر دلفی‌به‌وب تا انتقال سوابق» عوض شد.',
    fields: [{ key: 'resolution', label: 'چه کردیم', rows: 3 }],
  },
  {
    id: 'recovery',
    title: '۱۰. Recovery گذشته',
    hint: 'Problem Fixed ≠ Historical Data Fixed',
    expect: 'موارد قبلی الان درست‌اند؟ چطور چک شد؟ اگر نشده، صریح بنویس هنوز نه.',
    example: 'نید و نول را روی باشگاه چک کردم؛ گروه شعبه درست است. بقیهٔ بازه را فردا می‌روم.',
    fields: [{ key: 'recovery', label: 'موارد قبلی چگونه اصلاح شدند؟', rows: 3 }],
    warn: (draft) => (!draft.recovery?.trim() ? 'خالی است. ریشه درست شدن یعنی دادهٔ نید و نول هم درست شده؟' : null),
  },
  {
    id: 'validation',
    title: '۱۱. Validation',
    hint: 'از کجا مطمئن شدیم مشکل کاملاً حل شده؟',
    expect: 'یک نشانهٔ قابل‌تست: صفحه، رکورد، تاریخ چک. حسِ «دیگر نباید خراب باشد» کافی نیست.',
    example: '۱۰ شهریور روی سوجان و نید گروه درست بود؛ یک کانورت جدید آزمایشی هم درست درآمد.',
    fields: [{ key: 'validationNote', label: 'نشانه صحت', rows: 3 }],
    warn: (draft) => (!draft.validationNote?.trim() ? 'بدون نشانهٔ صحت، وضعیت را Resolved نگذار.' : null),
  },
  {
    id: 'cost',
    title: '۱۲. هزینه',
    hint: 'فنی / عملیاتی / کسب‌وکار / فرصت ازدست‌رفته',
    expect: 'حتی تقریبی. «نمی‌دانم» را با یک برآورد عوض کن.',
    example: 'فنی: دو باگ سپیدز. عملیاتی: فرآیند دستی. کسب‌وکار: نارضایتی دو شعبه.',
    fields: [
      { key: 'costTechnical', label: 'Technical' },
      { key: 'costOperational', label: 'Operational' },
      { key: 'costBusiness', label: 'Business' },
      { key: 'costOpportunity', label: 'Opportunity' },
    ],
    warn: (draft) =>
      looksLikeUnknown(draft.costBusiness) || looksLikeUnknown(draft.costOpportunity)
        ? 'به‌جای نمی‌دانم بنویس: اعتماد، تأخیر، یا ساعتی که می‌توانست کار دیگری باشد.'
        : null,
  },
  {
    id: 'prevention',
    title: '۱۳. Prevention',
    hint: 'دفعه بعد چه چیزی باید قبل از مشتری به ما بگوید؟',
    expect: 'سیگنال + صاحب + زمان. لینک امیر خوب است اگر بگویی کی می‌دهد و کی چک می‌کنی.',
    example: 'وضعیت کانورت برای سپیدز دیده شود؛ اگر برند نخواند، قبل از باشگاه آلارم بیاید.',
    fields: [{ key: 'prevention', label: 'چه باید تغییر کند', rows: 3 }],
  },
]
