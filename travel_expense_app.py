import streamlit as st
from datetime import date, datetime
from travel_db import get_col, CATEGORIES, PAY_METHODS, PAYERS, CURRENCIES, strip_emoji, COMMON_CSS

st.set_page_config(page_title="✈️ 旅遊記帳", page_icon="✈️", layout="centered")
st.markdown(COMMON_CSS, unsafe_allow_html=True)

col = get_col()

# ── Header ────────────────────────────────────────────────
st.title("✈️ 旅遊記帳助手")
st.caption("AlexLIFE DB · TravelExpense Collection")

# ── 快速 KPI ──────────────────────────────────────────────
data = list(col.find({}, {"amount":1, "payer":1, "date":1}).sort("createdAt", -1))
today_str = date.today().isoformat()
total  = sum(d.get("amount", 0) for d in data)
alex   = sum(d.get("amount", 0) for d in data if d.get("payer") == "ALEX")
mark   = sum(d.get("amount", 0) for d in data if d.get("payer") == "MARK")
today_n = sum(1 for d in data if d.get("date") == today_str)

k1, k2, k3, k4 = st.columns(4)
k1.metric("總消費", f"{total:,.0f}", f"{len(data)} 筆")
k2.metric("🤴 ALEX", f"{alex:,.0f}")
k3.metric("👨 MARK", f"{mark:,.0f}")
k4.metric("今日筆數", today_n)

st.divider()

# ── 新增表單 ───────────────────────────────────────────────
st.subheader("📝 新增消費")

with st.form("add_form", clear_on_submit=True):
    category   = st.radio("消費類別", CATEGORIES, horizontal=True)
    item       = st.text_input("消費項目", placeholder="例：晚餐 / BTS 票 / 按摩")
    c1, c2     = st.columns([3, 1])
    amount     = c1.number_input("金額", min_value=0.0, step=1.0, format="%.0f")
    currency   = c2.selectbox("幣別", CURRENCIES)
    pay_method = st.radio("付款方式", PAY_METHODS, horizontal=True)
    payer      = st.radio("付款人",   PAYERS,      horizontal=True)
    exp_date   = st.date_input("日期", value=date.today())
    note       = st.text_input("備注", placeholder="選填")
    submitted  = st.form_submit_button("✅ 確認送出", use_container_width=True)

if submitted:
    if not item.strip():
        st.error("請填寫消費項目")
    elif amount <= 0:
        st.error("請填寫金額")
    else:
        col.insert_one({
            "date":          exp_date.isoformat(),
            "category":      strip_emoji(category),
            "item":          item.strip(),
            "amount":        float(amount),
            "currency":      currency,
            "paymentMethod": strip_emoji(pay_method),
            "payer":         strip_emoji(payer),
            "note":          note.strip(),
            "createdAt":     datetime.utcnow(),
        })
        st.success(f"✅ 已新增：{item.strip()}　{amount:,.0f} {currency}")
        st.rerun()

st.divider()

# ── 查看明細按鈕 ───────────────────────────────────────────
if st.button("📋 查看消費明細", use_container_width=True):
    st.switch_page("pages/detail.py")
