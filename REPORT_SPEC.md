# 韋禮安「HI WE1 韋，您好 巡迴演唱會」台北場 — 報表規格文件

> 版本日期：2026-03-25
> 報表檔案：`A_WeiBird_Report_2026.html`
> 生成流程：`node generate_weibird_report.js` → `python transform_weibird.py`

---

## 一、專案背景

| 項目 | 內容 |
|------|------|
| 活動名稱 | 國泰世華銀行 2026 韋禮安「HI WE1 韋，您好 巡迴演唱會」台北場 |
| 場次 1 | 2026-05-30 19:30 |
| 場次 2 | 2026-05-31 16:30 |
| 場地容量（每場） | 11,146 座（依 sectionData 計算） |
| 開賣日期 | 2026-03-14（第一波）、2026-03-21（第二波） |
| 資料截止 | 2026-03-25（持續更新中） |

---

## 二、資料來源（MongoDB — QwareAi）

| 集合名稱 | 用途 | 查詢條件 |
|----------|------|----------|
| `Qware_A_Ticket_data_Daily` | 票券交易主資料 | `節目/商品名稱` = TARGET_NAME |
| `Qware_A_Section_number` | 票區座位容量 | `節目名稱` = TARGET_NAME |
| `QwareTrafficSession` | GA 開賣尖峰分鐘數據（Session/D/A） | `ActivityID` = 39484 |
| `QwareTrafficGAReadTime` | GA 開賣尖峰分鐘數據（ActiveUsers） | `ActivityID` = 39484 |
| `Qware_A_Traffic_session_data` | 每日網站瀏覽量趨勢（3/5–3/23） | `節目名稱` = TARGET_NAME_GA |
| `Qware_Member_data` | 會員國籍、縣市別 | `會員編號` IN（票券資料） |

### 關鍵欄位說明

- `交易時間`：格式 `YYYY-MM-DD HH:MM:SS`（本地時間）
- `售價`：數值（已在 generate 階段轉為 Number）
- `手續費`：`{ $numberDecimal }` 格式
- `演出時間/規格`：`2026-05-30 19:30:00` / `2026-05-31 16:30:00`
- `場次代碼`：`B0AVFRGX`（5/30）、`B0AYQQ74`（5/31）
- `gaSessions.SessionDate`：YYYYMMDD 整數
- `gaSessions.SessionTime`：HHMMSS 整數
- `pageViews.瀏覽日期`：ISO 格式 `2026-03-05T00:00:00.000Z`
- `pageViews.瀏覽量`：當日頁面瀏覽數

---

## 三、生成流程

```
1. node generate_weibird_report.js
   - 連線 MongoDB，抓取 6 個集合資料
   - 組合 dbData（含國籍/縣市/數值型別轉換）
   - 輸出含原始 JS 資料的 HTML（init() 為舊版簡易版）

2. python transform_weibird.py
   - pattern-match 原始 HTML，擷取 4 個資料陣列行：
       const dbData, const sectionData, const gaSessions,
       const gaReads, const pageViews
   - 重建完整 GoldenDisc 格式 HTML（覆蓋原檔）
   - 輸出最終報表
```

---

## 四、報表區塊說明（由上至下）

### 4.1 Header
- 活動標題、副標題
- 報表生成時間、總銷售筆數

### 4.2 KPI 卡片（stats-grid，8 張）

| ID | 名稱 | 計算邏輯 |
|----|------|----------|
| `val-revenue` | 總成交金額 | sum(`售價`)，狀態＝正常 |
| `val-tickets` | 總銷售張數 | count，狀態＝正常 |
| `val-aov` | 平均客單價 (AOV) | 總成交金額 ÷ 不重複訂單數 |
| `val-net-revenue` | 淨營收 | 總成交金額 − 退票金額 |
| `val-net-tickets` | 淨銷售張數 | 銷售張數 − 退票張數 |
| `val-refunds` | 退票金額 | sum(`實退金額`)，狀態＝已退票 |
| `val-refund-tickets` | 退票張數 | count，狀態＝已退票 |
| `val-refund-fees` | 退票手續費 | sum(`手續費.$numberDecimal`) |

> 參考數據（截至 2026-03-25）：總銷售 21,491 張、$50,435,840、AOV $4,863

### 4.3 各場次銷售概覽（showBreakdownTable）

依 `演出時間/規格` 分組，每場次對應 8 張卡片同欄位，末行加總計列。

| 場次 | 成交金額 | 銷售張數 | AOV | 淨營收 | 淨銷售張數 | 退票金額 | 退票張數 | 退票手續費 |
|------|----------|----------|-----|--------|------------|----------|----------|------------|
| 2026-05-30 19:30 | $26,057,700 | 11,050 | $5,000 | — | — | — | 302 | — |
| 2026-05-31 16:30 | $24,378,140 | 10,441 | $4,724 | — | — | — | 1,432 | — |
| 總計 | $50,435,840 | 21,491 | $4,863 | — | — | — | 1,734 | — |

### 4.4 網站流量趨勢（viewChart）

- 類型：Line Chart（Chart.js）
- 資料來源：`pageViews.瀏覽量`，依日期加總（多場次合計）
- 日期範圍：2026-03-05 ~ 2026-03-23
- fallback：若 `pageViews` 為空，改用 `gaSessions.SessionCount`

| 高峰日期 | 瀏覽量 |
|----------|--------|
| 2026-03-13（前日預熱） | 1,442,743 |
| 2026-03-14（第一波開賣） | 1,326,028 |
| 2026-03-20（前日預熱） | 546,050 |
| 2026-03-21（第二波開賣） | 1,101,026 |
| 2026-03-22（次日長尾） | 113,784 |
| 總計 | 4,543,265 |

### 4.5 每日銷售趨勢（trendChart）

- 類型：Line Chart
- 資料來源：`validOrders.交易時間`，依日期計張數
- 顯示：所有有銷售記錄的日期

### 4.6 性別分佈（genderChart）

- 類型：Pie Chart
- 來源：`validOrders.性別`，排除 `-`/`未知`/格式不符

### 4.7 年齡分佈（ageChart）

- 類型：Pie Chart
- 分組：`<18`, `18-24`, `25-34`, `35-44`, `45-54`, `55+`, `Unknown`
- 排除格式不符資料

### 4.8 城市分佈 Top 10（cityChart）

- 類型：Bar Chart（直式）
- 來源：`validOrders.縣市別`（由 `Qware_Member_data` 補入）
- 取不重複訂單數為計算基準

### 4.9 國籍分佈（natTable）

- 4 欄：國籍、人數(張數)、筆數、占比(進度條)
- 顯示前 5 名 + 其他
- `Taiwan, Province of China` 統一顯示為 `Taiwan`

### 4.10 付款方式（paymentTable）

- 3 欄：付款方式、筆數、占比(進度條)
- 末行加總計列

### 4.11 各票價銷售詳情（priceTable）

- 7 欄：票價、座位總數、保留數、可售數、銷售張數、營收、實銷率
- 依 `演出時間/規格` 分場次顯示，各場次有小計列，末行有總計
- 篩選條件：`座位總數 > 0` 且為數值（排除保留票區）
- 容量來源：`sectionData`，透過 `場次代碼→showCodeToDate` 對應場次日期
- 實銷率 = 銷售張數 ÷ 座位總數 × 100%
- 票價級距：$3,880 / $3,480 / $2,980 / $2,680 / $1,980 / $1,580 / $800

### 4.12 各銷售點分析（salesPointTable）

- 5 欄：銷售點、筆數、張數、營收、占比(進度條)
- 依營收排序，末行加總計列

### 4.13 開賣尖峰時段分析（4 張表）

每張表 13 欄，分鐘粒度（10:50–11:30）：

| ID | 開賣日期 | 場次 |
|----|----------|------|
| `minuteTable1_530` | 2026-03-14 | 5/30 |
| `minuteTable1_531` | 2026-03-14 | 5/31 |
| `minuteTable2_530` | 2026-03-21 | 5/30 |
| `minuteTable2_531` | 2026-03-21 | 5/31 |

**欄位（左→右）：**
時間 ｜ 每分鐘D(排隊) ｜ 每分鐘A(搶票) ｜ Session(連線) ｜ booking數 ｜ booking累加 ｜ 訂單張數 ｜ 訂單累加 ｜ 刷卡張數 ｜ 刷卡累加 ｜ ATM張數 ｜ ATM累加 ｜ 銷售率

**銷售率計算：** 累計訂單張數（該場次）÷ 該場次座位總數（11,146）× 100%
**隱藏規則：** 若該表的累計訂單張數為 0，自動隱藏整個 `.chart-card` 容器

> D/A/Session 來自 `gaSessions`/`gaReads`（共用，不分場次）
> booking/訂單/刷卡/ATM 僅計算 `filterShow` 對應場次的資料

### 4.14 客單價深度分析（aovAnalysisContainer）

自動產生文字敘述：
- 顯示 AOV 數值
- 熱銷票價前 3 名（依張數排序）
- 購買 1 張 vs 2 張訂單數比較

### 4.15 流量與轉換深度分析（trafficAnalysisContainer）

自動產生文字敘述：
- 總連線數、整體轉換率（銷售張數 ÷ 總連線數）
- 最高連線日及占比
- 長尾流量再行銷建議

---

## 五、CSS 設計規格

```css
--bg-color:          #0f172a
--card-bg:           #1e293b
--text-primary:      #f8fafc
--text-secondary:    #94a3b8
--accent-color:      #38bdf8  /* 主色：天藍 */
--success:           #22c55e
--danger:            #ef4444
```

- 尖峰時段表格 header：`#70ad47`（綠色，GoldenDisc 風格）
- GA 流量欄位 header：`#5a9bd5`（藍色）
- 金額高亮：`#ffd700`（黃金）

---

## 六、固定功能按鈕

| 按鈕 | 功能 | 位置 |
|------|------|------|
| 下載 PDF | `window.print()` | 右下 bottom:90px |
| 回首頁 | 連結至 `report_index.html` | 右下 bottom:30px |

---

## 七、待確認 / 潛在改善點

- [ ] `QwareTrafficSession` 資料僅到 3/15，已改用 `pageViews` 補足趨勢圖
- [ ] `pageViews` 目前最新至 3/23，後續仍需持續匯入
- [ ] 退票手續費場次拆分數字待確認（目前場次對應退票資料以 `演出時間/規格` 識別）
- [ ] 第二波開賣（3/21）的 D/A 分鐘數據仍待確認資料是否完整
