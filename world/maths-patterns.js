// Exact finite constructions shared by the drawings and their explanations.
export function fibonacciTiling(count) {
  const n=Math.max(0,Math.min(12,Math.floor(count))),squares=[];
  let bounds={x:0,y:0,width:1,height:1},a=1,b=1,end=[0,1];
  for(let i=0;i<n;i++) {
    const size=i<2?1:a+b;
    if(i>=2)[a,b]=[b,size];
    let x=0,y=0,centre=[1,1],next=[1,0];
    if(i) {
      const direction=(i-1)%4;
      if(direction===0){x=bounds.x+bounds.width;y=bounds.y;centre=[x,y+size];next=[x+size,y+size];}
      if(direction===1){x=bounds.x;y=bounds.y+bounds.height;centre=[x,y];next=[x,y+size];}
      if(direction===2){x=bounds.x-size;y=bounds.y;centre=[x+size,y];next=[x,y];}
      if(direction===3){x=bounds.x;y=bounds.y-size;centre=[x+size,y+size];next=[x+size,y];}
    }
    const start=[...end];end=next;
    squares.push({index:i,value:size,x,y,size,centre,start,end,
      path:`M${start.join(' ')}A${size} ${size} 0 0 1 ${end.join(' ')}`});
    const right=Math.max(bounds.x+bounds.width,x+size),bottom=Math.max(bounds.y+bounds.height,y+size);
    bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,y);bounds.width=right-bounds.x;bounds.height=bottom-bounds.y;
  }
  return {squares,bounds};
}
export function pascalRows(count) {
  const n=Math.max(0,Math.min(32,Math.floor(count))),rows=[];
  for(let r=0;r<n;r++)rows.push(Array.from({length:r+1},(_,c)=>c===0||c===r?1:rows[r-1][c-1]+rows[r-1][c]));
  return rows;
}
export function shallowDiagonal(rows,index) {
  const cells=[];
  for(let r=0;r<rows.length;r++) {
    const c=index-r;
    if(c>=0&&c<=r)cells.push({row:r,column:c,value:rows[r][c]});
  }
  return {cells,sum:cells.reduce((sum,c)=>sum+c.value,0)};
}
