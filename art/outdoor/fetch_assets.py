"""Download only documented public CC0 art inputs, without executing downloaded code.
Run: python art/outdoor/fetch_assets.py [asset IDs...]. Cache is ignored.
"""
import hashlib, json, sys, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'.cache'
MANIFEST=ROOT/'assets.json'
TEXTURES=('oak_veneer_01','walnut_veneer','grey_plaster_02','rough_linen','rock_face_03','coast_sand_01','aerial_grass_rock')
MODELS={name:'2k' for name in ('modern_arm_chair_01','potted_plant_01','potted_plant_04','throw_pillows_01','book_encyclopedia_set_01')}
MODELS.update({name:'1k' for name in ('island_tree_01','wild_rooibos_bush','grass_medium_02','coast_rocks_02','pine_tree_01')})
MODELS.update({name:'1k' for name in ('shrub_03','shrub_sorrel_01','fern_02','grass_bermuda_01','sofa_03')})
HDRS=('kloppenheim_06',)
def request(url):
    if not url.startswith(('https://api.polyhaven.com/','https://dl.polyhaven.org/')):
        raise ValueError('Unexpected asset host')
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'PhilippPortfolioStudio/1.0'}),timeout=180) as response:
        return response.read()
def download(url, relative, record):
    target=(CACHE/relative).resolve()
    if not target.is_relative_to(CACHE.resolve()): raise ValueError('Asset path escapes cache')
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists(): target.write_bytes(request(url))
    record['files'][target.relative_to(CACHE).as_posix()]=hashlib.sha256(target.read_bytes()).hexdigest()
    record['urls'][target.relative_to(CACHE).as_posix()]=url
manifest=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'licence_source':'https://polyhaven.com/license','verified':'2026-10-10','assets':{}}
chosen=sys.argv[1:] or list(TEXTURES)+list(MODELS)+list(HDRS)
for name in chosen:
    if name not in (*TEXTURES,*MODELS,*HDRS): raise ValueError('Undocumented asset: '+name)
    listing=json.loads(request('https://api.polyhaven.com/files/'+name))
    kind='textures' if name in TEXTURES else 'models' if name in MODELS else 'hdris'
    resolution='2k' if kind=='textures' else MODELS[name] if kind=='models' else '1k'
    record={'source':'https://polyhaven.com/a/'+name,'licence':'CC0 1.0','type':kind,'resolution':resolution,'files':{},'urls':{}}
    if kind=='models':
        item=listing['gltf'][resolution]['gltf']
        download(item['url'],Path('models')/name/(name+'.gltf'),record)
        for relative, data in item.get('include',{}).items():
            download(data['url'],Path('models')/name/relative,record)
    elif kind=='textures':
        for key, filename in (('Diffuse','diffuse'),('nor_gl','normal'),('Rough','rough')):
            options=listing[key][resolution]; ext='jpg' if 'jpg' in options else 'png'
            download(options[ext]['url'],Path('textures')/name/(filename+'.'+ext),record)
    else:
        download(listing['hdri'][resolution]['hdr']['url'],Path('hdris')/name/'environment.hdr',record)
    manifest['assets'][name]=record
    MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n')
    print(name, sum((CACHE/file).stat().st_size for file in record['files']), flush=True)
