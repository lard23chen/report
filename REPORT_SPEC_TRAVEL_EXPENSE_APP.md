# 旅遊記帳助手 技術規範說明

本文件定義「旅遊記帳助手 Streamlit App」的技術架構、資料結構、功能組件與維護規範。

---

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 應用程式名稱 | 旅遊記帳助手 |
| Streamlit Cloud URL | https://report-kql5mwjfdwxmzdg5n5gd7u.streamlit.app/ |
| 主程式 | `travel_expense_app.py` |
| 明細頁 | `pages/detail.py` |
| 共用模組 | `travel_db.py`（MongoDB 連線、常數、CSS） |
| 依賴清單 | `requirements.txt` |
| 資料庫 | MongoDB Atlas — `AlexLIFE` DB，`TravelExpense` Collection |
| 本機 Secrets | `.streamlit/secrets.toml`（不進 git） |
| 主題設定 | `.streamlit/config.toml`（進 git） |
| 負責人 | 陳俊良 |
| 主要目的 | 旅遊期間即時記帳，支援多裝置輸入，資料同步顯示，無需本機 server |

---

## 2. 技術架構

| 層級 | 技術 |
|------|------|
| 前端 / UI | Streamlit 1.57+（Python） |
| 後端 | Streamlit Cloud（無需本機 server） |
| 資料庫 | MongoDB Atlas（pymongo 4.17+） |
| 圖片壓縮 | Pillow 10.0+（JPEG，最大 1024px，quality=72） |
| 部署平台 | Streamlit Community Cloud（免費方案） |
| GitHub Repo | `lard23chen/report`，主程式位於根目錄 |

---

## 3. MongoDB 資料結構

### Collection：`AlexLIFE.TravelExpense`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `_id` | ObjectId | MongoDB 自動產生 |
| `date` | string | 消費日期，格式 `YYYY-MM-DD` |
| `category` | string | 消費類別（見 §4） |
| `item` | string | 消費項目說明 |
| `amount` | float | 金額（數字，無千分位） |
| `currency` | string | 幣別（TWD / THB / JPY / USD / HKD / KRW） |
| `paymentMethod` | string | 付款方式（見 §4） |
| `payer` | string | 付款人（見 §4） |
| `note` | string | 備注（可空） |
| `receiptImage` | string | 收據圖片 Base64（可空，壓縮後 JPEG） |
| `receiptType` | string | 固定為 `image/jpeg`（有 receiptImage 時存在） |
| `createdAt` | datetime | 寫入時間（UTC） |

---

## 4. 選項清單

### 消費類別
| 選項 | Emoji |
|------|-------|
| 餐飲 | 🍽️ |
| 交通 | 🚗 |
| 住宿 | 🏨 |
| 購物 | 🛍️ |
| 景點 | 🎫 |
| SPA | 💆 |
| 飲品 | 🧋 |
| 其他 | 💬 |

### 付款方式
`現金` / `信用卡` / `Scan to pay` / `其他`

### 付款人
`ALEX` / `MARK` / `泰國帳戶` / `其他`

---

## 5. 功能組件

### 5.1 主頁（`travel_expense_app.py`）

#### KPI 指標列
- 總消費金額（所有筆數加總）
- ALEX 負擔（payer = ALEX 加總）
- MARK 負擔（payer = MARK 加總）
- 今日消費筆數

#### 輸入表單
- 類別：Radio 水平排列（8 選項含 Emoji）
- 消費項目：文字輸入
- 金額 + 幣別：並排輸入
- 付款方式：Radio 水平排列
- 付款人：Radio 水平排列
- 日期：預設今天，可修改
- 備注：選填文字
- **收據憑證（選填）**：左欄拍照（`st.camera_input`）、右欄上傳圖片（`st.file_uploader`，支援 jpg/png/heic）
  - 壓縮為 JPEG（最大 1024px，quality=72），Base64 存入 MongoDB
  - 圖片為 lazy import（PIL 只在送出時才載入，避免 import 失敗導致 app crash）
- 送出後自動清空表單並立即重新載入（`st.rerun()`）
- 成功訊息有收據時附加 `🧾` 標示

#### 查看消費明細按鈕
- 以 HTML `<a target="_blank">` 實作，點擊後**另開新分頁**
- 連結至 `/detail` 頁（Streamlit multipage routing）

### 5.2 明細頁（`pages/detail.py`）

#### KPI 指標列
- 總消費金額、ALEX 負擔（含 %）、MARK 負擔（含 %）、消費天數

#### 篩選器
- 付款人 / 類別 / 幣別（三個下拉，預設「全部」）

#### 消費明細列表
- 依日期分組，折疊式展開（今日自動展開）
- 每日顯示：日期、筆數、小計
- 每筆記錄含：Emoji 類別、項目名稱、金額、付款人、付款方式、備注
- 有收據時顯示 `🧾` badge，可展開 expander 查看原圖
- 每筆右側有 🗑️ 刪除按鈕（點擊即刪，頁面自動重新整理）
- 頂部「＋ 新增消費」按鈕返回主頁（`st.page_link`）

#### 統計分析（頁面底部）
- 類別統計表：按金額降序，含 Emoji
- 付款人統計表：按金額降序，含佔比百分比
- 🔄 重新整理按鈕：手動拉取最新資料

---

## 6. 主題設定（`.streamlit/config.toml`）

使用 Streamlit 原生 theme 設定，不依賴 CSS selector（跨版本穩定）：

```toml
[theme]
base                     = "dark"
primaryColor             = "#00d4aa"
backgroundColor          = "#071426"
secondaryBackgroundColor = "#0d1f3c"
textColor                = "#e2e8f0"
font                     = "sans serif"
```

`COMMON_CSS`（`travel_db.py`）僅補充 theme 無法控制的細節：
- form card / metric card 的邊框
- 提交按鈕的漸層背景（`#00d4aa → #0096ff`）

---

## 7. 部署與維護

### 7.1 Streamlit Cloud 部署設定

| 設定 | 值 |
|------|----|
| Repository | `lard23chen/report` |
| Branch | `main` |
| Main file path | `travel_expense_app.py` |
| Secret（App Settings） | `MONGO_URI = "mongodb+srv://..."` |

### 7.2 本機開發

```bash
pip install streamlit pymongo pandas Pillow

# .streamlit/secrets.toml（不進 git）：
# MONGO_URI = "mongodb+srv://..."

python -m streamlit run travel_expense_app.py
```

### 7.3 新增選項

修改 `travel_db.py` 中的常數：

```python
CATEGORIES  = [...]   # 消費類別
PAY_METHODS = [...]   # 付款方式
PAYERS      = [...]   # 付款人
CURRENCIES  = [...]   # 幣別
```

push 後 Streamlit Cloud 自動重新部署。

---

## 8. 安全性說明

| 項目 | 說明 |
|------|------|
| MongoDB URI | 存在 Streamlit Cloud Secrets（不寫入程式碼或 git） |
| 本機 Secrets | `.streamlit/secrets.toml` 已列入 `.gitignore` |
| 主題設定 | `.streamlit/config.toml` 進 git（無敏感資訊） |
| 存取控制 | Streamlit Cloud 公開 URL，無密碼保護（個人工具） |

---

## 9. 相關連結

- 旅遊票券報表：`REPORT_SPEC_TRAVEL_2026.md`
- 旅遊排程自動更新：`REPORT_SPEC_SCHEDULED_TASKS.md` §4
- ALEX 生活管理目錄：`ALEX_Life_Catalog.html`
