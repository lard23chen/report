> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。

# 2026 旅遊票券統計與管理系統 (Travel Tickets Overview 2026)
## 視覺規範 (Visual Specifications)

### 1. 核心配色與風格 (Theme & Style)
*   **視覺風格**：簡約現代感，採用 **Apple-style** 的圓角與陰影效果。
*   **字體規範**：標題使用 `Outfit` 字體（現代感），內文搭配 `Noto Sans TC` 以確保繁體中文的可讀性。
*   **配色方案 (CSS Variables)**：
    *   `--accent`: `#0284c7` (Sky Blue) - 用於主標題與主要統計數字。
    *   `--accent2`: `#4f46e5` (Indigo) - 用於標籤與導航狀態。
    *   `--go`: `#059669` (Emerald Green) - 去程或成功狀態。
    *   `--back`: `#dc2626` (Red) - 回程或刪除狀態。
    *   `--gold`: `#b45309` (Amber) - PNR 訂位代號或特殊強調。

### 2. 佈局組件 (Layout Components)
*   **狀態面板 (Status Panel)**：右上角懸浮窗，顯示「網頁部署時間」與「資料存檔時間」。
*   **摘要卡片 (Summary Cards)**：四欄式網格佈局，包含總行程數、目的地加總（BKK/日本）及航空公司清單。
*   **行程區塊 (Trip Card)**：每個行程以獨立卡片封裝，頭部包含 Trip 編號、目的地圖示與日期區間。
*   **表格設計 (Flight Table)**：採用 `word-break: break-word` 與固定寬度配置，確保在不同螢幕尺寸下內容不溢出。

---

## 功能組件 (Functional Components)

### 1. 數據連動與統計 (Dynamic Stats)
*   **自動統計功能**：JavaScript 會即時掃描 DOM 中的 `.trip` 與 `.flight-no`。
*   **目的地關鍵字過濾**：自動偵測行程標題中的關鍵字（如：🇹🇭, BKK, 🇯🇵, KIX 等）並更新摘要卡片。
*   **航空公司動態彙整**：自動提取所有航班代碼，並彙整不重複的航空公司清單顯示於卡片。

### 2. 資料持久化與 CRUD (Persistence & Editing)
*   **管理員編輯模式**：點擊右下角按鈕並輸入密碼（`0918216001`）後開啟 CRUD 工具列。
*   **編輯功能**：支援標題、航班資訊、飯店明細的即時編輯（In-place Editing）。
*   **數據儲存**：
    *   **優先級 1**：遠端 MongoDB (REST API)。
    *   **優先級 2**：本地 LocalStorage (離線存取)。
*   **自動對齊**：編輯完成後自動呼叫統計函數與同步機制。

### 5. 飯店區塊管理 (Hotel Section)

#### 5.1 結構規範
每個 `.trip` 卡片必須包含 `.hotel-section`，位於 `.passenger-section` 之後、`.trip` 關閉前：

```html
<div class="hotel-section">
    <div class="hotel-section-title">🏨 飯店 Hotels</div>
    <div class="hotel-table"><table>
        <thead><tr>
            <th>酒店</th><th>體系</th><th>入住</th><th>退房</th>
            <th>晚數</th><th>支付</th><th>價錢</th><th>備註</th>
        </tr></thead>
        <tbody>
        <!-- 資料列 or 佔位符 -->
        </tbody>
    </table></div>
</div>
```

**佔位符（尚未確認飯店時使用）：**
```html
<tr><td colspan="8" class="note" style="text-align:center;color:var(--text-muted);">— 飯店資料待補 —</td></tr>
```

#### 5.2 資料列格式
```html
<tr>
  <td class="hotel-name">酒店名稱</td>
  <td><span class="hotel-system">IHG</span></td>  <!-- 或 class="dash">— -->
  <td class="hotel-dates">4/12</td>
  <td class="hotel-dates">4/17</td>
  <td class="note" style="text-align:center">5</td>
  <td class="note">大戶(4708)</td>
  <td class="price">THB 30,000</td>  <!-- 含 Points/哩/里 → 自動套用 class="hotel-pts" -->
  <td class="note">含早餐</td>       <!-- 或 class="dash">— -->
</tr>
```

**體系標籤 (`.hotel-system`)：** 紫色小標籤，常見值：`IHG`、`IHG 私享`、`Marriott`、`Marriott 私享`、`Hilton`、`Agoda`、`私享`。

**價錢欄自動判斷：** 若值包含 `Point`、`積分`、`哩`、`里` 等關鍵字，JS 自動套用 `.hotel-pts`（紫色加粗）；否則套用 `.price`。

#### 5.3 新增飯店資料（操作流程）

**方式一：管理員模式（推薦）**
1. 右下角點 ✏️ 編輯 → 輸入密碼
2. 找到該 trip 的 🏨 飯店 Hotels 表格
3. 點表格下方「＋ 新增一行」按鈕，填入欄位後儲存
4. 資料同步至 LocalStorage / MongoDB

**方式二：直接編輯 HTML**
在對應 trip 的 `.hotel-section tbody` 新增 `<tr>` 資料列（格式見 5.2）。

#### 5.4 覆蓋率現況
| Tab | 狀態 |
|-----|------|
| 2027 Trip 1–2 | 有結構，待補資料（佔位符） |
| 2026 Trip 1, 2, 4, 5 | 已填入完整資料 |
| 2026 Trip 3（聖誕跨年） | 有結構，待補資料（佔位符） |
| 2025 Trip 1–5 | 已填入完整資料 |
| 2024 T1–T7 | 有結構，待補資料（佔位符） |
| 2023 T1–T4 | 有結構，待補資料（佔位符） |
| 2022 T1 | 已填入完整資料 |

### 3. 多分頁管理 (Tab Navigation)
*   支援 2027 (計劃)、2026 (當前)、2025 (歷史) 及 2022-2024 (歷史) 的切換。
*   歷史頁面採用淡化處理（Desaturated color scheme），區分當前與過去數據。

### 4. 航班方向標籤 (Directional Badges)
*   **Outbound (去程)**：綠色主題標籤。
*   **Inbound (回程)**：紅色主題標籤。
*   **自定義區段**：支援非標準區段（如 URT↔DMK）的標籤生成。

---

## 技術架構與部署 (Technical Stack & Deployment)

### 1. 部署環境 (Deployment)
*   **前端網頁 (Frontend)**：託管於 **GitHub Pages**，提供靜態 HTML/JS 存取。
*   **後端 API (Backend)**：運行於 **Vercel Serverless Functions**，處理與 MongoDB 的資料交換。
*   **自動化 (CI/CD)**：透過 Git Push 觸發 GitHub Actions 或 Vercel 自動部署。

### 2. 資料庫與持久化 (Databases)
*   **主要資料庫 (Primary DB)**：**MongoDB Atlas** (Cloud Database)，儲存行程增刪、修改及標題編輯等持久化數據。
*   **備援與快取 (Local Cache)**：**瀏覽器 LocalStorage**，確保在網路斷線或 API 故障時，使用者仍能存取並暫存編輯內容。
*   **資料結構 (Data Schema)**：
    *   `deleted`: 紀錄已刪除組件的 Unique ID。
    *   `added`: 儲存新插入行的 HTML 片段。
    *   `tripEdits`: 儲存行程標題、日期與標籤的覆蓋屬性。
    *   `lastUpdated`: 紀錄最後一次同步的時間戳記。

---

## 近期功能異動紀錄 (Recent Feature Additions)

### 1. 備註欄 (Notes Column) — 2026-05-08
*   **背景**：2027 Tab 的 Trip 2 日本行程需要紀錄 ALEX 與 MARK 的個別備註。
*   **實作**：在對應 `<thead>` 加入 `<th>備註</th>`，每列補上 `<td class="dash">—</td>` 或實際備註文字。
*   **範圍**：僅影響 2027 Trip 2 的航班表格。

### 2. 複製列功能 (Copy Row Feature) — 2026-05-08
*   **背景**：編輯模式需要快速複製某旅客的航班列到另一個 Trip。
*   **實作**：
    1. 每列右側新增「複製」按鈕（`.copy-row-btn`），點擊後開啟目標選單（`#copy-target-menu`，`position:fixed`）。
    2. 選單選項：
        *   **同 Trip 插入**：直接在當前 `tbody` 最後插入，欄位間以 ` | ` 分隔顯示。
        *   **至其他 [Trip]**：將複製 HTML 存入 localStorage / MongoDB 的目標 Trip `<tbody>`。
*   **旅客判斷**：從 `.table-wrap` 往上查找 `.passenger-label > .p-badge`，取得 ALEX / MARK 等標籤，對應至正確的 `.passenger-section`。
*   **儲存格式**：`{ id, html }` 存入 store 的 `added[tbodyEid]` 陣列。
*   **CSS 注意**：選單使用 `position:fixed`，座標以 `getBoundingClientRect()` 取得 viewport 位置，**不加** `window.scrollY` / `window.scrollX`，否則會有偏移 bug。

### 3. 完整 Data Schema — 2026-05-08

localStorage / MongoDB store 欄位說明：

| 欄位 | 說明 |
|------|------|
| `deleted` | 已刪除元件的 `data-eid` 集合 |
| `added` | 新增航班列 `{ [tbodyEid]: [{id, html}] }` |
| `addedSections` | 新增旅客區塊 `{ [tripEid]: [{id, html}] }` |
| `addedTrips` | 新增行程 `{ [tabId]: [{id, html}] }` |
| `rowEdits` | 編輯列 `{ [trEid]: [cellHtml, ...] }` |
| `tripEdits` | 編輯行程標題 `{ [tripEid]: {dest, dates, tag} }` |
| `lastUpdated` | 最後同步時間（zh-TW locale string） |

### 4. 飯店區塊補齊 — 2026-06-02
*   **背景**：2024 T1–T7、2023 T1–T4、2026 Trip 3 原本缺少 `.hotel-section`，導致管理員模式無法新增飯店資料。
*   **修正**：補齊上述共 12 個 trip 的 `hotel-section`（含佔位符），確保所有 Tab 所有 trip 結構一致。
*   **規範**：詳見上方「5. 飯店區塊管理」章節。

---

*最後更新日期：2026/06/02*