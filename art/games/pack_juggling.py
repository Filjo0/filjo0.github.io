"""Pack deterministic Blender frames into one transparent WebP atlas and frame data."""
from pathlib import Path
from PIL import Image
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1];CACHE=ROOT/'.cache';OUT=PROJECT/'assets/games'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
data=json.loads((CACHE/'render-v2.json').read_text());w,h=data['size']
atlas=Image.new('RGBA',(w*8,h*5));shadows=Image.new('RGBA',(640*4,126*9));clips={};index=0
for name,frames in data['clips'].items():
    clips[name]=[]
    for frame in frames:
        image=Image.open(CACHE/'frames-v2'/frame['file']).convert('RGBA')
        x=(index%8)*w;y=(index//8)*h;atlas.paste(image,(x,y))
        for label in ['toe','plant']:
            ax,ay=frame[label];region=image.getchannel('A').crop((int(ax)-3,int(ay)-3,int(ax)+4,int(ay)+4))
            assert region.getextrema()[1]>180, (name,label,'Anchor must touch visible shoe pixels')
        shadow=Image.open(CACHE/'frames-v2'/frame['shadowFile']).convert('RGBA')
        assert shadow.size==(1280,252)
        shadow=shadow.resize((640,126),Image.Resampling.LANCZOS)
        sx=(index%4)*640;sy=(index//4)*126;shadows.paste(shadow,(sx,sy))
        frame['shadowPlant']=[v/2 for v in frame['shadowPlant']]
        clips[name].append({k:v for k,v in frame.items() if k not in ('file','shadowFile')}|
                           {'rect':[x,y,w,h],'bounds':image.getchannel('A').getbbox(),'shadowRect':[sx,sy,640,126],'shadowScale':2,'shadowBounds':shadow.getchannel('A').getbbox()})
        index+=1
assert index==36
atlas.save(OUT/'juggling-player-v2.webp',quality=88,method=6)
shadows.save(OUT/'juggling-shadow-v2.webp',quality=85,method=6)
ball=Image.open(CACHE/'ball.png').convert('RGBA');ball=ball.crop(ball.getchannel('A').getbbox())
ball.save(OUT/'juggling-ball-v2.webp',quality=90,method=6)
files=['juggling-court-v1.webp','juggling-player-v2.webp','juggling-ball-v2.webp','juggling-shadow-v2.webp']
manifest={'version':2,'fps':24,'worldHeight':2.5,'anchors':data['anchors'],'frameSize':[w,h],'clips':clips,
 'images':{'court':files[0],'player':files[1],'ball':files[2],'shadow':files[3]},
 'bytes':{f:(OUT/f).stat().st_size for f in files},'sha256':{f:digest(OUT/f) for f in files}}
(OUT/'juggling-v2.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
shutil.copy2(CACHE/'License.txt',ROOT/'QUATERNIUS-LICENSE.txt')
provenance={'verified':'2026-10-18','runtime_budget_bytes':1500000,
 'character':{'author':'Quaternius','source':'https://opengameart.org/content/universal-animation-library',
  'official_source':'https://quaternius.com/packs/universalanimationlibrary.html','licence':'CC0 1.0',
  'archive':'https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip',
  'archive_sha256':digest(CACHE/'quaternius-universal-animation-standard.zip'),
  'rig_sha256':digest(CACHE/'AnimationLibrary_Godot_Standard.glb'),
  'retarget':'Weighted body skeleton fitted to existing licensed MakeHuman human and clothing; original idle, kick-height poses and miss.',
  'human_source':'art/outdoor/assets.json#assets/makehuman_base','human_asset':'assets/outdoor/person.glb',
  'human_sha256':digest(PROJECT/'assets/outdoor/person.glb')},
 'kit':{'source':'CC0 MakeHuman male_casualsuit04 adapted to jersey/shorts; original socks',
  'licence_source':'https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html',
  'textures':json.loads((CACHE/'system-files.json').read_text()),'materials':'Textured skin with subsurface and micro-roughness; alpha hair; original knit fabrics and gum-soled indoor trainers'},
 'lighting':{'sun':'Back-left warm directional light','fill':'Soft cool sky and weak warm court bounce','shadow':'Per-pose Cycles shadow catcher, separate transparent atlas'},
 'court':{'tool':'built-in imagegen','reference':'assets/outdoor/concept-coast-v2.webp',
  'source':'exec-9e05d33f-25fc-42c4-b366-06ce50a0be2f.png','prompt_file':'art/games/juggling-court-prompt.txt'},
 'render':{'blender':'5.2.2 LTS','engine':'Cycles','samples':32,'gpu':'OptiX','frame_size':[w,h],
  'camera':data['camera'],'anchors':data['anchors'],'scripts':['art/games/futsal_kit.py','art/games/render_juggling.py','art/games/render_ball.py','art/games/pack_juggling.py']},
 'runtime_files':{f:{'bytes':(OUT/f).stat().st_size,'sha256':digest(OUT/f)} for f in files+['juggling-v2.json']}}
(ROOT/'assets.json').write_text(json.dumps(provenance,indent=2)+'\n')
print('JUGGLING_ART_BYTES',sum((OUT/f).stat().st_size for f in files+['juggling-v2.json']))