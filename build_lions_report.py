
import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r'D:\2025\AI\MongoDB\中華職棒37年例行賽統一獅主場（上）_會員購買明細.xls'

try:
    dfs = pd.read_html(file_path, encoding='utf-8')
    df = dfs[0]
    
    # Locate header robustly
    header_row_idx = -1
    for i, row in df.iterrows():
        row_str = ' '.join(row.fillna('').astype(str))
        if '訂單編號' in row_str or '交易時間' in row_str:
            header_row_idx = i
            break
            
    if header_row_idx != -1:
        df.columns = df.iloc[header_row_idx]
        df = df.iloc[header_row_idx+1:].reset_index(drop=True)
    
    df.columns = [str(c).strip() for c in df.columns]
    time_col = next(c for c in df.columns if '時間' in c)
    qty_col = next((c for c in df.columns if '數量' in c or '張數' in c), None)
    order_col = '訂單編號' if '訂單編號' in df.columns else time_col
    
    df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
    df = df.dropna(subset=[time_col])
    df[qty_col] = pd.to_numeric(df[qty_col], errors='coerce').fillna(1)
    
    # Analysis 1: Daily Summary
    df['Date'] = df[time_col].dt.strftime('%Y-%m-%d')
    daily = df.groupby('Date').agg({order_col: 'nunique', qty_col: 'sum'}).reset_index()
    daily.columns = ['Date', 'Orders', 'Tickets']
    daily_json = daily.to_json(orient='records')
    
    # Analysis 2: Peak Hours
    df['Hour'] = df[time_col].dt.strftime('%Y-%m-%d %H:00')
    hourly = df.groupby('Hour').agg({order_col: 'nunique', qty_col: 'sum'}).reset_index()
    hourly.columns = ['Time', 'Orders', 'Tickets']
    hourly_json = hourly.sort_values('Orders', ascending=False).to_json(orient='records')
    
    # Analysis 3: Peak Minutes
    df['Minute'] = df[time_col].dt.strftime('%Y-%m-%d %H:%M')
    minutes = df.groupby('Minute').agg({order_col: 'nunique', qty_col: 'sum'}).reset_index()
    minutes.columns = ['Minute', 'Orders', 'Tickets']
    minutes_json = minutes.sort_values('Orders', ascending=False).head(30).to_json(orient='records')
    
    # Analysis 4: Qty Distribution (How many tickets per order)
    qty_dist = df.groupby(order_col)[qty_col].sum().value_counts().sort_index().to_dict()
    qty_dist_json = json.dumps(qty_dist)
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>統一獅會員購買明細 - 深度分析報表</title>
        <style>
            :root {{ --bg: #0f172a; --surface: #1e293b; --surface2: #263348; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #f97316; }}
            body {{ background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; }}
            header {{ background: var(--surface); padding: 20px 40px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }}
            h1 {{ color: var(--accent); margin: 0; font-size: 1.4rem; }}
            .container {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}
            .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 32px; }}
            .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }}
            .card-title {{ font-size: 0.9rem; font-weight: 700; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
            th {{ text-align: left; padding: 10px; font-size: 0.75rem; color: var(--muted); background: var(--surface2); }}
            td {{ padding: 10px; border-bottom: 1px solid var(--border); }}
            .num {{ text-align: right; font-family: monospace; font-size: 1.1em; }}
            .highlight {{ color: var(--accent); font-weight: 700; }}
            .tabs {{ display: flex; gap: 8px; margin-bottom: 16px; }}
            .tab {{ padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--muted); }}
            .tab.active {{ background: var(--accent); color: #000; border-color: var(--accent); font-weight: 700; }}
            .view {{ display: none; }}
            .view.active {{ display: block; }}
        </style>
    </head>
    <body>
    <header>
        <h1>🦁 統一獅會員購票明細深度分析 (37年上)</h1>
        <div style="color:var(--muted)">總成交：{len(df)} 筆 / {int(df[qty_col].sum())} 張</div>
    </header>
    <div class="container">
        <div class="tabs">
            <div class="tab active" onclick="showView('summary')">📊 總體總表</div>
            <div class="tab" onclick="showView('detail')">🔍 每日明細</div>
            <div class="tab" onclick="showView('peaks')">⚡ 巔峰時段</div>
        </div>

        <!-- 總體總表 -->
        <div id="summary" class="view active">
            <div class="grid">
                <div class="card">
                    <div class="card-title">購票張數分佈 (一筆訂單買幾張)</div>
                    <table id="qty-table"></table>
                </div>
                <div class="card">
                    <div class="card-title">各時段開賣力道 (每小時)</div>
                    <table id="hourly-table"></table>
                </div>
            </div>
        </div>

        <!-- 每日明細 -->
        <div id="detail" class="view">
            <div class="card">
                <div class="card-title">每日購買量統計</div>
                <table id="daily-table"></table>
            </div>
        </div>

        <!-- 巔峰時段 -->
        <div id="peaks" class="view">
            <div class="card">
                <div class="card-title">最繁忙分鐘排行 (前 30 名)</div>
                <table id="peak-minutes-table"></table>
            </div>
        </div>
    </div>

    <script>
        const dailyData = {daily_json};
        const hourlyData = {hourly_json};
        const peakMinutes = {minutes_json};
        const qtyDist = {qty_dist_json};

        function showView(id) {{
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            event.target.classList.add('active');
        }}

        // Populate Qty Dist
        let qtyHtml = '<thead><tr><th>購買張數</th><th class="num">訂單筆數</th></tr></thead><tbody>';
        for(let q in qtyDist) {{
            qtyHtml += `<tr><td class="highlight">${{q}} 張</td><td class="num">${{qtyDist[q].toLocaleString()}}</td></tr>`;
        }}
        document.getElementById('qty-table').innerHTML = qtyHtml + '</tbody>';

        // Populate Daily
        let dailyHtml = '<thead><tr><th>交易日期</th><th class="num">成交筆數</th><th class="num">成交張數</th></tr></thead><tbody>';
        dailyData.sort((a,b)=>b.Date.localeCompare(a.Date)).forEach(d => {{
            dailyHtml += `<tr><td>${{d.Date}}</td><td class="num highlight">${{d.Orders.toLocaleString()}}</td><td class="num">${{d.Tickets.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('daily-table').innerHTML = dailyHtml + '</tbody>';

        // Populate Hourly
        let hourlyHtml = '<thead><tr><th>時段</th><th class="num">成交筆數</th></tr></thead><tbody>';
        hourlyData.slice(0, 10).forEach(h => {{
            hourlyHtml += `<tr><td>${{h.Time}}</td><td class="num highlight">${{h.Orders.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('hourly-table').innerHTML = hourlyHtml + '</tbody>';

        // Populate Peak Minutes
        let peakHtml = '<thead><tr><th>分鐘</th><th class="num">成交筆數</th><th class="num">成交張數</th></tr></thead><tbody>';
        peakMinutes.forEach(m => {{
            peakHtml += `<tr><td class="highlight">${{m.Minute}}</td><td class="num">${{m.Orders.toLocaleString()}}</td><td class="num">${{m.Tickets.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('peak-minutes-table').innerHTML = peakHtml + '</tbody>';
    </script>
    </body>
    </html>
    """
    
    with open('A_UniformLions_Detailed_Analysis.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("HTML 報表已產出：A_UniformLions_Detailed_Analysis.html")

except Exception as e:
    print(f"Error: {e}")
