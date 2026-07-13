# Travel Tickets MongoDB 設定說明

## 重要：正確的資料庫位置

| 項目 | 值 |
|------|----|
| 連線字串 | `讀取 .env 的 MONGODB_URI_PERSONAL（勿寫入文檔）` |
| **資料庫** | **`AlexLIFE`** |
| **Collection（旅程資料）** | **`Travel`**（大寫 T） |
| Collection（UI 編輯狀態） | `TravelStore` |

> ⚠️ 注意：Collection 名稱為 **`Travel`**，大寫開頭。勿建立新的 `travel` 或 `trips` collection。

---

## MongoDB 現有資料庫一覽

```
AlexLIFE      → Travel, Stock_Portfolio, TravelStore
sample_mflix  → (系統範例)
test          → Stock_Portfolio
```

---

## Travel Collection 資料結構

每筆文件代表一趟旅程：

```json
{
  "_id": "2026:t0",
  "tab": "2026",
  "tripNum": "Trip 1",
  "destination": "🇹🇭 Bangkok (BKK)",
  "dates": "2026/04/09 – 2026/04/19",
  "tag": "潑水節 Songkran",
  "tagStyle": "",
  "passengers": [
    {
      "name": "ALEX",
      "badge": "alex",
      "note": "",
      "flights": [
        {
          "direction": "go",
          "departure": "2026/04/10 22:40",
          "arrival": "01:25 (+1)",
          "flightNo": "CI837",
          "pnr": "6YG9JD",
          "aircraft": "Airbus A321neo",
          "ticket": "LINK",
          "payment": "KGI信用卡-4701",
          "fare": "NT$8,542",
          "fareType": "price",
          "notes": "購買 4/25"
        }
      ]
    }
  ],
  "hotels": [
    {
      "name": "Holiday Inn Express Bangkok Siam",
      "chain": "IHG",
      "checkIn": "4/10",
      "checkOut": "4/12",
      "nights": "2",
      "payment": "大戶(4708)",
      "price": "Points 36,000",
      "priceType": "pts",
      "notes": "ALEX · 2 Single Standard w/ Breakfast"
    }
  ]
}
```

### `_id` 命名規則
`{tab}:t{index}` — 例如 `2026:t0`, `2025:t3`, `2024:t11`

### `tab` 值
- `"2026"` — 當前旅程（4 筆）
- `"2025"` — 2025 歷史（6 筆）
- `"2024"` — 2022–2024 歷史（12 筆）

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `Travel_Tickets_2026.html` | 前端頁面，CRUD + MongoDB 同步 |
| `travel_server.js` | Express API 伺服器（port 3001） |
| `import_travel_to_mongo.js` | 從 HTML 解析並匯入資料到 MongoDB |

---

## 啟動方式

```bash
# 啟動 API 伺服器
node travel_server.js

# 開啟頁面
http://localhost:3001/Travel_Tickets_2026.html

# 重新匯入資料（HTML → MongoDB）
node import_travel_to_mongo.js
```

---

## API 端點

Base URL: `http://localhost:3001`

| Method | 路徑 | 說明 |
|--------|------|------|
| GET | `/api/travel/trips` | 所有旅程 |
| GET | `/api/travel/trips?tab=2026` | 指定年份 |
| GET | `/api/travel/trips/:id` | 單筆（如 `2026:t0`） |
| PUT | `/api/travel/trips/:id` | 更新旅程 |
| DELETE | `/api/travel/trips/:id` | 刪除旅程 |
| GET | `/api/travel/store` | 讀取 UI 編輯狀態 |
| PUT | `/api/travel/store` | 儲存 UI 編輯狀態 |
| DELETE | `/api/travel/store` | 清除所有編輯 |

---

## 曾發生的錯誤（避免重蹈）

### ❌ 錯誤：建立了新的 `travel` 資料庫
- 第一次設定時誤將 `DB_NAME = 'travel'`，在 MongoDB 建立了全新的 `travel` 資料庫
- 正確應為 `DB_NAME = 'AlexLIFE'`

### ❌ 錯誤：Collection 命名為 `trips`
- 第一次設定時 `COL_NAME = 'trips'`
- 正確應為 `COL_NAME = 'Travel'`（大寫 T，與使用者既有的 collection 一致）

### ✅ 正確做法
新增功能前，**先用以下指令確認現有資料庫結構**：

```javascript
const adminDb = client.db().admin();
const dbs = await adminDb.listDatabases();
for (const d of dbs.databases) {
    const cols = await client.db(d.name).listCollections().toArray();
    console.log(d.name, '->', cols.map(c => c.name).join(', '));
}
```
