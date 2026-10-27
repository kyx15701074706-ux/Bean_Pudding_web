"""从用户提供的组合色卡生成72、88、144色色表、审计信息和预览。

运行：python3 scripts/extract-palettes.py
依赖：Pillow、numpy。已有221色JSON是共用编号的唯一颜色来源。
"""
from pathlib import Path
import csv
import hashlib
import json
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/palettes'
SOURCE = DATA / 'source-multi-palettes.jpg'
BASE_PATH = DATA / 'bead-colors-221/bead-colors-221.json'
ROWS = {
    72: [
        'A2 A3 A7 A8 A9 A11 A16',
        'A20 A24 B2 B3 B6 B10 B12',
        'B18 B20 B22 B28 B29 C1 C2',
        'C3 C5 C6 C7 C10 C11 C15',
        'C16 C20 C23 C24 C26 D2 D3',
        'D8 D9 D11 D12 D13 D14 D16',
        'D18 D19 D20 D21 D24 D26 E3',
        'E7 E15 E16 E19 F5 F8 F13',
        'F24 G1 G3 G5 G6 G7 G8',
        'H1 H2 H4 H5 H7 M9 M10',
        'M11 M15',
    ],
    88: [
        'X1 X2 X3 X4 X5 X6 X7 X8',
        'X9 X10 X11 X12 X13 X14 X15 X16',
        'X17 X18 X19 B12 X21 X22 X23 X24',
        'X25 X26 F11 X28 X29 X30 X31 X32',
        'X33 X34 X35 X36 X37 X38 X39 H01',
        'X41 H07 H02 X44 C15 X46 X47 E07',
        'D03 X50 X51 X52 X53 X54 X55 X56',
        'X57 X58 X59 X60 G08 X62 X63 X64',
        'X65 X66 X67 X68 X69 X70 X71 X72',
        'X73 X74 X75 X76 X77 X78 X79 A02',
        'A20 X82 X83 X84 X85 H05 X87 X88',
    ],
    144: [
        'A1 A2 A3 A5 A6 A7 A8 A9 A11',
        'A13 A16 A17 A20 A21 A24 A25 A26 B1',
        'B2 B3 B6 B7 B8 B10 B11 B12 B13',
        'B14 B15 B17 B18 B19 B20 B22 B23 B28',
        'B29 C1 C2 C3 C4 C5 C6 C7 C8',
        'C10 C11 C13 C15 C16 C19 C20 C22 C23',
        'C24 C26 C28 C29 D1 D2 D3 D4 D6',
        'D7 D8 D9 D11 D12 D13 D14 D15 D16',
        'D18 D19 D20 D21 D22 D24 D25 D26 E1',
        'E2 E3 E5 E6 E7 E11 E13 E14 E15',
        'E16 E19 E20 E24 F1 F2 F3 F4 F5',
        'F6 F8 F12 F13 F18 F24 F25 G1 G2',
        'G3 G5 G6 G7 G8 G9 G14 G15 G17',
        'G18 G20 H1 H2 H3 H4 H5 H6 H7',
        'H8 H9 H14 H15 H19 M1 M3 M4 M5',
        'M7 M8 M9 M10 M11 M12 M13 M14 M15',
    ],
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    base = json.loads(BASE_PATH.read_text())
    pixels = np.asarray(Image.open(SOURCE).convert('RGB'))
    font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    font = ImageFont.truetype(font_path, 22)
    small = ImageFont.truetype(font_path, 16)
    title = ImageFont.truetype(font_path, 28)
    for count, lines in ROWS.items():
        rows = [line.split() for line in lines]
        codes = [code for row in rows for code in row]
        assert len(codes) == len(set(codes)) == count
        folder = DATA / f'bead-colors-{count}'
        folder.mkdir(exist_ok=True)
        colors, records = {}, []
        columns = max(map(len, rows))
        for row_index, row in enumerate(rows):
            for column_index, code in enumerate(row):
                canonical = re.sub(r'^([A-Z])0+(\d)', r'\1\2', code)
                region = None
                if canonical in base:
                    hex_value, origin = base[canonical], '221-shared'
                else:
                    assert count == 88 and code.startswith('X')
                    # 88色每格约57×58像素。只取标签下方内部区域，避开边框。
                    x1 = round(645 + column_index * 57.4 + 5)
                    y1 = round(125 + row_index * 58.7 + 31)
                    region = [x1, y1, x1 + 44, y1 + 20]
                    x1, y1, x2, y2 = region
                    rgb = np.rint(np.median(pixels[y1:y2, x1:x2].reshape(-1, 3), axis=0)).astype(int)
                    hex_value, origin = '#' + ''.join(f'{c:02X}' for c in rgb), 'image-median'
                colors[code] = hex_value
                records.append({'code': code, 'hex': hex_value, 'canonical_221_code': canonical if origin == '221-shared' else None,
                                'source_row': row_index + 1, 'source_column': column_index + 1,
                                'origin': origin, 'sample_region_px': region,
                                'sample_pixel_count': 880 if region else 0})
        save_json(folder / f'bead-colors-{count}.json', colors)
        with (folder / f'bead-colors-{count}.csv').open('w', newline='', encoding='utf-8') as stream:
            writer = csv.writer(stream)
            writer.writerow(['code', 'hex', 'r', 'g', 'b', 'group', 'source_row', 'source_column'])
            for item in records:
                value = item['hex']
                writer.writerow([item['code'], value, *[int(value[i:i+2], 16) for i in (1, 3, 5)],
                                 item['code'][0], item['source_row'], item['source_column']])
        preview = Image.new('RGB', (columns * 148 + 64, len(rows) * 78 + 140), '#FAFAF9')
        draw = ImageDraw.Draw(preview)
        draw.text((32, 24), f'BEAD PALETTE / {count} COLORS', font=title, fill='#292524')
        draw.text((32, 64), 'Source order / Shared codes use the original 221-color HEX', font=small, fill='#57534E')
        for item in records:
            x, y = 32 + (item['source_column'] - 1) * 148, 108 + (item['source_row'] - 1) * 78
            draw.rectangle([x, y, x + 139, y + 69], fill=item['hex'], outline='#D6D3D1')
            rgb = [int(item['hex'][i:i+2], 16) for i in (1, 3, 5)]
            linear = [c / 3294.6 if c <= 10 else ((c / 255 + .055) / 1.055) ** 2.4 for c in rgb]
            luminance = sum(a*b for a, b in zip(linear, (.2126, .7152, .0722)))
            ink = '#000000' if luminance > .179 else '#FFFFFF'
            draw.text((x + 12, y + 10), item['code'], font=font, fill=ink)
            draw.text((x + 12, y + 40), item['hex'], font=small, fill=ink)
        preview.save(folder / f'bead-colors-{count}-preview.png')
        save_json(folder / 'extraction-metadata.json', {
            'count': count, 'source': '../source-multi-palettes.jpg', 'source_sha256': sha256(SOURCE),
            'source_size': [pixels.shape[1], pixels.shape[0]], 'shared_palette': '../bead-colors-221/bead-colors-221.json',
            'shared_palette_sha256': sha256(BASE_PATH), 'rows': rows,
            'method': '共有编号（包括前导零写法）复用221色HEX，保留原始编号。X系列取标签下方880个RGB像素的通道中位数，numpy.rint取整。',
            'swatches': records,
        })
        (folder / 'README.md').write_text(f'''# 拼豆图片色卡 · {count}色

按用户组合色卡从左到右、从上到下逐格核对，共{count}个编号。右下色卡标题为144色，按图片实际数量记录。

- `bead-colors-{count}.json`：编号到大写HEX映射。
- `bead-colors-{count}.csv`：与JSON相同的颜色，包含RGB、分组、原图行列。
- `bead-colors-{count}-preview.png`：带编号和HEX的色卡预览。
- `extraction-metadata.json`：来源哈希、逐行编号、共用色对应关系、取样区域。
- `validation-report.json`：独立重算、格式、数量和预览验证结果。

原始图片为上一级的`source-multi-palettes.jpg`。72、144色均为221色的子集，共有编号复用原221色HEX，避免不同图片的色差。88色有76个X编号从照片内部区域取样，另外12个编号复用221色；H01/H07/H02/E07/D03/G08/A02/H05等前导零保留在输出编号中，对应221色的H1/H7/H2/E7/D3/G8/A2/H5。

88色照片中的颗粒、阴影、反光由RGB通道中位数归为代表色。HEX是图片取样近似值，不是厂家标准色。所有坐标均以原图左上为原点，矩形包含左上边、不包含右下边。各套色卡独立用于配色，不合并X系列与其他编号。

重建数据：在项目根目录运行`python3 scripts/extract-palettes.py`，需要Pillow、numpy。脚本不会改写221色数据。
''')
        print(f'{count}色：{sum(r["origin"] == "221-shared" for r in records)}共用，{sum(r["origin"] == "image-median" for r in records)}图片取样')


if __name__ == '__main__':
    main()
