# A 系統專案深度評估報表 通用技術規範說明

本文件定義所有「演唱會 / 專案深度評估」類報表的共通規範。
目前涵蓋：金唱片頒獎典禮、李聖傑演唱會、統一獅例行賽、韋禮安演唱會。

---

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表類型 | 單一專案深度分析（手動觸發） |
| 主要腳本 | 各報表獨立腳本（見下表） |
| 資料來源 | MongoDB `QwareAi`，多集合聯查 |
| 負責人 | 陳俊良 |

### 各報表對應腳本

| 報表 | 腳本 | 資料集合 |
|------|------|---------|
| A_GoldenDisc_Report_2026-02-06.html | generate_golden_disc_report.js | Qware_Ticket_Data |
| A_SamLee_Report_2025_Taipei.html | generate_sam_lee_report.js | Qware_Ticket_Data |
| A_UniformLions_Order_Analysis_20260309.html | generate_lions_order_report.js | Qware_A_Ticket_data_Daily |
| A_WeiBird_Report_2026.html | generate_weibird_report.js | Qware_A_Ticket_data_Daily |

---

## 2. 通用資料聯查模式

深度報表通常同時查詢以下多個集合：

| 集合 | 用途 |
|------|------|
| `Qware_Ticket_Data` 或 `Qware_A_Ticket_data_Daily` | 訂單/票券主資料（依事件時效選擇） |
| `Qware_A_Section_number` | 場次座位區資料（依節目名稱查） |
| `QwareTrafficSession` | GA 即時 session 數（依 ActivityID） |
| `QwareTrafficGAReadTime` | GA 即時 active users（依 ActivityID） |
| `Qware_A_Traffic_session_data` | 頁面瀏覽量（依節目名稱） |
| `Qware_Member_data` | 會員國籍與縣市（依會員編號批次查） |

---

## 3. 通用統計項目

| 項目 | 說明 |
|------|------|
| 訂單筆數 | `訂單編號` 取底線前綴後去重 |
| 購票張數 | 正常狀態 row 數 |
| 購票金額 | 正常狀態 `售價` 加總 |
| 退票筆數/張數/手續費 | 退票狀態統計 |
| 場次分析 | 依 `演出時間/規格` 拆分 |
| 付款方式分布 | 訂單數 + 金額 |
| 票種分布 | 張數 + 金額 |
| 會員國籍/縣市 | join Qware_Member_data |
| 性別 / 年齡分布 | 依 `性別`、`出生年` 計算 |

---

## 4. 視覺樣式

深色主題，與 A 系統月度報表一致。

| CSS 變數 | 值 |
|---|---|
| `--bg-color` | `#121212` |
| `--card-bg` | `#1e1e1e` |
| `--text-primary` | `#e0e0e0` |
| `--accent-color` | 依場次主色調（金唱片用金色、李聖傑用藍色等） |

---

## 5. 專案專屬說明

### 金唱片頒獎典禮（A_GoldenDisc_Report）
- 篩選條件：`節目/商品名稱 === '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards'`
- ActivityID：`39311`
- 特色：加入 GA 流量分析（session + active users）、會員國籍地圖

### 李聖傑演唱會（A_SamLee_Report）
- 篩選條件：`節目/商品名稱 === '2025李聖傑 One Day直到那一天 世界巡迴演唱會 台北站'`
- 場次：2025/12/26、2025/12/27（以 `演出時間/規格` 拆分）

### 統一獅例行賽（A_UniformLions_Order_Analysis）
- 篩選條件：`節目名稱 regex '中華職棒37年例行賽統一獅主場（上）'`、`交易時間 regex '^2026-03-09'`
- 時間範圍：18:00–23:59（開賣首日）
- 特色：逐分鐘趨勢分析、性別/年齡分布

### 韋禮安演唱會（A_WeiBird_Report）
- 篩選條件：`節目/商品名稱 === '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場'`
- ActivityID：`39484`
- GA 節目名稱（查流量用）：`'國泰世華銀行 2026 韋禮安 韋，您好 HI WE1巡迴演唱會'`

---

## 6. 更新方式

```bash
node generate_<script_name>.js
git add <report_name>.html
git commit -m "Update <report_name>"
git push origin main
```

更新頻率：**手動**（專案結束後一次性產出）
