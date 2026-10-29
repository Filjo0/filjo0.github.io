"""Fetch only CC0 graphical data from the official MakeHuman distribution.
No program code is downloaded or executed. Produces a source cache, not a runtime character.
"""
import hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent;CACHE=ROOT/'.cache'
def read(url):
    request=urllib.request.Request(url,headers={'User-Agent':'PhilippPortfolioStudio/1.0'})
    with urllib.request.urlopen(request,timeout=90) as response:return response.read()
commit=json.loads(read('https://api.github.com/repos/makehumancommunity/makehuman/commits/master'))['sha']
base='https://raw.githubusercontent.com/makehumancommunity/makehuman/'+commit+'/'
files={'base.obj':'makehuman/data/3dobjs/base.obj',
       'adult-male.target':'makehuman/data/targets/macrodetails/caucasian-male-young.target',
       'body-shape.target':'makehuman/data/targets/macrodetails/universal-male-young-averagemuscle-averageweight.target',
       'LICENSE.md':'LICENSE.md','LICENSE.ASSETS.md':'LICENSE.ASSETS.md'}
record={'source':'https://github.com/makehumancommunity/makehuman/tree/'+commit,
 'licence':'CC0 1.0 (graphical assets only)','licence_source':'https://github.com/makehumancommunity/makehuman/blob/'+commit+'/LICENSE.md',
 'revision':commit,'type':'character','files':{},'urls':{}}
for name,path in files.items():
    relative='models/human/'+name;target=CACHE/relative
    target.parent.mkdir(parents=True,exist_ok=True);data=read(base+path);target.write_bytes(data)
    record['files'][relative]=hashlib.sha256(data).hexdigest();record['urls'][relative]=base+path
manifest=json.loads((ROOT/'assets.json').read_text())
manifest['assets']['makehuman_base']=record
(ROOT/'assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('CC0_CHARACTER_DATA',commit,len((CACHE/'models/human/base.obj').read_bytes()))
groups={}
for line in (CACHE/'models/human/base.obj').read_text().splitlines():
    if line.startswith('g '): group=line[2:]
    if line.startswith('f '):groups[group]=groups.get(group,0)+1
print('MESH_GROUPS',json.dumps(groups))
