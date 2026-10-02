"""Compose inspected Blender upgrade renders; python3 art/blender/upgrades_sheet.py."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
folder=Path(__file__).resolve().parent/'renders'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
def sheet(assets,name,cols=4):
    rows=(len(assets)+cols-1)//cols
    out=Image.new('RGB',(cols*400,rows*380+52),'#292821');d=ImageDraw.Draw(out)
    d.text((18,14),'CAMP GREEN LAKE / UPGRADE ASSETS',font=font,fill='#efddb7')
    for i,(asset,caption) in enumerate(assets):
        x=i%cols*400;y=52+i//cols*380
        im=Image.open(folder/(asset+'.png')).convert('RGB');im.thumbnail((400,320),Image.Resampling.LANCZOS)
        out.paste(im,(x+(400-im.width)//2,y+(320-im.height)//2))
        d.text((x+14,y+328),asset,font=font,fill='#efddb7');d.text((x+14,y+355),caption,font=small,fill='#c8c1ab')
    out.save(folder/name)
sheet([
 ('Dynamite','Ground origin / 25 cm with fuse'),('DynamiteHeld','Same bundle / origin at grip'),
 ('LooseSand','1.6 m radius / 45 cm high'),('Scarecrow','2.2 m / patched shirt / rattle cans'),
 ('Dog','Scruffy mine dog / 14 bones / 6 clips'),('DisarmKit','Canvas roll / probe / cutters'),
 ('GravityBoots','Original shin skin / magnetic soles'),('GrappleHook','Launcher / rope drum / stowed hook'),
 ('GrappleHookHead','Rope eye origin / +X shaft'),('GoldScale','Sifter frame / X 1.6, Blender Y 0.7'),
 ('PipePump','Sifter frame / outside inlet socket'),('PipeSectionSteel','1 m +X / .24 m axis / clear bore')
], 'upgrades-sheet.png')
sheet([(f'Dog-{n}','In-place AnimationMixer clip') for n in ['Idle','Walk','Run','Sniff','Bark','Sit']]
      +[('LooseSand-flat','20% height'),('PipeSectionSteel-stretched','5.5x X stretch')], 'upgrades-motion-sheet.png')
game=folder/'upgrades-game'
if game.exists():
    files=sorted(game.glob('*.png'))
    out=Image.new('RGB',(1440,245*((len(files)+3)//4)), '#292821');d=ImageDraw.Draw(out)
    for i,f in enumerate(files):
        im=Image.open(f);im.thumbnail((360,225),Image.Resampling.LANCZOS);x=i%4*360;y=i//4*245
        out.paste(im,(x,y));d.text((x+10,y+226),f.stem,font=small,fill='#efddb7')
    out.save(folder/'upgrades-game-sheet.png')
