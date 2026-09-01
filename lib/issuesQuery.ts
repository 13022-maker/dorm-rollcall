// 報修／鑰匙房卡問題的資料庫查詢，只給 server 端（admin/page.tsx 等）用，
// 不要被 client component import——含 db 連線的模組絕不能進到瀏覽器端打包。
import { db } from '@/db';
import { issueReports } from '@/db/schema';
import { ne, asc } from 'drizzle-orm';
import type { IssueType, IssueStatus, IssueRow } from './issues';

// 取得所有尚未結案（PENDING / IN_PROGRESS）的報修與鑰匙問題，給 Admin 看板做 icon 標籤與展開內容用
export async function getOpenIssues(): Promise<IssueRow[]> {
  const rows = await db
    .select({
      id: issueReports.id,
      studentId: issueReports.studentId,
      reportType: issueReports.reportType,
      maintenanceItem: issueReports.maintenanceItem,
      issueDescription: issueReports.issueDescription,
      contactPhone: issueReports.contactPhone,
      status: issueReports.status,
      createdAt: issueReports.createdAt,
    })
    .from(issueReports)
    .where(ne(issueReports.status, 'RESOLVED'))
    .orderBy(asc(issueReports.createdAt));

  return rows.map((r) => ({
    ...r,
    reportType: r.reportType as IssueType,
    status: r.status as IssueStatus,
  }));
}
