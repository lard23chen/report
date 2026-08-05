> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取（內含 EMAIL / USER_ID 等會員 PII）。

# 會員黑名單標記查詢報表 技術規範說明

本文件定義「會員黑名單標記查詢報表」的產出標準，未來更新或重新產出時請遵循本規範。

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
- `ALL_INDEX` 只有 4 個欄位、沒有時間戳記，所以電話搜尋到的帳號如果**不在** `BLACKLIST_DATA` 裡（近 30 天沒被標記黑名單），CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER 這幾欄會顯示「—」，「黑名單狀態」欄改顯示 `MEMO0` 原始值（`Y`/`N`/`4`/`未標記`）；「關聯帳號」也會因為不在 `IP_LINKS`（見 §2.1）裡而顯示「無登入紀錄」。這是資料範圍限制，不是查詢錯誤。
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

### 3.3 ALL_INDEX 陣列格式（generator 注入，2026/08/05 新增，見 §2.2）

```js
[
  { u: "32322139317825347177", h: "852", m: "94702125", f: null },
  // … 全部 40 萬餘筆會員，f = MEMO0 原始值（'Y'/'N'/'4'/null）
]
```

只有 4 個極短欄位（`u`/`h`/`m`/`f`），刻意不含任何時間戳記或操作者欄位以控制檔案大小（見 §2.2）。電話搜尋（`applyFilter()`）直接對這個陣列做 `m.includes(kw)`；找到後若該 `u` 同時存在於 `BLACKLIST_DATA`，用後者的完整欄位補足顯示，否則對應欄位顯示「—」（見 §4.1）。

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

### 4.1 查詢條件（2026/08/05 改為雙模式）

`applyFilter()` 依電話號碼輸入框是否有值，分成兩種互斥模式：

| 模式 | 觸發條件 | 查詢資料源 | 日期區間是否生效 |
|------|---------|-----------|-----------------|
| **電話搜尋**（全會員） | `#mobileSearch` 有值 | `ALL_INDEX`（見 §3.3，全部 40 萬餘筆會員） | 否——`ALL_INDEX` 沒有時間欄位，日期篩選對它無意義，忽略 |
| **黑名單瀏覽**（依日期） | `#mobileSearch` 為空 | `BLACKLIST_DATA`（見 §3.1，近 30 天 `MEMO0='Y'`） | 是，依 `UPDATE_TIME` 篩選，flatpickr 雙欄位 `#dtFrom`/`#dtTo`，`dateFormat:'Y-m-d'` |

電話搜尋比對 `mobile`（`MOBILE` 完整電話號碼欄位，**不含國碼**），**部分字串比對**（`includes`，非完全相符），即時篩選（`oninput`）。找到的帳號會用 `uid` 去 `BLACKLIST_DATA` 反查，若存在就補上完整的 CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER，否則這些欄位顯示「—」（見 §2.2）。「1天前/3天前/7天前」快速按鈕固定屬於黑名單瀏覽模式，點擊時會**先清空電話號碼欄位**，避免兩種模式的篩選條件互相干擾。

⚠️ **欄位史誤（2026/08/04→08/05 修正）**：2026/08/04 建立本報表時，第一次查 schema 只抽樣到 collection 裡最早期（2019～2020 年）的幾筆文件，剛好都沒有 `MOBILE` 欄位（該欄位是後來才加進 schema 的），因而誤判「collection 裡沒有完整手機號碼欄位」，搜尋框當時比對的其實是 `MOBILE_head`（只有國碼，如 `852`、`886`）。使用者 2026/08/05 實際查號碼查不到（`mobile 94702125`）後回報，才發現 `MOBILE` 欄位其實存在、且在 `MEMO0='Y'` 的記錄裡幾乎 100% 有值。已修正 generator 與頁面改用 `MOBILE`（完整號碼）查詢，`MOBILE_head`（國碼）仍保留在 `mh` 欄位、顯示於表格 MOBILE 欄位前綴（如 `+81 09018071105`）。
⚠️ **範圍史誤（同日修正）**：欄位修正後，使用者接著指出「查一個真實存在但未被標記黑名單的號碼」仍然查不到——當時電話搜尋還只對 `BLACKLIST_DATA`（近 30 天黑名單）做，範圍本來就不含一般會員。使用者要求「不管有沒有在黑名單都要能先找到資料」，因此新增 §2.2 的 `ALL_INDEX` 把電話搜尋範圍擴大到全體會員，此限制已解除。

### 4.2 預設檢視（2026/08/05 改版）

⚠️ **2026/08/05 起頁面載入不再自動顯示任何資料**（原本 `setQuickRange(3)` 會自動帶出近 3 天），改為空白狀態＋提示文字「請輸入電話號碼或設定日期區間後按『套用篩選』查詢」。使用者需主動輸入電話號碼、設定日期區間、或點「1天前/3天前/7天前」快速按鈕，才會觸發查詢並顯示表格（皆會設定內部 `hasSearched` 旗標）。「重置」會清空電話號碼搜尋、清空日期選擇，並把畫面帶回未查詢的空白狀態（而不是像改版前那樣退回預設 3 天檢視）。

**原因**：此頁定位從「瀏覽近期黑名單列表」轉為「先用電話查到主帳號、再逐筆查其 IP 關聯」的查案流程（見 §4.3），使用者不希望一進頁面就看到一大串未經篩選的資料。

### 4.3 結果表格與 IP 關聯查詢（2026/08/05 新增）

欄位：USER_ID、**黑名單狀態**（2026/08/05 新增，見下）、MOBILE（顯示為 `+國碼 電話號碼`，如 `+81 09018071105`）、CREATE_TIME、UPDATE_TIME、CREATE_USER、UPDATE_USER、**關聯帳號**、**訂單紀錄**（2026/08/05 新增，見下）。EMAIL 欄位已移除，見 §3.1。點前 7 欄 header 可排序（`sortTable()`），預設依 UPDATE_TIME 由新到舊；最後兩欄（關聯帳號／訂單紀錄）是操作按鈕，不可排序。表格上方顯示「符合條件：N 筆」。

**黑名單狀態欄**：因電話搜尋現在涵蓋全體會員（見 §2.2），同一張表格可能同時出現黑名單與非黑名單帳號，需要一眼分辨。以 `memoBadge()` 依 `memo0` 值渲染徽章：`Y` → 紅色「黑名單」、`null` → 灰色「未標記」、其他值（如 `4`）→ 琥珀色原樣顯示。CREATE_TIME/UPDATE_TIME/CREATE_USER/UPDATE_USER 若無資料（帳號不在 `BLACKLIST_DATA` 裡）一律顯示「—」，不留空白。

**關聯帳號欄**：每列一顆按鈕，文字依 `IP_LINKS[uid]` 是否存在顯示「🔗 IP關聯 (N)」（N = 近 30 天內用過的相異 IP 數）或「🔗 無登入紀錄」。點擊呼叫 `openIPModal(uid)` 開啟 modal（`#ipModal`），依序列出：

1. 該帳號近 30 天用過的每個 IP（`entry.ip`）與該 IP 上的最後登入時間（`entry.t`）
2. 該 IP 底下的其他帳號（`entry.related`，最多 30 筆，依最後登入時間新到舊）與各自最後登入時間；若無其他帳號顯示「此 IP 近30天內查無其他帳號」
3. 若 `totalOthers > related.length`，額外顯示「共 N 個共用帳號，僅顯示前 30 個」截斷提示

這是查案用的「反查關聯帳號」功能：先用電話號碼在表格裡找到主帳號（不分黑名單狀態，見 §2.2） → 點「關聯帳號」看它近期用過哪些 IP → 再看同一 IP 底下還有哪些其他帳號，用來抓同一人／同一裝置註冊多個帳號規避黑名單的狀況。**只有近 30 天 `MEMO0='Y'` 的帳號才有 `IP_LINKS` 資料**，非黑名單帳號一律顯示「無登入紀錄」（見 §2.1）。

**訂單紀錄欄**（2026/08/05 新增）：每列一顆按鈕，文字依 `BOOKING_DATA[uid]` 是否存在顯示「🎫 訂單 (N)」（N = 近 7 天內訂票筆數）或「🎫 無訂單紀錄」。點擊呼叫 `openBookingModal(uid)` 開啟另一個 modal（`#bookModal`），列出該帳號近 7 天所有訂票紀錄（演出代碼、座位、訂票時間、訂票 IP），依時間新到舊排序，**不設筆數上限**（見 §2.3——同一帳號短時間內重複訂同一批座位是重點訊號，不應截斷）。此功能查詢範圍不限於 `BLACKLIST_DATA`／`IP_LINKS`，`BOOKING_DATA` 的 key 只要近 7 天有訂票紀錄就存在，即使該帳號不在會員黑名單 collection 裡也一樣。

### 4.4 IP 白名單保護

比照 E 系統報表機制（`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。本報表因含 EMAIL / USER_ID 等會員 PII，**建立時就內建此保護**，不是事後補上。清單為手動維護的靜態內容，`generate_f_mem_blacklist_query.js` 只用 marker 區塊替換資料、不會動到 `<head>`。

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

**目前沒有排入任何排程**（不在 `daily_update.bat` 等 4 支 bat 的清單內），純手動報表；如需查最新資料，重新執行上述指令即可（30 天滾動窗會自動往前移）。

**同步至 NewReport（使用者實際瀏覽的站台）**：本報表屬於 `newreport-dual-repo-architecture` 定義的「ad-hoc 檔案」，不在任何 bat 的固定同步清單內，更新完 `D:\2025\AI\MongoDB` 後需手動 copy 進 `D:\2025\AI\NewReport` 並 commit + push（`origin`、`company` 兩個 remote 交錯 pull/push，細節見 `REPORT_SPEC_SCHEDULED_TASKS.md` §5.6.3）。

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
*2026/08/05：使用者要求「再查所有帳號有 booking 的紀錄 Qware_A_OrderTemp_log_202608」，一開始詢問後理解為要獨立新報表，做了 `G_MEM_Booking_Accounts_Report.html`（見 `REPORT_SPEC_G_BOOKING_ACCOUNTS.md`）；使用者接著澄清其實是要在 F 報表裡「用電話號碼查出 user_id 後再查其訂單紀錄」，即整合進本報表既有的查詢流程，而非另開報表。新增 §2.3、§3.5 的 `BOOKING_DATA`：測過全量嵌入（不可行）、每帳號筆數上限 cap=10（~48～63MB）兩種方案後，改用使用者提出的「日期窗口」方案——不限筆數，只取近 7 天訂單（`BOOKING_WINDOW_DAYS=7`，錨定 collection 本身最新一筆時間），實測 ~15.8MB。表格新增「訂單紀錄」按鈕欄（§4.3），點擊開 `#bookModal` 顯示該帳號近 7 天訂票明細（演出/座位/時間/IP）。整份檔案從 ~33MB 增至 **~50.5MB**。`G_MEM_Booking_Accounts_Report.html` 予以保留，兩者用途互補（G 是全帳號彙總掃描，F 是查到帳號後的個案深挖），不互相連結*
