import type { DailyLog, Problem, TaskItem, WorkLogEntry } from '../types'
import { todayIso } from '../lib/dates'

export interface MockStore {
  tasks: TaskItem[]
  problems: Problem[]
  workLogs: WorkLogEntry[]
  dailyLogs: DailyLog[]
  trash: { kind: string; id: number; title: string; deletedAt: string; data: unknown }[]
  timeline: { id: number; taskId: number; note: string; createdAt: string }[]
  checklistItems: {
    id: number
    taskId: number
    title: string
    isDone: boolean
    sortOrder: number
    createdAt: string
    doneAt: string | null
  }[]
  settings: { pingMinutes: number; paused: boolean; lastPingAt: string | null }
  focus: { active: boolean; description: string; taskId: number | null; problemId: number | null; startedAt: string | null; updatedAt: string | null }
}

const STORAGE_KEY = 'taskos_data_v3'

export function getInitialMockStore(): MockStore {
  const today = todayIso()
  return {
    tasks: [] as TaskItem[],
    _removedDemoTasks: [
      {
        id: 1,
        title: 'طراحی ماژول گزارش‌گیری و صدور لاگ‌های فشرده برای جیرا',
        status: 'Doing',
        energyType: 'Deep',
        tags: ['جیرا', 'هسته'],
        stuckReason: null,
        isAging: false,
        agingDays: 0,
        createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: null,
      },
      {
        id: 2,
        title: 'بازطراحی مینیمال و شکیل پنجره پاپ‌آپ ویندوز فرم (WinForms)',
        status: 'Done',
        energyType: 'Deep',
        tags: ['طراحی', 'ویندوز'],
        stuckReason: null,
        isAging: false,
        agingDays: 0,
        createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: new Date().toISOString(),
      },
      {
        id: 3,
        title: 'رفع خطای زمان‌بندی سرویس پینگ و نمایش پیام‌های شناور',
        status: 'Open',
        energyType: 'Light',
        tags: ['باگ', 'سرویس'],
        stuckReason: null,
        isAging: true,
        agingDays: 3,
        createdAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: null,
      },
      {
        id: 4,
        title: 'بررسی ایمیل‌ها و هماهنگی جلسه بازبینی اسپرینت با تیم فنی',
        status: 'Open',
        energyType: 'Light',
        tags: ['ارتباطات', 'جلسه'],
        stuckReason: null,
        isAging: false,
        agingDays: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: null,
      },
      {
        id: 5,
        title: 'پیکربندی استراتژی پشتیبان‌گیری خودکار دیتابیس SQLite',
        status: 'Stuck',
        energyType: 'Deep',
        tags: ['دیتابیس', 'امنیت'],
        stuckReason: 'منتظر پاسخ یا اقدام شخص دیگری هستم',
        isAging: true,
        agingDays: 5,
        createdAt: new Date(Date.now() - 3600 * 1000 * 120).toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: null,
      },
    ],
    problems: [
      {
        id: 1,
        title: 'انتخاب معماری کش مناسب برای پاسخ‌دهی سریع گزارشات بدون فشار بر سرور',
        status: 'Chosen',
        noTimeNote: 'استفاده از MemoryCache توکار دات‌نت بدون هیچ زیرساخت خارجی',
        infiniteTimeNote: 'پیاده‌سازی کلاستر Redis توزیع‌شده با قابلیت Failover و پایپ‌لاین نویسی کامل',
        chosenOptionId: 101,
        premortemSign: 'اگر حجم لاگ‌ها در روز اول از ۱۰۰ مگابایت رد شود و حافظه پر شود',
        canChoose: true,
        blocker: null,
        createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
        updatedAt: new Date().toISOString(),
        options: [
          {
            id: 101,
            title: 'استفاده از IMemoryCache داخلی دات‌نت با زمان انقضای کش ۱۰ دقیقه‌ای',
            juniorExplain: 'داده‌ها به طور موقت در رم همان برنامه ذخیره می‌شوند و نیاز به نصب سرویس جدید نیست.',
            sortOrder: 1,
            isChosen: true,
          },
          {
            id: 102,
            title: 'راه‌اندازی سرور اختصاصی ردیس (Redis Cache)',
            juniorExplain: 'یک سرور جداگانه برای نگهداری کش که چندین برنامه بتوانند مشترکاً از آن استفاده کنند.',
            sortOrder: 2,
            isChosen: false,
          },
          {
            id: 103,
            title: 'بهینه‌سازی ایندکس‌های جدول در SQLite بدون کش',
            juniorExplain: 'فقط با ساخت ایندکس روی ستون‌های تاریخ و کاربر، سرعت کوئری مستقیم را بالا ببریم.',
            sortOrder: 3,
            isChosen: false,
          },
        ],
      },
    ],
    workLogs: [
      {
        id: 1,
        description: 'کدنویسی و بازطراحی استایل پنجره پاپ‌آپ ویندوز فرم',
        durationMinutes: 45,
        source: 'Timer',
        taskId: 2,
        problemId: null,
        createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
      },
      {
        id: 2,
        description: 'طراحی ساختار جدید داشبورد تسک‌ها و ستون‌های تمرکز عمیق',
        durationMinutes: 40,
        source: 'Manual',
        taskId: 1,
        problemId: null,
        createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      },
      {
        id: 3,
        description: 'استراحت و قهوه میان‌روز',
        durationMinutes: 15,
        source: 'Manual',
        taskId: null,
        problemId: null,
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      },
    ],
    dailyLogs: [
      {
        id: 1,
        logDate: today,
        note: 'امروز روی بهینه‌سازی تجربه کاربری و فارسی‌سازی محیط کار تمرکز کردم. تفکیک کارهای با تمرکز عمیق (Deep) از کارهای سبک باعث شد خستگی ذهنی به شدت کاهش پیدا کند و پیشرفت کارهای اساسی کاملاً ملموس باشد.',
        createdAt: new Date().toISOString(),
      },
    ],
    trash: [],
    checklistItems: [],
    timeline: [
      {
        id: 1,
        taskId: 1,
        note: 'فرمت خروجی جیرا تست شد و با استانداردهای تیم مطابقت دارد.',
        createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      },
    ],
    settings: {
      pingMinutes: 15,
      paused: false,
      lastPingAt: new Date(Date.now() - 60000 * 8).toISOString(),
    },
    focus: {
      active: true,
      description: 'طراحی ماژول گزارش‌گیری و صدور لاگ‌های فشرده برای جیرا',
      taskId: 1,
      problemId: null,
      startedAt: new Date(Date.now() - 60000 * 25).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }
}

export function loadStore(): MockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  const initial = getInitialMockStore()
  saveStore(initial)
  return initial
}

export function saveStore(store: MockStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore
  }
}
