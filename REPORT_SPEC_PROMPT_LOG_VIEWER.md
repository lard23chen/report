# Claude Prompt Log Viewer 技術規範說明

> 🔒 **存取限制** — 本工具僅供本機存取（localhost:3000），需啟動 `server.js` 才能使用，不對外公開。

## 1. 基本資訊

| 項目 | 內容 |
|------|------|
| 檔案位置 | `public/prompt_log_viewer.html` |
| 存取網址 | `http://localhost:3000/prompt_log_viewer.html` |
| 資料來源 | `C:\Users\alexchen\.claude\prompt-log.txt` |
| 後端服務 | `server.js`（Express，port 3000） |
| API 端點 | `GET /api/prompt-log` |
| 存取限制 | 本機 localhost（無 IP guard、無密碼） |
| 負責人 | 陳俊良 |
| 主要目的 | 瀏覽、搜尋 Claude Code 每次提交的 prompt 歷史紀錄 |

---

## 2. 資料來源

### 2.1 Log 檔案路徑

```
C:\Users\alexchen\.claude\prompt-log.txt
```

由 Claude Code 的 hook 機制自動寫入，每次提交 prompt 即附加一行。

### 2.2 Log 格式

每行一筆，格式如下：

```
YYYY-MM-DD HH:MM:SS | prompt 內容
```

範例：
```
2026-05-20 14:32:01 | 匯入4月份Azure費用資料
2026-05-20 15:10:44 | 全系統費用走勢趨勢圖 總計的節點請註記資料
```

- 日期時間與 prompt 以 `|` 分隔（前後各一空格）
- 無法解析格式的行仍會顯示，time 欄位留空

---

## 3. API 端點

`server.js` 提供以下端點：

```js
GET /api/prompt-log
```

直接讀取 `prompt-log.txt` 並以 `text/plain` 回傳，前端自行 parse。

```js
app.get('/api/prompt-log', (req, res) => {
    const logPath = 'C:\\Users\\alexchen\\.claude\\prompt-log.txt';
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.type('text/plain').send(data);
    });
});
```

---

## 4. 視覺樣式

採用深色主題，CSS 變數如下：

| 變數 | 值 | 用途 |
|------|----|------|
| `--bg` | `#0f1117` | 頁面背景 |
| `--card` | `#1a1d2e` | 表頭、header 背景 |
| `--border` | `#2d3148` | 分隔線、border |
| `--text` | `#e2e8f0` | 主文字 |
| `--muted` | `#8892a4` | 次要文字、編號 |
| `--accent` | `#7c9eff` | 主標題、連結 |
| `--accent2` | `#a78bfa` | 排序按鈕 |
| `--success` | `#4ade80` | 計數強調 |
| `--ts` | `#fbbf24` | 時間欄位、表頭 |
| `--hover` | `#252a45` | 列 hover 背景 |

字體：`Segoe UI`, system-ui（時間欄位改用 `Cascadia Code` / `Consolas` monospace）

---

## 5. 功能說明

### 5.1 Header 工具列

| 元件 | 功能 |
|------|------|
| 標題 | `🤖 Claude Prompt Log Viewer` |
| 計數 | 總計 N 筆 / 顯示 N 筆（即時更新） |
| 搜尋框 | 即時過濾，同時比對 prompt 內容與時間字串 |
| 排序按鈕 | `⬆ 最舊優先` / `⬇ 最新優先` 切換（預設最新優先） |
| 重新整理按鈕 | 重新呼叫 `/api/prompt-log` 取得最新資料 |

### 5.2 資料表格

欄位（左至右）：

| 欄位 | 說明 |
|------|------|
| `#` | 序號（依排序方向計算） |
| 時間 | `YYYY-MM-DD HH:MM:SS`，monospace 字體，金黃色 |
| Prompt | prompt 完整內容，搜尋時關鍵字以黃色高亮標記 |

### 5.3 搜尋關鍵字高亮

搜尋時，符合字串以 `<mark class="highlight">` 包覆，樣式：
- 背景：`rgba(251, 191, 36, 0.25)`（半透明黃）
- 圓角：`2px`

### 5.4 錯誤提示

若 `server.js` 未啟動或讀取失敗，頂部顯示紅色錯誤訊息區塊，提示確認 localhost:3000 是否運行。

---

## 6. 相關檔案

| 檔案 | 用途 |
|------|------|
| `public/prompt_log_viewer.html` | 前端主頁面（靜態，由 server.js 提供） |
| `server.js` | Express server（port 3000），含 `/api/prompt-log` 路由 |
| `C:\Users\alexchen\.claude\prompt-log.txt` | Claude Code hook 自動寫入的 prompt 紀錄 |

---

## 7. 啟動方式

```bash
node server.js
# 瀏覽器開啟 http://localhost:3000/prompt_log_viewer.html
```

---

*最後更新日期：2026/05/22*
