"""Contact sheets with actual animation time. Usage: grid.py frames-dir kind output.jpg"""
from PIL import Image, ImageDraw
from pathlib import Path
import sys, json
folder, kind, output = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
frames = json.loads((folder / ('frames-' + kind + '.json')).read_text())
w, h, label = 400, 225, 28
sheet = Image.new('RGB', (w * 4, (h + label) * ((len(frames) + 3) // 4)), '#211b17')
draw = ImageDraw.Draw(sheet)
for i, frame in enumerate(frames):
    x, y = i % 4 * w, i // 4 * (h + label)
    sheet.paste(Image.open(folder / frame['file']).resize((w, h)), (x, y))
    text = f"{kind} {frame['t']:.2f}s" if frame['busy'] else f"{kind} complete / {frame['gold']} gold"
    draw.text((x + 8, y + h + 7), text, fill='white')
sheet.save(output, quality=90)
