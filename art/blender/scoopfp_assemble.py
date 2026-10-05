"""Assemble FP camera phases/video and verify EEVEE visibility-mask measurements.

python3 art/blender/scoopfp_assemble.py --frames /tmp/sol-scoopfp/render \
    --ffmpeg /path/to/ffmpeg-with-h264_vaapi
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--frames',type=Path,default=Path('/tmp/sol-scoopfp/render'))
parser.add_argument('--ffmpeg',default='ffmpeg')
args=parser.parse_args()
out=Path(__file__).resolve().parent/'renders';out.mkdir(exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
phases=('ready','planted','levered','loaded','tossed','recover')
times=(0,8/30,16/30,25/30,35/30,1.5)
sheet=Image.new('RGB',(2880,738),'#eee9df');draw=ImageDraw.Draw(sheet)
draw.text((16,10),'ScoopFP  |  76° vertical FOV  |  16:9  |  near 0.045m  |  eye at origin',font=font,fill='#242424')
for row,(view,pitch) in enumerate((('level','0°'),('down','−30°'))):
    y=45+row*330
    for col,(phase,time) in enumerate(zip(phases,times)):
        x=col*480
        draw.text((x+12,y),f'{phase.upper()}  {time:.3f}s',font=font,fill='#242424')
        with Image.open(args.frames/f'{view}-{phase}.png') as cell:
            sheet.paste(cell.resize((480,270),Image.Resampling.LANCZOS),(x,y+32))
    draw.text((12,y+304),'CAMERA PITCH '+pitch,font=small,fill='#242424')
draw.text((16,712),'Arms follow camera pitch; the ground changes. Dirt shown in Lever/Loaded is a review-only payload.',font=small,fill='#242424')
sheet.save(out/'scoopfp-sheet.png')

# Every integer pose, plus duplicate endpoint, has a full-asset and isolated-blade
# mask rendered on EEVEE/Vulkan. Coverage measures visible sleeves + hands only.
measurements=[]
for frame in range(46):
    full=np.asarray(Image.open(args.frames/f'mask-full-{frame:03}.png'))[:,:,:3]
    blade=np.asarray(Image.open(args.frames/f'mask-blade-{frame:03}.png'))[:,:,:3]
    arms=(full[:,:,1]>150)&(full[:,:,0]<50)&(full[:,:,2]<50)
    visible=(full[:,:,0]>150)&(full[:,:,1]<50)&(full[:,:,2]<50)
    isolated=(blade[:,:,0]>150)&(blade[:,:,1]<50)&(blade[:,:,2]<50)
    coverage=float(arms.mean());visible_pixels=int(visible.sum())
    fraction=visible_pixels/max(1,int(isolated.sum()))
    assert coverage < .25, f'arms cover {coverage:.1%} at frame {frame}'
    assert visible_pixels > 300 and fraction > .60, f'blade obscured at frame {frame}: {visible_pixels}px/{fraction:.1%}'
    measurements.append({'frame':frame,'arms_coverage':coverage,'blade_pixels':visible_pixels,'blade_visibility':fraction})
metrics={'samples':46,'maximum_arm_coverage':max(measurements,key=lambda m:m['arms_coverage']),
    'minimum_blade_visibility':min(measurements,key=lambda m:m['blade_visibility']),
    'minimum_blade_pixels':min(measurements,key=lambda m:m['blade_pixels'])}
(args.frames/'visibility.json').write_text(json.dumps(metrics,indent=2)+'\n')
print('FP GPU visibility:',json.dumps(metrics))

with tempfile.TemporaryDirectory(prefix='scoopfp-loop-') as temp:
    sequence=Path(temp)
    for frame in range(135):
        source=(args.frames/f'loop-{frame%45:03}.png').resolve()
        assert source.is_file(),f'missing frame: {source}'
        (sequence/f'{frame:03}.png').symlink_to(source)
    subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','warning','-y',
        '-vaapi_device','/dev/dri/renderD128','-framerate','30','-start_number','0',
        '-i',str(sequence/'%03d.png'),'-frames:v','135','-vf','format=nv12,hwupload',
        '-c:v','h264_vaapi','-b:v','1800k','-maxrate','2500k','-bufsize','3500k',
        '-movflags','+faststart','-an',str(out/'scoopfp-preview.mp4')],check=True)
print(f'ScoopFP preview: 135 frames / 30fps = 4.5s, {(out/"scoopfp-preview.mp4").stat().st_size:,} bytes')
