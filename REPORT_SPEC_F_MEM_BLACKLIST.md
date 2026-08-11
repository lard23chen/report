> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取（內含 EMAIL / USER_ID 等會員 PII）。

# 會員黑名單標記查詢報表 技術規範說明

本文件定義「會員黑名單標記查詢報表」的產出標準，未來更新或重新產出時請遵循本規範。

> ℹ️ **2026/08/07：改回本文件描述的靜態嵌入架構**，2026/08/06 當天短暫改用 Vercel serverless API（`f_blacklist_api.js`）即時查詢，隔天使用者要求「先不用 vercel 了」——理由是 Vercel serverless 沒有固定 outbound IP，而 `QwareAi`（本報表資料庫所在的 Atlas 專案）的 Network Access 不像 `AlexLIFE` 專案那樣開放 `0.0.0.0/0`，導致 API 連線不穩定/連不上。已刪除 `f_blacklist_api.js` 與 `vercel.json` 對應的 build/route 設定，重新執行 `generate_f_mem_blacklist_query.js` 對舊版（含 marker 的）HTML 模板注入最新資料。**目前檔案 ~99.3MB（GitHub 顯示約 94.7MB／94.67 MiB，2026/08/07 新增 webType 欄位後的最新值，見底部 changelog）**，只剩約 5MB 餘裕即撞到 GitHub 100MB（104.86MB／100 MiB）硬性上限——若未來要重新考慮 API 方案，需先確認/開通 `QwareAi` Atlas 專案的 Network Access（見底部 changelog）。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `F_MEM_BlackList_Query_Report.html` |
| 產生腳本 | `generate_f_mem_blacklist_query.js` |
| 資料來源 | MongoDB `QwareAi`（`MONGODB_URI_QWARE`）`Qware_MEM_BlackList_202608` + `QWARE_MEM_IP_202608` + `Qware_A_OrderTemp_log_202608` collections |
| 資料範圍 | 黑名單詳情（BLACKLIST_DATA）：**僅嵌入近 30 天內** `UPDATE_TIME` 且 `MEMO0='Y'` 的資料（見 §2）；電話搜尋索引（ALL_INDEX，2026/08/05 新增）：**涵蓋全部會員**，不分黑名單狀態（見 §2.2）；IP 關聯：**僅嵌入近 30 天登入紀錄**，每組 IP 最多列前 30 個共用帳號（見 §2.1）；訂單紀錄（BOOKING_DATA，2026/08/05 新增）：**僅嵌入近 7 天訂票暫存 log**，不設每帳號筆數上限（見 §2.3） |
| 負責人 | 陳俊良 |
| 主要目的 | 用電話號碼查任一會員（不分是否被標記黑名單）；若該帳號近 30 天內被標記黑名單，額外顯示完整異動紀錄；也可不輸入電話、單純依「異動日期（UPDATE_TIME）」區間瀏覽近期黑名單。並可對單一帳號查詢其近期登入 IP，反查同一 IP 底下是否還有其他帳號（多帳號/共用裝置偵測，見 §4.3）；也可查該帳號近期訂票紀錄（演出/座位/時間/IP），協助判斷是否為搶票機器人（見 §4.3） |

## 2. 為何限制天數範圍（不嵌入全量資料）

> ⚠️ **檔案大小已逼近 GitHub 硬性上限**：截至 2026/08/06 本報表 **~88.5MB**，`git push` 時已跳出「超過建議 50MB」警告（見底部 changelog）。GitHub 對單一檔案的**硬性**上限是 100MB（超過會直接拒絕 push，不像 50MB 只是警告）。目前還有約 11.5MB 餘裕，但這幾天每次新增功能都在往上加：`ALL_INDEX` 全會員化 +25MB（08/05）→ IP 窗口拉長 +2MB（08/05）→ 訂單紀錄 +17MB（08/05）→ `ALL_INDEX` 補齊時間欄位 +35MB（08/06）→ MAJOR 標籤 +3MB（08/06，含資料集自然成長）。**下次若再要對全體 40 萬會員或百萬級 collection 做全量/近全量嵌入，開工前務必先估算大小並確認是否會撞到 100MB**，撞到的話需要改用 Git LFS 或砍掉部分既有嵌入範圍才能繼續 push。

`Qware_MEM_BlackList_202608` 總表逾 40 萬筆（`countDocuments` 實測 403,408，2026/08/05 查證；先前文件誤植「375 萬」，是 2026/08/04 建立當下用了不精確的計數方式），其中 `MEMO0='Y'` 有 58,093～85,485 筆之間浮動（此欄位會隨掃描/複核作業增減，非單調成長）。若整份嵌入靜態頁面，檔案仍會膨脹到 **10MB 以上**，遠超本專案現有報表最大檔案（~500KB 等級），且每次重新產出都會讓 git repo 跟著長大，不符合 `CLAUDE.md` 的容量管理原則。

2026/08/04 與使用者確認後改為：只嵌入最近 `WINDOW_DAYS` 天的 `MEMO0='Y'` 資料，初版為 90 天。當日稍後使用者要求查詢日期改用 `UPDATE_TIME`（而非 `CREATE_TIME`）——因為 `UPDATE_TIME` 恆 ≥ `CREATE_TIME`，同樣 90 天窗篩到的筆數明顯變多（58,622 筆、~10.8MB），使用者接著把窗口縮短為 **30 天**：實測 15,651 筆、檔案 ~2.9MB。**查更早期資料需另行以 MongoDB 查詢，本報表查不到**（頁面 header 有 warning 提示此限制）。

若未來需要查更久遠的歷史資料，選項包括：調大 `generate_f_mem_blacklist_query.js` 裡的 `WINDOW_DAYS` 常數（會讓檔案線性變大，見上面 90 天 vs 30 天的實測對照）、或改用真正的後端 API 即時查詢。

### 2.1 IP 關聯資料為何限制天數、每 IP 最多 30 個帳號

`QWARE_MEM_IP_202608`（`user_id` → `user_ip` 登入紀錄）逾 103 萬筆、無索引，單一 `user_id` 查詢約需 0.7 秒全表掃描。**本報表部署在公開 GitHub Pages 靜態頁面，不能把 MongoDB 連線字串放進前端 JS**（會外洩整個資料庫存取權限），所以「點一下即時查 DB」這條路不可行；改為在 `generate_f_mem_blacklist_query.js` 執行時**一次性**掃過 IP collection、在記憶體建好 `user_id↔user_ip` 雙向對照表，只為當次嵌入的黑名單帳號（近 30 天 `MEMO0='Y'`，約 1.5 萬筆）預先算出 `IP_LINKS`，寫進靜態頁面，瀏覽器端純查表、不連 DB。

- **時間窗**：初版嘗試近 30 天，`IP_LINKS` JSON 高達 ~5.87MB（總檔案逼近 9MB）；使用者當時要求縮到近 7 天，降到 ~3.86MB。**2026/08/05 稍後使用者又要求拉長回 30 天**（見底部 changelog），目前 `IP_WINDOW_DAYS = 30`，實測 `IP_LINKS` 涵蓋 4,278 個帳號（比 7 天窗的 2,608 個多），整份檔案（含 §2.2 的 ALL_INDEX）來到 **~33MB**。
- **共用帳號上限**：實測發現少數 IP 被 2,000＋不相關帳號共用（電信商 CGNAT／公共網路出口，非真實關聯）；每個 IP 仍設 30 筆上限（`IP_LINK_CAP`）避免單一熱門 IP 把檔案撐爆，超過上限時前端會顯示「共 N 個共用帳號，僅顯示前 30 個」。
- **涵蓋範圍**：`IP_LINKS` 只涵蓋近 30 天 `MEMO0='Y'` 的 ~1.5 萬個帳號（同 `BLACKLIST_DATA`），**不含 ALL_INDEX 裡其餘未被標記黑名單的會員**——即使電話搜尋現在能找到任何會員（見 §2.2），非黑名單帳號的「關聯帳號」按鈕一律顯示「無登入紀錄」（因為 `IP_LINKS` 裡沒有這個 uid 的 key）。把 `IP_LINKS` 也擴大到全體會員在技術上可行，但代價會跟 §2.2 的 ALL_INDEX 疊加，目前未做，如有需要需另行評估。

### 2.2 電話搜尋為何能查全部會員（ALL_INDEX，2026/08/05 新增）

2026/08/05 使用者要求「不管有沒有在黑名單都要能查到」。原本 `BLACKLIST_DATA` 只收近 30 天 `MEMO0='Y'` 的 ~1.5 萬筆，查不到的帳號不代表電話錯誤，只是不在這個窗口內。解法是新增一份**獨立、極簡欄位**的全量索引 `ALL_INDEX`：對 `Qware_MEM_BlackList_202608` 全表（40 萬餘筆，不加 `MEMO0`/`UPDATE_TIME` 篩選）只投影 `USER_ID`、`MOBILE_head`、`MOBILE`、`MEMO0` 四個欄位，實測 403,350 筆有 `MOBILE` 值、JSON 序列化後 **~24.8MB**。

- 這讓整份報表檔案從 ~6.3MB 跳到 **~31MB**，是本專案目前最大的報表檔案（其他報表多在 500KB 以下），且每次重新產出都會讓 git repo 再增加 ~25MB。這個取捨已與使用者確認：比起另外架設安全的查詢 API（見 §2.1 的「不能把連線字串放進前端」限制，同樣適用於全會員查詢），純前端嵌入索引是唯一不需要新基礎設施就能達成「查全部會員」的做法，使用者選擇接受檔案變大。
- `ALL_INDEX`（2026/08/06 起含完整欄位，見 §3.3）電話搜尋到的任何帳號都有完整 CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER，「黑名單狀態」欄顯示 `MEMO0` 原始值（`Y`/`N`/`4`/`未標記`）；但「關聯帳號」（`IP_LINKS`，見 §2.1）與「訂單紀錄」（`BOOKING_DATA`，見 §2.3）範圍仍只涵蓋近 30 天黑名單帳號／近 7 天有訂票紀錄的帳號，不在範圍內一律顯示「無登入紀錄」／「無訂單紀錄」。這是這兩項功能各自獨立的資料範圍限制，不是查詢錯誤。
- generator 對全表做一次 `find({})`（無索引、全表掃描）取回 40 萬餘筆，實測約 8～9 秒，屬於一次性成本、可接受。

### 2.3 訂單紀錄（BOOKING_DATA）為何限制 7 天、不逐帳號設筆數上限

2026/08/05 使用者要求「顯示用電話號碼查出的 user_id 後再查其訂單紀錄資料」——一開始曾單獨新建 `G_MEM_Booking_Accounts_Report.html`（見 `REPORT_SPEC_G_BOOKING_ACCOUNTS.md`）作為獨立報表，使用者後續澄清其實是要**整合進本報表**：查完電話找到帳號後，直接在同一頁查該帳號的訂單紀錄，不要另開報表。

資料源 `Qware_A_OrderTemp_log_202608`（訂票暫存 log，`order_user_id`/`performance_id`/`order_seat`/`book_date_time`/`order_user_ip`）全表 1,236,905 筆、無索引，資料期間僅 ~2 個月（collection 本身不留更久）。實測過三種方案：

| 方案 | 結果 |
|------|------|
| 全表逐筆嵌入（139,781 個帳號，各自全部訂單） | 不可行，遠超合理範圍（座位欄位是中文字串，體積大） |
| 每帳號筆數上限（cap=10，含座位欄位） | ~63MB；不含座位欄位仍要 ~48MB |
| **改用日期窗口**（近 7 天，不限筆數，使用者拍板方案） | **~15.8MB**，178,240 筆訂單、29,314 個帳號有資料 |

**採用日期窗口方案**：`BOOKING_WINDOW_DAYS = 7`，以 collection 裡 `book_date_time` 的**最大值**為錨點（而非日曆今天，同 §2.1 IP_LINKS 錨點設計），只取最近 7 天的訂單，每個帳號的訂單筆數不設上限（活動異常密集的帳號，例如近 7 天內同一 IP 反覆訂同一場同一批座位數十次，這種訊號本身就是重點，不應該被截斷隱藏）。整份報表檔案因此從 ~33MB 增至 **~50.5MB**，是與使用者確認過的取捨。

`G_MEM_Booking_Accounts_Report.html` 予以保留（彙總全部 139,781 個帳號的訂票統計，涵蓋範圍比 F 報表的 7 天窗更廣），兩份報表資料源相同但用途不同：G 是「哪些帳號訂票最異常」的總覽掃描，F 的訂單紀錄查詢是「查到特定帳號後看他最近訂了什麼」的個案深挖，彼此不互相連結。

## 3. 資料結構

### 3.1 BLACKLIST_DATA 陣列格式（generator 注入，短欄位名以縮小檔案）

```js
{
  uid:    "32395977337438732472",   // USER_ID
  mh:     "81",                     // MOBILE_head（國碼）
  mobile: "09018071105",            // MOBILE（完整電話號碼，2026/08/05 起改用此欄位查詢，見 §4.1）
  ct:     "2026-04-13 14:09:29",    // CREATE_TIME，已轉換為台北時間（+08:00）字串 "YYYY-MM-DD HH:mm:ss"
  ut:     "2026-06-22 09:21:19",    // UPDATE_TIME，同上格式
  cu:     "定期掃描異常帳號",         // CREATE_USER（可能是數字 ID 或掃描系統代稱）
  uu:     "775995263",              // UPDATE_USER
  wt:     "MAJOR",                  // （2026/08/06 新增，選填）同門號對應 5+ 個不同 USER_ID 時才有此欄位，見 §4.4
}
```

⚠️ 2026/08/05 起不再含 `email` 欄位（原 EMAIL，已從資料與表格移除，見 §4.1／changelog）。

### 3.2 DATA_META 物件格式（generator 注入）

```js
{ total: 15137, minDate: "2026-07-06", maxDate: "2026-08-04", ipWindowDays: 30, ipLinkCap: 30, allIndexTotal: 403350, bookingWindowDays: 7 }
```

- `minDate` / `maxDate`：本次嵌入資料中實際存在的 `UPDATE_TIME` 日期範圍（依台北時間），用於 flatpickr 的 `minDate`/`maxDate` 限制與「N天前」按鈕的錨點
- **錨點設計與 E 系統月報/漏斗報表相同**：quick range 以 `maxDate`（資料集裡最後一天）為錨點，而非日曆今天，避免 generator 執行當下資料還沒同步到今天時選到空日
- `ipWindowDays` / `ipLinkCap`：IP 關聯資料的時間窗（天）與每 IP 共用帳號上限，供前端 modal 標題與提示文字使用（見 §4.3、§2.1）
- `allIndexTotal`：`ALL_INDEX` 的筆數（見 §3.3），顯示於 header「📇 電話可查全部會員：N 筆」
- `bookingWindowDays`：訂單紀錄的時間窗（天），供 `openBookingModal()` 標題文字使用（見 §3.5、§2.3）

### 3.3 ALL_INDEX 陣列格式（generator 注入，2026/08/05 新增，見 §2.2；2026/08/06 加寬為含完整欄位）

```js
[
  {
    u: "32322139317825347177",   // USER_ID
    h: "852",                    // MOBILE_head（國碼）
    m: "94702125",                // MOBILE（完整電話號碼）
    f: null,                      // MEMO0 原始值（'Y'/'N'/'4'/null）
    ct: "2023-10-03 16:41:15",   // CREATE_TIME（台北時間）
    ut: "2026-08-03 18:52:53",   // UPDATE_TIME（台北時間）
    cu: "定260804解",             // CREATE_USER
    uu: "464939254",              // UPDATE_USER
    wt: "MAJOR",                   // （2026/08/06 新增，選填）見 §4.4
    wty: "APPLE",                  // （2026/08/07 新增）MongoDB `webType` 原始值，見 §4.6
  },
  // … 全部 40 萬餘筆會員
]
```

電話搜尋（`applyFilter()`）直接對這個陣列做 `m.includes(kw)`，找到的每一列**自帶完整欄位**，不需要再去 `BLACKLIST_DATA` 補資料。

### 3.3a wty（webType，2026/08/07 新增）

`Qware_MEM_BlackList_202608` 的 `webType` 欄位（注意是 camelCase，不是 `WEB_TYPE`）——**全體 41.3 萬筆都有值**，實測 6 種：`APPLE` / `FB` / `GOOGLE` / `LINE` / `MAJOR` / `OP`（分布約 MAJOR 46%／OP 25%／GOOGLE 19%／LINE 7%／APPLE 3%／FB <1%，2026/08/07 實測）。研判是會員的登入/註冊管道，但 `OP` 與 `MAJOR` 兩個值的確切業務意義未經業主證實，只如實顯示原始值，不臆測命名。`BLACKLIST_DATA`（近 30 天黑名單）與 `ALL_INDEX`（全體會員）兩個陣列都帶 `wty`，短欄位名沿用專案慣例。

⚠️ **與既有 `wt:'MAJOR'` 標籤（§4.4）撞名，但語意完全無關**：`wt` 是本報表自行計算的「同門號對應 5+ 個 USER_ID」旗標；`wty` 的 `'MAJOR'` 是 MongoDB 原始欄位值之一，只是恰好也叫這個字串，資料庫端沒說明其涵義。前端刻意用不同顏色（`wt` 紫色 pill vs. `wty` 橘色徽章）與不同圖示區隔，`hdr-note` 也加註說明，避免使用者誤以為兩者相關。

⚠️ **2026/08/06 欄位擴充**：`ALL_INDEX` 原本只有 `u`/`h`/`m`/`f` 4 個極簡欄位（刻意不含時間戳記以控制檔案大小），沒收錄的帳號查到後 CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER 一律顯示「—」。使用者查 `94702125` 發現這幾欄空白後追問「為什麼不顯示？」——實際上 MongoDB 裡這些帳號都有真實值，只是 generator 沒抓。改成每列直接帶上 `ct`/`ut`/`cu`/`uu`（等同把原本只給 `BLACKLIST_DATA`（近 30 天 `MEMO0='Y'`）的完整欄位，擴大到全部 40 萬會員都有），`ALL_INDEX` 從 ~24.8MB 增至 **~58.6MB**，整份報表檔案從 ~50.5MB 增至 **~85.3MB**。`BLACKLIST_DATA` 維持不變、繼续作為「黑名單瀏覽」日期篩選模式的資料源（見 §4.1），兩者對同一批黑名單帳號的欄位內容會重複，但保留是為了不動到既有日期篩選邏輯、降低改動風險。

### 3.4 IP_LINKS 物件格式（generator 注入，2026/08/05 新增）

```js
{
  "32395977337438732472": [   // key = 黑名單帳號 uid
    {
      ip: "104.28.83.101",
      t: "2026-08-04 21:39:13",       // 該帳號在此 IP 的最後登入時間（台北時間）
      totalOthers: 47,                // 此 IP 近 7 天內的其他帳號總數（不含自己）
      related: [                      // 前 IP_LINK_CAP（30）個，依最後登入時間新到舊
        { uid: "26585652857736531458", t: "2026-08-04 20:10:02" },
        // …
      ]
    },
    // 該帳號近 7 天內用過的其他 IP…
  ]
}
```

- 只有 `BLACKLIST_DATA` 裡、且近 7 天內有登入紀錄的帳號才會出現在 `IP_LINKS` 裡（key 不存在 = 該帳號查無登入紀錄，前端顯示「🔗 無登入紀錄」）
- `totalOthers > related.length` 時代表被 `IP_LINK_CAP` 截斷，前端顯示「共 N 個共用帳號，僅顯示前 30 個」

### 3.5 BOOKING_DATA 物件格式（generator 注入，2026/08/05 新增，見 §2.3）

```js
{
  "71543683776686754235": [   // key = order_user_id
    { pid: "B0BC63P7", seat: "VIP9區-33排-34號", t: "2026-07-30 20:34:07", ip: "36.229.168.189" },
    { pid: "B0BC63P7", seat: "VIP9區-33排-32號", t: "2026-07-30 20:34:07", ip: "36.229.168.189" },
    // … 該帳號近 7 天內所有訂票紀錄，依 book_date_time 新到舊排序，不設筆數上限
  ]
}
```

- `pid`：`performance_id`；`seat`：`order_seat`（座位描述，中文字串）；`t`：`book_date_time`（台北時間）；`ip`：`order_user_ip`
- **key 不限於 `BLACKLIST_DATA`／`ALL_INDEX` 裡的帳號**——只要近 7 天內有訂票紀錄就會出現在 `BOOKING_DATA`，即使該 `order_user_id` 不在會員黑名單 collection 裡也一樣（兩個 collection 的帳號集合不完全重疊，見 §2.3 表格底下說明）
- 不設每帳號筆數上限：同一帳號短時間內大量重複訂同一場同一批座位，這種模式本身是重點訊號，不應被截斷隱藏

### 3.6 Section Marker（Generator 注入點）

```
// ── Data Start ──────────────────────────────────────────────────────────────
const BLACKLIST_DATA = […];
const DATA_META = {…};
const IP_LINKS = {…};
const ALL_INDEX = […];
const BOOKING_DATA = {…};
// ── Data End ────────────────────────────────────────────────────────────────
```

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。`<span id="updateTimeLabel">…</span>` 由 generator 以 regex 整段替換為執行當下時間。

## 4. 關鍵組件

### 4.1 查詢模式（2026/08/06 改版：兩選一，日期瀏覽模式已移除）

篩選列有「查詢模式」單選標籤群（`#modeGroup`，`setQueryMode(mode)`），二選一：`mobile`（電話號碼，預設）、`userid`（USER_ID）。兩者互斥，同一時間只有選中模式對應的輸入框可用（`disabled` 灰階，非選中模式的輸入框即使殘留舊文字也不會被查詢邏輯讀取）。皆查詢 `ALL_INDEX`（見 §3.3，全部 40 萬餘筆會員，不分黑名單狀態），`includes` 部分字串比對，即時篩選（`oninput`）；找到的帳號直接使用 `ALL_INDEX` 該列自帶的 `ct`/`ut`/`cu`/`uu`（見 §3.3），全部 40 萬會員都是完整資料，不顯示「—」佔位。

- 電話搜尋比對 `mobile`（`MOBILE` 完整電話號碼欄位，**不含國碼**）；USER_ID 搜尋比對 `uid`（`USER_ID`）
- 曾經歷過三版設計：① 最初（2026/08/05）靠「電話輸入框是否有值」自動判斷雙模式；② 2026/08/06 新增 USER_ID 查詢時一度做成「日期瀏覽／電話／USER_ID」三選一模式選擇器，日期瀏覽模式查 `BLACKLIST_DATA`（近 30 天 `MEMO0='Y'`，依 `UPDATE_TIME` 篩選，搭配 flatpickr 日期區間與 1/3/7 天前快速按鈕）；③ 同日使用者接著要求「查詢模式不要日期瀏覽，不用日期查詢」，移除整個日期瀏覽模式與其 UI（flatpickr 區塊、快速按鈕、CDN 引用），只留電話／USER_ID 兩種模式，預設模式改為 `mobile`
- `BLACKLIST_DATA`（見 §3.1）自 ③ 版起**不再被前端查詢邏輯讀取**，但 generator 內部仍需要它來算 `IP_LINKS` 的帳號範圍（見 §2.1），故資料仍照常嵌入頁面，只是沒有對應的查詢入口

⚠️ **欄位史誤（2026/08/04→08/05 修正）**：2026/08/04 建立本報表時，第一次查 schema 只抽樣到 collection 裡最早期（2019～2020 年）的幾筆文件，剛好都沒有 `MOBILE` 欄位（該欄位是後來才加進 schema 的），因而誤判「collection 裡沒有完整手機號碼欄位」，搜尋框當時比對的其實是 `MOBILE_head`（只有國碼，如 `852`、`886`）。使用者 2026/08/05 實際查號碼查不到（`mobile 94702125`）後回報，才發現 `MOBILE` 欄位其實存在、且在 `MEMO0='Y'` 的記錄裡幾乎 100% 有值。已修正 generator 與頁面改用 `MOBILE`（完整號碼）查詢，`MOBILE_head`（國碼）仍保留在 `mh` 欄位、顯示於表格 MOBILE 欄位前綴（如 `+81 09018071105`）。
⚠️ **範圍史誤（同日修正）**：欄位修正後，使用者接著指出「查一個真實存在但未被標記黑名單的號碼」仍然查不到——當時電話搜尋還只對 `BLACKLIST_DATA`（近 30 天黑名單）做，範圍本來就不含一般會員。使用者要求「不管有沒有在黑名單都要能先找到資料」，因此新增 §2.2 的 `ALL_INDEX` 把電話搜尋範圍擴大到全體會員，此限制已解除。
⚠️ **時間欄位史誤（2026/08/06 修正）**：範圍擴大後，非黑名單帳號的 CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER 仍顯示「—」——因為當時 `ALL_INDEX` 只有 4 個極簡欄位，這幾項只靠反查 `BLACKLIST_DATA` 補，補不到就留空。使用者查 `94702125` 看到空白後追問「為什麼不顯示？」，才發現 MongoDB 裡這些帳號其實都有真實值，只是沒被抓進 `ALL_INDEX`。已將 `ALL_INDEX` 擴充為含完整欄位（見 §3.3），此限制已解除，代價是整份檔案再增加 ~35MB（~50.5MB → ~85.3MB）。

### 4.2 預設檢視

⚠️ **2026/08/05 起頁面載入不再自動顯示任何資料**，改為空白狀態＋提示文字「請選擇查詢模式並輸入電話號碼或 USER_ID 後按『套用篩選』查詢」。使用者需主動輸入電話號碼或 USER_ID，才會觸發查詢並顯示表格（會設定內部 `hasSearched` 旗標）。「重置」會清空兩個搜尋框、切回預設的 `mobile` 模式，並把畫面帶回未查詢的空白狀態。

**原因**：此頁定位從「瀏覽近期黑名單列表」轉為「先用電話或 USER_ID 查到主帳號、再逐筆查其 IP 關聯」的查案流程（見 §4.3），使用者不希望一進頁面就看到一大串未經篩選的資料。

### 4.3 結果表格與 IP 關聯查詢

欄位：USER_ID（同門號對應 5+ 個 USER_ID 時旁邊帶紫色「MAJOR」標籤，見 §4.4）、**黑名單狀態**、MOBILE（顯示為 `+國碼 電話號碼`，如 `+81 09018071105`）、**登入來源**（2026/08/07 新增，見 §4.6）、CREATE_TIME、CREATE_USER、UPDATE_USER、**關聯帳號**、**訂單紀錄**，共 9 欄（UPDATE_TIME 欄已於 2026/08/06 移除，見下）。EMAIL 欄位已移除，見 §3.1。點前 7 欄 header 可排序（`sortTable()`）；最後兩欄（關聯帳號／訂單紀錄）是操作按鈕，不可排序。表格上方顯示「符合條件：N 筆」。

⚠️ **UPDATE_TIME 欄位移除（2026/08/06）**：**僅移除表格顯示欄位**與其排序功能，`ALL_INDEX`/`BLACKLIST_DATA` 資料本身仍保留 `ut` 欄位供內部排序（依 `ut` 新到舊）使用，只是不再顯示成表格欄位、也沒有對應的日期篩選 UI（見 §4.1）。

**黑名單狀態欄**：因搜尋涵蓋全體會員（見 §2.2），同一張表格可能同時出現黑名單與非黑名單帳號，需要一眼分辨。以 `memoBadge()` 依 `memo0` 值渲染徽章：`Y` → 紅色「黑名單」、`null` → 灰色「未標記」、其他值（如 `4`）→ 琥珀色原樣顯示。CREATE_TIME/CREATE_USER/UPDATE_USER 對搜尋到的任何帳號都是完整資料（2026/08/06 起，見 §3.3），不再有「—」佔位的情況。

**CREATE_USER 異常值標記（2026/08/11 新增）**：`定期掃描異常帳號` 是這個欄位唯一預期的「系統自動」值（代表帳號是定期掃描程式標記的，見 §3.1 範例）；只要 `cu` 有值但**不是**這個字串（例如一串數字 ID），代表這筆是人工或其他來源建立，`createUserCell()` 會把它標成紅字並在後面加註「⚠️ 請IT確認」，提示需要跟 IT 確認來源。`cu` 為空時仍照舊顯示「—」。這是純前端顯示邏輯（比對 `r.cu` 字串），資料本身（`ALL_INDEX`/`BLACKLIST_DATA` 的 `cu` 欄位）不受影響，`generate_f_mem_blacklist_query.js` 不需要跟著修改。

**CREATE_USER 為「定期掃描異常帳號」時的封鎖建議（2026/08/11 新增）**：這種「系統自動標記」的帳號不再只顯示原字串，改用 `ipBlockAdvice(uid)` 依 §4.3 已有的「關聯帳號」IP 資料算出一個建議：

- 對該帳號 `IP_LINKS[uid]` 裡的**每一個** IP，用 `sameDayCount()` 算「主帳號在該 IP 的最後登入日期」與「`related`（共用此 IP 的其他帳號）裡日期相同的筆數」，取所有 IP 中**最高**的那個數字（`Math.max`，任一 IP 濃度夠高就算數，不用全部 IP 都高）
- **≥ `IP_SAME_DAY_BLOCK_THRESHOLD`（10）** → 紅字「(保持封鎖)」；**< 10（含完全沒有共用紀錄、或該帳號沒有 `IP_LINKS` 資料）** → 紅字「(可解封鎖)」；唯一例外是**完全沒有 `IP_LINKS[uid]` 這個 key**（沒有任何近 30 天登入紀錄）時兩種建議都不顯示，只印原字串「定期掃描異常帳號」——沒有登入資料就沒有依據下建議，不要求前端硬猜
- ⚠️ **這是近似值，不是精確的「當天逐筆登入」查詢**：`related` 裡每個共用帳號只保留「最後一次登入該 IP 的時間」，不是完整登入紀錄。如果某個共用帳號在同一天內有更早的登入、但最後一次落在別的日子，這裡會漏算，實際同日共用數可能比顯示的更高（只會低估，不會高估）。之所以用這個近似算法而非讓 generator 重新查 `QWARE_MEM_IP_202608` 做精確日級分組，是因為本檔案已逼近 GitHub 100MB 硬性上限（見 §2 開頭警語），精確計算需要新增一塊資料、有撞到上限的風險，經與使用者確認後選擇「用既有資料近似計算，不改 generator」。滑鼠 hover 到「(保持封鎖)」/「(可解封鎖)」文字上會顯示 tooltip：「同日共用此 IP 的其他帳號約 N 筆（近似值，見規範文件）」
- 閾值 10 對應使用者原始需求「約10筆以上」（保持封鎖）與「約10筆以下」（可解封鎖）在剛好等於 10 時的重疊；本規範採 `>= 10` 算保持封鎖、`< 10` 算可解封鎖，10 本身歸類為「大量」

**關聯帳號欄**：每列一顆按鈕，文字依 `IP_LINKS[uid]` 是否存在顯示「🔗 IP關聯 (N)」（N = 近 30 天內用過的相異 IP 數）或「🔗 無登入紀錄」。點擊呼叫 `openIPModal(uid)` 開啟 modal（`#ipModal`），依序列出：

1. 該帳號近 30 天用過的每個 IP（`entry.ip`）與該 IP 上的最後登入時間（`entry.t`）
2. 該 IP 底下的其他帳號（`entry.related`，最多 30 筆，依最後登入時間新到舊）與各自最後登入時間；若無其他帳號顯示「此 IP 近30天內查無其他帳號」
3. 若 `totalOthers > related.length`，額外顯示「共 N 個共用帳號，僅顯示前 30 個」截斷提示

這是查案用的「反查關聯帳號」功能：先用電話號碼或 USER_ID 在表格裡找到主帳號（不分黑名單狀態，見 §2.2） → 點「關聯帳號」看它近期用過哪些 IP → 再看同一 IP 底下還有哪些其他帳號，用來抓同一人／同一裝置註冊多個帳號規避黑名單的狀況。**只有近 30 天 `MEMO0='Y'` 的帳號才有 `IP_LINKS` 資料**，非黑名單帳號一律顯示「無登入紀錄」（見 §2.1）。

**訂單紀錄欄**：每列一顆按鈕，文字依 `BOOKING_DATA[uid]` 是否存在顯示「🎫 訂單 (N)」（N = 近 7 天內訂票筆數）或「🎫 無訂單紀錄」。點擊呼叫 `openBookingModal(uid)` 開啟另一個 modal（`#bookModal`），列出該帳號近 7 天所有訂票紀錄（演出代碼、座位、訂票時間、訂票 IP），依時間新到舊排序，**不設筆數上限**（見 §2.3——同一帳號短時間內重複訂同一批座位是重點訊號，不應截斷）。此功能查詢範圍不限於 `BLACKLIST_DATA`／`IP_LINKS`，`BOOKING_DATA` 的 key 只要近 7 天有訂票紀錄就存在，即使該帳號不在會員黑名單 collection 裡也一樣。

**同日訂單量異常提示（2026/08/11 新增）**：按鈕旁若該帳號**單一日期**的訂單筆數超過 `BOOKING_SAME_DAY_ALERT_THRESHOLD`（10，嚴格大於，11 筆才觸發），額外顯示紅字「⚠️ 通知IT確認」，提示短時間內大量下單、疑似搶票機器人。`maxSameDayBookingCount(uid)` 把 `BOOKING_DATA[uid]` 依 `t` 的日期部分（`YYYY-MM-DD`）分桶計數，取所有日期中最多的那天；因為 `BOOKING_DATA` 本身已是近 7 天內全部逐筆訂單、不設上限（見上段），這個計算是**精確值**，不像 §4.3 CREATE_USER 的封鎖建議那樣需要近似估計。沒有訂單紀錄或所有日期都在門檻以下時不顯示任何提示（維持原本按鈕文字）。

### 4.3a 頁面內規則說明區（2026/08/11 新增）

表格正下方（`</main>` 之前）新增一個「🚩 標記規則說明」卡片，把 §4.3 CREATE_USER 兩種紅字提示（⚠️ 請IT確認／(保持封鎖)／(可解封鎖)）與同日訂單量提示（⚠️ 通知IT確認）各用一行文字說明，並直接沿用 `.cu-flag` 樣式渲染範例 badge，讓看報表的人不用回頭問「這個紅字是什麼意思」。純靜態 HTML，寫在 Data marker 區塊外面，不受 generator 每日重新產出影響，未來新增規則需要手動同步補這個區塊。

### 4.4 MAJOR 標籤（同門號對應多個 USER_ID，2026/08/06 新增）

Generator 端計算：以 `MOBILE_head + MOBILE`（國碼+完整號碼）為 key，對全體 `ALL_INDEX`（40 萬餘會員）分組，找出同一門號對應 `MAJOR_THRESHOLD` 個以上不同 `USER_ID` 的帳號，一律標記 `wt: 'MAJOR'`（欄位省略＝非 MAJOR，節省檔案大小）。`BLACKLIST_DATA` 裡的對應帳號也同步標記（用同一份 `majorUids` 查表，雖然 §4.1 提到 `BLACKLIST_DATA` 已無查詢入口，但保留標記以防未來重新啟用）。前端在結果表格 USER_ID 欄位文字旁加一個小紫色「MAJOR」標籤（不佔額外欄位）。

⚠️ **閾值史誤（2026/08/06 當場修正）**：使用者原始需求是「出現兩個以上」，第一版用 `MAJOR_THRESHOLD = 2` 實作、跑完 generator 後發現全體 40.9 萬會員裡有 **31.8 萬個（78%）** 被標記 MAJOR——24.6 萬組門號裡有 15.6 萬組（63%）本身就對到 2 個以上不同 USER_ID，這是這份 collection 的真實資料型態（抽查命中最多的 15 組，每組普遍對到 5～6 個不同帳號），不是查詢邏輯錯誤。因為命中率太高、完全失去「標出可疑主帳號」的辨識力，回報使用者後改成 `MAJOR_THRESHOLD = 5`（同門號對應 5 個以上不同 USER_ID 才標記），重跑後命中 **988 個帳號（0.24%）**，符合預期的稀有度。**如需調整敏感度，改 `generate_f_mem_blacklist_query.js` 裡的 `MAJOR_THRESHOLD` 常數即可**，未來若改動請同步更新本節數字。

### 4.5 IP 白名單保護

比照 E 系統報表機制（`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。本報表因含 EMAIL / USER_ID 等會員 PII，**建立時就內建此保護**，不是事後補上。清單為手動維護的靜態內容，`generate_f_mem_blacklist_query.js` 只用 marker 區塊替換資料、不會動到 `<head>`。

### 4.6 登入來源欄位（webType，2026/08/07 新增）

顯示 `r.webtype`（來自 `ALL_INDEX`/`BLACKLIST_DATA` 的 `wty`，見 §3.3a）。`webTypeBadge()` 依原始值渲染不同顏色徽章：🍎 Apple（灰）、📘 Facebook（Facebook 藍）、🔍 Google（紅）、💬 LINE（LINE 綠）、⭐ MAJOR（琥珀色）、OP（灰，原樣顯示，無 icon）；未知值 fallback 顯示原字串（灰底），為將來 `webType` 若新增其他值預留。可點欄位 header 排序（`sortTable('webtype')`）。

⚠️ **與 §4.4 的紫色「MAJOR」標籤刻意用不同顏色/圖示區隔**（本欄琥珀色 ⭐，§4.4 是紫色 pill），因為 `webType` 剛好也有一個值叫 `MAJOR`，但這是資料庫欄位值的巧合，跟本報表算出的「同門號 5+ 帳號」旗標完全是两回事，語意無關。`hdr-note` 也加了對應提示文字。

### 4.7 已知效能限制（非本次改動引入，2026/08/07 測試時發現）

`applyFilter()` 綁在 `oninput`，每敲一個字元就對 41.3 萬筆 `ALL_INDEX` 做一次 `filter+map+sort` 並整批塞進 `renderTable()`，**沒有最短字元數門檻、也沒有渲染筆數上限**。若使用者從空白開始逐字輸入（例如打「0918...」的過程中，單一字元「0」就可能比對到數十萬筆電話號碼含有「0」），中間任一步驟若命中筆數過大，會嘗試建立巨量 `<tr>` DOM 節點，實測會讓分頁/瀏覽器分頁明顯卡死數十秒甚至更久（2026/08/07 用 Claude in Chrome 自動化測試時重現：逐字輸入「0918」在第一個字元就使分頁失去回應，需等待或強制關閉分頁）。**目前無已知因這個問題被回報過的實際使用者投訴**，暫列為已知限制而非立即修復項目；若未來要處理，選項包括：① 設定最短查詢字元數（如 4 碼以上才觸發搜尋）、② 對 `renderTable()` 顯示筆數設上限（如超過 200 筆只顯示前 200 並提示「請輸入更精確的號碼」）、③ 把 `oninput` 改回§4.1 修訂前的「按套用篩選才查」模式（但那樣會改變目前逐字即時篩選的既有使用體驗，需與使用者確認是否要犧牲）。

## 5. MongoDB 連線資訊

| 用途 | Cluster URI | DB | Collection | 篩選 |
|------|-------------|-------|------------|------|
| 近 30 天黑名單資料 | `MONGODB_URI_QWARE` | `QwareAi` | `Qware_MEM_BlackList_202608` | `MEMO0:"Y"`, `UPDATE_TIME >= now - 30天` |
| 全會員電話索引（ALL_INDEX） | `MONGODB_URI_QWARE` | `QwareAi` | `Qware_MEM_BlackList_202608` | 無篩選，全表 `find({})` 只投影 4 欄位（見 §2.2） |
| 近 30 天登入 IP 資料 | `MONGODB_URI_QWARE` | `QwareAi` | `QWARE_MEM_IP_202608` | `CREATE_TIME >= now - 30天`（不篩 user_id，一次抓回全部再於記憶體建對照表，見 §2.1） |
| 近 7 天訂單紀錄（BOOKING_DATA） | `MONGODB_URI_QWARE` | `QwareAi` | `Qware_A_OrderTemp_log_202608` | `book_date_time >= 該表最新一筆時間 - 7天`（不篩 user，一次抓回全部再於記憶體依帳號分組，見 §2.3） |

`Qware_MEM_BlackList_202608` 主要欄位：`USER_ID`、`EMAIL`（本報表已不使用）、`MOBILE_head`（國碼）、`MOBILE`（完整電話號碼，本報表查詢用此欄位，見 §4.1）、`CREATE_TIME`、`UPDATE_TIME`、`CREATE_USER`、`UPDATE_USER`、`MEMO0`（`Y`/`N`/`4`/`null`，只有 `Y` 才是本報表要查的黑名單標記）。collection 只有 `_id` 索引，全表 40 萬餘筆，`find()` 前務必先用 `MEMO0`+`UPDATE_TIME` 縮小範圍，避免全表掃描。

`QWARE_MEM_IP_202608` 欄位：`user_id`、`user_ip`、`CREATE_TIME`（登入時間）。同樣只有 `_id` 索引，全表 103 萬筆＋單一 `user_id` 查詢約 0.7 秒；本報表**不對此 collection 逐帳號查詢**，而是用 `CREATE_TIME` 範圍一次抓回整批（30 天窗約 50 萬筆）再於 Node 記憶體建雙向對照表，細節與取捨見 §2.1。

`Qware_A_OrderTemp_log_202608` 欄位：`order_user_id`、`performance_id`、`performance_price_area_id`、`order_seat`、`book_date_time`、`order_user_ip`。只有 `_id` 索引，全表 1,236,905 筆、資料期間僅 ~2 個月（collection 本身不留更久）；本報表用 `book_date_time` 範圍一次抓回整批（7 天窗約 17.8 萬筆）再依 `order_user_id` 分組，細節與取捨見 §2.3。**注意有另一個大小寫幾乎相同的 collection `QWARE_A_OrderTemp_log_202608`（371 萬筆），本報表固定使用開頭小寫的 `Qware_A_OrderTemp_log_202608`**，重跑 generator 前請確認沒有誤植。

## 6. 更新方式

```bash
node generate_f_mem_blacklist_query.js
git add F_MEM_BlackList_Query_Report.html generate_f_mem_blacklist_query.js
git commit -m "Update F blacklist query report"
git push origin main
```

**已排入 S1 每日排程（2026/08/11 起）**：`daily_update.bat` 每日 08:00 自動執行 `generate_f_mem_blacklist_query.js`（緊接在 `generate_e_dmp_funnel_report.js` 之後），30 天滾動窗自動往前移，不需要再手動重跑。實測單次執行（查 4 個 collection：黑名單近 30 天+全表 ALL_INDEX、IP 登入近 30 天、訂單近 7 天）約 1 分鐘內完成，可接受排進每日排程。⚠️ 在此之前本報表定位是「純手動報表，不排程」（見下方 changelog），2026/08/11 使用者要求改為排入 S1，需求異動已同步進 `HTML_Report_Catalog.html` 的 S1 列與本報表列。

**同步至 NewReport（使用者實際瀏覽的站台）**：`F_MEM_BlackList_Query_Report.html` 已加入 `daily_update.bat` 的 `SYNC_FILES`，隨每日排程自動 copy 進 `D:\2025\AI\NewReport` 並 commit + push 到 `origin`、`company` 兩個 remote，不再需要手動同步。

⚠️ **檔案大小仍逼近 GitHub 100MB 硬性上限**（見 §2 開頭警語，目前 ~93.7MB，只剩 ~6MB 餘裕）——排入每日自動 push 後，如果資料量持續成長導致某天檔案超過 100MB，`git push` 會直接失敗；`daily_update.bat` 對單一 script/push 失敗採 best-effort（記錄後繼續其他報表，最後統一發 LINE ⚠ 失敗告警），所以不會讓其他報表的每日更新連帶失敗，但這份報表本身會停止更新直到有人處理（拆分報表／改用 Git LFS／評估後端 API 方案）。

## 7. 相關連結

- 目錄：`HTML_Report_Catalog.html`

---
*建立日期：2026/08/04｜使用者需求為「用日期 + USER_ID 查詢 MEMO0='Y' 的黑名單資料」；因全量 85,485 筆嵌入會產生 ~15MB 異常檔案，與使用者確認後改為只嵌入近 90 天，預設檢視為近 3 天*
*2026/08/04：使用者要求日期查詢欄位改用 `UPDATE_TIME`（原為 `CREATE_TIME`），同步修改 generator 查詢條件/排序與頁面篩選邏輯；因 `UPDATE_TIME` 恆 ≥ `CREATE_TIME`，同樣 90 天窗篩到的筆數從 25,272 增至 58,622，檔案從 ~4.6MB 增至 ~10.8MB*
*2026/08/04：使用者要求把 `WINDOW_DAYS` 從 90 縮短為 30，筆數降到 15,651、檔案降到 ~2.9MB*
*2026/08/04：使用者要求查詢欄位從 USER_ID 改成電話號碼；確認 collection 無完整手機號碼欄位（只有 `MOBILE_head` 國碼）後，使用者選擇「改UI就好」——搜尋框改比對 `mobile`（`MOBILE_head`）而非 `uid`，純前端篩選 key 置換，未動 generator/資料結構，見 §4.1 說明*
*2026/08/05：新增 IP 關聯查詢功能（§3.3、§4.3）——移除 EMAIL 欄位／改為預設空白頁面需主動查詢（§4.2）／每列新增「關聯帳號」按鈕，查該帳號近期登入 IP 並反查同 IP 下的其他帳號。過程：使用者一開始要求即時查（電話→主帳號→USER_ID 查 `QWARE_MEM_IP_202608` 近期登入IP→反查同IP其他帳號），但該 collection 103 萬筆無索引、且本報表是公開靜態頁無法安全帶 DB 連線字串做即時查詢，改為 generator 端一次性預算好嵌入；IP 資料時間窗原評估 30 天（會膨脹到 ~5.87MB／總檔案逼近 9MB），使用者要求縮到 7 天（~3.86MB／總檔案 ~6.3MB，見 §2.1）；範圍確認為只做目前頁面既有的 ~1.5 萬個黑名單帳號，非全體會員（**此時仍誤判無完整電話號碼欄位，見下一則修正**）*
*2026/08/05：修正電話查詢欄位錯誤——使用者回報查真實號碼（`mobile 94702125`）找不到，追查發現 `Qware_MEM_BlackList_202608` 其實有完整 `MOBILE` 欄位，先前 08/04 建立報表時因 schema 抽樣只挑到 2019～2020 年最早期、還沒有 `MOBILE` 欄位的舊文件，誤判「系統沒有完整電話號碼」，實際搜尋框一直比對的是 `MOBILE_head`（國碼）。已修正 generator 投影與 BLACKLIST_DATA 結構（`mobile` 改存 `MOBILE` 完整號碼、新增 `mh` 存國碼），頁面 MOBILE 欄改顯示 `+國碼 號碼`，搜尋邏輯不變（仍是 `includes` 部分比對，只是比對對象換成真正的完整號碼）。同時修正文件裡多處錯誤的 collection 總筆數（`countDocuments` 實測 403,408，先前誤植「375 萬」）。查詢範圍仍收斂在頁面既有的黑名單帳號（見 §2.1 changelog 更新），未擴大到全體會員*
*2026/08/05：電話查詢範圍擴大到全體會員——欄位修好後使用者發現剛才那支號碼對應的帳號其實 `MEMO0:null`（未被標記黑名單），指出「要能先找到資料，不管有沒有在黑名單」。新增 §2.2 的 `ALL_INDEX`（對全表 40 萬餘筆只投影 `USER_ID`/`MOBILE_head`/`MOBILE`/`MEMO0` 四欄，~24.8MB）取代原本只查 `BLACKLIST_DATA` 的行為；`applyFilter()` 改為雙模式（見 §4.1）：有輸入電話 → 查 `ALL_INDEX`（忽略日期）、沒輸入 → 查 `BLACKLIST_DATA`（依日期，原行為不變）。表格新增「黑名單狀態」欄（`memoBadge()`），非黑名單帳號的時間/操作者欄位顯示「—」。整份檔案從 ~6.3MB 增至 **~31MB**，是與使用者確認過的取捨（曾提出縮小範圍/改後端 API 兩個替代方案，使用者選擇直接接受全量嵌入）*
*2026/08/05：使用者要求把「關聯帳號」的 IP 登入紀錄時間窗從 7 天拉長回 30 天，`IP_WINDOW_DAYS` 改回 30（見 §2.1）；`IP_LINKS` 涵蓋帳號數從 2,608 增至 4,278，整份檔案從 ~31MB 再增至 **~33MB**（此次未再另外確認，因為 30 天窗與 §2.2 的檔案量級已有先例可循，屬於直接執行的明確指示）*
*2026/08/05：使用者要求「再查所有帳號有 booking 的紀錄 Qware_A_OrderTemp_log_202608」，一開始詢問後理解為要獨立新報表，做了 `G_MEM_Booking_Accounts_Report.html`（見 `REPORT_SPEC_G_BOOKING_ACCOUNTS.md`）；使用者接著澄清其實是要在 F 報表裡「用電話號碼查出 user_id 後再查其訂單紀錄」，即整合進本報表既有的查詢流程，而非另開報表。新增 §2.3、§3.5 的 `BOOKING_DATA`：測過全量嵌入（不可行）、每帳號筆數上限 cap=10（~48～63MB）兩種方案後，改用使用者提出的「日期窗口」方案——不限筆數，只取近 7 天訂單（`BOOKING_WINDOW_DAYS=7`，錨定 collection 本身最新一筆時間），實測 ~15.8MB。表格新增「訂單紀錄」按鈕欄（§4.3），點擊開 `#bookModal` 顯示該帳號近 7 天訂票明細（演出/座位/時間/IP）。整份檔案從 ~33MB 增至 **~50.5MB**。`G_MEM_Booking_Accounts_Report.html` 予以保留，兩者用途互補（G 是全帳號彙總掃描，F 是查到帳號後的個案深挖），不互相連結。此次 `git push` 首次跳出 GitHub「檔案超過建議 50MB」warning（非硬性拒絕，仍 push 成功）*
*2026/08/06：使用者查 `94702125` 發現 CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER 全是空值，追問「為什麼不顯示？」——查證後這兩筆帳號在 MongoDB 裡其實都有真實值，只是 `ALL_INDEX`（見 §3.3）當初設計成只含 4 個極簡欄位，非黑名單帳號查到後這幾欄只能顯示「—」。使用者不接受這個折衷，要求顯示出來。改把 `ct`/`ut`/`cu`/`uu` 四個欄位加進 `ALL_INDEX` 每一列（等同把原本只給近 30 天黑名單帳號的完整資料，擴大到全部 40 萬會員都有），`applyFilter()` 電話搜尋分支同步簡化（直接用 `ALL_INDEX` 自帶欄位，不再需要反查 `BLACKLIST_DATA`）。`ALL_INDEX` 從 ~24.8MB 增至 ~58.6MB，整份檔案從 ~50.5MB 增至 **~85.3MB**，已逼近 GitHub 100MB 硬性上限（見 §2 開頭警語）*
*2026/08/06：三項需求一次交付——① 同門號對應多個 USER_ID 標記 MAJOR（見 §4.4）：原始需求「出現兩個以上」第一版用閾值 2 實作，跑完發現命中全體會員 78%（這份 collection 本身同門號對應多帳號極常見，非查詢邏輯錯誤），回報使用者後改閾值為 5，命中降到 988 個帳號（0.24%），恢復辨識力；② 移除表格 UPDATE_TIME 顯示欄位，保留日期區間篩選功能不變（見 §4.7）；③ 新增 USER_ID 查詢，與電話搜尋、日期瀏覽整合為三選一的「查詢模式」單選標籤群（見 §4.4、§4.5）——過程中使用者一開始要求電話/USER_ID 兩欄互斥且「輸入時自動清空對方」，接著又要求改成「各自獨立」，追問後釐清其實是要「只能擇一」但不要自動清空、也不要 AND 疊加，最終採用明確的模式選擇器 UI 達成三者互斥。整份報表檔案因新增 `wt` 短欄位與資料集自然成長，來到 **~88.5MB**（GitHub 100MB 硬性上限剩約 11.5MB 餘裕，見 §2 開頭警語）*
*2026/08/06（同日再次調整）：使用者要求「查詢模式不要日期瀏覽，不用日期查詢」——移除當天稍早才做好的「日期瀏覽／電話／USER_ID」三選一模式，拿掉整個日期區間篩選 UI（flatpickr 雙欄位、1/3/7 天前快速按鈕、flatpickr CDN 引用），只留「電話號碼／USER_ID」二選一，預設模式改為電話號碼（見 §4.1）。`BLACKLIST_DATA` 資料本身不變（generator 仍需要它算 `IP_LINKS` 範圍），只是前端不再有依日期瀏覽它的入口。過程中也順手修正 header 提示文字裡一處忘記從「2 個以上」同步改成「5 個以上」的 MAJOR 閾值敘述（見 §4.4 changelog）。檔案大小因移除 flatpickr CDN 連結與部分 UI/JS 略降，維持 **~88.5MB** 量級*
*2026/08/06（同日第三次調整，短命的架構改版）：使用者問「不是資料從 MongoDB 來？為什麼檔案這麼大」，藉機討論後改用專案既有的 Vercel 專案（`report-theta-nine.vercel.app`）新增 `f_blacklist_api.js` 即時查詢 MongoDB，前端改為 21KB 的 `fetch()` shell，靜態嵌入的 `BLACKLIST_DATA`/`ALL_INDEX`/`IP_LINKS`/`BOOKING_DATA` 全部拿掉。當時評估 4 個端點（`search`/`ip-links`/`bookings`/`meta`）皆做 IP 白名單雙重檢查（前端＋API 端）、並新增 3 個 MongoDB 索引加速。*
*2026/08/07：改回本文件版本（見檔案開頭 ℹ️ 提示）——Vercel serverless 沒有固定 outbound IP，`QwareAi` Atlas 專案的 Network Access 未開 `0.0.0.0/0`（不像 `AlexLIFE` 專案），導致 API 連線不穩定，使用者要求「先不用 vercel 了」。原以為 `generate_f_mem_blacklist_query.js` 已在 08/06 架構改版時被刪除，實際檢查發現該檔案從未真正從 git 移除（08/06 那次 commit 只動了 HTML/spec/新增 API 檔案），因此重新對這份舊 generator 補跑即可，不需要重寫。**唯一的坑**：08/06 之後的 `F_MEM_BlackList_Query_Report.html` 已被换成不含 `// ── Data Start ──` marker 的 21KB shell，generator 直接對它跑會拋 `Data markers not found`，需先用 `git show e91e7bb:F_MEM_BlackList_Query_Report.html` 還原回有 marker 的舊模板，才能重新注入資料。已刪除 `f_blacklist_api.js`、`vercel.json` 對應的 build/route 設定（3 個相關 MongoDB 索引未刪除，留著無害，之後若重啟 API 方案可直接用）。重新產出後檔案 **~89.9MB（GitHub 顯示值）**（資料集比 08/06 當時又自然成長了一些），比先前更逼近 100MB 硬上限，見檔案開頭警語*

*2026/08/07（同日再次調整）：新增「登入來源」欄位（webType，見 §3.3a、§4.6）——使用者要求顯示 `Qware_MEM_BlackList_202608` 的 `webType` 欄位（一開始誤記為 `WEB_TYPE`，實際查證欄位名是 camelCase `webType`）。全體 41.3 萬筆會員都有值，6 種：APPLE/FB/GOOGLE/LINE/MAJOR/OP。因其中一個值恰好也叫 `MAJOR`、與 §4.4 既有的紫色「MAJOR」標籤同名但語意無關，經與使用者確認後採用「不同顏色徽章＋不同用詞」方案區隔（本欄琥珀色 ⭐ 徽章，§4.4 維持紫色 pill），並在 `hdr-note` 加註說明兩者無關。`generate_f_mem_blacklist_query.js` 的 `BLACKLIST_DATA`/`ALL_INDEX` 查詢投影與輸出物件新增 `wty` 短欄位。因為要在 41.3 萬筆資料上各加一個字串欄位，整份檔案從 ~89.9MB 增至 **~99.3MB（GitHub 顯示約 94.7MB / 94.67 MiB）**，逼近 100MB（104.86MB／100 MiB）硬性上限，只剩約 5MB 餘裕——**下次若還要在 ALL_INDEX 加欄位，開工前務必先估算大小，很可能會撞到上限**，屆時需考慮拆分報表、改用 Git LFS，或評估是否要重新考慮後端 API 方案（見 §2 開頭 ℹ️ 提示，前提是先解決 Atlas Network Access 限制）。過程中用 Claude in Chrome 對本機起的靜態伺服器做手動驗證時，意外發現 §4.7 記錄的既有效能限制（`applyFilter()` 綁 `oninput`、無最短字元數門檻與渲染筆數上限，逐字輸入短字串會讓分頁卡死），這是本次改動前就存在的問題，非本次引入，先列為已知限制記錄，未進行修復。

*2026/08/11：CREATE_USER 欄新增異常值標記（見 §4.3）——`cu` 值只要不是 `定期掃描異常帳號`（唯一預期的系統自動值），就標紅字加註「⚠️ 請IT確認」，提示這筆帳號的建立者需要人工確認來源。純前端 `createUserCell()` 顯示邏輯，不動資料本身，`generate_f_mem_blacklist_query.js` 未修改，檔案大小不受影響。同日使用者原本另外提了一個「訂單紀錄旁加備註按鈕、寫回 MongoDB `QWare_MEM_BKnote_202608`」的需求，討論到寫入路徑（Vercel 直連 QwareAi 需要先開 Atlas Network Access，即時性 vs 走 Sheets 中介層延遲到下次報表更新）時使用者喊停，未實作、未定案，之後如要重啟這個需求需要重新走一次這個架構決策。*

*2026/08/11（同日再次調整）：CREATE_USER 為「定期掃描異常帳號」時新增封鎖建議（見 §4.3）——使用者接續上一則需求，指定兩條規則：該值時查關聯 IP，同日共用約 10 筆以上其他帳號 → 紅字「(保持封鎖)」；10 筆以下 → 紅字「(可解封鎖)」。討論後決定用**既有** `IP_LINKS` 資料近似計算（比對主帳號在該 IP 的最後登入日期與 `related` 各帳號最後登入日期是否同一天），不改 generator、不新增資料量——因為檔案已逼近 100MB 硬上限（見 §2、§4.6 changelog 的多次警語），使用者選擇犧牲精確度換取不增加撞上限風險，並接受這是近似值（只會低估不會高估）。多個關聯 IP 時取所有 IP 中最高的同日共用數判斷。用 Claude in Chrome 對本機靜態伺服器實測 3 種情境（高共用、低共用、完全無 `IP_LINKS` 資料）皆正確。*

*2026/08/11（同日第三次調整）：排入 S1 每日排程——使用者要求把本報表加進 `daily_update.bat`（見 §6），推翻先前「純手動、不排程」的定案（該定案原因是報表檔案已逼近 GitHub 100MB 上限，多一份每日自動 push 的風險）。手動跑一次 `generate_f_mem_blacklist_query.js` 實測約 1 分鐘完成（黑名單近30天 11,212 筆、全表 ALL_INDEX 431,845 筆、IP 登入近30天 510,651 筆、訂單近7天 181,716 筆），檔案從 ~94.68MB 降到 **~93.7MB**（30 天滾動窗往前移，非成長）；同步把輸出檔加進 `daily_update.bat` 的 `SYNC_FILES`，往後每日自動同步進 NewReport，不再需要手動 copy。用 Claude in Chrome 對重新產出的資料驗證 `createUserCell`/`ipBlockAdvice` 兩個前次新增的函式仍正常運作（generator 只改 Data marker 區塊，不會動到這些顯示邏輯）。*

*2026/08/11（同日第四次調整）：訂單紀錄欄新增同日異常量提示（見 §4.3）——使用者要求「同一天訂單紀錄超過10筆」標記通知IT確認，用來抓短時間內大量下單的搶票機器人特徵。因 `BOOKING_DATA` 本身已是近 7 天全部逐筆訂單、不設筆數上限（見 §2.3），`maxSameDayBookingCount()` 依日期分桶取最大值可以算出精確結果，不像同一天稍早的 CREATE_USER 封鎖建議（§4.3）需要用近似值——這裡不受 100MB 檔案上限問題影響，因為沒有新增資料，只是在既有 `BOOKING_DATA` 上做前端運算。閾值訂為「超過10筆」（`> 10`，11 筆才觸發），與使用者用詞一致。用 Claude in Chrome 找到實際帳號（單日 29 筆訂單）驗證按鈕旁正確顯示「⚠️ 通知IT確認」紅字提示。*

*2026/08/11（同日第五次調整）：新增頁面內規則說明區（見 §4.3a）——使用者要求把當天新增的幾條標記規則（CREATE_USER 的請IT確認／保持封鎖／可解封鎖、訂單紀錄的通知IT確認）直接顯示在報表頁面上，不要只寫在規範文件裡。加在表格正下方，沿用既有 `.cu-flag` 樣式渲染範例文字，純靜態內容、不影響 generator。*
