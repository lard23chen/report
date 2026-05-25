import streamlit as st
import base64
import io
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

def compress_image(img_file, max_px=1024, quality=72):
    from PIL import Image
    img = Image.open(img_file).convert("RGB")
    img.thumbnail((max_px, max_px), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode(), "image/jpeg"

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

    st.markdown("<p style='color:#6a8eaa;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px'>📸 收據憑證（選填）</p>", unsafe_allow_html=True)
    ri1, ri2 = st.columns(2)
    receipt_cam  = ri1.camera_input("拍攝收據", label_visibility="collapsed")
    receipt_file = ri2.file_uploader("上傳圖片", type=["jpg","jpeg","png","heic"], label_visibility="collapsed")

    submitted = st.form_submit_button("✅ 確認送出", use_container_width=True)

if submitted:
    if not item.strip():
        st.error("請填寫消費項目")
    elif amount <= 0:
        st.error("請填寫金額")
    else:
        receipt_src = receipt_cam or receipt_file
        receipt_b64, receipt_type = (None, None)
        if receipt_src:
            try:
                receipt_b64, receipt_type = compress_image(receipt_src)
            except Exception:
                pass

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
        if receipt_b64:
            doc["receiptImage"] = receipt_b64
            doc["receiptType"]  = receipt_type

        col.insert_one(doc)
        st.success(f"✅ 已新增：{item.strip()}　{amount:,.0f} {currency}" + ("　🧾" if receipt_b64 else ""))
        st.rerun()

st.divider()

# ── 查看明細按鈕（另開新分頁）─────────────────────────────
st.markdown("""
<a href="https://report-kql5mwjfdwxmzdg5n5gd7u.streamlit.app/detail" target="_blank"
   style="display:block;text-align:center;padding:13px;margin-top:4px;
   background:linear-gradient(135deg,#00d4aa,#0096ff);
   color:#000;font-weight:700;border-radius:10px;text-decoration:none;font-size:1rem;
   font-family:sans-serif;">
   📋 查看消費明細
</a>
""", unsafe_allow_html=True)
