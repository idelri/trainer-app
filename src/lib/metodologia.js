// src/lib/metodologia.js
//
// Taxonomía metodológica de SESIONES y BLOQUES.
// ⚠️  NO es taxonomía de ejercicios — para eso ver src/lib/taxonomia.js.

// ── FUNCIÓN DE SESIÓN ─────────────────────────────────────────────────────────
// Responde: ¿qué función cumple esta sesión dentro de la planificación?
// Almacenado en sesiones.funcion_sesion (text, selección única)

export const FUNCIONES_SESION = [
  { id: 'desarrollo',   label: 'Desarrollo' },
  { id: 'pmi',          label: 'PMI · Mejora individual' },
  { id: 'readaptacion', label: 'Readaptación' },
  { id: 'activacion',   label: 'Activación / Priming' },
  { id: 'recuperacion', label: 'Recuperación / Regenerativa' },
  { id: 'evaluacion',   label: 'Evaluación / Screening' },
  { id: 'tecnica',      label: 'Técnica / Aprendizaje' },
]

// ── CAPACIDADES ───────────────────────────────────────────────────────────────
// Responde: ¿qué capacidades trabajamos?
// Almacenado en sesiones.capacidades (text[], multiselección)

export const GRUPOS_CAPACIDAD = [
  {
    grupo: 'Neuromusculares',
    items: [
      { id: 'fuerza',           label: 'Fuerza' },
      { id: 'velocidad',        label: 'Velocidad' },
      { id: 'movilidad',        label: 'Movilidad' },
      { id: 'control_motor',    label: 'Control motor' },
      { id: 'habilidad_motriz', label: 'Habilidad motriz / deportiva' },
    ],
  },
  {
    grupo: 'Metabólicas',
    items: [
      { id: 'resistencia',          label: 'Resistencia' },
      { id: 'potencia_aerobica',    label: 'Potencia aeróbica / Alta intensidad aeróbica' },
      { id: 'capacidad_anaerobica', label: 'Capacidad anaeróbica' },
    ],
  },
]

// Lista plana de capacidades (útil para lookups)
export const CAPACIDADES = GRUPOS_CAPACIDAD.flatMap(g => g.items)

// ── OBJETIVOS POR CAPACIDAD ───────────────────────────────────────────────────
// Responde: ¿qué adaptación concreta buscamos?
// Almacenado en sesiones.objetivos_sesion (text[], multiselección)
// Los objetivos disponibles dependen de las capacidades seleccionadas.

export const OBJETIVOS_POR_CAPACIDAD = {
  fuerza: [
    { id: 'fuerza_maxima',      label: 'Fuerza máxima' },
    { id: 'fuerza_potencia',    label: 'Fuerza-potencia' },
    { id: 'fuerza_explosiva',   label: 'Fuerza explosiva / velocidad' },
    { id: 'fuerza_resistencia', label: 'Fuerza-resistencia' },
    { id: 'fuerza_excentrica',  label: 'Fuerza excéntrica' },
    { id: 'fuerza_rom',         label: 'Fuerza en amplio ROM' },
  ],
  velocidad: [
    { id: 'aceleracion',           label: 'Aceleración' },
    { id: 'velocidad_maxima',      label: 'Velocidad máxima' },
    { id: 'resistencia_velocidad', label: 'Resistencia a la velocidad' },
    { id: 'desaceleracion',        label: 'Desaceleración' },
    { id: 'cambio_direccion',      label: 'Cambio de dirección (COD)' },
  ],
  movilidad: [
    { id: 'aumento_rom',         label: 'Aumento / mantenimiento de ROM' },
    { id: 'control_rango_final', label: 'Control en rango final' },
  ],
  control_motor: [
    { id: 'estabilidad_postural',  label: 'Estabilidad / control postural' },
    { id: 'control_coordinacion',  label: 'Control y coordinación segmentaria' },
    { id: 'control_sensoriomotor', label: 'Control sensoriomotor / propioceptivo' },
  ],
  habilidad_motriz: [
    { id: 'desplazamiento',  label: 'Área de desplazamiento' },
    { id: 'salto',           label: 'Área de salto' },
    { id: 'lucha',           label: 'Área de lucha' },
    { id: 'actuacion_movil', label: 'Área de actuación sobre el móvil' },
  ],
  resistencia: [
    { id: 'recuperacion_metabolica', label: 'Recuperación / baja carga metabólica' },
    { id: 'resistencia_aerobica',    label: 'Resistencia aeróbica' },
    { id: 'resistencia_prolongada',  label: 'Resistencia prolongada' },
    { id: 'resistencia_especifica',  label: 'Resistencia específica' },
  ],
  potencia_aerobica: [
    { id: 'trabajo_subumbral',     label: 'Trabajo subumbral / Metabolic Drift' },
    { id: 'intensidad_especifica', label: 'Intensidad específica' },
    { id: 'vo2max',                label: 'VO₂max / VAM' },
  ],
  capacidad_anaerobica: [
    { id: 'tolerancia_alta_intensidad', label: 'Tolerancia a alta intensidad' },
    { id: 'potencia_anaerobica',        label: 'Potencia anaeróbica' },
  ],
}

/**
 * Dado un array de IDs de capacidades seleccionadas,
 * devuelve los objetivos disponibles agrupados por capacidad,
 * en el orden canónico de GRUPOS_CAPACIDAD.
 *
 * @param {string[]} capacidadesSeleccionadas
 * @returns {{ capacidadId: string, capacidadLabel: string, objetivos: {id:string,label:string}[] }[]}
 */
export function objetivosAgrupados(capacidadesSeleccionadas = []) {
  return capacidadesSeleccionadas
    .map(capId => {
      const cap = CAPACIDADES.find(c => c.id === capId)
      const objetivos = OBJETIVOS_POR_CAPACIDAD[capId] || []
      if (!cap || objetivos.length === 0) return null
      return { capacidadId: capId, capacidadLabel: cap.label, objetivos }
    })
    .filter(Boolean)
}

/**
 * Filtra un array de IDs de objetivos seleccionados para conservar
 * únicamente los que pertenecen a alguna de las capacidades activas.
 * Usar cada vez que cambia la selección de capacidades.
 *
 * @param {string[]} objetivosActuales - IDs actualmente seleccionados
 * @param {string[]} capacidadesActivas - IDs de capacidades actualmente seleccionadas
 * @returns {string[]}
 */
export function filtrarObjetivosCompatibles(objetivosActuales = [], capacidadesActivas = []) {
  const permitidos = new Set(
    capacidadesActivas.flatMap(capId => (OBJETIVOS_POR_CAPACIDAD[capId] || []).map(o => o.id))
  )
  return objetivosActuales.filter(id => permitidos.has(id))
}

// ── MÉTODOS DE BLOQUE ─────────────────────────────────────────────────────────
// Responde: ¿cómo se organiza el estímulo en este bloque?
// Almacenado en sesion_bloques.metodo (text, nullable)
// Ampliable en el futuro con más métodos y estructura visual específica por método.

export const METODOS_BLOQUE = [
  { id: 'series_tradicionales', label: 'Series tradicionales' },
  { id: 'series_alternas',      label: 'Series alternas' },
  { id: 'superserie',           label: 'Superserie' },
  { id: 'triserie',             label: 'Triserie' },
  { id: 'circuito',             label: 'Circuito' },
  { id: 'cluster',              label: 'Cluster' },
  { id: 'contraste_complex',    label: 'Contraste / Complex' },
]
