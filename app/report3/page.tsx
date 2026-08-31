import { getReportStudents } from '@/lib/report';
import { needsExplanationNow, rollcallDateFor, formatRollcallDate } from '@/lib/rollcall';
import ReportForm from '../report/ReportForm';

export const dynamic = 'force-dynamic';

const REGION = '萬能';

export default async function Report3Page() {
  const list = await getReportStudents(REGION);

  const now = new Date();
  const rollcallDate = rollcallDateFor(now);

  return (
    <main className="wrap">
      <header className="head">
        <h1>{REGION}宿舍夜間點名回報</h1>
        <p className="sub">{formatRollcallDate(rollcallDate)} 當夜 · 請於 23:00 前完成回報</p>
      </header>
      <ReportForm students={list} overdueNow={needsExplanationNow(now)} region={REGION} />
      <p className="foot">回報即代表你人已在宿舍。若已過 24:00 需填寫說明事由。</p>
    </main>
  );
}
