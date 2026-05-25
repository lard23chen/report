import streamlit as st
from pymongo import MongoClient

@st.cache_resource
def get_col():
    uri = st.secrets["MONGO_URI"]
    client = MongoClient(uri)
    return client["AlexLIFE"]["TravelExpense"]

CATEGORIES  = ["🍽️ 餐飲", "🚗 交通", "🏨 住宿", "🛍️ 購物", "🎫 景點", "💆 SPA", "🧋 飲品", "💬 其他"]
PAY_METHODS = ["💵 現金", "💳 信用卡", "📱 Scan to pay", "💰 其他"]
PAYERS      = ["🤴 ALEX", "👨 MARK", "🏦 泰國帳戶", "💰 其他"]
CURRENCIES  = ["TWD", "THB", "JPY", "USD", "HKD", "KRW"]
CAT_EMOJI   = {"餐飲":"🍽️","交通":"🚗","住宿":"🏨","購物":"🛍️","景點":"🎫","SPA":"💆","飲品":"🧋","其他":"💬"}
PAYER_COLOR = {"ALEX":"🔵","MARK":"🟡","泰國帳戶":"🟢","其他":"🟣"}

def strip_emoji(s):
    return s.split(" ", 1)[-1] if " " in s else s

COMMON_CSS = """
<style>
/* ── Base ─────────────────────────────────────────────── */
.stApp { background-color: #071426; }
.block-container { padding-top: 1.5rem; max-width: 960px; }

/* ── Global text (dark bg needs explicit light text) ──── */
.stApp p, .stApp span, .stApp div,
.stApp li, .stApp td, .stApp th { color: #cbd5e1; }

/* ── Headings ─────────────────────────────────────────── */
h1, h2, h3, h4,
[data-testid="stHeadingWithActionElements"] h1,
[data-testid="stHeadingWithActionElements"] h2,
[data-testid="stHeadingWithActionElements"] h3 { color: #00d4aa !important; }

/* ── Metric cards ─────────────────────────────────────── */
[data-testid="stMetric"] {
    background: #0d1f3c;
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid rgba(0,212,170,.15);
}
[data-testid="stMetricValue"],
[data-testid="stMetricValue"] > div,
[data-testid="stMetricValue"] label { color: #00d4aa !important; font-weight: 800; }
[data-testid="stMetricLabel"],
[data-testid="stMetricLabel"] > div,
[data-testid="stMetricLabel"] label { color: #6a8eaa !important; }
[data-testid="stMetricDelta"] { color: #94a3b8 !important; }

/* ── Form card ────────────────────────────────────────── */
[data-testid="stForm"] {
    background: #0d1f3c !important;
    border-radius: 16px; padding: 20px;
    border: 1px solid rgba(0,212,170,.15);
}

/* ── Buttons ──────────────────────────────────────────── */
.stButton > button, [data-testid="stFormSubmitButton"] > button {
    background: linear-gradient(135deg, #00d4aa, #0096ff) !important;
    color: #000 !important; font-weight: 700; border: none;
    border-radius: 10px; transition: opacity .2s;
}
.stButton > button:hover { opacity: .85; }

/* ── Widget labels ────────────────────────────────────── */
.stSelectbox label, .stTextInput label, .stNumberInput label,
.stDateInput label, .stRadio label, .stRadio > label,
[data-testid="stWidgetLabel"] p,
[data-testid="stWidgetLabel"] {
    color: #6a8eaa !important; font-size: .78rem;
    text-transform: uppercase; letter-spacing: .05em;
}

/* ── Radio horizontal ─────────────────────────────────── */
.row-widget.stRadio > div,
[data-testid="stRadio"] > div { flex-direction: row; flex-wrap: wrap; gap: 8px; }
</style>
"""
