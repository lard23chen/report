import re, csv, sys

with open('Stock_Portfolio.html', encoding='utf-8') as f:
    html = f.read()

match = re.search(r'const RAW=\[(.*?)\];', html, re.DOTALL)
if not match:
    print('ERROR: RAW array not found', file=sys.stderr)
    sys.exit(1)

block = match.group(1)
row_strings = re.findall(r'\[([^\]]+)\]', block)

HEADER = ['date','type','code','name','buyShares','buyPrice','sellShares','sellPrice',
          'fee','tax','amount','cost','spend','income','note','person']

with open('stock_portfolio_migration.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(HEADER)
    for row_str in row_strings:
        vals = next(csv.reader([row_str]))
        w.writerow(vals)

print(f'Written {len(row_strings)} rows to stock_portfolio_migration.csv')
