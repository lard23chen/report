
import pandas as pd
import sys

input_path = r'D:\2025\AI\MongoDB\會員訂單.txt'
output_path = r'D:\2025\AI\MongoDB\Lions_Orders_March9_1800_1900.txt'

try:
    # Use pandas to read TSV (assuming tab separated) with multiple encoding attempts
    df = None
    for enc in ['utf-16', 'utf-16-le', 'utf-8', 'big5']:
        try:
            df = pd.read_csv(input_path, sep='\t', encoding=enc)
            if not df.empty:
                print(f"Loaded with {enc}")
                break
        except:
            continue
            
    if df is None or df.empty:
        print("Failed to load data.")
        sys.exit(0)

    # Find the time column (usually contains '時間' or similar)
    time_col = next((c for c in df.columns if '時間' in str(c)), None)
    if not time_col:
        print(f"Time column not found. Cols: {df.columns.tolist()}")
        # Check if first few rows have dates
        for col in df.columns:
            if df[col].astype(str).str.contains('2026/03/09').any():
                time_col = col
                break
                
    if not time_col:
        print("Could not identify date column.")
        sys.exit(0)

    # Filter for 2026/03/09 18:xx:xx
    mask = df[time_col].astype(str).str.contains('2026/03/09 18:', na=False)
    filtered = df[mask]
    
    filtered.to_csv(output_path, sep='\t', index=False, encoding='utf-8-sig')
    print(f"SUCCESS: Extracted {len(filtered)} rows to {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
