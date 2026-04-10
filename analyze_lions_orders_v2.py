
import pandas as pd
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r'D:\2025\AI\MongoDB\Lions_Orders_0309_1800.txt'
output_path = r'D:\2025\AI\MongoDB\A_UniformLions_Order_Analysis_20260309_v2.html'

try:
    # Read the data (TSV format, no header)
    df = pd.read_csv(file_path, sep='\t', header=None, encoding='utf-8-sig')
    
    # Rename columns based on observation
    # 1: MemberNo, 5: TransTime, 6: EventTime, 7: OrderNo, 8: Tickets
    df = df.rename(columns={
        1: 'MemberNo',
        5: 'TransTime',
        6: 'EventTime',
        7: 'OrderNo',
        8: 'Tickets'
    })
    
    # Clean data
    df['TransTime'] = pd.to_datetime(df['TransTime'], errors='coerce')
    df['EventTime'] = pd.to_datetime(df['EventTime'], errors='coerce')
    df = df.dropna(subset=['TransTime'])
    df['Tickets'] = pd.to_numeric(df['Tickets'], errors='coerce').fillna(0).astype(int)
    
    # 1. Summary Metrics
    total_orders = df['OrderNo'].nunique()
    total_tickets = df['Tickets'].sum()
    unique_members = df['MemberNo'].nunique()
    
    # 2. Minute Statistics
    df['Minute'] = df['TransTime'].dt.strftime('%H:%M')
    min_stats = df.groupby('Minute').agg({'OrderNo': 'nunique', 'Tickets': 'sum'}).reset_index()
    min_stats.columns = ['Minute', 'Orders', 'TicketsCount']
    peak_val = min_stats['Orders'].max()
    peak_minute = min_stats.loc[min_stats['Orders'].idxmax(), 'Minute']
    timeline_json = min_stats.sort_values('Minute').to_json(orient='records')
    
    # 3. Tickets per Order Distribution
    qty_dist = df.groupby('OrderNo')['Tickets'].sum().value_counts().sort_index().to_dict()
    qty_dist_json = json.dumps(qty_dist)

    # 4. Events Analysis (Tickets per Event)
    event_dist = df.groupby(df['EventTime'].dt.strftime('%m/%d %H:%M')).agg({'Tickets': 'sum'}).reset_index()
    event_dist.columns = ['Event', 'Tickets']
    event_json = event_dist.sort_values('Tickets', ascending=False).head(20).to_json(orient='records')

    # 5. Top Members (by Orders)
    heavy = df.groupby('MemberNo')['OrderNo'].nunique().sort_values(ascending=False).head(20).reset_index()
    heavy.columns = ['MemberNo', 'OrderCount']
    heavy_json = heavy.to_json(orient='records')

    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>統一獅 3/9 18:00 訂單與張數 深度分析</title>
        <style>
            :root {{ --bg: #0f172a; --surface: #1e293b; --surface2: #263348; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #f97316; }}
            body {{ background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; }}
            header {{ background: var(--surface); padding: 24px 40px; border-bottom: 1px solid var(--border); }}
            h1 {{ color: var(--accent); margin: 0; font-size: 1.6rem; font-weight: 800; }}
            .container {{ max-width: 1400px; margin: 0 auto; padding: 32px; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px; }}
            .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }}
            .card-title {{ font-size: 0.8rem; font-weight: 700; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em; }}
            .stat-value {{ font-size: 2.2rem; font-weight: 800; color: #fff; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
            th {{ text-align: left; padding: 12px; font-size: 0.75rem; color: var(--muted); background: var(--surface2); }}
            td {{ padding: 12px; border-bottom: 1px solid var(--border); }}
            .num {{ text-align: right; font-family: monospace; font-size: 1.1em; }}
            .highlight {{ color: var(--accent); font-weight: 700; }}
        </style>
    </head>
    <body>
    <header>
        <h1>🦁 統一獅 3/9 開賣數據分析報告 (18:00-19:00)</h1>
        <div style="color:var(--muted); margin-top:4px">分析時段：開賣首小時</div>
    </header>
    <div class="container">
        <div class="stats-grid">
            <div class="card" style="border-left: 4px solid var(--accent)">
                <div class="card-title">總訂單筆數 (Unique Orders)</div>
                <div class="stat-value">{total_orders:,}</div>
            </div>
            <div class="card">
                <div class="card-title">總成交張數 (Total Tickets)</div>
                <div class="stat-value">{total_tickets:,}</div>
            </div>
            <div class="card">
                <div class="card-title">參與認證資料一數量</div>
                <div class="stat-value">{unique_members:,}</div>
            </div>
            <div class="card">
                <div class="card-title">巔峰成交分鐘</div>
                <div class="stat-value" style="color:var(--accent)">{peak_minute}</div>
                <div style="font-size:0.8rem; color:var(--muted); margin-top:4px">該分鐘成交 {peak_val:,} 筆訂單</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 32px;">
            <div class="card">
                <div class="card-title">⏱️ 每分鐘成交對照 (訂單 vs 張數)</div>
                <table id="timeline-table"></table>
            </div>
            <div>
                <div class="card" style="margin-bottom:24px">
                    <div class="card-title">📦 單筆購買張數分佈</div>
                    <table id="qty-table"></table>
                </div>
                <div class="card">
                    <div class="card-title">🏆 活躍認證資料一排名 (依訂單筆數)</div>
                    <table id="heavy-table"></table>
                </div>
            </div>
        </div>
    </div>

    <script>
        const timeline = {timeline_json};
        const qtyDist = {qty_dist_json};
        const heavy = {heavy_json};

        // Render Timeline
        let timeHtml = '<thead><tr><th>時段</th><th class="num">訂單筆數</th><th class="num">張數</th></tr></thead><tbody>';
        timeline.forEach(d => {{
            timeHtml += `<tr><td class="highlight">${{d.Minute}}</td><td class="num highlight">${{d.Orders.toLocaleString()}}</td><td class="num">${{d.TicketsCount.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('timeline-table').innerHTML = timeHtml + '</tbody>';

        // Render Qty
        let qtyHtml = '<thead><tr><th>單筆購買張數</th><th class="num">訂單筆數</th></tr></thead><tbody>';
        for(let q in qtyDist) {{
            qtyHtml += `<tr><td class="highlight">${{q}} 張</td><td class="num">${{qtyDist[q].toLocaleString()}}</td></tr>`;
        }}
        document.getElementById('qty-table').innerHTML = qtyHtml + '</tbody>';

        // Render Heavy
        let heavyHtml = '<thead><tr><th>認證資料一</th><th class="num">訂單筆數</th></tr></thead><tbody>';
        heavy.forEach(d => {{
            heavyHtml += `<tr><td class="highlight">${{d.MemberNo}}</td><td class="num highlight">${{d.OrderCount.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('heavy-table').innerHTML = heavyHtml + '</tbody>';
    </script>
    </body>
    </html>
    """
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"SUCCESS: Created {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
