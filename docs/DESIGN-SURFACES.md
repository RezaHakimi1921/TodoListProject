# سطوح دیزاین‌شده TaskOS

فهرست سطوحی که الان UI برایشان طراحی شده (تم تیره، RTL، فارسی). این فهرست طراحی جدید نیست؛ نقشه نقاط بررسی دیزاین است.

## وب — صفحات و مسیرها

| مسیر | فایل | چه دیزاین شده |
|---|---|---|
| `/` کارهای امروز | `frontend/src/pages/DashboardPage.tsx` | هدر روز، تفکیک Deep/Light، فیلتر وضعیت، افزودن سریع، نمای استاندارد / زن، rollover پایان روز |
| `/tasks/:id` جزئیات کار | `frontend/src/pages/TaskDetailPage.tsx` | ویرایش عنوان/وضعیت/انرژی، **چک‌لیست مراحل**، Work Logهای مرتبط، تایم‌لاین |
| `/work` ثبت کار و زمان | `frontend/src/pages/WorkLogPage.tsx` | خلاصه روز، گروه‌بندی fuzzy، کپی برای Jira |
| `/problems` استودیوی مسئله | `frontend/src/pages/ProblemsPage.tsx` | لیست مسئله‌ها و وضعیت Exploring/Chosen/Validated |
| `/problems/:id` استودیو | `frontend/src/pages/ProblemStudioPage.tsx` | گزینه‌ها، قید برعکس، توضیح جونیور، پیش‌مرگ، انتخاب و تست |
| `/daily` دفترچه یادگیری | `frontend/src/pages/DailyLogPage.tsx` | یادداشت پایان روز و کارهای همان روز |
| `/trash` سطل زباله | `frontend/src/pages/TrashPage.tsx` | برگرداندن / حذف دائم |
| `/settings` تنظیمات | `frontend/src/pages/SettingsPage.tsx` | فاصله پینگ، روشن/خاموش سیستم، تست فرم ویندوز |

## وب — کامپوننت‌های مشترک

| سطح | فایل | یادداشت |
|---|---|---|
| شل و نو | `frontend/src/components/Layout.tsx` | ناوبری RTL، لینک بخش‌ها، فوکوس فعل |
| کارت تسک | `frontend/src/components/TaskCard.tsx` | وضعیت، انرژی، aging، پیشرفت چک‌لیست، اکشن‌های focus/ویرایش/سطل |
| افزودن سریع | `frontend/src/components/QuickAddTask.tsx` | عنوان + Deep/Light + برچسب |
| کشوی ویرایش تسک | `frontend/src/components/TaskEditorDrawer.tsx` | همان فیلدهای جزئیات + چک‌لیست + تایم‌لاین |
| چک‌لیست مراحل | `frontend/src/components/TaskChecklist.tsx` | اینلاین، بدون بخش خالی وقتی آیتمی نیست |
| پاپ‌آپ Work Log وب | `frontend/src/components/WorkLogPrompt.tsx` | کار + دقیقه اجباری، استراحت، کار/مسئله جدید |
| تأیید | `frontend/src/components/ConfirmProvider.tsx` | جایگزین `window.confirm` |
| Aging | `frontend/src/components/AgingModal.tsx` | چهار دلیل فارسی برای تسک راکد |
| تشابه | `frontend/src/components/SimilarTasksHint.tsx` | تسک‌های Done شبیه |
| Work Log موجودیت | `frontend/src/components/EntityWorkLogs.tsx` | لاگ‌های وبسته به تسک یا مسئله |

## ویندوز — فرم پینگ

| سطح | فایل | یادداشت |
|---|---|---|
| پاپ‌آپ وسط صفحه | `backend/TaskOS.Api/Services/WorkPingForm.cs` | لیست تفکیک‌شده کار/مسئله/استراحت، چیپ دقیقه، بدون دکمه بستن X |

## کروم — اکستنشن

| سطح | فایل | یادداشت |
|---|---|---|
| Popup اکستنشن | `extension/popup.html` + `popup.js` | فرم کوچک لاگ + idle |

## طراحیشده ولی پیاده‌نشده (فاز بعد)

- تمپلیت چک‌لیست (`ChecklistTemplate`) و apply روی تسک جدید
- Dependency / ترتیب اجباری بین Stepها
- Query/File/Note روی هر Step (اینها همچنان تایم‌لاین Task می‌مانند)
- Drag & Drop برای ترتیب Step (فاز اول: دکمه بالا/پایین)
- فلو Jira از اکستنشن (فقط طراحی شده، ساخته نشده)
