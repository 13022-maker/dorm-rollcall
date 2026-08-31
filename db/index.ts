import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('缺少環境變數 DATABASE_URL（Neon 連線字串）');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
