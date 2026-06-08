# D系統節目點擊量分析報表 技術規範說明

本文件定義「D系統節目點擊量分析報表（2026年6月）」的產出標準與欄位說明，未來更新或重新產出此報表時，請遵循本規範。

## 1. 基本資訊 (General Info)

| 項目 | 說明 |
|------|------|
| 報表名稱 | `D_GA_ClickData_Webb_202606_Report.html` |
| 產生腳本 | 無（直接嵌入資料，一次性報表） |
| 資料來源 | MongoDB `QwareAi` / `GA_D_ClickData_Webb_202606` |
| 資料期間 | 2026/05/26 — 2026/06/05（11 天）|
| 資料擷取 | 2026/06/08（CreateTime 全為當日）|
| 負責人 | 陳俊良 |
| 主要目的 | 分析 D 系統各節目的 GA 網頁點擊量，含登入/未登入用戶行為、每日趨勢、活動排行 |

## 2. 資料集結構 (Collection Schema)

Collection: `GA_D_ClickData_Webb_202606`（451 documents）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `_id` | string | 文件 ID |
| `ProductId` | string | 產品代碼 |
| `PerformanceId` | string | 場次代碼 |
| `EventDate` | ISODate | 活動日期 |
| `GameInfoName` | string | 活動名稱（可能因場次不同而異） |
| `ActivityId` | string | 活動 ID |
| `CreateTime` | ISODate | 資料建立時間 |
| `EventCount` | number | 總點擊次數 |
| `LoggedInCount` | number | 已登入用戶點擊次數 |
| `NotLoggedInCount` | number | 未登入用戶點擊次數 |
| `UpdateTime` | ISODate | 資料更新時間 |

## 3. 視覺樣式設定 (Visual Styles)

採用深色主題，以 Outfit + Noto Sans TC 字體呈現。

| CSS 變數 | 值 | 說明 |
|---|---|---|
| `--bg` | `#0f172a` | 頁面背景 |
| `--card` | `#1e293b` | 卡片背景 |
| `--border` | `#334155` | 邊框 |
| `--text` | `#f8fafc` | 主要文字 |
| `--muted` | `#94a3b8` | 次要文字 |
| `--blue` | `#3b82f6` | 強調色（已登入/運動類）|
| `--purple` | `#8b5cf6` | 演唱會類 |
| `--rose` | `#f43f5e` | 見面會類 |
| `--green` | `#10b981` | 音樂節類 |
| `--amber` | `#f59e0b` | 峰值/Top 3 |

## 4. 關鍵統計數字 (Key Metrics)

| 指標 | 數值 |
|------|------|
| 總點擊量 | 448,578 |
| 活動數 | 33 |
| 場次數 | 451 |
| 登入點擊 | 250,112（55.7%）|
| 未登入點擊 | 198,466（44.3%）|
| 單日峰值 | 122,805（2026/06/05）|
| 點擊量 No.1 | 統一7-ELEVEn獅-樂天桃猿（92,108，ActivityId: 39428）|

## 5. 活動分類 (Category Classification)

| 類別 | badge 樣式 | 說明 |
|------|-----------|------|
| `sports` | 藍色 | 棒球、籃球等運動賽事 |
| `concert` | 紫色 | 演唱會、音樂會 |
| `fan` | 玫瑰色 | 見面會、粉絲活動 |
| `music` | 綠色 | 音樂節 |

- 運動類合計：~314,537 次（約 70.1%）
- 娛樂類合計：~134,041 次（約 29.9%）

## 6. 關鍵組件與圖表 (Components & Charts)

### 6.1 KPI 卡片 (5 張)
- 總點擊量、活動數、場次數、登入點擊佔比、單日峰值

### 6.2 洞察摘要列 (Insight Bar, 4 項)
- 點擊量 No.1、登入率最高（大量場次）、單場最高均值、高峰兩日佔比

### 6.3 每日點擊量趨勢 (Stacked Bar Chart)
- X: 日期（05/26 ~ 06/05），Y: 點擊量
- 堆疊：已登入（藍）/ 未登入（灰）

### 6.4 Top 10 活動橫條圖 (Horizontal Bar)
- 依總點擊量排名，顏色依類別區分

### 6.5 登入/未登入 Donut + 類別分布 Bar
- Donut：全體 55.7% vs 44.3%
- Bar：sports / concert / music / fan 四類比較

### 6.6 完整活動明細表
- 33 列，欄位：排名 / 活動名稱（含類別 tag 與比例 bar）/ 活動ID / 場次數 / 總點擊量 / 已登入 / 未登入 / 登入率 / 單場均值
- 可點欄位標題排序（升/降序）
- 上方篩選 chips：全部 / 運動 / 演唱會 / 見面會 / 音樂節

## 7. 資料嵌入方式

此報表為**獨立靜態 HTML**，資料直接嵌入 JavaScript 中，不需連接 MongoDB 或後端 API。
報表包含 IP 白名單保護，僅允許授權 IP 存取。

## 8. 注意事項

- ActivityId `39428` 在不同日期的 `GameInfoName` 不同（樂天桃猿主場系列賽，對戰隊伍各異），聚合時取 `$last` 為活動顯示名
- 2026/06/04 出現 61,496 次單場高點（新北國王 ActivityId 39190，推測為開賣日）
- 2026/06/05 出現兩波大量：台鋼雄鷹-樂天桃猿（40,880）+ Girl Rules Fan Meeting（36,592）

## 9. 更新方式

若需更新此報表（新月份資料），請：
1. 查詢新月份 Collection（如 `GA_D_ClickData_Webb_202607`）
2. 執行相同的 MongoDB aggregation 取得活動彙總資料
3. 更新 HTML 中 `DAILY` 和 `ACTIVITIES` JavaScript 常數
4. 修改 header 顯示的日期與資料範圍

## 10. 相關連結

- 目錄：`HTML_Report_Catalog.html`（D 系統 GA 點擊分析 區段）
- GA 事件流量報表（A系統）：`A_GA_Events_Traffic_Report.html`
- 規範文件：`REPORT_SPEC_GA_EVENTS_TRAFFIC.md`
