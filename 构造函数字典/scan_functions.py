#!/usr/bin/env python3
"""Scan C/C++ files recursively, extract function definitions to JSON."""

import json, sys, os
from pathlib import Path
import tree_sitter_c as tsc
import tree_sitter_cpp as tscpp
from tree_sitter import Language, Parser

C_LANG = Language(tsc.language())
CPP_LANG = Language(tscpp.language())
C_EXTS = {'.c'}
CPP_EXTS = {'.cpp', '.cc', '.cxx'}

def text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode('utf-8', errors='replace')

def param_types(params_node, src: bytes) -> str:
    types = []
    for ch in params_node.children:
        if ch.type == 'parameter_declaration':
            t = ch.child_by_field_name('type')
            if t: types.append(text(t, src).strip())
        elif ch.type == '...':
            types.append('...')
    return ', '.join(types)

def extract_func(node, src, class_name=None):
    """Return (key, info) or None for a function_definition node."""
    decl = node.child_by_field_name('declarator')
    if not decl: return None
    while decl.type in ('pointer_declarator', 'reference_declarator'):
        for c in decl.children:
            if c.type in ('function_declarator', 'pointer_declarator', 'reference_declarator'):
                decl = c; break
        else: return None
    if decl.type != 'function_declarator': return None

    name_node = decl.child_by_field_name('declarator')
    params_node = decl.child_by_field_name('parameters')
    if not name_node: return None

    if name_node.type in ('destructor_name', 'operator_name'): return None

    if name_node.type == 'qualified_identifier':
        scope = name_node.child_by_field_name('scope')
        name = name_node.child_by_field_name('name')
        if not scope or not name: return None
        if name.type in ('destructor_name', 'operator_name'): return None
        func_name = f"{text(scope, src)}::{text(name, src)}"
    else:
        fname = text(name_node, src)
        if class_name and fname == class_name: return None  # constructor
        func_name = f"{class_name}::{fname}" if class_name else fname

    pts = param_types(params_node, src) if params_node else ''
    key = f"{func_name}({pts})"
    return key, {
        'file': None,
        'start_line': node.start_point[0] + 1,
        'end_line': node.end_point[0] + 1,
    }

def walk(node, src, is_cpp, results, class_name=None):
    if is_cpp and node.type in ('class_specifier', 'struct_specifier'):
        cn = node.child_by_field_name('name')
        if cn:
            body = node.child_by_field_name('body')
            if body:
                for ch in body.children:
                    walk(ch, src, is_cpp, results, class_name=text(cn, src))
        return
    if node.type == 'function_definition':
        r = extract_func(node, src, class_name)
        if r: results.append(r)
        return
    for ch in node.children:
        walk(ch, src, is_cpp, results, class_name)

def parse_file(filepath: str) -> list:
    ext = Path(filepath).suffix.lower()
    is_cpp = ext in CPP_EXTS
    parser = Parser(CPP_LANG if is_cpp else C_LANG)
    with open(filepath, 'rb') as f:
        src = f.read()
    tree = parser.parse(src)
    results = []
    walk(tree.root_node, src, is_cpp, results)
    for _, info in results:
        info['file'] = filepath
    return results

def scan(directory: str) -> dict:
    all_exts = C_EXTS | CPP_EXTS
    funcs = {}
    for root, _, files in os.walk(directory):
        for fname in files:
            if Path(fname).suffix.lower() in all_exts:
                for key, info in parse_file(os.path.join(root, fname)):
                    funcs[key] = info
    return funcs

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <directory> [output.json]"); sys.exit(1)
    out = sys.argv[2] if len(sys.argv) > 2 else 'functions.json'
    funcs = scan(sys.argv[1])
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(funcs, f, indent=2, ensure_ascii=False)
    print(f"Found {len(funcs)} functions → {out}")
