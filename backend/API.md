# API Reference — 會議室預約系統

> 管理會議室資源並查詢可用時段的 REST API。

## Base URL

```
http://localhost:8000
```

## Authentication

No authentication required.

---

## General

### GET /

**確認服務運作狀態**

**Response 200**

```json
{
  "message": "會議室預約系統 API"
}
```

---

## Rooms

### GET /api/rooms

**取得所有會議室清單**

不需任何參數，回傳系統中全部已建立的會議室。

**Response 200**

```json
[
  {
    "id": 1,
    "name": "台北廳",
    "capacity": 10,
    "location": "3F",
    "description": "標準會議室，附投影機與白板"
  },
  {
    "id": 2,
    "name": "新竹廳",
    "capacity": 6,
    "location": "3F",
    "description": "小型討論室，適合 6 人以下會議"
  },
  {
    "id": 3,
    "name": "台中廳",
    "capacity": 20,
    "location": "4F",
    "description": "大型會議室，附視訊設備"
  },
  {
    "id": 4,
    "name": "台南廳",
    "capacity": 4,
    "location": "2F",
    "description": "電話會議專用室"
  },
  {
    "id": 5,
    "name": "高雄廳",
    "capacity": 30,
    "location": "4F",
    "description": "大型演講廳，附舞台與麥克風"
  }
]
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 500 | 伺服器內部錯誤 |

---

### GET /api/rooms/available

**查詢指定時段內無衝突的可用會議室**

根據給定的開始與結束時間，回傳在該時段內沒有任何有效預約（`status != "cancelled"`）的會議室清單。時間重疊判斷採半開區間：若現有預約結束時間恰好等於查詢開始時間，則不視為衝突。

**Query Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_time` | datetime (ISO 8601) | Yes | 查詢時段的開始時間，例如 `2024-06-01T09:00:00` |
| `end_time` | datetime (ISO 8601) | Yes | 查詢時段的結束時間，例如 `2024-06-01T10:00:00` |

**Example Request**

```
GET /api/rooms/available?start_time=2024-06-01T09:00:00&end_time=2024-06-01T10:00:00
```

**Response 200**

```json
[
  {
    "id": 1,
    "name": "台北廳",
    "capacity": 10,
    "location": "3F",
    "description": "標準會議室，附投影機與白板"
  },
  {
    "id": 2,
    "name": "新竹廳",
    "capacity": 6,
    "location": "3F",
    "description": "小型討論室，適合 6 人以下會議"
  }
]
```

若該時段所有會議室皆已被預約，則回傳空陣列 `[]`。

**衝突判斷邏輯**

一個現有預約與查詢時段衝突，若且唯若：

```
booking.start_time < query.end_time  AND  booking.end_time > query.start_time
```

已取消（`status = "cancelled"`）的預約不計入衝突。

**Error Responses**

| Status | Description |
|--------|-------------|
| 422 | Validation error — 缺少必填參數 `start_time` 或 `end_time`，或時間格式無效 |
| 500 | 伺服器內部錯誤 |

**422 Response Example**

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["query", "start_time"],
      "msg": "Field required",
      "input": null
    }
  ]
}
```

---

## Data Models

### Room

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | integer | No | 會議室唯一識別碼（主鍵） |
| `name` | string (100) | No | 會議室名稱，例如「台北廳」 |
| `capacity` | integer | No | 最大容納人數 |
| `location` | string (200) | Yes | 樓層或位置，例如「3F」 |
| `description` | string (text) | Yes | 會議室設備或用途說明 |

### Booking

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | No | — | 預約唯一識別碼（主鍵） |
| `room_id` | integer | No | — | 關聯的會議室 id |
| `user_id` | integer | No | — | 關聯的使用者 id |
| `title` | string (200) | No | — | 會議名稱 |
| `attendees` | integer | No | `1` | 預計出席人數 |
| `note` | string (text) | Yes | `null` | 備註 |
| `start_time` | datetime | No | — | 會議開始時間（UTC） |
| `end_time` | datetime | No | — | 會議結束時間（UTC） |
| `status` | string (20) | No | `"confirmed"` | 預約狀態：`confirmed` / `cancelled` |
| `created_at` | datetime | No | 系統時間 | 建立時間（UTC） |

### User

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | integer | No | 使用者唯一識別碼（主鍵） |
| `name` | string (100) | No | 使用者姓名 |
| `email` | string (200) | No | 電子郵件（唯一值） |
| `created_at` | datetime | No | 建立時間（UTC） |

---

## Notes

- 所有時間欄位皆使用 **ISO 8601 格式**，例如 `2024-06-01T09:00:00`。
- 時間值儲存於資料庫時以 **UTC** 為準；呼叫端負責時區換算。
- 預設資料由 `seed.py` 初始化，包含「台北廳、新竹廳、台中廳、台南廳、高雄廳」五間會議室。
