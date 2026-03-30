import re

with open('Stock_Portfolio.html', encoding='utf-8') as f:
    html = f.read()

# 1. Remove RAW comment + array block
html = re.sub(
    r'// ─── RAW DATA ─+\n// \[date.*?const RAW=\[.*?\];\n',
    '',
    html,
    flags=re.DOTALL
)

# 2. Remove CRUD store block (SK constant + getStore + saveStore)
html = re.sub(
    r'\n// ─── CRUD Store ─+\nconst SK=.*?saveStore\(s\)\{localStorage\.setItem\(SK,JSON\.stringify\(s\)\)\}\n',
    '\n',
    html,
    flags=re.DOTALL
)

# 3. Remove buildRows block
html = re.sub(
    r'\n// ─── Build rows with overrides ─+\nfunction buildRows\(\)\{.*?return rows;\n\}\n',
    '\n',
    html,
    flags=re.DOTALL
)

# 4. Insert API constants right after the opening <script> tag
html = html.replace(
    '<script>\n',
    '<script>\n'
    "// ─── API ─────────────────────────────────────────────────────────────────────\n"
    "const API='https://script.google.com/macros/s/AKfycbxoXM_4QgCCEzxgy7Oa0dSjUStpovdgyGnhrAP0TQBdkdXp3OgSomfQO92wf2sn5Q-k/exec';\n"
    "const SHEET='Stock_Portfolio';\n"
    "var data=[];\n\n",
    1
)

with open('Stock_Portfolio.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Done')
