
import pandas as pd
import json
import os

file_path = r'D:\2025\AI\MongoDB\中華職棒37年例行賽統一獅主場（上）_會員購買明細.xls'
output_path = r'D:\2025\AI\MongoDB\A_UniformLions_Detailed_Analysis.html'

try:
    # Read the pseudo-XLS (HTML format)
    dfs = pd.read_html(file_path, encoding='utf-8')
    df = dfs[0]
    
    # Robust header detection: find the row that contains '訂單編號'
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
    
    # Clean data
    df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
    df = df.dropna(subset=[time_col])
    if qty_col:
        df[qty_col] = pd.to_numeric(df[qty_col], errors='coerce').fillna(1)
    else:
        df['Counts'] = 1
        qty_col = 'Counts'

    # Stats
    df['Date'] = df[time_col].dt.strftime('%Y-%m-%d')
    daily = df.groupby('Date').agg({order_col: 'nunique', qty_col: 'sum'}).reset_index()
    daily.columns = ['Date', 'Orders', 'Tickets']
    
    df['Minute'] = df[time_col].dt.strftime('%Y-%m-%d %H:%M')
    minutes = df.groupby('Minute').agg({order_col: 'nunique', qty_col: 'sum'}).reset_index()
    minutes.columns = ['Minute', 'Orders', 'Tickets']
    
    qty_dist = df.groupby(order_col)[qty_col].sum().value_counts().sort_index().to_dict()

    # Build HTML
    html = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>統一獅 37年上 會員購買深度分析</title>
        <style>
            body {{ background: #0f172a; color: #e2e8f0; font-family: sans-serif; padding: 20px; }}
            h1 {{ color: #f97316; }}
            .card {{ background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ text-align: left; color: #94a3b8; padding: 10px; border-bottom: 1px solid #334155; }}
            td {{ padding: 10px; border-bottom: 1px solid #334155; }}
            .num {{ text-align: right; font-family: monospace; }}
            .highlight {{ color: #f97316; font-weight: bold; }}
        </style>
    </head>
    <body>
        <h1>🦁 統一獅會員購買深度分析 (37年上)</h1>
        
        <div class="card">
            <h3>📊 每日總覽統計 (Total: {len(df)} 筆)</h3>
            <table>
                <thead><tr><th>日期</th><th class="num">訂單筆數</th><th class="num">總張數</th></tr></thead>
                <tbody>
                    {"".join([f"<tr><td>{r['Date']}</td><td class='num highlight'>{int(r['Orders']):,}</td><td class='num'>{int(r['Tickets']):,}</td></tr>" for r in daily.to_dict('records')])}
                </tbody>
            </table>
        </div>

        <div class="card">
            <h3>⚡ 巔峰分鐘排行 (Top 20)</h3>
            <table>
                <thead><tr><th>時間</th><th class="num">筆數</th><th class="num">張數</th></tr></thead>
                <tbody>
                    {"".join([f"<tr><td>{r['Minute']}</td><td class='num highlight'>{int(r['Orders']):,}</td><td class='num'>{int(r['Tickets']):,}</td></tr>" for r in minutes.sort_values('Orders', ascending=False).head(20).to_dict('records')])}
                </tbody>
            </table>
        </div>

        <div class="card">
            <h3>📦 購買張數分佈</h3>
            <table>
                <thead><tr><th>單筆購買張數</th><th class="num">訂單筆數</th></tr></thead>
                <tbody>
                    {"".join([f"<tr><td>{q} 張</td><td class='num highlight'>{c:,}</td></tr>" for q, c in qty_dist.items()])}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    """
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"SUCCESS: Created {output_path}")

except Exception as e:
    print(f"FAILED: {e}")
