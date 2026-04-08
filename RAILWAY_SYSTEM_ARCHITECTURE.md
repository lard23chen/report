# Railway 生產環境系統架構 (Railway Project Architecture)

## 專屬系統流圖 (Railway Flowchart)

```mermaid
graph LR
    User((使用者 / 管理員))

    subgraph "前端展示層"
        Demo[Railway Demo - demo.html]
        Admin[Railway Admin - /admin]
    end

    subgraph "Railway 生產集群 (Production Cluster)"
        API[Node.js Express Server]
        Auth[JWT/Session Auth]
    end

    subgraph "數據持久層"
        DB[(Railway_Prod_DB - MongoDB)]
    end

    %% 交互關係
    User <-->|HTTPS| Demo
    User <-->|Login / Manage| Admin
    
    Demo <-->|API Request| API
    Admin <-->|Auth & CRUD| API
    
    API <-->|Write/Read| DB

    %% 樣式定義
    style User fill:#f9f,stroke:#333,stroke-width:2px
    style DB fill:#00ed64,stroke:#333,stroke-width:2px,color:#000
    style Demo fill:#42f5b6,stroke:#333,stroke-width:2px,color:#000
    style Admin fill:#1e293b,stroke:#fff,stroke-width:2px,color:#fff
    style API fill:#42f5b6,stroke:#333,stroke-width:2px,color:#000
```

---

## 23 & 24 整合運作流程

### 1. 展示頁面 (Demo) 流向
*   **載入**：前端發送請求至 Railway API。
*   **獲取**：API 從 `Railway_Prod_DB` 擷取生產環境數據。
*   **渲染**：以玻璃擬態 UI 展示即時專案狀態。

### 2. 管理後台 (Admin) 流向
*   **驗證**：進入 `/admin` 需通過安全密碼驗證取得 JWT 憑證。
*   **監控**：管理員可直接查閱資料庫狀態與即時 API 流量日誌。
*   **操作**：執行新增、修改、刪除動作後，API 同步更新資料庫，並使 Demo 頁面即時反映變更。

### 3. 環境特點
*   **全站 HTTPS**：強制使用 Railway 提供之 SSL 加密連線。
*   **零時差同步**：所有操作直接作用於生產環境資料庫，無快取延遲。
