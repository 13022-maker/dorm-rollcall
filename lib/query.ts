import { db } from '@/db';
import { students, rollcalls } from '@/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { rollcallDateFor, type RowStatus } from './rollcall';

export type NightRow = {
  id: number;
  region: string | null;
  building: string;
  className: string;
  studentNo: string | null;
  name: string;
  gender: string | null;
  room: string | null;
  floor: number | null;
  company: string | null;
  status: RowStatus;
  reportedAt: Date | null;
  explanation: string | null;
};

// 取得某一夜（預設今晚）全體名單 + 回報狀態，未回報者 status = 'unreported'
export async function getNightRows(rollcallDate = rollcallDateFor(new Date())): Promise<{
  rollcallDate: string;
  rows: NightRow[];
}> {
  const raw = await db
    .select({
      id: students.id,
      region: students.region,
      building: students.building,
      className: students.className,
      studentNo: students.studentNo,
      name: students.name,
      gender: students.gender,
      room: students.room,
      floor: students.floor,
      company: students.company,
      status: rollcalls.status,
      reportedAt: rollcalls.reportedAt,
      explanation: rollcalls.explanation,
    })
    .from(students)
    .leftJoin(
      rollcalls,
      and(eq(rollcalls.studentId, students.id), eq(rollcalls.rollcallDate, rollcallDate))
    )
    .orderBy(asc(students.building), asc(students.className), asc(students.room), asc(students.name));

  const rows: NightRow[] = raw.map((r) => ({
    id: r.id,
    region: r.region,
    building: r.building,
    className: r.className,
    studentNo: r.studentNo,
    name: r.name,
    gender: r.gender,
    room: r.room,
    floor: r.floor,
    company: r.company,
    status: (r.status as RowStatus) ?? 'unreported',
    reportedAt: r.reportedAt ?? null,
    explanation: r.explanation ?? null,
  }));

  return { rollcallDate, rows };
}
