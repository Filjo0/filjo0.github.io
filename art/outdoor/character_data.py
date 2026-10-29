"""Small data-only OBJ/MHCLO reader for the licensed human source assets."""
from pathlib import Path
import math

def read_obj(path):
    vertices=[];uv=[];faces=[];group='body'
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        fields=line.split()
        if not fields:continue
        if fields[0]=='v':vertices.append(tuple(map(float,fields[1:4])))
        elif fields[0]=='vt':uv.append(tuple(map(float,fields[1:3])))
        elif fields[0]=='g':group=' '.join(fields[1:])
        elif fields[0]=='f':
            corners=[]
            for value in fields[1:]:
                indices=value.split('/')
                corners.append((int(indices[0])-1,int(indices[1])-1 if len(indices)>1 and indices[1] else -1))
            faces.append((group,corners))
    return {'vertices':vertices,'uv':uv,'faces':faces}

def apply_targets(vertices,paths):
    result=[list(v) for v in vertices]
    for path in paths:
        for line in Path(path).read_text().splitlines():
            fields=line.split()
            if len(fields)!=4 or fields[0].startswith('#'):continue
            index=int(fields[0])
            for axis in range(3):result[index][axis]+=float(fields[axis+1])
    return result

def joint_centres(mesh,vertices):
    groups={}
    for group,corners in mesh['faces']:
        if group.startswith('joint-'):
            groups.setdefault(group,set()).update(i for i,_ in corners)
    return {name:tuple(sum(vertices[i][a] for i in indices)/len(indices) for a in range(3))
            for name,indices in groups.items()}

def fit_clothing(mesh,path,morphed):
    scales=[1,1,1];rows=[];active=False
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        fields=line.split()
        if not fields or fields[0].startswith('#'):continue
        if fields[0] in ('x_scale','y_scale','z_scale'):
            axis='xyz'.index(fields[0][0]);a,b=int(fields[1]),int(fields[2])
            scales[axis]=abs(morphed[a][axis]-morphed[b][axis])/float(fields[3])
        elif fields[0]=='verts':active=True
        elif active:
            try:
                if len(fields)==1:
                    rows.append(tuple(morphed[int(fields[0])]))
                elif len(fields)==9:
                    indices=list(map(int,fields[:3]));weights=list(map(float,fields[3:6]));offset=list(map(float,fields[6:9]))
                    rows.append(tuple(sum(morphed[i][axis]*weight for i,weight in zip(indices,weights))+
                                      offset[axis]*scales[axis] for axis in range(3)))
                else:active=False
            except ValueError:active=False
    if len(rows)!=len(mesh['vertices']):
        raise ValueError('MHCLO mapping count does not match geometry: '+str(path))
    return rows
