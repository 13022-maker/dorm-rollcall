import { NextRequest } from 'next/server';
import { getNightRows } from '@/lib/query';
import { STATUS_LABEL, formatTaipeiTime, rollcallDateFor } from '@/lib/rollcall';

export const dynamic = 'force-dynamic';

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || rollcallDateFor(new Date());
  const { rollcallDate, rows } = await getNightRows(date);

  const header = ['樓別', '班級', '房號', '姓名', '性別', '狀態', '回報時間', '逾時說明'];
  const lines = rows.map((r) =>
    [
      r.building,
      r.className,
      r.room ?? '',
      r.name,
      r.gender ?? '',
      STATUS_LABEL[r.status],
      r.reportedAt ? formatTaipeiTime(r.reportedAt, rollcallDate) : '',
      r.explanation ?? '',
    ]
      .map(csvCell)
      .join(',')
  );
  const body = '\uFEFF' + [header.join(','), ...lines].join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rollcall_${rollcallDate}.csv"`,
    },
  });
}
