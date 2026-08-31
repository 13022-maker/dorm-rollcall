'use server';

import { db } from '@/db';
import { students } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type StudentInput = {
  region: string | null;
  building: string;
  className: string;
  studentNo: string | null;
  name: string;
  gender: string | null;
  room: string | null;
  floor: number | null;
  company: string | null;
  note: string | null;
};

export type ActionResult = { ok: true } | { ok: false; message: string };

function validate(input: StudentInput): string | null {
  if (!input.building.trim()) return '樓別必填';
  if (!input.className.trim()) return '班級必填';
  if (!input.name.trim()) return '姓名必填';
  return null;
}

// 新增一位學生
export async function addStudent(input: StudentInput): Promise<ActionResult> {
  const err = validate(input);
  if (err) return { ok: false, message: err };

  try {
    await db.insert(students).values(input);
  } catch (e) {
    console.error('addStudent failed', e);
    return { ok: false, message: '新增失敗，請稍後再試' };
  }

  revalidatePath('/admin/students');
  revalidatePath('/admin');
  revalidatePath('/report');
  return { ok: true };
}

// 修改一位學生的資料
export async function updateStudent(id: number, input: StudentInput): Promise<ActionResult> {
  const err = validate(input);
  if (err) return { ok: false, message: err };

  try {
    await db.update(students).set(input).where(eq(students.id, id));
  } catch (e) {
    console.error('updateStudent failed', e);
    return { ok: false, message: '儲存失敗，請稍後再試' };
  }

  revalidatePath('/admin/students');
  revalidatePath('/admin');
  revalidatePath('/report');
  return { ok: true };
}

// 刪除一位學生（連同他的回報紀錄一起刪除，資料庫外鍵設定 cascade）
export async function deleteStudent(id: number): Promise<ActionResult> {
  try {
    await db.delete(students).where(eq(students.id, id));
  } catch (e) {
    console.error('deleteStudent failed', e);
    return { ok: false, message: '刪除失敗，請稍後再試' };
  }

  revalidatePath('/admin/students');
  revalidatePath('/admin');
  revalidatePath('/report');
  return { ok: true };
}

// 批次刪除多位學生（連同他們的回報紀錄一起刪除）
export async function deleteStudents(ids: number[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };

  try {
    await db.delete(students).where(inArray(students.id, ids));
  } catch (e) {
    console.error('deleteStudents failed', e);
    return { ok: false, message: '刪除失敗，請稍後再試' };
  }

  revalidatePath('/admin/students');
  revalidatePath('/admin');
  revalidatePath('/report');
  return { ok: true };
}
