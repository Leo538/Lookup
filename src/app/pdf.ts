import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Case, CONCEPTS, Document, State, academicComparison, activeReport, checkApplicable, checkEvidence, checkReady, checkSelected, money, snapshot, totals, validateSettlement } from './models';
export async function fingerprint(c:Case,docs:Document[],settings:State['settings']) {const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(snapshot(c,docs,settings)));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export async function generatePDF(c:Case,docs:Document[],settings:State['settings'],kind:'Liquidación PDF'|'Paz y salvo PDF',consolidated=false):Promise<Document>{
 if(kind==='Liquidación PDF'&&(!c.settlement.validatedAt||validateSettlement(c,docs).length))throw new Error('Guarde y valide la liquidación antes de generar el documento.');
 if(kind==='Paz y salvo PDF'&&!checkReady(c,docs))throw new Error('Guarda las verificaciones obligatorias aprobadas y al menos una aprobación con responsable y fecha.');
 const pdf=new jsPDF({unit:'mm',format:'a4'});let y=46;
 const academic=c.academic;
 const employer=academic?.employer;
 const company=employer?.name??settings.company;
 const representative=employer?.representative.name??settings.representative;
 pdf.setFillColor(16,42,67);pdf.rect(0,0,210,34,'F');pdf.setTextColor(255);pdf.setFontSize(23);pdf.text(employer?.name??'LOOKUP',16,16);pdf.setFontSize(10);pdf.text(kind==='Liquidación PDF'?'DOCUMENTO INTERNO DE LIQUIDACIÓN LABORAL':'CERTIFICADO INTERNO DE PAZ Y SALVO',16,25);pdf.setTextColor(30,45,60);
 const paragraph=(text:string)=>{const lines=pdf.splitTextToSize(text,178) as string[];for(const line of lines){if(y>271){pdf.addPage();y=20;}pdf.setFontSize(9);pdf.text(line,16,y);y+=5;}y+=3;};
 const cellPadding=academic&&kind==='Paz y salvo PDF'?2.2:2.8;
 const table=(head:string[],body:string[][])=>{autoTable(pdf,{startY:y,head:[head],body,margin:{left:16,right:16,top:18,bottom:20},styles:{fontSize:8.5,cellPadding,overflow:'linebreak'},headStyles:{fillColor:[16,42,67]},columnStyles:head.length===2?{1:{halign:'right',cellWidth:40}}:{},theme:'striped'});y=(pdf as jsPDF&{lastAutoTable:{finalY:number}}).lastAutoTable.finalY+8;};
 paragraph(`Expediente: ${c.code}${c.demo?' | CASO FICTICIO ACADÉMICO':''}`);
 if(employer)paragraph(`Empresa: ${company} | Actividad: ${employer.activity}\nUbicación: ${employer.city}, ${employer.country} | Región: ${employer.region}\nRepresentante legal: ${representative} | Nivel ${employer.representative.level} | Cédula ficticia ${employer.representative.identity}`);
 else paragraph(`Empresa: ${company} | RUC: ${settings.ruc||'No registrado'}\nDirección: ${settings.address||'No registrada'}`);
 paragraph(`Trabajador: ${c.worker.name} | Cédula${academic?' ficticia':''}: ${c.worker.identity}\nCargo: ${c.worker.role} | Departamento: ${c.worker.department}\nIngreso: ${c.worker.start} | Salida: ${c.end} | Remuneración mensual registrada: ${money(c.worker.salary)}\nCausal: ${c.cause}${academic?`\nNivel: ${academic.employment.level} | Contrato: ${academic.employment.contract} | Décimos: ${academic.employment.monthlyBonuses?'Mensualizados':'No mensualizados'}\nFecha de firma prevista en el informe: ${academic.employment.agreementDate}`:''}`);
 if(kind==='Liquidación PDF'){
 const s=c.settlement,t=totals(s);const reports=[activeReport(c,docs)].filter(d=>d!==undefined);
 paragraph('Respaldo del simulador del Ministerio del Trabajo de Ecuador:');
 for(const d of reports)paragraph(`${d.name} | ID: ${d.id} | Registro: ${d.createdAt}`);
 table(['HABERES TRANSCRITOS DEL REPORTE','USD'],CONCEPTS.map((label,i)=>[label,money(s.values[i])]));
 paragraph(`Total aproximado reportado por el simulador: ${money(s.approximate)}\nSuma de rubros transcritos: ${money(t.reportedSum)}${s.discrepancyReason?'\nExplicación de diferencia: '+s.discrepancyReason:''}`);
 if(academic)table(['INFORME APE 4 / RUBRO','INFORME','PDF EXTRAÍDO','DIFERENCIA'],academicComparison(c).map(row=>[row.label,money(row.expected),row.extracted===null?'Sin dato':money(row.extracted),row.difference===null?'Sin dato':money(row.difference)]));
 if(!consolidated)table(['CONTROL MANUAL DE VACACIONES','DÍAS'],[['Saldo disponible registrado',String(s.vacation.available)],['Días utilizados',String(s.vacation.used)],['Días liquidados',String(s.vacation.settled)],['Saldo pendiente',String(Math.round((s.vacation.available-s.vacation.used-s.vacation.settled)*100)/100)]]);
 if(s.adjustments.length){table(['TIPO / CONCEPTO','VALOR USD'],s.adjustments.map(a=>[`${a.kind}: ${a.label}`,money(a.amount)]));for(const a of s.adjustments){const doc=docs.find(d=>d.id===a.evidenceId);paragraph(`${a.label}: ${a.justification}\nRevisado por: ${a.reviewer} | Evidencia: ${doc?.name} (${a.evidenceId})`);}}
 table(['CONSOLIDACIÓN VALIDADA','USD'],[['Total haberes',money(t.earnings)],['Deducciones justificadas',money(t.deductions)],['VALOR NETO FINAL VALIDADO',money(s.final!)]]);
 paragraph(`Responsable de revisión: ${s.reviewer}\nValidación: ${s.validatedAt}\nOrigen del registro: ${s.source} | Revisión: ${s.revision}\nObservaciones: ${s.notes||'Sin observaciones.'}`);
 paragraph('El valor del simulador es aproximado y orientativo. La revisión y validación del documento final corresponde a los responsables de Lookup. Este documento interno no sustituye el acta ni el registro en la plataforma del Ministerio. No se aplican fórmulas laborales en esta herramienta.');
 }else{
 const selected=c.checks.filter(checkSelected);
 table(['DEPARTAMENTO / VERIFICACIÓN','ESTADO','RESPONSABLE / FECHA'],selected.map(x=>[`${x.department}: ${x.label}${x.required&&checkApplicable(x)?' (obligatorio)':''}\n${x.notes}${x.evidenceException?'\nExcepción documental: '+x.evidenceException:''}${checkApplicable(x)?checkEvidence(x).map(id=>'\nRespaldo: '+(docs.find(d=>d.id===id)?.name??id)).join(''):''}`,x.status,`${x.reviewer}\n${x.date}`]));
 paragraph(`Se emite este certificado interno con ${selected.filter(x=>x.status==='Aprobado').length} verificaciones aprobadas de ${selected.filter(checkApplicable).length} aplicables. ${academic?'Las aprobaciones y las constancias forman parte de la simulación académica.':'Los demás estados se detallan en la tabla.'} Este certificado interno no implica renuncia de derechos laborales.`);
 }
 paragraph(`Observaciones del expediente: ${c.notes||'Sin observaciones.'}\nEmisión: ${new Date().toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}`);
 const compactCertificate=academic&&kind==='Paz y salvo PDF';
 if(y>(compactCertificate?259:252)){pdf.addPage();y=24;}
 y+=compactCertificate?10:18;
 pdf.line(16,y,91,y);pdf.line(119,y,194,y);
 y+=6;pdf.setFontSize(9);
 pdf.text('Firma del trabajador',16,y);pdf.text('Firma del representante legal',119,y);
 y+=6;
 const workerLines=pdf.splitTextToSize(c.worker.name,75);const repLines=pdf.splitTextToSize(representative||'Nombre: ____________________',75);
 pdf.text(workerLines.slice(0,2),16,y);pdf.text(repLines.slice(0,2),119,y);
 const fp=await fingerprint(c,docs,settings);const pages=pdf.getNumberOfPages();if(!consolidated)for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFontSize(7);pdf.setTextColor(100);pdf.text(`${c.code} | ${i}/${pages} | Huella ${fp.slice(0,16)}`,16,287);}
 const blob=pdf.output('blob');return {id:crypto.randomUUID(),caseId:c.id,name:`${c.code}-${kind==='Liquidación PDF'?'liquidacion':'paz-y-salvo'}-r${c.settlement.revision}-${Date.now()}.pdf`,mime:'application/pdf',size:blob.size,blob,kind,description:`${kind} generado desde valores y revisiones guardados.`,createdAt:new Date().toISOString(),revision:c.settlement.revision,fingerprint:fp};
}
