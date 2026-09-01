'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { submitReport, type ReportResult } from './actions';
import { submitIssueReport, type IssueSubmitResult } from './issueActions';
import {
  ISSUE_TYPE_LABEL,
  MAINTENANCE_ITEMS,
  KEY_ITEMS,
  CARD_ITEMS,
  type IssueType,
} from '@/lib/issues';
import { STATUS_LABEL, STATUS_COLOR, formatTaipeiTime, type RowStatus } from '@/lib/rollcall';

type S = {
  id: number;
  building: string;
  className: string;
  name: string;
  room: string | null;
  floor: number | null;
  gender: string | null;
  status: RowStatus;
  reportedAt: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  on_time: { bg: '#dcfce7', fg: '#166534' },
  late: { bg: '#fef3c7', fg: '#92400e' },
  overdue: { bg: '#fee2e2', fg: '#991b1b' },
};

const NONE = '__none__'; // 未分配房號

// 回報類型分頁：ROLLCALL 是預設的例行夜間點名，其他三種寫進 issue_reports
type ReportTab = 'ROLLCALL' | IssueType;
const TABS: { key: ReportTab; label: string }[] = [
  { key: 'ROLLCALL', label: '例行夜間點名' },
  { key: 'MAINTENANCE', label: '房間物品報修' },
  { key: 'KEY_ISSUE', label: '鑰匙問題' },
  { key: 'CARD_ISSUE', label: '房卡問題' },
  { key: 'OTHER', label: '其他特殊狀況' },
];

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
  const [tab, setTab] = useState<ReportTab>('ROLLCALL');
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [sid, setSid] = useState<number | ''>('');
  const [explanation, setExplanation] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);

  // 報修／鑰匙房卡問題／其他 共用欄位
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [issueResult, setIssueResult] = useState<IssueSubmitResult | null>(null);
  const [issueErr, setIssueErr] = useState('');

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

  // 該棟的房號清單，依樓層分組；同時算出每個房間「已簽到/總人數」方便選房號時就先看到進度
  const roomsByFloor = useMemo(() => {
    const inB = students.filter((s) => s.building === building);
    const map = new Map<number | null, Map<string, S[]>>();
    let hasNone = false;
    for (const s of inB) {
      if (!s.room) { hasNone = true; continue; }
      const fKey = s.floor;
      if (!map.has(fKey)) map.set(fKey, new Map());
      const rooms = map.get(fKey)!;
      if (!rooms.has(s.room)) rooms.set(s.room, []);
      rooms.get(s.room)!.push(s);
    }
    const groups = Array.from(map.entries())
      .sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))
      .map(([f, rooms]) => ({
        floor: f,
        rooms: Array.from(rooms.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([r, list]) => ({
            room: r,
            checkedIn: list.filter((x) => x.status !== 'unreported').length,
            total: list.length,
          })),
      }));
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
  // 例行點名才需要看鎖定：這位同學今晚已經回報過了
  const meLocked = tab === 'ROLLCALL' && !!me && me.status !== 'unreported';

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
    setIssueResult(null);
  }
  function chooseRoom(r: string) {
    setRoom(r);
    setSid('');
    setResult(null);
    setIssueResult(null);
  }
  function pick(id: number) {
    setSid(id);
    setResult(null);
    setIssueResult(null);
    setIssueErr('');
    try {
      localStorage.setItem(storageKey, JSON.stringify({ id }));
    } catch {}
  }
  function chooseTab(t: ReportTab) {
    setTab(t);
    setResult(null);
    setIssueResult(null);
    setIssueErr('');
    setItem('');
    setDescription('');
    setContactPhone('');
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

  function sendIssue() {
    if (!me) return;
    if (!description.trim()) {
      setIssueErr('請填寫狀況說明');
      return;
    }
    setIssueErr('');
    start(async () => {
      const r = await submitIssueReport({
        studentId: me.id,
        region,
        reportType: tab as IssueType,
        maintenanceItem: item || null,
        issueDescription: description,
        contactPhone: contactPhone || null,
      });
      setIssueResult(r);
      if (r.ok) {
        setItem('');
        setDescription('');
        setContactPhone('');
      }
    });
  }

  // 例行點名：送出成功畫面
  if (tab === 'ROLLCALL' && result?.ok) {
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

  // 報修／鑰匙房卡／其他：送出成功畫面
  if (tab !== 'ROLLCALL' && issueResult?.ok) {
    return (
      <div className="card done" style={{ background: '#dbeafe', color: '#1e3a8a' }}>
        <div className="tick">✓</div>
        <h2>已送出</h2>
        <p className="big">
          {me?.building} 棟 · {me?.room ?? '未分配房'} · {me?.name}
        </p>
        <p>
          類型：<b>{issueResult.typeLabel}</b>，我們會盡快處理
        </p>
        <button className="btn ghost" onClick={() => setIssueResult(null)}>
          再回報一筆
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {/* 0. 回報類型分頁 */}
      <div className="field">
        <span>回報類型</span>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn${tab === t.key ? ' on' : ''}`}
              onClick={() => chooseTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

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

      {/* 2. 房號（例行點名才顯示已簽到進度） */}
      {building && (
        <label className="field">
          <span>房號</span>
          <select value={room} onChange={(e) => chooseRoom(e.target.value)}>
            <option value="">請選擇房號</option>
            {roomsByFloor.groups.map((g) => (
              <optgroup key={String(g.floor)} label={floorLabel(g.floor)}>
                {g.rooms.map((r) => (
                  <option key={r.room} value={r.room}>
                    {r.room}
                    {tab === 'ROLLCALL' ? `（${r.checkedIn}/${r.total} 已簽到）` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
            {roomsByFloor.hasNone && <option value={NONE}>未分配房號</option>}
          </select>
        </label>
      )}

      {/* 3. 點自己名字：例行點名依簽到狀態上色 */}
      {building && room && (
        <div className="field">
          <span>點選你的姓名</span>
          {tab === 'ROLLCALL' && (
            <div className="legend">
              <span><i className="dot" style={{ background: STATUS_COLOR.on_time }} />準時</span>
              <span><i className="dot" style={{ background: STATUS_COLOR.late }} />遲報</span>
              <span><i className="dot" style={{ background: STATUS_COLOR.overdue }} />逾時</span>
              <span><i className="dot" style={{ background: STATUS_COLOR.unreported }} />未簽到</span>
            </div>
          )}
          <div className="names">
            {roommates.map((s) => {
              const showStatus = tab === 'ROLLCALL' && s.status !== 'unreported';
              return (
                <button
                  key={s.id}
                  className={`name-btn${sid === s.id ? ' on' : ''}${showStatus ? ` st-${s.status}` : ''}`}
                  onClick={() => pick(s.id)}
                >
                  {s.name}
                  {showStatus && (
                    <span className="name-time">
                      {STATUS_LABEL[s.status]} {s.reportedAt ? formatTaipeiTime(new Date(s.reportedAt)) : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {me && (
        <div className="me">
          {me.building} 棟 · <b>{me.room ?? '未分配'}</b> · <b>{me.name}</b>
          <span className="me-cls">{me.className}</span>
        </div>
      )}

      {/* 例行點名：已鎖定畫面（今晚已回報過，禁止再送出覆蓋） */}
      {tab === 'ROLLCALL' && meLocked && me && (
        <div className="locked">
          已於 <b>{me.reportedAt ? formatTaipeiTime(new Date(me.reportedAt)) : ''}</b> 完成回報（{STATUS_LABEL[me.status]}），
          今晚不能重複送出。填錯了嗎？請聯絡舍監協助解鎖。
        </div>
      )}

      {/* 例行點名：未鎖定才顯示逾時說明與送出鈕 */}
      {tab === 'ROLLCALL' && !meLocked && (
        <>
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
        </>
      )}

      {/* 報修／鑰匙房卡問題／其他：專屬欄位 */}
      {tab !== 'ROLLCALL' && me && (
        <>
          {tab === 'MAINTENANCE' && (
            <label className="field">
              <span>報修項目</span>
              <select value={item} onChange={(e) => setItem(e.target.value)}>
                <option value="">請選擇</option>
                {MAINTENANCE_ITEMS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>
          )}

          {tab === 'KEY_ISSUE' && (
            <label className="field">
              <span>狀況</span>
              <select value={item} onChange={(e) => setItem(e.target.value)}>
                <option value="">請選擇</option>
                {KEY_ITEMS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>
          )}

          {tab === 'CARD_ISSUE' && (
            <label className="field">
              <span>狀況</span>
              <select value={item} onChange={(e) => setItem(e.target.value)}>
                <option value="">請選擇</option>
                {CARD_ITEMS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>
              {tab === 'MAINTENANCE' ? '損壞位置與狀況說明' : tab === 'KEY_ISSUE' || tab === 'CARD_ISSUE' ? '補充說明' : '狀況說明'}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                tab === 'MAINTENANCE'
                  ? '例：靠窗床位電燈不亮，已經兩天了'
                  : tab === 'KEY_ISSUE'
                  ? '例：早上出門發現鑰匙不見了'
                  : tab === 'CARD_ISSUE'
                  ? '例：房卡刷不進房間，可能消磁了'
                  : '請描述狀況'
              }
              rows={3}
            />
          </label>

          <label className="field">
            <span>聯絡電話 / Line ID（方便維修人員或舍監聯繫，非必填）</span>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="例：0912345678 或 Line ID"
            />
          </label>

          {issueErr && <p className="err">{issueErr}</p>}
          {issueResult && !issueResult.ok && <p className="err">{issueResult.message}</p>}

          <button className="btn primary" disabled={!me || pending} onClick={sendIssue}>
            {pending ? '送出中…' : `送出${ISSUE_TYPE_LABEL[tab as IssueType]}`}
          </button>
        </>
      )}

      {tab !== 'ROLLCALL' && !me && (
        <p className="sub">請先選擇你的姓名，再填寫詳細內容。</p>
      )}
    </div>
  );
}
