'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addStudent, updateStudent, deleteStudent, deleteStudents, setStudentsActive, type StudentInput } from './actions';

type S = {
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
  active: boolean;
  note: string | null;
};

const EMPTY: StudentInput = {
  region: '',
  building: '',
  className: '',
  studentNo: '',
  name: '',
  gender: '',
  room: '',
  floor: null,
  company: '',
  active: true,
  note: '',
};

// 空字串一律轉成 null 再送出，資料庫欄位才會是乾淨的 NULL 而不是空字串
function normalize(input: StudentInput): StudentInput {
  return {
    region: input.region?.trim() || null,
    building: input.building.trim(),
    className: input.className.trim(),
    studentNo: input.studentNo?.trim() || null,
    name: input.name.trim(),
    gender: input.gender?.trim() || null,
    room: input.room?.trim() || null,
    floor: input.floor,
    company: input.company?.trim() || null,
    active: input.active,
    note: input.note?.trim() || null,
  };
}

export default function StudentsClient({ students }: { students: S[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const [region, setRegion] = useState('');
  const [building, setBuilding] = useState('');
  const [q, setQ] = useState('');
  // 停用中的人（目前不住宿舍）預設隱藏，避免跟真的要點名的人混在一起；要管理/恢復時再打開
  const [showInactive, setShowInactive] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<StudentInput>(EMPTY);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<StudentInput>(EMPTY);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const regions = useMemo(
    () => Array.from(new Set(students.map((s) => s.region).filter((v): v is string => !!v))).sort(),
    [students]
  );
  // 選了地區時，樓別選單只列出該地區底下的校舍
  const buildings = useMemo(() => {
    const inRegion = region ? students.filter((s) => s.region === region) : students;
    return Array.from(new Set(inRegion.map((s) => s.building))).sort();
  }, [students, region]);

  function chooseRegion(v: string) {
    setRegion(v);
    setBuilding('');
  }

  const filtered = useMemo(() => {
    const kw = q.trim();
    return students
      .filter((s) => (showInactive ? true : s.active))
      .filter((s) => (region ? s.region === region : true))
      .filter((s) => (building ? s.building === building : true))
      .filter((s) => (kw ? s.name.includes(kw) || (s.room ?? '').includes(kw) || s.className.includes(kw) : true));
  }, [students, region, building, q, showInactive]);

  function toStudentInput(s: S): StudentInput {
    return {
      region: s.region,
      building: s.building,
      className: s.className,
      studentNo: s.studentNo,
      name: s.name,
      gender: s.gender,
      room: s.room,
      floor: s.floor,
      company: s.company,
      active: s.active,
      note: s.note,
    };
  }

  function startEdit(s: S) {
    setEditingId(s.id);
    setEditRow(toStudentInput(s));
    setError('');
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError('');
  }

  function saveEdit(id: number) {
    setError('');
    start(async () => {
      const r = await updateStudent(id, normalize(editRow));
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function submitAdd() {
    setError('');
    start(async () => {
      const r = await addStudent(normalize(newRow));
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setNewRow(EMPTY);
      setAdding(false);
      router.refresh();
    });
  }

  function doDelete(id: number) {
    setError('');
    start(async () => {
      const r = await deleteStudent(id);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  // 目前篩選結果裡「有被勾選」的那些人（切換篩選條件不會自動清掉勾選，但只會刪掉畫面上看得到的這些）
  const selectedInView = filtered.filter((s) => selected.has(s.id));
  const allInViewSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allInViewSelected) {
        for (const s of filtered) next.delete(s.id);
      } else {
        for (const s of filtered) next.add(s.id);
      }
      return next;
    });
  }

  function doBulkDelete() {
    setError('');
    const ids = selectedInView.map((s) => s.id);
    start(async () => {
      const r = await deleteStudents(ids);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setBulkConfirm(false);
      router.refresh();
    });
  }

  function doBulkSetActive(active: boolean) {
    setError('');
    const ids = selectedInView.map((s) => s.id);
    start(async () => {
      const r = await setStudentsActive(ids, active);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      router.refresh();
    });
  }

  return (
    <main className="wrap wide">
      <header className="head row">
        <div>
          <h1>住宿名單管理</h1>
          <p className="sub">
            共 {students.filter((s) => s.active).length} 人使用中
            {students.some((s) => !s.active) && `（另有 ${students.filter((s) => !s.active).length} 人停用中）`}
            {' '}· 新增／修改／刪除會直接反映到 /report 跟看板
          </p>
        </div>
        <a className="btn ghost sm" href="/admin">
          回看板
        </a>
      </header>

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
        <input
          placeholder="搜尋姓名 / 房號 / 班級"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--dim)' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          顯示停用中的人
        </label>
        <button className="btn primary sm" onClick={() => { setAdding((v) => !v); setError(''); }}>
          {adding ? '取消新增' : '＋ 新增學生'}
        </button>
      </section>

      {error && <p className="err">{error}</p>}

      {adding && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="editgrid">
            <input placeholder="地區（可空，例：明新）" value={newRow.region ?? ''} onChange={(e) => setNewRow({ ...newRow, region: e.target.value })} />
            <input placeholder="樓別（例：明新A）" value={newRow.building} onChange={(e) => setNewRow({ ...newRow, building: e.target.value })} />
            <input placeholder="班級" value={newRow.className} onChange={(e) => setNewRow({ ...newRow, className: e.target.value })} />
            <input placeholder="姓名" value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} />
            <input placeholder="學號（可空）" value={newRow.studentNo ?? ''} onChange={(e) => setNewRow({ ...newRow, studentNo: e.target.value })} />
            <select value={newRow.gender ?? ''} onChange={(e) => setNewRow({ ...newRow, gender: e.target.value })}>
              <option value="">性別</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <input placeholder="房號（可空）" value={newRow.room ?? ''} onChange={(e) => setNewRow({ ...newRow, room: e.target.value })} />
            <input
              placeholder="樓層（可空）"
              inputMode="numeric"
              value={newRow.floor ?? ''}
              onChange={(e) => setNewRow({ ...newRow, floor: e.target.value ? Number(e.target.value) : null })}
            />
            <input placeholder="工讀公司（可空）" value={newRow.company ?? ''} onChange={(e) => setNewRow({ ...newRow, company: e.target.value })} />
            <input placeholder="備註（可空）" value={newRow.note ?? ''} onChange={(e) => setNewRow({ ...newRow, note: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={newRow.active} onChange={(e) => setNewRow({ ...newRow, active: e.target.checked })} />
              使用中（取消勾選＝目前不住宿舍，不列入回報/統計）
            </label>
          </div>
          <button className="btn primary sm" disabled={pending} onClick={submitAdd} style={{ marginTop: 12 }}>
            {pending ? '新增中…' : '確認新增'}
          </button>
        </div>
      )}

      <p className="count">符合 {filtered.length} 人</p>

      {selectedInView.length > 0 && (
        <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>已選取 {selectedInView.length} 人</span>
          {bulkConfirm ? (
            <>
              <button className="btn danger sm" disabled={pending} onClick={doBulkDelete}>
                確定刪除這 {selectedInView.length} 人
              </button>
              <button className="btn ghost sm" onClick={() => setBulkConfirm(false)}>取消</button>
            </>
          ) : (
            <>
              <button className="btn ghost sm" disabled={pending} onClick={() => doBulkSetActive(false)}>停用選取</button>
              <button className="btn ghost sm" disabled={pending} onClick={() => doBulkSetActive(true)}>啟用選取</button>
              <button className="btn danger sm" onClick={() => setBulkConfirm(true)}>刪除選取</button>
              <button className="btn ghost sm" onClick={() => setSelected(new Set())}>清除選取</button>
            </>
          )}
        </div>
      )}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allInViewSelected}
                  onChange={toggleSelectAll}
                  aria-label="全選"
                />
              </th>
              <th>地區</th>
              <th>樓別</th>
              <th>班級</th>
              <th>姓名</th>
              <th>學號</th>
              <th>性別</th>
              <th>房號</th>
              <th>樓層</th>
              <th>工讀公司</th>
              <th>狀態</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <tr key={s.id} style={s.active ? undefined : { opacity: 0.5 }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      aria-label={`選取 ${s.name}`}
                    />
                  </td>
                  {isEditing ? (
                    <>
                      <td><input value={editRow.region ?? ''} onChange={(e) => setEditRow({ ...editRow, region: e.target.value })} /></td>
                      <td><input value={editRow.building} onChange={(e) => setEditRow({ ...editRow, building: e.target.value })} /></td>
                      <td><input value={editRow.className} onChange={(e) => setEditRow({ ...editRow, className: e.target.value })} /></td>
                      <td><input value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} /></td>
                      <td><input value={editRow.studentNo ?? ''} onChange={(e) => setEditRow({ ...editRow, studentNo: e.target.value })} /></td>
                      <td>
                        <select value={editRow.gender ?? ''} onChange={(e) => setEditRow({ ...editRow, gender: e.target.value })}>
                          <option value="">—</option>
                          <option value="男">男</option>
                          <option value="女">女</option>
                        </select>
                      </td>
                      <td><input value={editRow.room ?? ''} onChange={(e) => setEditRow({ ...editRow, room: e.target.value })} /></td>
                      <td>
                        <input
                          inputMode="numeric"
                          value={editRow.floor ?? ''}
                          onChange={(e) => setEditRow({ ...editRow, floor: e.target.value ? Number(e.target.value) : null })}
                        />
                      </td>
                      <td><input value={editRow.company ?? ''} onChange={(e) => setEditRow({ ...editRow, company: e.target.value })} /></td>
                      <td>
                        <select value={editRow.active ? '1' : '0'} onChange={(e) => setEditRow({ ...editRow, active: e.target.value === '1' })}>
                          <option value="1">使用中</option>
                          <option value="0">停用</option>
                        </select>
                      </td>
                      <td><input value={editRow.note ?? ''} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} /></td>
                      <td className="opcell">
                        <button className="btn primary sm" disabled={pending} onClick={() => saveEdit(s.id)}>存檔</button>
                        <button className="btn ghost sm" onClick={cancelEdit}>取消</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="dim">{s.region ?? '—'}</td>
                      <td>{s.building}</td>
                      <td className="dim">{s.className}</td>
                      <td className="nm">{s.name}</td>
                      <td className="dim">{s.studentNo ?? '—'}</td>
                      <td>{s.gender ?? '—'}</td>
                      <td>{s.room ?? '—'}</td>
                      <td>{s.floor ?? '—'}</td>
                      <td className="dim">{s.company ?? '—'}</td>
                      <td>
                        {s.active ? (
                          <span className="pill" style={{ background: '#16a34a' }}>使用中</span>
                        ) : (
                          <span className="pill" style={{ background: '#94a3b8' }}>停用</span>
                        )}
                      </td>
                      <td className="dim">{s.note ?? ''}</td>
                      <td className="opcell">
                        <button className="btn ghost sm" onClick={() => startEdit(s)}>編輯</button>
                        {confirmDeleteId === s.id ? (
                          <>
                            <button className="btn danger sm" disabled={pending} onClick={() => doDelete(s.id)}>
                              確定刪除
                            </button>
                            <button className="btn ghost sm" onClick={() => setConfirmDeleteId(null)}>取消</button>
                          </>
                        ) : (
                          <button className="btn ghost sm" onClick={() => setConfirmDeleteId(s.id)}>刪除</button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="empty">沒有符合條件的學生</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
