
import pandas as pd
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')
file_path = r'D:\2025\AI\MongoDB\Lions_Orders_March9_1800.txt'
output_path = r'D:\2025\AI\MongoDB\A_UniformLions_Order_Analysis_20260309.html'

try:
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    
    data = []
    for line in lines[1:]:
        parts = re.split(r'\t', line.strip())
        trans_times = [p for p in parts if "2026/03/09 18:" in p]
        if trans_times:
            trans_time = trans_times[0]
            other_dates = [p for p in parts if "/" in p and p != trans_time]
            event_time = other_dates[0] if other_dates else "Unknown"
            mem_no = parts[1] if len(parts) > 1 else "Unknown"
            # Extract OrderNo (starting with A26)
            order_no = "Unknown"
            match = re.search(r'A26\d+', line)
            if match:
                order_no = match.group()
            
            data.append({'MemberNo': mem_no, 'TransTime': trans_time, 'EventTime': event_time, 'OrderNo': order_no})

    df = pd.DataFrame(data)
    if df.empty:
        print("Error: No data.")
        sys.exit(1)

    # Core Stats
    total_tickets = len(df) # 7832
    total_orders = df['OrderNo'].nunique() # 7831
    unique_members = df['MemberNo'].nunique() # 3027

    # Minute Stats
    df['Minute'] = df['TransTime'].str.extract(r'(\d{2}:\d{2})')
    min_stats = df.groupby('Minute').agg({'OrderNo': 'nunique', 'MemberNo': 'count'}).reset_index()
    min_stats.columns = ['Minute', 'Orders', 'Tickets']
    peak_val_orders = min_stats['Orders'].max()
    peak_minute = min_stats.loc[min_stats['Orders'].idxmax(), 'Minute']
    timeline_json = min_stats.sort_values('Minute').to_json(orient='records')
    
    # Event Stats
    event_dist = df['EventTime'].value_counts().reset_index()
    event_dist.columns = ['Event', 'Tickets']
    event_json = event_dist.head(30).to_json(orient='records')

    # Heavy Member Ranking
    heavy = df.groupby('MemberNo')['OrderNo'].nunique().sort_values(ascending=False).head(20).reset_index()
    heavy.columns = ['MemberNo', 'OrderCount']
    heavy_json = heavy.to_json(orient='records')

    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>統一獅 3/9 18:00 訂單 vs 張數 分析報告</title>
        <style>
            :root {{ --bg: #0f172a; --surface: #1e293b; --surface2: #263348; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #f97316; }}
            body {{ background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; }}
            header {{ background: var(--surface); padding: 24px 40px; border-bottom: 1px solid var(--border); }}
            h1 {{ color: var(--accent); margin: 0; font-size: 1.6rem; font-weight: 800; }}
            .container {{ max-width: 1400px; margin: 0 auto; padding: 32px; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 40px; }}
            .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }}
            .card-title {{ font-size: 0.8rem; font-weight: 700; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em; }}
            .stat-value {{ font-size: 2.2rem; font-weight: 800; color: #fff; line-height: 1.2; }}
            .stat-unit {{ font-size: 0.9rem; color: var(--muted); margin-left: 4px; font-weight: 500; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
            th {{ text-align: left; padding: 12px; font-size: 0.75rem; color: var(--muted); background: var(--surface2); border-radius: 4px; }}
            td {{ padding: 12px; border-bottom: 1px solid var(--border); }}
            .num {{ text-align: right; font-family: 'JetBrains Mono', monospace; }}
            .highlight {{ color: var(--accent); font-weight: 700; }}
            .bar-container {{ width: 100%; background: var(--surface2); height: 8px; border-radius: 4px; overflow: hidden; }}
            .bar {{ background: var(--accent); height: 100%; border-radius: 4px; }}
        </style>
    </head>
    <body>
    <header>
        <h1>🦁 統一獅 3/9 開賣數據分析報告 (18:00-19:00)</h1>
        <div style="color:var(--muted); margin-top:4px">分析樣本：{total_tickets:,} 行原始數據</div>
    </header>
    <div class="container">
        <!-- 數據卡片 -->
        <div class="stats-grid">
            <div class="card" style="border-left: 4px solid var(--accent)">
                <div class="card-title">總訂單筆數</div>
                <div class="stat-value">{total_orders:,} <span class="stat-unit">筆</span></div>
                <div style="font-size:0.8rem; color:var(--muted); margin-top:8px">不重複訂單編號</div>
            </div>
            <div class="card">
                <div class="card-title">總成交張數</div>
                <div class="stat-value">{total_tickets:,} <span class="stat-unit">張</span></div>
                <div style="font-size:0.8rem; color:var(--muted); margin-top:8px">成交總數 (行數)</div>
            </div>
            <div class="card">
                <div class="card-title">參與認證資料一數量</div>
                <div class="stat-value">{unique_members:,} <span class="stat-unit">位</span></div>
                <div style="font-size:0.8rem; color:var(--muted); margin-top:8px">不重複 8 位數 ID</div>
            </div>
            <div class="card">
                <div class="card-title">巔峰成交分鐘</div>
                <div class="stat-value" style="color:var(--accent)">{peak_minute}</div>
                <div style="font-size:0.8rem; color:var(--muted); margin-top:8px">該分鐘成交 {peak_val_orders:,} 筆訂單</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap: 32px;">
            <!-- 時間軸 -->
            <div class="card">
                <div class="card-title">⏱️ 每分鐘成交對照 (訂單 vs 張數)</div>
                <table id="timeline-table"></table>
            </div>
            <div>
                <!-- 會員排名 -->
                <div class="card" style="margin-bottom:24px">
                    <div class="card-title">🏆 認證資料一活躍排行 (依訂單筆數)</div>
                    <table id="heavy-table"></table>
                </div>
                <!-- 賽事分布 -->
                <div class="card">
                    <div class="card-title">🏟️ 賽事場次分布 (張數統計)</div>
                    <table id="event-table"></table>
                </div>
            </div>
        </div>
    </div>

    <script>
        const timeline = {timeline_json};
        const events = {event_json};
        const heavy = {heavy_json};

        // Render Timeline
        let timeHtml = '<thead><tr><th>時段</th><th class="num">訂單筆數</th><th class="num">成交張數</th><th style="width:30%">趨勢</th></tr></thead><tbody>';
        timeline.forEach(d => {{
            let pct = (d.Orders / {peak_val_orders} * 100).toFixed(0);
            timeHtml += `<tr><td class="highlight">${{d.Minute}}</td><td class="num highlight">${{d.Orders.toLocaleString()}}</td><td class="num">${{d.Tickets.toLocaleString()}}</td><td><div class="bar-container"><div class="bar" style="width:${{pct}}%"></div></div></td></tr>`;
        }});
        document.getElementById('timeline-table').innerHTML = timeHtml + '</tbody>';

        // Render Heavy
        let heavyHtml = '<thead><tr><th>認證資料一</th><th class="num">訂單筆數</th></tr></thead><tbody>';
        heavy.forEach(d => {{
            heavyHtml += `<tr><td class="highlight">${{d.MemberNo}}</td><td class="num highlight">${{d.OrderCount.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('heavy-table').innerHTML = heavyHtml + '</tbody>';

        // Render Events
        let eventHtml = '<thead><tr><th>賽事日期</th><th class="num">銷售張數</th></tr></thead><tbody>';
        events.forEach(d => {{
            eventHtml += `<tr><td>${{d.Event}}</td><td class="num highlight">${{d.Tickets.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('event-table').innerHTML = eventHtml + '</tbody>';
    </script>
    </body>
    </html>
    """
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"SUCCESS: Created {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
