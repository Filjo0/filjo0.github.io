import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {containsPrivateProject} from './public-content-guard.mjs';
const fixture=[[6,7,createHash('sha256').update('hidden example').digest('hex')]];
test('public-source guard retains case-insensitive substring matching without naming private products',()=>{
 for(const text of ['hidden example','HIDDEN EXAMPLE','prefixhidden examplesuffix'])
  assert.equal(containsPrivateProject(text,fixture),true);
 for(const text of ['hidden','example','hidden examples'.replace(' ','_'),'public example'])
  assert.equal(containsPrivateProject(text,fixture),false);
});
