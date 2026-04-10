
import pandas as pd
import sys
import os

# Set encoding for output
sys.stdout.reconfigure(encoding='utf-8')

file_path = r'D:\2025\AI\MongoDB\中華職棒37年例行賽統一獅主場（上）_會員購買明細.xls'

try:
    # Read HTML table from the "XLS" file
    # The file is HTML format as confirmed by previous check
    dfs = pd.read_html(file_path, encoding='utf-8')
    df = dfs[0]
    
    # Cleaning: The first row might be metadata (seen "蝭桀蝔")
    # Let's find where the real header is. Usually it's the row after "蝭桀蝔" or similar.
    # Looking at the sample: the first <tr> has 2 columns, metadata.
    # The actual table headers are likely in the next few rows.
    
    # Try to find the row that contains '訂單編號' or '交易時間'
    header_row_idx = -1
    for i, row in df.iterrows():
        row_str = ' '.join(row.astype(str))
        if '訂單編號' in row_str or '交易時間' in row_str or '訂購時間' in row_str:
            header_row_idx = i
            break
            
    if header_row_idx != -1:
        # Re-set columns based on found header row
        df.columns = df.iloc[header_row_idx]
        df = df.iloc[header_row_idx+1:].reset_index(drop=True)
    
    # Columns we care about (based on typical Lions member report):
    # '訂單編號', '訂購時間' or '交易時間', '數量' or '張數'
    
    # Normalize column names (strip spaces, etc.)
    df.columns = [str(c).strip() for c in df.columns]
    
    # Identify time column and quantity column
    time_col = next((c for c in df.columns if '時間' in c), None)
    qty_col = next((c for c in df.columns if '數量' in c or '張數' in c), None)
    order_col = next((c for c in df.columns if '訂單' in c), None)
    
    if not time_col:
        print(f"Error: Could not find time column. Available columns: {df.columns.tolist()}")
        sys.exit(1)

    # Convert to datetime
    df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
    df = df.dropna(subset=[time_col])
    
    # Convert quantity to numeric
    if qty_col:
        df[qty_col] = pd.to_numeric(df[qty_col], errors='coerce').fillna(0)
    else:
        # If no quantity column, each row is 1 ticket? (Check first)
        df['Counts'] = 1
        qty_col = 'Counts'

    # Analysis by Hour
    df['Hour'] = df[time_col].dt.strftime('%Y-%m-%d %H:00')
    hourly_stats = df.groupby('Hour').agg({
        order_col if order_col else time_col: 'nunique',
        qty_col: 'sum'
    }).rename(columns={
        (order_col if order_col else time_col): '筆數',
        qty_col: '張數'
    })
    
    print("\n### 每小時統計 (前 10 筆繁忙時段) ###")
    print(hourly_stats.sort_values('筆數', ascending=False).head(10).to_string())
    
    # Analysis by Minute (for high peak)
    df['Minute'] = df[time_col].dt.strftime('%Y-%m-%d %H:%M')
    minute_stats = df.groupby('Minute').agg({
        order_col if order_col else time_col: 'nunique',
        qty_col: 'sum'
    }).rename(columns={
        (order_col if order_col else time_col): '筆數',
        qty_col: '張數'
    })
    
    print("\n### 每分鐘統計 (最繁忙的前 10 分鐘) ###")
    print(minute_stats.sort_values('筆數', ascending=False).head(10).to_string())
    
    # Save results to CSV for user to query later
    hourly_stats.to_csv('lions_hourly_stats.csv')
    minute_stats.to_csv('lions_minute_stats.csv')
    print("\n統計結果已存至 lions_hourly_stats.csv 與 lions_minute_stats.csv")

except Exception as e:
    print(f"An error occurred: {e}")
    # Print columns to help debug if it fails
    if 'df' in locals():
        print("Columns found:", df.columns.tolist())
