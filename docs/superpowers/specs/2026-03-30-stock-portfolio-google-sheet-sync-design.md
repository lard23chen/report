# Stock_Portfolio.html — Google Sheet Sync Design

Date: 2026-03-30

## Goal

Replace the hardcoded `RAW` array and `localStorage`-based CRUD in `Stock_Portfolio.html` with a Google Sheet as the single source of truth, using the same Apps Script + Sheet already serving `Team_Resources.html`.

---

## Architecture

```
Stock_Portfolio.html
  ↕ fetch (GET)   → Apps Script (doGet)  → Sheet tab "Stock_Portfolio"
  ↕ fetch (POST)  → Apps Script (doPost) → Sheet tab "Stock_Portfolio"

Team_Resources.html (unchanged behaviour)
  ↕ fetch (GET/POST) → same Apps Script → Sheet tab "Team_Resources"
```

The existing Apps Script is **replaced** (not patched) with a new version that routes by an optional `sheet` query/body parameter:
- Default `sheet` = `"Team_Resources"` → existing behaviour preserved, no breaking change.
- `sheet` = `"Stock_Portfolio"` → new 16-column tab.

---

## Google Sheet Layout

Sheet tab name: **`Stock_Portfolio`**

Row 1 = header (frozen):

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| date | type | code | name | buyShares | buyPrice | sellShares | sellPrice | fee | tax | amount | cost | spend | income | note | person |

Rows 2+ = data. No formula columns; all plain values.

---

## Apps Script (complete replacement)

### doGet(e)

```
sheet = e.parameter.sheet || "Team_Resources"
→ open named sheet tab
→ read all rows (skip header)
→ return JSON: { ok: true, data: [...] }
```

For `Team_Resources`: each row → `{ item, url, note }`
For `Stock_Portfolio`: each row → `{ date, type, code, name, buyShares, buyPrice, sellShares, sellPrice, fee, tax, amount, cost, spend, income, note, person }`

### doPost(e)

```
body = JSON.parse(e.postData.contents)
sheet = body.sheet || "Team_Resources"
action = body.action  // "add" | "update" | "delete"
```

For `Team_Resources`: existing add/update/delete logic (unchanged).
For `Stock_Portfolio`:
- `add`: append a new row with all 16 fields.
- `update`: overwrite row at `body.index + 2` (1-based + header offset).
- `delete`: delete row at `body.index + 2`.

Both sheets use `index` = 0-based position in the data array (matching the JS side).

---

## Stock_Portfolio.html Changes

### Removed
- `const RAW = [...]` — entire array (~350 rows, ~350 lines)
- `const SK = 'stock_crud_v1'` and `getStore()` / `saveStore()`
- `buildRows()` function (replaced by `data` array fetched from API)

### Added / Changed

**Constants**
```js
const API = '<existing Apps Script URL>';
const SHEET = 'Stock_Portfolio';
```

**On load**: call `fetchData()` (same pattern as Team_Resources).

**fetchData()**
- Show loading spinner in header (sync dot).
- `GET API?sheet=Stock_Portfolio&t=Date.now()`
- On success: `data = json.data`; call `populateFilters(data)` + `render()`.
- On error: show error state with retry button.

**apiPost(body)**
- Same `no-cors` POST as Team_Resources, but always includes `sheet: SHEET`.

**buildRows()** → removed; all functions that called it now use `data` directly.

**Add modal save**
```js
await apiPost({ action: 'add', sheet: SHEET, ...fields });
await delay(1200); await fetchData();
```

**Edit modal save**
```js
await apiPost({ action: 'update', sheet: SHEET, index: rowIndex, ...fields });
await delay(1200); await fetchData();
```

**Delete confirm**
```js
await apiPost({ action: 'delete', sheet: SHEET, index: rowIndex });
await delay(1200); await fetchData();
```

**Sync status indicator** (header): same dot + text pattern as Team_Resources.

**Price cache**: `localStorage` key `stock_prices` unchanged — prices are ephemeral and not stored in Sheet.

**Password-protected edit mode**: logic unchanged.

---

## Data Migration

One-time step performed by the user before going live:

1. Open the Google Sheet.
2. Create a new tab named exactly `Stock_Portfolio`.
3. Paste the header row (16 columns listed above) into row 1.
4. Paste the CSV data (generated from the existing `RAW` array) into rows 2+.

A migration CSV will be generated as a separate deliverable (`stock_portfolio_migration.csv`).

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| API fetch fails on load | Sync dot turns red, error message in table body, reload button enabled |
| POST fails (no-cors, can't detect) | Show "已儲存，同步中…" toast then re-fetch; if re-fetch returns old data, user sees no change |
| Sheet tab missing | doGet returns `{ ok: false }`; page shows error state |

No retry loops. User manually retries via reload button.

---

## Out of Scope

- Real-time multi-user conflict resolution.
- Undo/redo.
- Sheet formula columns.
- Migrating existing `localStorage` overrides (user confirmed: discard).
