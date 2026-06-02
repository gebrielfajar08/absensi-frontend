from pathlib import Path
text = Path('src/pages/Landing.jsx').read_text(encoding='utf-8')
stack = []
line = 1
col = 0
in_single = False
in_double = False
in_template = False
escaped = False
in_comment = None
prev = ''
error = False
for ch in text:
    col += 1
    if ch == '\n':
        line += 1
        col = 0
        if in_comment == 'line':
            in_comment = None
        prev = ch
        continue
    if in_comment:
        if in_comment == 'block' and ch == '/' and prev == '*':
            in_comment = None
        prev = ch
        continue
    if not in_single and not in_double and not in_template:
        if ch == '/' and prev == '/':
            in_comment = 'line'
        elif ch == '/' and prev == '*':
            in_comment = 'block'
        if ch == '"' and prev != '\\':
            in_double = True
        elif ch == "'" and prev != '\\':
            in_single = True
        elif ch == '`' and prev != '\\':
            in_template = True
        elif ch in '([{':
            stack.append((ch, line, col))
        elif ch in ')]}':
            if not stack:
                print('Unmatched closing', ch, 'at', line, col)
                error = True
                break
            opening, ol, oc = stack.pop()
            if (opening, ch) not in [('(', ')'), ('[', ']'), ('{', '}')]:
                print('Mismatched', opening, 'at', ol, oc, 'with', ch, line, col)
                error = True
                break
    else:
        if escaped:
            escaped = False
        elif ch == '\\':
            escaped = True
        elif in_single and ch == "'":
            in_single = False
        elif in_double and ch == '"':
            in_double = False
        elif in_template and ch == '`':
            in_template = False
    prev = ch
if not error:
    if stack:
        print('Unclosed at end:', stack[-1])
    else:
        print('No unmatched braces found')
