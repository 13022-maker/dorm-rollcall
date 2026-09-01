'use server';

import { db } from '@/db';
import { issueReports, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ISSUE_TYPE_LABEL, type IssueType } from '@/lib/issues';

export type IssueSubmitResult =
  | { ok: true; typeLabel: string }
  | { ok: false; message: string };

export async function submitIssueReport(input: {
  studentId: number;
  region: string;
  reportType: IssueType;
  maintenanceItem: string | null;
  issueDescription: string;
  contactPhone: string | null;
}): Promise<IssueSubmitResult> {
  const { studentId, region, reportType, maintenanceItem, issueDescription, contactPhone } = input;

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { ok: false, message: '請先選擇你的姓名' };
  }
  if (!['MAINTENANCE', 'KEY_CARD_ISSUE', 'OTHER'].includes(reportType)) {
    return { ok: false, message: '回報類型錯誤' };
  }
  if (!issueDescription.trim()) {
    return { ok: false, message: '請填寫狀況說明' };
  }

  // 伺服器端再驗證一次這個學生真的屬於這個回報入口的宿舍，同 submitReport 的作法。
  const [student] = await db
    .select({ region: students.region, active: students.active })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student || student.region !== region) {
    return { ok: false, message: '這個帳號不屬於此回報頁面，請確認網址是否正確' };
  }
  if (!student.active) {
    return { ok: false, message: '此帳號目前為停用狀態，不開放回報，請聯絡舍監' };
  }

  try {
    await db.insert(issueReports).values({
      studentId,
      reportType,
      maintenanceItem: maintenanceItem?.trim() || null,
      issueDescription: issueDescription.trim(),
      contactPhone: contactPhone?.trim() || null,
      status: 'PENDING',
    });
  } catch (e) {
    console.error('submitIssueReport failed', e);
    return { ok: false, message: '系統忙碌，請稍後再試一次' };
  }

  return { ok: true, typeLabel: ISSUE_TYPE_LABEL[reportType] };
}
