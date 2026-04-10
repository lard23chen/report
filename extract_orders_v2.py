
import sys

input_path = r'D:\2025\AI\MongoDB\會員訂單.txt'
output_path = r'D:\2025\AI\MongoDB\Lions_Orders_March9_1800_1900.txt'

try:
    # Read as utf-16-le to avoid BOM requirement
    with open(input_path, 'r', encoding='utf-16-le', errors='ignore') as f:
        lines = f.readlines()
    
    if not lines:
        print("No lines found.")
        sys.exit(0)

    filtered = []
    # Include header
    filtered.append(lines[0])
    
    # Range: 2026/03/09 18:00 to 18:59
    count = 0
    for line in lines[1:]:
        if "2026/03/09 18:" in line:
            filtered.append(line)
            count += 1
            
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(filtered)
    
    print(f"SUCCESS: Found {count} orders. Saved to {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
