import { db } from '@/db';
import { students } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { needsExplanationNow, rollcallDateFor, formatRollcallDate } from '@/lib/rollcall';
import ReportForm from './ReportForm';

export const dynamic = 'force-dynamic';

export default async function ReportPage() {
  const list = await db
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
    .orderBy(asc(students.building), asc(students.room), asc(students.name));

  const now = new Date();
  const rollcallDate = rollcallDateFor(now);

  return (
    <main className="wrap">
      <header className="head">
        <h1>宿舍夜間點名回報</h1>
        <p className="sub">{formatRollcallDate(rollcallDate)} 當夜 · 請於 23:00 前完成回報</p>
      </header>
      <ReportForm students={list} overdueNow={needsExplanationNow(now)} />
      <p className="foot">回報即代表你人已在宿舍。若已過 24:00 需填寫說明事由。</p>
    </main>
  );
}
