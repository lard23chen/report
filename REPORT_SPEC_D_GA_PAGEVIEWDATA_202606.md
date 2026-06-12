# D系統 節目介紹頁瀏覽量分析報表 技術規範說明

本文件定義「D系統節目介紹頁瀏覽量分析報表（2026年6月）」的產出標準與欄位說明，未來更新或重新產出此報表時，請遵循本規範。

## 1. 基本資訊 (General Info)

| 項目 | 說明 |
|------|------|
| 報表名稱 | `D_GA_PageViewData_Webb_202606_Report.html` |
| 產生腳本 | 無（直接嵌入資料，一次性靜態報表） |
| 資料來源 | MongoDB `QwareAi` / `GA_D_PageViewData_Webb_202606` |
| 資料快照日期 | 2026/06/10（`EventDate` 全部為同一天）|
| 資料建立時間 | 2026/06/12（`CreateTime`）|
| 頁面 URL | `https://ticket.ibon.com.tw/ActivityInfo/Details` |
| 負責人 | 陳俊良 |
| 主要目的 | 分析 D 系統節目介紹頁（ActivityInfo/Details）在指定日期的 Page View 分佈，用於了解用戶瀏覽熱門節目的關注焦點 |

---

## 2. 資料集結構 (Collection Schema)

Collection：`QwareAi.GA_D_PageViewData_Webb_202606`（32 documents）

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

| 指標 | 數值 |
|------|------|
| 總 Page Views | 33,995 |
| 活動頁數 | 32 |
| 快照日期 | 2026/06/10 |
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

### 分類統計

| 類別 | 活動數 | PV | 佔比 |
|------|-------:|---:|-----:|
| 演唱會/音樂節 | 10 | 16,344 | 48.1% |
| 棒球/TPBL | 9 | 13,502 | 39.7% |
| K-pop/韓星 | 8 | 2,608 | 7.7% |
| 動漫/遊戲音樂 | 5 | 1,541 | 4.5% |

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
| 總 Page Views | 33,995 | amber |
| 活動數 | 32 | cyan |
| 單頁最高 PV | 8,612（7-ELEVEN） | green |
| TOP 5 集中度 | 69.3% | rose |
| 棒球/TPBL 佔比 | 39.7% | sports blue |
| 演唱會/音樂節 佔比 | 48.1% | concert purple |

### 6.2 Insight Bar（4 項洞察）
- PV No.1 活動
- Rakuten 碎分提醒（合計排名）
- TOP 5 集中度
- 最大類別

### 6.3 類別 PV 分布 Doughnut Chart
- 4 個類別，`cutout: 62%`
- Datalabels 顯示百分比（> 5% 才顯示）

### 6.4 TOP 10 活動橫條圖（Horizontal Bar）
- 依 PV 排名，顏色依類別
- Y 軸：活動名稱（超 22 字截斷）
- Datalabels 顯示實際 PV 數

### 6.5 集中度視覺化條（Concentration Bars）
- TOP 1/3/5/10 及其餘各一條 CSS 橫條，色彩漸進（amber → orange → rose → purple → muted）

### 6.6 Rakuten 碎分提示區塊
- 說明 6 個子頁面合計 6,648 PV，實際排名應為第 2 的補充說明

### 6.7 完整活動排行表（32 列）
- 欄位：排名 / 活動名稱 + ID / 類別 Badge / PV 數 / 佔比條 / ActivityId
- **篩選 Chips**：全部 / 體育 / 演唱會 / K-pop / 動漫
- **欄位排序**：點擊 `#`、`PV 數`、`ActivityId` 欄位標題可排序（升/降序切換）
- 前 3 名排名數字金/銀/銅色標示

---

## 7. 資料嵌入方式

此報表為**獨立靜態 HTML**，資料直接嵌入 JavaScript `DATA` 陣列，不需連接 MongoDB。

```js
const DATA = [
  { rank:1, id:"39590", name:"2026 7–ELEVEN 高雄啤酒音樂節", cat:"concert", pv:8612 },
  // ...
];
```

---

## 8. 與 ClickData 報表的差異

| 比較項目 | PageView 報表 | ClickData 報表 |
|---------|--------------|----------------|
| Collection | `GA_D_PageViewData_Webb_202606` | `GA_D_ClickData_Webb_202606` |
| 資料筆數 | 32（活動層級） | 451（場次層級）|
| 時間範圍 | 單日快照（06/10）| 多日（05/26–06/05）|
| 登入/未登入 | 無 | 有 |
| 主要指標 | 節目介紹頁瀏覽次數 | 售票場次點擊次數 |
| GA 事件 | `page_view` | `click`（推測）|

---

## 9. 關鍵洞察 (Key Insights)

1. **7-ELEVEN 高雄啤酒音樂節獨占 25.3%**：快照日（06/10）正逢開賣期間，瞬間流量最高。
2. **Rakuten 碎分問題**：6 個子頁面合計 6,648 PV，若合算實際排第 2 名，高於 JAM JAM ASIA（4,240）。
3. **K-pop 8 個節目只分 7.7%**：個別 PV 低（108–857），顯示粉絲深度購票，以社群直連為主，非搜尋瀏覽入場。
4. **動漫/遊戲類 Square Enix（724）遠高於同類**：IP 效應明顯，其餘動漫類活動均低於 200 PV。
5. **長尾顯著**：後 22 個節目合計 4,804 PV（14.1%），平均 218 PV / 頁。

---

## 10. 更新方式

此為**手動一次性報表**，無自動更新排程。

若需更新為新日期快照：
1. 重新查詢 MongoDB `GA_D_PageViewData_Webb_202606`（或新月份 collection）
2. 更新 HTML 中的 `DATA` 陣列與 header 日期
3. 更新 `HTML_Report_Catalog.html` 更新時間
4. `git add → commit → push`

---

## 11. 相關連結

- 目錄：`HTML_Report_Catalog.html`（D 系統 GA 分析區段）
- 同月 ClickData 報表：`D_GA_ClickData_Webb_202606_Report.html`
- 規範文件：`REPORT_SPEC_D_GA_CLICKDATA_202606.md`

---

*最後更新日期：2026/06/12（初版建立）*
