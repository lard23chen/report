# D系統 節目介紹頁瀏覽量分析報表 技術規範說明

本文件定義「D系統節目介紹頁瀏覽量分析報表（2026年6月）」的產出標準與欄位說明，未來更新或重新產出此報表時，請遵循本規範。

## 1. 基本資訊 (General Info)

| 項目 | 說明 |
|------|------|
| 報表名稱 | `D_GA_PageViewData_Webb_202606_Report.html` |
| 產生腳本 | `generate_d_ga_pageview_report.js` |
| 資料來源 | MongoDB `QwareAi` / `GA_D_PageViewData_Webb_202606` |
| 資料起始日 | 2026/06/10（目前唯一快照日）|
| 資料建立時間 | 2026/06/12（`CreateTime`）|
| 頁面 URL | `https://ticket.ibon.com.tw/ActivityInfo/Details` |
| 自動更新排程 | ~~S1（`daily_update.bat`）每日 08:00 執行~~ **已於 2026/07/23 停止**（使用者要求，改為手動執行） |
| 負責人 | 陳俊良 |
| 主要目的 | 分析 D 系統節目介紹頁（ActivityInfo/Details）每日 Page View 累積趨勢，並呈現活動排行與類別分布 |

---

## 2. 資料集結構 (Collection Schema)

Collection：`QwareAi.GA_D_PageViewData_Webb_202606`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `_id` | string | 文件 ID |
| `EventDate` | ISODate | GA 事件日期（UTC，台灣時間 = +8h）|
| `ActivityId` | string | 活動 ID（對應 ticket.ibon.com.tw 活動頁）|
| `ActivityName` | string | 活動名稱 |
| `CreateTime` | ISODate | 資料寫入 MongoDB 時間 |
| `EventCount` | number | Page View 次數（GA `page_view` event count）|
| `UpdateTime` | ISODate | 最後更新時間 |

> **注意**：此 collection 無 `LoggedInCount` / `NotLoggedInCount` 欄位，僅有總 PV（與 `GA_D_ClickData_Webb_202606` 不同）。

---

## 3. 關鍵統計數字 (Key Metrics)

以 2026/06/10 快照為基準：

| 指標 | 數值 |
|------|------|
| 總 Page Views | 33,995 |
| 活動頁數 | 32 |
| PV No.1 | 2026 7–ELEVEN 高雄啤酒音樂節（8,612）|
| TOP 3 集中度 | 50.2%（17,056 PV）|
| TOP 5 集中度 | 69.3%（23,552 PV）|
| TOP 10 集中度 | 85.9%（29,191 PV）|

---

## 4. 活動分類 (Category Classification)

| 類別 key | 中文標籤 | Badge 樣式 | 說明 |
|----------|---------|-----------|------|
| `sports`  | 體育 | 藍色 | 棒球（職棒 / 明星賽）、TPBL 籃球 |
| `concert` | 演唱會 | 紫色 | 演唱會、音樂節、表演 |
| `kpop`    | K-pop | 玫瑰色 | 韓星演唱會 / 見面會 |
| `anime`   | 動漫 | 綠色 | 動漫、遊戲音樂會 |

### 分類統計（2026/06/10）

| 類別 | 活動數 | PV | 佔比 |
|------|-------:|---:|-----:|
| 演唱會/音樂節 | 10 | 16,344 | 48.1% |
| 棒球/TPBL | 9 | 13,502 | 39.7% |
| K-pop/韓星 | 8 | 2,608 | 7.7% |
| 動漫/遊戲音樂 | 5 | 1,541 | 4.5% |

### CAT_MAP（ActivityId → 類別）

`generate_d_ga_pageview_report.js` 中維護，新增活動時需手動補上：

```js
const CAT_MAP = {
    '39590':'concert','39664':'concert','39226':'sports', '39428':'sports',
    '39455':'sports', '39611':'concert','39667':'sports', '39678':'kpop',
    '39496':'anime',  '39559':'concert','39649':'kpop',   '39451':'sports',
    '39584':'anime',  '39603':'kpop',   '39511':'sports', '39458':'sports',
    '39682':'kpop',   '39680':'kpop',   '39494':'concert','38900':'concert',
    '39673':'kpop',   '39490':'anime',  '39453':'concert','39005':'sports',
    '39605':'kpop',   '39650':'concert','39555':'anime',  '39666':'sports',
    '39607':'kpop',   '39549':'kpop',   '39556':'anime',  '39527':'concert'
};
```

> 未定義的 ActivityId 預設歸類為 `concert`，需人工確認。

---

## 5. 視覺樣式設定 (Visual Styles)

採用深色主題，CSS 變數定義：

| CSS 變數 | 值 | 說明 |
|---|---|---|
| `--bg` | `#0f172a` | 頁面背景 |
| `--card` | `#1e293b` | 卡片背景 |
| `--border` | `#2d3d55` | 邊框 |
| `--text` | `#f1f5f9` | 主要文字 |
| `--muted` | `#94a3b8` | 次要文字 |
| `--amber` | `#f59e0b` | 總 PV / TOP1 強調 |
| `--cyan` | `#06b6d4` | 活動數 / 日期強調 |
| `--sports` | `#3b82f6` | 棒球/體育類別 |
| `--concert` | `#8b5cf6` | 演唱會類別 |
| `--kpop` | `#f43f5e` | K-pop 類別 |
| `--anime` | `#10b981` | 動漫/遊戲類別 |

---

## 6. 關鍵組件與圖表 (Components & Charts)

### 6.1 KPI 卡片（6 張）

| 卡片 | 值 | 顏色 |
|------|---|------|
| 總 Page Views | 動態（DAILY 加總） | amber |
| 活動數 | 動態（DATA 筆數） | cyan |
| 單頁最高 PV | 動態（DATA[0].pv） | green |
| TOP 5 集中度 | 動態 | rose |
| 棒球/TPBL 佔比 | 動態 | sports blue |
| 演唱會/音樂節 佔比 | 動態 | concert purple |

### 6.2 Insight Bar（4 項洞察，靜態）
- PV No.1 活動名稱
- Rakuten 系列合計 PV
- TOP 5 集中度百分比
- 最大類別佔比

### 6.3 📅 每日 Page View 趨勢（Daily Bar Chart）
- Canvas ID：`dailyChart`
- 資料來源：`DAILY` 陣列（由 generator 注入）
- 類型：`bar`，X 軸：日期（`MM/DD`），Y 軸：當日總 PV
- 顏色：`rgba(59,130,246,0.55)`（藍色半透明）/ 邊框 `#3b82f6`
- **Datalabels**：每根柱頂顯示完整數字（`v.toLocaleString()`），`anchor:'end'`、`align:'top'`，白色粗體
- Y 軸刻度：`>= 1000` 顯示為 `K`（如 `34K`）
- layout padding top: 24px（為標籤預留空間）
- 圖表卡片右下角顯示「最新資料更新」時間（`id="updateTimeLabel"`，由 generator 注入）

### 6.4 類別 PV 分布 Doughnut Chart
- Canvas ID：`donutChart`
- 資料動態從 `DATA` 陣列計算（`catTotals`），不寫死數值
- 4 個類別，`cutout: 62%`
- Datalabels 顯示百分比（> 5% 才顯示）

### 6.5 TOP 10 活動橫條圖（Horizontal Bar）
- Canvas ID：`top10Chart`
- 依 PV 排名，顏色依類別
- Y 軸：活動名稱（超 22 字截斷加 `…`）
- Datalabels：右側顯示實際 PV 數，`anchor:'end'`、`align:'end'`

### 6.6 完整活動排行表（動態筆數）
- 欄位：排名 / 活動名稱 + ID / 類別 Badge / PV 數 / 佔比條 / ActivityId
- **篩選 Chips**：全部 / 體育 / 演唱會 / K-pop / 動漫
- **欄位排序**：點擊 `#`、`PV 數`、`ActivityId` 欄位標題可排序（升/降序切換）
- 前 3 名排名數字金/銀/銅色標示

---

## 7. 資料嵌入與自動更新機制

### 7.1 Section Markers

HTML `<script>` 內以兩個固定標記區隔資料區與圖表區，generator 每次替換兩者之間的內容：

```
// ── Data ──────────────────────────────────────────────────────────────────
const DAILY = [...];   ← generator 注入
const DATA  = [...];   ← generator 注入
// ── Charts ─────────────────────────────────────────────────────────────────
（圖表初始化程式碼，不被替換）
```

> ⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點會拋出錯誤並中止。

> **2026/07/20 新增**：`<head>` 加入 IP 白名單保護（同目錄頁 `HTML_Report_Catalog.html` 機制，`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。此前本報表沒有此保護，任何人有連結即可看到完整 D 系統瀏覽量資料。清單為手動維護的靜態內容，`generate_d_ga_pageview_report.js` 僅用 regex 替換資料常數、不會動到 `<head>`，之後改版該檔案時務必保留此段。

### 7.2 DAILY 陣列格式

```js
// 由 generator aggregation 產生，每個元素代表一天
{ date: "06/10", totalPV: 33995, actCount: 32 }
```

### 7.3 DATA 陣列格式

```js
// 依 PV 降序，rank 由 generator 自動編號
{ rank: 1, id: "39590", name: "活動名稱", cat: "concert", pv: 8612 }
```

---

## 8. 自動更新排程（已於 2026/07/23 停止）

### ⚠️ 排程異動記錄

原本掛在 S1（`daily_update.bat`）每日 08:00 自動執行，**2026/07/23 起依使用者要求從 `daily_update.bat` 移除**（見 `REPORT_SPEC_SCHEDULED_TASKS.md` §2.2/§2.3 追記）。腳本與已產出的 HTML 都保留在原位，只是不再每日自動觸發，改為需要時手動執行。

- ~~**排程名稱**：S1~~
- ~~**批次檔**：`daily_update.bat`~~
- ~~**執行時間**：每日 08:00（Windows 工作排程器）~~
- ~~**執行順序**：`generate_d_ga_clickdata_report.js` → `generate_d_ga_pageview_report.js`~~

### Generator 執行流程

```
MongoDB QwareAi.GA_D_PageViewData_Webb_202606
    ↓ aggregate by EventDate → DAILY array
    ↓ aggregate by ActivityId (sum EventCount, sort desc) → DATA array
generate_d_ga_pageview_report.js
    ↓ 替換 HTML Data section（Data marker 之間）
    ↓ 更新 #updateTimeLabel 文字
    ↓ 更新 footer 日期範圍（單日 → "快照日期", 多日 → "資料期間 X — Y"）
D_GA_PageViewData_Webb_202606_Report.html
    ↓ git add / commit / push（手動執行時需自行 commit/push，不再由 daily_update.bat 統一處理）
```

### 手動執行

```bash
node generate_d_ga_pageview_report.js
```

---

## 9. 與 ClickData 報表的差異

| 比較項目 | PageView 報表 | ClickData 報表 |
|---------|--------------|----------------|
| Collection | `GA_D_PageViewData_Webb_202606` | `GA_D_ClickData_Webb_202606` |
| 資料層級 | 活動層級 | 場次層級 |
| 時間範圍 | 持續累積（起始 06/10）| 05/26–06/05（11 天）|
| 登入/未登入分析 | 無 | 有 |
| 主要指標 | 節目介紹頁瀏覽次數 | 售票場次點擊次數 |
| GA 事件 | `page_view` | `click`（推測）|
| 自動更新 | ❌ 已停用（2026/07/23，改手動） | ❌ 已停用（2026/07/23，改手動） |

---

## 10. 新增活動 SOP

MongoDB collection 新增新活動後，generator 會自動帶入，但類別需人工維護：

1. 執行 generator，確認新活動出現在排行表（類別預設 `concert`）
2. 在 `generate_d_ga_pageview_report.js` 的 `CAT_MAP` 新增對應的 `ActivityId → cat`
3. `git add generate_d_ga_pageview_report.js && git commit -m "Update CAT_MAP: add ActivityId XXXXX"`

---

## 11. 關鍵洞察 (Key Insights)

1. **7-ELEVEN 高雄啤酒音樂節獨占 25.3%**：快照日（06/10）正逢開賣期間，瞬間流量最高。
2. **Rakuten 碎分問題**：6 個子頁面合計 6,648 PV，若合算實際排第 2 名，高於 JAM JAM ASIA（4,240）。
3. **K-pop 8 個節目只分 7.7%**：個別 PV 低（108–857），顯示粉絲深度購票，以社群直連為主，非搜尋瀏覽入場。
4. **動漫/遊戲類 Square Enix（724）遠高於同類**：IP 效應明顯，其餘動漫類均低於 200 PV。
5. **長尾顯著**：後 22 個節目合計 4,804 PV（14.1%），平均 218 PV / 頁。

---

## 12. 相關連結

- 目錄：`HTML_Report_Catalog.html`（D 系統 GA 分析區段，編號 20-E）
- 同月 ClickData 報表：`D_GA_ClickData_Webb_202606_Report.html`
- ClickData 規範：`REPORT_SPEC_D_GA_CLICKDATA_202606.md`
- ~~自動更新排程：`daily_update.bat`~~（已於 2026/07/23 停止，見 §8）

---

*2026/07/23：已停止每日自動更新（使用者要求），從 `daily_update.bat` 移除，見 §8*
*2026/07/20：`<head>` 補上 IP 白名單保護，之前任何人有連結都能看，見 §7*
*最後更新日期：2026/06/12（加入每日趨勢圖、generator 腳本、S1 排程）*
