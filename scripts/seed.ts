import 'dotenv/config';
import { db } from '../db';
import { students } from '../db/schema';
import { seedStudents } from '../db/students.seed';
import { sql } from 'drizzle-orm';

// 重跑會清空 students（連帶 rollcalls）再重新匯入，方便名單異動後同步。
async function main() {
  console.log(`匯入 ${seedStudents.length} 位學生…`);
  await db.execute(sql`TRUNCATE TABLE students RESTART IDENTITY CASCADE`);
  await db.insert(students).values(
    seedStudents.map((s) => ({
      region: s.region ?? null,
      building: s.building,
      className: s.className,
      studentNo: s.studentNo,
      name: s.name,
      gender: s.gender,
      room: s.room,
      floor: s.floor,
      company: s.company ?? null,
      note: s.note,
    }))
  );
  const res = await db.execute(sql`SELECT COUNT(*)::int AS n FROM students`);
  const n = (res.rows?.[0] as { n: number } | undefined)?.n ?? seedStudents.length;
  console.log(`完成，目前 students 共 ${n} 筆。`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
