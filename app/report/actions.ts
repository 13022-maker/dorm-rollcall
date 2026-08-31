'use server';

import { db } from '@/db';
import { rollcalls, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { classify, STATUS_LABEL, formatTaipeiTime } from '@/lib/rollcall';

export type ReportResult =
  | { ok: true; status: 'on_time' | 'late' | 'overdue'; label: string; time: string; rollcallDate: string }
  | { ok: false; error: 'NEED_EXPLANATION' | 'INVALID' | 'SERVER'; message: string };

export async function submitReport(
  studentId: number,
  region: string,
  explanation?: string
): Promise<ReportResult> {
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { ok: false, error: 'INVALID', message: '請先選擇你的姓名' };
  }

  // 伺服器端再驗證一次：這個學生真的屬於呼叫端聲稱的宿舍（region），
  // 不能只信任前端傳來的 studentId——避免竄改 payload 冒用別的宿舍身分回報。
  const [student] = await db
    .select({ region: students.region, active: students.active })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student || student.region !== region) {
    return { ok: false, error: 'INVALID', message: '這個帳號不屬於此回報頁面，請確認網址是否正確' };
  }
  if (!student.active) {
    return { ok: false, error: 'INVALID', message: '此帳號目前為停用狀態，不開放回報，請聯絡舍監' };
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
