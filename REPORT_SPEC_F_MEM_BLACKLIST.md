> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取（內含 EMAIL / USER_ID 等會員 PII）。

# 會員黑名單標記查詢報表 技術規範說明

本文件定義「會員黑名單標記查詢報表」的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `F_MEM_BlackList_Query_Report.html`（精簡版，2026/08/06 起不再嵌入資料，見 §2） |
| 後端 API | `f_blacklist_api.js`，部署於既有 Vercel 專案 `report-theta-nine.vercel.app`（見 §3） |
| 資料來源 | MongoDB `QwareAi`（`MONGODB_URI_QWARE`）`Qware_MEM_BlackList_202608` + `QWARE_MEM_IP_202608` + `Qware_A_OrderTemp_log_202608` collections，皆由 API 即時查詢，不再有本機 generator |
| 資料範圍 | 電話／USER_ID 搜尋：**即時查全部會員**，不分黑名單狀態；IP 關聯：即時查**近 30 天**登入紀錄，每組 IP 最多列前 30 個共用帳號；訂單紀錄：即時查**近 7 天**訂票暫存 log，不設每帳號筆數上限 |
| 負責人 | 陳俊良 |
| 主要目的 | 用電話號碼或 USER_ID 查任一會員（不分是否被標記黑名單），顯示完整異動紀錄與黑名單狀態；同門號對應 5 個以上不同 USER_ID 標示「MAJOR」標籤。可對單一帳號查詢其近期登入 IP，反查同一 IP 底下是否還有其他帳號（多帳號/共用裝置偵測，見 §5.3）；也可查該帳號近期訂票紀錄（演出/座位/時間/IP），協助判斷是否為搶票機器人（見 §5.3） |

## 2. 為何改用即時 API 查詢（取代 2026/08/04～08/06 的靜態嵌入版）

本報表最初（2026/08/04～08/06）採用「generator 預先查好 MongoDB、把結果 JSON 直接寫死進靜態 HTML」的做法，理由是報表部署在公開 GitHub Pages 靜態頁面，不能把 MongoDB 連線字串放進前端 JS（會外洩整個資料庫存取權限）。但隨著查詢範圍一路擴大到全體 40 萬會員 + 完整欄位 + 不限筆數訂單紀錄，檔案在 2026/08/06 當天膨脹到 **~88.5MB**，逼近 GitHub 單檔 100MB 硬性上限（詳細膨脹過程見底部 changelog）。

2026/08/06 使用者詢問「不是資料從 MongoDB 來？為什麼檔案這麼大」，藉此機會確認專案裡其實已經有現成的 Vercel 專案（`report-theta-nine.vercel.app`，見 `stock_api.js` 等既有 API），可以用**伺服器端環境變數**保管 `MONGODB_URI_QWARE`、前端改成 `fetch()` 呼叫 API 即時查詢——這樣既不用把連線字串放前端，也不用把資料嵌進靜態頁面。與使用者確認後決定**全面改用 API**，不保留靜態嵌入版本作備援，舊的 `generate_f_mem_blacklist_query.js` 已刪除。

**已知取捨**：電話／USER_ID 搜尋維持原本「任意位置部分字串比對」（如打 `018071105` 查得到 `09018071105`），這種查法即使加了索引也無法被 MongoDB 利用（索引只加速前綴比對或完全相符），每次搜尋仍是全表掃描，估計需要數秒。使用者已確認接受這個延遲，換取不用改變既有搜尋習慣。

## 3. API 端點規格

### 3.1 部署方式

`f_blacklist_api.js` 比照專案既有 `stock_api.js` 的 Vercel serverless function 模式：Express app、MongoDB 連線快取（`cachedDb`，避免每次 invoke 重新連線）、`module.exports = app`。`vercel.json` 的 `builds`/`routes` 加入對應項目，路由前綴 `/api/f-blacklist/*`。部署方式是**git push 觸發 Vercel 既有的 GitHub 整合自動部署**，不需要額外操作；但 Vercel 專案的環境變數必須已有 `MONGODB_URI_QWARE`（跟本機 `.env` 用同一把），否則 API 連不上 DB——這件事本機無法確認，需使用者自行到 Vercel dashboard 檢查。

### 3.2 端點清單

所有端點**先做 IP 白名單檢查**（見 §5.4），來源 IP 不在授權清單內一律回 `403 { ok:false, error:'forbidden' }`。

| 端點 | 參數 | 查詢對象 | 說明 |
|------|------|---------|------|
| `GET /api/f-blacklist/search` | `mode`(`mobile`\|`userid`)、`kw` | `Qware_MEM_BlackList_202608` | 依 `mode` 對 `MOBILE` 或 `USER_ID` 做部分字串 regex 比對，回傳最多 200 筆（超過時 `truncated:true`），每筆即時算 `isMajor`（見 §3.3） |
| `GET /api/f-blacklist/ip-links` | `uid` | `QWARE_MEM_IP_202608` | 該帳號近 30 天登入過的 IP，及每個 IP 底下其他帳號（上限 30，含 `totalOthers` 供截斷提示） |
| `GET /api/f-blacklist/bookings` | `uid` | `Qware_A_OrderTemp_log_202608` | 該帳號近 7 天訂票紀錄，不設筆數上限 |
| `GET /api/f-blacklist/meta` | 無 | `Qware_MEM_BlackList_202608` | Header 統計數字：全會員數（`countDocuments({})`）、近 30 天 `MEMO0='Y'` 數（靠 §4 的 `MEMO0`+`UPDATE_TIME` 複合索引加速） |

### 3.3 回傳格式

```js
// GET /api/f-blacklist/search?mode=mobile&kw=09018071105
{
  ok: true,
  truncated: false,          // 符合筆數是否超過 200 上限（超過只回前 200 筆）
  data: [
    {
      uid: "32395977337438732472",      // USER_ID
      mobileHead: "81",                  // MOBILE_head（國碼）
      mobile: "09018071105",             // MOBILE（完整電話號碼）
      memo0: "Y",                        // 'Y' / 'N' / '4' / null
      createTime: "2026-04-13 14:09:29", // 台北時間字串
      updateTime: "2026-06-22 09:21:19",
      createUser: "定期掃描異常帳號",
      updateUser: "775995263",
      isMajor: true,                     // 同門號對應 5+ 個不同 USER_ID 時為 true，否則 false
    },
  ],
}

// GET /api/f-blacklist/ip-links?uid=xxx
{
  ok: true,
  links: [
    {
      ip: "104.28.83.101",
      lastLogin: "2026-08-04 21:39:13",
      totalOthers: 47,
      related: [{ uid: "26585652857736531458", lastLogin: "2026-08-04 20:10:02" }, /* … 最多 30 筆 */],
    },
  ],
}

// GET /api/f-blacklist/bookings?uid=xxx
{
  ok: true,
  bookings: [
    { performanceId: "B0BC63P7", seat: "VIP9區-33排-34號", time: "2026-07-30 20:34:07", ip: "36.229.168.189" },
  ],
}

// GET /api/f-blacklist/meta
{ ok: true, totalMembers: 409370, blacklistCount30d: 15146, ipWindowDays: 30, ipLinkCap: 30, bookingWindowDays: 7 }
```

⚠️ 欄位改用完整英文名（`uid`/`mobile`/`createTime`…），不再沿用靜態嵌入版為了縮小檔案用的短欄位名（`uid`/`mh`/`ct`…，見舊版 changelog）——API 回傳的是單次查詢結果，體積不是問題，可讀性優先。

### 3.4 MAJOR 判定（`isMajor`，取代舊版 generator 端全表預算）

舊版（靜態嵌入）在 generator 執行時一次性掃過全體 40 萬會員算好 `wt:'MAJOR'`。API 版改成**針對本次查詢結果裡出現的相異門號，各自即時算一次**：對結果中每個不重複的 `(MOBILE_head, MOBILE)` 組合，執行 `countDocuments({MOBILE_head, MOBILE})`（靠 §4 的複合索引加速），數量 ≥ `MAJOR_THRESHOLD`（5）即為該組所有帳號標記 `isMajor:true`。

## 4. MongoDB 索引

2026/08/06 新增（執行前已與使用者確認：不影響既有資料，只是額外佔用儲存空間；建立過程對這幾個十萬～百萬筆等級的 collection 可能需要數十秒到數分鐘）：

| Collection | 索引 | 用途 |
|------------|------|------|
| `Qware_MEM_BlackList_202608` | `{MOBILE_head:1, MOBILE:1}` | §3.4 MAJOR 判定的 `countDocuments` 精準查詢 |
| `Qware_MEM_BlackList_202608` | `{USER_ID:1}` | 未來精準查單一帳號用（目前端點皆為部分比對，暫未直接受益） |
| `Qware_MEM_BlackList_202608` | `{MEMO0:1, UPDATE_TIME:-1}` | `/meta` 端點的「近 30 天黑名單數」計數 |
| `QWARE_MEM_IP_202608` | `{user_id:1, CREATE_TIME:-1}` | `/ip-links` 第一步：查該帳號近 30 天登入過的 IP |
| `QWARE_MEM_IP_202608` | `{user_ip:1, CREATE_TIME:-1}` | `/ip-links` 第二步：反查同 IP 底下近 30 天的其他帳號 |
| `Qware_A_OrderTemp_log_202608` | `{order_user_id:1, book_date_time:-1}` | `/bookings` 查該帳號近 7 天訂票紀錄 |

⚠️ **電話／USER_ID 搜尋本身（`/search` 端點）不受這些索引加速**——`includes` 風格的部分字串比對在 MongoDB 對應不加 `^` 錨點的 regex，無法使用索引，仍是全表掃描。使用者已確認接受（見 §2）。

## 5. 前端關鍵組件

### 5.1 查詢模式

沿用 2026/08/06 稍早改版後的二選一設計（電話號碼／USER_ID，互斥，單選標籤 `#modeGroup`），細節不變。**差異只在觸發方式**：改版前是 `oninput` 即時篩選，API 版改成**只有按「套用篩選」才呼叫 API**（避免每敲一碼就打一次 API），輸入框保留 `Enter` 鍵可觸發同等效果。查詢中按鈕顯示 loading 狀態、停用避免重複送出。

### 5.2 預設檢視

頁面載入不自動查詢，維持空白狀態＋提示文字，行為與改版前相同（見底部 changelog）。

### 5.3 結果表格與 IP 關聯查詢

欄位與呈現方式維持不變（USER_ID + MAJOR 標籤／黑名單狀態／MOBILE／CREATE_TIME／CREATE_USER／UPDATE_USER／關聯帳號／訂單紀錄，共 8 欄），差異在於「關聯帳號」「訂單紀錄」按鈕改成點擊時才 `fetch()` 對應端點（`/api/f-blacklist/ip-links`、`/api/f-blacklist/bookings`），modal 開啟前顯示 loading，取得資料後才渲染內容；不像舊版所有帳號的 IP/訂單資料都已經在頁面載入時全部備妥。

### 5.4 IP 白名單保護（前端＋API 雙重）

前端維持既有機制（`api.ipify.org` 查訪客 IP 比對授權清單，不符即整頁換成「存取被拒絕」，`<style>html{visibility:hidden}</style>` 起手式）。**新增**：`f_blacklist_api.js` 每個端點開頭也重新檢查一次來源 IP（讀 `req.headers['x-forwarded-for']`，比對同一份授權清單），不符合直接回 403，不執行任何查詢。理由：本報表含 EMAIL / USER_ID 等會員 PII，一旦查詢邏輯搬到公開可呼叫的 API endpoint，只靠前端檢查會被繞過（直接打 API URL 就能拿到資料），需要伺服器端再擋一次。兩份授權 IP 清單需保持同步（前端 `<head>` 內聯 JS 一份、`f_blacklist_api.js` 一份），修改時務必同步兩邊。

## 6. 相關連結

- 目錄：`HTML_Report_Catalog.html`
- 同架構的既有 API 範例：`stock_api.js`（Vercel serverless function + MongoDB 連線快取寫法）

---
*建立日期：2026/08/04｜使用者需求為「用日期 + USER_ID 查詢 MEMO0='Y' 的黑名單資料」；因全量 85,485 筆嵌入會產生 ~15MB 異常檔案，與使用者確認後改為只嵌入近 90 天，預設檢視為近 3 天*
*2026/08/04：使用者要求日期查詢欄位改用 `UPDATE_TIME`（原為 `CREATE_TIME`），同步修改 generator 查詢條件/排序與頁面篩選邏輯；因 `UPDATE_TIME` 恆 ≥ `CREATE_TIME`，同樣 90 天窗篩到的筆數從 25,272 增至 58,622，檔案從 ~4.6MB 增至 ~10.8MB*
*2026/08/04：使用者要求把 `WINDOW_DAYS` 從 90 縮短為 30，筆數降到 15,651、檔案降到 ~2.9MB*
*2026/08/04：使用者要求查詢欄位從 USER_ID 改成電話號碼；確認 collection 無完整手機號碼欄位（只有 `MOBILE_head` 國碼）後，使用者選擇「改UI就好」——搜尋框改比對 `mobile`（`MOBILE_head`）而非 `uid`，純前端篩選 key 置換，未動 generator/資料結構*
*2026/08/05：新增 IP 關聯查詢功能——移除 EMAIL 欄位／改為預設空白頁面需主動查詢／每列新增「關聯帳號」按鈕，查該帳號近期登入 IP 並反查同 IP 下的其他帳號。過程：使用者一開始要求即時查，但該 collection 103 萬筆無索引、且本報表是公開靜態頁無法安全帶 DB 連線字串做即時查詢，改為 generator 端一次性預算好嵌入；IP 資料時間窗原評估 30 天（會膨脹到 ~5.87MB／總檔案逼近 9MB），使用者要求縮到 7 天（~3.86MB／總檔案 ~6.3MB）；範圍確認為只做目前頁面既有的 ~1.5 萬個黑名單帳號，非全體會員（**此時仍誤判無完整電話號碼欄位，見下一則修正**）*
*2026/08/05：修正電話查詢欄位錯誤——使用者回報查真實號碼（`mobile 94702125`）找不到，追查發現 `Qware_MEM_BlackList_202608` 其實有完整 `MOBILE` 欄位，先前 08/04 建立報表時因 schema 抽樣只挑到 2019～2020 年最早期、還沒有 `MOBILE` 欄位的舊文件，誤判「系統沒有完整電話號碼」，實際搜尋框一直比對的是 `MOBILE_head`（國碼）。已修正 generator 投影與資料結構（`mobile` 改存 `MOBILE` 完整號碼、新增 `mh` 存國碼），頁面 MOBILE 欄改顯示 `+國碼 號碼`，搜尋邏輯不變（仍是 `includes` 部分比對，只是比對對象換成真正的完整號碼）。同時修正文件裡多處錯誤的 collection 總筆數（`countDocuments` 實測 403,408，先前誤植「375 萬」）。查詢範圍仍收斂在頁面既有的黑名單帳號，未擴大到全體會員*
*2026/08/05：電話查詢範圍擴大到全體會員——欄位修好後使用者發現剛才那支號碼對應的帳號其實 `MEMO0:null`（未被標記黑名單），指出「要能先找到資料，不管有沒有在黑名單」。新增全量索引 `ALL_INDEX`（對全表 40 萬餘筆只投影 `USER_ID`/`MOBILE_head`/`MOBILE`/`MEMO0` 四欄，~24.8MB）取代原本只查近 30 天黑名單資料的行為；`applyFilter()` 改為雙模式：有輸入電話 → 查全量索引（忽略日期）、沒輸入 → 查近 30 天黑名單（依日期，原行為不變）。表格新增「黑名單狀態」欄，非黑名單帳號的時間/操作者欄位顯示「—」。整份檔案從 ~6.3MB 增至 **~31MB**，是與使用者確認過的取捨（曾提出縮小範圍/改後端 API 兩個替代方案，使用者選擇直接接受全量嵌入）*
*2026/08/05：使用者要求把「關聯帳號」的 IP 登入紀錄時間窗從 7 天拉長回 30 天；`IP_LINKS` 涵蓋帳號數從 2,608 增至 4,278，整份檔案從 ~31MB 再增至 **~33MB***
*2026/08/05：使用者要求「再查所有帳號有 booking 的紀錄 Qware_A_OrderTemp_log_202608」，一開始詢問後理解為要獨立新報表，做了 `G_MEM_Booking_Accounts_Report.html`（見 `REPORT_SPEC_G_BOOKING_ACCOUNTS.md`）；使用者接著澄清其實是要在 F 報表裡「用電話號碼查出 user_id 後再查其訂單紀錄」，即整合進本報表既有的查詢流程，而非另開報表。新增 `BOOKING_DATA`：測過全量嵌入（不可行）、每帳號筆數上限 cap=10（~48～63MB）兩種方案後，改用使用者提出的「日期窗口」方案——不限筆數，只取近 7 天訂單，實測 ~15.8MB。表格新增「訂單紀錄」按鈕欄，點擊開 modal 顯示該帳號近 7 天訂票明細（演出/座位/時間/IP）。整份檔案從 ~33MB 增至 **~50.5MB**。`G_MEM_Booking_Accounts_Report.html` 予以保留，兩者用途互補（G 是全帳號彙總掃描，F 是查到帳號後的個案深挖），不互相連結。此次 `git push` 首次跳出 GitHub「檔案超過建議 50MB」warning（非硬性拒絕，仍 push 成功）*
*2026/08/06：使用者查 `94702125` 發現 CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER 全是空值，追問「為什麼不顯示？」——查證後這兩筆帳號在 MongoDB 裡其實都有真實值，只是全量索引當初設計成只含 4 個極簡欄位，非黑名單帳號查到後這幾欄只能顯示「—」。使用者不接受這個折衷，要求顯示出來。改把 `ct`/`ut`/`cu`/`uu` 四個欄位加進全量索引每一列，整份檔案從 ~50.5MB 增至 **~85.3MB**，已逼近 GitHub 100MB 硬性上限*
*2026/08/06：三項需求一次交付——① 同門號對應多個 USER_ID 標記 MAJOR：原始需求「出現兩個以上」第一版用閾值 2 實作，跑完發現命中全體會員 78%（這份 collection 本身同門號對應多帳號極常見，非查詢邏輯錯誤），回報使用者後改閾值為 5，命中降到 988 個帳號（0.24%），恢復辨識力；② 移除表格 UPDATE_TIME 顯示欄位，保留日期區間篩選功能不變；③ 新增 USER_ID 查詢，與電話搜尋、日期瀏覽整合為三選一的「查詢模式」單選標籤群——過程中使用者一開始要求電話/USER_ID 兩欄互斥且「輸入時自動清空對方」，接著又要求改成「各自獨立」，追問後釐清其實是要「只能擇一」但不要自動清空、也不要 AND 疊加，最終採用明確的模式選擇器 UI 達成三者互斥。整份報表檔案來到 **~88.5MB**（GitHub 100MB 硬性上限剩約 11.5MB 餘裕）*
*2026/08/06（同日再次調整）：使用者要求「查詢模式不要日期瀏覽，不用日期查詢」——移除當天稍早才做好的「日期瀏覽／電話／USER_ID」三選一模式，拿掉整個日期區間篩選 UI，只留「電話號碼／USER_ID」二選一，預設模式改為電話號碼。檔案維持 **~88.5MB** 量級*
*2026/08/06（同日第三次調整，架構改版）：使用者問「不是資料從 MongoDB 來？為什麼檔案這麼大」，藉機討論後決定放棄靜態嵌入架構，改用專案既有的 Vercel 專案（`report-theta-nine.vercel.app`）新增 `f_blacklist_api.js` 即時查詢 MongoDB，前端改精簡版純 `fetch()`。過程確認：① 全部 4 塊資料都改即時 API（不折衷保留部分嵌入）；② 不保留靜態嵌入版備援，刪除 `generate_f_mem_blacklist_query.js`；③ 為 3 個相關 collection 新增索引加速精準比對查詢（`/ip-links`、`/bookings`、MAJOR 判定），但發現電話/USER_ID 的「任意位置部分字串比對」索引幫不上忙（MongoDB 只有前綴/完全相符才能用索引），使用者確認接受每次搜尋數秒延遲、不改比對規則；④ API 端也加一層 IP 白名單檢查（原本只有前端擋，可被繞過直接打 API）；⑤ 搜尋觸發方式從 `oninput` 即時篩選改成需按「套用篩選」，避免每敲一碼打一次 API。檔案大小從 ~88.5MB 大幅降至 KB 等級（不再嵌入任何會員資料）*
