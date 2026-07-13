# 股票投資組合資料存取說明 (Stock Portfolio Data Access Guide)

本專案已全面遷移至 MongoDB 雲端架構，並透過 Vercel 部署後端 API 以供資料維護與查詢。

## 1. 資料存取資訊 (Data Storage)

*   **資料庫平台**: MongoDB Atlas
*   **資料庫名稱 (Database)**: `AlexLIFE`
*   **集合名稱 (Collection)**: `Stock_Portfolio`
*   **連線字串**: `讀取 .env 的 MONGODB_URI_PERSONAL（勿寫入文檔）`

---

## 2. 後端 API (Backend API)

後端使用 Node.js Express 撰寫，並部署於 Vercel。

*   **雲端 API 網址**: `https://report-theta-nine.vercel.app/api/stock`
*   **本機 API 網址**: `http://localhost:3001/api/stock` (開發測試用)

### API 端點說明:

| 功能 | 方法 | 端點 (Endpoint) | 說明 |
| :--- | :--- | :--- | :--- |
| 取得所有資料 | GET | `/` | 回傳所有交易記錄，依日期降序排列。 |
| 新增記錄 | POST | `/add` | 新增一筆交易記錄。 |
| 修改記錄 | POST | `/update` | 根據 `_id` 修改指定記錄。 |
| 刪除記錄 | POST | `/delete` | 根據 `_id` 刪除指定記錄。 |
| 取得即時股價 | GET | `/prices` | 從台證所 (TWSE) 抓取指定代號的最新股價。 |

---

## 3. 資料欄位結構 (Schema)

每筆交易記錄包含以下欄位：

| 欄位名 | 類型 | 說明 | 範例 |
| :--- | :--- | :--- | :--- |
| `date` | String | 交易日期 (YYYY/MM/DD) | `2026/03/31` |
| `type` | String | 交易類型 (買/賣/股利) | `買` |
| `code` | String | 股票代號 | `2330` |
| `name` | String | 股票名稱 | `台積電` |
| `buyShares` | Number | 買入股數 | `1000` |
| `buyPrice` | Number | 買入單價 | `600.5` |
| `sellShares` | Number | 賣出股數 | `0` |
| `sellPrice` | Number | 賣出單價 | `0` |
| `amount` | Number | 成交金額 | `600500` |
| `cost` | Number | 交易成本 (手續費+稅) | `855` |
| `spend` | Number | 總支出 | `601355` |
| `income` | Number | 總收入 | `0` |
| `person` | String | 操作人員 (alex/mark) | `alex` |
| `note` | String | 備註 | `長期持有` |

---

## 4. 維護與開發 (Maintenance)

### 本機開發環境啟動：
1. 確保已安裝相關套件：`npm install`
2. 啟動 API 伺服器：
   ```powershell
   node stock_api.js
   ```
3. 開啟網頁：直接在瀏覽器打開 `Stock_Portfolio.html` 即可。

### 部署說明：
*   **前端**: 只要 `git push` 到 GitHub，GitHub Pages 會自動更新。
*   **後端**: 只要 `git push` 到 GitHub，Vercel 會偵測 `vercel.json` 並自動重新部署 API。

---

## 5. 常見問題排除 (Troubleshooting)

1.  **API 500 錯誤**:
    *   通常是 MongoDB Atlas 的 **Network Access** 沒有將 IP 設為 `0.0.0.0/0`。
    *   或是連線字串中的帳號密碼有誤。
2.  **日期顯示 "Wed"**:
    *   已在 `Stock_Portfolio.html` 中修復，請確保使用 `formatDate()` 函數處理資料顯示。
3.  **無法取得股價**:
    *   為了避開瀏覽器 CORS 限制，必須透過 `/api/stock/prices` 由伺服器端請求台證所資料。
