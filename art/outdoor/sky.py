"""Render the same physical sky into six small local environment faces."""
import math
from pathlib import Path
import bpy
from mathutils import Vector,Matrix

def export_sky(scene,output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    hidden={obj:obj.hide_render for obj in scene.objects}
    original_camera=scene.camera
    original=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,
              scene.render.image_settings.file_format,scene.render.filepath,scene.cycles.samples)
    camera_data=bpy.data.cameras.new('author_sky_camera');camera_data.lens=18;camera_data.sensor_width=36
    camera=bpy.data.objects.new('author_sky_camera',camera_data);scene.collection.objects.link(camera)
    point=lambda v:Vector((v[0],-v[2],v[1]))
    faces=[('px',(1,0,0),(0,1,0)),('nx',(-1,0,0),(0,1,0)),
           ('py',(0,1,0),(0,0,-1)),('ny',(0,-1,0),(0,0,1)),
           ('pz',(0,0,1),(0,1,0)),('nz',(0,0,-1),(0,1,0))]
    try:
        for obj in hidden:obj.hide_render=True
        scene.camera=camera;scene.render.resolution_x=scene.render.resolution_y=512
        scene.render.resolution_percentage=100;scene.render.image_settings.file_format='JPEG'
        scene.render.image_settings.quality=90;scene.cycles.samples=4
        for name,direction,up in faces:
            forward=point(direction);up=point(up);right=forward.cross(up)
            camera.rotation_euler=Matrix((right,up,-forward)).transposed().to_euler()
            scene.render.filepath=str(output/(name+'.jpg'));bpy.ops.render.render(write_still=True)
    finally:
        for obj,value in hidden.items():obj.hide_render=value
        scene.camera=original_camera
        (scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,
         scene.render.image_settings.file_format,scene.render.filepath,scene.cycles.samples)=original
        bpy.data.objects.remove(camera,do_unlink=True)

def export_panorama(scene, output):
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    hidden={obj:obj.hide_render for obj in scene.objects}
    old_camera=scene.camera
    settings=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,
              scene.render.image_settings.file_format,scene.render.filepath,scene.cycles.samples)
    data=bpy.data.cameras.new('author_panorama');data.type='PANO';data.panorama_type='EQUIRECTANGULAR'
    camera=bpy.data.objects.new('author_panorama',data);scene.collection.objects.link(camera)
    camera.rotation_euler=(math.pi/2,0,0)
    try:
        for obj in hidden:obj.hide_render=True
        scene.camera=camera;scene.render.resolution_x=1024;scene.render.resolution_y=512
        scene.render.resolution_percentage=100;scene.render.image_settings.file_format='JPEG'
        scene.render.image_settings.quality=92;scene.render.filepath=str(output);scene.cycles.samples=4
        bpy.ops.render.render(write_still=True)
    finally:
        for obj,value in hidden.items():obj.hide_render=value
        scene.camera=old_camera
        (scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,
         scene.render.image_settings.file_format,scene.render.filepath,scene.cycles.samples)=settings
        bpy.data.objects.remove(camera,do_unlink=True)
