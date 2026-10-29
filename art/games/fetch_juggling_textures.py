"""Fetch CC0 skin and hair graphical textures, with bounded/restartable archive range reads."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import sys,zipfile,json,hashlib,subprocess,urllib.request
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'outdoor'))
from fetch_clothes import RemoteZip,URL,SIZE
class ChunkedZip(RemoteZip):
    def read(self,size=-1):
        size=min(SIZE-self.position,size if size>=0 else SIZE-self.position)
        if size<=65536:return super().read(size)
        start=self.position;cache=ROOT/'.cache/ranges';cache.mkdir(exist_ok=True)
        def piece(offset):
            length=min(65536,size-offset);name=cache/(str(start+offset)+'-'+str(length)+'.bin')
            if name.exists() and name.stat().st_size==length:return name.read_bytes()
            cmd=['curl.exe','--silent','--show-error','--fail','--max-time','35','--retry','2',
                 '--range',str(start+offset)+'-'+str(start+offset+length-1),URL]
            result=subprocess.run(cmd,capture_output=True,check=True).stdout
            if len(result)!=length:raise ValueError('Incorrect archive range size')
            name.write_bytes(result);return result
        with ThreadPoolExecutor(max_workers=12) as pool:result=b''.join(pool.map(piece,range(0,size,65536)))
        self.position+=len(result);return result
# Restore authoring geometry from the already recorded revisions, without updating outdoor assets.
outdoor=ROOT.parent/'outdoor';record=json.loads((outdoor/'assets.json').read_text())['assets']
for rel in ['models/human/base.obj','models/human/adult-male.target','models/human/body-shape.target']:
    target=outdoor/'.cache'/rel;expected=record['makehuman_base']['files'][rel]
    if not target.exists():
        with urllib.request.urlopen(record['makehuman_base']['urls'][rel],timeout=40) as response:blob=response.read()
        if hashlib.sha256(blob).hexdigest()!=expected:raise ValueError('Pinned geometry hash mismatch: '+rel)
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(blob)
    if hashlib.sha256(target.read_bytes()).hexdigest()!=expected:raise ValueError('Local geometry differs: '+rel)
wanted=['skins/young_caucasian_male/young_lightskinned_male_diffuse.png','hair/short01/short01_diffuse.png']
pinned=json.loads((ROOT/'assets.json').read_text())['kit']['textures']['files']
jobs=[(ROOT/'.cache/system'/n,n,pinned[n]['sha256']) for n in wanted]
for name in ['male_casualsuit04.obj','male_casualsuit04.mhclo']:
    entry='clothes/male_casualsuit04/'+name;rel='models/human/system/'+entry
    jobs.append((outdoor/'.cache'/rel,entry,record['makehuman_system']['files'][rel]))
missing=[job for job in jobs if not job[0].exists()]
if missing:
    print('Reading CC0 archive directory',flush=True)
    with zipfile.ZipFile(ChunkedZip()) as archive:
        for target,name,expected in missing:
            print('Fetching '+name,flush=True);blob=archive.read(name)
            if hashlib.sha256(blob).hexdigest()!=expected:raise ValueError('Pinned graphical asset mismatch: '+name)
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(blob)
for target,name,expected in jobs:
    if hashlib.sha256(target.read_bytes()).hexdigest()!=expected:raise ValueError('Local asset differs: '+name)
files={n:{'sha256':pinned[n]['sha256'],'bytes':(ROOT/'.cache/system'/n).stat().st_size} for n in wanted}
(ROOT/'.cache/system-files.json').write_text(json.dumps({'source':URL,'licence':'CC0 1.0','files':files},indent=2))
print('Verified pinned CC0 body, clothing, skin and hair sources',flush=True)
