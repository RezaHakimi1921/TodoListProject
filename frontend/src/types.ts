export type TaskStatus = 'Open' | 'Doing' | 'Stuck' | 'Done'
export type EnergyType = 'Deep' | 'Light'
export type WorkLogSource = 'Timer' | 'Extension' | 'Manual'
export type ProblemStatus = 'Exploring' | 'Chosen' | 'Validated'

export const STUCK_REASONS = [
  'منتظر کسی‌ام',
  'یادم رفت',
  'سخته',
  'مهم نیست دیگه',
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
  Open: 'باز',
  Doing: 'در حال انجام',
  Stuck: 'گیر کرده',
  Done: 'انجام شد',
}

export const PROBLEM_STATUS_LABEL: Record<ProblemStatus, string> = {
  Exploring: 'در حال کشف',
  Chosen: 'انتخاب شده — تست نشده',
  Validated: 'تست شد',
}

export const SPARK_QUESTIONS = [
  'اگر فردا باید به یک جونیور توضیح بدی، کدام گزینه ساده‌تر می‌شه؟',
  'اگر این کار فقط یک ساعت وقت داشت، کدام راه را قطع می‌کردی؟',
  'اگر محدودیت برعکس می‌شد (هیچ زمان / هیچ دسترسی به DB)، چی می‌کردی؟',
  'کدام گزینه را حاضر حذف می‌کنی چون هنوز مسئله حل شود؟',
  'اگر یک هفته بعد این انتخاب شکست بشود، کدام نشانه زودتر آن را نشان می‌داد؟',
]
