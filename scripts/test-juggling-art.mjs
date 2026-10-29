import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root));
test('rendered juggling uses recorded, bounded, transparent Blender art with real foot anchors',async()=>{
 const provenance=JSON.parse(await read('art/games/assets.json')),data=JSON.parse(await read('assets/games/juggling-v2.json'));
 assert.equal(provenance.character.licence,'CC0 1.0');let bytes=0;
 for(const [file,record] of Object.entries(provenance.runtime_files)){
  const b=await read('assets/games/'+file);bytes+=b.length;
  assert.equal(b.length,record.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),record.sha256);
 }
 assert.equal(data.anchors.source,'evaluated shoe mesh vertices');
 assert.ok(bytes<=1500000);assert.equal(data.worldHeight,2.5);
 const atlas=await read('assets/games/'+data.images.player);
 assert.equal(atlas.toString('ascii',0,4),'RIFF');assert.equal(atlas.toString('ascii',8,12),'WEBP');
 assert.equal(atlas.toString('ascii',12,16),'VP8X');assert.ok(atlas[20]&16,'The sprite atlas has genuine alpha');
 const width=atlas.readUIntLE(24,3)+1,height=atlas.readUIntLE(27,3)+1;
 assert.ok(width<=4096&&height<=4096,'The atlas fits common 4096 texture bounds');
 for(const clip of ['idle','kick','miss']){
  assert.equal(data.clips[clip].length,12);
  for(const frame of data.clips[clip]){
   const [x,y,w,h]=frame.rect;
   assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height);
   for(const anchor of [frame.toe,frame.plant]){
    assert.ok(anchor.every(Number.isFinite));assert.ok(anchor[0]>=0&&anchor[0]<=w&&anchor[1]>=0&&anchor[1]<=h);
   }
   assert.ok(frame.bounds[2]>frame.bounds[0]&&frame.bounds[3]>frame.bounds[1]);
   assert.ok(frame.shadowBounds?.[2]>frame.shadowBounds?.[0],'Every pose has a genuine rendered court shadow');
   assert.equal(frame.shadowRect[2],640);assert.equal(frame.shadowRect[3],126);
   assert.ok(frame.shadowPlant.every(Number.isFinite));
   assert.ok(frame.shadowBounds[2]>frame.shadowPlant[0]+80,'The actual cast shadow extends toward camera-right');
  }
 }
 assert.equal(provenance.kit.textures.licence,'CC0 1.0');
 assert.ok(provenance.lighting.shadow.includes('Cycles'));
 const heights=data.clips.kick.map(f=>f.plant[1]-f.toe[1]);
 assert.ok(Math.max(...heights)-Math.min(...heights)>data.frameSize[1]*.2,'The rig actually lifts the foot through different kick heights');
 assert.equal(createHash('sha256').update(await read(provenance.character.human_asset)).digest('hex'),provenance.character.human_sha256);
});