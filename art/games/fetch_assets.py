"""Fetch only pinned CC0 model data. No downloaded code is executed."""
from pathlib import Path
import urllib.request,zipfile,hashlib
ROOT=Path(__file__).resolve().parent;CACHE=ROOT/'.cache'
URL='https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip'
SHA='18ff1a7215f4852b320203e8aaf02a1578b5c8eef9027fbaedfcedc7b85a3ac2'
CACHE.mkdir(exist_ok=True);target=CACHE/'quaternius-universal-animation-standard.zip'
if not target.exists():
    request=urllib.request.Request(URL,headers={'User-Agent':'PortfolioStudio/1.0'})
    with urllib.request.urlopen(request,timeout=90) as response:data=response.read()
    if hashlib.sha256(data).hexdigest()!=SHA:raise RuntimeError('Source changed: review its licence and revision before updating the pin.')
    target.write_bytes(data)
assert hashlib.sha256(target.read_bytes()).hexdigest()==SHA
with zipfile.ZipFile(target) as archive:
    for source,name in [('Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb',
                         'AnimationLibrary_Godot_Standard.glb'),('Animation Library[Standard]/License.txt','License.txt')]:
        (CACHE/name).write_bytes(archive.read(source))
print('Verified CC0 rig data downloaded.')