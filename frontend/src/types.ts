export type TaskStatus = 'Open' | 'Doing' | 'Stuck' | 'Done'
export type EnergyType = 'Deep' | 'Light'
export type TaskOwnership = 'Mine' | 'Other'
export type WorkLogSource = 'Timer' | 'Extension' | 'Manual' | 'Break' | 'Auto'
export type ProblemStatus = 'Open' | 'Monitoring' | 'Resolved'

export const STUCK_REASONS = [
  'منتظر کسی‌ام',
  'یادم رفت',
  'سخته',
  'مهم نیست دیگه',
] as const

export type StuckReason = (typeof STUCK_REASONS)[number]

export const STUCK_REASON_LABEL: Record<StuckReason, string> = {
  'منتظر کسی‌ام': 'منتظر پاسخ یا اقدام شخص دیگری هستم',
  'یادم رفت': 'فراموش شده بود یا اولویت دیگری پیش آمد',
  'سخته': 'کار بزرگ و سنگین است و نیاز به خرد کردن دارد',
  'مهم نیست دیگه': 'دیگر اولویت ندارد یا منتفی شد (اتمام و بستن)',
}

export const FOCUS_PAUSED_REASON: StuckReason = 'یادم رفت'

export function isFocusPaused(task: { status: TaskStatus; stuckReason?: string | null }) {
  return task.status === 'Stuck' && task.stuckReason === FOCUS_PAUSED_REASON
}

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
  checklistTotal?: number
  checklistDone?: number
  jiraKey?: string | null
  jiraUrl?: string | null
  ownership?: TaskOwnership
  assigneeName?: string | null
  assigneeDisplay?: string | null
  pinned?: boolean
  problems?: ProblemLink[]
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
  jiraWorklogId?: string | null
  taskTitle?: string | null
  jiraKey?: string | null
  problemTitle?: string | null
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

export interface ProblemLink {
  id: number
  title: string
  status: ProblemStatus
}

export interface ProblemTaskLink {
  id: number
  title: string
  status: string
  jiraKey?: string | null
  jiraUrl?: string | null
}

export interface ProblemActionItem {
  id: number
  title: string
  owner: string | null
  deadline: string | null
  status: 'Open' | 'Done'
}

export interface Problem {
  id: number
  title: string
  status: ProblemStatus
  expectedBehavior?: string | null
  actualBehavior?: string | null
  rootCause?: string | null
  detectionGap?: string | null
  affectedPopulation?: string | null
  resolution?: string | null
  recovery?: string | null
  validationNote?: string | null
  prevention?: string | null
  impactBranches?: string | null
  impactCustomers?: string | null
  impactRecords?: string | null
  impactServices?: string | null
  impactSupport?: string | null
  impactBusiness?: string | null
  startedAt?: string | null
  firstAffectedAt?: string | null
  detectedAt?: string | null
  rootCauseFoundAt?: string | null
  fixedAt?: string | null
  recoveryCompletedAt?: string | null
  costTechnical?: string | null
  costOperational?: string | null
  costBusiness?: string | null
  costOpportunity?: string | null
  sectionSavedAt?: Record<string, string> | null
  taskCount?: number
  tasks?: ProblemTaskLink[]
  actions?: ProblemActionItem[]
  noTimeNote?: string | null
  infiniteTimeNote?: string | null
  chosenOptionId?: number | null
  premortemSign?: string | null
  options?: ProblemOption[]
  canChoose?: boolean
  blocker?: string | null
  createdAt: string
  updatedAt: string
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  Open: 'باز برای اقدام',
  Doing: 'در حال انجام',
  Stuck: 'متوقف / گیر کرده',
  Done: 'تکمیل شده',
}

export function statusLabel(task: { status: TaskStatus; stuckReason?: string | null }) {
  if (isFocusPaused(task)) return 'در حال انجام متوقف شده'
  return STATUS_LABEL[task.status]
}

export function ownerLabel(task: {
  ownership?: TaskOwnership
  assigneeDisplay?: string | null
  assigneeName?: string | null
}) {
  if (task.ownership !== 'Other') return 'من'
  const name = (task.assigneeDisplay || task.assigneeName || '').trim()
  return name || 'دیگری'
}

export const PROBLEM_STATUS_LABEL: Record<ProblemStatus, string> = {
  Open: 'در حال بررسی',
  Monitoring: 'مراقب تکرار',
  Resolved: 'بسته شد',
}

export const GOLD_QUESTIONS = [
  'از کی شروع شده؟',
  'چرا اتفاق افتاده؟',
  'غیر از این مورد، چه چیزهای دیگری تحت تأثیر قرار گرفته‌اند؟',
  'چطور مطمئن شوم همه موارد قبلی اصلاح شده‌اند؟',
  'چه چیزی باید تغییر کند که دفعه بعد خودمان زودتر بفهمیم؟',
]

export function isAutomaticWorkLog(source: string | null | undefined) {
  return source === 'Auto' || source === 'Timer' || source === 'Extension'
}
