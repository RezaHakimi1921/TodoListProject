export type TaskStatus = 'Open' | 'Doing' | 'Stuck' | 'Done'
export type EnergyType = 'Deep' | 'Light'
export type WorkLogSource = 'Timer' | 'Extension' | 'Manual'
export type ProblemStatus = 'Exploring' | 'Chosen' | 'Validated'

export const STUCK_REASONS = [
  'منتظر پاسخ یا اقدام شخص دیگری هستم',
  'کار بزرگ و سنگین است و نیاز به خرد کردن دارد',
  'فراموش شده بود یا اولویت دیگری پیش آمد',
  'دیگر اولویت ندارد یا منتفی شد (اتمام و بستن)',
] as const

export type StuckReason = (typeof STUCK_REASONS)[number]

export interface TaskItem {
  id: number
  title: string
  status: TaskStatus
  energyType: EnergyType
  tags: string[]
  stuckReason: string | null
  isAging: boolean
  agingDays: number
  createdAt: string
  updatedAt: string
  doneAt: string | null
  targetDate?: string | null
  rolledOver?: boolean
  rolledOverFrom?: string | null
}

export interface TimelineEntry {
  id: number
  taskId: number
  note: string
  createdAt: string
}

export interface SimilarTask {
  id: number
  title: string
  doneAt: string | null
  similarity: number
}

export interface DailyLog {
  id: number
  logDate: string
  note: string
  createdAt: string
}

export interface WorkLogEntry {
  id: number
  description: string
  durationMinutes: number
  source: WorkLogSource
  taskId?: number | null
  problemId?: number | null
  createdAt: string
}

export interface WorkLogGroup {
  title: string
  totalMinutes: number
  entries: WorkLogEntry[]
}

export interface WorkLogSummary {
  date: string
  totalMinutes: number
  groups: WorkLogGroup[]
  copyText: string
}

export interface ProblemOption {
  id: number
  title: string
  juniorExplain: string | null
  sortOrder: number
  isChosen: boolean
}

export interface Problem {
  id: number
  title: string
  status: ProblemStatus
  noTimeNote: string | null
  infiniteTimeNote: string | null
  chosenOptionId: number | null
  premortemSign: string | null
  options: ProblemOption[]
  canChoose: boolean
  blocker: string | null
  createdAt: string
  updatedAt: string
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  Open: 'باز برای اقدام',
  Doing: 'در حال انجام',
  Stuck: 'متوقف / گیر کرده',
  Done: 'تکمیل شده',
}

export const PROBLEM_STATUS_LABEL: Record<ProblemStatus, string> = {
  Exploring: 'در حال کشف و بررسی گزینه‌ها',
  Chosen: 'راهکار انتخاب شده (پیش از تست)',
  Validated: 'تست شده و تثبیت‌شده',
}

export const SPARK_QUESTIONS = [
  'اگر فردا باید به یک همکار تازه‌کار (Junior) توضیح دهی، کدام مسیر ساده‌تر و شفاف‌تر است؟',
  'اگر برای حل این مسئله فقط ۱ ساعت زمان داشتی، کدام کارها را بی‌درنگ حذف می‌کردی؟',
  'اگر محدودیت‌ها برعکس می‌شد (مثلاً بدون دسترسی به دیتابیس یا بدون بودجه)، چه می‌کردی؟',
  'کدام بخش این راه‌حل را می‌توانی بدون آسیب زدن به هدف اصلی حذف کنی؟',
  'اگر یک هفته بعد این انتخاب شکست بخورد، چه نشانه‌ای زودتر از همه آن را هشدار می‌داد؟',
]
