# E 系統月度對帳報表 技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義「E 系統月度對帳分析報表」的產出標準。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `E_Qware_Revenue_Report_YYYY年MM月_分析報表.html` |
| 產生腳本 | `generate_e_report_<月份>.js`（例：`generate_e_report_mar_2026.js`） |
| 資料來源 | MongoDB `QwareAi` / `Qware_Ticket_Data_Esys` |
| 負責人 | 陳俊良 |
| 主要目的 | E 系統當月完整銷售、退票、對帳分析，含 PDF 匯出 |

---

## 2. 視覺樣式

採用**粉紅色主題 (Pink / Rose Theme)**，與 A 系統明顯區隔。

| CSS 變數 | 值 | 說明 |
|---|---|---|
| `--bg-color` | `#fce4ec` | 頁面背景（淺粉） |
| `--card-bg` | `#ffffff` | 卡片背景 |
| `--text-primary` | `#880e4f` | 主要文字（深玫瑰） |
| `--text-secondary` | `#ad1457` | 次要文字 |
| `--accent-color` | `#d81b60` | 強調色（桃紅） |

字體：`Inter`（Google Fonts）

---

## 3. 資料篩選方式

```js
collection.find({ "交易時間": { $regex: "^YYYY-MM" } })
```

每個月份獨立腳本，只查指定月份資料。

---

## 4. 核心統計邏輯

與 A 系統一致：
- **正常交易**：`狀態 === '正常'`
- **退票交易**：`狀態 === '已退票'` 或 `'退票'`
- **訂單筆數**：`訂單編號` 取底線前綴後去重
- **購票金額**：正常狀態 `售價` 加總
- **退票手續費**：退票狀態 `手續費` 加總
- **ibon logo**：載入本地 `ibon_logo.png`（base64 嵌入）

---

## 5. 關鍵組件

### 5.1 KPI 卡片

| 卡片 | 說明 |
|------|------|
| 購票金額 | 當月正常交易金額合計 |
| 訂單筆數 | 不重複訂單數 |
| 購票張數 | 正常 row 數 |
| 客單價 | 金額 / 訂單數 |
| 退票張數 | 退票 row 數 |
| 退票手續費 | 手續費合計 |

### 5.2 趨勢分析

- 每日銷售折線圖（Chart.js）
- 退票手續費趨勢

### 5.3 付款方式分析

欄位：付款方式 / 訂單數 / 張數 / 金額 / 占比 %

### 5.4 活動排行

前 5 名活動（依金額降序）：活動名稱 / 訂單數 / 張數 / 金額 / 占比 %

### 5.5 PDF 匯出

引入 `html2pdf.js`，提供「匯出 PDF」按鈕。

---

## 6. 建立新月份報表流程

> 完整每月更新 SOP（含首頁 `E_report_index.html` 統計區塊與 Tab 卡片更新）見 `REPORT_SPEC_E_INDEX_DASHBOARD.md`。

1. 複製現有月份腳本（例 `generate_e_report_may_2026.js`）
   - ⚠️ **必須用 Node.js 讀檔 + `.replace()` 替換月份字串後以 `'utf8'` 寫入，禁止用 PowerShell `-replace`**（UTF-16 LE 編碼會破壞中文字元）
2. 修改篩選月份 regex（`^YYYY-MM`）及標題文字
3. 執行：`node generate_e_report_<新月份>.js`
4. 更新 `E_report_index.html`（執行 `node update_e_index_stats.js` + 手動調 Tab 卡片）
5. 在 `HTML_Report_Catalog.html` E 系統區段新增對應列（規則見 `REPORT_SPEC_CATALOG.md`）

現有月份腳本：jan / feb / mar / apr / may / jun（2026）。

---

## 7. 更新方式

```bash
node generate_e_report_<月份>.js
git add E_Qware_Revenue_Report_YYYY年MM月_分析報表.html
git commit -m "Add E system YYYY/MM monthly report"
git push origin main
```

更新頻率：**月次**（每月月初）

---
*Last Updated: 2026/07/06（新增 2026年06月 報表；補流程交叉引用與 PowerShell 編碼警告）*
