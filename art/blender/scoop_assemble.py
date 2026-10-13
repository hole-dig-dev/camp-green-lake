"""Assemble Scoop's EEVEE frames; requires Pillow and FFmpeg with h264_vaapi.

python3 art/blender/scoop_assemble.py --frames /tmp/sol-scoop/render \
    --ffmpeg /path/to/ffmpeg
"""
import argparse
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--frames', type=Path, default=Path('/tmp/sol-scoop/render'))
parser.add_argument('--ffmpeg', default='ffmpeg')
args = parser.parse_args()
out = Path(__file__).resolve().parent / 'renders'
out.mkdir(exist_ok=True)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
phases = ('ready', 'planted', 'levered', 'loaded', 'tossed', 'recover')
times = (0, 8/30, 16/30, 25/30, 35/30, 1.5)
sheet = Image.new('RGB', (1920, 760), '#eee9df')
draw = ImageDraw.Draw(sheet)
for row, view in enumerate(('side', 'front')):
    for col, (phase, time) in enumerate(zip(phases, times)):
        with Image.open(args.frames / f'{view}-{phase}.png') as cell:
            sheet.paste(cell.resize((320, 320), Image.Resampling.LANCZOS), (col * 320, row * 380 + 35))
        draw.text((col * 320 + 10, row * 380 + 9), f'{phase.upper()}  {time:.3f}s', font=font, fill='#242424')
    draw.text((10, row * 380 + 357), 'SIDE' if row == 0 else '3/4 FRONT', font=font, fill='#242424')
sheet.save(out / 'scoop-sheet.png')
# Loop the 45 distinct frames three times. Keep the duplicate endpoint out of the
# sequence so each loop is exactly 1.5s. VA-API uses the Radeon render node.
with tempfile.TemporaryDirectory(prefix='scoop-loop-') as temp:
    sequence = Path(temp)
    for frame in range(135):
        source = (args.frames / f'loop-{frame % 45:03}.png').resolve()
        assert source.is_file(), f'missing rendered frame: {source}'
        (sequence / f'{frame:03}.png').symlink_to(source)
    subprocess.run([
        args.ffmpeg, '-hide_banner', '-loglevel', 'warning', '-y',
        '-vaapi_device', '/dev/dri/renderD128', '-framerate', '30',
        '-start_number', '0', '-i', str(sequence / '%03d.png'),
        '-frames:v', '135', '-vf', 'format=nv12,hwupload', '-c:v', 'h264_vaapi',
        '-b:v', '1500k', '-maxrate', '2000k', '-bufsize', '3000k',
        '-movflags', '+faststart', '-an', str(out / 'scoop-preview.mp4')], check=True)
video = out / 'scoop-preview.mp4'
assert video.stat().st_size <= 6_000_000, 'preview exceeds 6MB'
print(out / 'scoop-sheet.png')
print(f'{video}: 135 frames / 30fps = 4.5s, {video.stat().st_size:,} bytes')
