import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  date,
  unique,
  index,
} from 'drizzle-orm/pg-core';

// 住宿學生名單
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  region: text('region'), // 地區（上層分類），例：'明新'、'萬能'、'啟英'；一般宿舍生可為 null
  building: text('building').notNull(), // 棟別/校舍，例：'明新A'、'萬能男'、'啟英女'
  className: text('class_name').notNull(), // 例：僑資一甲B
  studentNo: text('student_no'), // 部分班級無學號，可為 null
  name: text('name').notNull(),
  gender: text('gender'), // 男 / 女
  room: text('room'), // 房號，例：1023；未分配可為 null
  floor: integer('floor'), // 樓層，男 1F、女 4/5F；無樓層資料可為 null
  company: text('company'), // 建教合作班的工讀公司，一般宿舍生可為 null
  note: text('note'),
});

// 每晚點名回報（一位學生每夜最多一筆，重複回報以最新覆蓋）
export const rollcalls = pgTable(
  'rollcalls',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    rollcallDate: date('rollcall_date').notNull(), // 所屬「點名夜」YYYY-MM-DD
    reportedAt: timestamp('reported_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text('status').notNull(), // on_time | late | overdue
    explanation: text('explanation'), // 逾時說明事由
  },
  (t) => ({
    uniqStudentNight: unique('uniq_student_night').on(t.studentId, t.rollcallDate),
    idxDate: index('idx_rollcall_date').on(t.rollcallDate),
  })
);

export type Student = typeof students.$inferSelect;
export type Rollcall = typeof rollcalls.$inferSelect;
