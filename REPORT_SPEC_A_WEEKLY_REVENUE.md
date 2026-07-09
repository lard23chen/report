# A 系統週報分析報表 技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。

本文件定義「A 系統週報分析報表」的產出標準與設定。報表格式沿用每日快訊報表（`REPORT_SPEC_A_DAILY_REVENUE.md`），差異在於**統計區間為一週**且**排除 B 開頭訂單**。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `A_Qware_Revenue_Report_Weekly_YYYYMMDD-YYYYMMDD.html`（檔名帶週期起訖日，例：`A_Qware_Revenue_Report_Weekly_20260702-20260708.html`） |
| 產生腳本 | `generate_a_weekly_report.js` |
| 資料來源 | MongoDB `QwareAi` / `Qware_A_Ticket_data_Daily` |
| 負責人 | 陳俊良 |
| 主要目的 | 以每日快訊報表相同格式，彙整「上週四～本週三」一整週的交易分析 |
| 建立日期 | 2026/07/09 |

---

## 2. 與每日報表的差異（核心規則）

### 2.1 統計區間：上週四 ~ 本週三

- 執行時動態計算：往回找**最近一個已過完的週三**（執行日若為週三，取上一個週三）作為區間結束日，再往前推 6 天（週四）作為起始日。
- 例：2026/07/09（週四）執行 → 區間為 **2026/07/02 ~ 2026/07/08**。
- 標題格式：`YYYY年MM月DD日 - YYYY年MM月DD日 週報分析報表 (A系統)`。

### 2.2 排除 B 開頭訂單

- `訂單編號` 第一個字元為 `B` 的資料列**全數排除**（正常與退票皆排除），於任何統計之前先過濾。
- 頁首 Data Source 列註明「已排除訂單編號 B 開頭之訂單」。

### 2.3 週期歸屬判定

- **正常交易**：以 `交易時間` 落在區間內為準。
- **退票交易**：以 `退票時間` 落在區間內為準（`退票時間` 為空或 `-` 時 fallback `交易時間`）。與每日退票趨勢圖的日期取法一致，使 KPI、每日統計表與退票趨勢圖數字互相吻合。
- 每日交易統計表中，退票列同樣以退票日期歸入當日。

---

### 2.5 電子票/紙票統計（2026/07/09 新增，每日報表沒有）

- **判定規則**（沿用 `generate_report_dec_2025_final.js` 慣例）：`取票方式 === '未列印'` → **電子票**；`取票方式 === '已取'` → **紙票**。僅統計正常交易。
- **每日交易統計表**：在「購票張數」後新增「電子票」「紙票」兩欄，格式 `張數 (占比%)`，占比為佔**當日購票張數**比例；總計列同格式，占比為佔週總張數比例。
- **每日交易統計表標題與表頭為純中文**（不加英文對照，與每日報表不同；區塊標題「📊 每日交易統計」、欄位「日期／購票筆數／購票張數／電子票／紙票／購票金額／退票張數／退票手續費」、總計列「總計」）。
- **銷售排行 Top 5（by 金額 & by 張數）**：在「張數」後新增「電子票」「紙票」兩欄，格式相同，占比為佔**該節目張數**比例。
- 對應 `aggData` 欄位：`dailyStats[].eTickets / .pTickets`、`topByRevenue[].eTickets / .pTickets`、`topByTickets[].eTickets / .pTickets`；前端以 `cntPct(n, total)` 渲染。

## 3. 沿用每日報表的部分

以下皆與 `REPORT_SPEC_A_DAILY_REVENUE.md` 相同，不再重複：

- 視覺樣式（Light / Cyan Theme、Inter 字體）
- IP 白名單存取限制
- 核心統計邏輯（正常/退票判定、訂單去重、Decimal128 解析、AOV）
- 元件：6 張 KPI 卡片、每日趨勢折線圖（含當日最高張數節目標記）、退票趨勢折線圖、每日快報表格、銷售排行 Top 5（by 金額含場次子表 modal / by 張數）、退票排行 Top 5、付款方式分析、銷售點分析
- 下載 PDF / 回首頁固定按鈕

---

## 4. 更新方式

更新頻率：**每週四 08:30 自動排程**（2026/07/09 起）。

- Windows 工作排程器任務：`Qware_Weekly_Report_Update`，執行 `weekly_update.bat`（含重複執行保護與 `StartWhenAvailable` 錯過補跑），log 寫入 `weekly_log.txt`。排程細節見 `REPORT_SPEC_SCHEDULED_TASKS.md` §5。
- 週四執行時「上週四～本週三」資料已完整，且趕在滾動集合清掉週初資料之前。

手動更新：

```bash
node generate_a_weekly_report.js
git add A_Qware_Revenue_Report_Weekly.html
git commit -m "Update A weekly revenue report"
git push origin main
```

### 2.4 檔名帶週期日期，每週累積不覆蓋（2026/07/09 起）

- 每週產出**獨立檔案** `A_Qware_Revenue_Report_Weekly_{起始YYYYMMDD}-{結束YYYYMMDD}.html`，歷週報表保留不互相覆蓋。
- generator 產出報表後會自動做兩件事（皆為冪等，同週重跑不會重複插入）：
  1. **`report_index.html` tab7 插入本週卡片**：卡片標題與說明文字都帶週期日期（`週報 分析報表 (A系統) YYYY/MM/DD~YYYY/MM/DD`），插在 grid 最上方（最新在前）；若該檔名連結已存在則略過。
  2. **`HTML_Report_Catalog.html` 週報列改指最新一週**：連結 href、顯示檔名、更新時間、執行狀態時間戳全部換新。

## 5. 入口連結

- `report_index.html` 導覽儀表板已於 2026/07/09 新增「**週報報表分析**」Tab（`tab7`，位於「本月/上月報表」之後），歷週報表卡片依週期由新到舊排列（青色 `#06b6d4` 色系、Badge 為 `Weekly`）。卡片由 generator 自動插入（見 §2.4），**勿手動增刪 tab7 grid 內的卡片結構**。

## 6. 注意事項

- 資料來源 `Qware_A_Ticket_data_Daily` 為滾動集合（實測約保留 8 天資料），**必須在週三結束後、舊資料被清掉前執行**，否則週初資料可能缺漏（每週四 08:30 排程即為此設計）。
- 修改 HTML 元件時必須同步修改 `generate_a_weekly_report.js`（HTML 由腳本 template 產出，重跑會覆蓋手動修改）。
