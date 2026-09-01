import { getNightRows } from '@/lib/query';
import { formatRollcallDate, rollcallDateFor } from '@/lib/rollcall';
import { getOpenIssues } from '@/lib/issuesQuery';
import type { IssueRow } from '@/lib/issues';
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

  // 尚未結案的報修／鑰匙房卡問題，依學生 id 分組給看板加 icon 標籤與展開內容用
  const openIssues = await getOpenIssues();
  const issuesByStudent: Record<number, IssueRow[]> = {};
  for (const issue of openIssues) {
    (issuesByStudent[issue.studentId] ??= []).push(issue);
  }
  const issuesPayload = Object.fromEntries(
    Object.entries(issuesByStudent).map(([sid, list]) => [
      sid,
      list.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
    ])
  );

  return (
    <AdminClient
      rollcallDate={rollcallDate}
      dateLabel={formatRollcallDate(rollcallDate)}
      today={rollcallDateFor(new Date())}
      rows={payload}
      issuesByStudent={issuesPayload}
    />
  );
}
