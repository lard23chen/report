# API Reference — 會議室預約系統

> 提供會議室查詢、預約建立／修改／取消、每日總覽與個人預約管理的 REST API。

## Base URL

```
http://localhost:8000
```

## Authentication

目前不需要認證。`user_id` 直接帶入請求參數／Body。

## 資料格式

- Request / Response：`application/json`
- 時間格式：ISO 8601 — `2024-06-01T09:00:00`
- 狀態值（`status`）：`confirmed` | `cancelled`

---

## Rooms — 會議室

### GET /api/rooms

取得系統中所有會議室清單。

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

---

### GET /api/rooms/available

依時段查詢無衝突的可用會議室（排除已取消的預約）。

**Query Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_time` | datetime | Yes | 查詢時段開始，例如 `2024-06-01T09:00:00` |
| `end_time` | datetime | Yes | 查詢時段結束，例如 `2024-06-01T10:00:00` |

**重疊判斷邏輯**

只要現有預約的時段與查詢時段有任何重疊（`start < end_time AND end > start_time`），該會議室即從結果中排除。相鄰時段（例如預約到 10:00，查詢從 10:00 開始）視為不衝突。

**Request 範例**

```
GET /api/rooms/available?start_time=2024-06-01T09:00:00&end_time=2024-06-01T10:00:00
```

**Response 200**

```json
[
  {
    "id": 2,
    "name": "新竹廳",
    "capacity": 6,
    "location": "3F",
    "description": "小型討論室，適合 6 人以下會議"
  }
]
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 422 | 缺少 `start_time` 或 `end_time`，或時間格式無效 |

---

## Bookings — 預約

### POST /api/bookings

建立新預約。若指定時段與同一會議室已有有效預約重疊，回傳 409。

**Request Body**

```json
{
  "room_id": 1,
  "user_id": 42,
  "title": "Q3 產品規劃會議",
  "attendees": 8,
  "note": "需要準備白板筆",
  "start_time": "2024-06-01T09:00:00",
  "end_time": "2024-06-01T11:00:00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `room_id` | int | Yes | 會議室 ID |
| `user_id` | int | Yes | 預約人 ID |
| `title` | string | Yes | 會議主題 |
| `attendees` | int | No（預設 1）| 參與人數 |
| `note` | string | No | 備註 |
| `start_time` | datetime | Yes | 開始時間 |
| `end_time` | datetime | Yes | 結束時間 |

**Response 201**

```json
{
  "id": 101,
  "room_id": 1,
  "user_id": 42,
  "title": "Q3 產品規劃會議",
  "attendees": 8,
  "note": "需要準備白板筆",
  "start_time": "2024-06-01T09:00:00",
  "end_time": "2024-06-01T11:00:00",
  "status": "confirmed",
  "created_at": "2024-05-20T14:32:00",
  "room": { "id": 1, "name": "台北廳", "capacity": 10, "location": "3F", "description": "附投影機與白板" },
  "user": null
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 409 | 時段衝突 — 同一會議室在此時段已有有效預約 |
| 422 | 請求欄位缺少或格式錯誤 |

---

### GET /api/bookings/daily

查詢指定日期的所有預約（用於總覽頁面時間軸）。

**Query Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `date` | string（YYYY-MM-DD）| Yes | 查詢日期，例如 `2024-06-01` |

**Response 200**

```json
[
  {
    "id": 101,
    "room_id": 1,
    "user_id": 42,
    "title": "Q3 產品規劃會議",
    "attendees": 8,
    "note": "需要準備白板筆",
    "start_time": "2024-06-01T09:00:00",
    "end_time": "2024-06-01T11:00:00",
    "status": "confirmed",
    "created_at": "2024-05-20T14:32:00",
    "room": { "id": 1, "name": "台北廳", "capacity": 10, "location": "3F", "description": null }
  }
]
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 422 | 缺少 `date` 或日期格式無效 |

---

### GET /api/bookings/my

查詢指定使用者的所有預約，分為「即將到來」與「歷史紀錄」。

**Query Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `user_id` | int | Yes | 使用者 ID |

**Response 200**

```json
{
  "upcoming": [
    {
      "id": 101,
      "room_id": 1,
      "user_id": 42,
      "title": "Q3 產品規劃會議",
      "attendees": 8,
      "note": null,
      "start_time": "2024-06-10T09:00:00",
      "end_time": "2024-06-10T11:00:00",
      "status": "confirmed",
      "created_at": "2024-05-20T14:32:00",
      "room": { "id": 1, "name": "台北廳", "capacity": 10, "location": "3F", "description": null }
    }
  ],
  "history": [
    {
      "id": 98,
      "room_id": 2,
      "user_id": 42,
      "title": "週會",
      "attendees": 5,
      "note": null,
      "start_time": "2024-05-15T14:00:00",
      "end_time": "2024-05-15T15:00:00",
      "status": "confirmed",
      "created_at": "2024-05-10T09:00:00",
      "room": { "id": 2, "name": "新竹廳", "capacity": 6, "location": "3F", "description": null }
    }
  ]
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 422 | 缺少 `user_id` 或格式錯誤 |

---

### PUT /api/bookings/{id}

修改現有預約。會重新執行衝突驗證（排除自身預約）。

**Path Parameters**

| Name | Type | Description |
|------|------|-------------|
| `id` | int | 預約 ID |

**Request Body**（所有欄位皆為選填，只傳要修改的欄位）

```json
{
  "title": "Q3 產品規劃會議（更新）",
  "attendees": 10,
  "start_time": "2024-06-01T10:00:00",
  "end_time": "2024-06-01T12:00:00"
}
```

**Response 200** — 回傳更新後完整的預約物件（格式同 POST）

**Error Responses**

| Status | Description |
|--------|-------------|
| 404 | 找不到此預約 |
| 409 | 修改後的時段與其他預約衝突 |
| 422 | 請求欄位格式錯誤 |

---

### DELETE /api/bookings/{id}

取消預約（將 `status` 更新為 `cancelled`，不刪除紀錄）。取消後該時段立即釋放，可重新被預約。

**Path Parameters**

| Name | Type | Description |
|------|------|-------------|
| `id` | int | 預約 ID |

**Response 200**

```json
{
  "id": 101,
  "status": "cancelled"
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 404 | 找不到此預約 |

---

## 前端頁面與 API 對應

| 頁面 | 動作 | API |
|------|------|-----|
| 預約（BookPage） | 選時段查可用會議室 | `GET /api/rooms/available` |
| 預約（BookPage） | 送出預約表單 | `POST /api/bookings` |
| 總覽（OverviewPage） | 載入日期時間軸 | `GET /api/bookings/daily` |
| 我的預約（MyPage） | 載入個人預約列表 | `GET /api/bookings/my` |
| 我的預約（MyPage） | 修改預約 | `PUT /api/bookings/{id}` |
| 我的預約（MyPage） | 取消預約 | `DELETE /api/bookings/{id}` |

---

## 錯誤格式

所有錯誤回傳標準 FastAPI 格式：

```json
{
  "detail": "錯誤說明文字"
}
```

422 Validation Error 額外包含欄位資訊：

```json
{
  "detail": [
    {
      "loc": ["query", "start_time"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```
