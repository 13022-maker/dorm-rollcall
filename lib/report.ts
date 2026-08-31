import { db } from '@/db';
import { students } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

// /report、/report2、/report3 共用：依「地區」（明新/啟英/萬能）取回該宿舍自己的學生名單。
// 從資料庫層就把其他宿舍的資料過濾掉，而不是只在畫面上隱藏，避免選錯、也避免多餘的資料外洩到不相關的頁面。
export async function getReportStudents(region: string) {
  return db
    .select({
      id: students.id,
      building: students.building,
      className: students.className,
      name: students.name,
      room: students.room,
      floor: students.floor,
      gender: students.gender,
    })
    .from(students)
    .where(eq(students.region, region))
    .orderBy(asc(students.building), asc(students.room), asc(students.name));
}
