# 會議室預約系統技術規劃

## 技術選型

| 層次 | 技術 | 用途 |
|------|------|------|
| 前端 | React 18 | 使用者操作層 UI |
| 後端 | Python / FastAPI | API 服務、商業邏輯 |
| 資料庫 | SQLite | 資料持久化儲存 |

---

## 系統架構

```
┌─────────────────────────────────────┐
│           前端 (React)               │
│   瀏覽器執行，透過 REST API 與後端溝通  │
└─────────────────┬───────────────────┘
                  │ HTTP / JSON
                  ▼
┌─────────────────────────────────────┐
│          後端 (FastAPI)              │
│   處理請求、驗證邏輯、回傳資料          │
└─────────────────┬───────────────────┘
                  │ SQL
                  ▼
┌─────────────────────────────────────┐
│          資料庫 (SQLite)             │
│   儲存預約、會議室、使用者資料          │
└─────────────────────────────────────┘
```

---

## 專案結構

```
project/
├── backend/
│   ├── main.py              # FastAPI 應用程式入口
│   ├── database.py          # 資料庫連線與初始化
│   ├── models.py            # SQLAlchemy 資料模型
│   ├── schemas.py           # Pydantic 請求/回應 Schema
│   ├── routers/
│   │   ├── bookings.py      # 預約相關 API
│   │   ├── rooms.py         # 會議室相關 API
│   │   └── users.py         # 使用者相關 API
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BookingForm.jsx      # 預約表單
│   │   │   ├── RoomCalendar.jsx     # 時間軸總覽
│   │   │   └── MyBookings.jsx       # 我的預約列表
│   │   ├── pages/
│   │   │   ├── BookPage.jsx         # 功能一：會議室預約
│   │   │   ├── OverviewPage.jsx     # 功能二：查看預約情形
│   │   │   └── MyPage.jsx           # 功能三：我的預約
│   │   ├── api/
│   │   │   └── client.js            # API 請求封裝
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── bookings.db              # SQLite 資料庫檔案
```

---

## 資料庫設計

### 資料表：`users`（使用者）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | INTEGER PK | 使用者 ID |
| name | TEXT | 姓名 |
| email | TEXT UNIQUE | 電子郵件 |
| created_at | DATETIME | 建立時間 |

### 資料表：`rooms`（會議室）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | INTEGER PK | 會議室 ID |
| name | TEXT | 會議室名稱 |
| capacity | INTEGER | 最大容納人數 |
| description | TEXT | 備註說明 |

### 資料表：`bookings`（預約）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | INTEGER PK | 預約 ID |
| room_id | INTEGER FK | 會議室 ID |
| user_id | INTEGER FK | 預約人 ID |
| title | TEXT | 會議主題 |
| attendees | INTEGER | 參與人數 |
| note | TEXT | 備註（選填） |
| start_time | DATETIME | 開始時間 |
| end_time | DATETIME | 結束時間 |
| status | TEXT | 狀態：pending / confirmed / cancelled |
| created_at | DATETIME | 建立時間 |

---

## 後端 API 設計

### 會議室

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/rooms` | 取得所有會議室 |
| GET | `/api/rooms/available` | 查詢指定時段的可用會議室（需帶 `start_time`, `end_time`）|

### 預約

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/bookings` | 建立新預約（含衝突驗證）|
| GET | `/api/bookings/daily` | 查詢指定日期所有預約（需帶 `date`）|
| GET | `/api/bookings/my` | 查詢目前使用者的所有預約 |
| PUT | `/api/bookings/{id}` | 修改預約（含衝突重新驗證）|
| DELETE | `/api/bookings/{id}` | 取消預約（更新狀態為 cancelled）|

---

## 前端頁面與元件

### 功能一：會議室預約（BookPage）

- 日期與時段選擇器
- 呼叫 `/api/rooms/available` 顯示可用會議室清單
- 選擇會議室後展開 `BookingForm`（主題、人數、備註）
- 送出後顯示成功訊息或衝突錯誤提示

### 功能二：查看預約情形（OverviewPage）

- 日期選擇器
- `RoomCalendar` 元件以時間軸方式呈現各會議室佔用狀況
  - 已預約時段顯示會議摘要（hover 或點擊）
  - 空閒時段可點擊直接跳轉至預約頁面
- 資料來源：`/api/bookings/daily`

### 功能三：我的預約（MyPage）

- `MyBookings` 元件分「即將到來」與「歷史紀錄」兩區塊
- 每筆預約顯示：會議室、日期時段、主題、狀態
- 操作：
  - **修改**：展開編輯表單，送出後呼叫 `PUT /api/bookings/{id}`
  - **取消**：確認 dialog 後呼叫 `DELETE /api/bookings/{id}`

---

## 後端核心邏輯：衝突驗證

預約建立與修改時，皆執行以下 SQL 查詢確認無時段重疊：

```sql
SELECT id FROM bookings
WHERE room_id = :room_id
  AND status != 'cancelled'
  AND start_time < :end_time
  AND end_time > :start_time
  AND id != :exclude_id  -- 修改時排除自身
```

若查詢結果不為空，回傳 `409 Conflict`。

---

## 主要套件

### 後端 (`requirements.txt`)

```
fastapi
uvicorn
sqlalchemy
pydantic
```

### 前端 (`package.json` dependencies)

```
react
react-dom
react-router-dom
axios
dayjs
```

---

## 啟動方式

### 後端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端預設執行於 `http://localhost:5173`，後端 API 於 `http://localhost:8000`。
