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
  building: text('building').notNull(), // 'A' | 'B'
  className: text('class_name').notNull(), // 例：僑資一甲B
  studentNo: text('student_no'), // 部分班級無學號，可為 null
  name: text('name').notNull(),
  gender: text('gender'), // 男 / 女
  room: text('room'), // 房號，例：1023；未分配可為 null
  floor: integer('floor'), // 樓層，男 1F、女 4/5F
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
