# CLAUDE.md — idelri trainer-app

## Qué es esta aplicación

**idelri** es una plataforma de planificación, seguimiento y comunicación entre entrenadora y cliente.
Desarrollada por Irene del Río, entrenadora personal y especialista en rendimiento (FC Barcelona, selección española femenina).

No es un simple calendario de entrenamiento. Es una herramienta profesional completa.

URL producción: https://trainer-app-pink-delta.vercel.app  
Repo: trainer-app

---

## Stack técnico

- **Frontend**: React CRA (Create React App)
- **Base de datos**: Supabase (PostgreSQL)
- **Despliegue**: Vercel
- **Autenticación**: Supabase Auth

---

## Estructura de archivos

```
src/
  components/
    FeedbackForm.jsx        # Formulario de feedback de sesión
    GraficaCarga.jsx        # Gráfica de carga de entrenamiento
    PanelFuerzaSalud.jsx    # Panel específico clientes fuerza/salud
  hooks/
    useGenerarPagosMensuales.js   # Genera mensualidades automáticamente al inicio de mes
  lib/
    supabase.js             # Cliente de Supabase
    export.js               # Exportación a CSV
  pages/
    Dashboard.jsx           # Vista inicial: clientes agrupados por actividad
    Clientes.jsx            # Gestión de clientes (CRUD)
    Pagos.jsx               # Facturación mensual + gráfica de ingresos
    Planificacion.jsx       # Vista principal de planificación por cliente
    SesionesPlan.jsx        # Calendario de sesiones por semana
    Sesiones.jsx            # Editor completo de sesiones
    VistaSemanalCliente.jsx # Vista pública semanal para el cliente (token)
    CheckinSemanal.jsx      # Cuestionario semanal del cliente
    PlanPublica.jsx         # Vista pública de planificación compartida
    SesionPublica.jsx       # Vista pública de sesión compartida
    Tareas.jsx              # Gestión de tareas internas
    Login.jsx               # Autenticación
  App.js                    # Rutas principales
```

---

## Schema completo de Supabase

### Jerarquía de datos

```
clientes
└── planificaciones        (token_publico para compartir)
    └── bloques            (fase, carga, color, orden)
        └── subbloques     (enfoque_prioridad jsonb, zonas, km)
            └── semanas    (km_objetivo/real, zonas real, token_publico)
                └── sesiones (tipo_sesion, token_publico)
                    └── sesion_bloques (nombre, color, orden)
                        └── sesion_ejercicios (series, reps, rpe, media)
                    └── sesion_feedback (data jsonb, editado)
                    └── sesion_notas
```

---

### planificaciones
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| cliente_id | uuid | FK → clientes |
| nombre | text | |
| fecha_inicio | date | |
| fecha_fin | date | |
| notas | text | |
| token_publico | text | unique, para compartir |
| created_at | timestamptz | |

---

### bloques
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| planificacion_id | uuid | FK → planificaciones |
| nombre | text | |
| fase | text | general / pretemporada / competicion / recuperacion / transicion |
| carga | text | baja / media / alta / muy_alta |
| semanas | integer | duración en semanas |
| fecha_inicio | date | |
| objetivo | text | |
| contenidos | text | |
| orden | integer | |
| color | text | default #2d6a4f |

---

### subbloques
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| bloque_id | uuid | FK → bloques |
| nombre | text | |
| semana_inicio | integer | relativa al bloque |
| semana_fin | integer | relativa al bloque |
| objetivo | text | |
| notas | text | |
| zona1_2 | integer | % objetivo resistencia |
| zona3_4 | integer | % objetivo resistencia |
| zona5 | integer | % objetivo resistencia |
| km_min / km_max | integer | volumen objetivo resistencia |
| sesiones_min / sesiones_max | integer | frecuencia fuerza/salud |
| duracion_media_min | integer | duración sesión fuerza/salud |
| exigencia | text | baja / media / alta |
| enfoque | text[] | array de contenidos (fuerza, movilidad...) |
| enfoque_prioridad | jsonb | scoring 1-5 por contenido → % automático |

---

### semanas
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| bloque_id | uuid | FK → bloques (no subbloque_id) |
| numero | integer | número de semana |
| objetivo | text | |
| notas | text | |
| carga | text | baja / media / alta / muy_alta |
| zona1_2_real / zona3_4_real / zona5_real | integer | zonas reales realizadas |
| km_objetivo / km_real | integer | volumen planificado vs real |
| comentario | text | |
| nota_cliente | text | visible para el cliente |
| token_publico | uuid | para compartir vista semanal |

---

### sesiones
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| cliente_id | uuid | FK → clientes |
| titulo | text | |
| fecha | date | null = sesión abierta sin fecha fija |
| objetivo | text | |
| duracion_min | integer | |
| material | text | |
| indicaciones | text | |
| tipo_sesion | text | programada / flexible / opcional |
| token_publico | text | unique, para compartir con cliente |

---

### sesion_bloques
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| sesion_id | uuid | FK → sesiones (cascade delete) |
| nombre | text | nombre del bloque dentro de la sesión |
| color | text | código de color visual |
| nota | text | |
| orden | integer | |

---

### sesion_ejercicios
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| bloque_id | uuid | FK → sesion_bloques (cascade delete) |
| nombre | text | |
| series | text | |
| reps | text | |
| rpe | text | |
| notas | text | |
| media_tipo | text | imagen / video |
| media_url | text | URL imagen |
| video_url | text | URL vídeo |
| orden | integer | |

---

### sesion_feedback
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| sesion_id | uuid | FK → sesiones, unique (1 feedback por sesión) |
| data | jsonb | respuestas del cliente |
| submitted_at | timestamptz | |
| editado | boolean | si el cliente ha editado tras enviar |

---

### checkin_semanal
Cuestionario semanal independiente del cliente.
Recoge: descanso, energía, molestias, carga percibida, etc.
La visualización y análisis de respuestas está **pendiente de desarrollo**.

---

## Arquitectura de la aplicación

### Menú lateral (4 secciones)

1. **Dashboard** — Clientes agrupados por tipo de actividad. Clic → planificación directa.
2. **Clientes** — CRUD completo. Etiquetas: Gratis/Familia o cliente de pago.
3. **Pagos** — Tabla mensual + gráfica de ingresos. Mensualidades auto-generadas al inicio de cada mes via `useGenerarPagosMensuales`.
4. **Planificación** — Núcleo principal. Prioridad máxima de desarrollo.

### Sección Planificación — 5 vistas

**Vista 1 — Resumen**: línea temporal anual, bloques, subbloques, semanas, competiciones, semana tipo, consideraciones del deportista.

**Vista 2 — Bloques**: bloques desplegables con objetivos e info general.

**Vista 3 — Subbloques**: información diferente según tipo de cliente:
- *Fuerza/Salud*: objetivos, frecuencia, nº sesiones, tiempo, exigencia, contenidos con % de prioridad (`enfoque_prioridad` jsonb con scoring 1-5 → % automático).
- *Resistencia*: objetivos, distribución por zonas, objetivo de volumen.

**Vista 4 — Semanas**: jerarquía Bloque → Subbloque → Semana. En resistencia: comparación km planificado vs real, zonas planificadas vs reales.

**Vista 5 — Sesiones** *(más importante)*: calendario semanal. Cabecera: nº semana + subbloque + bloque. Enlace para compartir semana con cliente via `token_publico`.

### Tipos de elementos en el calendario de sesiones
- Sesiones con fecha fija
- Sesiones abiertas (fecha null, el cliente elige cuándo)
- Competiciones
- Valoraciones
- Controles
- Notas

Cada elemento: se puede eliminar, copiar o arrastrar.

### Editor de sesiones
Estructura: sesion → sesion_bloques (con color) → sesion_ejercicios (series, reps, rpe, media).
Cada sesión tiene `token_publico` para enlace compartible con el cliente.

### Botones generales de planificación
Imprimir · Compartir enlace · Editar info general · Eliminar planificación · Añadir (bloque, subbloque, competición, control, valoración) · Copiar planificación.

---

## Diferenciación clave entre tipos de cliente

Siempre distinguir entre:
- **Resistencia**: volumen en km, zonas de intensidad (zona1_2 / zona3_4 / zona5), planificado vs realizado
- **Fuerza/Salud**: frecuencia semanal, exigencia, contenidos con % de prioridad via `enfoque_prioridad`

Esta distinción afecta a subbloques, semanas, paneles de análisis y componentes visuales.

---

## Reglas de desarrollo

- No cambiar la arquitectura de menú ni la jerarquía `planificaciones → bloques → subbloques → semanas → sesiones` salvo petición explícita.
- No modificar la lógica de `enfoque_prioridad` (scoring 1-5 con % automático) sin consultar.
- No cambiar nombres de tablas ni columnas de Supabase sin confirmar migración primero.
- Ejecutar siempre el SQL de migración en Supabase **antes** de escribir el código frontend.
- Ante errores de JSX estructural, pedir bloques de 50+ líneas de contexto antes de sugerir reemplazos.
- Irene pega el código exacto tal como está en su archivo. Si el texto a reemplazar no coincide exactamente, ella lo indicará.
- Las vistas públicas (cliente) van por `token_publico`, sin autenticación propia.
- Prioridad de desarrollo: Vista Sesiones > resto de Planificación > Dashboard > Clientes/Pagos.
- La visualización del `checkin_semanal` está pendiente — no está implementada aún.
