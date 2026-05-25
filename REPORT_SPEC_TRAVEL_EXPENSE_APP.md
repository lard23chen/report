# 旅遊記帳助手 技術規範說明

本文件定義「旅遊記帳助手 Streamlit App」的技術架構、資料結構、功能組件與維護規範。

---

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 應用程式名稱 | 旅遊記帳助手 |
| Streamlit Cloud URL | https://report-kql5mwjfdwxmzdg5n5gd7u.streamlit.app/ |
| 主程式 | `travel_expense_app.py` |
| 依賴清單 | `requirements.txt` |
| 資料庫 | MongoDB Atlas — `AlexLIFE` DB，`TravelExpense` Collection |
| 本機 Secrets | `.streamlit/secrets.toml`（不進 git） |
| 負責人 | 陳俊良 |
| 主要目的 | 旅遊期間即時記帳，支援多裝置輸入，資料同步顯示，無需本機 server |

---

## 2. 技術架構

| 層級 | 技術 |
|------|------|
| 前端 / UI | Streamlit 1.57+（Python） |
| 後端 | Streamlit Cloud（無需本機 server） |
| 資料庫 | MongoDB Atlas（pymongo 4.17+） |
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

### 5.1 KPI 指標列（頁面頂部）
- 總消費金額（所有筆數加總）
- ALEX 負擔（payer = ALEX 加總）
- MARK 負擔（payer = MARK 加總）
- 今日消費筆數 + 今日金額

### 5.2 輸入表單（左欄）
- 類別：Radio 水平排列（8 選項含 Emoji）
- 消費項目：文字輸入
- 金額 + 幣別：並排輸入
- 付款方式：Radio 水平排列
- 付款人：Radio 水平排列
- 日期：預設今天，可修改
- 備注：選填文字
- 送出後自動清空表單並立即重新載入資料（`st.rerun()`）

### 5.3 消費明細列表（右欄）
- 篩選器：付款人 / 類別 / 幣別（三個下拉）
- 依日期分組，折疊式展開（今日自動展開）
- 每日小計顯示
- 每筆記錄含：Emoji 類別、項目名稱、金額、付款人、付款方式、備注
- 每筆右側有 🗑️ 刪除按鈕（點擊即刪，頁面自動重新整理）

### 5.4 統計分析（頁面底部）
- 類別統計表：按金額降序，含 Emoji
- 付款人統計表：按金額降序，含佔比百分比
- 🔄 重新整理按鈕：手動拉取最新資料

---

## 6. 部署與維護

### 6.1 Streamlit Cloud 部署設定

| 設定 | 值 |
|------|----|
| Repository | `lard23chen/report` |
| Branch | `main` |
| Main file path | `travel_expense_app.py` |
| Secret（App Settings） | `MONGO_URI = "mongodb+srv://..."` |

### 6.2 本機開發

```bash
# 安裝依賴
pip install streamlit pymongo pandas

# 建立 secrets（不進 git）
# .streamlit/secrets.toml：
# MONGO_URI = "mongodb+srv://..."

# 啟動
python -m streamlit run travel_expense_app.py
```

### 6.3 新增選項

修改 `travel_expense_app.py` 中的常數：

```python
CATEGORIES  = [...]   # 消費類別
PAY_METHODS = [...]   # 付款方式
PAYERS      = [...]   # 付款人
CURRENCIES  = [...]   # 幣別
```

push 後 Streamlit Cloud 自動重新部署。

---

## 7. 安全性說明

| 項目 | 說明 |
|------|------|
| MongoDB URI | 存在 Streamlit Cloud Secrets（不寫入程式碼或 git） |
| 本機 Secrets | `.streamlit/secrets.toml` 已列入 `.gitignore` |
| 存取控制 | Streamlit Cloud 公開 URL，無密碼保護（個人工具） |

---

## 8. 相關連結

- 旅遊票券報表：`REPORT_SPEC_TRAVEL_2026.md`
- 旅遊排程自動更新：`REPORT_SPEC_SCHEDULED_TASKS.md` §4
- ALEX 生活管理目錄：`ALEX_Life_Catalog.html`
