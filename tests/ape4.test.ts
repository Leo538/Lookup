import '@angular/compiler';
import { ChangeDetectorRef,Injector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { AppComponent,PREPARE_APE4,UPDATE_APE4_PRESENTATION } from '../src/app/app.component';
import { createApe4Presentation } from '../src/app/ape4';
import { createDemo } from '../src/app/demo';
import { APE4_CASE_ID,CONCEPTS,MUTUAL_AGREEMENT,PREVIOUS_APE4,checkReady,completionIssues,emptyState } from '../src/app/models';
import { Storage } from '../src/app/storage';
import { candidates,readReportText } from '../src/app/extraction';
import { createHash } from 'node:crypto';
import { jsPDF } from 'jspdf';

test('instala un único APE 4, archiva antes de retirar y permite restaurar sin duplicar',async()=>{
 globalThis.indexedDB=new IDBFactory();
 const old=await createDemo();
 const provisionalWorker={...old.worker,id:PREVIOUS_APE4.workerId,name:'Expediente provisional',identity:'0000000000'};
 const provisional={...old.case,id:PREVIOUS_APE4.caseId,code:PREVIOUS_APE4.code,workerId:provisionalWorker.id,worker:provisionalWorker};
 const provisionalReport={...old.docs[0],id:'provisional-report',caseId:provisional.id};
 const previous={...emptyState(),workers:[old.worker,provisionalWorker],cases:[old.case,provisional],history:[{id:'demo-history',caseId:old.case.id,action:'Verificación de prueba',actor:'Demo',date:old.case.createdAt}]};
 const db=new Storage();await db.open();await db.commit(previous,[...old.docs,provisionalReport]);
 const seed=createApe4Presentation();
 await db.prepareApe4(seed);
 const archived=await db.getApe4Archive();
 assert.deepEqual(archived?.state,previous);
 assert.equal(archived?.documents.length,2);
 assert.deepEqual(await archived!.documents.find(doc=>doc.id==='provisional-report')!.blob.arrayBuffer(),await provisionalReport.blob.arrayBuffer());
 db.close();
 const reopened=new Storage();const data=await reopened.open();
 assert.equal(data.state.cases.length,1);assert.equal(data.state.workers.length,1);
 assert.equal(data.state.cases[0].id,APE4_CASE_ID);assert.equal(data.docs.length,seed.documents.length);
 assert.ok(data.state.history.every(history=>history.caseId===APE4_CASE_ID));
 await reopened.prepareApe4(createApe4Presentation());assert.equal((await reopened.load()).docs.length,seed.documents.length);
 await reopened.restoreApe4Archive();await reopened.restoreApe4Archive();await reopened.prepareApe4(seed);
 const restored=await reopened.load();
 assert.equal(restored.state.cases.length,3);assert.equal(restored.docs.length,seed.documents.length+2);
 assert.ok(restored.state.history.some(history=>history.id==='demo-history'));
 reopened.close();
});

test('conserva datos desconocidos incluso si se adjuntaron a la antigua demostración',async()=>{
 globalThis.indexedDB=new IDBFactory();
 const old=await createDemo();
 const unknown={...old.docs[0],id:'usuario-archivo',kind:'Evidencia' as const,name:'archivo-del-usuario.pdf'};
 const unrelated={...old.worker,id:'usuario-trabajador',identity:'0000000099',name:'Registro de origen desconocido'};
 const db=new Storage();await db.open();await db.commit({...emptyState(),workers:[old.worker,unrelated],cases:[old.case]},[...old.docs,unknown]);
 await db.prepareApe4(createApe4Presentation());
 const loaded=await db.load();
 assert.equal(await db.getApe4Archive(),undefined);
 assert.ok(loaded.state.cases.some(c=>c.id===old.case.id));
 assert.ok(loaded.state.workers.some(w=>w.id===unrelated.id));
 assert.ok(loaded.docs.some(doc=>doc.id===unknown.id));
 db.close();
});

test('inicia el caso exacto y deja la liquidación sin importar el PDF anterior',async()=>{
 globalThis.indexedDB=new IDBFactory();
 const old=await createDemo();
 const worker={...old.worker,name:'Registro anterior de prueba'};
 const oldCase={...old.case,worker,code:'LOOKUP-LIQ-2026-001',demo:false};
 const store=new Storage();await store.open();
 await store.commit({...emptyState(),workers:[worker],cases:[oldCase]},old.docs);store.close();
 const expected=createHash('sha256').update(`${worker.name.toLowerCase()}|${worker.identity}|${oldCase.code}`).digest('hex');
 const injector=Injector.create({providers:[FormBuilder,
  {provide:PREPARE_APE4,useValue:true},
  {provide:UPDATE_APE4_PRESENTATION,useValue:{previousCaseCode:oldCase.code,workerFingerprint:expected}},
  {provide:ChangeDetectorRef,useValue:{markForCheck(){}}},
  {provide:DomSanitizer,useValue:{bypassSecurityTrustResourceUrl:(s:string)=>s}},
  {provide:AppComponent,useFactory:()=>new AppComponent()},
 ]});
 const app=injector.get(AppComponent);await app.ngOnInit();
 assert.deepEqual(app.state.cases.map(c=>c.id),[APE4_CASE_ID]);
 assert.equal((await app.db.getApe4Archive())?.state.workers[0].id,worker.id);
 const c=app.presentationCase!;
 assert.deepEqual([c.worker.name,c.worker.identity,c.worker.role,c.worker.salary,c.worker.start,c.end,c.cause],['Clarent Mora','1805876545','Desarrollador de software',52000,'2025-11-01','2026-11-18',MUTUAL_AGREEMENT]);
 assert.deepEqual(c.academic?.employer,{name:'LOOKUP S.A.S.',activity:'Desarrollo de software',city:'Ambato',country:'Ecuador',region:'Sierra',representative:{name:'Ariel Mateo Paredes Lozada',level:'A1',identity:'1804123451'}});
 assert.deepEqual(c.academic?.employment,{level:'C1',contract:'Indefinido',monthlyBonuses:false,agreementDate:'2026-11-17'});
 assert.deepEqual(c.academic?.vacation,{firstDays:15,firstStart:'2026-11-02',firstEnd:'2026-11-16',secondPending:0.71});
 assert.deepEqual(new Set(c.checks.filter(row=>row.applicable).map(row=>row.department)),new Set(['Jefatura inmediata','Tecnología','Financiero','Talento Humano']));
 assert.ok(checkReady(c,app.docs));assert.equal(app.docs.length,5);
 assert.ok(completionIssues(c,app.docs).some(issue=>issue.includes('Falta el PDF original')&&issue.includes('Clarent Mora')));
 app.openCase(c,'Liquidación');
 assert.equal(app.vacationRemaining,0.71);assert.ok(app.values.getRawValue().every(amount=>amount===''));
 assert.equal(app.report,undefined);
 assert.deepEqual(app.academicReportComparison.map(row=>[row.expected,row.extracted]),[[50263,null],[14460,null],[1231,null],[13000,null],[78954,null]]);
 const bytes=await readFile('public/examples/repote.pdf');
 app.uploadFile=new File([bytes],'reporte-renombrado.pdf',{type:'application/pdf'});
 await app.upload();assert.match(app.toast(),/demostración anterior/);assert.equal(app.reports.length,0);
 await app.generate();assert.equal(app.generated.length,0);
 app.db.close();injector.destroy();
});

test('extrae un PDF de prueba, compara con el informe y genera el consolidado al validar',async()=>{
 globalThis.indexedDB=new IDBFactory();
 const injector=Injector.create({providers:[FormBuilder,{provide:PREPARE_APE4,useValue:true},{provide:ChangeDetectorRef,useValue:{markForCheck(){}}},{provide:DomSanitizer,useValue:{bypassSecurityTrustResourceUrl:(s:string)=>s}},{provide:AppComponent,useFactory:()=>new AppComponent()}]});
 const app=injector.get(AppComponent);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 app.reportParser.extract=async blob=>{
  const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),standardFontDataUrl:'node_modules/pdfjs-dist/standard_fonts/'});
  try{return candidates(await readReportText(await task.promise));}finally{await task.destroy();}
 };
 await app.ngOnInit();app.openCase(app.presentationCase!,'Liquidación');
 const form=app.settlementForm;
 form.patchValue({reviewer:'Talento Humano (prueba)',notes:'Revisada la diferencia de vacaciones con el informe.'});
 const fixture=new jsPDF();
 const amounts=[50263,14460,1299,0,13000,0,0,0,0,0];
 fixture.text('ARCHIVO SINTÉTICO PARA PRUEBA TÉCNICA',16,17);
 CONCEPTS.forEach((label,i)=>fixture.text(`${label}: USD ${(amounts[i]/100).toFixed(2)}`,16,25+i*8));
 fixture.text('Total aproximado: USD 790.22',16,120);
 app.uploadFile=new File([fixture.output('arraybuffer')],'reporte-qa.pdf',{type:'application/pdf'});
 await app.upload();
 assert.equal(form.controls.approximate.value,'790.22');assert.equal(form.controls.reviewer.value,'Talento Humano (prueba)');
 assert.equal(app.values.at(2).value,'12.99');
 assert.deepEqual(app.academicReportComparison.filter(row=>row.difference).map(row=>row.difference),[68,68]);
 app.values.at(2).setValue('12.31');
 assert.equal(app.academicReportComparison.find(row=>row.label==='Vacaciones')?.extracted,1299);
 app.values.at(2).setValue('12.99');
 await app.generate();assert.equal(app.generated.length,0);
 form.controls.final.setValue('790.22');form.controls.confirmed.setValue(true);
 await app.saveSettlement(true);assert.ok(app.hasValidated,app.toast());
 await app.generate();await app.generate();assert.equal(app.generated.length,1,app.toast());
 const task=pdfjs.getDocument({data:new Uint8Array(await app.generated[0].blob.arrayBuffer()),standardFontDataUrl:'node_modules/pdfjs-dist/standard_fonts/'});
 try{
  const doc=await task.promise;
  const pages=await Promise.all(Array.from({length:doc.numPages},async(_,i)=>{
   const content=await(await doc.getPage(i+1)).getTextContent();
   return content.items.map(item=>'str' in item?item.str:'').join(' ');
  }));
  const text=pages.join('\n');
  for(const term of ['Clarent Mora','LOOKUP S.A.S.','Ariel Mateo Paredes Lozada','1. Certificado de paz y salvo','2. Liquidación laboral','3. Control de vacaciones','4. Documentación de terminación','5. Evidencias del paz y salvo','6. Reporte ministerial','Acuerdo de terminación laboral por mutuo acuerdo','Constancia de entrega de repositorios y accesos','ARCHIVO SINTÉTICO PARA PRUEBA TÉCNICA'])assert.ok(text.includes(term),`Falta en el expediente: ${term}`);
  assert.match(text,/789,54/);assert.match(text,/790,22/);
 }finally{await task.destroy();}
 await app.transition('Finalizado');assert.equal(app.current?.status,'Finalizado');
 if(app.inlineURL)URL.revokeObjectURL(app.inlineURL);
 app.db.close();injector.destroy();
});

test('retira solo el trabajador elegido y permite recuperar su expediente y adjuntos',async()=>{
 globalThis.indexedDB=new IDBFactory();
 const demo=await createDemo();
 const established={...demo.case,demo:false,code:'LOOKUP-LIQ-2026-010'};
 const seed=createApe4Presentation();
 const db=new Storage();await db.open();
 const state=emptyState();
 state.cases=[established,seed.case];state.workers=[demo.worker,seed.worker];
 state.history=[...seed.history,{id:'target-event',caseId:established.id,date:established.createdAt,actor:'Pruebas',action:'Historial del expediente'}];
 await db.commit(state,[...demo.docs,...seed.documents]);
 await assert.rejects(db.archiveWorker({...demo.worker,identity:'0000000099'}),/cambió/);
 assert.equal(await db.archiveWorker(demo.worker),1);
 const active=await db.load();
 assert.deepEqual(active.state.workers,[seed.worker]);
 assert.equal(active.state.cases.length,1);assert.equal(active.state.cases[0].id,seed.case.id);
 assert.equal(active.state.history.length,seed.history.length);
 assert.equal(active.docs.length,seed.documents.length);
 const archived=await db.getApe4Archive();
 assert.equal(archived?.state.history[0].id,'target-event');
 assert.deepEqual(await archived?.documents[0].blob.arrayBuffer(),await demo.docs[0].blob.arrayBuffer());
 await db.restoreApe4Archive();
 assert.equal((await db.load()).state.cases.length,2);
 db.close();
});

