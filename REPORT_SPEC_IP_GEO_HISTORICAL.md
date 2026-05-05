# 歷史 IP 地理分析報表 (A系統) 技術規範說明

本文件定義「歷史 IP 地理分析報表」的產出標準與設定，未來更新或重新產出此報表時，請遵循本規範。

## 1. 基本資訊 (General Info)

| 項目 | 說明 |
|------|------|
| 報表名稱 | `A_IP_Geo_Analysis_Report_Historical.html` |
| 產生腳本 | `generate_ip_geo_report_historical.js` |
| 資料來源 | MongoDB `QwareAi` / `Qware_Ticket_Data` |
| GeoIP 套件 | `geoip-lite` (npm) |
| 負責人 | 陳俊良 |
| 主要目的 | 依全歷史訂單 IP 判斷台灣 vs 海外購票行為，提供完整歷史地理分布、付款方式、年齡結構分析 |

## 2. 與本月報表的差異

| 項目 | 本月報表 (`A_IP_Geo_Analysis_Report.html`) | 歷史報表（本檔） |
|------|------|------|
| 資料來源 | `Qware_A_Ticket_data_Daily` | `Qware_Ticket_Data` |
| 預設時間範圍 | 本月 | 全部資料 |
| 快捷按鈕 | 近30天 / 近90天 / 全部 | **今年** / 近30天 / 近90天 / 全部 |
| 資料量 | ~每日累計 | ~814,000 筆（全歷史） |

## 3. 視覺樣式設定 (Visual Styles)

與 A 系統其他報表一致，採用**深色主題 (Dark Theme)**。

| CSS 變數 | 值 | 說明 |
|---|---|---|
| `--bg` | `#0f172a` | 頁面背景 |
| `--card` | `#1e293b` | 卡片背景 |
| `--border` | `#334155` | 邊框色 |
| `--text` | `#e2e8f0` | 主要文字 |
| `--muted` | `#94a3b8` | 次要文字 |
| `--accent` | `#3b82f6` | 強調色（藍） |
| 台灣色 | `#4ade80` | 綠色，代表台灣 |
| 海外色 | `#60a5fa` | 藍色，代表海外 |
| 內部訂單色 | `#f59e0b` | 琥珀色 |

## 4. IP 地理判斷邏輯 (GeoIP Logic)

與本月報表相同（詳見 `REPORT_SPEC_IP_GEO_ANALYSIS.md`）：

1. 讀取每筆資料的 `IP` 欄位
2. 使用 `geoip-lite` 查詢國家代碼
3. 分類規則：
   - `country === 'TW'` → **台灣**
   - 私有 IP → **內部訂單**
   - `country === 'UNKNOWN'` → **無法識別**
   - 其他 → **海外**（依國家代碼分群）
4. `isPrivateIP()` 在 geoip 查詢前執行
5. 使用 `ipCache` 避免重複查詢

## 5. 關鍵組件與圖表 (Components & Charts)

### 5.1 KPI 卡片

| 卡片 | 內容 |
|------|------|
| 🇹🇼 台灣購票金額 | 金額 + 占比 % + 訂單筆數 + 張數 |
| 🌏 海外購票金額 | 金額 + 占比 % + 訂單筆數 + 張數 |
| 🏢 內部訂單（內網IP） | 金額 + 占比 % + 訂單筆數 + 張數 |
| ❓ IP 無法識別 | 金額 + 占比 % + 訂單筆數 |
| 🌍 海外國家數 | 不重複國家/地區數量 |
| 🇹🇼 台灣退票筆數 | 退票筆數 + 張數 + 手續費 |
| 🌏 海外退票筆數 | 退票筆數 + 張數 + 手續費 |

### 5.2 圖表

- **圓餅圖 × 2**：購票金額分布 / 訂單數分布（台灣/海外/內部/未識別）
- **橫條圖**：海外前 10 國家（購票金額）
- **橫條圖**：海外前 10 國家（購票筆數 vs 張數）—— 雙系列分組
- **分組長條圖**：年齡分布（台灣 vs 海外，`<20/20-29/30-39/40-49/50-59/60+`）
- **迷你表格**：海外前 10 綜合數據（嵌入圖表區）

### 5.3 海外國家明細表

欄位：國家 / 購票筆數 / 購票張數 / 購票金額 / 退票筆數（前 15 名，依購票金額排序）

### 5.4 付款方式對照表

台灣 vs 海外並排，欄位：付款方式 / 台灣訂單數 / 台灣金額 / 海外訂單數 / 海外金額

## 6. 日期區間查詢 (Date Range Filter)

採客戶端互動式篩選，腳本產生 `DAILY_DATA` JSON 嵌入 HTML：

| 元件 | 說明 |
|------|------|
| 起訖日期輸入框 | 預設為資料最小/最大日期 |
| 查詢按鈕 | 重算全部 KPI / 圖表 / 表格 |
| **今年** | 快捷 preset，以今年 1/1 至今 |
| 近30天 / 近90天 | 以資料最大日期往前推算 |
| 全部 | 重置回全資料範圍 |

## 7. 更新方式 (Update Procedure)

```bash
# 更新報表（資料量大約需 1-2 分鐘）
node generate_ip_geo_report_historical.js

# 推送
git add A_IP_Geo_Analysis_Report_Historical.html generate_ip_geo_report_historical.js
git commit -m "Update historical IP geo analysis report"
git push origin main
```

更新頻率：**手動 / 依需求**（Qware_Ticket_Data 資料更新後執行）

## 8. 國家名稱對照表 (Country Map)

與 `REPORT_SPEC_IP_GEO_ANALYSIS.md` 相同，詳見該文件 Section 8。
