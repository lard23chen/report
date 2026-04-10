
import sys

# File paths
input_path = r'D:\2025\AI\MongoDB\會員訂單_0309.txt'
output_path = r'D:\2025\AI\MongoDB\Lions_Orders_0309_1800.txt'

# Time range pattern
# Search for "2026/03/09 18:" which covers the 18:00-19:00 window
target_pattern = "2026/03/09 18:"

results = []
try:
    # Try different encodings: utf-16-le (common for TSV), utf-8
    encodings = ['utf-16-le', 'utf-8', 'utf-16', 'big5']
    lines = None
    
    for enc in encodings:
        try:
            with open(input_path, 'r', encoding=enc, errors='ignore') as f:
                lines = f.readlines()
            if lines:
                # Check if we can find any dates in the first 100 lines
                sample = "".join(lines[:100])
                if "2026/03/09" in sample:
                    print(f"Detected encoding: {enc}")
                    break
        except Exception:
            continue

    if not lines:
        print("Failed to read file or file is empty.")
        sys.exit(1)

    # Filter lines
    count = 0
    for line in lines:
        if target_pattern in line:
            results.append(line)
            count += 1
            
    if not results:
        print(f"No records found for {target_pattern}")
    else:
        with open(output_path, 'w', encoding='utf-8-sig') as f:
            f.writelines(results)
        print(f"SUCCESS: Extracted {count} rows to {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
