
import pandas as pd
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')
file_path = r'D:\2025\AI\MongoDB\Lions_Orders_March9_1800.txt'
output_path = r'D:\2025\AI\MongoDB\A_UniformLions_Order_Analysis_20260309.html'

try:
    # Read raw to handle delimiters
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    
    data = []
    # Header is lines[0]
    # Format: [Seq] [MemNo] [Name] [Channel] [TransTime] [EventTime] [OrderNo]
    for line in lines[1:]:
        parts = re.split(r'\t', line.strip())
        # The preview shows TransTime is around index 4 or 5 depending on tabs
        # Let's find parts that look like dates "2026/03/09 18:xx"
        times = [p for p in parts if "2026/03/09 18:" in p]
        if times:
            trans_time = times[0]
            # Try to find event time (another date)
            other_dates = [p for p in parts if "/" in p and p != trans_time]
            event_time = other_dates[0] if other_dates else "Unknown"
            # MemNo is likely the second part
            mem_no = parts[1] if len(parts) > 1 else "Unknown"
            data.append({'MemberNo': mem_no, 'TransTime': trans_time, 'EventTime': event_time})

    df = pd.DataFrame(data)
    if df.empty:
        print("Error: No valid data extracted.")
        sys.exit(1)

    # 1. Summary
    total_orders = len(df)
    unique_members = df['MemberNo'].nunique()
    # Extract minute from "2026/03/09 18:11" -> "18:11"
    df['Minute'] = df['TransTime'].str.extract(r'(\d{2}:\d{2})')
    minute_counts = df['Minute'].value_counts()
    peak_minute = minute_counts.idxmax()
    peak_val = minute_counts.max()

    # 2. Timeline
    timeline = minute_counts.sort_index().reset_index()
    timeline.columns = ['Minute', 'Count']
    timeline_json = timeline.to_json(orient='records')
    
    # 3. Events
    event_dist = df['EventTime'].value_counts().reset_index()
    event_dist.columns = ['Event', 'Count']
    event_json = event_dist.head(30).to_json(orient='records')

    # 4. Heavy Buyers
    heavy = df['MemberNo'].value_counts().head(20).reset_index()
    heavy.columns = ['MemberNo', 'OrderCount']
    heavy_json = heavy.to_json(orient='records')

    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>統一獅 3/9 18:00-19:00 訂單深度分析</title>
        <style>
            :root {{ --bg: #0f172a; --surface: #1e293b; --surface2: #263348; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #f97316; }}
            body {{ background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; }}
            header {{ background: var(--surface); padding: 20px 40px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }}
            h1 {{ color: var(--accent); margin: 0; font-size: 1.4rem; font-weight: 800; }}
            .container {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px; }}
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
        <h1>🦁 統一獅 3/9 開賣首小時訂單分析 (18:00-19:00)</h1>
        <div style="color:var(--muted)">總成交：{total_orders:,} 筆</div>
    </header>
    <div class="container">
        <div class="stats-grid">
            <div class="card">
                <div class="card-title">總訂單筆數 (Total Orders)</div>
                <div class="stat-value">{total_orders:,}</div>
            </div>
            <div class="card">
                <div class="card-title">參與認證資料一數量 (Uniq)</div>
                <div class="stat-value">{unique_members:,}</div>
            </div>
            <div class="card">
                <div class="card-title">最巔峰成交分鐘 (Peak)</div>
                <div class="stat-value" style="color:var(--accent)">{peak_minute}</div>
                <div style="font-size:0.9rem; color:var(--muted); margin-top:4px">當分鐘成交 {peak_val:,} 筆</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div class="card">
                <div class="card-title">⏱️ 每分鐘成交趨勢 (Timeline)</div>
                <table id="timeline-table"></table>
            </div>
            <div>
                <div class="card" style="margin-bottom:24px">
                    <div class="card-title">🏆 購買活躍認證資料一排名 (Top 20)</div>
                    <table id="heavy-table"></table>
                </div>
                <div class="card">
                    <div class="card-title">🏟️ 賽事日期銷售熱度</div>
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
        let timeHtml = '<thead><tr><th>時段 (18:xx)</th><th class="num">筆數</th><th style="width:50%">趨勢</th></tr></thead><tbody>';
        timeline.forEach(d => {{
            let pct = (d.Count / {peak_val} * 100).toFixed(0);
            timeHtml += `<tr><td class="highlight">${{d.Minute}}</td><td class="num">${{d.Count.toLocaleString()}}</td><td><div class="bar-container"><div class="bar" style="width:${{pct}}%"></div></div></td></tr>`;
        }});
        document.getElementById('timeline-table').innerHTML = timeHtml + '</tbody>';

        // Render Heavy
        let heavyHtml = '<thead><tr><th>認證資料一</th><th class="num">成交筆數</th></tr></thead><tbody>';
        heavy.forEach(d => {{
            heavyHtml += `<tr><td class="highlight">${{d.MemberNo}}</td><td class="num">${{d.OrderCount.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('heavy-table').innerHTML = heavyHtml + '</tbody>';

        // Render Events
        let eventHtml = '<thead><tr><th>賽事日期</th><th class="num">筆數</th></tr></thead><tbody>';
        events.forEach(d => {{
            eventHtml += `<tr><td>${{d.Event}}</td><td class="num highlight">${{d.Count.toLocaleString()}}</td></tr>`;
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
