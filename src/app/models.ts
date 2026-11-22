export const CONCEPTS = [
 'Décima tercera remuneración','Décima cuarta remuneración','Vacaciones',
 'Indemnización por despido intempestivo','Bonificación o indemnización por desahucio',
 'Indemnización por embarazo','Indemnización por dirigente sindical','Indemnización por discapacidad',
 'Indemnización por enfermedad no profesional','Indemnización por terminación anticipada'
] as const;
export const CAUSES = ['Acuerdo de las partes (art. 169.2)','Conclusión de obra, período o servicio (art. 169.3)','Causas legalmente previstas en el contrato (art. 169.1)','Muerte o incapacidad del empleador / extinción de persona jurídica (art. 169.4)','Muerte o incapacidad permanente del trabajador (art. 169.5)','Caso fortuito o fuerza mayor (art. 169.6)','Voluntad del empleador, visto bueno (arts. 169.7 y 172)','Voluntad del trabajador, visto bueno (arts. 169.8 y 173)','Desahucio del trabajador (arts. 169.9 y 184)','Despido intempestivo (art. 188)'];
export const RESIGNATION = 'Renuncia voluntaria';
export const MUTUAL_AGREEMENT = 'Mutuo acuerdo (artículo 169 numeral 2)';
export const APE4_CASE_ID = 'lookup-ape4-clarent-2026';
export const APE4_WORKER_ID = 'lookup-ape4-clarent-worker-2026';
export const APE4_CASE_CODE = 'LOOKUP-APE4-2026-002';
export const PREVIOUS_APE4 = {caseId:'lookup-ape4-carlos-2026',workerId:'lookup-ape4-worker-2026',code:'LOOKUP-APE4-2026-001'} as const;
CAUSES.push(RESIGNATION,MUTUAL_AGREEMENT);
const TERMINATION_GUIDES: Record<string, string> = {
 [RESIGNATION]: 'Carta de renuncia. Documenta la comunicación de salida del trabajador.',
 [CAUSES[0]]: 'Acuerdo de terminación. Documenta las condiciones acordadas por las partes.',
 [MUTUAL_AGREEMENT]: 'Acuerdo de terminación por mutuo acuerdo de las partes.',
 [CAUSES[1]]: 'Contrato, acta de cierre u otro documento que acredite la conclusión de la obra, período o servicio.',
 [CAUSES[6]]: 'Resolución de visto bueno u otro documento que identifique la decisión y su origen.',
 [CAUSES[7]]: 'Resolución de visto bueno u otro documento que identifique la decisión y su origen.',
 [CAUSES[8]]: 'Comunicación de desahucio del trabajador y constancia de recepción, si está disponible.',
 [CAUSES[9]]: 'Comunicación de despido u otro documento pertinente que respalde la terminación.',
};
export const terminationGuide = (cause: string) => TERMINATION_GUIDES[cause] ?? 'Adjunta el documento pertinente para acreditar la causal seleccionada y describe su relación con la salida.';
export const CHECKLIST: Record<string,string[]> = {
 'Talento Humano':['Verificación de documentación laboral','Registro de vacaciones pendientes','Documentación de terminación'],
 'Tecnología':['Devolución de equipos','Entrega de accesorios','Desactivación de accesos'],
 'Financiero':['Verificación de anticipos','Revisión de obligaciones pendientes','Conciliación de valores documentados'],
 'Bodega':['Devolución de materiales','Entrega de herramientas','Verificación de inventario asignado'],
 'Jefatura inmediata':['Entrega de funciones','Entrega de documentación','Acta de entrega-recepción'],
 'Administración':['Revisión del expediente','Validación de requisitos','Aprobación administrativa final']
};
export interface Worker { id:string; name:string; identity:string; role:string; department:string; start:string; salary:number; email:string; phone:string; active:boolean }
export interface Check { id:string; department:string; label:string; required:boolean; status:'Pendiente'|'Aprobado'|'Rechazado'|'No aplica'; reviewer:string; date:string; notes:string; evidenceId:string; applicable?:boolean; evidenceIds?:string[]; evidenceRequired?:boolean; evidenceException?:string }
export interface Termination { documentId:string; relatedDocumentIds?:string[]; exception:string; reviewed:boolean }
export interface Adjustment { id:string; kind:'Deducción'|'Haber adicional'; label:string; amount:number; justification:string; evidenceId:string; reviewer:string }
export const VACATION_FIELDS = ['available','used','settled'] as const;
export interface AcademicCase {
 employer:{name:string;activity:string;city:string;country:string;region:string;representative:{name:string;level:string;identity:string}};
 employment:{level:string;contract:string;monthlyBonuses:boolean;agreementDate:string};
 vacation:{firstDays:number;firstStart:string;firstEnd:string;secondPending:number};
 reference:{concepts:Partial<Record<(typeof CONCEPTS)[number],number>>;total:number};
}
export interface Settlement { values:number[]; approximate:number; vacation:{available:number;used:number;settled:number}; adjustments:Adjustment[]; final:number|null; reviewer:string; notes:string; confirmed:boolean; validatedAt:string|null; revision:number; source:'Manual'|'Extracción PDF revisada'; discrepancyReason:string; reportId?:string; missingValues?:number[]; approximateMissing?:boolean; detectedValues?:number[]; detectedApproximate?:boolean; vacationRecorded?:boolean; missingVacation?: (typeof VACATION_FIELDS)[number][]; reportNotice?:string; reportExtraction?:{values:Record<number,number>;approximate:number|null} }
export interface Case { id:string; code:string; workerId:string; worker:Worker; end:string; cause:string; notes:string; status:string; demo:boolean; createdAt:string; updatedAt:string; checks:Check[]; settlement:Settlement; termination?:Termination; academic?:AcademicCase }
export interface Document { id:string; caseId:string; name:string; mime:string; size:number; blob:Blob; kind:'Reporte ministerial'|'Evidencia'|'Liquidación PDF'|'Paz y salvo PDF'|'Respaldo de terminación'|'Expediente consolidado PDF'; description:string; createdAt:string; revision?:number; fingerprint?:string; referenceOnly?:boolean }
export interface History { id:string; caseId:string; date:string; actor:string; action:string; checks?:Check[] }
export interface State { workers:Worker[]; cases:Case[]; history:History[]; settings:{company:string;ruc:string;address:string;representative:string} }
export function emptyState():State {return {workers:[],cases:[],history:[],settings:{company:'Lookup',ruc:'',address:'',representative:''}};}
export function emptySettlement():Settlement {return {values:CONCEPTS.map(()=>0),approximate:0,vacation:{available:0,used:0,settled:0},adjustments:[],final:null,reviewer:'',notes:'',confirmed:false,validatedAt:null,revision:1,source:'Manual',discrepancyReason:'',vacationRecorded:false,missingValues:CONCEPTS.map((_,i)=>i),approximateMissing:true};}
export function newCheck(department:string,label:string,applicable=false):Check {return {id:crypto.randomUUID(),department,label,applicable,required:false,status:'Pendiente',reviewer:'',date:'',notes:'',evidenceId:''};}
export function newChecks():Check[] { return Object.entries(CHECKLIST).flatMap(([department,labels])=>labels.map(label=>newCheck(department,label))); }
export const checkEvidence = (check:Check) => [...new Set([check.evidenceId,...(check.evidenceIds??[])].filter(Boolean))];
export const checkSelected = (check:Check) => check.applicable ?? (check.status!=='Pendiente'||!!check.reviewer||!!check.date||!!check.notes||checkEvidence(check).length>0);
export const checkApplicable = (check:Check) => checkSelected(check)&&check.status!=='No aplica';
export const caseSources = (c:Case,docs:Document[]) => docs.filter(d=>d.caseId===c.id&&!d.kind.endsWith('PDF'));
export function activeReport(c:Case,docs:Document[]) {
 const reports=docs.filter(d=>d.caseId===c.id&&d.kind==='Reporte ministerial');
 return c.settlement.reportId===undefined ? reports[0] : reports.find(d=>d.id===c.settlement.reportId);
}
export const requiresOriginalPdf=(c:Case)=>c.id===APE4_CASE_ID||c.id===PREVIOUS_APE4.caseId;
export function academicComparison(c:Case){
 const reference=c.academic?.reference;
 if(!reference)return [];
 const extraction=c.settlement.reportExtraction;
 const compare=(label:string,expected:number,extracted:number|null)=>({label,expected,extracted,difference:extracted===null?null:extracted-expected});
 return [
  ...CONCEPTS.flatMap((label,i)=>{
   const expected=reference.concepts[label];
   if(expected===undefined)return [];
   return [compare(label==='Bonificación o indemnización por desahucio'?'Bonificación por desahucio':label,expected,extraction?.values[i]??null)];
  }),
  compare('Total del informe',reference.total,extraction?.approximate??null),
 ];
}
export function money(cents:number):string {return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(cents/100);}
export function cents(value:unknown):number { const s=String(value).trim(); if(!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Ingrese un valor monetario no negativo con hasta dos decimales.'); const [a,b='']=s.split('.'); const n=Number(a)*100+Number(b.padEnd(2,'0')); if(!Number.isSafeInteger(n)||n>99999999999)throw new Error('Valor fuera del rango permitido.'); return n; }
export function totals(s:Settlement) { const earnings=s.values.reduce((a,b)=>a+b,0)+s.adjustments.filter(x=>x.kind==='Haber adicional').reduce((a,b)=>a+b.amount,0); const deductions=s.adjustments.filter(x=>x.kind==='Deducción').reduce((a,b)=>a+b.amount,0);return {earnings,deductions,net:earnings-deductions,reportedSum:s.values.reduce((a,b)=>a+b,0)}; }
export function vacationValid(v:Settlement['vacation']) {return Object.values(v).every(n=>Number.isFinite(n)&&n>=0&&n<=999999&&Math.abs(n*100-Math.round(n*100))<0.000001)&&Math.round(v.used*100)+Math.round(v.settled*100)<=Math.round(v.available*100);}
export function checkIssue(check:Check,docs?:Document[]):string|null {
 if(!checkSelected(check)||check.status==='Pendiente')return null;
 if(!check.reviewer.trim()||!check.date)return `${check.label}: registra responsable y fecha.`;
 if(['No aplica','Rechazado'].includes(check.status)&&!check.notes.trim())return `${check.label}: registra la justificación.`;
 const linked=checkEvidence(check);
 if(check.status==='Aprobado'&&check.evidenceRequired&&!check.evidenceException?.trim()&&!(docs?linked.some(id=>docs.some(d=>d.id===id)):linked.length))return `${check.label}: adjunta un respaldo o justifica su ausencia.`;
 return null;
}
export function checkReady(c:Case,docs?:Document[]):boolean {
 const applicable=c.checks.filter(checkApplicable);
 const available=docs&&caseSources(c,docs);
 return applicable.some(x=>x.status==='Aprobado'&&!checkIssue(x,available))
   && applicable.every(x=>!x.required||(x.status==='Aprobado'&&!checkIssue(x,available)))
   && c.checks.every(x=>!checkIssue(x,available));
}
export function validateSettlement(c:Case,docs:Document[]):string[] {const s=c.settlement;const errors:string[]=[];const t=totals(s);
 const report=activeReport(c,docs);
 if(report?.referenceOnly)errors.push(`${report.name} está activo como referencia. Carga otro PDF o confirma este como propio del expediente si verificaste su correspondencia.`);
 else if(requiresOriginalPdf(c)&&report?.mime!=='application/pdf')errors.push(`Adjunta el PDF original del simulador ministerial para el caso de ${c.worker.name}.`);
 else if(!report)errors.push('Adjunta o selecciona el reporte ministerial PDF o una captura.');
 if(s.missingValues?.length||s.approximateMissing)errors.push('Completa los rubros y el total aproximado que faltan. Registra cero solo si corresponde.');
 if(s.vacationRecorded===false)errors.push('Registra los días de vacaciones, incluso si el saldo es cero.');
 if(s.values.length!==CONCEPTS.length||[...s.values,s.approximate,...s.adjustments.map(x=>x.amount)].some(x=>!Number.isSafeInteger(x)||x<0))errors.push('Revise los valores monetarios.');
 const v=s.vacation;if(!vacationValid(v))errors.push('Los días utilizados y liquidados no pueden superar el saldo registrado; use como máximo dos decimales.');
 const sources=caseSources(c,docs);
 if(s.adjustments.some(x=>!x.label.trim()||!x.justification.trim()||!x.reviewer.trim()||!sources.some(d=>d.id===x.evidenceId))) errors.push('Cada ajuste o deducción requiere concepto, justificación, responsable y respaldo.');
 if(t.reportedSum!==s.approximate&&!s.discrepancyReason.trim())errors.push('Explique la diferencia entre los rubros transcritos y el total aproximado.');
 if(t.net<0)errors.push('Las deducciones superan los haberes.');
 if(s.final===null||!Number.isSafeInteger(s.final)||s.final!==t.net)errors.push('El valor final registrado debe coincidir con los haberes menos deducciones.');
 if(!s.reviewer.trim())errors.push('Indique quién revisa la liquidación.');if(!s.confirmed)errors.push('Confirme la revisión del reporte original y de los valores.');return errors;
}
export function invalidate(c:Case) {c.settlement.validatedAt=null;c.settlement.confirmed=false;c.settlement.revision++;if(['Aprobado','Finalizado','Pendiente de aprobación'].includes(c.status))c.status='En revisión';}
export function snapshot(c:Case,docs:Document[],settings:State['settings']):string {return JSON.stringify({worker:c.worker,end:c.end,cause:c.cause,notes:c.notes,termination:c.termination,academic:c.academic,checks:c.checks,settlement:c.settlement,settings,documents:caseSources(c,docs).map(d=>({id:d.id,name:d.name,size:d.size,createdAt:d.createdAt})).sort((a,b)=>a.id.localeCompare(b.id))});}

export function completionIssues(c:Case,docs:Document[]):string[] {
 const issues:string[]=[];
 const {worker,termination,settlement}=c;
 if(!worker.name.trim()||!/^\d{10}$/.test(worker.identity)||!worker.role.trim()||!worker.department.trim()||!worker.start||!Number.isSafeInteger(worker.salary)||worker.salary<0)issues.push('Completa los datos laborales y la identificación del trabajador.');
 if(!CAUSES.includes(c.cause)||!c.end||c.end<worker.start)issues.push('Revisa la causal y la fecha de salida.');
 if(!termination?.reviewed||!(termination.documentId?caseSources(c,docs).some(d=>d.id===termination.documentId):termination.exception.trim()))issues.push('Guarda y confirma la revisión del respaldo de terminación o su excepción en Información general.');
 if(!checkReady(c,docs)){
  issues.push('Aprueba al menos una verificación de paz y salvo y las que marcaste obligatorias.');
  for(const check of c.checks){const issue=checkIssue(check,caseSources(c,docs));if(issue)issues.push(issue);}
 }
 const report=activeReport(c,docs);
 if(report?.referenceOnly)issues.push('El PDF adjunto es de referencia. Falta el reporte del simulador para este expediente.');
 else if(requiresOriginalPdf(c)&&report?.mime!=='application/pdf')issues.push(`Falta el PDF original del simulador para ${c.worker.name}.`);
 else if(!report)issues.push('Adjunta o selecciona el reporte ministerial.');
 if(settlement.vacationRecorded===false||!vacationValid(settlement.vacation))issues.push('Registra y guarda el control de vacaciones.');
 if(!settlement.validatedAt)issues.push('Guarda y valida la liquidación.');
 else issues.push(...validateSettlement(c,docs));
 return [...new Set(issues)];
}
