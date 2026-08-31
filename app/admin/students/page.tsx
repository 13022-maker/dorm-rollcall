import { db } from '@/db';
import { students } from '@/db/schema';
import { asc } from 'drizzle-orm';
import StudentsClient from './StudentsClient';

export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  const rows = await db
    .select()
    .from(students)
    .orderBy(asc(students.building), asc(students.room), asc(students.name));

  return <StudentsClient students={rows} />;
}
