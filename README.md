# 宿舍夜間點名回報系統

住宿學生用手機於 **23:00（11PM）前**回報「已回宿舍」；系統依回報時間自動判定狀態，舍監在看板即時掌握。技術棧：Next.js（App Router）+ TypeScript + Drizzle + Neon PostgreSQL + Vercel。

## 時間規則

| 狀態 | 條件 | 顏色 |
|---|---|---|
| 準時 | 23:00 前回報 | 綠 |
| 遲報 | 23:00–24:00 回報 | 黃 |
| 逾時 | 超過 24:00 回報，**強制填寫說明事由** | 紅 |
| 未回報 | 到截止仍無回報 | 灰 |

凌晨補報（00:00–11:59）會自動歸到「前一夜」的點名。時間線（23:00 / 24:00）集中在 `lib/rollcall.ts` 的 `ONTIME_DEADLINE_MIN`、`LATE_DEADLINE_MIN`，要改只動這兩個常數。時區固定 UTC+8，不受伺服器時區影響。

## 兩個入口

- **學生**：`/report` — 選班級 → 選姓名（自動帶房號）→ 一鍵回報。免登入，會記住身分隔夜免重選；已過 24:00 時按鈕變為「回報並填寫說明」，未填不可送出。把這個網址做成 QR 貼在寢室 / 群組即可。
- **舍監**：`/admin` — 需密碼登入。即時回報率、未回報／逾時人數，可依樓別 / 班級 / 性別 / 狀態篩選、搜尋姓名房號，未回報自動排最前，逾時說明逐筆可見，一鍵匯出 CSV。每 20 秒自動更新。

## 部署步驟

1. **建 Neon 資料庫**，複製連線字串。
2. **環境變數**（本機 `.env`，Vercel 專案 Settings → Environment Variables）：
   ```
   DATABASE_URL=（Neon 連線字串）
   ADMIN_PASSWORD=（舍監登入密碼）
   ADMIN_TOKEN=（隨機長字串，登入 cookie 驗證用）
   ```
   `ADMIN_TOKEN` 可用 `openssl rand -hex 32` 產生。
3. **安裝與建表**：
   ```bash
   npm install
   npm run db:push      # 建立 students / rollcalls 資料表
   npm run db:seed      # 匯入 142 位學生名單
   ```
4. **本機測試**：`npm run dev` → 開 `/report` 與 `/admin`。
5. **部署**：推上 GitHub，Vercel import，環境變數填好即可。

## 名單維護

名單在 `db/students.seed.ts`（142 人，已含班級 / 姓名 / 性別 / 房號 / 樓層）。異動後重跑 `npm run db:seed` 會清空重匯（連同舊回報紀錄；學期中若要保留紀錄，改用增量更新而非 seed）。

## 資料結構

- `students`：building、className、studentNo、name、gender、room、floor、note
- `rollcalls`：studentId、rollcallDate（點名夜）、reportedAt、status、explanation。`(studentId, rollcallDate)` 唯一，重複回報覆蓋為最新。

## 可延伸

- **即時推播**：目前看板為 20 秒輪詢，要秒級可接 Ably（你 QuizFlow 已用）。
- **登入強化**：管理端目前為共用密碼 + httpOnly cookie，要細分帳號可換 Clerk。
- **歷史查詢**：`getNightRows(date)` 已支援指定日期，加一個日期選擇器即可回看任一夜。
- **自動關窗**：可加 cron 在每日 00:00 對未回報者標記通知導師。
