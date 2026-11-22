import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const name='lookup-ape4-clarent-respaldos';
const folder='tmp/pdfs/ape4-preview';
await mkdir(folder,{recursive:true});
const task=getDocument({data:new Uint8Array(await readFile(`output/pdf/${name}.pdf`)),standardFontDataUrl:'node_modules/pdfjs-dist/standard_fonts/',useSystemFonts:false});
try{
 const doc=await task.promise;
 const width=375,height=525;
 for(let start=1;start<=doc.numPages;start+=4){
  const count=Math.min(4,doc.numPages-start+1);
  const sheet=createCanvas(width*2,height*Math.ceil(count/2));
  const ctx=sheet.getContext('2d');
  ctx.fillStyle='#e1e8f0';ctx.fillRect(0,0,sheet.width,sheet.height);
  for(let i=0;i<count;i++){
   const page=await doc.getPage(start+i);
   const viewport=page.getViewport({scale:.6});
   const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   ctx.drawImage(canvas,(i%2)*width+9,Math.floor(i/2)*height+8);
  }
  await writeFile(`${folder}/paginas-desde-${start}.png`,sheet.toBuffer('image/png'));
 }
 console.log(`${doc.numPages} páginas renderizadas en ${folder}`);
}finally{await task.destroy();}
