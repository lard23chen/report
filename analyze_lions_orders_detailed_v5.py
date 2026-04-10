
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
    # Data Format Check: [Seq] [MemNo] [Name] [Channel] [TransTime] [EventTime] [OrderNo]
    for line in lines[1:]:
        # Split by tabs (ensure we get OrderNo correctly)
        parts = re.split(r'\t', line.strip())
        
        # Correctly identify TransTime (18:xx)
        trans_times = [p for p in parts if "2026/03/09 18:" in p]
        if trans_times:
            trans_time = trans_times[0]
            # EventTime is usually another date in the row
            other_dates = [p for p in parts if "/" in p and p != trans_time]
            event_time = other_dates[0] if other_dates else "Unknown"
            # MemNo is part 1
            mem_no = parts[1] if len(parts) > 1 else "Unknown"
            
            # OrderNo Identification: Look for the specific "A26..." pattern or pick the last part
            order_no = "Unknown"
            for p in parts:
                if p.startswith('A26') and len(p) > 10:
                    order_no = p
                    break
            
            data.append({'MemberNo': mem_no, 'TransTime': trans_time, 'EventTime': event_time, 'OrderNo': order_no})

    df = pd.DataFrame(data)
    if df.empty:
        print("Error: No data.")
        sys.exit(1)

    # 1. Core Metrics
    total_tickets = len(df) # Every row is a ticket
    total_orders = df['OrderNo'].nunique() # Unique OrderNo count
    unique_members = df['MemberNo'].nunique()

    # 2. Minute Stats (Minute of Transaction)
    df['Minute'] = df['TransTime'].str.extract(r'(\d{2}:\d{2})')
    # Minute analysis based on unique OrderNo and total tickets
    min_stats = df.groupby('Minute').agg({'OrderNo': 'nunique', 'MemberNo': 'count'}).reset_index()
    min_stats.columns = ['Minute', 'Orders', 'Tickets']
    peak_val = min_stats['Orders'].max()
    peak_minute = min_stats.loc[min_stats['Orders'].idxmax(), 'Minute']
    timeline_json = min_stats.sort_values('Minute').to_json(orient='records')
    
    # 3. Events Distribution (Tickets count)
    event_dist = df['EventTime'].value_counts().reset_index()
    event_dist.columns = ['Event', 'Tickets']
    event_json = event_dist.head(30).to_json(orient='records')

    # 4. Heavy Buyers (Ranking by Orders count)
    heavy = df.groupby('MemberNo')['OrderNo'].nunique().sort_values(ascending=False).head(20).reset_index()
    heavy.columns = ['MemberNo', 'OrderCount']
    heavy_json = heavy.to_json(orient='records')

    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>統一獅 3/9 18:00-19:00 訂單張數分析</title>
        <style>
            :root {{ --bg: #0f172a; --surface: #1e293b; --surface2: #263348; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #f97316; }}
            body {{ background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; }}
            header {{ background: var(--surface); padding: 20px 40px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }}
            h1 {{ color: var(--accent); margin: 0; font-size: 1.4rem; font-weight: 800; }}
            .container {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }}
            .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }}
            .card-title {{ font-size: 0.85rem; font-weight: 700; color: var(--muted); margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.05em; }}
            .stat-value {{ font-size: 2rem; font-weight: 800; color: #fff; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
            th {{ text-align: left; padding: 12px; font-size: 0.75rem; color: var(--muted); background: var(--surface2); text-transform: uppercase; }}
            td {{ padding: 10px 12px; border-bottom: 1px solid var(--border); }}
            .num {{ text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 1.1em; }}
            .highlight {{ color: var(--accent); font-weight: 700; }}
            .bar-container {{ width: 100%; background: var(--surface2); height: 8px; border-radius: 4px; overflow: hidden; }}
            .bar {{ background: var(--accent); height: 100%; border-radius: 4px; }}
        </style>
    </head>
    <body>
    <header>
        <h1>🦁 統一獅 3/9 開賣首小時深度分析 (18:00-19:00)</h1>
        <div style="color:var(--muted)">總成交：{total_tickets:,} 張</div>
    </header>
    <div class="container">
        <div class="stats-grid">
            <div class="card">
                <div class="card-title">總訂單筆數 (Orders)</div>
                <div class="stat-value" style="color:var(--accent)">{total_orders:,}</div>
            </div>
            <div class="card">
                <div class="card-title">總成交張數 (Tickets)</div>
                <div class="stat-value">{total_tickets:,}</div>
            </div>
            <div class="card">
                <div class="card-title">認證資料一數量 (Uniq)</div>
                <div class="stat-value">{unique_members:,}</div>
            </div>
            <div class="card">
                <div class="card-title">最巔峰成交分鐘</div>
                <div class="stat-value" style="color:var(--accent)">{peak_minute}</div>
                <div style="font-size:0.9rem; color:var(--muted); margin-top:4px">該分鐘成交 {peak_val:,} 筆訂單</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div class="card">
                <div class="card-title">⏱️ 每分鐘成交趨勢 (訂單筆數 vs 張數)</div>
                <table id="timeline-table"></table>
            </div>
            <div>
                <div class="card" style="margin-bottom:24px">
                    <div class="card-title">🏆 活躍認證資料一排名 (依訂單筆數)</div>
                    <table id="heavy-table"></table>
                </div>
                <div class="card">
                    <div class="card-title">🏟️ 賽事日期銷售張數熱度</div>
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
        let timeHtml = '<thead><tr><th>時段</th><th class="num">訂單筆數</th><th class="num">張數</th><th style="width:40%">趨勢 (訂單)</th></tr></thead><tbody>';
        timeline.forEach(d => {{
            let pct = (d.Orders / {peak_val} * 100).toFixed(0);
            timeHtml += `<tr><td class="highlight">${{d.Minute}}</td><td class="num">${{d.Orders.toLocaleString()}}</td><td class="num">${{d.Tickets.toLocaleString()}}</td><td><div class="bar-container"><div class="bar" style="width:${{pct}}%"></div></div></td></tr>`;
        }});
        document.getElementById('timeline-table').innerHTML = timeHtml + '</tbody>';

        // Render Heavy
        let heavyHtml = '<thead><tr><th>認證資料一</th><th class="num">訂單筆數</th></tr></thead><tbody>';
        heavy.forEach(d => {{
            heavyHtml += `<tr><td class="highlight">${{d.MemberNo}}</td><td class="num">${{d.OrderCount.toLocaleString()}}</td></tr>`;
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
