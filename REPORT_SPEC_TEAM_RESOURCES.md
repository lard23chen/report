# 團隊資源索引 技術規範說明

本文件定義「團隊資源索引（Team_Resources.html）」的產出標準。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `Team_Resources.html` |
| 架構 | 純前端 HTML（無產生腳本），直接與 MongoDB Atlas 通訊 |
| 資料來源 | MongoDB `QwareAi` / `TeamResourcesDB` |
| 負責人 | 陳俊良 |
| 主要目的 | 管理並快速查閱團隊常用連結（CRUD 操作） |

---

## 2. 視覺樣式

採用**深色主題（Dark / Slate）**。

| CSS 變數 | 值 | 說明 |
|---|---|---|
| `--bg` | `#0f172a` | 頁面背景 |
| `--surface` | `#1e293b` | 卡片/面板背景 |
| `--surface2` | `#273349` | 次層背景 |
| `--border` | `#334155` | 邊框 |
| `--accent` | `#3b82f6` | 強調色（藍） |
| `--accent-hover` | `#2563eb` | 強調色 hover |
| `--success` | `#22c55e` | 成功/新增 |
| `--danger` | `#ef4444` | 刪除/警告 |
| `--text` | `#f1f5f9` | 主要文字 |
| `--text-muted` | `#94a3b8` | 次要文字 |

字體：`Inter` + `Noto Sans TC`（Google Fonts）

---

## 3. 功能組件

### 3.1 搜尋列（Toolbar）

- 即時搜尋（`input` 事件觸發）
- 搜尋範圍：項目名稱、說明、連結 URL
- 顯示目前資源筆數 badge

### 3.2 資源清單表格

| 欄位 | 說明 |
|------|------|
| 編號 | 自動序號 |
| 項目名稱 | 資源名稱 |
| 說明 | 備注欄 |
| 連結 | 可點擊 URL |
| 操作 | 編輯 / 刪除按鈕 |

### 3.3 新增 / 編輯 Modal

- 欄位：名稱、說明、連結
- 送出後寫入 MongoDB，即時刷新表格

### 3.4 刪除確認

刪除前顯示確認對話，防止誤刪。

---

## 4. 資料結構（MongoDB 文件）

```json
{
  "_id": ObjectId,
  "name": "資源名稱",
  "note": "說明備注",
  "url": "https://...",
  "createdAt": ISODate
}
```

---

## 5. 更新方式

此報表為 CRUD 應用，直接在頁面操作即可。無需執行腳本。

若需修改 UI 或邏輯，直接編輯 `Team_Resources.html` 後 commit/push：

```bash
git add Team_Resources.html
git commit -m "Update Team Resources UI/logic"
git push origin main
```
