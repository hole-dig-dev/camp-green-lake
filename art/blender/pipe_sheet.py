"""Compose the six inspected Blender previews: python3 art/blender/pipe_sheet.py."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

folder = Path(__file__).resolve().parent / 'renders'
assets = [
    ('PipeSection', '1 m reference / stretch X only'),
    ('PipeJoint', 'Clear coupling / wood saddle'),
    ('PipeCrack', 'Shattered wall / spill / FIX marker'),
    ('PipeSlug', '0.9 m loose sand / inside bore'),
    ('PipeIntake', 'Open clear hopper / SAND IN'),
    ('Sifter', 'Permanent clear inlet / socket -1.9 m'),
]
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 19)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
sheet = Image.new('RGB', (1440, 1008), '#282520')
draw = ImageDraw.Draw(sheet)
draw.text((20, 14), 'CAMP GREEN LAKE  /  SAND PIPELINE', font=font, fill='#f4dfb9')
for i, (name, caption) in enumerate(assets):
    x, y = i % 3 * 480, 50 + i // 3 * 479
    im = Image.open(folder / (name + '.png')).convert('RGB')
    im.thumbnail((480, 400), Image.Resampling.LANCZOS)
    sheet.paste(im, (x + (480-im.width)//2, y + (400-im.height)//2))
    draw.text((x+16, y+412), name, font=font, fill='#f4dfb9')
    draw.text((x+16, y+443), caption, font=small, fill='#c8bca9')
sheet.save(folder / 'pipe-sheet.png')
