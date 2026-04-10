
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r'D:\2025\AI\MongoDB\中華職棒37年例行賽統一獅主場（上）_會員購買明細.xls'

try:
    dfs = pd.read_html(file_path, encoding='utf-8')
    df = dfs[0]
    
    # Locate header
    header_row_idx = -1
    for i, row in df.iterrows():
        row_str = ' '.join(row.astype(str))
        if '訂單編號' in row_str or '交易時間' in row_str:
            header_row_idx = i
            break
            
    if header_row_idx != -1:
        df.columns = df.iloc[header_row_idx]
        df = df.iloc[header_row_idx+1:].reset_index(drop=True)
    
    df.columns = [str(c).strip() for c in df.columns]
    time_col = next(c for c in df.columns if '時間' in c)
    qty_col = next((c for c in df.columns if '數量' in c or '張數' in c), None)
    
    df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
    df = df.dropna(subset=[time_col])
    
    # Filter for 3/29 18:00-19:00
    mask = (df[time_col] >= '2026-03-29 18:00:00') & (df[time_col] < '2026-03-29 19:00:00')
    target = df[mask].copy()
    
    if target.empty:
        print("該時段 (2026-03-29 18:00-19:00) 無成交資料。")
    else:
        print(f"### 2026-03-29 18:00-19:00 專案分析 ###")
        print(f"總筆數: {len(target)}")
        if qty_col:
            target[qty_col] = pd.to_numeric(target[qty_col], errors='coerce').fillna(1)
            print(f"總張數: {int(target[qty_col].sum())}")
        
        print("\n[每分鐘成交分佈]")
        print(target.groupby(target[time_col].dt.strftime('%H:%M')).size().to_string())
        
        print("\n[秒級密集成交 (每秒成交 > 1 筆)]")
        sec_stats = target.groupby(target[time_col].dt.strftime('%H:%M:%S')).size()
        print(sec_stats[sec_stats > 1].to_string())

except Exception as e:
    print(f"分析錯誤: {e}")
