'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatTaipeiTime,
  type RowStatus,
} from '@/lib/rollcall';

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

const STATUS_ORDER: RowStatus[] = ['unreported', 'overdue', 'late', 'on_time'];

export default function AdminClient({
  rollcallDate,
  dateLabel,
  rows,
}: {
  rollcallDate: string;
  dateLabel: string;
  rows: Row[];
}) {
  const router = useRouter();
  const [region, setRegion] = useState('');
  const [building, setBuilding] = useState('');
  const [cls, setCls] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState<RowStatus | ''>('');
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);

  // 每 20 秒自動刷新伺服器資料
  useEffect(() => {
    const t = setInterval(() => {
      router.refresh();
      setTick((n) => n + 1);
    }, 20_000);
    return () => clearInterval(t);
  }, [router]);

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

  const filtered = useMemo(() => {
    return scoped
      .filter((r) => (status ? r.status === status : true))
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          (a.room ?? '').localeCompare(b.room ?? '') ||
          a.name.localeCompare(b.name)
      );
  }, [scoped, status]);

  return (
    <main className="wrap wide">
      <header className="head row">
        <div>
          <h1>夜間點名看板{region && `・${region}`}</h1>
          <p className="sub">
            {dateLabel} 當夜 · 共 {scoped.length} 人{scoped.length !== rows.length && `（全部 ${rows.length} 人）`} · 每 20 秒自動更新
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

      <section className="stats">
        <Stat label="回報率" value={`${pct}%`} sub={`${reported}/${scoped.length}`} color="#0f172a" active={false} onClick={() => setStatus('')} />
        <Stat label={STATUS_LABEL.unreported} value={counts.unreported} color={STATUS_COLOR.unreported} active={status === 'unreported'} onClick={() => setStatus(status === 'unreported' ? '' : 'unreported')} />
        <Stat label={STATUS_LABEL.overdue} value={counts.overdue} color={STATUS_COLOR.overdue} active={status === 'overdue'} onClick={() => setStatus(status === 'overdue' ? '' : 'overdue')} />
        <Stat label={STATUS_LABEL.late} value={counts.late} color={STATUS_COLOR.late} active={status === 'late'} onClick={() => setStatus(status === 'late' ? '' : 'late')} />
        <Stat label={STATUS_LABEL.on_time} value={counts.on_time} color={STATUS_COLOR.on_time} active={status === 'on_time'} onClick={() => setStatus(status === 'on_time' ? '' : 'on_time')} />
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
        {(region || building || cls || gender || status || q) && (
          <button className="btn ghost sm" onClick={() => { setRegion(''); setBuilding(''); setCls(''); setGender(''); setStatus(''); setQ(''); }}>
            清除
          </button>
        )}
      </section>

      <p className="count">符合 {filtered.length} 人</p>

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
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
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
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">沒有符合條件的學生</td>
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
