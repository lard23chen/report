
import sys

input_path = r'D:\2025\AI\MongoDB\會員訂單.txt'
output_path = r'D:\2025\AI\MongoDB\Lions_Orders_March9_1800.txt'

try:
    # Read using utf-8 ignore to be safe
    with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    if not lines:
        print("Empty file.")
        sys.exit(0)

    filtered = []
    # Add header
    filtered.append(lines[0])
    
    count = 0
    # Search for "2026/03/09 18:" which covers the 18:00-19:00 window
    for line in lines[1:]:
        if "2026/03/09 18:" in line:
            filtered.append(line)
            count += 1
            
    with open(output_path, 'w', encoding='utf-8-sig') as f:
        f.writelines(filtered)
    
    print(f"SUCCESS: Extracted {count} orders from 3/9 18:00-19:00.")
    print(f"File saved to: {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
