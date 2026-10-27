"""独立检查新增色表、来源、代表色和预览像素。"""
from pathlib import Path
from statistics import median
import csv
import hashlib
import json
import re

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/palettes'
source = DATA / 'source-multi-palettes.jpg'
original = Image.open(source).convert('RGB')
base_path = DATA / 'bead-colors-221/bead-colors-221.json'
base = json.loads(base_path.read_text())
reports = []
for count in (72, 88, 144):
    folder = DATA / f'bead-colors-{count}'
    colors = json.loads((folder / f'bead-colors-{count}.json').read_text())
    metadata = json.loads((folder / 'extraction-metadata.json').read_text())
    with (folder / f'bead-colors-{count}.csv').open() as stream:
        rows = list(csv.DictReader(stream))
    checks = []

    def check(name, value):
        assert value, f'{count}: {name}'
        checks.append(name)

    check('实际编号数量与标题一致', len(colors) == len(rows) == len(metadata['swatches']) == count)
    check('每个编号均带数字且HEX格式正确', all(re.fullmatch(r'[A-Z]\d+', code) and re.fullmatch(r'#[0-9A-F]{6}', value) for code, value in colors.items()))
    check('JSON、CSV与逐行编号顺序一致', list(colors) == [r['code'] for r in rows] == [code for row in metadata['rows'] for code in row])
    check('原始图片与共用221色来源哈希正确', metadata['source_sha256'] == hashlib.sha256(source.read_bytes()).hexdigest() and metadata['shared_palette_sha256'] == hashlib.sha256(base_path.read_bytes()).hexdigest())
    preview = Image.open(folder / f'bead-colors-{count}-preview.png').convert('RGB')
    sampled, shared = 0, 0
    for row, item in zip(rows, metadata['swatches']):
        code = row['code']
        rgb = tuple(int(colors[code][i:i+2], 16) for i in (1, 3, 5))
        assert colors[code] == row['hex'] == item['hex']
        assert rgb == tuple(int(row[c]) for c in ('r', 'g', 'b'))
        assert int(row['source_row']) == item['source_row'] and int(row['source_column']) == item['source_column']
        if item['origin'] == '221-shared':
            canonical = code[0] + str(int(code[1:]))
            assert colors[code] == base[canonical] and canonical == item['canonical_221_code']
            shared += 1
        else:
            crop = original.crop(tuple(item['sample_region_px']))
            pixels = [crop.getpixel((x, y)) for y in range(crop.height) for x in range(crop.width)]
            recalculated = tuple(round(median(p[c] for p in pixels)) for c in range(3))
            assert rgb == recalculated and len(pixels) == 880
            sampled += 1
        x = 32 + (item['source_column'] - 1) * 148 + 130
        y = 108 + (item['source_row'] - 1) * 78 + 60
        assert preview.getpixel((x, y)) == rgb
    checks += ['逐项JSON/CSV/元数据及RGB一致', '共用编号独立归一化并与221色逐项一致', '新增色使用statistics.median独立重算一致', '所有预览色块像素与HEX一致']
    check('共用及新增数量符合逐格核对结果', (shared, sampled) == ((12, 76) if count == 88 else (count, 0)))
    report = {'palette': count, 'passed': True, 'shared_colors': shared, 'sampled_colors': sampled, 'checks': checks}
    (folder / 'validation-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    reports.append(report)
print(json.dumps(reports, ensure_ascii=False, indent=2))
