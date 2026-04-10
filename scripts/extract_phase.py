import re
import sys

def extract_blocks(filepath, start_kw, end_kw):
    blocks = []
    current = []
    inside = False
    start_count = 0
    unclosed_count = 0

    with open(filepath, 'r') as f:
        for line in f:
            if start_kw in line:
                if inside:
                    unclosed_count += 1
                inside = True
                start_count += 1
                current = [line]
            elif end_kw in line and inside:
                current.append(line)
                blocks.append(''.join(current))
                current = []
                inside = False
            elif inside:
                current.append(line)

    if inside:
        unclosed_count += 1

    return blocks, start_count, unclosed_count

if __name__ == '__main__':
    filepath = sys.argv[1]
    start_kw = sys.argv[2]
    end_kw = sys.argv[3]

    blocks, start_count, unclosed_count = extract_blocks(filepath, start_kw, end_kw)

    if start_count == 0:
        print(f"[WARN] 未找到起始关键字 \"{start_kw}\"")
    elif len(blocks) == 0:
        print(f"[WARN] 找到 {start_count} 个起始关键字，但没有匹配到完整的段落（缺少结束关键字 \"{end_kw}\"）")
    else:
        for i, block in enumerate(blocks, 1):
            print(f"=== Block {i} ===")
            print(block)
        if unclosed_count > 0:
            print(f"[WARN] 有 {unclosed_count} 个起始关键字未找到对应的结束关键字")
