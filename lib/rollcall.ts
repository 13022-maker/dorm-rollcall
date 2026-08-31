// 夜間點名的時間核心邏輯。台灣為 UTC+8 且無日光節約，直接用固定位移計算，
// 不依賴任何時區套件，避免伺服器時區設定造成誤差。

export const TZ_OFFSET_MIN = 8 * 60; // 台北 UTC+8

// 可調參數：準時線 23:00（11PM）、遲報線 24:00（凌晨 00:00）。
// 之後若要改時間，只動這兩個常數即可。
export const ONTIME_DEADLINE_MIN = 23 * 60; // 距當夜 00:00 的分鐘數 → 23:00
export const LATE_DEADLINE_MIN = 24 * 60; // → 24:00（隔日 00:00）

export type RollStatus = 'on_time' | 'late' | 'overdue';
export type RowStatus = RollStatus | 'unreported';

export const STATUS_LABEL: Record<RowStatus, string> = {
  on_time: '準時',
  late: '遲報',
  overdue: '逾時',
  unreported: '未回報',
};

export const STATUS_COLOR: Record<RowStatus, string> = {
  on_time: '#16a34a', // 綠
  late: '#d97706', // 黃
  overdue: '#dc2626', // 紅
  unreported: '#6b7280', // 灰
};

// 把某個時間點換算成台北的牆上時間各欄位
function taipeiParts(d: Date) {
  const t = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth(), // 0-based
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    min: t.getUTCMinutes(),
  };
}

function ymd(y: number, m0: number, day: number) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 判斷某時間點屬於「哪一夜」的點名。以中午 12:00 為分界：
// 12:00–23:59 → 當天這一夜；00:00–11:59 → 前一天那一夜（凌晨補報仍算前夜）。
export function rollcallDateFor(d: Date): string {
  const p = taipeiParts(d);
  if (p.hour < 12) {
    const prev = new Date(Date.UTC(p.y, p.m, p.day) - 86_400_000);
    return ymd(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate());
  }
  return ymd(p.y, p.m, p.day);
}

// 某夜 00:00（台北）對應的 UTC 毫秒
function nightStartUtcMs(rollcallDate: string): number {
  const [y, m, day] = rollcallDate.split('-').map(Number);
  return Date.UTC(y, m - 1, day, 0, 0, 0) - TZ_OFFSET_MIN * 60_000;
}

// 回報時間距「當夜 00:00」的分鐘數（凌晨補報會 > 1440）
export function minutesIntoNight(rollcallDate: string, reportedAt: Date): number {
  return Math.floor((reportedAt.getTime() - nightStartUtcMs(rollcallDate)) / 60_000);
}

// 給定回報時間點，一次算出所屬點名夜、狀態、是否須填說明
export function classify(reportedAt: Date): {
  rollcallDate: string;
  status: RollStatus;
  requiresExplanation: boolean;
} {
  const rollcallDate = rollcallDateFor(reportedAt);
  const mins = minutesIntoNight(rollcallDate, reportedAt);
  let status: RollStatus;
  if (mins <= ONTIME_DEADLINE_MIN) status = 'on_time';
  else if (mins <= LATE_DEADLINE_MIN) status = 'late';
  else status = 'overdue';
  return { rollcallDate, status, requiresExplanation: status === 'overdue' };
}

// 現在（台北）是否已過 24:00 → 學生端要不要顯示「說明」欄位
export function needsExplanationNow(now: Date = new Date()): boolean {
  return classify(now).requiresExplanation;
}

// 顯示用：把時間格式化成台北 HH:mm（跨夜補報顯示「次日 00:30」）
export function formatTaipeiTime(d: Date, rollcallDate?: string): string {
  const p = taipeiParts(d);
  const hhmm = `${String(p.hour).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
  if (rollcallDate && ymd(p.y, p.m, p.day) !== rollcallDate) return `次日 ${hhmm}`;
  return hhmm;
}

export function formatRollcallDate(rollcallDate: string): string {
  const [, m, d] = rollcallDate.split('-');
  return `${Number(m)}/${Number(d)}`;
}
