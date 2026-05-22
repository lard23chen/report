# GA 事件流量深度分析報表 技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義「GA 事件流量深度分析報表」的產出標準與設定，未來更新或重新產出此報表時，請遵循本規範。

## 1. 基本資訊 (General Info)

| 項目 | 說明 |
|------|------|
| 報表名稱 | `A_GA_Events_Traffic_Report.html` |
| 產生腳本 | `generate_ga_events_report.js` |
| 資料來源 | MongoDB `QwareAi` / `QwareTrafficSession` + `QwareTrafficGAReadTime` |
| 票務輔助來源 | `Qware_A_Ticket_data_Daily`（當月）/ `Qware_Ticket_Data`（歷史） |
| 負責人 | 陳俊良 |
| 主要目的 | 針對高流量活動（MaxSessions > 2000）進行每分鐘 GA 流量深度分析，含訂單/張數趨勢及峰值比較 |

## 2. 視覺樣式設定 (Visual Styles)

採用深色主題，以 Outfit + Noto Sans TC 字體呈現。

| CSS 變數 | 值 | 說明 |
|---|---|---|
| `--bg-color` | `#0f172a` | 頁面背景 |
| `--card-bg` | `#1e293b` | 卡片背景 |
| `--text-primary` | `#f8fafc` | 主要文字 |
| `--text-secondary` | `#94a3b8` | 次要文字 |
| `--accent-color` | `#3b82f6` | 強調色（藍） |
| `--purple` | `#8b5cf6` | 紫色 |
| `--green` | `#10b981` | 綠色 |

## 3. 資料篩選邏輯 (Data Filter Logic)

- 從 `QwareTrafficSession` 聚合：依 `ActivityID` 分組，取 `MaxSessions > 2000` 的活動
- 從 `QwareTrafficGAReadTime` 取讀取留存數據
- 按活動日期判斷票務集合：當月使用 `Qware_A_Ticket_data_Daily`，歷史使用 `Qware_Ticket_Data`
- 時間精度：**每分鐘** (YYYY-MM-DD HH:MM)

## 4. 關鍵組件與圖表 (Components & Charts)

### 4.1 側邊欄 (Sidebar)

左側固定欄，列出所有符合條件的活動，顯示：
- 活動名稱
- 資料記錄日期
- MaxSessions 數值

點擊切換右側主要內容。

### 4.2 KPI 卡片 (5 + 1 張)

| 卡片 | 說明 |
|------|------|
| 最高 A session數 | 峰值 Session 數 + 發生時間點 |
| 最高 D每分鐘流量 | D 類型每分鐘最高流量 + 發生時間點 |
| 最高 A每分鐘流量 | A 類型每分鐘最高流量 + 發生時間點 |
| 最高 每分鐘訂單 | 每分鐘最高訂單數 + 發生時間點 |
| 最高 每分鐘張數 | 每分鐘最高票券張數 + 發生時間點 |
| **資料記錄區間** | 顯示活動資料起迄時間（可點擊 → 連結至 IP 地理分析報表） |

### 4.3 資料記錄區間連結 (IP Geo Cross-link)

「資料記錄區間」卡片的時間文字為可點擊連結，根據活動日期自動判斷目標報表：

| 條件 | 目標報表 |
|------|------|
| 活動日期屬**本月** | `A_IP_Geo_Analysis_Report.html` |
| 活動日期屬**非本月（歷史）** | `A_IP_Geo_Analysis_Report_Historical.html` |

連結附帶 URL 參數，自動套用對應日期與時段篩選：

```
?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&startHour=<slot>&endHour=<slot>
```

**Slot 計算方式（30分鐘間距）：**
```
slot = hour × 2 + (minute >= 30 ? 1 : 0)
```
例：12:30 → slot 25；13:59 → slot 27

IP 地理分析報表（兩版本）在 `DOMContentLoaded` 時讀取 URL params 並自動套用篩選。

### 4.4 折線圖 (Line Chart)

顯示選定活動的每分鐘時序資料，多條數據線：
- A session數（藍）
- D每分鐘流量（黃）
- A每分鐘流量（綠）
- 每分鐘訂單（橙）
- 每分鐘張數（粉）

峰值點以 datalabels 標示。

### 4.5 資料明細表

每分鐘一列，顯示：GATime / D每分鐘流量 / A每分鐘流量 / A session數（峰值列高亮）/ 每分鐘訂單 / 每分鐘張數

預設從峰值前 10 分鐘開始顯示。

## 5. 更新方式 (Update Procedure)

```bash
node generate_ga_events_report.js

git add A_GA_Events_Traffic_Report.html generate_ga_events_report.js
git commit -m "Update GA events traffic report"
git push origin main
```

更新頻率：**手動 / 依需求**（新活動開賣後執行）

### ⚠️ 維護注意：HTML 與 Generator 必須同步

`A_GA_Events_Traffic_Report.html` 由 `generate_ga_events_report.js` 產出。

若只修改 HTML 而未同步修改 generator，下次執行 `node generate_ga_events_report.js` 時 **HTML 會被覆蓋**，手動修改的功能將遺失。

**規則：凡修改 HTML 中的 JS 邏輯，必須同步修改 `generate_ga_events_report.js` 對應位置。**

受影響的功能（歷史上曾被覆蓋過）：
- 4.3 資料記錄區間連結（`valTime` innerHTML / IP Geo cross-link）— 2026/05/07 被自動更新覆蓋，2026/05/08 已修復並同步 generator

## 6. 相關連結

- IP 地理分析報表（本月）：`A_IP_Geo_Analysis_Report.html`
- IP 地理分析報表（歷史）：`A_IP_Geo_Analysis_Report_Historical.html`
- 規範文件：`REPORT_SPEC_IP_GEO_ANALYSIS.md` / `REPORT_SPEC_IP_GEO_HISTORICAL.md`
