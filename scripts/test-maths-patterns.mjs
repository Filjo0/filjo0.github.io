import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fibonacciTiling,pascalRows,shallowDiagonal} from '../world/maths-patterns.js';
test('Fibonacci squares follow the recurrence, stay bounded and tile without overlap',()=>{
 const {squares,bounds}=fibonacciTiling(999);
 assert.equal(squares.length,12);assert.deepEqual(squares.map(s=>s.value),[1,1,2,3,5,8,13,21,34,55,89,144]);
 assert.equal(squares.reduce((sum,s)=>sum+s.size*s.size,0),bounds.width*bounds.height);
 for(const a of squares)for(const b of squares)if(a!==b)
  assert.ok(a.x+a.size<=b.x||b.x+b.size<=a.x||a.y+a.size<=b.y||b.y+b.size<=a.y,'Square interiors never overlap');
});
test('each quarter-circle joins the previous arc with a continuous tangent',()=>{
 const {squares}=fibonacciTiling(12);
 for(const [i,s] of squares.entries()){
  for(const p of [s.start,s.end])assert.equal(Math.hypot(p[0]-s.centre[0],p[1]-s.centre[1]),s.size);
  assert.ok((s.start[0]-s.centre[0])*(s.end[0]-s.centre[0])+(s.start[1]-s.centre[1])*(s.end[1]-s.centre[1])===0);
  if(i){const prev=squares[i-1];assert.deepEqual(s.start,prev.end);
   const a=prev.end.map((v,j)=>(v-prev.centre[j])/prev.size),b=s.start.map((v,j)=>(v-s.centre[j])/s.size);
   assert.ok(a.every((v,j)=>v===b[j]),'Arc radii, and therefore tangents, agree at the join');}
 }
});
test('the displayed ratio comes from the actual last two squares',()=>{
 const s=fibonacciTiling(12).squares;assert.ok(Math.abs(s.at(-1).value/s.at(-2).value-(1+Math.sqrt(5))/2)<.001);
 assert.equal(fibonacciTiling(0).squares.length,0);
});
test('Pascal rows use their two actual parents and remain exact through row 32',()=>{
 const rows=pascalRows(999);assert.equal(rows.length,32);
 rows.forEach((row,r)=>{assert.equal(row[0],1);assert.equal(row.at(-1),1);assert.equal(row.reduce((a,b)=>a+b,0),2**r);
  for(let c=1;c<r;c++)assert.equal(row[c],rows[r-1][c-1]+rows[r-1][c]);
  assert.ok(row.every(Number.isSafeInteger));});
});
test('odd entries form three smaller copies at each power-of-two scale',()=>{
 const rows=pascalRows(32);assert.equal(rows.flat().filter(v=>v%2).length,243);
 for(let r=16;r<32;r++)for(let c=0;c<=r;c++){
  const expected=c<=r-16?rows[r-16][c]%2:c>=16?rows[r-16][c-16]%2:0;
  assert.equal(rows[r][c]%2,expected);
 }
});
test('shallow diagonals sum to Fibonacci numbers from their real cells',()=>{
 const rows=pascalRows(32),sums=Array.from({length:32},(_,i)=>shallowDiagonal(rows,i).sum);
 assert.deepEqual(sums.slice(0,8),[1,1,2,3,5,8,13,21]);
 for(let i=2;i<sums.length;i++)assert.equal(sums[i],sums[i-1]+sums[i-2]);
 const d=shallowDiagonal(rows,7);assert.deepEqual(d.cells.map(c=>c.value),[4,10,6,1]);assert.equal(d.sum,21);
});
