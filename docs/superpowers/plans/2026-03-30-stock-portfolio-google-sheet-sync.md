# Stock Portfolio — Google Sheet Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `RAW` array and `localStorage`-based CRUD in `Stock_Portfolio.html` with Google Sheet as the single source of truth, using the same Apps Script and Sheet already serving `Team_Resources.html`.

**Architecture:** The existing Apps Script is replaced with a version that routes by an optional `sheet` parameter — `"Team_Resources"` (default, unchanged behaviour) or `"Stock_Portfolio"` (new tab). `Stock_Portfolio.html` fetches all data on load via GET and writes add/update/delete changes via POST, mirroring the `Team_Resources` pattern exactly.

**Tech Stack:** HTML/JS (vanilla, no framework), Google Apps Script, Google Sheets

---

### Task 1: Generate migration CSV from RAW data

**Files:**
- Create: `scripts/extract_raw_csv.py`
- Create: `stock_portfolio_migration.csv`

- [ ] **Step 1: Create extraction script**

Create `scripts/extract_raw_csv.py`:

```python
import re, csv, sys

with open('Stock_Portfolio.html', encoding='utf-8') as f:
    html = f.read()

match = re.search(r'const RAW=\[(.*?)\];', html, re.DOTALL)
if not match:
    print('ERROR: RAW array not found', file=sys.stderr)
    sys.exit(1)

block = match.group(1)
row_strings = re.findall(r'\[([^\]]+)\]', block)

HEADER = ['date','type','code','name','buyShares','buyPrice','sellShares','sellPrice',
          'fee','tax','amount','cost','spend','income','note','person']

with open('stock_portfolio_migration.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(HEADER)
    for row_str in row_strings:
        vals = next(csv.reader([row_str]))
        w.writerow(vals)

print(f'Written {len(row_strings)} rows to stock_portfolio_migration.csv')
```

- [ ] **Step 2: Run the script from the repo root**

```
cd D:/2025/AI/MongoDB
python scripts/extract_raw_csv.py
```

Expected output:
```
Written 354 rows to stock_portfolio_migration.csv
```

- [ ] **Step 3: Spot-check the CSV**

Open `stock_portfolio_migration.csv` and verify:
- Row 1 is the 16-column header: `date,type,code,name,buyShares,...,person`
- Row 2 starts with: `1899/12/30,買,2845,遠東銀,3000,16.4,...`
- Last row starts with: `2026/3/17,買,2317,鴻海,500,214.0,...`

- [ ] **Step 4: Commit**

```bash
git add scripts/extract_raw_csv.py stock_portfolio_migration.csv
git commit -m "chore: generate migration CSV from Stock_Portfolio RAW data"
```

---

### Task 2: Write the new Apps Script (Code.gs)

**Files:**
- Create: `apps_script/Code.gs`

This replaces the existing Apps Script in full. The user will paste this into the Apps Script editor and redeploy. `Team_Resources` behaviour is preserved by defaulting to that sheet when no `sheet` parameter is provided.

- [ ] **Step 1: Create `apps_script/Code.gs`**

```javascript
function doGet(e) {
  var sheetName = (e && e.parameter && e.parameter.sheet)
    ? e.parameter.sheet
    : 'Team_Resources';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: false, error: 'Sheet not found: ' + sheetName });

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonResponse({ ok: true, data: [] });
  var dataRows = rows.slice(1);
  var data;

  if (sheetName === 'Team_Resources') {
    data = dataRows
      .map(function(r) { return { item: r[0], url: r[1], note: r[2] }; })
      .filter(function(r) { return r.item; });

  } else if (sheetName === 'Stock_Portfolio') {
    data = dataRows
      .map(function(r) {
        return {
          date:       String(r[0]  || ''),
          type:       String(r[1]  || ''),
          code:       String(r[2]  || ''),
          name:       String(r[3]  || ''),
          buyShares:  Number(r[4])  || 0,
          buyPrice:   Number(r[5])  || 0,
          sellShares: Number(r[6])  || 0,
          sellPrice:  Number(r[7])  || 0,
          fee:        Number(r[8])  || 0,
          tax:        Number(r[9])  || 0,
          amount:     Number(r[10]) || 0,
          cost:       Number(r[11]) || 0,
          spend:      Number(r[12]) || 0,
          income:     Number(r[13]) || 0,
          note:       String(r[14] || ''),
          person:     String(r[15] || 'alex')
        };
      })
      .filter(function(r) { return r.date || r.code; });

  } else {
    return jsonResponse({ ok: false, error: 'Unknown sheet: ' + sheetName });
  }

  return jsonResponse({ ok: true, data: data });
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var sheetName = body.sheet || 'Team_Resources';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: false, error: 'Sheet not found: ' + sheetName });

  if (sheetName === 'Team_Resources') {
    handleTeamResources(sheet, body);
  } else if (sheetName === 'Stock_Portfolio') {
    handleStockPortfolio(sheet, body);
  }
  return jsonResponse({ ok: true });
}

function handleTeamResources(sheet, body) {
  var rowNum = Number(body.index) + 2;
  if (body.action === 'add') {
    sheet.appendRow([body.item || '', body.url || '', body.note || '']);
  } else if (body.action === 'update') {
    sheet.getRange(rowNum, 1, 1, 3).setValues([[
      body.item || '', body.url || '', body.note || ''
    ]]);
  } else if (body.action === 'delete') {
    sheet.deleteRow(rowNum);
  }
}

function handleStockPortfolio(sheet, body) {
  var rowNum = Number(body.index) + 2;
  if (body.action === 'add') {
    sheet.appendRow([
      body.date,      body.type,       body.code,      body.name,
      body.buyShares, body.buyPrice,   body.sellShares, body.sellPrice,
      body.fee,       body.tax,        body.amount,    body.cost,
      body.spend,     body.income,     body.note || '', body.person
    ]);
  } else if (body.action === 'update') {
    sheet.getRange(rowNum, 1, 1, 16).setValues([[
      body.date,      body.type,       body.code,      body.name,
      body.buyShares, body.buyPrice,   body.sellShares, body.sellPrice,
      body.fee,       body.tax,        body.amount,    body.cost,
      body.spend,     body.income,     body.note || '', body.person
    ]]);
  } else if (body.action === 'delete') {
    sheet.deleteRow(rowNum);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps_script/Code.gs
git commit -m "feat: Apps Script with Team_Resources + Stock_Portfolio sheet routing"
```

---

### Task 3: Remove RAW data and CRUD store from Stock_Portfolio.html

**Files:**
- Modify: `Stock_Portfolio.html`

The RAW array spans lines 160–514 (~355 lines). Use a Python script to make this replacement safely.

- [ ] **Step 1: Create replacement script**

Create `scripts/patch_stock_portfolio.py`:

```python
import re

with open('Stock_Portfolio.html', encoding='utf-8') as f:
    html = f.read()

# Remove RAW array block (from comment through closing ];)
html = re.sub(
    r'// ─── RAW DATA ─+\n// \[date.*?\n const RAW=\[.*?\];\n',
    '',
    html,
    flags=re.DOTALL
)

# Remove CRUD store block (SK + getStore + saveStore)
html = re.sub(
    r'\n// ─── CRUD Store ─+\nconst SK=.*?saveStore\(s\)\{localStorage\.setItem\(SK,JSON\.stringify\(s\)\)\}\n',
    '\n',
    html,
    flags=re.DOTALL
)

# Remove buildRows block
html = re.sub(
    r'\n// ─── Build rows with overrides ─+\nfunction buildRows\(\)\{.*?return rows;\n\}\n',
    '\n',
    html,
    flags=re.DOTALL
)

# Insert API constants right after <script>
html = html.replace(
    '<script>\n',
    '<script>\n'
    "// ─── API ─────────────────────────────────────────────────────────────────────\n"
    "const API='https://script.google.com/macros/s/AKfycbxoXM_4QgCCEzxgy7Oa0dSjUStpovdgyGnhrAP0TQBdkdXp3OgSomfQO92wf2sn5Q-k/exec';\n"
    "const SHEET='Stock_Portfolio';\n"
    "var data=[];\n\n",
    1  # replace only first occurrence
)

with open('Stock_Portfolio.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Done')
```

- [ ] **Step 2: Run the script**

```
cd D:/2025/AI/MongoDB
python scripts/patch_stock_portfolio.py
```

Expected output:
```
Done
```

- [ ] **Step 3: Verify**

```bash
grep -n "const RAW" Stock_Portfolio.html    # should return nothing
grep -n "const SK" Stock_Portfolio.html     # should return nothing
grep -n "buildRows" Stock_Portfolio.html    # should return nothing
grep -n "const API" Stock_Portfolio.html    # should return line number
grep -n "var data=\[\]" Stock_Portfolio.html  # should return line number
```

- [ ] **Step 4: Commit**

```bash
git add Stock_Portfolio.html scripts/patch_stock_portfolio.py
git commit -m "refactor: remove RAW array and localStorage CRUD from Stock_Portfolio.html"
```

---

### Task 4: Add fetchData, apiPost, sync status UI

**Files:**
- Modify: `Stock_Portfolio.html`

- [ ] **Step 1: Add sync dot to header HTML**

Find in `Stock_Portfolio.html`:
```html
<header>
  <h1>📈 股票交易記錄</h1>
  <span id="hdr-sub">2018 – 2026</span>
</header>
```

Replace with:
```html
<header>
  <h1>📈 股票交易記錄</h1>
  <span id="hdr-sub">2018 – 2026</span>
  <span id="sync-info" style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#64748b">
    <span id="sync-dot" style="width:6px;height:6px;border-radius:50%;background:#f59e0b;display:inline-block;animation:pulse 1s infinite;flex-shrink:0"></span>
    <span id="sync-text">載入中…</span>
  </span>
</header>
```

- [ ] **Step 2: Add pulse keyframes to CSS**

Find `</style>` in the `<head>` and insert before it:

```css
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
```

- [ ] **Step 3: Add fetchData, apiPost, setSyncState after `var data=[];`**

Find in `Stock_Portfolio.html`:
```js
var data=[];
```

Replace with:
```js
var data=[];

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchData(){
  setSyncState('loading','載入中…');
  try{
    var res=await fetch(API+'?sheet='+SHEET+'&t='+Date.now());
    var json=await res.json();
    if(!json.ok)throw new Error('API error');
    data=json.data.map(function(r,i){r._idx=i;return r;});
    setSyncState('ok','同步完成・'+new Date().toLocaleTimeString('zh-TW',{hour12:false}));
    populateFilters(data);
    render();
  }catch(e){
    setSyncState('error','載入失敗');
    document.getElementById('hdr-sub').textContent='載入失敗，請重新整理頁面';
  }
}
async function apiPost(body){
  await fetch(API,{
    method:'POST',
    mode:'no-cors',
    headers:{'Content-Type':'text/plain'},
    body:JSON.stringify(body)
  });
}
function setSyncState(state,text){
  var dot=document.getElementById('sync-dot');
  if(state==='loading'){dot.style.background='#f59e0b';dot.style.animation='pulse 1s infinite';}
  else if(state==='ok'){dot.style.background='#22c55e';dot.style.animation='none';}
  else{dot.style.background='#ef4444';dot.style.animation='none';}
  document.getElementById('sync-text').textContent=text;
}
```

- [ ] **Step 4: Add showToast and delay helpers**

Find:
```js
var sortCol='date', sortDir='desc', curPage=1, perPage=50, editOn=false;
```

Replace with:
```js
var sortCol='date', sortDir='desc', curPage=1, perPage=50, editOn=false;
var toastEl=null, toastTimer;
function showToast(msg,type){
  if(!toastEl){
    toastEl=document.createElement('div');
    toastEl.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(80px);background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:10px 20px;border-radius:10px;font-size:0.85rem;transition:transform 0.3s;z-index:9999;white-space:nowrap';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent=msg;
  toastEl.style.borderColor=type==='error'?'#ef4444':type==='success'?'#22c55e':'#334155';
  toastEl.style.color=type==='error'?'#ef4444':type==='success'?'#22c55e':'#e2e8f0';
  toastEl.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){toastEl.style.transform='translateX(-50%) translateY(80px)';},3000);
}
function delay(ms){return new Promise(function(r){setTimeout(r,ms);});}
```

- [ ] **Step 5: Commit**

```bash
git add Stock_Portfolio.html
git commit -m "feat: add fetchData, apiPost, sync status dot to Stock_Portfolio.html"
```

---

### Task 5: Update CRUD operations to use API

**Files:**
- Modify: `Stock_Portfolio.html`

- [ ] **Step 1: Update showAddModal**

Find:
```js
window.showAddModal=function(){
  showModal(rowFormHtml(null,'＋ 新增交易'));
  document.getElementById('form-save').addEventListener('click',function(){
    var d=collectForm();
    if(!d.date||!d.code){document.getElementById('form-err').textContent='日期和代號為必填';return;}
    var s=getStore();
    d._id='a'+Date.now();d._src='added';
    s.add.push(d);saveStore(s);hideModal();render();
  });
};
```

Replace with:
```js
window.showAddModal=function(){
  showModal(rowFormHtml(null,'＋ 新增交易'));
  document.getElementById('form-save').addEventListener('click',async function(){
    var d=collectForm();
    if(!d.date||!d.code){document.getElementById('form-err').textContent='日期和代號為必填';return;}
    var btn=document.getElementById('form-save');
    btn.disabled=true;btn.textContent='儲存中…';
    try{
      await apiPost({action:'add',sheet:SHEET,
        date:d.date,type:d.type,code:d.code,name:d.name,
        buyShares:d.buyShares,buyPrice:d.buyPrice,sellShares:d.sellShares,sellPrice:d.sellPrice,
        fee:d.fee,tax:d.tax,amount:d.amount,cost:d.cost,spend:d.spend,income:d.income,
        note:d.note,person:d.person});
      hideModal();
      showToast('已新增，同步中…','success');
      await delay(1200);
      await fetchData();
    }catch(e){showToast('新增失敗，請重試','error');}
    btn.disabled=false;btn.textContent='儲存';
  });
};
```

- [ ] **Step 2: Update showEditModal**

Find:
```js
window.showEditModal=function(id){
  var all=buildRows();
  var row=null;all.forEach(function(r){if(r._id===id)row=r;});
  if(!row)return;
  showModal(rowFormHtml(row,'✏️ 修改交易'));
  document.getElementById('form-save').addEventListener('click',function(){
    var d=collectForm();
    if(!d.date||!d.code){document.getElementById('form-err').textContent='日期和代號為必填';return;}
    d._id=id;d._src=row._src;
    var s=getStore();
    if(id.startsWith('r')){s.edit[id]=d;}
    else{s.add=s.add.map(function(r){return r._id===id?d:r;});}
    saveStore(s);hideModal();render();
  });
};
```

Replace with:
```js
window.showEditModal=function(idx){
  var row=data[idx];
  if(!row)return;
  showModal(rowFormHtml(row,'✏️ 修改交易'));
  document.getElementById('form-save').addEventListener('click',async function(){
    var d=collectForm();
    if(!d.date||!d.code){document.getElementById('form-err').textContent='日期和代號為必填';return;}
    var btn=document.getElementById('form-save');
    btn.disabled=true;btn.textContent='儲存中…';
    try{
      await apiPost({action:'update',sheet:SHEET,index:idx,
        date:d.date,type:d.type,code:d.code,name:d.name,
        buyShares:d.buyShares,buyPrice:d.buyPrice,sellShares:d.sellShares,sellPrice:d.sellPrice,
        fee:d.fee,tax:d.tax,amount:d.amount,cost:d.cost,spend:d.spend,income:d.income,
        note:d.note,person:d.person});
      hideModal();
      showToast('已儲存，同步中…','success');
      await delay(1200);
      await fetchData();
    }catch(e){showToast('儲存失敗，請重試','error');}
    btn.disabled=false;btn.textContent='儲存';
  });
};
```

- [ ] **Step 3: Update confirmDel**

Find:
```js
window.confirmDel=function(id){
  showModal('<h3>⚠️ 確認刪除</h3><p style="color:var(--muted);margin-bottom:16px">確定要刪除這筆交易記錄嗎？</p><div class="modal-actions"><button class="btn btn-secondary" onclick="hideModal()">取消</button><button class="btn btn-danger" id="del-yes">確定刪除</button></div>');
  document.getElementById('del-yes').addEventListener('click',function(){
    var s=getStore();
    if(id.startsWith('r')){s.del[id]=1;}
    else{s.add=s.add.filter(function(r){return r._id!==id;});}
    saveStore(s);hideModal();render();
  });
};
```

Replace with:
```js
window.confirmDel=function(idx){
  showModal('<h3>⚠️ 確認刪除</h3><p style="color:var(--muted);margin-bottom:16px">確定要刪除這筆交易記錄嗎？此操作將同步刪除 Google Sheet 資料。</p><div class="modal-actions"><button class="btn btn-secondary" onclick="hideModal()">取消</button><button class="btn btn-danger" id="del-yes">確定刪除</button></div>');
  document.getElementById('del-yes').addEventListener('click',async function(){
    var btn=document.getElementById('del-yes');
    btn.disabled=true;btn.textContent='刪除中…';
    try{
      await apiPost({action:'delete',sheet:SHEET,index:idx});
      hideModal();
      showToast('已刪除，同步中…','success');
      await delay(1200);
      await fetchData();
    }catch(e){showToast('刪除失敗，請重試','error');}
    btn.disabled=false;btn.textContent='確定刪除';
  });
};
```

- [ ] **Step 4: Update renderTable — use `r._idx` for button onclick**

Find in `renderTable`:
```js
html+='<td class="num" style="white-space:nowrap">'+(px?fmtP(px):'<span class="muted">—</span>')+'<button class="act-btn act-edit" style="margin-left:6px" onclick="showEditModal(\''+r._id+'\')">編輯</button><button class="act-btn act-del" onclick="confirmDel(\''+r._id+'\')">刪除</button></td>';
```

Replace with:
```js
html+='<td class="num" style="white-space:nowrap">'+(px?fmtP(px):'<span class="muted">—</span>')+'<button class="act-btn act-edit" style="margin-left:6px" onclick="showEditModal('+r._idx+')">編輯</button><button class="act-btn act-del" onclick="confirmDel('+r._idx+')">刪除</button></td>';
```

- [ ] **Step 5: Commit**

```bash
git add Stock_Portfolio.html
git commit -m "feat: CRUD operations now write to Google Sheet via Apps Script"
```

---

### Task 6: Fix render(), fetchPrices(), and init

**Files:**
- Modify: `Stock_Portfolio.html`

- [ ] **Step 1: Update render() — replace buildRows() with data**

Find:
```js
function render(){
  var all=buildRows();
  var topRows=activePerson?all.filter(function(r){return(r.person||'alex')===activePerson;}):all;
```

Replace with:
```js
function render(){
  var all=data;
  var topRows=activePerson?all.filter(function(r){return(r.person||'alex')===activePerson;}):all;
```

- [ ] **Step 2: Update fetchPrices() — replace both buildRows() calls with data**

There are two occurrences in `fetchPrices`. Find the first:
```js
    var codes=Array.from(new Set(buildRows().map(function(r){return r.code;})));
    // Request both TSE (上市) and OTC (上櫃) variants; API ignores invalid ones
```

Replace with:
```js
    var codes=Array.from(new Set(data.map(function(r){return r.code;})));
    // Request both TSE (上市) and OTC (上櫃) variants; API ignores invalid ones
```

Find the second occurrence:
```js
      var codes2=Array.from(new Set(buildRows().map(function(r){return r.code;})));
```

Replace with:
```js
      var codes2=Array.from(new Set(data.map(function(r){return r.code;})));
```

- [ ] **Step 3: Update init at bottom of script**

Find:
```js
populateFilters(RAW.map(function(r,i){return{_id:'r'+i,date:r[0],type:r[1],code:r[2],name:r[3],person:r[15]};}));
render();
```

Replace with:
```js
fetchData();
```

- [ ] **Step 4: Verify no remaining references to removed functions**

```bash
grep -n "buildRows\|getStore\|saveStore\|const RAW\|const SK" Stock_Portfolio.html
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add Stock_Portfolio.html
git commit -m "feat: Stock_Portfolio.html fully migrated to Google Sheet data source"
```

---

### Task 7: Manual setup steps (performed by user)

These steps are done by the user in the browser, not by the agent.

- [ ] **Step 1: Create Stock_Portfolio sheet tab**

1. Open the Google Sheet:
   `https://docs.google.com/spreadsheets/d/1HbHSaa1EL4zv6JHFOFDTr8pdBJA_QA7Q2E_pQTbWl_0/edit`
2. Click `+` at the bottom to add a new tab
3. Rename it exactly: **`Stock_Portfolio`** (capital S, capital P — must match the JS constant)
4. In cell A1, paste the header row across 16 columns (A1–P1):
   ```
   date  type  code  name  buyShares  buyPrice  sellShares  sellPrice  fee  tax  amount  cost  spend  income  note  person
   ```
5. Open `stock_portfolio_migration.csv`, copy all data rows (skip the header row), paste into A2

- [ ] **Step 2: Replace the Apps Script**

1. In the Google Sheet: **Extensions → Apps Script**
2. Select all existing code (Ctrl+A) and delete
3. Paste the full content of `apps_script/Code.gs`
4. Click **Save** (Ctrl+S)
5. Click **Deploy → Manage deployments**
6. Click the pencil icon (Edit) on the existing deployment
7. Set **Version** to `New version`
8. Click **Deploy**
9. **Copy the deployment URL** (it may change)

- [ ] **Step 3: Update HTML files if the deployment URL changed**

If the new URL differs from:
```
https://script.google.com/macros/s/AKfycbxoXM_4QgCCEzxgy7Oa0dSjUStpovdgyGnhrAP0TQBdkdXp3OgSomfQO92wf2sn5Q-k/exec
```

Update it in **both** files:

In `Stock_Portfolio.html`, find `const API='https://script.google.com/...` and replace the URL.
In `Team_Resources.html`, find `const API = 'https://script.google.com/...` and replace the URL.

```bash
git add Stock_Portfolio.html Team_Resources.html
git commit -m "fix: update Apps Script URL after redeployment"
```

- [ ] **Step 4: Smoke-test Team_Resources.html**

Open `Team_Resources.html` locally or via GitHub Pages.
Expected: sync dot turns green, all existing resource data loads. If it fails, recheck the URL in Step 3.

- [ ] **Step 5: Smoke-test Stock_Portfolio.html end-to-end**

1. Open `Stock_Portfolio.html` locally
2. Sync dot animates yellow → turns green with "同步完成"
3. All ~354 historical rows appear in the table
4. Enable edit mode (use password)
5. Click **＋ 新增**, add a test row (any values), save → toast "已新增，同步中…" → data reloads
6. Verify the test row appears in the Google Sheet `Stock_Portfolio` tab
7. Edit that test row → verify Sheet updates
8. Delete that test row → verify Sheet row is removed

---

### Task 8: Push to GitHub Pages

- [ ] **Step 1: Confirm GitHub Pages is set to `main` branch**

Run:
```bash
gh api repos/lard23chen/report/pages --jq '.source.branch'
```

Expected: `main`

If it shows `master`, fix it at:
`https://github.com/lard23chen/report/settings/pages`
→ Source branch: `main`

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Verify**

Wait ~2 minutes for Pages to rebuild, then open:
`https://lard23chen.github.io/report/Stock_Portfolio.html`

Expected: page loads, sync dot turns green, all data appears.
