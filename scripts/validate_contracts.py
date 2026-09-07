#!/usr/bin/env python3
"""
Validador determinista de contratos híbridos OKF+CCDD para KDD.
Verifica frontmatter, campos requeridos y existencia de nodos enlazados sin requerir dependencias externas.
"""
import os
import sys
import re

REQUIRED_OKF = ['type', 'title', 'description', 'tags']
REQUIRED_CCDD = ['task', 'intent', 'target', 'signature', 'test_command', 'budget', 'tests', 'deps_allowed']

def parse_frontmatter(content):
    if not content.startswith('---'):
        return None, "Falta delimitador inicial de frontmatter (---)"
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None, "Frontmatter mal formado o sin delimitador de cierre (---)"
    raw_yaml = parts[1]
    body = parts[2]
    
    # Parser simple y determinista de YAML plano y estructuras básicas
    data = {}
    current_key = None
    in_budget = False
    
    for line in raw_yaml.splitlines():
        line_strip = line.strip()
        if not line_strip or line_strip.startswith('#'):
            continue
        
        # Check indent for subkey (e.g. budget)
        if line.startswith('  ') and in_budget:
            subparts = line_strip.split(':', 1)
            if len(subparts) == 2:
                subk = subparts[0].strip()
                subv = subparts[1].strip()
                try:
                    data['budget'][subk] = int(subv)
                except ValueError:
                    data['budget'][subk] = subv
            continue
        else:
            in_budget = False

        if ':' in line:
            k, v = line.split(':', 1)
            k = k.strip()
            v = v.strip()
            if k == 'budget':
                data[k] = {}
                in_budget = True
                continue
            if v.startswith('[') and v.endswith(']'):
                # Array simple
                items = [x.strip().strip("'\"") for x in v[1:-1].split(',') if x.strip()]
                data[k] = items
            else:
                data[k] = v.strip("'\"")
    return (data, body), None

def validate_contract_file(path, base_dir):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    res, err = parse_frontmatter(content)
    if err:
        return False, f"[{os.path.basename(path)}] {err}"
    
    data, body = res
    # Validar OKF
    for req in REQUIRED_OKF:
        if req not in data:
            return False, f"[{os.path.basename(path)}] Falta campo OKF obligatorio: '{req}'"
    if data.get('type') != 'Task Contract':
        return False, f"[{os.path.basename(path)}] El campo 'type' debe ser estrictamente 'Task Contract'"
    
    # Validar CCDD
    for req in REQUIRED_CCDD:
        if req not in data:
            return False, f"[{os.path.basename(path)}] Falta campo CCDD obligatorio: '{req}'"
    
    # Validar enlaces relativos en el cuerpo
    contract_dir = os.path.dirname(path)
    links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', body)
    for text, target in links:
        if target.startswith('http://') or target.startswith('https://') or target.startswith('#'):
            continue
        # Resolver link relativo
        clean_target = target.split('#')[0]
        resolved = os.path.normpath(os.path.join(contract_dir, clean_target))
        if not os.path.exists(resolved):
            return False, f"[{os.path.basename(path)}] Enlace roto: '{target}' hacia '{resolved}' no existe."
            
    return True, "OK"

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    contracts_dir = os.path.join(root, 'knowledge', 'contracts')
    if not os.path.exists(contracts_dir):
        print(f"ERROR: Directorio {contracts_dir} no encontrado.")
        sys.exit(1)
        
    contract_files = [os.path.join(contracts_dir, f) for f in os.listdir(contracts_dir) if f.endswith('.md')]
    if not contract_files:
        print("ADVERTENCIA: No se encontraron contratos en knowledge/contracts/")
        sys.exit(1)
        
    print(f"Validando {len(contract_files)} contratos CCDD+OKF...")
    all_ok = True
    for cfile in contract_files:
        ok, msg = validate_contract_file(cfile, root)
        if ok:
            print(f"  [PASS] {os.path.basename(cfile)}")
        else:
            print(f"  [FAIL] {msg}")
            all_ok = False
            
    if all_ok:
        print("Todos los contratos son validos segun la especificacion KDD.")
        sys.exit(0)
    else:
        print("Se encontraron errores en los contratos.")
        sys.exit(1)

if __name__ == '__main__':
    main()
