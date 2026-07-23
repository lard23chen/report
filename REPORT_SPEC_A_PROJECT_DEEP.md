# A 系統專案深度評估報表 通用技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義所有「演唱會 / 專案深度評估」類報表的共通規範。
目前涵蓋：金唱片頒獎典禮、李聖傑演唱會、統一獅例行賽、韋禮安演唱會、高雄啤酒音樂節 2025/2026、高雄櫻花季 2025/2026、台灣精品中華職棒明星對抗賽 2026、中華職棒37年 Rakuten主場例行賽。

---

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表類型 | 單一專案深度分析（手動觸發） |
| 主要腳本 | 各報表獨立腳本（見下表） |
| 資料來源 | MongoDB `QwareAi`，多集合聯查 |
| 負責人 | 陳俊良 |

### 各報表對應腳本

| 報表 | 腳本 | 資料集合 |
|------|------|---------|
| A_GoldenDisc_Report_2026-02-06.html | generate_golden_disc_report.js | Qware_Ticket_Data |
| A_SamLee_Report_2025_Taipei.html | generate_sam_lee_report.js | Qware_Ticket_Data |
| A_UniformLions_Order_Analysis_20260309.html | generate_lions_order_report.js | Qware_A_Ticket_data_Daily |
| A_WeiBird_Report_2026.html | generate_weibird_report.js | Qware_A_Ticket_data_Daily |
| A_BaseballAllStar_2026.html | generate_baseball_allstar_2026_report.js | Qware_A_Ticket_data_Daily + Qware_Member_data |
| A_KaohsiungBeerFestival_2025.html | generate_kaohsiung_beer_festival_2025_report.js | Qware_Ticket_Data + Qware_Member_data |
| A_KaohsiungBeerFestival_2026.html | generate_kaohsiung_beer_festival_report.js | Qware_A_Ticket_data_Daily + Qware_Member_data |
| A_KaohsiungSakuraFestival_2025.html | generate_kaohsiung_sakura_festival_2025_report.js | Qware_Ticket_Data + Qware_Member_data |
| A_KaohsiungSakuraFestival_2026.html | generate_kaohsiung_sakura_festival_report.js | Qware_Ticket_Data + Qware_Member_data |
| A_RakutenCPBL36_2025.html | generate_rakuten_cpbl36_report.js | Qware_A_Ticket_2025_Data + Qware_Member_data |
| A_RakutenCPBL37_2026.html | generate_rakuten_cpbl37_report.js | Qware_Ticket_Data + Qware_Member_data |

---

## 2. 通用資料聯查模式

深度報表通常同時查詢以下多個集合：

| 集合 | 用途 |
|------|------|
| `Qware_Ticket_Data` 或 `Qware_A_Ticket_data_Daily` | 訂單/票券主資料（依事件時效選擇） |
| `Qware_A_Section_number` | 場次座位區資料（依節目名稱查） |
| `QwareTrafficSession` | GA 即時 session 數（依 ActivityID，僅 GA 專用報表使用） |
| `QwareTrafficGAReadTime` | GA 即時 active users（依 ActivityID，僅 GA 專用報表使用） |
| `Qware_A_Traffic_session_data` | 每日頁面瀏覽量（依 `節目名稱` regex 查詢，欄位：`瀏覽日期`、`瀏覽量`）**啤酒節 / 櫻花季流量趨勢圖主要資料來源** |
| `Qware_Member_data` | 會員國籍與縣市（依會員編號批次查） |
| `AzureMonthlyCost_Daily` | 每日雲端費用成本（依 `Date` 欄位精確查詢，格式為 `YYYY/MM/DD`）**開賣日雲端費用成本區塊資料來源** |

### AzureMonthlyCost_Daily 欄位對應

| MongoDB 欄位 | JS 對應屬性 | 說明 |
|---|---|---|
| `Date` | `date` | 日期（字串，格式 `YYYY/MM/DD`） |
| `ASys` | `sysA` | A系統費用 |
| `DSysAWS` | `sysD` | D系統(AWS)費用 |
| ~~`ESys`~~ | ~~`sysE`~~ | **E系統費用 — 不納入成本計算，表格不顯示** |
| `Shared` | `shared` | 共用費用 |
| `Member` | `member` | 會員系統費用 |
| — | `total` | **sysA + sysD + shared + member**（不使用 `TotalRevenue`，已排除 E系統） |
| `Activity` | `activity` | 主要活動說明 |
| `Note` | `notes` | 備註 |

---

## 3. 通用統計項目

| 項目 | 說明 |
|------|------|
| 訂單筆數 | `訂單編號` 取底線前綴後去重 |
| 購票張數 | 正常狀態 row 數 |
| 購票金額 | 正常狀態 `售價` 加總 |
| 退票筆數/張數/手續費 | 退票狀態統計 |
| 場次分析 | 依 `演出時間/規格` 拆分 |
| 付款方式分布 | 訂單數 + 金額 |
| 票種分布 | 張數 + 金額 |
| 會員國籍/縣市 | join Qware_Member_data |
| 性別 / 年齡分布 | 依 `性別`、`出生年` 計算 |

---

## 4. 視覺樣式

**標準格式（WeiBird 格式，2026/05 起統一採用）：**

| CSS 變數 | 值 | 說明 |
|---|---|---|
| `--bg-color` | `#0f172a` | 深海軍藍背景 |
| `--card-bg` | `#1e293b` | 卡片背景 |
| `--text-primary` | `#f8fafc` | 主要文字 |
| `--text-secondary` | `#94a3b8` | 次要文字、軸線標籤 |
| `--accent-color` | `#38bdf8` | 天空藍強調色（圖表主色） |
| `--success` | `#22c55e` | 淨營收正值 |
| `--danger` | `#ef4444` | 退票、負值 |

- 字型：`'Outfit', 'Noto Sans TC'`（同 WeiBird）
- Header：`linear-gradient(to right, #1e293b, #0f172a)`，底部 4px accent 線
- Logo 文字：`linear-gradient(135deg, #38bdf8, #818cf8)` clip-text
- 卡片 hover：`border-color: var(--accent-color); transform: translateY(-5px)`
- 版面格線：`.stats-grid`（KPI）、`.show-split`（1fr×場次數）、`.main-content`（2fr 1fr）、`.demo-content`（1fr 1fr）

**性別分佈圖顏色（2026/05 對調統一）：**

| 報表類型 | 顏色陣列（index 0 先，index 1 後）|
|---|---|
| 啤酒節 2025/2026 | `['#fb7185', '#38bdf8', '#94a3b8', '#a78bfa']`（玫瑰/天藍） |
| 櫻花季 2025/2026 | `['#c084fc', '#f472b6', '#94a3b8', '#fb923c']`（紫/粉） |
| 金唱片、李聖傑、韋禮安、Deca Joins | `['#EC407A', '#42A5F5', '#BDBDBD']`（桃/藍） |

> 顏色順序為對調後的狀態；顏色與性別標籤的對應取決於資料中 `Object.keys(gStats)` 的出現順序。

> 舊報表（金唱片、李聖傑等）各有獨立主色調，尚未統一至此格式。

---

## 5. 專案專屬說明

### 金唱片頒獎典禮（A_GoldenDisc_Report）
- 篩選條件：`節目/商品名稱 === '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards'`
- ActivityID：`39311`
- 特色：加入 GA 流量分析（session + active users）、會員國籍地圖
- **開賣日雲端費用成本**：查詢 `AzureMonthlyCost_Daily`，Date `$in ['2025/12/13', '2025/12/14']`，顯示於報表最底部（金色主題表格，含合計列）
- 注意：`售價`、`原價`、`實退金額`、`手續費` 欄位須在 server 端做 `$numberDecimal` 正規化（`parseFloat(d[f].$numberDecimal)`），否則瀏覽器端計算結果為 NaN

### 李聖傑演唱會（A_SamLee_Report）
- 篩選條件：`節目/商品名稱 === '2025李聖傑 One Day直到那一天 世界巡迴演唱會 台北站'`
- 場次：2025/12/26、2025/12/27（以 `演出時間/規格` 拆分）

### 統一獅例行賽（A_UniformLions_Order_Analysis）
- 篩選條件：`節目名稱 regex '中華職棒37年例行賽統一獅主場（上）'`、`交易時間 regex '^2026-03-09'`
- 時間範圍：18:00–23:59（開賣首日）
- 特色：逐分鐘趨勢分析、性別/年齡分布

### 韋禮安演唱會（A_WeiBird_Report）
- 篩選條件：`節目/商品名稱 === '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場'`
- ActivityID：`39484`
- GA 節目名稱（查流量用）：`'國泰世華銀行 2026 韋禮安 韋，您好 HI WE1巡迴演唱會'`

### 台灣精品中華職棒明星對抗賽 2026（A_BaseballAllStar_2026）
- 篩選條件：`節目/商品名稱 === '2026年台灣精品中華職棒明星對抗賽'`
- 節目代碼：`B0BN5Y8D`
- 場次：2 場，場地為臺北大巨蛋
  - `2026-07-18`：7/18 (六) 18:05 Day 1
  - `2026-07-19`：7/19 (日) 17:05 Day 2
- 聯查集合：`Qware_A_Ticket_data_Daily`（票券主資料）+ `Qware_Member_data`（國籍 / 縣市）
- 開賣日：`2026-06-22`（首筆交易 14:18:39）
- 開賣尖峰：`2026-06-22 14:00–15:00`（峰值於 14:18 / 14:19，各 600 張）
- 票別：全票、優惠票、身障輪椅席票、身障輪椅席陪同票、貴賓券
- 票價：$0 ~ $4,390（20 個價格層級）
- **流量趨勢圖**：無（`Qware_A_Traffic_session_data` 無此節目資料，已省略 viewChart 區塊）
- 視覺格式：WeiBird 格式（navy 主題），**accent-color 改為翠綠 `#34d399`**（棒球場地配色）
- 額外分析區塊：**座位區域分析 Top 20**（`座位資訊/票區` 欄位，棒球事件特有）
- 峰值分析備注：現金付款顯示於「現金」欄（取代啤酒節的「ATM」欄）
- 每日銷售：2026-06-22 (2,841) / 2026-06-23 (9,301) / 2026-06-24 (46,895)
- **PDF 下載**：header 右側「⬇ 下載 PDF」按鈕，呼叫 `window.print()`，由瀏覽器原生列印引擎輸出（存成 PDF）
  - `@media print` 規則：`@page { size: A3 landscape; margin: 10mm; }`
  - `print-color-adjust: exact` 保留深色背景與自訂色彩
  - Grid 欄位強制設定（stats-grid 6 欄、main-content 2:1、demo-content 1:1、show-split 1:1）
  - `break-inside: avoid` 防止 chart-card / card 跨頁截斷
  - 按鈕本身在列印時隱藏（`display: none`）
  - 棄用 html2pdf.js（無法正確渲染 CSS Grid + Canvas 複合版面）

### 中華職棒36年 Rakuten主場例行賽（A_RakutenCPBL36_2025）
- 篩選條件：`節目/商品名稱 regex '中華職棒36年Rakuten'`（含所有子活動類型及總冠軍賽，共 7 種）
- 資料來源：`Qware_A_Ticket_2025_Data`（**含 `$numberDecimal` 正規化**：售價 / 原價 / 實退金額 / 手續費）
- 聯查集合：`Qware_Member_data`（依 `會員編號` 批次查，取國籍 / 縣市）
- 場次：64 場（例行賽 61 場 2025-04-08 ~ 2025-09-29 + 總冠軍賽 3 場 2025-10-11 / 10/21 / 10/26）
- 場地：樂天桃園棒球場 + 臺北大巨蛋
- 子活動類型（共 7 種）：
  - 主場例行賽（主）：582,567 筆 / 特色席位＆套票：29,441 筆 / 小周末套票：564 筆
  - 動紫趴三日套票：145 筆 / 水蜜桃雙人套票：170 筆 / 遠東商銀寵物樂園：192 筆
  - 主場總冠軍賽：70,426 筆
- 總資料筆數：683,505 筆
- 交易期間：2025-03-11 ~ 2025-10-26
- 開賣日：2025-03-11 16:30（首筆交易）
- **視覺格式**：WeiBird navy 主題，accent-color `#f43f5e`（Rakuten 品牌紅）
- **場次表格**：場地徽章（大巨蛋紅 `#f43f5e` / 桃園橙 `#fb923c`）+ 總冠軍賽金黃徽章 `#facc15`
- **各場次銷售張數圖**：大巨蛋=紅、桃園=橙、總冠軍賽=金黃
- **預聚合 HTML 架構**：683k 筆 server 端聚合 → HTML 僅嵌入 JSON（50 KB）
- **PDF 下載**：呼叫 `window.print()`，`@page { size: A3 landscape; margin: 10mm; }`

### 中華職棒37年 Rakuten主場例行賽（A_RakutenCPBL37_2026）
- 篩選條件：`節目/商品名稱 regex '中華職棒37年Rakuten'`（含所有子活動類型，共 6 種）
- 資料來源：`Qware_Ticket_Data`（**含 `$numberDecimal` 正規化**：售價 / 原價 / 實退金額 / 手續費）
- 聯查集合：`Qware_Member_data`（依 `會員編號` 批次查，取國籍 / 縣市）
- 場次：31 場（2026-03-28 ~ 2026-07-10）
- 場地：樂天桃園棒球場（213,825 張）+ 臺北大巨蛋（56,017 張，3/28 單場 35,036 張最高）
- 子活動類型（共 6 種）：
  - 主場例行賽（主）：264,505 筆 / 特色席位：9,303 筆 / 黑松沙士快樂炒：3,074 筆
  - 小周末套票_周五版：513 筆 / 小周末套票_周三版：451 筆 / 動紫三日套票：110 筆
- 銷售總覽：
  - 總銷售張數：269,842（正常）/ 退票：8,114
  - 總成交金額：$124,107,675 / 退票金額：$4,663,916 / 淨營收：$119,443,759
  - 訂單去重：`訂單編號.split('_')[0]`
- 付款方式：信用卡（110,550）/ 現金（159,292）
- 交易期間：2026-03-04 ~ 2026-05-31
- 開賣日：2026-03-04 10:00（首筆 10:00:13）/ 當日 21,160 張
- 開賣尖峰：2026-03-04 10:01（529 張/分）
- 每月購票量：2026-03（131,092）/ 2026-04（75,594）/ 2026-05（63,156）
- **視覺格式**：WeiBird navy 主題，accent-color `#f43f5e`（Rakuten 品牌紅）
- **預聚合 HTML 架構**（非嵌入原始資料）：
  - Node.js 端完成所有統計，HTML 僅嵌入聚合 JSON（~40 KB）
  - 原因：278k 筆嵌入約 250MB，超過 GitHub 100MB 上限
- **主要分析區塊**：KPI 6 項 → 場次 Table（31 場）→ 子活動 + 場地圓餅 → 月別/場次 Bar → 每日趨勢 Bar → 性別 + 年齡 → 城市 Top 10 + 國籍/付款/取票 Table → 票別 + 票價 Table → 銷售點 Top 20 → 開賣尖峰 Table
- **場次表格**：場地以徽章顯示（大巨蛋紅 `#f43f5e` / 桃園橙 `#fb923c`）
- **PDF 下載**：呼叫 `window.print()`，`@page { size: A3 landscape; margin: 10mm; }`

### 高雄啤酒音樂節 2025（A_KaohsiungBeerFestival_2025）
- 篩選條件：`節目/商品名稱 === '2025 7-ELEVEN高雄啤酒音樂節'`
- 場次：3 場（2025-07-04 / 2025-07-05 / 2025-07-06）
- 聯查集合：`Qware_Ticket_Data` + `Qware_Member_data`
- 開賣尖峰：`2025-05-23 12:00–13:00`
- **流量趨勢圖**：`Qware_A_Traffic_session_data`（節目名稱 regex `高雄啤酒`），顯示範圍 `>= 2025-05-23`
- 特殊說明：含天候退票分析（退票率偏高，notice box 提示）

### 高雄啤酒音樂節 2026（A_KaohsiungBeerFestival_2026）
- 篩選條件：`節目/商品名稱 === '2026 7–ELEVEN 高雄啤酒音樂節'`（注意破折號為全形 `–`）
- 節目代碼：`B0BA4VPF`
- 場次：3 場（`演出時間/規格` 含日期判斷）
  - `2026-07-03`：7/3 (六) 15:00 Day 1
  - `2026-07-04`：7/4 (日) 15:00 Day 2
  - `2026-07-05`：7/5 (一) 16:00 Day 3
- 聯查集合：`Qware_A_Ticket_data_Daily`（票券主資料）+ `Qware_Member_data`（國籍 / 縣市）
- 開賣尖峰：`2026-05-13 12:00–13:00`（逐分鐘分析）
- **流量趨勢圖**：`Qware_A_Traffic_session_data`（節目名稱 regex `高雄啤酒`），顯示範圍 `>= 2026-05-13`
- 圖表清單：
  - KPI 卡片（6 張）：總成交金額、總銷售張數、總訂單筆數、客單價、退票張數、淨營收
  - 場次銷售概況（`.show-split` 3 欄卡片）
  - 每日銷售趨勢（bar chart）
  - **每日各場次購票趨勢（line chart，3 場次各一條線，天空藍 / 靛紫 / 玫瑰）**
  - 性別分佈（doughnut）、年齡分佈（bar）
  - 城市 Top 10（橫向 bar）、付款方式 + 取票方式（table）
  - 票別分析、票價分析（table + progress bar）
  - 銷售點 Top 20（table）
  - 開賣尖峰分析（table，逐分鐘張數 / 累計 / 信用卡 / ATM / 轉換率）
- 視覺格式：**WeiBird 格式**（navy 主題，見第 4 節）
- 更新方式：`generate_kaohsiung_beer_festival_report.js` 曾加入 `daily_update.bat` 每日 08:00 自動執行，**2026/07/23 起依使用者要求移除**，改回本節開頭定義的手動觸發（見 `REPORT_SPEC_SCHEDULED_TASKS.md` §2.2/§2.3 追記）

### 高雄櫻花季 2025（A_KaohsiungSakuraFestival_2025）
- 篩選條件：`節目/商品名稱 === '2025 7-ELEVEN高雄櫻花季 SAKURA FESTIVAL'`
- 場次：3 場（2025-03-28 / 2025-03-29 / 2025-03-30）
- 聯查集合：`Qware_Ticket_Data` + `Qware_Member_data`
- 開賣日：**2025-01-04**（Day 1）、**2025-01-05**（Day 2）— 雙開賣日尖峰分析
- 流量趨勢圖：未接 `Qware_A_Traffic_session_data`（無此資料）
- 特殊說明：含大量退票 notice box（天候因素）

### 高雄櫻花季 2026（A_KaohsiungSakuraFestival_2026）
- 篩選條件：`節目/商品名稱 === '2026 7-ELEVEN高雄櫻花季 SAKURA FESTIVAL'`
- 節目代碼：`B0AJKPPD`
- 場次：3 場（2026-03-13 / 2026-03-14 / 2026-03-15）
- 聯查集合：`Qware_Ticket_Data` + `Qware_Member_data`
- 開賣尖峰：`2025-12-23 12:00–13:00`
- **流量趨勢圖**：`Qware_A_Traffic_session_data`（節目名稱 regex `高雄櫻花`），顯示範圍 `2025-12-23 ~ 2026-02-01`
- **開賣日雲端費用成本**：查詢 `AzureMonthlyCost_Daily`，Date `$in ['2025/12/23', '2025/12/24']`，顯示於報表最底部（粉紫主題表格，含合計列）
- 視覺格式：粉紫主題（`--accent-color: #f472b6`）

---

## 6. 更新方式

```bash
node generate_<script_name>.js
git add <report_name>.html
git commit -m "Update <report_name>"
git push origin main
```

更新頻率：**手動**（專案結束後一次性產出）
