'use server';

import { db } from '@/db';
import { rollcalls } from '@/db/schema';
import { classify, STATUS_LABEL, formatTaipeiTime } from '@/lib/rollcall';

export type ReportResult =
  | { ok: true; status: 'on_time' | 'late' | 'overdue'; label: string; time: string; rollcallDate: string }
  | { ok: false; error: 'NEED_EXPLANATION' | 'INVALID' | 'SERVER'; message: string };

export async function submitReport(
  studentId: number,
  explanation?: string
): Promise<ReportResult> {
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { ok: false, error: 'INVALID', message: '請先選擇你的姓名' };
  }

  const now = new Date();
  const { rollcallDate, status, requiresExplanation } = classify(now);
  const reason = explanation?.trim() || null;

  if (requiresExplanation && !reason) {
    return { ok: false, error: 'NEED_EXPLANATION', message: '已超過 24:00，請填寫逾時說明後再送出' };
  }

  try {
    await db
      .insert(rollcalls)
      .values({ studentId, rollcallDate, reportedAt: now, status, explanation: reason })
      .onConflictDoUpdate({
        target: [rollcalls.studentId, rollcalls.rollcallDate],
        set: { reportedAt: now, status, explanation: reason },
      });
  } catch (e) {
    console.error('submitReport failed', e);
    return { ok: false, error: 'SERVER', message: '系統忙碌，請稍後再試一次' };
  }

  return {
    ok: true,
    status,
    label: STATUS_LABEL[status],
    time: formatTaipeiTime(now, rollcallDate),
    rollcallDate,
  };
}
