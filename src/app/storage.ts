import { APE4_CASE_ID, PREVIOUS_APE4, Document, State, Worker, checkSelected, emptyState } from './models';
import type { createApe4Presentation } from './ape4';
const request=<T>(req:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const archiveKey='archivo-demostracion-ape4';
interface Archive { state:State; documents:Document[] }
const transactionDone=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{
 tx.oncomplete=()=>resolve();
 tx.onabort=()=>reject(tx.error??new Error('No se pudo completar el guardado.'));
});

function previousDemo(state:State,docs:Document[]):Archive {
 const legacyCode='LOOKUP-DEMO-2026-001';
 const wasDemo=(worker:State['workers'][number])=>worker.name==='Daniela Torres (ficticia)'&&worker.identity==='0000000001'&&worker.email==='daniela@example.invalid';
 const knownFile=(doc:Document)=>{
  if(doc.kind==='Reporte ministerial')return doc.name==='DEMO-respaldo-sintetico-NO-ministerial.pdf'&&doc.description==='Respaldo sintético de demostración. NO emitido por el Ministerio. No corresponde a repote.pdf.';
  return ['Liquidación PDF','Paz y salvo PDF','Expediente consolidado PDF'].includes(doc.kind)&&doc.name.startsWith(legacyCode+'-')&&/^[a-f0-9]{64}$/.test(doc.fingerprint??'');
 };
 const cases=state.cases.filter(c=>{
  if(!c.demo||c.workerId!==c.worker.id)return false;
  if(c.id===PREVIOUS_APE4.caseId&&c.code===PREVIOUS_APE4.code&&c.workerId===PREVIOUS_APE4.workerId)return true;
  return c.code===legacyCode&&wasDemo(c.worker)&&c.notes==='Demostración académica. Identidad y cifras ficticias. repote.pdf se conserva como referencia independiente y no se atribuye a esta trabajadora.'&&docs.filter(d=>d.caseId===c.id).every(knownFile);
 });
 const caseIds=new Set(cases.map(c=>c.id));
 const workers=state.workers.filter(w=>(wasDemo(w)||w.id===PREVIOUS_APE4.workerId)&&cases.some(c=>c.workerId===w.id)&&!state.cases.some(c=>c.workerId===w.id&&!caseIds.has(c.id)));
 return {state:{settings:state.settings,cases,workers,history:state.history.filter(event=>caseIds.has(event.caseId))},documents:docs.filter(d=>caseIds.has(d.caseId))};
}

export class Storage {
 private db!:IDBDatabase;
 async open(){this.db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('lookup-laboral',1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('documents',{keyPath:'id'});};r.onsuccess=()=>{this.db=r.result;this.db.onversionchange=()=>this.db.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Cierre otras pestañas de Lookup para abrir el almacenamiento.'));});return this.load();}
 async load(){
  const tx=this.db.transaction(['state','documents'],'readonly');
  const [saved,docs]=await Promise.all([request(tx.objectStore('state').get('main')),request(tx.objectStore('documents').getAll())]);
  const state=(saved as State|undefined)??emptyState();
  // Keep the same stores, document IDs and historical snapshots across upgrades.
  for(const c of state.cases){
   c.termination??={documentId:'',exception:'',reviewed:false};
   c.settlement.vacationRecorded??=!!c.settlement.validatedAt||Object.values(c.settlement.vacation).some(Boolean);
   for(const check of c.checks){
    if(check.applicable!==undefined)continue;
    check.applicable=checkSelected(check);
    check.required=false;
   }
  }
  return {state,docs:docs as Document[]};
 }
 async commit(state:State,add:Document[]=[],remove:string[]=[]){await new Promise<void>((resolve,reject)=>{const tx=this.db.transaction(['state','documents'],'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('No se pudo guardar.'));tx.objectStore('state').put(structuredClone(state),'main');for(const d of add)tx.objectStore('documents').put(d);for(const id of remove)tx.objectStore('documents').delete(id);});}
 async prepareApe4(seed:ReturnType<typeof createApe4Presentation>){
  const tx=this.db.transaction(['state','documents'],'readwrite');
  const done=transactionDone(tx);
  void done.catch(()=>{});
  const stateStore=tx.objectStore('state'),fileStore=tx.objectStore('documents');
  const [saved,docs,previousArchive]=await Promise.all([
   request(stateStore.get('main')) as Promise<State|undefined>,
   request(fileStore.getAll()) as Promise<Document[]>,
   request(stateStore.get(archiveKey)) as Promise<Archive|undefined>,
  ]);
  const state=saved??emptyState();
  if(state.cases.some(c=>c.id===APE4_CASE_ID)||previousArchive?.state.cases.some(c=>c.id===APE4_CASE_ID)){await done;return;}

  const archive=previousDemo(state,docs);
  if(archive.state.cases.length){
   // Use a separate key for recovery. The archive and active changes commit together.
   archiveActiveRecords(stateStore,fileStore,state,archive,previousArchive);
  }
  if(!state.workers.some(w=>w.id===seed.worker.id))state.workers.push(seed.worker);
  state.cases.push(seed.case);
  state.history.push(...seed.history);
  for(const doc of seed.documents)fileStore.add(doc);
  stateStore.put(state,'main');
  await done;
 }
 async archiveWorker(expected:Pick<Worker,'id'|'identity'|'name'>){
  const tx=this.db.transaction(['state','documents'],'readwrite');
  const done=transactionDone(tx);
  void done.catch(()=>{});
  const stateStore=tx.objectStore('state'),fileStore=tx.objectStore('documents');
  const [state,docs,previousArchive]=await Promise.all([
   request(stateStore.get('main')) as Promise<State|undefined>,
   request(fileStore.getAll()) as Promise<Document[]>,
   request(stateStore.get(archiveKey)) as Promise<Archive|undefined>,
  ]);
  const worker=state?.workers.find(w=>w.id===expected.id);
  if(!state||!worker||worker.identity!==expected.identity||worker.name!==expected.name){
   await done;
   throw new Error('El registro cambió. Comprueba los datos del trabajador y vuelve a intentarlo.');
  }

  const cases=state.cases.filter(c=>c.workerId===worker.id);
  const caseIds=new Set(cases.map(c=>c.id));
  const uniqueName=state.workers.filter(w=>w.name===worker.name).length===1;
  const workerEvents=[`Registro de trabajador: ${worker.name}`,`Edición de trabajador: ${worker.name}`];
  const history=state.history.filter(event=>caseIds.has(event.caseId)||(uniqueName&&!event.caseId&&workerEvents.includes(event.action)));
  const archive={state:{settings:state.settings,cases,workers:[worker],history},documents:docs.filter(doc=>caseIds.has(doc.caseId))};
  archiveActiveRecords(stateStore,fileStore,state,archive,previousArchive);
  stateStore.put(state,'main');
  await done;
  return cases.length;
 }
 async getApe4Archive():Promise<Archive|undefined>{
  return request(this.db.transaction('state').objectStore('state').get(archiveKey));
 }
 async restoreApe4Archive(){
  const tx=this.db.transaction(['state','documents'],'readwrite');
  const done=transactionDone(tx);
  void done.catch(()=>{});
  const stateStore=tx.objectStore('state'),fileStore=tx.objectStore('documents');
  const [state,documents,archive]=await Promise.all([
   request(stateStore.get('main')) as Promise<State>,
   request(fileStore.getAll()) as Promise<Document[]>,
   request(stateStore.get(archiveKey)) as Promise<Archive|undefined>,
  ]);
  if(archive){
   const collision=archive.state.workers.some(w=>state.workers.some(active=>active.id!==w.id&&active.identity===w.identity));
   if(collision){await done;throw new Error('Ya existe un trabajador activo con una cédula de la copia. Los registros archivados siguen guardados.');}
   const merged=mergeArchive({state,documents},archive);
   const existing=new Set(documents.map(d=>d.id));
   for(const doc of merged.documents)if(!existing.has(doc.id))fileStore.add(doc);
   stateStore.put(merged.state,'main');
  }
  await done;
 }
 close(){this.db.close();}
}
function archiveActiveRecords(stateStore:IDBObjectStore,fileStore:IDBObjectStore,state:State,archive:Archive,previous?:Archive){
 stateStore.put(previous?mergeArchive(archive,previous):archive,archiveKey);
 const caseIds=new Set(archive.state.cases.map(c=>c.id));
 const workerIds=new Set(archive.state.workers.map(w=>w.id));
 const historyIds=new Set(archive.state.history.map(event=>event.id));
 state.cases=state.cases.filter(c=>!caseIds.has(c.id));
 state.workers=state.workers.filter(w=>!workerIds.has(w.id));
 state.history=state.history.filter(event=>!historyIds.has(event.id));
 for(const doc of archive.documents)fileStore.delete(doc.id);
}
function mergeArchive(current:Archive,other:Archive):Archive{
 const appendMissing=<T extends {id:string}>(active:T[],archive:T[])=>{
  const existing=new Set(active.map(item=>item.id));
  return [...active,...archive.filter(item=>!existing.has(item.id))];
 };
 return {state:{settings:current.state.settings,workers:appendMissing(current.state.workers,other.state.workers),cases:appendMissing(current.state.cases,other.state.cases),history:appendMissing(current.state.history,other.state.history)},documents:appendMissing(current.documents,other.documents)};
}
export const MAX_FILE=20*1024*1024;
export async function validateFile(file:File){if(file.size===0||file.size>MAX_FILE)throw new Error('El archivo debe tener contenido y pesar como máximo 20 MB.');const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());const pdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-';const png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10';const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const ext=file.name.split('.').pop()?.toLowerCase();if(pdf&&ext==='pdf')return 'application/pdf';if(png&&ext==='png')return 'image/png';if(jpg&&['jpg','jpeg'].includes(ext??''))return 'image/jpeg';throw new Error('Solo se admiten PDF, PNG y JPG/JPEG válidos; revise el contenido y la extensión.');}
