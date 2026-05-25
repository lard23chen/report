import streamlit as st
from bson import ObjectId
import base64
import pandas as pd
from travel_db import get_col, CATEGORIES, PAYERS, CURRENCIES, CAT_EMOJI, PAYER_COLOR, strip_emoji, COMMON_CSS

st.set_page_config(page_title="📋 消費明細", page_icon="📋", layout="wide")
st.markdown(COMMON_CSS, unsafe_allow_html=True)

col = get_col()

# ── Header ────────────────────────────────────────────────
hd, back = st.columns([5, 1])
hd.title("📋 消費明細")
back.page_link("travel_expense_app.py", label="＋ 新增消費", use_container_width=True)

# ── Load ──────────────────────────────────────────────────
data = list(col.find().sort([("date", -1), ("createdAt", -1)]))
for d in data:
    d["_id"] = str(d["_id"])

if not data:
    st.info("還沒有消費記錄，回到新增頁面開始記帳。")
    st.stop()

# ── KPI ───────────────────────────────────────────────────
total  = sum(d.get("amount", 0) for d in data)
alex   = sum(d.get("amount", 0) for d in data if d.get("payer") == "ALEX")
mark   = sum(d.get("amount", 0) for d in data if d.get("payer") == "MARK")

k1, k2, k3, k4 = st.columns(4)
k1.metric("總消費金額", f"{total:,.0f}", f"{len(data)} 筆")
k2.metric("🤴 ALEX 負擔", f"{alex:,.0f}", f"{total and f'{alex/total*100:.0f}%' or '—'}")
k3.metric("👨 MARK 負擔", f"{mark:,.0f}", f"{total and f'{mark/total*100:.0f}%' or '—'}")
k4.metric("消費天數", len({d.get('date') for d in data}))

st.divider()

# ── Filters ───────────────────────────────────────────────
f1, f2, f3 = st.columns(3)
fp  = f1.selectbox("付款人", ["全部"] + [strip_emoji(p) for p in PAYERS])
fc  = f2.selectbox("類別",   ["全部"] + [strip_emoji(c) for c in CATEGORIES])
fur = f3.selectbox("幣別",   ["全部"] + CURRENCIES)

filtered = [
    d for d in data
    if (fp  == "全部" or d.get("payer")    == fp)
    and (fc  == "全部" or d.get("category") == fc)
    and (fur == "全部" or d.get("currency") == fur)
]

st.caption(f"顯示 {len(filtered)} / {len(data)} 筆")

# ── List ──────────────────────────────────────────────────
if not filtered:
    st.warning("沒有符合條件的記錄")
else:
    by_date = {}
    for d in filtered:
        by_date.setdefault(d.get("date", "未知"), []).append(d)

    from datetime import date
    today_str = date.today().isoformat()

    for day in sorted(by_date.keys(), reverse=True):
        day_items = by_date[day]
        day_total = sum(d.get("amount", 0) for d in day_items)
        label = f"📅 {day}　·　{len(day_items)} 筆　·　小計 {day_total:,.0f}"
        with st.expander(label, expanded=(day == today_str)):
            for d in day_items:
                emoji = CAT_EMOJI.get(d.get("category", ""), "💬")
                pc    = PAYER_COLOR.get(d.get("payer", ""), "⚪")
                r1, r2 = st.columns([8, 1])
                with r1:
                    note_str = f"　📝 _{d['note']}_" if d.get("note") else ""
                    receipt_badge = "　🧾" if d.get("receiptImage") else ""
                    st.markdown(
                        f"{emoji} **{d.get('item','—')}**　"
                        f"`{d.get('amount',0):,.0f} {d.get('currency','')}`　"
                        f"{pc} {d.get('payer','')}　"
                        f"_{d.get('paymentMethod','')}_"
                        f"{note_str}{receipt_badge}"
                    )
                    if d.get("receiptImage"):
                        with st.expander("🧾 查看收據"):
                            img_bytes = base64.b64decode(d["receiptImage"])
                            st.image(img_bytes, use_container_width=True)
                with r2:
                    if st.button("🗑️", key=f"del_{d['_id']}", help="刪除此筆"):
                        col.delete_one({"_id": ObjectId(d["_id"])})
                        st.rerun()

st.divider()

# ── Stats ─────────────────────────────────────────────────
st.subheader("📊 統計分析")
s1, s2 = st.columns(2)

with s1:
    st.markdown("**🗂️ 類別統計**")
    cat_map = {}
    for d in data:
        k = d.get("category", "其他")
        cat_map[k] = cat_map.get(k, 0) + d.get("amount", 0)
    if cat_map:
        df = pd.DataFrame(
            [(CAT_EMOJI.get(k,"💬") + " " + k, f"{v:,.0f}") for k, v in sorted(cat_map.items(), key=lambda x: -x[1])],
            columns=["類別", "金額"]
        )
        st.dataframe(df, use_container_width=True, hide_index=True)

with s2:
    st.markdown("**👤 付款人統計**")
    payer_map = {}
    for d in data:
        k = d.get("payer", "其他")
        payer_map[k] = payer_map.get(k, 0) + d.get("amount", 0)
    if payer_map and total > 0:
        df = pd.DataFrame(
            [(PAYER_COLOR.get(k,"⚪") + " " + k, f"{v:,.0f}", f"{v/total*100:.1f}%")
             for k, v in sorted(payer_map.items(), key=lambda x: -x[1])],
            columns=["付款人", "金額", "佔比"]
        )
        st.dataframe(df, use_container_width=True, hide_index=True)

st.caption(f"共 {len(data)} 筆　· 點擊 🔄 重新整理")
if st.button("🔄 重新整理"):
    st.rerun()
