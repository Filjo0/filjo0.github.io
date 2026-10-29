"""Read selected CC0 graphical assets from the official system pack via HTTP ranges.
Never extracts or runs programs; cache paths stay inside this source directory.
"""
import io,json,urllib.request,zipfile,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
URL='https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip'
SIZE=280737770
class RemoteZip(io.RawIOBase):
    def __init__(self):self.position=0;self.blocks=[]
    def seekable(self):return True
    def readable(self):return True
    def tell(self):return self.position
    def seek(self,offset,whence=0):
        self.position=offset if whence==0 else self.position+offset if whence==1 else SIZE+offset
        return self.position
    def read(self,size=-1):
        size=min(SIZE-self.position,size if size>=0 else SIZE-self.position)
        if size<=0:return b''
        for start,data in self.blocks:
            if start<=self.position and self.position+size<=start+len(data):
                result=data[self.position-start:self.position-start+size];self.position+=size;return result
        headers={'User-Agent':'PhilippPortfolioStudio/1.0','Range':'bytes='+str(self.position)+'-'+str(self.position+size-1)}
        with urllib.request.urlopen(urllib.request.Request(URL,headers=headers),timeout=90) as r:
            if r.status!=206:raise ValueError('Server must support bounded range reads')
            data=r.read()
        if len(data)!=size:raise ValueError('Incomplete source archive range')
        self.position+=len(data);return data
GROUPS=('clothes/male_casualsuit04/','clothes/male_casualsuit05/',
        'clothes/shoes01/','hair/short01/','eyes/low-poly/','skins/young_caucasian_male/')
def fetch_groups(thumbs=False, geometry=False):
    manifest=json.loads((ROOT/'assets.json').read_text())
    record={'source':URL,'licence':'CC0 1.0','licence_source':
      'https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html',
      'type':'character-clothing','files':{},'urls':{}}
    remote=RemoteZip()
    with zipfile.ZipFile(remote) as archive:
        for info in archive.infolist():
            if not info.filename.startswith(GROUPS) or info.is_dir():continue
            extensions='.thumb' if thumbs else ('.obj','.mhclo','.mhmat') if geometry else ('.obj','.mhclo','.mhmat','.png','.thumb')
            if not info.filename.endswith(extensions):continue
            if info.file_size>8000000:raise ValueError('Unexpectedly large graphical asset')
            relative=Path('models/human/system')/info.filename
            target=(ROOT/'.cache'/relative).resolve()
            if not target.is_relative_to((ROOT/'.cache').resolve()):raise ValueError('Unsafe source archive path')
            if not target.exists():
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(info))
            record['files'][relative.as_posix()]=hashlib.sha256(target.read_bytes()).hexdigest()
            record['urls'][relative.as_posix()]=URL+'#'+info.filename
            print(info.filename,info.file_size,flush=True)
    previous=manifest['assets'].get('makehuman_system',{})
    record['files']={**previous.get('files',{}),**record['files']}
    record['urls']={**previous.get('urls',{}),**record['urls']}
    manifest['assets']['makehuman_system']=record
    (ROOT/'assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':
    import sys
    fetch_groups('--thumbs' in sys.argv,'--geometry' in sys.argv)
