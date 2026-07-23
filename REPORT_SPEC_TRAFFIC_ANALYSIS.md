# 流量分析報表 通用技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義所有流量相關報表的共通規範。
目前涵蓋：GA 系統趨勢、DMP Top10、deca joins 流量明細、統一獅 GA 即時分析。

---

## 1. 報表總覽

| 報表 | 腳本 | 資料集合 | 排程 |
|------|------|---------|------|
| A_GA_Traffic_Analysis_Report.html | generate_ga_report.js | GA_MonthlyStats | 每日 08:00 / 15:00；每月 10 日由 daily_update.bat 額外執行 |
| A_DMP_PageView_Report_AllTime_Top10.html | generate_alltime_top10_v3.js | DMP event (trek-first-party-dmp) | 手動 |
| A_DecaJoins_Traffic_Analysis.html | generate_deca_traffic_report.js | Qware_A_Traffic_session_data | 手動 |
| A_UniformLions_GA_Analysis_20260309.html | generate_lions_ga_report.js | QwareTrafficSession / QwareTrafficGAReadTime | 手動 |

---

## 2. GA 系統月度流量分析（A_GA_Traffic_Analysis_Report）

### 資料來源
- DB：`QwareAi` / `GA_MonthlyStats`
- MongoDB 查詢以 `ID` 升序取回，**取回後再依 `YearMonth` 字串升序重新排序**

> ⚠️ 維護注意：`ID` 欄位值不保證與 `YearMonth` 時間順序一致（例如補登月份可能取得較小的 ID）。若只靠 `sort({ ID: 1 })` 會導致新月份插到陣列頭部，圖表時間軸錯亂、資料表順序錯誤、分析區間 header 顯示異常（如 `2026/04 ~ 2026/03`）。2026/05 已確認此問題並修正為 `chartData.sort((a, b) => a.month.localeCompare(b.month))`。

### 資料結構
| 欄位 | 說明 |
|------|------|
| YearMonth | YYYY-MM 格式 |
| A_Total | A 系統當月總 sessions |
| A_Mobile | A 系統手機 sessions |
| D_Total | D 系統總 sessions |
| D_Mobile | D 系統手機 sessions |
| E_Total | E 系統總 sessions |
| E_Mobile | E 系統手機 sessions |

### 視覺樣式（深色 + 青綠強調）

| CSS 變數 | 值 |
|---|---|
| `--bg-color` | `#121212` |
| `--card-bg` | `#1e1e1e` |
| `--accent-color` | `#4DB6AC`（青綠） |
| A 系統色 | `#FF7043`（橘） |
| D 系統色 | `#42A5F5`（藍） |
| E 系統色 | `#66BB6A`（綠） |

### 關鍵組件
1. **KPI 卡片**：A/D/E 各系統總流量 + 手機佔比
2. **每月詳細數據表**：新到舊排列，每列含各系統流量 + MoM 箭頭 + Mobile 佔比
3. **最近月份趨勢分析 (MoM Analysis)**：數據表正下方，由 `generate_ga_report.js` 動態產生，**不得手動寫死在 HTML**（下次執行腳本會整頁覆蓋）。
    *   **格式**：二行文字摘要：📊 流量（三系統各自 ▲/▼ 百分比 + 絕對差）、📱 Mobile 佔比（各系統當月佔比 + 與上月 pp 差）
    *   **樣式**：深灰背景 `#252525`、左側 `3px solid var(--accent-color)` 青綠飾條、`max-width:780px`，h4 使用 `var(--accent-color)` 青綠色
    *   **資料來源**：`chartData` 升序排列後，取最後兩筆（`chartData[length-1]` = 當月、`chartData[length-2]` = 上月）
4. **趨勢折線圖**：多系統月度流量疊加（Chart.js）
5. **手機佔比長條圖**：各系統手機 vs 桌機比例

---

## 3. DMP 歷史 Top 10 活動（A_DMP_PageView_Report_AllTime_Top10）

### 資料來源
- DB：`trek-first-party-dmp` / `event`（獨立 MongoDB 叢集）
- 連線字串：`讀取 .env 的 MONGODB_URI_DMP（勿寫入文檔）`
- 篩選條件：`name='page_view'`、`bu='D'`、`canonical_url` regex `ticket.ibon.com.tw`

### 核心邏輯
1. 以 `content_name` 分組，統計 `views` 與 `attribution_ids`（不重複 user 數）
2. 取 Top 10，再查各活動的日期分布、裝置分布、地區分布
3. 批次查詢（`$in`）避免 N+1

### 關鍵組件
1. 總覽 KPI（總瀏覽量、活動數）
2. Top 10 排行橫條圖
3. 各活動詳細卡片（每日趨勢、裝置佔比）
4. **資料起訖時間**（2026/07/23 新增）：header 副標下方顯示「資料起訖：YYYY-MM-DD ~ YYYY-MM-DD」，取 `baseMatch`（非僅 Top10 節目）範圍內 `time` 欄位的 `$min`/`$max`，換算 `Asia/Taipei` 時區日期；額外一次輕量聚合查詢（約 1–2 分鐘），置於 Step 1 總瀏覽量查詢之後

---

## 4. deca joins 場次流量明細（A_DecaJoins_Traffic_Analysis）

### 資料來源
- DB：`QwareAi` / `Qware_A_Traffic_session_data`
- 篩選：`節目名稱 === 'deca joins 2026 world tour － 在這裡停一下'`

### 場次對照表

| 場次代碼 | 場次名稱 |
|---------|--------|
| B0AQY9PL | 台北站 (5/1) |
| B0ARAQUY | 台北站 (5/2) |
| B0ARARJH | 台北站 (5/3) |
| B0ARASAV | 台中站 (5/8) |
| B0ARATMZ | 高雄站 (5/10) |

### 關鍵組件
1. 各場次總流量摘要卡片
2. 多場次每日折線圖（日期 X 軸）
3. 場次流量明細表（日期 × 場次矩陣）

---

## 5. 統一獅開賣首日 GA 即時分析（A_UniformLions_GA_Analysis）

### 資料來源
- DB：`QwareAi` / `QwareTrafficSession` + `QwareTrafficGAReadTime`
- ActivityID：`39455`
- 時間範圍：`2026-03-09 18:00–18:30`

### 核心邏輯
- 以分鐘為單位（18:00, 18:01, … 18:30）彙整
- `SessionCount` 取各分鐘最大值
- `ActiveUsersDCount` / `ActiveUsersACount`：D/A 系統即時活躍用戶

### 關鍵組件
1. 逐分鐘折線圖（Session + Active Users D/A）
2. 開賣高峰時間點標註

---

## 6. 更新方式

### ⚠️ 維護注意：HTML 與 Generator 必須同步

`A_GA_Traffic_Analysis_Report.html` 由 `generate_ga_report.js` **完整覆蓋產生**（整頁重新生成，非局部替換）。

**凡修改 HTML 中的任何邏輯，必須同步修改 `generate_ga_report.js` 對應位置，否則下次排程執行將整頁覆蓋，修改遺失。**

受影響的功能（歷史上曾被覆蓋過）：
- 最近月份趨勢分析區塊 — 2026/05/21 新增，已同步至 generator（直接嵌入 `momSection` 變數至模板字串）

---

```bash
# GA 月度（固定排程）
node generate_ga_report.js

# 其餘（手動）
node generate_alltime_top10_v3.js
node generate_deca_traffic_report.js
node generate_lions_ga_report.js

git add <report>.html
git commit -m "Update traffic report"
git push origin main
```
