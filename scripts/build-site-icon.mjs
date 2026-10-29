import {readFile,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await pw.chromium.launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{})});
try {
  const page=await browser.newPage(),svg=(await readFile(new URL('../assets/site-icon.svg',import.meta.url))).toString('base64');
  const sizes=[16,32,48,64],images=[];
  for(const size of sizes) {
    const png=await page.evaluate(async({svg,size})=>{
      const image=new Image();image.src='data:image/svg+xml;base64,'+svg;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      canvas.getContext('2d').drawImage(image,0,0,size,size);return canvas.toDataURL('image/png').split(',')[1];
    },{svg,size});
    images.push(Buffer.from(png,'base64'));
  }
  const directory=Buffer.alloc(6+16*sizes.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);
  let offset=directory.length;
  for(let i=0;i<sizes.length;i++) {
    const entry=6+i*16;directory[entry]=directory[entry+1]=sizes[i];
    directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);
    directory.writeUInt32LE(images[i].length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=images[i].length;
  }
  await writeFile(new URL('../favicon.ico',import.meta.url),Buffer.concat([directory,...images]));
  console.log('favicon.ico: four PNG-backed icon sizes rendered from assets/site-icon.svg ('+offset+' bytes).');
} finally {await browser.close();}
