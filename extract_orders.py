
import sys
import re

# File paths
input_path = r'D:\2025\AI\MongoDB\會員訂單.txt'
output_path = r'D:\2025\AI\MongoDB\Lions_Orders_March9_1800_1900.txt'

# Time range pattern
target_start = '2026/03/09 18:00'
target_end = '2026/03/09 19:00'

results = []
try:
    # Read as bytes first to handle potential encoding issues (common in TSV/TXT)
    with open(input_path, 'rb') as f:
        content = f.read()
    
    # Try common encodings: utf-16 (le), utf-8
    try:
        lines = content.decode('utf-16').splitlines()
    except UnicodeDecodeError:
        lines = content.decode('utf-8', errors='ignore').splitlines()

    if not lines:
        print("File is empty.")
        sys.exit(0)

    # Header
    results.append(lines[0])
    
    count = 0
    for line in lines[1:]:
        # Simple string search for the date/hour range
        # Looking for "2026/03/09 18:"
        if "2026/03/09 18:" in line:
            results.append(line)
            count += 1
            
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(results))
    
    print(f"SUCCESS: Extracted {count} rows to {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
