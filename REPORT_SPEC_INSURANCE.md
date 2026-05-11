# 保單資產管理系統 (A_Insurance_Report)

## 1. 基本資訊

| 項目 | 內容 |
|------|------|
| 檔案名稱 | `A_Insurance_Report.html` |
| GitHub Pages URL | https://lard23chen.github.io/report/A_Insurance_Report.html |
| MongoDB 資料庫 | `AlexLIFE` |
| MongoDB Collection | `Insurance` |
| Vercel API | `https://report-theta-nine.vercel.app/api/insurance` |
| 本地 API | `insurance_server.js`（port 3001）或 `server.js`（port 3000） |
| API 腳本 | `insurance_api.js`（Vercel 用） |

---

## 2. 視覺規範

- **視覺風格**：深色模式，與 Stock_Portfolio 同一套 CSS 變數（`--bg:#0f172a`、`--surface:#1e293b`）
- **同步狀態指示器**：右上角圓點
  - 🟡 黃色閃爍：載入中
  - 🟢 綠色：已連上 Vercel API（可 CRUD）
  - 🔴 紅色：唯讀模式（fallback 靜態 JSON）

---

## 3. 欄位定義

| 欄位 key | 顯示名稱 | 說明 |
|----------|---------|------|
| `name` | 保單名稱 | 商品名稱 |
| `date` | 成交日 | 投保日期 |
| `policyNumber` | 保單號碼 | 保單編號或銀行帳戶資訊 |
| `years` | 年期 | 繳費年數 |
| `annualPremium` | 年繳保費 | 每年繳納金額（字串含逗號） |
| `accumulatedPremium` | 累計繳費 | 累計總繳金額 |
| `maturityYear` | 滿期年 | 保單到期年份 |
| `maturityAmount` | 滿期金 | 期滿領回金額 |
| `return5yr` | 5年領回 | 滿期後5年可領金額 |
| `return10yr` | 10年領回 | 滿期後10年可領金額 |
| `returnNov2025` | 2025領回 | 2025/11 解約預計領回金額 |
| `insured` | 保險人 | 選單：`Alex` / `Mark` |
| `agent` | 經手人 | 選單：`金` / `琪` |
| `memo` | 備註 | 自由文字，允許換行顯示 |

---

## 4. 統計卡片

頁面頂部顯示三張統計卡：
- **總保單數**：目前筆數
- **總年繳保費估算**：`annualPremium` 欄位加總
- **總累計繳費估算**：`accumulatedPremium` 欄位加總

---

## 5. CRUD 操作

### 進入編輯模式
右下角 ✏️ 編輯按鈕 → 輸入密碼 → 啟用編輯模式，每列顯示「編輯」「刪除」按鈕，並出現「＋ 新增」按鈕。

### API 路由

| 動作 | Method | 路由 |
|------|--------|------|
| 讀取全部 | GET | `/api/insurance` |
| 新增 | POST | `/api/insurance/add` |
| 修改 | POST | `/api/insurance/update`（body 含 `_id`） |
| 刪除 | POST | `/api/insurance/delete`（body 含 `_id`） |

### 唯讀模式
當 Vercel API 無法連線時，自動 fallback 讀取 `insurance_data.json`（靜態）。此時點儲存會彈出提示，不允許寫入。

---

## 6. 資料流

```
GitHub Pages (靜態)
  ↓ fetch Vercel API
https://report-theta-nine.vercel.app/api/insurance
  ↓ insurance_api.js (Vercel Serverless)
  ↓ MongoDB Atlas: AlexLIFE.Insurance
  
本地開發
  node insurance_server.js (port 3001)
  或 node server.js (port 3000) → /api/insurance 路由
  ↓ MongoDB Atlas: AlexLIFE.Insurance
```

---

## 7. 靜態同步腳本

每次透過本地 server 對 MongoDB 修改資料後，執行以下指令更新 GitHub Pages 的靜態備援檔案：

```bash
node sync_insurance_json.js
git add insurance_data.json
git commit -m "sync insurance data"
git push origin main
```

---

## 8. 相關檔案

| 檔案 | 用途 |
|------|------|
| `A_Insurance_Report.html` | 前端主報表（GitHub Pages） |
| `insurance_api.js` | Vercel Serverless API |
| `insurance_server.js` | 本地獨立 server（port 3001） |
| `insurance_data.json` | 靜態備援資料（Vercel 掛掉時用） |
| `sync_insurance_json.js` | 從 MongoDB dump 到靜態 JSON |
| `import_insurance.js` | 從 extracted_insurance.json 匯入 MongoDB（一次性） |
| `extracted_insurance.json` | Google Sheets 原始匯出資料 |
