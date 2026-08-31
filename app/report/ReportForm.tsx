'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { submitReport, type ReportResult } from './actions';

type S = {
  id: number;
  building: string;
  className: string;
  name: string;
  room: string | null;
  floor: number | null;
  gender: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  on_time: { bg: '#dcfce7', fg: '#166534' },
  late: { bg: '#fef3c7', fg: '#92400e' },
  overdue: { bg: '#fee2e2', fg: '#991b1b' },
};

const NONE = '__none__'; // 未分配房號

function floorLabel(f: number | null) {
  if (f == null) return '未分配';
  return `${f} 樓`;
}

export default function ReportForm({
  students,
  overdueNow,
  region,
}: {
  students: S[];
  overdueNow: boolean;
  region: string;
}) {
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [sid, setSid] = useState<number | ''>('');
  const [explanation, setExplanation] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pending, start] = useTransition();

  // 每個宿舍分開記住身分（key 帶 region），避免同一支手機開不同宿舍的回報頁時互相蓋掉
  const storageKey = `dorm_me_${region}`;

  // 記住上次身分，隔夜自動回到該棟該房並選好名字
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const me = JSON.parse(saved) as { id: number };
        const s = students.find((x) => x.id === me.id);
        if (s) {
          setBuilding(s.building);
          setRoom(s.room ?? NONE);
          setSid(s.id);
        }
      }
    } catch {}
  }, [students, storageKey]);

  // 該棟的房號清單，依樓層分組
  const roomsByFloor = useMemo(() => {
    const inB = students.filter((s) => s.building === building);
    const map = new Map<number | null, Set<string>>();
    let hasNone = false;
    for (const s of inB) {
      if (!s.room) { hasNone = true; continue; }
      const key = s.floor;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(s.room);
    }
    const groups = Array.from(map.entries())
      .sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))
      .map(([f, set]) => ({ floor: f, rooms: Array.from(set).sort() }));
    return { groups, hasNone };
  }, [students, building]);

  // 該棟該房的室友
  const roommates = useMemo(() => {
    if (!building || !room) return [];
    return students
      .filter((s) => s.building === building && (room === NONE ? !s.room : s.room === room))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, building, room]);

  const me = students.find((s) => s.id === sid);

  // 樓別清單直接從名單資料算出來，新增校舍不用改這支程式
  const buildings = useMemo(
    () => Array.from(new Set(students.map((s) => s.building))).sort(),
    [students]
  );

  function chooseBuilding(b: string) {
    setBuilding(b);
    setRoom('');
    setSid('');
    setResult(null);
  }
  function chooseRoom(r: string) {
    setRoom(r);
    setSid('');
    setResult(null);
  }
  function pick(id: number) {
    setSid(id);
    setResult(null);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ id }));
    } catch {}
  }

  function send() {
    if (!me) return;
    start(async () => {
      // region 帶進去讓後端驗證這位學生真的屬於這個回報入口，不是單純前端過濾而已
      const r = await submitReport(me.id, region, explanation);
      setResult(r);
      if (r.ok) setExplanation('');
    });
  }

  if (result?.ok) {
    const st = STATUS_STYLE[result.status];
    return (
      <div className="card done" style={{ background: st.bg, color: st.fg }}>
        <div className="tick">✓</div>
        <h2>回報成功</h2>
        <p className="big">
          {me?.building} 棟 · {me?.room ?? '未分配房'} · {me?.name}
        </p>
        <p>
          狀態：<b>{result.label}</b> · 時間 {result.time}
        </p>
        <button className="btn ghost" onClick={() => setResult(null)}>
          重新回報
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {/* 1. 棟別 */}
      <div className="field">
        <span>樓別</span>
        <div className="seg">
          {buildings.map((b) => (
            <button
              key={b}
              className={`seg-btn${building === b ? ' on' : ''}`}
              onClick={() => chooseBuilding(b)}
            >
              {b} 棟
            </button>
          ))}
        </div>
      </div>

      {/* 2. 房號 */}
      {building && (
        <label className="field">
          <span>房號</span>
          <select value={room} onChange={(e) => chooseRoom(e.target.value)}>
            <option value="">請選擇房號</option>
            {roomsByFloor.groups.map((g) => (
              <optgroup key={String(g.floor)} label={floorLabel(g.floor)}>
                {g.rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </optgroup>
            ))}
            {roomsByFloor.hasNone && <option value={NONE}>未分配房號</option>}
          </select>
        </label>
      )}

      {/* 3. 點自己名字 */}
      {building && room && (
        <div className="field">
          <span>點選你的姓名</span>
          <div className="names">
            {roommates.map((s) => (
              <button
                key={s.id}
                className={`name-btn${sid === s.id ? ' on' : ''}`}
                onClick={() => pick(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {me && (
        <div className="me">
          {me.building} 棟 · <b>{me.room ?? '未分配'}</b> · <b>{me.name}</b>
          <span className="me-cls">{me.className}</span>
        </div>
      )}

      {overdueNow && me && (
        <label className="field">
          <span className="warn">已超過 24:00，請填寫逾時說明</span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="例：晚自習後夜排球比賽延誤、身體不適就醫…"
            rows={3}
          />
        </label>
      )}

      {result && !result.ok && <p className="err">{result.message}</p>}

      <button className="btn primary" disabled={!me || pending} onClick={send}>
        {pending ? '送出中…' : overdueNow ? '回報並填寫說明' : '已回宿舍'}
      </button>
    </div>
  );
}
