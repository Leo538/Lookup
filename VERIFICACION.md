# Verificación funcional

Fecha: 18 de noviembre de 2026.

| Requisito expreso | Implementación | Evidencia de verificación |
| --- | --- | --- |
| Subir, almacenar, visualizar y descargar reporte | Blob en IndexedDB, original junto a rubros, visor modal, descarga | Validación de firma/tamaño; persistencia de bytes al reabrir; controlador de carga probado. Visor pendiente de revisión visual en navegador. |
| Registro manual o extracción revisada | PDF.js completa el formulario al cargar el reporte. Los valores ausentes quedan en blanco y se pide confirmación expresa. | repote.pdf devuelve los diez rubros y USD 4.560,97. Un PDF de solo imagen permite transcripción manual. |
| Vacaciones pendientes, utilizadas y liquidadas | Saldo disponible manual y control de consumos, pendiente por diferencia | Rechazo de negativos y consumos superiores al saldo, control de decimales. |
| Haberes, deducciones y neto | Diez conceptos y ajustes con responsable, evidencia y justificación | Pruebas de consolidación en centavos, evidencia del mismo expediente y neto explícito. |
| Aproximado separado del validado | Campos distintos, discrepancia explicada, validación con fecha | Pruebas de diferencia y revocación por cambios. |
| PDF con todos los datos y firmas | Consolidado A4 con índice, numeración, seis secciones y anexos incorporados. | Se comprobaron el texto, las páginas de los anexos, la exclusión de archivos ajenos y los duplicados. |
| Original y PDF en expediente | Vínculos por expediente y requisito, guardado transaccional. | Prueba de reapertura de IndexedDB con original, consolidado y versiones. |
| Consulta y descarga posterior | Evidencias muestra el resumen de originales y Documentos generados conserva el historial. | Se verificó el archivo descargable a partir del Blob y su persistencia tras reabrir la base. |
| Sin calculadora laboral propia | Solo transcripción, sumas, restas y control de saldos | No existen fórmulas de prestaciones, antigüedad ni indemnizaciones. |

La versión actual incorpora respaldos por causal, departamentos desplegables, requisitos aplicables configurables y un solo PDF vigente por revisión. La migración mantiene IDs, archivos e historial anteriores.

## Resultados

- `npm test` cubre creación por renuncia, paz y salvo, lectura automática, vacaciones, revisión, anexos, descarga, versiones y finalización en un caso técnico independiente.
- Para APE 4 se comprobó la instalación de Clarent Mora, la copia y restauración de las demostraciones anteriores, la conservación de datos de origen incierto y la separación entre los valores del informe y el PDF. El flujo de generación y cierre se verificó con una muestra técnica aislada.
- `npm run build`: compilación de producción aprobada con plantillas estrictas.
- Servidor local de desarrollo: respuesta HTTP 200.
- El consolidado de prueba se renderizó para inspeccionar el índice, las tablas, las firmas y los anexos.
- El PDF de `output/pdf` reúne el certificado de paz y salvo y cinco respaldos académicos del caso de Clarent. Los ejemplos anteriores se conservan en `output/archive`.

## Pendientes de verificación

No se encontró la Guía APE 4, por lo que sus nueve requisitos no se presentan como verificados. Falta contrastarlos con el documento original.

El host del navegador de pruebas no estaba disponible en esta revisión. Las pruebas del flujo usan el controlador Angular, IndexedDB en memoria y verificación visual de páginas PDF renderizadas.

El usuario indicó que cargará el PDF ministerial de Clarent. La liquidación, el consolidado final y el cierre permanecen pendientes de la carga y validación de ese archivo.
