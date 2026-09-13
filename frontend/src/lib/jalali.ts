const G_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

export const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

export function gregorianToJalali(gy: number, gm: number, gd: number) {
  const gy2 = gm > 2 ? gy + 1 : gy
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    G_DAYS[gm - 1]
  let jy = -1595 + 33 * Math.floor(days / 12053)
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return { jy, jm, jd }
}

export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  jy += 1595
  let days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)
  let gy = 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524)
    days %= 36524
    if (days >= 365) days += 1
  }
  gy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    gy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  let gd = days + 1
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0
  const sal = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 1
  while (gm <= 12 && gd > sal[gm]) {
    gd -= sal[gm]
    gm += 1
  }
  return { gy, gm, gd }
}

export function isoToJalali(iso: string) {
  const [gy, gm, gd] = iso.split('-').map(Number)
  return gregorianToJalali(gy, gm, gd)
}

export function jalaliToIso(jy: number, jm: number, jd: number) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${gy}-${pad(gm)}-${pad(gd)}`
}

export function jalaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  const { gy, gm, gd } = jalaliToGregorian(jy, 12, 29)
  const next = new Date(gy, gm - 1, gd + 1)
  const j = gregorianToJalali(next.getFullYear(), next.getMonth() + 1, next.getDate())
  return j.jm === 12 ? 30 : 29
}

export function shiftJalaliMonth(jy: number, jm: number, delta: number) {
  const index = jy * 12 + (jm - 1) + delta
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 }
}

export function saturdayIndex(iso: string) {
  const [gy, gm, gd] = iso.split('-').map(Number)
  const weekday = new Date(gy, gm - 1, gd).getDay()
  return (weekday + 1) % 7
}

export function toFaDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}
