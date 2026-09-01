'use server';

import { db } from '@/db';
import { rollcalls, issueReports } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { IssueStatus } from '@/lib/issues';

export type ActionResult = { ok: true } | { ok: false; message: string };

// 舍監解鎖：刪掉這位學生「這一夜」的點名紀錄，讓他可以在 /report 系列重新回報一次。
// 學生端一旦回報成功就鎖定不能自己改，要修改只能請舍監在這裡解鎖。
export async function resetRollcall(studentId: number, rollcallDate: string): Promise<ActionResult> {
  try {
    await db
      .delete(rollcalls)
      .where(and(eq(rollcalls.studentId, studentId), eq(rollcalls.rollcallDate, rollcallDate)));
  } catch (e) {
    console.error('resetRollcall failed', e);
    return { ok: false, message: '解鎖失敗，請稍後再試' };
  }

  revalidatePath('/admin');
  revalidatePath('/report');
  revalidatePath('/report2');
  revalidatePath('/report3');
  return { ok: true };
}

// 更新報修／鑰匙房卡問題的處理進度
export async function updateIssueStatus(id: number, status: IssueStatus): Promise<ActionResult> {
  try {
    await db.update(issueReports).set({ status, updatedAt: new Date() }).where(eq(issueReports.id, id));
  } catch (e) {
    console.error('updateIssueStatus failed', e);
    return { ok: false, message: '更新失敗，請稍後再試' };
  }

  revalidatePath('/admin');
  return { ok: true };
}
