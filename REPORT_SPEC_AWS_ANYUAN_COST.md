# 安源資訊 AWS 費用分析報表 技術規範說明

> ⚠️ **存取限制** — 本報表已設有 IP 白名單（沿用 `REPORT_SPEC_AZURE_COST.md` 同一份 ALLOWED 清單），僅限授權網路存取。

本文件定義「安源資訊 AWS 費用分析報表」的產出標準與設定，未來更新月份資料時請遵循此規範。

## 1. 基本資訊 (General Info)

- **報表名稱**：`AWS_Anyuan_Cost_Analysis_Report.html`
- **報表網址**：`https://lard23chen.github.io/NewReport/AWS_Anyuan_Cost_Analysis_Report.html`
- **資料來源**：客戶端（安源資訊，AWS 代理商）每月手動提供的 Excel 帳單，無 MongoDB 依賴
- **生成腳本**：`generate_aws_anyuan_cost_report.js`
- **主要目的**：追蹤「售票網_正式環境」（AccountId `822996750037`）每月 AWS 雲端費用，呈現月費用趨勢與帳單各項加減費用（Enterprise Support 費、優惠折扣、維運服務費）的明細拆解。
- **與 `Azure_Cost_Analysis_Report.html` 的關係**：兩者資料來源不同、費用口徑不同（該報表 `SystemD_Cost` 走 `AzureMonthlyCost` collection 另一條資料流，2026/06 數字為 $155,225，與本報表同月應繳總金額 NT$115,816 對不上），**不要互相替代或合併**，各自獨立維護。

---

## 2. 資料來源結構 (Excel Schema)

### 2.1 檔案命名規則

```
安源資訊_售票網_正式環境_YYYY_MM.xlsx
```

`YYYY_MM` 為該份帳單涵蓋的**最新月份**（如 `2026_06`），非單月帳單——`總表` 分頁本身就是當年 1 月至該月的累計資料，因此不需要保留每個月的舊檔案，直接以新檔案覆蓋/新增即可，generator 會自動挑選檔名最新（字串排序）的一份。

### 2.2 `總表` 分頁結構

| 欄位 | 內容 |
|------|------|
| Row 0（header） | `A`=報表標題、`B`=空、`C`~`N`=`1月(USD)`~`12月(USD)`、`O`=`年度合計` |
| Row 1~58 | 每個 AWS 服務一組（值列 + 中文說明列，說明列數值欄位皆為空） |
| Row 59 | `服務合計USD` |
| Row 60 | `結算匯率` |
| Row 61 | `服務合計USD-->NTD` |
| Row 62-63 | `AWS Enterprise Support費率` / `AWS Enterprise Support費用`（10%） |
| Row 64 | `服務合計(含AWS Enterprise Support)` |
| Row 65-66 | `優惠費率` / `優惠折扣`（15%，負值） |
| Row 67 | `服務合計(扣除優惠折扣)` |
| Row 68-69 | `基本型維運服務費率` / `基本型維運服務費`（10%） |
| Row 70 | `服務合計(含服務費)` |
| Row 71 | `已預付金額` |
| Row 72 | `應繳總金額NTD(未稅)` |

> generator 用「欄位 A 文字完全比對」找列，不依賴固定 row index；若安源資訊調整帳單版面（增刪服務列），仍可正確解析，但若**改動上述 12 個彙總列的文字標籤**，`parseSummarySheet()` 會拋錯，需同步修改 `SUMMARY_LABELS`。

### 2.3 各月明細分頁（`01`~`12`_售票網_正式環境）

本報表**未使用**明細分頁（僅用 `總表`）。明細分頁含每個 AWS 服務依地區/用量拆分的完整帳單行項目，以及含稅金額（`應繳總金額NTD(含稅)`，`總表` 沒有此列）。若未來需要「當月服務明細排行」，資料來源在此，欄位為 `A`=項目說明、`B`=unit price、`C`=Usage、`D`=sub-Total（USD）。

---

## 3. 視覺樣式設定 (Visual Styles)

沿用專案深色主題慣例，改用 **AWS 品牌橘**（呼應 Azure Cost Report 用 Azure 藍的做法）：

- 背景色 (`--bg-color`): `#121212`
- 卡片背景 (`--card-bg`): `#1e1e1e`
- 強調色 (`--accent-color`): `#FF9900`（AWS Orange）
- 次要強調 (`--accent-secondary`): `#42A5F5`
- 應繳總金額色 (`--color-final`): `#FF9900`
- 原始服務費色 (`--color-raw`): `#42A5F5`
- 優惠折扣色 (`--color-discount`): `#66BB6A`
- Support/維運費色 (`--color-support`): `#AB47BC`
- 字體：`Outfit`、`Noto Sans TC`（Google Fonts）

---

## 4. 核心組件 (Components)

### 4.1 頂部統計卡片

| 卡片 | 內容 |
|------|------|
| 最新月應繳總金額(未稅) | 金額 + 相較上月 ▲/▼%（費用上升=紅=壞，下降=綠=好，與 Azure Cost Report 語意一致） |
| 年度累計應繳總金額(未稅) | 至最新月為止的年度累計 |
| 月均費用 | 年度累計 ÷ 資料月數 |
| 最新月 AWS 原始服務費 | USD 原始金額 + 結算匯率換算 NTD |
| 最新月優惠折扣 | 已扣除金額（絕對值） |

### 4.2 每月費用趨勢圖

Chart.js `line`，雙線：
- 橘實線：應繳總金額NTD(未稅)（`finalNTD`）
- 藍虛線：AWS 服務原始費用(NTD，折扣前)（`serviceNTD`）

用意：對照「AWS 原始開銷」與「經過 Enterprise Support 費、優惠折扣、維運服務費調整後的實際應繳金額」之間的落差。

### 4.3 每月費用明細表格

欄位：月份 / AWS服務費(USD) / 結算匯率 / AWS服務費(NTD) / Enterprise Support費 / 優惠折扣 / 維運服務費 / 應繳總金額NTD(未稅)（含 MoM %）

- 資料以月份倒序顯示（最新在上）
- 表尾顯示區間加總列（匯率欄不加總，顯示 `—`）

### 4.4 最近月份趨勢分析 (MoM Analysis)

由 generator 在 Node.js 層以 `latest` / `prev` 產生的靜態文字區塊，**不得手動寫死在 HTML**（下次執行腳本會整頁覆蓋）：
- 💰 應繳總金額(未稅) ▲/▼% + 絕對差 + 當月金額
- ☁️ AWS 原始服務費 USD/NTD 各自 ▲/▼% + 絕對差 + 當月匯率

### 4.5 回首頁按鈕

固定右下角，連結 `report_index.html`（NewReport 站台首頁）。

### 4.6 IP 白名單

與 `Azure_Cost_Analysis_Report.html` 完全相同的 ALLOWED IP 清單（見 `REPORT_SPEC_AZURE_COST.md` 或直接看 HTML 內 `<script>`），財務資料一律套用內網限制。

---

## 5. 生成流程 (Generation Process)

```
安源資訊_售票網_正式環境_YYYY_MM.xlsx（客戶端手動提供，置於 repo 根目錄）
    ↓ 讀取檔名最新一份 → 解析「總表」分頁
generate_aws_anyuan_cost_report.js (Node.js)
    ↓ JSON.stringify(monthlyTrend) 注入 HTML
AWS_Anyuan_Cost_Analysis_Report.html
```

執行指令：
```bash
cd "D:\2025\AI\MongoDB"
node generate_aws_anyuan_cost_report.js
```

---

## 6. 新增月份資料流程 (Monthly Update SOP)

1. 取得客戶端提供的最新月份 Excel，檔名需符合 `安源資訊_售票網_正式環境_YYYY_MM.xlsx` 規則，放到 `D:\2025\AI\MongoDB` 根目錄（同名覆蓋或新檔皆可，只要月份是最新的）
2. 執行 `node generate_aws_anyuan_cost_report.js` 重新生成報表
3. 確認終端機輸出的「最新月份」與「應繳總金額」正確
4. 複製 `AWS_Anyuan_Cost_Analysis_Report.html` 到 `D:\2025\AI\NewReport`（本報表**直接發布於 NewReport**，非 `report` repo 的 GitHub Pages；MongoDB repo 僅保留 generator 原始碼與本機副本，不需另外部署）
5. `HTML_Report_Catalog.html` 的更新時間同步修改（MongoDB repo 與 NewReport 兩邊都要）
6. Git 操作：
   - MongoDB repo（`report` remote `origin`）：`git add generate_aws_anyuan_cost_report.js AWS_Anyuan_Cost_Analysis_Report.html HTML_Report_Catalog.html 安源資訊_售票網_正式環境_YYYY_MM.xlsx && git commit && git push origin main`
   - NewReport repo：`git add AWS_Anyuan_Cost_Analysis_Report.html HTML_Report_Catalog.html report_index.html && git commit && git push`（`origin` + `company` 兩個 remote，`company` 為公司內部 UAT 部署來源，推送前需與使用者確認）

---

## 7. 已知限制

- 未涵蓋含稅金額（`應繳總金額NTD(含稅)`）：`總表` 分頁沒有這個欄位，只在各月明細分頁才有；若未來需要顯示含稅金額，需改為解析明細分頁最後一列。
- 未拆解各 AWS 服務別占比（如 EC2 / CloudWatch / ElastiCache）：目前僅聚焦月費用趨勢，服務層級明細排行留待有需求時再擴充（資料已存在於 `總表` 各服務列與各月明細分頁，不需改資料來源）。

---

*建立日期：2026/07/31（首次建立，來源檔案 `安源資訊_售票網_正式環境_2026_06.xlsx`，資料範圍 2026/01～2026/06）*
