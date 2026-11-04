import os, re

routers_dir = 'gateway/http/routers'
for f in os.listdir(routers_dir):
    if not f.endswith('.py'):
        continue
    path = os.path.join(routers_dir, f)
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if re.search(r'@router\.(get|post|put|delete|patch)\([\'"]\/[\'"]', line):
            prev_line = lines[i-1] if i > 0 else ''
            if '""' not in prev_line and "''" not in prev_line:
                print(f'{f}:{i+1} -> {line}')
