# 每日雲端費用明細與活動分析報表 技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義「每日雲端費用明細與活動分析報表」的產出標準與設定，未來更新資料或調整圖表時請遵循此規範。

## 1. 基本資訊 (General Info)

- **報表名稱**：`daily_expense_report.html`
- **報表網址**：`https://lard23chen.github.io/report/daily_expense_report.html`
- **資料來源**：MongoDB (`QwareAi` / `AzureMonthlyCost_Daily`)
- **生成腳本**：`generate_expense_report.js`
- **匯入腳本**：每月依實際需求建立（命名格式：`import_<月份>_azure_daily.js`）
- **負責人**：陳俊良
- **主要目的**：逐日追蹤各系統雲端費用，並結合活動備註呈現費用高峰原因，供成本稽核與活動排程參考。

---

## 2. 資料來源結構 (MongoDB Schema)

Collection：`QwareAi.AzureMonthlyCost_Daily`

| 欄位名稱 | 型態 | 說明 |
|---------|------|------|
| `Date` | String | 日期，格式 `YYYY/MM/DD`（如 `2026/03/01`） |
| `ASys` | String | A 系統費用（數字字串，無 `$` 或 `,`） |
| `DSysAWS` | String | D 系統（AWS）費用 |
| `ESys` | String | E 系統費用 |
| `Shared` | String | 共用費用 |
| `Member` | String | 會員系統費用 |
| `TotalRevenue` | String | 當日總費用（未稅） |
| `Level` | String | 機器監控等級（如 `A系統-小型(小型監控)`，多筆以 `\n` 分隔） |
| `Activity` | String | 當日主要活動名稱（多筆以 `\n` 分隔） |
| `Note` | String | 備註說明 |

> **注意**：費用欄位皆為字串型態，前端及後端讀取時需用 `parseFloat()` 轉型。

---

## 3. 資料匯入流程 (Monthly Import SOP)

### 3.1 來源
Google Sheets：`https://docs.google.com/spreadsheets/d/12PafK4fsLw7SAy4FG3SSK-P3khs0VcBnRwirgsBpeSk`

每月費用資料位於 `gid=581929756`（04.AzureAWS合併費用 分頁）。

### 3.2 CSV 欄位對應

下載格式：`export?format=csv&gid=581929756`

| CSV Index | 欄位名稱 | MongoDB 欄位 |
|-----------|---------|-------------|
| 1 | 年/月（日期） | `Date`（取前 10 字元） |
| 2 | A系統 | `ASys` |
| 3 | D系統(AWS) | `DSysAWS` |
| 4 | E系統 | `ESys` |
| 5 | 共用 | `Shared` |
| 6 | 會員 | `Member` |
| 7 | 總計[未稅] | `TotalRevenue` |
| 8 | 機器監控等級 | `Level` |
| 9 | 活動名稱 | `Activity` |
| 10 | 備註說明 | `Note` |

### 3.3 匯入注意事項

- 費用欄位含 `$` 與 `,`，匯入時需清除：`str.replace(/[$,\s]/g, '').trim()`
- CSV 部分欄位內含換行（引號包覆），需正確處理 RFC 4180 引號規則
- 匯入前先 `deleteMany({ Date: { $regex: /^YYYY\/MM\// } })` 避免重複
- 篩選條件：`dateStr.match(/^YYYY\/MM\//)`

### 3.4 執行步驟

```bash
# 1. 下載最新 CSV（已有 fetch_gsheet_csv.js）
node fetch_gsheet_csv.js

# 2. 執行月份匯入腳本（以 3 月為例）
node import_mar_azure_daily.js

# 3. 重新生成報表
node generate_expense_report.js

# 4. 提交並推送
git add daily_expense_report.html
git commit -m "Update daily_expense_report: add YYYY/MM daily data"
git push
```

---

## 4. 視覺樣式設定 (Visual Styles)

報表採用 **深藍夜間主題**。

- **配色**：
  - 背景色：`#0f172a`（Slate 950）
  - 卡片背景：`rgba(30, 41, 59, 0.7)`（毛玻璃效果）
  - 主要文字：`#f8fafc`
  - 次要文字：`#94a3b8`
- **字體**：`Outfit`, `Noto Sans TC`（Google Fonts）

---

## 5. 核心組件 (Components)

### 5.1 月份篩選器

- `<select>` 下拉，選項依資料中所有月份自動生成（倒序排列）
- 預設顯示所有歷史資料
- 切換後同步更新表格與圖表

### 5.2 每日費用明細表格

欄位（左至右）：

| 日期 | A系統 | D(AWS) | E系統 | 共用 | 會員 | 總計[未稅] | 主要活動與備註 |

- 固定高度 550px，超出可捲動
- 表頭 sticky（`position: sticky; top: 0`）
- 活動欄：活動名稱以綠色（`#34d399`）標示，備註灰色

### 5.3 費用走勢趨勢圖 (Chart.js line)

**Datasets（6 條線）**：

| 線條 | 欄位 | 顏色 |
|-----|------|------|
| 總計 | `TotalRevenue` | `#60a5fa`（藍，含填色） |
| A系統 | `ASys` | `#a78bfa`（紫） |
| D系統 | `DSysAWS` | `#f472b6`（粉） |
| E系統 | `ESys` | `#fbbf24`（黃） |
| 共用 | `Shared` | `#10b981`（綠） |
| 會員 | `Member` | `#94a3b8`（灰） |

**活動節點標籤（A系統專屬）**：
- 有 `activity` 資料的點：`pointRadius: 6`、填色（`#a78bfa`）
- 無 `activity` 的點：`pointRadius: 2`、透明
- 使用 `chartjs-plugin-datalabels` 在節點上方顯示活動名稱
  - 每行截短至 18 字（超出加 `…`）
  - 多活動以 `\n` 換行顯示
  - 標籤樣式：深色背景框（`rgba(30, 41, 59, 0.85)`）、圓角 4px
  - 僅在篩選月份 ≤ 31 筆時顯示（`showLabels = dat.length <= 31`）

**D系統節點費用標籤（2026/06/11 新增）**：
- 單月模式（`showLabels = true`，即 ≤ 31 筆）時，每個 D系統節點下方顯示完整費用數字
- 格式：`$4,477`（`'$' + Math.round(v).toLocaleString()`）
- 節點點徑：單月模式 `pointRadius: 4`，全歷史模式 `pointRadius: 2`
- 標籤位置：`align: 'bottom'`、`anchor: 'center'`、`offset: 6`，在節點下方顯示，避免與總計／A系統標籤重疊
- 標籤樣式：粉色文字（`#f472b6`）、深色背景框（`rgba(15, 23, 42, 0.85)`）、圓角 4px
- 全歷史模式不顯示（避免密集）

**Tooltip**：
- `mode: 'index'`，顯示當日所有系統費用
- `afterBody` 顯示活動名稱（截前 50 字）

---

## 6. 生成邏輯 (generate_expense_report.js)

```
MongoDB (AzureMonthlyCost_Daily)
    ↓ find({}).sort({ Date: 1 })
Node.js 轉換欄位（parseFloat）
    ↓ JSON.stringify 注入前端
daily_expense_report.html（靜態 HTML）
```

月份篩選選項由後端在生成時根據資料自動產出（`[...new Set(data.map(...))]`），無需手動維護。

---

## 7. Git 管理規範

- 每次月份資料更新後立即 commit，訊息格式：
  - `Update daily_expense_report: add YYYY/MM daily data (N days)`
- 新增月份匯入腳本時一併 commit

---

---

## 8. 獨立分析圖表

### 8.1 D系統 4月 vs 5月 每日費用比較圖

- **檔案**：`sysD_april_may_compare.html`
- **性質**：手動維護的單次分析用獨立 HTML，非 MongoDB 自動產生
- **資料**：直接寫入 HTML 的靜態 JS 陣列（`april[]`、`may[]`），含各日期活動名稱對照
- **X 軸**：當月第 1~31 日對齊（4月第 31 日為 `null`）
- **功能**：
  - 藍線（`#60a5fa`）= 4月，粉紅線（`#f472b6`）= 5月
  - 滑鼠 hover 顯示兩個月同日金額 + 活動名稱
  - 超過 $6,000 的節點自動顯示金額（4月在上方，5月在下方）
  - 有活動的節點放大（`pointRadius: 6`）、無活動縮小（`pointRadius: 3`）
  - 底部 spike-box 列出 5月六個重大峰值事件
- **2026/07/20 新增**：`<head>` 加入 IP 白名單保護（同目錄頁 `HTML_Report_Catalog.html` 機制，`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。此前本頁沒有此保護。無 generator 腳本（純手動維護），日後若重新編輯此檔案務必保留此段

### 8.2 D系統 4月 / 5月 / 6月 每日費用比較圖（2026/07/09 新增）

- **檔案**：`sysD_apr_may_jun_compare.html`
- **性質**：手動維護的單次分析用獨立 HTML（同 §8.1 模式），資料以靜態 JS 陣列寫入（`april[]`、`may[]`、`june[]` + 各月活動對照）
- **功能**（在 §8.1 基礎上擴充）：
  - 三條線：藍（`#60a5fa`）= 4月、粉紅（`#f472b6`）= 5月、黃（`#fbbf24`）= 6月，X 軸當月 1~31 日對齊（30 天月份補 `null`）
  - **Y 軸線性/對數切換按鈕**：5月峰值（$90,618）與日常（~$5,000）差 18 倍，對數模式可看清 4/6 月細節
  - 頂部三月統計卡（總計/日均/峰值日）、分析摘要 box、跨月峰值事件列表（依金額排序、依月份著色）
  - 超過 $6,000 的節點顯示金額標籤；tooltip 顯示三個月同日金額與活動
- **無活動日基線比較區塊（2026/07/09 補充）**：位於主圖與峰值列表之間，含三月基線統計表（天數/平均/中位數/範圍）、僅標無活動日的散點圖（`baselineChart`，>$5,400 顯示金額標籤）、基線結論 box
- **核心結論（產出時）**：5月為異常月（啤酒節兩天佔全月 47%）；4月與 6月為正常水位（總計差 +2.3%）；無活動日基線 6月最低最穩（平均 $4,663、範圍 $4,240–4,971），5月出現大活動後縮編延遲（05/18 無活動仍 $7,928）
- **2026/07/20 新增**：`<head>` 加入 IP 白名單保護（同 §8.1，機制與清單一致）。此前本頁沒有此保護。無 generator 腳本（純手動維護），日後若重新編輯此檔案務必保留此段

---

*2026/07/20：`sysD_april_may_compare.html` / `sysD_apr_may_jun_compare.html` 補上 IP 白名單保護，之前任何人有連結都能看，見 §8.1/§8.2*
*最後更新日期：2026/07/09（匯入 2026/06 全月 30 天資料；新增 §8.2 三個月 D系統比較圖；`import_jun_azure_daily.js` 改用 RFC 4180 全文解析，正確處理引號欄位內換行——`import_mar` 的逐行解析遇多行欄位會錯，後續月份請以 jun 版為範本）*
*2026/06/11：D系統節點費用標籤、4月vs5月比較圖*
