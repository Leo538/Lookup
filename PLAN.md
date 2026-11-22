# Implementación de Lookup

La carpeta de trabajo estaba vacía al inicio. Se conserva la elección del plan: Angular 20 standalone, Reactive Forms, Tailwind, Lucide, IndexedDB y jsPDF. La aplicación funciona localmente; no requiere cuentas ni servicios contratados.

1. Preparar proyecto, modelos y almacenamiento transaccional de registros y blobs.
2. Construir navegación, dashboard con estadísticas reales y registro de trabajadores y expedientes con datos laborales históricos.
3. Incorporar 18 verificaciones departamentales, responsables, fechas, observaciones, evidencias e historial.
4. Incorporar archivos originales PDF/PNG/JPG, validación de contenido, visualización, descarga y eliminación controlada.
5. Registrar los diez rubros del reporte, valor aproximado independiente, vacaciones y ajustes respaldados. Extraer propuestas de PDFs con texto; siempre revisar antes de validar.
6. Generar documentos A4 con firmas, referencias al original, vacaciones, rubros, deducciones, neto, responsable y revisión. Archivar versiones y detectar documentos anteriores por huella de contenido.
7. Probar persistencia, validaciones, aritmética de consolidación, PDFs y flujo de demostración.

## Límites de las fuentes

Se encontró `repote.pdf` en la carpeta superior de la materia. Se usa únicamente como referencia de formato, sin atribuir sus cifras a la trabajadora ficticia. No se encontró el documento Guía APE 4. Por tanto, no se declara verificado el cumplimiento íntegro de sus nueve requisitos; la implementación cubre los requisitos expresos del mensaje y del plan adjunto.

La única aritmética implementada es sumar valores transcritos, restar deducciones registradas y controlar saldos de días ingresados. No se calculan prestaciones desde salarios, antigüedad ni fórmulas del Código del Trabajo.
