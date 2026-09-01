// 房間物品報修／鑰匙房卡問題／其他特殊狀況：型別與顯示標籤
// 注意：這支檔案會被 client component（ReportForm.tsx）引用，
// 不能 import db／drizzle 查詢，否則資料庫連線程式碼會被打包進瀏覽器端。
// 需要查資料庫的部分放在 lib/issuesQuery.ts（只給 server 端用）。

export type IssueType = 'MAINTENANCE' | 'KEY_CARD_ISSUE' | 'OTHER';
export type IssueStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';

export const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  MAINTENANCE: '房間物品報修',
  KEY_CARD_ISSUE: '鑰匙／房卡問題',
  OTHER: '其他特殊狀況',
};

// 後台名單旁的醒目 icon
export const ISSUE_TYPE_ICON: Record<IssueType, string> = {
  MAINTENANCE: '🔧',
  KEY_CARD_ISSUE: '🔑',
  OTHER: '❗',
};

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  PENDING: '待處理',
  IN_PROGRESS: '處理中',
  RESOLVED: '已結案',
};

// 報修項目常見選項（學生端下拉選單用，選「其他」時請學生在說明欄補充）
export const MAINTENANCE_ITEMS = ['冷氣', '電燈', '水龍頭', '馬桶', '書桌', '門窗', '其他'];
// 鑰匙／房卡問題常見狀況
export const KEY_CARD_ITEMS = ['遺失', '損壞', '反鎖', '要求補發', '其他'];

export type IssueRow = {
  id: number;
  studentId: number;
  reportType: IssueType;
  maintenanceItem: string | null;
  issueDescription: string | null;
  contactPhone: string | null;
  status: IssueStatus;
  createdAt: Date;
};
