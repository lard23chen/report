# 匠名 IG 內容計畫 技術規範說明

本文件定義「匠名 IG 內容計畫」工具的功能規範與設定方式。與 [REPORT_SPEC_IG_PLANNER.md](REPORT_SPEC_IG_PLANNER.md)（`@pinkcoffeetaiwan`）為完全獨立的帳號與工具，彼此不共用資料。

---

## 1. 基本資訊 (General Info)

- **報表名稱**：`IG_Anon_Planner.html`
- **報表網址**：`https://lard23chen.github.io/report/IG_Anon_Planner.html`
- **資料來源**：瀏覽器 localStorage（無後端，全前端運作），key 為 `ig-anon-planner-v1`
- **IG 帳號**：匠名帳號，尚未建立（帳號名稱待補）
- **定位**：測試/學習自動化流程用，**不談變現**
- **內容形式**：每日 7–10 秒生活碎片短影音（Reels），無腳本、不露臉
- **素材流程（Phase 1）**：手機拍攝 → 手機剪輯 App 完成剪輯 → 直接發布到 IG，不進雲端素材庫
- **素材流程（Phase 2，全自動）**：手機剪輯完成 → 存進 Google Drive 同步資料夾 → 雲端服務自動偵測並發布到 IG（見第 5 節）

---

## 2. 分階段架構 (Phasing)

| Phase | 內容 | 狀態 |
|-------|------|------|
| Phase 0 | 帳號啟動 SOP（開新帳號、去識別化、封鎖已知聯絡人） | 人工操作，一次性 |
| Phase 1 | 內容規劃工具（月曆排程、文案範本、Hashtag、Checklist、人工手動發布） | ✅ 已完成，本文件涵蓋 |
| Phase 2 | Instagram Graph API 自動發布 | 尚未決定是否要做，僅列規格骨架 |

**Phase 2 與素材流程的已知矛盾**：Graph API 發布**必須提供公開可存取的影片 URL**，而目前選擇的素材流程是「手機到手機、不進雲端」。若未來要做 Phase 2，勢必要新增一個雲端中轉步驟（例如上傳到 GitHub 或雲端硬碟取得公開 URL），屆時需要重新確認是否仍要維持「素材不進雲端」的原則。

---

## 3. 功能說明 (Features)

### 3.1 月曆頁（📅 月曆）

- 與 IG_Post_Planner 相同的動態月曆、進度追蹤、連續天數邏輯
- **支柱**（依星期自動套用，全部為免露臉主題）：

| 星期 | 支柱 |
|------|------|
| 一、五 | ☕ 日常片刻 |
| 二、日 | 🚶 移動瞬間 |
| 三 | 🚗 通勤視角 |
| 四 | 🌆 場景光影 |
| 六 | 🎬 隨手一鏡 |

- 主題建議依日期 hash 決定性選取（固定不亂跳），所有主題皆為手邊物件/環境/移動畫面，不涉及入鏡或口白
- 資料持久化：`localStorage` key `ig-anon-planner-v1`，以 `YYYY/M/D` 為索引

### 3.2 文案範本頁（✍️ 文案範本）

- 五大支柱各 2 個範本（比 IG_Post_Planner 少，因應短影音字幕通常更精簡）
- 文案內容針對 7–10 秒片段設計，避免透露真實地點、店名等可辨識資訊
- 每個範本右上角「複製」按鈕，一鍵複製全文

### 3.3 Hashtag 頁（🏷️ Hashtag）

- 分類：大標籤、中標籤、小標籤、生活片刻、短影音
- **刻意不含精確地標類 hashtag**（例如特定店名、街道），避免匠名帳號被反向定位
- 點擊標籤選取（再點取消），底部顯示已選清單，一鍵複製

### 3.4 清單頁（✅ 清單）

新增第四組清單（Phase 0），其餘三組沿用 IG_Post_Planner 架構但調整內容：

1. **🔒 帳號啟動前（Phase 0）**：開新帳號、大頭貼去識別化、Bio 不寫真實資訊、封鎖已知聯絡人、關閉聯絡人同步、關閉精確地理標記
2. **📋 每日發文前確認**：新增「畫面無臉部/車牌/門牌等可辨識資訊」「文案沒有透露真實地點」兩項隱私檢查
3. **📈 每週成長確認**：新增「確認素材都在手機端剪輯完成，未上傳到任何雲端」
4. **🚀 新帳號前 30 天任務**：移除「大頭貼換真實照片」，改為去識別化版本

勾選狀態存入 localStorage。

---

## 4. 視覺樣式

與 IG_Post_Planner 相同：

- **主題**：深色背景（`#0f0f0f`）
- **主色**：IG 漸層（`#f58529` → `#dd2a7b` → `#8134af` → `#515bd4`）
- **字體**：`Outfit`, `Noto Sans TC`

---

## 5. 全自動發布系統（Phase 2）

> ⚠️ **狀態：規格已定案，等待前置設定完成後才能開發**（見 5.4 前置條件檢查表）
>
> 決策記錄：2026/07/20 與用戶確認 —— (1) 監看服務跑在雲端主機（非本機，24/7 不受電腦開關機影響）；(2) mp4 上傳方式採 Google Drive 同步資料夾；(3) Instagram 發文的 Meta API 設定要先走完，才開始寫程式。

### 5.1 整體流程

```
[使用者電腦]                [Google Drive]              [雲端服務 24/7]                [Instagram]
手機剪輯完成的 mp4   ──同步──▶  /IG_AutoPost/inbox/  ──輪詢偵測──▶  Node.js Worker  ──Graph API──▶  發布 Reels
                                                              │
                                                              ├─ 讀取同名 .txt 當文案（沒有就用範本自動生成）
                                                              ├─ 下載影片、暫存到自己的公開端點取得 video_url
                                                              ├─ 呼叫 Graph API 發布
                                                              └─ 成功 → 搬到 /inbox/posted/
                                                                 失敗 → 搬到 /inbox/failed/ + 記錄錯誤原因
```

### 5.2 元件說明

| 元件 | 說明 |
|------|------|
| Google Drive 同步資料夾 | `IG_AutoPost/inbox/`（使用者電腦裝 Google Drive 桌面應用程式即可，丟檔案 = 自動上雲） |
| 雲端 Worker | Node.js 常駐服務，部署在雲端主機（Railway 或同等服務），每 N 分鐘輪詢 Drive API 檢查新檔案 |
| 文案來源 | 資料夾內同名 `.txt`（優先）→ 沒有的話依當天星期自動套用 Phase 1 的支柱範本 + Hashtag |
| 公開影片 URL | Graph API 要求 `video_url` 可被 Meta 伺服器存取；Worker 下載後由自己的服務暫時對外提供該檔案（非永久公開 Drive 連結），避免長期外流原始素材 |
| 狀態記錄 | 成功/失敗分別搬到 `inbox/posted/`、`inbox/failed/`，失敗需寫入錯誤原因，避免無限重試 |

### 5.3 Instagram Graph API 發文步驟

1. 建立 Facebook 粉絲專頁並綁定新 IG 帳號（創作者/商業帳號）
2. 建立 Meta Developer App，取得 App ID / App Secret
3. 用 Graph API Explorer 取得 Long-lived Access Token，權限需含 `instagram_content_publish`
4. `POST /{ig-user-id}/media`（帶 `video_url` + `media_type=REELS` + `caption`）→ 取得 `creation_id`
5. 輪詢 `GET /{creation_id}?fields=status_code` 直到 `FINISHED`
6. `POST /{ig-user-id}/media_publish`（帶 `creation_id`）→ 正式發布

### 5.4 前置條件檢查表（用戶自行操作，完成後告知 Claude 繼續）

> 互動版指南見 [`IG_Anon_Setup_Guide.html`](https://lard23chen.github.io/report/IG_Anon_Setup_Guide.html)：每個前置條件都有逐步操作說明、可勾選追蹤進度（localStorage key `ig-anon-setup-v1`），並標註哪些資訊要回報給 Claude（App ID/Secret、Drive 憑證等）。

| 項目 | 狀態 |
|------|------|
| Phase 0：新匠名帳號建立 + 切換創作者/商業帳號 | 🔲 |
| Facebook 粉絲專頁建立並綁定 IG 帳號 | 🔲 |
| Meta Developer App 建立，取得 App ID / App Secret | 🔲 |
| Google Cloud 專案啟用 Drive API，取得服務帳號憑證 | 🔲 |
| 雲端主機選定（Railway 或同等服務），可跑 24/7 Node 服務 | 🔲 |

> 全部打勾後，Claude 才開始寫 Worker 程式（`ig_auto_publish_worker.js`），並補上部署 SOP 到本文件。

---

## 6. 更新 SOP

1. 修改 `IG_Anon_Planner.html`
2. `git add IG_Anon_Planner.html && git commit -m "..." && git push origin main`
3. 若有功能變更，同步更新本文件

---

*建立日期：2026/07/20*
