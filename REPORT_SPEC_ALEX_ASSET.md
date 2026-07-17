# Alex 個人資產配置分析報表 技術規範說明

> 🔒 **私有報表（2026/07/17 起）** — 本報表內容為個人財務資料，**不進公開 repo、不上 GitHub Pages**。產出的 HTML 已列入 `.gitignore`，僅發佈到預設私有的 Claude Artifact（網址見個人記錄，勿寫入本 repo）。

本文件定義「Alex 個人資產配置分析報表」的產出標準與設定。

## 1. 基本資訊 (General Info)

- **報表名稱**：`alex/Alex_Asset_Report.html`（僅本機產出，git 忽略）
- **發佈位置**：私有 Claude Artifact（每次更新以同一 Artifact URL 重新發佈）
- **資料來源**：Google Sheets → MongoDB（個人 cluster `alex` / `AssetSnapshots`）
- **來源試算表**：Sheets ID `1ExXSoThNuzhLnn5K7ldXkpNaHXSIaBuUPl75sPp1Z7E`（分頁 `2026年`，gid=0）
- **匯入腳本**：`alex/import_alex_asset.js`
- **生成腳本**：`alex/generate_alex_asset_report.js`
- **主要目的**：追蹤個人資產配置（股票/基金、銀行、保險、電子支付、禮券、加密貨幣、其他、不動產），提供分類佔比、Top 項目與流動性分析。

---

## 2. 資料來源結構

### 2.1 Google Sheets 版面

- 三欄：`分類 | 項目 | 金額`；分類欄僅在該區第一列出現（往下沿用）
- 首列第三欄為快照日期（如 `2026/7/1`）
- 最末列（無分類、無項目）為試算表總計
- 金額格式：`NT$1,234`、`$1,234`（保險部分保單）、`-NT$670,151`（房貸負債）、空白（未估值）

### 2.2 金額口徑（重要）

- **「NT$」前綴**：台幣現值，計入試算表總計
- **「$」前綴**（僅出現在保險分類）：**不計入試算表總計口徑**
- **試算表總計 = 所有「NT$」前綴且為正值的項目加總**（排除「$」保險與負值房貸），即 `TotalAssets − Σ($保險) = SheetTotal`
- 匯入腳本以此口徑驗證，不符即中止匯入（exit 1）

### 2.3 MongoDB Schema

Cluster：`MONGODB_URI_PERSONAL`（.env），Database：`alex`，Collection：`AssetSnapshots`，以 `SnapshotDate` upsert。

| 欄位 | 型態 | 說明 |
|------|------|------|
| `SnapshotDate` | String | 快照日期 `YYYY/MM/DD` |
| `SheetId` | String | 來源試算表 ID |
| `Items` | Array | `{Category, Item, Amount, CurrencyMark}`；`Amount` 未估值為 `null`；`CurrencyMark` 為 `'NT$'`/`'$'`/`null` |
| `TotalAssets` | Number | 全部正值項目加總（含「$」保險） |
| `TotalLiabilities` | Number | 負值項目絕對值加總（房貸） |
| `NetAssets` | Number | TotalAssets − TotalLiabilities |
| `NtdPositiveTotal` | Number | 「NT$」正值項目加總（= 試算表口徑） |
| `SheetTotal` | Number | 試算表最末列總計（驗證用） |
| `ImportedAt` | Date | 匯入時間 |

---

## 3. 視覺樣式設定

深色主題，沿用本站報表家族樣式（背景 `#121212`、卡片 `#1e1e1e`、字體 `Outfit` + `Noto Sans TC`）。

**分類固定色序**（dataviz 驗證通過的 dark categorical palette，surface `#1e1e1e` 全項 PASS；順序固定不可循環/重排）：

| 分類 | 色碼 |
|------|------|
| 股票/基金 | `#3987e5` |
| 銀行帳戶(國內) | `#008300` |
| 保險 | `#d55181` |
| 電子支付 | `#c98500` |
| 禮券 | `#199e70` |
| 加密貨幣 | `#d95926` |
| 其他 | `#9085e9` |
| 不動產（負債） | `#e66767` |

> CVD 最差相鄰對 ΔE 8.4（6–8 floor band 之上），仍搭配直接標籤 + 完整表格作為次要編碼。

---

## 4. 核心組件

1. **統計卡片**：淨資產（綠 hero）、總資產、負債（紅）、NT$ 現值總計（試算表口徑）
2. **資產配置 doughnut**：7 個資產分類（排除負債），slice 直接標籤（分類 + %，<3% 不標）、2px surface 邊框間隔、右側 legend、tooltip 顯示金額與佔比
3. **Top 10 資產項目橫向長條**：單一色相 `#3987e5`（量值編碼）、4px 圓角資料端、`萬` 單位標籤
4. **全部項目明細表**：依分類分組（分類列含色點 + 小計 + 佔比）、負債紅字、未估值顯示 `—（未估值）`、「$」保單加 `$口徑外` 標記、tfoot 淨資產合計
5. **配置分析區塊**：流動性資金（銀行+電支）、投資部位（股票/基金+加密貨幣）、保險現值（含 $ 口徑說明）、不動產未估值備註 — 由 generator 以 snapshot 數據計算，**不得手動寫死在 HTML**

> **datalabels 注意**：`display` callback 必須使用 `ctx.dataset.data[ctx.dataIndex] != null`，不可使用 `ctx.parsed`（datalabels context 無此屬性，詳見 `REPORT_SPEC_AZURE_COST.md` 2026/07/17 修正記錄）。

---

## 5. 生成流程

```
Google Sheets (資產表)
    ↓ node alex/import_alex_asset.js   ← CSV export 下載 + 口徑驗證 + upsert
MongoDB (alex / AssetSnapshots)
    ↓ node alex/generate_alex_asset_report.js
alex/Alex_Asset_Report.html   ← 本機檔案，.gitignore 忽略，不 push
    ↓ 自包含化（內嵌 chart.js/datalabels、去 CDN 與 Google Fonts）
私有 Claude Artifact（同一 URL 重新發佈）
```

## 6. 更新 SOP（新增快照）

1. 在 Google Sheets 更新／新增快照資料（若新增月份分頁，需同步修改 `import_alex_asset.js` 的 gid）
2. `node alex/import_alex_asset.js` — 確認口徑驗證通過、upsert 成功
3. `node alex/generate_alex_asset_report.js` — 重新產出本機 HTML
4. 產出自包含版本並以**同一個 Artifact URL** 重新發佈（Artifact 有 CSP，CDN/字體連結必須內嵌；請 Claude 執行「更新資產報表 Artifact」即可）
5. 更新 `HTML_Report_Catalog.html` 第 48 筆更新時間後 commit（**確認未含報表 HTML**）；腳本或 spec 有改時一併 commit

> Generator 已支援多快照：`AssetSnapshots` 有 2 筆以上時，報表使用最新快照；歷史趨勢圖為未來擴充項目。

---

## 7. Git 管理規範

- **報表 HTML 與 Artifact URL 一律不得 commit 進本 repo**（`.gitignore` 已涵蓋 HTML）
- 腳本/spec 更新後 commit，訊息格式：`Update Alex asset report scripts: <說明>`
- HTML 由 generator 完整覆蓋產生，凡改 HTML 邏輯必同步改 `alex/generate_alex_asset_report.js`

---

*最後更新日期：2026/07/17（初版建立；同日改為私有發佈——HTML 退出公開 repo 與 Pages，改發佈至私有 Claude Artifact）*
