# AUDITORÍA FASE 2 — ARQUITECTURA DE SESIONES Y PLANIFICACIÓN

> Fecha: 2026-07-29  
> Rama: main  
> Sin modificaciones de código. Solo análisis y documentación.

---

## RESUMEN EJECUTIVO

La aplicación tiene **dos mundos paralelos** para gestionar sesiones que han crecido por separado:

1. **El mundo de Planificacion.jsx + CalendarioSesiones.jsx**: el flujo real y habitual de trabajo (menú → cliente → calendario → sesión). Es el camino que usa el usuario todos los días.

2. **El mundo de Sesiones.jsx + su Calendario interno**: un editor completo y autónomo con su propio calendario. Se accede de forma indirecta (vía `setSesionesContext` desde Planificacion o Biblioteca). Contiene la lógica más madura y correcta.

3. **SesionesPlan.jsx**: una tercera implementación paralela, más avanzada en algunas áreas (packs, semanas, copia entre clientes), pero completamente huérfana: ningún archivo activo la importa ni la ejecuta.

El resultado es que la misma operación (copiar una sesión, editar un ejercicio, crear una sesión nueva) existe en hasta **tres versiones distintas** con comportamientos diferentes. Esto ya causó el bug de copia de sesiones de resistencia corregido en la sesión anterior.

**Riesgo principal**: cualquier mejora aplicada en un sitio equivocado es trabajo perdido. Cualquier bug en el flujo real puede ser difícil de encontrar porque existen implementaciones falsas que parecen activas.

---

## 1. MAPA DE RESPONSABILIDADES ACTUALES

### App.js (174 líneas)

| Categoría | Detalle |
|---|---|
| **Responsabilidad de página** | Routing global: detecta URL pública o privada y decide qué renderizar |
| **Navegación** | Estado `page` (string) que controla qué componente de página se monta |
| **Paso de contexto** | `sesionesContext` ({clienteId, sesionId, esPlantilla}) para abrir directamente una sesión específica |
| **Auth** | `supabase.auth.getSession`, listener de cambio de sesión |
| **Menú** | Array `NAV` con 5 entradas; `Tareas` importado pero NO en NAV ni en el switch de renderizado |
| **Estado** | `page`, `clientePlanificacion`, `sesionesContext`, `recargarPlan`, `authLoading`, 8 tokens públicos |
| **Dependencias** | Importa Dashboard, Clientes, Pagos, Planificacion, Sesiones, Biblioteca + 8 páginas públicas |
| **Activo** | Sí, 100% activo |
| **Legado/duplicado** | `CheckIcon` definida al final pero no usada en el menú |

**Cómo se entra:** es el punto de entrada único.  
**Cómo se sale:** no aplica (es la raíz).

---

### Planificacion.jsx (2746 líneas)

| Categoría | Detalle |
|---|---|
| **Responsabilidad de página** | Vista de planificación anual por cliente (timeline, bloques, semanas, sesiones) |
| **Componentes internos** | `VistaLista` (lista de sesiones por semana), múltiples modales inline (nueva sesión, competición, control, bloque, subbloque, semana) |
| **Estados principales** | `clienteSeleccionado`, `planificacion`, `bloques`, `subbloques`, `semanas`, `sesiones`, `competiciones`, `controles`, `notas`, `vista` (timeline/bloques/subbloques/semanas/calendario/seguimiento/lista), `clipboardSesion`, `clipboardSemana`, `openModal`, ~30 estados de formulario |
| **Consultas Supabase** | `clientes`, `planificaciones`, `bloques`, `subbloques`, `semanas`, `sesiones`, `competiciones`, `controles`, `sesion_notas`, `packs_flexibles` |
| **Escrituras Supabase** | INSERT/UPDATE/DELETE en todas las tablas anteriores + INSERT inline en `sesion_bloques`, `sesion_ejercicios`, `sesion_fases`, `sesion_fase_grupos` (solo en `onPegar`) |
| **Funciones de negocio** | `cargarPlanificacion`, `guardarBloque`, `eliminarBloque`, `guardarSubbloque`, `guardarSemana`, `eliminarItem`, `onPegar` (inline, copia completa de sesión) |
| **Funciones de interfaz** | Renderizado de timeline, desplegables de bloques, selector de vistas, modales, colores |
| **Depende de** | `CalendarioSesiones`, `Seguimiento`, `VistaLista` (interno) |
| **Quién depende de él** | `App.js` |
| **Acceso** | Menú lateral → "Plan." → `setPage('planificacion')` |
| **Salida** | `setSesionesContext(...)` + `setPage('sesiones')` para abrir el editor |
| **Activo** | Sí, flujo principal |
| **Legado** | El handler `onPegar` inline mezcla lógica de negocio compleja dentro del JSX — candidato a extraer |

---

### Sesiones.jsx (2743 líneas)

| Categoría | Detalle |
|---|---|
| **Responsabilidad de página** | Editor completo de sesiones (fuerza y carrera) + calendario propio para el cliente |
| **Componentes internos** | `Calendario` (calendario mes/semana propio, ~250 líneas), `InlineInput`, `DiaMenu` |
| **Estados principales** | `clienteSeleccionado`, `sesiones`, `sesionAbierta`, `bloques`, `ejercicios`, `carritoItems` (editor carrera), `clipboardBloque` (sessionStorage), `clipboard` (sesión completa), `modalCrearEj`, `panelBiblioteca`, `dirty`, `avisoSinGuardar`, `packs`, `notas`, `competicionesCal`, `controlesCal`, `bloquesPlan`, `subbloquesPlan`, ~35 estados en total |
| **Consultas Supabase** | `clientes`, `sesiones`, `sesion_notas`, `competiciones`, `controles`, `packs_flexibles`, `planificaciones`, `bloques`, `subbloques`, `sesion_bloques`, `sesion_ejercicios`, `sesion_fases`, `sesion_fase_grupos`, `ejercicios_biblioteca`, `bloques_biblioteca`, `bloques_biblioteca_ejercicios`, `semanas` |
| **Escrituras Supabase** | INSERT/UPDATE/DELETE en casi todas las tablas anteriores |
| **Funciones de negocio** | `cargarSesiones`, `cargarDetalle`, `guardarSesion`, `eliminarSesion`, `pegarSesion` (correcta, con grupos), `duplicarSesion`, `guardarEnBiblioteca`, `guardarEjercicioPersonalizado`, `añadirDesdeBiblioteca`, `pegarDesdePortapapeles`, `guardarBloqueEnBiblioteca`, `reordenarBloques`, `reordenarCarrito`, carrito de carrera completo |
| **Funciones de interfaz** | Editor de fuerza (bloques + ejercicios), editor de carrera (fases + grupos), modal crear ejercicio, panel biblioteca, vista previa cliente, `InlineInput`, drag & drop ejercicios y bloques |
| **Depende de** | `EmojiPicker`, `taxonomia.js`, `clasificarEjercicio.js` |
| **Quién depende de él** | `App.js`, `Biblioteca.jsx` (vía `setSesionesContext`) |
| **Acceso** | Via `setSesionesContext` + `setPage('sesiones')` desde Planificacion o Biblioteca. También puede usarse standalone con `clienteInicial` |
| **Salida** | `volverAlCalendario()` → `setPage('planificacion')` + `setRecargarPlan(r+1)` |
| **Activo** | Sí, editor principal |
| **Legado** | `añadirFase`, `actualizarFase`, `eliminarFase` mantenidas como wrappers de compatibilidad (comentario explícito: "legacy"). El calendario interno (`Calendario`) duplica CalendarioSesiones |

---

### SesionesPlan.jsx (1270 líneas)

| Categoría | Detalle |
|---|---|
| **Responsabilidad declarada** | Editor de sesiones alternativo integrado con el calendario de planificación |
| **Componentes internos** | `InlineInput` (duplicado), `ToggleVisibilidad` (exclusivo) |
| **Usa** | `CalendarioSesiones` (importado y referenciado) |
| **Estados principales** | `sesiones`, `packs`, `packAbierto`, `sesionAbierta`, `bloques`, `ejercicios`, `clipboard`, `clipboardSemana`, `clipboardBloque`, `clipboardLista`, `competiciones`, `controles`, `notas`, `semanasMap`, `semanaSeleccionada`, ~40 estados |
| **Consultas Supabase** | `sesiones`, `competiciones`, `controles`, `sesion_notas`, `packs_flexibles`, `semanas`, `sesion_bloques`, `sesion_ejercicios`, `sesion_fases`, `sesion_fase_grupos` |
| **Escrituras** | INSERT/UPDATE/DELETE en las anteriores + Supabase Storage (upload de archivos) |
| **Funciones de negocio** | `cargarSesiones`, `cargarDetalle`, `guardarSesion`, `pegarSesion`, `pegarItem`, `copiarSemana`, `pegarSemana`, `copiarListaSinFecha`, `pegarListaSinFecha`, `copiarPackAOtroCliente`, `reordenarSinFecha`, `guardarNotaSemana` |
| **Acceso** | **Ninguno**: no está importado en App.js ni en ningún archivo activo |
| **Activo** | ❌ No — código huérfano |

---

### CalendarioSesiones.jsx (413 líneas)

| Categoría | Detalle |
|---|---|
| **Responsabilidad de componente** | Calendario mes/semana reutilizable con menú contextual, tooltip, drag&drop, copy/paste |
| **Componentes internos** | `DiaMenu` (menú "+" por día), `iconoSesion` (función de icono) |
| **Estados** | `vista` (mes/semana), `cursor`, `arrastrando`, `menu`, `tooltip` |
| **Consultas Supabase propias** | `sesion_fases` + `sesion_fase_grupos` (tooltip carrera), `sesion_bloques` + `sesion_ejercicios` (tooltip fuerza), `semanas` (link compartir semana) |
| **Props recibidas** | `sesiones`, `competiciones`, `controles`, `notas`, `bloquesPlan`, `subbloquesPlan`, `packs`, callbacks de acción (onAbrirSesion, onNuevaSesion, onCopiar, onPegar, etc.), `clipboard`, `clipboardSemana` |
| **Quién lo usa** | `Planificacion.jsx` (activo), `SesionesPlan.jsx` (huérfano) |
| **Activo** | Sí, usado por Planificacion.jsx |
| **Mixtura UI/datos** | Sí: hace queries a Supabase directamente para el tooltip y para el link de compartir semana |

---

## 2. FLUJOS REALES DE USUARIO

### A. Entrar en Planificación desde el menú

```
Clic en "Plan." en sidebar
  └── App.js: setPage('planificacion')
        └── React desmonta la página anterior y monta <Planificacion>
              └── Planificacion::useEffect → cargarPlanificacion()
                    └── SELECT clientes, planificaciones, bloques, subbloques, semanas,
                              sesiones, competiciones, controles, notas
```

**Pérdida de estado:** si el usuario estaba en otra página, todo su estado anterior se pierde (sin caché).

---

### B. Seleccionar un cliente

```
Planificacion: <select> cliente
  └── setClienteSeleccionado(id)
        └── setClientePlanificacion(id)  [prop hacia App.js]
              └── cargarPlanificacion() se vuelve a ejecutar con el nuevo clienteId
```

---

### C. Visualizar el calendario

```
Planificacion: vista === 'calendario'
  └── Renderiza <CalendarioSesiones>
        con props: sesiones, competiciones, controles, notas, bloquesPlan, subbloquesPlan
        └── CalendarioSesiones calcula bloqueDeFecha() para cada semana visible
              para mostrar cabeceras de semana con nombre de bloque/subbloque
```

---

### D. Crear una sesión desde Planificación

```
Calendario: clic en "+" del día → "💪 Sesión"
  └── CalendarioSesiones: onNuevaSesion(fecha)
        └── Planificacion: openModal('sesion', { fecha })
              └── setModalSesion({ fecha, clienteId })
                    └── Modal de nueva sesión (inline en Planificacion.jsx)
                          └── "Guardar" → INSERT sesiones
                                └── cargarPlanificacion() para refrescar
```

**Nota:** esta sesión nueva no tiene bloques ni fases creados automáticamente. La sesión queda vacía hasta que se abre en el editor.

---

### E. Abrir una sesión existente

```
Calendario: clic en chip de sesión
  └── CalendarioSesiones: onAbrirSesion(item)
        └── Planificacion: setSesionesContext({ clienteId, sesionId: item.id })
                           setPage('sesiones')
              └── App.js: desmonta Planificacion, monta <Sesiones>
                    con props: clienteInicial, sesionInicialId
                    └── Sesiones: useEffect → cargarSesiones()
                          └── en cargarSesiones():
                                si sesionInicialId → sesionInicialCargada = true
                                setSesionAbierta(sesion encontrada)
                          └── useEffect([sesionAbierta]) → cargarDetalle(sesionAbierta.id)
                                └── SELECT sesion_bloques, sesion_fases, sesion_fase_grupos
```

**Punto de riesgo:** `sesionInicialId` se busca dentro del array `ses` que viene del SELECT. Si `cargarSesiones` no ha terminado cuando el componente monta, la sesión puede no abrirse. El `useRef(sesionInicialCargada)` evita que se abra dos veces, pero si falla la primera vez no hay reintento.

---

### F. Editar una sesión de fuerza

```
Sesiones: sesionAbierta con tipo_editor === 'fuerza' (o null)
  └── Renderiza editor de fuerza:
        bloques[] → para cada bloque:
          InlineInput nombre del bloque
          COLORES picker (clic derecho o selector)
          ejercicios[bloqueId][] → para cada ejercicio:
            InlineInput nombre, series, reps, rpe, notas
            Media (YouTube embed o imagen)
          Botón "+ Ejercicio" → abrirCrearEjercicio(bloqueId)
                                 o abrirBiblioteca(bloqueId)
        Botón "+ Bloque" → añadirBloque()
```

Cada cambio en `InlineInput` dispara `actualizarEjercicio(bloqueId, id, campo, valor)` con debounce de 700ms → UPDATE inmediato en Supabase.

---

### G. Editar una sesión de resistencia (carrera)

```
Sesiones: sesionAbierta con tipo_editor === 'carrera'
  └── Renderiza editor de carrera (carritoItems):
        carritoItems[] (mezcla de fases sueltas y grupos):
          si type === 'fase':
            Bloque suelto: nombre, descripcion, volumen, fc_zona, ritmo, rpe
            Botones: duplicar, copiar, eliminar
          si type === 'grupo':
            Cabecera grupo: "−" repeticiones "+"
            Para cada fase del grupo:
              Igual que bloque suelto
              + botón eliminar fase del grupo
              + botón añadir fase al grupo
            Botones grupo: duplicar, copiar, eliminar
        Botón "+ Bloque suelto" → añadirBloqueSuelto()
        Botón "+ Grupo" → añadirGrupoCarrera()
```

Cada cambio llama a `actualizarBloqueCarrito(id, campo, valor, grupoId)` → UPDATE en `sesion_fases`.

---

### H. Guardar una sesión

El modelo de guardado en Sesiones.jsx es **optimista y continuo**: cada campo se guarda al instante en Supabase mediante `actualizarEjercicio` / `actualizarBloqueCarrito` / `actualizarBloque`. El botón "Guardar" no hace ninguna escritura adicional: solo limpia el flag `dirty` y muestra "✓ Guardado". El aviso "cambios sin guardar" es cosmético — los cambios ya están en la base de datos.

**Confusión potencial**: el usuario ve "⚠️ Tienes cambios sin guardar" pero los datos ya están guardados. El flag `dirty` rastrea si algo se ha modificado desde la última vez que se pulsó "Guardar", no si hay datos sin persistir.

---

### I. Volver desde Sesiones a Planificación

```
Sesiones: clic en "← Volver"
  └── if (dirty) → setAvisoSinGuardar(true)
        (muestra aviso "tienes cambios sin guardar")
  └── else → volverAlCalendario()
        └── localStorage.setItem('planVista', 'calendario')
              setRecargarPlan(r => r + 1)   [prop hacia App.js → Planificacion]
              setClientePlanificacion(clienteSeleccionado)
              setPage('planificacion')
```

**Punto de riesgo:** `recargarPlan` se incrementa en App.js y Planificacion lo recibe como prop. Planificacion tiene un `useEffect([recargarPlan])` que llama a `cargarPlanificacion()`. Si Planificacion se remonta desde cero (desmontaje/montaje por cambio de `page`), el `useEffect` del montaje ya carga los datos y el `recargarPlan` podría disparar una carga doble.

---

### J. Copiar o duplicar una sesión

**Flujo real (Planificacion → CalendarioSesiones):**
```
Calendario: clic derecho → "📋 Copiar"
  └── CalendarioSesiones: onCopiar(item)
        └── Planificacion: setClipboardSesion(item)
Calendario: clic derecho en otro día → "📌 Pegar aquí"
  └── CalendarioSesiones: onPegar(clipboard, fecha)
        └── Planificacion: onPegar inline (~línea 1773)
              1. INSERT sesiones
              2. INSERT sesion_bloques + sesion_ejercicios
              3. INSERT sesion_fase_grupos (con gruposMap)
              4. INSERT sesion_fases (con grupo_id correcto)
              5. cargarPlanificacion()
```
**Limitación:** no permite pegar en otro cliente desde este flujo.

**Flujo alternativo (Sesiones → Calendario interno):**
```
Calendario interno: clic derecho → "📋 Copiar sesión"
  └── setClipboard(item)
Calendario: "📌 Pegar aquí" o "Pegar en [cliente]"
  └── pegarSesion(item, fecha, clienteDestino)
        → misma lógica pero con soporte multi-cliente
```
Este flujo sí permite copiar a otro cliente.

**Duplicar** (solo desde Sesiones):
```
Botón "📋 Duplicar" en barra superior
  └── setModalDuplicar(sesionAbierta)
        Modal con fecha → duplicarSesion(s, fechaDestino)
              → igual que pegarSesion pero mismo cliente, título + " (copia)"
```

---

### K. Acceder a una sesión desde Biblioteca

```
Biblioteca.jsx
  └── Tab "Sesiones" → BibliotecaSesiones.jsx
        └── Clic en sesión plantilla
              └── Biblioteca: setSesionesContext({ sesionId, esPlantilla: true })
                              setPage('sesiones')
                    └── Sesiones monta con esPlantilla=true
                          useEffect → SELECT sesion WHERE id = sesionInicialId
                          setSesionAbierta(data)
                          (sin cliente, sesión plantilla con cliente_id = null)
```

---

### L. Acceder al calendario interno de Sesiones.jsx

```
Sesiones: !sesionAbierta && clienteSeleccionado
  └── Renderiza <Calendario> (componente interno, línea 94)
        → calendario propio con sesiones del cliente
        → al hacer clic en sesión: setSesionAbierta(item)
        → al crear: abrirNuevaSesion() → modal → guardarSesion()
```

Este calendario **sí es accesible** cuando se entra en Sesiones.jsx sin `sesionInicialId`, o cuando se cierra la sesión abierta dentro del editor.

---

## 3. COMPARACIÓN ENTRE LOS DOS CALENDARIOS

### Tabla comparativa

| Funcionalidad | `Calendario` (interno Sesiones.jsx) | `CalendarioSesiones.jsx` (componente externo) |
|---|---|---|
| **Dónde se usa** | Solo dentro de `Sesiones.jsx` | Solo desde `Planificacion.jsx` (SesionesPlan también lo importa, pero es huérfano) |
| **Vista mes/semana** | ✅ Sí | ✅ Sí |
| **Cabeceras de semana** | ✅ Sí (bloque + subbloque) | ✅ Sí (bloque + subbloque + dot de comentario + link compartir + copiar/pegar semana) |
| **Crear sesión** | ✅ Sí (modal propio → `guardarSesion`) | ✅ Sí (callback `onNuevaSesion` → lógica en Planificacion) |
| **Abrir sesión** | ✅ Sí → `setSesionAbierta` (mismo componente) | ✅ Sí → `onAbrirSesion` → navega a Sesiones.jsx |
| **Crear competición** | ✅ Sí (modal propio) | ✅ Sí (callback `onNuevaCompeticion`) |
| **Crear nota** | ✅ Sí (modal propio) | ✅ Sí (callback `onNuevaNota`) |
| **Crear valoración/control** | ❌ No | ✅ Sí (callback `onNuevaValoracion`) |
| **Copiar elemento** | ✅ Sí (solo sesiones, menú contextual) | ✅ Sí (cualquier tipo de elemento) |
| **Pegar en mismo cliente** | ✅ Sí → `pegarSesion()` (correcta, con grupos) | ✅ Sí → `onPegar` inline (corregido) |
| **Pegar en otro cliente** | ✅ Sí (menú contextual con lista de clientes) | ❌ No (solo mismo cliente; `onPegarOtroCliente` existe pero no implementado) |
| **Copiar semana entera** | ❌ No | ✅ Sí (con `onCopiarSemana` / `onPegarSemana`) |
| **Drag & drop sesiones** | ✅ Sí (`onMoverItem`) | ✅ Sí (`onMoverSesion`) |
| **Tooltip al hover** | ❌ No | ✅ Sí (con fases agrupadas y bloques) |
| **Iconos de sesión** | ⚠️ Solo "💪" hardcoded (línea 298) | ✅ `iconoSesion()` completa (lee `tipos_actividad`, `icono`) |
| **Packs flexibles** | ✅ Muestra franja de pack | ✅ Muestra franja de pack |
| **Seleccionar semana** | ❌ No | ✅ Sí (panel lateral con notas de semana) |
| **Consultas Supabase propias** | ❌ No (recibe datos como props) | ✅ Sí (tooltip, link semana) |
| **Acceso a lista de clientes** | ✅ Sí (para pegar en otro cliente) | ❌ No |

### Respuestas

**1. ¿Ambos calendarios son necesarios?**  
No. Las funcionalidades están duplicadas casi al 100%, con pequeñas diferencias. El calendario interno de Sesiones.jsx es más antiguo y menos completo (sin tooltip, sin copiar semana, sin valoraciones, con ícono hardcodeado).

**2. ¿Uno puede sustituir al otro?**  
`CalendarioSesiones.jsx` puede sustituir al `Calendario` interno de Sesiones.jsx con algunos ajustes (principalmente: añadir soporte para pegar en otro cliente con lista de clientes). No al revés.

**3. ¿Cuál es el calendario principal actual?**  
`CalendarioSesiones.jsx`. Es el que usa el flujo habitual de trabajo (menú → Plan. → calendario).

**4. ¿Qué riesgo existe al mantener los dos?**  
- Bugs arreglados en uno no se propagan al otro.  
- Comportamientos distintos para la misma acción (el icono de sesión de resistencia es "💪" en el calendario de Sesiones, correcto en CalendarioSesiones).  
- Mayor superficie de mantenimiento.  
- Confusión sobre cuál es "el bueno" al leer el código.

**5. ¿Qué funcionalidades habría que conservar si se unificasen?**  
Del calendario interno de Sesiones.jsx: **solo** la capacidad de pegar en otro cliente con menú de lista de clientes. Todo lo demás ya existe en CalendarioSesiones.jsx o es más completo allí.

---

## 4. COMPARACIÓN SESIONES.JSX vs SesionesPlan.jsx

### Tabla comparativa

| Aspecto | `Sesiones.jsx` | `SesionesPlan.jsx` |
|---|---|---|
| **Accesible** | ✅ Sí | ❌ No (huérfano) |
| **Líneas** | 2743 | 1270 |
| **Campo tipo sesión** | `tipo_editor: 'fuerza'/'carrera'` | `tipo_actividad: 'fuerza'/'correr'/...` + `tipos_actividad: []` |
| **Editor de fuerza** | ✅ Completo (InlineInput, drag ejercicios, drag bloques) | ✅ Completo (InlineInput, drag ejercicios, drag bloques, reordenación persistida) |
| **Editor de carrera** | ✅ Completo (carritoItems, grupos, repeticiones, reordenación) | ❌ No existe |
| **Calendario** | ✅ Interno propio (`Calendario` en línea 94) | ✅ Usa `CalendarioSesiones` (componente externo) |
| **Crear sesión** | Modal con `tipo_editor` | Modal con `tipo_actividad` + `tipos_actividad[]` |
| **Copiar sesión** | `pegarSesion(s, fecha, clienteDestino)` — con grupos carrera | `pegarSesion(s, fecha, clienteDestino)` — con grupos carrera |
| **Pegar en otro cliente** | ✅ Sí (menú contextual con lista) | ✅ Sí (modal explícito `modalPegarOtro`) |
| **Duplicar sesión** | ✅ Sí (modal con fecha) | ❌ No (no implementado) |
| **Copiar semana** | ❌ No | ✅ Sí (`copiarSemana`, `pegarSemana`) |
| **Copiar semana a otro cliente** | ❌ No | ✅ Sí (modal `modalPegarSemanaOtro`) |
| **Packs flexibles** | ✅ Sí (CRUD básico + compartir) | ✅ Sí (CRUD completo + desplegable + copiar a otro cliente) |
| **Copiar pack a otro cliente** | ❌ No | ✅ Sí (`copiarPackAOtroCliente`) |
| **Lista de sesiones sin fecha** | ✅ Sí (chips) | ✅ Sí (chips con drag & drop) |
| **Copiar lista sin fecha** | ❌ No | ✅ Sí (`copiarListaSinFecha`, `pegarListaSinFecha`) |
| **Biblioteca de ejercicios** | ✅ Sí (panel lateral, buscar, filtrar por taxonomía) | ❌ No |
| **Biblioteca de bloques** | ✅ Sí (cargar bloque completo desde biblioteca) | ❌ No |
| **Modal crear ejercicio** | ✅ Sí (con taxonomía, media, clasificación automática) | ❌ No |
| **Guardar sesión en biblioteca** | ✅ Sí | ❌ No |
| **Vista previa cliente** | ✅ Sí (`vistaPrevia` flag) | ❌ No |
| **Compartir enlace sesión** | ✅ Sí (token_publico) | ✅ Sí |
| **Subida de archivos (media)** | ✅ Sí (Supabase Storage) | ✅ Sí (Supabase Storage, más completo: gif, video, imagen) |
| **Notas de semana** | ❌ No | ✅ Sí (panel lateral con autosave) |
| **Selección de semana** | ❌ No | ✅ Sí |
| **Portapapeles de bloques** | ✅ Sí (sessionStorage, cross-session) | ✅ Sí (estado local, no persistido) |
| **Reordenación de bloques** | ✅ Sí (drag & drop con persistencia) | ✅ Sí (drag & drop con persistencia) |
| **Reordenación de ejercicios** | ✅ Sí | ✅ Sí (+ reordenación en DB al eliminar) |
| **`ToggleVisibilidad`** | ❌ No | ✅ Exclusivo — permite marcar visibilidad entrenadora/cliente |
| **Importa** | `EmojiPicker`, `taxonomia.js`, `clasificarEjercicio.js` | `CalendarioSesiones`, `EmojiPicker` |

### Respuestas razonadas

**1. ¿SesionesPlan.jsx parece una versión antigua, experimental o módulo futuro?**  
Ni antigua ni experimental: es una versión **más avanzada** en algunas áreas específicas (packs, semanas, copy/paste multi-cliente, visibilidad) que se desarrolló **en paralelo** a Sesiones.jsx. Sin embargo, le falta el editor de carrera completo y toda la capa de biblioteca. Parece que fue el intento de integrar el editor directamente dentro de Planificacion (como sub-componente con `clienteId` como prop, en lugar de navegar a otra página), pero nunca se conectó.

**2. ¿Hay alguna funcionalidad exclusiva de SesionesPlan.jsx que no exista en Sesiones.jsx?**  
Sí, varias importantes:
- **Copiar semana entera** a otro cliente
- **Copiar lista de sesiones sin fecha** a otro cliente
- **Copiar pack completo** a otro cliente
- **`ToggleVisibilidad`** (marcar si sesión/competición/nota es visible para cliente o solo entrenadora)
- **Panel de notas de semana** (comentario por semana visible en el calendario)
- **Drag & drop de sesiones sin fecha** para reordenarlas

**3. ¿Hay alguna referencia dinámica o indirecta que pueda hacer que sí se ejecute?**  
No. Búsqueda exhaustiva en el código: SesionesPlan.jsx solo aparece en su propia declaración `export default function SesionesPlan`. No hay ningún `import`, `lazy`, `require`, ni referencia dinámica de cadena que pueda activarlo.

**4. ¿Qué habría que comprobar antes de archivarlo o eliminarlo?**  
- Confirmar que `ToggleVisibilidad` (visibilidad entrenadora/cliente) no está usando la columna `visibilidad` en las tablas de Supabase para algo que la app ya muestra en otro sitio.
- Confirmar que `notas de semana` sí se pueden editar desde Planificacion.jsx (lo son: vía `CalendarioSesiones` + `onSemanaClick` + panel en Planificacion).
- Confirmar que ninguna URL pública o webhook apunta a una ruta que cargue SesionesPlan.jsx.

**5. ¿Qué riesgo tiene dejarlo en su ubicación y nombre actuales?**  
Alto. Cualquier desarrollador nuevo (o yo misma en 6 meses) puede encontrarlo, modificarlo, y pasar horas sin entender por qué los cambios no tienen efecto. También ocupa 1270 líneas de contexto mental que hay que descartar cada vez que se busca algo en el código.

---

## 5. LÓGICA DE NEGOCIO DUPLICADA

| Operación | Sesiones.jsx | Planificacion.jsx | SesionesPlan.jsx | Cuál es la activa | Cuál es la más completa | Riesgo |
|---|---|---|---|---|---|---|
| **Crear sesión** | `guardarSesion()` — con tipo_editor, fuerza: 4 bloques, carrera: 3 fases | Modal inline — sin bloques iniciales | `guardarSesion()` — con tipo_actividad | Sesiones.jsx (para sesiones editables); Planificacion.jsx (para añadir al calendario) | Sesiones.jsx | Sesiones creadas desde Planificacion quedan vacías (sin bloques/fases) |
| **Guardar sesión** | `guardarSesion()` | No aplica (INSERT puro) | `guardarSesion()` | Sesiones.jsx | Sesiones.jsx | — |
| **Cargar sesión** | `cargarDetalle()` — bloques, fases, grupos, ejercicios | No | `cargarDetalle()` — solo bloques y ejercicios (sin fases/grupos) | Sesiones.jsx | Sesiones.jsx | SesionesPlan no carga fases/grupos |
| **Copiar sesión** | `pegarSesion()` — fuerza + carrera con grupos | `onPegar` inline — fuerza + carrera con grupos (fix reciente) | `pegarSesion()` — fuerza + carrera con grupos | Planificacion.jsx (flujo habitual) y Sesiones.jsx (flujo editor) | Sesiones.jsx (más campos copiados: peso, distancia, altura, etc.) | Sesiones.jsx copia más campos de ejercicio que Planificacion.jsx |
| **Duplicar sesión** | `duplicarSesion()` — copia completa con grupos | No | No | Sesiones.jsx | Sesiones.jsx | Solo accesible desde el editor, no desde el calendario de Planificacion |
| **Mover sesión** | `onMoverItem()` → UPDATE fecha | `onMoverSesion()` → UPDATE fecha | `moverItem()` → UPDATE fecha | Todos activos según flujo | Equivalentes | — |
| **Crear bloque fuerza** | `añadirBloque()` | No | `añadirBloque()` | Sesiones.jsx | Sesiones.jsx | — |
| **Copiar bloque** | `copiarBloqueFuerza()` → sessionStorage | `copiarBloque()` → estado local | Ambos | Sesiones.jsx es el activo | Sesiones.jsx (persiste en sessionStorage) | Dos sistemas de portapapeles de bloque incompatibles |
| **Crear grupo carrera** | `añadirGrupoCarrera()` | No | No | Sesiones.jsx | Sesiones.jsx | — |
| **Guardar fases** | `actualizarBloqueCarrito()` → UPDATE inmediato | INSERT en onPegar | INSERT en onPegar | Sesiones.jsx (edición), Planificacion.jsx (copia) | Sesiones.jsx | — |
| **Cargar grupos** | `cargarDetalle()` — lee fase_grupos + fases + construye carritoItems | No | `cargarDetalle()` — no lee grupos | Sesiones.jsx | Sesiones.jsx | — |
| **Abrir sesión** | `setSesionAbierta(item)` (interno) | `onAbrirSesion` → `setSesionesContext` + `setPage` | `setSesionAbierta(item)` (interno) | Planificacion usa setPage; Sesiones usa estado interno | — | Dos modelos de navegación distintos |
| **Volver al calendario** | `volverAlCalendario()` → setPage + setRecargarPlan | No aplica | No aplica | Sesiones.jsx | Sesiones.jsx | — |
| **Determinar tipo de sesión** | `tipo_editor: 'fuerza'/'carrera'` | Lee `tipo_editor` para onPegar | `tipo_actividad: 'fuerza'/'correr'/...` | Ambos campos coexisten en la tabla `sesiones` | Ver sección 6 | — |
| **Icono de sesión** | Hardcoded "💪" en Calendario interno (línea 298) | Usa `iconoSesion()` via CalendarioSesiones | `iconoSesion()` completa (usa tipos_actividad) | CalendarioSesiones::iconoSesion | CalendarioSesiones | Sesiones.jsx muestra icono incorrecto para sesiones de carrera en su propio calendario |

---

## 6. ANÁLISIS DE tipo_editor, tipo_actividad Y tipos_actividad

### Dónde se lee cada campo

| Campo | Lee | Escribe |
|---|---|---|
| `tipo_editor` | Sesiones.jsx (decide qué editor renderizar), CalendarioSesiones.jsx (decide tooltip), Planificacion.jsx (`onPegar` al copiar), SesionesPlan.jsx (`pegarSesion`) | Sesiones.jsx (`guardarSesion`, `EMPTY_SESION`), Planificacion.jsx (`onPegar` al copiar: `item.tipo_editor || 'fuerza'`) |
| `tipo_actividad` | SesionesPlan.jsx (icono, guardar, pegar), CalendarioSesiones.jsx (iconoSesion fallback) | SesionesPlan.jsx (`guardarSesion`, `pegarSesion`) |
| `tipos_actividad` | SesionesPlan.jsx (icono, guardar, pegar), CalendarioSesiones.jsx (`iconoSesion` — primera lectura) | SesionesPlan.jsx (`guardarSesion`, `pegarSesion`) |

### Valores que aparecen

| Campo | Valores posibles |
|---|---|
| `tipo_editor` | `'fuerza'` \| `'carrera'` \| `null` |
| `tipo_actividad` | `'fuerza'` \| `'correr'` \| `'caminar'` \| `'bicicleta'` \| `'nadar'` \| `'movilidad'` \| `'futbol'` \| `'padel'` |
| `tipos_actividad` | Array de los mismos valores que `tipo_actividad` |

### Qué decisiones dependen de cada campo

| Campo | Decisiones de interfaz |
|---|---|
| `tipo_editor` | **Crítico**: decide si se renderiza el editor de fuerza o el editor de carrera en Sesiones.jsx. También decide qué tooltip mostrar en CalendarioSesiones.jsx. |
| `tipo_actividad` | Icono en SesionesPlan.jsx y CalendarioSesiones.jsx (fallback). Guardado al copiar sesiones desde SesionesPlan. |
| `tipos_actividad` | Icono en CalendarioSesiones.jsx (prioridad sobre tipo_actividad). Permite sesiones multi-actividad. |

### ¿Son conceptos distintos o duplicados?

Parcialmente duplicados. `tipo_editor` controla el **modo de edición** (fuerza vs carrera). `tipo_actividad` y `tipos_actividad` controlan el **icono y la categoría** de la sesión (pueden ser más granulares: caminar, padel, fútbol). Una sesión de "correr" y una de "caminar" usarían `tipo_editor: 'carrera'` pero `tipo_actividad` distinto.

Sin embargo, en la práctica actual, Sesiones.jsx solo maneja `tipo_editor` y no escribe `tipo_actividad`. Una sesión creada desde Sesiones.jsx tendrá `tipo_editor: 'carrera'` pero `tipo_actividad: null` y `tipos_actividad: null`.

### ¿Qué ocurre si faltan o contienen valores contradictorios?

- `tipo_editor = null`: Sesiones.jsx lo trata como `'fuerza'` por defecto (fallback `|| 'fuerza'`). CalendarioSesiones también: sin `tipo_editor === 'carrera'` muestra tooltip de fuerza.
- `tipo_editor = 'carrera'` + `tipo_actividad = null`: CalendarioSesiones muestra icono "💪" (fallback). La sesión funciona correctamente en el editor.
- `tipo_editor = 'fuerza'` + `tipo_actividad = 'correr'`: el editor muestra el modo fuerza pero el icono muestra "🏃". Inconsistencia visual.
- `tipos_actividad = ['correr']` + `tipo_editor = null`: el icono es "🏃" pero el editor es de fuerza. Confuso.

### ¿Qué campo parece ser el principal?

`tipo_editor` para el flujo activo (Sesiones.jsx + CalendarioSesiones.jsx). `tipos_actividad` para el flujo huérfano (SesionesPlan.jsx).

### Compatibilidad con sesiones antiguas

Las sesiones creadas desde SesionesPlan.jsx (si las hubiera en producción) tienen `tipo_actividad` y `tipos_actividad` pero pueden carecer de `tipo_editor`. El fallback `|| 'fuerza'` las abrirá en modo fuerza aunque sean de carrera. Esto es un riesgo real si hay datos históricos.

---

## 7. PROPUESTA DE ARQUITECTURA OBJETIVO

### Principio guía

No reescribir. Reorganizar gradualmente. Cada fase debe mantener el comportamiento actual.

### Estructura propuesta

```
src/
  pages/
    Planificacion.jsx        → conservar, reducir tamaño extrayendo lógica
    Sesiones.jsx             → conservar, reducir tamaño extrayendo lógica
    SesionesPlan.jsx         → mover a src/_legado/ con comentario visible
    [otras páginas actuales sin cambios]

  components/
    CalendarioSesiones.jsx   → conservar, añadir soporte multi-cliente
    FeedbackForm.jsx         → sin cambios
    GraficaCarga.jsx         → sin cambios
    PanelFuerzaSalud.jsx     → sin cambios
    EmojiPicker.jsx          → sin cambios

  features/
    sesiones/
      useCopiarSesion.js     → hook: lógica de pegar/duplicar sesión (actualmente inline en Planificacion y en Sesiones)
      useCarritoCarrera.js   → hook: estado y operaciones del carrito de carrera (actualmente en Sesiones.jsx)
      usePortapapelesBloque.js → hook: portapapeles de bloque (sessionStorage, actualmente en Sesiones.jsx)

  lib/
    supabase.js              → sin cambios
    taxonomia.js             → sin cambios
    clasificarEjercicio.js   → sin cambios
    export.js                → sin cambios

  hooks/
    useGenerarPagosMensuales.js → sin cambios
```

### Responsabilidades por módulo

| Módulo | Responsabilidad | Código origen | Prioridad |
|---|---|---|---|
| `features/sesiones/useCopiarSesion.js` | Una sola implementación de copiar sesión (con grupos carrera, multi-cliente, todos los campos) | Extraer de Sesiones.jsx::pegarSesion + Planificacion.jsx::onPegar | Alta |
| `features/sesiones/useCarritoCarrera.js` | Estado y operaciones del carrito de carrera (añadir, eliminar, reordenar, actualizar fases/grupos) | Extraer de Sesiones.jsx líneas 652-776 | Media |
| `features/sesiones/usePortapapelesBloque.js` | Portapapeles de bloques con sessionStorage | Extraer de Sesiones.jsx líneas 439-503 | Baja |
| `CalendarioSesiones.jsx` | Añadir prop `clientes` para soportar pegar en otro cliente desde Planificacion | Tomar del calendario interno de Sesiones.jsx | Media |
| `src/_legado/SesionesPlan.jsx` | Código de referencia, no activo | Mover sin modificar | Inmediato |

---

## 8. QUÉ DEBE QUEDARSE EN CADA PÁGINA

### Planificacion.jsx debe conservar:
- Selección de cliente
- Todas las vistas (timeline, bloques, subbloques, semanas, lista, seguimiento)
- Carga de `planificaciones`, `bloques`, `subbloques`, `semanas`
- Renderizado de `<CalendarioSesiones>` con sus props
- Modales de gestión de planificación (nuevo bloque, nuevo subbloque, nueva semana, nueva competición)
- `onCopiar` / `setClipboardSesion`
- Gestión de semanas con comentario

### Planificacion.jsx debe delegar:
- La lógica compleja de `onPegar` inline → extraer a `useCopiarSesion` (hook compartido)
- El modal de nueva sesión podría simplificarse si Sesiones.jsx lo maneja

### Sesiones.jsx debe conservar:
- El editor de fuerza (bloques, ejercicios, InlineInput, drag & drop)
- El editor de carrera (carritoItems, fases, grupos)
- El modal de crear ejercicio personalizado
- El panel de biblioteca (ejercicios + bloques)
- `pegarSesion`, `duplicarSesion`
- `guardarEnBiblioteca`
- `volverAlCalendario`
- Gestión de packs (CRUD básico)

### Sesiones.jsx debe delegar:
- El componente `Calendario` interno → sustituir por `CalendarioSesiones` (requiere añadir soporte de lista de clientes para pegar en otro cliente)
- El hook `useCarritoCarrera` → extraer como feature separado
- `pegarSesion` → unificar con `useCopiarSesion`

### CalendarioSesiones.jsx debe conservar:
- Toda su funcionalidad actual
- La lógica de tooltip (con grupos y fases)
- La lógica de copiar/pegar semana
- La cabecera de semana con link compartir

### CalendarioSesiones.jsx debe dejar de hacer:
- Hacer consultas a Supabase directamente para el tooltip (debería recibir los datos como props o usar un hook dedicado)
- Depender de `supabase` importado directamente — debería recibir un callback de datos

### App.js debe conservar:
- La detección de URL públicas
- El routing por estado `page`
- El paso de `sesionesContext` entre páginas

### App.js debe delegar:
- Cuando haya muchas páginas, mover el routing a un array de configuración en lugar de condicionales inline

### SesionesPlan.jsx debe:
**Marcarse como legado y moverse a `src/_legado/`.**

Justificación: tiene funcionalidades únicas que pueden ser valiosas de recuperar (copiar semana a otro cliente, copiar pack, lista sin fecha, toggle visibilidad), pero al estar sin conexión y con un modelo de datos diferente (`tipo_actividad` vs `tipo_editor`), si se conecta tal cual rompería el flujo actual. Lo correcto es moverlo como referencia, extraer las funcionalidades únicas que se quieran recuperar (en fases independientes), y eliminarlo en una limpieza posterior.

---

## 9. PLAN DE REFACTORIZACIÓN GRADUAL

### Fase R1 — Marcar y aislar código legado (inmediata, 0 riesgo)

**Objetivo:** eliminar confusión sobre qué código está activo.  
**Archivos afectados:** `src/pages/SesionesPlan.jsx`, nueva carpeta `src/_legado/`  
**Cambios:** mover SesionesPlan.jsx a `src/_legado/SesionesPlan.jsx`, añadir comentario en la primera línea: `// LEGADO: este archivo no está conectado a ninguna ruta activa. Referencia de funcionalidades no migradas.`  
**Riesgos:** ninguno (el archivo no está importado en ningún sitio)  
**Pruebas manuales:** comprobar que la app compila y funciona igual que antes  
**Criterio de fin:** npm run build sin errores, archivo en nueva ubicación

---

### Fase R2 — Unificar la lógica de copiar sesión (corto plazo, riesgo bajo)

**Objetivo:** una sola implementación correcta de copiar/pegar sesión, compartida entre Planificacion.jsx y Sesiones.jsx.  
**Archivos afectados:** nuevo `src/features/sesiones/useCopiarSesion.js`, `Planificacion.jsx`, `Sesiones.jsx`  
**Cambios:**
1. Crear `useCopiarSesion.js` con la función `copiarSesion(sesionOrigen, fechaDestino, clienteDestino)` — tomando lo mejor de ambas implementaciones (campos de ejercicio completos de Sesiones.jsx + manejo de error de Planificacion.jsx)
2. En `Planificacion.jsx`: reemplazar el bloque `onPegar` inline por una llamada al hook
3. En `Sesiones.jsx`: reemplazar `pegarSesion` por una llamada al hook  
**Riesgos:** la función compartida debe cubrir todos los campos de ejercicio que copia cada versión actual  
**Pruebas manuales:** copiar sesión fuerza, resistencia con grupos, desde Planificacion y desde Sesiones  
**Criterio de fin:** un solo punto de verdad para la copia, ambas páginas compilando y funcionando

---

### Fase R3 — Sustituir el calendario interno de Sesiones.jsx (corto plazo, riesgo medio)

**Objetivo:** eliminar el componente `Calendario` duplicado dentro de Sesiones.jsx, usar `CalendarioSesiones.jsx` también allí.  
**Archivos afectados:** `Sesiones.jsx`, `CalendarioSesiones.jsx`  
**Cambios previos necesarios:** añadir a `CalendarioSesiones` la prop `clientes` y lógica de menú contextual "Pegar en otro cliente" (funcionalidad que hoy solo tiene el Calendario interno)  
**Riesgos:** el calendario interno tiene sutiles diferencias (ícono hardcoded, sin tooltip, sin copiar semana). Al sustituirlo, el tooltip aparecerá por primera vez en la vista de Sesiones — esto es una mejora, no un riesgo. El ícono hardcoded "💪" desaparecerá y se mostrará el correcto.  
**Pruebas manuales:** desde Sesiones.jsx, crear sesión, abrir sesión, copiar sesión a otro cliente, mover sesión  
**Criterio de fin:** componente `Calendario` eliminado de Sesiones.jsx, CalendarioSesiones usado en su lugar

---

### Fase R4 — Extraer el carrito de carrera a un hook (medio plazo, riesgo bajo)

**Objetivo:** separar la lógica del editor de carrera del componente Sesiones.jsx.  
**Archivos afectados:** nuevo `src/features/sesiones/useCarritoCarrera.js`, `Sesiones.jsx`  
**Cambios:** extraer estado y funciones del carrito (líneas 652-776 de Sesiones.jsx) a un hook reutilizable  
**Riesgos:** bajo — cambio de organización sin cambiar comportamiento  
**Pruebas manuales:** editor carrera completo: añadir bloque suelto, añadir grupo, cambiar repeticiones, reordenar, copiar grupo  
**Criterio de fin:** Sesiones.jsx más pequeño, funcionalidad idéntica

---

### Fase R5 — Unificar campo tipo_editor / tipo_actividad (medio plazo, riesgo medio)

**Objetivo:** un solo campo para determinar el tipo de sesión, con migración de datos existentes.  
**Archivos afectados:** Sesiones.jsx, CalendarioSesiones.jsx, posible migración SQL  
**Cambios:** definir `tipo_editor` como el campo único. Para sesiones con `tipo_actividad` pero sin `tipo_editor`, inferir `tipo_editor` ('correr' → 'carrera', demás → 'fuerza')  
**Riesgos:** datos históricos en Supabase — requiere verificar cuántas sesiones tienen `tipo_actividad` pero no `tipo_editor`  
**Pruebas manuales:** sesiones antiguas abren en el editor correcto  
**Criterio de fin:** código no lee `tipo_actividad` para decidir el editor

---

### Fase R6 — Reducir Planificacion.jsx y Sesiones.jsx (largo plazo)

**Objetivo:** bajar ambos archivos de ~2700 líneas a un tamaño manejable (~800-1200 líneas cada uno).  
**Método:** extraer los ~15 modales inline de Planificacion.jsx a componentes separados; extraer el editor de fuerza y el de carrera de Sesiones.jsx a componentes separados.  
**Riesgos:** alto — cambios de JSX grandes pueden introducir bugs de renderizado  
**Dependencia:** requiere R2 y R4 completadas

---

## 10. PRIORIDADES

| Prioridad | Tarea | Impacto | Riesgo | Dificultad | Archivos afectados | Depende de |
|---|---|---|---|---|---|---|
| **Inmediata** | R1: mover SesionesPlan a _legado | Alto (claridad) | Ninguno | Baja | SesionesPlan.jsx | — |
| **Corto plazo** | R2: unificar lógica de copiar sesión | Alto (calidad) | Bajo | Media | Sesiones.jsx, Planificacion.jsx, nuevo hook | R1 |
| **Corto plazo** | R3: sustituir Calendario interno | Medio (calidad) | Medio | Media | Sesiones.jsx, CalendarioSesiones.jsx | R2 |
| **Corto plazo** | Recuperar funcionalidades de SesionesPlan útiles (copiar semana a otro cliente, toggle visibilidad) | Alto (funcional) | Bajo | Media | Planificacion.jsx o CalendarioSesiones.jsx | R1 |
| **Medio plazo** | R4: extraer hook carrito de carrera | Medio (organización) | Bajo | Media | Sesiones.jsx | R2, R3 |
| **Medio plazo** | R5: unificar tipo_editor / tipo_actividad | Medio (corrección) | Medio | Media-alta | Sesiones.jsx, Supabase | R3 |
| **No prioritaria** | R6: reducir tamaño de archivos grandes | Medio (organización) | Alto | Alta | Sesiones.jsx, Planificacion.jsx | R2, R3, R4 |
| **No prioritaria** | Quitar queries directas de CalendarioSesiones | Bajo | Bajo | Baja | CalendarioSesiones.jsx | — |

---

## 11. PREGUNTAS PARA EL USUARIO

Antes de ejecutar cualquier refactorización, necesito que respondas estas preguntas. No son técnicas — son sobre cómo quieres que funcione la app.

**Sobre el flujo de trabajo:**

1. Cuando estás en el calendario de un cliente (vista "Plan."), ¿alguna vez necesitas copiar una sesión a otro cliente? ¿O esa operación siempre la haces desde la vista de "Sesiones"?

2. ¿Usas el calendario que aparece dentro de la vista "Sesiones" (cuando no tienes ninguna sesión abierta), o siempre entras en las sesiones desde "Plan."?

3. ¿Alguna vez copias una semana entera de un cliente a otro (por ejemplo, la semana de Blanca Plana a Maite Lavin)? Esta funcionalidad existe en el código pero actualmente no es accesible.

4. ¿Usas o necesitarías el "toggle de visibilidad" (marcar si una sesión, nota o competición es visible solo para ti o también para el cliente)? Esta funcionalidad también existe en el código pero no es accesible.

5. ¿Existe alguna diferencia entre una sesión de "correr" y una de "caminar" o "bicicleta" en cuanto al tipo de ejercicios que les pones? ¿O todas las sesiones de resistencia usan el mismo editor de fases/grupos?

**Sobre el editor:**

6. ¿Quieres mantener un calendario dentro del editor de sesiones (como el que aparece al entrar en "Sesiones" sin abrir ninguna), o prefieres gestionar siempre el calendario desde "Plan."?

7. Cuando creas una sesión desde el calendario de "Plan.", la sesión queda vacía (sin bloques ni fases). ¿Prefieres que se abra directamente en el editor para empezar a rellenarla, o está bien que quede creada en el calendario y la abras cuando quieras?

**Sobre la arquitectura:**

8. ¿Hay alguna funcionalidad que hayas echado de menos y que ahora no encuentres en la app? (Puede que esté implementada en el código huérfano y sea recuperable).

---

## 12. RECOMENDACIÓN FINAL

La aplicación funciona correctamente para el flujo principal (Plan. → calendario → editor de sesiones). Los bugs críticos están corregidos.

El mayor riesgo ahora mismo no es funcional: es de **mantenibilidad**. Con tres implementaciones paralelas del mismo editor, es fácil arreglar el lugar equivocado o no saber cuál versión del código es la real.

La recomendación es:

1. **Primero**, ejecutar R1 (mover SesionesPlan a legado) antes de cualquier otro trabajo. Es seguro, rápido, y elimina inmediatamente la principal fuente de confusión.

2. **Segundo**, antes de R2 (unificar copia), responder la pregunta nº 1 de la sección anterior: si se necesita copiar entre clientes desde el calendario de Plan., el alcance de R2 cambia.

3. **Tercero**, evaluar qué funcionalidades de SesionesPlan.jsx merece la pena recuperar (preguntas 3 y 4) antes de archivarlo definitivamente, para no perder trabajo útil.

---

## COMPROBACIÓN FINAL

> Este documento es solo documentación. No se ha modificado ningún archivo de código funcional.
