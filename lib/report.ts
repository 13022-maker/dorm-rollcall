import { db } from '@/db';
import { students, rollcalls } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { rollcallDateFor, type RowStatus } from './rollcall';

// /report、/report2、/report3 共用：依「地區」（明新/啟英/萬能）取回該宿舍自己的學生名單，
// 一併 join「今晚」的點名紀錄，讓學生選房號/點名字時能看到室友的簽到狀態（準時/遲報/逾時/未簽到）。
// 從資料庫層就把其他宿舍的資料過濾掉，而不是只在畫面上隱藏，避免選錯、也避免多餘的資料外洩到不相關的頁面。
// active = false 的人（目前不住宿舍，例如返校上課但實際住別區）不會出現在任何回報選單裡。
export async function getReportStudents(region: string) {
  const rollcallDate = rollcallDateFor(new Date());

  const rows = await db
    .select({
      id: students.id,
      building: students.building,
      className: students.className,
      name: students.name,
      room: students.room,
      floor: students.floor,
      gender: students.gender,
      status: rollcalls.status,
      reportedAt: rollcalls.reportedAt,
    })
    .from(students)
    .leftJoin(
      rollcalls,
      and(eq(rollcalls.studentId, students.id), eq(rollcalls.rollcallDate, rollcallDate))
    )
    .where(and(eq(students.region, region), eq(students.active, true)))
    .orderBy(asc(students.building), asc(students.room), asc(students.name));

  return rows.map((r) => ({
    ...r,
    status: (r.status as RowStatus | null) ?? ('unreported' as RowStatus),
    reportedAt: r.reportedAt ? r.reportedAt.toISOString() : null,
  }));
}
