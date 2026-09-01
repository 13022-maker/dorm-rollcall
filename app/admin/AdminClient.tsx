'use client';

import { Fragment, useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatTaipeiTime,
  type RowStatus,
} from '@/lib/rollcall';
import {
  ISSUE_TYPE_LABEL,
  ISSUE_TYPE_ICON,
  ISSUE_STATUS_LABEL,
  type IssueType,
  type IssueStatus,
} from '@/lib/issues';
import { resetRollcall, updateIssueStatus } from './actions';

type Row = {
  id: number;
  region: string | null;
  building: string;
  className: string;
  studentNo: string | null;
  name: string;
  gender: string | null;
  room: string | null;
  floor: number | null;
  company: string | null;
  status: RowStatus;
  reportedAt: string | null;
  explanation: string | null;
};

type Issue = {
  id: number;
  studentId: number;
  reportType: IssueType;
  maintenanceItem: string | null;
  issueDescription: string | null;
  contactPhone: string | null;
  status: IssueStatus;
  createdAt: string;
};

const STATUS_ORDER: RowStatus[] = ['unreported', 'overdue', 'late', 'on_time'];
const ISSUE_STATUS_ORDER: IssueStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

// 給日期字串（YYYY-MM-DD）加減幾天，回傳一樣格式的字串
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function AdminClient({
  rollcallDate,
  dateLabel,
  today,
  rows,
  issuesByStudent,
}: {
  rollcallDate: string;
  dateLabel: string;
  today: string;
  rows: Row[];
  issuesByStudent: Record<number, Issue[]>;
}) {
  const router = useRouter();
  const isToday = rollcallDate === today;
  const [region, setRegion] = useState('');
  const [building, setBuilding] = useState('');
  const [cls, setCls] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState<RowStatus | ''>('');
  const [issueOnly, setIssueOnly] = useState(false); // 只看有未結案報修/鑰匙房卡問題的人
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null); // 展開中的學生 id（報修詳情）
  const [confirmUnlockId, setConfirmUnlockId] = useState<number | null>(null);
  const [opError, setOpError] = useState('');
  const [pending, start] = useTransition();

  function toggleExpand(studentId: number) {
    setExpanded((cur) => (cur === studentId ? null : studentId));
  }

  // 舍監解鎖：刪掉今晚這筆點名紀錄，讓學生可以在 /report 系列重新回報
  function unlock(studentId: number) {
    setOpError('');
    start(async () => {
      const r = await resetRollcall(studentId, rollcallDate);
      if (!r.ok) {
        setOpError(r.message);
        return;
      }
      setConfirmUnlockId(null);
      router.refresh();
    });
  }

  function setIssueStatus(issueId: number, next: IssueStatus) {
    setOpError('');
    start(async () => {
      const r = await updateIssueStatus(issueId, next);
      if (!r.ok) {
        setOpError(r.message);
        return;
      }
      router.refresh();
    });
  }

  function goToDate(date: string) {
    router.push(date === today ? '/admin' : `/admin?date=${date}`);
  }

  // 只有看「今晚」才需要每 20 秒自動刷新；查過去的夜晚資料不會再變，刷新只是浪費
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => {
      router.refresh();
      setTick((n) => n + 1);
    }, 20_000);
    return () => clearInterval(t);
  }, [router, isToday]);

  const regions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.region).filter((v): v is string => !!v))).sort(),
    [rows]
  );
  // 選了地區時，樓別選單只列出該地區底下的校舍
  const buildings = useMemo(() => {
    const inRegion = region ? rows.filter((r) => r.region === region) : rows;
    return Array.from(new Set(inRegion.map((r) => r.building))).sort();
  }, [rows, region]);
  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.className))), [rows]);

  function chooseRegion(v: string) {
    setRegion(v);
    setBuilding(''); // 換地區後樓別選項會變，先清掉避免選到不存在的組合
  }

  // 除了「狀態」以外的篩選條件（地區/樓別/班級/性別/搜尋）都先套用，
  // 統計卡片（回報率、各狀態人數）以這個範圍為準，才會隨著選的宿舍/樓別即時連動；
  // 「狀態」本身不套在這裡，因為卡片本來就是要顯示「這個範圍內」各狀態各有幾人。
  const scoped = useMemo(() => {
    const kw = q.trim();
    return rows
      .filter((r) => (region ? r.region === region : true))
      .filter((r) => (building ? r.building === building : true))
      .filter((r) => (cls ? r.className === cls : true))
      .filter((r) => (gender ? r.gender === gender : true))
      .filter((r) => (kw ? r.name.includes(kw) || (r.room ?? '').includes(kw) : true));
  }, [rows, region, building, cls, gender, q]);

  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { on_time: 0, late: 0, overdue: 0, unreported: 0 };
    scoped.forEach((r) => (c[r.status] += 1));
    return c;
  }, [scoped]);

  const reported = counts.on_time + counts.late + counts.overdue;
  const pct = scoped.length ? Math.round((reported / scoped.length) * 100) : 0;

  // 這個範圍內有未結案報修/鑰匙房卡問題的人數
  const issueCount = useMemo(
    () => scoped.filter((r) => (issuesByStudent[r.id] ?? []).length > 0).length,
    [scoped, issuesByStudent]
  );

  const filtered = useMemo(() => {
    return scoped
      .filter((r) => (status ? r.status === status : true))
      .filter((r) => (issueOnly ? (issuesByStudent[r.id] ?? []).length > 0 : true))
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          (a.room ?? '').localeCompare(b.room ?? '') ||
          a.name.localeCompare(b.name)
      );
  }, [scoped, status, issueOnly, issuesByStudent]);

  return (
    <main className="wrap wide">
      <header className="head row">
        <div>
          <h1>夜間點名看板{region && `・${region}`}</h1>
          <p className="sub">
            {dateLabel} 當夜{!isToday && '（非今晚）'} · 共 {scoped.length} 人{scoped.length !== rows.length && `（全部 ${rows.length} 人）`}
            {isToday && ' · 每 20 秒自動更新'}
          </p>
        </div>
        <div className="opcell">
          <a className="btn ghost sm" href="/admin/students">
            名單管理
          </a>
          <a className="btn ghost sm" href={`/admin/export?date=${rollcallDate}`}>
            匯出 CSV
          </a>
        </div>
      </header>

      <section className="opcell" style={{ marginBottom: 16 }}>
        <button className="btn ghost sm" onClick={() => goToDate(shiftDate(rollcallDate, -1))}>
          ‹ 前一夜
        </button>
        <input
          type="date"
          value={rollcallDate}
          max={today}
          onChange={(e) => e.target.value && goToDate(e.target.value)}
        />
        <button className="btn ghost sm" disabled={isToday} onClick={() => goToDate(shiftDate(rollcallDate, 1))}>
          後一夜 ›
        </button>
        {!isToday && (
          <button className="btn ghost sm" onClick={() => goToDate(today)}>
            回今晚
          </button>
        )}
      </section>

      <section className="stats">
        <Stat label="回報率" value={`${pct}%`} sub={`${reported}/${scoped.length}`} color="#0f172a" active={false} onClick={() => setStatus('')} />
        <Stat label={STATUS_LABEL.unreported} value={counts.unreported} color={STATUS_COLOR.unreported} active={status === 'unreported'} onClick={() => setStatus(status === 'unreported' ? '' : 'unreported')} />
        <Stat label={STATUS_LABEL.overdue} value={counts.overdue} color={STATUS_COLOR.overdue} active={status === 'overdue'} onClick={() => setStatus(status === 'overdue' ? '' : 'overdue')} />
        <Stat label={STATUS_LABEL.late} value={counts.late} color={STATUS_COLOR.late} active={status === 'late'} onClick={() => setStatus(status === 'late' ? '' : 'late')} />
        <Stat label={STATUS_LABEL.on_time} value={counts.on_time} color={STATUS_COLOR.on_time} active={status === 'on_time'} onClick={() => setStatus(status === 'on_time' ? '' : 'on_time')} />
        <Stat label="報修中" value={issueCount} color="#7c3aed" active={issueOnly} onClick={() => setIssueOnly((v) => !v)} />
      </section>

      <section className="filters">
        {regions.length > 0 && (
          <select value={region} onChange={(e) => chooseRegion(e.target.value)}>
            <option value="">全部地區</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <select value={building} onChange={(e) => setBuilding(e.target.value)}>
          <option value="">全部樓別</option>
          {buildings.map((b) => (
            <option key={b} value={b}>
              {b} 棟
            </option>
          ))}
        </select>
        <select value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">全部班級</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">全部性別</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
        <input
          placeholder="搜尋姓名 / 房號"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(region || building || cls || gender || status || issueOnly || q) && (
          <button className="btn ghost sm" onClick={() => { setRegion(''); setBuilding(''); setCls(''); setGender(''); setStatus(''); setIssueOnly(false); setQ(''); }}>
            清除
          </button>
        )}
      </section>

      <p className="count">符合 {filtered.length} 人</p>
      {opError && <p className="err">{opError}</p>}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>狀態</th>
              <th>房號</th>
              <th>姓名</th>
              <th>班級</th>
              <th>性別</th>
              <th>工讀公司</th>
              <th>回報時間</th>
              <th>逾時說明</th>
              <th>報修/鑰匙</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const issues = issuesByStudent[r.id] ?? [];
              const isExpanded = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      <span className="pill" style={{ background: STATUS_COLOR[r.status] }}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td>{r.room ?? '—'}</td>
                    <td className="nm">{r.name}</td>
                    <td className="dim">{r.className}</td>
                    <td>{r.gender ?? '—'}</td>
                    <td className="dim">{r.company ?? '—'}</td>
                    <td className="dim">
                      {r.reportedAt ? formatTaipeiTime(new Date(r.reportedAt), rollcallDate) : '—'}
                    </td>
                    <td className="exp">{r.explanation ?? ''}</td>
                    <td>
                      {issues.length > 0 ? (
                        <button className="icon-badges" onClick={() => toggleExpand(r.id)} title="點擊查看詳情">
                          {Array.from(new Set(issues.map((i) => i.reportType))).map((t) => (
                            <span key={t}>{ISSUE_TYPE_ICON[t]}</span>
                          ))}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="opcell">
                      {isToday && r.status !== 'unreported' && (
                        confirmUnlockId === r.id ? (
                          <>
                            <button className="btn danger sm" disabled={pending} onClick={() => unlock(r.id)}>
                              確定解鎖
                            </button>
                            <button className="btn ghost sm" onClick={() => setConfirmUnlockId(null)}>取消</button>
                          </>
                        ) : (
                          <button className="btn ghost sm" onClick={() => setConfirmUnlockId(r.id)}>
                            解鎖重填
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                  {isExpanded && issues.length > 0 && (
                    <tr className="issue-detail-row">
                      <td colSpan={10}>
                        <div className="issue-list">
                          {issues.map((i) => (
                            <div className="issue-item" key={i.id}>
                              <div className="issue-item-head">
                                <span>{ISSUE_TYPE_ICON[i.reportType]} {ISSUE_TYPE_LABEL[i.reportType]}</span>
                                {i.maintenanceItem && <span className="dim">・{i.maintenanceItem}</span>}
                                <span className="dim">・{formatTaipeiTime(new Date(i.createdAt))}</span>
                              </div>
                              <p className="issue-item-desc">{i.issueDescription}</p>
                              {i.contactPhone && <p className="dim">聯絡方式：{i.contactPhone}</p>}
                              <div className="opcell">
                                {ISSUE_STATUS_ORDER.map((st) => (
                                  <button
                                    key={st}
                                    className={`btn sm ${i.status === st ? 'primary' : 'ghost'}`}
                                    disabled={pending}
                                    onClick={() => setIssueStatus(i.id, st)}
                                  >
                                    {ISSUE_STATUS_LABEL[st]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">沒有符合條件的學生</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`stat${active ? ' on' : ''}`} style={{ borderColor: color }} onClick={onClick}>
      <span className="stat-v" style={{ color }}>{value}</span>
      <span className="stat-l">{label}</span>
      {sub && <span className="stat-s">{sub}</span>}
    </button>
  );
}
