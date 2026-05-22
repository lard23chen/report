# 高雄啤酒音樂節 監控搶票訂單分析報表 技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義「2026 7-ELEVEN 高雄啤酒音樂節 監控搶票訂單分析報表」的產出標準與設定，未來更新或重新產出此報表時，請遵循本規範。

## 1. 基本資訊 (General Info)

| 項目 | 說明 |
|------|------|
| 報表名稱 | `A_BeerFestival_OrderMonitor_2026.html` |
| 產生腳本 | `generate_beer_order_monitor.js` |
| 資料來源 | Google Sheets「監控搶票訂單數」(ID: `1ZsTasNipcvmWNHi53lBtJMmM191m6h_hYuN6o7wTiYU`) |
| 分析頁籤 | `啤酒節5/13`、`啤酒節5/14` |
| 分析時段 | 12:00–12:50（51 分鐘，每分鐘一列） |
| 活動名稱 | 2026 7-ELEVEN 高雄啤酒音樂節（ActivityID 39590） |
| 負責人 | 陳俊良 |
| 主要目的 | 比較 5/13 與 5/14 兩日開賣期間每分鐘訂單流量、QIT 等候室壅塞情形，輔助容量規劃與開賣後檢討 |

## 2. 視覺樣式設定 (Visual Styles)

採用深色琥珀/金色主題（Beer Festival 專屬色調）。

| CSS 設定 | 值 | 說明 |
|---|---|---|
| body 背景 | `#1a1200` | 深棕黑 |
| header 漸層 | `#2d1a00 → #4a2800` | 深琥珀漸層 |
| 主要強調色 | `#ffd000` | 金黃 |
| 5/13 系列色 | `#ff9900` | 橙色 |
| 5/14 系列色 | `#4dd0e1` | 青色 |
| 邊框色 | `#c68000` | 琥珀金 |
| 圖表網格 | `#2a1800` | 深棕 |

## 3. 資料欄位說明 (Data Columns)

Google Sheets 原始欄位（共 13 欄）：

| 欄位 | 說明 |
|------|------|
| 時間 | HH:MM（台灣時間，每分鐘） |
| booking數 | 該分鐘新增 Booking 筆數 |
| booking數（累加） | 開賣以來累計 Booking 筆數 |
| 訂單張數 | 該分鐘新增訂單票券張數 |
| 訂單張數（累加） | 開賣以來累計訂單張數 |
| 刷卡張數 | 該分鐘刷卡成功票券張數 |
| 刷卡張數（累加） | 開賣以來累計刷卡張數 |
| 國內IP/QIT等候室人數 | 國內 IP 在 QIT 等候室中的人數 |
| 國內IP/從等候室進至活動人數 | 該分鐘從等候室放行人數 |
| 國內IP/max流出量設定 | 當前最大流出量設定值 |
| 國外IP/QIT等候室人數 | 國外 IP 在 QIT 等候室中的人數 |
| 國外IP/從等候室進至活動人數 | 該分鐘從等候室放行人數 |
| 國外IP/max流出量設定 | 當前最大流出量設定值 |

### 備注：QIT 等候室資料空白段

5/13 資料於 12:44–12:50（共 7 筆）QIT 欄位為空，已代入 0 處理。

## 4. 關鍵組件與圖表 (Components & Charts)

### 4.1 KPI 卡片（6 張，上下雙列比較）

每張卡片同時顯示 5/13（橙色）和 5/14（青色）數值：

| 卡片 | 說明 |
|------|------|
| 總 Booking 數 | 51 分鐘累計，含 5/14 vs 5/13 增幅百分比 |
| 總訂單張數 | 51 分鐘累計，含增幅百分比 |
| 總刷卡張數 | 51 分鐘累計 |
| Booking 尖峰分鐘 | 格式：`HH:MM (數值)` |
| 訂單尖峰分鐘 | 格式：`HH:MM (數值)` |
| 國內 QIT 等候室峰值 | 當日最高等候室人數 |

### 4.2 走勢圖（4 張，2×2 格線佈局）

使用 `chart.js@4.4.0` + `chartjs-plugin-datalabels@2.2.0`。

| 圖表 | 資料欄位 | 備注 |
|------|---------|------|
| 每分鐘 Booking 數比較 | `booking` | 折線圖 |
| 每分鐘訂單張數比較 | `orders` | 折線圖 |
| 累積訂單張數比較 | `ordersCum` | 折線圖 |
| 國內 IP QIT 等候室人數 | `domQIT` | 折線圖 |

**節點標籤規則（datalabels）：**
- 數值 ≥ 100 才顯示標籤（避免低值雜訊）
- 5/13 標籤在節點**上方**（anchor: end, align: top），橙色
- 5/14 標籤在節點**下方**（anchor: start, align: bottom），青色
- `display: 'auto'` 自動隱藏過密標籤，`clamp: true` 防止溢出圖框
- `pointRadius: 3`，`pointHoverRadius: 5`

### 4.3 每 30 分鐘區段統計表

| 區段 | 5/13 Booking | 5/13 訂單 | 5/13 刷卡 | 5/14 Booking | 5/14 訂單 | 5/14 刷卡 | 訂單增幅 |
|------|---|---|---|---|---|---|---|

區段定義：
- 12:00–12:29（前 30 分鐘）
- 12:30–12:50（後 21 分鐘）

### 4.4 每分鐘明細表（分頁切換）

- 分頁按鈕：「啤酒節 5/13」/ 「啤酒節 5/14」
- 13 欄完整顯示所有原始欄位
- 12:30 列加上分隔線（`tr.divider`）
- 最大高度 460px，超出則捲動

## 5. 資料讀取方式 (Data Source Access)

資料透過 Google Drive MCP 讀取 Google Sheets：

1. 使用 `mcp__claude_ai_Google_Drive__read_file_content` 讀取試算表
2. 回傳的 fileContent 為 Markdown 表格格式（以 `\n` 分隔行）
3. 以 PowerShell 解析後，由 `generate_beer_order_monitor.js` 讀取 `tmp_beer_data.json` 產出 HTML

**注意：MCP 回傳結果含 UTF-8 BOM，不可直接 `JSON.parse`，需用 `System.Text.UTF8Encoding($false)` 存檔排除 BOM。**

## 6. 更新方式 (Update Procedure)

更新資料時需重新從 Google Sheets 讀取：

```powershell
# Step 1: 用 MCP 重新讀取 Google Sheets 資料（啤酒節5/13 + 啤酒節5/14）
# Step 2: 執行 PowerShell 解析並存成 tmp_beer_data.json（UTF-8 無 BOM）
# Step 3:
node generate_beer_order_monitor.js

git add A_BeerFestival_OrderMonitor_2026.html generate_beer_order_monitor.js
git commit -m "Update beer festival order monitor report"
git push origin main
```

### ⚠️ 維護注意：HTML 與 Generator 必須同步

`A_BeerFestival_OrderMonitor_2026.html` 由 `generate_beer_order_monitor.js` 產出。

若只修改 HTML 而未同步修改 generator，下次執行時 **HTML 會被覆蓋**。

**規則：凡修改 HTML 中的 JS 邏輯，必須同步修改 `generate_beer_order_monitor.js` 對應位置。**

## 7. 已知問題與歷史修正 (Known Issues & Fixes)

| 日期 | 問題 | 修正 |
|------|------|------|
| 2026/05/14 | PowerShell heredoc 展開 JS `${}` template literals，頁面無資料 | 改用 Node.js generator + ES5 string concatenation |
| 2026/05/14 | `data514` 的 `intlQIT/intlIn/intlMax` 欄位因 PS 變數名稱衝突產生垃圾字串 | 改用短屬性名（IQ/II/IM）避免展開衝突，加入 `node --check` 語法驗證 |
| 2026/05/14 | `tmp_beer_data.json` 含 UTF-8 BOM 導致 `JSON.parse` 失敗 | 改用 `new System.Text.UTF8Encoding($false)` 輸出無 BOM 檔案 |

## 8. 相關連結

- 啤酒音樂節 GA 流量分析：`A_BeerFestival_GA_Analysis_2026.html`
- 啤酒音樂節節目報表：`A_KaohsiungBeerFestival_2026.html`
- GA 規範文件：`REPORT_SPEC_GA_EVENTS_TRAFFIC.md`
