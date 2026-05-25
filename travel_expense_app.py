import streamlit as st
from pymongo import MongoClient
from datetime import date, datetime
from bson import ObjectId
import pandas as pd

st.set_page_config(
    page_title="✈️ 旅遊記帳助手",
    page_icon="✈️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    .stApp { background-color: #071426; }
    .block-container { padding-top: 1.5rem; max-width: 1400px; }
    h1, h2, h3 { color: #00d4aa !important; }
    .stButton > button {
        background: linear-gradient(135deg, #00d4aa, #0096ff);
        color: #000; font-weight: 700; border: none;
        border-radius: 10px; padding: .55rem 1.2rem;
        transition: opacity .2s;
    }
    .stButton > button:hover { opacity: .85; }
    div[data-testid="stMetricValue"] { color: #00d4aa; font-size: 1.8rem !important; font-weight: 800; }
    div[data-testid="stMetricLabel"] { color: #6a8eaa; }
    .stSelectbox label, .stTextInput label, .stNumberInput label,
    .stDateInput label, .stRadio label { color: #6a8eaa !important; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; }
    .stDataFrame { background: #0d1f3c; }
    .row-widget.stRadio > div { flex-direction: row; flex-wrap: wrap; gap: 8px; }
    div[data-testid="stForm"] { background: #0d1f3c; border-radius: 16px; padding: 20px; border: 1px solid rgba(0,212,170,.15); }
    .kpi-note { color: #6a8eaa; font-size: .78rem; margin-top: -10px; }
    .stAlert { border-radius: 12px; }
    .stSuccess { background: rgba(0,212,170,.1) !important; color: #00d4aa !important; }
    .delete-btn { color: #ff5252 !important; background: none !important; border: 1px solid rgba(255,82,82,.3) !important; padding: 2px 8px !important; font-size: .75rem !important; }
</style>
""", unsafe_allow_html=True)


# ── MongoDB ──────────────────────────────────────────────
@st.cache_resource
def get_col():
    # On Streamlit Cloud: set MONGO_URI in App Settings → Secrets
    # Local: create .streamlit/secrets.toml with MONGO_URI = "..."
    uri = st.secrets["MONGO_URI"]
    client = MongoClient(uri)
    return client["AlexLIFE"]["TravelExpense"]

col = get_col()


# ── Constants ─────────────────────────────────────────────
CATEGORIES  = ["🍽️ 餐飲", "🚗 交通", "🏨 住宿", "🛍️ 購物", "🎫 景點", "💆 SPA", "🧋 飲品", "💬 其他"]
PAY_METHODS = ["💵 現金", "💳 信用卡", "📱 Scan to pay", "💰 其他"]
PAYERS      = ["🤴 ALEX", "👨 MARK", "🏦 泰國帳戶", "💰 其他"]
CURRENCIES  = ["TWD", "THB", "JPY", "USD", "HKD", "KRW"]
CAT_EMOJI   = {"餐飲":"🍽️","交通":"🚗","住宿":"🏨","購物":"🛍️","景點":"🎫","SPA":"💆","飲品":"🧋","其他":"💬"}
PAYER_COLORS= {"ALEX":"🔵","MARK":"🟡","泰國帳戶":"🟢","其他":"🟣"}

def strip_emoji(s):
    """Remove leading emoji + space from button label."""
    return s.split(" ", 1)[-1] if " " in s else s


# ── Load data ─────────────────────────────────────────────
def load_data():
    docs = list(col.find().sort([("date", -1), ("createdAt", -1)]))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


# ── Header ────────────────────────────────────────────────
st.title("✈️ 旅遊記帳助手")
st.caption("MongoDB 即時同步 · AlexLIFE DB · TravelExpense Collection")

# ── KPI row ───────────────────────────────────────────────
data = load_data()
today_str = date.today().isoformat()

total_amt   = sum(d.get("amount", 0) for d in data)
alex_amt    = sum(d.get("amount", 0) for d in data if d.get("payer") == "ALEX")
mark_amt    = sum(d.get("amount", 0) for d in data if d.get("payer") == "MARK")
today_items = [d for d in data if d.get("date") == today_str]
today_amt   = sum(d.get("amount", 0) for d in today_items)

k1, k2, k3, k4 = st.columns(4)
k1.metric("總消費金額", f"{total_amt:,.0f}", f"{len(data)} 筆")
k2.metric("🤴 ALEX 負擔", f"{alex_amt:,.0f}", f"{sum(1 for d in data if d.get('payer')=='ALEX')} 筆")
k3.metric("👨 MARK 負擔", f"{mark_amt:,.0f}", f"{sum(1 for d in data if d.get('payer')=='MARK')} 筆")
k4.metric("今日消費筆數", len(today_items), f"今日 {today_amt:,.0f}")

st.divider()

# ── Main layout ───────────────────────────────────────────
left, right = st.columns([1, 1.8], gap="large")

# ── Form (left) ───────────────────────────────────────────
with left:
    st.subheader("📝 新增消費")
    with st.form("expense_form", clear_on_submit=True):

        category = st.radio("消費類別", CATEGORIES, horizontal=True)

        item = st.text_input("消費項目", placeholder="例：晚餐 / BTS 票 / 按摩")

        c1, c2 = st.columns([3, 1])
        amount   = c1.number_input("金額", min_value=0.0, step=1.0, format="%.0f")
        currency = c2.selectbox("幣別", CURRENCIES)

        pay_method = st.radio("付款方式", PAY_METHODS, horizontal=True)
        payer      = st.radio("付款人",   PAYERS,      horizontal=True)

        exp_date = st.date_input("日期", value=date.today())
        note     = st.text_input("備注", placeholder="額外說明（選填）")

        submitted = st.form_submit_button("✅ 確認送出", use_container_width=True)

    if submitted:
        if not item.strip():
            st.error("請填寫消費項目")
        elif amount <= 0:
            st.error("請填寫金額")
        else:
            doc = {
                "date":          exp_date.isoformat(),
                "category":      strip_emoji(category),
                "item":          item.strip(),
                "amount":        float(amount),
                "currency":      currency,
                "paymentMethod": strip_emoji(pay_method),
                "payer":         strip_emoji(payer),
                "note":          note.strip(),
                "createdAt":     datetime.utcnow(),
            }
            col.insert_one(doc)
            st.success(f"✅ 已新增：{item.strip()}  {amount:,.0f} {currency}")
            st.rerun()

# ── List (right) ──────────────────────────────────────────
with right:
    st.subheader("📋 消費明細")

    # Filters
    f1, f2, f3 = st.columns(3)
    fp  = f1.selectbox("付款人", ["全部"] + [strip_emoji(p) for p in PAYERS], key="fp")
    fc  = f2.selectbox("類別",   ["全部"] + [strip_emoji(c) for c in CATEGORIES], key="fc")
    fur = f3.selectbox("幣別",   ["全部"] + CURRENCIES, key="fur")

    filtered = [
        d for d in data
        if (fp  == "全部" or d.get("payer")    == fp)
        and (fc  == "全部" or d.get("category") == fc)
        and (fur == "全部" or d.get("currency") == fur)
    ]

    if not filtered:
        st.info("沒有符合條件的記錄")
    else:
        # Group by date
        by_date = {}
        for d in filtered:
            k = d.get("date", "未知")
            by_date.setdefault(k, []).append(d)

        for day in sorted(by_date.keys(), reverse=True):
            day_total = sum(d.get("amount", 0) for d in by_date[day])
            with st.expander(f"📅 {day}　小計 {day_total:,.0f}", expanded=(day == today_str)):
                for d in by_date[day]:
                    emoji = CAT_EMOJI.get(d.get("category", ""), "💬")
                    pc    = PAYER_COLORS.get(d.get("payer", ""), "⚪")
                    r1, r2 = st.columns([6, 1])
                    with r1:
                        st.markdown(
                            f"**{emoji} {d.get('item','—')}**　"
                            f"`{d.get('amount',0):,.0f} {d.get('currency','')}`　"
                            f"{pc} {d.get('payer','')}　"
                            f"_{d.get('paymentMethod','')}_ "
                            + (f"　📝 {d.get('note','')}" if d.get("note") else "")
                        )
                    with r2:
                        if st.button("🗑️", key=f"del_{d['_id']}", help="刪除"):
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
        cat_map[d.get("category", "其他")] = cat_map.get(d.get("category", "其他"), 0) + d.get("amount", 0)
    if cat_map:
        df_cat = pd.DataFrame(
            [(CAT_EMOJI.get(k,"💬") + " " + k, v) for k, v in sorted(cat_map.items(), key=lambda x: -x[1])],
            columns=["類別", "金額"]
        )
        st.dataframe(df_cat, use_container_width=True, hide_index=True)

with s2:
    st.markdown("**👤 付款人統計**")
    payer_map = {}
    for d in data:
        payer_map[d.get("payer", "其他")] = payer_map.get(d.get("payer", "其他"), 0) + d.get("amount", 0)
    if payer_map and total_amt > 0:
        df_payer = pd.DataFrame(
            [(PAYER_COLORS.get(k,"⚪") + " " + k, v, f"{v/total_amt*100:.1f}%")
             for k, v in sorted(payer_map.items(), key=lambda x: -x[1])],
            columns=["付款人", "金額", "佔比"]
        )
        st.dataframe(df_payer, use_container_width=True, hide_index=True)

# ── Footer ────────────────────────────────────────────────
st.caption(f"資料筆數：{len(data)} 筆　· 最後更新：{datetime.now().strftime('%H:%M:%S')}")
if st.button("🔄 重新整理"):
    st.rerun()
