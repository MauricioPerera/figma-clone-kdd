#!/usr/bin/env python3
"""
Validador de nodos de conocimiento OKF (Open Knowledge Format).
Verifica que todos los archivos .md en knowledge/ tengan Frontmatter válido y enlaces funcionales.
"""
import os
import sys
import re

REQUIRED_OKF_FIELDS = ['type', 'title', 'description', 'tags']

def validate_okf_node(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not content.startswith('---'):
        return False, "Falta Frontmatter inicial (---)"
    parts = content.split('---', 2)
    if len(parts) < 3:
        return False, "Frontmatter mal cerrado (---)"

    frontmatter = parts[1]
    body = parts[2]

    # Parse simple frontmatter keys
    keys = set()
    for line in frontmatter.splitlines():
        line = line.strip()
        if ':' in line and not line.startswith('#'):
            k = line.split(':', 1)[0].strip()
            keys.add(k)

    for req in REQUIRED_OKF_FIELDS:
        if req not in keys:
            return False, f"Falta campo requerido: '{req}'"

    # Validate links
    doc_dir = os.path.dirname(filepath)
    links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', body)
    for text, target in links:
        if target.startswith('http://') or target.startswith('https://') or target.startswith('#'):
            continue
        clean = target.split('#')[0]
        if not clean:
            continue
        resolved = os.path.normpath(os.path.join(doc_dir, clean))
        if not os.path.exists(resolved):
            return False, f"Enlace roto a '{target}' (no existe '{resolved}')"

    return True, "OK"

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    kdir = os.path.join(root, 'knowledge')
    
    all_ok = True
    count = 0
    for dirpath, _, filenames in os.walk(kdir):
        for fname in filenames:
            if fname.endswith('.md'):
                fpath = os.path.join(dirpath, fname)
                count += 1
                ok, msg = validate_okf_node(fpath)
                rel = os.path.relpath(fpath, root)
                if ok:
                    print(f"  [PASS] {rel}")
                else:
                    print(f"  [FAIL] {rel}: {msg}")
                    all_ok = False

    print(f"Verificados {count} nodos OKF.")
    if all_ok:
        print("Todos los nodos OKF son validos.")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
