export interface ReportAmounts { values:Record<number,number>; approximate:number|null }

export function parseAmount(raw:string):number|null {
 const amount=raw.replace(/(?:USD|US\$|\$)/gi,'').trim().replace(/[\u00a0\u202f]/g,' ');
 const decimal=amount.match(/^(\d+|\d{1,3}(?:[., ]\d{3})+)([.,])(\d{1,2})$/);
 const integer=/^\d+$/.test(amount)?amount:null;
 if(!decimal&&!integer)return null;
 const whole=Number(decimal?decimal[1].replace(/[., ]/g,''):integer);
 const cents=whole*100+Number(decimal?.[3].padEnd(2,'0')??0);
 return Number.isSafeInteger(cents)&&cents<=99999999999?cents:null;
}

const labels=[
 /decim[ao]\s*tercer/,/decim[ao]\s*cuart/,/vacaciones/,/despido\s+intempestivo/,/desahucio/,
 /embaraz[oa]/,/dirigente\s+sindical/,/discapacidad/,/enfermedad\s+no/,/terminacion\s+(?:anticipada|antes de)/,
 /total\s+(?:valor\s+)?(?:(?:de\s+)?liquidacion|aproximad[oa]|a\s+recibir)|^total\s*[:$]/,
];
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const amountAtEnd=/(?:US\$|USD|\$)?\s*(\d{1,3}(?:[., ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*USD)?\s*$/i;

export function candidates(text:string):ReportAmounts {
 const lines=text.split('\n').map(normalized).filter(Boolean);
 const found=new Map<number,Set<number>>();
 for(let i=0;i<lines.length;i++){
  const first=lines[i];
  if(/^(?:[“"']|el |la |los |las |segun |conforme |art\b|articulo\b)/.test(first))continue;
  let row=first;
  for(let continuation=0;continuation<=2;continuation++){
   const indexes=labels.flatMap((label,index)=>label.test(row)?[index]:[]);
   if(indexes.length>1)break;
   const amount=row.match(amountAtEnd);
   if(indexes.length===1&&amount){
    const prefix=row.slice(0,amount.index).trimEnd();
    const separated=/\$|usd/i.test(amount[0])||/[:=]\s*$/.test(prefix)||/^[\d.,\s]+$/.test(lines[i+continuation]);
    if(separated&&!/\b(?:art(?:iculo)?\.?[- ]*|ley\s+\w*)$/.test(prefix)){
     const cents=parseAmount(amount[1]);
     if(cents!==null){const values=found.get(indexes[0])??new Set<number>();values.add(cents);found.set(indexes[0],values);}
     break;
    }
   }
   const next=lines[i+continuation+1];
   if(!next||labels.some(label=>label.test(next))||/\b(?:art\.|articulo|codigo del trabajo)\b/.test(next))break;
   row+=' '+next;
  }
 }
 const values:Record<number,number>={};
 let approximate:number|null=null;
 for(const [index,options] of found){
  if(options.size!==1)continue;
  const [amount]=options;
  if(index===labels.length-1)approximate=amount;
  else values[index]=amount;
 }
 return {values,approximate};
}

type PositionedText={str:string;transform:number[]};
export function textByRows(items:PositionedText[]):string {
 const rows:{y:number;items:{str:string;x:number}[]}[]=[];
 for(const item of items){
  if(!item.str.trim())continue;
  const y=item.transform[5];
  let row=rows.find(other=>Math.abs(other.y-y)<3);
  if(!row){row={y,items:[]};rows.push(row);}
  row.items.push({str:item.str,x:item.transform[4]});
 }
 return rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.x-b.x).map(item=>item.str).join(' ')).join('\n');
}

export async function readReportText(pdf:import('pdfjs-dist/types/src/display/api').PDFDocumentProxy){
 if(pdf.numPages>100)throw new Error('PDF extenso. Registra los importes manualmente.');
 const pages:string[]=[];
 for(let index=1;index<=pdf.numPages;index++){
  const content=await(await pdf.getPage(index)).getTextContent();
  pages.push(textByRows(content.items.filter((item):item is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in item)));
 }
 return pages.join('\n');
}

export class MinisterialReportParserService {
 async extract(blob:Blob):Promise<ReportAmounts>{
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc='/assets/pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer())});
  try{return candidates(await readReportText(await task.promise));}
  finally{await task.destroy();}
 }
}
