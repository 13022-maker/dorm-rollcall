import { getNightRows } from '@/lib/query';
import { formatRollcallDate, rollcallDateFor } from '@/lib/rollcall';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  // 網址帶的日期格式不對就當沒帶，退回今晚，不要讓髒資料打進 SQL
  const requestedDate = date && DATE_RE.test(date) ? date : undefined;

  const { rollcallDate, rows } = await getNightRows(requestedDate);
  const payload = rows.map((r) => ({
    ...r,
    reportedAt: r.reportedAt ? r.reportedAt.toISOString() : null,
  }));
  return (
    <AdminClient
      rollcallDate={rollcallDate}
      dateLabel={formatRollcallDate(rollcallDate)}
      today={rollcallDateFor(new Date())}
      rows={payload}
    />
  );
}
