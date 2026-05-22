> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。

# Railway 管理後台系統 (Railway Admin Dashboard)
## 視覺規範 (Visual Specifications)

### 1. 管理介面風格 (Admin Style)
*   **專業儀表板 (Enterprise Dashboard)**：左側固定導航欄，右側內容區塊。
*   **字體**：`Outfit` (數字與標題) + `Noto Sans TC` (中文說明)。
*   **配色**：`#1e293b` (深藍灰背景) 搭配綠色 (#22c55e) 或紅色 (#ef4444) 的狀態標籤。

### 2. 數據組件 (Data Components)
*   **數值卡片 (Metric Cards)**：顯示總交易量、存活連接數與日均處理量。
*   **資料表 (Data Tables)**：支援多欄位排序 (Sorting) 與篩選功能 (Filtering)。
*   **分頁控制**：整合於表格底部的快速分頁跳轉。

---

## 功能組件 (Functional Components)

### 1. 管理員功能 (Admin Features)
*   **身份驗證 (Authentication)**：透過 Railway Server 進行 JWT 或 Session 權限控管。
*   **CRUD 管理**：直接操作 `Railway_Prod_DB` 的完整介面。
*   **即時日誌檢視 (Live Log)**：查看生產環境的即時 API 呼叫日誌。

### 2. 技術架構 (Technical Stack)
*   **環境部署**：**Railway.app**。
*   **API 核心**：Express.js 搭配 MongoDB Driver。
*   **安全性**：啟用生產環境下的 SSL 強制與 Rate Limiting。

---

## 操作流程 (Operating Procedures)

### 1. 登入與授權 (Login & Auth)
*   **權限入口**：輸入管理帳號與 10 位數安全密碼。
*   **憑證取得**：成功後由 Railway Server 簽發效期 24 小時的 Session，以供後續 CRUD 操作。

### 2. 資料管理 (Data Management)
*   **新增項目**：點擊右上角「＋」按鈕，填入 JSON 格式數據並提交。
*   **編輯與刪除**：在表格行尾點擊「編輯」或「刪除」，操作後系統會立即同步至 `Railway_Prod_DB` 並重新整理列表。

### 3. 日誌與監控 (Monitoring)
*   **即時日誌**：開啟「Live Log」視窗可查看當前生產環境的所有 HTTP 請求與錯誤回應。
*   **快取清除**：若有資料更新未即時反映，可手動執行「Clear Server Cache」強制重新整理。

---

## 測試案例 (Test Cases)

> 測試環境：`https://project1-production-76e0.up.railway.app/admin`
> 更新日期：2026/04/08

### TC-ADMIN-001：未登入直接訪問後台應被導向登入頁

| 欄位 | 內容 |
|------|------|
| **前置條件** | 瀏覽器未持有有效 Session |
| **測試步驟** | 1. 直接瀏覽 `/admin` URL |
| **預期結果** | HTTP 302 Redirect 至 `/admin/login`，不顯示後台內容 |

### TC-ADMIN-002：GET /admin/login 登入頁正常顯示

| 欄位 | 內容 |
|------|------|
| **前置條件** | 無 |
| **測試步驟** | 1. 瀏覽 `/admin/login` |
| **預期結果** | 顯示深色主題登入畫面，包含「帳號」「密碼」輸入欄及「登入」按鈕，無錯誤訊息 |

### TC-ADMIN-003：登入失敗（帳密錯誤）

| 欄位 | 內容 |
|------|------|
| **前置條件** | 位於 `/admin/login` 頁面 |
| **測試步驟** | 1. 輸入錯誤帳號 / 密碼<br>2. 點擊「登入」 |
| **預期結果** | HTTP 401，頁面顯示紅色錯誤訊息「帳號或密碼錯誤」，不進入後台 |

### TC-ADMIN-004：登入成功（帳密正確）

| 欄位 | 內容 |
|------|------|
| **前置條件** | 位於 `/admin/login` 頁面 |
| **測試步驟** | 1. 輸入正確管理帳號與 10 位數密碼<br>2. 點擊「登入」 |
| **預期結果** | HTTP 302 Redirect 至 `/admin`，後台儀表板正常顯示，Session 效期 24 小時 |

### TC-ADMIN-005：已登入再訪問登入頁應直接導向後台

| 欄位 | 內容 |
|------|------|
| **前置條件** | 已持有有效 Session |
| **測試步驟** | 1. 瀏覽 `/admin/login` |
| **預期結果** | 自動 Redirect 至 `/admin`，不顯示登入表單 |

### TC-ADMIN-006：GET /api/admin/stats 統計資料

| 欄位 | 內容 |
|------|------|
| **前置條件** | 已登入，取得有效 Session |
| **測試步驟** | 1. 呼叫 `GET /api/admin/stats` |
| **預期結果** | HTTP 200，回傳 JSON 包含 `total`、`aiResolved`、`needsHuman`、`resolutionRate`、`dailyCounts`、`topQuestions` 欄位 |

### TC-ADMIN-007：GET /api/admin/logs 對話紀錄（全部）

| 欄位 | 內容 |
|------|------|
| **前置條件** | 已登入 |
| **測試步驟** | 1. 呼叫 `GET /api/admin/logs` |
| **預期結果** | HTTP 200，回傳 `{ total, page, data: [...] }`，data 中每筆含 `user_message`、`ai_reply`、`needs_human`、`rating`、`created_at` |

### TC-ADMIN-008：GET /api/admin/logs?filter=human 篩選轉人工紀錄

| 欄位 | 內容 |
|------|------|
| **前置條件** | 已登入，資料庫中有 `needs_human: true` 的紀錄 |
| **測試步驟** | 1. 呼叫 `GET /api/admin/logs?filter=human` |
| **預期結果** | 回傳的 data 中每筆 `needs_human` 均為 `1`（true），total 為轉人工紀錄總數 |

### TC-ADMIN-009：POST /api/admin/knowledge 新增知識庫條目

| 欄位 | 內容 |
|------|------|
| **前置條件** | 已登入 |
| **測試步驟** | 1. POST `{ question: "測試問題", answer: "測試答案", tags: "tag1,tag2" }` 至 `/api/admin/knowledge` |
| **預期結果** | HTTP 200，回傳 `{ success: true, id: "QA-XXX" }`，新條目出現於知識庫列表 |
| **異常情境** | 缺少 `question` 或 `answer` 時回傳 HTTP 400 `{ error: "請填寫問題與答案" }` |

### TC-ADMIN-010：GET /admin/logout 登出並清除 Session

| 欄位 | 內容 |
|------|------|
| **前置條件** | 已登入 |
| **測試步驟** | 1. 瀏覽 `/admin/logout` |
| **預期結果** | Session 銷毀，HTTP 302 Redirect 至 `/admin/login`；再次訪問 `/admin` 需重新登入 |

### TC-ADMIN-011：未登入呼叫 API 應回傳 401

| 欄位 | 內容 |
|------|------|
| **前置條件** | 無有效 Session |
| **測試步驟** | 1. 無 Session 狀態下呼叫 `GET /api/admin/stats`<br>2. 無 Session 狀態下呼叫 `GET /api/admin/logs` |
| **預期結果** | 兩者皆回傳 HTTP 401，拒絕存取 |

### TC-ADMIN-012：Live Log 視窗即時顯示

| 欄位 | 內容 |
|------|------|
| **前置條件** | 已登入後台 |
| **測試步驟** | 1. 開啟「Live Log」視窗<br>2. 在另一頁面對 `/api/chat` 發送問題 |
| **預期結果** | Live Log 視窗即時顯示該次 HTTP 請求記錄，包含時間戳、方法、路徑、狀態碼 |
