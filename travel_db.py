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
/* layout */
.block-container { padding-top: 1.5rem; max-width: 960px; }

/* form card border */
[data-testid="stForm"] {
    border-radius: 16px;
    border: 1px solid rgba(0,212,170,.25);
    padding: 20px;
}

/* metric card border */
[data-testid="stMetric"] {
    border-radius: 12px;
    border: 1px solid rgba(0,212,170,.15);
    padding: 12px 16px;
}

/* button gradient */
.stButton > button,
[data-testid="stFormSubmitButton"] > button {
    background: linear-gradient(135deg, #00d4aa, #0096ff) !important;
    color: #000 !important;
    font-weight: 700;
    border: none;
    border-radius: 10px;
}
</style>
"""
