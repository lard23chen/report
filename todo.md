# 會議室預約系統 TODO

> 執行順序：從基礎到進階，每個階段低耦合、可獨立測試。

---

## 第一階段：後端基礎建設

- [x] 建立 `backend/` 資料夾與 `requirements.txt`，安裝 fastapi / uvicorn / sqlalchemy / pydantic
- [x] 實作 `database.py`：SQLite 連線、建立 engine 與 SessionLocal
- [x] 實作 `models.py`：定義 `users`、`rooms`、`bookings` 三張資料表的 SQLAlchemy Model
- [x] 實作 `schemas.py`：定義 Pydantic Request / Response Schema
- [x] 實作 `main.py`：建立 FastAPI app、掛載 router、啟動時自動建表
- [x] 測試：執行 `uvicorn main:app --reload`，確認 `/docs` 頁面正常開啟
- [x] 撰寫測試程式：`tests/test_database.py` — 測試 DB 連線、SessionLocal 可正常建立與關閉、資料表自動建立

---

## 第二階段：後端 API — 會議室（rooms）

- [x] 實作 `routers/rooms.py`：`GET /api/rooms` 取得所有會議室
- [x] 實作 `GET /api/rooms/available`：依 `start_time` / `end_time` 查詢無衝突的可用會議室
- [x] 新增初始資料：seed 3–5 間會議室至資料庫
- [x] 測試：用 `/docs` 或 curl 驗證回傳格式與可用性篩選邏輯
- [x] 撰寫測試程式：`tests/test_rooms.py` — 測試 `GET /api/rooms` 回傳清單、`GET /api/rooms/available` 依時段篩選正確

---

## 第三階段：後端 API — 預約（bookings）

- [ ] 實作 `routers/bookings.py`：`POST /api/bookings` 建立預約，含衝突驗證 SQL（時段重疊回傳 409）
- [ ] 實作 `GET /api/bookings/daily`：依 `date` 查詢當日所有預約
- [ ] 實作 `GET /api/bookings/my`：依 `user_id` 查詢個人所有預約，分未來 / 歷史
- [ ] 實作 `PUT /api/bookings/{id}`：修改預約，重新執行衝突驗證（排除自身）
- [ ] 實作 `DELETE /api/bookings/{id}`：更新狀態為 `cancelled`，釋放時段
- [ ] 測試：驗證衝突情境（同一會議室時段重疊應拒絕）、取消後可再被預約
- [ ] 撰寫測試程式：`tests/test_bookings.py` — 測試正常建立預約、時段重疊回傳 409、取消後可重新預約、每日查詢與個人查詢回傳正確

---

## 第四階段：前端基礎建設

- [ ] 建立 `frontend/` 專案（Vite + React 18），安裝 react-router-dom / axios / dayjs
- [ ] 實作 `src/api/client.js`：封裝 axios baseURL（`http://localhost:8000`）與各 API 呼叫函式
- [ ] 實作 `App.jsx`：設定 Router，定義 `/book`、`/overview`、`/my` 三條路由
- [ ] 實作 Sidebar 與 Header 共用版面（對應 demo.html 樣式）
- [ ] 測試：啟動 `npm run dev`，確認三個路由頁面可切換，API client 可正常 fetch 後端
- [ ] 撰寫測試程式：`src/__tests__/App.test.jsx` — 測試三條路由可正確渲染對應頁面、API client 函式回傳符合預期格式

---

## 第五階段：功能一 — 會議室預約（BookPage）

- [ ] 實作 `BookPage.jsx`：日期與起訖時間選擇器，選完後呼叫 `GET /api/rooms/available`
- [ ] 顯示可用會議室清單；選擇後展開 `BookingForm.jsx`
- [ ] 實作 `BookingForm.jsx`：填寫會議主題、參與人數、備註，送出呼叫 `POST /api/bookings`
- [ ] 顯示預約結果：成功提示或 409 衝突錯誤訊息
- [ ] 測試：完整走一次預約流程，確認成功與衝突兩種情境皆正確顯示
- [ ] 撰寫測試程式：`src/__tests__/BookPage.test.jsx` — 測試日期時間選擇後可用會議室清單渲染、`BookingForm` 送出成功訊息、衝突時顯示 409 錯誤提示

---

## 第六階段：功能二 — 查看預約情形（OverviewPage）

- [ ] 實作 `OverviewPage.jsx`：日期選擇器 + 上下頁切換按鈕，選日期後呼叫 `GET /api/bookings/daily`
- [ ] 實作 `RoomCalendar.jsx`：以時間軸表格呈現各會議室 08:00–20:00 的佔用狀況
  - [ ] 已預約時段標示為紅色區塊，hover 顯示 tooltip（會議主題、預約人）
  - [ ] 空閒時段 hover 顯示 `+`，點擊跳轉至 `/book` 並帶入日期與時段參數
- [ ] 測試：有預約資料時確認正確渲染，點擊空閒時段可帶參數進入預約頁面
- [ ] 撰寫測試程式：`src/__tests__/OverviewPage.test.jsx` — 測試已預約時段顯示紅色區塊與 tooltip、點擊空閒時段正確跳轉並帶入日期與時段參數

---

## 第七階段：功能三 — 我的預約（MyPage）

- [ ] 實作 `MyPage.jsx`：載入時呼叫 `GET /api/bookings/my`，依時間分為「即將到來」與「歷史紀錄」兩區塊
- [ ] 實作 `MyBookings.jsx`：卡片顯示會議室、日期時段、主題、狀態標籤
- [ ] 修改功能：點擊「修改」展開編輯表單，送出呼叫 `PUT /api/bookings/{id}`
- [ ] 取消功能：點擊「取消」顯示確認 dialog，確認後呼叫 `DELETE /api/bookings/{id}` 並重新載入列表
- [ ] 測試：驗證修改衝突情境、取消後該時段可被重新預約
- [ ] 撰寫測試程式：`src/__tests__/MyPage.test.jsx` — 測試預約列表分類顯示、修改時衝突錯誤處理、取消確認 dialog 與重新載入列表

---

## 第八階段：整合驗收

- [ ] 前後端 CORS 設定：FastAPI 加入允許 `http://localhost:5173` 的 CORS middleware
- [ ] 端對端流程測試：預約 → 在總覽確認佔用 → 在我的預約中修改 → 取消
- [ ] 邊界情境測試：空時段查詢、跨日查詢、同時段多次預約衝突
- [ ] UI 細節對齊 demo.html：sidebar active 狀態、卡片 hover 效果、狀態標籤顏色
- [ ] 撰寫測試程式：`tests/test_e2e.py`（Playwright 或 pytest）— 端對端測試完整預約流程、修改與取消流程、衝突與邊界情境全數通過
