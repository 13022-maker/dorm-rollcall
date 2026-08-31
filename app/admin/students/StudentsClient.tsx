'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addStudent, updateStudent, deleteStudent, type StudentInput } from './actions';

type S = {
  id: number;
  building: string;
  className: string;
  studentNo: string | null;
  name: string;
  gender: string | null;
  room: string | null;
  floor: number | null;
  note: string | null;
};

const EMPTY: StudentInput = {
  building: '',
  className: '',
  studentNo: '',
  name: '',
  gender: '',
  room: '',
  floor: null,
  note: '',
};

// 空字串一律轉成 null 再送出，資料庫欄位才會是乾淨的 NULL 而不是空字串
function normalize(input: StudentInput): StudentInput {
  return {
    building: input.building.trim(),
    className: input.className.trim(),
    studentNo: input.studentNo?.trim() || null,
    name: input.name.trim(),
    gender: input.gender?.trim() || null,
    room: input.room?.trim() || null,
    floor: input.floor,
    note: input.note?.trim() || null,
  };
}

export default function StudentsClient({ students }: { students: S[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const [building, setBuilding] = useState('');
  const [q, setQ] = useState('');

  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<StudentInput>(EMPTY);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<StudentInput>(EMPTY);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const buildings = useMemo(() => Array.from(new Set(students.map((s) => s.building))).sort(), [students]);

  const filtered = useMemo(() => {
    const kw = q.trim();
    return students
      .filter((s) => (building ? s.building === building : true))
      .filter((s) => (kw ? s.name.includes(kw) || (s.room ?? '').includes(kw) || s.className.includes(kw) : true));
  }, [students, building, q]);

  function toStudentInput(s: S): StudentInput {
    return {
      building: s.building,
      className: s.className,
      studentNo: s.studentNo,
      name: s.name,
      gender: s.gender,
      room: s.room,
      floor: s.floor,
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

  return (
    <main className="wrap wide">
      <header className="head row">
        <div>
          <h1>住宿名單管理</h1>
          <p className="sub">共 {students.length} 人 · 新增／修改／刪除會直接反映到 /report 跟看板</p>
        </div>
        <a className="btn ghost sm" href="/admin">
          回看板
        </a>
      </header>

      <section className="filters">
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
        <button className="btn primary sm" onClick={() => { setAdding((v) => !v); setError(''); }}>
          {adding ? '取消新增' : '＋ 新增學生'}
        </button>
      </section>

      {error && <p className="err">{error}</p>}

      {adding && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="editgrid">
            <input placeholder="樓別（例：A）" value={newRow.building} onChange={(e) => setNewRow({ ...newRow, building: e.target.value })} />
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
            <input placeholder="備註（可空）" value={newRow.note ?? ''} onChange={(e) => setNewRow({ ...newRow, note: e.target.value })} />
          </div>
          <button className="btn primary sm" disabled={pending} onClick={submitAdd} style={{ marginTop: 12 }}>
            {pending ? '新增中…' : '確認新增'}
          </button>
        </div>
      )}

      <p className="count">符合 {filtered.length} 人</p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>樓別</th>
              <th>班級</th>
              <th>姓名</th>
              <th>學號</th>
              <th>性別</th>
              <th>房號</th>
              <th>樓層</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <tr key={s.id}>
                  {isEditing ? (
                    <>
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
                      <td><input value={editRow.note ?? ''} onChange={(e) => setEditRow({ ...editRow, note: e.target.value })} /></td>
                      <td className="opcell">
                        <button className="btn primary sm" disabled={pending} onClick={() => saveEdit(s.id)}>存檔</button>
                        <button className="btn ghost sm" onClick={cancelEdit}>取消</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{s.building}</td>
                      <td className="dim">{s.className}</td>
                      <td className="nm">{s.name}</td>
                      <td className="dim">{s.studentNo ?? '—'}</td>
                      <td>{s.gender ?? '—'}</td>
                      <td>{s.room ?? '—'}</td>
                      <td>{s.floor ?? '—'}</td>
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
                <td colSpan={9} className="empty">沒有符合條件的學生</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
