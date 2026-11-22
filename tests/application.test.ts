import '@angular/compiler';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Injector,ChangeDetectorRef} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {FormBuilder} from '@angular/forms';
import {jsPDF} from 'jspdf';
import 'fake-indexeddb/auto';
import {AppComponent} from '../src/app/app.component';
import {candidates,readReportText} from '../src/app/extraction';
import {RESIGNATION} from '../src/app/models';

function samplePdf(name:string,body:string){
 const pdf=new jsPDF();pdf.text(body,20,40);
 return new File([pdf.output('arraybuffer')],name,{type:'application/pdf'});
}
function fileEvent(file:File){return {target:{files:[file],value:file.name}} as unknown as Event;}

test('Lookup: renuncia, requisitos, lectura de repote.pdf, anexos, descarga, versiones y cierre',async(t)=>{
 const injector=Injector.create({providers:[FormBuilder,{provide:ChangeDetectorRef,useValue:{markForCheck(){}}},{provide:DomSanitizer,useValue:{bypassSecurityTrustResourceUrl:(s:string)=>s}},{provide:AppComponent,useFactory:()=>new AppComponent()}]});
 const app=injector.get(AppComponent);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 // Use the same report reader with PDF.js's Node entry point in this controller test.
 app.reportParser.extract=async blob=>{
  const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),standardFontDataUrl:'node_modules/pdfjs-dist/standard_fonts/'});
  try{return candidates(await readReportText(await task.promise));}finally{await task.destroy();}
 };
 await app.ngOnInit();assert.equal(app.ready(),true);
 app.workerForm.setValue({name:'Prueba Ficticia',identity:'0000000002',role:'Analista',department:'Tecnología',start:'2024-01-01',salary:'900.00',email:'prueba@example.invalid',phone:'',active:true});
 await app.saveWorker();assert.equal(app.state.workers.length,1);
 await app.saveWorker();assert.equal(app.state.workers.length,1);assert.match(app.toast(),/Ya existe/);
 app.newCase();
 app.caseForm.patchValue({workerId:app.state.workers[0].id,end:'2026-10-31',cause:RESIGNATION});
 assert.match(app.terminationGuide(RESIGNATION),/Carta de renuncia/);
 app.selectTermination(fileEvent(samplePdf('carta-ficticia.pdf','ANEXO CARTA DE RENUNCIA FICTICIA')),true);
 await app.createCase();
 assert.ok(app.current);assert.equal(app.terminationDoc?.kind,'Respaldo de terminación');
 assert.equal(app.current!.termination?.reviewed,false);
 app.current!.termination!.reviewed=true;app.dirty=true;await app.saveGeneral();

 app.changeTab('Paz y salvo');
 const [check,notApplicable,required]=app.departmentChecks('Tecnología');
 app.toggleCheck(check,true);check.required=true;check.evidenceRequired=true;
 check.status='Aprobado';check.reviewer='Responsable ficticio';check.date='2026-11-17';
 await app.saveChecks();assert.match(app.toast(),/adjunta un respaldo/);
 const act=samplePdf('acta-ficticia.pdf','ANEXO ACTA DE ENTREGA FICTICIA');
 app.addEvidence(check,fileEvent(act));app.addEvidence(check,fileEvent(act));
 const {createCanvas}=await import('@napi-rs/canvas');
 const image=createCanvas(600,300);const context=image.getContext('2d');
 context.fillStyle='#eaf0fa';context.fillRect(0,0,600,300);context.fillStyle='#102a43';context.font='26px sans-serif';context.fillText('Evidencia ficticia de prueba',40,120);
 const imageBytes=new Uint8Array(image.toBuffer('image/png'));
 app.addEvidence(check,fileEvent(new File([imageBytes],'foto-ficticia.png',{type:'image/png'})));
 app.toggleCheck(notApplicable,true);
 app.addEvidence(notApplicable,fileEvent(samplePdf('excluido.pdf','ESTE ANEXO QUEDA EXCLUIDO')));
 app.toggleCheck(required,true);required.required=true;
 app.customLabels['Tecnología']='Entrega de credencial';app.addCheck('Tecnología');
 await app.saveChecks();assert.equal(app.checkReady(app.current!),false);
 const excluded=app.current!.checks.find(x=>x.id===notApplicable.id)!;
 excluded.status='No aplica';excluded.notes='No recibió accesorios.';excluded.reviewer='Responsable ficticio';excluded.date='2026-11-17';excluded.required=true;excluded.evidenceRequired=true;
 app.toggleCheck(app.current!.checks.find(x=>x.id===required.id)!,false);
 await app.saveChecks();assert.equal(app.checkReady(app.current!),true);
 assert.equal(app.history.find(h=>h.checks)?.checks?.length,19);

 app.changeTab('Liquidación');
 const scanned=new jsPDF();scanned.addImage(imageBytes,'PNG',10,10,100,50);
 app.fileSelected(fileEvent(new File([scanned.output('arraybuffer')],'escaneado.pdf',{type:'application/pdf'})));
 await app.upload();
 assert.ok(app.values.getRawValue().every(value=>value===''));
 assert.equal(app.settlementForm.controls.approximate.value,'');
 assert.match(app.toast(),/No se detectaron importes/);
 const reportBytes=await readFile('public/examples/repote.pdf');
 app.fileSelected(fileEvent(new File([reportBytes],'repote.pdf',{type:'application/pdf'})));
 await app.upload();
 assert.equal(app.report?.name,'repote.pdf');
 assert.deepEqual(app.values.getRawValue(),['1140.00','136.57','284.40','0.00','3000.00','0.00','0.00','0.00','0.00','0.00']);
 assert.equal(app.settlementForm.controls.approximate.value,'4560.97');
 assert.equal(app.hasValidated,false);
 app.settlementForm.patchValue({available:10,used:3,settled:2,final:'4560.97',reviewer:'Revisor ficticio'});
 app.settlementForm.controls.confirmed.setValue(true);
 app.settlementForm.controls.notes.setValue('Comprobación académica de los valores del reporte de prueba.');
 assert.equal(app.settlementForm.controls.confirmed.value,false);
 await app.saveSettlement(true);assert.equal(app.hasValidated,false);
 app.settlementForm.controls.confirmed.setValue(true);await app.saveSettlement(true);
 assert.equal(app.hasValidated,true);assert.equal(app.current!.settlement.final,456097);assert.equal(app.vacationRemaining,5);
 const foreign=await app.makeDocument({...app.current!,id:'otro-expediente'},samplePdf('otro.pdf','ANEXO DE OTRO EXPEDIENTE'),'Evidencia','Caso externo');
 app.docs.push(foreign);
 await app.transition('Finalizado');assert.match(app.toast(),/genere el expediente PDF consolidado/);

 await app.generate();
 assert.equal(app.generated.length,1,app.toast());
 const consolidated=app.generated[0];
 assert.equal(consolidated.kind,'Expediente consolidado PDF');assert.equal(consolidated.revision,1);assert.equal(consolidated.fingerprint,app.currentFp);
 const data=await consolidated.blob.arrayBuffer();
 const task=pdfjs.getDocument({data:new Uint8Array(data.slice(0)),standardFontDataUrl:'node_modules/pdfjs-dist/standard_fonts/'});
 const pdf=await task.promise;
 const pages:string[]=[];
 for(let i=1;i<=pdf.numPages;i++){
  const page=await pdf.getPage(i);const viewport=page.getViewport({scale:1});
  assert.ok(Math.abs(viewport.width-595.28)<1&&Math.abs(viewport.height-841.89)<1);
  pages.push((await page.getTextContent()).items.map(item=>'str' in item?item.str:'').join(' '));
 }
 await task.destroy();
 assert.match(pages[0],/ÍNDICE/);
 for(const heading of ['1. Certificado de paz y salvo','2. Liquidación laboral','3. Control de vacaciones','4. Documentación de terminación','5. Evidencias del paz y salvo','6. Reporte ministerial'])assert.ok(pages[0].includes(heading),heading);
 for(const marker of ['ANEXO CARTA DE RENUNCIA FICTICIA','ANEXO ACTA DE ENTREGA FICTICIA','SIMULADOR CALCULADORA DE LIQUIDACIONES'])assert.equal(pages.filter(page=>page.includes(marker)).length,1,marker);
 assert.doesNotMatch(pages.join('\n'),/ESTE ANEXO QUEDA EXCLUIDO|ANEXO DE OTRO EXPEDIENTE|escaneado\.pdf/);
 assert.equal(pages.filter(page=>page.replace(/\s/g,'').match(/^Lookup\|LOOKUP-LIQ-\d+-\d+\|\d+\/\d+$/)).length,1,'La imagen ocupa su propia página A4');
 if(process.env.LOOKUP_RENDER_SAMPLE){await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/consolidado.pdf',new Uint8Array(data));}

 let downloadUrl='';
 const link={href:'',download:'',click(){downloadUrl=this.href;}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>link}});
 t.mock.timers.enable({apis:['setTimeout']});
 try{app.download(consolidated);assert.equal(link.download,consolidated.name);assert.deepEqual(await(await fetch(downloadUrl)).arrayBuffer(),data);}
 finally{if(downloadUrl)URL.revokeObjectURL(downloadUrl);t.mock.timers.reset();Reflect.deleteProperty(globalThis,'document');}

 await app.generate();assert.equal(app.generated.length,1,'La misma revisión no duplica el PDF');
 await app.transition('Finalizado');assert.equal(app.current!.status,'Finalizado');
 app.changeTab('Liquidación');
 app.settlementForm.controls.notes.setValue('Revisión de prueba actualizada.');
 app.settlementForm.controls.confirmed.setValue(true);await app.saveSettlement(true);
 assert.equal(app.currentConsolidated,undefined);
 await app.generate();assert.deepEqual(app.generated.map(doc=>doc.revision).sort(),[1,2]);
 await app.transition('Finalizado');assert.equal(app.current!.status,'Finalizado');
 app.db.close();
 const persisted=await app.db.open();
 assert.equal(persisted.state.cases[0].status,'Finalizado');assert.equal(persisted.docs.filter(doc=>doc.kind==='Expediente consolidado PDF').length,2);
 assert.deepEqual(new Uint8Array(await persisted.docs.find(doc=>doc.name==='repote.pdf')!.blob.arrayBuffer()),new Uint8Array(reportBytes));
 if(app.inlineURL)URL.revokeObjectURL(app.inlineURL);app.db.close();injector.destroy();
});
