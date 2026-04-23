# 訂單國籍占比 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `A_Qware_Revenue_Report_2026年03月_分析報表.html` 新增「訂單國籍占比」section，顯示 donut chart 和 table。

**Architecture:** 修改 `generate_report_mar_2026_v3.js`，在現有資料抓取流程後新增一個 step：以 2026-03 有效訂單的 `會員編號` 批次查詢 `Qware_Member_data` 取得 `國家`，在 Node.js 計算各國訂單數和佔比，注入 `summaryData.nationalityList`，再在 HTML template 新增對應 section。

**Tech Stack:** Node.js, MongoDB Driver, Chart.js (已存在), chartjs-plugin-datalabels (已存在)

---

### Task 1: 新增 nationality lookup 邏輯並計算 nationalityList

**Files:**
- Modify: `generate_report_mar_2026_v3.js` (在 `const summaryData = {...}` 之前新增)

- [ ] **Step 1: 在 `generate_report_mar_2026_v3.js` 中，找到 `const eventList = ...` 之後、`const summaryData = {` 之前，插入 nationality lookup 程式碼**

在 `generate_report_mar_2026_v3.js` 第 123 行附近（`const eventList = Object.entries...` 之後），加入：

```js
        // --- 4. Nationality from Member Data ---
        const memberIds = [...new Set(validOrders.map(o => o['會員編號']).filter(Boolean))];
        const memberCollection = db.collection('Qware_Member_data');
        const memberDocs = await memberCollection.find(
            { '會員編號': { $in: memberIds } },
            { projection: { '會員編號': 1, '國家': 1, '_id': 0 } }
        ).toArray();

        const memberNationalityMap = {};
        memberDocs.forEach(m => { memberNationalityMap[m['會員編號']] = m['國家'] || '未知'; });

        const nationalityOrderMap = {};
        const seenOrders = new Set();
        validOrders.forEach(o => {
            const baseOrder = o['訂單編號'] ? o['訂單編號'].split('_')[0] : null;
            if (!baseOrder || seenOrders.has(baseOrder)) return;
            seenOrders.add(baseOrder);
            const country = memberNationalityMap[o['會員編號']] || '未知';
            nationalityOrderMap[country] = (nationalityOrderMap[country] || 0) + 1;
        });

        const totalNationalityOrders = Object.values(nationalityOrderMap).reduce((a, b) => a + b, 0);
        const nationalityListRaw = Object.entries(nationalityOrderMap)
            .map(([name, orders]) => ({ name, orders, share: (orders / totalNationalityOrders * 100).toFixed(1) }))
            .sort((a, b) => b.orders - a.orders);

        const top10 = nationalityListRaw.slice(0, 10);
        const othersOrders = nationalityListRaw.slice(10).reduce((acc, cur) => acc + cur.orders, 0);
        const nationalityList = othersOrders > 0
            ? [...top10, { name: '其他', orders: othersOrders, share: (othersOrders / totalNationalityOrders * 100).toFixed(1) }]
            : top10;
```

- [ ] **Step 2: 將 `nationalityList` 加入 `summaryData`**

找到 `const summaryData = {` 區塊（約第 139 行），在 `meta: { ... }` 這一行之前加入：

```js
            nationalityList,
```

完整 summaryData 的 `meta` 前一行應變成：
```js
            nationalityList,
            meta: { totalRows: rawData.length, reportTime: new Date().toLocaleString('zh-TW') }
```

- [ ] **Step 3: 執行腳本確認 nationalityList 有值（console.log 驗證）**

在 `nationalityList` 計算完後暫時加一行：
```js
        console.log('nationalityList sample:', nationalityList.slice(0, 3));
```

執行：
```bash
node generate_report_mar_2026_v3.js
```

預期輸出包含類似：
```
nationalityList sample: [ { name: '台灣', orders: 12345, share: '85.2' }, ... ]
```

確認有資料後移除 `console.log` 這行。

- [ ] **Step 4: Commit**

```bash
git add generate_report_mar_2026_v3.js
git commit -m "feat: add nationality lookup logic to March 2026 revenue report"
```

---

### Task 2: 在 HTML template 新增 nationality section（chart + table）

**Files:**
- Modify: `generate_report_mar_2026_v3.js` (HTML template 字串部分)

- [ ] **Step 1: 找到 HTML template 中 paymentTable section 的位置**

在 `generate_report_mar_2026_v3.js` 中，HTML template 字串（從 `const uiPart` 拼接的部分）裡找到 `id="paymentTable"` 附近的結構，確認其所在位置（在 `renderTable('#paymentTable', ...)` 的 HTML 對應 section）。

因為此腳本是從 `generate_report_feb_2026.js` 抓 template 再替換，nationality section 需要加在最終 `finalHtml` 的 HTML 結構裡。

找到 `finalHtml` 字串中的 `</script>\n</body></html>` 結尾（約第 277 行），在結尾的 `</script>` **之前**，在 `function closeModal()` 之後加入以下 chart 初始化程式碼。

- [ ] **Step 2: 在 `window.addEventListener('load', ...)` 內，renderTable('#salesPointTable', ...) 之後，加入 nationality chart 初始化**

找到 `renderTable('#salesPointTable', ...)` 這一行，在其後加入：

```js
        // Nationality Chart
        const natColors = ['#d81b60','#e53935','#fb8c00','#fdd835','#43a047','#00acc1','#1e88e5','#5e35b1','#8e24aa','#00897b','#546e7a'];
        const natLabels = s.nationalityList.map(n => n.name);
        const natData = s.nationalityList.map(n => n.orders);
        new Chart(document.getElementById('nationalityChart'), {
            type: 'doughnut',
            data: {
                labels: natLabels,
                datasets: [{ data: natData, backgroundColor: natColors.slice(0, natLabels.length), borderWidth: 2, borderColor: '#1e1e1e' }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#ccc', font: { size: 12 }, padding: 12 } },
                    datalabels: {
                        color: 'white',
                        font: { weight: 'bold', size: 11 },
                        formatter: (value, ctx) => {
                            const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const pct = (value / total * 100).toFixed(1);
                            return pct > 2 ? pct + '%' : '';
                        }
                    }
                }
            }
        });

        renderTable('#nationalityTable', s.nationalityList, (item, i) => \`<tr><td><span style="background:var(--accent-color); color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i + 1}</span></td><td class="font-bold">\${item.name}</td><td class="text-right">\${item.orders.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);
```

- [ ] **Step 3: 在 `finalHtml` 的 `</script>` 之後、`</body></html>` 之前插入 nationality HTML section**

`generate_report_mar_2026_v3.js` 約第 278 行，`finalHtml` 字串的最後是：
```js
    function closeModal() {
        document.getElementById('analysisModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
</script>
</body></html>`.replace(/2026年02月/g, "2026年03月");
```

將這段結尾改為（在 `</script>` 和 `</body>` 之間插入 HTML section）：

```js
    function closeModal() {
        document.getElementById('analysisModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
</script>

<div style="max-width:1400px; margin:0 auto 40px; padding:0 30px;">
    <h2 style="font-size:1.1rem; color:#a0a0a0; text-transform:uppercase; letter-spacing:1px; border-left:4px solid var(--accent-color); padding-left:10px; margin-bottom:20px;">訂單國籍占比 (Order Nationality)</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;">
        <div style="background:#1e1e1e; border-radius:16px; padding:25px; box-shadow:0 8px 16px rgba(0,0,0,0.3); border:1px solid #333;">
            <h3 style="margin-top:0; color:#e0e0e0; border-left:4px solid var(--accent-color); padding-left:10px;">國籍分佈</h3>
            <div style="height:350px;"><canvas id="nationalityChart"></canvas></div>
        </div>
        <div style="background:#1e1e1e; border-radius:16px; padding:25px; box-shadow:0 8px 16px rgba(0,0,0,0.3); border:1px solid #333;">
            <h3 style="margin-top:0; color:#e0e0e0; border-left:4px solid var(--accent-color); padding-left:10px;">國籍明細</h3>
            <table id="nationalityTable" style="width:100%; border-collapse:collapse; font-size:0.95em;">
                <thead><tr>
                    <th style="padding:15px; text-align:left; border-bottom:1px solid #333; color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">排名</th>
                    <th style="padding:15px; text-align:left; border-bottom:1px solid #333; color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">國家/地區</th>
                    <th style="padding:15px; text-align:right; border-bottom:1px solid #333; color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">訂單數</th>
                    <th style="padding:15px; text-align:right; border-bottom:1px solid #333; color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">佔比</th>
                </tr></thead>
                <tbody></tbody>
            </table>
        </div>
    </div>
</div>

</body></html>`.replace(/2026年02月/g, "2026年03月");
```

- [ ] **Step 4: 執行腳本並開啟 HTML 確認**

```bash
node generate_report_mar_2026_v3.js
```

用瀏覽器開啟 `A_Qware_Revenue_Report_2026年03月_分析報表.html`，確認：
- 頁面有「訂單國籍占比」section
- Donut chart 顯示正常（有百分比 label）
- Table 有資料，佔比加總 ≈ 100%

- [ ] **Step 5: Commit**

```bash
git add generate_report_mar_2026_v3.js A_Qware_Revenue_Report_2026年03月_分析報表.html
git commit -m "feat: add nationality distribution section to March 2026 revenue report"
```

---

### Task 3: 推送至 GitHub

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: 確認 GitHub Pages 更新**

開啟 `https://lard23chen.github.io/report/A_Qware_Revenue_Report_2026%E5%B9%B403%E6%9C%88_%E5%88%86%E6%9E%90%E5%A0%B1%E8%A1%A8.html` 確認頁面有國籍占比 section。

