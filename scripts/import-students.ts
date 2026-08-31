import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { db } from '../db';
import { students } from '../db/schema';
import type { SeedStudent } from '../db/students.seed';

// 批次匯入新校舍/新班級的學生名單，用途跟 db:seed 不同：
// - db:seed 會清空整張表重匯（連舊回報紀錄一起清掉）
// - 這支只「新增」，不動既有資料，學期中要加名單用這支
//
// 用法：npm run db:import -- 檔案路徑.csv
// CSV 第一列要是欄位名稱，順序不拘：
//   building,className,studentNo,name,gender,room,floor,note
// 其中 building / className / name 必填，其他欄位可留空。

const REQUIRED = ['building', 'className', 'name'] as const;
const COLUMNS = ['building', 'className', 'studentNo', 'name', 'gender', 'room', 'floor', 'note'] as const;

// 簡易 CSV 解析：支援雙引號包欄位、欄位內逗號跟換行
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export function toRecords(csvText: string): SeedStudent[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('CSV 至少要有標題列 + 1 筆資料');

  const header = rows[0].map((h) => h.trim());
  for (const col of REQUIRED) {
    if (!header.includes(col)) throw new Error(`CSV 缺少必要欄位：${col}`);
  }

  return rows.slice(1).map((cols, idx) => {
    const get = (key: string) => {
      const i = header.indexOf(key);
      return i === -1 ? '' : (cols[i] ?? '').trim();
    };

    for (const col of REQUIRED) {
      if (!get(col)) throw new Error(`第 ${idx + 2} 列缺少必填欄位「${col}」`);
    }

    const floorRaw = get('floor');
    return {
      building: get('building'),
      className: get('className'),
      studentNo: get('studentNo') || null,
      name: get('name'),
      gender: get('gender') || null,
      room: get('room') || null,
      floor: floorRaw ? Number(floorRaw) : null,
      note: get('note') || null,
    };
  });
}

// 把新名單附加進 db/students.seed.ts，讓 db:seed（重建資料庫時）也會包含這批人
function appendToSeedFile(records: SeedStudent[]) {
  const path = new URL('../db/students.seed.ts', import.meta.url);
  const text = readFileSync(path, 'utf-8');

  const closingIdx = text.lastIndexOf('];');
  if (closingIdx === -1) throw new Error('db/students.seed.ts 格式跟預期不同，找不到陣列結尾 "];"，請手動加入');

  const block = records
    .map((r) => {
      const lines = COLUMNS.map((c) => `    ${JSON.stringify(c)}: ${JSON.stringify(r[c] ?? null)}`).join(',\n');
      return `  {\n${lines}\n  }`;
    })
    .join(',\n');

  const before = text.slice(0, closingIdx).replace(/,?\s*$/, ',\n');
  const after = text.slice(closingIdx);
  writeFileSync(path, `${before}${block}\n${after}`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('用法：npm run db:import -- 檔案路徑.csv');
    process.exit(1);
  }

  const csvText = readFileSync(file, 'utf-8');
  const records = toRecords(csvText);

  console.log(`解析到 ${records.length} 筆，開始寫入資料庫…`);
  await db.insert(students).values(records);

  console.log('同步寫入 db/students.seed.ts…');
  appendToSeedFile(records);

  console.log(`完成，已新增 ${records.length} 位學生（既有名單與回報紀錄不受影響）。`);
  process.exit(0);
}

// 只有直接執行這支檔案（npm run db:import）才會跑 main，被其他檔案 import 時不會觸發
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
