
import pandas as pd
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
file_path = r'D:\2025\AI\MongoDB\Lions_Orders_March9_1800.txt'
output_path = r'D:\2025\AI\MongoDB\A_UniformLions_Order_Analysis_20260309.html'

try:
    # Read the data (TSV format)
    df = pd.read_csv(file_path, sep='\t', encoding='utf-8-sig', header=0)
    
    # Identify columns by content since headers are garbled
    # Expected columns: [Seq, MemNo, Name, Channel, TransTime, EventTime, OrderNo]
    # We will pick the columns based on their index to be safe
    # Based on preview: 
    # Index 1: MemberNo, Index 4: TransTime, Index 5: EventTime, Index 6: OrderNo
    
    cols = df.columns.tolist()
    df = df.rename(columns={
        cols[1]: 'MemberNo',
        cols[4]: 'TransTime',
        cols[5]: 'EventTime',
        cols[6]: 'OrderNo'
    })
    
    # Clean times
    df['TransTime'] = pd.to_datetime(df['TransTime'], errors='coerce')
    df['EventTime'] = pd.to_datetime(df['EventTime'], errors='coerce')
    df = df.dropna(subset=['TransTime'])
    
    # 1. Summary Stats
    total_orders = len(df)
    unique_members = df['MemberNo'].nunique()
    peak_minute = df['TransTime'].dt.strftime('%H:%M').value_counts().idxmax()
    peak_val = df['TransTime'].dt.strftime('%H:%M').value_counts().max()

    # 2. Minute-by-Minute Timeline
    timeline = df.groupby(df['TransTime'].dt.strftime('%H:%M')).size().reset_index()
    timeline.columns = ['Minute', 'Count']
    timeline_json = timeline.to_json(orient='records')
    
    # 3. Analysis by Event Date (賽事分佈)
    event_dist = df.groupby(df['EventTime'].dt.strftime('%m/%d %H:%M')).size().reset_index()
    event_dist.columns = ['Event', 'Count']
    event_json = event_dist.sort_values('Count', ascending=False).to_json(orient='records')

    # 4. Top Members (Heavy Buyers)
    heavy_buyers = df['MemberNo'].value_counts().head(20).reset_index()
    heavy_buyers.columns = ['MemberNo', 'OrderCount']
    heavy_json = heavy_buyers.to_json(orient='records')

    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>統一獅 3/9 18:00-19:00 訂單分析</title>
        <style>
            :root {{ --bg: #0f172a; --surface: #1e293b; --surface2: #263348; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #f97316; }}
            body {{ background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; }}
            header {{ background: var(--surface); padding: 20px 40px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }}
            h1 {{ color: var(--accent); margin: 0; font-size: 1.4rem; }}
            .container {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px; }}
            .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }}
            .card-title {{ font-size: 0.9rem; font-weight: 700; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; }}
            .stat-value {{ font-size: 1.8rem; font-weight: 800; color: #fff; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
            th {{ text-align: left; padding: 10px; font-size: 0.75rem; color: var(--muted); background: var(--surface2); }}
            td {{ padding: 10px; border-bottom: 1px solid var(--border); }}
            .num {{ text-align: right; font-family: monospace; font-size: 1.1em; }}
            .highlight {{ color: var(--accent); font-weight: 700; }}
            .chart-bar {{ background: var(--accent); height: 8px; border-radius: 4px; display: inline-block; }}
        </style>
    </head>
    <body>
    <header>
        <h1>🦁 統一獅 3/9 18:00-19:00 開賣分析</h1>
        <div style="color:var(--muted)">Data Source: Lions_Orders_March9_1800.txt</div>
    </header>
    <div class="container">
        <div class="stats-grid">
            <div class="card">
                <div class="card-title">總訂單筆數</div>
                <div class="stat-value">{total_orders:,}</div>
            </div>
            <div class="card">
                <div class="card-title">參與購買會員數</div>
                <div class="stat-value">{unique_members:,}</div>
            </div>
            <div class="card">
                <div class="card-title">最巔峰分鐘 (18:xx)</div>
                <div class="stat-value" style="color:var(--accent)">{peak_minute}</div>
                <div style="font-size:0.85rem; color:var(--muted)">成交筆數: {peak_val:,}</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 2fr 1fr; gap: 24px;">
            <div class="card">
                <div class="card-title">每分鐘成交明細 (Timeline)</div>
                <table id="timeline-table"></table>
            </div>
            <div class="card">
                <div class="card-title">各賽事日期銷售熱度</div>
                <table id="event-table"></table>
            </div>
        </div>

        <div class="card" style="margin-top:24px">
            <div class="card-title">高頻購買會員排名 (Top 20)</div>
            <table id="heavy-table"></table>
        </div>
    </div>

    <script>
        const timeline = {timeline_json};
        const events = {event_json};
        const heavy = {heavy_json};

        // Render Timeline
        let timeHtml = '<thead><tr><th>交易時間 (18:xx)</th><th class="num">成交筆數</th><th>分佈圖</th></tr></thead><tbody>';
        timeline.forEach(d => {{
            let pct = (d.Count / {peak_val} * 100).toFixed(0);
            timeHtml += `<tr><td class="highlight">${{d.Minute}}</td><td class="num">${{d.Count.toLocaleString()}}</td><td><div class="chart-bar" style="width:${{pct}}%"></div></td></tr>`;
        }});
        document.getElementById('timeline-table').innerHTML = timeHtml + '</tbody>';

        // Render Events
        let eventHtml = '<thead><tr><th>賽事日期</th><th class="num">筆數</th></tr></thead><tbody>';
        events.forEach(d => {{
            eventHtml += `<tr><td>${{d.Event}}</td><td class="num highlight">${{d.Count.toLocaleString()}}</td></tr>`;
        }});
        document.getElementById('event-table').innerHTML = eventHtml + '</tbody>';

        // Render Heavy Buyers
        let heavyHtml = '<thead><tr><th>會員編號</th><th class="num">成交筆數</th></tr></thead><tbody>';
        heavy.forEach(d => {{
            heavyHtml += `<tr><td class="highlight">${{d.MemberNo}}</td><td class="num">${{d.OrderCount.toLocaleString()}}</td></tr>`;
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
