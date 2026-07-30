# CONTRATO FUNCIONAL — idelri trainer-app

> Fecha: 2026-07-29  
> Última actualización: 2026-07-30 (portal configurable v1: columna portal_config JSONB en clientes, PortalClienteModal.jsx compartido, visibilidad de pestañas por cliente)  
> Propósito: referencia obligatoria para todas las refactorizaciones futuras.  
> Todo lo descrito aquí debe seguir funcionando exactamente igual salvo decisión explícita de Irene del Río.

---

## RESUMEN EJECUTIVO

Esta aplicación tiene dos universos de uso distintos:

**Universo entrenadora** — acceso autenticado. Gestión de clientes, planificación anual, sesiones, biblioteca de ejercicios y seguimiento del feedback de las clientas.

**Universo cliente** — acceso público por token. La clienta recibe un enlace, ve su sesión, marca los ejercicios realizados, rellena el feedback y lo envía. Sin login.

La comunicación entre ambos universos pasa por Supabase: la entrenadora crea y comparte; la clienta ejecuta y responde; la entrenadora ve el resultado en Seguimiento.

---

## 1. FLUJOS PROTEGIDOS

### F1 — Entrar en Planificación y seleccionar cliente

**Entrada:** clic en "Plan." en el menú lateral  
**Componentes:** `App.js` → `Planificacion.jsx`  
**Tablas:** `clientes`, `planificaciones`, `bloques`, `subbloques`, `semanas`, `sesiones`, `competiciones`, `controles`, `sesion_notas`  
**Resultado esperado:** la pantalla muestra la planificación del último cliente seleccionado (o pide elegir uno). Las vistas disponibles (Timeline, Bloques, Semanas, Calendario, Seguimiento, Lista) son accesibles.  
**Nunca debe romperse:** que al cambiar de cliente se recarguen todos los datos correctamente.

---

### F2 — Visualizar el calendario de sesiones

**Entrada:** en Planificacion, vista "Calendario"  
**Componentes:** `Planificacion.jsx` → `CalendarioSesiones.jsx`  
**Tablas:** `sesiones`, `competiciones`, `controles`, `sesion_notas`, `bloques`, `subbloques`, `semanas`, `packs_flexibles`  
**Resultado esperado:** calendario mes/semana con sesiones coloreadas, competiciones, controles, notas. Cabeceras de semana con número, bloque y subbloque. Navegación mes anterior/siguiente. Cambio a vista semana.  
**Nunca debe romperse:** que aparezcan todos los elementos del día correcto, que las cabeceras de semana muestren el bloque correcto.

---

### F3 — Crear una sesión desde el calendario

**Entrada:** clic en "+" de un día → "💪 Sesión"  
**Componentes:** `CalendarioSesiones.jsx` → callback `onNuevaSesion` → modal en `Planificacion.jsx`  
**Tablas:** `sesiones` (INSERT)  
**Resultado esperado:** aparece un modal con título, fecha, tipo de sesión, tipo de editor (fuerza/carrera), icono. Al guardar, la sesión aparece en el calendario.  
**Nunca debe romperse:** que la sesión creada tenga la fecha correcta y el tipo de editor elegido. Que aparezca en el calendario inmediatamente.

---

### F4 — Abrir una sesión desde el calendario

**Entrada:** clic en chip de sesión en el calendario de Planificacion  
**Componentes:** `CalendarioSesiones.jsx` → `onAbrirSesion` → `Planificacion.jsx` → `setSesionesContext` → `App.js` → `Sesiones.jsx`  
**Tablas:** `sesiones`, `sesion_bloques`, `sesion_ejercicios`, `sesion_fases`, `sesion_fase_grupos`, `planificaciones`, `bloques`, `subbloques`  
**Resultado esperado:** la app navega a la página Sesiones y abre directamente el editor de la sesión seleccionada.  
**Nunca debe romperse:** que la sesión correcta se abra, que el tipo de editor (fuerza/carrera) sea el correcto según el campo `tipo_editor` de la sesión.

---

### F5 — Editar una sesión de fuerza

**Entrada:** sesión abierta en Sesiones.jsx con `tipo_editor: 'fuerza'`  
**Componentes:** `Sesiones.jsx` (editor de fuerza)  
**Tablas:** `sesion_bloques` (UPDATE/INSERT/DELETE), `sesion_ejercicios` (UPDATE/INSERT/DELETE), `ejercicios_biblioteca` (INSERT en crear ejercicio personalizado)  
**Resultado esperado:**
- Ver bloques con sus colores
- Editar nombre del bloque, nota del bloque, color
- Ver ejercicios dentro de cada bloque: nombre, series, repeticiones, RPE, notas
- Editar cualquier campo de ejercicio con guardado automático (debounce 700ms + al perder foco)
- Ver/reproducir vídeo de YouTube o imagen adjunta al ejercicio
- Añadir ejercicio desde biblioteca (panel lateral)
- Crear ejercicio personalizado (modal con taxonomía + media)
- Reordenar ejercicios con drag & drop
- Reordenar bloques con drag & drop
- Añadir nuevo bloque
- Eliminar bloque
- Copiar bloque al portapapeles y pegar en otra sesión
- Guardar en biblioteca de bloques
**Nunca debe romperse:** que los cambios persistan en Supabase. Que el vídeo de YouTube se muestre correctamente. Que al crear un ejercicio personalizado quede tanto en `ejercicios_biblioteca` como en `sesion_ejercicios`.

---

### F6 — Editar una sesión de carrera (resistencia)

**Entrada:** sesión abierta en Sesiones.jsx con `tipo_editor: 'carrera'`  
**Componentes:** `Sesiones.jsx` (editor de carrera — carritoItems)  
**Tablas:** `sesion_fases` (UPDATE/INSERT/DELETE), `sesion_fase_grupos` (UPDATE/INSERT/DELETE)  
**Resultado esperado:**
- Ver lista combinada de fases sueltas y grupos con repeticiones
- Grupos muestran "− N +" para cambiar repeticiones (mínimo 2)
- Las fases dentro de un grupo se editan independientemente
- Campos editables por fase: nombre, descripción, volumen (min y km), FC zona, ritmo inicio/fin, RPE
- Añadir fase suelta ("+ Bloque suelto")
- Añadir grupo de repeticiones ("+ Grupo") — crea grupo con 2 fases y 3 repeticiones por defecto
- Añadir fase a un grupo existente
- Duplicar fase suelta
- Duplicar grupo (crea nuevo grupo con las mismas fases)
- Copiar fase o grupo al portapapeles y pegar en la misma sesión u otra
- Eliminar fase suelta
- Eliminar grupo (elimina también sus fases)
- Eliminar fase de un grupo
- Reordenar fases sueltas y grupos con drag & drop
**Nunca debe romperse:** que los grupos con repeticiones se conserven (no se conviertan en fases sueltas). Que las fases de un grupo tengan `grupo_id` correcto. Que las repeticiones se actualicen en `sesion_fase_grupos`.

---

### F7 — Copiar una sesión entre días o entre clientes

**Entrada A (flujo habitual):** clic derecho en sesión del calendario de Planificacion → "📋 Copiar" → clic derecho en otro día → "📌 Pegar aquí"  
**Entrada B (flujo alternativo):** desde el calendario interno de Sesiones.jsx → mismo proceso + opción "Pegar en otro cliente"  
**Componentes A:** `CalendarioSesiones.jsx` → `onCopiar`/`onPegar` → `Planificacion.jsx` (handler inline)  
**Componentes B:** `Sesiones.jsx` (Calendario interno) → `pegarSesion()`  
**Tablas:** `sesiones`, `sesion_bloques`, `sesion_ejercicios`, `sesion_fases`, `sesion_fase_grupos`  
**Resultado esperado:** la sesión copiada aparece en la fecha de destino con todos sus bloques (fuerza) o grupos/fases (carrera), incluyendo repeticiones. La sesión original no cambia. Si se pega en otro cliente, aparece en la planificación de ese cliente.  
**Nunca debe romperse:** que los grupos con repeticiones se copien íntegramente. Que las fases tengan el `grupo_id` correcto en la copia. Que la sesión original no se modifique.

---

### F8 — Mover una sesión a otra fecha (drag & drop)

**Entrada:** arrastrar chip de sesión de un día a otro en el calendario  
**Componentes:** `CalendarioSesiones.jsx` → `onMoverSesion` → `Planificacion.jsx`  
**Tablas:** `sesiones` (UPDATE fecha)  
**Resultado esperado:** la sesión aparece en la nueva fecha, desaparece de la anterior.  
**Nunca debe romperse:** que la fecha se actualice correctamente en Supabase.

---

### F9 — Usar la biblioteca desde el editor

**Entrada A:** panel lateral "📚 Biblioteca" dentro del editor de sesiones → buscar ejercicio → arrastrarlo o hacer clic para añadirlo a un bloque  
**Entrada B:** "📚 Biblioteca" en el menú lateral → tab Ejercicios / Bloques / Sesiones  
**Componentes:** `Sesiones.jsx` (panel biblioteca) → `Biblioteca.jsx` → `BibliotecaSesiones.jsx`  
**Tablas:** `ejercicios_biblioteca`, `bloques_biblioteca`, `bloques_biblioteca_ejercicios`, `sesiones` (es_plantilla=true)  
**Resultado esperado:**
- Buscar ejercicio por nombre
- Filtrar por taxonomía (zona corporal, patrón, etc.)
- Añadir ejercicio a bloque: aparece en el bloque con nombre y media copiados
- Guardar bloque de sesión en la biblioteca de bloques
- Guardar sesión completa como plantilla en biblioteca de sesiones
- Abrir plantilla de sesión desde Biblioteca: navega a Sesiones.jsx con esa plantilla
- Copiar plantilla a cliente (asigna la plantilla a un cliente con fecha)
**Nunca debe romperse:** que el ejercicio añadido desde biblioteca tenga el `biblioteca_id` correcto y la media (URL YouTube/imagen/vídeo) copiada.

---

### F10 — Volver a Planificación desde el editor

**Entrada:** botón "← Volver" en Sesiones.jsx  
**Componentes:** `Sesiones.jsx` → `volverAlCalendario()` → `App.js` → `Planificacion.jsx`  
**Resultado esperado:** vuelve a la vista Planificacion del mismo cliente, con el calendario visible. Si hay cambios sin marcar como guardados, aparece un aviso antes de salir. Planificacion recarga sus datos.  
**Nunca debe romperse:** que al volver aparezca el cliente correcto y el calendario con los datos actualizados.

---

### F11 — Acceso de la clienta a su sesión (vista pública)

**Entrada:** enlace `/sesion/[token]` en el navegador de la clienta (sin login)  
**Componentes:** `SesionPublica.jsx`  
**Tablas:** `sesiones`, `sesion_bloques`, `sesion_ejercicios`, `sesion_fases`, `sesion_fase_grupos`, `sesion_feedback`  
**Resultado esperado:**
- La página carga la sesión sin autenticación
- Si es de fuerza: muestra bloques con ejercicios, series, reps, RPE, notas, vídeo/imagen
- Si es de carrera: muestra fases sueltas y grupos con repeticiones y descripción
- Puede marcar ejercicios como realizados (valores reales)
- Puede marcar "todos realizados"
- Formulario de feedback al final (si `con_feedback !== false`)
- Puede enviar el feedback
- Puede editar el feedback tras enviarlo
- Si la sesión es parte de un pack flexible, puede guardarla en una fecha específica
**Nunca debe romperse:** el acceso público sin login, la visualización correcta de grupos de carrera, el envío del feedback, que el feedback quede guardado en `sesion_feedback`.

---

### F12 — Feedback de la clienta visible para la entrenadora (Seguimiento)

**Entrada:** en Planificacion, vista "Seguimiento"  
**Componentes:** `Planificacion.jsx` → `Seguimiento.jsx`  
**Tablas:** `sesiones`, `sesion_feedback`, `checkin_semanal`, `bloques`, `subbloques`, `semanas`  
**Resultado esperado:** la entrenadora ve por semana el estado de cada sesión (completada, parcial, no realizada, sin feedback), el RPE medio, la duración, comentarios de la clienta, molestias y dificultades técnicas reportadas.  
**Nunca debe romperse:** que el feedback enviado por la clienta aparezca en la vista de seguimiento.

---

### F13 — ~~Acceso público al plan de planificación~~ — ELIMINADO

> **Eliminado completamente 2026-07-29.** `PlanPublica.jsx` borrado. Ruta `/plan/[token]` y lógica en App.js eliminadas. Columna `planificaciones.token_publico` eliminada de Supabase junto con las 4 políticas RLS dependientes (`público - planificaciones por token`, `público - bloques`, `público - subbloques`, `público - semanas`). El sistema activo de acceso público es el portal completo `/cliente/[token_cliente]`. Los tokens de `sesiones`, `semanas`, `packs_flexibles` y `cuestionario_inicial` siguen intactos.

---

### F14 — Vista semanal de la clienta

**Entrada:** enlace `/semana/[token]`  
**Componentes:** `VistaSemanalCliente.jsx`  
**Tablas:** `semanas`, `sesiones`, `sesion_feedback`, `checkin_semanal`  
**Resultado esperado:** la clienta ve las sesiones de esa semana con su estado (pendiente, completada, etc.). Puede rellenar el check-in semanal.  
**Nunca debe romperse:** que las sesiones aparezcan con el estado correcto, que el check-in se guarde en Supabase.

---

### F15 — Portal completo de la clienta

**Entrada:** enlace `/cliente/[token_cliente]`  
**Componentes:** `ClientePortal.jsx`  
**Tablas:** `clientes` (incluye `portal_config`), `planificaciones`, `sesiones`, `sesion_feedback`, `packs_flexibles`, `competiciones`, `controles`, `sesion_notas`  
**Resultado esperado:** la clienta ve su información según la configuración de visibilidad. Pestañas disponibles: "Esta semana", "Calendario", "Mi plan". Cada una puede activarse/desactivarse individualmente desde `portal_config`.  
**Compatibilidad:** clientes sin `portal_config` (null) ven las tres pestañas completas.  
**Pestaña inicial:** la primera visible según orden: Esta semana → Calendario → Mi plan.  
**Nunca debe romperse:** que el token de cliente cargue solo los datos de esa clienta. Que una configuración incompleta no deje pantalla vacía.

**Configuración de visibilidad (`portal_config` JSONB en `clientes`):**
```json
{
  "mostrar_semana": true,
  "mostrar_calendario": true,
  "mostrar_plan": true
}
```
- Valores por defecto: todos `true`.
- Mínimo un apartado visible (validado en `PortalClienteModal.jsx`).
- Los flags son de presentación: no reemplazan las políticas RLS.
- Las rutas `/sesion/`, `/semana/`, `/pack/`, `/cuestionario/`, `/checkin-portal/` siguen activas e independientes.

---

### F16 — Compartir enlace de sesión

**Entrada:** botón "🔗 Compartir" en editor de sesiones  
**Componentes:** `Sesiones.jsx` → `copiarEnlaceSesion`  
**Tablas:** `sesiones` (lee `token_publico`)  
**Resultado esperado:** el enlace `/sesion/[token]` se copia al portapapeles. El enlace lleva a la vista pública de la sesión.  
**Nunca debe romperse:** que el token sea único y persista para esa sesión.

---

### F17 — Gestión de clientes (CRUD)

**Entrada:** menú → Clientes  
**Componentes:** `Clientes.jsx`  
**Tablas:** `clientes`  
**Resultado esperado:** lista de clientes con estado, nombre, tipo. Crear, editar, desactivar clientes. Acceder directamente a la planificación de un cliente desde aquí.  
**Nunca debe romperse:** que los clientes desactivados no aparezcan en los selectores de otros módulos.

---

### F18 — Autenticación

**Entrada:** acceso a la app sin sesión  
**Componentes:** `Login.jsx`, `App.js` (supabase.auth)  
**Tablas:** Supabase Auth  
**Resultado esperado:** pantalla de login. Tras autenticarse, la app carga la pantalla principal. Al cerrar sesión, vuelve al login.  
**Nunca debe romperse:** que las páginas privadas no sean accesibles sin sesión. Que las páginas públicas (por token) funcionen sin sesión.

---

## 2. FUNCIONALIDADES CRÍTICAS

Las siguientes funcionalidades nunca deben romperse en ninguna refactorización. Son el núcleo operativo de la app.

| # | Funcionalidad | Justificación |
|---|---|---|
| C1 | Abrir sesión desde el calendario de Planificacion | Flujo de trabajo diario principal |
| C2 | Editor de fuerza: editar nombre, series, reps, RPE y notas de ejercicio con guardado automático | Contenido central de cada sesión |
| C3 | Editor de carrera: grupos de repeticiones con su count (N×) correctamente representado | La pérdida de grupos fue el bug más crítico detectado |
| C4 | Copiar sesión conservando grupos de carrera | Bug ya corregido — debe permanecer correctamente |
| C5 | Vídeo de YouTube en ejercicio: se muestra correctamente al cliente | Contenido multimedia principal |
| C6 | Acceso público de la clienta a su sesión por token | Sin esto la clienta no puede ver ni hacer su entrenamiento |
| C7 | Envío de feedback por la clienta | Comunicación clienta → entrenadora |
| C8 | Feedback de la clienta visible en Seguimiento | Comunicación clienta → entrenadora |
| C9 | Enlace de sesión compartible (token único por sesión) | Canal de comunicación permanente |
| C10 | Crear ejercicio personalizado desde el editor (modal + INSERT atómico en biblioteca + sesión) | Alta de ejercicios nuevos en flujo de trabajo |
| C11 | Añadir ejercicio desde biblioteca al bloque (con biblioteca_id y media) | Reutilización de ejercicios existentes |
| C12 | Volver de Sesiones a Planificacion con recarga correcta del cliente | Navegación principal entre los dos módulos |
| C13 | Portal cliente (`/cliente/[token]`): acceso sin login y solo datos del cliente correcto | Privacidad y accesibilidad del cliente |
| C14 | Plan público (`/plan/[token]`): acceso sin login | Comunicación de la planificación al cliente |
| C15 | Autenticación: páginas privadas inaccesibles sin login | Seguridad básica |
| C16 | Mover sesión a otra fecha con drag & drop | Ajuste diario de planificación |
| C17 | Guardar sesión como plantilla en biblioteca | Reutilización de trabajo |
| C18 | Duplicar sesión con fecha elegida | Operación frecuente de planificación |
| C19 | Estado `tipo_editor` de la sesión determina correctamente qué editor se muestra | Si falla, una sesión de carrera abriría como fuerza y viceversa |
| C20 | Feedback: la clienta puede editar su respuesta tras enviarla | Funcionalidad de corrección documentada y activa |

---

## 3. FUNCIONALIDADES SECUNDARIAS

Estas funcionalidades forman parte de la app y deben funcionar, pero un cambio temporal o una regresión puntual en ellas no bloquea el trabajo diario.

| # | Funcionalidad |
|---|---|
| S1 | Compartir enlace de semana (`/semana/[token]`) y check-in semanal de la clienta |
| S2 | Vista semanal de cliente (`VistaSemanalCliente`): estado de sesiones y check-in |
| S3 | Gestión de packs flexibles (CRUD, compartir enlace `/pack/[token]`) |
| S4 | Exportar datos a CSV (`export.js`) |
| S5 | Creación y edición de competiciones en el calendario |
| S6 | Creación y edición de valoraciones/controles en el calendario |
| S7 | Notas en el calendario (crear, editar, ver en tooltip) |
| S8 | Copiar y pegar semana entera (si se activa esta funcionalidad desde Planificacion) |
| S9 | Biblioteca de bloques (crear, editar, insertar en sesión) |
| S10 | Guardar sesión en biblioteca de sesiones (plantillas) |
| S11 | Copiar plantilla de biblioteca a un cliente con fecha |
| S12 | Vista previa cliente desde el editor de sesiones |
| S13 | ~~Compartir enlace de planificación (plan público por token)~~ — **Eliminado 2026-07-29.** `PlanPublica.jsx` borrado. Ruta `/plan/[token]` inactiva. |
| S14 | Tooltip al pasar el cursor sobre sesión en el calendario (bloques/fases/grupos) |
| S15 | Filtros de timeline (bloques, subbloques, semanas, sesiones, eventos) |
| S16 | Cuestionario inicial de incorporación de clienta (`/cuestionario/[token]`) |
| S17 | Dashboard: clientes agrupados por actividad con acceso rápido |
| S18 | Pagos: tabla mensual y gráfica de ingresos |
| S19 | Portapapeles de bloque (copiar un bloque fuerza completo y pegarlo en otra sesión) |
| S20 | Icono personalizado por sesión (emoji picker) |

---

## 4. FUNCIONALIDADES APARENTEMENTE SIN USO ACTIVO

Estas funcionalidades existen en el código pero no forman parte del flujo habitual confirmado, o están accesibles solo por rutas huérfanas.

| # | Funcionalidad | Ubicación | Estado |
|---|---|---|---|
| U1 | Editor completo de sesiones alternativo | `SesionesPlan.jsx` | Código huérfano — no importado en App.js. Incluye packs avanzados, copiar semana entre clientes, lista sin fecha |
| U2 | Toggle de visibilidad sesión/nota (entrenadora / cliente) | `SesionesPlan.jsx` | Solo en código huérfano. No hay columna `visibilidad` visible en el flujo activo |
| U3 | Copiar semana entera a otro cliente | `SesionesPlan.jsx::copiarSemana`, `pegarSemana` | Solo en código huérfano |
| U4 | Copiar lista de sesiones sin fecha a otro cliente | `SesionesPlan.jsx::copiarListaSinFecha` | Solo en código huérfano |
| U5 | Copiar pack completo a otro cliente | `SesionesPlan.jsx::copiarPackAOtroCliente` | Solo en código huérfano |
| U6 | Panel de notas de semana (comentario editable al hacer clic en la cabecera de semana) | `SesionesPlan.jsx::guardarNotaSemana` | En código huérfano; CalendarioSesiones sí tiene la cabecera con clic pero la lógica de notas allí apunta a Planificacion |
| U7 | `Tareas.jsx` | `src/pages/Tareas.jsx` | Importado en App.js pero no en el array NAV ni en el switch de renderizado. Inaccesible |
| U8 | `CheckIcon` en App.js | `App.js` línea 166 | Definida pero no usada en el JSX del menú |
| U9 | Pegar sesión en otro cliente desde el calendario de Planificacion | `CalendarioSesiones.jsx` prop `onPegarOtroCliente` | La prop existe y hay un botón "→ Otro cliente" si `onPegarOtroCliente` está presente, pero Planificacion.jsx no la implementa actualmente |
| U10 | Reordenación de sesiones sin fecha con drag & drop | `SesionesPlan.jsx::reordenarSinFecha` | Solo en código huérfano |
| U11 | Análisis de visualización de checkin_semanal en Seguimiento | Parcialmente en `Seguimiento.jsx` | Los datos de checkin se cargan pero la visualización está incompleta según CLAUDE.md |
| U12 | `CheckinPortal.jsx` | `src/pages/CheckinPortal.jsx` | Accesible por `/checkin-portal/[token]` pero la lógica interna necesita revisión |

---

## 5. CHECKLIST COMPLETA DE REGRESIÓN

Esta lista debe recorrerse manualmente después de cualquier cambio de código relevante.

### BLOQUE 1 — Autenticación y navegación

```
□ 1.1  Abrir la app sin sesión muestra la pantalla de login
□ 1.2  Iniciar sesión con credenciales correctas lleva al Dashboard
□ 1.3  Cerrar sesión vuelve al login
□ 1.4  Menú lateral muestra: Dashboard, Clientes, Pagos, Plan., Biblioteca
□ 1.5  Cambiar de sección desde el menú lateral funciona
□ 1.6  El cliente anterior sigue seleccionado al volver a Plan. desde otra sección
```

### BLOQUE 2 — Planificación y calendario

```
□ 2.1  Entrar en Plan. muestra el selector de cliente o el último cliente
□ 2.2  Cambiar de cliente recarga todos los datos correctamente
□ 2.3  Cambiar entre vistas (Timeline, Bloques, Subbloques, Semanas, Calendario, Seguimiento, Lista)
□ 2.4  En vista Calendario: las sesiones aparecen en el día correcto
□ 2.5  En vista Calendario: las competiciones aparecen en su día con icono 🏆
□ 2.6  En vista Calendario: los controles/valoraciones aparecen con icono 🔬
□ 2.7  En vista Calendario: las notas aparecen con icono 📝
□ 2.8  Las cabeceras de semana muestran número de semana, bloque y subbloque correctos
□ 2.9  Navegación de mes anterior/siguiente funciona
□ 2.10 Cambiar a vista semana funciona
□ 2.11 Tooltip al pasar el cursor sobre una sesión de fuerza muestra bloques y ejercicios
□ 2.12 Tooltip sobre sesión de carrera muestra fases sueltas y grupos con "🔁 N×"
□ 2.13 Tooltip sobre nota muestra el texto y permite editarla al hacer clic
```

### BLOQUE 3 — Crear elementos desde el calendario

```
□ 3.1  Clic en "+" de un día abre el menú (Sesión / Competición / Valoración / Nota)
□ 3.2  Crear sesión: el modal aparece con la fecha correcta
□ 3.3  Crear sesión fuerza: se guarda con tipo_editor='fuerza'
□ 3.4  Crear sesión carrera: se guarda con tipo_editor='carrera'
□ 3.5  La sesión nueva aparece en el calendario en la fecha correcta
□ 3.6  Crear competición: aparece en el calendario con 🏆
□ 3.7  Crear valoración/control: aparece con 🔬
□ 3.8  Crear nota: aparece con 📝
□ 3.9  Clic derecho en sesión muestra menú contextual con "📋 Copiar"
□ 3.10 Con portapapeles activo, clic derecho en día vacío muestra "📌 Pegar aquí"
```

### BLOQUE 4 — Abrir y editar sesión de fuerza

```
□ 4.1  Clic en sesión del calendario navega al editor y abre esa sesión
□ 4.2  El editor muestra los bloques existentes con sus colores
□ 4.3  Cada bloque muestra sus ejercicios con nombre, series, reps, RPE, notas
□ 4.4  Editar nombre de ejercicio: el cambio se persiste en Supabase
□ 4.5  Editar series/reps/RPE/notas: el cambio se persiste
□ 4.6  Cambiar color de bloque: el nuevo color se guarda
□ 4.7  Añadir nuevo bloque: aparece vacío al final
□ 4.8  Eliminar bloque: desaparece y sus ejercicios también
□ 4.9  Drag & drop de ejercicios dentro del bloque: reordenación persiste
□ 4.10 Drag & drop entre bloques: ejercicio se mueve al bloque correcto
□ 4.11 Drag & drop de bloques: reordenación persiste
□ 4.12 Ejercicio con YouTube: el embed de vídeo se muestra correctamente
□ 4.13 Ejercicio con imagen: la imagen se muestra
□ 4.14 Ejercicio con vídeo subido: el vídeo se reproduce
□ 4.15 Crear ejercicio personalizado (modal): se guarda en biblioteca Y en la sesión
□ 4.16 Añadir ejercicio desde panel biblioteca: aparece en el bloque con media copiada
□ 4.17 Copiar bloque: aparece en el portapapeles (toast "copiado")
□ 4.18 Pegar bloque en otra sesión: el bloque con sus ejercicios aparece
□ 4.19 Guardar en biblioteca de bloques: el bloque aparece en "Biblioteca > Bloques"
□ 4.20 Botón "Guardar" cambia a "✓ Guardado"
□ 4.21 Compartir enlace de sesión: copia URL al portapapeles
□ 4.22 Duplicar sesión: modal con fecha, crea copia con todos los bloques
```

### BLOQUE 5 — Editar sesión de carrera (resistencia)

```
□ 5.1  El editor de carrera muestra el carrito de fases/grupos (no el editor de fuerza)
□ 5.2  Las fases sueltas se muestran como bloques individuales
□ 5.3  Los grupos con repeticiones muestran "− N +" donde N es el número correcto
□ 5.4  Las fases dentro del grupo aparecen anidadas bajo el grupo
□ 5.5  Editar nombre de fase: el cambio persiste en sesion_fases
□ 5.6  Editar descripción: persiste
□ 5.7  Editar volumen (km, min): persiste
□ 5.8  Editar FC zona, ritmo, RPE: persiste
□ 5.9  Incrementar repeticiones de grupo (botón "+"): persiste en sesion_fase_grupos
□ 5.10 Decrementar repeticiones (botón "−"): no baja de 2
□ 5.11 Añadir fase suelta ("+ Bloque suelto"): aparece al final del carrito
□ 5.12 Añadir grupo ("+ Grupo"): aparece con 3 repeticiones y 2 fases vacías
□ 5.13 Añadir fase a grupo existente: aparece dentro del grupo
□ 5.14 Duplicar fase suelta: aparece copia a continuación
□ 5.15 Duplicar grupo: aparece copia con todas sus fases y el mismo N de repeticiones
□ 5.16 Eliminar fase suelta: desaparece de sesion_fases
□ 5.17 Eliminar grupo: desaparece de sesion_fase_grupos y sus fases de sesion_fases
□ 5.18 Eliminar fase de un grupo: la fase desaparece, el grupo persiste
□ 5.19 Drag & drop del carrito: reordenación persiste
```

### BLOQUE 6 — Copiar y mover sesiones

```
□ 6.1  Copiar sesión de fuerza desde Planificacion y pegar en otro día: bloques y ejercicios correctos
□ 6.2  Copiar sesión de carrera con fases sueltas desde Planificacion: las fases se copian sueltas
□ 6.3  Copiar sesión de carrera con grupos desde Planificacion: los grupos con N× correctos
□ 6.4  La sesión original no se modifica tras la copia
□ 6.5  Mover sesión con drag & drop a otro día: aparece en el nuevo día, desaparece del anterior
□ 6.6  Copiar y pegar desde el calendario interno de Sesiones.jsx: mismo resultado
□ 6.7  Pegar en otro cliente desde el calendario de Sesiones.jsx: aparece en la planificación del cliente destino
□ 6.8  Duplicar sesión de carrera: los grupos con repeticiones se copian correctamente
```

### BLOQUE 7 — Volver a Planificación

```
□ 7.1  Botón "← Volver" sin cambios pendientes: vuelve directamente a Planificacion
□ 7.2  Botón "← Volver" con cambios pendientes: muestra aviso antes de salir
□ 7.3  "Salir sin guardar" vuelve sin guardar
□ 7.4  Al volver, Planificacion muestra el mismo cliente que estaba seleccionado
□ 7.5  Al volver, el calendario muestra las sesiones actualizadas
```

### BLOQUE 8 — Biblioteca

```
□ 8.1  Menú → Biblioteca muestra tabs: Ejercicios, Bloques, Sesiones
□ 8.2  Tab Ejercicios: lista todos los ejercicios de la biblioteca
□ 8.3  Buscar ejercicio por nombre: filtra correctamente
□ 8.4  Crear ejercicio nuevo en Biblioteca: aparece en la lista
□ 8.5  Editar ejercicio en Biblioteca: los cambios persisten
□ 8.6  Eliminar ejercicio: desaparece (sin afectar sesiones existentes)
□ 8.7  Tab Bloques: lista bloques de la biblioteca
□ 8.8  Tab Sesiones: lista plantillas de sesión
□ 8.9  Abrir plantilla de sesión: navega al editor con esa plantilla
□ 8.10 Copiar plantilla a cliente: la sesión aparece en la planificación del cliente con la fecha elegida
```

### BLOQUE 9 — Vista pública (cliente)

```
□ 9.1  Enlace /sesion/[token] carga sin login
□ 9.2  Token incorrecto no muestra datos (error o página vacía)
□ 9.3  Sesión de fuerza: se muestran los bloques y sus ejercicios
□ 9.4  Cada ejercicio muestra: nombre, series, reps, RPE, notas
□ 9.5  Ejercicio con YouTube: el embed aparece y se puede reproducir
□ 9.6  Ejercicio con imagen: se muestra la imagen
□ 9.7  Ejercicio con vídeo subido: se puede reproducir
□ 9.8  Sesión de carrera: se muestran fases sueltas y grupos con "🔁 N×"
□ 9.9  Marcar ejercicio como realizado: se guarda en valores_reales
□ 9.10 "Marcar todos como realizados" funciona
□ 9.11 Formulario de feedback aparece al final (si con_feedback=true)
□ 9.12 Rellenar y enviar feedback: se guarda en sesion_feedback
□ 9.13 Editar feedback enviado: el formulario se pre-rellena con los valores anteriores
□ 9.14 Feedback actualizado visible para entrenadora en Seguimiento
□ 9.15 Sesión con con_feedback=false: no aparece el formulario de feedback
```

### BLOQUE 10 — Seguimiento

```
□ 10.1 En Planificacion → vista Seguimiento: se cargan los datos del cliente
□ 10.2 Las sesiones aparecen agrupadas por semana
□ 10.3 El estado de cada sesión (completada/parcial/no realizada/sin feedback) es correcto
□ 10.4 El RPE medio por semana se calcula correctamente
□ 10.5 Los comentarios de la clienta aparecen
□ 10.6 Las molestias y dificultades técnicas aparecen
□ 10.7 Sesiones sin feedback aparecen como "Sin feedback" (no como error)
```

### BLOQUE 11 — Plan y portal público

```
□ 11.1 Enlace /plan/[token] carga la planificación sin login
□ 11.2 La planificación muestra bloques, subbloques y semanas
□ 11.3 Enlace /cliente/[token_cliente] carga el portal de la clienta sin login
□ 11.4 El portal muestra las sesiones de la semana actual
□ 11.5 Clic en sesión del portal: navega a /sesion/[token] de esa sesión
□ 11.6 Enlace /semana/[token] carga la vista semanal
□ 11.7 El check-in semanal se puede rellenar y enviar
```

### BLOQUE 12 — Gestión general

```
□ 12.1 Menú → Clientes: lista de clientes
□ 12.2 Crear cliente nuevo: aparece en la lista
□ 12.3 Editar cliente: los cambios persisten
□ 12.4 Desde Clientes, acceder directamente a la planificación del cliente
□ 12.5 Dashboard: clientes agrupados por tipo de actividad
□ 12.6 Dashboard: clic en cliente navega a su planificación
□ 12.7 Pagos: tabla mensual de facturación visible
```

---

## 6. RIESGOS

### Clasificación por flujo

| Flujo | Nivel | Justificación |
|---|---|---|
| F4 — Abrir sesión desde calendario | **Muy alto** | Cualquier cambio en el paso de contexto entre App.js, Planificacion y Sesiones puede romper la apertura de sesiones. Es el paso más frágil de la navegación. |
| F11 — Acceso público de la clienta | **Muy alto** | Las clientas acceden desde sus móviles. Un error en SesionPublica o en la estructura de datos de fases/grupos les impide hacer su entrenamiento. |
| F6 — Editor de carrera | **Muy alto** | La lógica de grupos con repeticiones (`sesion_fase_grupos` + `sesion_fases` con `grupo_id`) es la más compleja. Cualquier refactorización que toque el carrito o la carga de detalle puede romper la representación de grupos. |
| F7 — Copiar sesión con grupos | **Muy alto** | Bug ya corregido dos veces. La lógica correcta vive en dos sitios distintos (Planificacion y Sesiones) con implementaciones ligeramente diferentes. |
| F12 — Feedback en Seguimiento | **Alto** | La cadena es larga: clienta envía → `sesion_feedback` → entrenadora ve en Seguimiento. Cualquier cambio en el schema de `data` (JSONB) puede romper la visualización sin error aparente. |
| F10 — Volver a Planificación | **Alto** | El paso `setRecargarPlan` + `setClientePlanificacion` + `setPage` en App.js es una cadena de estados que puede desincronizarse. Si Planificacion no carga el cliente correcto al volver, el usuario puede ver datos de otro cliente. |
| F5 — Editor de fuerza | **Alto** | El guardado automático (debounce) puede perder cambios si el usuario navega antes de que el timer se complete. |
| F9 — Biblioteca | **Medio** | El INSERT atómico (biblioteca + sesion_ejercicios) puede dejar registros huérfanos en biblioteca si falla el segundo INSERT. |
| F2 — Calendario | **Medio** | `bloqueDeFecha()` calcula la semana relativa a cada bloque. Si los datos de bloque tienen fechas erróneas, las cabeceras de semana son incorrectas. |
| F13 / F14 / F15 — Vistas públicas | **Medio** | Son páginas solo de lectura. El riesgo es de rendimiento o de privacidad (token incorrecto mostrando datos ajenos), no de pérdida de datos. |
| F1 — Entrar en Planificación | **Bajo** | Carga de datos estándar. El riesgo más común es una carga lenta si hay muchos datos. |
| F3 — Crear sesión | **Bajo** | INSERT simple. El riesgo es que la fecha o el tipo_editor se pierdan si el modal no los pasa correctamente. |
| F8 — Mover sesión (drag & drop) | **Bajo** | UPDATE de fecha. El único riesgo es que la UI no refleje el cambio si el estado local no se actualiza tras el UPDATE. |
| F17 / F18 — Clientes / Auth | **Bajo** | Funcionalidades estables y no conectadas al núcleo de sesiones. |

### Puntos de alta fragilidad transversal

| Punto | Por qué es frágil | Afecta a |
|---|---|---|
| `tipo_editor` null o ausente | El fallback es `'fuerza'`. Una sesión de carrera sin `tipo_editor` abre como fuerza sin error. | F4, F6, F11 |
| `sesionesContext` en App.js | Si `setSesionesContext` se llama con `sesionId: null` por error, Sesiones.jsx carga sin sesión inicial y el usuario ve el calendario vacío | F4 |
| `grupo_id` en sesion_fases | Las fases sueltas tienen `grupo_id = null`. Si por error se inserta `undefined`, el comportamiento en la vista pública es indeterminado | F6, F7, F11 |
| `token_publico` en sesiones | Si es null, el enlace de compartir no funciona. Si no es único, una clienta podría ver la sesión de otra | F16, F11 |
| `con_feedback` en sesiones | Si es `false`, no aparece el formulario. Si se pierde en una copia, la clienta no puede dar feedback | F7, F11 |
| Supabase RLS | Si las políticas cambian, las vistas públicas pueden quedar inaccesibles o mostrar datos incorrectos | F11 – F15 |

---

## APÉNDICE: PREGUNTAS SIN RESPUESTA

Las siguientes preguntas afectan al alcance del contrato pero no pueden responderse solo con análisis de código:

**P1.** ¿Actualmente hay sesiones en producción con `tipo_actividad` pero sin `tipo_editor`? (Sesiones creadas antes de la migración a `tipo_editor`)

**P2.** ¿La funcionalidad de "toggle visibilidad" (entrenadora / cliente) estaba activa en algún momento? ¿Hay datos en las tablas con ese campo?

**P3.** ¿El campo `con_feedback` en sesiones tiene un valor por defecto en Supabase, o depende de que la app lo escriba explícitamente?

**P4.** ¿Las sesiones antiguas (antes del editor de carrera) tienen `sesion_fases` vacías o no tienen registros en esa tabla?

**P5.** ¿Se usa actualmente el portal de clienta (`/cliente/[token_cliente]`)? ¿El `token_cliente` está generado para todas las clientas o solo para algunas?
