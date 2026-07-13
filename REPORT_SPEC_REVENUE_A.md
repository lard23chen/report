> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。

# ibon 營收分析報表 (A系統) 技術規範說明

本文件定義了「A系統營收分析報表」的產出標準與設定，未來產出相同類型的月份或專案報表時，請務必遵循此設定規範。

## 1. 基本資訊 (General Info)
- **報表名稱格式**：`A_Qware_Revenue_Report_YYYY年MM月_分析報表.html`
- **資料來源**：MongoDB (`QwareAi` / `Qware_Ticket_Data`)
- **負責人**：陳俊良
- **主要目的**：分析特定月份或時段的購票營收、退票狀況、支付佔比及銷售點分佈。

## 2. 視覺樣式設定 (Visual Styles)
報表採用 **Pink/Rose** 色系，展現現代感且專業的視覺效果。

- **配色方案 (CSS Variables)**:
  - 背景色 (`--bg-color`): `#fce4ec` (淺粉)
  - 卡片背景 (`--card-bg`): `#ffffff`
  - 主要文字 (`--text-primary`): `#880e4f` (深紫紅)
  - 次要文字 (`--text-secondary`): `#ad1457`
  - 強調色 (`--accent-color`): `#d81b60`
- **字體**: `Inter`, sans-serif (Google Fonts)
- **Logo**: 必須包含 ibon Logo (Base64 或 官方連結 `https://ticket.ibon.com.tw/assets/img/logo.png`)。

## 3. 核心統計邏輯 (Core Logic)
在計算各項指標時，必須遵循以下邏輯：

- **排除 B 開頭訂單（2026/07/09 起）**: `generate_monthly_report.js` 查詢時以 `"訂單編號": { $not: /^B/ }` 排除訂單編號 B 開頭的訂單，全報表統計皆不含 B 訂單；頁首 Data Source 列標明「已排除訂單編號 B 開頭之訂單」。與首頁月份統計表（`update_index_stats.js`）及週報口徑一致。2026年01月～06月報表已全數依新口徑重新產出（2026/07/09 回溯），各月總營收與首頁月份統計表完全一致；**2025年12月以前的報表（已封存至 report-archive 庫）仍為舊口徑（含 B 訂單），未重產**。
- **正常交易 (Valid Orders)**: 狀態欄位為 `正常` 的資料。
- **退票交易 (Refunded)**: 狀態欄位為 `已退票` 或 `退票`，或 `手續費` > 0 的資料。
- **總營收 (Total Revenue)**: `正常` 狀態下 `售價` 的加總。
- **訂單筆數 (Distinct Orders)**: `訂單編號` 取底線 (`_`) 前的前綴字串進行不重複計數 (Set)。
- **客單價 (AOV)**: `總營收 / 訂單筆數`。
- **退票金額**: `已退票` 或 `退票` 狀態下 `實退金額` 的加總。
- **退票手續費**: 全體資料中 `手續費` 的加總（此項視為系統實質營收）。

## 4. 關鍵組件與圖表 (Components & Charts)

### 4.1 數據卡片 (Stats Grid)
必須包含以下七個關鍵指標：
1. 總營收 (Total Revenue)
2. 客單價 (AOV)
3. 總交易張數 (Total Tickets)
4. 總訂單筆數 (Distinct Orders)
5. 總退票張數 (Total Refunded Tickets)
6. 總退票金額 (Refunded Amt)
7. 退票手續費 (Refund Fees)

### 4.2 趨勢圖表 (Trend Charts)
- **營收趨勢圖**: 使用 `Chart.js` 的 `line` 類型，呈現每日銷售額。
  - 必須加入 `Annotation` 插件，在銷售高峰（如開賣日 > 600萬）標註銷售最高的節目名稱。
- **退票趨勢圖**: 呈現每日退票金額走勢。

### 4.3 分析表格 (Data Tables)
- **銷售排行 Top 5**: 分別依據「金額」與「張數」進行排行，必須嚴格限制僅顯示前 5 名。
- **電子票/紙票欄**（2026/07/13 新增，2026年06月報表起適用）:
  - 兩張銷售排行表在「張數」右側各有「電子票 (E-Ticket)」「紙票 (Paper)」欄，顯示張數與占**該節目張數**的比例（括號小字）。
  - 判定規則與 report_index 月份統計/週報一致：`取票方式` 未列印=電子票、已取=紙票。
  - 實作：`generate_monthly_report.js` 聚合時累計 `eTickets` / `paperTickets`（projection **必須包含 `取票方式`**）；表頭在 `uiTemplate` 上以 table id（`topEventsTable` / `topTicketsEventsTable`）錨定的 regex 動態插入，**共用模板 `generate_report_feb_2026.js` 本身未改**（避免歷史二月報表重跑時欄位錯位），列模板 `revenueRowTpl` / `ticketsRowTpl` 以 `ttCell()` helper 產出兩欄。退票排行不套用。
- **銷售排行「全部 / 排除體育」切換鈕**（2026/07/06 新增，2026年06月報表起適用）:
  - 位於「銷售排行 Top 5 (By Revenue)」標題列右側（`#rankViewToggle`），一鍵同時切換金額與張數兩張表，預設「全部」。
  - **排除邏輯**: 過濾 `業態別 === '運動票'` 的節目後重新取 Top 5（資料庫欄位，非名稱關鍵字比對）。退票排行不套用。
  - **佔比分母維持全月總營收**，切換前後百分比可直接比較。
  - 資料由 `generate_monthly_report.js` 產出 `summaryData.topByRevenueNoSports` / `topByTicketsNoSports`；抓數據的 projection **必須包含 `業態別` 欄位**（漏掉會使 category 全為「未知」、排除失效）。
  - 切換函式 `window.switchRankView(mode)` 在 `generate_monthly_report.js` 注入的 JS 內；按鈕 HTML 與 `.rank-toggle-btn` CSS 在 `generate_report_feb_2026.js` 的 `htmlContent` 模板內，**兩者必須同步維護**。
- **退票排行 Top 5**: 依據「退票手續費金額」進行排行，必須嚴格限制僅顯示前 5 名。
- **維度分析完整性**: 「付款方式分析」與「銷售點分析」表格中，除營收與佔比外，**必須包含該維度的「訂單筆數」與「票券張數」**。

### 4.4 互動功能 (Interactions)
- **活動深鑽 (Analysis Modal)**: 
  - 點擊表格中的節目名稱彈出。
  - **必須包含該活動專屬的「每日銷售趨勢圖」** (Chart.js)。
  - 票價分佈表必須按 **票價由高至低** 排序。
  - 需顯示退票原因分析及其產生的手續費。

## 5. 實作注意事項 (Implementation Notes & Pitfalls)
處理大量數據 (如 30 萬筆以上) 時，請務必遵循以下開發原則：

- **後端彙總 (Backend Aggregation)**: 禁止將數十萬筆明細直接注入 HTML。必須在產生階段 (Node.js) 完成所有的 `sum`, `count`, `groupBy` 運算，僅將彙總後的 `summaryData` 注入前端。
- **HTML 結構保留**: 在使用正則或字串替換注入數據時，必須確保 `<body>` 內的 UI 結構 (如 `div.container`, `canvas` 標籤) 完整保留，不可只保留 `<script>`。
- **字串轉義 (Escaping)**: 節目名稱若含有單引號 (`'`)，在注入 `onclick="analyzeEvent('...')"` 時會導致 JS 語法錯誤。必須使用 `.replace(/'/g, "\\'")` 進行轉義。
- **資料型態轉換**: MongoDB 的 `Decimal128` 在輸出時為物件 `{ $numberDecimal: "..." }`，必須先轉換為 `Number` 才能進行運算。
- **圖表清理**: 在 Modal 內重新渲染 Chart.js 時，必須先執行 `chart.destroy()` 釋放記憶體，避免圖表重疊。

## 6. 輸出規範 (Output Requirements)
- **檔案編碼**: 儲存檔案時必須添加 BOM (`\ufeff`)。
- **功能按鈕**: 底部需提供「下載 PDF (列印模式)」與「回首頁」按鈕。實作範本如下：

```html
<!-- Fixed PDF Button -->
<button onclick="downloadPDF()" style="
    position: fixed; bottom: 90px; right: 30px;
    background: linear-gradient(135deg, #1e88e5, #1565c0);
    color: white; padding: 12px 24px; border: none; border-radius: 50px;
    cursor: pointer; font-weight: 600; font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(30, 136, 229, 0.4);
    display: flex; align-items: center; gap: 8px; transition: all 0.3s ease; z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(30, 136, 229, 0.5)';"
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(30, 136, 229, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
    下載 PDF
</button>

<script>
    function downloadPDF() { window.print(); }
</script>

<!-- Fixed Home Button -->
<a href="report_index.html" style="
    position: fixed; bottom: 30px; right: 30px;
    background: linear-gradient(135deg, #d81b60, #ad1457);
    color: white; padding: 12px 24px; border-radius: 50px;
    text-decoration: none; font-weight: 600; font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(216, 27, 96, 0.4);
    display: flex; align-items: center; gap: 8px; transition: all 0.3s ease; z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(216, 27, 96, 0.5)';"
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(216, 27, 96, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
    回首頁
</a>

<!-- 安全驗證腳本 -->
<script src="auth.js"></script>
```

- **錯誤處理**: 必須包含 `window.onerror` 攔截。


---

## 7. 已知問題紀錄與修正方式 (Known Issues & Fixes)

### 問題一：報表資料空白（HTML 模板佔位符未替換）

**發生時間**: 2026/04/01（1月、2月、3月報表同時出現）

**症狀**:
- 開啟 HTML 後所有數字欄位顯示為 `--` 或空白
- 瀏覽器 Console 出現 `summaryData is not defined` 錯誤
- 原始 HTML 第 101 行可見未替換的佔位符：`const summaryData = ${JSON.stringify(summaryData)};`

**根本原因**:
報表 HTML 以 Node.js 模板字串（backtick template literal）結構撰寫，預期在執行時由 Node.js 將 `${JSON.stringify(summaryData)}` 替換為真實 JSON。但實際執行的生成腳本採用另一套方式（`__DB_DATA_PLACEHOLDER__` 字串替換），兩者架構不同，導致 HTML 以未替換的原始模板狀態直接輸出。

**修正方式**:
使用 `generate_report_XXX_2026_v3.js` 系列腳本（v3 版本）重新產出報表。v3 版本採用**伺服器端預聚合**，在 Node.js 層完成所有運算後，將精簡的 `summaryData` JSON 注入正確的 HTML 結構。

---

### 問題二：數值計算全部顯示為 0 或 NaN（`$numberDecimal` 未轉型）

**症狀**:
- 總營收、退票手續費等所有金額欄位顯示為 `0` 或 `NaN`
- 圖表無資料點

**根本原因**:
MongoDB 的 `Decimal128` 型態欄位（如 `售價`、`手續費`、`實退金額`）在 `find()` 查詢結果中以物件格式輸出：`{ "$numberDecimal": "600.0000" }`。舊版腳本直接做 `cur['售價'] || 0`，由於物件永遠為 truthy，加法運算結果為 `NaN`。

**修正方式**:
在 Node.js 聚合階段統一使用 `getVal()` 輔助函數進行轉型：
```javascript
const getVal = (v) => (v && v['$numberDecimal'] ? parseFloat(v['$numberDecimal']) : (Number(v) || 0));
```
此函數已納入所有 v3 版本生成腳本。前端（瀏覽器端）**不應**再存取原始 `dbData` 進行金額運算。

---

### 問題三：HTML 檔案過大導致瀏覽器無法載入（原始資料直接注入）

**症狀**:
- 報表 HTML 檔案高達 **267 MB**（3月份 307,089 筆資料）
- 瀏覽器開啟後停頓、當機或無回應

**根本原因**:
舊版腳本（`generate_report_mar_2026.js`）將完整的原始查詢結果以 `const dbData = ${JSON.stringify(data)}` 直接嵌入 HTML，由瀏覽器端 JavaScript 進行聚合運算，造成檔案過大。

**修正方式**:
改為後端預聚合（v3 版本），僅將結果摘要注入 HTML。修正後檔案大小：

| 月份 | 原始筆數 | 修正前檔案大小 | 修正後檔案大小 |
|------|---------|--------------|--------------|
| 2026年01月 | 35,713 筆 | ~30 MB | 61 KB |
| 2026年02月 | 90,194 筆 | ~80 MB | 64 KB |
| 2026年03月 | 307,089 筆 | 267 MB | 85 KB |

---

### 問題四：HTML 模板提取邏輯因 CRLF 行尾失敗

**症狀**:
- v3 腳本執行後，HTML 檔案開頭出現 Node.js 程式碼（如 `const { MongoClient...`）而非 `<!DOCTYPE html>`

**根本原因**:
v3 腳本使用 `fs.readFileSync` 讀取 `generate_report_feb_2026.js` 後，以 `indexOf('const htmlContent = \`\n')` 搜尋模板起點。但該檔案使用 **Windows CRLF（`\r\n`）** 行尾，而搜尋字串含 Unix LF（`\n`），導致 `indexOf` 回傳 `-1`，模板提取完全偏移。

**修正方式**:
改為只搜尋 backtick marker（不含換行符），找到後手動跳過 `\r\n` 或 `\n`：
```javascript
const backtickMarker = 'const htmlContent = `';
let tplStart = genScript.indexOf(backtickMarker) + backtickMarker.length;
while (genScript[tplStart] === '\r' || genScript[tplStart] === '\n') tplStart++;
```

---

### 問題五：退票排行第二名（或任意名次）筆數為 0（sort comparator typo）

**發生時間**: 2026/06/10

**症狀**:
- `#topRefundTable` 退票排行榜中，部分名次的退票筆數與張數顯示為 `0`
- 退票排行與實際退票金額最高的節目不符

**根本原因**:
`generate_monthly_report.js` 第 186 行排序函式寫成：
```javascript
// 錯誤
const topByRefunds = [...eventList].sort((a,b) => b.refunds - b.refunds).slice(0, 5);
```
`b.refunds - b.refunds` 同一變數相減恆為 `0`，Array.sort 視為相等不調換順序，導致排序完全失效。`topByRefunds` 實際上是 `eventList` 的插入順序前 5 筆，其中可能有完全無退票記錄的節目。

**修正方式**:
```javascript
// 正確
const topByRefunds = [...eventList].sort((a,b) => b.refunds - a.refunds).slice(0, 5);
```
修正後重新產出 2026年05月報表已確認退票排行正確。

---

## 8. 報表生成腳本對照表 (Script Reference)

**2026/07/09 起統一使用通用腳本 `generate_monthly_report.js`**（UI 模板動態抽取自 `generate_report_feb_2026.js`）：

```bash
node generate_monthly_report.js            # 自動偵測上月（每月 2 日排程執行）
node generate_monthly_report.js 2026-05    # 手動指定月份
```

| 月份 | 產出腳本 | 備註 |
|------|------------|------|
| 2026年01月～06月 | `generate_monthly_report.js` | 2026/07/09 以新口徑（排除 B 開頭訂單）回溯重產，版面為現行標準模板 |
| 2025年12月以前 | 各月獨立腳本（jan/feb/mar `_v3` 等） | 舊口徑（含 B 訂單），已封存至 report-archive 庫，未重產 |

> **原則**：新增月份不再複製各月獨立腳本，直接用 `generate_monthly_report.js`（每月 2 日 `daily_update.bat` 已自動執行）。修改報表 UI 元件時，需改 `generate_report_feb_2026.js` 內的 HTML 模板（通用腳本從該檔動態抽取）。

## 9. Git 管理規範 (Git Management)
- **提交頻率**: 每完成一項子任務或功能修正後，**必須立即進行 Git 提交 (Commit)**。
- **提交訊息**: 應簡潔描述變更內容與目的（例如：`feat: 增加 PDF 下載與回首頁按鈕`）。
- **流程確認**: 提交後執行 `git status` 確認工作目錄狀態。

---
*最後更新日期: 2026/07/13（銷售排行兩表新增電子票/紙票張數與占比欄，2026年06月報表起適用，詳見 §4.3）*
*2026/07/09：新增排除 B 開頭訂單口徑；2026年01月～06月回溯重產；§8 改為通用腳本 generate_monthly_report.js*

