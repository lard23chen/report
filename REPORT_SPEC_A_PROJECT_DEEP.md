# A 系統專案深度評估報表 通用技術規範說明

本文件定義所有「演唱會 / 專案深度評估」類報表的共通規範。
目前涵蓋：金唱片頒獎典禮、李聖傑演唱會、統一獅例行賽、韋禮安演唱會、高雄啤酒音樂節。

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
| A_KaohsiungBeerFestival_2026.html | generate_kaohsiung_beer_festival_report.js | Qware_A_Ticket_data_Daily + Qware_Member_data |

---

## 2. 通用資料聯查模式

深度報表通常同時查詢以下多個集合：

| 集合 | 用途 |
|------|------|
| `Qware_Ticket_Data` 或 `Qware_A_Ticket_data_Daily` | 訂單/票券主資料（依事件時效選擇） |
| `Qware_A_Section_number` | 場次座位區資料（依節目名稱查） |
| `QwareTrafficSession` | GA 即時 session 數（依 ActivityID） |
| `QwareTrafficGAReadTime` | GA 即時 active users（依 ActivityID） |
| `Qware_A_Traffic_session_data` | 頁面瀏覽量（依節目名稱） |
| `Qware_Member_data` | 會員國籍與縣市（依會員編號批次查） |

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

> 舊報表（金唱片、李聖傑等）各有獨立主色調，尚未統一至此格式。

---

## 5. 專案專屬說明

### 金唱片頒獎典禮（A_GoldenDisc_Report）
- 篩選條件：`節目/商品名稱 === '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards'`
- ActivityID：`39311`
- 特色：加入 GA 流量分析（session + active users）、會員國籍地圖

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

### 高雄啤酒音樂節（A_KaohsiungBeerFestival_2026）
- 篩選條件：`節目/商品名稱 === '2026 7–ELEVEN 高雄啤酒音樂節'`（注意破折號為全形 `–`）
- 節目代碼：`B0BA4VPF`
- 場次：3 場（`演出時間/規格` 含日期判斷）
  - `2026-07-03`：7/3 (六) 15:00 Day 1
  - `2026-07-04`：7/4 (日) 15:00 Day 2
  - `2026-07-05`：7/5 (一) 16:00 Day 3
- 聯查集合：`Qware_A_Ticket_data_Daily`（票券主資料）+ `Qware_Member_data`（國籍 / 縣市）
- 開賣尖峰：`2026-05-13 12:00–13:00`（逐分鐘分析）
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

---

## 6. 更新方式

```bash
node generate_<script_name>.js
git add <report_name>.html
git commit -m "Update <report_name>"
git push origin main
```

更新頻率：**手動**（專案結束後一次性產出）
