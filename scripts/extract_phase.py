import re
import sys

def extract_blocks(filepath, start_kw, end_kw):
    blocks = []
    current = []
    inside = False

    with open(filepath, 'r') as f:
        for line in f:
            if start_kw in line:
                inside = True
                current = [line]
            elif end_kw in line and inside:
                current.append(line)
                blocks.append(''.join(current))
                current = []
                inside = False
            elif inside:
                current.append(line)

    return blocks

if __name__ == '__main__':
    filepath = sys.argv[1]
    start_kw = sys.argv[2]
    end_kw = sys.argv[3]

    blocks = extract_blocks(filepath, start_kw, end_kw)
    for i, block in enumerate(blocks, 1):
        print(f"=== Block {i} ===")
        print(block)
