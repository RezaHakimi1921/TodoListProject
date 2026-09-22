# TaskOS — اتوماسیون و عمومی‌سازی برای چند کاربر

تاریخ: ۱۴۰۴/۰۶/۲۶ (2026-09-17)  
به‌روزرسانی تصمیم‌های معماری: ۱۴۰۴/۰۶/۲۶ (عصر)  
هدف: TaskOS فقط برای یک نفر (رضا / SmartX / SIP) customize نباشد؛ هر کاربر در **همان تیم** بتواند با پروفایل و قوانین خودش کار کند.

---

## ۱) خلاصه اجرایی

امروز TaskOS یک **موتور کاری قوی** دارد (تمرکز، تسک، اینباکس، یادآور، ورک‌لاگ روزانه، نقش ادمین/کاربر، بازیابی رمز با ntfy)، ولی هنوز لایهٔ «هویت و یکپارچه‌سازی» روی فرض‌های رضا/SmartX چسبیده است.

مسیر درست:

1. **Core engine** ثابت بماند (تسک، فوکوس، نوتیف، رول‌اوور روز، …).
2. **Work Profile** برای هر کاربر: هویت جیرا، لینک‌ها، میانبرهای برد، تنظیمات اعلان.
3. **Automations** به‌صورت event → condition → action، نه `if (user == reza)` در کد.
4. **تیم داخلی یک‌نصب** (SmartX)، نه محصول SaaS چندسازمانی.

این سند هم کار **انجام‌شده** را ثبت می‌کند، هم **تصمیم‌های قفل‌شده**، هم کار **پیشِ رو**.

---

## ۰) فاز صفر — تصمیم‌های معماری (قفل‌شده)

> این بخش فقط تصمیم است؛ کد سنگین برای multi-tenant / Project-Board / Billing نوشته نمی‌شود.

### ۰.۱ مدل استقرار: single-org per install

| تصمیم | جزئیات |
|--------|--------|
| **انتخاب** | یک نصب TaskOS = یک تیم / یک سازمان |
| **معنی** | جداسازی داده با `OwnerUserId` (+ بعداً Visibility)، **نه** با `TenantId` روی همهٔ جدول‌ها |
| **عمداً خارج از scope** | multi-tenant واقعی روی یک DB (چند سازمان جدا با isolation سخت) |
| **اگر بعداً تیم دیگری خواست** | نصب جدا / DB جدا — نه افزودن Tenant به schema فعلی |

کلمهٔ «سازمان» در این سند یعنی **همان تیم نصب‌شده**، نه marketplace چندمشتری.

### ۰.۲ Visibility تسک‌ها (نه مدل Board کامل)

الان معماری نزدیک «چند صندوق شخصی کنار هم» است (`OwnerUserId`). برای کار تیمی واقعی، بدون ساختن Project/Board جیرا-مانند:

| فیلد پیشنهادی | معنی |
|----------------|------|
| `Visibility = Private` | فقط مالک (+ ادمین در صورت نیاز) |
| `Visibility = Team` | همهٔ اعضای همان نصب می‌بینند / روی برد مشترک |

- مالک (`OwnerUserId`) همچنان مشخص است (گزارش فردی، فوکوس، rollover).
- **ساختن مدل Project/Board با اعضا per-board فعلاً لازم نیست** — برای تیم کوچک داخلی over-engineering است.
- Aging / DailyLog تیمی: جمع‌زدن روی تسک‌های `Team` + مالک‌های فعال؛ جزئیات در فاز Visibility.

### ۰.۳ نقش‌ها: Admin / Member (فعلاً)

| نقش | اختیار |
|------|--------|
| **Admin** | مدیریت کاربران، تنظیمات سیستم (SMTP در صورت بازگشت، ntfy پایه، …)، دیدن/مدیریت در حد نیاز تیم |
| **Member** (`User` فعلی) | کار روزمره روی تسک‌های خود + تسک‌های `Team` |

**تصمیم YAGNI:** لایهٔ جداگانهٔ `Owner` سازمان فعلاً اضافه نمی‌شود.  
تا وقتی نیاز واقعی «ادمینی که تنظیمات سیستم را نزند ولی عضو را مدیریت کند» حس نشود، `Admin`/`Member` کافی است. اگر بعداً لازم شد، `Owner` را بالای Admin اضافه می‌کنیم — نه از روز اول.

Permission دانه‌ریز روی هر برد/پروژه: **خارج از scope فعلی**.

### ۰.۴ صریحاً خارج از scope (ننویسید / پیاده نکنید مگر تصمیم عوض شود)

- Multi-tenant واقعی + `TenantId` سراسری
- Billing / Licensing / سقف کاربر per plan (الگوی Arte فقط اگر روزی محصول بیرونی شد)
- مدل Project/Board کامل با نقش per-board
- ورود گوگل به‌عنوان مسیر اصلی بازیابی/احراز (مسیر فعلی: رمز + ntfy)

### ۰.۵ ریسک‌های فنی که از همین فاز باید در طراحی بمانند

| موضوع | تصمیم طراحی |
|--------|-------------|
| توکن جیرا | per-user در Work Profile؛ **encrypted at rest** (مثلاً DataProtection) — plaintext در DB ممنوع |
| Automation سنگین | از v1 با **hosted service / worker** جدا از request pipeline؛ نه فقط داخل action کنترلر |
| Jira rate limit | صف + backoff وقتی چند کاربر sync می‌کنند |
| SMTP / تنظیمات سیستم | در مدل single-org، سراسری برای همان نصب کافی است |

---

## ۲) چه چیزی الان شخصی / سخت‌کد است؟

| حوزه | وضعیت فعلی | مشکل برای نفر بعدی |
|------|------------|---------------------|
| هویت جیرا | `IsSelf` / `IsMe` ≈ رضا | تشخیص «من» برای کاربر دیگر غلط است |
| دامنه جیرا | `jira.smartx.ir`، پروژه‌های `PS`/`SIP` | تغییر سازمان/پروژه بدون rebuild سخت است |
| میانبرهای برد | seed برای رضا؛ کاربر جدید خالی | باید از پروفایل/تنظیمات بیاید |
| سرویس‌های پس‌زمینه | اغلب `CurrentUser.Use("reza")` | sync/اینباکس فقط برای یک مالک |
| خدنگ | تشخیص agent با نام/الگوی خاص | باید قابل تنظیم در پروفایل/تنظیمات نصب باشد |
| نوتیف تیکت خاص | فرض‌هایی مثل `SIP-2286` | شماره تیکت نباید در کد باشد |
| Owner پیش‌فرض | بعضی مسیرها به `reza` می‌افتند | چندکاربره واقعی می‌شکند |
| Visibility | فقط `OwnerUserId` | تسک مشترک تیمی مدل نشده |

نقطهٔ مثبت: **میانبرهای برد (Board Activities)** و **OwnerUserId روی تسک/لاگ** شروع جداسازی داده از کد بوده‌اند.

---

## ۳) کارهای انجام‌شده (مرتبط با محصول چندکاربره / ورود / روز کاری)

### ۳.۱ هویت و دسترسی
- جدول/مدل `AppUser` با ایمیل، نقش `Admin` / `User` (= Member)
- مدیریت کاربران برای ادمین
- `OwnerUserId` روی تسک‌ها و `DailyLog` با یکتایی `(LogDate, OwnerUserId)`
- موضوع ntfy **per-user** برای اعلان و بازیابی رمز

### ۳.۲ بستن روز کاری و گزارش
- بستن روز → rollover تسک‌های باز
- مودال خلاصهٔ پایان روز (`CloseDayReportModal` / `WorkLogSummaryDto`)

### ۳.۳ ورود و بازیابی
- `/forgot-password`: ایمیل → کد موقت عددی به **ntfy همان کاربر** → فرم کد + رمز جدید
- ورود گوگل و کارت تنظیمات Google از مسیر اصلی محصول حذف شده (بازیابی = ntfy)
- `/set-password` وقتی `MustChangePassword`

### ۳.۴ نوتیف و کامنت
- اینباکس چندتب با صفحه‌بندی
- رندر Markdown کامنت‌ها / خدنگ (`MarkdownBody`, `toCommentMarkdown`)

### ۳.۵ یکپارچگی عملیاتی
- Deploy روی `192.168.210.196` (API + www)
- همگام‌سازی اینباکس با مالک درست

---

## ۴) معماری هدف: Work Profile + Automations + Visibility

### ۴.۱ Work Profile (هر کاربر یک پروفایل کار)

```text
WorkProfile
├── Identity
│   ├── jiraUsername / displayName / accountId
│   └── timezone / locale
├── Integrations
│   ├── jiraBaseUrl          # معمولاً همان نصب؛ قابل override
│   ├── jiraProjects[]
│   ├── auth (PAT) encrypted at rest
│   └── ntfy topic (از قبل per-user)
├── BoardShortcuts[]
├── NotificationPrefs
└── Defaults
```

قواعد:
- URL سازمانی در frontend hardcode نشود مگر fallback از پروفایل/تنظیمات نصب.
- `IsMe` از پروفایل خوانده شود، نه ثابت `reza`.

### ۴.۲ Visibility (قبل از اتوماسیون سنگین)

```text
Task.OwnerUserId = مالک
Task.Visibility  = Private | Team
```

لیست داشبورد پیش‌فرض: `Private(من) ∪ Team(نصب)`.  
گزارش فردی روی مالک؛ نمای تیمی روی `Visibility=Team`.

### ۴.۳ موتور اتوماسیون

```text
Trigger → Conditions → Actions
```

قالب‌های v1 پیشنهادی: کامنت خدنگ → نوتیف؛ تسک جدید پروژهٔ X → اینباکس؛ Aging → یادآور.

قانون طلایی: **اتوماسیون = داده در UI**، نه commit برای هر نفر.  
اجرا: **worker / hosted service** + احترام به rate limit جیرا.

---

## ۵) نقشهٔ فازها (ترتیب تأییدشده)

### فاز ۰ — تصمیم معماری — **انجام (مکتوب در بخش ۰)**
- [x] single-org per install
- [x] Visibility = Private \| Team (نه Board کامل)
- [x] نقش Admin / Member؛ Owner سه‌لایه فعلاً نه
- [x] multi-tenant و billing خارج از scope

### فاز A — جداسازی هویت — بخشی انجام / ادامه
- [x] نقش Admin/User و ایمیل پروفایل
- [x] OwnerUserId روی موجودیت‌های اصلی
- [ ] حذف کامل fallback `"reza"` از repositoryها و hosted serviceها
- [ ] `IsMe` / فیلتر جیرا از Work Profile
- [ ] Jira base URL از تنظیمات کاربر/نصب

### فاز A+ — Visibility ساده (قبل از Automation)
- [ ] ستون/فیلد `Visibility` روی Task (+ پیش‌فرض Private)
- [ ] فیلتر لیست: شخصی + تیمی
- [ ] قوانین گزارش Aging/Daily در حد جمع تیمی سبک
- [ ] (اختیاری) AuditEvent خیلی سبک برای ویرایش ادمین روی کاربر/تسک دیگران

### فاز B — Work Profile UI
- [ ] صفحه «پروفایل کار» برای هر کاربر
- [ ] میانبرهای برد داخل همان پروفایل
- [ ] توکن جیرا per-user + رمزنگاری at rest
- [ ] wizard اولین ورود

### فاز C — Automations v1
- [ ] مدل Rule در SQLite
- [ ] UI لیست قوانین + فعال/غیرفعال
- [ ] ۳ قالب آماده
- [ ] اجرای روی **hosted service / worker** (نه فقط داخل request)
- [ ] صف + backoff برای Jira

### فاز D — لینک‌ها و انعطاف نصب (نه multi-tenant)
- [ ] لینک‌های دلخواه روی کارت تسک
- [ ] جدا کردن seed SIP از هسته
- [ ] در صورت نیاز: بیش از یک Jira base به‌عنوان «اتصال»، نه به‌عنوان tenant

### فاز E — onboarding
- [ ] مستند نصب یک‌صفحه‌ای
- [ ] کاربر بدون جیرا کاملاً قابل استفاده
- [ ] ادمین کاربر بسازد و پروفایل خالی بدهد
- [ ] عوض کردن لینک/پروژه بدون rebuild

---

## ۶) کارهای همین دور (ورود / MD / سند)

| مورد | وضعیت |
|------|--------|
| Forgot password فقط ایمیل + ntfy | انجام |
| حذف مسیر گوگل از بازیابی/ورود اصلی | انجام |
| رندر Markdown کامنت‌ها و خدنگ | انجام |
| این سند + فاز ۰ قفل‌شده | انجام |
| Visibility در کد | **باقی‌مانده (فاز A+)** |

---

## ۷) معیار پذیرش عمومی‌سازی (Definition of Done)

1. کاربر جدید (Member) ساخته شود، ایمیل + ntfy بگذارد، بدون دست زدن به کد کار کند.
2. هویت جیرای او در پروفایل ست شود و `IsMe` درست شود.
3. میانبرهای برد و لینک‌ها از داده بیایند.
4. تسک بتواند `Private` یا `Team` باشد و عضو تیم تسک تیمی را ببیند.
5. حداقل یک اتوماسیون از UI روشن/خاموش شود و روی worker اجرا شود.
6. هیچ مسیر پس‌زمینه‌ای فقط با `"reza"` نچرخد مگر seed توسعه.

---

## ۸) تصمیم‌های باز (باقی‌مانده — بقیه قفل شد)

| موضوع | وضعیت |
|--------|--------|
| single-org vs multi-tenant | **قفل: single-org** |
| Visibility vs Board کامل | **قفل: Private \| Team** |
| Owner جدا از Admin | **قفل فعلاً: نه (YAGNI)** |
| Billing | **قفل: خارج از scope** |
| توکن جیرا per-user vs service-account | باز — پیش‌فرض پیشنهادی: per-user + encryption؛ service-account اختیاری بعدی |
| خدنگ: سراسری نصب یا per-profile | باز — پیش‌فرض: الگوی سراسری نصب + override در پروفایل |
| ایمیل digest روزانه | باز — فعلاً فقط بازیابی/اعلان از ntfy |

---

## ۹) ترتیب اجرای بعدی (تأییدشده)

1. پاک‌سازی `reza` fallback + Profile Identity (**فاز A**)
2. Visibility ساده Private/Team (**فاز A+**)
3. صفحه Work Profile + توکن رمزنگاری‌شده (**فاز B**)
4. Automations v1 روی worker + ۳ قالب (**فاز C**)
5. مستند onboarding ادمین (**فاز E**)

---

## ۱۰) ارجاع فایل‌های کلیدی

- Auth / بازیابی: `backend/TaskOS.Api/Services/AuthService.cs`, `PushNotificationService`
- Forgot / Set password UI: `ForgotPasswordPage.tsx`, `SetPasswordPage.tsx`
- Markdown: `MarkdownBody.tsx`, `frontend/src/lib/jira.ts`
- کامنت‌ها / اعلان‌ها: `TaskCommentThread.tsx`, `NotificationsPage.tsx`
- روز کاری: close/rollover + `CloseDayReportModal`
- جداسازی کاربر: `CurrentUser`, `OwnerUserId` در repositoryها

---

*فاز ۰ قفل است. پیاده‌سازی بعدی از فاز A شروع می‌شود؛ multi-tenant و billing عمداً ساخته نمی‌شوند مگر این سند عوض شود.*
