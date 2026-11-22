import { mkdir,writeFile } from 'node:fs/promises';
import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import { createApe4Presentation } from '../src/app/ape4';
import { academicComparison,emptyState,money } from '../src/app/models';
import { generatePDF } from '../src/app/pdf';

const seed=createApe4Presentation();
const certificate=await generatePDF(seed.case,seed.documents,emptyState().settings,'Paz y salvo PDF',true);
const cover=new jsPDF({format:'a4',unit:'mm'});
cover.setFillColor(16,42,67);cover.rect(0,0,210,68,'F');
cover.setTextColor(255);cover.setFontSize(26);cover.text(seed.case.academic!.employer.name,17,26);
cover.setFontSize(14);cover.text('Respaldos para la presentación APE 4',17,42);
cover.setFontSize(10);cover.text('CASO HIPOTÉTICO ACADÉMICO',17,55);
cover.setTextColor(16,42,67);cover.setFontSize(18);cover.text(seed.worker.name,17,90);
cover.setFontSize(10);cover.text(`${seed.case.code} | ${seed.worker.role} | Ambato, Ecuador`,17,100);
cover.setFillColor(238,244,252);cover.roundedRect(17,112,176,33,2,2,'F');
cover.text(['Paz y salvo aprobado en la simulación académica.', 'Liquidación y expediente final pendientes del PDF del simulador.', 'Los respaldos incluyen espacios de firma en blanco.'],22,121,{lineHeightFactor:1.75});
cover.setFontSize(13);cover.text('Documentos incluidos',17,161);
cover.setFontSize(10);
const titles=['Certificado interno de paz y salvo',...seed.evidenceTitles];
titles.forEach((title,index)=>cover.text(`${index+1}. ${title}`,19,173+7*index));
cover.setFontSize(13);cover.text('Importes de referencia del informe APE 4',17,225);
cover.setFontSize(9);
academicComparison(seed.case).forEach((row,index)=>{
 const y=234+6*index;
 cover.text(row.label,19,y);
 cover.text(money(row.expected),191,y,{align:'right'});
});
cover.text('Pendientes de contrastar con el reporte del simulador.',17,267);

const packet=await PDFDocument.create();
packet.setTitle('Lookup | Respaldos académicos APE 4');
packet.setAuthor('Lookup');
const append=async(bytes:ArrayBuffer)=>{
 const source=await PDFDocument.load(bytes);
 for(const page of await packet.copyPages(source,source.getPageIndices()))packet.addPage(page);
};
await append(cover.output('arraybuffer'));
await append(await certificate.blob.arrayBuffer());
for(const document of seed.documents)await append(await document.blob.arrayBuffer());
const font=await packet.embedFont(StandardFonts.Helvetica);
const pages=packet.getPages();
pages.forEach((page,i)=>page.drawText(`Lookup | ${seed.case.code} | ${i+1} / ${pages.length}`,{x:48,y:21,size:8,font,color:rgb(.3,.37,.45)}));
await mkdir('output/pdf',{recursive:true});
await writeFile('output/pdf/lookup-ape4-clarent-respaldos.pdf',await packet.save());
