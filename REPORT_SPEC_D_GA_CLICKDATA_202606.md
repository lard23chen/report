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
- **互動功能：點擊柱體 → 展開當日活動明細 Panel（見 6.7）**
- **數字標籤（chartjs-plugin-datalabels）：**
  - 每個柱頂顯示當日總量（格式：`XXK`，如 `13K`, `123K`；< 10K 顯示 `X.XK`）
  - 各段落中央顯示段落量（值 ≥ 15,000 才顯示，避免細段落擁擠）
  - 點選某日時，僅選中柱保留標籤，其餘柱標籤隱藏（搭配淡化效果）
  - 圖表 layout padding top: 20px，為頂部標籤預留空間

### 6.4 Top 10 活動橫條圖 (Horizontal Bar)
- 依總點擊量排名，顏色依類別區分

### 6.5 登入/未登入 Donut + 類別分布 Bar
- Donut：全體 55.7% vs 44.3%
- Bar：sports / concert / music / fan 四類比較

### 6.6 完整活動明細表
- 33 列，欄位：排名 / 活動名稱（含類別 tag 與比例 bar）/ 活動ID / 場次數 / 總點擊量 / 已登入 / 未登入 / 登入率 / 單場均值
- 可點欄位標題排序（升/降序）
- 上方篩選 chips：全部 / 運動 / 演唱會 / 見面會 / 音樂節
- **互動功能：點擊活動名稱 → 開啟活動每日明細 Modal（見 6.8）**

### 6.7 每日活動明細 Panel（點擊趨勢圖柱體觸發）

圖表下方 inline 展開，顯示選定日期的所有活動資料：

| 欄位 | 說明 |
|------|------|
| 排名 | 該日點擊量排序 |
| 活動名稱 | 含類別 tag |
| 總點擊 | 當日該活動點擊數 |
| 已登入 / 未登入 | 分類計數 |
| 登入率 | 色碼 badge（綠 ≥70% / 橙 ≥40% / 紅 <40%）|

**互動行為：**
- 點擊同一柱：關閉 panel，恢復所有柱體亮度
- 點擊其他柱：切換至新日期，panel 內容更新
- 選中柱高亮（全亮），其餘柱淡化（透明度降低）
- Header 底部提示文字隨狀態切換

**資料來源（JS 常數）：** `BY_DATE`（11 個元素的陣列，對應 DAILY 索引）

### 6.8 活動每日明細 Modal（點擊活動名稱觸發）

全頁遮罩（backdrop rgba 65% 黑），居中卡片（max-width 720px，max-height 88vh 可捲動）：

**Header 區：**
- 活動名稱、類別 tag、ActivityId
- 5 個 KPI：總點擊量 / 登入率 / 活躍天數 / 單日峰值（含日期）/ 日均點擊

**明細表（每行一天）：**

| 欄位 | 說明 |
|------|------|
| 日期 | 格式 2026/MM/DD，峰值日加 ★ 並整列淡藍高亮 |
| 總點擊 | 當日點擊數 |
| 已登入 / 未登入 | 分類計數 |
| 登入率 | 色碼 badge |
| 趨勢 bar | CSS 橫條，寬度以該活動最高單日為 100% 基準，顏色依類別 |

**Footer 摘要：** 峰值日說明 + 登入最高日說明

**關閉方式：** ✕ 按鈕 / 點擊背景遮罩 / ESC 鍵

**資料來源（JS 常數）：** `ACT_DAILY`（key = ActivityId，value = 每日資料陣列）

## 7. 資料嵌入方式

此報表為**獨立靜態 HTML**，資料直接嵌入 JavaScript 中，不需連接 MongoDB 或後端 API。
報表包含 IP 白名單保護，僅允許授權 IP 存取。

> **2026/07/20 修正**：白名單漏了 `133.149.194.24` 一組 IP（與目錄頁 `HTML_Report_Catalog.html` 等其他受保護報表的清單不一致），已補齊為 9 組。此清單為手動維護的靜態內容，`generate_d_ga_clickdata_report.js` 僅用 regex 替換資料常數、不會動到 `<head>`，之後改版該檔案時務必保留此段。

## 8. 注意事項

- ActivityId `39428` 在不同日期的 `GameInfoName` 不同（樂天桃猿主場系列賽，對戰隊伍各異），聚合時取 `$last` 為活動顯示名
- 2026/06/04 出現 61,496 次單場高點（新北國王 ActivityId 39190，推測為開賣日）
- 2026/06/05 出現兩波大量：台鋼雄鷹-樂天桃猿（40,880）+ Girl Rules Fan Meeting（36,592）

## 9. 更新方式

### ⚠️ 已停止每日自動更新（2026/07/23，使用者要求）

原本已加入 `daily_update.bat`、由 Windows 工作排程器每日 08:00 自動執行，**2026/07/23 起已從排程移除**（見 `REPORT_SPEC_SCHEDULED_TASKS.md` §2.2 追記）。腳本與已產出的 HTML 都保留在原位，只是不再每日自動觸發，改為需要時手動執行。

Generator 腳本會：
1. 連線 MongoDB `QwareAi.GA_D_ClickData_Webb_202606`
2. 執行 4 個 aggregation（DAILY / ACTIVITIES / BY_DATE / ACT_DAILY）
3. 讀取現有 HTML，替換 `// ── Data ──` 至 `// ── Charts ─` 區間的資料常數
4. 更新 header 資料期間與最新資料更新時間（UTC+8 台灣時間）
5. 存回 `D_GA_ClickData_Webb_202606_Report.html`

### 手動執行

```bash
node generate_d_ga_clickdata_report.js
```

### 切換新月份（如 202607）

1. 複製 `generate_d_ga_clickdata_report.js` 為 `generate_d_ga_clickdata_report_202607.js`
2. 修改 `COLL`、`OUT_FILE`、`YEAR` 三個常數
3. 更新 `CAT_MAP`（如有新活動需分類）
4. 同步更新 `daily_update.bat` 與 `HTML_Report_Catalog.html`

**注意事項：**
- `CAT_MAP` 為手動分類，新活動預設歸類為 `concert`，需人工確認
- UpdateTime 直接從 MongoDB `UpdateTime` 欄位取最新值，已自動轉換為台灣時間（UTC+8）

## 10. 相關連結

- 目錄：`HTML_Report_Catalog.html`（D 系統 GA 點擊分析 區段）
- GA 事件流量報表（A系統）：`A_GA_Events_Traffic_Report.html`
- 規範文件：`REPORT_SPEC_GA_EVENTS_TRAFFIC.md`
