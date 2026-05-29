# IG 貼文計畫 技術規範說明

本文件定義「IG 貼文計畫」工具的功能規範與設定方式。

---

## 1. 基本資訊 (General Info)

- **報表名稱**：`IG_Post_Planner.html`
- **報表網址**：`https://lard23chen.github.io/report/IG_Post_Planner.html`
- **資料來源**：瀏覽器 localStorage（無後端，全前端運作）
- **IG 帳號**：`@pinkcoffeetaiwan`
- **主要目的**：個人 IG 貼文計畫工具，包含月曆追蹤、文案範本、Hashtag 選取、發文清單

---

## 2. 功能說明 (Features)

### 2.1 月曆頁（📅 月曆）

- **動態產生**：自動顯示當月日曆，無需手動設定
- **月份導航**：‹ / › 按鈕切換月份，「回今天」快速跳回當月
- **支柱循環**：依星期自動套用內容支柱

| 星期 | 支柱 |
|------|------|
| 一、五 | 🌅 日常記錄 |
| 二、日 | 💭 心情感悟 |
| 三 | 🍜 美食探索 |
| 四 | 🎯 成長紀錄 |
| 六 | 🌍 出遊足跡 |

- **主題建議**：每天從主題池依日期 hash 決定性選取（固定不亂跳）
- **點擊格子**：開啟 Modal，可寫草稿、備註、套用範本、標記完成
- **橘點標記**：格子右下角出現橘點代表有儲存草稿
- **進度追蹤**：已完成 / 待發文 / 完成率 / 連續天數（全域跨月計算）
- **資料持久化**：`localStorage` key `ig-planner-v2`，以 `YYYY/M/D` 為索引

### 2.2 文案範本頁（✍️ 文案範本）

- 五大支柱各 3 個範本，可展開折疊
- 每個範本右上角「複製」按鈕，一鍵複製全文

### 2.3 Hashtag 頁（🏷️ Hashtag）

- 分類：大標籤（百萬+）、中標籤（1–10 萬）、小標籤、美食、旅遊
- 點擊標籤選取（再點取消），底部顯示已選清單，一鍵複製

### 2.4 清單頁（✅ 清單）

- 每日發文前確認 checklist
- 每週成長確認 checklist
- 新帳號前 30 天任務 checklist
- 勾選狀態存入 localStorage

---

## 3. 視覺樣式

- **主題**：深色背景（`#0f0f0f`）
- **主色**：IG 漸層（`#f58529` → `#dd2a7b` → `#8134af` → `#515bd4`）
- **字體**：`Outfit`, `Noto Sans TC`

---

## 4. Instagram Graph API 自動發文設定 SOP

> ⚠️ **尚未完成設定**，等待 Meta App ID / App Secret 取得後繼續

### 4.1 前置條件

| 項目 | 狀態 |
|------|------|
| IG 帳號類型 | ✅ 已是創作者帳號（`@pinkcoffeetaiwan`） |
| Facebook 粉絲專頁 | 🔲 尚未建立 |
| Meta Developer App | 🔲 尚未建立 |
| Access Token | 🔲 尚未取得 |

### 4.2 設定步驟

#### Step 1｜建立 Facebook 粉絲專頁
1. 開 [facebook.com/pages/create](https://www.facebook.com/pages/create)
2. 名稱輸入 `pinkcoffeetaiwan`，類別選「個人部落客」
3. 建立完成即可（不需填其他資料）

#### Step 2｜將 FB 粉絲專頁連結到 IG 帳號
1. 開 IG app → 右上角三條線 → **設定和隱私**
2. **帳號中心** → **帳號** → **新增帳號** → 選擇剛建立的 FB 粉絲專頁

#### Step 3｜建立 Meta Developer App
1. 開 [developers.facebook.com](https://developers.facebook.com) → 右上角「開始使用」
2. 「建立 App」→ 類型選「**其他**」→「**商業**」
3. App 名稱填 `IG Planner`
4. 在控制台左側「產品」→ 找「**Instagram**」→「設定」
5. 進入後記下 **App ID** 與 **App Secret**（設定 → 基本資料）

#### Step 4｜取得 Access Token（由 Claude 協助完成）
將 `App ID` 與 `App Secret` 提供給 Claude，後續步驟：
1. 用 Graph API Explorer 取得 User Token
2. 要求權限：`instagram_content_publish`、`instagram_manage_insights`、`pages_show_list`
3. 換取 Long-lived Token（有效期 60 天）
4. 整合發文 API 進 `IG_Post_Planner.html`

### 4.3 發文 API 流程（設定完成後）

```
Step 1：POST /{ig-user-id}/media
        → 上傳圖片 URL + caption
        → 回傳 creation_id

Step 2：POST /{ig-user-id}/media/publish
        → 帶入 creation_id
        → 正式發布貼文
```

> ⚠️ **注意**：Instagram Graph API 發文**必須附圖片**（不支援純文字）。
> 圖片需要是**公開可存取的 URL**（不能是本機路徑）。
> 建議使用 GitHub 托管圖片或 imgur。

### 4.4 計畫整合功能（完成 Token 設定後）

在 Modal 裡新增「📤 發布到 IG」按鈕：
- 輸入圖片 URL
- 文案草稿直接作為 caption
- 按下後呼叫 API 發文，顯示成功/失敗訊息
- 發文成功自動標記當天為「已完成」

---

## 5. 更新 SOP

1. 修改 `IG_Post_Planner.html`
2. `git add IG_Post_Planner.html && git commit -m "..." && git push origin main`
3. 若有功能變更，同步更新本文件

---

*最後更新日期：2026/05/29（建立規範文檔，新增 API 設定 SOP）*
