import { Component, ChangeDetectorRef, InjectionToken, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, LayoutDashboard, Users, FolderOpen, ShieldCheck, Receipt, Files, History as HistoryIcon, Settings, ArrowUpRight, Plus, Search, Download, Eye, Trash2, X, Check, FileText, ChevronRight, Upload, ArrowLeft, Save, CircleHelp } from 'lucide-angular';
import { APE4_CASE_ID, Case, Check as Verification, Worker, Document, State, CONCEPTS, CAUSES, CHECKLIST, VACATION_FIELDS, emptyState, emptySettlement, newChecks, newCheck, cents, money, totals, checkReady, checkSelected, checkApplicable, checkEvidence, checkIssue, activeReport, academicComparison, requiresOriginalPdf, caseSources, completionIssues, terminationGuide, validateSettlement, invalidate, vacationValid } from './models';
import { Storage, validateFile } from './storage';
import { MinisterialReportParserService, ReportAmounts } from './extraction';
import { fingerprint } from './pdf';

export const PREPARE_APE4 = new InjectionToken<boolean>('Preparar presentación APE 4');
export const UPDATE_APE4_PRESENTATION = new InjectionToken<{previousCaseCode:string;workerFingerprint:string}>('Archivar expediente anterior indicado');
const REFERENCE_PDF_SHA256='a78f966ae698d666a89f4a61e327c09be0ac7c0d902bb88989cd5fe7ce2fd9b4';
const REFERENCE_ACTION='Reporte de referencia incorporado a Liquidación';
const REFERENCE_DESCRIPTION='Reporte del simulador para revisar sus rubros. Pendiente de comprobar que corresponda a los datos de este expediente.';
async function sha256(data:ArrayBuffer|Uint8Array<ArrayBuffer>){
 const digest=await crypto.subtle.digest('SHA-256',data);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

@Component({selector:'lookup-app',standalone:true,imports:[CommonModule,ReactiveFormsModule,FormsModule,LucideAngularModule],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit {
 readonly icons={LayoutDashboard,Users,FolderOpen,ShieldCheck,Receipt,Files,HistoryIcon,Settings,ArrowUpRight,Plus,Search,Download,Eye,Trash2,X,Check,FileText,ChevronRight,Upload,ArrowLeft,Save,CircleHelp};
 readonly nav=[['Dashboard','LayoutDashboard'],['Trabajadores','Users'],['Expedientes laborales','FolderOpen'],['Paz y salvo','ShieldCheck'],['Liquidaciones','Receipt'],['Historial','HistoryIcon'],['Configuración de Lookup','Settings']];
 readonly concepts=CONCEPTS;readonly causes=CAUSES;readonly departments=Object.keys(CHECKLIST);readonly money=money;
 readonly fb=inject(FormBuilder);readonly cdr=inject(ChangeDetectorRef);readonly sanitizer=inject(DomSanitizer);readonly db=new Storage();
 state:State=emptyState();docs:Document[]=[];page='Dashboard';tab='Información general';search='';filter='';current:Case|null=null;currentFp='';dirty=false;
 busy=signal(false);ready=signal(false);toast=signal('');error=signal(false);modal:''|'worker'|'case'|'preview'|'confirm'='';confirmAction:(()=>Promise<void>)|null=null;confirmText='';inlineURL='';inlineSafe:SafeResourceUrl|null=null;lastFormValues='';
 editingWorker:string|null=null;previewDoc:Document|null=null;previewURL='';safePreview:SafeResourceUrl|null=null;
 readonly reportParser=new MinisterialReportParserService();
 private readonly prepareOnOpen=inject(PREPARE_APE4,{optional:true});
 private readonly presentationUpdate=inject(UPDATE_APE4_PRESENTATION,{optional:true});
 hasApe4Archive=false;
 terminationFile:File|null=null; terminationDescription='';
 pendingEvidence:Record<string,{file:File;description:string}[]>={};
 adjustmentFiles:Record<string,File>={};
 customLabels:Record<string,string>={};
 readonly terminationGuide=terminationGuide;
 readonly checkSelected=checkSelected;
 workerForm=this.fb.group({name:['',Validators.required],identity:['',[Validators.required,Validators.pattern(/^\d{10}$/)]],role:['',Validators.required],department:['',Validators.required],start:['',Validators.required],salary:['0.00',[Validators.required]],email:['',Validators.email],phone:[''],active:[true]});
 caseForm=this.fb.group({workerId:['',Validators.required],end:['',Validators.required],cause:[CAUSES[0],Validators.required],notes:[''],terminationException:['']});
 settingsForm=this.fb.group({company:[{value:'Lookup',disabled:true}],ruc:[''],address:[''],representative:['']});
 settlementForm=this.makeSettlementForm(emptySettlement());
 uploadDescription='';uploadFile:File|null=null;
 async ngOnInit(){
  await this.run(async()=>{
   await this.refreshStoredData(await this.db.open());
   this.ready.set(true);
   if(this.prepareOnOpen&&!this.presentationCase)await this.preparePresentation();
   if(this.presentationUpdate)await this.updatePresentation(this.presentationUpdate);
  });
  this.settlementForm.valueChanges.subscribe(()=>{
   this.dirty=true;
   const {confirmed,...rest}=this.settlementForm.getRawValue();
   const payload=JSON.stringify(rest);
   if(payload!==this.lastFormValues)this.settlementForm.controls.confirmed.setValue(false,{emitEvent:false});
   this.lastFormValues=payload;
  });
 }
 private async refreshStoredData(data:{state:State;docs:Document[]}){
  this.state=data.state;
  this.docs=data.docs;
  this.settingsForm.patchValue(data.state.settings);
  this.hasApe4Archive=!!await this.db.getApe4Archive();
 }
 get presentationCase(){return this.state.cases.find(c=>c.id===APE4_CASE_ID);}
 get originalPdfRequired(){return !!this.current&&requiresOriginalPdf(this.current);}
 get academicReportComparison(){return this.current?academicComparison(this.current):[];}
 private async preparePresentation(){
  const {createApe4Presentation}=await import('./ape4');
  await this.db.prepareApe4(createApe4Presentation());
  await this.refreshStoredData(await this.db.load());
 }
 private async updatePresentation(update:{previousCaseCode:string;workerFingerprint:string}){
  const previous=this.state.cases.find(c=>c.code===update.previousCaseCode);
  const worker=previous&&this.state.workers.find(w=>w.id===previous.workerId);
  if(worker){
   const name=worker.name.trim().replace(/\s+/g,' ').toLowerCase();
   const identity=new TextEncoder().encode(`${name}|${worker.identity}|${update.previousCaseCode}`);
   if(await sha256(identity)===update.workerFingerprint){
    const archived=await this.db.getApe4Archive();
    if(!archived?.state.workers.some(item=>item.id===worker.id)){
     await this.db.archiveWorker(worker);
     await this.refreshStoredData(await this.db.load());
    }
   }
  }

 }
 makeSettlementForm(s:Case['settlement']){
  const missing=s.missingVacation??(s.vacationRecorded===false?VACATION_FIELDS:[]);
  const available=missing.includes('available')?null:s.vacation.available;
  const used=missing.includes('used')?null:s.vacation.used;
  const settled=missing.includes('settled')?null:s.vacation.settled;
  return this.fb.group({values:this.fb.array(s.values.map((x,i)=>this.fb.control(s.missingValues?.includes(i)?'':(x/100).toFixed(2)))),approximate:[s.approximateMissing?'':(s.approximate/100).toFixed(2)],available:[available,Validators.required],used:[used,Validators.required],settled:[settled,Validators.required],adjustments:this.fb.array(s.adjustments.map(a=>this.fb.group({id:[a.id],kind:[a.kind],label:[a.label],amount:[(a.amount/100).toFixed(2)],justification:[a.justification],evidenceId:[a.evidenceId],reviewer:[a.reviewer]}))),final:[s.final===null?'':(s.final/100).toFixed(2)],reviewer:[s.reviewer],notes:[s.notes],confirmed:[false],discrepancyReason:[s.discrepancyReason]});
 }
 get values(){return this.settlementForm.controls.values;} get adjustments(){return this.settlementForm.controls.adjustments;}
 get caseDocs(){return this.docs.filter(d=>d.caseId===this.current?.id);}
 get sources(){return this.current?caseSources(this.current,this.docs):[];}
 get reports(){return this.caseDocs.filter(d=>d.kind==='Reporte ministerial');}
 get report(){return this.current?activeReport(this.current,this.docs):undefined;}
 get terminationDoc(){return this.sources.find(d=>d.id===this.current?.termination?.documentId);}
 get relatedTerminationDocs(){return this.sources.filter(d=>this.current?.termination?.relatedDocumentIds?.includes(d.id));}
 get generated(){return this.caseDocs.filter(d=>d.kind.endsWith('PDF')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 get currentConsolidated(){return this.generated.find(d=>d.kind==='Expediente consolidado PDF'&&d.fingerprint===this.currentFp);}
 get completionErrors(){return this.current?completionIssues(this.current,this.docs):[];}
 get termination(){return this.current?.termination;}
 get filteredCases(){return this.state.cases.filter(c=>(!this.filter||c.status===this.filter)&&`${c.code} ${c.worker.name} ${c.worker.identity}`.toLowerCase().includes(this.search.toLowerCase())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
 get filteredWorkers(){return this.state.workers.filter(w=>`${w.name} ${w.identity} ${w.role}`.toLowerCase().includes(this.search.toLowerCase()));}
 get counts(){return [this.state.cases.length,this.state.cases.filter(c=>!['Aprobado','Finalizado'].includes(c.status)).length,this.state.cases.filter(c=>!checkReady(c,this.docs)).length,this.state.cases.filter(c=>c.status==='Aprobado').length,this.state.cases.filter(c=>!!c.settlement.validatedAt).length,this.state.cases.filter(c=>c.status==='Finalizado').length];}
 get progress(){const applicable=this.current?.checks.filter(checkApplicable)??[];return applicable.length?Math.round(applicable.filter(c=>c.status==='Aprobado'&&!checkIssue(c,this.sources)).length/applicable.length*100):0;}
 get liveTotals(){try{const s=this.readSettlement();return s.missingValues?.length?null:totals(s);}catch{return null;}}
 get discrepancy(){try{const s=this.readSettlement();return !s.missingValues?.length&&!s.approximateMissing&&totals(s).reportedSum!==s.approximate;}catch{return false;}}
 get vacationAmount(){const value=this.values.at(2).value;try{return money(cents(value));}catch{return 'Pendiente de registro';}}
 get vacationRemaining(){const v=this.settlementForm.getRawValue();return Math.round((Number(v.available)-Number(v.used)-Number(v.settled))*100)/100;}
 get history(){return this.state.history.filter(h=>!this.current||h.caseId===this.current.id).slice().reverse();}
 get hasValidated(){return !!this.current?.settlement.validatedAt&&!this.dirty;}
 notify(message:string,error=false){this.error.set(error);this.toast.set(message);}
 async run(fn:()=>Promise<void>){if(this.busy())return;this.busy.set(true);try{await fn();}catch(e){const message=e instanceof Error?e.message:'No se pudo completar la operación. Revise el almacenamiento.';this.notify(e instanceof Error&&e.name==='QuotaExceededError'?'El almacenamiento local está lleno. Descargue un respaldo y libere espacio antes de volver a guardar.':message,true);}finally{this.busy.set(false);this.cdr.markForCheck();}}
 addHistory(state:State,caseId:string,action:string,actor='Administración Lookup'){state.history.push({id:crypto.randomUUID(),caseId,date:new Date().toISOString(),actor,action});}
 async persist(next:State,add:Document[]=[],remove:string[]=[]){
  await this.db.commit(next,add,remove);
  this.state=next;
  const changedIds=new Set([...remove,...add.map(doc=>doc.id)]);
  this.docs=this.docs.filter(doc=>!changedIds.has(doc.id)).concat(add);
  if(this.current){
   const saved=this.state.cases.find(c=>c.id===this.current!.id);
   this.current=saved?structuredClone(saved):null;
   await this.refreshFingerprint();
  }
 }
 async refreshFingerprint(){this.currentFp=this.current?await fingerprint(this.current,this.docs,this.state.settings):'';}
 async saveCase(c:Case,action:string,actor?:string,add:Document[]=[],remove:string[]=[]){const next=structuredClone(this.state);c.updatedAt=new Date().toISOString();const index=next.cases.findIndex(x=>x.id===c.id);if(index<0)next.cases.push(c);else next.cases[index]=c;this.addHistory(next,c.id,action,actor);if(action==='Verificaciones departamentales guardadas')next.history[next.history.length-1].checks=structuredClone(c.checks);await this.persist(next,add,remove);}
 guardLeave(action:()=>void){if(this.dirty){this.ask('Hay cambios sin guardar. ¿Desea descartarlos?',async()=>{this.dirty=false;action();});}else action();}
 navigate(page:string){this.guardLeave(()=>{this.current=null;this.page=page;this.search='';this.filter='';});}
 openCase(c:Case,tab='Información general'){this.guardLeave(()=>{this.current=structuredClone(c);this.page='Expedientes laborales';this.tab=tab;this.loadSettlement();void this.refreshFingerprint().then(()=>this.cdr.markForCheck());});}
 changeTab(tab:string){this.guardLeave(()=>{if(this.current)this.current=structuredClone(this.state.cases.find(c=>c.id===this.current!.id)!);this.tab=tab;this.loadSettlement();});}
 loadSettlement(){
  if(!this.current)return;
  this.current.termination??={documentId:'',exception:'',reviewed:false};
  const form=this.makeSettlementForm(this.current.settlement);
  this.settlementForm.setControl('values',form.controls.values,{emitEvent:false});
  this.settlementForm.setControl('adjustments',form.controls.adjustments,{emitEvent:false});
  this.settlementForm.patchValue(form.getRawValue(),{emitEvent:false});
  const {confirmed,...rest}=this.settlementForm.getRawValue();
  this.lastFormValues=JSON.stringify(rest);
  this.dirty=false;
  this.pendingEvidence={};this.adjustmentFiles={};this.customLabels={};
  this.terminationFile=null;this.terminationDescription='';
  this.uploadFile=null;this.uploadDescription='';
  if(this.inlineURL)URL.revokeObjectURL(this.inlineURL);
  this.inlineURL='';this.inlineSafe=null;
  const report=this.report;
  if(report){this.inlineURL=URL.createObjectURL(report.blob);this.inlineSafe=this.sanitizer.bypassSecurityTrustResourceUrl(this.inlineURL);}
 }
 openWorker(w?:Worker){this.editingWorker=w?.id??null;this.workerForm.reset(w?{...w,salary:(w.salary/100).toFixed(2)}:{name:'',identity:'',role:'',department:'',start:'',salary:'0.00',email:'',phone:'',active:true});this.modal='worker';}
 archiveWorker(worker:Worker){
  const linked=this.state.cases.filter(c=>c.workerId===worker.id);
  const details=linked.length?` Sus expedientes vinculados (${linked.map(c=>c.code).join(', ')}) y sus archivos también pasarán a la copia recuperable.`:'';
  this.ask(`¿Retirar de Lookup a ${worker.name}?${details}`,async()=>{
   const count=await this.db.archiveWorker(worker);
   await this.refreshStoredData(await this.db.load());
   this.notify(count?`Trabajador retirado con ${count} ${count===1?'expediente vinculado':'expedientes vinculados'}. Copia disponible en Configuración.`:'Trabajador retirado. Copia disponible en Configuración.');
  });
 }
 async saveWorker(){await this.run(async()=>{if(this.workerForm.invalid){this.workerForm.markAllAsTouched();throw new Error('Complete nombre, cédula de 10 dígitos, cargo, departamento, fecha y correo válido si corresponde.');}const v=this.workerForm.getRawValue();if(this.state.workers.some(w=>w.identity===v.identity&&w.id!==this.editingWorker))throw new Error('Ya existe un trabajador con esta cédula.');const next=structuredClone(this.state);const worker:Worker={id:this.editingWorker??crypto.randomUUID(),name:v.name!.trim(),identity:v.identity!,role:v.role!.trim(),department:v.department!.trim(),start:v.start!,salary:cents(v.salary),email:v.email??'',phone:v.phone??'',active:!!v.active};if(!worker.name||!worker.role||!worker.department)throw new Error('Los campos obligatorios no pueden estar vacíos.');const i=next.workers.findIndex(w=>w.id===worker.id);if(i<0)next.workers.push(worker);else next.workers[i]=worker;this.addHistory(next,'',`${i<0?'Registro':'Edición'} de trabajador: ${worker.name}`);await this.persist(next);this.modal='';this.notify('Trabajador guardado. Los expedientes conservan sus datos laborales originales.');});}
 newCase(){
  if(!this.state.workers.length){this.notify('Registre primero un trabajador.');this.openWorker();return;}
  this.terminationFile=null;
  this.terminationDescription='';
  this.caseForm.reset({workerId:this.state.workers[0].id,end:'',cause:CAUSES[0],notes:'',terminationException:''});
  this.modal='case';
 }
 async createCase(){
  await this.run(async()=>{
   const value=this.caseForm.getRawValue();
   if(this.caseForm.invalid||!value.end||!value.cause||!CAUSES.includes(value.cause))throw new Error('Completa trabajador, fecha de salida y causal.');
   const worker=this.state.workers.find(w=>w.id===value.workerId);
   if(!worker)throw new Error('Selecciona un trabajador.');
   if(value.end<worker.start)throw new Error('La fecha de salida no puede ser anterior al ingreso.');
   if(this.state.cases.some(c=>c.workerId===worker.id&&c.end===value.end))throw new Error('Ya existe un expediente de este trabajador con esa fecha de salida.');
   const now=new Date().toISOString();
   const codes=this.state.cases.map(c=>Number(c.code.split('-').at(-1)));
   const code='LOOKUP-LIQ-'+new Date().getFullYear()+'-'+String(Math.max(0,...codes)+1).padStart(3,'0');
   const c:Case={id:crypto.randomUUID(),code,workerId:worker.id,worker:structuredClone(worker),end:value.end,cause:value.cause,notes:value.notes??'',status:'Borrador',demo:false,createdAt:now,updatedAt:now,checks:newChecks(),settlement:emptySettlement()};
   const file=this.terminationFile&&await this.makeDocument(c,this.terminationFile,'Respaldo de terminación',this.terminationDescription||terminationGuide(c.cause));
   c.termination={documentId:file?.id??'',exception:file?'':value.terminationException?.trim()??'',reviewed:false};
   await this.saveCase(c,'Expediente creado',undefined,file?[file]:[]);
   this.modal='';
   this.openCase(c);
   this.notify('Expediente creado. Revisa el respaldo o su excepción en Información general.');
  });
 }
 async saveGeneral(){
  await this.run(async()=>{
   if(!this.current)return;
   const c=structuredClone(this.current);
   if(!c.end||c.end<c.worker.start||!CAUSES.includes(c.cause))throw new Error('Revisa la fecha de salida y la causal.');
   if(this.state.cases.some(x=>x.id!==c.id&&x.workerId===c.workerId&&x.end===c.end))throw new Error('Ya existe otro expediente con esa fecha de salida.');
   const file=this.terminationFile&&await this.makeDocument(c,this.terminationFile,'Respaldo de terminación',this.terminationDescription||terminationGuide(c.cause));
   if(file){c.termination!.documentId=file.id;c.termination!.exception='';}
   if(c.termination?.reviewed&&!c.termination.documentId&&!c.termination.exception.trim())throw new Error('Adjunta el respaldo de terminación o justifica su ausencia antes de confirmar la revisión.');
   if(c.termination?.documentId&&!file&&!this.sources.some(d=>d.id===c.termination?.documentId&&d.kind!=='Reporte ministerial'))throw new Error('Selecciona un respaldo de terminación de este expediente.');
   invalidate(c);
   await this.saveCase(c,'Datos y respaldo de terminación guardados',undefined,file?[file]:[]);
   this.loadSettlement();
   this.notify('Expediente guardado.');
  });
 }
 changeCause(cause:string){
  if(!this.current)return;
  this.current.cause=cause;
  this.current.termination={documentId:'',exception:'',reviewed:false};
  this.terminationFile=null;
  this.terminationDescription='';
  this.dirty=true;
 }
 selectTermination(event:Event,creating=false){
  this.terminationFile=this.selectedFiles(event)[0]??null;
  if(!creating&&this.current?.termination){this.current.termination.reviewed=false;this.dirty=true;}
 }
 get terminationCandidates(){return this.sources.filter(d=>d.kind!=='Reporte ministerial');}
 async syncWorker(){await this.run(async()=>{if(!this.current||this.dirty)throw new Error('Guarde primero los cambios del expediente.');const w=this.state.workers.find(w=>w.id===this.current!.workerId);if(!w)throw new Error('No se encontró el registro del trabajador.');if(w.start>this.current.end)throw new Error('El ingreso actualizado es posterior a la salida. Corrija las fechas.');const c=structuredClone(this.current);c.worker=structuredClone(w);invalidate(c);await this.saveCase(c,'Datos del trabajador actualizados desde el registro; revisión invalidada');this.loadSettlement();this.notify('Datos laborales actualizados. Los PDFs previos se conservan como versiones anteriores.');});}
 departmentChecks(department:string){return this.current?.checks.filter(x=>x.department===department)??[];}
 departmentSummary(department:string){
  const checks=this.departmentChecks(department).filter(checkApplicable);
  return checks.filter(x=>x.status==='Aprobado'&&!checkIssue(x,this.sources)).length+' de '+checks.length+' aprobados';
 }
 checkDocs(check:Verification){return this.sources.filter(d=>checkEvidence(check).includes(d.id));}
 recommendation(check:Verification){
  const label=check.label.toLowerCase();
  if(label.includes('vacaciones'))return 'Registro o reporte de vacaciones.';
  if(label.includes('terminación'))return terminationGuide(this.current?.cause??'');
  if(label.includes('equipos')||label.includes('accesorios')||label.includes('computadora'))return 'Acta de entrega-recepción o comprobante de devolución.';
  if(label.includes('materiales')||label.includes('herramientas')||label.includes('inventario'))return 'Comprobante, inventario firmado o acta de devolución.';
  if(label.includes('funciones'))return 'Acta de entrega de funciones.';
  if(check.department==='Financiero')return 'Constancia de revisión, comprobante o conciliación.';
  return 'Adjunta un acta, registro o documento relacionado con esta verificación.';
 }
 addCheck(department:string){
  const label=this.customLabels[department]?.trim();
  if(!this.current||!label)return;
  if(this.departmentChecks(department).some(x=>x.label.toLowerCase()===label.toLowerCase())){
   this.notify('Ya existe un requisito con ese nombre en el departamento.',true);return;
  }
  this.current.checks.push(newCheck(department,label,true));
  this.customLabels[department]='';
  this.dirty=true;
 }
 toggleCheck(check:Verification,selected:boolean){check.applicable=selected;this.dirty=true;}
 addEvidence(check:Verification,event:Event){
  const files=this.selectedFiles(event);
  if(!files.length)return;
  this.pendingEvidence[check.id]??=[];
  this.pendingEvidence[check.id].push(...files.map(file=>({file,description:''})));
  this.dirty=true;
 }
 linkEvidence(check:Verification,id:string){
  if(!id||!this.sources.some(d=>d.id===id))return;
  check.evidenceIds=[...new Set([...checkEvidence(check),id])];
  check.evidenceId='';
  this.dirty=true;
 }
 discardPendingEvidence(check:Verification,index:number){this.pendingEvidence[check.id]?.splice(index,1);this.dirty=true;}
 async saveChecks(){
  await this.run(async()=>{
   if(!this.current)return;
   const c=structuredClone(this.current);
   const attached:Document[]=[];
   for(const check of c.checks){
    if(!checkSelected(check))continue;
    if(check.status!=='No aplica'){
     for(const item of this.pendingEvidence[check.id]??[]){
      const doc=await this.makeDocument(c,item.file,'Evidencia',item.description||'Respaldo de '+check.label);
      attached.push(doc);
      check.evidenceIds=[...checkEvidence(check),doc.id];
      check.evidenceId='';
     }
    }
    const available=[...this.sources,...attached];
    const issue=checkIssue(check,available);
    if(issue)throw new Error(issue);
    if(checkEvidence(check).some(id=>!available.some(d=>d.id===id)))throw new Error(check.label+': hay un respaldo que ya no está disponible.');
   }
   invalidate(c);
   await this.saveCase(c,'Verificaciones departamentales guardadas',undefined,attached);
   this.loadSettlement();
   this.notify('Verificaciones y respaldos guardados.');
  });
 }
 readSettlement():Case['settlement'] {
  const value=this.settlementForm.getRawValue();
  const blank=(x:unknown)=>x===null||x===undefined||x==='';
  const missingVacation=VACATION_FIELDS.filter(key=>blank(value[key]));
  return {
   ...(this.current?.settlement??emptySettlement()),
   values:value.values.map(x=>blank(x)?0:cents(x)),
   missingValues:value.values.flatMap((x,i)=>blank(x)?[i]:[]),
   approximate:blank(value.approximate)?0:cents(value.approximate),
   approximateMissing:blank(value.approximate),
   vacation:{available:Number(value.available),used:Number(value.used),settled:Number(value.settled)},
   vacationRecorded:missingVacation.length===0,missingVacation,
   adjustments:value.adjustments.map(a=>({id:a.id!,kind:a.kind as 'Deducción'|'Haber adicional',label:a.label??'',amount:cents(a.amount),justification:a.justification??'',evidenceId:a.evidenceId??'',reviewer:a.reviewer??''})),
   final:blank(value.final)?null:cents(value.final),
   reviewer:value.reviewer??'',notes:value.notes??'',confirmed:!!value.confirmed,discrepancyReason:value.discrepancyReason??''
  };
 }
 addAdjustment(){this.adjustments.push(this.fb.group({id:[crypto.randomUUID() as string],kind:['Deducción' as 'Deducción'|'Haber adicional'],label:[''],amount:['0.00'],justification:[''],evidenceId:[''],reviewer:['']}));}
 stageAdjustment(id:string,event:Event){const [file]=this.selectedFiles(event);if(file){this.adjustmentFiles[id]=file;this.settlementForm.controls.confirmed.setValue(false);}}
 async saveSettlement(validate:boolean){
  await this.run(async()=>{
   if(!this.current)return;
   if(validate&&this.uploadFile)throw new Error('Carga el archivo seleccionado o quítalo de la selección antes de validar.');
   if(!this.dirty&&this.hasValidated){this.notify('La revisión actual ya está guardada.');return;}
   const c=structuredClone(this.current);
   c.settlement=this.readSettlement();
   const attached:Document[]=[];
   for(const adjustment of c.settlement.adjustments){
    const file=this.adjustmentFiles[adjustment.id];
    if(!file)continue;
    const doc=await this.makeDocument(c,file,'Evidencia','Respaldo de ajuste: '+adjustment.label);
    adjustment.evidenceId=doc.id;
    attached.push(doc);
   }
   invalidate(c);
   c.settlement.confirmed=validate&&!!this.settlementForm.controls.confirmed.value;
   if(c.settlement.vacationRecorded&&!vacationValid(c.settlement.vacation))throw new Error('Revisa los días de vacaciones. Los utilizados y liquidados no pueden superar el saldo disponible.');
   if(validate){
    const errors=validateSettlement(c,[...this.docs,...attached]);
    if(errors.length)throw new Error(errors.join('\n'));
    c.settlement.validatedAt=new Date().toISOString();
    c.status='Pendiente de aprobación';
   }else c.status='En revisión';
   await this.saveCase(c,validate?'Liquidación revisada y validada':'Borrador de liquidación guardado',c.settlement.reviewer||undefined,attached);
   this.loadSettlement();
   this.notify(validate?'Liquidación validada.':'Borrador guardado.');
  });
 }
 selectedFiles(event:Event){
  const input=event.target as HTMLInputElement;
  const files=Array.from(input.files??[]);
  input.value='';
  return files;
 }
 fileSelected(event:Event){this.uploadFile=this.selectedFiles(event)[0]??null;}
 async makeDocument(c:Case,file:File,kind:Document['kind'],description:string):Promise<Document>{
  const mime=await validateFile(file);
  return {id:crypto.randomUUID(),caseId:c.id,name:file.name,mime,size:file.size,blob:file.slice(0,file.size,mime),kind,description:description.trim(),createdAt:new Date().toISOString()};
 }
 async upload(){
  await this.run(async()=>{
   if(!this.current||!this.uploadFile)throw new Error('Selecciona un archivo.');
   const c=structuredClone(this.current);
   const doc=await this.makeDocument(c,this.uploadFile,'Reporte ministerial',this.uploadDescription);
   await this.saveReport(c,doc,[doc]);
  });
 }
 async selectReport(doc:Document){
  await this.run(async()=>{
   if(!this.current||doc.caseId!==this.current.id||doc.kind!=='Reporte ministerial')return;
   await this.saveReport(structuredClone(this.current),doc);
  });
 }
 confirmReferenceReport(){
  const report=this.report;
  if(this.current?.academic||!report?.referenceOnly)return;
  this.ask(`¿Usar «${report.name}» como reporte de este expediente? Confirma que lo generaste en el simulador para este trabajador y que verificaste las fechas, la causal, la remuneración y las vacaciones.`,async()=>{
   if(!this.current||this.report?.id!==report.id||!this.report.referenceOnly)return;
   const c=structuredClone(this.current);
   invalidate(c);
   c.settlement.reportNotice='Reporte activo confirmado para este expediente. Revisa los importes y completa la validación.';
   const verified={...report,referenceOnly:false,description:'Correspondencia con el expediente confirmada por el usuario.'};
   await this.saveCase(c,'Correspondencia del reporte confirmada por el usuario',undefined,[verified]);
   this.settlementForm.controls.confirmed.setValue(false,{emitEvent:false});
   this.notify('PDF confirmado como reporte activo. Revisa los importes y guarda la validación.');
  });
 }
 async saveReport(c:Case,doc:Document,add:Document[]=[]){
  if(requiresOriginalPdf(c)){
   if(doc.mime!=='application/pdf')throw new Error('Para el caso APE 4, adjunta el PDF original que descarga el simulador.');
   const reference=await sha256(await doc.blob.arrayBuffer())===REFERENCE_PDF_SHA256;
   if(reference&&c.academic)throw new Error(`Este PDF pertenece a la demostración anterior. Carga el reporte del simulador para ${c.worker.name}.`);
   if(doc.referenceOnly&&!reference)throw new Error('La copia disponible de repote.pdf no coincide con el archivo indicado.');
   if(reference&&doc.referenceOnly===undefined){doc.referenceOnly=true;doc.description=REFERENCE_DESCRIPTION;}
  }
  const keepDraft=this.current?.id===c.id&&this.dirty&&this.tab==='Liquidación';
  const {available,used,settled,reviewer,notes}=this.settlementForm.getRawValue();
  const draftAdjustments=this.adjustments;
  const draftFiles=this.adjustmentFiles;
  let amounts:ReportAmounts={values:{},approximate:null};
  let notice='Captura guardada. Transcribe manualmente los importes.';
  if(doc.mime==='application/pdf'){
   try{
    amounts=await this.reportParser.extract(doc.blob);
    const count=Object.keys(amounts.values).length;
    notice=count||amounts.approximate!==null
      ? 'Se detectaron '+count+' de '+CONCEPTS.length+' rubros. Compáralos con el original y completa los campos pendientes.'
      : 'No se detectaron importes. Si el PDF está escaneado, completa los campos manualmente.';
   }catch{
    notice='El archivo se conservó. No se pudo leer el texto del PDF. Registra los importes manualmente.';
   }
  }
  const s=c.settlement;
  invalidate(c);
  s.reportId=doc.id;
  s.values=CONCEPTS.map((_,i)=>amounts.values[i]??0);
  s.missingValues=CONCEPTS.flatMap((_,i)=>amounts.values[i]===undefined?[i]:[]);
  s.detectedValues=Object.keys(amounts.values).map(Number);
  s.approximate=amounts.approximate??0;
  s.approximateMissing=amounts.approximate===null;
  s.reportExtraction=amounts;
  s.detectedApproximate=amounts.approximate!==null;
  s.source=s.detectedValues.length||s.detectedApproximate?'Extracción PDF revisada':'Manual';
  s.final=null;
  s.discrepancyReason='';
  notice=doc.referenceOnly?'PDF de referencia adjunto. '+notice+' Carga un reporte nuevo o confirma este PDF si verificaste que corresponde al expediente.':`Reporte activo: ${doc.name}. ${notice}`;
  s.reportNotice=notice;
  const action=doc.referenceOnly?REFERENCE_ACTION:add.length?'Reporte ministerial cargado':'Reporte ministerial seleccionado y leído';
  await this.saveCase(c,action,undefined,add);
  this.loadSettlement();
  if(keepDraft){
   this.settlementForm.setControl('adjustments',draftAdjustments,{emitEvent:false});
   this.settlementForm.patchValue({available,used,settled,reviewer,notes},{emitEvent:false});
   this.adjustmentFiles=draftFiles;
   const {confirmed,...rest}=this.settlementForm.getRawValue();
   const draft=JSON.stringify(rest);
   this.dirty=draft!==this.lastFormValues||Object.keys(draftFiles).length>0;
   this.lastFormValues=draft;
  }
  this.notify(notice);
 }
 ask(text:string,fn:()=>Promise<void>){this.confirmText=text;this.confirmAction=fn;this.modal='confirm';}
 async confirm(){const action=this.confirmAction;this.modal='';this.confirmAction=null;if(action)await this.run(action);}
 removeDocument(d:Document,check?:Verification){
  this.ask(`¿${check?'Quitar el respaldo':'Retirar'} «${d.name}»?`,async()=>{
   if(this.dirty)throw new Error('Guarda primero los cambios del expediente.');
   const c=structuredClone(this.state.cases.find(c=>c.id===d.caseId)!);
   if(check){
    const row=c.checks.find(x=>x.id===check.id)!;
    row.evidenceIds=checkEvidence(row).filter(id=>id!==d.id);
    row.evidenceId='';
   }else if(c.termination?.documentId===d.id){
    c.termination={documentId:'',exception:'',reviewed:false};
   }else if(c.settlement.adjustments.some(a=>a.evidenceId===d.id)||c.checks.some(x=>checkEvidence(x).includes(d.id))){
    throw new Error('El archivo respalda un ajuste o una verificación. Retira primero ese vínculo.');
   }
   if(!check&&(c.settlement.reportId===d.id||activeReport(c,this.docs)?.id===d.id)){
    c.settlement.reportId='';
    c.settlement.reportExtraction=undefined;
   }
   const linked=c.termination?.documentId===d.id||c.termination?.relatedDocumentIds?.includes(d.id)||c.settlement.adjustments.some(a=>a.evidenceId===d.id)||c.checks.some(x=>checkEvidence(x).includes(d.id));
   const originalReport=check&&d.kind==='Reporte ministerial';
   if(originalReport)c.settlement.reportId=this.report?.id??c.settlement.reportId;
   invalidate(c);
   await this.saveCase(c,`Respaldo retirado: ${d.name}`,undefined,[],linked||originalReport?[]:[d.id]);
   this.loadSettlement();
   this.notify(linked||originalReport?'Vínculo retirado. El archivo permanece en sus otras secciones.':'Archivo eliminado.');
  });
 }
 preview(d:Document){this.releasePreview();this.previewDoc=d;this.previewURL=URL.createObjectURL(d.blob);this.safePreview=this.sanitizer.bypassSecurityTrustResourceUrl(this.previewURL);this.modal='preview';}
 releasePreview(){if(this.previewURL)URL.revokeObjectURL(this.previewURL);this.previewURL='';this.safePreview=null;this.previewDoc=null;}
 closeModal(){if(this.modal==='preview')this.releasePreview();this.modal='';}
 download(d:Document){this.downloadBlob(d.blob,d.name);}
 downloadBlob(blob:Blob,name:string){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
 async generate(){
  await this.run(async()=>{
   if(!this.current)return;
   if(this.dirty)throw new Error('Guarda los cambios antes de generar el expediente PDF.');
   const c=structuredClone(this.current);
   const fp=await fingerprint(c,this.docs,this.state.settings);
   const existing=this.generated.find(d=>d.kind==='Expediente consolidado PDF'&&d.fingerprint===fp);
   if(existing){this.tab='Documentos generados';this.notify('El expediente PDF vigente ya está disponible.');return;}
   const {createConsolidated}=await import('./consolidated-pdf');
   const doc=await createConsolidated(c,this.docs,this.state.settings,fp);
   await this.saveCase(c,'Expediente PDF consolidado generado y archivado',c.settlement.reviewer,[doc]);
   this.tab='Documentos generados';
   this.notify('Expediente PDF consolidado generado.');
  });
 }
 async transition(status:string){
  await this.run(async()=>{
   if(!this.current||this.dirty)throw new Error('Guarda los cambios antes de actualizar el estado.');
   const c=structuredClone(this.current);
   if(['Aprobado','Finalizado'].includes(status)){
    const issues=completionIssues(c,this.docs);
    if(status==='Finalizado'){
     const fp=await fingerprint(c,this.docs,this.state.settings);
     if(issues.length||!this.generated.some(d=>d.kind==='Expediente consolidado PDF'&&d.fingerprint===fp)){
      throw new Error(['Complete las verificaciones pendientes y genere el expediente PDF consolidado antes de finalizar',...issues].join('\n'));
     }
    }else if(issues.length)throw new Error(issues.join('\n'));
   }
   c.status=status;
   await this.saveCase(c,`Estado actualizado: ${status}`);
   this.notify(`Expediente ${status.toLowerCase()}.`);
  });
 }
 async saveSettings(){await this.run(async()=>{const v=this.settingsForm.getRawValue();if(v.ruc&&!/^\d{13}$/.test(v.ruc))throw new Error('El RUC debe contener 13 dígitos o dejarse vacío.');const next=structuredClone(this.state);next.settings={company:'Lookup',ruc:v.ruc??'',address:v.address??'',representative:v.representative??''};for(const c of next.cases){invalidate(c);}this.addHistory(next,'','Configuración de Lookup actualizada; documentos previos conservados, revisión requerida');await this.persist(next);this.notify('Configuración guardada. Revise los documentos si cambió la identificación de la empresa.');});}
 private async downloadBackup(state:State,docs:Document[],name:string){
  const files=[];
  for(const {blob,...meta} of docs){
   const bytes=new Uint8Array(await blob.arrayBuffer());
   let binary='';
   for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   files.push({...meta,base64:btoa(binary)});
  }
  this.downloadBlob(new Blob([JSON.stringify({format:'lookup-backup-v1',state,documents:files})],{type:'application/json'}),name);
 }
 async backup(){await this.run(async()=>{
  await this.downloadBackup(this.state,this.docs,`lookup-respaldo-${new Date().toISOString().slice(0,10)}.json`);
  this.notify('Respaldo completo descargado con los archivos originales.');
 });}
 async backupApe4Archive(){await this.run(async()=>{
  const archive=await this.db.getApe4Archive();
  if(!archive)return;
  await this.downloadBackup(archive.state,archive.documents,'lookup-respaldo-registros-archivados.json');
  this.notify('Copia de los registros archivados descargada.');
 });}
 async restoreApe4Archive(){await this.run(async()=>{
  await this.db.restoreApe4Archive();
  await this.refreshStoredData(await this.db.load());
  this.notify('Copia restaurada junto a los registros actuales.');
 });}
 async seedDemo(){await this.run(async()=>{
  if(!this.presentationCase)await this.preparePresentation();
  const c=this.presentationCase;
  if(c)this.openCase(c);
 });}
 caseCode(id:string){return this.state.cases.find(c=>c.id===id)?.code??'General';}
 icon(name:string){return this.icons[name as keyof typeof this.icons];}
 size(n:number){return n<1048576?`${Math.ceil(n/1024)} KB`:`${(n/1048576).toFixed(1)} MB`;}
 statusClass(status:string){return ['Aprobado','Finalizado'].includes(status)?'success':status==='Con observaciones'?'danger':'pending';}
 checkReady=(c:Case)=>checkReady(c,this.docs);
}
