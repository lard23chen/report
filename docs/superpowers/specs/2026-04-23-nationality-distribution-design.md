---
title: 訂單國籍占比 — A_Qware_Revenue_Report_2026年03月
date: 2026-04-23
status: approved
---

## 目標

在 `A_Qware_Revenue_Report_2026年03月_分析報表.html` 報表中，新增「訂單國籍占比」section，顯示購票會員的國籍分佈。

## 資料來源

| Collection | 欄位 | 用途 |
|---|---|---|
| `Qware_Ticket_Data` | `會員編號`, `訂單編號`, `狀態`, `交易時間` | 取得 2026-03 有效訂單的會員 |
| `Qware_Member_data` | `會員編號`, `國家` | 查詢每位會員的國籍 |

## 資料流

1. 從 `Qware_Ticket_Data` 過濾 `交易時間 ^2026-03` 且 `狀態 === '正常'` 的訂單
2. 從這些訂單中取出不重複的 `會員編號` 集合
3. 批次查詢 `Qware_Member_data`，projection `{ 會員編號: 1, 國家: 1 }`，條件 `{ 會員編號: { $in: [...] } }`
4. 建立 `memberNationalityMap: Map<會員編號, 國家>`
5. 遍歷有效訂單，以 `訂單編號.split('_')[0]` 為 base 去重，計算每個 `國家` 的訂單數
6. 缺少會員資料或 `國家` 為空的，歸類為「未知」
7. 依訂單數降冪排列；chart 取前 10 名，其餘合併為「其他」

## 輸出資料結構

新增至 `summaryData`：

```js
nationalityList: [
  { name: '台灣', orders: 12345, share: '85.2' },
  { name: '香港', orders: 321, share: '2.2' },
  // ...
  { name: '其他', orders: 89, share: '0.6' }  // chart-only 合併項
]
```

## HTML 修改

### 新增 section 位置
`paymentTable` section 之後，`salesPointTable` section 之前。

### 元件
- **Donut chart** (`nationalityChart`)：前 10 國 + 其他，顯示 % label，使用 `chartjs-plugin-datalabels`
- **Table** (`nationalityTable`)：欄位為「排名 / 國家 / 訂單數 / 佔比%」，樣式沿用現有 `paymentTable`

### 顏色
沿用 `var(--accent-color)` 主色系，chart 使用現有報表的多色 palette。

## 修改範圍

- **唯一修改檔案**：`generate_report_mar_2026_v3.js`
  - 新增 step 3b：member nationality lookup
  - 新增 `nationalityList` 計算邏輯
  - 將 `nationalityList` 注入 `summaryData`
  - 在 HTML template 字串中新增 nationality section（chart + table）
  - 在 `window.addEventListener('load', ...)` 中新增 chart 初始化和 table render

## 成功條件

- `A_Qware_Revenue_Report_2026年03月_分析報表.html` 包含 nationality donut chart 和 table
- 所有國籍百分比合計 = 100%
- 「未知」項目存在但不影響其他數值
- 腳本執行不 timeout（batch lookup 一次查詢，不逐筆查詢）
