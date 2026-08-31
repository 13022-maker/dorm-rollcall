import { getNightRows } from '@/lib/query';
import { formatRollcallDate } from '@/lib/rollcall';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { rollcallDate, rows } = await getNightRows();
  const payload = rows.map((r) => ({
    ...r,
    reportedAt: r.reportedAt ? r.reportedAt.toISOString() : null,
  }));
  return (
    <AdminClient
      rollcallDate={rollcallDate}
      dateLabel={formatRollcallDate(rollcallDate)}
      rows={payload}
    />
  );
}
