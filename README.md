# Lookup · Gestión laboral

Aplicación local para trabajadores, expedientes, paz y salvo y liquidación documental. Angular 20 standalone, TypeScript, Reactive Forms, Tailwind 4, Lucide, IndexedDB, PDF.js, jsPDF y pdf-lib.

**No contiene una calculadora laboral propia.** El usuario realiza el cálculo fuera de la aplicación en el [portal oficial de calculadoras](https://calculadoras.trabajo.gob.ec/), adjunta su reporte o captura y revisa los valores transcritos. La aplicación únicamente suma importes registrados, resta deducciones respaldadas y controla saldos de vacaciones ingresados manualmente.

## Ejecutar

Requiere Node.js 22.12 o posterior compatible con Angular 20; se verificó con Node 24.19.0.

```powershell
npm ci
npm start
```

Abrir **http://127.0.0.1:4200/**. Las dependencias ya están instaladas en esta carpeta. Para el uso local habitual basta ejecutar `npm start`.

La versión compilada incluye caché de aplicación mediante Angular Service Worker. Para usarla:

```powershell
npm run build
npm run preview
```

Detener `npm start` antes de iniciar `npm run preview`: ambos utilizan el puerto 4200. Mantener el mismo navegador, perfil, host y puerto para consultar los mismos datos. `localhost` y `127.0.0.1` son orígenes distintos y tienen almacenamientos separados. No abrir `index.html` con doble clic.

Tras instalar dependencias, los formularios, IndexedDB y generación de PDF funcionan sin conexión externa mientras el servidor local esté ejecutándose. El simulador oficial requiere internet. El Service Worker de producción permite cachear la aplicación después de una primera visita completa; el modo de desarrollo no registra Service Worker. No se usan fuentes, OCR ni APIs externas para leer los documentos.

## Flujo de trabajo

1. En **Configuración de Lookup**, registrar RUC, dirección y representante para los documentos.
2. En **Trabajadores**, registrar nombre, cédula, cargo, departamento, ingreso, remuneración y contacto. La cédula debe tener 10 dígitos y ser única. No se verifica el dígito de control, para admitir también casos ficticios identificados.
3. Crear el expediente y seleccionar la causal. Adjuntar el respaldo recomendado o registrar por qué falta. En **Información general**, revisar el archivo o su excepción y guardar la confirmación. Puedes reutilizar un archivo que ya pertenezca al expediente.
4. Los archivos PDF, PNG y JPG/JPEG se cargan en su sección, hasta 20 MB por archivo. **Evidencias** reúne los originales para verlos y descargarlos. La actualización conserva los archivos y su vínculo con el expediente.
5. En **Paz y salvo**, expandir un departamento y seleccionar los requisitos aplicables o crear uno personalizado. Aprobar al menos uno y todos los marcados obligatorios. Si un requisito se marca como «No aplica», justificarlo. Cuando se exija respaldo, adjuntar un documento o escribir la excepción. Guardar las verificaciones para que consten en **Historial**.
6. En **Liquidación**, cargar el PDF del Ministerio. El formulario se llena con los importes detectados y los campos no detectados quedan en blanco. Comparar las cifras con el original y corregirlas si corresponde. Si el documento es una captura o un PDF escaneado, registrar sus valores manualmente.
7. Registrar saldo de vacaciones disponible, días utilizados y días liquidados. La pantalla muestra el saldo pendiente. Se aceptan hasta dos decimales y se bloquea un consumo superior al saldo. No se derivan días desde antigüedad o salario.
8. Agregar, si corresponde, deducciones o haberes adicionales con concepto, importe, justificación, responsable y evidencia del mismo expediente. El neto consolidado es la suma de haberes menos deducciones. **Ingresar explícitamente el valor final** y confirmar la revisión. Si los rubros difieren del total aproximado, explicar la diferencia. **Guardar y validar** exige respaldo, consistencia y responsable.
9. En **Documentos generados**, crear el **Expediente PDF consolidado**. El archivo A4 tiene índice, numeración, paz y salvo, liquidación, vacaciones y las páginas de los respaldos correspondientes. Regenerar sin cambios reutiliza la versión vigente.
10. Finalizar desde **Información general**. La pantalla muestra los datos o revisiones faltantes. El cierre requiere un respaldo de terminación revisado o una excepción justificada, el paz y salvo aprobado, la liquidación validada con vacaciones registradas y el consolidado vigente.

## Revisión, documentos e integridad

- El aproximado ministerial y el final validado se almacenan en campos independientes.
- Editar otro dato de liquidación desmarca la confirmación; el usuario debe revisar de nuevo.
- Guardar cambios en datos, respaldos o checklist anula la validación vigente. Los PDFs anteriores se conservan y se identifican como **Versión anterior** por una huella SHA-256 del contenido.
- Al retirar un respaldo de un requisito, se conserva el archivo cuando sigue vinculado a otro requisito, a un ajuste o a la terminación. Los reportes quedan gestionados en Liquidación y los PDFs anteriores siguen disponibles en Documentos generados.
- Archivos y cambios relacionados se guardan en una transacción de IndexedDB. Si falla, la operación no se presenta como guardada.
- El PDF es un documento interno de Lookup. El resultado orientativo del simulador no se presenta como aprobación del Ministerio ni como sustituto del acta en su plataforma.

## Caso hipotético APE 4

Al abrir Lookup se instala una sola vez el expediente académico `LOOKUP-APE4-2026-002` de Clarent Mora, con los datos del apartado 3 del informe APE 4. Contiene cinco respaldos ficticios, verificaciones simuladas del paz y salvo y 0,71 días de vacaciones pendientes en el segundo período. Los campos de liquidación esperan el PDF original del simulador para este caso.

La actualización guarda en IndexedDB una copia recuperable de los expedientes de prueba identificados junto con sus documentos antes de retirarlos de la vista activa. Los registros de origen incierto se conservan. **Configuración de Lookup** ofrece descargar o restaurar la copia. Para Clarent, Lookup evita reutilizar el PDF conocido de la demostración anterior y mantiene separados los importes extraídos del documento y los valores del informe académico.

El certificado y los respaldos académicos están en `output/pdf/lookup-ape4-clarent-respaldos.pdf`. Consulta [la guía de demostración](GUIA-DEMOSTRACION-APE4.md) para presentar el caso y completar el flujo con el PDF del simulador.

## Pruebas

```powershell
npm test
npm run build
npm run pdf:prepare
npm run pdf:render
```

Las pruebas cubren validación monetaria, vacaciones, deducciones respaldadas, lectura de los diez rubros de repote.pdf, requisitos aplicables u obligatorios, guardado de originales, versiones y finalización.

La prueba del flujo usa los formularios y el controlador de Angular con IndexedDB en memoria. Para Clarent se prueba la carga inicial, la copia recuperable, la separación entre el informe y la extracción del PDF, la revisión de una diferencia y la generación de un solo consolidado tras validar una muestra técnica aislada.

La compilación Angular valida también las plantillas estrictas. Puede emitir advertencias de optimización CommonJS de dependencias transitivas de jsPDF; no impiden generar el build.

## Almacenamiento y límites

Los datos pertenecen al navegador y equipo. No existe sincronización, servidor de datos, autenticación ni control de roles. Los nombres de responsables son registros manuales y no equivalen a firma digital. El historial local no es un registro a prueba de alteraciones. Usar un solo espacio de edición a la vez.

En Configuración se puede **descargar un respaldo completo JSON** con registros y archivos codificados en base64 para conservar una copia externa. No hay restauración automática en esta versión; los documentos individuales también pueden descargarse. No borrar los datos del navegador para actualizar la aplicación. Las cuotas y la permanencia de IndexedDB dependen del navegador; no usar modo incógnito para expedientes que deban conservarse.

**La Guía APE 4 no estaba disponible.** No se puede certificar el cumplimiento íntegro de sus nueve requisitos del apartado 2 sin contrastar ese documento. Se implementaron los requisitos expresos del mensaje y el plan adjunto; ver `PLAN.md` y `VERIFICACION.md`.

El navegador de pruebas no estaba accesible. La revisión visual se hizo sobre el PDF consolidado renderizado. La descarga y persistencia se probaron desde el controlador.
