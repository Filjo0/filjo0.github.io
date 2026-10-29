"""Web export and structural guards for the authored outdoor assets."""
import json, struct
from pathlib import Path
import bpy

def export_web(scene, output, retry=True):
    # The Blender roundtrip emits an empty packed ORM source for these imported
    # potted-plant materials. Clay/leaves use constant roughness instead.
    for material in bpy.data.materials:
        if material.name.startswith('potted_plant_01'):
            bsdf=material.node_tree.nodes.get('Principled BSDF')
            if bsdf:
                for name,value in (('Roughness',.8),('Metallic',0)):
                    for link in list(bsdf.inputs[name].links):
                        material.node_tree.links.remove(link)
                    bsdf.inputs[name].default_value=value
    for o in scene.objects:
        o.select_set(o.type in {'MESH','EMPTY'} and not o.name.startswith('author_'))
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
        export_image_format='WEBP',export_yup=True,export_apply=True,export_lights=False,export_cameras=False,export_gpu_instances=True)
    data=Path(output).read_bytes()
    length=struct.unpack_from('<I',data,12)[0]
    document=json.loads(data[20:20+length])
    invalid=[]
    for i,texture in enumerate(document.get('textures',[])):
        source=texture.get('source',texture.get('extensions',{}).get('EXT_texture_webp',{}).get('source'))
        if not isinstance(source,int) or not 0<=source<len(document.get('images',[])):
            invalid.append(i)
    if invalid and retry:
        repaired=[]
        for definition in document.get('materials',[]):
            packed=definition.get('pbrMetallicRoughness',{}).get('metallicRoughnessTexture',{})
            if packed.get('index') not in invalid:continue
            material=bpy.data.materials.get(definition['name'])
            if not material:continue
            bsdf=material.node_tree.nodes.get('Principled BSDF')
            for name,value in (('Roughness',.8),('Metallic',0)):
                for link in list(bsdf.inputs[name].links):material.node_tree.links.remove(link)
                bsdf.inputs[name].default_value=value
            repaired.append(material.name)
        if repaired:
            print('PACKED_ORM_FALLBACK',json.dumps(repaired),flush=True)
            return export_web(scene,output,retry=False)
    if invalid:raise ValueError('Invalid image sources for textures '+str(invalid))
    print('VALID_WEB_EXPORT',len(data),'bytes',flush=True)
