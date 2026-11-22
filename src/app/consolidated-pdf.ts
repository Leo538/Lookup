import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PDFDocument, PDFFont } from 'pdf-lib';
import { Case, Document, State, activeReport, caseSources, checkApplicable, checkEvidence, completionIssues, money } from './models';
import { generatePDF } from './pdf';

function section(title:string,caseCode:string,body:string[][],index=false):ArrayBuffer {
 const pdf=new jsPDF({format:'a4'});
 pdf.setFillColor(16,42,67);
 pdf.rect(0,0,210,37,'F');
 pdf.setTextColor(255);
 pdf.setFontSize(21);
 pdf.text('LOOKUP',16,15);
 pdf.setFontSize(12);
 pdf.text(title,16,26);
 pdf.setTextColor(30,45,60);
 pdf.setFontSize(10);
 const caseLines=pdf.splitTextToSize(caseCode,178) as string[];
 pdf.text(caseLines,16,47);
 autoTable(pdf,{startY:50+4*caseLines.length,head:[index?['Documento o sección','Página']:['Detalle','Registro']],body,margin:{left:16,right:16,top:18,bottom:21},styles:{fontSize:10,cellPadding:3.5,overflow:'linebreak'},headStyles:{fillColor:[16,42,67]},columnStyles:index?{1:{cellWidth:22,halign:'right'}}:{0:{cellWidth:62}}});
 return pdf.output('arraybuffer');
}

const CONSOLIDATED='Expediente consolidado PDF' as const;
export async function createConsolidated(c:Case,docs:Document[],settings:State['settings'],fingerprint:string):Promise<Document> {
 const issues=completionIssues(c,docs);
 if(issues.length)throw new Error(issues.join('\n'));
 const { PDFDocument, PageSizes, StandardFonts, degrees, rgb }=await import('pdf-lib');
 const result=await PDFDocument.create();
 result.setTitle(`Expediente de terminación laboral - ${c.code}`);
 result.setAuthor(c.academic?.employer.name??'Lookup');
 const index:{label:string;page:number}[]=[];
 const sources=caseSources(c,docs);
 const report=activeReport(c,docs)!;
 const included=new Map<string,number>();
 const includedContent=new Map<string,number>();
 const [width,height]=PageSizes.A4;
 const nextPage=()=>result.getPageCount()+1;
 const append=async(bytes:ArrayBuffer)=>{
  const source=await PDFDocument.load(bytes);
  if(!source.getPageCount())throw new Error('El PDF no contiene páginas.');
  for(const page of await result.copyPages(source,source.getPageIndices()))result.addPage(page);
 };
 const insertSection=async(title:string,bytes:ArrayBuffer)=>{index.push({label:title,page:nextPage()});await append(bytes);};
 const appendAnnex=async(doc:Document)=>{
  if(included.has(doc.id))return;
  try{
   const bytes=await doc.blob.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',');
   const previous=includedContent.get(hash);
   if(previous){included.set(doc.id,previous);index.push({label:`   ${doc.name} (incluido en otro anexo)`,page:previous});return;}
   const start=nextPage();
   if(doc.mime==='application/pdf'){
    const source=await PDFDocument.load(bytes);
    if(!source.getPageCount())throw new Error('Sin páginas');
    for(const original of source.getPages()){
     const page=result.addPage(PageSizes.A4);
     if(!original.node.Contents())continue;
     const crop=original.getCropBox();
     const embedded=await result.embedPage(original,{left:crop.x,bottom:crop.y,right:crop.x+crop.width,top:crop.y+crop.height});
     const angle=((original.getRotation().angle%360)+360)%360;
     const sideways=angle===90||angle===270;
     const scale=Math.min((width-48)/(sideways?embedded.height:embedded.width),(height-52)/(sideways?embedded.width:embedded.height));
     const w=embedded.width*scale,h=embedded.height*scale;
     const x=(width-(sideways?h:w))/2,y=(height-(sideways?w:h))/2;
     page.drawPage(embedded,{x:x+(angle===180?w:angle===270?h:0),y:y+(angle===90?w:angle===180?h:0),width:w,height:h,rotate:degrees(-angle)});
    }
   }else{
    const image=doc.mime==='image/png'?await result.embedPng(bytes):await result.embedJpg(bytes);
    const fitted=image.scaleToFit(width-48,height-52);
    result.addPage(PageSizes.A4).drawImage(image,{x:(width-fitted.width)/2,y:(height-fitted.height)/2,...fitted});
   }
   included.set(doc.id,start);
   includedContent.set(hash,start);
   index.push({label:`   ${doc.name}`,page:start});
  }catch{throw new Error(`No se pudo incorporar «${doc.name}». Comprueba que el archivo abra y que el PDF no esté protegido con contraseña.`);}
 };

 const peace=await generatePDF(c,docs,settings,'Paz y salvo PDF',true);
 await insertSection('1. Certificado de paz y salvo',await peace.blob.arrayBuffer());
 const liquidation=await generatePDF(c,docs,settings,'Liquidación PDF',true);
 await insertSection('2. Liquidación laboral',await liquidation.blob.arrayBuffer());
 const evidenceIds=new Set(c.checks.filter(checkApplicable).flatMap(checkEvidence));
 const adjustmentIds=new Set(c.settlement.adjustments.map(adjustment=>adjustment.evidenceId));
 const terminationIds=new Set([c.termination?.documentId,...(c.termination?.relatedDocumentIds??[])]);
 for(const doc of sources.filter(d=>adjustmentIds.has(d.id)&&!evidenceIds.has(d.id)&&d.id!==report.id&&!terminationIds.has(d.id)))await appendAnnex(doc);

 const s=c.settlement;
 const vacation=c.academic?.vacation;
 await insertSection('3. Control de vacaciones',section('3. CONTROL DE VACACIONES',c.code,[
  ['Trabajador',c.worker.name],
  ...(vacation?[
   ['Primer período',`${vacation.firstDays} días gozados del ${vacation.firstStart} al ${vacation.firstEnd}`],
   ['Segundo período',`${vacation.secondPending.toLocaleString('es-EC')} días pendientes según el informe`],
   ['Valor de vacaciones según el informe',money(c.academic?.reference.concepts['Vacaciones']??0)],
  ]:[]),
  ['Saldo disponible de control (días)',String(s.vacation.available)],['Días utilizados',String(s.vacation.used)],
  ['Días liquidados',String(s.vacation.settled)],['Días pendientes',String(Math.round((s.vacation.available-s.vacation.used-s.vacation.settled)*100)/100)],
  ['Valor registrado en el reporte',money(s.values[2])],['Responsable de revisión',s.reviewer],
 ]));
 const termination=sources.find(d=>d.id===c.termination?.documentId);
 const related=sources.filter(d=>d.id!==termination?.id&&d.id!==report.id&&terminationIds.has(d.id));
 await insertSection('4. Documentación de terminación',section('4. DOCUMENTACIÓN DE TERMINACIÓN',c.code,[
  ['Causal',c.cause],['Respaldo revisado',termination?.name??'Excepción justificada'],['Descripción o motivo',termination?.description||c.termination?.exception||'Sin descripción'],
  ...(c.academic?[['Fecha de firma prevista en el informe',c.academic.employment.agreementDate]]:[]),
  ...related.map(doc=>['Documento complementario',doc.name]),
 ]));
 if(termination&&termination.id!==report.id)await appendAnnex(termination);
 for(const doc of related)await appendAnnex(doc);

 const checkDocs=sources.filter(doc=>evidenceIds.has(doc.id));
 const checkRows=checkDocs.map(doc=>[doc.name,c.checks.filter(check=>checkApplicable(check)&&checkEvidence(check).includes(doc.id)).map(check=>`${check.department} / ${check.label}`).join('\n')]);
 await insertSection('5. Evidencias del paz y salvo',section('5. EVIDENCIAS DEL PAZ Y SALVO',c.code,checkRows.length?checkRows:[['Respaldos','Sin archivos vinculados a verificaciones aplicables.']]));
 for(const doc of checkDocs)if(doc.id!==report.id)await appendAnnex(doc);

 const reportDate=new Date(report.createdAt).toLocaleDateString('es-EC',{timeZone:'America/Guayaquil'});
 await insertSection('6. Reporte ministerial',section('6. REPORTE MINISTERIAL',c.code,[['Archivo original',report.name],['Descripción',report.description||'Reporte seleccionado en Liquidación'],['Fecha de carga',reportDate]]));
 await appendAnnex(report);

 // Build the index twice so page references account for an index longer than one page.
 const coverRows=(offset:number)=>index.map(entry=>[entry.label,String(entry.page+offset)]);
 const coverTitle='EXPEDIENTE DE TERMINACIÓN LABORAL · ÍNDICE';
 const coverCode=`${c.code} | ${c.worker.name}${c.academic?` | ${c.academic.employer.name}`:''}${c.demo?' | CASO FICTICIO':''}`;
 const trial=await PDFDocument.load(section(coverTitle,coverCode,coverRows(0),true));
 const cover=await PDFDocument.load(section(coverTitle,coverCode,coverRows(trial.getPageCount()),true));
 const coverPages=await result.copyPages(cover,cover.getPageIndices());
 coverPages.forEach((page,index)=>result.insertPage(index,page));

 const font:PDFFont=await result.embedFont(StandardFonts.Helvetica);
 const pages=result.getPages();
 pages.forEach((page,i)=>page.drawText(`Lookup  |  ${c.code}  |  ${i+1} / ${pages.length}`,{x:45,y:15,size:8,font,color:rgb(.32,.39,.48)}));
 const bytes=await result.save();
 const blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
 const revision=1+Math.max(0,...docs.filter(d=>d.caseId===c.id&&d.kind===CONSOLIDATED).map(d=>d.revision??0));
 return {id:`${c.id}-consolidado-${fingerprint}`,caseId:c.id,name:`${c.code}-expediente-r${revision}.pdf`,mime:blob.type,size:blob.size,blob,kind:CONSOLIDATED,description:'Expediente consolidado con anexos',createdAt:new Date().toISOString(),revision,fingerprint};
}
