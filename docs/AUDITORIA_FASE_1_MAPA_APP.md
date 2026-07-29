# AUDITORÍA FASE 1 — MAPA GENERAL DE LA APLICACIÓN

> Fecha: 2026-07-29  
> Rama: main  
> Sin modificaciones de código. Solo lectura y documentación.

---

## A. ESTADO ACTUAL DEL REPOSITORIO

| Propiedad | Valor |
|---|---|
| Ruta real | `/Users/moises/Documents/trainer-app-main` |
| Rama | `main` |
| Commits sin push | 0 |
| Archivos modificados sin commit | `build/` (archivos generados, no relevantes) |
| Archivos nuevos sin seguimiento | `.DS_Store`, `.claude/`, `src/.DS_Store` |

### Cambios previos a esta auditoría (no tocados aquí)

Los archivos de `build/` tienen cambios no commiteados porque contienen el resultado del último `npm run build` local. Son archivos generados y no afectan al código fuente.

### Últimos 10 commits

```
833140d Debug: logging copia fases carrera en Sesiones.jsx
5834adf Debug: logging en pegarSesion para diagnosticar copia de fases carrera
04dcf95 Fix: copiar sesión de carrera preserva tipo_editor en SesionesPlan
09eca2d Fix: copiar sesión de carrera incluye fases y grupos con repeticiones
b2b95f4 Fix: copiar sesión de carrera incluye fases y grupos con repeticiones
b3338f3 Fix: vincular biblioteca_id al escribir nombre de ejercicio nuevo en sesión
1e689ee Multimedia modal crear ejercicio: añadir vídeo, GIF y subida de archivo
791c0c0 FASE 2: modal de creación de ejercicio personalizado + taxonomía unificada
9d65218 Fix identidad ejercicio: biblioteca_id solo en creación inicial
286d72b Fix: vincular biblioteca_id al escribir nombre de ejercicio nuevo en sesión
```

---

## B. ÁRBOL RESUMIDO DEL PROYECTO

```
trainer-app-main/
├── src/
│   ├── App.js                        # Raíz: routing, auth, menú lateral
│   ├── index.css                     # Estilos globales (variables CSS, clases utilitarias)
│   ├── index.js                      # Punto de entrada React
│   │
│   ├── pages/                        # Páginas principales (renderizadas desde App.js)
│   │   ├── Dashboard.jsx             # Vista resumen de clientes (64 líneas)
│   │   ├── Clientes.jsx              # CRUD de clientes (675 líneas)
│   │   ├── Pagos.jsx                 # Facturación mensual (400 líneas)
│   │   ├── Planificacion.jsx         # Plan anual por cliente — vista principal (2746 líneas) ⚠️
│   │   ├── Sesiones.jsx              # Editor completo de sesiones + calendario embebido (2743 líneas) ⚠️
│   │   ├── SesionesPlan.jsx          # Editor alternativo de sesiones — NO importado desde App.js (1270 líneas) ⚠️
│   │   ├── Biblioteca.jsx            # Biblioteca de ejercicios (1002 líneas)
│   │   ├── BibliotecaSesiones.jsx    # Sub-vista de sesiones dentro de Biblioteca (600 líneas)
│   │   ├── Seguimiento.jsx           # Panel de seguimiento — renderizado dentro de Planificacion (826 líneas)
│   │   ├── Tareas.jsx                # Gestión de tareas internas (449 líneas)
│   │   ├── Login.jsx                 # Autenticación (53 líneas)
│   │   │
│   │   ├── (vistas públicas — sin auth)
│   │   ├── PlanPublica.jsx           # Plan compartido por token (851 líneas)
│   │   ├── SesionPublica.jsx         # Sesión compartida por token (816 líneas)
│   │   ├── VistaSemanalCliente.jsx   # Semana compartida por token (583 líneas)
│   │   ├── CheckinSemanal.jsx        # Cuestionario semanal del cliente (286 líneas)
│   │   ├── CheckinPortal.jsx         # Portal de check-in (293 líneas)
│   │   ├── ClientePortal.jsx         # Portal completo del cliente (899 líneas)
│   │   ├── PackPublico.jsx           # Pack flexible compartido (141 líneas)
│   │   └── CuestionarioInicial.jsx   # Cuestionario de incorporación (922 líneas)
│   │
│   ├── components/
│   │   ├── CalendarioSesiones.jsx    # Calendario mes/semana reutilizable (389 líneas)
│   │   ├── FeedbackForm.jsx          # Formulario de feedback post-sesión (244 líneas)
│   │   ├── GraficaCarga.jsx          # Gráfica de carga de entrenamiento (261 líneas)
│   │   ├── PanelFuerzaSalud.jsx      # Panel análisis fuerza/salud (169 líneas)
│   │   └── EmojiPicker.jsx           # Selector de emojis (159 líneas)
│   │
│   ├── hooks/
│   │   └── useGenerarPagosMensuales.js  # Auto-generación de mensualidades (49 líneas)
│   │
│   └── lib/
│       ├── supabase.js               # Cliente Supabase (1 línea útil)
│       ├── taxonomia.js              # Fuente única de etiquetas de ejercicios (65 líneas)
│       ├── clasificarEjercicio.js    # Clasificador automático de ejercicios (393 líneas)
│       └── export.js                 # Exportación a CSV (47 líneas)
│
├── supabase/
│   └── migration_nivel_aproximacion.sql  # Única migración registrada localmente
├── supabase-schema.sql               # Schema inicial (solo clientes, servicios, pagos, tareas)
├── docs/
│   └── AUDITORIA_FASE_1_MAPA_APP.md  # Este archivo
├── public/
├── build/                            # Archivos generados (no editar)
├── .claude/launch.json               # Config dev server (creado en esta sesión)
├── vercel.json                       # Config Vercel
├── package.json                      # CRA, react-scripts, supabase-js, date-fns, chart.js, lucide-react
└── CLAUDE.md                         # Instrucciones del proyecto
```

### Responsabilidad de cada carpeta

| Carpeta | Responsabilidad |
|---|---|
| `src/pages/` | Pantallas completas, cada una con su propio estado y llamadas a Supabase |
| `src/components/` | Componentes reutilizables (calendario, gráficas, formularios) |
| `src/hooks/` | Lógica de efectos secundarios reutilizable |
| `src/lib/` | Utilidades: cliente Supabase, taxonomía, clasificador, exportación |
| `supabase/` | Migraciones SQL (solo 1 registrada localmente; el resto aplicadas directamente) |

---

## C. MAPA DE PÁGINAS Y RUTAS

### Sistema de routing

La app **no usa React Router**. Usa un estado `page` en `App.js` con renderizado condicional:
```js
{page === 'dashboard'   && <Dashboard ... />}
{page === 'sesiones'    && <Sesiones ... />}
```

Las URLs públicas se detectan con `window.location.pathname` y regex al montar.

### Páginas activas (accesibles desde la app autenticada)

| Archivo | Componente | Acceso | Función principal | Riesgo |
|---|---|---|---|---|
| `App.js` → `Dashboard.jsx` | `Dashboard` | Menú lateral > Dashboard | Vista resumen de clientes agrupados | Bajo |
| `App.js` → `Clientes.jsx` | `Clientes` | Menú lateral > Clientes | CRUD completo de clientes | Bajo |
| `App.js` → `Pagos.jsx` | `Pagos` | Menú lateral > Pagos | Facturación mensual + gráfica | Bajo |
| `App.js` → `Planificacion.jsx` | `Planificacion` | Menú lateral > Plan. | Plan anual + calendario + sesiones (por cliente) | **Alto** |
| `App.js` → `Sesiones.jsx` | `Sesiones` | Solo via `setSesionesContext` desde Planificacion/Biblioteca | Editor completo de sesiones | **Alto** |
| `App.js` → `Biblioteca.jsx` | `Biblioteca` | Menú lateral > Biblioteca | Biblioteca de ejercicios + plantillas de sesiones | Medio |
| `Biblioteca.jsx` → `BibliotecaSesiones.jsx` | `BibliotecaSesiones` | Tab dentro de Biblioteca | Plantillas de sesiones guardadas | Medio |
| `Planificacion.jsx` → `Seguimiento.jsx` | `Seguimiento` | Tab "Seguimiento" dentro de Planificacion | Análisis de carga y adherencia | Medio |
| `App.js` → `Tareas.jsx` | `Tareas` | Menú lateral (no visible, acceso interno) | Gestión de tareas — parece no estar en el menú | **Medio** |

**Nota**: `Tareas` está importado en `App.js` pero no aparece en el array `NAV`. No es accesible desde el menú lateral según el código actual. Necesita verificación.

### Páginas públicas (sin auth, por token en URL)

| Ruta URL | Componente | Función |
|---|---|---|
| `/plan/:token` | `PlanPublica` | Plan de planificación compartido |
| `/sesion/:token` | `SesionPublica` | Sesión compartida con cliente |
| `/semana/:token` | `VistaSemanalCliente` | Vista semanal del cliente |
| `/checkin/:token` | `CheckinSemanal` | Cuestionario semanal |
| `/checkin-portal/:token` | `CheckinPortal` | Portal de check-in |
| `/pack/:token` | `PackPublico` | Pack flexible compartido |
| `/cliente/:token` | `ClientePortal` | Portal completo del cliente |
| `/cuestionario/:token` | `CuestionarioInicial` | Cuestionario de incorporación |

### Página NO accesible desde App.js

| Archivo | Estado |
|---|---|
| `SesionesPlan.jsx` | **Exporta un componente pero no está importado en ningún sitio del árbol de App.js.** Es código huérfano activo. Contiene lógica de sesiones completa (pegarSesion, duplicarSesion, editor de bloques, carrito carrera). Riesgo: **Alto** si alguien la modifica creyendo que está activa. |

### Navegación y conservación de estado

- La navegación entre páginas **desmonta y remonta el componente completo** (renderizado condicional puro).
- Cuando se pasa de `Planificacion` a `Sesiones`, el contexto se pasa via `setSesionesContext({ clienteId, sesionId })` en `App.js`. Si este contexto se pierde (rerenders de App), la sesión puede no abrirse correctamente.
- **Al volver de `Sesiones` a `Planificacion`**, `Planificacion` se remonta completamente y recarga todos sus datos. Esto puede causar estados visuales que parecen "versión antigua" si hay datos cacheados en el estado que no se han recargado.
- No hay `React.memo`, `useCallback`, ni `React.lazy`. Cada cambio de página crea nuevas instancias.
- `sessionStorage` se usa para el portapapeles de bloques (`idelri_clipboardBloque`). Persiste entre navegaciones dentro de la misma pestaña.

---

## D. MAPA DE COMPONENTES

| Archivo | Responsabilidad | Usado en | Props clave | Mezcla UI+lógica | Líneas | Complejidad |
|---|---|---|---|---|---|---|
| `CalendarioSesiones.jsx` | Calendario mes/semana con menú contextual, tooltip, drag&drop, copia | `Planificacion.jsx` | `sesiones`, `clipboard`, `onCopiar`, `onPegar`, `onMoverSesion` | Sí (hace queries a Supabase para tooltips) | 389 | Alto |
| `FeedbackForm.jsx` | Formulario de feedback post-sesión del cliente | `SesionPublica.jsx`, `ClientePortal.jsx` | `sesionId`, `token` | No | 244 | Bajo |
| `GraficaCarga.jsx` | Gráfica de carga (Chart.js) | `Seguimiento.jsx` | `semanas`, `bloques` | No | 261 | Medio |
| `PanelFuerzaSalud.jsx` | Panel análisis fuerza/salud por cliente | `Seguimiento.jsx` | `clienteId`, `planificacionId` | Sí (queries propias) | 169 | Medio |
| `EmojiPicker.jsx` | Selector de emojis | `Sesiones.jsx`, `SesionesPlan.jsx` | `value`, `onChange` | No | 159 | Bajo |

### Componentes internos (definidos dentro de páginas, no en /components)

| Nombre | Definido en | Responsabilidad | Líneas aprox. |
|---|---|---|---|
| `Calendario` | `Sesiones.jsx` (línea 94) | Calendario mes/semana con copy/paste y drag, embebido solo en Sesiones | ~250 |
| `InlineInput` | `Sesiones.jsx` (línea 30) | Input editable inline con autosave | ~30 |
| `InlineInput` | `SesionesPlan.jsx` (línea 43) | **Duplicado exacto** del de Sesiones.jsx | ~25 |
| `DiaMenu` | `Sesiones.jsx` (línea 63) | Menú "+" para añadir elementos en un día | ~30 |
| `DiaMenu` | `CalendarioSesiones.jsx` (línea 25) | **Versión similar** del DiaMenu de Sesiones | ~40 |
| `VistaLista` | `Planificacion.jsx` (interno) | Lista de sesiones por semana | ~200 |
| `TagSelector` | `Biblioteca.jsx` (interno) | Selector de etiquetas taxonómicas | ~50 |

---

## E. INVENTARIO DE FUNCIONES PRINCIPALES

### Crear / guardar sesión

| Función | Archivo | Línea | Llama a | Tablas | Notas |
|---|---|---|---|---|---|
| `guardarSesion()` | `Sesiones.jsx` | 822 | `supabase.from('sesiones')`, `sesion_fases`, `sesion_bloques`, `sesion_ejercicios` | sesiones, sesion_fases, sesion_bloques, sesion_ejercicios | Crea sesión nueva o actualiza; si es carrera crea 3 fases, si es fuerza crea 4 bloques x 3 ejercicios |
| `guardarSesion()` | `SesionesPlan.jsx` | 243 | `supabase.from('sesiones')` | sesiones | **Versión alternativa** — no accesible desde App.js |
| `openModal('sesion', ...)` | `Planificacion.jsx` | ~210 | `guardarSesionPlan()` | sesiones | Crea sesión desde el calendario de planificación |

### Copiar / pegar sesión — **3 implementaciones distintas**

| Función | Archivo | Línea | Copia fases carrera | Copia grupos | Copia a otro cliente | Activa |
|---|---|---|---|---|---|---|
| `pegarSesion()` | `Sesiones.jsx` | 1033 | ✅ Sí | ✅ Sí (con logging debug) | ✅ Sí | ✅ Sí (calendario embebido en Sesiones) |
| `onPegar` inline | `Planificacion.jsx` | ~1778 | ⚠️ Parcial (sin grupo_id) | ❌ **No** | ❌ No (mismo cliente) | ✅ **Sí — es la que usa el usuario** |
| `pegarSesion()` | `SesionesPlan.jsx` | 428 | ✅ Sí (con logging debug) | ✅ Sí | ✅ Sí | ❌ No (archivo huérfano) |

**→ El bug de "solo aparece un bloque" está en `Planificacion.jsx` línea ~1778**: el `onPegar` inline copia `sesion_fases` pero sin `grupo_id` y sin copiar `sesion_fase_grupos`. Por eso los grupos con repeticiones se pierden.

### Duplicar sesión

| Función | Archivo | Línea | Copia fases | Copia grupos |
|---|---|---|---|---|
| `duplicarSesion()` | `Sesiones.jsx` | 1096 | ✅ Sí | ✅ Sí |
| Modal duplicar | `SesionesPlan.jsx` | ~600 | ✅ Sí | ✅ Sí |

### Cargar detalle de sesión (fases y bloques)

| Función | Archivo | Línea | Carga fases | Carga grupos |
|---|---|---|---|---|
| `cargarDetalle(sesionId)` | `Sesiones.jsx` | 624 | ✅ Sí | ✅ Sí |
| `cargarDetalle(sesionId)` | `SesionesPlan.jsx` | 223 | ✅ Sí | ✅ Sí |

### Operaciones con bloques de fuerza

| Función | Archivo | Línea | Descripción |
|---|---|---|---|
| `añadirBloque()` | `Sesiones.jsx` | 895 | Añade bloque vacío |
| `eliminarBloque()` | `Sesiones.jsx` | 906 | Elimina bloque y ejercicios en cascada |
| `actualizarBloque()` | `Sesiones.jsx` | 883 | Actualiza campo de bloque |
| `copiarBloqueFuerza()` | `Sesiones.jsx` | 470 | Copia bloque al portapapeles |
| `pegarDesdePortapapeles()` | `Sesiones.jsx` | 475 | Pega bloque desde portapapeles (sessionStorage) |
| `añadirBloque()` | `SesionesPlan.jsx` | 327 | **Duplicado** — mismo nombre, mismo propósito |
| `actualizarBloque()` | `SesionesPlan.jsx` | 317 | **Duplicado** — mismo nombre |

### Operaciones con fases de carrera (carrito)

| Función | Archivo | Línea | Descripción |
|---|---|---|---|
| `añadirBloqueSuelto()` | `Sesiones.jsx` | 657 | Añade fase suelta al carrito |
| `añadirGrupoCarrera()` | `Sesiones.jsx` | 664 | Crea grupo con 3 repeticiones y 2 fases |
| `duplicarBloqueCarrito()` | `Sesiones.jsx` | 719 | Duplica una fase dentro del carrito |
| `duplicarGrupoCarrito()` | `Sesiones.jsx` | 741 | Duplica un grupo entero |
| `copiarFase()` | `Sesiones.jsx` | 464 | Copia fase al portapapeles |
| `copiarGrupo()` | `Sesiones.jsx` | 467 | Copia grupo al portapapeles |
| `cambiarRepeticionesGrupo()` | `Sesiones.jsx` | 695 | Incrementa/decrementa repeticiones |

### Ejercicios

| Función | Archivo | Línea | Descripción |
|---|---|---|---|
| `abrirCrearEjercicio()` | `Sesiones.jsx` | 913 | Abre modal de creación (sin DB hasta Guardar) |
| `guardarEjercicioPersonalizado()` | `Sesiones.jsx` | 955 | INSERT atómico biblioteca + sesion_ejercicios |
| `añadirDesdeBiblioteca()` | `Sesiones.jsx` | 929 | Inserta ejercicio existente de la biblioteca |
| `actualizarEjercicio()` | `Sesiones.jsx` | 949 | Actualiza campo de ejercicio (simplificado) |
| `eliminarEjercicio()` | `Sesiones.jsx` | 1027 | Elimina ejercicio |
| `añadirEjercicio()` | `SesionesPlan.jsx` | 375 | **Versión alternativa** — inserta fila vacía inmediatamente (patrón antiguo) |
| `actualizarEjercicio()` | `SesionesPlan.jsx` | 382 | **Versión alternativa** — actualiza campo |

### Navegación al editor

| Función | Archivo | Línea | Descripción |
|---|---|---|---|
| `setSesionesContext()` | `Planificacion.jsx` | múltiple | Setea clienteId + sesionId y cambia page a 'sesiones' |
| `volverAlCalendario()` | `Sesiones.jsx` | 869 | Limpia sesionAbierta o llama setPage('planificacion') |
| `setSesionAbierta()` | `Sesiones.jsx` | 380 | Abre sesión en el editor sin navegar |

---

## F. MAPA INICIAL DE SUPABASE

> El `supabase-schema.sql` del repo solo contiene las tablas iniciales (clientes, servicios, pagos, tareas). Las demás tablas se han creado directamente en Supabase. Lo que sigue está **inferido del código**.

### Tablas confirmadas por el schema.sql

| Tabla | Propósito |
|---|---|
| `clientes` | Datos de clientes |
| `servicios` | Configuración de entrenamiento por cliente |
| `pagos` | Facturación mensual |
| `tareas` | Tareas internas de la entrenadora |

### Tablas inferidas del código (no en schema.sql)

| Tabla | Propósito inferido | Lee | Escribe |
|---|---|---|---|
| `planificaciones` | Plan anual por cliente | Planificacion, PlanPublica, ClientePortal | Planificacion |
| `bloques` | Bloques del plan (fases, pretemporada, etc.) | Planificacion, PlanPublica, ClientePortal, Sesiones | Planificacion |
| `subbloques` | Sub-divisiones de bloques | Planificacion, PlanPublica, ClientePortal | Planificacion |
| `semanas` | Semanas del plan con datos reales/objetivo | Planificacion, CalendarioSesiones, VistaSemanalCliente | Planificacion, CalendarioSesiones |
| `sesiones` | Sesiones de entrenamiento | Sesiones, Planificacion, SesionesPlan, ClientePortal | Sesiones, Planificacion, SesionesPlan |
| `sesion_bloques` | Bloques dentro de sesiones de fuerza | Sesiones, SesionesPlan, BibliotecaSesiones, SesionPublica | Sesiones, SesionesPlan, Planificacion |
| `sesion_ejercicios` | Ejercicios dentro de bloques de fuerza | Sesiones, SesionesPlan, BibliotecaSesiones, SesionPublica | Sesiones, SesionesPlan, Planificacion |
| `sesion_fases` | Fases del carrito de carrera | Sesiones, SesionesPlan, SesionPublica, CalendarioSesiones | Sesiones, SesionesPlan, Planificacion |
| `sesion_fase_grupos` | Grupos con repeticiones (carrera) | Sesiones, SesionesPlan, SesionPublica | Sesiones, SesionesPlan |
| `sesion_feedback` | Feedback post-sesión del cliente | Seguimiento, SesionPublica | SesionPublica (via FeedbackForm) |
| `sesion_notas` | Notas del calendario | Sesiones, Planificacion, ClientePortal | Sesiones, Planificacion |
| `ejercicios_biblioteca` | Biblioteca maestra de ejercicios | Sesiones, Biblioteca | Sesiones, Biblioteca |
| `bloques_biblioteca` | Biblioteca de bloques de sesión | Sesiones | Sesiones, Biblioteca |
| `bloques_biblioteca_ejercicios` | Ejercicios dentro de bloques de biblioteca | Sesiones | Sesiones |
| `competiciones` | Competiciones en el calendario | Planificacion, Sesiones, PlanPublica, ClientePortal | Planificacion, Sesiones |
| `controles` | Valoraciones/controles en el calendario | Planificacion, Sesiones, PlanPublica | Planificacion, Sesiones |
| `packs_flexibles` | Packs de sesiones sin fecha | Sesiones, SesionesPlan, ClientePortal, PackPublico | Sesiones, SesionesPlan |
| `checkin_semanal` | Cuestionarios semanales del cliente | CheckinSemanal, CheckinPortal, Seguimiento, VistaSemanalCliente | CheckinSemanal |
| `cuestionario_inicial` | Cuestionario de incorporación | CuestionarioInicial, Clientes | CuestionarioInicial |

### Tablas con campos no documentados en CLAUDE.md

- `sesiones`: tiene `tipo_editor` (carrera/fuerza), `tipo_actividad`, `tipos_actividad[]`, `es_plantilla`, `pack_id`, `orden`, `estado`, `con_feedback`, `icono`
- `sesion_fases`: tiene `grupo_id` (FK a `sesion_fase_grupos`), `descripcion`, `volumen_min`, `volumen_km`, `fc_zona`, `ritmo_inicio`, `ritmo_fin`, `rpe`
- `ejercicios_biblioteca`: tiene `nivel_aproximacion text[]` (añadido en migración reciente)

---

## G. FLUJO DE COPIAR UNA SESIÓN

### Flujo real cuando el usuario está en "Plan." (Planificacion.jsx)

```
Usuario en página 'planificacion'
  └── App.js renderiza <Planificacion>
        └── Planificacion.jsx renderiza <CalendarioSesiones> (componente externo)
              └── CalendarioSesiones.jsx
                    └── Clic derecho sobre sesión
                          └── menú contextual (línea ~326 CalendarioSesiones.jsx)
                                └── "📋 Copiar"
                                      └── onCopiar(menu.item)
                                            └── Planificacion.jsx: setClipboardSesion(item)
                                                  [item = objeto sesión con _tipo:'sesion']

  └── Clic derecho en otro día / otro cliente
        └── "📌 Pegar aquí"
              └── onPegar(clipboard, menu.fecha) — solo mismo cliente
                    └── Planificacion.jsx inline (~línea 1778):
                          1. INSERT sesiones → nueva sesión
                          2. SELECT sesion_bloques WHERE sesion_id = item.id
                          3. Para cada bloque → INSERT sesion_bloques
                          4. Para cada ejercicio → INSERT sesion_ejercicios
                          5. SELECT sesion_fases WHERE sesion_id = item.id
                          6. Para cada fase → INSERT sesion_fases SIN grupo_id, SIN sesion_fase_grupos
                          ❌ sesion_fase_grupos NUNCA se copia
                          ❌ Las fases se insertan con grupo_id = undefined (→ fases sueltas)
```

### Diferencia entre copiar fuerza y copiar resistencia en este flujo

| Tipo | Resultado |
|---|---|
| Fuerza | ✅ Funciona: copia sesion_bloques + sesion_ejercicios |
| Carrera (fases sueltas) | ⚠️ Parcial: copia las fases pero sin enlazar a grupos |
| Carrera (grupos con repeticiones) | ❌ Roto: los grupos desaparecen, las fases quedan sueltas |

### Flujo cuando el usuario está en "Sesiones" (Sesiones.jsx)

```
Usuario en página 'sesiones'
  └── App.js renderiza <Sesiones>
        └── Sesiones.jsx renderiza <Calendario> (componente INTERNO, línea 94)
              └── Clic derecho → "📋 Copiar sesión"
                    └── onCopiar → setClipboard(item)
              └── "Pegar en otro cliente > [nombre]"
                    └── onPegar(clipboard, fecha, clienteDestino)
                          └── Sesiones.jsx::pegarSesion() (línea 1033)
                                ✅ Copia sesion_bloques + sesion_ejercicios
                                ✅ Copia sesion_fase_grupos
                                ✅ Copia sesion_fases con grupo_id correcto
```

### Implementaciones de "pegar sesión" y su estado

| Implementación | Archivo | Estado | Copia grupos |
|---|---|---|---|
| `pegarSesion()` | `Sesiones.jsx:1033` | ✅ Activa, accesible desde Sesiones | ✅ Sí |
| `onPegar` inline | `Planificacion.jsx:~1778` | ✅ **Activa, es la que usa el usuario habitualmente** | ❌ No |
| `pegarSesion()` | `SesionesPlan.jsx:428` | ❌ No accesible (archivo huérfano) | ✅ Sí |

---

## H. POSIBLES DUPLICIDADES

### Confirmadas

| Elemento | Archivos | Evidencia |
|---|---|---|
| Función `InlineInput` | `Sesiones.jsx:30` y `SesionesPlan.jsx:43` | Código casi idéntico en ambos archivos |
| Función `ytId()` | `Sesiones.jsx:13` y `SesionesPlan.jsx:29` | Idéntica en ambos |
| Función `ytTitulo()` | `Sesiones.jsx:19` y `SesionesPlan.jsx:35` | Idéntica en ambos |
| Función `añadirBloque()` | `Sesiones.jsx:895` y `SesionesPlan.jsx:327` | Mismo propósito, mismo nombre |
| Función `actualizarBloque()` | `Sesiones.jsx:883` y `SesionesPlan.jsx:317` | Mismo propósito |
| Función `añadirEjercicio()` | `Sesiones.jsx` (eliminada) y `SesionesPlan.jsx:375` | La de Sesiones fue reemplazada por modal; SesionesPlan sigue con patrón antiguo (insert inmediato) |
| Función `pegarSesion()` | `Sesiones.jsx:1033`, `SesionesPlan.jsx:428`, y `onPegar` inline en `Planificacion.jsx:~1778` | **3 implementaciones** distintas con comportamiento diferente |
| Función `duplicarSesion()` | `Sesiones.jsx:1096` y lógica similar en `SesionesPlan.jsx` | Mismo propósito, implementadas por separado |
| Componente `DiaMenu` | `Sesiones.jsx:63` y `CalendarioSesiones.jsx:25` | Similar propósito, implementaciones distintas |
| Componente calendario | `Sesiones.jsx::Calendario` (interno) y `CalendarioSesiones.jsx` (componente externo) | **Dos calendarios distintos**: el interno solo en Sesiones, el externo solo en Planificacion |
| `iconoSesion()` | `Sesiones.jsx` (no encontrada), `SesionesPlan.jsx:23`, `CalendarioSesiones.jsx:17` | Función de icono duplicada |

### Probables

| Elemento | Archivos | Notas |
|---|---|---|
| Lógica de copy/paste de bloques | `Sesiones.jsx` y `SesionesPlan.jsx` | Ambos tienen portapapeles de bloques, quizás con diferente alcance |
| Carga de detalle de sesión (`cargarDetalle`) | `Sesiones.jsx:624` y `SesionesPlan.jsx:223` | Mismo nombre, mismo propósito |
| Gestión de `tipo_editor` vs `tipo_actividad` | Sesiones usa `tipo_editor`, SesionesPlan usa `tipo_actividad` y `tipos_actividad[]` | **Campo diferente para el mismo concepto** — puede causar que sesiones creadas en un editor no se reconozcan correctamente en el otro |

### Necesita más investigación

| Elemento | Notas |
|---|---|
| Campos `tipo_editor` vs `tipo_actividad` | Sesiones.jsx usa `tipo_editor: 'carrera'/'fuerza'`. SesionesPlan.jsx usa `tipo_actividad: 'correr'/'fuerza'/'caminar'...`. Son campos diferentes con propósitos parcialmente superpuestos |
| `bloques_biblioteca` vs `ejercicios_biblioteca` | Dos sistemas de biblioteca: uno de ejercicios individuales, otro de bloques completos |

---

## I. CÓDIGO POSIBLEMENTE NO UTILIZADO

> ⚠️ Una detección estática no garantiza que el código sea eliminable con seguridad. Verificar siempre antes de actuar.

| Elemento | Archivo | Evidencia | Clasificación |
|---|---|---|---|
| `SesionesPlan.jsx` (completo) | `src/pages/SesionesPlan.jsx` | No está importado en ningún archivo del árbol de App.js. La única referencia a su export es su propia declaración. | **Probable no utilizado** |
| `Tareas` | `src/pages/Tareas.jsx` | Importado en App.js pero no aparece en el array `NAV`. No hay `{page === 'tareas' && ...}` en el JSX de App.js visible. Necesita verificación. | **Necesita investigación** |
| Funciones de logging debug | `Sesiones.jsx:~1069`, `SesionesPlan.jsx:~439` | `console.log('[copy] ...')` añadidos para debugging. No son errores pero contaminan la consola en producción. | **A limpiar** |
| `CheckIcon` | `App.js` | Definida al final de App.js pero no aparece en el JSX del menú (el menú usa solo HomeIcon, UsersIcon, EuroIcon, CalendarIcon, BookIcon). | **Probable no utilizado** |
| `export.js` | `src/lib/export.js` | Importado en App.js (función `exportarTodo`). Activo. | Activo |

---

## J. ARCHIVOS DE MAYOR RIESGO

### Top 10 por criticidad

| # | Archivo | Líneas | Responsabilidades | Estado local | Queries Supabase | Riesgo principal |
|---|---|---|---|---|---|---|
| 1 | `src/pages/Sesiones.jsx` | 2743 | Editor fuerza + Editor carrera + Calendario embebido + Biblioteca inline + Portapapeles + Packs + Modal crear ejercicio + Copy/paste | ~25 estados + refs | ~40 tablas distintas tocadas | Archivo monolítico. Cualquier cambio puede romper múltiples flujos. Contiene 2 editores distintos (carrera/fuerza) y un calendario propio. |
| 2 | `src/pages/Planificacion.jsx` | 2746 | Timeline + Bloques + Subbloques + Semanas + Calendario + Copiar/pegar sesiones + Vista lista + Seguimiento inline | ~30 estados | ~12 tablas | Contiene la implementación rota de copiar sesión (`onPegar` inline). Enorme y difícil de modificar. |
| 3 | `src/pages/SesionesPlan.jsx` | 1270 | Editor completo de sesiones alternativo — **huérfano** | ~20 estados | ~10 tablas | No se usa pero existe. Si alguien lo modifica creyendo que está activo, el trabajo es inútil. Confunde la arquitectura. |
| 4 | `src/components/CalendarioSesiones.jsx` | 389 | Calendario con drag, tooltip con queries propias, menú contextual | 3 estados | `semanas`, `sesion_bloques`, `sesion_fases` | El tooltip hace queries directas a Supabase. El menú de paste no copia `sesion_fase_grupos`. Es el punto de entrada del bug de copiar. |
| 5 | `src/pages/Biblioteca.jsx` | 1002 | Biblioteca ejercicios + Biblioteca bloques + Modal edición + Upload media | ~15 estados | `ejercicios_biblioteca`, `bloques_biblioteca`, `bloques_biblioteca_ejercicios` | Taxonomía recientemente migrada. Riesgo si los labels de taxonomía divergen entre Biblioteca y Sesiones. |
| 6 | `src/pages/ClientePortal.jsx` | 899 | Vista completa del cliente: plan, sesiones, competiciones, checkins | ~10 estados | 9 tablas | Lee muchas tablas. Afectado si cambia el schema. |
| 7 | `src/pages/SesionPublica.jsx` | 816 | Vista pública de sesión, feedback, carrito carrera | ~8 estados | `sesiones`, `sesion_fases`, `sesion_fase_grupos`, `sesion_feedback` | Lee `sesion_fase_grupos` — sensible a cambios de schema. |
| 8 | `src/pages/Seguimiento.jsx` | 826 | Análisis de adherencia, gráficas, checkins | ~10 estados | `sesiones`, `checkin_semanal`, `sesion_feedback` | Dependiente de estructura de datos que aún está en desarrollo. |
| 9 | `src/lib/clasificarEjercicio.js` | 393 | Clasificador automático de ejercicios por keywords | Estado: ninguno | Ninguna | Acoplado a taxonomía. Si cambian los valores de `ETIQUETAS` sin actualizar las reglas, la clasificación falla silenciosamente. |
| 10 | `src/App.js` | 174 | Routing, auth, menú lateral, paso de contexto entre páginas | ~10 estados | `supabase.auth` | Cambiar el paso de contexto entre páginas puede romper la navegación Planificacion → Sesiones y el regreso. |

---

## K. PREGUNTAS Y ZONAS QUE REQUIEREN SEGUNDA AUDITORÍA

1. **`tipo_editor` vs `tipo_actividad`**: ¿Son campos diferentes en la misma tabla `sesiones`? ¿Existe alguna sesión con `tipo_editor = 'carrera'` y a la vez `tipo_actividad = 'correr'`? ¿O son siempre mutuamente exclusivos? Una sesión creada en Sesiones.jsx usa `tipo_editor`; una creada en SesionesPlan.jsx usa `tipo_actividad`. Si la misma sesión se abre desde ambos editores, ¿cuál prevalece?

2. **`SesionesPlan.jsx`**: ¿Fue una versión anterior de `Sesiones.jsx` que quedó abandonada? ¿O está previsto que vuelva a usarse? La respuesta determina si puede eliminarse o refactorizarse.

3. **`Tareas.jsx`**: ¿Está accesible desde algún lugar de la UI o quedó desconectado del menú?

4. **Schema real de Supabase**: El `supabase-schema.sql` tiene solo 4 tablas. El código usa al menos 20. Las migraciones adicionales no están versionadas localmente. Necesita auditoría directa de Supabase para confirmar columnas, constraints, y RLS actuales.

5. **RLS en `sesion_fase_grupos`**: La copia de grupos falla silenciosamente (sin error visible). Podría ser un problema de RLS además del bug de código. Necesita verificación en Supabase.

6. **`packs_flexibles`**: La lógica de packs aparece en Sesiones.jsx y SesionesPlan.jsx. ¿Son el mismo sistema o evolucionaron de forma independiente?

7. **`bloques_biblioteca` vs `ejercicios_biblioteca`**: ¿Son dos sistemas de plantilla paralelos? ¿Cuál es el previsto para el futuro?

8. **Estado "versión antigua en pantalla"**: La falta de `React.memo` y la remontada completa al cambiar de página pueden ser la causa de que a veces aparezca una versión anterior. Necesita reproducción controlada para confirmar.

---

## RESUMEN EJECUTIVO

### Estructura actual

La aplicación es una SPA React CRA sin React Router. La navegación se gestiona con un estado `page` en `App.js`. Las páginas se desmontan y remontan completamente al cambiar de sección.

El núcleo de la aplicación son dos archivos de ~2750 líneas cada uno (`Sesiones.jsx` y `Planificacion.jsx`) que han crecido acumulando funcionalidades heterogéneas.

### Páginas activas (menú lateral)

Dashboard → Clientes → Pagos → Planificacion → Biblioteca

`Sesiones.jsx` no tiene entrada en el menú: se accede solo via `setSesionesContext` desde otras páginas.

### Principales duplicidades detectadas

1. **3 implementaciones de "pegar sesión"** con comportamiento diferente — la activa desde el calendario habitual (`Planificacion.jsx`) es la más incompleta.
2. **2 calendarios distintos**: `Calendario` (interno en Sesiones.jsx) y `CalendarioSesiones` (componente externo usado en Planificacion.jsx).
3. **`SesionesPlan.jsx`** es un editor de sesiones completo que no está conectado a ninguna ruta de App.js.
4. Funciones utilitarias (`InlineInput`, `ytId`, `ytTitulo`, `iconoSesion`) duplicadas entre Sesiones.jsx y SesionesPlan.jsx.
5. Campos `tipo_editor` y `tipo_actividad` representan el mismo concepto con valores distintos.

### Bug de copiar sesión de carrera — causa raíz

El usuario utiliza el calendario de la página `Planificacion` (que renderiza `CalendarioSesiones.jsx`). Al pegar, se ejecuta el handler `onPegar` inline definido en `Planificacion.jsx` (~línea 1778). Este handler copia `sesion_fases` pero **no copia `sesion_fase_grupos`** y además inserta las fases sin `grupo_id`. Los grupos con repeticiones se pierden.

El fix correcto es en `Planificacion.jsx`, en el bloque `onPegar` inline, añadiendo la copia de `sesion_fase_grupos` antes de insertar las fases, igual que ya hace `pegarSesion()` en `Sesiones.jsx`.

### Confirmación

**No se ha modificado ningún archivo de código funcional en esta auditoría.**  
El único archivo creado es: `docs/AUDITORIA_FASE_1_MAPA_APP.md`
