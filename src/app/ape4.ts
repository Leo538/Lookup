import { jsPDF } from 'jspdf';
import { AcademicCase, APE4_CASE_CODE, APE4_CASE_ID, APE4_WORKER_ID, Case, Document, History, MUTUAL_AGREEMENT, Worker, emptySettlement, money, newChecks } from './models';

const worker:Worker={id:APE4_WORKER_ID,name:'Clarent Mora',identity:'1805876545',role:'Desarrollador de software',department:'Desarrollo de software',start:'2025-11-01',salary:52000,email:'',phone:'',active:false};
const end='2026-11-18';
const academic:AcademicCase={
 employer:{name:'LOOKUP S.A.S.',activity:'Desarrollo de software',city:'Ambato',country:'Ecuador',region:'Sierra',representative:{name:'Ariel Mateo Paredes Lozada',level:'A1',identity:'1804123451'}},
 employment:{level:'C1',contract:'Indefinido',monthlyBonuses:false,agreementDate:'2026-11-17'},
 vacation:{firstDays:15,firstStart:'2026-11-02',firstEnd:'2026-11-16',secondPending:0.71},
 reference:{concepts:{'Vacaciones':1231,'Décima tercera remuneración':50263,'Décima cuarta remuneración':14460,'Bonificación o indemnización por desahucio':13000},total:78954},
};
const displayDate=(iso:string)=>iso.split('-').reverse().join('/');
const signatureWorker='Clarent Mora | Trabajador';
const areas={supervisor:'Jefatura inmediata',technology:'Tecnología',finance:'Financiero',hr:'Talento Humano'};
const simulated=(role:string)=>`${role} (rol simulado)`;

interface Evidence {
 key:string;
 title:string;
 date:string;
 description:string;
 paragraphs:string[];
 signatures:[string,string];
 termination?:boolean;
}

const evidence:Evidence[]=[
 {key:'01-acuerdo-mutuo',title:'Acuerdo de terminación laboral por mutuo acuerdo',date:academic.employment.agreementDate,termination:true,
  description:'Acuerdo académico fechado el 17/11/2026, con terminación el 18/11/2026.',
  paragraphs:[
   'Comparecen en el caso hipotético LOOKUP S.A.S., representada por Ariel Mateo Paredes Lozada, nivel A1, cédula ficticia 1804123451, y Clarent Mora, nivel C1, cédula ficticia 1805876545.',
   'Las partes acuerdan terminar, con efecto al 18/11/2026, la relación laboral iniciada el 01/11/2025 bajo un contrato indefinido. La causal planteada es mutuo acuerdo, artículo 169 numeral 2 del Código del Trabajo.',
   'La remuneración mensual del caso es USD 520,00 y los décimos no se mensualizan. Los haberes se documentarán en la liquidación una vez revisado el reporte ministerial.',
  ],signatures:[signatureWorker,'Ariel Mateo Paredes Lozada | Representante legal']},
 {key:'02-entrega-recepcion-equipos',title:'Acta de entrega-recepción de equipos',date:end,
  description:'Respaldo simulado de la devolución de equipos al área de Tecnología.',
  paragraphs:[
   'En la fecha de salida se documenta, para el ejercicio, la devolución del equipo de trabajo, su cargador y los accesorios asociados al puesto de desarrollo.',
   'Tecnología deja constancia de la recepción académica y registra la devolución en el control simulado del expediente. Los datos de inventario se representan únicamente para demostrar el procedimiento.',
  ],signatures:[signatureWorker,simulated(areas.technology)]},
 {key:'03-entrega-repositorios-accesos',title:'Constancia de entrega de repositorios y accesos',date:end,
  description:'Entrega académica de funciones y repositorios, con cierre simulado de accesos.',
  paragraphs:[
   'Clarent Mora entrega a Jefatura inmediata el estado de las tareas, los repositorios del ejercicio y la documentación necesaria para dar continuidad al desarrollo.',
   'Tecnología registra el retiro simulado de los permisos individuales al cese. El control se limita al procedimiento académico y no incluye contraseñas, claves ni cuentas reales.',
  ],signatures:[simulated(areas.supervisor),simulated(areas.technology)]},
 {key:'04-control-vacaciones',title:'Control de vacaciones al cese',date:end,
  description:'15 días gozados del 02/11/2026 al 16/11/2026 y 0,71 días pendientes.',
  paragraphs:[
   'Primer período: 15 días gozados del 02/11/2026 al 16/11/2026.',
   'Segundo período: saldo pendiente de 0,71 días al 18/11/2026. El apartado 3 del informe académico indica USD 12,31 por vacaciones.',
   'El formulario de liquidación mostrará el valor extraído del reporte ministerial. El valor del informe queda disponible para comparar.',
  ],signatures:[signatureWorker,simulated(areas.hr)]},
 {key:'05-revision-obligaciones',title:'Constancia de revisión de obligaciones',date:end,
  description:'Respaldo académico del control financiero de obligaciones pendientes.',
  paragraphs:[
   'El área Financiera registra la revisión simulada de obligaciones pendientes de Clarent Mora para la fecha de salida.',
   'El ejercicio no incorpora deducciones adicionales. La validación de los haberes se hará con el PDF ministerial que se adjunte al expediente.',
  ],signatures:[simulated(areas.finance),signatureWorker]},
];

function makeEvidence(doc:Evidence):Document {
 const pdf=new jsPDF({format:'a4',unit:'mm'});
 pdf.setProperties({title:doc.title,author:`${academic.employer.name} | Caso hipotético académico`});
 pdf.setFillColor(16,42,67);pdf.rect(0,0,210,38,'F');
 pdf.setTextColor(255);pdf.setFontSize(22);pdf.text(academic.employer.name,17,16);
 pdf.setFontSize(10);pdf.text('CASO HIPOTÉTICO ACADÉMICO',17,27);
 pdf.setTextColor(16,42,67);pdf.setFontSize(17);pdf.setFont('helvetica','bold');
 const title=pdf.splitTextToSize(doc.title,176) as string[];
 pdf.text(title,17,53);
 const headerY=64+(title.length-1)*7;
 pdf.setFontSize(10);pdf.setFont('helvetica','normal');
 pdf.text(`Expediente ${APE4_CASE_CODE}  |  ${academic.employer.city}, ${displayDate(doc.date)}`,17,headerY);
 pdf.setFillColor(238,244,252);pdf.roundedRect(17,headerY+9,176,30,2,2,'F');
 pdf.text([`Trabajador: ${worker.name} | Cédula ficticia: ${worker.identity}`,`Cargo: ${worker.role} | Nivel: ${academic.employment.level} | Contrato: ${academic.employment.contract}`,`Ingreso: ${displayDate(worker.start)} | Salida: ${displayDate(end)} | Remuneración mensual: ${money(worker.salary)}`],22,headerY+17,{lineHeightFactor:1.65});
 let y=headerY+55;
 for(const paragraph of doc.paragraphs){
  const lines=pdf.splitTextToSize(paragraph,176) as string[];
  pdf.text(lines,17,y,{lineHeightFactor:1.55});y+=lines.length*5.6+5;
 }
 const signatureY=Math.max(215,y+12);
 for(const [i,signatory] of doc.signatures.entries()){
  const x=i===0?17:111;
  pdf.line(x,signatureY,x+82,signatureY);
  pdf.text(pdf.splitTextToSize(signatory,82),x,signatureY+6);
 }
 pdf.setDrawColor(211,223,235);pdf.line(17,271,193,271);
 pdf.setTextColor(76,94,113);pdf.setFontSize(9);
 pdf.text('Ejercicio APE 4. Constancia ficticia. Firmas en blanco.',17,278);
 const blob=pdf.output('blob');
 return {id:`${APE4_CASE_ID}-${doc.key}`,caseId:APE4_CASE_ID,name:`${doc.key}.pdf`,mime:blob.type,size:blob.size,blob,kind:doc.termination?'Respaldo de terminación':'Evidencia',description:doc.description,createdAt:`${doc.date}T17:00:00-05:00`};
}

export function createApe4Presentation(now=new Date().toISOString()) {
 const documents=evidence.map(makeEvidence);
 const [agreement,equipment,access,vacation,financial]=documents.map(doc=>doc.id);
 const checks=newChecks();
 const approve=(label:string,role:string,notes:string,evidenceId:string)=>{
  const check=checks.find(row=>row.label===label)!;
  Object.assign(check,{id:`${APE4_CASE_ID}-check-${checks.indexOf(check)+1}`,applicable:true,required:true,status:'Aprobado',reviewer:simulated(role),date:end,notes:`Aprobación académica simulada. ${notes}`,evidenceIds:[evidenceId],evidenceRequired:true});
 };
 approve('Entrega de funciones',areas.supervisor,'Entrega de funciones, repositorios y documentación del ejercicio.',access);
 approve('Devolución de equipos',areas.technology,'Devolución simulada de equipo y accesorios.',equipment);
 approve('Desactivación de accesos',areas.technology,'Entrega de accesos a custodios y retiro simulado de permisos individuales.',access);
 approve('Revisión de obligaciones pendientes',areas.finance,'Revisión simulada. El ejercicio no incorpora deducciones adicionales.',financial);
 approve('Registro de vacaciones pendientes',areas.hr,'15 días gozados en el primer período y 0,71 días pendientes en el segundo.',vacation);
 approve('Verificación de documentación laboral',areas.hr,'Acuerdo fechado el 17/11/2026 y salida el 18/11/2026.',agreement);
 const settlement={...emptySettlement(),reportId:'',vacation:{available:academic.vacation.secondPending,used:0,settled:0},vacationRecorded:true,reportNotice:'Carga el PDF del simulador para extraer los rubros y compararlos con el apartado 3 del informe APE 4.',notes:'Caso hipotético del apartado 3 del informe APE 4. Región Sierra y décimos no mensualizados.'};
 const c:Case={id:APE4_CASE_ID,code:APE4_CASE_CODE,workerId:worker.id,worker:structuredClone(worker),end,cause:MUTUAL_AGREEMENT,notes:'Caso hipotético académico del apartado 3 del informe APE 4. Firmas en blanco y aprobaciones simuladas.',status:'En revisión',demo:true,createdAt:now,updatedAt:now,checks,settlement,academic:structuredClone(academic),termination:{documentId:agreement,exception:'',reviewed:true}};
 const history:History[]=[
  {id:`${c.id}-h1`,caseId:c.id,date:now,actor:simulated(areas.hr),action:'Caso de Clarent Mora registrado con los datos del apartado 3 del informe APE 4.'},
  {id:`${c.id}-h2`,caseId:c.id,date:now,actor:simulated(areas.supervisor),action:'Registradas las aprobaciones académicas de Jefatura inmediata, Tecnología, Financiero y Talento Humano.',checks:structuredClone(checks.filter(check=>check.applicable))},
  {id:`${c.id}-h3`,caseId:c.id,date:now,actor:simulated(areas.hr),action:'Registrados 15 días gozados y 0,71 días pendientes. Cifras del informe separadas del PDF ministerial pendiente.'},
 ];
 return {worker:c.worker,case:c,documents,history,evidenceTitles:evidence.map(doc=>doc.title)};
}
